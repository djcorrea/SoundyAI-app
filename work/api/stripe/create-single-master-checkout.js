// work/api/stripe/create-single-master-checkout.js
// Endpoint para criar Checkout Session de compra avulsa (master única)

import express from 'express';
import { getStripe } from '../../lib/stripe/config.js';
import { getAuth, getFirestore } from '../../../firebase/admin.js';

const router = express.Router();

// Validação de UUID v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/stripe/create-single-master-checkout
 * Cria uma Checkout Session de pagamento único para liberar o download de uma master já processada.
 *
 * Body: { masterId: string }
 * Headers: { Authorization: "Bearer <firebase_token>" }
 *
 * Response: { url: string }
 */
router.post('/create-single-master-checkout', async (req, res) => {
  console.log('🎚️ [SINGLE-MASTER] Solicitação de checkout avulso recebida');

  try {
    // 1. AUTENTICAÇÃO
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Token de autenticação ausente.' });
    }
    const rawToken = authHeader.split('Bearer ')[1].trim();
    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(rawToken);
      uid = decoded.uid;
    } catch (authErr) {
      console.error('❌ [SINGLE-MASTER] Token inválido:', authErr.message);
      return res.status(401).json({ error: 'unauthorized', message: 'Token inválido ou expirado.' });
    }

    // 2. VALIDAR masterId
    const { masterId } = req.body;
    if (!masterId || typeof masterId !== 'string' || !UUID_RE.test(masterId)) {
      return res.status(400).json({ error: 'invalid_master_id', message: 'masterId inválido.' });
    }

    // 3. VERIFICAR EXISTÊNCIA + PROPRIEDADE no Firestore
    const db = getFirestore();
    const masterSnap = await db.collection('masters').doc(masterId).get();
    if (!masterSnap.exists) {
      return res.status(404).json({ error: 'master_not_found', message: 'Master não encontrada.' });
    }
    const masterData = masterSnap.data();
    if (masterData.userId !== uid) {
      console.warn('⚠️ [SINGLE-MASTER] Acesso negado — uid:', uid, 'masterUserId:', masterData.userId);
      return res.status(403).json({ error: 'forbidden', message: 'Acesso negado.' });
    }

    // 4. SE JÁ PAGO, não criar nova sessão
    if (masterData.status === 'paid') {
      return res.status(409).json({ error: 'already_paid', message: 'Esta master já foi paga.' });
    }

    // 5. CRIAR CHECKOUT SESSION
    const stripe = getStripe();
    const baseUrl = process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://soundyai.com';

    const priceAmount = parseInt(process.env.SINGLE_MASTER_PRICE_CENTS || '1990', 10); // R$19,90

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'SoundyAI AutoMaster — Download Avulso',
              description: 'Libera o download da sua master processada.',
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'single_master',
        masterId,
        uid,
      },
      client_reference_id: uid,
      success_url: `${baseUrl}/success.html?masterId=${masterId}`,
      cancel_url: `${baseUrl}/planos.html?masterId=${masterId}`,
    });

    console.log('✅ [SINGLE-MASTER] Session criada:', session.id, '| masterId:', masterId, '| uid:', uid);

    // Salvar sessionId no Firestore para permitir reconciliação futura caso o webhook falhe.
    // merge:true garante que não sobrescreve nenhum dado existente (ex: status 'paid').
    db.collection('masters').doc(masterId).set(
      {
        pendingStripeSessionId: session.id,
        checkoutCreatedAt: new Date(),
      },
      { merge: true }
    ).catch(e => console.error('⚠️ [SINGLE-MASTER] Erro ao salvar pendingStripeSessionId (não fatal):', e.message));

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('❌ [SINGLE-MASTER] Erro ao criar checkout:', error.message);
    return res.status(500).json({ error: 'checkout_error', message: error.message });
  }
});

export default router;
