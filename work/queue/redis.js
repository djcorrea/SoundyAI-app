// queue/redis.js
import BullMQ from 'bullmq';
import IORedis from 'ioredis';

const { Queue, Worker } = BullMQ;

// 🔗 Conexão com Redis Upstash usando credenciais fornecidas
const connection = new IORedis('rediss://guided-snapper-23234.upstash.io:6379', {
  password: 'AVrCAAIncDJhMDljZDE5MjM5Njk0OGQyYWI2ZTMyNDkwMjVkNmNiMHAyMjMyMzQ',
  tls: {},
  maxRetriesPerRequest: null,  // ✅ Obrigatório para BullMQ
  retryDelayOnFailover: 500,
  lazyConnect: true,
  connectTimeout: 30000,
  commandTimeout: 10000
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

// 📋 Fila principal para análises de áudio
export const audioQueue = new Queue('audio-analyzer', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,  // Manter apenas 50 jobs concluídos
    removeOnFail: 100,     // Manter 100 jobs falhados para debug
    attempts: 3,           // 3 tentativas máximas
    backoff: {
      type: 'exponential',
      delay: 5000          // 5s, 10s, 20s entre tentativas
    }
  }
});

// 🏭 Factory para criar workers com configuração padrão
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
      stalledInterval: 30000,  // 30s para detectar jobs travados
      maxStalledCount: 3       // 3 tentativas antes de marcar como falhado
    }
  });
};

// 📊 Função para monitorar status da fila
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      audioQueue.getWaiting(),
      audioQueue.getActive(),
      audioQueue.getCompleted(),
      audioQueue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  } catch (error) {
    console.error('❌ [REDIS] Erro ao obter estatísticas:', error);
    return { error: error.message };
  }
};

// 🧹 Função para limpar fila (útil para desenvolvimento)
export const clearQueue = async () => {
  try {
    await audioQueue.obliterate({ force: true });
    console.log('🧹 [REDIS] Fila limpa com sucesso');
  } catch (error) {
    console.error('❌ [REDIS] Erro ao limpar fila:', error);
  }
};

export default connection;