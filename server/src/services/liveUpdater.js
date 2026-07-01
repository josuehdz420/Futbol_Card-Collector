/**
 * services/liveUpdater.js
 * --------------------------------------------------
 * Tarea en segundo plano que refresca el cache de partidos en vivo
 * automáticamente cada 5 minutos, para que /live responda rápido incluso
 * en la primera consulta de cada ventana de tiempo.
 */

const espnService = require("./espnService");

const FIVE_MINUTES = 5 * 60 * 1000;

function startLiveUpdater() {
  // Ejecuta una vez al iniciar el servidor...
  refresh();
  // ...y luego cada 5 minutos.
  setInterval(refresh, FIVE_MINUTES);
  console.log("[liveUpdater] Actualización automática de partidos en vivo cada 5 minutos activada.");
}

async function refresh() {
  try {
    const live = await espnService.getLiveMatches();
    console.log(`[liveUpdater] Cache de partidos en vivo actualizado (${live.length} en vivo).`);
  } catch (err) {
    console.warn("[liveUpdater] No se pudo refrescar partidos en vivo:", err.message);
  }
}

module.exports = { startLiveUpdater };
