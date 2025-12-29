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
    maxMessagesPerMonth: 80,              // ✅ ATUALIZADO: 60 → 80
    maxFullAnalysesPerMonth: 25,          // ✅ ATUALIZADO: 20 → 25
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    maxImagesPerMonth: 70,                // ✅ NOVO: Limite de mensagens com imagens
    hardCapMessagesPerMonth: 300,         // ✅ NOVO: Hard cap invisível para mensagens
    hardCapAnalysesPerMonth: 500,         // ✅ ATUALIZADO: 200 → 500 análises/mês (hard cap técnico)
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
  
  // ✅ NOVO: Garantir que imagesMonth existe e é número
  if (typeof user.imagesMonth !== 'number' || isNaN(user.imagesMonth)) {
    user.imagesMonth = 0;
    changed = true;
  }
  
  // 🧼 LIMPEZA: Remover campo legado imagemAnalises (se existir)
  if (user.imagemAnalises !== undefined) {
    delete user.imagemAnalises;
    changed = true;
    console.log(`🧹 [USER-PLANS] Campo legado imagemAnalises removido para UID=${uid}`);
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
    user.imagesMonth = 0; // ✅ NOVO: Resetar contador de imagens
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

  // ✅ STRIPE: Verificar expiração de assinatura recorrente
  if (user.subscription && user.subscription.status === 'canceled') {
    const currentPeriodEnd = new Date(user.subscription.currentPeriodEnd).getTime();
    if (Date.now() > currentPeriodEnd) {
      console.log(`⏰ [USER-PLANS] Assinatura Stripe expirada para: ${uid}`);
      user.plan = "free";
      user.subscription = null;
      changed = true;
    }
  }
  
  // ✅ Persistir no Firestore apenas se houver mudanças
  if (changed) {
    const nowISO = now.toISOString();
    const ref = getDb().collection(USERS).doc(uid);
    
    const updateData = {
      plan: user.plan,
      analysesMonth: user.analysesMonth,
      messagesMonth: user.messagesMonth,
      imagesMonth: user.imagesMonth ?? 0,
      billingMonth: user.billingMonth,
      plusExpiresAt: user.plusExpiresAt ?? null,
      proExpiresAt: user.proExpiresAt ?? null,
      updatedAt: nowISO,
    };

    // ✅ STRIPE: Incluir subscription se existir
    if (user.subscription !== undefined) {
      updateData.subscription = user.subscription;
    }
    
    await ref.update(updateData);
    
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
        imagesMonth: 0, // ✅ NOVO: Contador de imagens
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

  // ✅ ETAPA 2.5: Limpar campo anterior para evitar estados inconsistentes
  if (plan === "plus") {
    update.plusExpiresAt = expires;
    update.proExpiresAt = null;  // Limpar PRO ao ativar PLUS
  }
  
  if (plan === "pro") {
    update.proExpiresAt = expires;
    update.plusExpiresAt = null;  // Limpar PLUS ao ativar PRO
  }

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Plano aplicado: ${uid} → ${plan} até ${expires}`);
  
  return updatedUser;
}

/**
 * Aplicar assinatura Stripe (modo recorrente)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { plan, subscriptionId, status, currentPeriodEnd, priceId }
 * @returns {Promise<Object>} Perfil atualizado
 */
export async function applySubscription(uid, { plan, subscriptionId, status, currentPeriodEnd, priceId }) {
  console.log(`💳 [USER-PLANS] Aplicando assinatura Stripe ${plan} para ${uid}`);
  
  const ref = getDb().collection(USERS).doc(uid);
  await getOrCreateUser(uid);

  const update = {
    plan,
    subscription: {
      id: subscriptionId,
      status,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      priceId,
    },
    updatedAt: new Date().toISOString(),
  };

  // Limpar campos de expiração anteriores (pagamentos únicos)
  if (plan === "plus") {
    update.plusExpiresAt = null;
    update.proExpiresAt = null;
  }
  
  if (plan === "pro") {
    update.proExpiresAt = null;
    update.plusExpiresAt = null;
  }

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Assinatura aplicada: ${uid} → ${plan} (Sub: ${subscriptionId})`);
  
  return updatedUser;
}

/**
 * Cancelar assinatura Stripe (mantém ativo até fim do período)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { subscriptionId, currentPeriodEnd }
 * @returns {Promise<Object>} Perfil atualizado
 */
export async function cancelSubscription(uid, { subscriptionId, currentPeriodEnd }) {
  console.log(`🚫 [USER-PLANS] Cancelando assinatura ${subscriptionId} para ${uid}`);
  
  const ref = getDb().collection(USERS).doc(uid);
  const userDoc = await ref.get();
  
  if (!userDoc.exists) {
    throw new Error(`Usuário ${uid} não encontrado`);
  }

  const update = {
    'subscription.status': 'canceled',
    'subscription.currentPeriodEnd': currentPeriodEnd.toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Assinatura cancelada (ativa até ${currentPeriodEnd.toISOString()})`);
  
  return updatedUser;
}

/**
 * Verificar se usuário pode usar chat
 * @param {string} uid - UID do Firebase Auth
 * @param {boolean} hasImages - Se a mensagem contém imagens (para contabilizar uso de GPT-4o)
 * @returns {Promise<Object>} { allowed: boolean, user: Object, remaining: number, errorCode?: string }
 */
export async function canUseChat(uid, hasImages = false) {
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);
  
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  // ✅ NOVO: Verificar hard cap de mensagens para PRO
  if (limits.hardCapMessagesPerMonth != null) {
    const currentMessages = user.messagesMonth || 0;
    
    if (currentMessages >= limits.hardCapMessagesPerMonth) {
      console.log(`🚫 [USER-PLANS] HARD CAP DE MENSAGENS ATINGIDO: ${uid} (${currentMessages}/${limits.hardCapMessagesPerMonth})`);
      return { 
        allowed: false, 
        user, 
        remaining: 0,
        errorCode: 'SYSTEM_PEAK_USAGE'
      };
    }
  }

  // ✅ NOVO: Verificar limite de imagens para PRO
  if (hasImages && limits.maxImagesPerMonth != null) {
    const currentImages = user.imagesMonth || 0;
    
    if (currentImages >= limits.maxImagesPerMonth) {
      console.log(`🚫 [USER-PLANS] LIMITE DE IMAGENS ATINGIDO: ${uid} (${currentImages}/${limits.maxImagesPerMonth})`);
      return { 
        allowed: false, 
        user, 
        remaining: 0,
        errorCode: 'IMAGE_PEAK_USAGE'
      };
    }
  }

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
 * @param {boolean} hasImages - Se a mensagem contém imagens
 * @returns {Promise<void>}
 */
export async function registerChat(uid, hasImages = false) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);

  const newCount = (user.messagesMonth || 0) + 1;
  
  const updateData = {
    messagesMonth: newCount,
    updatedAt: new Date().toISOString(),
  };

  // ✅ NOVO: Incrementar contador de imagens se aplicável
  if (hasImages) {
    const newImageCount = (user.imagesMonth || 0) + 1;
    updateData.imagesMonth = newImageCount;
    console.log(`📝 [USER-PLANS] Chat com imagem registrado: ${uid} (mensagens: ${newCount}, imagens: ${newImageCount})`);
  } else {
    console.log(`📝 [USER-PLANS] Chat registrado: ${uid} (total no mês: ${newCount})`);
  }

  await ref.update(updateData);
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

  // ✅ HARD CAP (PRO): Após 500 análises/mês → BLOQUEAR com mensagem neutra
  if (limits.hardCapAnalysesPerMonth != null && 
      currentMonthAnalyses >= limits.hardCapAnalysesPerMonth) {
    console.log(`🚫 [USER-PLANS] HARD CAP ATINGIDO: ${uid} (${currentMonthAnalyses}/${limits.hardCapAnalysesPerMonth}) - BLOQUEADO`);
    return {
      allowed: false,
      mode: 'blocked',
      user,
      remainingFull: 0,
      errorCode: 'SYSTEM_PEAK_USAGE',
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

  console.log(`📊 [USER-PLANS] getPlanFeatures - plan: ${p}, mode: ${analysisMode}, isFull: ${isFull}`);

  // PRO: Todas as features (sempre)
  if (p === 'pro') {
    console.log('✅ [USER-PLANS] PRO - Todas as features liberadas');
    return {
      canSuggestions: true,
      canSpectralAdvanced: true,
      canAiHelp: true,
      canPdf: true,
      canCorrectionPlan: true,  // ✅ Plano de Correção ilimitado
    };
  }

  // PLUS: Sugestões apenas em análise full, IA/PDF sempre bloqueados
  if (p === 'plus') {
    console.log(`✅ [USER-PLANS] PLUS - Sugestões: ${isFull}, IA/PDF: bloqueados`);
    return {
      canSuggestions: isFull,
      canSpectralAdvanced: false,
      canAiHelp: false,
      canPdf: false,
      canCorrectionPlan: isFull,  // ✅ Plano de Correção em análise full
    };
  }

  // FREE: Em modo FULL (trial das 3 primeiras), libera TUDO. Em reduced, bloqueia TUDO.
  if (isFull) {
    console.log('🎁 [USER-PLANS] FREE TRIAL (modo FULL) - IA e PDF LIBERADOS');
    return {
      canSuggestions: true,
      canSpectralAdvanced: false,
      canAiHelp: true,  // ✅ LIBERADO NO TRIAL
      canPdf: true,     // ✅ LIBERADO NO TRIAL
      canCorrectionPlan: true,  // ✅ Plano de Correção no trial (1/mês)
    };
  } else {
    console.log('🔒 [USER-PLANS] FREE REDUCED - Tudo bloqueado');
    return {
      canSuggestions: false,
      canSpectralAdvanced: false,
      canAiHelp: false,
      canPdf: false,
      canCorrectionPlan: false,  // 🔒 Bloqueado no modo reduced
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 LIMITES DE PLANO DE CORREÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Limites mensais para geração de Planos de Correção
 */
export const CORRECTION_PLAN_LIMITS = {
  free: 1,    // 1 plano/mês (preview)
  plus: 10,   // 10 planos/mês
  pro: 50     // 50 planos/mês (hard cap anti-abuse)
};
