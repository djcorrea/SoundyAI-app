/**
 * 🧪 TESTE FASE 1 - BULLMQ QUEUE SYSTEM
 * Teste automatizado do sistema de filas
 */

import { audioQueue } from '../infrastructure/queue/queue.js';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const TEST_JOBS = [
  { fileKey: 'test-audio-1.wav', mode: 'genre', fileName: 'Teste 1' },
  { fileKey: 'test-audio-2.mp3', mode: 'genre', fileName: 'Teste 2' },
  { fileKey: 'test-audio-3.flac', mode: 'reference', fileName: 'Teste 3' },
  { fileKey: 'https://cdn.exemplo.com/audio4.wav', mode: 'genre', fileName: 'Teste 4' },
  { fileKey: 'test-audio-5.wav', mode: 'genre', fileName: 'Teste 5' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createJob(jobData) {
  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${result.message}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Erro ao criar job:`, error.message);
    return null;
  }
}

async function checkJobStatus(jobId) {
  try {
    const response = await fetch(`${API_BASE}/api/analyze/${jobId}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${result.message}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Erro ao consultar job ${jobId}:`, error.message);
    return null;
  }
}

async function waitForCompletion(jobId, maxWaitTime = 300000) { // 5 minutos
  const startTime = Date.now();
  const checkInterval = 2000; // 2 segundos
  
  console.log(`⏳ Aguardando conclusão do job ${jobId}...`);
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkJobStatus(jobId);
    
    if (!status) {
      break;
    }

    console.log(`🔄 Job ${jobId}: ${status.state} ${status.progress ? `(${status.progress}%)` : ''}`);
    
    if (status.state === 'completed') {
      console.log(`✅ Job ${jobId} concluído!`);
      return status;
    }
    
    if (status.state === 'failed') {
      console.log(`❌ Job ${jobId} falhou: ${status.reason}`);
      return status;
    }
    
    await sleep(checkInterval);
  }
  
  console.log(`⏰ Timeout aguardando job ${jobId}`);
  return null;
}

async function testQueueSystem() {
  console.log('🧪 ===== TESTE DO SISTEMA DE FILAS - FASE 1 =====\n');
  
  // Verificar conexão com a fila
  try {
    await audioQueue.getJobs();
    console.log('✅ Conexão com fila BullMQ: OK\n');
  } catch (error) {
    console.error('❌ Erro de conexão com fila:', error.message);
    return;
  }

  const results = [];
  
  // Criar todos os jobs
  console.log('📤 Criando jobs de teste...');
  for (let i = 0; i < TEST_JOBS.length; i++) {
    const jobData = TEST_JOBS[i];
    console.log(`   ${i + 1}. Criando job: ${jobData.fileName}`);
    
    const result = await createJob(jobData);
    if (result) {
      results.push({
        index: i + 1,
        jobId: result.jobId,
        data: jobData,
        created: true
      });
      console.log(`      ✅ Job criado: ${result.jobId}`);
    } else {
      results.push({
        index: i + 1,
        data: jobData,
        created: false
      });
      console.log(`      ❌ Falha ao criar job`);
    }
    
    await sleep(500); // Pequeno delay entre criações
  }

  console.log(`\n📊 Resumo da criação: ${results.filter(r => r.created).length}/${TEST_JOBS.length} jobs criados\n`);

  // Aguardar conclusão de todos os jobs
  console.log('⏳ Aguardando processamento dos jobs...');
  const completedJobs = [];
  
  for (const result of results) {
    if (!result.created) continue;
    
    const finalStatus = await waitForCompletion(result.jobId);
    completedJobs.push({
      ...result,
      finalStatus
    });
  }

  // Relatório final
  console.log('\n📋 ===== RELATÓRIO FINAL =====');
  console.log(`Total de jobs criados: ${results.filter(r => r.created).length}`);
  console.log(`Jobs completados: ${completedJobs.filter(j => j.finalStatus?.state === 'completed').length}`);
  console.log(`Jobs falharam: ${completedJobs.filter(j => j.finalStatus?.state === 'failed').length}`);
  console.log(`Jobs timeout: ${completedJobs.filter(j => !j.finalStatus).length}`);

  console.log('\n📝 Detalhes por job:');
  completedJobs.forEach(job => {
    const status = job.finalStatus?.state || 'timeout';
    const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏰';
    console.log(`   ${icon} Job ${job.index} (${job.jobId}): ${status}`);
    
    if (status === 'failed' && job.finalStatus?.reason) {
      console.log(`      Erro: ${job.finalStatus.reason}`);
    }
  });

  // Verificar status da fila
  const waiting = await audioQueue.getWaiting();
  const active = await audioQueue.getActive();
  const completed = await audioQueue.getCompleted();
  const failed = await audioQueue.getFailed();

  console.log('\n🎯 Status final da fila:');
  console.log(`   Aguardando: ${waiting.length}`);
  console.log(`   Ativo: ${active.length}`);
  console.log(`   Completados: ${completed.length}`);
  console.log(`   Falharam: ${failed.length}`);

  console.log('\n🧪 ===== TESTE CONCLUÍDO =====');
  
  // Encerrar conexões
  await audioQueue.close();
  process.exit(0);
}

// Executar teste
testQueueSystem().catch(error => {
  console.error('💥 Erro crítico no teste:', error);
  process.exit(1);
});