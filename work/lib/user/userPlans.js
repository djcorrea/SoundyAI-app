// work/lib/user/userPlans.js
// Sistema de planos e limites mensais para SoundyAI

import { getFirestore } from "../../../firebase/admin.js";

// ✅ Obter db via função (lazy loading) ao invés de top-level
const getDb = () => getFirestore();
const USERS = "usuarios"; // Coleção existente no Firestore

console.log(`🔥 [USER-PLANS] Módulo carregado (MIGRAÇÃO MENSAL) - Collection: ${USERS}`);

// ✅ Sistema de limites mensais (NOVA ESTRUTURA)
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 3,
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  plus: {
    maxMessagesPerMonth: 80,
    maxFullAnalysesPerMonth: 25,
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    hardCapAnalysesPerMonth: 200,         // Hard cap: 200/mês e bloqueia
    allowReducedAfterLimit: false,        // Sem reduced, só erro
  },
};

/**
 * Helper: retorna o mês atual no formato YYYY-MM (ex: "2025-12")
 * @param {Date} now - Data de referência (default: new Date())
 * @returns {string} Mês atual
 */
function getCurrentMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7); // "YYYY-MM"
}

/**
 * Normalizar documento do usuário: aplicar reset mensal lazy se necessário
 * @param {Object} user - Dados do usuário
 * @param {string} uid - UID do Firebase Auth
 * @param {Date} now - Data de referência (default: new Date())
 * @returns {Promise<Object>} Dados normalizados
 */
async function normalizeUserDoc(user, uid, now = new Date()) {
  let changed = false;
  const currentMonth = getCurrentMonthKey(now); // "2025-12"
  
  // ✅ Garantir que plan existe
  if (!user.plan) {
    user.plan = "free";
    changed = true;
  }
  
  // ✅ Garantir que analysesMonth e messagesMonth existam e sejam números
  if (typeof user.analysesMonth !== 'number' || isNaN(user.analysesMonth)) {
    user.analysesMonth = 0;
    changed = true;
  }
  
  if (typeof user.messagesMonth !== 'number' || isNaN(user.messagesMonth)) {
    user.messagesMonth = 0;
    changed = true;
  }
  
  // ✅ Garantir que billingMonth existe
  if (!user.billingMonth) {
    user.billingMonth = currentMonth;
    changed = true;
  }
  
  // ✅ RESET MENSAL LAZY: Se mudou o mês, zerar contadores
  if (user.billingMonth !== currentMonth) {
    console.log(`🔄 [USER-PLANS] Reset mensal aplicado para UID=${uid} (${user.billingMonth} → ${currentMonth})`);
    user.analysesMonth = 0;
    user.messagesMonth = 0;
    user.billingMonth = currentMonth;
    changed = true;
  }
  
  // ✅ Verificar expiração do plano Plus
  if (user.plusExpiresAt && Date.now() > new Date(user.plusExpiresAt).getTime() && user.plan === "plus") {
    console.log(`⏰ [USER-PLANS] Plano Plus expirado para: ${uid}`);
    user.plan = "free";
    changed = true;
  }
  
  // ✅ Verificar expiração do plano Pro
  if (user.proExpiresAt && Date.now() > new Date(user.proExpiresAt).getTime() && user.plan === "pro") {
    console.log(`⏰ [USER-PLANS] Plano Pro expirado para: ${uid}`);
    user.plan = "free";
    changed = true;
  }
  
  // ✅ Persistir no Firestore apenas se houver mudanças
  if (changed) {
    const nowISO = now.toISOString();
    const ref = getDb().collection(USERS).doc(uid);
    
    await ref.update({
      plan: user.plan,
      analysesMonth: user.analysesMonth,
      messagesMonth: user.messagesMonth,
      billingMonth: user.billingMonth,
      plusExpiresAt: user.plusExpiresAt || null,
      proExpiresAt: user.proExpiresAt || null,
      updatedAt: nowISO,
    });
    
    user.updatedAt = nowISO;
    console.log(`💾 [USER-PLANS] Usuário normalizado e salvo: ${uid} (plan: ${user.plan}, billingMonth: ${user.billingMonth})`);
  }
  
  return user;
}
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
      const now = new Date();
      const nowISO = now.toISOString();
      const currentMonth = getCurrentMonthKey(now);
      
      const profile = {
        uid,
        plan: "free",
        plusExpiresAt: null,
        proExpiresAt: null,
        
        // ✅ NOVOS CAMPOS MENSAIS
        messagesMonth: 0,
        analysesMonth: 0,
        billingMonth: currentMonth,
        
        createdAt: nowISO,
        updatedAt: nowISO,
        ...extra,
      };
      
      console.log(`💾 [USER-PLANS] Criando novo usuário no Firestore...`);
      console.log(`📋 [USER-PLANS] Perfil:`, JSON.stringify(profile, null, 2));
      
      await ref.set(profile);
      console.log(`✅ [USER-PLANS] Novo usuário criado com sucesso: ${uid} (plan: free, billingMonth: ${currentMonth})`);
      return profile;
    }

    console.log(`♻️ [USER-PLANS] Usuário já existe, normalizando...`);
    return normalizeUserDoc(snap.data(), uid);
    
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
 * @returns {Promise<Object>} { allowed: boolean, user: Object, remaining: number, errorCode?: string }
 */
export async function canUseChat(uid) {
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);
  
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  if (limits.maxMessagesPerMonth === Infinity) {
    console.log(`✅ [USER-PLANS] Chat permitido (ilimitado): ${uid} (plan: ${user.plan})`);
    return { allowed: true, user, remaining: Infinity };
  }

  const current = user.messagesMonth || 0;
  
  if (current >= limits.maxMessagesPerMonth) {
    console.log(`🚫 [USER-PLANS] Chat BLOQUEADO: ${uid} (${current}/${limits.maxMessagesPerMonth} mensagens no mês)`);
    return { 
      allowed: false, 
      user, 
      remaining: 0,
      errorCode: 'LIMIT_REACHED'
    };
  }
  
  const remaining = limits.maxMessagesPerMonth - current;
  console.log(`✅ [USER-PLANS] Chat permitido: ${uid} (${current}/${limits.maxMessagesPerMonth} mensagens no mês) - ${remaining} restantes`);
  
  return { allowed: true, user, remaining };
}

/**
 * Registrar uso de chat (incrementar contador)
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<void>}
 */
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);

  const newCount = (user.messagesMonth || 0) + 1;

  await ref.update({
    messagesMonth: newCount,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`📝 [USER-PLANS] Chat registrado: ${uid} (total no mês: ${newCount})`);
}

/**
 * Verificar se usuário pode usar análise de áudio
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<Object>} { allowed: boolean, mode: "full"|"reduced"|"blocked", user: Object, remainingFull: number, errorCode?: string }
 */
export async function canUseAnalysis(uid) {
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);
  
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  const currentMonthAnalyses = user.analysesMonth || 0;

  // ✅ HARD CAP (PRO): Após 200 análises/mês → BLOQUEAR
  if (limits.hardCapAnalysesPerMonth != null && 
      currentMonthAnalyses >= limits.hardCapAnalysesPerMonth) {
    console.log(`🚫 [USER-PLANS] HARD CAP ATINGIDO: ${uid} (${currentMonthAnalyses}/${limits.hardCapAnalysesPerMonth}) - BLOQUEADO`);
    return {
      allowed: false,
      mode: 'blocked',
      user,
      remainingFull: 0,
      errorCode: 'LIMIT_REACHED',
    };
  }

  // ✅ ANÁLISES FULL ILIMITADAS (PRO antes do hard cap)
  if (limits.maxFullAnalysesPerMonth === Infinity) {
    const remaining = limits.hardCapAnalysesPerMonth 
      ? limits.hardCapAnalysesPerMonth - currentMonthAnalyses 
      : Infinity;
    
    console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (${user.plan.toUpperCase()}): ${uid} (${currentMonthAnalyses}/${limits.hardCapAnalysesPerMonth || '∞'})`);
    return {
      allowed: true,
      mode: 'full',
      user,
      remainingFull: remaining,
    };
  }

  // ✅ ANÁLISES FULL LIMITADAS (FREE/PLUS)
  if (currentMonthAnalyses < limits.maxFullAnalysesPerMonth) {
    const remaining = limits.maxFullAnalysesPerMonth - currentMonthAnalyses;
    console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (${user.plan.toUpperCase()}): ${uid} (${currentMonthAnalyses}/${limits.maxFullAnalysesPerMonth}) - ${remaining} restantes`);
    return {
      allowed: true,
      mode: 'full',
      user,
      remainingFull: remaining,
    };
  }

  // ✅ MODO REDUZIDO (FREE/PLUS após limite de full)
  if (limits.allowReducedAfterLimit) {
    console.log(`⚠️ [USER-PLANS] Análise em MODO REDUZIDO (${user.plan.toUpperCase()}): ${uid} (${currentMonthAnalyses}/${limits.maxFullAnalysesPerMonth} completas usadas)`);
    return {
      allowed: true,
      mode: 'reduced',
      user,
      remainingFull: 0,
    };
  }

  // ✅ FALLBACK: BLOQUEADO (não deveria chegar aqui)
  console.error(`❌ [USER-PLANS] Estado inesperado para ${uid} (plan: ${user.plan})`);
  return {
    allowed: false,
    mode: 'blocked',
    user,
    remainingFull: 0,
    errorCode: 'LIMIT_REACHED',
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
  await normalizeUserDoc(user, uid);

  const newCount = (user.analysesMonth || 0) + 1;

  await ref.update({
    analysesMonth: newCount,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`📝 [USER-PLANS] Análise COMPLETA registrada: ${uid} (total no mês: ${newCount})`);
}

/**
 * Obter informações do plano do usuário
 * @param {string} uid - UID do Firebase Auth
 * @returns {Promise<Object>} Informações completas do plano
 */
export async function getUserPlanInfo(uid) {
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);
  
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  
  // Análises: calcular limite correto baseado no plano
  let analysesLimit;
  let analysesRemaining;
  
  if (limits.maxFullAnalysesPerMonth === Infinity) {
    // PRO: mostrar hard cap
    analysesLimit = limits.hardCapAnalysesPerMonth;
    analysesRemaining = Math.max(0, analysesLimit - (user.analysesMonth || 0));
  } else {
    // FREE/PLUS: mostrar limite de full analyses
    analysesLimit = limits.maxFullAnalysesPerMonth;
    analysesRemaining = Math.max(0, analysesLimit - (user.analysesMonth || 0));
  }
  
  return {
    plan: user.plan,
    
    // Mensagens
    messagesMonth: user.messagesMonth || 0,
    messagesLimit: limits.maxMessagesPerMonth,
    messagesRemaining: limits.maxMessagesPerMonth === Infinity 
      ? Infinity 
      : Math.max(0, limits.maxMessagesPerMonth - (user.messagesMonth || 0)),
    
    // Análises
    analysesMonth: user.analysesMonth || 0,
    analysesLimit,
    analysesRemaining,
    
    // Billing
    billingMonth: user.billingMonth,
    expiresAt: user.plan === 'plus' ? user.plusExpiresAt : (user.plan === 'pro' ? user.proExpiresAt : null),
  };
}

/**
 * Obter features disponíveis baseado no plano e modo de análise
 * @param {string} plan - Plano do usuário: "free" | "plus" | "pro"
 * @param {string} analysisMode - Modo da análise: "full" | "reduced" | "blocked"
 * @returns {Object} Features disponíveis
 */
export function getPlanFeatures(plan, analysisMode) {
  const p = plan || 'free';
  const isFull = analysisMode === 'full';

  // PRO: Todas as features (sempre)
  if (p === 'pro') {
    return {
      canSuggestions: true,
      canSpectralAdvanced: true,
      canAiHelp: true,
      canPdf: true,
    };
  }

  // PLUS: Sugestões apenas em análise full
  if (p === 'plus') {
    return {
      canSuggestions: isFull,
      canSpectralAdvanced: false,
      canAiHelp: false,
      canPdf: false,
    };
  }

  // FREE: Sem features extras
  return {
    canSuggestions: false,
    canSpectralAdvanced: false,
    canAiHelp: false,
    canPdf: false,
  };
}
