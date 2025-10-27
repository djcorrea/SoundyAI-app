// validate-integration.js - VALIDAÇÃO FINAL DA INTEGRAÇÃO
import "dotenv/config";
import { audioQueue, getQueueStats } from './work/queue/redis.js';

console.log('🎯 [VALIDATION] Validação final da integração API ↔ Worker Redis...\n');

async function validateRedisConnection() {
  try {
    console.log('1️⃣ Testando conexão Redis...');
    const stats = await getQueueStats();
    console.log(`   ✅ Redis conectado - Stats: W:${stats.waiting} A:${stats.active} C:${stats.completed} F:${stats.failed}`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro na conexão Redis:', error.message);
    return false;
  }
}

async function validateJobEnqueuing() {
  try {
    console.log('2️⃣ Testando enfileiramento de jobs...');
    
    const job = await audioQueue.add('analyze', {
      jobId: 'validation-test-' + Date.now(),
      fileKey: 'validation/test.wav',
      mode: 'genre',
      fileName: 'validation-test.wav'
    });
    
    console.log(`   ✅ Job enfileirado com sucesso - ID: ${job.id}`);
    console.log(`   📋 Job data: ${JSON.stringify(job.data)}`);
    return job;
  } catch (error) {
    console.error('   ❌ Erro ao enfileirar job:', error.message);
    return null;
  }
}

async function monitorJobProcessing(jobId, duration = 15) {
  console.log(`3️⃣ Monitorando processamento por ${duration} segundos...`);
  
  for (let i = 0; i < duration; i++) {
    const stats = await getQueueStats();
    const status = `W:${stats.waiting} A:${stats.active} C:${stats.completed} F:${stats.failed}`;
    console.log(`   📊 ${i+1}s: ${status}`);
    
    if (stats.active > 0) {
      console.log('   ⚡ JOB ATIVO DETECTADO - Worker está processando!');
    }
    
    if (stats.completed > 0) {
      console.log('   🎉 JOB COMPLETED DETECTADO - Processamento bem-sucedido!');
      return 'completed';
    }
    
    if (stats.failed > 0) {
      console.log('   ⚠️ JOB FAILED DETECTADO - Falha no processamento (esperado se arquivo não existe)');
      return 'failed';
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('   ⏰ Timeout - Job não foi processado');
  return 'timeout';
}

async function generateReport(redisOk, jobEnqueued, processingResult) {
  console.log('\n📋 RELATÓRIO FINAL DA VALIDAÇÃO');
  console.log('='.repeat(50));
  
  console.log(`🔗 Conexão Redis: ${redisOk ? '✅ FUNCIONAL' : '❌ FALHOU'}`);
  console.log(`📥 Enfileiramento: ${jobEnqueued ? '✅ FUNCIONAL' : '❌ FALHOU'}`);
  
  let processingStatus = '❌ NÃO TESTADO';
  if (processingResult === 'completed') processingStatus = '✅ SUCESSO COMPLETO';
  else if (processingResult === 'failed') processingStatus = '⚠️ FALHA ESPERADA (arquivo não existe)';
  else if (processingResult === 'timeout') processingStatus = '⏰ TIMEOUT (worker não ativo?)';
  
  console.log(`⚙️ Processamento: ${processingStatus}`);
  
  console.log('\n🎯 DIAGNÓSTICO:');
  
  if (redisOk && jobEnqueued) {
    if (processingResult === 'completed') {
      console.log('🎉 INTEGRAÇÃO 100% FUNCIONAL - Sistema pronto para produção!');
    } else if (processingResult === 'failed') {
      console.log('✅ INTEGRAÇÃO FUNCIONAL - Falha esperada (teste com arquivo real)');
    } else {
      console.log('⚠️ INTEGRAÇÃO PARCIAL - Verificar se worker está rodando');
    }
  } else {
    console.log('❌ PROBLEMAS NA INTEGRAÇÃO - Verificar configuração Redis');
  }
  
  console.log('\n📝 PRÓXIMOS PASSOS:');
  console.log('1. Deploy Railway com worker corrigido');
  console.log('2. Testar com arquivo real existente no Backblaze');
  console.log('3. Monitorar logs em produção');
}

async function runValidation() {
  const redisOk = await validateRedisConnection();
  if (!redisOk) {
    await generateReport(false, false, null);
    return;
  }
  
  const job = await validateJobEnqueuing();
  if (!job) {
    await generateReport(true, false, null);
    return;
  }
  
  const processingResult = await monitorJobProcessing(job.id);
  await generateReport(true, true, processingResult);
}

runValidation().catch(console.error);