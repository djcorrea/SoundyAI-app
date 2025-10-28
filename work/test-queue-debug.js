// test-queue-debug.js - SCRIPT DE DEBUG COMPLETO DA FILA
// 🔍 Lista jobs waiting, verifica conexão e status da fila

import "dotenv/config";
import { Queue } from 'bullmq';
import { getRedisConnection, testRedisConnection, getConnectionMetadata } from './lib/redis-connection.js';

console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 🔍 INICIANDO DEBUG COMPLETO DA FILA...`);

async function debugQueue() {
  try {
    // 🔗 Teste de conexão
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 1: Testando conexão Redis...`);
    const connectionTest = await testRedisConnection();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 🔍 Connection Test:`, connectionTest);
    
    // 🔗 Metadata da conexão
    const metadata = getConnectionMetadata();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📊 Connection Metadata:`, metadata);
    
    // 📋 Criar queue para debug
    const redis = getRedisConnection();
    const audioQueue = new Queue('audio-analyzer', { connection: redis });
    
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 2: Analisando fila 'audio-analyzer'...`);
    
    // 🔢 Contar jobs por status
    const jobCounts = await audioQueue.getJobCounts();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📊 Job Counts:`, jobCounts);
    
    // 📝 Listar jobs waiting
    if (jobCounts.waiting > 0) {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 3: Listando ${jobCounts.waiting} jobs WAITING...`);
      const waitingJobs = await audioQueue.getWaiting(0, 10);
      waitingJobs.forEach((job, index) => {
        console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] ->   ${index + 1}. Job ID: ${job.id} | Name: ${job.name} | Data:`, job.data);
      });
    } else {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ✅ Nenhum job WAITING na fila`);
    }
    
    // 📝 Listar jobs active
    if (jobCounts.active > 0) {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 4: Listando ${jobCounts.active} jobs ACTIVE...`);
      const activeJobs = await audioQueue.getActive(0, 10);
      activeJobs.forEach((job, index) => {
        console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] ->   ${index + 1}. Job ID: ${job.id} | Name: ${job.name} | Data:`, job.data);
      });
    } else {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ⚠️ Nenhum job ACTIVE na fila`);
    }
    
    // 📝 Listar jobs completed (últimos 5)
    if (jobCounts.completed > 0) {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 5: Listando últimos 5 jobs COMPLETED...`);
      const completedJobs = await audioQueue.getCompleted(0, 5);
      completedJobs.forEach((job, index) => {
        console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] ->   ${index + 1}. Job ID: ${job.id} | Name: ${job.name} | Finished: ${new Date(job.finishedOn).toISOString()}`);
      });
    }
    
    // 📝 Listar jobs failed (últimos 5)
    if (jobCounts.failed > 0) {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 6: Listando últimos 5 jobs FAILED...`);
      const failedJobs = await audioQueue.getFailed(0, 5);
      failedJobs.forEach((job, index) => {
        console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] ->   ${index + 1}. Job ID: ${job.id} | Name: ${job.name} | Error: ${job.failedReason}`);
      });
    }
    
    // 🔍 Verificar se a fila está pausada
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 7: Verificando status da fila...`);
    
    // ✅ CORRIGIDO: Aguardar queue ficar pronta
    await audioQueue.waitUntilReady();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ✅ Queue está pronta`);
    
    const isPaused = await audioQueue.isPaused();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 🔍 Queue Status - Pausada: ${isPaused}`);
    
    if (isPaused) {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ⚠️ FILA ESTÁ PAUSADA! Executando resume...`);
      await audioQueue.resume();
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ▶️ Queue resumed com sucesso`);
    }
    
    // 🔑 Verificar chaves Redis relacionadas à fila
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 8: Verificando chaves Redis...`);
    const keys = await redis.keys('bull:audio-analyzer:*');
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 🔑 Encontradas ${keys.length} chaves BullMQ:`, keys);
    
    // 🎯 Verificar workers conectados
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 📋 PASSO 9: Verificando workers...`);
    const workers = await audioQueue.getWorkers();
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 👷 Workers conectados: ${workers.length}`);
    workers.forEach((worker, index) => {
      console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] ->   ${index + 1}. Worker: ${worker.id} | Status: ${worker.addr}`);
    });
    
    console.log(`[QUEUE-DEBUG][${new Date().toISOString()}] -> ✅ DEBUG COMPLETO FINALIZADO!`);
    
  } catch (error) {
    console.error(`[QUEUE-DEBUG][${new Date().toISOString()}] -> 🚨 ERRO NO DEBUG:`, error);
  } finally {
    process.exit(0);
  }
}

// Executar debug
debugQueue();