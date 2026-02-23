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
    // ✅ PATCH 2026-02-23: ALINHADO COM WORKER TIMEOUT (300s) + MARGEM (60s)
    // Antes: 180000ms (3 min) - Queue matava job antes do worker finalizar
    // Depois: 360000ms (6 min) - Worker timeout 300s + margem 60s
    // Motivo: Prevenir "queue timeout < worker timeout" causando duplicação
    timeout: 360000 // 6 minutos total timeout (worker 300s + margem)
  }
});

automasterQueue.on('error', (err) => {
  console.error('[QUEUE] Erro:', err.message);
});

module.exports = automasterQueue;
