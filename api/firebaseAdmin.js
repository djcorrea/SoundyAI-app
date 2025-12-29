// ✅ FIREBASE ADMIN - Inicializador AUTOSSUFICIENTE para deploy api/
// Deploy Railway: api/ roda como serviço separado, não pode importar de ../

import admin from "firebase-admin";

let _admin = null;
let _auth = null;
let _db = null;

/**
 * Inicializa Firebase Admin (singleton)
 */
function initFirebaseAdmin() {
  if (_admin) return _admin;
  
  if (!admin.apps.length) {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT não configurado');
      }

      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("🔥 [API] Firebase Admin inicializado.");
    } catch (err) {
      console.error("❌ [API] Erro ao inicializar Firebase Admin:", err.message);
      throw err;
    }
  }
  
  _admin = admin;
  return _admin;
}

// Inicializar e exportar instâncias
const adminInstance = initFirebaseAdmin();
export const auth = adminInstance.auth();
export const db = adminInstance.firestore();
export { adminInstance as admin };