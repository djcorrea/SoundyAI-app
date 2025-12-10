// api/mercadopago.js
import express from "express";
import * as mercadopago from "mercadopago";
import { getAuth, getFirestore } from '../firebase/admin.js';

const auth = getAuth();
const db = getFirestore();

const router = express.Router();

// ─── 1) CONFIGURAÇÃO DO MERCADO PAGO ──────────────────────
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("⚠️ MP_ACCESS_TOKEN não está definido!");
} else {
  mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN,
  });
}


// ─── 2) MIDDLEWARE: VALIDAÇÃO DO ID TOKEN FIREBASE ────────
async function validateFirebaseIdToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized");
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Token inválido:", err);
    return res.status(401).send("Unauthorized");
  }
}

// ─── 3) ROTA: CRIA PREFERÊNCIA DO MERCADO PAGO ──────────────
router.post("/create-preference", validateFirebaseIdToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const preference = {
      items: [
        {
          title: "Assinatura Prod.AI Plus",
          unit_price: 19.9,
          quantity: 1,
          currency_id: "BRL",
        },
      ],
      payer: { email: req.user.email },
      back_urls: {
        success: process.env.FRONTEND_URL,
        failure: process.env.FRONTEND_URL,
        pending: process.env.FRONTEND_URL,
      },
      auto_return: "approved",
      external_reference: uid,
    };

    const mpRes = await mercadopago.preferences.create(preference);
    return res.json({ init_point: mpRes.body.init_point });
  } catch (err) {
    console.error("Erro criando preferência:", err);
    return res.status(500).json({ error: "Erro criando preferência." });
  }
});

// ─── 4) ROTA: WEBHOOK DE PAGAMENTO ──────────────────────────
router.post("/webhook", async (req, res) => {
  const { type, data } = req.body;
  if (type === "payment") {
    const payment = data;
    const uid = payment.external_reference;
    if (payment.status === "approved") {
      await db.collection("usuarios").doc(uid).set(
        {
          isPlus: true,
          plano: "plus",
          upgradedAt: new Date(),
        },
        { merge: true }
      );
    }
  }
  return res.sendStatus(200);
});

export default router;
