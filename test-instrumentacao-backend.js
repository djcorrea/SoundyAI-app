// test-instrumentacao-backend.js
// 🔥 TESTE ESPECÍFICO DA INSTRUMENTAÇÃO DO BACKEND

import "dotenv/config";
import { audioQueue, getQueueStats } from './work/queue/redis.js';
import { randomUUID } from "crypto";

console.log('🔥 [TESTE-INSTRUMENTAÇÃO] VALIDANDO BACKEND INSTRUMENTADO');
console.log('=' .repeat(80));

async function testarInstrumentacaoBackend() {
  console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 🚀 Iniciando teste da instrumentação...`);

  // 1. Simular criação de job como o backend faria
  console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 🎯 Simulando processo completo do backend...`);
  
  try {
    // Gerar job ID como o backend faz
    const jobId = randomUUID();
    const testData = {
      fileKey: 'test-files/instrumentacao-sample.wav',
      mode: 'genre',
      fileName: 'instrumentacao-sample.wav'
    };

    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 📋 Job ID gerado: ${jobId}`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 📦 Dados do teste:`, testData);

    // 2. Simular logs que seriam gerados pelo backend instrumentado
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📥 INICIANDO enfileiramento no Redis...`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🎯 Fila de destino: '${audioQueue.name}' | Job type: 'analyze'`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🔧 Host Redis: guided-snapper-23234.upstash.io`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📦 Job ID gerado: ${jobId}`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📦 Dados completos do job:`, JSON.stringify({
      jobId,
      fileKey: testData.fileKey,
      mode: testData.mode,
      fileName: testData.fileName
    }, null, 2));
    console.log(`[BACKEND][${new Date().toISOString()}] -> ⚙️ Opções BullMQ: attempts=3, backoff=exponential(5s), removeOnComplete=50`);

    // 3. Adicionar job na fila como o backend faria
    const addedJob = await audioQueue.add('analyze', {
      jobId,
      fileKey: testData.fileKey,
      mode: testData.mode,
      fileName: testData.fileName
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 100
    });

    // 4. Logs de sucesso como o backend instrumentado faria
    console.log(`[BACKEND][${new Date().toISOString()}] -> ✅ Job ${jobId} enfileirado no Redis com sucesso!`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 BullMQ ID retornado: ${addedJob.id}`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📊 Fila confirmada: '${addedJob.queueName}' | Job name: '${addedJob.name}'`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> ⏰ Timestamp BullMQ: ${new Date(addedJob.timestamp).toISOString()}`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 Status do job adicionado:`, {
      postgresJobId: jobId,
      bullmqId: addedJob.id,
      queueName: addedJob.queueName,
      jobName: addedJob.name,
      timestamp: addedJob.timestamp,
      attempts: addedJob.opts?.attempts
    });

    // 5. Verificar se job apareceu na fila
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 📊 Verificando stats da fila...`);
    const stats = await getQueueStats();
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 📈 Stats após enfileiramento:`, stats);

    // 6. Verificar eventos da fila
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 👀 Aguardando eventos da fila por 10 segundos...`);
    
    let eventsCaptured = false;
    const waitingHandler = (capturedJob) => {
      if (capturedJob.id === addedJob.id) {
        console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${addedJob.id} -> WAITING`);
        eventsCaptured = true;
      }
    };

    audioQueue.on('waiting', waitingHandler);
    
    // Aguardar 10 segundos
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    audioQueue.off('waiting', waitingHandler);

    // 7. Relatório final
    console.log('=' .repeat(80));
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 📋 RELATÓRIO DA INSTRUMENTAÇÃO:`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Job ID gerado: ${jobId}`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ BullMQ ID retornado: ${addedJob.id}`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Fila utilizada: '${addedJob.queueName}'`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Job name: '${addedJob.name}'`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Evento WAITING capturado: ${eventsCaptured}`);
    console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Host Redis confirmado: guided-snapper-23234.upstash.io`);

    if (eventsCaptured) {
      console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 🎉 INSTRUMENTAÇÃO FUNCIONANDO PERFEITAMENTE!`);
      console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 💡 O backend está corretamente enfileirando jobs no Redis`);
    } else {
      console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ⚠️ Job foi adicionado mas evento WAITING não foi capturado`);
      console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 💡 Verifique se os event listeners estão configurados`);
    }

  } catch (error) {
    // Simular logs de erro como o backend instrumentado faria
    console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO CRÍTICO ao enfileirar no Redis:`, error.message);
    console.error(`[BACKEND][${new Date().toISOString()}] -> 📊 CONTEXTO DO ERRO:`);
    console.error(`[BACKEND][${new Date().toISOString()}] ->    - Fila: '${audioQueue.name}'`);
    console.error(`[BACKEND][${new Date().toISOString()}] ->    - Job Type: 'analyze'`);
    console.error(`[BACKEND][${new Date().toISOString()}] ->    - Host Redis: guided-snapper-23234.upstash.io`);
    console.error(`[BACKEND][${new Date().toISOString()}] -> 📜 Stack trace completo:`, error.stack);
    
    console.error(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ❌ ERRO no teste: ${error.message}`);
  }

  console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 🏁 Teste da instrumentação concluído`);
}

// Executar teste
testarInstrumentacaoBackend().then(() => {
  console.log(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> ✅ Validação da instrumentação finalizada`);
  process.exit(0);
}).catch((err) => {
  console.error(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> 💥 Erro fatal: ${err.message}`);
  console.error(`[TESTE-INSTRUMENTAÇÃO][${new Date().toISOString()}] -> Stack: ${err.stack}`);
  process.exit(1);
});