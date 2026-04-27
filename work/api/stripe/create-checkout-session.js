// work/api/stripe/create-checkout-session.js
// Endpoint para criar Checkout Session no Stripe

import express from 'express';
import stripe, { getPlanConfig, isValidPlan, STRIPE_PAYMENT_LINKS } from '../../lib/stripe/config.js';
import { getAuth } from '../../../firebase/admin.js';

const router = express.Router();

/**
 * POST /api/stripe/create-checkout-session
 * Criar Checkout Session no Stripe
 * 
 * Body: { plan: "plus" | "pro" }
 * Headers: { Authorization: "Bearer <firebase_token>" }
 * 
 * Response: { sessionId: string, url: string }
 */
router.post('/create-checkout-session', async (req, res) => {
  console.log('📦 [STRIPE] Solicitação de checkout recebida');
  
  try {
    // 1️⃣ VALIDAR AUTENTICAÇÃO FIREBASE
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [STRIPE] Token Firebase ausente');
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Token de autenticação ausente',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      const auth = getAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('❌ [STRIPE] Token Firebase inválido:', error.message);
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Token de autenticação inválido',
      });
    }

    const uid = decodedToken.uid;
    console.log(`✅ [STRIPE] Usuário autenticado: ${uid}`);

    // 2️⃣ VALIDAR PLANO
    const { plan, jobId } = req.body;

    if (!plan) {
      console.error('❌ [STRIPE] Plano não informado');
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Plano não informado',
      });
    }

    // ── CRÉDITO AVULSO: fluxo separado (mode: payment, não subscription) ──────
    if (plan === 'single_credit') {
      const stripeInstance = stripe();
      const baseUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.get('host')}`
        : `${req.protocol}://${req.get('host')}`;

      const session = await stripeInstance.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              unit_amount: 399, // R$3,99 em centavos
              product_data: {
                name: 'AutoMaster — 1 download',
                description: 'Baixe sua faixa masterizada em WAV',
              },
            },
            quantity: 1,
          },
        ],
        customer_email: decodedToken.email,
        client_reference_id: uid,
        metadata: {
          uid,
          type: 'single_credit',
          jobId: jobId || '',
          email: decodedToken.email || '',
        },
        success_url: `${baseUrl}/success.html?type=single_credit`,
        cancel_url:  `${baseUrl}/home.html`,
      });

      console.log(`✅ [STRIPE] Checkout single_credit criado: ${session.id} — uid: ${uid}`);
      return res.status(200).json({ sessionId: session.id, url: session.url });
    }
    // ────────────────────────────────────────────────────────────────────────────

    if (!isValidPlan(plan)) {
      console.error(`❌ [STRIPE] Plano inválido: ${plan}`);
      return res.status(400).json({
        error: 'invalid_request',
        message: `Plano inválido: ${plan}`,
      });
    }

    // 3️⃣ OBTER CONFIGURAÇÃO DO PLANO
    let planConfig;
    try {
      planConfig = getPlanConfig(plan);
    } catch (error) {
      console.error(`❌ [STRIPE] Erro ao obter configuração do plano: ${error.message}`);
      return res.status(500).json({
        error: 'server_error',
        message: 'Erro ao obter configuração do plano',
      });
    }

    console.log(`📋 [STRIPE] Plano selecionado: ${planConfig.displayName} (${planConfig.priceId})`);

    // 4️⃣ VERIFICAR SE PLANO USA PAYMENT LINK DIRETO (ex: PRO)
    const paymentLinkBase = STRIPE_PAYMENT_LINKS[plan];
    if (paymentLinkBase) {
      console.log(`🔗 [STRIPE] Redirecionando via Payment Link para plano: ${plan}`);
      // Passar uid e email como query params para o Payment Link (suporte nativo Stripe)
      const params = new URLSearchParams({ client_reference_id: uid });
      if (decodedToken.email) params.append('prefilled_email', decodedToken.email);
      const paymentLinkUrl = `${paymentLinkBase}?${params.toString()}`;
      return res.status(200).json({ url: paymentLinkUrl });
    }

    // 5️⃣ CRIAR CHECKOUT SESSION NO STRIPE (ASSINATURA RECORRENTE - demais planos)
    console.log(`🔧 [STRIPE] Criando session - Mode: subscription, Price ID: ${planConfig.priceId}`);
    
    // Construir URLs de sucesso e cancelamento
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}` 
      : `${req.protocol}://${req.get('host')}`;
    
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${baseUrl}/planos.html?canceled=true`;

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      // ✅ Identificação do cliente
      customer_email: decodedToken.email,
      client_reference_id: uid, // ✅ NOVO: Fallback para identificar uid
      
      // ✅ Metadata na subscription para persistir com a assinatura
      subscription_data: {
        metadata: {
          uid: uid,
          plan: plan,
          email: decodedToken.email || '',
        },
      },
      
      // ✅ Metadata na session para checkout.session.completed
      metadata: {
        uid: uid,
        plan: plan,
        email: decodedToken.email || '',
      },
      
      // ✅ URLs de redirecionamento
      success_url: successUrl,
      cancel_url: cancelUrl,
      
      // ✅ Configurações adicionais
      allow_promotion_codes: true, // Permitir cupons de desconto
      billing_address_collection: 'auto',
    });

    console.log(`✅ [STRIPE] Checkout Session criada: ${session.id}`);

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('❌ [STRIPE] Erro ao criar checkout session:', error.message);
    console.error('❌ [STRIPE] Stack:', error.stack);
    console.error('❌ [STRIPE] Tipo do erro:', error.type || 'unknown');
    
    return res.status(500).json({
      error: 'server_error',
      message: 'Erro ao criar sessão de checkout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
