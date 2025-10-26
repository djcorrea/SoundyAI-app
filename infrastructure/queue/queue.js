/**
 * 🎵 AUDIO ANALYSIS QUEUE - BULLMQ IMPLEMENTATION
 * Sistema de fila distribuída para processamento de áudio
 * Configuração específica via REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// 🔑 Carregar configurações PRIMEIRO
dotenv.config();

// 🔧 Configuração Redis usando variáveis específicas
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  tls: {},
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Validar configuração Redis obrigatória
if (!redisConfig.host || !redisConfig.port) {
  console.error('❌ [QUEUE] ERRO: REDIS_HOST e REDIS_PORT são obrigatórios');
  console.error('❌ [QUEUE] Configuração atual:', {
    host: redisConfig.host || 'undefined',
    port: redisConfig.port || 'undefined',
    hasPassword: !!redisConfig.password
  });
  process.exit(1);
}

console.log(`🔧 [QUEUE] Redis configurado: ${redisConfig.host}:${redisConfig.port}`);

// Criar conexão Redis para monitoramento
const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ [QUEUE] Redis conectado com sucesso');
});

redis.on('error', (error) => {
  console.error('❌ [QUEUE] Erro de conexão Redis:', error.message);
});

// Configuração da fila BullMQ
export const audioQueue = new Queue('audio-analysis', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 100,
    removeOnFail: 50,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    delay: 0,
  },
});

// Event listeners para debugging
audioQueue.on('error', (error) => {
  console.error('❌ [QUEUE] Erro na fila:', error);
});

audioQueue.on('waiting', (job) => {
  console.log(`🔄 [QUEUE] Job ${job.id} aguardando processamento`);
});

audioQueue.on('active', (job) => {
  console.log(`⚡ [QUEUE] Job ${job.id} iniciado`);
});

audioQueue.on('completed', (job) => {
  console.log(`✅ [QUEUE] Job ${job.id} concluído`);
});

audioQueue.on('failed', (job, error) => {
  console.error(`❌ [QUEUE] Job ${job.id} falhou:`, error.message);
});

console.log('🎵 [QUEUE] AudioQueue inicializada com BullMQ');

export { redis };
export default audioQueue;