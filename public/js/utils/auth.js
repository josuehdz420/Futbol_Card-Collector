// auth.js
// --------------------------------------------------
// Autenticación con Firebase Auth + datos de usuario en Firestore.
// Misma API pública que antes (register, login, logout, recoverSession,
// currentUser, updateUser) para que el resto de la app (gacha, album,
// battle, profile, etc.) no tenga que cambiar ni una línea.

const Auth = {

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  validatePassword(password) {
    return password.length >= 6;
  },

  _defaultUserData(name, email) {
    return {
      email:            email.toLowerCase().trim(),
      name:             name.trim(),
      createdAt:        new Date().toISOString(),
      tiradas:          5,
      freeSpinsClaimed: true,
      monedas:          0,
      figuritas:        [],
      favoritos:        [],
      predicciones:     [],
      aciertos:         0,
      pityCount:        0,
      equipo_ideal:     {},
      activity_log:     []
    };
  },

  async _fetchUserDoc(uid) {
    const snap = await fbDB.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return { uid, ...snap.data() };
  },

  _friendlyError(err) {
    const map = {
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/invalid-email':        'Correo inválido',
      'auth/user-not-found':       'No existe cuenta con ese correo',
      'auth/wrong-password':       'Contraseña incorrecta',
      'auth/invalid-credential':   'Correo o contraseña incorrectos',
      'auth/too-many-requests':    'Demasiados intentos — espera un momento e intenta de nuevo',
      'auth/network-request-failed': 'Sin conexión — revisa tu internet',
    };
    return map[err.code] || ('Error: ' + err.message);
  },

  async register({ name, email, password }) {
    if (!name || name.trim().length < 2)
      return { ok: false, field: 'name', msg: 'El nombre debe tener al menos 2 caracteres' };

    if (!this.validateEmail(email))
      return { ok: false, field: 'email', msg: 'Correo inválido' };

    if (!this.validatePassword(password))
      return { ok: false, field: 'pass', msg: 'Contraseña mínimo 6 caracteres' };

    try {
      const cred = await fbAuth.createUserWithEmailAndPassword(email.toLowerCase().trim(), password);
      const userData = this._defaultUserData(name, email);
      await fbDB.collection('users').doc(cred.user.uid).set(userData);
      return { ok: true };
    } catch (err) {
      const msg = this._friendlyError(err);
      const field = err.code === 'auth/weak-password' ? 'pass' : 'email';
      return { ok: false, field, msg };
    }
  },

  async login({ email, password }) {
    if (!this.validateEmail(email))
      return { ok: false, field: 'email', msg: 'Correo inválido' };

    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email.toLowerCase().trim(), password);
      let user = await this._fetchUserDoc(cred.user.uid);

      // Si por algún motivo el usuario existe en Auth pero no en Firestore
      // (p. ej. cuenta antigua migrada a mano), le creamos el documento base.
      if (!user) {
        const fresh = this._defaultUserData(cred.user.displayName || email.split('@')[0], email);
        await fbDB.collection('users').doc(cred.user.uid).set(fresh);
        user = { uid: cred.user.uid, ...fresh };
      }

      // Bonus histórico para una cuenta específica (se mantiene igual que antes)
      if (email.toLowerCase().trim() === 'marruecosparaelmundial@gmail.com') {
        const nuevasTiradas = (user.tiradas || 0) + 50;
        await fbDB.collection('users').doc(cred.user.uid).update({ tiradas: nuevasTiradas });
        user.tiradas = nuevasTiradas;
      }

      return { ok: true, user };
    } catch (err) {
      const msg = this._friendlyError(err);
      const field = (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') ? 'pass' : 'email';
      return { ok: false, field, msg };
    }
  },

  async logout() {
    await fbAuth.signOut();
  },

  // Espera a que Firebase resuelva el estado de auth (es asíncrono al
  // arrancar la app) y devuelve el usuario actual (o null).
  async recoverSession() {
    return new Promise((resolve) => {
      const unsub = fbAuth.onAuthStateChanged(async (fbUser) => {
        unsub();
        if (!fbUser) { resolve(null); return; }
        const user = await this._fetchUserDoc(fbUser.uid);
        resolve(user);
      });
    });
  },

  async currentUser() {
    const fbUser = fbAuth.currentUser;
    if (!fbUser) return await this.recoverSession();
    return await this._fetchUserDoc(fbUser.uid);
  },

  // Los módulos (gacha, album, battle, profile, ...) mutan el objeto
  // `user` en memoria y llaman esto para persistirlo.
  async updateUser(updatedUser) {
    const fbUser = fbAuth.currentUser;
    if (!fbUser) return;
    const { uid, ...data } = updatedUser;
    await fbDB.collection('users').doc(fbUser.uid).set(data, { merge: true });
  }
};
