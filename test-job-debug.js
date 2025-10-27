// test-job-debug.js - TESTE FOCADO NO PROBLEMA
import "dotenv/config";
import { audioQueue } from './work/queue/redis.js';

console.log('🔍 [DEBUG] Testando job específico...');

async function testJobWithLogs() {
  // Adicionar listeners de eventos
  audioQueue.on('waiting', (job) => {
    console.log(`⌛ [DEBUG] Job waiting: ${job.id} | Nome: ${job.name}`);
  });

  audioQueue.on('active', (job) => {
    console.log(`⚡ [DEBUG] Job active: ${job.id} | Nome: ${job.name}`);
  });

  audioQueue.on('completed', (job, result) => {
    console.log(`✅ [DEBUG] Job completed: ${job.id} | Nome: ${job.name}`);
  });

  audioQueue.on('failed', (job, err) => {
    console.log(`❌ [DEBUG] Job failed: ${job.id} | Nome: ${job.name} | Erro: ${err.message}`);
  });

  try {
    console.log('📥 [DEBUG] Adicionando job na fila Redis...');
    
    const job = await audioQueue.add('analyze', {
      jobId: 'debug-test-' + Date.now(),
      fileKey: 'test-files/sample.wav',
      mode: 'genre',
      fileName: 'sample-debug.wav'
    });

    console.log(`📋 [DEBUG] Job enfileirado: ID=${job.id}, Nome=${job.name}`);
    
    // Aguardar 10 segundos para ver o que acontece
    console.log('⏳ [DEBUG] Aguardando 10 segundos para monitorar...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verificar estado final
    const stats = await audioQueue.getWaitingCount();
    const active = await audioQueue.getActiveCount();
    const completed = await audioQueue.getCompletedCount();
    const failed = await audioQueue.getFailedCount();
    
    console.log('📊 [DEBUG] Estado final da fila:');
    console.log(`   Waiting: ${stats}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    
  } catch (error) {
    console.error('❌ [DEBUG] Erro no teste:', error.message);
  }
}

testJobWithLogs().catch(console.error);