/**
 * middleware/errorHandler.js
 * --------------------------------------------------
 * Middleware central de manejo de errores. Captura cualquier error pasado
 * con next(err) desde las rutas y responde con un JSON consistente.
 */

const { ApiError } = require("../utils/errors");

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;
  const message = err.message || "Error interno del servidor";

  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    success: false,
    error: message
  });
}

module.exports = { notFoundHandler, errorHandler };
