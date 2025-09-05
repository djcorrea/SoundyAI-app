// firebaseAdmin.js

let auth, db;

// 🚨 Se quiser ativar o Firebase de verdade depois, só trocar esse bloco
if (process.env.USE_FIREBASE === "true") {
  import { initializeApp, cert, getApps } from "firebase-admin/app";
  import { getAuth } from "firebase-admin/auth";
  import { getFirestore } from "firebase-admin/firestore";

  if (!getApps().length) {
    initializeApp({
      // Aqui só vai funcionar se você configurar as variáveis no Railway
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }

  auth = getAuth();
  db = getFirestore();
} else {
  console.warn("⚠️ Firebase DESATIVADO — usando MOCK no Railway");

  // 🔹 Mock simples para não quebrar
  auth = {
    verifyIdToken: async (token) => {
      console.log(`Mock Firebase: validando token ${token?.substring(0, 10)}...`);
      return { uid: "mock-user", email: "mock@test.com" };
    },
  };

  db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ plano: "free" }) }),
        set: async (data) => {
          console.log("Mock Firebase: salvando", data);
          return true;
        },
        update: async (data) => {
          console.log("Mock Firebase: atualizando", data);
          return true;
        },
      }),
    }),
  };
}

export { auth, db };
