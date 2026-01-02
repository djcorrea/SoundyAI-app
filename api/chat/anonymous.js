/**
 * 🔓 CHAT ANÔNIMO (VERCEL SERVERLESS) - Endpoint para usuários sem autenticação Firebase
 * 
 * Permite que visitantes não logados enviem mensagens de chat
 * COM LIMITES: 5 mensagens por dia
 * 
 * Este arquivo é específico para deploy no Vercel como serverless function.
 * A versão principal está em work/api/chat-anonymous.js
 * 
 * @version 1.0.0
 * @date 2026-01-02
 */

import cors from 'cors';
import Redis from 'ioredis';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE LIMITES
// ═══════════════════════════════════════════════════════════════════

const ANONYMOUS_LIMITS = {
  maxMessages: 5,
  ttlSeconds: 86400, // 24h
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_SIZE = 5;

// ═══════════════════════════════════════════════════════════════════
// CLIENTE REDIS
// ═══════════════════════════════════════════════════════════════════

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  
  if (!process.env.REDIS_URL) {
    console.warn('[ANON_CHAT] REDIS_URL não configurado');
    return null;
  }
  
  const isTLS = process.env.REDIS_URL.startsWith('rediss://');
  redisClient = new Redis(process.env.REDIS_URL, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    ...(isTLS && { tls: { rejectUnauthorized: false } })
  });
  
  return redisClient;
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES DE LIMITE
// ═══════════════════════════════════════════════════════════════════

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function getAnonymousKey(visitorId, ip) {
  const identifier = visitorId ? `${visitorId}_${ip}` : `ip_${ip}`;
  const today = new Date().toISOString().split('T')[0];
  return `anon:chat:${identifier}:${today}`;
}

async function canChat(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip);
  
  const redis = getRedis();
  if (!redis) {
    return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxMessages, 
             message: 'Sistema indisponível', errorCode: 'SYSTEM_UNAVAILABLE' };
  }
  
  try {
    await redis.connect().catch(() => {});
    const count = parseInt(await redis.get(key) || '0', 10);
    
    if (count >= ANONYMOUS_LIMITS.maxMessages) {
      return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxMessages,
               used: count, message: 'Limite atingido', errorCode: 'ANON_CHAT_LIMIT_REACHED' };
    }
    
    return { allowed: true, remaining: ANONYMOUS_LIMITS.maxMessages - count,
             limit: ANONYMOUS_LIMITS.maxMessages, used: count };
  } catch (err) {
    console.error('[ANON_CHAT] Redis error:', err.message);
    return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxMessages,
             message: 'Erro de sistema', errorCode: 'REDIS_ERROR' };
  }
}

async function registerChat(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip);
  
  const redis = getRedis();
  if (!redis) return { success: false };
  
  try {
    const newCount = await redis.incr(key);
    if (newCount === 1) await redis.expire(key, ANONYMOUS_LIMITS.ttlSeconds);
    return { success: true, used: newCount, remaining: Math.max(0, ANONYMOUS_LIMITS.maxMessages - newCount) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════════

const corsMiddleware = cors({
  origin: ['https://soundyai.com.br', 'https://www.soundyai.com.br', 
           'http://localhost:3000', 'http://localhost:5000'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════

function validateInput(body) {
  const { message, visitorId, conversationHistory } = body;
  
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('MESSAGE_INVALID');
  }
  if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
    throw new Error('VISITOR_ID_INVALID');
  }
  
  let validHistory = [];
  if (conversationHistory) {
    let data = conversationHistory;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = []; }
    }
    if (Array.isArray(data)) {
      validHistory = data.filter(m => 
        m && m.role && m.content && ['user', 'assistant'].includes(m.role)
      ).slice(-MAX_HISTORY_SIZE);
    }
  }
  
  return {
    message: message.trim().substring(0, MAX_MESSAGE_LENGTH),
    visitorId: visitorId.trim(),
    conversationHistory: validHistory
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch {
    return res.status(403).json({ error: 'CORS_ERROR' });
  }
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  
  try {
    const validated = validateInput(req.body || {});
    const { message, visitorId, conversationHistory } = validated;
    
    // Verificar limites
    const limitCheck = await canChat(visitorId, req);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.errorCode,
        message: limitCheck.message,
        remaining: 0,
        limit: limitCheck.limit,
        requiresLogin: true
      });
    }
    
    // Chamar OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'CONFIG_ERROR', message: 'Serviço indisponível' });
    }
    
    const systemPrompt = `🎵 Você é o assistente de áudio do SoundyAI para visitantes.
Seja útil, educativo e amigável. Foco em mixagem, mastering e produção musical.
Respostas concisas (máximo 3 parágrafos). Português brasileiro.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    if (!aiResponse.ok) {
      return res.status(502).json({ error: 'AI_SERVICE_ERROR', message: 'Erro ao processar mensagem' });
    }
    
    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui responder.';
    
    // Registrar uso
    const regResult = await registerChat(visitorId, req);
    
    return res.status(200).json({
      success: true,
      reply,
      anonymous: true,
      limits: {
        used: regResult.used || (limitCheck.used + 1),
        remaining: regResult.remaining ?? (limitCheck.remaining - 1),
        limit: limitCheck.limit
      }
    });
    
  } catch (error) {
    if (error.message === 'MESSAGE_INVALID') {
      return res.status(422).json({ error: 'MESSAGE_INVALID', message: 'Mensagem inválida' });
    }
    if (error.message === 'VISITOR_ID_INVALID') {
      return res.status(400).json({ error: 'VISITOR_ID_REQUIRED', message: 'Identificador inválido' });
    }
    
    console.error('[ANON_CHAT] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno' });
  }
}
