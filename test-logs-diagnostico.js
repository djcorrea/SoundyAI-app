// test-logs-diagnostico.js
// 🔥 TESTE ULTRA-DETALHADO DOS LOGS DE DIAGNÓSTICO IMPLEMENTADOS

import { audioQueue, getQueueStats } from './work/queue/redis.js';
import 'dotenv/config';
import { randomUUID } from 'crypto';

console.log('🔥 [TESTE-LOGS] INICIANDO TESTE ULTRA-DETALHADO DOS LOGS DE DIAGNÓSTICO');
console.log('=' .repeat(80));

// 📋 Função para mostrar todos os tipos de logs implementados
function mostrarTiposLogs() {
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 TIPOS DE LOGS IMPLEMENTADOS:`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> � [CONFIG] - Configuração Redis/Queue (work/queue/redis.js)`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔗 [REDIS] - Eventos de conexão Redis (connect, ready, error, etc)`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> � [QUEUE] - Eventos da fila (waiting, active, completed, failed, stalled)`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🏭 [WORKER-FACTORY] - Criação de workers`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚡ [WORKER] - Eventos do worker BullMQ`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🟡 [PROCESS] - Processamento detalhado de jobs dentro do audioProcessor`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🚀 [BACKEND] - Criação de jobs no backend API`);
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🚨 [FATAL] - Erros críticos globais (uncaughtException, unhandledRejection)`);
  console.log('=' .repeat(80));
}

async function testarLogsDiagnostico() {
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🚀 Iniciando validação ultra-detalhada...`);

  mostrarTiposLogs();

  // 1. Verificar conexão Redis e capturar logs [REDIS]
  try {
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔗 Testando conexão Redis (deve gerar logs [REDIS])...`);
    const stats = await getQueueStats();
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Redis conectado - Stats:`, stats);
  } catch (error) {
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> ❌ ERRO na conexão Redis: ${error.message}`);
    return;
  }

  // 2. Testar enfileiramento (deve gerar logs [QUEUE])
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📥 Testando enfileiramento (deve gerar logs [QUEUE])...`);
  
  try {
    const testJobData = {
      jobId: 'teste-logs-' + Date.now(),
      fileKey: 'test-files/diagnostico-sample.wav',
      mode: 'genre',
      fileName: 'diagnostico-sample.wav'
    };

    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📋 Dados do job:`, JSON.stringify(testJobData, null, 2));
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 Fila de destino: '${audioQueue.name}'`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔧 Host Redis: guided-snapper-23234.upstash.io`);

    const job = await audioQueue.add('analyze', testJobData, {
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });

    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job enfileirado com sucesso!`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 BullMQ ID: ${job.id} | JobID: ${job.data.jobId}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📊 Job Name: '${job.name}' | Queue: '${job.queueName}'`);
    
    // 3. Aguardar e monitorar eventos (deve capturar [QUEUE] events)
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 👀 Monitorando por 15 segundos para capturar eventos...`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚠️  Para processamento completo, certifique-se de que o worker esteja rodando!`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💡 Comando: node work/worker-redis.js`);
    
    let eventsCaptured = {
      waiting: false,
      active: false,
      completed: false,
      failed: false
    };

    // Event listeners para capturar
    const waitingHandler = (capturedJob) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${job.id} -> WAITING`);
        eventsCaptured.waiting = true;
      }
    };

    const activeHandler = (capturedJob) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${job.id} -> ACTIVE`);
        eventsCaptured.active = true;
      }
    };

    const completedHandler = (capturedJob, result) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${job.id} -> COMPLETED`);
        eventsCaptured.completed = true;
      }
    };

    const failedHandler = (capturedJob, err) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${job.id} -> FAILED (${err.message})`);
        eventsCaptured.failed = true;
      }
    };

    const progressHandler = (capturedJob, progress) => {
      if (capturedJob.id === job.id) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🔍 EVENTO CAPTURADO: Job ${job.id} -> PROGRESS ${progress}%`);
      }
    };

    audioQueue.on('waiting', waitingHandler);
    audioQueue.on('active', activeHandler);
    audioQueue.on('completed', completedHandler);
    audioQueue.on('failed', failedHandler);
    audioQueue.on('progress', progressHandler);

    // Monitorar por 15 segundos com stats periódicas
    const startTime = Date.now();
    const monitoringTime = 15000;
    
    while ((Date.now() - startTime) < monitoringTime) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentStats = await getQueueStats();
      const elapsed = Date.now() - startTime;
      
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📊 Stats [${elapsed}ms]: W:${currentStats.waiting} A:${currentStats.active} C:${currentStats.completed} F:${currentStats.failed}`);
      
      // Se job foi processado, sair do loop
      if (eventsCaptured.completed || eventsCaptured.failed) {
        console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚡ Job processado, finalizando monitoramento...`);
        break;
      }
    }

    // Cleanup listeners
    audioQueue.off('waiting', waitingHandler);
    audioQueue.off('active', activeHandler);
    audioQueue.off('completed', completedHandler);
    audioQueue.off('failed', failedHandler);
    audioQueue.off('progress', progressHandler);

    // 4. Relatório de diagnóstico
    console.log('=' .repeat(80));
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📋 RELATÓRIO DE DIAGNÓSTICO:`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Job WAITING capturado: ${eventsCaptured.waiting}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ⚡ Job ACTIVE capturado: ${eventsCaptured.active}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎉 Job COMPLETED capturado: ${eventsCaptured.completed}`);
    console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💥 Job FAILED capturado: ${eventsCaptured.failed}`);

    // Diagnóstico detalhado
    if (eventsCaptured.waiting && eventsCaptured.active && (eventsCaptured.completed || eventsCaptured.failed)) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> � DIAGNÓSTICO: ✅ FLUXO COMPLETO FUNCIONANDO`);
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💡 Worker está pegando e processando jobs corretamente!`);
    } else if (eventsCaptured.waiting && eventsCaptured.active && !eventsCaptured.completed && !eventsCaptured.failed) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 DIAGNÓSTICO: ⚠️ Job está processando (pode demorar)`);
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💡 Worker está ativo, aguarde conclusão...`);
    } else if (eventsCaptured.waiting && !eventsCaptured.active) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 DIAGNÓSTICO: ❌ WORKER NÃO ESTÁ PEGANDO JOBS`);
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💡 Verifique se o worker está rodando: node work/worker-redis.js`);
    } else if (!eventsCaptured.waiting) {
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🎯 DIAGNÓSTICO: ❌ JOBS NÃO ESTÃO ENTRANDO NA FILA`);
      console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 💡 Problema na configuração Redis ou fila`);
    }

  } catch (error) {
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> ❌ ERRO no teste: ${error.message}`);
    console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> Stack trace: ${error.stack}`);
  }

  // 5. Mostrar exemplos de logs implementados
  console.log('=' .repeat(80));
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 📺 EXEMPLOS DE LOGS IMPLEMENTADOS:`);
  console.log('');
  console.log('🔗 [REDIS][TIMESTAMP] -> 🟢 Conectado ao Upstash Redis (Host: guided-snapper-23234.upstash.io:6379)');
  console.log('📋 [QUEUE][TIMESTAMP] -> ⌛ Job 15 WAITING | Nome: \'analyze\' | JobID: abc12345 | FileKey: sample.wav');  
  console.log('🚀 [BACKEND][TIMESTAMP] -> 📥 INICIANDO enfileiramento no Redis...');
  console.log('🏭 [WORKER-FACTORY][TIMESTAMP] -> 🚀 Criando worker para fila \'audio-analyzer\' com concorrência: 5');
  console.log('⚡ [WORKER][TIMESTAMP] -> ⚡ PROCESSANDO Job 15 | JobID: abc12345 | File: sample.wav');
  console.log('🟡 [PROCESS][TIMESTAMP] -> 🟡 INICIANDO job 15 {jobId, fileKey, mode, fileName, timestamp, attempts}');
  console.log('🚨 [FATAL][TIMESTAMP] -> 🚨 UNCAUGHT EXCEPTION: Error message');
  console.log('');
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> 🏁 Teste de logs concluído`);
}

// Executar teste
testarLogsDiagnostico().then(() => {
  console.log(`[TESTE-LOGS][${new Date().toISOString()}] -> ✅ Validação de logs finalizada com sucesso`);
  process.exit(0);
}).catch((err) => {
  console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> 💥 Erro fatal: ${err.message}`);
  console.error(`[TESTE-LOGS][${new Date().toISOString()}] -> Stack: ${err.stack}`);
  process.exit(1);
});