/**
 * utils/errors.js
 * --------------------------------------------------
 * Clase de error personalizada para poder distinguir errores "esperados"
 * (ej. liga no válida, partido no encontrado) de errores inesperados,
 * y poder asignarles un código HTTP correcto desde el middleware central.
 */

class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

module.exports = { ApiError };
