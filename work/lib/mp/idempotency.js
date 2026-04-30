// work/lib/mp/idempotency.js
// Controle de idempotência para pagamentos Mercado Pago.
// Colection Firestore: processed_mp_payments/{paymentId}
//
// Garante que cada pagamento MP seja processado exatamente uma vez,
// mesmo que o webhook seja entregue múltiplas vezes.

import { getFirestore } from '../../../firebase/admin.js';

const COLLECTION = 'processed_mp_payments';

/**
 * Verifica se um pagamento MP já foi processado.
 * @param {string|number} paymentId
 * @returns {Promise<boolean>}
 */
export async function isPaymentProcessed(paymentId) {
  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(String(paymentId));
  const snap = await docRef.get();
  return snap.exists;
}

/**
 * Marca um pagamento MP como processado.
 * Chamado SOMENTE após sucesso confirmado no Firestore.
 * @param {string|number} paymentId
 * @param {object} data  — metadados para auditoria
 */
export async function markPaymentAsProcessed(paymentId, data) {
  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(String(paymentId));
  await docRef.set({
    paymentId: String(paymentId),
    processedAt: Date.now(),
    ...data,
  });
}
