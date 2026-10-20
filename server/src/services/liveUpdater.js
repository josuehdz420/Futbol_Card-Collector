/**
 * services/liveUpdater.js
 * --------------------------------------------------
 * Tarea en segundo plano que precalienta el cache de partidos de hoy cada
 * 5 minutos (y deja en el log cuántos hay en vivo y si hubo fallos).
 */

const espnService = require("./espnService");
const logger = require("../utils/logger");

const FIVE_MINUTES = 5 * 60 * 1000;

function startLiveUpdater() {
  refresh();
  const timer = setInterval(refresh, FIVE_MINUTES);
  timer.unref?.();
  logger.info("liveUpdater", "Actualización automática de partidos en vivo cada 5 minutos activada");
}

async function refresh() {
  try {
    const live = await espnService.getLiveMatchesDetailed();
    logger.info("liveUpdater", "Cache de hoy actualizado", {
      live: live.data.length,
      source: live.source,
      partial: live.partial
    });
  } catch (err) {
    logger.warn("liveUpdater", "No se pudo refrescar partidos en vivo", { code: err.code, error: err.message });
  }
}

module.exports = { startLiveUpdater };
