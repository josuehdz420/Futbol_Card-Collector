// Backend propio (Node.js + Express, datos públicos de ESPN).
// En desarrollo corre en localhost:3001 (ver /server). Se puede sobreescribir
// definiendo window.__API_BASE__ antes de cargar este script (ej. en producción).
const WCC_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001';
console.info('[API] Backend en uso:', WCC_BASE);

// --- Catálogo de competiciones (ver server/src/config/competitions.js) ---
// Las 3 competiciones "principales" son las que se siguen a nivel de tabla
// de posiciones / seguimiento de equipos y jugadores. Las "secundarias" son
// copas locales donde participan los mismos clubes (Real Madrid, Barcelona,
// Atlético, Manchester City, Liverpool, Manchester United, etc.) y cuyos
// partidos también se muestran (calendario/resultados/en vivo), pero sin
// tabla de posiciones tipo liga.
const MAIN_LEAGUES = [
  { id: 'esp.1',           name: 'La Liga',              short: 'La Liga',   country: 'España' },
  { id: 'eng.1',            name: 'Premier League',       short: 'Premier',  country: 'Inglaterra' },
  { id: 'uefa.champions',   name: 'UEFA Champions League',short: 'Champions',country: 'Europa' },
];

const SECONDARY_LEAGUES = [
  { id: 'esp.copa_del_rey', name: 'Copa del Rey',          short: 'Copa del Rey',  country: 'España' },
  { id: 'esp.super_cup',    name: 'Supercopa de España',   short: 'Supercopa',     country: 'España' },
  { id: 'eng.fa',           name: 'FA Cup',                short: 'FA Cup',        country: 'Inglaterra' },
  { id: 'eng.league_cup',   name: 'Carabao Cup',           short: 'Carabao Cup',   country: 'Inglaterra' },
  { id: 'eng.charity',      name: 'FA Community Shield',   short: 'Community Shield', country: 'Inglaterra' },
];

const ALL_LEAGUES = [...MAIN_LEAGUES, ...SECONDARY_LEAGUES];
const DEFAULT_LEAGUE = 'esp.1';

function isMainLeague(id) { return MAIN_LEAGUES.some(l => l.id === id); }
function getLeagueMeta(id) { return ALL_LEAGUES.find(l => l.id === id) || null; }
function getLeagueName(id) { return getLeagueMeta(id)?.name || id || ''; }

// Rango de días hacia atrás/adelante que se consulta a la API para traer
// histórico (resultados pasados) + próximos partidos en una sola llamada.
const ESPN_DAYS_BACK = 30;
const ESPN_DAYS_FORWARD = 45;

function _espnDateRangeYYYYMMDD() {
  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const from = new Date(); from.setDate(from.getDate() - ESPN_DAYS_BACK);
  const to   = new Date(); to.setDate(to.getDate() + ESPN_DAYS_FORWARD);
  return { from: fmt(from), to: fmt(to) };
}

// Parte un rango YYYYMMDD en ventanas de N días (ESPN responde mejor a rangos
// cortos y así una ventana caída no tumba el resto).
function _splitYmdRange(from, to, chunkDays = 14) {
  const parse = s => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const fmt = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`; };
  const end = parse(to), out = [];
  for (let t = parse(from); t <= end; t += chunkDays * 86400000) {
    out.push([fmt(t), fmt(Math.min(t + (chunkDays - 1) * 86400000, end))]);
  }
  return out;
}

const API_STATUS = {
  usingMock:        false,
  lastError:        null,
  lastSuccess:      null,
  usedEspnFallback: false, // true si la última respuesta vino del respaldo directo a ESPN (backend propio caído)
};

function localDateStr(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1); return localDateStr(d);
}

function _normalizeSearch(str) {
  return (str || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesSearch(text, q) {
  if (!q) return true;
  return _normalizeSearch(text).includes(_normalizeSearch(q));
}

// --- Escudos de clubes: usamos el logo que ya trae ESPN en cada partido
// (espnMatch.home.logo / .away.logo). Como respaldo (mock / offline) hay un
// pequeño mapa de escudos de los clubes grandes que la app destaca.
const CLUB_CRESTS = {
  'Real Madrid':          'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
  'Barcelona':            'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
  'Atletico Madrid':      'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
  'Atlético de Madrid':   'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
  'Manchester City':      'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
  'Liverpool':            'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
  'Manchester United':    'https://a.espncdn.com/i/teamlogos/soccer/500/360.png',
  'Chelsea':              'https://a.espncdn.com/i/teamlogos/soccer/500/363.png',
  'Arsenal':              'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
  'Tottenham Hotspur':    'https://a.espncdn.com/i/teamlogos/soccer/500/367.png',
};
function getCrestFallback(name) {
  return CLUB_CRESTS[name] || `https://ui-avatars.com/api/?background=141a2b&color=8fa3c4&bold=true&name=${encodeURIComponent((name||'?').slice(0,2))}`;
}

// --- Fase/minuto de un partido, ya traducido a español ---
const _PHASE_LABELS = [
  [/^1st half$/i,                 '1er Tiempo'],
  [/^2nd half$/i,                 '2do Tiempo'],
  [/^halftime$/i,                 'Descanso'],
  [/^half$/i,                     'Descanso'],
  [/^full ?time$/i,               'Final'],
  [/end of extra time/i,          'Fin prórroga'],
  [/extra time.*1st half|extra time.*first half/i, 'Prórroga 1T'],
  [/extra time.*2nd half|extra time.*second half/i, 'Prórroga 2T'],
  [/^extra time$/i,               'Prórroga'],
  [/^overtime$/i,                  'Prórroga'],
  [/overtime.*1st half|overtime.*first half/i, 'Prórroga 1T'],
  [/overtime.*2nd half|overtime.*second half/i, 'Prórroga 2T'],
  [/penalty shoot-?out|^pens?o?$|shootout/i, 'Penales'],
  [/after penalties/i,            'Final (penales)'],
  [/after extra time|^aet$/i,     'Final (prórroga)'],
  [/postponed/i,                  'Aplazado'],
  [/suspended/i,                  'Suspendido'],
  [/cancell?ed/i,                 'Cancelado'],
  [/^ft$/i,                       'Final'],
  [/^ht$/i,                       'Descanso'],
];

function _formatMatchPhase(rawDetail) {
  const desc = String(rawDetail || '').trim();
  if (!desc) return '';
  for (const [re, label] of _PHASE_LABELS) {
    if (re.test(desc)) return label != null ? label : desc;
  }
  if (/^\d+(\+\d+)?'?$/.test(desc)) return desc.endsWith("'") ? desc : `${desc}'`;
  return desc;
}

// --- Normaliza un evento del backend/ESPN (shape de espnService.js) a un
// "match" plano que usa toda la UI (dashboard, predictions, stats, etc). ---
function _normalizeMatch(ev) {
  if (!ev) return null;
  const status = ev.status || {};
  const isFinished = !!status.completed || status.state === 'post';
  const isLive = status.state === 'in' || !!status.isLive;

  let matchStatus = 'scheduled';
  if (isFinished) matchStatus = 'finished';
  else if (isLive) matchStatus = 'live';

  let minute = null;
  if (isLive) minute = _formatMatchPhase(status.detail || status.shortDetail || status.displayClock || status.description) || 'EN VIVO';

  // date/time locales (hora de El Salvador, UTC-6) para calcular estados
  const d = ev.date ? new Date(ev.date) : null;
  let date = '', time = '';
  if (d && !isNaN(d)) {
    const sv = new Date(d.getTime() - 6 * 3600000);
    date = `${sv.getUTCFullYear()}-${String(sv.getUTCMonth()+1).padStart(2,'0')}-${String(sv.getUTCDate()).padStart(2,'0')}`;
    time = `${String(sv.getUTCHours()).padStart(2,'0')}:${String(sv.getUTCMinutes()).padStart(2,'0')}`;
  }

  return {
    id:            String(ev.id),
    league:        ev.league || '',
    competition:   getLeagueName(ev.league),
    home:          ev.home?.name || '',
    away:          ev.away?.name || '',
    homeCrest:     ev.home?.logo || getCrestFallback(ev.home?.name),
    awayCrest:     ev.away?.logo || getCrestFallback(ev.away?.name),
    date,
    time,
    dateRaw:       ev.date || null,
    round:         ev.round || null,
    venue:         ev.venue || '',
    status:        matchStatus,
    scoreHome:     (isLive || isFinished) ? (ev.home?.score != null ? Number(ev.home.score) : null) : null,
    scoreAway:     (isLive || isFinished) ? (ev.away?.score != null ? Number(ev.away.score) : null) : null,
    minute,
  };
}

const API = {

  _memCache: {},
  _init() { this._invalidateOldCache(); },
  _teamsCache: null,

  _TTL: {
    live:      2  * 60 * 1000,
    upcoming:  5  * 60 * 1000,
    standings: 5  * 60 * 1000,
    finished:  10 * 60 * 1000,
    default:   5  * 60 * 1000,
  },

  _ttlFor(key) {
    if (key.startsWith('live'))      return this._TTL.live;
    if (key.startsWith('upcoming'))  return this._TTL.upcoming;
    if (key.startsWith('standings')) return this._TTL.standings;
    if (key.startsWith('finished'))  return this._TTL.finished;
    return this._TTL.default;
  },

  _memGet(key) {
    const e = this._memCache[key];
    if (!e) return null;
    if (Date.now() - e.ts > this._ttlFor(key)) { delete this._memCache[key]; return null; }
    return e.data;
  },
  _memSet(key, data) { this._memCache[key] = { data, ts: Date.now() }; return data; },

  _CACHE_VERSION: 'clubs_v1',

  _lsCacheKey(key) { return `wcc_cache_${this._CACHE_VERSION}_${key}`; },

  _invalidateOldCache() {
    try {
      const prefix = 'wcc_cache_';
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix) && !k.startsWith(`${prefix}${this._CACHE_VERSION}_`))
        .forEach(k => localStorage.removeItem(k));
    } catch(_) {}
  },

  _lsGet(key) {
    try {
      const raw = localStorage.getItem(this._lsCacheKey(key));
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > this._ttlFor(key)) { localStorage.removeItem(this._lsCacheKey(key)); return null; }
      return data;
    } catch(_) { return null; }
  },
  _lsSet(key, data) {
    try { localStorage.setItem(this._lsCacheKey(key), JSON.stringify({ data, ts: Date.now() })); } catch(_) {}
    return data;
  },

  // opts.timeoutMs: timeout por intento (default 25s: el plan gratis de Render
  // puede tardar 30-50s en "despertar" tras estar inactivo).
  // opts.retries: reintentos adicionales tras el primer intento (default 1).
  // Devuelve el JSON o null. El motivo del fallo queda en API_STATUS.lastError
  // ('timeout' | 'http' | 'format' | 'network') y en la consola.
  async _fetch(url, headers = {}, opts = {}) {
    const { timeoutMs = 25000, retries = 1, retryDelayMs = 2000 } = opts;
    const shortUrl = url.replace(WCC_BASE, '');

    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let kind = 'network', retryable = true;
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        if (!res.ok) {
          kind = 'http'; retryable = res.status >= 500;
          // Nuestro backend responde { success:false, error, code }: lo mostramos
          const body = await res.json().catch(() => null);
          throw new Error(`HTTP ${res.status}${body?.code ? ' ' + body.code : ''}${body?.error ? ' - ' + body.error : ''}`);
        }
        let data;
        try { data = await res.json(); }
        catch (_) { kind = 'format'; throw new Error('la respuesta no es JSON (¿HTML de error o proxy?)'); }
        return data;
      } catch (err) {
        if (err.name === 'AbortError') kind = 'timeout';
        const isLastAttempt = attempt === retries || !retryable;
        console.warn('[API]', shortUrl, `- intento ${attempt + 1}/${retries + 1} falló (${kind}):`, err.message);
        if (!isLastAttempt) { await new Promise(r => setTimeout(r, retryDelayMs)); continue; }
        API_STATUS.lastError = kind;
        return null;
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  },

  // --- Respaldo de EMERGENCIA: consulta directa a ESPN desde el navegador,
  // solo si nuestro propio backend falla incluso tras reintentar. ---
  ESPN_DIRECT_BASE: 'https://site.api.espn.com/apis/site/v2/sports/soccer',

  async _fetchEspnDirect(url, timeoutMs = 12000) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res   = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(err) {
      console.warn('[API][ESPN fallback]', url.split('?')[0], '-', err.message);
      return null;
    }
  },

  _normalizeEspnEventDirect(event, leagueId) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home');
    const away = competition?.competitors?.find(c => c.homeAway === 'away');
    const status = event.status?.type || {};
    const note = competition?.notes?.[0]?.headline || event.season?.slug || null;
    return {
      id: event.id, league: leagueId, date: event.date, round: note,
      status: {
        state: status.state, description: status.description || null,
        detail: status.detail, shortDetail: status.shortDetail,
        displayClock: competition?.status?.displayClock || null,
        isLive: status.state === 'in', completed: !!status.completed,
      },
      venue: competition?.venue?.fullName || null,
      home: home ? { id: home.team?.id, name: home.team?.displayName, logo: home.team?.logo, score: home.score ?? null, winner: !!home.winner } : null,
      away: away ? { id: away.team?.id, name: away.team?.displayName, logo: away.team?.logo, score: away.score ?? null, winner: !!away.winner } : null,
    };
  },

  // Consulta directa a ESPN por ventanas de 14 días. Devuelve array (puede ser
  // vacío si ESPN respondió sin eventos) o null si NINGUNA ventana respondió.
  async _fetchEspnGamesDirect(leagueId, fromStr, toStr) {
    const windows = _splitYmdRange(fromStr, toStr);
    const results = await Promise.all(windows.map(([f, t]) =>
      this._fetchEspnDirect(`${this.ESPN_DIRECT_BASE}/${leagueId}/scoreboard?dates=${f}-${t}`)));
    const okResults = results.filter(r => r && Array.isArray(r.events));
    if (okResults.length === 0) return null;
    if (okResults.length < results.length) {
      console.warn(`[API][ESPN directo] ${leagueId}: respuesta parcial (${okResults.length}/${results.length} ventanas)`);
    }
    const seen = new Set(), out = [];
    for (const r of okResults) for (const ev of r.events) {
      if (!ev || !ev.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      out.push(this._normalizeEspnEventDirect(ev, leagueId));
    }
    return out;
  },

  // --- Trae partidos de UNA liga (rango histórico + futuro).
  // Devuelve: array de partidos (vacío SOLO si está confirmado que no hay) o
  // null si no se pudo obtener de ninguna fuente. Peticiones simultáneas y
  // repetidas (<30s) comparten resultado: antes live/upcoming/finished/
  // teamMatches pedían cada uno las 8 ligas por separado.
  _leagueInflight: {},
  _leagueMemo: {},
  _LEAGUE_MEMO_MS: 30 * 1000,

  _fetchLeagueMatches(leagueId) {
    const memo = this._leagueMemo[leagueId];
    if (memo && Date.now() - memo.ts < this._LEAGUE_MEMO_MS) return Promise.resolve(memo.data);
    if (this._leagueInflight[leagueId]) return this._leagueInflight[leagueId];
    const p = this._loadLeagueMatches(leagueId)
      .then(data => { if (data) this._leagueMemo[leagueId] = { data, ts: Date.now() }; return data; })
      .finally(() => { delete this._leagueInflight[leagueId]; });
    this._leagueInflight[leagueId] = p;
    return p;
  },

  async _loadLeagueMatches(leagueId) {
    const { from, to } = _espnDateRangeYYYYMMDD();
    const t0 = performance.now();
    const data = await this._fetch(`${WCC_BASE}/matches?league=${leagueId}&from=${from}&to=${to}`);

    if (data && data.success && Array.isArray(data.data)) {
      const meta = data.meta || null;       // backends antiguos no envían meta
      const list = data.data;
      if (meta && (meta.partial || meta.stale)) {
        console.warn(`[API] ${leagueId}: datos ${meta.stale ? 'de respaldo (ESPN falló)' : 'parciales'}`, meta.warnings);
      }
      // Con partidos, o vacío CONFIRMADO por el backend (ESPN respondió bien a todo): se acepta.
      if (list.length > 0 || (meta && meta.verifiedEmpty)) {
        API_STATUS.usedEspnFallback = false;
        console.info(`[API] ${leagueId}: ${list.length} partidos (${meta?.source || 'backend'}, ${Math.round(performance.now() - t0)}ms)`);
        return list.map(_normalizeMatch).filter(Boolean);
      }
      // Vacío NO confirmado (backend antiguo sin meta, o parcial/respaldo sin datos): contrastar con ESPN.
      console.warn(`[API] ${leagueId}: backend devolvió 0 partidos sin confirmar -> contrastando con ESPN directo`);
      const direct = await this._fetchEspnGamesDirect(leagueId, from, to);
      if (direct && direct.length > 0) {
        API_STATUS.usedEspnFallback = true;
        console.warn(`[API] ${leagueId}: ESPN directo SÍ tenía ${direct.length} partidos (el backend devolvió vacío)`);
        return direct.map(_normalizeMatch).filter(Boolean);
      }
      if (direct) return [];                 // ESPN directo también confirma: no hay partidos
      return meta ? null : [];               // no se pudo contrastar: con meta parcial es fallo; sin meta, se acepta
    }

    console.warn(`[API] Backend propio no disponible (${leagueId}), probando ESPN directo...`);
    const direct = await this._fetchEspnGamesDirect(leagueId, from, to);
    if (direct === null) {
      console.error(`[API] ${leagueId}: sin datos de ninguna fuente (backend: ${API_STATUS.lastError || 'error'}, ESPN directo: sin respuesta)`);
      return null;
    }
    API_STATUS.usedEspnFallback = true;
    API_STATUS.lastError = null;
    return direct.map(_normalizeMatch).filter(Boolean);
  },

  // --- Trae partidos de TODAS las competiciones soportadas (principales +
  // secundarias) en un solo array, combinado y ordenado. ---
  // Devuelve el array combinado, o null si NINGUNA competición respondió
  // (así Cache.swr conserva los datos buenos en vez de pisarlos con []).
  async _fetchAllLeaguesMatches() {
    const results = await Promise.all(ALL_LEAGUES.map(l => this._fetchLeagueMatches(l.id).catch(() => null)));
    const ok = results.filter(r => Array.isArray(r));
    if (ok.length === 0) {
      API_STATUS.lastError = API_STATUS.lastError || 'network';
      console.error('[API] Ninguna competición respondió (backend y ESPN directo fallaron)');
      return null;
    }
    if (ok.length < results.length) {
      console.warn(`[API] Datos parciales: respondieron ${ok.length}/${results.length} competiciones`);
    }
    API_STATUS.lastError = null;
    return ok.flat()
      .sort((a, b) => ((a.date||'')+(a.time||'')) < ((b.date||'')+(b.time||'')) ? -1 : 1);
  },

  // --- Competiciones ---
  getLeagues()          { return ALL_LEAGUES; },
  getMainLeagues()       { return MAIN_LEAGUES; },
  getSecondaryLeagues()  { return SECONDARY_LEAGUES; },
  getLeagueName(id)      { return getLeagueName(id); },
  isMainLeague(id)       { return isMainLeague(id); },
  getDefaultLeague()     { return DEFAULT_LEAGUE; },

  async getCompetitions() {
    const mem = this._memGet('competitions');
    if (mem) return mem;
    const data = await this._fetch(`${WCC_BASE}/competitions`);
    if (data && data.success) return this._memSet('competitions', data.data);
    return this._memSet('competitions', ALL_LEAGUES);
  },

  // --- Partidos EN VIVO (todas las competiciones) ---
  async _fetchLiveFromNetwork() {
    const all = await this._fetchAllLeaguesMatches();
    if (!all) return null;
    const live = all.filter(m => m.status === 'live');
    API_STATUS.usingMock = false;
    return live;
  },

  async getLiveMatches() {
    const result = await Cache.swr('live', () => this._fetchLiveFromNetwork(), { ttl: this._TTL.live });
    if (result) return result;
    API_STATUS.usingMock = false;
    return [];
  },

  // --- Próximos partidos + histórico reciente (todas las competiciones,
  // o filtrado por liga si se especifica) ---
  async _fetchUpcomingFromNetwork(leagueId = null) {
    const yestStr = yesterdayStr();
    const all = leagueId ? await this._fetchLeagueMatches(leagueId) : await this._fetchAllLeaguesMatches();
    if (!all) return null;
    const mapped = all
      .filter(m => m.date >= yestStr)
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return  1;
        return ((a.date||'')+(a.time||'')) < ((b.date||'')+(b.time||'')) ? -1 : 1;
      });
    API_STATUS.usingMock = false;
    return mapped;
  },

  async getUpcomingMatches(leagueId = null) {
    const cacheKey = leagueId ? `upcoming_${leagueId}` : 'upcoming';
    const result = await Cache.swr(cacheKey, () => this._fetchUpcomingFromNetwork(leagueId), { ttl: this._TTL.upcoming });
    if (result) return result;
    API_STATUS.usingMock = false;
    return [];
  },

  // --- Partidos finalizados (para calcular tablas propias si hiciera falta) ---
  async _fetchFinishedFromNetwork(leagueId = null) {
    const all = leagueId ? await this._fetchLeagueMatches(leagueId) : await this._fetchAllLeaguesMatches();
    if (!all) return null;
    const finished = all
      .filter(m => m.status === 'finished')
      .sort((a, b) => (b.date||'') > (a.date||'') ? 1 : -1);
    API_STATUS.usingMock = false;
    return finished;
  },

  async getFinishedMatches(leagueId = null) {
    const cacheKey = leagueId ? `finished_${leagueId}` : 'finished';
    const result = await Cache.swr(cacheKey, () => this._fetchFinishedFromNetwork(leagueId), { ttl: this._TTL.finished });
    if (result) return result;
    API_STATUS.usingMock = false;
    return [];
  },

  // --- Tabla de posiciones de una liga (por defecto La Liga) ---
  // Tabla directa de ESPN (endpoint /apis/v2: el /apis/site/v2 no trae tabla).
  ESPN_STANDINGS_DIRECT_BASE: 'https://site.api.espn.com/apis/v2/sports/soccer',

  async _fetchEspnStandingsDirect(leagueId) {
    const data = await this._fetchEspnDirect(`${this.ESPN_STANDINGS_DIRECT_BASE}/${leagueId}/standings`);
    if (!data) return null;
    const entries = data.standings?.entries
      || (data.children || []).flatMap(ch => ch.standings?.entries || []);
    return entries.map(e => {
      const st = {};
      (e.stats || []).forEach(x => { st[x.name] = x.value; });
      return {
        team: e.team?.displayName, logo: e.team?.logos?.[0]?.href, group: null,
        rank: st.rank, played: st.gamesPlayed, wins: st.wins, draws: st.ties, losses: st.losses,
        goalsFor: st.pointsFor, goalsAgainst: st.pointsAgainst, points: st.points,
      };
    });
  },

  // Devuelve filas, o null si no hay tabla (un [] nunca se guarda en caché).
  async _fetchStandingsFromNetwork(leagueId) {
    const data = await this._fetch(`${WCC_BASE}/standings?league=${leagueId}`);
    let rows = (data && data.success && Array.isArray(data.data)) ? data.data : null;
    if (!rows || rows.length === 0) {
      console.warn(`[API] standings ${leagueId}: backend ${rows ? 'devolvió tabla vacía' : 'no disponible'} -> ESPN directo`);
      const direct = await this._fetchEspnStandingsDirect(leagueId);
      if (direct && direct.length > 0) { rows = direct; API_STATUS.usedEspnFallback = true; }
    }
    if (!rows || rows.length === 0) return null;
    API_STATUS.usingMock = false;
    return rows.map(row => ({
      pos:  row.rank || 0,
      team: row.team || '',
      crest: row.logo || getCrestFallback(row.team),
      group: row.group || null,
      pj: row.played || 0, w: row.wins || 0, d: row.draws || 0, l: row.losses || 0,
      gf: row.goalsFor || 0, gc: row.goalsAgainst || 0, pts: row.points || 0,
    }));
  },

  async getStandings(leagueId = DEFAULT_LEAGUE) {
    const cacheKey = `standings_${leagueId}`;
    const result = await Cache.swr(cacheKey, () => this._fetchStandingsFromNetwork(leagueId), { ttl: this._TTL.standings });
    if (result) return result;
    API_STATUS.usingMock = false;
    return [];
  },

  // --- Equipos: se derivan de la tabla de posiciones de una liga ---
  async getTeams(leagueId = DEFAULT_LEAGUE, query = '') {
    const standings = await this.getStandings(leagueId).catch(() => []);
    const teams = (standings || []).map(s => ({
      id:    'club_' + _normalizeSearch(s.team).replace(/\s+/g, '_'),
      name:  s.team,
      crest: s.crest,
      league: leagueId,
      pj: s.pj, w: s.w, d: s.d, l: s.l, gf: s.gf, gc: s.gc, pts: s.pts, pos: s.pos,
    }));
    this._teamsCache = teams;
    if (!query) return teams;
    return teams.filter(t => matchesSearch(t.name||'', query));
  },

  // --- Todos los clubes conocidos (unión de las 3 tablas principales),
  // útil para el buscador general de la pestaña Estadísticas. ---
  async getAllKnownTeams() {
    const mem = this._memGet('allKnownTeams');
    if (mem) return mem;
    const lists = await Promise.all(MAIN_LEAGUES.map(l => this.getTeams(l.id).catch(() => [])));
    const seen = new Map();
    lists.flat().forEach(t => {
      const key = _normalizeSearch(t.name);
      if (!seen.has(key)) seen.set(key, t);
    });
    return this._memSet('allKnownTeams', Array.from(seen.values()));
  },

  // --- Partidos de un club concreto, en cualquiera de las competiciones
  // soportadas (liga + copas locales que le apliquen). ---
  async getTeamMatches(teamName) {
    const cacheKey = `team_matches_${teamName}`;
    const mem = this._memGet(cacheKey);
    if (mem) return mem;

    const tn = _normalizeSearch(teamName);
    const all = await this._fetchAllLeaguesMatches();
    if (!all) return { played: [], upcoming: [] };   // sin datos: no se cachea
    const played   = all.filter(m => m.status === 'finished' && (_normalizeSearch(m.home).includes(tn) || _normalizeSearch(m.away).includes(tn)));
    const upcoming = all.filter(m => m.status !== 'finished'  && (_normalizeSearch(m.home).includes(tn) || _normalizeSearch(m.away).includes(tn)));

    return this._memSet(cacheKey, { played, upcoming });
  },

  // --- Estado temporal de un partido (para predicciones y badges) ---
  _venueOffset() { return '-06:00'; }, // Hora de El Salvador (UTC-6)

  _MATCH_MAX_DURATION_MIN: 200,

  getMatchState(m) {
    if (m.status === 'live')     return 'live';
    if (m.status === 'finished') return 'finished';
    if (!m.date || !m.time)      return 'upcoming';
    const offset  = this._venueOffset(m.venue);
    const matchTs = new Date(`${m.date}T${m.time}:00${offset}`).getTime();
    const diffMin = (Date.now() - matchTs) / 60000;
    if (diffMin > this._MATCH_MAX_DURATION_MIN) return 'finished';
    if (diffMin > 0)   return 'live';
    if (diffMin > -60) return 'closed';
    if (diffMin > -180) return 'starting_soon';
    return 'upcoming';
  },

  getTimeUntilMatch(m) {
    if (!m.date || !m.time) return '';
    const offset  = this._venueOffset(m.venue);
    const diffMs = new Date(`${m.date}T${m.time}:00${offset}`).getTime() - Date.now();
    if (diffMs <= 0) return '';
    const h   = Math.floor(diffMs / 3600000);
    const min = Math.floor((diffMs % 3600000) / 60000);
    if (h >= 24) { const d = Math.floor(h/24); return `En ${d}d ${h%24}h`; }
    if (h > 0)   return `En ${h}h ${min}m`;
    return `En ${min}m`;
  },

  // --- Partidos disponibles para el sistema de predicciones (todas las
  // competiciones, próximos o recién cerrados) ---
  async getPredictableMatches() {
    const yestStr = yesterdayStr();
    try {
      const all = await this.getUpcomingMatches();
      if (all?.length > 0) {
        return all
          .filter(m => (m.date||'') >= yestStr)
          .sort((a,b) => ((a.date||'')+(a.time||'')) < ((b.date||'')+(b.time||'')) ? -1 : 1);
      }
    } catch(_) {}
    return [];
  },

  // --- Detalle enriquecido de un partido (goleadores, alineaciones, etc) ---
  async _fetchEspnMatchDetailDirect(leagueId, matchId) {
    const url = `${this.ESPN_DIRECT_BASE}/${leagueId}/summary?event=${matchId}`;
    const data = await this._fetchEspnDirect(url);
    if (!data || (!data.header && !data.boxscore)) return null;
    return this._parseRawDetail(data, matchId, leagueId);
  },

  _extractGoalPlayer(text) {
    if (!text) return null;
    const raw = String(text);
    const afterScoreline = raw.replace(/^(?:own\s+)?goal!\s*[^.]*\.\s*/i, '');
    const withParens = afterScoreline.match(/^([^(]+?)\s*\(/);
    if (withParens) return withParens[1].trim();
    const ownGoalPhrase = afterScoreline.match(/^([^.]+?)\s+(?:scores?\s+an?\s+)?own[\s-]?goal/i);
    if (ownGoalPhrase) return ownGoalPhrase[1].trim();
    const byPhrase = raw.match(/own[\s-]?goal\s+by\s+([^.,]+)/i);
    if (byPhrase) return byPhrase[1].trim();
    return null;
  },
  _extractAssistPlayer(text) {
    if (!text) return null;
    const m = String(text).match(/assisted by\s+([^.,]+)/i);
    return m ? m[1].trim() : null;
  },
  _extractCardPlayer(text) {
    if (!text) return null;
    const dash = String(text).match(/^(?:Yellow|Red)\s*Card\s*-\s*([^(]+?)\s*\(/i);
    if (dash) return dash[1].trim();
    const receives = String(text).match(/^([^(]+?)\s*\([^)]*\)\s*(?:receives|is shown)/i);
    return receives ? receives[1].trim() : null;
  },
  _extractSubPlayers(text) {
    if (!text) return null;
    const afterTeam = String(text).replace(/^Substitution,\s*[^.]*\.\s*/i, '');
    const m = afterTeam.match(/^(.+?)\s+replaces\s+(.+?)\.?\s*$/i);
    if (!m) return null;
    return { playerIn: m[1].trim(), playerOut: m[2].trim() };
  },
  _isScoringEvent(typeText) {
    const t = String(typeText || '');
    if (/goal/i.test(t)) return true;
    if (/penalty/i.test(t) && /(scored|converted|goal)/i.test(t) && !/(miss|save|block|off\s*target|woodwork)/i.test(t)) return true;
    return false;
  },

  _parseRawDetail(data, matchId, leagueId) {
    const header = data.header;
    const competition = header?.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home');
    const away = competition?.competitors?.find(c => c.homeAway === 'away');
    const statusType = competition?.status?.type || {};
    const isFinished = !!statusType.completed || statusType.state === 'post';
    const isLive = statusType.state === 'in';
    const phase = (isLive || isFinished)
      ? _formatMatchPhase(statusType.detail || statusType.shortDetail || competition?.status?.displayClock || statusType.description)
      : '';

    return {
      id: matchId,
      league: leagueId,
      competition: getLeagueName(leagueId),
      home: home?.team?.displayName || '',
      away: away?.team?.displayName || '',
      homeCrest: home?.team?.logos?.[0]?.href || getCrestFallback(home?.team?.displayName),
      awayCrest: away?.team?.logos?.[0]?.href || getCrestFallback(away?.team?.displayName),
      venue: data.gameInfo?.venue?.fullName || '',
      status: isFinished ? 'finished' : (isLive ? 'live' : 'scheduled'),
      phase,
      scoreHome: home?.score != null ? Number(home.score) : null,
      scoreAway: away?.score != null ? Number(away.score) : null,
      scorers: (data.keyEvents || [])
        .filter(ev => this._isScoringEvent(ev.type?.text))
        .map(ev => ({
          player: ev.athletesInvolved?.[0]?.displayName || this._extractGoalPlayer(ev.text) || null,
          assist: ev.athletesInvolved?.[1]?.displayName || this._extractAssistPlayer(ev.text) || null,
          clock: ev.clock?.displayValue || null,
          team: ev.team?.displayName || null,
          ownGoal: /own goal/i.test(ev.type?.text || ''),
          penalty: /penalty/i.test(ev.type?.text || ''),
        })),
      cards: (data.keyEvents || [])
        .filter(ev => /(yellow|red)\s*card|second yellow/i.test(ev.type?.text || ''))
        .map(ev => ({
          player: ev.athletesInvolved?.[0]?.displayName || this._extractCardPlayer(ev.text) || null,
          clock: ev.clock?.displayValue || null,
          team: ev.team?.displayName || null,
          red: /red card|second yellow/i.test(ev.type?.text || ''),
        })),
      substitutions: (data.keyEvents || [])
        .filter(ev => /subst/i.test(ev.type?.text || ''))
        .map(ev => {
          const parsed = this._extractSubPlayers(ev.text);
          return {
            clock: ev.clock?.displayValue || null, team: ev.team?.displayName || null,
            playerIn: ev.athletesInvolved?.[0]?.displayName || parsed?.playerIn || null,
            playerOut: ev.athletesInvolved?.[1]?.displayName || parsed?.playerOut || null,
            text: ev.text || null,
          };
        }),
      statistics: (data.boxscore?.teams || []).map(t => ({
        team: t.team?.displayName,
        stats: (t.statistics || []).map(s => ({
          name: s.name || s.label || null,
          displayName: s.displayName || s.label || s.name || null,
          value: s.displayValue ?? s.value ?? null,
        })),
      })),
      lineups: data.rosters ? data.rosters.map(r => ({
        team: r.team?.displayName,
        formation: r.formation || null,
        starters: (r.roster || []).filter(p => !!p.starter).map(p => ({ name: p.athlete?.displayName, position: p.position?.abbreviation || null, jersey: p.jersey || null })),
        bench: (r.roster || []).filter(p => !p.starter).map(p => ({ name: p.athlete?.displayName, position: p.position?.abbreviation || null, jersey: p.jersey || null })),
      })) : [],
    };
  },

  async getMatchDetail(matchId, leagueHint = null) {
    const cacheKey = `match_detail_${matchId}`;
    const mem = this._memGet(cacheKey);
    if (mem) return mem;

    let raw = null;
    try {
      const lg = leagueHint ? `?league=${encodeURIComponent(leagueHint)}` : '';
      const data = await this._fetch(`${WCC_BASE}/match/${matchId}${lg}`, {}, { retries: 1 });
      if (data && data.success && data.data) raw = data.data;
    } catch(_) {}

    if (raw) {
      const home = raw.home, away = raw.away;
      const status = raw.status || {};
      const isFinished = !!status.completed || status.state === 'post';
      const isLive = status.state === 'in';
      const phase = (isLive || isFinished)
        ? _formatMatchPhase(status.detail || status.shortDetail || status.displayClock || status.description)
        : '';
      const mapped = {
        id: matchId,
        league: raw.league || leagueHint || '',
        competition: getLeagueName(raw.league || leagueHint),
        home: home?.name || '', away: away?.name || '',
        homeCrest: home?.logo || getCrestFallback(home?.name),
        awayCrest: away?.logo || getCrestFallback(away?.name),
        venue: raw.venue || '',
        status: isFinished ? 'finished' : (isLive ? 'live' : 'scheduled'),
        phase,
        scoreHome: home?.score != null ? Number(home.score) : null,
        scoreAway: away?.score != null ? Number(away.score) : null,
        scorers: raw.scorers || [], substitutions: raw.substitutions || [],
        cards: raw.cards || [], statistics: raw.statistics || [], lineups: raw.lineups || [],
      };
      return this._memSet(cacheKey, mapped, 60);
    }

    // Backend caído: probamos ESPN directo, probando cada liga soportada.
    console.warn('[API] Backend propio no disponible para el detalle, probando ESPN directo...');
    const leaguesToTry = leagueHint ? [leagueHint, ...ALL_LEAGUES.map(l=>l.id).filter(id=>id!==leagueHint)] : ALL_LEAGUES.map(l=>l.id);
    for (const lg of leaguesToTry) {
      const detail = await this._fetchEspnMatchDetailDirect(lg, matchId);
      if (detail) return this._memSet(cacheKey, detail, 60);
    }

    // Último recurso: lo básico que ya tengamos en la lista de partidos.
    const all = await this.getUpcomingMatches();
    const basic = all.find(m => m.id === String(matchId));
    if (!basic) return null;
    return this._memSet(cacheKey, { ...basic, phase: basic.minute || '', scorers: [], substitutions: [], cards: [], statistics: [], lineups: [] }, 30);
  },

  // --- Forzar actualización de todos los datos ---
  async forceRefresh() {
    this._memCache  = {};
    this._leagueMemo = {};
    this._teamsCache = null;
    API_STATUS.lastError = null;
    this._invalidateOldCache();

    if (typeof Cache !== 'undefined') {
      const keys = ['live', 'upcoming', 'finished',
        ...ALL_LEAGUES.flatMap(l => [`upcoming_${l.id}`, `finished_${l.id}`]),
        ...MAIN_LEAGUES.map(l => `standings_${l.id}`)];
      await Cache.invalidateAll(keys);
    }

    try {
      const [live, upcoming, finished, standings] = await Promise.all([
        this.getLiveMatches(),
        this.getUpcomingMatches(),
        this.getFinishedMatches(),
        this.getStandings(DEFAULT_LEAGUE),
      ]);
      const apiConnected = (upcoming?.length || 0) > 0;
      API_STATUS.usingMock = !apiConnected;
      return { live, upcoming, standings, finished, source: apiConnected ? 'espn-api' : (API_STATUS.lastError ? 'network_error' : 'sin_datos') };
    } catch(err) {
      API_STATUS.lastError = 'network';
      return { live:[], upcoming:[], standings:[], finished:[], source:'network_error' };
    }
  },

  _pausedTimers: [],
  pauseWhenHidden() {
    if (this._visibilityBound) return;
    this._visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._pausedTimers.forEach(t => { if (t.id) { clearInterval(t.id); t.id=null; } });
      } else {
        this._pausedTimers.forEach(t => { if (!t.id) { t.fn(); t.id=setInterval(t.fn,t.ms); } });
      }
    });
  },
  registerTimer(fn, ms) {
    const entry = { fn, ms, id: setInterval(fn, ms) };
    this._pausedTimers.push(entry);
    this.pauseWhenHidden();
    return entry;
  },

  // --- Fotos de jugadores (figuritas del gacha) ---
  _PHOTO_BASE_URL: 'https://cdn.jsdelivr.net/gh/josuehdz420/wcc-assets@main/figuritas/',
  getPhotoSync(fig) {
    if (!fig?.id) return null;
    return `${this._PHOTO_BASE_URL}${fig.id}.png`;
  },
  async getPhotoById(figId) {
    if (!figId) return null;
    return `${this._PHOTO_BASE_URL}${figId}.png`;
  },
  async getPlayerPhoto() { return null; },
  async getPlayerPhotosCached() { return null; },
  async precachePhotos() { return; },
  clearPhotoCache() { this._teamsCache = null; this._memCache = {}; },

  getCrest(name) { return getCrestFallback(name); },
  getApiStatus() {
    return {
      espnFallback: { used: API_STATUS.usedEspnFallback },
    };
  }
};

API._init();

// Cuando 'finished' se revalida en background, no recalculamos standings
// nosotros mismos (a diferencia del Mundial): la tabla de cada liga viene
// directa de ESPN vía /standings, así que no depende de los resultados que
// tengamos cacheados localmente.
