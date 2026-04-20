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
 * 🧹 MEMORY OPT 2026: Queue BullMQ instanciada de forma lazy
 * Redis e BullMQ não são carregados no startup — apenas na primeira chamada de add()
 * ============================================================================
 */

const { Queue } = require('bullmq');

let _queue = null;

/**
 * Retorna a instância lazy da Queue BullMQ.
 * Inicializa na primeira chamada, reutiliza nas seguintes.
 */
function getQueue() {
  if (!_queue) {
    try {
      const redis = require('./redis-connection.cjs');
      _queue = new Queue('automaster', {
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

      _queue.on('error', (err) => {
        console.error('[QUEUE INIT] Erro interno da fila:', err.message);
      });

      console.log('[QUEUE INIT] automaster Queue inicializada com sucesso');
    } catch (err) {
      console.error('[QUEUE INIT] Falha ao inicializar a fila:', err.message);
      _queue = null;
      throw err;
    }
  }
  return _queue;
}

// Proxy com interface compatível com a Queue BullMQ
// Callers do server.js usam .add() — este objeto mantém a API sem mudanças
module.exports = {
  add: (...args) => getQueue().add(...args),
  close: (...args) => getQueue().close(...args),
  on: (...args) => getQueue().on(...args),
  getJob: (...args) => getQueue().getJob(...args),
  getQueue, // exposto para casos que precisem de acesso direto
};
