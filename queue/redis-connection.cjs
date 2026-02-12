/**
 * ============================================================================
 * REDIS CONNECTION - CONEXÃO COMPARTILHADA
 * ============================================================================
 * 
 * Conexão singleton do Redis usando ioredis.
 * Configurável via REDIS_URL (Railway, Render, etc.)
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 1.0.0
 * 
 * ============================================================================
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    console.error('[REDIS] Reconnect on error:', err.message);
    return true;
  }
});

redis.on('connect', () => {
  console.log('[REDIS] Conectado com sucesso');
});

redis.on('error', (err) => {
  console.error('[REDIS] Erro de conexão:', err.message);
});

redis.on('ready', () => {
  console.log('[REDIS] Pronto para receber comandos');
});

module.exports = redis;
