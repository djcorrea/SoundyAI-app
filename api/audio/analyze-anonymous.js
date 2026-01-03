/**
 * 🔓 ANÁLISE ANÔNIMA (VERCEL SERVERLESS) - Endpoint para usuários sem autenticação Firebase
 * 
 * Permite que visitantes não logados façam análises de áudio
 * 
 * ⚠️ REGRA DE NEGÓCIO CRÍTICA:
 * - 1 análise NA VIDA (PERMANENTE)
 * - O backend Railway é a ÚNICA autoridade de bloqueio
 * - Esta rota apenas redireciona para o backend Railway
 * 
 * Este arquivo é específico para deploy no Vercel como serverless function.
 * A versão principal está em work/api/audio/analyze-anonymous.js
 * 
 * IMPORTANTE: Esta rota cria o job e redireciona para o backend Railway
 * que possui o worker BullMQ para processamento real.
 * 
 * @version 2.0.0 - BLOQUEIO PERMANENTE
 * @date 2025-01-03
 */

import cors from 'cors';
import Redis from 'ioredis';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const ANONYMOUS_LIMITS = {
  maxAnalyses: 1,       // 1 análise NA VIDA (backend Railway é autoridade)
  ttlSeconds: 86400,    // TTL apenas para cache local, não para bloqueio real
};

const RAILWAY_BACKEND_URL = process.env.RAILWAY_BACKEND_URL || 'https://soundyai-app-production.up.railway.app';

// ═══════════════════════════════════════════════════════════════════
// CLIENTE REDIS
// ═══════════════════════════════════════════════════════════════════

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  
  if (!process.env.REDIS_URL) {
    console.warn('[ANON_ANALYZE] REDIS_URL não configurado');
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
  return `anon:analysis:${identifier}:${today}`;
}

async function canAnalyze(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip);
  
  const redis = getRedis();
  if (!redis) {
    return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxAnalyses, 
             message: 'Sistema indisponível', errorCode: 'SYSTEM_UNAVAILABLE' };
  }
  
  try {
    await redis.connect().catch(() => {});
    const count = parseInt(await redis.get(key) || '0', 10);
    
    if (count >= ANONYMOUS_LIMITS.maxAnalyses) {
      return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxAnalyses,
               used: count, message: 'Limite de análises atingido', 
               errorCode: 'ANON_ANALYSIS_LIMIT_REACHED' };
    }
    
    return { allowed: true, remaining: ANONYMOUS_LIMITS.maxAnalyses - count,
             limit: ANONYMOUS_LIMITS.maxAnalyses, used: count };
  } catch (err) {
    console.error('[ANON_ANALYZE] Redis error:', err.message);
    return { allowed: false, remaining: 0, limit: ANONYMOUS_LIMITS.maxAnalyses,
             message: 'Erro de sistema', errorCode: 'REDIS_ERROR' };
  }
}

async function registerAnalysis(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip);
  
  const redis = getRedis();
  if (!redis) return { success: false };
  
  try {
    const newCount = await redis.incr(key);
    if (newCount === 1) await redis.expire(key, ANONYMOUS_LIMITS.ttlSeconds);
    return { success: true, used: newCount, remaining: Math.max(0, ANONYMOUS_LIMITS.maxAnalyses - newCount) };
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
    const { fileKey, fileName, genre, genreTargets, visitorId, soundDestination } = req.body || {};
    
    // Validar visitorId
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'VISITOR_ID_REQUIRED',
        message: 'Identificador de visitante é obrigatório'
      });
    }
    
    // Verificar limites
    const limitCheck = await canAnalyze(visitorId, req);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: limitCheck.errorCode,
        message: limitCheck.message,
        remaining: 0,
        limit: limitCheck.limit,
        requiresLogin: true
      });
    }
    
    // Validar fileKey
    if (!fileKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'FILE_KEY_REQUIRED',
        message: 'fileKey é obrigatório'
      });
    }
    
    // Validar genre (obrigatório para anônimos)
    if (!genre || typeof genre !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'GENRE_REQUIRED',
        message: 'Selecione um gênero para análise'
      });
    }
    
    // Proxy para o backend Railway (onde está o worker BullMQ)
    console.log('[ANON_ANALYZE] Encaminhando para Railway backend...');
    
    const railwayResponse = await fetch(`${RAILWAY_BACKEND_URL}/api/audio/analyze-anonymous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': getClientIP(req),
        'X-Visitor-Id': visitorId
      },
      body: JSON.stringify({
        fileKey,
        fileName,
        genre,
        genreTargets,
        visitorId,
        soundDestination: soundDestination || 'pista'
      })
    });
    
    const data = await railwayResponse.json();
    
    if (!railwayResponse.ok) {
      // Propagar erro do backend
      return res.status(railwayResponse.status).json(data);
    }
    
    // Registrar uso localmente também (redundância)
    await registerAnalysis(visitorId, req);
    
    return res.status(201).json(data);
    
  } catch (error) {
    console.error('[ANON_ANALYZE] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao processar análise'
    });
  }
}
