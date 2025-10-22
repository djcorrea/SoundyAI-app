/**
 * 🧠 INTENT CLASSIFIER
 * Detecta a intenção do usuário baseado na mensagem
 * Permite ajustar system prompt e comportamento do chat
 */

/**
 * Intents disponíveis no sistema
 */
export const INTENTS = {
  MIX_ANALYZER_HELP: 'mix_analyzer_help',      // Ajuda com análise de mixagem
  TECHNICAL_QUESTION: 'technical_question',    // Pergunta técnica sobre áudio
  CASUAL_MUSIC_TALK: 'casual_music_talk',     // Conversa casual sobre música
  PLUGIN_RECOMMENDATION: 'plugin_recommendation', // Pedido de recomendação de plugin
  FOLLOW_UP_ANALYSIS: 'follow_up_analysis',    // Follow-up de análise anterior
  GENERAL: 'general'                           // Conversa geral
};

/**
 * Keywords para cada intent
 */
const INTENT_KEYWORDS = {
  [INTENTS.MIX_ANALYZER_HELP]: [
    'análise', 'analisei', 'mixagem', 'mixar', 'mix', 'master', 'mastering',
    'lufs', 'peak', 'true peak', 'dbtp', 'dynamic range', 'dr', 'lra',
    'crest factor', 'freq', 'hz', 'db', 'clipping', 'compressor',
    'eq', 'equalização', 'limiter', 'limitador', 'headroom',
    'ANÁLISE DE ÁUDIO', 'ANÁLISE TÉCNICA', 'dados técnicos',
    'problema', 'correção', 'ajustar', 'corrigir', 'melhorar',
    'espectro', 'espectral', 'bandas', 'grave', 'médio', 'agudo'
  ],
  
  [INTENTS.TECHNICAL_QUESTION]: [
    'como', 'o que é', 'qual', 'quando', 'onde', 'por que',
    'explica', 'explicar', 'ensina', 'como fazer', 'tutorial',
    'attack', 'release', 'threshold', 'ratio', 'knee',
    'side-chain', 'parallel', 'send', 'aux', 'bus'
  ],
  
  [INTENTS.PLUGIN_RECOMMENDATION]: [
    'plugin', 'vst', 'qual plugin', 'recomenda', 'sugestão de plugin',
    'melhor plugin', 'compressor para', 'eq para', 'reverb para',
    'delay', 'saturação', 'distortion', 'tape', 'vintage'
  ],
  
  [INTENTS.FOLLOW_UP_ANALYSIS]: [
    'e se', 'mas', 'porém', 'isso significa', 'então',
    'entendi', 'ok mas', 'e sobre', 'e quanto', 'como aplicar'
  ]
};

/**
 * Estrutura de dados JSON que indica análise de áudio
 */
const ANALYSIS_JSON_MARKERS = [
  'JSON_DATA',
  'metrics',
  'suggestions',
  'problems',
  'spectralBands',
  'technicalData'
];

/**
 * Classifica a intenção de uma mensagem
 * @param {string} message - Mensagem do usuário
 * @param {Array} conversationHistory - Histórico de mensagens (opcional)
 * @returns {Object} { intent: string, confidence: number, reasoning: string }
 */
export function classifyIntent(message, conversationHistory = []) {
  if (!message || typeof message !== 'string') {
    return {
      intent: INTENTS.GENERAL,
      confidence: 0,
      reasoning: 'Mensagem inválida'
    };
  }

  const messageLower = message.toLowerCase();
  const scores = {};

  // 🎯 REGRA 1: Detectar JSON de análise técnica
  if (ANALYSIS_JSON_MARKERS.some(marker => message.includes(marker))) {
    return {
      intent: INTENTS.MIX_ANALYZER_HELP,
      confidence: 1.0,
      reasoning: 'JSON de análise detectado'
    };
  }

  // 🎯 REGRA 2: Detectar cabeçalho de análise
  if (messageLower.includes('análise de áudio') || 
      messageLower.includes('análise técnica') ||
      messageLower.includes('analisei meu áudio')) {
    return {
      intent: INTENTS.MIX_ANALYZER_HELP,
      confidence: 0.95,
      reasoning: 'Cabeçalho de análise detectado'
    };
  }

  // 🎯 REGRA 3: Calcular score por keywords
  Object.entries(INTENT_KEYWORDS).forEach(([intent, keywords]) => {
    const matchCount = keywords.filter(keyword => 
      messageLower.includes(keyword.toLowerCase())
    ).length;
    
    scores[intent] = matchCount;
  });

  // 🎯 REGRA 4: Verificar follow-up de análise anterior
  const lastAssistantMessage = conversationHistory
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0];
  
  if (lastAssistantMessage && 
      (lastAssistantMessage.content.includes('LUFS') || 
       lastAssistantMessage.content.includes('mixagem') ||
       lastAssistantMessage.content.includes('EQ'))) {
    
    // Se última resposta foi sobre mixagem E mensagem atual é follow-up
    if (scores[INTENTS.FOLLOW_UP_ANALYSIS] > 0) {
      return {
        intent: INTENTS.FOLLOW_UP_ANALYSIS,
        confidence: 0.85,
        reasoning: 'Follow-up de análise anterior detectado'
      };
    }
  }

  // 🎯 REGRA 5: Determinar intent com maior score
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) {
    return {
      intent: INTENTS.CASUAL_MUSIC_TALK,
      confidence: 0.3,
      reasoning: 'Nenhum keyword específico detectado, assumindo conversa casual'
    };
  }

  const topIntent = Object.entries(scores)
    .find(([, score]) => score === maxScore)?.[0];

  const confidence = Math.min(0.9, maxScore / 10); // Normalizar

  return {
    intent: topIntent,
    confidence,
    reasoning: `${maxScore} keyword(s) correspondente(s)`
  };
}

/**
 * Verifica se a mensagem é sobre análise de mixagem
 * Helper rápido para decisão binária
 * @param {string} message - Mensagem do usuário
 * @returns {boolean} True se for análise de mixagem
 */
export function isMixAnalysisMessage(message) {
  const classification = classifyIntent(message);
  return classification.intent === INTENTS.MIX_ANALYZER_HELP && 
         classification.confidence > 0.7;
}

/**
 * Retorna informações sobre um intent
 * @param {string} intent - Intent classificado
 * @returns {Object} Metadados do intent
 */
export function getIntentMetadata(intent) {
  const metadata = {
    [INTENTS.MIX_ANALYZER_HELP]: {
      name: 'Ajuda com Análise de Mixagem',
      systemPromptKey: 'mixAnalyzerHelp',
      maxTokens: 1200,
      temperature: 0.3,
      requiresContext: true
    },
    [INTENTS.TECHNICAL_QUESTION]: {
      name: 'Pergunta Técnica',
      systemPromptKey: 'default',
      maxTokens: 800,
      temperature: 0.4,
      requiresContext: false
    },
    [INTENTS.PLUGIN_RECOMMENDATION]: {
      name: 'Recomendação de Plugin',
      systemPromptKey: 'default',
      maxTokens: 600,
      temperature: 0.5,
      requiresContext: false
    },
    [INTENTS.FOLLOW_UP_ANALYSIS]: {
      name: 'Follow-up de Análise',
      systemPromptKey: 'mixAnalyzerHelp',
      maxTokens: 1000,
      temperature: 0.3,
      requiresContext: true
    },
    [INTENTS.CASUAL_MUSIC_TALK]: {
      name: 'Conversa Casual sobre Música',
      systemPromptKey: 'default',
      maxTokens: 600,
      temperature: 0.7,
      requiresContext: false
    },
    [INTENTS.GENERAL]: {
      name: 'Geral',
      systemPromptKey: 'default',
      maxTokens: 500,
      temperature: 0.7,
      requiresContext: false
    }
  };

  return metadata[intent] || metadata[INTENTS.GENERAL];
}
