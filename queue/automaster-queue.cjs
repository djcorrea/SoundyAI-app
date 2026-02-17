/**
 * ============================================================================
 * AUTOMASTER QUEUE - FILA BULLMQ
 * ============================================================================
 * 
 * Fila BullMQ para processamento de masterização.
 * Configuração profissional com retry, backoff e limpeza automática.
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 1.0.0
 * 
 * ============================================================================
 */

const { Queue } = require('bullmq');
const redis = require('./redis-connection.cjs');

const automasterQueue = new Queue('automaster', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, // Máximo 3 tentativas (alinhado com error-classifier)
    backoff: {
      type: 'exponential',
      delay: 10000 // 10s base, depois 30s, 90s (alinhado com error-classifier)
    },
    removeOnComplete: {
      age: 3600, // 1 hora
      count: 1000
    },
    removeOnFail: {
      age: 86400 // 24 horas
    },
    timeout: 180000 // 3 minutos total timeout (alinhado com lock TTL)
  }
});

automasterQueue.on('error', (err) => {
  console.error('[QUEUE] Erro:', err.message);
});

module.exports = automasterQueue;
