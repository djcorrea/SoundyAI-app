// test-logs-diagnostico.js
// 🔥 TESTE COMPLETO DOS LOGS DE DIAGNÓSTICO IMPLEMENTADOS

import { audioQueue } from './work/queue/redis.js';
import 'dotenv/config';

console.log('🔥 [TESTE-LOGS] INICIANDO TESTE COMPLETO DOS LOGS DE DIAGNÓSTICO');
console.log('=' .repeat(80));

async function testarLogsDiagnostico() {
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🚀 Iniciando validação de logs...`);

  // 1. Verificar conexão Redis
  try {
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔗 Testando conexão Redis...`);
    const stats = await Promise.all([
      audioQueue.getWaitingCount(),
      audioQueue.getActiveCount(),
      audioQueue.getCompletedCount(),
      audioQueue.getFailedCount()
    ]);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Redis conectado - Stats: W:${stats[0]} A:${stats[1]} C:${stats[2]} F:${stats[3]}`);
  } catch (error) {
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> ❌ Erro na conexão Redis: ${error.message}`);
    return;
  }

  // 2. Testar enfileiramento com logs
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📥 Testando enfileiramento com logs detalhados...`);
  
  try {
    const testJobData = {
      jobId: 'teste-logs-' + Date.now(),
      fileKey: 'test-files/diagnostico-sample.wav',
      mode: 'genre',
      fileName: 'diagnostico-sample.wav'
    };

    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📋 Dados do job:`, testJobData);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 Fila de destino: '${audioQueue.name}'`);

    const job = await audioQueue.add('analyze', testJobData, {
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });

    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job enfileirado: BullMQ ID ${job.id} | JobID ${job.data.jobId}`);
    
    // 3. Monitorar por 20 segundos para ver os logs
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 👀 Monitorando logs por 20 segundos...`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚠️  CERTIFIQUE-SE DE QUE O WORKER ESTEJA RODANDO!`);
    
    let monitoring = true;
    let eventsCaptured = {
      waiting: false,
      active: false,
      completed: false,
      failed: false
    };

    // Event listeners para capturar logs
    const waitingHandler = (capturedJob) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 CAPTURED: Job WAITING event`);
        eventsCaptured.waiting = true;
      }
    };

    const activeHandler = (capturedJob) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 CAPTURED: Job ACTIVE event`);
        eventsCaptured.active = true;
      }
    };

    const completedHandler = (capturedJob, result) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 CAPTURED: Job COMPLETED event`);
        eventsCaptured.completed = true;
        monitoring = false;
      }
    };

    const failedHandler = (capturedJob, err) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 CAPTURED: Job FAILED event - ${err.message}`);
        eventsCaptured.failed = true;
        monitoring = false;
      }
    };

    audioQueue.on('waiting', waitingHandler);
    audioQueue.on('active', activeHandler);
    audioQueue.on('completed', completedHandler);
    audioQueue.on('failed', failedHandler);

    // Monitorar por 20 segundos
    const startTime = Date.now();
    while (monitoring && (Date.now() - startTime) < 20000) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentStats = await Promise.all([
        audioQueue.getWaitingCount(),
        audioQueue.getActiveCount(),
        audioQueue.getCompletedCount(),
        audioQueue.getFailedCount()
      ]);
      
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📊 Stats atuais: W:${currentStats[0]} A:${currentStats[1]} C:${currentStats[2]} F:${currentStats[3]} | Elapsed: ${Date.now() - startTime}ms`);
    }

    // Cleanup listeners
    audioQueue.off('waiting', waitingHandler);
    audioQueue.off('active', activeHandler);
    audioQueue.off('completed', completedHandler);
    audioQueue.off('failed', failedHandler);

    // 4. Relatório final
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📋 RELATÓRIO FINAL:`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job WAITING captured: ${eventsCaptured.waiting}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job ACTIVE captured: ${eventsCaptured.active}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job COMPLETED captured: ${eventsCaptured.completed}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job FAILED captured: ${eventsCaptured.failed}`);

    if (eventsCaptured.waiting && eventsCaptured.active) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎉 DIAGNÓSTICO: Integração funcional - Worker está processando jobs!`);
    } else if (eventsCaptured.waiting && !eventsCaptured.active) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚠️  DIAGNÓSTICO: Worker não está pegando jobs da fila`);
    } else if (!eventsCaptured.waiting) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ❌ DIAGNÓSTICO: Jobs não estão entrando na fila`);
    }

  } catch (error) {
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> ❌ Erro no teste: ${error.message}`);
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> Stack trace: ${error.stack}`);
  }

  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🏁 Teste de logs concluído`);
}

// 5. Demonstrar formato dos logs implementados
console.log('\n🎯 [TESTE-LOGS] FORMATO DOS LOGS IMPLEMENTADOS:');
console.log('=====================================');
console.log('[REDIS][TIMESTAMP] -> 🟢 Conectado ao Redis...');
console.log('[QUEUE][TIMESTAMP] -> ⌛ Job WAITING...');  
console.log('[BACKEND][TIMESTAMP] -> 📥 Job criado na fila...');
console.log('[WORKER][TIMESTAMP] -> ⚡ Job PROCESSANDO...');
console.log('[WORKER-REDIS][TIMESTAMP] -> ✅ Job COMPLETADO...');
console.log('=====================================\n');

// Executar teste
testarLogsDiagnostico().then(() => {
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Teste finalizado com sucesso`);
  process.exit(0);
}).catch((err) => {
  console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> 💥 Erro fatal: ${err}`);
  process.exit(1);
});