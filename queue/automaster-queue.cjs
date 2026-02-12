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
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 3600, // 1 hora
      count: 1000
    },
    removeOnFail: {
      age: 86400 // 24 horas
    },
    timeout: 120000 // 2 minutos total timeout
  }
});

automasterQueue.on('error', (err) => {
  console.error('[QUEUE] Erro:', err.message);
});

module.exports = automasterQueue;
