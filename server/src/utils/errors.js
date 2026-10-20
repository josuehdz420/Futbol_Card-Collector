/**
 * utils/errors.js
 * --------------------------------------------------
 * Error personalizado para distinguir errores "esperados" (liga inválida,
 * partido no encontrado, fallo de ESPN...) de errores inesperados, con:
 *   - statusCode: código HTTP que devolverá nuestra API
 *   - code:       identificador estable legible por máquina (p. ej.
 *                 "upstream_timeout", "upstream_http_error", "invalid_date")
 *   - details:    datos extra seguros de exponer (estado HTTP de ESPN, etc.)
 *   - retryable:  si tiene sentido reintentar la petición a ESPN
 */

class ApiError extends Error {
  constructor(message, statusCode = 500, opts = {}) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
    this.code = opts.code || null;
    this.details = opts.details || null;
    this.retryable = !!opts.retryable;
  }
}

module.exports = { ApiError };
