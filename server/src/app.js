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

// Pequeño logger de requests, útil en desarrollo
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Ruta raíz informativa
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "⚽ Futbol API - datos de partidos, resultados, en vivo y tablas",
    endpoints: [
      "GET /matches?league=eng.1&date=YYYYMMDD",
      "GET /live",
      "GET /match/:id",
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
