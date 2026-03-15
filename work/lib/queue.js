/**
 * 🔗 QUEUE CENTRALIZED MODULE
 * Módulo único para conexão Redis e Queue BullMQ
 * Garante inicialização síncrona e singleton global
 */

import Redis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';

// 🔑 SINGLETON GLOBAL para evitar múltiplas conexões
const GLOBAL_KEY = Symbol.for('soundyai.redis.connection');
const QUEUE_KEY = Symbol.for('soundyai.bullmq.queue');
const EVENTS_KEY = Symbol.for('soundyai.bullmq.events');
const READY_PROMISE_KEY = Symbol.for('soundyai.queue.ready');

/**
 * Configuração Redis otimizada para BullMQ
 */
const REDIS_CONFIG = {
  maxRetriesPerRequest: null,      // ✅ Obrigatório para BullMQ
  lazyConnect: true,               // Conexão manual para controle total
  connectTimeout: 45000,
  commandTimeout: 15000,
  keepAlive: 120000,
  enableReadyCheck: false,
  enableAutoPipelining: true,
  family: 4,
  
  retryStrategy: (times) => {
    const delay = Math.min(times * 2000, 30000);
    console.log(`🔄 [REDIS] Retry attempt ${times}: ${delay}ms delay`);
    return delay;
  },
  
  retryDelayOnFailover: 2000,
};

/**
 * Opções de conexão dedicadas para BullMQ (sem lazyConnect).
 * BullMQ v5 + ioredis lazyConnect:true causa "Connection is closed" porque
 * o duplicate() interno herda lazyConnect e nunca chama connect().
 * Passar um plain IORedisOptions resolve o problema: BullMQ gerencia seu
 * próprio ciclo de vida de conexão.
 */
function buildBullMQConnectionOpts() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not set');
  const parsed = new URL(url);
  const opts = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 2000, 30000);
      console.log(`🔄 [BULLMQ] Connection retry ${times}: ${delay}ms`);
      return delay;
    },
  };
  if (parsed.password) opts.password = decodeURIComponent(parsed.password);
  if (parsed.username && parsed.username !== 'default') {
    opts.username = decodeURIComponent(parsed.username);
  }
  if (url.startsWith('rediss://')) opts.tls = { rejectUnauthorized: false };
  return opts;
}

/**
 * Inicializar conexão Redis singleton
 */
function initializeRedisConnection() {
  if (globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  if (!process.env.REDIS_URL) {
    throw new Error('🚨 REDIS_URL environment variable not configured');
  }

  console.log(`🔗 [REDIS] Creating singleton connection - PID: ${process.pid}`);
  console.log(`🔗 [REDIS] Service: ${process.env.SERVICE_NAME || 'unknown'}`);
  
  const connection = new Redis(process.env.REDIS_URL, REDIS_CONFIG);
  
  // 📊 Event Listeners para auditoria
  connection.on('connect', () => {
    console.log(`✅ [REDIS] Connected successfully - PID: ${process.pid}`);
  });
  
  connection.on('ready', async () => {
    try {
      const clientId = await connection.client('id');
      const dbSize = await connection.dbsize();
      console.log(`🟢 [REDIS] Ready for operations - Client ID: ${clientId} | DB Size: ${dbSize}`);
    } catch (err) {
      console.error(`🚨 [REDIS] Ready audit failed:`, err.message);
    }
  });
  
  connection.on('error', (err) => {
    console.error(`🚨 [REDIS] Connection error:`, err.message);
  });
  
  connection.on('reconnecting', (delay) => {
    console.log(`🔄 [REDIS] Reconnecting in ${delay}ms...`);
  });
  
  connection.on('end', () => {
    console.log(`🔌 [REDIS] Connection ended`);
  });
  
  connection.on('close', () => {
    console.log(`🚪 [REDIS] Connection closed`);
  });

  // Armazenar no singleton global
  globalThis[GLOBAL_KEY] = connection;
  return connection;
}

/**
 * Inicializar BullMQ Queue com configuração robusta
 */
function initializeQueue(connection) {
  if (globalThis[QUEUE_KEY]) {
    return globalThis[QUEUE_KEY];
  }

  console.log(`📋 [QUEUE] Creating BullMQ Queue 'audio-analyzer'`);
  
  // ✅ FIX: Usar opções de conexão (não instância ioredis) para evitar bug
  // BullMQ v5 + lazyConnect:true = "Connection is closed"
  const audioQueue = new Queue('audio-analyzer', {
    connection: buildBullMQConnectionOpts(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
      jobId: undefined, // Será definido individualmente para cada job
    }
  });

  // Armazenar no singleton global
  globalThis[QUEUE_KEY] = audioQueue;
  return audioQueue;
}

/**
 * Inicializar QueueEvents para monitoramento
 */
function initializeQueueEvents(connection) {
  if (globalThis[EVENTS_KEY]) {
    return globalThis[EVENTS_KEY];
  }

  console.log(`📡 [QUEUE-EVENTS] Creating QueueEvents for 'audio-analyzer'`);
  
  // ✅ FIX: Usar opções de conexão (não instância ioredis) para BullMQ v5
  const queueEvents = new QueueEvents('audio-analyzer', { connection: buildBullMQConnectionOpts() });
  
  // Listeners para auditoria
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`🔴 [QUEUE-EVENT] Job FAILED: ${jobId} | Reason: ${failedReason}`);
  });
  
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`🟢 [QUEUE-EVENT] Job COMPLETED: ${jobId} | Duration: ${returnvalue?.processingTime || 'unknown'}`);
  });
  
  queueEvents.on('error', (err) => {
    console.error(`🚨 [QUEUE-EVENT] QueueEvents error:`, err.message);
  });

  // Armazenar no singleton global
  globalThis[EVENTS_KEY] = queueEvents;
  return queueEvents;
}

/**
 * Promise global que resolve apenas quando tudo estiver pronto
 */
function createQueueReadyPromise() {
  if (globalThis[READY_PROMISE_KEY]) {
    return globalThis[READY_PROMISE_KEY];
  }

  const readyPromise = (async () => {
    try {
      console.log(`⏳ [QUEUE-INIT] Starting queue initialization...`);
      
      // 1. Inicializar conexão Redis
      const connection = initializeRedisConnection();
      
      // 2. Conectar ao Redis
      console.log(`🔌 [QUEUE-INIT] Connecting to Redis...`);
      await connection.connect();
      
      // 3. Aguardar Redis estar ready (com listeners devidamente removidos)
      console.log(`⏳ [QUEUE-INIT] Waiting for Redis ready state...`);
      await new Promise((resolve, reject) => {
        if (connection.status === 'ready') {
          resolve();
          return;
        }
        const onReady = () => {
          connection.removeListener('error', onError);
          resolve();
        };
        const onError = (err) => {
          connection.removeListener('ready', onReady);
          reject(err);
        };
        connection.once('ready', onReady);
        connection.once('error', onError);
        // Timeout de segurança
        setTimeout(() => {
          connection.removeListener('ready', onReady);
          connection.removeListener('error', onError);
          reject(new Error('Redis ready timeout after 30s'));
        }, 30000);
      });
      
      // 4. Inicializar Queue
      const audioQueue = initializeQueue(connection);
      
      // 5. Aguardar Queue estar pronta (com retry para resiliência)
      console.log(`⏳ [QUEUE-INIT] Waiting for Queue ready state...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await audioQueue.waitUntilReady();
          break;
        } catch (err) {
          if (attempt === 3) throw err;
          console.warn(`⚠️ [QUEUE-INIT] waitUntilReady attempt ${attempt} failed (${err.message}), retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      // 6. Garantir que não está pausada
      await audioQueue.resume();
      
      // 7. Inicializar QueueEvents
      const queueEvents = initializeQueueEvents(connection);
      
      // 8. Verificar status final
      const jobCounts = await audioQueue.getJobCounts();
      const isPaused = await audioQueue.isPaused();
      
      console.log(`✅ [QUEUE-INIT] Queue initialization completed successfully!`);
      console.log(`📊 [QUEUE-INIT] Status - Paused: ${isPaused} | Jobs: ${JSON.stringify(jobCounts)}`);
      
      return {
        connection,
        audioQueue,
        queueEvents,
        isReady: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`💥 [QUEUE-INIT] Initialization failed:`, error.message);
      console.error(`💥 [QUEUE-INIT] Stack trace:`, error.stack);
      // Resetar singleton para permitir retry na próxima chamada
      globalThis[READY_PROMISE_KEY] = null;
      globalThis[QUEUE_KEY] = null;
      globalThis[EVENTS_KEY] = null;
      throw error;
    }
  })();

  // Armazenar no singleton global
  globalThis[READY_PROMISE_KEY] = readyPromise;
  return readyPromise;
}

/**
 * Obter conexão Redis (garantindo que existe)
 */
export function getRedisConnection() {
  const connection = globalThis[GLOBAL_KEY];
  if (!connection) {
    throw new Error('🚨 Redis connection not initialized. Call getQueueReadyPromise() first.');
  }
  return connection;
}

/**
 * Obter Queue BullMQ (garantindo que existe)
 */
export function getAudioQueue() {
  const queue = globalThis[QUEUE_KEY];
  if (!queue) {
    throw new Error('🚨 Audio queue not initialized. Call getQueueReadyPromise() first.');
  }
  return queue;
}

/**
 * Obter QueueEvents (garantindo que existe)
 */
export function getQueueEvents() {
  const events = globalThis[EVENTS_KEY];
  if (!events) {
    console.warn('🚨 Queue events not initialized. Call getQueueReadyPromise() first.');
    return null; // Retorna null em vez de lançar erro para não quebrar o Worker
  }
  return events;
}

/**
 * Promise que resolve quando toda infraestrutura estiver pronta
 */
export function getQueueReadyPromise() {
  return createQueueReadyPromise();
}

/**
 * Verificar se a queue está pronta (síncrono)
 */
export function isQueueReady() {
  const readyPromise = globalThis[READY_PROMISE_KEY];
  if (!readyPromise) return false;
  
  // Verificar se a promise já foi resolvida
  return readyPromise.then(() => true).catch(() => false);
}

/**
 * Cleanup graceful das conexões
 */
export async function closeAllConnections() {
  try {
    console.log(`🔌 [CLEANUP] Starting graceful shutdown...`);
    
    const connection = globalThis[GLOBAL_KEY];
    const queue = globalThis[QUEUE_KEY];
    const events = globalThis[EVENTS_KEY];
    
    if (queue) {
      await queue.close();
      console.log(`🔌 [CLEANUP] Queue closed`);
    }
    
    if (events) {
      await events.close();
      console.log(`🔌 [CLEANUP] QueueEvents closed`);
    }
    
    if (connection) {
      await connection.quit();
      console.log(`🔌 [CLEANUP] Redis connection closed`);
    }
    
    // Limpar singletons
    delete globalThis[GLOBAL_KEY];
    delete globalThis[QUEUE_KEY];
    delete globalThis[EVENTS_KEY];
    delete globalThis[READY_PROMISE_KEY];
    
    console.log(`✅ [CLEANUP] Graceful shutdown completed`);
    
  } catch (error) {
    console.error(`💥 [CLEANUP] Error during shutdown:`, error.message);
  }
}

// Cleanup automático em shutdown
process.on('SIGINT', closeAllConnections);
process.on('SIGTERM', closeAllConnections);
process.on('beforeExit', closeAllConnections);