/**
 * services/espnService.js
 * --------------------------------------------------
 * Capa de acceso a datos. Consume los endpoints públicos JSON de ESPN
 * (no oficiales, sin necesidad de API key) y normaliza la respuesta a un
 * formato simple y consistente para nuestra API.
 *
 * Endpoints públicos usados (gratuitos, sin auth):
 *   Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard
 *   Standings:  https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/standings
 *   Summary:    https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={id}
 *
 * Todo el resultado pasa por utils/cache.js para no golpear ESPN en cada
 * request entrante a nuestra propia API.
 */

const axios = require("axios");
const cache = require("../utils/cache");
const { ApiError } = require("../utils/errors");
const { COMPETITIONS, DEFAULT_LEAGUE, isValidLeague } = require("../config/competitions");

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Tiempos de vida del cache (ms)
const TTL = {
  SCOREBOARD: 60 * 1000, // 1 minuto para partidos/resultados generales
  LIVE: 30 * 1000, // 30s para partidos en vivo (se refresca aparte cada 5 min igual)
  STANDINGS: 10 * 60 * 1000, // 10 minutos para tablas (cambian poco)
  MATCH: 30 * 1000 // 30s para detalle de un partido
};

const http = axios.create({
  timeout: 10000,
  headers: {
    // Algunos endpoints públicos de ESPN responden mejor con un User-Agent
    // de navegador normal en vez del default de axios.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  }
});

/**
 * Hace un GET con manejo de errores uniforme.
 */
async function safeGet(url) {
  try {
    const { data } = await http.get(url);
    return data;
  } catch (err) {
    const status = err.response?.status || 502;
    throw new ApiError(`Error consultando fuente de datos (ESPN): ${err.message}`, status);
  }
}

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
      description: status.description || null, // ej. "Halftime", "Extra Time", "Penalty Shoot-out"
      detail: status.detail, // ej. "FT", "Live - 65'"
      shortDetail: status.shortDetail,
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

/**
 * Obtiene el scoreboard (partidos del día / rango) de una liga.
 * ESPN acepta opcionalmente ?dates=YYYYMMDD para un día específico.
 */
async function getScoreboard(leagueId = DEFAULT_LEAGUE, dateStr = null) {
  if (!isValidLeague(leagueId)) {
    throw new ApiError(`Liga no soportada: ${leagueId}`, 400);
  }

  const cacheKey = `scoreboard:${leagueId}:${dateStr || "today"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/${leagueId}/scoreboard`;
  if (dateStr) {
    url += `?dates=${dateStr}`;
  }

  const data = await safeGet(url);
  const events = data.events || [];
  const matches = events.map((ev) => normalizeEvent(ev, leagueId));

  cache.set(cacheKey, matches, TTL.SCOREBOARD);
  return matches;
}

/**
 * Obtiene el scoreboard de una liga para un RANGO de fechas
 * (ESPN soporta ?dates=YYYYMMDD-YYYYMMDD). Esto permite traer partidos
 * de días pasados (resultados/historial) junto con los futuros en una
 * sola consulta. Se cachea por rango.
 */
async function getScoreboardRange(leagueId = DEFAULT_LEAGUE, fromStr, toStr) {
  if (!isValidLeague(leagueId)) {
    throw new ApiError(`Liga no soportada: ${leagueId}`, 400);
  }
  if (!fromStr || !toStr) {
    throw new ApiError("Se requieren los parámetros 'from' y 'to' (YYYYMMDD)", 400);
  }

  const cacheKey = `scoreboard:${leagueId}:${fromStr}-${toStr}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/${leagueId}/scoreboard?dates=${fromStr}-${toStr}`;
  const data = await safeGet(url);
  let events = data.events || [];

  // Algunos endpoints de ESPN ignoran rangos demasiado amplios y devuelven
  // solo el día actual; si detectamos pocos resultados, reforzamos con
  // requests día por día para no perder histórico/futuro.
  if (events.length === 0) {
    const days = _enumerateDates(fromStr, toStr);
    const results = await Promise.allSettled(
      days.map((d) => safeGet(`${BASE_URL}/${leagueId}/scoreboard?dates=${d}`))
    );
    events = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value.events || []);
  }

  // Deduplicar por id (por si el rango y el fallback día-a-día se solapan)
  const seen = new Set();
  const matches = [];
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    matches.push(normalizeEvent(ev, leagueId));
  }

  matches.sort((a, b) => new Date(a.date) - new Date(b.date));

  cache.set(cacheKey, matches, TTL.SCOREBOARD);
  return matches;
}

/**
 * Obtiene partidos de TODAS las competiciones soportadas en un rango de
 * fechas (histórico + futuro combinado y ordenado cronológicamente).
 */
async function getAllMatchesRange(fromStr, toStr) {
  const cacheKey = `matches:all:${fromStr}-${toStr}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = await Promise.allSettled(
    COMPETITIONS.map((c) => getScoreboardRange(c.id, fromStr, toStr))
  );

  const matches = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  cache.set(cacheKey, matches, TTL.SCOREBOARD);
  return matches;
}

/**
 * Genera un array de strings YYYYMMDD entre dos fechas (inclusive).
 * Límite de seguridad: 60 días, para evitar loops gigantes.
 */
function _enumerateDates(fromStr, toStr) {
  const parse = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  const from = parse(fromStr);
  const to = parse(toStr);
  const days = [];
  const cursor = new Date(from);
  let safety = 0;
  while (cursor <= to && safety < 60) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    days.push(`${y}${m}${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    safety++;
  }
  return days;
}

/**
 * Obtiene partidos de TODAS las competiciones soportadas para una fecha
 * (o el día actual de ESPN si no se especifica).
 */
async function getAllMatches(dateStr = null) {
  const cacheKey = `matches:all:${dateStr || "today"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = await Promise.allSettled(
    COMPETITIONS.map((c) => getScoreboard(c.id, dateStr))
  );

  const matches = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  cache.set(cacheKey, matches, TTL.SCOREBOARD);
  return matches;
}

/**
 * Obtiene únicamente los partidos que están EN VIVO ahora mismo,
 * recorriendo todas las competiciones soportadas.
 */
async function getLiveMatches() {
  const cacheKey = "matches:live";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const all = await getAllMatches();
  const live = all.filter((m) => m.status.isLive);

  cache.set(cacheKey, live, TTL.LIVE);
  return live;
}

/**
 * Obtiene el detalle de un partido específico por su ID de ESPN.
 * Como ESPN no permite buscar por ID sin saber la liga, primero intentamos
 * encontrarlo en el cache de "todos los partidos"; si no aparece ahí,
 * probamos contra cada liga soportada (con cache propio) hasta encontrarlo.
 */
async function getMatchById(matchId) {
  const cacheKey = `match:${matchId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. Intentar ubicar la liga del partido a partir de los partidos ya cacheados/recientes
  const all = await getAllMatches();
  const found = all.find((m) => String(m.id) === String(matchId));
  const leagueGuess = found ? found.league : null;

  const leaguesToTry = leagueGuess
    ? [leagueGuess, ...COMPETITIONS.map((c) => c.id).filter((id) => id !== leagueGuess)]
    : COMPETITIONS.map((c) => c.id);

  for (const leagueId of leaguesToTry) {
    try {
      const url = `${BASE_URL}/${leagueId}/summary?event=${matchId}`;
      const data = await safeGet(url);
      if (!data || (!data.header && !data.boxscore)) continue;

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
        // qué texto es un gol).
        scorers: (data.keyEvents || [])
          .filter((ev) => /goal/i.test(ev.type?.text || ""))
          .map((ev) => ({
            player: ev.athletesInvolved?.[0]?.displayName || ev.text?.split(" - ")?.[0] || null,
            clock: ev.clock?.displayValue || null,
            team: ev.team?.displayName || null,
            ownGoal: /own goal/i.test(ev.type?.text || ""),
            penalty: /penalty/i.test(ev.type?.text || "")
          })),
        // Cambios (si ESPN los reporta como keyEvent de sustitución)
        substitutions: (data.keyEvents || [])
          .filter((ev) => /subst/i.test(ev.type?.text || ""))
          .map((ev) => ({
            clock: ev.clock?.displayValue || null,
            team: ev.team?.displayName || null,
            playerIn: ev.athletesInvolved?.[0]?.displayName || null,
            playerOut: ev.athletesInvolved?.[1]?.displayName || null,
            text: ev.text || null
          })),
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

      cache.set(cacheKey, detail, TTL.MATCH);
      return detail;
    } catch (err) {
      // Probamos con la siguiente liga
      continue;
    }
  }

  throw new ApiError(`No se encontró el partido con id ${matchId}`, 404);
}

/**
 * Obtiene la tabla de posiciones de una liga.
 */
async function getStandings(leagueId = DEFAULT_LEAGUE) {
  if (!isValidLeague(leagueId)) {
    throw new ApiError(`Liga no soportada: ${leagueId}`, 400);
  }

  const cacheKey = `standings:${leagueId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/${leagueId}/standings`;
  const data = await safeGet(url);

  // La estructura de standings de ESPN suele venir anidada en children/groups
  let entries = [];

  if (data.standings?.entries) {
    entries = data.standings.entries.map((e) => ({ ...e, __group: null }));
  } else if (Array.isArray(data.children)) {
    // Algunas ligas (ej. con grupos/conferencias, como el Mundial) anidan los standings aquí
    data.children.forEach((child) => {
      if (child.standings?.entries) {
        const groupName = child.name || child.abbreviation || null;
        entries = entries.concat(
          child.standings.entries.map((e) => ({ ...e, __group: groupName }))
        );
      }
    });
  }

  const table = entries.map((entry) => {
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

  cache.set(cacheKey, table, TTL.STANDINGS);
  return table;
}

/**
 * Lista estática de competiciones soportadas (no requiere request externo).
 */
function getCompetitions() {
  return COMPETITIONS;
}

module.exports = {
  getScoreboard,
  getScoreboardRange,
  getAllMatches,
  getAllMatchesRange,
  getLiveMatches,
  getMatchById,
  getStandings,
  getCompetitions
};
