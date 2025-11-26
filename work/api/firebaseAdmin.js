import admin from "firebase-admin";

let auth, db;

// ✅ Ativa Firebase real somente se a variável estiver definida
if (process.env.USE_FIREBASE === "true" && process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log("🔥 Firebase Admin REAL habilitado");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      ),
    });
  }

  auth = admin.auth();
  db = admin.firestore();
} else {
  console.warn("⚠️ Firebase Admin DESATIVADO — usando MOCK no Railway");

  // Mock para desenvolvimento/produção temporária
  auth = {
    verifyIdToken: async (token) => {
      console.log(`🔑 Mock: Validando token ${token?.substring(0, 20)}...`);
      return {
        uid: "mock-user-123",
        email: "mock@test.com",
        name: "Usuário Mock",
      };
    },
  };

  db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({
          exists: true,
          data: () => ({
            plano: "gratuito",
            mensagensEnviadas: 5,
            mesAtual: new Date().getMonth(),
            anoAtual: new Date().getFullYear(),
            imagemAnalises: {
              quantidade: 2,
              mesAtual: new Date().getMonth(),
              anoAtual: new Date().getFullYear(),
            },
          }),
        }),
        set: async (data) => {
          console.log("📝 Mock: Salvando dados:", data);
          return data;
        },
        update: async (data) => {
          console.log("📝 Mock: Atualizando dados:", data);
          return data;
        },
      }),
    }),
    runTransaction: async (fn) => {
      console.log("🔄 Mock: Executando transação");
      const mockTx = {
        get: async () => ({
          exists: true,
          data: () => ({
            plano: "gratuito",
            mensagensEnviadas: 5,
            mesAtual: new Date().getMonth(),
            anoAtual: new Date().getFullYear(),
          }),
        }),
        set: async (ref, data) => {
          console.log("📝 Mock TX: Salvando:", data);
          return data;
        },
        update: async (ref, data) => {
          console.log("📝 Mock TX: Atualizando:", data);
          return data;
        },
      };
      return await fn(mockTx);
    },
  };
}

export { auth, db };
