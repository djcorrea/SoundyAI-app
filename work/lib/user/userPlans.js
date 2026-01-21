// work/lib/user/userPlans.js
// Sistema de planos e limites mensais para SoundyAI

import { getFirestore } from "../../../firebase/admin.js";
import { detectEnvironment, getEnvironmentFeatures } from '../../config/environment.js';

// ✅ Obter db via função (lazy loading) ao invés de top-level
const getDb = () => getFirestore();
const USERS = "usuarios"; // Coleção existente no Firestore

// ✅ Detectar ambiente
const ENV = detectEnvironment();
const ENV_FEATURES = getEnvironmentFeatures(ENV);

console.log(`🔥 [USER-PLANS] Módulo carregado (MIGRAÇÃO MENSAL) - Collection: ${USERS}`);
console.log(`🌍 [USER-PLANS] Ambiente: ${ENV}`);
console.log(`⚙️ [USER-PLANS] Auto-grant PRO em teste: ${ENV_FEATURES.features.autoGrantProPlan}`);

// ✅ Sistema de limites mensais (NOVA ESTRUTURA)
// 🔓 ATUALIZAÇÃO 2026-01-06: Ajuste de limites PLUS (20), PRO (60) e criação STUDIO (400)
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 1,           // ✅ 1 análise/mês (modo anônimo: 2)
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  plus: {
    maxMessagesPerMonth: 80,              // ✅ Mantido: 80 mensagens/mês
    maxFullAnalysesPerMonth: 20,          // ✅ ATUALIZADO 2026-01-06: 25 → 20 análises/mês
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  pro: {
    maxMessagesPerMonth: Infinity,        // Ilimitado visualmente
    maxFullAnalysesPerMonth: 60,          // ✅ 60 análises completas/mês
    maxImagesPerMonth: 70,                // Limite de mensagens com imagens
    hardCapMessagesPerMonth: 300,         // Hard cap invisível para mensagens
    hardCapAnalysesPerMonth: null,        // ✅ SEM HARD CAP: permite reduced após 60 análises
    allowReducedAfterLimit: true,         // ✅ Permite reduced após limite
  },
  // 🎧 DJ BETA: Limites idênticos ao PRO (acesso temporário 15 dias)
  dj: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: 60,          // ✅ Segue PRO
    maxImagesPerMonth: 70,
    hardCapMessagesPerMonth: 300,
    hardCapAnalysesPerMonth: null,        // ✅ SEM HARD CAP: permite reduced (segue PRO)
    allowReducedAfterLimit: true,
  },
  // 🎬 STUDIO (R$99,90/mês) - Plano premium para produtores profissionais e estúdios
  // Análises e chat "ilimitados" com hard cap técnico de 400 (proteção de custo)
  studio: {
    maxMessagesPerMonth: Infinity,        // Ilimitado visualmente
    maxFullAnalysesPerMonth: Infinity,    // Ilimitado visualmente
    maxImagesPerMonth: 150,               // ✅ Mais imagens que PRO
    hardCapMessagesPerMonth: 400,         // ✅ HARD CAP: 400 mensagens/mês
    hardCapAnalysesPerMonth: 400,         // ✅ HARD CAP: 400 análises/mês
    allowReducedAfterLimit: false,        // Bloqueia após hard cap
    priorityQueue: true,                  // ✅ Prioridade de processamento
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
  
  // 🧪 AMBIENTE DE TESTE: Auto-grant plano PRO para usuários sem plano pago
  if (ENV_FEATURES.features.autoGrantProPlan && user.plan === 'free') {
    user.plan = 'pro';
    user.proExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 ano
    changed = true;
    console.log(`🧪 [USER-PLANS][TESTE] Auto-grant PRO aplicado para UID: ${uid} (era FREE)`);
  }
  
  // ✅ Garantir que plan existe
  if (!user.plan) {
    user.plan = ENV_FEATURES.features.autoGrantProPlan ? 'pro' : 'free';
    if (ENV_FEATURES.features.autoGrantProPlan) {
      user.proExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`🧪 [USER-PLANS][TESTE] Auto-grant PRO aplicado para UID: ${uid} (sem plano)`);
    }
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

  // 🎧 BETA DJS: Verificar expiração do plano dj (15 dias)
  if (user.djExpiresAt && Date.now() > new Date(user.djExpiresAt).getTime() && user.plan === "dj") {
    console.log(`🎧 [USER-PLANS] Plano DJ Beta expirado para: ${uid}`);
    user.plan = "free";
    user.djExpired = true;  // ✅ Flag para exibir modal de encerramento
    changed = true;
  }

  // 🎬 STUDIO: Verificar expiração do plano Studio (120 dias via Hotmart)
  if (user.studioExpiresAt && Date.now() > new Date(user.studioExpiresAt).getTime() && user.plan === "studio") {
    console.log(`🎬 [USER-PLANS] Plano Studio expirado para: ${uid}`);
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
      djExpiresAt: user.djExpiresAt ?? null,        // 🎧 NOVO: Expiração Beta DJs
      djExpired: user.djExpired ?? false,           // 🎧 NOVO: Flag de beta expirado
      studioExpiresAt: user.studioExpiresAt ?? null, // 🎬 NOVO: Expiração STUDIO (Hotmart)
      updatedAt: nowISO,
    };

    // ✅ STRIPE: Incluir subscription se existir
    if (user.subscription !== undefined) {
      updateData.subscription = user.subscription;
    }
    
    // ✅ CRÍTICO: Preservar campo perfil (entrevista do usuário) se existir
    // Não deve ser alterado pela normalização de planos
    if (user.perfil !== undefined) {
      // Não incluir no updateData para não sobrescrever
      // Apenas preservar no objeto retornado
      console.log(`✅ [USER-PLANS] Perfil do usuário preservado (entrevista concluída)`);
    }
    
    await ref.update(updateData);
    
    user.updatedAt = nowISO;
    console.log(`💾 [USER-PLANS] Usuário normalizado e salvo: ${uid} (plan: ${user.plan}, billingMonth: ${user.billingMonth})`);
  }
  
  // ✅ DEBUG FINAL: Confirmar que perfil está no objeto retornado
  if (user.perfil) {
    console.log(`✅ [USER-PLANS] RETORNANDO perfil completo para ${uid}`);
  } else {
    console.log(`⚠️ [USER-PLANS] ATENÇÃO: perfil NÃO está no objeto retornado para ${uid}`);
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
      
      // 🧪 AMBIENTE DE TESTE: Auto-grant plano PRO para facilitar testes
      const defaultPlan = ENV_FEATURES.features.autoGrantProPlan ? 'pro' : 'free';
      const proExpiration = ENV_FEATURES.features.autoGrantProPlan 
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 ano
        : null;
      
      const profile = {
        uid,
        plan: defaultPlan,
        plusExpiresAt: null,
        proExpiresAt: proExpiration,
        djExpiresAt: null,         // 🎧 NOVO: Controle Beta DJs
        djExpired: false,          // 🎧 NOVO: Flag de beta expirado
        
        // ✅ NOVOS CAMPOS MENSAIS
        messagesMonth: 0,
        analysesMonth: 0,
        imagesMonth: 0, // ✅ NOVO: Contador de imagens
        billingMonth: currentMonth,
        
        createdAt: nowISO,
        updatedAt: nowISO,
        ...extra,
      };
      
      if (ENV_FEATURES.features.autoGrantProPlan) {
        console.log(`🧪 [USER-PLANS][TESTE] Auto-grant plano PRO ativado para UID: ${uid}`);
      }
      
      console.log(`💾 [USER-PLANS] Criando novo usuário no Firestore...`);
      console.log(`📋 [USER-PLANS] Perfil:`, JSON.stringify(profile, null, 2));
      
      await ref.set(profile);
      console.log(`✅ [USER-PLANS] Novo usuário criado com sucesso: ${uid} (plan: ${defaultPlan}, billingMonth: ${currentMonth})`);
      return profile;
    }

    console.log(`♻️ [USER-PLANS] Usuário já existe, normalizando...`);
    const fullUserData = snap.data();
    
    // ✅ DEBUG: Verificar se perfil está presente
    if (fullUserData.perfil) {
      console.log(`✅ [USER-PLANS] Perfil de entrevista encontrado para ${uid}:`, {
        nomeArtistico: fullUserData.perfil.nomeArtistico || '(não informado)',
        nivelTecnico: fullUserData.perfil.nivelTecnico || '(não informado)',
        daw: fullUserData.perfil.daw || '(não informado)',
        estilo: fullUserData.perfil.estilo || '(não informado)'
      });
    } else {
      console.log(`⚠️ [USER-PLANS] Perfil de entrevista NÃO encontrado para ${uid}`);
    }
    
    return normalizeUserDoc(fullUserData, uid);
    
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
 * Aplicar plano (usado pelos webhooks Mercado Pago e Hotmart)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { plan: 'plus'|'pro'|'studio'|'dj', durationDays: number }
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
    update.djExpiresAt = null;   // Limpar DJ ao ativar PLUS
    update.studioExpiresAt = null; // Limpar STUDIO ao ativar PLUS
  }
  
  if (plan === "pro") {
    update.proExpiresAt = expires;
    update.plusExpiresAt = null;  // Limpar PLUS ao ativar PRO
    update.djExpiresAt = null;    // Limpar DJ ao ativar PRO
    update.studioExpiresAt = null; // Limpar STUDIO ao ativar PRO
  }

  // 🎧 DJ BETA: Ativar plano DJ (15 dias fixos)
  if (plan === "dj") {
    update.djExpiresAt = expires;
    update.plusExpiresAt = null;  // Limpar PLUS ao ativar DJ
    update.proExpiresAt = null;   // Limpar PRO ao ativar DJ
    update.studioExpiresAt = null; // Limpar STUDIO ao ativar DJ
    update.djExpired = false;     // Resetar flag de expiração
  }

  // 🎬 STUDIO: Ativar plano STUDIO (120 dias via Hotmart)
  if (plan === "studio") {
    update.studioExpiresAt = expires;
    update.plusExpiresAt = null;  // Limpar PLUS ao ativar STUDIO
    update.proExpiresAt = null;   // Limpar PRO ao ativar STUDIO
    update.djExpiresAt = null;    // Limpar DJ ao ativar STUDIO
  }

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Plano aplicado: ${uid} → ${plan} até ${expires}`);
  
  return updatedUser;
}

/**
 * Aplicar assinatura Stripe (modo recorrente)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { plan, subscriptionId, customerId, status, currentPeriodEnd, priceId }
 * @returns {Promise<Object>} Perfil atualizado
 */
export async function applySubscription(uid, { plan, subscriptionId, customerId, status, currentPeriodEnd, priceId }) {
  console.log(`💳 [USER-PLANS] Aplicando assinatura Stripe ${plan} para ${uid}`);
  
  const ref = getDb().collection(USERS).doc(uid);
  await getOrCreateUser(uid);

  const update = {
    plan,
    subscription: {
      id: subscriptionId,
      customerId: customerId || null,
      status,
      currentPeriodEnd: currentPeriodEnd instanceof Date ? currentPeriodEnd.toISOString() : currentPeriodEnd,
      priceId,
      updatedAt: new Date().toISOString(),
    },
    // ✅ Salvar customerId no nível do documento para fácil acesso
    stripeCustomerId: customerId || null,
    updatedAt: new Date().toISOString(),
  };

  // Limpar campos de expiração anteriores (pagamentos únicos)
  if (plan === "plus") {
    update.plusExpiresAt = null;
    update.proExpiresAt = null;
    update.studioExpiresAt = null;   // ✅ NOVO: Limpar STUDIO
  }
  
  if (plan === "pro") {
    update.proExpiresAt = null;
    update.plusExpiresAt = null;
    update.studioExpiresAt = null;   // ✅ NOVO: Limpar STUDIO
  }

  // ✅ NOVO 2026-01-06: Suporte ao plano STUDIO
  if (plan === "studio") {
    update.studioExpiresAt = null;
    update.plusExpiresAt = null;
    update.proExpiresAt = null;
  }

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Assinatura aplicada: ${uid} → ${plan} (Sub: ${subscriptionId}, Status: ${status})`);
  
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

  const periodEnd = currentPeriodEnd instanceof Date ? currentPeriodEnd.toISOString() : currentPeriodEnd;

  const update = {
    'subscription.status': 'canceled',
    'subscription.currentPeriodEnd': periodEnd,
    'subscription.canceledAt': new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Assinatura cancelada (ativa até ${periodEnd})`);
  
  return updatedUser;
}

/**
 * Rebaixar usuário para plano FREE (após inadimplência ou expiração)
 * @param {string} uid - UID do Firebase Auth
 * @param {Object} options - { subscriptionId, reason }
 * @returns {Promise<Object>} Perfil atualizado
 */
export async function downgradeToFree(uid, { subscriptionId, reason }) {
  console.log(`🔻 [USER-PLANS] Rebaixando para FREE: ${uid} (motivo: ${reason})`);
  
  const ref = getDb().collection(USERS).doc(uid);
  const userDoc = await ref.get();
  
  if (!userDoc.exists) {
    throw new Error(`Usuário ${uid} não encontrado`);
  }

  const now = new Date().toISOString();

  const update = {
    plan: 'free',
    subscription: {
      id: subscriptionId || null,
      status: 'expired',
      expiredAt: now,
      expiredReason: reason,
    },
    // Manter customerId para histórico
    plusExpiresAt: null,
    proExpiresAt: null,
    updatedAt: now,
  };

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Usuário rebaixado para FREE: ${uid}`);
  
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
    // ✅ ATUALIZADO 2026-01-06: Inclui 'studio'
    expiresAt: user.plan === 'plus' ? user.plusExpiresAt 
             : user.plan === 'pro' ? user.proExpiresAt 
             : user.plan === 'studio' ? user.studioExpiresAt 
             : null,
  };
}

/**
 * Obter features disponíveis baseado no plano e modo de análise
 * @param {string} plan - Plano do usuário: "free" | "plus" | "pro" | "studio"
 * @param {string} analysisMode - Modo da análise: "full" | "reduced" | "blocked"
 * @returns {Object} Features disponíveis
 */
export function getPlanFeatures(plan, analysisMode) {
  const p = plan || 'free';
  const isFull = analysisMode === 'full';

  console.log(`📊 [USER-PLANS] getPlanFeatures - plan: ${p}, mode: ${analysisMode}, isFull: ${isFull}`);

  // ✅ STUDIO: Todas as features + extras premium (NOVO 2026-01-06)
  if (p === 'studio') {
    console.log('✅ [USER-PLANS] STUDIO - Todas as features + prioridade');
    return {
      canSuggestions: true,
      canSpectralAdvanced: true,
      canAiHelp: true,
      canPdf: true,
      canCorrectionPlan: true,
      priorityProcessing: true,   // ✅ Prioridade de processamento
      studioBadge: true,          // ✅ Badge STUDIO
    };
  }

  // PRO: Todas as features EXCETO Plano de Correção (agora é DJ/STUDIO only)
  if (p === 'pro') {
    console.log('✅ [USER-PLANS] PRO - Features liberadas (sem correctionPlan)');
    return {
      canSuggestions: true,
      canSpectralAdvanced: true,
      canAiHelp: true,
      canPdf: true,
      canCorrectionPlan: false,  // ❌ REMOVIDO 2026-01-06: Agora é DJ/STUDIO only
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
 * ✅ ATUALIZADO 2026-01-06: PRO não tem mais acesso ao Plano de Correção
 * Agora é exclusivo de DJ (beta) e STUDIO
 */
export const CORRECTION_PLAN_LIMITS = {
  free: 1,     // 1 plano/mês (preview/trial)
  plus: 0,     // ❌ Não tem acesso
  pro: 0,      // ❌ REMOVIDO 2026-01-06: PRO não tem mais Plano de Correção
  dj: 50,      // 50 planos/mês (beta temporário)
  studio: 100  // 100 planos/mês (hard cap anti-abuse)
};
