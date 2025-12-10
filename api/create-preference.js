// api/create-preference.js
import mercadopago from "mercadopago";   // ✅ import default
import { getAuth } from '../firebase/admin.js';

const firebaseAuth = getAuth(); // ✅ evita conflito de nome

// Configura Mercado Pago
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("⚠️ MP_ACCESS_TOKEN não definido!");
} else {
  mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // valida ID Token
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const idToken = authHeader.split("Bearer ")[1];

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken); // ✅ usa firebaseAuth
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const preference = {
    items: [
      {
        title: "Assinatura Prod.AI Plus",
        unit_price: 19.9,
        quantity: 1,
        currency_id: "BRL",
      },
    ],
    payer: { email: decoded.email },
    back_urls: {
      success: process.env.FRONTEND_URL,
      failure: process.env.FRONTEND_URL,
      pending: process.env.FRONTEND_URL,
    },
    auto_return: "approved",
    external_reference: decoded.uid,
  };

  try {
    const mpRes = await mercadopago.preferences.create(preference);
    return res.status(200).json({ init_point: mpRes.body.init_point });
  } catch (err) {
    console.error("Erro criando preferência:", err);
    return res.status(500).json({ error: "Erro criando preferência." });
  }
}
