// swr-cache.js
// --------------------------------------------------
// Capa reusable de caché "stale-while-revalidate" (SWR), respaldada por
// IndexedDB (store 'swr_cache' en db.js) con un espejo en memoria para
// lecturas síncronas instantáneas.
//
// Objetivo (ver auditoría de rendimiento):
//   1) Mostrar de inmediato el último dato guardado localmente al abrir la app.
//   2) Sincronizar en background con la API y refrescar la UI sola cuando
//      llegan datos nuevos, sin bloquear el render ni mostrar pantallas vacías.
//   3) TTL configurable por key para saber cuándo un dato se considera "viejo"
//      (igual se sirve al instante; el TTL solo decide si se revalida o no).
//
// Cómo se usa (ver api.js):
//
//   const data = await Cache.swr('standings', async () => {
//     const fresh = await fetchFromApi();
//     return fresh; // o null si falló — Cache no cachea nulls
//   }, { ttl: 5 * 60 * 1000 });
//
// Cache.swr():
//   - Si hay dato en memoria/IndexedDB (aunque esté vencido) lo devuelve YA,
//     sin esperar red, y dispara la revalidación en background.
//   - Si NO hay ningún dato guardado (primera vez que se abre la app / caché
//     borrado), no hay nada que mostrar: ahí sí espera la respuesta de red
//     una única vez.
//   - Cuando la revalidación en background trae datos nuevos, actualiza el
//     caché y emite un evento 'wcc:cache-update' en window para que la UI
//     (dashboard.js, predictions.js, etc.) se refresque sola.
//
// No rompe nada existente: es un módulo aparte, opt-in, que api.js consume
// solo en los endpoints que lo necesitan.

const Cache = {
  _mem: {},        // key -> { data, ts }
  _inflight: {},    // key -> Promise (dedupe de revalidaciones concurrentes)
  _preloaded: false,

  TTL: {
    live:      2  * 60 * 1000,
    upcoming:  5  * 60 * 1000,
    standings: 5  * 60 * 1000,
    finished:  10 * 60 * 1000,
    default:   5  * 60 * 1000,
  },

  _ttlFor(key) {
    return this.TTL[key] != null ? this.TTL[key] : this.TTL.default;
  },

  // Lee del espejo en memoria (síncrono). Usar tras preload() o tras el
  // primer swr() de la sesión.
  get(key) {
    return this._mem[key] || null;
  },

  isStale(key, ttl) {
    const e = this._mem[key];
    if (!e) return true;
    return (Date.now() - e.ts) > (ttl != null ? ttl : this._ttlFor(key));
  },

  // Escribe en memoria + IndexedDB (persistente). La escritura a IndexedDB
  // es "fire and forget": no bloquea al llamador ni al renderizado.
  set(key, data) {
    const entry = { data, ts: Date.now() };
    this._mem[key] = entry;
    try {
      DB.put('swr_cache', { key, data, ts: entry.ts }).catch(err =>
        console.warn('[Cache] no se pudo persistir', key, err)
      );
    } catch (_) { /* IndexedDB no disponible, seguimos solo en memoria */ }
    return data;
  },

  // Precarga el espejo en memoria desde IndexedDB para una lista de keys.
  // Se llama una vez al iniciar la app (App.init), antes del primer render,
  // para que el primer Dashboard.render() ya tenga datos listos sin red.
  async preload(keys = []) {
    await Promise.all(keys.map(async (key) => {
      if (this._mem[key]) return; // ya está en memoria, no pisar
      try {
        const row = await DB.get('swr_cache', key);
        if (row) this._mem[key] = { data: row.data, ts: row.ts };
      } catch (_) { /* sin caché previo, no pasa nada */ }
    }));
    this._preloaded = true;
  },

  // Limpia una key (memoria + IndexedDB). Usado por "Actualizar" manual /
  // forceRefresh para forzar una recarga 100% fresca.
  async invalidate(key) {
    delete this._mem[key];
    try { await DB.delete('swr_cache', key); } catch (_) {}
  },

  async invalidateAll(keys) {
    await Promise.all(keys.map(k => this.invalidate(k)));
  },

  _emit(key, data) {
    try {
      window.dispatchEvent(new CustomEvent('wcc:cache-update', { detail: { key, data } }));
    } catch (_) {}
  },

  // Dispara (o reutiliza si ya hay una en curso) la revalidación en
  // background para `key`, usando `fetcher`. Si trae datos, actualiza el
  // caché y emite 'wcc:cache-update'. Nunca lanza (los errores se loguean).
  _revalidate(key, fetcher) {
    if (this._inflight[key]) return this._inflight[key];

    const p = (async () => {
      try {
        const fresh = await fetcher();
        if (fresh != null) {
          this.set(key, fresh);
          this._emit(key, fresh);
        }
        return fresh;
      } catch (err) {
        console.warn('[Cache] revalidación falló para', key, err);
        return null;
      } finally {
        delete this._inflight[key];
      }
    })();

    this._inflight[key] = p;
    return p;
  },

  // Núcleo del patrón stale-while-revalidate.
  // opts.ttl:          milisegundos antes de considerar el dato "viejo"
  // opts.forceNetwork:  fuerza revalidación aunque el dato esté fresco
  async swr(key, fetcher, opts = {}) {
    const ttl = opts.ttl != null ? opts.ttl : this._ttlFor(key);
    const cached = this._mem[key];

    if (cached) {
      const stale = (Date.now() - cached.ts) > ttl;
      if (stale || opts.forceNetwork) {
        this._revalidate(key, fetcher); // en background, no se espera
      }
      return cached.data;
    }

    // Sin nada que mostrar todavía (primer arranque / caché limpio):
    // aquí sí hay que esperar la red una vez.
    return this._revalidate(key, fetcher);
  },

  // Suscripción de conveniencia a actualizaciones de una key concreta.
  // Devuelve una función para desuscribirse.
  on(key, cb) {
    const handler = (e) => { if (e.detail && e.detail.key === key) cb(e.detail.data); };
    window.addEventListener('wcc:cache-update', handler);
    return () => window.removeEventListener('wcc:cache-update', handler);
  },
};
