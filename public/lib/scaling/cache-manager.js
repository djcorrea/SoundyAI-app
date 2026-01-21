// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 💾 CACHE MANAGER - FASE 2
 * Sistema de cache inteligente com fallback para Redis futuro
 * Compatible with Upstash Redis when configured
 */

// Configurações
const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutos
  maxMemoryEntries: 1000,
  enableCompression: true,
  enableMetrics: true
};

/**
 * Cache Manager with Redis-compatible interface
 */
export class CacheManager {
  constructor(options = {}) {
    this.config = { ...CACHE_CONFIG, ...options };
    this.memoryCache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    
    // Setup cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 1 minute
    
    log('💾 CacheManager inicializado:', this.config);
  }
  
  /**
   * Get value from cache
   */
  async get(key) {
    try {
      // Try Redis first (if configured)
      if (this.redis) {
        const value = await this.redis.get(key);
        if (value !== null) {
          this.metrics.hits++;
          return this.deserialize(value);
        }
      }
      
      // Fallback to memory cache
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        this.metrics.hits++;
        return entry.value;
      }
      
      // Remove expired entry
      if (entry) {
        this.memoryCache.delete(key);
      }
      
      this.metrics.misses++;
      return null;
      
    } catch (error) {
      warn('Cache get error:', error);
      this.metrics.misses++;
      return null;
    }
  }
  
  /**
   * Set value in cache
   */
  async set(key, value, ttl = this.config.defaultTTL) {
    try {
      const serialized = this.serialize(value);
      const expiresAt = Date.now() + (ttl * 1000);
      
      // Try Redis first
      if (this.redis) {
        await this.redis.setex(key, ttl, serialized);
      }
      
      // Always store in memory as backup
      this.memoryCache.set(key, {
        value,
        expiresAt,
        size: this.estimateSize(serialized)
      });
      
      this.metrics.sets++;
      
      // Check memory limit
      if (this.memoryCache.size > this.config.maxMemoryEntries) {
        this.evictOldest();
      }
      
      return true;
      
    } catch (error) {
      warn('Cache set error:', error);
      return false;
    }
  }
  
  /**
   * Delete from cache
   */
  async delete(key) {
    try {
      if (this.redis) {
        await this.redis.del(key);
      }
      
      const deleted = this.memoryCache.delete(key);
      if (deleted) {
        this.metrics.deletes++;
      }
      
      return deleted;
      
    } catch (error) {
      warn('Cache delete error:', error);
      return false;
    }
  }
  
  /**
   * Check if key exists
   */
  async has(key) {
    try {
      if (this.redis) {
        const exists = await this.redis.exists(key);
        if (exists) return true;
      }
      
      const entry = this.memoryCache.get(key);
      return entry && entry.expiresAt > Date.now();
      
    } catch (error) {
      warn('Cache has error:', error);
      return false;
    }
  }
  
  /**
   * Increment counter (for rate limiting)
   */
  async increment(key, window = 60) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowKey = `${key}:${Math.floor(now / window)}`;
      
      if (this.redis) {
        const count = await this.redis.incr(windowKey);
        await this.redis.expire(windowKey, window * 2);
        return count;
      }
      
      // Memory fallback
      const entry = this.memoryCache.get(windowKey) || { value: 0, expiresAt: (now + window * 2) * 1000 };
      entry.value++;
      this.memoryCache.set(windowKey, entry);
      
      return entry.value;
      
    } catch (error) {
      warn('Cache increment error:', error);
      return 1;
    }
  }
  
  /**
   * Serialize value for storage
   */
  serialize(value) {
    try {
      const json = JSON.stringify(value);
      
      if (this.config.enableCompression && json.length > 1000) {
        // Simple compression for large objects
        return this.compress(json);
      }
      
      return json;
      
    } catch (error) {
      warn('Serialization error:', error);
      return String(value);
    }
  }
  
  /**
   * Deserialize value from storage
   */
  deserialize(value) {
    try {
      if (typeof value === 'string' && value.startsWith('{')) {
        return JSON.parse(value);
      }
      return value;
      
    } catch (error) {
      warn('Deserialization error:', error);
      return value;
    }
  }
  
  /**
   * Simple compression (placeholder for future implementation)
   */
  compress(data) {
    // For now, just return as-is
    // In production, could use LZ-string or similar
    return data;
  }
  
  /**
   * Estimate memory size of data
   */
  estimateSize(data) {
    return new Blob([data]).size;
  }
  
  /**
   * Evict oldest entries when memory limit is reached
   */
  evictOldest() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    const toEvict = Math.ceil(entries.length * 0.1); // Evict 10%
    for (let i = 0; i < toEvict; i++) {
      this.memoryCache.delete(entries[i][0]);
      this.metrics.evictions++;
    }
    
    log(`🧹 Cache eviction: ${toEvict} entries removed`);
  }
  
  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    const beforeSize = this.memoryCache.size;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
    
    const cleaned = beforeSize - this.memoryCache.size;
    if (cleaned > 0) {
      log(`🧹 Cache cleanup: ${cleaned} expired entries removed`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: totalRequests > 0 ? (this.metrics.hits / totalRequests * 100).toFixed(2) + '%' : '0%',
      memoryEntries: this.memoryCache.size,
      memoryLimit: this.config.maxMemoryEntries,
      memoryUsage: `${this.memoryCache.size}/${this.config.maxMemoryEntries}`,
      redisConnected: !!this.redis
    };
  }
  
  /**
   * Connect to Redis (Upstash compatible)
   */
  async connectRedis(config) {
    try {
      if (config.url && config.token) {
        // Upstash Redis
        const { Redis } = await import('@upstash/redis');
        this.redis = new Redis(config);
        log('✅ Connected to Upstash Redis');
      } else if (config.host) {
        // Standard Redis (for future use)
        log('⚠️ Standard Redis not implemented yet');
      }
      
      return !!this.redis;
      
    } catch (error) {
      warn('Failed to connect to Redis:', error);
      return false;
    }
  }
  
  /**
   * Clear all cache
   */
  async clear() {
    try {
      if (this.redis) {
        // Note: Be careful with FLUSHALL in production
        warn('⚠️ Redis flush not implemented for safety');
      }
      
      this.memoryCache.clear();
      log('🧹 Memory cache cleared');
      
    } catch (error) {
      warn('Cache clear error:', error);
    }
  }
  
  /**
   * Destroy cache manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.memoryCache.clear();
    this.redis = null;
    
    log('💥 CacheManager destroyed');
  }
}

/**
 * Global cache instance
 */
export const globalCache = new CacheManager();

/**
 * Helper functions for common caching patterns
 */
export class CacheHelpers {
  
  /**
   * Cache with automatic key generation
   */
  static async cacheFunction(fn, args = [], ttl = 300) {
    const key = `fn:${fn.name}:${JSON.stringify(args)}`;
    
    let result = await globalCache.get(key);
    if (result !== null) {
      return result;
    }
    
    result = await fn(...args);
    await globalCache.set(key, result, ttl);
    
    return result;
  }
  
  /**
   * Cache API responses
   */
  static async cacheApiCall(url, options = {}, ttl = 300) {
    const key = `api:${url}:${JSON.stringify(options)}`;
    
    let result = await globalCache.get(key);
    if (result !== null) {
      return result;
    }
    
    const response = await fetch(url, options);
    result = await response.json();
    
    await globalCache.set(key, result, ttl);
    
    return result;
  }
  
  /**
   * Rate limiting with cache
   */
  static async checkRateLimit(userId, maxRequests = 10, window = 60) {
    const key = `rate:${userId}`;
    const count = await globalCache.increment(key, window);
    
    if (count > maxRequests) {
      const error = new Error('Rate limit exceeded');
      error.retryAfter = window;
      error.current = count;
      error.limit = maxRequests;
      throw error;
    }
    
    return {
      allowed: true,
      current: count,
      limit: maxRequests,
      remaining: maxRequests - count
    };
  }
}

// Debug helpers
if (typeof window !== 'undefined') {
  window.__CACHE_STATS__ = () => globalCache.getStats();
  window.__CACHE_CLEAR__ = () => globalCache.clear();
  window.__CACHE_GET__ = (key) => globalCache.get(key);
  window.__CACHE_SET__ = (key, value, ttl) => globalCache.set(key, value, ttl);
}

export default { CacheManager, globalCache, CacheHelpers };
