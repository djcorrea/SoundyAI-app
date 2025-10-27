// test-integracao-bullmq.js
// 🔥 AUDITORIA COMPLETA DA INTEGRAÇÃO BULLMQ API ↔ WORKER

import { audioQueue } from './work/queue/redis.js';
import 'dotenv/config';

console.log('🧪 [AUDIT] INICIANDO AUDITORIA COMPLETA DA INTEGRAÇÃO BULLMQ/REDIS');
console.log('=' .repeat(80));

// 🔍 STEP 1: Verificar configuração Redis
console.log('🔍 STEP 1: VERIFICANDO CONFIGURAÇÃO REDIS');
console.log('Redis Queue Name:', audioQueue.name);
console.log('Redis Connection:', audioQueue.opts.connection.options);

// 🔍 STEP 2: Teste de conexão
async function testRedisConnection() {
  try {
    console.log('🔗 [AUDIT] Testando conexão Redis...');
    // Testar conexão com o Redis usando getWaitingCount (método simples)
    await audioQueue.getWaitingCount();
    console.log('✅ [AUDIT] Redis conectado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ [AUDIT] Erro na conexão Redis:', error.message);
    return false;
  }
}

// 🔍 STEP 3: Verificar stats da fila
async function checkQueueStats() {
  try {
    console.log('📊 [AUDIT] Verificando stats da fila...');
    
    const [waiting, active, completed, failed] = await Promise.all([
      audioQueue.getWaitingCount(),
      audioQueue.getActiveCount(), 
      audioQueue.getCompletedCount(),
      audioQueue.getFailedCount()
    ]);

    console.log(`📈 [AUDIT] FILA STATS:`);
    console.log(`   - Aguardando: ${waiting}`);
    console.log(`   - Ativas: ${active}`);
    console.log(`   - Completas: ${completed}`);
    console.log(`   - Falhadas: ${failed}`);
    console.log(`   - Total: ${waiting + active + completed + failed}`);

    return { waiting, active, completed, failed };
  } catch (error) {
    console.error('❌ [AUDIT] Erro ao obter stats:', error.message);
    return null;
  }
}

// 🔍 STEP 4: Teste de enfileiramento
async function testJobEnqueue() {
  try {
    console.log('📥 [AUDIT] Testando enfileiramento de job...');
    
    const testJobData = {
      jobId: 'audit-test-' + Date.now(),
      fileKey: 'test-files/audit-sample.wav',
      mode: 'genre',
      fileName: 'audit-sample.wav'
    };

    console.log('📋 [AUDIT] Dados do job teste:', testJobData);
    
    // Adicionar job na fila
    const job = await audioQueue.add('analyze', testJobData, {
      attempts: 1, // Apenas 1 tentativa para teste
      removeOnComplete: 1,
      removeOnFail: 1
    });

    console.log('✅ [AUDIT] Job enfileirado com sucesso!');
    console.log(`   - Job ID: ${job.id}`);
    console.log(`   - Job Name: ${job.name}`);
    console.log(`   - JobID Interno: ${job.data.jobId}`);

    return job;
  } catch (error) {
    console.error('❌ [AUDIT] Erro ao enfileirar job:', error.message);
    return null;
  }
}

// 🔍 STEP 5: Monitorar processamento por 30 segundos
async function monitorProcessing(testJob) {
  if (!testJob) {
    console.log('⚠️ [AUDIT] Não há job para monitorar');
    return;
  }

  console.log('👀 [AUDIT] Monitorando processamento por 30 segundos...');
  
  let monitoring = true;
  let foundActive = false;
  let foundCompleted = false;
  let foundFailed = false;

  // Event listeners para debug
  audioQueue.on('waiting', (job) => {
    if (job.id === testJob.id) {
      console.log(`⌛ [AUDIT] JOB WAITING: ${job.id} | ${job.data.jobId}`);
    }
  });

  audioQueue.on('active', (job) => {
    if (job.id === testJob.id) {
      console.log(`⚡ [AUDIT] JOB ATIVO: ${job.id} | ${job.data.jobId}`);
      foundActive = true;
    }
  });

  audioQueue.on('completed', (job, result) => {
    if (job.id === testJob.id) {
      console.log(`✅ [AUDIT] JOB COMPLETO: ${job.id} | ${job.data.jobId}`);
      foundCompleted = true;
      monitoring = false;
    }
  });

  audioQueue.on('failed', (job, err) => {
    if (job.id === testJob.id) {
      console.log(`❌ [AUDIT] JOB FALHOU: ${job.id} | ${job.data.jobId} | Erro: ${err.message}`);
      foundFailed = true;
      monitoring = false;
    }
  });

  // Monitorar por 30 segundos
  const startTime = Date.now();
  while (monitoring && (Date.now() - startTime) < 30000) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar stats a cada 2 segundos
    const stats = await checkQueueStats();
    if (stats && stats.active > 0) {
      console.log(`🔄 [AUDIT] Worker processando... (${stats.active} ativas)`);
    }
  }

  // Timeout
  if (monitoring) {
    console.log('⏰ [AUDIT] Timeout de 30 segundos atingido');
    monitoring = false;
  }

  return {
    foundActive,
    foundCompleted, 
    foundFailed
  };
}

// 🔍 STEP 6: Diagnóstico final
function generateDiagnosis(redisOk, stats, jobEnqueued, monitorResults) {
  console.log('\n🏁 [AUDIT] DIAGNÓSTICO FINAL');
  console.log('=' .repeat(50));

  // Redis Connection
  if (redisOk) {
    console.log('✅ Conexão Redis: FUNCIONAL');
  } else {
    console.log('❌ Conexão Redis: FALHA');
    return 'REDIS_CONNECTION_FAILED';
  }

  // Job Enqueuing
  if (jobEnqueued) {
    console.log('✅ Enfileiramento: FUNCIONAL');
  } else {
    console.log('❌ Enfileiramento: FALHA');
    return 'ENQUEUE_FAILED';
  }

  // Worker Processing
  if (monitorResults.foundActive) {
    console.log('✅ Worker Pickup: FUNCIONAL');
  } else {
    console.log('❌ Worker Pickup: FALHA');
    return 'WORKER_NOT_PICKING_UP';
  }

  if (monitorResults.foundCompleted) {
    console.log('✅ Processamento Completo: FUNCIONAL');
    return 'INTEGRATION_FULLY_FUNCTIONAL';
  } else if (monitorResults.foundFailed) {
    console.log('⚠️ Processamento: FALHA ESPERADA (arquivo teste)');
    return 'INTEGRATION_FUNCTIONAL_TEST_FILE_MISSING';
  } else {
    console.log('⚠️ Processamento: EM ANDAMENTO/TIMEOUT');
    return 'PROCESSING_TIMEOUT_OR_IN_PROGRESS';
  }
}

// 🚀 EXECUTAR AUDITORIA COMPLETA
async function runCompleteAudit() {
  try {
    console.log('🚀 [AUDIT] EXECUTANDO AUDITORIA COMPLETA...\n');

    // Step 1: Conexão Redis
    const redisOk = await testRedisConnection();
    if (!redisOk) {
      console.log('🚨 [AUDIT] CRÍTICO: Redis não conectado - encerrando auditoria');
      process.exit(1);
    }

    // Step 2: Stats iniciais
    console.log('\n📊 [AUDIT] Stats iniciais da fila:');
    const initialStats = await checkQueueStats();

    // Step 3: Enfileirar job teste
    console.log('\n📥 [AUDIT] Testando enfileiramento:');
    const testJob = await testJobEnqueue();

    // Step 4: Stats após enfileiramento
    console.log('\n📊 [AUDIT] Stats após enfileiramento:');
    await checkQueueStats();

    // Step 5: Monitorar processamento
    console.log('\n👀 [AUDIT] Monitorando processamento:');
    const monitorResults = await monitorProcessing(testJob);

    // Step 6: Diagnóstico final
    const diagnosis = generateDiagnosis(redisOk, initialStats, !!testJob, monitorResults);
    
    console.log('\n🎯 [AUDIT] RESULTADO:', diagnosis);
    
    // Limpar eventos
    audioQueue.removeAllListeners();
    
    console.log('\n✅ [AUDIT] Auditoria completa finalizada');
    process.exit(0);

  } catch (error) {
    console.error('\n🚨 [AUDIT] ERRO CRÍTICO na auditoria:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar
runCompleteAudit();