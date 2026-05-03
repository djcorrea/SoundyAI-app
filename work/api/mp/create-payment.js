// work/api/mp/create-payment.js
// POST /api/mp/create-payment   — cria pagamento PIX transparente (sem redirect)
// GET  /api/mp/create-payment?id=xxx — consulta status do pagamento (polling)
//
// ARQUITETURA:
//  • Checkout Transparente: sem redirect para mercadopago.com
//  • Responde { qr_code, qr_code_base64, payment_id } para o frontend exibir QR
//  • Frontend faz polling em GET ?id=xxx a cada 3s até status approved
//  • Webhook /api/webhook/mp recebe notificação MP e aplica creditsLimit += 1

import express from 'express';
import { getAuth } from '../../../firebase/admin.js';

const router = express.Router();

const SINGLE_CREDIT_PRICE = parseFloat(process.env.MP_SINGLE_CREDIT_PRICE || '3.99');

function getNotificationUrl() {
  if (process.env.MP_WEBHOOK_URL) return process.env.MP_WEBHOOK_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/webhook/mp`;
  }
  return 'https://soundyai-app-production.up.railway.app/api/webhook/mp';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mp/create-payment?id=xxx  — polling de status (frontend consulta)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const paymentId = req.query.id;
  if (!paymentId) {
    return res.status(400).json({ error: 'missing_id', message: 'Query param id obrigatório' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'server_error', message: 'Gateway não configurado' });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[MP PAYMENT-STATUS] HTTP ${response.status} para id=${paymentId}: ${body}`);
      return res.status(502).json({ error: 'gateway_error' });
    }
    const payment = await response.json();
    console.error(`[MP PAYMENT-STATUS] id=${paymentId} status=${payment.status}`);
    return res.status(200).json({ status: payment.status, payment_id: String(payment.id) });
  } catch (err) {
    console.error('[MP PAYMENT-STATUS] Erro:', err.message);
    return res.status(502).json({ error: 'gateway_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mp/create-payment  — cria pagamento PIX transparente
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  console.error('[MP CREATE-PAYMENT] Requisição recebida');

  // 1️⃣ AUTENTICAÇÃO FIREBASE
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[MP CREATE-PAYMENT] Token ausente');
    return res.status(401).json({ error: 'unauthorized', message: 'Token de autenticação ausente' });
  }
  const token = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (err) {
    console.error('[MP CREATE-PAYMENT] Token inválido:', err.message);
    return res.status(401).json({ error: 'unauthorized', message: 'Token inválido' });
  }

  const uid   = decodedToken.uid;
  const email = decodedToken.email || `${uid}@soundyai.user`;
  const jobId = req.body?.jobId || '';

  console.error(`[MP CREATE-PAYMENT] uid=${uid} jobId=${jobId} price=${SINGLE_CREDIT_PRICE}`);

  // 2️⃣ VERIFICAR TOKEN MP
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MP CREATE-PAYMENT] MP_ACCESS_TOKEN não configurado');
    return res.status(500).json({ error: 'server_error', message: 'Gateway não configurado' });
  }

  const tokenEnv = accessToken.startsWith('TEST') ? 'TESTE ⚠️' : 'PRODUÇÃO ✅';
  console.error(`[MP CREATE-PAYMENT] Ambiente token: ${tokenEnv}`);

  // 3️⃣ CRIAR PAGAMENTO PIX (Checkout Transparente)
  // API: POST /v1/payments com payment_method_id=pix
  // Resposta contém point_of_interaction.transaction_data.{qr_code, qr_code_base64}
  const paymentBody = {
    transaction_amount: SINGLE_CREDIT_PRICE,
    payment_method_id:  'pix',
    description:        'Crédito SoundyAI — 1 masterização',
    payer: {
      email,
    },
    metadata: {
      uid,
      type:  'single_credit',
      jobId,
    },
    external_reference:  uid,
    notification_url:    getNotificationUrl(),
  };

  console.error('[MP CREATE-PAYMENT] Payment body:', JSON.stringify(paymentBody, null, 2));

  let mpPayment;
  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':     `Bearer ${accessToken}`,
        'Content-Type':      'application/json',
        // Chave única por tentativa: garante sempre um pagamento novo no MP.
        // NÃO reutilizar jobId aqui — se o pagamento anterior expirou/foi pago
        // e o usuário tenta de novo com o mesmo jobId, o MP devolveria o QR
        // em cache (já inválido), gerando erro "Ordem rejeitada" no app do banco.
        'X-Idempotency-Key': `pix-${uid}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    mpPayment = await mpRes.json();

    if (!mpRes.ok) {
      console.error('[MP CREATE-PAYMENT] Erro API MP:', JSON.stringify(mpPayment));
      return res.status(502).json({
        error:   'payment_gateway_error',
        message: mpPayment?.message || 'Erro ao criar pagamento PIX',
      });
    }
  } catch (err) {
    console.error('[MP CREATE-PAYMENT] Falha na requisição:', err.message);
    return res.status(502).json({ error: 'payment_gateway_error', message: err.message });
  }

  // 4️⃣ EXTRAIR QR CODE DA RESPOSTA
  const txData    = mpPayment?.point_of_interaction?.transaction_data || {};
  const qrCode    = txData.qr_code        || null;
  const qrBase64  = txData.qr_code_base64 || null;
  const paymentId = String(mpPayment.id);

  console.error(`[MP CREATE-PAYMENT] PIX criado — id=${paymentId} status=${mpPayment.status}`);

  if (!qrCode) {
    console.error('[MP CREATE-PAYMENT] qr_code ausente na resposta MP:', JSON.stringify(mpPayment));
    return res.status(502).json({
      error:   'pix_unavailable',
      message: 'PIX não disponível. Verifique se a conta MP tem PIX ativado.',
    });
  }

  return res.status(200).json({
    payment_id:     paymentId,
    qr_code:        qrCode,
    qr_code_base64: qrBase64,
    status:         mpPayment.status,
  });
});

export default router;

