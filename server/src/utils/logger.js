/**
 * utils/logger.js
 * --------------------------------------------------
 * Logger mínimo con niveles (LOG_LEVEL=debug|info|warn|error, por defecto
 * info) y campos clave=valor en una sola línea. Nunca imprime cuerpos de
 * respuesta, solo contadores y estados.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[String(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

function fmt(fields) {
  if (!fields) return "";
  return (
    " " +
    Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
  );
}

function log(level, tag, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}${fmt(fields)}`;
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

module.exports = {
  debug: (tag, msg, f) => log("debug", tag, msg, f),
  info: (tag, msg, f) => log("info", tag, msg, f),
  warn: (tag, msg, f) => log("warn", tag, msg, f),
  error: (tag, msg, f) => log("error", tag, msg, f)
};
