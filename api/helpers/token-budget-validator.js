/**
 * 🧮 TOKEN BUDGET VALIDATOR
 * Valida e gerencia orçamento de tokens para evitar overflow
 * Implementa trimming inteligente de histórico quando necessário
 */

import { estimateTokens } from './analysis-prompt-filter.js';

/**
 * Limites de tokens por modelo
 */
const MODEL_LIMITS = {
  'gpt-3.5-turbo': {
    total: 4096,        // Total disponível
    safeInput: 3000,    // Máximo seguro para input (deixa espaço para output)
    minOutput: 500      // Mínimo reservado para resposta
  },
  'gpt-4': {
    total: 8192,
    safeInput: 6500,
    minOutput: 1000
  },
  'gpt-4o': {
    total: 128000,
    safeInput: 120000,
    minOutput: 2000
  }
};

/**
 * Calcula tokens estimados de um array de mensagens
 * @param {Array} messages - Array de mensagens no formato OpenAI
 * @returns {number} Tokens estimados
 */
export function calculateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;

  let totalTokens = 0;

  messages.forEach(msg => {
    // System/user/assistant role overhead
    totalTokens += 4; // Aproximação do overhead de role

    // Content
    if (typeof msg.content === 'string') {
      totalTokens += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      // Para mensagens com imagens
      msg.content.forEach(part => {
        if (part.type === 'text') {
          totalTokens += estimateTokens(part.text);
        } else if (part.type === 'image_url') {
          // Imagens custam ~85 tokens em detail: low, ~255 em detail: high
          totalTokens += part.image_url?.detail === 'high' ? 255 : 85;
        }
      });
    }
  });

  return totalTokens;
}

/**
 * Valida se o orçamento de tokens está OK
 * @param {Array} messages - Mensagens a enviar
 * @param {string} model - Modelo OpenAI
 * @param {number} maxTokensResponse - Tokens máximos para resposta
 * @returns {Object} { valid: boolean, usage: object, recommendation: string }
 */
export function validateTokenBudget(messages, model = 'gpt-3.5-turbo', maxTokensResponse = 1000) {
  const limits = MODEL_LIMITS[model] || MODEL_LIMITS['gpt-3.5-turbo'];
  const inputTokens = calculateMessagesTokens(messages);
  const totalEstimated = inputTokens + maxTokensResponse;

  const result = {
    valid: totalEstimated <= limits.total,
    usage: {
      inputTokens,
      maxOutputTokens: maxTokensResponse,
      totalEstimated,
      limit: limits.total,
      safeLimit: limits.safeInput,
      margin: limits.total - totalEstimated
    },
    recommendation: ''
  };

  // Gerar recomendação
  if (totalEstimated > limits.total) {
    result.recommendation = 'CRITICAL: Excede limite total. Reduzir histórico ou simplificar análise.';
  } else if (inputTokens > limits.safeInput) {
    result.recommendation = 'WARNING: Próximo ao limite seguro. Considerar trimming de histórico.';
  } else if (totalEstimated > limits.safeInput) {
    result.recommendation = 'INFO: Uso alto mas seguro. Monitorar próximas mensagens.';
  } else {
    result.recommendation = 'OK: Orçamento de tokens saudável.';
  }

  return result;
}

/**
 * Aplica trimming inteligente no histórico de mensagens
 * Remove mensagens antigas mas preserva contexto recente
 * @param {Array} messages - Array de mensagens
 * @param {number} targetTokens - Tokens alvo
 * @param {Object} options - Opções de trimming
 * @returns {Array} Mensagens trimmed
 */
export function trimConversationHistory(messages, targetTokens, options = {}) {
  const {
    preserveSystemPrompt = true,
    preserveLastUserMessage = true,
    minMessages = 2 // System + última do usuário
  } = options;

  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }

  // Clone para não modificar original
  let trimmed = [...messages];
  let currentTokens = calculateMessagesTokens(trimmed);

  // Se já está OK, retornar
  if (currentTokens <= targetTokens) {
    return trimmed;
  }

  // Separar mensagens
  const systemMessages = trimmed.filter(m => m.role === 'system');
  const conversationMessages = trimmed.filter(m => m.role !== 'system');

  // Garantir que há mensagens de conversa
  if (conversationMessages.length === 0) {
    return trimmed;
  }

  // Identificar última mensagem do usuário
  const lastUserIndex = conversationMessages.map(m => m.role).lastIndexOf('user');
  const lastUserMessage = conversationMessages[lastUserIndex];

  // Começar removendo mensagens mais antigas (exceto system e última do user)
  let availableForRemoval = conversationMessages.filter((msg, idx) => 
    !(preserveLastUserMessage && idx === lastUserIndex)
  );

  // Remover do início (mais antigas) até atingir target
  while (currentTokens > targetTokens && availableForRemoval.length > minMessages) {
    // Remover a mensagem mais antiga disponível
    const removed = availableForRemoval.shift();
    
    // Recriar array trimmed
    trimmed = [
      ...(preserveSystemPrompt ? systemMessages : []),
      ...availableForRemoval,
      ...(preserveLastUserMessage ? [lastUserMessage] : [])
    ];

    currentTokens = calculateMessagesTokens(trimmed);
  }

  // Log do resultado
  console.log(`📊 Token trimming: ${messages.length} → ${trimmed.length} mensagens | ${calculateMessagesTokens(messages)} → ${currentTokens} tokens`);

  return trimmed;
}

/**
 * Prepara mensagens com controle de orçamento automático
 * @param {Array} messages - Mensagens originais
 * @param {string} model - Modelo OpenAI
 * @param {number} maxTokensResponse - Tokens máximos para resposta
 * @returns {Object} { messages: Array, budget: Object, trimmed: boolean }
 */
export function prepareMessagesWithBudget(messages, model = 'gpt-3.5-turbo', maxTokensResponse = 1000) {
  // Validar orçamento inicial
  const initialBudget = validateTokenBudget(messages, model, maxTokensResponse);

  if (initialBudget.valid) {
    return {
      messages,
      budget: initialBudget,
      trimmed: false
    };
  }

  // Precisa fazer trimming
  console.warn('⚠️ Token budget exceeded, applying intelligent trimming...');

  const limits = MODEL_LIMITS[model] || MODEL_LIMITS['gpt-3.5-turbo'];
  const targetTokens = limits.safeInput - maxTokensResponse;

  const trimmedMessages = trimConversationHistory(messages, targetTokens, {
    preserveSystemPrompt: true,
    preserveLastUserMessage: true,
    minMessages: 2
  });

  const finalBudget = validateTokenBudget(trimmedMessages, model, maxTokensResponse);

  return {
    messages: trimmedMessages,
    budget: finalBudget,
    trimmed: true,
    removedCount: messages.length - trimmedMessages.length
  };
}

/**
 * Gera relatório de uso de tokens
 * @param {Object} budgetInfo - Informação de orçamento
 * @returns {string} Relatório formatado
 */
export function generateTokenReport(budgetInfo) {
  const { usage, recommendation } = budgetInfo;
  
  return `
📊 Token Usage Report:
  Input: ${usage.inputTokens} tokens
  Max Output: ${usage.maxOutputTokens} tokens
  Total Estimated: ${usage.totalEstimated} tokens
  Model Limit: ${usage.limit} tokens
  Safe Limit: ${usage.safeLimit} tokens
  Margin: ${usage.margin} tokens (${((usage.margin / usage.limit) * 100).toFixed(1)}%)
  
  ℹ️ ${recommendation}
  `.trim();
}
