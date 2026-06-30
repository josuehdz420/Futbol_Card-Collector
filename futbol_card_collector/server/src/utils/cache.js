/**
 * utils/cache.js
 * --------------------------------------------------
 * Sistema de cache simple en memoria (con respaldo opcional en archivo JSON
 * local) para evitar golpear demasiado los endpoints públicos de ESPN.
 *
 * - get(key)            -> devuelve el valor cacheado si no ha expirado
 * - set(key, value, ttl) -> guarda un valor con tiempo de vida en ms
 * - del(key)             -> elimina una entrada
 * - flush()              -> limpia todo el cache
 *
 * También persiste el cache en /data/cache.json cada vez que cambia, para
 * que si el servidor se reinicia no arranque completamente "en frío".
 * Esto es solo un respaldo en disco, NO una base de datos.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class MemoryCache {
  constructor() {
    this.store = new Map(); // key -> { value, expiresAt }
    this._loadFromDisk();
  }

  _loadFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, entry]) => {
          // Solo restauramos entradas que aún no hayan expirado
          if (entry.expiresAt > now) {
            this.store.set(key, entry);
          }
        });
        console.log(`[cache] Restauradas ${this.store.size} entradas desde disco.`);
      }
    } catch (err) {
      console.warn("[cache] No se pudo leer cache.json, se inicia vacío:", err.message);
    }
  }

  _persistToDisk() {
    try {
      const obj = {};
      for (const [key, entry] of this.store.entries()) {
        obj[key] = entry;
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("[cache] No se pudo escribir cache.json:", err.message);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 60_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this._persistToDisk();
    return value;
  }

  del(key) {
    this.store.delete(key);
    this._persistToDisk();
  }

  flush() {
    this.store.clear();
    this._persistToDisk();
  }
}

// Exportamos una única instancia compartida (singleton) para toda la app
module.exports = new MemoryCache();
