// queue/redis.js
import BullMQ from 'bullmq';
import IORedis from 'ioredis';

const { Queue, Worker } = BullMQ;

// 🔗 Conexão ULTRA-OTIMIZADA com Redis Upstash para MÍNIMO consumo de requests
const connection = new IORedis('rediss://guided-snapper-23234.upstash.io:6379', {
  password: 'AVrCAAIncDJhMDljZDE5MjM5Njk0OGQyYWI2ZTMyNDkwMjVkNmNiMHAyMjMyMzQ',
  tls: {},
  maxRetriesPerRequest: null,  // ✅ Obrigatório para BullMQ
  retryDelayOnFailover: 2000,  // Aumentado para 2s (era 500ms) - menos retries
  lazyConnect: true,
  connectTimeout: 45000,       // Aumentado para 45s - evita reconexões desnecessárias
  commandTimeout: 15000,       // Aumentado para 15s - evita timeouts prematuros
  
  // 🚀 OPTIMIZE CONNECTION POOLING AND REDUCE REQUESTS
  keepAlive: 120000,           // 2 minutos keep-alive - menos pings
  enableReadyCheck: false,     // Desativa ready-check automático
  maxLoadingTimeout: 10000,    // 10s loading timeout
  enableAutoPipelining: true,  // Agrupa commands automaticamente - CRITICAL FOR REDIS OPTIMIZATION
  
  // 🔧 REDUCE CONNECTION OVERHEAD  
  family: 4,                   // Force IPv4 - mais rápido
  dropBufferSupport: true,     // Remove buffer support - menos overhead
  
  // ⏰ BATCH COMMANDS TO REDUCE REQUEST COUNT
  autoResubmit: false,         // Não resubmete commands falhados automaticamente
  enableOfflineQueue: true     // ✅ REATIVADO: Necessário para evitar erros de stream
});

// 🔥 Eventos de conexão para debugging
connection.on('connect', () => {
  console.log('🟢 [REDIS] Conectado ao Upstash Redis');
});

connection.on('error', (err) => {
  console.error('🔴 [REDIS] Erro de conexão:', err.message);
});

connection.on('ready', () => {
  console.log('✅ [REDIS] Conexão pronta para uso');
});

// 📋 Fila principal para análises de áudio - OTIMIZADA PARA REDUZIR REQUESTS REDIS
export const audioQueue = new Queue('audio-analyzer', { 
  connection,
  defaultJobOptions: {
    // 🧼 LIMPEZA AGRESSIVA: Remove jobs assim que processados para economizar Redis
    removeOnComplete: 5,   // Manter apenas 5 jobs concluídos (reduzido de 50)
    removeOnFail: 10,      // Manter apenas 10 jobs falhados (reduzido de 100)
    attempts: 2,           // Reduzido para 2 tentativas (de 3) - menos retries = menos requests
    backoff: {
      type: 'fixed',       // Mudado para 'fixed' - mais previsível que exponential
      delay: 10000         // 10s fixo entre tentativas (era 5s exponential)
    },
    // 🕒 TIMEOUTS OTIMIZADOS
    ttl: 300000,          // TTL de 5 minutos - auto-expire jobs antigos
    delay: 0              // Sem delay - processa imediatamente
  }
});

// 🔍 Event listeners para debug
audioQueue.on('waiting', (job) => {
  console.log(`⌛ [QUEUE] Job waiting: ${job.id} | Nome: ${job.name} | JobID: ${job.data?.jobId}`);
});

audioQueue.on('active', (job) => {
  console.log(`⚡ [QUEUE] Job active: ${job.id} | Nome: ${job.name} | JobID: ${job.data?.jobId}`);
});

audioQueue.on('completed', (job, result) => {
  console.log(`✅ [QUEUE] Job completed: ${job.id} | Nome: ${job.name} | JobID: ${job.data?.jobId}`);
});

audioQueue.on('failed', (job, err) => {
  console.log(`❌ [QUEUE] Job failed: ${job.id} | Nome: ${job.name} | JobID: ${job.data?.jobId} | Erro: ${err.message}`);
});

// 🏭 Factory para criar workers com configuração ULTRA-OTIMIZADA para Redis
export const createWorker = (
  queueName, 
  processor, 
  concurrency = Number(process.env.WORKER_CONCURRENCY) || 5
) => {
  console.log(`🚀 [WORKER] Criando worker '${queueName}' com concorrência: ${concurrency}`);
  
  return new Worker(queueName, processor, { 
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
      maxRetriesPerRequest: 2,   // Menos retries = menos requests
      retryDelayOnFailover: 1000, // 1s delay em failover
      lazyConnect: true          // Conecta apenas quando necessário
    }
  });
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