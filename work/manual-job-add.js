// manual-job-add.js - ADICIONAR JOB DE TESTE MANUAL
// 🚀 Adiciona job de teste para verificar se Worker processa

import "dotenv/config";
import { Queue } from 'bullmq';
import { getRedisConnection, testRedisConnection } from './lib/redis-connection.js';
import { randomUUID } from "crypto";

console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🚀 ADICIONANDO JOB DE TESTE MANUAL...`);

async function addTestJob() {
  try {
    // 🔗 Teste de conexão
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 📋 PASSO 1: Testando conexão Redis...`);
    const connectionTest = await testRedisConnection();
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🔍 Connection Test:`, connectionTest);
    
    if (connectionTest.status !== 'healthy') {
      throw new Error('Conexão Redis não está saudável!');
    }
    
    // 📋 Criar queue
    const redis = getRedisConnection();
    const audioQueue = new Queue('audio-analyzer', { connection: redis });
    
    // ✅ CORRIGIDO: Aguardar queue ficar pronta
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ⏳ Aguardando queue ficar pronta...`);
    await audioQueue.waitUntilReady();
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ✅ Queue está pronta!`);
    
    // ▶️ Garantir que não está pausada
    await audioQueue.resume();
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ▶️ Queue resumed`);
    
    // 📊 Status antes de adicionar
    const countsBefor = await audioQueue.getJobCounts();
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 📊 Queue counts ANTES:`, countsBefor);
    
    // 🎯 Dados do job de teste
    const jobId = randomUUID();
    const testData = {
      jobId: jobId,
      fileKey: 'test-files/sample-audio.wav',
      fileName: 'sample-audio.wav',
      mode: 'mastering'
    };
    
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 📋 PASSO 2: Adicionando job de teste...`);
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🎯 Job Data:`, testData);
    
    // 🟥🟥 AUDITORIA: QUEM ESTÁ CRIANDO O JOB
    console.log("🟥🟥 [AUDIT:JOB-CREATOR] Este arquivo está CRIANDO um job AGORA:");
    console.log("🟥 [AUDIT:JOB-CREATOR] Arquivo:", import.meta.url);
    console.log("🟥 [AUDIT:JOB-CREATOR] Payload enviado para a fila:");
    console.dir(testData, { depth: 10 });
    
    // ✅ Adicionar job com mesmo formato que a API
    const redisJob = await audioQueue.add('process-audio', testData, {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      priority: 1,
      jobId: `manual-test-${jobId}-${Date.now()}`
    });
    
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ✅ Job adicionado com sucesso!`);
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🆔 Redis Job ID: ${redisJob.id}`);
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🏷️ Job Name: ${redisJob.name}`);
    
    // 📊 Status depois de adicionar
    const countsAfter = await audioQueue.getJobCounts();
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 📊 Queue counts DEPOIS:`, countsAfter);
    
    // 🕐 Aguardar alguns segundos para ver se é processado
    console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ⏳ Aguardando 10 segundos para verificar processamento...`);
    
    setTimeout(async () => {
      try {
        const finalCounts = await audioQueue.getJobCounts();
        console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 📊 Queue counts FINAL:`, finalCounts);
        
        // Verificar se job foi processado
        if (finalCounts.waiting < countsAfter.waiting) {
          console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ✅ Job foi PROCESSADO! (waiting diminuiu)`);
        } else if (finalCounts.active > 0) {
          console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> 🔵 Job está ATIVO! (sendo processado)`);
        } else {
          console.log(`[MANUAL-JOB][${new Date().toISOString()}] -> ⚠️ Job NÃO foi processado (ainda waiting)`);
        }
        
        process.exit(0);
      } catch (err) {
        console.error(`[MANUAL-JOB][${new Date().toISOString()}] -> 🚨 Erro na verificação final:`, err);
        process.exit(1);
      }
    }, 10000);
    
  } catch (error) {
    console.error(`[MANUAL-JOB][${new Date().toISOString()}] -> 🚨 ERRO:`, error);
    process.exit(1);
  }
}

// Executar teste
addTestJob();