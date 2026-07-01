// db.js
// --------------------------------------------------
// Desde la migración a Firebase, esta capa cumple DOS roles:
//
// 1) Caché local pura (stats_cache, photo_cache) — sigue en IndexedDB,
//    porque es solo optimización de rendimiento, no datos de cuenta.
//
// 2) Funciones de compatibilidad hacia Firestore (getUser, saveUser,
//    logActivity) para el flujo de "transferir cuenta por JSON" en
//    login.astro y para los módulos que ya llamaban DB.logActivity(...).
//
// Los datos de cuenta (figuritas, monedas, predicciones, etc.) YA NO
// viven aquí — viven en Firestore, gestionados desde auth.js.

const DB_NAME    = 'WCCollectorUES_cache';
const DB_VERSION = 1;

let _db     = null;
let _dbProm = null;

const DB = {
  open() {
    if (_db)     return Promise.resolve(_db);
    if (_dbProm) return _dbProm;

    _dbProm = new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        _dbProm = null;
        reject(e);
        return;
      }

      const timeout = setTimeout(() => {
        _dbProm = null;
        reject(new Error('IndexedDB timeout — puede haber otra pestaña bloqueando'));
      }, 8000);

      req.onblocked = () => console.warn('DB bloqueada por otra pestaña — esperando...');

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const ensure = (name, opts) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
        };
        ensure('stats_cache', { keyPath: 'key' });
        ensure('photo_cache', { keyPath: 'id' });
      };

      req.onsuccess = (e) => {
        clearTimeout(timeout);
        _db = e.target.result;
        _db.onclose        = () => { _db = null; _dbProm = null; };
        _db.onversionchange = () => { _db.close(); _db = null; _dbProm = null; };
        resolve(_db);
      };

      req.onerror = (e) => {
        clearTimeout(timeout);
        _dbProm = null;
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });

    return _dbProm;
  },

  async resetDB() {
    _db = null; _dbProm = null;
    return new Promise((res, rej) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
      req.onblocked = () => res();
    });
  },

  async put(store, value) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },

  async get(store, key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },

  async delete(store, key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },

  async clear(store) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },

  async getCacheStats(key) {
    const row = await this.get('stats_cache', key);
    if (!row) return null;
    if (Date.now() - row.timestamp > 30 * 60 * 1000) return null;
    return row.data;
  },
  async setCacheStats(key, data) {
    await this.put('stats_cache', { key, data, timestamp: Date.now() });
  },

  // ---- Compatibilidad Firestore (cuentas) ----

  // NOTA: ya no se usa en el flujo actual (login.astro ahora resuelve
  // el usuario por uid tras signIn/createUser). Se deja de referencia,
  // pero con las reglas de seguridad de firestore.rules esta consulta
  // por email fallará para cualquiera excepto el propio usuario, porque
  // Firestore exige que las reglas puedan validarse por documento.
  async getUser(email) {
    const norm = email.toLowerCase().trim();
    const snap = await fbDB.collection('users').where('email', '==', norm).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, ...doc.data() };
  },

  // Guarda/actualiza el documento de usuario en Firestore. Requiere que
  // el usuario ya esté autenticado con Firebase Auth (uid presente).
  async saveUser(user) {
    const fbUser = fbAuth.currentUser;
    const uid = user.uid || (fbUser && fbUser.uid);
    if (!uid) throw new Error('No hay sesión activa de Firebase para guardar el usuario');
    const { uid: _drop, ...data } = user;
    await fbDB.collection('users').doc(uid).set(data, { merge: true });
  },

  async logActivity(email, type, detail = '') {
    try {
      const fbUser = fbAuth.currentUser;
      if (!fbUser) return;
      const ref = fbDB.collection('users').doc(fbUser.uid);
      await ref.update({
        activity_log: firebase.firestore.FieldValue.arrayUnion({
          type, detail, timestamp: Date.now()
        })
      });
    } catch (_) { /* no crítico */ }
  },

  async getRecentActivity(limit = 10) {
    const fbUser = fbAuth.currentUser;
    if (!fbUser) return [];
    const snap = await fbDB.collection('users').doc(fbUser.uid).get();
    const log = (snap.data() || {}).activity_log || [];
    return log.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },

  // La sesión ahora la maneja Firebase Auth solo (persistencia LOCAL).
  // Se dejan como no-ops para no romper llamadas existentes.
  async getSession()      { return null; },
  async setSession(_email) {},
  async clearSession()    {}
};
