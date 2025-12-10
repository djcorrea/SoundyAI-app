// work/lib/user/userPlans.js
// Sistema de planos e limites para SoundyAI

import { getFirestore } from "../../../firebase/admin.js";

// ✅ Obter db via função (lazy loading) ao invés de top-level
const getDb = () => getFirestore();
const USERS = "usuarios"; // Coleção existente no Firestore

console.log(`🔥 [USER-PLANS] Módulo carregado - Collection: ${USERS}`);

// ✅ Sistema de limites mensais
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 3,
    hardCapAnalysesPerMonth: 3,
  },
  plus: {
    maxMessagesPerMonth: 60,
    maxFullAnalysesPerMonth: 20,
    hardCapAnalysesPerMonth: 20,
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    hardCapAnalysesPerMonth: 200,
  },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Helper: retorna o mês atual no formato YYYY-MM (ex: "2025-12")
 * @returns {string} Mês atual
 */
const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);

/**
 * Buscar ou criar usuário no Firestore
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} extra - Dados extras para criação
 * @returns {Promise<Object>} Perfil do usuário
 */
export async function getOrCreateUser(uid, extra = {}) {
  console.log(`🔍 [USER-PLANS] getOrCreateUser chamado para UID: ${uid}`);
  
  try {
    const db = getDb();
    console.log(`📦 [USER-PLANS] Firestore obtido, acessando collection: ${USERS}`);
    
    const ref = db.collection(USERS).doc(uid);
    console.log(`📄 [USER-PLANS] Referência do documento criada: ${USERS}/${uid}`);
    
    const snap = await ref.get();
    console.log(`📊 [USER-PLANS] Snapshot obtido - Existe: ${snap.exists}`);

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
      
      console.log(`💾 [USER-PLANS] Criando novo usuário no Firestore...`);
      console.log(`📋 [USER-PLANS] Perfil:`, JSON.stringify(profile, null, 2));
      
      await ref.set(profile);
      console.log(`✅ [USER-PLANS] Novo usuário criado com sucesso: ${uid} (plan: free)`);
      return profile;
    }

    console.log(`♻️ [USER-PLANS] Usuário já existe, normalizando...`);
    return normalizeUser(ref, snap.data());
    
  } catch (error) {
    console.error(`❌ [USER-PLANS] ERRO CRÍTICO em getOrCreateUser:`);
    console.error(`   UID: ${uid}`);
    console.error(`   Collection: ${USERS}`);
    console.error(`   Erro: ${error.message}`);
    console.error(`   Stack:`, error.stack);
    throw error;
  }
}

/**
 * Normalizar usuário: verificar expiração + reset mensal
 * @param {FirestoreDocRef} ref - Referência do documento
 * @param {Object} data - Dados atuais do usuário
 * @returns {Promise<Object>} Dados normalizados
 */
async function normalizeUser(ref, data) {
  let changed = false;
  const now = new Date().toISOString();
  const currentMonth = getCurrentMonthKey(); // "2025-12"
  const lastResetMonth = (data.lastResetAt || "").slice(0, 7); // "2025-11"

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

  // ✅ Reset mensal de contadores (não mais diário)
  if (lastResetMonth !== currentMonth) {
    console.log(`🔄 [USER-PLANS] Reset mensal para: ${data.uid} (último: ${lastResetMonth}, atual: ${currentMonth})`);
    data.messagesToday = 0; // Reaproveitado como contador do mês
    data.analysesToday = 0; // Reaproveitado como contador do mês
    data.lastResetAt = now; // ISO completo
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

  if (limits.maxMessagesPerMonth === Infinity) {
    console.log(`✅ [USER-PLANS] Chat permitido (ilimitado): ${uid} (plan: ${user.plan})`);
    return { allowed: true, user, remaining: Infinity };
  }

  const remaining = limits.maxMessagesPerMonth - (user.messagesToday || 0);
  const allowed = remaining > 0;
  
  console.log(`🔍 [USER-PLANS] Chat check: ${uid} (${user.messagesToday}/${limits.maxMessagesPerMonth} mensagens no mês) - ${allowed ? 'OK' : 'BLOQUEADO'}`);
  
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
 * @returns {Promise<Object>} { allowed: boolean, mode: "full"|"reduced"|"blocked", user: Object, remainingFull: number }
 */
export async function canUseAnalysis(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];
  const currentAnalyses = user.analysesToday || 0;

  // FREE: 3 análises completas, depois modo reduzido
  if (user.plan === "free") {
    if (currentAnalyses < limits.maxFullAnalysesPerMonth) {
      console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (FREE): ${uid} (${currentAnalyses}/${limits.maxFullAnalysesPerMonth})`);
      return {
        allowed: true,
        mode: "full",
        user,
        remainingFull: limits.maxFullAnalysesPerMonth - currentAnalyses,
      };
    } else {
      console.log(`⚠️ [USER-PLANS] Análise em MODO REDUZIDO (FREE): ${uid} (${currentAnalyses}/${limits.maxFullAnalysesPerMonth} completas usadas)`);
      return {
        allowed: true,
        mode: "reduced",
        user,
        remainingFull: 0,
      };
    }
  }

  // PLUS: 20 análises completas, depois modo reduzido
  if (user.plan === "plus") {
    if (currentAnalyses < limits.maxFullAnalysesPerMonth) {
      console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (PLUS): ${uid} (${currentAnalyses}/${limits.maxFullAnalysesPerMonth})`);
      return {
        allowed: true,
        mode: "full",
        user,
        remainingFull: limits.maxFullAnalysesPerMonth - currentAnalyses,
      };
    } else {
      console.log(`⚠️ [USER-PLANS] Análise em MODO REDUZIDO (PLUS): ${uid} (${currentAnalyses}/${limits.maxFullAnalysesPerMonth} completas usadas)`);
      return {
        allowed: true,
        mode: "reduced",
        user,
        remainingFull: 0,
      };
    }
  }

  // PRO: 200 análises hard cap, depois bloqueia
  if (user.plan === "pro") {
    if (currentAnalyses < limits.hardCapAnalysesPerMonth) {
      console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (PRO): ${uid} (${currentAnalyses}/${limits.hardCapAnalysesPerMonth})`);
      return {
        allowed: true,
        mode: "full",
        user,
        remainingFull: limits.hardCapAnalysesPerMonth - currentAnalyses,
      };
    } else {
      console.log(`🚫 [USER-PLANS] HARD CAP ATINGIDO (PRO): ${uid} (${currentAnalyses}/${limits.hardCapAnalysesPerMonth})`);
      return {
        allowed: false,
        mode: "blocked",
        user,
        remainingFull: 0,
      };
    }
  }

  // Fallback (não deveria chegar aqui)
  console.error(`❌ [USER-PLANS] Plano desconhecido: ${user.plan} para ${uid}`);
  return {
    allowed: false,
    mode: "blocked",
    user,
    remainingFull: 0,
  };
}

/**
 * Registrar uso de análise (incrementar contador apenas para análises completas)
 * @param {string} uid - UID do Firebase Auth
 * @param {string} mode - Modo da análise: "full" | "reduced" | "blocked"
 * @returns {Promise<void>}
 */
export async function registerAnalysis(uid, mode = "full") {
  // ✅ Só incrementa se foi análise completa
  if (mode !== "full") {
    console.log(`⏭️ [USER-PLANS] Análise NÃO registrada (modo: ${mode}): ${uid}`);
    return;
  }

  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);

  await ref.update({
    analysesToday: (user.analysesToday || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`📝 [USER-PLANS] Análise COMPLETA registrada: ${uid} (total no mês: ${(user.analysesToday || 0) + 1})`);
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
    messagesLimit: limits.maxMessagesPerMonth,
    messagesRemaining: limits.maxMessagesPerMonth === Infinity 
      ? Infinity 
      : Math.max(0, limits.maxMessagesPerMonth - (user.messagesToday || 0)),
    analysesToday: user.analysesToday || 0,
    analysesLimit: limits.maxFullAnalysesPerMonth === Infinity ? limits.hardCapAnalysesPerMonth : limits.maxFullAnalysesPerMonth,
    analysesRemaining: limits.maxFullAnalysesPerMonth === Infinity 
      ? Math.max(0, limits.hardCapAnalysesPerMonth - (user.analysesToday || 0))
      : Math.max(0, limits.maxFullAnalysesPerMonth - (user.analysesToday || 0)),
    expiresAt: user.plan === 'plus' ? user.plusExpiresAt : (user.plan === 'pro' ? user.proExpiresAt : null),
    lastResetAt: user.lastResetAt,
  };
}

/**
 * Obter features disponíveis baseado no plano e modo de análise
 * @param {string} plan - Plano do usuário: "free" | "plus" | "pro"
 * @param {string} analysisMode - Modo da análise: "full" | "reduced" | "blocked"
 * @returns {Object} Features disponíveis
 */
export function getPlanFeatures(plan, analysisMode) {
  const base = {
    canSuggestions: false,
    canUltraSuggestions: false,
    canSpectralAdvanced: false,
    canHelpAI: false,
    canPDF: false,
  };

  if (plan === "free") return base;

  if (plan === "plus") {
    return {
      ...base,
      canSuggestions: analysisMode === "full", // Só em análise completa
    };
  }

  if (plan === "pro") {
    if (analysisMode === "blocked") return base;
    return {
      canSuggestions: true,
      canUltraSuggestions: analysisMode === "full",
      canSpectralAdvanced: analysisMode === "full",
      canHelpAI: analysisMode === "full",
      canPDF: analysisMode === "full",
    };
  }

  return base;
}
