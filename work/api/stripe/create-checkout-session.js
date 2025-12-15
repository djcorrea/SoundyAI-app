// work/api/stripe/create-checkout-session.js
// Endpoint para criar Checkout Session no Stripe

import express from 'express';
import stripe, { getPlanConfig, isValidPlan } from '../../lib/stripe/config.js';
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
    const { plan } = req.body;

    if (!plan) {
      console.error('❌ [STRIPE] Plano não informado');
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Plano não informado',
      });
    }

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

    // 4️⃣ CRIAR CHECKOUT SESSION NO STRIPE (ASSINATURA RECORRENTE)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      customer_email: decodedToken.email,
      subscription_data: {
        metadata: {
          uid: uid,
          plan: plan,
        },
      },
      metadata: {
        uid: uid,
        plan: plan,
      },
      success_url: process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/cancel`,
    });

    console.log(`✅ [STRIPE] Checkout Session criada: ${session.id}`);

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('❌ [STRIPE] Erro ao criar checkout session:', error.message);
    
    return res.status(500).json({
      error: 'server_error',
      message: 'Erro ao criar sessão de checkout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
