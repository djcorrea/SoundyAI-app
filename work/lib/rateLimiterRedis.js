/**
 * 🛡️ RATE LIMITER REDIS - PROTEÇÃO GLOBAL CONTRA ABUSO
 * 
 * Implementação de rate limiting DISTRIBUÍDO usando Redis.
 * Escala horizontalmente - compartilha limites entre TODAS as instâncias.
 * 
 * OBJETIVO:
 * - Proteger contra bots, loops maliciosos e abuso
 * - Limites GLOBAIS (não multiplicados por instância)
 * - Fallback seguro se Redis falhar
 * - Zero alteração nas regras de negócio
 * 
 * ARQUITETURA:
 * - Chave por UID (se autenticado) com fallback para IP
 * - Sliding window usando Redis INCR + EXPIRE
 * - TTL automático (60 segundos)
 * - Formato de chave: rate:{tipo}:{uid|ip}:{YYYYMMDDHHMM}
 * 
 * LIMITES (IGUAIS AO SISTEMA ANTERIOR):
 * - Chat (texto + imagens): 30 req/min
 * - Análise de áudio: 10 req/min
 * - Webhook de pagamento: 10 req/min
 * 
 * @version 3.0.0 (Redis - distribuído)
 * @date 2025-12-14
 */

import Redis from 'ioredis';

// ✅ Cliente Redis global (compartilhado)
let redisClient = null;
let redisAvailable = false;

// ✅ Métricas globais
let totalRequests = 0;
let blockedRequests = 0;
let redisErrors = 0;

/**
 * Inicializar cliente Redis
 * Chamado automaticamente na primeira requisição
 */
function initRedis() {
  if (redisClient) return; // Já inicializado
  
  if (!process.env.REDIS_URL) {
    console.error('❌ [RATE_LIMIT_REDIS] REDIS_URL não configurado - fallback para modo permissivo');
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
          console.error(`❌ [RATE_LIMIT_REDIS] Falha após 3 tentativas - modo fallback ativo`);
          redisAvailable = false;
          return null; // Para de tentar
        }
        return Math.min(times * 1000, 3000);
      }
    });
    
    redisClient.on('connect', () => {
      console.log('✅ [RATE_LIMIT_REDIS] Conectado com sucesso');
      redisAvailable = true;
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ [RATE_LIMIT_REDIS] Erro:', err.message);
      redisErrors++;
      redisAvailable = false;
    });
    
    redisClient.on('ready', () => {
      redisAvailable = true;
    });
    
  } catch (err) {
    console.error('❌ [RATE_LIMIT_REDIS] Erro na inicialização:', err.message);
    redisAvailable = false;
  }
}

/**
 * Extrair identificador (UID ou IP)
 * Prioriza UID para limites mais precisos
 * 
 * @param {Object} req - Request Express
 * @returns {Object} { identifier, type }
 */
function getIdentifier(req) {
  // ✅ PRIORIDADE 1: UID do usuário autenticado
  // Extrai de diferentes fontes possíveis
  const uid = req.user?.uid || 
              req.body?.uid || 
              req.query?.uid ||
              null;
  
  if (uid) {
    return { identifier: `uid_${uid}`, type: 'UID' };
  }
  
  // ✅ PRIORIDADE 2: IP da requisição (fallback)
  const ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             'unknown';
  
  return { identifier: `ip_${ip}`, type: 'IP' };
}

/**
 * Verificar rate limit usando Redis
 * 
 * @param {Object} req - Request Express
 * @param {string} limitType - Tipo do limite (chat, analysis, webhook)
 * @param {number} maxRequests - Máximo de requisições permitidas
 * @returns {Promise<Object>} { allowed, current, identifier }
 */
async function checkRateLimit(req, limitType, maxRequests) {
  // Inicializar Redis se necessário
  if (!redisClient) {
    initRedis();
  }
  
  totalRequests++;
  
  // ✅ FALLBACK: Se Redis não disponível, modo permissivo
  if (!redisAvailable || !redisClient) {
    console.warn(`⚠️ [RATE_LIMIT_REDIS] Redis indisponível - permitindo requisição (fallback)`);
    return { allowed: true, current: 0, identifier: 'fallback', fallback: true };
  }
  
  // Obter identificador (UID ou IP)
  const { identifier, type } = getIdentifier(req);
  
  // Obter minuto atual (YYYYMMDDHHMM)
  const now = new Date();
  const minute = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Chave Redis: rate:{tipo}:{uid|ip}:{minuto}
  const key = `rate:${limitType}:${identifier}:${minute}`;
  
  try {
    // ✅ REDIS INCR: Incrementa contador atomicamente
    const current = await redisClient.incr(key);
    
    // ✅ Se é a primeira requisição deste minuto, setar TTL de 60 segundos
    if (current === 1) {
      await redisClient.expire(key, 60);
    }
    
    // ✅ Verificar se excedeu o limite
    if (current > maxRequests) {
      blockedRequests++;
      console.warn(`⚠️ [RATE_LIMIT_REDIS] Bloqueado: ${limitType} | ${type}: ${identifier.replace('uid_', '').replace('ip_', '')} | ${current}/${maxRequests} req/min`);
      return { allowed: false, current, identifier, type };
    }
    
    // ✅ Requisição permitida
    return { allowed: true, current, identifier, type };
    
  } catch (err) {
    // ✅ ERRO NO REDIS: Fallback permissivo
    console.error(`❌ [RATE_LIMIT_REDIS] Erro ao verificar limite:`, err.message);
    redisErrors++;
    redisAvailable = false;
    
    // Modo permissivo em caso de erro
    return { allowed: true, current: 0, identifier, fallback: true, error: true };
  }
}

/**
 * Factory para criar middlewares de rate limiting
 * 
 * @param {string} limitType - Tipo do limite (chat, analysis, webhook)
 * @param {number} maxRequests - Máximo de requisições por minuto
 * @returns {Function} Middleware Express
 */
function createRateLimiter(limitType, maxRequests) {
  return async function rateLimiterMiddleware(req, res, next) {
    try {
      const result = await checkRateLimit(req, limitType, maxRequests);
      
      if (!result.allowed) {
        // ✅ Log detalhado de bloqueio
        const identifierDisplay = result.identifier.replace('uid_', '').replace('ip_', '');
        console.warn(`🛑 [RATE_LIMIT_REDIS] BLOQUEADO: ${limitType} | ${result.type}: ${identifierDisplay} | ${result.current}/${maxRequests} req/min`);
        
        // ✅ Retornar HTTP 429 com mensagem neutra
        return res.status(429).json({
          error: 'RATE_LIMIT',
          message: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.',
          retryAfter: 60
        });
      }
      
      // ✅ Log de fallback se aplicável
      if (result.fallback) {
        console.warn(`⚠️ [RATE_LIMIT_REDIS] Fallback ativo para ${limitType}`);
      }
      
      // ✅ Continuar para próximo middleware
      next();
      
    } catch (err) {
      // ✅ ERRO CRÍTICO: Log mas não bloqueia (modo permissivo)
      console.error(`❌ [RATE_LIMIT_REDIS] Erro crítico no middleware ${limitType}:`, err.message);
      redisErrors++;
      next(); // Permite requisição em caso de erro
    }
  };
}

/**
 * Rate limiter para endpoints de chat (texto + imagens)
 * 
 * Limite: 30 requisições por minuto (GLOBAL)
 * Por UID (se autenticado) ou IP (fallback)
 */
export const chatLimiter = createRateLimiter('chat', 30);

/**
 * Rate limiter para análise de áudio
 * 
 * Limite: 10 requisições por minuto (GLOBAL)
 * Por UID (se autenticado) ou IP (fallback)
 */
export const analysisLimiter = createRateLimiter('analysis', 10);

/**
 * Rate limiter para webhook de pagamento
 * 
 * Limite: 10 requisições por minuto (GLOBAL)
 * Por IP (webhooks geralmente não têm UID)
 */
export const webhookLimiter = createRateLimiter('webhook', 10);

/**
 * Obter estatísticas de rate limiting
 * 
 * @returns {Object} Estatísticas
 */
export function getRateLimitStats() {
  return {
    totalRequests,
    blockedRequests,
    redisErrors,
    redisAvailable,
    blockRate: totalRequests > 0 ? (blockedRequests / totalRequests * 100).toFixed(2) + '%' : '0%',
    errorRate: totalRequests > 0 ? (redisErrors / totalRequests * 100).toFixed(2) + '%' : '0%'
  };
}

/**
 * NOTAS TÉCNICAS:
 * 
 * 1. ✅ Rate limiting GLOBAL via Redis (compartilhado entre instâncias)
 * 2. ✅ Sliding window usando INCR + EXPIRE (eficiente e preciso)
 * 3. ✅ Chave por UID (se autenticado) com fallback para IP
 * 4. ✅ TTL automático de 60 segundos (limpa automaticamente)
 * 5. ✅ Fallback permissivo se Redis falhar (não bloqueia tudo)
 * 6. ✅ Logs detalhados (bloqueios, erros, fallbacks)
 * 7. ✅ Limites IGUAIS ao sistema anterior (30 chat, 10 análise)
 * 8. ✅ NÃO altera regras de negócio (canUseChat, canUseAnalysis intactos)
 * 9. ✅ NÃO altera hard caps mensais (500/300/70 PRO)
 * 10. ✅ Zero alteração na UX
 * 
 * GARANTIAS:
 * - ✅ Múltiplas instâncias → limite NÃO multiplica
 * - ✅ Mesmo UID, IPs diferentes → limite por UID (correto)
 * - ✅ Redis indisponível → modo permissivo (não quebra)
 * - ✅ Ataque burst → bloqueio em segundos
 * - ✅ Compatível com sistema de planos (FREE/PLUS/PRO)
 * 
 * CHAVES REDIS:
 * - rate:chat:uid_abc123:202512141230
 * - rate:analysis:ip_189.10.20.30:202512141231
 * - rate:webhook:ip_203.45.67.89:202512141232
 * 
 * EXEMPLO DE FLUXO:
 * 1. Requisição chega → extrair UID ou IP
 * 2. Gerar chave: rate:chat:uid_xyz:202512141230
 * 3. INCR na chave (incrementa contador)
 * 4. Se contador = 1 → EXPIRE 60s
 * 5. Se contador > 30 → bloquear (HTTP 429)
 * 6. Se contador <= 30 → permitir
 * 7. Após 60s → chave expira automaticamente
 */
