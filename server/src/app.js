/**
 * src/app.js
 * --------------------------------------------------
 * Configuración de la aplicación Express: middlewares globales,
 * montaje de rutas y manejo de errores. Separado de server.js para
 * mantener el proyecto modular (facilita testing y reutilización).
 */

const express = require("express");
const cors = require("cors");

const matchesRoutes = require("./routes/matches");
const matchRoutes = require("./routes/match");
const standingsRoutes = require("./routes/standings");
const competitionsRoutes = require("./routes/competitions");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// CORS abierto para que cualquier frontend (incluido Astro en localhost) pueda consumir la API
app.use(cors());
app.use(express.json());

// Logger de requests: línea al recibir y línea al responder (estado, tiempo y
// resumen de fuente/caché que dejan las rutas en res.locals.logInfo).
app.use((req, res, next) => {
  const t0 = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}] -> ${res.statusCode} ${req.method} ${req.path} ${Date.now() - t0}ms` +
        (res.locals.logInfo ? ` ${res.locals.logInfo}` : "")
    );
  });
  next();
});

// Ruta raíz informativa
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "⚽ Futbol API - datos de partidos, resultados, en vivo y tablas",
    endpoints: [
      "GET /matches?league=eng.1&date=YYYYMMDD",
      "GET /matches?league=eng.1&from=YYYYMMDD&to=YYYYMMDD",
      "GET /live",
      "GET /match/:id?league=esp.1",
      "GET /standings?league=eng.1",
      "GET /competitions"
    ]
  });
});

// Rutas principales
app.use(matchesRoutes);
app.use(matchRoutes);
app.use(standingsRoutes);
app.use(competitionsRoutes);

// 404 y manejo de errores (siempre al final)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
