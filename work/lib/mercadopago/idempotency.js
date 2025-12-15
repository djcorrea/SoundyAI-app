// work/lib/mercadopago/idempotency.js
// Sistema de idempotência para webhooks Mercado Pago

import { getFirestore } from '../../../firebase/admin.js';

const getDb = () => getFirestore();
const COLLECTION = 'processed_mercadopago_events';

console.log(`✅ [MERCADOPAGO IDEMPOTENCY] Módulo carregado - Collection: ${COLLECTION}`);

/**
 * Verificar se evento já foi processado
 * @param {string} paymentId - ID do pagamento Mercado Pago
 * @returns {Promise<boolean>} true se já processado
 */
export async function isPaymentProcessed(paymentId) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(paymentId).get();
    const exists = doc.exists;
    
    if (exists) {
      console.log(`⏭️ [MERCADOPAGO IDEMPOTENCY] Pagamento já processado: ${paymentId}`);
    }
    
    return exists;
  } catch (error) {
    console.error(`❌ [MERCADOPAGO IDEMPOTENCY] Erro ao verificar pagamento: ${error.message}`);
    throw error;
  }
}

/**
 * Marcar pagamento como processado
 * @param {string} paymentId - ID do pagamento Mercado Pago
 * @param {Object} data - Dados adicionais para auditoria
 * @returns {Promise<void>}
 */
export async function markPaymentAsProcessed(paymentId, data = {}) {
  try {
    await getDb().collection(COLLECTION).doc(paymentId).set({
      paymentId,
      processedAt: new Date(),
      ...data,
    });
    
    console.log(`✅ [MERCADOPAGO IDEMPOTENCY] Pagamento marcado como processado: ${paymentId}`);
  } catch (error) {
    console.error(`❌ [MERCADOPAGO IDEMPOTENCY] Erro ao marcar pagamento: ${error.message}`);
    throw error;
  }
}

/**
 * Obter detalhes de um pagamento processado
 * @param {string} paymentId - ID do pagamento Mercado Pago
 * @returns {Promise<Object|null>} Dados do pagamento ou null se não encontrado
 */
export async function getProcessedPayment(paymentId) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(paymentId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data();
  } catch (error) {
    console.error(`❌ [MERCADOPAGO IDEMPOTENCY] Erro ao obter pagamento: ${error.message}`);
    throw error;
  }
}
