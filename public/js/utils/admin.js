// admin.js
// --------------------------------------------------
// Rol de administrador de UNA sola cuenta fija, identificada por su UID de
// Firebase Auth (no por contraseña — esa nunca vive en el código, la valida
// Firebase Auth). NO es un sistema de roles genérico: no existe un campo
// `role` en users/{uid}, porque las reglas actuales de Firestore permiten
// que cada usuario lea/escriba su propio documento completo, así que ese
// campo sería auto-editable por cualquier usuario común.
//
// El mecanismo de seguridad REAL son las reglas de Firestore (firestore.rules,
// colección config/{docId}), que comparan request.auth.uid contra este mismo
// UID literal. La constante ADMIN_UID de acá abajo SOLO decide qué construir
// en el DOM (mostrar u ocultar el botón "Editar") — es experiencia de
// usuario, no autorización. Si alguien más intentara escribir en config/live
// con las herramientas del navegador, Firestore rechazaría la escritura
// igual, porque su uid no coincide con el de las reglas.

const ADMIN_UID = 'EDh7heVm8xd1wUWuIXjwnH6yKe43'; // ver instrucciones al final de la respuesta

const Admin = {
  isAdmin() {
    return fbAuth.currentUser?.uid === ADMIN_UID;
  },

  async getLiveConfig() {
    // Lee config/live. Si no existe el documento, devuelve null: quien
    // llame debe seguir usando sus propios valores por defecto/actuales
    // (los que ya trae el HTML estático de TabLive.astro).
    try {
      const snap = await fbDB.collection('config').doc('live').get();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      console.warn('[Admin] no se pudo leer config/live', err);
      return null;
    }
  },

  async saveLiveConfig(data) {
    // Esto solo tendrá éxito si el usuario logueado es el UID admin —
    // lo hace cumplir la regla de Firestore, no este código.
    await fbDB.collection('config').doc('live').set(data, { merge: true });
  },
};
