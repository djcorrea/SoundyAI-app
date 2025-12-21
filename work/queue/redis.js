// queue/redis.js
import BullMQ from 'bullmq';
import Redis from 'ioredis';

const { Queue, Worker } = BullMQ;

// 🔗 DIAGNÓSTICO: Configuração Redis Padronizada
console.log(`[CONFIG][${new Date().toISOString()}] -> 🔧 Iniciando conexão Redis`);

if (!process.env.REDIS_URL) {
  console.error(`[CONFIG][${new Date().toISOString()}] -> � ERRO: REDIS_URL não configurado!`);
  process.exit(1);
}

// 🔗 Conexão OTIMIZADA usando APENAS REDIS_URL
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,  // ✅ Obrigatório para BullMQ
  lazyConnect: true,
  connectTimeout: 45000,
  commandTimeout: 15000,
  keepAlive: 120000,
  enableReadyCheck: false,
  enableAutoPipelining: true,
  family: 4,
  
  // � RETRY STRATEGY ROBUSTO
  retryStrategy: (times) => {
    const delay = Math.min(times * 2000, 30000); // Máximo 30s
    console.log(`[REDIS][${new Date().toISOString()}] -> 🔄 Tentando reconectar... (tentativa ${times})`);
    return delay;
  },
  
  retryDelayOnFailover: 2000,
});

console.log(`[CONFIG][${new Date().toISOString()}] -> ⚙️ Configurações aplicadas: usando REDIS_URL exclusivamente`);

// 🔥 Eventos de conexão para debugging
connection.on('connect', () => {
  console.log(`[REDIS][${new Date().toISOString()}] -> ✅ Conectado ao Redis`);
});

connection.on('error', (err) => {
  console.error(`[REDIS][${new Date().toISOString()}] -> � Erro ao conectar ao Redis: ${err.message}`);
});

connection.on('ready', () => {
  console.log(`[REDIS][${new Date().toISOString()}] -> ✅ Conexão pronta para uso (Status: READY)`);
});

connection.on('reconnecting', (delay) => {
  console.log(`[REDIS][${new Date().toISOString()}] -> 🔄 Tentando reconectar... (delay: ${delay}ms)`);
});

connection.on('end', () => {
  console.log(`[REDIS][${new Date().toISOString()}] -> 🔌 Conexão encerrada`);
});

connection.on('close', () => {
  console.log(`[REDIS][${new Date().toISOString()}] -> 🚪 Conexão fechada`);
});

// 📋 DIAGNÓSTICO: Criação da fila principal
console.log(`[CONFIG][${new Date().toISOString()}] -> 📋 Criando fila 'audio-analyzer'`);
console.log(`[CONFIG][${new Date().toISOString()}] -> 🔧 removeOnComplete=5, removeOnFail=10, attempts=2`);

// 📋 Fila principal para análises de áudio - OTIMIZADA PARA REDUZIR REQUESTS REDIS
export const audioQueue = new Queue('audio-analyzer', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000
    },
    ttl: 300000,
    delay: 0
  }
});

// 🔥 LOGS DE DIAGNÓSTICO - Queue Events
console.log(`[QUEUE][${new Date().toISOString()}] -> 📋 Fila '${audioQueue.name}' criada com sucesso`);
console.log(`[QUEUE][${new Date().toISOString()}] -> 🎯 Fila utilizada: '${audioQueue.name}'`);

audioQueue.on('error', (err) => {
  console.error(`[QUEUE][${new Date().toISOString()}] -> 🚨 ERRO NA FILA: ${err.message}`);
  console.error(`[QUEUE][${new Date().toISOString()}] -> Stack trace:`, err.stack);
});

audioQueue.on('ready', () => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> 🟢 Fila '${audioQueue.name}' pronta para uso`);
});

audioQueue.on('paused', () => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> ⏸️ Fila '${audioQueue.name}' pausada`);
});

audioQueue.on('resumed', () => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> ▶️ Fila '${audioQueue.name}' retomada`);
});

audioQueue.on('cleaned', (jobs, type) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> 🧹 Limpeza: ${jobs.length} jobs '${type}' removidos`);
});

// 🔍 Event listeners para debug ULTRA-DETALHADOS
audioQueue.on('waiting', (job) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> ⌛ Job ${job.id} WAITING | Nome: '${job.name}' | JobID: ${job.data?.jobId} | FileKey: ${job.data?.fileKey}`);
});

audioQueue.on('active', (job) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> ⚡ Job ${job.id} ACTIVE | Nome: '${job.name}' | JobID: ${job.data?.jobId} | FileKey: ${job.data?.fileKey}`);
});

audioQueue.on('completed', (job, result) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> ✅ Job ${job.id} COMPLETED | Nome: '${job.name}' | JobID: ${job.data?.jobId} | Tempo: ${Date.now() - job.timestamp}ms`);
});

audioQueue.on('failed', (job, err) => {
  console.error(`[QUEUE][${new Date().toISOString()}] -> ❌ Job ${job.id} FAILED | Nome: '${job.name}' | JobID: ${job.data?.jobId} | Erro: ${err.message}`);
  console.error(`[QUEUE][${new Date().toISOString()}] -> Stack do erro:`, err.stack);
});

audioQueue.on('stalled', (job) => {
  console.warn(`[QUEUE][${new Date().toISOString()}] -> 🐌 Job ${job.id} STALLED | Nome: '${job.name}' | JobID: ${job.data?.jobId}`);
});

audioQueue.on('progress', (job, progress) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> 📈 Job ${job.id} PROGRESS: ${progress}% | JobID: ${job.data?.jobId}`);
});

audioQueue.on('removed', (job) => {
  console.log(`[QUEUE][${new Date().toISOString()}] -> 🗑️ Job ${job.id} REMOVED | Nome: '${job.name}' | JobID: ${job.data?.jobId}`);
});

// 🏭 Factory para criar workers com configuração ULTRA-OTIMIZADA para Redis
export const createWorker = (
  queueName, 
  processor, 
  concurrency = Number(process.env.WORKER_CONCURRENCY) || 6
) => {
  console.log(`[WORKER-FACTORY][${new Date().toISOString()}] -> 🚀 Worker iniciado com concurrency = ${concurrency} (WORKER_CONCURRENCY=${process.env.WORKER_CONCURRENCY || 'não definida, usando fallback'})`);
  
  const worker = new Worker(queueName, processor, { 
    connection, 
    concurrency,
    settings: {
      // ⏰ DRAMATICALLY INCREASE INTERVALS TO REDUCE REDIS REQUESTS
      stalledInterval: 120000,    // 2 minutos (era 30s) - 4x menos requests de heartbeat
      maxStalledCount: 2,         // Reduzido para 2 (era 3) - menos verificações
      
      // 🔒 LOCK DURATION - Mantém job "locked" por mais tempo, evitando re-checks
      lockDuration: 180000,       // 3 minutos de lock - evita re-acquisition
      
      // 📡 REDUCE KEEP-ALIVE FREQUENCY
      keepAlive: 60000,          // 1 minuto de keep-alive (reduz heartbeats)
      
      // 🚀 BATCH PROCESSING - Pega vários jobs de uma vez
      batchSize: 1,              // Mantém 1 por segurança do pipeline atual
      
      // ⚡ REDUCE POLLING FREQUENCY
      delayedDebounce: 10000,    // 10s delay entre verificações de jobs delayed
    },
    // 🛡️ CONNECTION OPTIMIZATION 
    opts: {
      retryDelayOnFailover: 1000, // 1s delay em failover
      lazyConnect: true          // Conecta apenas quando necessário
    }
  });

  // 🔥 LOGS DE DIAGNÓSTICO ULTRA-DETALHADOS - Worker Events
  worker.on('ready', () => {
    console.log(`[WORKER][${new Date().toISOString()}] -> 🟢 Worker para fila '${queueName}' PRONTO (Concorrência: ${concurrency})`);
  });

  worker.on('error', (err) => {
    console.error(`[WORKER][${new Date().toISOString()}] -> 🚨 ERRO NO WORKER: ${err.message}`);
    console.error(`[WORKER][${new Date().toISOString()}] -> Stack trace:`, err.stack);
  });

  worker.on('active', (job) => {
    console.log(`[WORKER][${new Date().toISOString()}] -> ⚡ PROCESSANDO Job ${job.id} | Nome: '${job.name}' | JobID: ${job.data?.jobId} | FileKey: ${job.data?.fileKey}`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[WORKER][${new Date().toISOString()}] -> ✅ COMPLETADO Job ${job.id} | JobID: ${job.data?.jobId} | Tempo: ${Date.now() - job.timestamp}ms`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[WORKER][${new Date().toISOString()}] -> ❌ FALHOU Job ${job.id} | JobID: ${job.data?.jobId} | Erro: ${err.message}`);
    console.error(`[WORKER][${new Date().toISOString()}] -> Stack do erro:`, err.stack);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[WORKER][${new Date().toISOString()}] -> 📈 PROGRESSO Job ${job.id} | JobID: ${job.data?.jobId} | ${progress}%`);
  });

  worker.on('stalled', (job) => {
    console.warn(`[WORKER][${new Date().toISOString()}] -> 🐌 TRAVADO Job ${job.id} | JobID: ${job.data?.jobId}`);
  });

  worker.on('paused', () => {
    console.log(`[WORKER][${new Date().toISOString()}] -> ⏸️ Worker pausado`);
  });

  worker.on('resumed', () => {
    console.log(`[WORKER][${new Date().toISOString()}] -> ▶️ Worker retomado`);
  });

  worker.on('closing', () => {
    console.log(`[WORKER][${new Date().toISOString()}] -> 🚪 Worker fechando...`);
  });

  worker.on('closed', () => {
    console.log(`[WORKER][${new Date().toISOString()}] -> 🔒 Worker fechado`);
  });

  return worker;
};

// 📊 Função OTIMIZADA para monitorar status da fila - MÍNIMO requests Redis
export const getQueueStats = async () => {
  try {
    // 🚀 ULTRA-OPTIMIZED: Use apenas counts ao invés de arrays completos
    // Isso reduz DRASTICAMENTE o número de requests e dados transferidos
    const [waitingCount, activeCount, completedCount, failedCount] = await Promise.all([
      audioQueue.getWaitingCount(),   // Count only - muito mais eficiente
      audioQueue.getActiveCount(),    // Count only - muito mais eficiente  
      audioQueue.getCompletedCount(), // Count only - muito mais eficiente
      audioQueue.getFailedCount()     // Count only - muito mais eficiente
    ]);

    return {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      total: waitingCount + activeCount + completedCount + failedCount
    };
  } catch (error) {
    console.error('❌ [REDIS] Erro ao obter estatísticas:', error);
    return { error: error.message };
  }
};

// 🧹 Função ULTRA-OTIMIZADA para limpar fila - REDUZ acúmulo e requests
export const clearQueue = async () => {
  try {
    // 🚀 CLEANUP INTELIGENTE: Remove apenas jobs desnecessários
    await Promise.all([
      audioQueue.clean(60000, 10, 'completed'), // Remove completed > 1min, mantém só 10
      audioQueue.clean(300000, 20, 'failed'),   // Remove failed > 5min, mantém só 20
      audioQueue.clean(600000, 0, 'active')     // Remove active órfãos > 10min
    ]);
    console.log('🧹 [REDIS] Limpeza inteligente executada - fila otimizada');
  } catch (error) {
    console.error('❌ [REDIS] Erro na limpeza inteligente:', error);
  }
};

// 🕐 AUTO-CLEANUP: Executa limpeza automática a cada 10 minutos
setInterval(clearQueue, 600000); // 10 minutos

export default connection;