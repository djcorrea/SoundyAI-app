// work/api/webhook/stripe.js
// Webhook Stripe seguro e idempotente

import express from 'express';
import stripe from '../../lib/stripe/config.js';
import { applySubscription, cancelSubscription } from '../../lib/user/userPlans.js';
import { isEventProcessed, markEventAsProcessed } from '../../lib/stripe/idempotency.js';

const router = express.Router();

router.post('/stripe', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 [STRIPE WEBHOOK] [${timestamp}] Webhook recebido`);

  try {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error(`❌ [STRIPE WEBHOOK] Assinatura ausente`);
      return res.status(400).json({ error: 'No signature' });
    }

    let event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`❌ [STRIPE WEBHOOK] Assinatura inválida: ${err.message}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`🔐 [STRIPE WEBHOOK] Evento validado: ${event.type}`);

    const eventId = event.id;
    const alreadyProcessed = await isEventProcessed(eventId);
    
    if (alreadyProcessed) {
      console.log(`⏭️ [STRIPE WEBHOOK] Evento já processado: ${eventId}`);
      return res.status(200).json({ received: true });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, eventId, timestamp);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, eventId, timestamp);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, eventId, timestamp);
        break;
      
      default:
        console.log(`⏭️ [STRIPE WEBHOOK] Evento ignorado: ${event.type}`);
        return res.status(200).json({ received: true });
    }

    console.log(`✅ [STRIPE WEBHOOK] Evento processado: ${eventId}`);
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error(`❌ [STRIPE WEBHOOK] Erro crítico: ${error.message}`);
    return res.status(200).json({ received: true });
  }
});

async function handleCheckoutCompleted(event, eventId, timestamp) {
  const session = event.data.object;
  
  console.log(`📦 [STRIPE CHECKOUT] Session: ${session.id}`);
  
  if (session.mode !== 'subscription') {
    console.log(`⏭️ [STRIPE CHECKOUT] Não é subscription`);
    await markEventAsProcessed(eventId, {
      sessionId: session.id,
      mode: session.mode,
      result: 'ignored_non_subscription',
    });
    return;
  }

  console.log(`🔔 [STRIPE CHECKOUT] Processando subscription: ${session.id}`);

  let fullSession;
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription']
    });
  } catch (error) {
    console.error(`❌ [STRIPE CHECKOUT] Erro ao buscar session: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'session_retrieval_failed',
      sessionId: session.id,
    });
    return;
  }

  if (fullSession.payment_status !== 'paid') {
    console.log(`⏭️ [STRIPE CHECKOUT] Pagamento não confirmado`);
    await markEventAsProcessed(eventId, {
      sessionId: session.id,
      paymentStatus: fullSession.payment_status,
      result: 'payment_not_confirmed',
    });
    return;
  }

  const metadata = fullSession.metadata;
  if (!metadata || !metadata.uid || !metadata.plan) {
    console.error(`❌ [STRIPE CHECKOUT] Metadata incompleta`);
    await markEventAsProcessed(eventId, {
      error: 'metadata_incomplete',
      sessionId: session.id,
    });
    return;
  }

  const { uid, plan } = metadata;

  if (plan !== 'plus' && plan !== 'pro') {
    console.error(`❌ [STRIPE CHECKOUT] Plano inválido: ${plan}`);
    await markEventAsProcessed(eventId, {
      error: 'invalid_plan',
      sessionId: session.id,
      uid,
      plan,
    });
    return;
  }

  const subscription = fullSession.subscription;
  if (!subscription) {
    console.error(`❌ [STRIPE CHECKOUT] Subscription ausente`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_missing',
      sessionId: session.id,
      uid,
      plan,
    });
    return;
  }

  const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;
  const subscriptionObj = typeof subscription === 'string' 
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : subscription;

  const priceId = subscriptionObj.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscriptionObj.current_period_end * 1000);

  console.log(`📋 [STRIPE CHECKOUT] UID=${uid} | Plan=${plan} | Sub=${subscriptionId}`);

  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE CHECKOUT] Assinatura ativada: ${uid} → ${plan}`);
  } catch (error) {
    console.error(`❌ [STRIPE CHECKOUT] Erro ao ativar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_activation_failed',
      errorMessage: error.message,
      sessionId: session.id,
      uid,
      plan,
      subscriptionId,
    });
    return;
  }

  await markEventAsProcessed(eventId, {
    eventType: 'checkout.session.completed',
    sessionId: session.id,
    uid,
    plan,
    subscriptionId,
    priceId,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

async function handleInvoicePaymentSucceeded(event, eventId, timestamp) {
  const invoice = event.data.object;
  
  console.log(`💳 [STRIPE RENEWAL] Invoice: ${invoice.id}`);

  if (!invoice.subscription) {
    console.log(`⏭️ [STRIPE RENEWAL] Invoice sem subscription`);
    await markEventAsProcessed(eventId, {
      invoiceId: invoice.id,
      result: 'no_subscription',
    });
    return;
  }

  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  } catch (error) {
    console.error(`❌ [STRIPE RENEWAL] Erro ao buscar subscription: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_retrieval_failed',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
    });
    return;
  }

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const customerId = subscription.customer;

  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE RENEWAL] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE RENEWAL] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      error: 'uid_not_found',
      invoiceId: invoice.id,
      subscriptionId,
    });
    return;
  }

  let plan;
  if (priceId === process.env.STRIPE_PRICE_ID_PLUS) {
    plan = 'plus';
  } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    plan = 'pro';
  } else {
    console.error(`❌ [STRIPE RENEWAL] Price ID não reconhecido: ${priceId}`);
    await markEventAsProcessed(eventId, {
      error: 'unknown_price_id',
      invoiceId: invoice.id,
      subscriptionId,
      priceId,
    });
    return;
  }

  console.log(`📋 [STRIPE RENEWAL] UID=${uid} | Plan=${plan}`);

  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE RENEWAL] Assinatura renovada: ${uid} → ${plan}`);
  } catch (error) {
    console.error(`❌ [STRIPE RENEWAL] Erro ao renovar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_renewal_failed',
      errorMessage: error.message,
      invoiceId: invoice.id,
      uid,
      plan,
      subscriptionId,
    });
    return;
  }

  await markEventAsProcessed(eventId, {
    eventType: 'invoice.payment_succeeded',
    invoiceId: invoice.id,
    uid,
    plan,
    subscriptionId,
    priceId,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

async function handleSubscriptionDeleted(event, eventId, timestamp) {
  const subscription = event.data.object;
  
  console.log(`🚫 [STRIPE CANCEL] Sub: ${subscription.id}`);

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const customerId = subscription.customer;

  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE CANCEL] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE CANCEL] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      error: 'uid_not_found',
      subscriptionId,
    });
    return;
  }

  let plan;
  if (priceId === process.env.STRIPE_PRICE_ID_PLUS) {
    plan = 'plus';
  } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    plan = 'pro';
  } else {
    console.error(`❌ [STRIPE CANCEL] Price ID não reconhecido: ${priceId}`);
    await markEventAsProcessed(eventId, {
      error: 'unknown_price_id',
      subscriptionId,
      priceId,
    });
    return;
  }

  console.log(`📋 [STRIPE CANCEL] UID=${uid} | Plan=${plan}`);

  try {
    await cancelSubscription(uid, {
      subscriptionId,
      currentPeriodEnd,
    });

    console.log(`✅ [STRIPE CANCEL] Assinatura cancelada (ativa até ${currentPeriodEnd.toISOString()})`);
  } catch (error) {
    console.error(`❌ [STRIPE CANCEL] Erro ao cancelar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_cancellation_failed',
      errorMessage: error.message,
      subscriptionId,
      uid,
      plan,
    });
    return;
  }

  await markEventAsProcessed(eventId, {
    eventType: 'customer.subscription.deleted',
    subscriptionId,
    uid,
    plan,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

export default router;
