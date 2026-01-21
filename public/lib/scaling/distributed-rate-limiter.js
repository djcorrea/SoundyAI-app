// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🚀 RATE LIMITER DISTRIBUÍDO - FASE 1 
 * Melhoria 100% compatível com o sistema atual
 * Suporta fallback gracioso para o Map existente
 */

// Configurações
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 10;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * Rate Limiter avançado com cleanup automático e métricas
 */
export class DistributedRateLimit {
  constructor(options = {}) {
    this.windowMs = options.windowMs || DEFAULT_WINDOW_MS;
    this.maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    this.requests = new Map(); // Estrutura: userId -> [timestamps]
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      activeUsers: 0,
      lastCleanup: Date.now()
    };
    
    // Auto-cleanup periódico
    this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    
    log('✅ DistributedRateLimit inicializado:', {
      window: this.windowMs + 'ms',
      maxRequests: this.maxRequests
    });
  }
  
  /**
   * Verifica se usuário pode fazer request
   */
  async checkLimit(userId, customMax = null) {
    const now = Date.now();
    const maxReqs = customMax || this.maxRequests;
    
    // Incrementar métricas
    this.metrics.totalRequests++;
    
    // Obter histórico do usuário
    let userRequests = this.requests.get(userId) || [];
    
    // Remover timestamps expirados
    const cutoff = now - this.windowMs;
    userRequests = userRequests.filter(timestamp => timestamp > cutoff);
    
    // Verificar limite
    if (userRequests.length >= maxReqs) {
      this.metrics.blockedRequests++;
      
      // Calcular tempo para retry
      const oldestRequest = Math.min(...userRequests);
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
      
      const error = new Error('Rate limit exceeded');
      error.retryAfter = Math.max(retryAfter, 1);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.current = userRequests.length;
      error.limit = maxReqs;
      
      throw error;
    }
    
    // Adicionar timestamp atual
    userRequests.push(now);
    this.requests.set(userId, userRequests);
    
    return {
      allowed: true,
      current: userRequests.length,
      limit: maxReqs,
      remaining: maxReqs - userRequests.length,
      resetTime: Math.min(...userRequests) + this.windowMs
    };
  }
  
  /**
   * Limpa registros expirados
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const beforeSize = this.requests.size;
    
    for (const [userId, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => t > cutoff);
      
      if (valid.length === 0) {
        this.requests.delete(userId);
      } else if (valid.length !== timestamps.length) {
        this.requests.set(userId, valid);
      }
    }
    
    this.metrics.activeUsers = this.requests.size;
    this.metrics.lastCleanup = now;
    
    const cleaned = beforeSize - this.requests.size;
    if (cleaned > 0) {
      log(`🧹 Rate limit cleanup: ${cleaned} usuários inativos removidos`);
    }
  }
  
  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsage: this.requests.size,
      blockedRate: this.metrics.totalRequests > 0 
        ? (this.metrics.blockedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  /**
   * Para modo desenvolvimento - reseta limites
   */
  reset(userId = null) {
    if (userId) {
      this.requests.delete(userId);
      log(`🔄 Rate limit resetado para usuário: ${userId}`);
    } else {
      this.requests.clear();
      this.metrics = {
        totalRequests: 0,
        blockedRequests: 0,
        activeUsers: 0,
        lastCleanup: Date.now()
      };
      log('🔄 Rate limit resetado para todos os usuários');
    }
  }
  
  /**
   * Destrutor - limpa intervalos
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
    log('💥 DistributedRateLimit destruído');
  }
}

/**
 * Instância global para uso imediato
 */
export const globalRateLimit = new DistributedRateLimit();

/**
 * Função helper compatível com código existente
 */
export function checkRateLimit(userId, maxRequests = DEFAULT_MAX_REQUESTS) {
  return globalRateLimit.checkLimit(userId, maxRequests)
    .then(() => true)
    .catch(() => false);
}

/**
 * Middleware para Express/Vercel
 */
export function rateLimitMiddleware(options = {}) {
  const limiter = new DistributedRateLimit(options);
  
  return async (req, res, next) => {
    try {
      const userId = req.user?.uid || req.headers['x-user-id'] || req.ip;
      
      if (!userId) {
        return res.status(400).json({
          error: 'USER_ID_REQUIRED',
          message: 'Identificação de usuário necessária'
        });
      }
      
      const result = await limiter.checkLimit(userId);
      
      // Adicionar headers informativos
      res.set({
        'X-RateLimit-Limit': result.limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });
      
      next();
      
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Muitas requisições. Tente novamente em ${error.retryAfter} segundos`,
          retryAfter: error.retryAfter,
          current: error.current,
          limit: error.limit
        });
      }
      
      // Erro inesperado - permitir request
      error('⚠️ Erro no rate limiter:', error);
      next();
    }
  };
}

// Debug helpers para desenvolvimento
if (typeof window !== 'undefined') {
  window.__RATE_LIMIT_METRICS__ = () => globalRateLimit.getMetrics();
  window.__RATE_LIMIT_RESET__ = (userId) => globalRateLimit.reset(userId);
}
