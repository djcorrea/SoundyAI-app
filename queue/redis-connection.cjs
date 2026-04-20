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

// NOTA: lazyConnect=true foi REMOVIDO intencionalmente.
// BullMQ não chama .connect() em instâncias lazy — resulta em "Connection is closed" no boot.
// O retryStrategy abaixo garante reconexão automática sem crashar o processo.
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`[REDIS RETRY] Tentativa ${times} — próxima em ${delay}ms`);
    return delay;
  },
  reconnectOnError(err) {
    console.error('[REDIS] Reconectando após erro:', err.message);
    return true;
  }
});

redis.on('connect', () => {
  console.log('[REDIS] Conectando...');
});

redis.on('ready', () => {
  console.log('[REDIS] Pronto para receber comandos');
});

redis.on('error', (err) => {
  console.error('[REDIS] Erro de conexão:', err.message);
});

redis.on('close', () => {
  console.warn('[REDIS] Conexão encerrada. Aguardando reconexão automática...');
});

module.exports = redis;
