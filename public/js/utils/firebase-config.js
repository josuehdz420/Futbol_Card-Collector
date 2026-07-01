// firebase-config.js
// --------------------------------------------------
// Inicializa Firebase (Auth + Firestore) para toda la app.
// Reemplaza los valores de abajo por los de TU proyecto:
// Firebase Console → Configuración del proyecto → Tus apps → SDK setup.
//
// Este archivo debe cargarse ANTES que db.js y auth.js.

const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:         "TU_PROYECTO.firebaseapp.com",
  projectId:          "TU_PROYECTO",
  storageBucket:      "TU_PROYECTO.appspot.com",
  messagingSenderId:  "TU_SENDER_ID",
  appId:              "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Persistencia local: la sesión sobrevive a cerrar el navegador
// (equivalente a "recordar sesión" siempre activo).
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
  console.warn('[Firebase] No se pudo fijar persistencia LOCAL:', err.message);
});

const fbAuth = firebase.auth();
const fbDB   = firebase.firestore();

// Habilita cache offline de Firestore (opcional, ayuda al comportamiento PWA)
fbDB.enablePersistence({ synchronizeTabs: true }).catch(err => {
  console.warn('[Firestore] Persistencia offline no disponible:', err.code);
});
