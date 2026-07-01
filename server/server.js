/**
 * server.js
 * --------------------------------------------------
 * Punto de entrada de la aplicación. Levanta el servidor Express y arranca
 * la tarea de actualización automática de partidos en vivo.
 */

const app = require("./src/app");
const { startLiveUpdater } = require("./src/services/liveUpdater");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`⚽ Futbol API corriendo en http://localhost:${PORT}`);
  startLiveUpdater();
});
