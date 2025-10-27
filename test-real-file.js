// test-real-file.js - TESTE COM ARQUIVO REAL
import "dotenv/config";
import { audioQueue } from './work/queue/redis.js';

console.log('🔍 [TEST] Testando com arquivo real do Backblaze...');

async function testWithRealFile() {
  try {
    console.log('📥 [TEST] Adicionando job com arquivo que deveria existir...');
    
    // Usar um arquivo que provavelmente existe ou criar um falso para debug
    const job = await audioQueue.add('analyze', {
      jobId: 'real-test-' + Date.now(),
      fileKey: 'uploads/test.wav', // Arquivo mais provável de existir
      mode: 'genre',
      fileName: 'test.wav'
    });

    console.log(`📋 [TEST] Job enfileirado: ID=${job.id}, Nome=${job.name}`);
    
    // Aguardar 15 segundos para ver o que acontece
    console.log('⏳ [TEST] Aguardando 15 segundos para monitorar processamento...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verificar estado final
    const stats = await audioQueue.getWaitingCount();
    const active = await audioQueue.getActiveCount();
    const completed = await audioQueue.getCompletedCount();
    const failed = await audioQueue.getFailedCount();
    
    console.log('📊 [TEST] Estado final da fila:');
    console.log(`   Waiting: ${stats}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    
  } catch (error) {
    console.error('❌ [TEST] Erro no teste:', error.message);
  }
}

testWithRealFile().catch(console.error);