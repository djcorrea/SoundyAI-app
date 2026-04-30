// work/api/mp/create-payment.js
// POST /api/mp/create-payment
// Cria uma preferência no Mercado Pago para compra de 1 crédito de masterização.
//
// ARQUITETURA:
//  • Mercado Pago é o ÚNICO responsável por crédito avulso (single_credit).
//  • Stripe trata exclusivamente planos (Plus / Pro).
//
// Fluxo:
//  1. Valida token Firebase (autenticação)
//  2. Cria Preference MP com PIX via Checkout Pro
//  3. Retorna { init_point } para redirect no frontend

import express from 'express';
import { getAuth } from '../../../firebase/admin.js';

const router = express.Router();

// Valor do crédito avulso — configurável via env var
const SINGLE_CREDIT_PRICE = parseFloat(process.env.MP_SINGLE_CREDIT_PRICE || '3.99');

// URL pública do backend Railway para receber notificações
function getNotificationUrl() {
  if (process.env.MP_WEBHOOK_URL) return process.env.MP_WEBHOOK_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/webhook/mp`;
  }
  return 'https://soundyai-app-production.up.railway.app/api/webhook/mp';
}

// URL base do frontend para back_urls
function getFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const host = req.get('host') || 'soundyai.com.br';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  return `${protocol}://${host}`;
}

/**
 * POST /api/mp/create-payment
 * Headers: Authorization: Bearer <firebase_token>
 * Body: { jobId?: string }
 * Response: { init_point: string }
 */
router.post('/', async (req, res) => {
  console.error('[MP CREATE-PAYMENT] Requisição recebida');

  // 1️⃣ VALIDAR AUTENTICAÇÃO FIREBASE
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[MP CREATE-PAYMENT] Token Firebase ausente');
    return res.status(401).json({ error: 'unauthorized', message: 'Token de autenticação ausente' });
  }

  const token = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    const auth = getAuth();
    decodedToken = await auth.verifyIdToken(token);
  } catch (err) {
    console.error('[MP CREATE-PAYMENT] Token Firebase inválido:', err.message);
    return res.status(401).json({ error: 'unauthorized', message: 'Token de autenticação inválido' });
  }

  const uid   = decodedToken.uid;
  const email = decodedToken.email || '';
  const jobId = req.body?.jobId || '';

  console.error(`[MP CREATE-PAYMENT] uid=${uid} jobId=${jobId} price=${SINGLE_CREDIT_PRICE}`);

  // 2️⃣ VERIFICAR CONFIGURAÇÃO
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MP CREATE-PAYMENT] MP_ACCESS_TOKEN não configurado');
    return res.status(500).json({ error: 'server_error', message: 'Gateway de pagamento não configurado' });
  }

  const notificationUrl = getNotificationUrl();
  const frontendUrl     = getFrontendUrl(req);

  // 3️⃣ CRIAR PREFERÊNCIA MERCADO PAGO (via fetch nativo — Node.js 20)
  const preference = {
    items: [
      {
        id:          'single_credit',
        title:       'Masterização SoundyAI',
        description: 'Crédito para 1 masterização profissional',
        quantity:    1,
        unit_price:  SINGLE_CREDIT_PRICE,
        currency_id: 'BRL',
      },
    ],
    payer: {
      email,
    },
    // metadata é preservado no objeto payment — usado pelo webhook para obter o uid
    metadata: {
      uid,
      type:  'single_credit',
      jobId,
    },
    // Referência externa como fallback de identificação
    external_reference: uid,
    payment_methods: {
      // Habilitar apenas Pix (bank_transfer) e cartão de crédito
      excluded_payment_types: [
        { id: 'ticket' },   // boleto
        { id: 'atm' },
        { id: 'debit_card' },
        { id: 'prepaid_card' },
      ],
      installments: 1,
    },
    back_urls: {
      success: `${frontendUrl}/success.html?type=single_credit`,
      failure: `${frontendUrl}/home.html`,
      pending: `${frontendUrl}/home.html`,
    },
    auto_return:      'approved',
    notification_url: notificationUrl,
  };

  let mpResponse;
  try {
    const res2 = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'X-Idempotency-Key': `${uid}-${jobId || Date.now()}`,
      },
      body: JSON.stringify(preference),
    });

    mpResponse = await res2.json();

    if (!res2.ok) {
      console.error('[MP CREATE-PAYMENT] Erro na API MP:', JSON.stringify(mpResponse));
      return res.status(502).json({
        error:   'payment_gateway_error',
        message: 'Erro ao criar preferência de pagamento',
      });
    }
  } catch (err) {
    console.error('[MP CREATE-PAYMENT] Falha na requisição à API MP:', err.message);
    return res.status(502).json({
      error:   'payment_gateway_error',
      message: 'Falha na comunicação com gateway de pagamento',
    });
  }

  const initPoint = mpResponse.init_point;
  console.error(`[MP CREATE-PAYMENT] Preferência criada: ${mpResponse.id} | init_point: ${initPoint}`);

  return res.status(200).json({ init_point: initPoint, preference_id: mpResponse.id });
});

export default router;
