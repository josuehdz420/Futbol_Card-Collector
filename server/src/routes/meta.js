/**
 * routes/meta.js
 * --------------------------------------------------
 * Construye el bloque `meta` (aditivo, no rompe el contrato anterior) que
 * permite al cliente distinguir:
 *   - verifiedEmpty: ESPN respondió bien a todo y no hay eventos
 *   - partial:       faltan datos (alguna ventana/liga falló)
 *   - stale:         se sirve el último dato bueno porque ESPN falló
 * y deja una línea de resumen en res.locals.logInfo para el log de Express.
 */

function buildMeta(res, result) {
  const count = Array.isArray(result.data) ? result.data.length : 0;
  const meta = {
    source: result.source, // "espn" | "cache" | "stale"
    partial: !!result.partial,
    stale: !!result.stale,
    verifiedEmpty: count === 0 && !result.partial && !result.stale,
    upstream: result.upstream || null,
    warnings: result.warnings || []
  };
  res.locals.logInfo =
    `source=${meta.source} count=${count} partial=${meta.partial}` +
    (meta.stale ? " stale=true" : "") +
    (meta.warnings.length ? ` warnings=${meta.warnings.length}` : "");
  return meta;
}

module.exports = { buildMeta };
