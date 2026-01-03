// work/api/stripe/cancel-subscription.js
// Rota segura para cancelar assinatura Stripe
// Cancela apenas ao fim do período (cancel_at_period_end: true)

import express from 'express';
import stripe from '../../lib/stripe/config.js';
import { getAuth, getFirestore } from '../../../firebase/admin.js';
import { FieldValue } from 'firebase-admin/firestore';

const router = express.Router();
const auth = getAuth();
const db = getFirestore();

/**
 * POST /api/stripe/cancel-subscription
 * 
 * Cancela a assinatura do usuário autenticado.
 * A assinatura permanece ativa até o fim do período atual (cancel_at_period_end).
 * 
 * Headers:
 *   Authorization: Bearer {Firebase ID Token}
 * 
 * Response:
 *   200: { success: true, message: string, cancelAt: string }
 *   400: { error: string } - Sem assinatura ativa ou já cancelada
 *   401: { error: string } - Token inválido
 *   404: { error: string } - Usuário não encontrado
 *   500: { error: string } - Erro interno
 */
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🚫 [STRIPE CANCEL] [${timestamp}] ════════════════════════════════════════`);

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ VALIDAR AUTENTICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    const authHeader = req.headers.authorization || '';
    
    if (!authHeader.startsWith('Bearer ')) {
      console.error(`❌ [STRIPE CANCEL] Token Bearer ausente`);
      return res.status(401).json({ error: 'Token de autorização não fornecido' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error(`❌ [STRIPE CANCEL] Token inválido: ${error.message}`);
      return res.status(401).json({ error: 'Token de autenticação inválido' });
    }

    const uid = decodedToken.uid;
    console.log(`👤 [STRIPE CANCEL] Usuário autenticado: ${uid}`);

    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ BUSCAR DADOS DO USUÁRIO NO FIRESTORE
    // ═══════════════════════════════════════════════════════════════════
    const userDoc = await db.collection('usuarios').doc(uid).get();

    if (!userDoc.exists) {
      console.error(`❌ [STRIPE CANCEL] Usuário não encontrado no Firestore: ${uid}`);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    console.log(`📋 [STRIPE CANCEL] Dados do usuário:`, {
      plan: userData.plan,
      subscriptionId: userData.subscription?.id,
      subscriptionStatus: userData.subscription?.status,
      stripeCustomerId: userData.stripeCustomerId,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ VALIDAR SE HÁ ASSINATURA ATIVA
    // ═══════════════════════════════════════════════════════════════════
    const subscription = userData.subscription;

    if (!subscription || !subscription.id) {
      console.error(`❌ [STRIPE CANCEL] Usuário sem assinatura: ${uid}`);
      return res.status(400).json({ 
        error: 'Nenhuma assinatura ativa encontrada',
        message: 'Você não possui uma assinatura ativa para cancelar.'
      });
    }

    // Verificar se já está cancelada
    if (subscription.status === 'canceled') {
      console.log(`⚠️ [STRIPE CANCEL] Assinatura já cancelada: ${subscription.id}`);
      return res.status(400).json({ 
        error: 'Assinatura já cancelada',
        message: 'Sua assinatura já foi cancelada anteriormente. Você manterá acesso até o fim do período.',
        cancelAt: subscription.currentPeriodEnd
      });
    }

    const subscriptionId = subscription.id;
    console.log(`🔍 [STRIPE CANCEL] Subscription ID: ${subscriptionId}`);

    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ CANCELAR NO STRIPE (cancel_at_period_end: true)
    // ═══════════════════════════════════════════════════════════════════
    let stripeSubscription;
    
    try {
      stripeSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log(`✅ [STRIPE CANCEL] Stripe atualizado com sucesso:`, {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        current_period_end: stripeSubscription.current_period_end,
      });
      
    } catch (stripeError) {
      console.error(`❌ [STRIPE CANCEL] Erro na API Stripe: ${stripeError.message}`);
      
      // Tratar erros específicos do Stripe
      if (stripeError.code === 'resource_missing') {
        return res.status(400).json({ 
          error: 'Assinatura não encontrada no Stripe',
          message: 'A assinatura não foi encontrada. Entre em contato com o suporte.'
        });
      }
      
      throw stripeError;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ ATUALIZAR FIRESTORE
    // ═══════════════════════════════════════════════════════════════════
    const periodEndDate = new Date(stripeSubscription.current_period_end * 1000);
    
    const updateData = {
      'subscription.status': 'active_until_period_end',
      'subscription.cancel_at_period_end': true,
      'subscription.canceledAt': FieldValue.serverTimestamp(),
      'subscription.currentPeriodEnd': periodEndDate.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('usuarios').doc(uid).update(updateData);
    console.log(`✅ [STRIPE CANCEL] Firestore atualizado`);

    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ RETORNAR SUCESSO
    // ═══════════════════════════════════════════════════════════════════
    const formattedDate = periodEndDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    console.log(`✅ [STRIPE CANCEL] Cancelamento concluído para ${uid}`);
    console.log(`════════════════════════════════════════════════════════════════════════\n`);

    return res.status(200).json({
      success: true,
      message: `Assinatura cancelada com sucesso. Você manterá acesso até ${formattedDate}.`,
      cancelAt: periodEndDate.toISOString(),
      cancelAtFormatted: formattedDate,
    });

  } catch (error) {
    console.error(`❌ [STRIPE CANCEL] Erro crítico: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);

    return res.status(500).json({
      error: 'Erro interno ao cancelar assinatura',
      message: 'Ocorreu um erro. Tente novamente ou entre em contato com o suporte.',
    });
  }
});

export default router;
