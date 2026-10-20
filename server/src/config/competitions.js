/**
 * config/competitions.js
 * --------------------------------------------------
 * Catálogo de competiciones soportadas. ESPN expone endpoints públicos
 * (sin API key) bajo el patrón:
 *
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/standings
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/summary?event={id}
 *
 * El "slug" es el identificador interno que usa ESPN para cada liga/torneo.
 *
 * La app está enfocada en clubes, con TRES competiciones principales
 * (las que se siguen a nivel de jugadores/equipos con tabla propia):
 *   - La Liga (España)
 *   - Premier League (Inglaterra)
 *   - UEFA Champions League
 *
 * Además se incluyen competiciones "secundarias": copas locales en las
 * que participan los mismos clubes (Real Madrid, Barcelona, Atlético,
 * Manchester City, Liverpool, Manchester United, etc.) y cuyos partidos
 * también se muestran en la app (calendario/resultados), aunque no
 * tengan tabla de posiciones propia tipo liga.
 */

// Competiciones principales: tienen tabla de posiciones y son el foco
// de la app (predicciones, seguimiento de jugadores/equipos).
const MAIN_COMPETITIONS = [
  { id: "esp.1", name: "La Liga", country: "España", tier: "main" },
  { id: "eng.1", name: "Premier League", country: "Inglaterra", tier: "main" },
  { id: "uefa.champions", name: "UEFA Champions League", country: "Europa", tier: "main" }
];

// Competiciones secundarias: copas domésticas/locales donde participan
// los mismos clubes de las ligas principales. Se muestran sus partidos
// (calendario, resultados, en vivo) pero no tienen tabla de posiciones
// tipo liga en el dashboard.
const SECONDARY_COMPETITIONS = [
  { id: "esp.copa_del_rey", name: "Copa del Rey", country: "España", tier: "secondary" },
  { id: "esp.super_cup", name: "Supercopa de España", country: "España", tier: "secondary" },
  { id: "eng.fa", name: "FA Cup", country: "Inglaterra", tier: "secondary" },
  { id: "eng.league_cup", name: "Carabao Cup", country: "Inglaterra", tier: "secondary" },
  { id: "eng.charity", name: "FA Community Shield", country: "Inglaterra", tier: "secondary" }
];

const COMPETITIONS = [...MAIN_COMPETITIONS, ...SECONDARY_COMPETITIONS];

// Slug por defecto cuando no se especifica liga en la query (?league=)
const DEFAULT_LEAGUE = "esp.1";

function isValidLeague(slug) {
  return COMPETITIONS.some((c) => c.id === slug);
}

function isMainLeague(slug) {
  return MAIN_COMPETITIONS.some((c) => c.id === slug);
}

module.exports = {
  COMPETITIONS,
  MAIN_COMPETITIONS,
  SECONDARY_COMPETITIONS,
  DEFAULT_LEAGUE,
  isValidLeague,
  isMainLeague
};
