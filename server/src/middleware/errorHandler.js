/**
 * middleware/errorHandler.js
 * --------------------------------------------------
 * Manejo central de errores. Respuesta consistente:
 *   { success:false, error:"mensaje", code:"upstream_timeout", details? }
 * `code` y `details` permiten saber QUÉ falló (ESPN caído, timeout, rango
 * inválido...) sin tener que mirar los logs del servidor.
 */

const { ApiError } = require("../utils/errors");
const logger = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    code: "route_not_found"
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isApiError = err instanceof ApiError;
  const message = isApiError || statusCode < 500 ? err.message : "Error interno del servidor";

  if (statusCode >= 500) {
    // Errores esperados de ESPN: una línea; inesperados: con stack
    if (isApiError) {
      logger.error("error", message, { status: statusCode, code: err.code, path: req.originalUrl });
    } else {
      console.error("[error]", err);
    }
  }
  res.locals.logInfo = `error=${err.code || err.name}`;

  const body = { success: false, error: message, code: err.code || (statusCode >= 500 ? "internal_error" : "bad_request") };
  if (isApiError && err.details) body.details = err.details;
  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
