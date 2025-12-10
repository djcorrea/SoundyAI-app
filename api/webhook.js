// api/webhook.js
// ✅ CORREÇÃO: Firebase real sempre ativo via inicializador global

import express from "express";
import { getFirestore } from "../firebase/admin.js";

const router = express.Router();

// ✅ Obter Firestore real
const getDb = () => getFirestore();

// Rota do webhook
router.post("/", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment" && data.status === "approved") {
    const uid = data.external_reference;
    await getDb()
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
