// api/create-preference.js
import { MercadoPagoConfig, Preference as MPPreference } from 'mercadopago';
import { getAuth } from '../../firebase/admin.js';

const firebaseAuth = getAuth(); // ✅ evita conflito de nome

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("⚠️ MP_ACCESS_TOKEN não definido!");
}

function getMPClient() {
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
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
    const prefClient = new MPPreference(getMPClient());
    const mpRes = await prefClient.create({ body: preference });
    return res.status(200).json({ init_point: mpRes.init_point });

  } catch (err) {
    console.error("Erro criando preferência:", err);
    return res.status(500).json({ error: "Erro criando preferência." });
  }
}
