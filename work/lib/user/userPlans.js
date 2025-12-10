// work/lib/user/userPlans.js
// Sistema de planos e limites para SoundyAI

import { getFirestore } from "../../../firebase/admin.js";

// ✅ Obter db via função (lazy loading) ao invés de top-level
const getDb = () => getFirestore();
const USERS = "userPlans"; // Coleção existente no Firestore

const PLAN_LIMITS = {
  free: { maxMessagesPerDay: 20, maxAnalysesPerDay: 3 },
  plus: { maxMessagesPerDay: 80, maxAnalysesPerDay: 30 },
  pro: { maxMessagesPerDay: Infinity, maxAnalysesPerDay: Infinity },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Buscar ou criar usuário no Firestore
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} extra - Dados extras para criação
 * @returns {Promise<Object>} Perfil do usuário
 */
export async function getOrCreateUser(uid, extra = {}) {
  const ref = getDb().collection(USERS).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = new Date().toISOString();
    const profile = {
      uid,
      plan: "free",
      plusExpiresAt: null,
      proExpiresAt: null,
      messagesToday: 0,
      analysesToday: 0,
      lastResetAt: todayISO(),
      createdAt: now,
      updatedAt: now,
      ...extra,
    };
    await ref.set(profile);
    console.log(`✅ [USER-PLANS] Novo usuário criado: ${uid} (plan: free)`);
    return profile;
  }

  return normalizeUser(ref, snap.data());
}

/**
 * Normalizar usuário: verificar expiração + reset diário
 * @param {FirestoreDocRef} ref - Referência do documento
 * @param {Object} data - Dados atuais do usuário
 * @returns {Promise<Object>} Dados normalizados
 */
async function normalizeUser(ref, data) {
  let changed = false;
  const today = todayISO();
  const now = new Date().toISOString();

  // Verificar expiração do plano Plus
  if (data.plusExpiresAt && Date.now() > new Date(data.plusExpiresAt).getTime() && data.plan === "plus") {
    console.log(`⏰ [USER-PLANS] Plano Plus expirado para: ${data.uid}`);
    data.plan = "free";
    changed = true;
  }

  // Verificar expiração do plano Pro
  if (data.proExpiresAt && Date.now() > new Date(data.proExpiresAt).getTime() && data.plan === "pro") {
    console.log(`⏰ [USER-PLANS] Plano Pro expirado para: ${data.uid}`);
    data.plan = "free";
    changed = true;
  }

  // Reset diário de contadores
  if (data.lastResetAt !== today) {
    console.log(`🔄 [USER-PLANS] Reset diário para: ${data.uid} (último: ${data.lastResetAt}, hoje: ${today})`);
    data.messagesToday = 0;
    data.analysesToday = 0;
    data.lastResetAt = today;
    changed = true;
  }

  // Atualizar Firestore se houver mudanças
  if (changed) {
    data.updatedAt = now;
    await ref.update({
      plan: data.plan,
      plusExpiresAt: data.plusExpiresAt || null,
      proExpiresAt: data.proExpiresAt || null,
      messagesToday: data.messagesToday,
      analysesToday: data.analysesToday,
      lastResetAt: data.lastResetAt,
      updatedAt: now,
    });
    console.log(`💾 [USER-PLANS] Usuário atualizado: ${data.uid} (plan: ${data.plan})`);
  }

  return data;
}

/**
 * Aplicar plano (usado pelo webhook Mercado Pago)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { plan: 'plus'|'pro', durationDays: number }
 * @returns {Promise<Object>} Perfil atualizado
 */
export async function applyPlan(uid, { plan, durationDays }) {
  console.log(`💳 [USER-PLANS] Aplicando plano ${plan} para ${uid} (${durationDays} dias)`);
  
  const ref = getDb().collection(USERS).doc(uid);
  await getOrCreateUser(uid);

  const now = Date.now();
  const expires = new Date(now + durationDays * 86400000).toISOString();

  const update = {
    plan,
    updatedAt: new Date().toISOString(),
  };

  if (plan === "plus") update.plusExpiresAt = expires;
  if (plan === "pro") update.proExpiresAt = expires;

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Plano aplicado: ${uid} → ${plan} até ${expires}`);
  
  return updatedUser;
}

/**
 * Verificar se usuário pode usar chat
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<Object>} { allowed: boolean, user: Object, remaining: number }
 */
export async function canUseChat(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];

  if (limits.maxMessagesPerDay === Infinity) {
    console.log(`✅ [USER-PLANS] Chat permitido (ilimitado): ${uid} (plan: ${user.plan})`);
    return { allowed: true, user, remaining: Infinity };
  }

  const remaining = limits.maxMessagesPerDay - (user.messagesToday || 0);
  const allowed = remaining > 0;
  
  console.log(`🔍 [USER-PLANS] Chat check: ${uid} (${user.messagesToday}/${limits.maxMessagesPerDay}) - ${allowed ? 'OK' : 'BLOQUEADO'}`);
  
  return { allowed, user, remaining: Math.max(0, remaining) };
}

/**
 * Registrar uso de chat (incrementar contador)
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<void>}
 */
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);

  await ref.update({
    messagesToday: (user.messagesToday || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`📝 [USER-PLANS] Chat registrado: ${uid} (total: ${(user.messagesToday || 0) + 1})`);
}

/**
 * Verificar se usuário pode usar análise de áudio
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<Object>} { allowed: boolean, user: Object, remaining: number }
 */
export async function canUseAnalysis(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];

  if (limits.maxAnalysesPerDay === Infinity) {
    console.log(`✅ [USER-PLANS] Análise permitida (ilimitada): ${uid} (plan: ${user.plan})`);
    return { allowed: true, user, remaining: Infinity };
  }

  const remaining = limits.maxAnalysesPerDay - (user.analysesToday || 0);
  const allowed = remaining > 0;
  
  console.log(`🔍 [USER-PLANS] Análise check: ${uid} (${user.analysesToday}/${limits.maxAnalysesPerDay}) - ${allowed ? 'OK' : 'BLOQUEADO'}`);
  
  return { allowed, user, remaining: Math.max(0, remaining) };
}

/**
 * Registrar uso de análise (incrementar contador)
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<void>}
 */
export async function registerAnalysis(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);

  await ref.update({
    analysesToday: (user.analysesToday || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`📝 [USER-PLANS] Análise registrada: ${uid} (total: ${(user.analysesToday || 0) + 1})`);
}

/**
 * Obter informações do plano do usuário
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<Object>} Informações completas do plano
 */
export async function getUserPlanInfo(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];
  
  return {
    plan: user.plan,
    messagesToday: user.messagesToday || 0,
    messagesLimit: limits.maxMessagesPerDay,
    messagesRemaining: limits.maxMessagesPerDay === Infinity 
      ? Infinity 
      : Math.max(0, limits.maxMessagesPerDay - (user.messagesToday || 0)),
    analysesToday: user.analysesToday || 0,
    analysesLimit: limits.maxAnalysesPerDay,
    analysesRemaining: limits.maxAnalysesPerDay === Infinity 
      ? Infinity 
      : Math.max(0, limits.maxAnalysesPerDay - (user.analysesToday || 0)),
    expiresAt: user.plan === 'plus' ? user.plusExpiresAt : (user.plan === 'pro' ? user.proExpiresAt : null),
    lastResetAt: user.lastResetAt,
  };
}
