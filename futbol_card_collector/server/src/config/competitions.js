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
 * Puedes agregar más competiciones aquí sin tocar el resto del código.
 */

const COMPETITIONS = [
  { id: "eng.1", name: "Premier League", country: "Inglaterra" },
  { id: "esp.1", name: "La Liga", country: "España" },
  { id: "ita.1", name: "Serie A", country: "Italia" },
  { id: "ger.1", name: "Bundesliga", country: "Alemania" },
  { id: "fra.1", name: "Ligue 1", country: "Francia" },
  { id: "usa.1", name: "MLS", country: "Estados Unidos" },
  { id: "mex.1", name: "Liga MX", country: "México" },
  { id: "uefa.champions", name: "UEFA Champions League", country: "Europa" },
  { id: "uefa.europa", name: "UEFA Europa League", country: "Europa" },
  { id: "conmebol.libertadores", name: "Copa Libertadores", country: "Sudamérica" },
  { id: "fifa.world", name: "FIFA World Cup", country: "Internacional" },
  { id: "sv.1", name: "Primera División El Salvador", country: "El Salvador" }
];

// Slug por defecto cuando no se especifica liga en la query (?league=)
const DEFAULT_LEAGUE = "eng.1";

function isValidLeague(slug) {
  return COMPETITIONS.some((c) => c.id === slug);
}

module.exports = { COMPETITIONS, DEFAULT_LEAGUE, isValidLeague };
