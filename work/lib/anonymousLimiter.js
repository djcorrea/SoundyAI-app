/**
 * 🛡️ ANONYMOUS LIMITER - Sistema de Limites para Usuários Não Autenticados
 * 
 * Controla o acesso de usuários anônimos (sem login Firebase) usando:
 * - Fingerprint (via FingerprintJS do frontend)
 * - IP como fallback/combinação
 * 
 * LIMITES ANÔNIMOS:
 * - 2 análises de áudio por dia
 * - 5 mensagens de chat por dia
 * 
 * ARQUITETURA:
 * - Redis para persistência de contadores
 * - Chave por fingerprint+IP para anti-fraude
 * - TTL de 24 horas (reset automático)
 * - Fallback seguro se Redis falhar
 * 
 * @version 1.0.0
 * @date 2026-01-02
 */

import Redis from 'ioredis';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE LIMITES
// ═══════════════════════════════════════════════════════════════════

const ANONYMOUS_LIMITS = {
  maxAnalyses: 2,      // Máximo de análises por dia
  maxMessages: 5,      // Máximo de mensagens por dia
  ttlSeconds: 86400,   // 24 horas em segundos
};

// ═══════════════════════════════════════════════════════════════════
// CLIENTE REDIS
// ═══════════════════════════════════════════════════════════════════

let redisClient = null;
let redisAvailable = false;

/**
 * Inicializar cliente Redis para limites anônimos
 */
function initRedis() {
  if (redisClient) return;
  
  if (!process.env.REDIS_URL) {
    console.warn('⚠️ [ANON_LIMITER] REDIS_URL não configurado - modo restritivo ativo');
    redisAvailable = false;
    return;
  }
  
  try {
    const isTLS = process.env.REDIS_URL.startsWith('rediss://');
    
    redisClient = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false,
      ...(isTLS && { tls: { rejectUnauthorized: false } }),
      retryStrategy: (times) => {
        if (times > 3) {
          console.error(`❌ [ANON_LIMITER] Falha após 3 tentativas`);
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 1000, 3000);
      }
    });
    
    redisClient.on('connect', () => {
      console.log('✅ [ANON_LIMITER] Conectado ao Redis');
      redisAvailable = true;
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ [ANON_LIMITER] Erro Redis:', err.message);
      redisAvailable = false;
    });
    
    redisClient.on('ready', () => {
      redisAvailable = true;
    });
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro na inicialização:', err.message);
    redisAvailable = false;
  }
}

// Inicializar automaticamente
initRedis();

// ═══════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrair IP do request
 * Considera proxies (Railway, Vercel, Cloudflare)
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
}

/**
 * Gerar chave única para o visitante anônimo
 * Combina fingerprint + IP para anti-fraude
 */
function getAnonymousKey(visitorId, ip, type) {
  // Se não tem visitorId, usar apenas IP (menos seguro mas funcional)
  const identifier = visitorId 
    ? `${visitorId}_${ip}` 
    : `ip_${ip}`;
  
  // Adicionar data para reset diário
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `anon:${type}:${identifier}:${today}`;
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Verificar se usuário anônimo pode fazer análise
 * 
 * @param {string} visitorId - Fingerprint do FingerprintJS
 * @param {Object} req - Request Express
 * @returns {Promise<Object>} { allowed, remaining, limit, message }
 */
export async function canAnonymousAnalyze(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip, 'analysis');
  
  console.log(`🔍 [ANON_LIMITER] Verificando análise - key: ${key}`);
  
  // Fallback se Redis não disponível - BLOQUEAR por segurança
  if (!redisAvailable || !redisClient) {
    console.warn('⚠️ [ANON_LIMITER] Redis indisponível - bloqueando análise anônima');
    return {
      allowed: false,
      remaining: 0,
      limit: ANONYMOUS_LIMITS.maxAnalyses,
      message: 'Sistema temporariamente indisponível. Faça login para continuar.',
      errorCode: 'ANON_SYSTEM_UNAVAILABLE'
    };
  }
  
  try {
    const count = await redisClient.get(key);
    const currentCount = parseInt(count || '0', 10);
    
    console.log(`📊 [ANON_LIMITER] Análises hoje: ${currentCount}/${ANONYMOUS_LIMITS.maxAnalyses}`);
    
    if (currentCount >= ANONYMOUS_LIMITS.maxAnalyses) {
      return {
        allowed: false,
        remaining: 0,
        limit: ANONYMOUS_LIMITS.maxAnalyses,
        used: currentCount,
        message: 'Você atingiu o limite de análises gratuitas. Crie uma conta para continuar analisando!',
        errorCode: 'ANON_ANALYSIS_LIMIT_REACHED'
      };
    }
    
    return {
      allowed: true,
      remaining: ANONYMOUS_LIMITS.maxAnalyses - currentCount,
      limit: ANONYMOUS_LIMITS.maxAnalyses,
      used: currentCount
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao verificar análise:', err.message);
    // Em caso de erro, bloquear por segurança
    return {
      allowed: false,
      remaining: 0,
      limit: ANONYMOUS_LIMITS.maxAnalyses,
      message: 'Erro ao verificar limites. Tente novamente.',
      errorCode: 'ANON_CHECK_ERROR'
    };
  }
}

/**
 * Registrar uma análise feita por usuário anônimo
 */
export async function registerAnonymousAnalysis(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip, 'analysis');
  
  console.log(`📝 [ANON_LIMITER] Registrando análise - key: ${key}`);
  
  if (!redisAvailable || !redisClient) {
    console.warn('⚠️ [ANON_LIMITER] Redis indisponível - não registrou análise');
    return { success: false, error: 'Redis unavailable' };
  }
  
  try {
    const newCount = await redisClient.incr(key);
    
    // Definir TTL se é a primeira análise do dia
    if (newCount === 1) {
      await redisClient.expire(key, ANONYMOUS_LIMITS.ttlSeconds);
    }
    
    console.log(`✅ [ANON_LIMITER] Análise registrada: ${newCount}/${ANONYMOUS_LIMITS.maxAnalyses}`);
    
    return {
      success: true,
      used: newCount,
      remaining: Math.max(0, ANONYMOUS_LIMITS.maxAnalyses - newCount)
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao registrar análise:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verificar se usuário anônimo pode enviar mensagem
 */
export async function canAnonymousChat(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip, 'chat');
  
  console.log(`🔍 [ANON_LIMITER] Verificando chat - key: ${key}`);
  
  // Fallback se Redis não disponível - BLOQUEAR por segurança
  if (!redisAvailable || !redisClient) {
    console.warn('⚠️ [ANON_LIMITER] Redis indisponível - bloqueando chat anônimo');
    return {
      allowed: false,
      remaining: 0,
      limit: ANONYMOUS_LIMITS.maxMessages,
      message: 'Sistema temporariamente indisponível. Faça login para continuar.',
      errorCode: 'ANON_SYSTEM_UNAVAILABLE'
    };
  }
  
  try {
    const count = await redisClient.get(key);
    const currentCount = parseInt(count || '0', 10);
    
    console.log(`📊 [ANON_LIMITER] Mensagens hoje: ${currentCount}/${ANONYMOUS_LIMITS.maxMessages}`);
    
    if (currentCount >= ANONYMOUS_LIMITS.maxMessages) {
      return {
        allowed: false,
        remaining: 0,
        limit: ANONYMOUS_LIMITS.maxMessages,
        used: currentCount,
        message: 'Você atingiu o limite de mensagens gratuitas. Crie uma conta para continuar conversando!',
        errorCode: 'ANON_CHAT_LIMIT_REACHED'
      };
    }
    
    return {
      allowed: true,
      remaining: ANONYMOUS_LIMITS.maxMessages - currentCount,
      limit: ANONYMOUS_LIMITS.maxMessages,
      used: currentCount
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao verificar chat:', err.message);
    return {
      allowed: false,
      remaining: 0,
      limit: ANONYMOUS_LIMITS.maxMessages,
      message: 'Erro ao verificar limites. Tente novamente.',
      errorCode: 'ANON_CHECK_ERROR'
    };
  }
}

/**
 * Registrar uma mensagem feita por usuário anônimo
 */
export async function registerAnonymousChat(visitorId, req) {
  const ip = getClientIP(req);
  const key = getAnonymousKey(visitorId, ip, 'chat');
  
  console.log(`📝 [ANON_LIMITER] Registrando mensagem - key: ${key}`);
  
  if (!redisAvailable || !redisClient) {
    console.warn('⚠️ [ANON_LIMITER] Redis indisponível - não registrou mensagem');
    return { success: false, error: 'Redis unavailable' };
  }
  
  try {
    const newCount = await redisClient.incr(key);
    
    // Definir TTL se é a primeira mensagem do dia
    if (newCount === 1) {
      await redisClient.expire(key, ANONYMOUS_LIMITS.ttlSeconds);
    }
    
    console.log(`✅ [ANON_LIMITER] Mensagem registrada: ${newCount}/${ANONYMOUS_LIMITS.maxMessages}`);
    
    return {
      success: true,
      used: newCount,
      remaining: Math.max(0, ANONYMOUS_LIMITS.maxMessages - newCount)
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao registrar mensagem:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Obter status atual do visitante anônimo
 */
export async function getAnonymousStatus(visitorId, req) {
  const ip = getClientIP(req);
  const analysisKey = getAnonymousKey(visitorId, ip, 'analysis');
  const chatKey = getAnonymousKey(visitorId, ip, 'chat');
  
  if (!redisAvailable || !redisClient) {
    return {
      analyses: { used: 0, remaining: ANONYMOUS_LIMITS.maxAnalyses, limit: ANONYMOUS_LIMITS.maxAnalyses },
      messages: { used: 0, remaining: ANONYMOUS_LIMITS.maxMessages, limit: ANONYMOUS_LIMITS.maxMessages },
      redis: false
    };
  }
  
  try {
    const [analysisCount, chatCount] = await Promise.all([
      redisClient.get(analysisKey),
      redisClient.get(chatKey)
    ]);
    
    const usedAnalyses = parseInt(analysisCount || '0', 10);
    const usedMessages = parseInt(chatCount || '0', 10);
    
    return {
      analyses: {
        used: usedAnalyses,
        remaining: Math.max(0, ANONYMOUS_LIMITS.maxAnalyses - usedAnalyses),
        limit: ANONYMOUS_LIMITS.maxAnalyses
      },
      messages: {
        used: usedMessages,
        remaining: Math.max(0, ANONYMOUS_LIMITS.maxMessages - usedMessages),
        limit: ANONYMOUS_LIMITS.maxMessages
      },
      redis: true
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao obter status:', err.message);
    return {
      analyses: { used: 0, remaining: 0, limit: ANONYMOUS_LIMITS.maxAnalyses },
      messages: { used: 0, remaining: 0, limit: ANONYMOUS_LIMITS.maxMessages },
      redis: false,
      error: err.message
    };
  }
}

export const LIMITS = ANONYMOUS_LIMITS;
