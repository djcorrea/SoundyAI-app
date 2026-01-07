// work/lib/entitlements.js
// Sistema Centralizado de Entitlements (Controle de Acesso por Plano)
// ✅ FONTE DA VERDADE: Backend valida, frontend exibe modal

import { STRIPE_PRICE_IDS, getPlanFromPriceId } from './stripe/config.js';

console.log('🔐 [ENTITLEMENTS] Módulo carregado');

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAPEAMENTO DE FEATURES POR PLANO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Entitlements por plano
 * Define quais features cada plano pode acessar
 * 
 * REGRA ATUALIZADA 2026-01-06:
 * - reference, pdf, askAI são EXCLUSIVOS do PRO+
 * - correctionPlan agora é EXCLUSIVO de DJ e STUDIO (PRO não tem mais)
 */
export const PLAN_ENTITLEMENTS = {
  free: {
    reference: false,       // ❌ Modo Referência (PRO+ only)
    correctionPlan: false,  // ❌ Gerar Plano de Correção (DJ/STUDIO only)
    pdf: false,             // ❌ Baixar PDF (PRO+ only)
    askAI: false,           // ❌ Pedir Ajuda à IA (PRO+ only)
    // Features permitidas no FREE
    genreAnalysis: true,    // ✅ Análise por gênero (com limite mensal)
    suggestions: true,      // ✅ Sugestões de IA (em análise full)
  },
  plus: {
    reference: false,       // ❌ Modo Referência (PRO+ only)
    correctionPlan: false,  // ❌ Gerar Plano de Correção (DJ/STUDIO only)
    pdf: false,             // ❌ Baixar PDF (PRO+ only)
    askAI: false,           // ❌ Pedir Ajuda à IA (PRO+ only)
    // Features permitidas no PLUS
    genreAnalysis: true,    // ✅ Análise por gênero (com limite mensal maior)
    suggestions: true,      // ✅ Sugestões de IA (em análise full)
  },
  pro: {
    reference: true,        // ✅ Modo Referência
    correctionPlan: false,  // ❌ REMOVIDO 2026-01-06: Plano de Correção agora é DJ/STUDIO only
    pdf: true,              // ✅ Baixar PDF
    askAI: true,            // ✅ Pedir Ajuda à IA
    // Features permitidas no PRO
    genreAnalysis: true,    // ✅ Análise por gênero ilimitada
    suggestions: true,      // ✅ Sugestões de IA
  },
  // 🎧 DJ BETA: Mantém Plano de Correção (duração limitada a 15 dias)
  dj: {
    reference: true,        // ✅ Modo Referência (temporário)
    correctionPlan: true,   // ✅ Gerar Plano de Correção (temporário)
    pdf: true,              // ✅ Baixar PDF (temporário)
    askAI: true,            // ✅ Pedir Ajuda à IA (temporário)
    // Features do Beta DJs
    genreAnalysis: true,    // ✅ Análise por gênero ilimitada
    suggestions: true,      // ✅ Sugestões de IA
  },
  // ✅ NOVO 2026-01-06: Plano STUDIO (R$99,90/mês)
  studio: {
    reference: true,        // ✅ Modo Referência
    correctionPlan: true,   // ✅ Gerar Plano de Correção (EXCLUSIVO DJ/STUDIO)
    pdf: true,              // ✅ Baixar PDF
    askAI: true,            // ✅ Pedir Ajuda à IA
    // Features premium do STUDIO
    genreAnalysis: true,    // ✅ Análise por gênero ilimitada
    suggestions: true,      // ✅ Sugestões de IA
    priorityProcessing: true, // ✅ Prioridade de processamento
    studioBadge: true,      // ✅ Badge exclusivo
  },
};

/**
 * Mensagens de erro por feature (para o frontend)
 * ATUALIZADO 2026-01-06: correctionPlan agora é DJ/STUDIO
 */
export const FEATURE_MESSAGES = {
  reference: 'O Modo Referência é exclusivo do plano PRO ou superior.',
  correctionPlan: 'O Plano de Correção é exclusivo do plano STUDIO.',
  pdf: 'O Relatório PDF é exclusivo do plano PRO ou superior.',
  askAI: 'Pedir Ajuda à IA é exclusivo do plano PRO ou superior.',
};

/**
 * Nomes de display das features
 */
export const FEATURE_DISPLAY_NAMES = {
  reference: 'Modo Referência',
  correctionPlan: 'Plano de Correção',
  pdf: 'Relatório PDF',
  askAI: 'Pedir Ajuda à IA',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES DE VERIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extrai o plano do usuário a partir do documento do Firestore
 * @param {Object} userDoc - Documento do usuário no Firestore
 * @returns {string} "free" | "plus" | "pro" | "studio" | "dj"
 */
export function getUserPlan(userDoc) {
  if (!userDoc) {
    console.log('[ENTITLEMENTS] userDoc is null/undefined, returning free');
    return 'free';
  }

  // Prioridade 1: Campo plan explícito (inclui 'studio' agora)
  if (userDoc.plan && ['free', 'plus', 'pro', 'studio', 'dj'].includes(userDoc.plan)) {
    return userDoc.plan;
  }

  // Prioridade 2: Derivar do subscription.priceId
  if (userDoc.subscription?.priceId) {
    const derivedPlan = getPlanFromPriceId(userDoc.subscription.priceId);
    if (derivedPlan) {
      console.log(`[ENTITLEMENTS] Plano derivado do priceId: ${derivedPlan}`);
      return derivedPlan;
    }
  }

  // Prioridade 3: Verificar status de assinatura ativa
  if (userDoc.subscription?.status === 'active') {
    // Se tem assinatura ativa mas não conseguimos determinar o plano,
    // assumir plus como fallback seguro
    console.log('[ENTITLEMENTS] Assinatura ativa sem plano definido, assumindo plus');
    return 'plus';
  }

  // Fallback: free
  console.log('[ENTITLEMENTS] Nenhum plano encontrado, retornando free');
  return 'free';
}

/**
 * Verifica se um plano tem permissão para uma feature
 * @param {string} plan - "free" | "plus" | "pro"
 * @param {string} feature - "reference" | "correctionPlan" | "pdf" | "askAI"
 * @returns {boolean}
 */
export function hasEntitlement(plan, feature) {
  const normalizedPlan = plan || 'free';
  const entitlements = PLAN_ENTITLEMENTS[normalizedPlan] || PLAN_ENTITLEMENTS.free;
  
  return entitlements[feature] === true;
}

/**
 * Verifica permissão e retorna resultado estruturado
 * @param {string} plan - "free" | "plus" | "pro" | "studio" | "dj"
 * @param {string} feature - "reference" | "correctionPlan" | "pdf" | "askAI"
 * @returns {{ allowed: boolean, plan: string, feature: string, message?: string }}
 */
export function checkEntitlement(plan, feature) {
  const normalizedPlan = plan || 'free';
  const allowed = hasEntitlement(normalizedPlan, feature);
  
  const result = {
    allowed,
    plan: normalizedPlan,
    feature,
  };

  if (!allowed) {
    result.message = FEATURE_MESSAGES[feature] || `Esta feature requer o plano PRO ou superior.`;
    // ✅ ATUALIZADO 2026-01-06: correctionPlan agora requer STUDIO
    result.requiredPlan = feature === 'correctionPlan' ? 'studio' : 'pro';
  }

  console.log(`[ENTITLEMENTS] checkEntitlement: plan=${normalizedPlan}, feature=${feature}, allowed=${allowed}`);
  
  return result;
}

/**
 * Lança erro se não tiver permissão (para uso em middleware)
 * @param {string} plan - "free" | "plus" | "pro"
 * @param {string} feature - "reference" | "correctionPlan" | "pdf" | "askAI"
 * @throws {EntitlementError} Se não tiver permissão
 */
export function assertEntitled(plan, feature) {
  const check = checkEntitlement(plan, feature);
  
  if (!check.allowed) {
    const error = new Error(check.message);
    error.name = 'EntitlementError';
    error.code = 'PLAN_REQUIRED';
    error.feature = feature;
    error.currentPlan = plan;
    error.requiredPlan = 'pro';
    throw error;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ RESPONSE HELPERS (para uso nos endpoints)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gera resposta HTTP 403 padronizada para feature bloqueada
 * @param {string} feature - "reference" | "correctionPlan" | "pdf" | "askAI"
 * @param {string} currentPlan - Plano atual do usuário
 * @param {string} scope - "chat" | "analysis" (opcional, para novo contrato)
 * @returns {Object} Payload JSON para resposta 403
 */
export function buildPlanRequiredResponse(feature, currentPlan = 'free', scope = 'analysis') {
  // ✅ Calcular data de reset (primeiro dia do próximo mês)
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  
  // ✅ Determinar plano requerido baseado na feature
  const requiredPlan = feature === 'correctionPlan' ? 'studio' : 'pro';
  
  return {
    // 🎯 NOVO CONTRATO: scope + code + feature + plan + meta
    code: 'FEATURE_LOCKED',
    scope: scope,
    feature: feature,
    plan: currentPlan,
    meta: {
      requiredPlan: requiredPlan,
      resetDate: resetDate
    },
    // ✅ LEGADO: Manter campos antigos para retrocompatibilidade
    error: 'PLAN_REQUIRED',
    requiredPlan: requiredPlan,
    currentPlan,
    message: FEATURE_MESSAGES[feature] || `Esta feature requer o plano ${requiredPlan.toUpperCase()}.`,
    featureDisplayName: FEATURE_DISPLAY_NAMES[feature] || feature,
  };
}

/**
 * Middleware Express para verificar entitlement
 * Uso: router.post('/api/endpoint', requireEntitlement('reference'), handler)
 * 
 * @param {string} feature - Feature a verificar
 * @returns {Function} Middleware Express
 */
export function requireEntitlement(feature) {
  return async (req, res, next) => {
    try {
      // O plano deve estar em req.userPlan (definido pelo middleware de auth)
      const plan = req.userPlan || req.user?.plan || 'free';
      
      console.log(`[ENTITLEMENTS-MW] Verificando ${feature} para plano ${plan}`);
      
      if (!hasEntitlement(plan, feature)) {
        console.log(`[ENTITLEMENTS-MW] ❌ BLOQUEADO: ${feature} requer PRO, usuário tem ${plan}`);
        return res.status(403).json(buildPlanRequiredResponse(feature, plan));
      }
      
      console.log(`[ENTITLEMENTS-MW] ✅ PERMITIDO: ${feature} para plano ${plan}`);
      next();
    } catch (error) {
      console.error('[ENTITLEMENTS-MW] Erro:', error);
      return res.status(500).json({
        error: 'ENTITLEMENT_CHECK_ERROR',
        message: 'Erro ao verificar permissões do plano'
      });
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_ENTITLEMENTS,
  FEATURE_MESSAGES,
  FEATURE_DISPLAY_NAMES,
  getUserPlan,
  hasEntitlement,
  checkEntitlement,
  assertEntitled,
  buildPlanRequiredResponse,
  requireEntitlement,
};
