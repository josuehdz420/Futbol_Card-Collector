/**
 * utils/cache.js
 * --------------------------------------------------
 * Caché en memoria con respaldo opcional en data/cache.json.
 *
 * Política:
 *   - Cada entrada tiene `expiresAt` (fresca) y `staleUntil` (hasta cuándo
 *     puede servirse como RESPALDO si ESPN falla: getStale()).
 *   - Las entradas VACÍAS no se restauran desde disco: un [] cacheado
 *     durante un fallo transitorio no debe sobrevivir a un reinicio.
 *   - La escritura a disco es diferida (debounce) y atómica (tmp + rename),
 *     en vez de reescribir el JSON entero en cada set().
 *   - once(key, fn) agrupa llamadas concurrentes a la misma clave (una sola
 *     petición a ESPN aunque lleguen N requests simultáneas).
 *   - CACHE_DISABLE_PERSIST=1 desactiva el disco (útil en tests).
 */

const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");
const PERSIST = process.env.CACHE_DISABLE_PERSIST !== "1";
const PERSIST_DEBOUNCE_MS = 2000;
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000; // 6 h de respaldo ante caídas de ESPN

function isEmptyValue(v) {
  return !!v && Array.isArray(v.data) && v.data.length === 0;
}

class MemoryCache {
  constructor() {
    this.store = new Map(); // key -> { value, expiresAt, staleUntil }
    this.inflight = new Map();
    this._timer = null;
    if (PERSIST) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      this._loadFromDisk();
      const flushAndExit = () => {
        this._persistNow();
        process.exit(0);
      };
      process.once("exit", () => this._persistNow());
      process.once("SIGTERM", flushAndExit);
      process.once("SIGINT", flushAndExit);
    }
  }

  _loadFromDisk() {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      const now = Date.now();
      let skipped = 0;
      for (const [key, entry] of Object.entries(parsed)) {
        if (!entry || typeof entry.expiresAt !== "number") continue;
        const staleUntil = entry.staleUntil ?? entry.expiresAt;
        // Solo formato actual (claves "v2:") y nunca entradas vacías
        if (staleUntil <= now || !key.startsWith("v2:") || isEmptyValue(entry.value)) {
          skipped++;
          continue;
        }
        this.store.set(key, { value: entry.value, expiresAt: entry.expiresAt, staleUntil });
      }
      logger.info("cache", "Restauradas entradas desde disco", { restored: this.store.size, skipped });
    } catch (err) {
      logger.warn("cache", "No se pudo leer cache.json, se inicia vacío", { error: err.message });
    }
  }

  _schedulePersist() {
    if (!PERSIST || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._persistNow();
    }, PERSIST_DEBOUNCE_MS);
    this._timer.unref?.();
  }

  _persistNow() {
    if (!PERSIST) return;
    try {
      const now = Date.now();
      const obj = {};
      for (const [key, entry] of this.store.entries()) {
        if (entry.staleUntil > now) obj[key] = entry;
      }
      const tmp = CACHE_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(obj), "utf-8");
      fs.renameSync(tmp, CACHE_FILE);
    } catch (err) {
      logger.warn("cache", "No se pudo escribir cache.json", { error: err.message });
    }
  }

  /** Valor FRESCO o null. */
  get(key) {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.value;
  }

  /** Valor aunque haya caducado (solo como respaldo ante fallos). */
  getStale(key) {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.staleUntil) return null;
    return { value: entry.value, expiresAt: entry.expiresAt };
  }

  /** Entradas (frescas o respaldo) cuya clave empieza por prefix. */
  entries(prefix) {
    const now = Date.now();
    const out = [];
    for (const [key, entry] of this.store.entries()) {
      if (key.startsWith(prefix) && entry.staleUntil > now) out.push([key, entry.value]);
    }
    return out;
  }

  set(key, value, ttlMs = 60_000, { staleMs = DEFAULT_STALE_MS } = {}) {
    const now = Date.now();
    this.store.set(key, { value, expiresAt: now + ttlMs, staleUntil: now + ttlMs + staleMs });
    this._schedulePersist();
    return value;
  }

  del(key) {
    this.store.delete(key);
    this._schedulePersist();
  }

  flush() {
    this.store.clear();
    this._schedulePersist();
  }

  /** Ejecuta fn() una sola vez por clave mientras haya una en curso. */
  once(key, fn) {
    if (this.inflight.has(key)) return this.inflight.get(key);
    const p = (async () => {
      try {
        return await fn();
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }
}

module.exports = new MemoryCache();
