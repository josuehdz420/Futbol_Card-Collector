/**
 * services/espnService.js
 * --------------------------------------------------
 * Capa de acceso a datos. Consume los endpoints públicos JSON de ESPN
 * (no oficiales, sin API key) y normaliza la respuesta.
 *
 *   Scoreboard: {BASE}/{league}/scoreboard?dates=YYYYMMDD[-YYYYMMDD]
 *   Standings:  https://site.api.espn.com/apis/v2/sports/soccer/{league}/standings
 *               (el /apis/site/v2/.../standings solo devuelve un stub sin tabla)
 *   Summary:    {BASE}/{league}/summary?event={id}
 *
 * Principios (ver informe de diagnóstico):
 *   - Un fallo de ESPN NUNCA se convierte en "lista vacía con success:true".
 *     Se distingue: error (se lanza ApiError con code), respuesta parcial
 *     (meta.partial) y respuesta válida sin eventos (meta.verifiedEmpty).
 *   - Los rangos largos se parten en ventanas pequeñas y con concurrencia
 *     limitada (antes: hasta 60 peticiones simultáneas por liga).
 *   - Si ESPN falla se sirve el último dato bueno como respaldo ("stale").
 *   - Peticiones idénticas concurrentes comparten una sola llamada a ESPN.
 *
 * Variables de entorno opcionales: ESPN_BASE_URL, ESPN_STANDINGS_BASE_URL,
 * ESPN_TIMEOUT_MS, ESPN_MAX_CONCURRENCY, LOG_LEVEL.
 */

const axios = require("axios");
const cache = require("../utils/cache");
const logger = require("../utils/logger");
const { ApiError } = require("../utils/errors");
const {
  COMPETITIONS,
  DEFAULT_LEAGUE,
  isValidLeague,
  isMainLeague
} = require("../config/competitions");

const BASE_URL = process.env.ESPN_BASE_URL || "https://site.api.espn.com/apis/site/v2/sports/soccer";
const STANDINGS_V2_BASE_URL =
  process.env.ESPN_STANDINGS_BASE_URL || "https://site.api.espn.com/apis/v2/sports/soccer";
const TIMEOUT_MS = Number(process.env.ESPN_TIMEOUT_MS) || 10000;
const MAX_CONCURRENCY = Number(process.env.ESPN_MAX_CONCURRENCY) || 6;
const MAX_ATTEMPTS = 2; // 1 intento + 1 reintento (solo errores transitorios)

// Rangos: ventanas de N días y tope de seguridad (se rechaza, no se trunca).
const RANGE_CHUNK_DAYS = 14;
const MAX_RANGE_DAYS = 120;

// Tiempos de vida del cache (ms)
const TTL = {
  TODAY: 30 * 1000, // scoreboard "de hoy": puede haber partidos en vivo
  SCOREBOARD: 60 * 1000, // scoreboard de una fecha / rango
  EMPTY: 60 * 1000, // respuesta válida sin eventos
  PARTIAL: 15 * 1000, // respuesta incompleta: reintentar pronto
  STANDINGS: 10 * 60 * 1000,
  MATCH_LIVE: 20 * 1000,
  MATCH_PRE: 60 * 1000,
  MATCH_FINISHED: 10 * 60 * 1000
};

const http = axios.create({
  timeout: TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    Referer: "https://www.espn.com/"
  }
});

// ---------------------------------------------------------------------------
// Red: limitador de concurrencia + GET con clasificación de errores y logs
// ---------------------------------------------------------------------------

let active = 0;
const waiting = [];
function schedule(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      active++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          if (waiting.length) waiting.shift()();
        });
    };
    active < MAX_CONCURRENCY ? run() : waiting.push(run);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Freno ante bloqueo: si ESPN responde 403/429, seguir insistiendo solo alarga
// el bloqueo. Se pausan TODAS las llamadas a ESPN (2, 4, 8... hasta 15 min) y
// mientras tanto se responde al instante con upstream_blocked (o con el último
// dato bueno si existe). Una respuesta correcta reinicia el contador.
let blockedUntil = 0;
let blockStrikes = 0;

function assertNotBlocked() {
  const left = blockedUntil - Date.now();
  if (left > 0) {
    throw new ApiError(
      `ESPN está bloqueando las peticiones de este servidor (403/429). Pausa automática: reintento en ${Math.ceil(left / 1000)} s`,
      503,
      { code: "upstream_blocked", details: { retryInSeconds: Math.ceil(left / 1000), strikes: blockStrikes } }
    );
  }
}

function registerBlock(status) {
  if (Date.now() < blockedUntil) return; // fallos simultáneos de la misma ráfaga: un solo strike
  blockStrikes++;
  const ms = Math.min(2 * 60 * 1000 * 2 ** (blockStrikes - 1), 15 * 60 * 1000);
  blockedUntil = Date.now() + ms;
  logger.error("espn", "ESPN bloquea las peticiones: se pausan las llamadas", {
    upstreamStatus: status,
    pauseS: Math.round(ms / 1000),
    strikes: blockStrikes
  });
}

/** Convierte cualquier error de axios en un ApiError con code/estado claros. */
function toApiError(raw) {
  if (raw instanceof ApiError) return raw;
  const upstreamStatus = raw.response?.status;
  if (upstreamStatus) {
    if (upstreamStatus === 404) {
      return new ApiError("ESPN respondió 404 (recurso no encontrado)", 404, {
        code: "upstream_not_found",
        details: { upstreamStatus }
      });
    }
    if (upstreamStatus === 429) {
      return new ApiError("ESPN limitó las peticiones (HTTP 429)", 503, {
        code: "upstream_rate_limited",
        details: { upstreamStatus },
        retryable: true
      });
    }
    return new ApiError(`ESPN respondió con error HTTP ${upstreamStatus}`, 502, {
      code: "upstream_http_error",
      details: { upstreamStatus },
      retryable: upstreamStatus >= 500
    });
  }
  if (raw.code === "ECONNABORTED" || raw.code === "ETIMEDOUT") {
    return new ApiError(`ESPN no respondió en ${TIMEOUT_MS} ms (timeout)`, 504, {
      code: "upstream_timeout",
      retryable: true
    });
  }
  return new ApiError(`No se pudo conectar con ESPN (${raw.code || raw.message})`, 502, {
    code: "upstream_unreachable",
    details: { cause: raw.code || null },
    retryable: true
  });
}

/**
 * GET JSON a ESPN. Devuelve { data, ms }. Lanza ApiError clasificado.
 * Reintenta una vez solo ante timeout / conexión / 5xx / 429.
 */
async function fetchJson(url, label, opts = {}) {
  assertNotBlocked();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    try {
      const res = await schedule(() => http.get(url));
      blockStrikes = 0;
      blockedUntil = 0;
      const ms = Date.now() - t0;
      if (!res.data || typeof res.data !== "object") {
        throw new ApiError("ESPN devolvió una respuesta que no es JSON (¿HTML de error?)", 502, {
          code: "upstream_bad_format",
          details: { upstreamStatus: res.status }
        });
      }
      logger.debug("espn", `GET ${label}`, { status: res.status, ms, attempt });
      if (ms > 3000) logger.warn("espn", `Respuesta lenta ${label}`, { status: res.status, ms });
      return { data: res.data, ms };
    } catch (raw) {
      const err = toApiError(raw);
      if (!opts.skipBlockDetection && (err.details?.upstreamStatus === 403 || err.details?.upstreamStatus === 429)) {
        registerBlock(err.details.upstreamStatus);
      }
      logger.warn("espn", `FALLO ${label}`, {
        code: err.code,
        upstreamStatus: err.details?.upstreamStatus,
        ms: Date.now() - t0,
        attempt,
        willRetry: attempt < MAX_ATTEMPTS && err.retryable
      });
      if (attempt < MAX_ATTEMPTS && err.retryable) {
        await sleep(300 + Math.random() * 300);
        continue;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");

function parseYmd(s) {
  if (!/^\d{8}$/.test(String(s))) return null;
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  if (isNaN(d)) return null;
  // Rechaza fechas imposibles que Date "corrige" (20260231 -> 3 de marzo)
  return toYmd(d) === s ? d : null;
}

function toYmd(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function assertDate(dateStr) {
  if (dateStr && !parseYmd(dateStr)) {
    throw new ApiError(`Fecha inválida: "${dateStr}" (formato esperado YYYYMMDD)`, 400, {
      code: "invalid_date"
    });
  }
}

/** Valida y devuelve { from, to, days }. Rechaza (400) en vez de truncar. */
function assertRange(fromStr, toStr) {
  if (!fromStr || !toStr) {
    throw new ApiError("Se requieren los parámetros 'from' y 'to' (YYYYMMDD)", 400, {
      code: "invalid_date_range"
    });
  }
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  if (!from || !to) {
    throw new ApiError(`Rango inválido: from=${fromStr} to=${toStr} (formato YYYYMMDD)`, 400, {
      code: "invalid_date_range"
    });
  }
  if (from > to) {
    throw new ApiError("Rango inválido: 'from' es posterior a 'to'", 400, { code: "invalid_date_range" });
  }
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new ApiError(`Rango demasiado amplio (${days} días; máximo ${MAX_RANGE_DAYS})`, 400, {
      code: "range_too_large"
    });
  }
  return { from, to, days };
}

/** Parte [from,to] en ventanas de `chunkDays` días: [["YYYYMMDD","YYYYMMDD"], ...] */
function splitRange(fromStr, toStr, chunkDays = RANGE_CHUNK_DAYS) {
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  const windows = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + chunkDays - 1);
    if (end > to) end.setTime(to.getTime());
    windows.push([toYmd(start), toYmd(end)]);
    cursor.setUTCDate(cursor.getUTCDate() + chunkDays);
  }
  return windows;
}

function enumerateDates(fromStr, toStr) {
  const out = [];
  const cursor = parseYmd(fromStr);
  const to = parseYmd(toStr);
  while (cursor <= to) {
    out.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** ¿La fecha del evento cae en la ventana (con ±1 día por zonas horarias)? */
function eventInWindow(ev, fromStr, toStr) {
  const t = new Date(ev.date).getTime();
  if (isNaN(t)) return true; // sin fecha fiable: no lo usamos para acusar a ESPN
  const lo = parseYmd(fromStr).getTime() - 86400000;
  const hi = parseYmd(toStr).getTime() + 2 * 86400000;
  return t >= lo && t < hi;
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Normaliza un "event" del scoreboard de ESPN a un objeto de partido simple.
 */
function normalizeEvent(event, leagueId) {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((c) => c.homeAway === "home");
  const away = competition?.competitors?.find((c) => c.homeAway === "away");
  const status = event.status?.type || {};
  const note = competition?.notes?.[0]?.headline || event.season?.slug || null;

  return {
    id: event.id,
    league: leagueId,
    date: event.date,
    round: note,
    status: {
      state: status.state, // "pre" | "in" | "post"
      description: status.description || null, // ej. "Halftime", "Extra Time"
      detail: status.detail, // ej. "FT", "Live - 65'"
      shortDetail: status.shortDetail,
      displayClock: event.status?.displayClock || competition?.status?.displayClock || null,
      isLive: status.state === "in",
      completed: !!status.completed
    },
    venue: competition?.venue?.fullName || null,
    home: home
      ? {
          id: home.team?.id,
          name: home.team?.displayName,
          shortName: home.team?.shortDisplayName,
          logo: home.team?.logo,
          score: home.score ?? null,
          winner: !!home.winner
        }
      : null,
    away: away
      ? {
          id: away.team?.id,
          name: away.team?.displayName,
          shortName: away.team?.shortDisplayName,
          logo: away.team?.logo,
          score: away.score ?? null,
          winner: !!away.winner
        }
      : null
  };
}

/** Valida la forma de un scoreboard. Una respuesta sin `events` ni otras claves de scoreboard es inválida. */
function extractEvents(data, label) {
  if (Array.isArray(data.events)) return data.events;
  if (data.leagues || data.day || data.season) return []; // forma válida de "sin eventos"
  throw new ApiError(`Formato inesperado en scoreboard de ESPN (${label}): falta "events"`, 502, {
    code: "upstream_bad_format"
  });
}

// ---------------------------------------------------------------------------
// Caché "read-through" con respaldo (stale) y dedupe
// ---------------------------------------------------------------------------

function ttlFor(payload, normalTtl) {
  if (payload.partial) return TTL.PARTIAL;
  if (payload.fallback) return Math.max(normalTtl, 5 * 60 * 1000); // modo día a día es caro: se cachea más
  if (Array.isArray(payload.data) && payload.data.length === 0) return TTL.EMPTY;
  return normalTtl;
}

/**
 * loader() -> payload { data, partial, warnings, upstream }.
 * Devuelve { ...payload, source: 'cache'|'espn'|'stale', stale }.
 * Si loader falla y existe un valor previo, se sirve como respaldo.
 */
async function readThrough(key, loader, normalTtl, fixedTtl = null) {
  const hit = cache.get(key);
  if (hit) return { ...hit, source: "cache", stale: false };

  return cache.once(key, async () => {
    try {
      const payload = await loader();
      cache.set(key, payload, fixedTtl ?? ttlFor(payload, normalTtl));
      return { ...payload, source: "espn", stale: false };
    } catch (err) {
      const stale = cache.getStale(key);
      if (stale) {
        logger.warn("cache", "ESPN falló: se sirve respaldo caducado", {
          key,
          code: err.code,
          expiredAgoS: Math.round((Date.now() - stale.expiresAt) / 1000)
        });
        return {
          ...stale.value,
          source: "stale",
          stale: true,
          partial: true,
          warnings: [
            ...(stale.value.warnings || []),
            { code: err.code || "upstream_error", message: err.message }
          ]
        };
      }
      throw err;
    }
  });
}

function assertLeague(leagueId) {
  if (!isValidLeague(leagueId)) {
    throw new ApiError(`Liga no soportada: ${leagueId}`, 400, { code: "invalid_league" });
  }
}

// ---------------------------------------------------------------------------
// Scoreboard (un día)
// ---------------------------------------------------------------------------

async function loadSingleDay(leagueId, dateStr) {
  const url = `${BASE_URL}/${leagueId}/scoreboard${dateStr ? `?dates=${dateStr}` : ""}`;
  const label = `scoreboard ${leagueId} ${dateStr || "today"}`;
  const t0 = Date.now();
  const { data, ms } = await fetchJson(url, label);
  const events = extractEvents(data, label);
  const matches = events.filter((e) => e && e.id).map((e) => normalizeEvent(e, leagueId));
  logger.info("espn", `scoreboard ${leagueId}`, {
    dates: dateStr || "today",
    events: events.length,
    matches: matches.length,
    ms: Date.now() - t0 || ms
  });
  return {
    data: matches,
    partial: false,
    warnings: [],
    upstream: { requests: 1, failed: 0, events: events.length }
  };
}

function getScoreboardDetailed(leagueId = DEFAULT_LEAGUE, dateStr = null) {
  assertLeague(leagueId);
  assertDate(dateStr);
  return readThrough(
    `v2:sb:${leagueId}:${dateStr || "today"}`,
    () => loadSingleDay(leagueId, dateStr),
    dateStr ? TTL.SCOREBOARD : TTL.TODAY
  );
}

// ---------------------------------------------------------------------------
// Scoreboard (rango)
// ---------------------------------------------------------------------------

// TTL de un día suelto según su antigüedad: lo ya jugado casi no cambia, así que
// el modo "día a día" (caro) se amortiza entre ligas, ventanas y refrescos.
function dayTtl(day) {
  const diffDays = Math.round((parseYmd(day) - parseYmd(toYmd(new Date()))) / 86400000);
  if (diffDays < -1) return 30 * 60 * 1000; // pasado
  if (diffDays > 1) return 15 * 60 * 1000; // futuro
  return TTL.SCOREBOARD; // ayer / hoy / mañana
}

/** Eventos crudos de UN día, cacheados (compartidos por todas las ventanas). */
function getDayEvents(leagueId, day) {
  return readThrough(
    `v2:day:${leagueId}:${day}`,
    async () => {
      const label = `scoreboard ${leagueId} ${day}`;
      const { data } = await fetchJson(`${BASE_URL}/${leagueId}/scoreboard?dates=${day}`, label);
      return { data: extractEvents(data, label), partial: false, warnings: [] };
    },
    TTL.SCOREBOARD,
    dayTtl(day)
  );
}

/** Pide día a día las fechas de una ventana (último recurso). Devuelve { events, requests, errors }. */
async function fetchPerDay(leagueId, from, to) {
  const days = enumerateDates(from, to);
  const results = await Promise.allSettled(days.map((d) => getDayEvents(leagueId, d)));
  const events = [];
  const errors = [];
  let requests = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      events.push(...r.value.data);
      if (r.value.source === "espn") requests++;
    } else {
      requests++;
      errors.push({ window: days[i], code: r.reason.code, message: r.reason.message, error: r.reason });
    }
  });
  return { events, requests, errors };
}

// Si ESPN rechaza los RANGOS (400/403) se deja de intentarlos un rato y se va
// directo día a día. Un 403 en un rango NO activa el freno global (las tablas y
// "hoy" pueden seguir funcionando); si el día a día también da 403, ahí sí.
let rangeBypassUntil = 0;

/**
 * Una ventana (<= RANGE_CHUNK_DAYS días). Refuerza día a día si:
 *   - ESPN devuelve eventos FUERA de la ventana (ignoró el rango), o
 *   - ESPN RECHAZA el rango (400/403).
 */
async function fetchWindow(leagueId, from, to) {
  const dates = from === to ? from : `${from}-${to}`;
  const label = `scoreboard ${leagueId} ${dates}`;
  const url = `${BASE_URL}/${leagueId}/scoreboard?dates=${dates}`;

  if (from !== to && Date.now() < rangeBypassUntil) {
    const r = await fetchPerDay(leagueId, from, to);
    if (r.errors.length > 0 && r.events.length === 0 && r.errors.length === enumerateDates(from, to).length) throw r.errors[0].error;
    return { ...r, fallback: "per-day" };
  }

  let data;
  try {
    ({ data } = await fetchJson(url, label, { skipBlockDetection: from !== to }));
  } catch (err) {
    const st = err.details?.upstreamStatus;
    if (from !== to && (st === 400 || st === 403)) {
      rangeBypassUntil = Date.now() + 30 * 60 * 1000;
      logger.warn("espn", `ESPN rechazó el rango (${st}): se pide día a día durante 30 min`, { league: leagueId, window: dates });
      const r = await fetchPerDay(leagueId, from, to);
      if (r.errors.length === r.requests && r.events.length === 0) throw err; // ni día a día respondió
      return { ...r, requests: r.requests + 1, fallback: "per-day" };
    }
    throw err;
  }

  const events = extractEvents(data, label);
  if (from !== to && events.some((ev) => !eventInWindow(ev, from, to))) {
    logger.warn("espn", "ESPN ignoró el rango: se refuerza día a día", { league: leagueId, window: dates, events: events.length });
    const r = await fetchPerDay(leagueId, from, to);
    return { ...r, requests: r.requests + 1, fallback: "per-day" };
  }
  return { events, requests: 1, errors: [] };
}

async function loadRange(leagueId, fromStr, toStr) {
  const t0 = Date.now();
  const windows = splitRange(fromStr, toStr);
  const settled = await Promise.allSettled(windows.map(([f, t]) => fetchWindow(leagueId, f, t)));

  const warnings = [];
  let requests = 0;
  let failed = 0;
  const byId = new Map();
  let rawEvents = 0;
  let dropped = 0;
  let fallback = null;

  settled.forEach((r, i) => {
    const win = `${windows[i][0]}-${windows[i][1]}`;
    if (r.status === "rejected") {
      requests += 1;
      failed += 1;
      warnings.push({ window: win, code: r.reason.code || "upstream_error", message: r.reason.message });
      return;
    }
    requests += r.value.requests;
    if (r.value.fallback) fallback = r.value.fallback;
    failed += r.value.errors.length;
    r.value.errors.forEach(({ window, code, message }) => warnings.push({ window, code, message }));
    for (const ev of r.value.events) {
      rawEvents++;
      if (!ev || !ev.id) {
        dropped++;
        continue;
      }
      if (!byId.has(ev.id)) byId.set(ev.id, ev);
    }
  });

  const failedWindows = settled.filter((r) => r.status === "rejected").length;
  if (failedWindows === windows.length) {
    // Ninguna ventana respondió: es un fallo, no "sin partidos".
    throw settled[0].reason;
  }

  const matches = [...byId.values()]
    .map((ev) => normalizeEvent(ev, leagueId))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const partial = warnings.length > 0;
  logger.info("espn", `range ${leagueId}`, {
    dates: `${fromStr}-${toStr}`,
    windows: windows.length,
    failedWindows,
    events: rawEvents,
    dropped,
    matches: matches.length,
    partial,
    ms: Date.now() - t0
  });

  return { data: matches, partial, warnings, fallback, upstream: { requests, failed, events: rawEvents } };
}

function getScoreboardRangeDetailed(leagueId = DEFAULT_LEAGUE, fromStr, toStr) {
  assertLeague(leagueId);
  assertRange(fromStr, toStr);
  return readThrough(`v2:sb:${leagueId}:${fromStr}-${toStr}`, () => loadRange(leagueId, fromStr, toStr), TTL.SCOREBOARD);
}

// ---------------------------------------------------------------------------
// Todas las competiciones
// ---------------------------------------------------------------------------

/** Combina resultados por liga sin ocultar fallos. Lanza si fallaron todas. */
function aggregate(settled) {
  const ok = settled.filter((s) => s.result.status === "fulfilled");
  const bad = settled.filter((s) => s.result.status === "rejected");

  if (ok.length === 0) {
    const errors = bad.map((b) => ({
      league: b.leagueId,
      code: b.result.reason.code,
      message: b.result.reason.message
    }));
    const sameCode = errors.every((e) => e.code === errors[0].code);
    throw new ApiError(
      `No se pudo obtener datos de ninguna competición (ESPN): ${errors[0].message}`,
      sameCode && errors[0].code === "upstream_timeout" ? 504 : 502,
      { code: "all_sources_failed", details: { errors } }
    );
  }

  const warnings = [];
  const upstream = { requests: 0, failed: 0, events: 0 };
  const data = [];
  let partial = bad.length > 0;
  let anyEspn = false;
  let anyStale = false;

  for (const b of bad) {
    warnings.push({ league: b.leagueId, code: b.result.reason.code, message: b.result.reason.message });
  }
  for (const o of ok) {
    const v = o.result.value;
    data.push(...v.data);
    if (v.partial) partial = true;
    if (v.source === "espn") anyEspn = true;
    if (v.stale) anyStale = true;
    (v.warnings || []).forEach((w) => warnings.push({ league: o.leagueId, ...w }));
    upstream.requests += v.upstream?.requests || 0;
    upstream.failed += v.upstream?.failed || 0;
    upstream.events += v.upstream?.events || 0;
  }
  return {
    data,
    partial,
    warnings,
    upstream,
    stale: anyStale,
    source: anyEspn ? "espn" : anyStale ? "stale" : "cache"
  };
}

async function fanOut(fn) {
  const results = await Promise.allSettled(COMPETITIONS.map((c) => fn(c.id)));
  return aggregate(COMPETITIONS.map((c, i) => ({ leagueId: c.id, result: results[i] })));
}

async function getAllMatchesDetailed(dateStr = null) {
  assertDate(dateStr);
  return fanOut((id) => getScoreboardDetailed(id, dateStr));
}

async function getAllMatchesRangeDetailed(fromStr, toStr) {
  assertRange(fromStr, toStr);
  const res = await fanOut((id) => getScoreboardRangeDetailed(id, fromStr, toStr));
  res.data.sort((a, b) => new Date(a.date) - new Date(b.date));
  return res;
}

/** Partidos EN VIVO: se deriva de los scoreboards de hoy (ya cacheados 30 s por liga). */
async function getLiveMatchesDetailed() {
  const all = await getAllMatchesDetailed();
  return { ...all, data: all.data.filter((m) => m.status.isLive) };
}

// Versiones "solo array" (compatibilidad con código que ya las usaba)
const getScoreboard = async (l, d) => (await getScoreboardDetailed(l, d)).data;
const getScoreboardRange = async (l, f, t) => (await getScoreboardRangeDetailed(l, f, t)).data;
const getAllMatches = async (d) => (await getAllMatchesDetailed(d)).data;
const getAllMatchesRange = async (f, t) => (await getAllMatchesRangeDetailed(f, t)).data;
const getLiveMatches = async () => (await getLiveMatchesDetailed()).data;

// ---------------------------------------------------------------------------
// Detalle de partido: helpers de parseo (sin cambios)
// ---------------------------------------------------------------------------

// --- Extrae SOLO el nombre del jugador desde la prosa editorial de ESPN
// para un evento de gol, sin exponer el resto del texto. Formato típico:
// "Goal! Equipo 1, Equipo 2. Nombre Jugador (Equipo) left footed shot ..."
// Para autogoles ESPN usa un preámbulo distinto ("Own Goal! ...") y a veces
// no incluye el "(Equipo)" después del nombre, así que se prueban varios
// patrones en orden. Si ninguno matchea, devuelve null (nunca la prosa
// completa).
function _extractGoalPlayer(text) {
  if (!text) return null;
  const raw = String(text);
  // Quita el preámbulo del marcador, sea gol normal o autogol.
  const afterScoreline = raw.replace(/^(?:own\s+)?goal!\s*[^.]*\.\s*/i, "");

  // Caso normal / autogol con equipo entre paréntesis: "Nombre (Equipo) ..."
  const withParens = afterScoreline.match(/^([^(]+?)\s*\(/);
  if (withParens) return withParens[1].trim();

  // Autogol narrado sin paréntesis: "Nombre Jugador own goal ..." /
  // "Nombre Jugador scores an own goal ..."
  const ownGoalPhrase = afterScoreline.match(/^([^.]+?)\s+(?:scores?\s+an?\s+)?own[\s-]?goal/i);
  if (ownGoalPhrase) return ownGoalPhrase[1].trim();

  // Autogol narrado como "Own goal by Nombre Jugador."
  const byPhrase = raw.match(/own[\s-]?goal\s+by\s+([^.,]+)/i);
  if (byPhrase) return byPhrase[1].trim();

  return null;
}

// --- Extrae SOLO el nombre de quien dio la asistencia, si ESPN lo incluye
// en la prosa del gol ("... assisted by Nombre Jugador."). Nunca expone el
// resto del texto; si no matchea el patrón, devuelve null. ---
function _extractAssistPlayer(text) {
  if (!text) return null;
  const m = String(text).match(/assisted by\s+([^.,]+)/i);
  return m ? m[1].trim() : null;
}

// --- Extrae SOLO el nombre del jugador amonestado/expulsado desde la
// prosa de un evento de tarjeta. Formatos típicos de ESPN:
// "Yellow Card - Nombre Jugador (Equipo)." o
// "Nombre Jugador (Equipo) is shown the yellow card."
// Nunca expone el resto del texto; si no matchea, devuelve null. ---
function _extractCardPlayer(text) {
  if (!text) return null;
  const dash = String(text).match(/^(?:Yellow|Red)\s*Card\s*-\s*([^(]+?)\s*\(/i);
  if (dash) return dash[1].trim();
  const receives = String(text).match(/^([^(]+?)\s*\([^)]*\)\s*(?:receives|is shown)/i);
  return receives ? receives[1].trim() : null;
}

// --- Detecta si un keyEvent de ESPN es un gol válido. Antes solo se
// aceptaba texto con la palabra "goal", así que penales convertidos que
// ESPN reporta como "Penalty Scored"/"Penalty - Converted" (sin la
// palabra "goal") se perdían aunque el marcador ya los contara. Se
// añaden esas variantes sin tocar la detección existente, y se excluyen
// explícitamente penales fallados/atajados para no generar goles falsos.
function _isScoringEvent(typeText) {
  const t = String(typeText || "");
  if (/goal/i.test(t)) return true; // "Goal", "Own Goal", "Penalty Goal", "Goal - Penalty", etc.
  if (
    /penalty/i.test(t) &&
    /(scored|converted|goal)/i.test(t) &&
    !/(miss|save|block|off\s*target|woodwork)/i.test(t)
  ) {
    return true; // "Penalty Scored", "Penalty - Converted", sin la palabra "goal"
  }
  return false;
}

// --- Extrae los nombres de jugador que entra/sale de un evento de cambio.
// Formato típico: "Substitution, Equipo. Nombre Entra replaces Nombre Sale."
// Si no matchea, devuelve null (nunca la prosa completa).
function _extractSubPlayers(text) {
  if (!text) return null;
  const afterTeam = String(text).replace(/^Substitution,\s*[^.]*\.\s*/i, "");
  const m = afterTeam.match(/^(.+?)\s+replaces\s+(.+?)\.?\s*$/i);
  if (!m) return null;
  return { playerIn: m[1].trim(), playerOut: m[2].trim() };
}

function buildMatchDetail(data, matchId, leagueId) {
      const header = data.header;
      const competition = header?.competitions?.[0];
      const home = competition?.competitors?.find((c) => c.homeAway === "home");
      const away = competition?.competitors?.find((c) => c.homeAway === "away");

      const statusType = header?.competitions?.[0]?.status?.type || {};
      const detail = {
        id: matchId,
        league: leagueId,
        date: header?.competitions?.[0]?.date || null,
        status: {
          state: statusType.state,          // "pre" | "in" | "post"
          completed: !!statusType.completed, // true incluso tras prórroga/penales
          // "description"/"detail" ya vienen bien redactados por ESPN para
          // entretiempo, prórroga y penales (ej. "Halftime", "Extra Time",
          // "Penalty Shoot-out", "Full Time"): no los reconstruimos a mano,
          // así evitamos el bug de mostrar mal esos estados.
          description: statusType.description || null,
          detail: statusType.detail || null,
          shortDetail: statusType.shortDetail || null,
          // Minuto crudo tal como lo entrega ESPN (ej. "38'"), aparte de
          // detail/shortDetail, para tener un tercer valor de respaldo
          // antes de caer en description ("1st Half"/"2nd Half").
          displayClock: header?.competitions?.[0]?.status?.displayClock || null,
          isLive: statusType.state === "in"
        },
        venue: data.gameInfo?.venue?.fullName || null,
        home: home
          ? {
              id: home.team?.id,
              name: home.team?.displayName,
              logo: home.team?.logos?.[0]?.href,
              score: home.score ?? null,
              winner: !!home.winner
            }
          : null,
        away: away
          ? {
              id: away.team?.id,
              name: away.team?.displayName,
              logo: away.team?.logos?.[0]?.href,
              score: away.score ?? null,
              winner: !!away.winner
            }
          : null,
        // Eventos clave: goles, tarjetas, cambios, etc. (feed crudo, si ESPN los provee)
        keyEvents: (data.keyEvents || []).map((ev) => ({
          type: ev.type?.text,
          clock: ev.clock?.displayValue,
          text: ev.text,
          team: ev.team?.displayName || null
        })),
        // Goleadores (subconjunto de keyEvents, ya filtrado, para pintar
        // directo en el marcador sin que el frontend tenga que adivinar
        // qué texto es un gol). Nunca se usa la prosa completa de ESPN como
        // fallback: si no viene "athletesInvolved" se extrae SOLO el nombre
        // del jugador con una regex sobre el texto (ver _extractGoalPlayer).
        scorers: (data.keyEvents || [])
          .filter((ev) => _isScoringEvent(ev.type?.text))
          .map((ev) => ({
            player: ev.athletesInvolved?.[0]?.displayName || _extractGoalPlayer(ev.text) || null,
            assist: ev.athletesInvolved?.[1]?.displayName || _extractAssistPlayer(ev.text) || null,
            clock: ev.clock?.displayValue || null,
            team: ev.team?.displayName || null,
            ownGoal: /own goal/i.test(ev.type?.text || ""),
            penalty: /penalty/i.test(ev.type?.text || "")
          })),
        // Tarjetas (amarilla/roja/doble amarilla), mismo criterio que goles
        // y cambios: nunca se expone la prosa completa de ESPN, solo el
        // nombre del jugador extraído (vía athletesInvolved o regex).
        cards: (data.keyEvents || [])
          .filter((ev) => /(yellow|red)\s*card|second yellow/i.test(ev.type?.text || ""))
          .map((ev) => ({
            player: ev.athletesInvolved?.[0]?.displayName || _extractCardPlayer(ev.text) || null,
            clock: ev.clock?.displayValue || null,
            team: ev.team?.displayName || null,
            red: /red card|second yellow/i.test(ev.type?.text || "")
          })),
        // Cambios (si ESPN los reporta como keyEvent de sustitución). Mismo
        // criterio: si no hay "athletesInvolved" se extraen los dos nombres
        // del texto con regex, nunca se expone la prosa completa.
        substitutions: (data.keyEvents || [])
          .filter((ev) => /subst/i.test(ev.type?.text || ""))
          .map((ev) => {
            const parsed = _extractSubPlayers(ev.text);
            return {
              clock: ev.clock?.displayValue || null,
              team: ev.team?.displayName || null,
              playerIn: ev.athletesInvolved?.[0]?.displayName || parsed?.playerIn || null,
              playerOut: ev.athletesInvolved?.[1]?.displayName || parsed?.playerOut || null
            };
          }),
        // Estadísticas rápidas por equipo (posesión, tiros, duelos, etc.)
        // — el nombre exacto de cada stat lo pone ESPN (`name`/`label`); se
        // deja tal cual para no perder cobertura si varía entre partidos.
        statistics: (data.boxscore?.teams || []).map((t) => ({
          team: t.team?.displayName,
          stats: (t.statistics || []).map((s) => ({
            name: s.name || s.label || null,
            displayName: s.displayName || s.label || s.name || null,
            value: s.displayValue ?? s.value ?? null
          }))
        })),
        // Formaciones / alineaciones si están disponibles
        lineups: data.rosters
          ? data.rosters.map((r) => ({
              team: r.team?.displayName,
              formation: r.formation || null,
              starters: (r.roster || [])
                .filter((p) => !!p.starter)
                .map((p) => ({
                  name: p.athlete?.displayName,
                  position: p.position?.abbreviation || null,
                  jersey: p.jersey || null
                })),
              bench: (r.roster || [])
                .filter((p) => !p.starter)
                .map((p) => ({
                  name: p.athlete?.displayName,
                  position: p.position?.abbreviation || null,
                  jersey: p.jersey || null,
                  subbedIn: (p.subbedIn ?? p.plays?.some?.((pl) => /subst/i.test(pl.type?.text || ""))) || false
                }))
            }))
          : []
      };
  return detail;
}

// ---------------------------------------------------------------------------
// Detalle de partido
// ---------------------------------------------------------------------------

/** Busca en los scoreboards ya cacheados la liga de un partido (sin llamar a ESPN). */
function findLeagueInCache(matchId) {
  for (const [, payload] of cache.entries("v2:sb:")) {
    const m = (payload.data || []).find((x) => String(x.id) === String(matchId));
    if (m) return m.league;
  }
  return null;
}

function matchTtl(detail) {
  if (detail.status?.state === "in") return TTL.MATCH_LIVE;
  if (detail.status?.completed || detail.status?.state === "post") return TTL.MATCH_FINISHED;
  return TTL.MATCH_PRE;
}

/**
 * Detalle de un partido. `leagueHint` (query ?league=) evita probar las 8
 * competiciones. Distingue "no existe" (404) de "ESPN no disponible" (502).
 */
async function getMatchByIdDetailed(matchId, leagueHint = null) {
  if (!/^\d{1,20}$/.test(String(matchId))) {
    throw new ApiError(`Identificador de partido inválido: "${matchId}"`, 400, { code: "invalid_match_id" });
  }
  if (leagueHint) assertLeague(leagueHint);

  const key = `v2:match:${matchId}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, source: "cache", stale: false };

  return cache.once(key, async () => {
    const guess = leagueHint || findLeagueInCache(matchId);
    const order = guess
      ? [guess, ...COMPETITIONS.map((c) => c.id).filter((id) => id !== guess)]
      : COMPETITIONS.map((c) => c.id);

    const failures = [];
    for (const leagueId of order) {
      try {
        const { data } = await fetchJson(
          `${BASE_URL}/${leagueId}/summary?event=${matchId}`,
          `summary ${leagueId} event=${matchId}`
        );
        if (!data.header && !data.boxscore) continue; // esa liga no tiene el partido
        const detail = buildMatchDetail(data, matchId, leagueId);
        const payload = { data: detail, partial: false, warnings: [], upstream: { requests: 1, failed: 0, events: 0 } };
        cache.set(key, payload, matchTtl(detail));
        logger.info("espn", `summary ${leagueId}`, {
          event: matchId,
          keyEvents: detail.keyEvents.length,
          stats: detail.statistics.length,
          lineups: detail.lineups.length,
          viaHint: leagueId === guess
        });
        return { ...payload, source: "espn", stale: false };
      } catch (err) {
        // 404 = esa liga no tiene el partido; cualquier otro error es un fallo real
        if (err.code !== "upstream_not_found") failures.push({ league: leagueId, code: err.code, message: err.message });
      }
    }

    const stale = cache.getStale(key);
    if (stale && failures.length) {
      return { ...stale.value, source: "stale", stale: true, partial: true, warnings: failures };
    }
    if (failures.length) {
      throw new ApiError(
        `No se pudo consultar ESPN para el partido ${matchId}: ${failures[0].message}`,
        502,
        { code: "upstream_unavailable", details: { errors: failures.slice(0, 3) } }
      );
    }
    throw new ApiError(`No se encontró el partido con id ${matchId}`, 404, { code: "match_not_found" });
  });
}

const getMatchById = async (id, hint) => (await getMatchByIdDetailed(id, hint)).data;

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function parseStandings(data) {
  let entries = [];
  if (data.standings?.entries) {
    entries = data.standings.entries.map((e) => ({ ...e, __group: null }));
  } else if (Array.isArray(data.children)) {
    // Ligas con grupos/conferencias (y el formato de /apis/v2) anidan aquí
    data.children.forEach((child) => {
      if (child.standings?.entries) {
        const groupName = data.children.length > 1 ? child.name || child.abbreviation || null : null;
        entries = entries.concat(child.standings.entries.map((e) => ({ ...e, __group: groupName })));
      }
    });
  }
  return entries.map((entry) => {
    const stats = {};
    (entry.stats || []).forEach((s) => {
      stats[s.name] = s.value;
    });
    return {
      team: entry.team?.displayName,
      teamId: entry.team?.id,
      logo: entry.team?.logos?.[0]?.href,
      group: entry.__group,
      rank: stats.rank ?? null,
      played: stats.gamesPlayed ?? null,
      wins: stats.wins ?? null,
      draws: stats.ties ?? null,
      losses: stats.losses ?? null,
      goalsFor: stats.pointsFor ?? null,
      goalsAgainst: stats.pointsAgainst ?? null,
      goalDiff: stats.pointDifferential ?? null,
      points: stats.points ?? null
    };
  });
}

async function loadStandings(leagueId) {
  // 1º el endpoint que sí trae la tabla (/apis/v2); 2º el /apis/site/v2 por si ESPN lo completa.
  const candidates = [
    { name: "v2", url: `${STANDINGS_V2_BASE_URL}/${leagueId}/standings` },
    { name: "site", url: `${BASE_URL}/${leagueId}/standings` }
  ];
  const errors = [];
  let answered = 0;
  for (const c of candidates) {
    try {
      const { data } = await fetchJson(c.url, `standings ${leagueId} (${c.name})`);
      answered++;
      const table = parseStandings(data);
      logger.info("espn", `standings ${leagueId}`, { endpoint: c.name, rows: table.length });
      if (table.length > 0) {
        return { data: table, partial: false, warnings: [], upstream: { requests: answered + errors.length, failed: errors.length, events: 0 } };
      }
    } catch (err) {
      errors.push({ endpoint: c.name, code: err.code, message: err.message });
    }
  }
  if (answered === 0) {
    throw new ApiError(`No se pudo consultar la tabla de ${leagueId}: ${errors[0].message}`, 502, {
      code: "upstream_unavailable",
      details: { errors }
    });
  }
  // ESPN respondió bien pero sin filas.
  if (isMainLeague(leagueId)) {
    throw new ApiError(`ESPN respondió sin tabla de posiciones para ${leagueId}`, 502, {
      code: "standings_empty",
      details: { errors }
    });
  }
  return { data: [], partial: false, warnings: [], upstream: { requests: answered, failed: errors.length, events: 0 } };
}

function getStandingsDetailed(leagueId = DEFAULT_LEAGUE) {
  assertLeague(leagueId);
  return readThrough(`v2:standings:${leagueId}`, () => loadStandings(leagueId), TTL.STANDINGS);
}
const getStandings = async (l) => (await getStandingsDetailed(l)).data;

/** Lista estática de competiciones soportadas (no requiere request externo). */
function getCompetitions() {
  return COMPETITIONS;
}

module.exports = {
  // Con metadatos (usadas por las rutas)
  getScoreboardDetailed,
  getScoreboardRangeDetailed,
  getAllMatchesDetailed,
  getAllMatchesRangeDetailed,
  getLiveMatchesDetailed,
  getMatchByIdDetailed,
  getStandingsDetailed,
  // Solo datos (contrato anterior)
  getScoreboard,
  getScoreboardRange,
  getAllMatches,
  getAllMatchesRange,
  getLiveMatches,
  getMatchById,
  getStandings,
  getCompetitions,
  // Exportadas para pruebas
  _internal: { splitRange, assertRange, parseYmd, parseStandings, resetBreaker: () => { blockedUntil = 0; blockStrikes = 0; rangeBypassUntil = 0; } }
};
