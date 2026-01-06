/**
 * 🎯 CONFIGURAÇÃO CENTRALIZADA DE PLANOS - SOUNDYAI
 * 
 * Arquivo central que define TODOS os limites e features por plano.
 * Substitui limites hardcoded espalhados pelo código.
 * 
 * ⚠️ REGRAS IMPORTANTES:
 * 1. Valores -1 = ilimitado (mas PRO tem limite invisível de segurança)
 * 2. Período: 'day' (diário) ou 'month' (mensal)
 * 3. Features: boolean (true = liberado, false = bloqueado)
 * 4. NÃO adicionar lógica condicional aqui - apenas objetos estáticos
 * 
 * @version 1.0.0
 * @created 2025-12-10
 * @author Sistema SoundyAI
 */

// ═══════════════════════════════════════════════════════════
// 📊 DEFINIÇÃO COMPLETA DOS PLANOS
// ═══════════════════════════════════════════════════════════

export const PLAN_LIMITS = {
  /**
   * 🆓 PLANO FREE (R$ 0/mês)
   * - 1 análise/mês (após limite: só score + LUFS, TP, DR)
   * - 20 mensagens/mês no chat
   * - 5 análises de imagem/mês
   * - Sem funcionalidades avançadas
   * 
   * 🔓 NOTA: Modo anônimo (sem login) permite 2 análises + 5 mensagens
   */
  free: {
    id: 'free',
    name: 'FREE',
    displayName: 'Gratuito',
    price: 0,
    currency: 'BRL',
    
    // 🔢 LIMITES DE USO
    limits: {
      // Análises de áudio completas
      audioAnalyses: {
        limit: 1,                     // ✅ ATUALIZADO: 3 → 1 (modo anônimo: 2)
        period: 'month',
        description: 'Análises completas de áudio por mês',
        afterLimit: 'score-only', // Após limite: apenas score básico
        metricsAfterLimit: ['lufs', 'truePeak', 'dynamicRange'] // Métricas permitidas após limite
      },
      
      // Mensagens de chat
      messages: {
        limit: 20,
        period: 'month', // ⚠️ MUDANÇA: era 'day', agora é mensal
        description: 'Mensagens no chat por mês'
      },
      
      // Análises de imagem (screenshots, espectrogramas)
      imageAnalyses: {
        limit: 5,
        period: 'month',
        description: 'Análises de imagem por mês'
      },
      
      // Uploads de referência
      referenceUploads: {
        limit: 0,
        period: 'month',
        description: 'Uploads de músicas de referência'
      },
      
      // Geração de PDF
      pdfReports: {
        limit: 0,
        period: 'month',
        description: 'Relatórios PDF gerados'
      },
      
      // Comparações AB
      abComparisons: {
        limit: 0,
        period: 'month',
        description: 'Comparações A/B entre músicas'
      }
    },
    
    // ⚡ FUNCIONALIDADES DISPONÍVEIS
    features: {
      // Análise básica
      basicAnalysis: true,           // Score + métricas principais
      spectralAnalysis: false,       // ❌ Análise espectral completa
      spectralAdvanced: false,       // ❌ Análise espectral ultra detalhada
      
      // Sugestões e IA
      suggestions: false,            // ❌ Sugestões de correção
      suggestionsBasic: false,       // ❌ Sugestões básicas
      suggestionsAdvanced: false,    // ❌ Sugestões avançadas
      aiContext: false,              // ❌ "Pedir ajuda à IA" com contexto
      aiEnrichment: false,           // ❌ Enriquecimento IA das sugestões
      
      // Funcionalidades avançadas
      referenceMode: false,          // ❌ Análise por música de referência
      referenceUpload: false,        // ❌ Upload de referência própria
      pdfGeneration: false,          // ❌ Geração de PDF
      abComparison: false,           // ❌ Comparação AB
      
      // Privilégios especiais
      priorityQueue: false,          // ❌ Fila normal
      vipQueue: false,               // ❌ Fila VIP
      badges: false,                 // ❌ Sistema de badges
      earlyAccess: false,            // ❌ Early access
      
      // Modelos de IA
      gpt4Access: false,             // ❌ GPT-4
      gpt4Vision: false,             // ❌ GPT-4 Vision
      gpt4oMini: true                // ✅ GPT-4o mini
    }
  },

  /**
   * ➕ PLANO PLUS (R$ 47/mês)
   * - 20 análises/mês (completas com sugestões)
   * - 80 mensagens/mês
   * - 20 análises de imagem/mês
   * - Sugestões completas
   * - Análise espectral completa
   * 
   * ✅ ATUALIZAÇÃO 2026-01-06: Limite ajustado de 25 → 20 análises
   */
  plus: {
    id: 'plus',
    name: 'PLUS',
    displayName: 'Plus',
    price: 47,
    currency: 'BRL',
    
    // 🔢 LIMITES DE USO
    limits: {
      audioAnalyses: {
        limit: 20,                   // ✅ ATUALIZADO 2026-01-06: 25 → 20
        period: 'month',
        description: 'Análises completas de áudio por mês',
        afterLimit: 'score-only',
        metricsAfterLimit: ['lufs', 'truePeak', 'dynamicRange']
      },
      
      messages: {
        limit: 80,
        period: 'month',
        description: 'Mensagens no chat por mês'
      },
      
      imageAnalyses: {
        limit: 20,
        period: 'month',
        description: 'Análises de imagem por mês'
      },
      
      referenceUploads: {
        limit: 0,
        period: 'month',
        description: 'Uploads de músicas de referência'
      },
      
      pdfReports: {
        limit: 0,
        period: 'month',
        description: 'Relatórios PDF gerados'
      },
      
      abComparisons: {
        limit: 0,
        period: 'month',
        description: 'Comparações A/B entre músicas'
      }
    },
    
    // ⚡ FUNCIONALIDADES DISPONÍVEIS
    features: {
      // Análise completa
      basicAnalysis: true,
      spectralAnalysis: true,        // ✅ Análise espectral completa
      spectralAdvanced: false,       // ❌ Ultra detalhada (PRO)
      
      // Sugestões
      suggestions: true,             // ✅ Sugestões de correção
      suggestionsBasic: true,        // ✅ Sugestões básicas
      suggestionsAdvanced: false,    // ❌ Sugestões avançadas (PRO)
      aiContext: false,              // ❌ IA contexto completo (PRO)
      aiEnrichment: true,            // ✅ Enriquecimento IA básico
      
      // Funcionalidades avançadas
      referenceMode: true,           // ✅ Análise por gênero de referência
      referenceUpload: false,        // ❌ Upload próprio (PRO)
      pdfGeneration: false,          // ❌ PDF (PRO)
      abComparison: false,           // ❌ AB (PRO)
      
      // Privilégios
      priorityQueue: false,
      vipQueue: false,
      badges: false,
      earlyAccess: false,
      
      // IA
      gpt4Access: false,
      gpt4Vision: true,              // ✅ Análise de imagem com GPT-4 Vision
      gpt4oMini: true
    }
  },

  /**
   * 🚀 PLANO PRO (R$ 79,99/mês)
   * - 60 análises/mês (antes ilimitado)
   * - Chat ilimitado (hard cap: 300 mensagens/mês)
   * - TODAS funcionalidades liberadas
   * - Fila VIP, badges, early access
   * 
   * ✅ ATUALIZAÇÃO 2026-01-06: Limite ajustado de ilimitado → 60 análises
   */
  pro: {
    id: 'pro',
    name: 'PRO',
    displayName: 'Pro',
    price: 79.99,
    currency: 'BRL',
    
    // 🔢 LIMITES DE USO
    limits: {
      audioAnalyses: {
        limit: 60,                   // ✅ ATUALIZADO 2026-01-06: -1 → 60
        period: 'month',
        description: '60 análises de áudio por mês',
        afterLimit: 'reduced'        // ✅ ATUALIZADO: Modo reduced após limite
      },
      
      messages: {
        limit: -1,
        invisibleLimit: 300,         // ✅ ATUALIZADO: Hard cap de 300
        period: 'month',
        description: 'Mensagens ilimitadas no chat'
      },
      
      imageAnalyses: {
        limit: -1,
        invisibleLimit: 100,
        period: 'month',
        description: 'Análises ilimitadas de imagem'
      },
      
      referenceUploads: {
        limit: -1,
        invisibleLimit: 50,
        period: 'month',
        description: 'Uploads ilimitados de referência'
      },
      
      pdfReports: {
        limit: -1,
        invisibleLimit: 50,
        period: 'month',
        description: 'Relatórios PDF ilimitados'
      },
      
      abComparisons: {
        limit: -1,
        invisibleLimit: 30,
        period: 'month',
        description: 'Comparações A/B ilimitadas'
      }
    },
    
    // ⚡ FUNCIONALIDADES DISPONÍVEIS (TODAS)
    features: {
      // Análise ultra completa
      basicAnalysis: true,
      spectralAnalysis: true,
      spectralAdvanced: true,        // ✅ Análise espectral ULTRA detalhada
      
      // IA completa
      suggestions: true,
      suggestionsBasic: true,
      suggestionsAdvanced: true,     // ✅ Sugestões ultra detalhadas
      aiContext: true,               // ✅ "Pedir ajuda à IA" com contexto completo
      aiEnrichment: true,
      
      // Todas funcionalidades
      referenceMode: true,
      referenceUpload: true,         // ✅ Upload de referência própria
      pdfGeneration: true,           // ✅ Geração de PDF
      abComparison: true,            // ✅ Comparação AB
      
      // Privilégios VIP
      priorityQueue: true,           // ✅ Fila prioritária
      vipQueue: true,                // ✅ Fila VIP (processamento mais rápido)
      badges: true,                  // ✅ Sistema de badges
      earlyAccess: true,             // ✅ Early access a features
      
      // Melhor IA
      gpt4Access: true,              // ✅ GPT-4o completo
      gpt4Vision: true,
      gpt4oMini: true
    }
  },

  /**
   * � PLANO STUDIO (R$ 99,90/mês) - NOVO 2026-01-06
   * Plano premium para produtores profissionais e estúdios
   * - Análises "ilimitadas" (hard cap técnico: 400/mês)
   * - Chat "ilimitado" (hard cap técnico: 400 mensagens/mês)
   * - TODAS funcionalidades do PRO
   * - Prioridade de processamento no servidor
   * - Badge STUDIO exclusivo
   */
  studio: {
    id: 'studio',
    name: 'STUDIO',
    displayName: 'Studio',
    price: 99.90,
    currency: 'BRL',
    
    // 🔢 LIMITES DE USO (ilimitado visualmente, hard cap técnico)
    limits: {
      audioAnalyses: {
        limit: -1,                   // Ilimitado visualmente
        invisibleLimit: 400,         // ✅ HARD CAP: 400 análises/mês
        period: 'month',
        description: 'Análises ilimitadas de áudio (uso justo)',
        afterLimit: 'blocked'        // Bloqueia após hard cap
      },
      
      messages: {
        limit: -1,                   // Ilimitado visualmente
        invisibleLimit: 400,         // ✅ HARD CAP: 400 mensagens/mês
        period: 'month',
        description: 'Chat ilimitado (uso justo)'
      },
      
      imageAnalyses: {
        limit: -1,
        invisibleLimit: 150,         // Mais imagens que PRO
        period: 'month',
        description: 'Análises ilimitadas de imagem'
      },
      
      referenceUploads: {
        limit: -1,
        invisibleLimit: 100,         // Mais referências que PRO
        period: 'month',
        description: 'Uploads ilimitados de referência'
      },
      
      pdfReports: {
        limit: -1,
        invisibleLimit: 100,         // Mais PDFs que PRO
        period: 'month',
        description: 'Relatórios PDF ilimitados'
      },
      
      abComparisons: {
        limit: -1,
        invisibleLimit: 50,          // Mais comparações que PRO
        period: 'month',
        description: 'Comparações A/B ilimitadas'
      }
    },
    
    // ⚡ FUNCIONALIDADES DISPONÍVEIS (TODAS + EXTRAS)
    features: {
      // Análise ultra completa
      basicAnalysis: true,
      spectralAnalysis: true,
      spectralAdvanced: true,        // ✅ Análise espectral ULTRA detalhada
      
      // IA completa
      suggestions: true,
      suggestionsBasic: true,
      suggestionsAdvanced: true,     // ✅ Sugestões ultra detalhadas
      aiContext: true,               // ✅ "Pedir ajuda à IA" com contexto completo
      aiEnrichment: true,
      
      // Todas funcionalidades
      referenceMode: true,
      referenceUpload: true,         // ✅ Upload de referência própria
      pdfGeneration: true,           // ✅ Geração de PDF
      abComparison: true,            // ✅ Comparação AB
      
      // Privilégios STUDIO (superiores ao PRO)
      priorityQueue: true,           // ✅ Fila prioritária
      vipQueue: true,                // ✅ Fila VIP (processamento mais rápido)
      studioPriority: true,          // ✅ NOVO: Prioridade máxima de processamento
      badges: true,                  // ✅ Sistema de badges
      studioBadge: true,             // ✅ NOVO: Badge STUDIO exclusivo
      earlyAccess: true,             // ✅ Early access a features
      
      // Melhor IA
      gpt4Access: true,              // ✅ GPT-4o completo
      gpt4Vision: true,
      gpt4oMini: true
    }
  },

  /**
   * �🏢 PLANO ENTERPRISE (FUTURO)
   * Preparado para expansão futura
   * - Limites customizáveis
   * - API dedicada
   * - Suporte prioritário
   */
  enterprise: {
    id: 'enterprise',
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    price: null, // Sob consulta
    currency: 'BRL',
    enabled: false, // ⚠️ Inativo por enquanto
    
    limits: {
      audioAnalyses: {
        limit: -1,
        invisibleLimit: null, // Sem limite
        period: 'month',
        description: 'Análises customizáveis'
      },
      messages: {
        limit: -1,
        invisibleLimit: null,
        period: 'month',
        description: 'Chat customizável'
      },
      imageAnalyses: {
        limit: -1,
        invisibleLimit: null,
        period: 'month',
        description: 'Imagens customizáveis'
      },
      referenceUploads: {
        limit: -1,
        invisibleLimit: null,
        period: 'month',
        description: 'Referências customizáveis'
      },
      pdfReports: {
        limit: -1,
        invisibleLimit: null,
        period: 'month',
        description: 'PDFs customizáveis'
      },
      abComparisons: {
        limit: -1,
        invisibleLimit: null,
        period: 'month',
        description: 'Comparações customizáveis'
      }
    },
    
    features: {
      // Tudo do PRO + extras
      basicAnalysis: true,
      spectralAnalysis: true,
      spectralAdvanced: true,
      suggestions: true,
      suggestionsBasic: true,
      suggestionsAdvanced: true,
      aiContext: true,
      aiEnrichment: true,
      referenceMode: true,
      referenceUpload: true,
      pdfGeneration: true,
      abComparison: true,
      priorityQueue: true,
      vipQueue: true,
      badges: true,
      earlyAccess: true,
      gpt4Access: true,
      gpt4Vision: true,
      gpt4oMini: true,
      
      // Extras Enterprise
      apiAccess: true,               // API dedicada
      customIntegration: true,       // Integrações custom
      dedicatedSupport: true,        // Suporte dedicado
      sla: true,                     // SLA garantido
      multiUser: true,               // Múltiplos usuários
      teamManagement: true,          // Gestão de equipe
      advancedAnalytics: true        // Analytics avançado
    }
  }
};

// ═══════════════════════════════════════════════════════════
// 🎁 COMBOS E OFERTAS ESPECIAIS
// ═══════════════════════════════════════════════════════════

/**
 * Combo Hotmart: 4 meses de acesso Plus
 * Ativado via webhook após compra
 */
export const HOTMART_COMBO = {
  id: 'hotmart-plus-4m',
  name: 'Combo Hotmart Plus 4 Meses',
  basePlan: 'plus', // Usa limites do Plus
  duration: 120, // 4 meses em dias
  price: 157, // R$ 157 (4 x R$ 47 = R$ 188, desconto de R$ 31)
  features: {
    // Mesmas features do Plus
    ...PLAN_LIMITS.plus.features,
    // Bonus: Badge especial
    hotmartBadge: true
  }
};

// ═══════════════════════════════════════════════════════════
// 🛠️ FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════

/**
 * Obtém configuração completa de um plano
 * @param {string} planId - ID do plano ('free', 'plus', 'pro', 'studio', 'enterprise')
 * @returns {object} Configuração do plano ou free como fallback
 */
export function getPlanConfig(planId) {
  // Normalizar ID do plano
  const normalizedId = String(planId).toLowerCase().trim();
  
  // Mapeamento para compatibilidade com nomes antigos
  // ✅ ATUALIZADO 2026-01-06: Inclui 'studio'
  const planMapping = {
    'gratis': 'free',
    'gratuito': 'free',
    'free': 'free',
    'plus': 'plus',
    'pro': 'pro',
    'studio': 'studio',         // ✅ NOVO
    'enterprise': 'enterprise'
  };
  
  const mappedId = planMapping[normalizedId] || 'free';
  
  // Retornar configuração ou fallback para free
  return PLAN_LIMITS[mappedId] || PLAN_LIMITS.free;
}

/**
 * Obtém limites específicos de um plano
 * @param {string} planId - ID do plano
 * @returns {object} Objeto com todos os limites
 */
export function getLimitsFor(planId) {
  const config = getPlanConfig(planId);
  return config.limits;
}

/**
 * Obtém limite de um recurso específico
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso ('audioAnalyses', 'messages', etc)
 * @returns {number} Limite do recurso (-1 = ilimitado)
 */
export function getResourceLimit(planId, resource) {
  const limits = getLimitsFor(planId);
  return limits[resource]?.limit ?? 0;
}

/**
 * Obtém limite invisível (de segurança) para plano PRO
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso
 * @returns {number|null} Limite invisível ou null
 */
export function getInvisibleLimit(planId, resource) {
  const limits = getLimitsFor(planId);
  return limits[resource]?.invisibleLimit ?? null;
}

/**
 * Verifica se recurso é ilimitado
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso
 * @returns {boolean} true se ilimitado
 */
export function isUnlimited(planId, resource) {
  const limit = getResourceLimit(planId, resource);
  return limit === -1;
}

/**
 * Verifica se usuário ainda tem cota disponível
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso
 * @param {number} used - Quantidade já usada
 * @returns {object} { hasQuota: boolean, remaining: number|string }
 */
export function checkQuota(planId, resource, used = 0) {
  const config = getPlanConfig(planId);
  const resourceConfig = config.limits[resource];
  
  if (!resourceConfig) {
    return { hasQuota: false, remaining: 0, reason: 'RESOURCE_NOT_FOUND' };
  }
  
  const limit = resourceConfig.limit;
  
  // Se ilimitado, verificar limite invisível (PRO)
  if (limit === -1) {
    const invisibleLimit = resourceConfig.invisibleLimit;
    
    if (invisibleLimit && used >= invisibleLimit) {
      // Atingiu limite invisível (abuse prevention)
      return {
        hasQuota: false,
        remaining: 0,
        reason: 'INVISIBLE_LIMIT_REACHED',
        message: 'Limite de segurança atingido. Entre em contato com suporte.'
      };
    }
    
    return {
      hasQuota: true,
      remaining: 'unlimited',
      used,
      invisibleLimit
    };
  }
  
  // Limite finito
  const remaining = Math.max(0, limit - used);
  
  return {
    hasQuota: remaining > 0,
    remaining,
    limit,
    used,
    percentage: limit > 0 ? Math.round((used / limit) * 100) : 0
  };
}

/**
 * Verifica se feature está disponível no plano
 * @param {string} planId - ID do plano
 * @param {string} feature - Nome da feature
 * @returns {boolean} true se disponível
 */
export function isFeatureAllowed(planId, feature) {
  const config = getPlanConfig(planId);
  return config.features[feature] === true;
}

/**
 * Obtém todas features disponíveis de um plano
 * @param {string} planId - ID do plano
 * @returns {object} Objeto com todas features
 */
export function getFeaturesFor(planId) {
  const config = getPlanConfig(planId);
  return config.features;
}

/**
 * Retorna nome de exibição do plano
 * @param {string} planId - ID do plano
 * @returns {string} Nome formatado do plano
 */
export function getPlanDisplayName(planId) {
  const config = getPlanConfig(planId);
  return config.displayName || config.name;
}

/**
 * Retorna preço do plano
 * @param {string} planId - ID do plano
 * @returns {number} Preço em reais
 */
export function getPlanPrice(planId) {
  const config = getPlanConfig(planId);
  return config.price;
}

/**
 * Verifica se plano está ativo
 * @param {string} planId - ID do plano
 * @returns {boolean} true se ativo
 */
export function isPlanActive(planId) {
  const config = getPlanConfig(planId);
  return config.enabled !== false;
}

/**
 * Obtém plano recomendado para upgrade baseado em feature
 * @param {string} currentPlan - Plano atual
 * @param {string} feature - Feature desejada
 * @returns {string|null} ID do plano recomendado ou null
 */
export function getRecommendedUpgrade(currentPlan, feature) {
  // Se já tem a feature, não precisa upgrade
  if (isFeatureAllowed(currentPlan, feature)) {
    return null;
  }
  
  // Verificar qual plano tem a feature
  const planOrder = ['free', 'plus', 'pro', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  
  for (let i = currentIndex + 1; i < planOrder.length; i++) {
    const planId = planOrder[i];
    if (isPlanActive(planId) && isFeatureAllowed(planId, feature)) {
      return planId;
    }
  }
  
  return null;
}

/**
 * Obtém período de reset de um recurso
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso
 * @returns {string} 'day' ou 'month'
 */
export function getResetPeriod(planId, resource) {
  const limits = getLimitsFor(planId);
  return limits[resource]?.period || 'month';
}

/**
 * Calcula data do próximo reset
 * @param {string} period - 'day' ou 'month'
 * @returns {Date} Data do próximo reset
 */
export function getNextResetDate(period) {
  const now = new Date();
  
  if (period === 'day') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
  
  if (period === 'month') {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
  
  return now;
}

/**
 * Formata mensagem de limite excedido
 * @param {string} planId - ID do plano
 * @param {string} resource - Recurso
 * @param {number} used - Quantidade usada
 * @returns {object} { title, message, action, upgrade }
 */
export function formatLimitExceededMessage(planId, resource, used) {
  const config = getPlanConfig(planId);
  const resourceConfig = config.limits[resource];
  const limit = resourceConfig?.limit || 0;
  const nextReset = getNextResetDate(resourceConfig?.period || 'month');
  
  const resourceNames = {
    audioAnalyses: 'análises de áudio',
    messages: 'mensagens',
    imageAnalyses: 'análises de imagem',
    referenceUploads: 'uploads de referência',
    pdfReports: 'relatórios PDF',
    abComparisons: 'comparações A/B'
  };
  
  const resourceName = resourceNames[resource] || resource;
  const upgradeMessage = planId === 'free' ? 'Faça upgrade para o plano Plus!' : 'Faça upgrade para o plano Pro!';
  const upgrade = planId === 'free' ? 'plus' : 'pro';
  
  return {
    title: `Limite de ${resourceName} atingido`,
    message: `Você usou ${used} de ${limit} ${resourceName} disponíveis este mês.`,
    action: upgradeMessage,
    nextReset: nextReset.toLocaleDateString('pt-BR'),
    upgrade
  };
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS DEFAULT
// ═══════════════════════════════════════════════════════════

export default {
  PLAN_LIMITS,
  HOTMART_COMBO,
  getPlanConfig,
  getLimitsFor,
  getResourceLimit,
  getInvisibleLimit,
  isUnlimited,
  checkQuota,
  isFeatureAllowed,
  getFeaturesFor,
  getPlanDisplayName,
  getPlanPrice,
  isPlanActive,
  getRecommendedUpgrade,
  getResetPeriod,
  getNextResetDate,
  formatLimitExceededMessage
};
