// test-redis-pipeline-local.js - TESTE COMPLETO DA PIPELINE REDIS
import "dotenv/config";
import { audioQueue, getQueueStats } from './work/queue/redis.js';

console.log('🧪 [TEST] Iniciando teste da pipeline Redis...');

async function testRedisConnection() {
  try {
    const stats = await getQueueStats();
    console.log('✅ [TEST] Conexão Redis funcionando:', stats);
    return true;
  } catch (error) {
    console.error('❌ [TEST] Erro na conexão Redis:', error.message);
    return false;
  }
}

async function testJobEnqueue() {
  try {
    const job = await audioQueue.add('analyze', {
      jobId: 'test-' + Date.now(),
      fileKey: 'test-files/sample.wav',
      mode: 'genre',
      fileName: 'sample.wav'
    });

    console.log('✅ [TEST] Job enfileirado com sucesso:', job.id);
    return job;
  } catch (error) {
    console.error('❌ [TEST] Erro ao enfileirar job:', error.message);
    return null;
  }
}

async function monitorQueueStats() {
  console.log('📊 [TEST] Monitorando fila por 30 segundos...');
  
  for (let i = 0; i < 6; i++) {
    try {
      const stats = await getQueueStats();
      console.log(`📈 [TEST] Stats ${i+1}/6:`, {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed
      });
    } catch (error) {
      console.error('⚠️ [TEST] Erro ao obter stats:', error.message);
    }
    
    if (i < 5) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function runFullTest() {
  console.log('🎯 [TEST] Iniciando teste completo...\n');

  // 1. Testar conexão Redis
  console.log('1️⃣ Testando conexão Redis...');
  const redisOk = await testRedisConnection();
  if (!redisOk) {
    console.log('❌ [TEST] Redis falhou - abortando teste');
    return;
  }

  // 2. Testar enfileiramento
  console.log('\n2️⃣ Testando enfileiramento...');
  const job = await testJobEnqueue();
  if (!job) {
    console.log('❌ [TEST] Enfileiramento falhou - abortando teste');
    return;
  }

  // 3. Monitorar estatísticas
  console.log('\n3️⃣ Monitorando processamento...');
  await monitorQueueStats();

  console.log('\n🎉 [TEST] Teste completo finalizado!');
  console.log('📋 [TEST] Verifique os logs do worker para confirmar processamento');
}

// Executar teste
runFullTest().catch(console.error);