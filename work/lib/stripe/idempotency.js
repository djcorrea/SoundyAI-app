// work/lib/stripe/idempotency.js
// Sistema de idempotência para webhooks Stripe

import { getFirestore } from '../../../firebase/admin.js';

const getDb = () => getFirestore();
const COLLECTION = 'processed_stripe_events';

console.log(`✅ [STRIPE IDEMPOTENCY] Módulo carregado - Collection: ${COLLECTION}`);

/**
 * Verificar se evento já foi processado
 * @param {string} eventId - ID do evento Stripe (ex: evt_xxx)
 * @returns {Promise<boolean>} true se já processado
 */
export async function isEventProcessed(eventId) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(eventId).get();
    const exists = doc.exists;
    
    if (exists) {
      console.log(`⏭️ [STRIPE IDEMPOTENCY] Evento já processado: ${eventId}`);
    }
    
    return exists;
  } catch (error) {
    console.error(`❌ [STRIPE IDEMPOTENCY] Erro ao verificar evento: ${error.message}`);
    throw error;
  }
}

/**
 * Marcar evento como processado
 * @param {string} eventId - ID do evento Stripe
 * @param {Object} data - Dados adicionais para auditoria
 * @returns {Promise<void>}
 */
export async function markEventAsProcessed(eventId, data = {}) {
  try {
    await getDb().collection(COLLECTION).doc(eventId).set({
      eventId,
      processedAt: new Date(),
      ...data,
    });
    
    console.log(`✅ [STRIPE IDEMPOTENCY] Evento marcado como processado: ${eventId}`);
  } catch (error) {
    console.error(`❌ [STRIPE IDEMPOTENCY] Erro ao marcar evento: ${error.message}`);
    throw error;
  }
}

/**
 * Obter detalhes de um evento processado
 * @param {string} eventId - ID do evento Stripe
 * @returns {Promise<Object|null>} Dados do evento ou null se não encontrado
 */
export async function getProcessedEvent(eventId) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(eventId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data();
  } catch (error) {
    console.error(`❌ [STRIPE IDEMPOTENCY] Erro ao obter evento: ${error.message}`);
    throw error;
  }
}
