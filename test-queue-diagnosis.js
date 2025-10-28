/**
 * 🔍 DIAGNÓSTICO COMPLETO DO SISTEMA DE FILAS
 * Script de teste abrangente para identificar problemas no fluxo Redis/BullMQ
 */

import dotenv from 'dotenv';
dotenv.config();

import { getQueueReadyPromise, getRedisConnection, getAudioQueue } from './work/lib/queue.js';

/**
 * 🧪 TESTE 1: Verificar consistência da configuração Redis
 */
async function testRedisConfiguration() {
  console.log('\n🔍 === TESTE 1: CONFIGURAÇÃO REDIS ===');
  
  try {
    const { connection } = await getQueueReadyPromise();
    
    // Verificar informações da conexão
    const clientId = await connection.client('id');
    const ping = await connection.ping();
    const dbSize = await connection.dbsize();
    const info = await connection.info('server');
    const redisVersion = info.match(/redis_version:([\d.]+)/)?.[1] || 'unknown';
    
    console.log(`✅ Conexão Redis funcional:`);
    console.log(`   - Client ID: ${clientId}`);
    console.log(`   - Ping: ${ping}`);
    console.log(`   - DB Size: ${dbSize}`);
    console.log(`   - Redis Version: ${redisVersion}`);
    console.log(`   - URL Hash: ${process.env.REDIS_URL ? 'configurado' : 'NÃO CONFIGURADO'}`);
    
    return { success: true, clientId, dbSize, redisVersion };
    
  } catch (error) {
    console.error(`❌ Erro na configuração Redis: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 🧪 TESTE 2: Verificar estado da fila audio-analyzer
 */
async function testQueueState() {
  console.log('\n🔍 === TESTE 2: ESTADO DA FILA ===');
  
  try {
    const queue = getAudioQueue();
    
    // Verificar contadores de jobs
    const jobCounts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();
    const workers = await queue.getWorkers();
    
    console.log(`✅ Estado da fila 'audio-analyzer':`);
    console.log(`   - Pausada: ${isPaused}`);
    console.log(`   - Workers ativos: ${workers.length}`);
    console.log(`   - Jobs:`);
    console.log(`     * Waiting: ${jobCounts.waiting}`);
    console.log(`     * Active: ${jobCounts.active}`);
    console.log(`     * Completed: ${jobCounts.completed}`);
    console.log(`     * Failed: ${jobCounts.failed}`);
    console.log(`     * Delayed: ${jobCounts.delayed}`);
    console.log(`     * Paused: ${jobCounts.paused}`);
    
    // ⚠️ DIAGNÓSTICO CRÍTICO: Se failed > 0, há jobs corrompidos
    if (jobCounts.failed > 0) {
      console.warn(`🚨 PROBLEMA DETECTADO: ${jobCounts.failed} job(s) falharam!`);
      
      // Listar jobs falhados
      const failedJobs = await queue.getFailed(0, 10);
      console.log(`🔍 Jobs falhados (últimos 10):`);
      
      for (const job of failedJobs) {
        console.log(`   - Job ID: ${job.id}`);
        console.log(`     * Name: ${job.name}`);
        console.log(`     * Data: ${JSON.stringify(job.data)}`);
        console.log(`     * Failed Reason: ${job.failedReason}`);
        console.log(`     * Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
        console.log(`     * Created: ${new Date(job.timestamp).toISOString()}`);
      }
    }
    
    return { success: true, jobCounts, isPaused, workers: workers.length, failedJobs: jobCounts.failed };
    
  } catch (error) {
    console.error(`❌ Erro ao verificar estado da fila: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 🧪 TESTE 3: Simular enfileiramento de job
 */
async function testJobEnqueue() {
  console.log('\n🔍 === TESTE 3: ENFILEIRAMENTO DE JOB ===');
  
  try {
    const queue = getAudioQueue();
    const testJobId = `test-${Date.now()}`;
    
    console.log(`📩 Criando job de teste: ${testJobId}`);
    
    // Criar job de teste (SEM try/catch para detectar erros silenciosos)
    const job = await queue.add('process-audio', {
      jobId: testJobId,
      fileKey: 'test/fake-file.wav',
      fileName: 'test-audio.wav',
      mode: 'test'
    }, {
      jobId: `audio-test-${testJobId}`,
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`✅ Job criado com sucesso:`);
    console.log(`   - Redis Job ID: ${job.id}`);
    console.log(`   - Job Name: ${job.name}`);
    console.log(`   - Data: ${JSON.stringify(job.data)}`);
    
    // Verificar se job está na fila
    const jobInQueue = await queue.getJob(job.id);
    console.log(`✅ Job encontrado na fila: ${jobInQueue ? 'SIM' : 'NÃO'}`);
    
    // Remover job de teste imediatamente
    await job.remove();
    console.log(`🗑️ Job de teste removido`);
    
    return { success: true, jobId: job.id, jobName: job.name };
    
  } catch (error) {
    console.error(`❌ ERRO SILENCIOSO DETECTADO no enfileiramento: ${error.message}`);
    console.error(`💥 Stack trace:`, error.stack);
    return { success: false, error: error.message, stack: error.stack };
  }
}

/**
 * 🧪 TESTE 4: Verificar worker listening
 */
async function testWorkerListening() {
  console.log('\n🔍 === TESTE 4: WORKER LISTENING ===');
  
  try {
    const queue = getAudioQueue();
    
    // Verificar workers conectados
    const workers = await queue.getWorkers();
    console.log(`✅ Workers conectados à fila: ${workers.length}`);
    
    if (workers.length === 0) {
      console.warn(`🚨 PROBLEMA: Nenhum worker conectado à fila 'audio-analyzer'!`);
      console.warn(`💡 Solução: Iniciar o worker com: cd work && node worker-redis.js`);
    } else {
      console.log(`✅ Workers detectados:`);
      workers.forEach((worker, index) => {
        console.log(`   Worker ${index + 1}: ${worker.name || 'unnamed'}`);
      });
    }
    
    return { success: true, workersCount: workers.length, workers };
    
  } catch (error) {
    console.error(`❌ Erro ao verificar workers: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 🧪 TESTE 5: Limpeza de jobs corrompidos
 */
async function cleanCorruptedJobs() {
  console.log('\n🔍 === TESTE 5: LIMPEZA DE JOBS CORROMPIDOS ===');
  
  try {
    const queue = getAudioQueue();
    
    // Limpar jobs falhados
    const failedJobs = await queue.getFailed();
    console.log(`🗑️ Limpando ${failedJobs.length} job(s) falhado(s)...`);
    
    for (const job of failedJobs) {
      await job.remove();
      console.log(`   ✅ Removido job falhado: ${job.id}`);
    }
    
    // Limpar jobs travados (stalled)
    await queue.clean(0, 'stalled');
    console.log(`🗑️ Jobs travados limpos`);
    
    // Limpar jobs antigos
    await queue.clean(24 * 60 * 60 * 1000, 'completed'); // 24h
    await queue.clean(24 * 60 * 60 * 1000, 'failed');    // 24h
    console.log(`🗑️ Jobs antigos limpos (>24h)`);
    
    // Verificar estado após limpeza
    const newJobCounts = await queue.getJobCounts();
    console.log(`✅ Estado após limpeza:`);
    console.log(`   - Waiting: ${newJobCounts.waiting}`);
    console.log(`   - Active: ${newJobCounts.active}`);
    console.log(`   - Failed: ${newJobCounts.failed}`);
    
    return { success: true, cleaned: failedJobs.length, newCounts: newJobCounts };
    
  } catch (error) {
    console.error(`❌ Erro na limpeza: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 🚀 EXECUTAR DIAGNÓSTICO COMPLETO
 */
async function runFullDiagnosis() {
  console.log('🔍 INICIANDO DIAGNÓSTICO COMPLETO DO SISTEMA DE FILAS');
  console.log('================================================================');
  
  const results = {};
  
  try {
    // Teste 1: Configuração Redis
    results.redis = await testRedisConfiguration();
    
    // Teste 2: Estado da fila
    results.queue = await testQueueState();
    
    // Teste 3: Enfileiramento
    results.enqueue = await testJobEnqueue();
    
    // Teste 4: Worker listening
    results.worker = await testWorkerListening();
    
    // Teste 5: Limpeza (só se necessário)
    if (results.queue.failedJobs > 0) {
      console.log('\n⚠️ Jobs falhados detectados - executando limpeza...');
      results.cleanup = await cleanCorruptedJobs();
    }
    
  } catch (error) {
    console.error(`💥 Erro fatal no diagnóstico: ${error.message}`);
    results.fatal = { error: error.message, stack: error.stack };
  }
  
  // 📊 RELATÓRIO FINAL
  console.log('\n📊 === RELATÓRIO FINAL DO DIAGNÓSTICO ===');
  console.log('================================================================');
  
  console.log(`✅ Redis: ${results.redis?.success ? 'OK' : '❌ FALHA'}`);
  console.log(`✅ Fila: ${results.queue?.success ? 'OK' : '❌ FALHA'}`);
  console.log(`✅ Enfileiramento: ${results.enqueue?.success ? 'OK' : '❌ FALHA'}`);
  console.log(`✅ Worker: ${results.worker?.success ? 'OK' : '❌ FALHA'}`);
  
  if (results.cleanup) {
    console.log(`✅ Limpeza: ${results.cleanup?.success ? 'OK' : '❌ FALHA'}`);
  }
  
  // 🎯 VEREDITO
  const allTestsPassed = Object.values(results).every(test => test?.success !== false);
  
  if (allTestsPassed) {
    console.log('\n🎉 SISTEMA OPERACIONAL - Todos os testes passaram!');
  } else {
    console.log('\n🚨 PROBLEMAS DETECTADOS - Verifique os erros acima');
  }
  
  return results;
}

// Executar diagnóstico
runFullDiagnosis()
  .then(() => {
    console.log('\n✅ Diagnóstico concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });