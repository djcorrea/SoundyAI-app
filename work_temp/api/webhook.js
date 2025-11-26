// api/webhook.js
// ⚠️ Firebase desativado temporariamente no Railway
// Substituir por inicialização real quando variáveis FIREBASE_* forem configuradas

import express from "express";
const router = express.Router();

// MOCK para DB (até habilitar Firebase de verdade)
const mockDb = {
  collection: () => ({
    doc: () => ({
      set: async (data) => {
        console.log("📝 Mock Webhook: dados salvos:", data);
        return data;
      },
    }),
  }),
};

// Rota do webhook
router.post("/", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment" && data.status === "approved") {
    const uid = data.external_reference;
    await mockDb
      .collection("usuarios")
      .doc(uid)
      .set(
        {
          isPlus: true,
          plano: "plus",
          upgradedAt: new Date(),
        },
        { merge: true }
      );
  }

  return res.sendStatus(200);
});

export default router;

/*
  🔧 ANOTAÇÃO:
  - Firebase Admin foi DESATIVADO neste arquivo.
  - Quando quiser habilitar de novo:
    1. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY no Railway.
    2. Troque o mockDb pela inicialização real:
        import admin from "firebase-admin";
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
          });
        }
        const db = admin.firestore();
    3. Substitua mockDb por db.
*/
