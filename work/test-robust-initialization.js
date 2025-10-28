/**
 * 🧪 TESTE DE INICIALIZAÇÃO ROBUSTA
 * Verifica se a nova implementação funciona corretamente
 */

import "dotenv/config";
import { getQueueReadyPromise, getAudioQueue, getRedisConnection } from './lib/queue.js';

console.log(`🧪 [TEST][${new Date().toISOString()}] -> Starting robust initialization test...`);

async function testRobustInitialization() {
  try {
    const startTime = Date.now();
    
    // 1. Testar inicialização da queue
    console.log(`⏳ [TEST][${new Date().toISOString()}] -> Testing queue initialization...`);
    const queueResult = await getQueueReadyPromise();
    console.log(`✅ [TEST][${new Date().toISOString()}] -> Queue ready! Result:`, queueResult);
    
    // 2. Testar obtenção de conexão
    console.log(`🔗 [TEST][${new Date().toISOString()}] -> Testing Redis connection...`);
    const connection = getRedisConnection();
    const ping = await connection.ping();
    console.log(`🏓 [TEST][${new Date().toISOString()}] -> Redis ping: ${ping}`);
    
    // 3. Testar obtenção da queue
    console.log(`📋 [TEST][${new Date().toISOString()}] -> Testing queue access...`);
    const audioQueue = getAudioQueue();
    const queueCounts = await audioQueue.getJobCounts();
    console.log(`📊 [TEST][${new Date().toISOString()}] -> Queue counts:`, queueCounts);
    
    // 4. Testar adição de job de teste
    console.log(`🎯 [TEST][${new Date().toISOString()}] -> Testing job addition...`);
    const testJob = await audioQueue.add('process-audio', {
      jobId: 'test-job-123',
      fileKey: 'test/file.wav',
      fileName: 'test.wav',
      mode: 'genre'
    }, {
      jobId: `test-${Date.now()}`,
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`✅ [TEST][${new Date().toISOString()}] -> Test job added: ${testJob.id}`);
    
    // 5. Verificar se job foi adicionado
    const finalCounts = await audioQueue.getJobCounts();
    console.log(`📊 [TEST][${new Date().toISOString()}] -> Final queue counts:`, finalCounts);
    
    const totalTime = Date.now() - startTime;
    console.log(`🎉 [TEST][${new Date().toISOString()}] -> Test completed successfully in ${totalTime}ms!`);
    
    // 6. Remover job de teste
    await testJob.remove();
    console.log(`🗑️ [TEST][${new Date().toISOString()}] -> Test job removed`);
    
  } catch (error) {
    console.error(`💥 [TEST][${new Date().toISOString()}] -> Test failed:`, error.message);
    console.error(`💥 [TEST][${new Date().toISOString()}] -> Stack trace:`, error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testRobustInitialization();