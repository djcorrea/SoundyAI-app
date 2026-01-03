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
    console.log(`🔧 [STRIPE] Criando session - Mode: subscription, Price ID: ${planConfig.priceId}`);
    
    // Construir URLs de sucesso e cancelamento
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}` 
      : `${req.protocol}://${req.get('host')}`;
    
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${baseUrl}/planos.html?canceled=true`;

    const session = await stripe.checkout.sessions.create({
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
