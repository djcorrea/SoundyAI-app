/**
 * 🔓 CHAT ANÔNIMO - Endpoint para usuários sem autenticação Firebase
 * 
 * Permite que visitantes não logados enviem mensagens de chat
 * COM LIMITES: 5 mensagens por dia
 * 
 * Identificação por:
 * - fingerprint (FingerprintJS do frontend)
 * - IP como fallback/combinação
 * 
 * @version 1.0.0
 * @date 2026-01-02
 */

import cors from 'cors';
import {
  canAnonymousChat,
  registerAnonymousChat
} from '../../lib/anonymousLimiter.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE LIMITES (espelhando chat.js autenticado)
// ═══════════════════════════════════════════════════════════════════

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_SIZE = 5;

// ═══════════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════

const corsMiddleware = cors({
  origin: function(origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman)
    if (!origin) {
      callback(null, true);
      return;
    }

    const ALLOWED_ORIGINS = [
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000'
    ];

    // Verificar se é localhost ou origem permitida
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));

    if (isLocalhost || isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[ANON_CHAT] CORS bloqueado: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE ENTRADA
// ═══════════════════════════════════════════════════════════════════

function validateAnonymousInput(body) {
  const { message, visitorId, conversationHistory } = body;

  // Mensagem obrigatória
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('MESSAGE_INVALID');
  }

  // visitorId obrigatório (fingerprint)
  if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
    throw new Error('VISITOR_ID_INVALID');
  }

  // Processar histórico de conversa
  let validHistory = [];
  if (conversationHistory) {
    let historyData = conversationHistory;
    
    if (typeof conversationHistory === 'string') {
      try {
        historyData = JSON.parse(conversationHistory);
      } catch {
        historyData = [];
      }
    }
    
    if (Array.isArray(historyData)) {
      validHistory = historyData
        .filter(msg => 
          msg && 
          typeof msg === 'object' && 
          msg.role && 
          msg.content &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0 &&
          ['user', 'assistant'].includes(msg.role)
        )
        .slice(-MAX_HISTORY_SIZE);
    }
  }

  return {
    message: message.trim().substring(0, MAX_MESSAGE_LENGTH),
    visitorId: visitorId.trim(),
    conversationHistory: validHistory
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`🔓 [ANON_CHAT:${requestId}] Nova requisição anônima:`, {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body,
    contentType: req.headers['content-type'],
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
  });

  // Prevenir múltiplas respostas
  let responseSent = false;
  const sendResponse = (status, data) => {
    if (responseSent) {
      console.warn(`⚠️ [ANON_CHAT:${requestId}] Resposta duplicada ignorada`);
      return;
    }
    responseSent = true;
    return res.status(status).json(data);
  };

  // CORS
  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error(`❌ [ANON_CHAT:${requestId}] CORS error:`, err);
    return sendResponse(403, { error: 'CORS_ERROR', message: 'Origem não permitida' });
  }

  // OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return sendResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Apenas POST permitido' });
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 1: VALIDAR ENTRADA
    // ═══════════════════════════════════════════════════════════════
    
    const body = req.body || {};
    
    let validatedData;
    try {
      validatedData = validateAnonymousInput(body);
    } catch (error) {
      console.error(`❌ [ANON_CHAT:${requestId}] Validação falhou:`, error.message);
      
      if (error.message === 'MESSAGE_INVALID') {
        return sendResponse(422, { error: 'MESSAGE_INVALID', message: 'Mensagem inválida ou vazia' });
      }
      if (error.message === 'VISITOR_ID_INVALID') {
        return sendResponse(400, { error: 'VISITOR_ID_REQUIRED', message: 'Identificador de visitante inválido' });
      }
      throw error;
    }

    const { message, visitorId, conversationHistory } = validatedData;

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 2: VERIFICAR LIMITES ANÔNIMOS
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📊 [ANON_CHAT:${requestId}] Verificando limites para visitor: ${visitorId.substring(0, 8)}...`);
    
    const limitCheck = await canAnonymousChat(visitorId, req);
    
    if (!limitCheck.allowed) {
      console.log(`⛔ [ANON_CHAT:${requestId}] Limite atingido:`, {
        used: limitCheck.used,
        limit: limitCheck.limit,
        errorCode: limitCheck.errorCode
      });
      
      return sendResponse(403, {
        error: limitCheck.errorCode || 'ANONYMOUS_LIMIT_REACHED',
        message: limitCheck.message,
        remaining: limitCheck.remaining,
        limit: limitCheck.limit,
        requiresLogin: true
      });
    }

    console.log(`✅ [ANON_CHAT:${requestId}] Limite OK: ${limitCheck.remaining} restantes`);

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 3: CHAMAR OPENAI
    // ═══════════════════════════════════════════════════════════════
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error(`❌ [ANON_CHAT:${requestId}] OPENAI_API_KEY não configurada`);
      return sendResponse(500, { error: 'CONFIG_ERROR', message: 'Serviço temporariamente indisponível' });
    }

    // Construir mensagens para OpenAI
    const systemPrompt = getAnonymousSystemPrompt();
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    console.log(`🤖 [ANON_CHAT:${requestId}] Chamando OpenAI com ${messages.length} mensagens`);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modelo econômico para anônimos
        messages,
        temperature: 0.7,
        max_tokens: 800, // Limite mais baixo para anônimos
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error(`❌ [ANON_CHAT:${requestId}] OpenAI erro:`, {
        status: openaiResponse.status,
        error: errorData
      });
      
      return sendResponse(502, {
        error: 'AI_SERVICE_ERROR',
        message: 'Erro ao processar sua mensagem. Tente novamente.'
      });
    }

    const aiData = await openaiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 4: REGISTRAR USO (APÓS SUCESSO)
    // ═══════════════════════════════════════════════════════════════
    
    const registerResult = await registerAnonymousChat(visitorId, req);
    
    console.log(`✅ [ANON_CHAT:${requestId}] Mensagem processada e registrada:`, {
      used: registerResult.used,
      remaining: registerResult.remaining
    });

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 5: RESPOSTA
    // ═══════════════════════════════════════════════════════════════
    
    return sendResponse(200, {
      success: true,
      reply,
      anonymous: true,
      limits: {
        used: registerResult.used || (limitCheck.used + 1),
        remaining: registerResult.remaining ?? (limitCheck.remaining - 1),
        limit: limitCheck.limit
      },
      model: 'gpt-4o-mini',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error(`❌ [ANON_CHAT:${requestId}] Erro fatal:`, error);
    
    return sendResponse(500, {
      error: 'INTERNAL_ERROR',
      message: 'Erro interno. Tente novamente mais tarde.'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT DO SISTEMA PARA ANÔNIMOS
// ═══════════════════════════════════════════════════════════════════

function getAnonymousSystemPrompt() {
  return `🎵 Você é o assistente de áudio do SoundyAI.

CONTEXTO:
- Você está conversando com um VISITANTE que ainda não criou conta
- Seja AMIGÁVEL e PRESTATIVO para demonstrar o valor do SoundyAI
- Responda sobre mixagem, mastering, áudio, produção musical
- Se perguntarem sobre análise de áudio, explique que podem analisar músicas gratuitamente

LIMITES:
- Respostas concisas (máximo 3 parágrafos)
- Foque em ser útil e educativo
- Não revele detalhes técnicos internos do sistema

OBJETIVO:
- Mostrar valor do SoundyAI
- Incentivar o visitante a criar uma conta gratuita
- Ser um assistente de áudio útil e acessível

⚡ RESPONDA EM PORTUGUÊS BRASILEIRO, de forma clara e amigável.`;
}
