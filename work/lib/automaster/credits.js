// work/lib/automaster/credits.js
// Sistema de créditos AutoMaster — verificação e consumo atômico via Firestore.
// Todas as operações de escrita usam transactions para evitar race conditions.

import { getFirestore } from '../../../firebase/admin.js';

const USERS = 'usuarios';

/**
 * Créditos AutoMaster adicionados por plano a cada renovação / primeira ativação.
 * Plano 'studio' tem acesso ilimitado e não usa créditos.
 * Plano 'free'    tem 0 créditos mensais (recebe apenas o free trial implícito em automasterFreeUsed).
 */
export const AUTOMASTER_CREDITS_PER_PLAN = {
  free:   0,
  plus:   5,
  pro:    20,
  dj:     20,  // DJ Beta: mesmos limites do PRO
  studio: 0,   // Studio não usa créditos — veja lógica especial em checkAndConsumeCredit
};

/**
 * Verifica elegibilidade e consome 1 crédito AutoMaster em uma única transaction atômica.
 *
 * Ordem de prioridade:
 *  1. Plano 'studio'              → acesso ilimitado, sem consumo
 *  2. automasterFreeUsed === false → concede trial grátis, marca como usado
 *  3. automasterCredits > 0       → decrementa 1 crédito
 *  4. Caso contrário              → bloqueia com { allowed: false, code: 'NO_CREDITS' }
 *
 * @param {string} uid - UID Firebase do usuário autenticado
 * @returns {Promise<{ allowed: boolean, type: string, code?: string, creditsAfter: number }>}
 */
export async function checkAndConsumeCredit(uid) {
  const db = getFirestore();
  const userRef = db.collection(USERS).doc(uid);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);

    if (!snap.exists) {
      const err = new Error('Usuário não encontrado no banco de dados.');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const data     = snap.data();
    const plan     = data.plan || 'free';
    const freeUsed = data.automasterFreeUsed ?? false;
    const credits  = typeof data.automasterCredits === 'number' ? data.automasterCredits : 0;

    console.log(`💳 [CREDITS] uid=${uid} plan=${plan} freeUsed=${freeUsed} credits=${credits}`);

    // 1. Studio: ilimitado — não consome crédito
    if (plan === 'studio') {
      return { allowed: true, type: 'plan_unlimited', creditsAfter: credits };
    }

    // 2. Free trial ainda disponível
    if (!freeUsed) {
      tx.update(userRef, { automasterFreeUsed: true });
      console.log(`💳 [CREDITS] Trial grátis concedido: uid=${uid}`);
      return { allowed: true, type: 'free_trial', creditsAfter: credits };
    }

    // 3. Créditos disponíveis
    if (credits > 0) {
      tx.update(userRef, { automasterCredits: credits - 1 });
      console.log(`💳 [CREDITS] Crédito consumido: uid=${uid} restante=${credits - 1}`);
      return { allowed: true, type: 'credit', creditsAfter: credits - 1 };
    }

    // 4. Sem créditos — bloquear
    console.log(`🚫 [CREDITS] Sem créditos: uid=${uid}`);
    return { allowed: false, type: 'no_credits', code: 'NO_CREDITS', creditsAfter: 0 };
  });
}

/**
 * Adiciona créditos AutoMaster ao usuário de forma atômica.
 * Uso: chamado pelo webhook Stripe após pagamento/renovação confirmados.
 *
 * @param {string} uid    - UID Firebase do usuário
 * @param {number} amount - Quantidade de créditos a adicionar
 */
export async function addAutomasterCredits(uid, amount) {
  if (!uid || typeof amount !== 'number' || amount <= 0) return;

  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);

  await db.runTransaction(async (tx) => {
    const snap    = await tx.get(userRef);
    const current = snap.exists && typeof snap.data().automasterCredits === 'number'
      ? snap.data().automasterCredits
      : 0;
    tx.set(userRef, { automasterCredits: current + amount }, { merge: true });
  });

  console.log(`💳 [CREDITS] Créditos adicionados: uid=${uid} +${amount}`);
}
