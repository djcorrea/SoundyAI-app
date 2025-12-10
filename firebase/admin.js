// /firebase/admin.js
// ✅ INICIALIZADOR GLOBAL DO FIREBASE ADMIN
// Singleton garantido para API + Worker + qualquer módulo

import admin from "firebase-admin";

let app = null;

/**
 * Obter instância do Firebase Admin (inicializa se necessário)
 * @returns {admin.app.App} Instância do Firebase Admin
 */
export function getAdmin() {
  if (!admin.apps.length) {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT não configurado');
      }

      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("🔥 Firebase Admin inicializado globalmente.");
    } catch (err) {
      console.error("❌ Erro ao inicializar Firebase Admin:", err.message);
      throw err;
    }
  }

  return admin;
}

/**
 * Obter instância do Firestore (lazy loading)
 * @returns {admin.firestore.Firestore} Instância do Firestore
 */
export function getFirestore() {
  const adminInstance = getAdmin();
  return adminInstance.firestore();
}

/**
 * Obter instância do Auth (lazy loading)
 * @returns {admin.auth.Auth} Instância do Auth
 */
export function getAuth() {
  const adminInstance = getAdmin();
  return adminInstance.auth();
}
