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

      const detail = {
        id: matchId,
        league: leagueId,
        date: header?.competitions?.[0]?.date || null,
        status: {
          state: header?.competitions?.[0]?.status?.type?.state,
          detail: header?.competitions?.[0]?.status?.type?.detail,
          isLive: header?.competitions?.[0]?.status?.type?.state === "in"
        },
        venue: data.gameInfo?.venue?.fullName || null,
        home: home
          ? {
              id: home.team?.id,
              name: home.team?.displayName,
              logo: home.team?.logos?.[0]?.href,
              score: home.score ?? null
            }
          : null,
        away: away
          ? {
              id: away.team?.id,
              name: away.team?.displayName,
              logo: away.team?.logos?.[0]?.href,
              score: away.score ?? null
            }
          : null,
        // Eventos clave: goles, tarjetas, etc. (si ESPN los provee)
        keyEvents: (data.keyEvents || []).map((ev) => ({
          type: ev.type?.text,
          clock: ev.clock?.displayValue,
          text: ev.text,
          team: ev.team?.displayName || null
        })),
        // Formaciones / alineaciones si están disponibles
        lineups: data.rosters
          ? data.rosters.map((r) => ({
              team: r.team?.displayName,
              formation: r.formation || null,
              players: (r.roster || []).map((p) => ({
                name: p.athlete?.displayName,
                position: p.position?.abbreviation,
                starter: !!p.starter
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
  getAllMatches,
  getLiveMatches,
  getMatchById,
  getStandings,
  getCompetitions
};
