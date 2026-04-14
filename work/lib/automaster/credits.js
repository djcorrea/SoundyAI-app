// work/lib/automaster/credits.js
// Sistema de créditos AutoMaster — inicialização mensal e compatibilidade com webhook Stripe.
//
// Planos:
//   free  → 1/mês   | plus  → 20/mês   | pro → 200/mês (ilimitado)   | dj → 200/mês (beta)
// Studio removido.

import { getFirestore } from '../../../firebase/admin.js';

const USERS = 'usuarios';

/**
 * Limites mensais por plano.
 * Usado pelo webhook Stripe para inicializar a estrutura mensal no Firestore.
 *
 * O valor indica o número de masters permitidos por mês.
 * Pro e DJ são tratados como "ilimitados" no frontend, mas têm hardcap interno de 200.
 *
 * Planos com valor 0 não disparam addAutomasterCredits no webhook.
 */
export const AUTOMASTER_CREDITS_PER_PLAN = {
  free:  0,    // sem webhook — free é gerenciado automaticamente
  plus:  20,   // 20 masters/mês
  pro:   200,  // 200 hardcap interno (exibido como "ilimitado")
  dj:    200,  // DJ Beta: mesmo que pro
};

/**
 * Retorna o timestamp do primeiro dia do próximo mês (midnight UTC).
 */
function getNextMonthTimestamp() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Verifica elegibilidade e consome 1 crédito AutoMaster em uma única transaction atômica.
 * Compatibilidade: usado internamente, mas o fluxo principal usa jobs.js.
 *
 * Respeita o sistema mensal: creditsUsed < creditsLimit liberado, com reset automático.
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

    const data  = snap.data();
    const plan  = data.plan || 'free';
    const limit = AUTOMASTER_CREDITS_PER_PLAN[plan] ?? 1;
    const now   = Date.now();

    // Monthly reset
    let creditsUsed = typeof data.creditsUsed === 'number' ? data.creditsUsed : 0;
    const resetDate = typeof data.resetDate   === 'number' ? data.resetDate   : 0;

    if (now > resetDate) {
      creditsUsed = 0;
      tx.update(userRef, {
        creditsUsed:  0,
        creditsLimit: limit,
        resetDate:    getNextMonthTimestamp(),
      });
    }

    console.log(`💳 [CREDITS] uid=${uid} plan=${plan} used=${creditsUsed}/${limit}`);

    if (creditsUsed >= limit) {
      console.log(`🚫 [CREDITS] Limite atingido: uid=${uid}`);
      return { allowed: false, type: 'limit_reached', code: 'NO_CREDITS', creditsAfter: 0 };
    }

    const newUsed = creditsUsed + 1;
    tx.update(userRef, {
      creditsUsed: newUsed,
    });

    console.log(`💳 [CREDITS] Crédito consumido: uid=${uid} restante=${limit - newUsed}`);
    return { allowed: true, type: 'plan_monthly', creditsAfter: Math.max(0, limit - newUsed) };
  });
}

/**
 * Inicializa a estrutura mensal de créditos AutoMaster para um usuário.
 * Chamado pelo webhook Stripe após pagamento/renovação confirmados.
 *
 * @param {string} uid    - UID Firebase do usuário
 * @param {number} amount - Limite mensal do plano (ex: 20 para plus, 200 para pro)
 */
export async function addAutomasterCredits(uid, amount) {
  if (!uid || typeof amount !== 'number' || amount <= 0) return;

  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);

  await db.runTransaction(async (tx) => {
    // Inicializar/renovar estrutura mensal para o novo período
    tx.set(userRef, {
      creditsLimit: amount,
      creditsUsed:  0,
      resetDate:    getNextMonthTimestamp(),
    }, { merge: true });
  });

  console.log(`💳 [CREDITS] Estrutura mensal inicializada: uid=${uid} limit=${amount}`);
}
