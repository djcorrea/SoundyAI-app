/**
 * 🧪 TESTE DA CORREÇÃO UUID
 * Verificar se as correções resolveram os problemas de validação
 */

import dotenv from 'dotenv';
dotenv.config();

import { getQueueReadyPromise, getAudioQueue } from './work/lib/queue.js';
import { randomUUID } from 'crypto';

async function testUUIDValidation() {
  console.log('🧪 TESTE DA CORREÇÃO DE VALIDAÇÃO UUID');
  console.log('================================================================');
  
  try {
    await getQueueReadyPromise();
    const queue = getAudioQueue();
    
    // 🧪 TESTE 1: Job com UUID válido
    console.log('\n🧪 === TESTE 1: UUID VÁLIDO ===');
    const validUUID = randomUUID();
    console.log(`✅ Testando com UUID válido: ${validUUID}`);
    
    const validJob = await queue.add('process-audio', {
      jobId: validUUID,
      fileKey: 'test/valid-uuid-test.wav',
      fileName: 'test-valid.wav',
      mode: 'test'
    }, {
      jobId: `audio-valid-${Date.now()}`,
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`✅ Job com UUID válido criado: ${validJob.id}`);
    
    // Aguardar um pouco para ver se processsa
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Remover job de teste
    try {
      await validJob.remove();
      console.log(`🗑️ Job de teste removido`);
    } catch (e) {
      console.log(`⚠️ Job pode ter sido processado: ${e.message}`);
    }
    
    // 🧪 TESTE 2: Job com ID inválido (deve falhar graciosamente)
    console.log('\n🧪 === TESTE 2: ID INVÁLIDO ===');
    const invalidId = 'test-invalid-' + Date.now();
    console.log(`❌ Testando com ID inválido: ${invalidId}`);
    
    const invalidJob = await queue.add('process-audio', {
      jobId: invalidId,
      fileKey: 'test/invalid-id-test.wav',
      fileName: 'test-invalid.wav',
      mode: 'test'
    }, {
      jobId: `audio-invalid-${Date.now()}`,
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`✅ Job com ID inválido criado: ${invalidJob.id}`);
    console.log(`🔍 Aguardando processamento para ver se erro é tratado graciosamente...`);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar estado do job
    const jobState = await invalidJob.getState();
    console.log(`📊 Estado final do job inválido: ${jobState}`);
    
    if (jobState === 'failed') {
      const failedReason = invalidJob.failedReason || 'Motivo não especificado';
      console.log(`✅ Job falhou conforme esperado: ${failedReason}`);
      
      if (failedReason.includes('UUID válido')) {
        console.log(`✅ CORREÇÃO FUNCIONANDO: Validação UUID detectou problema`);
      }
    }
    
    // Remover job de teste
    try {
      await invalidJob.remove();
      console.log(`🗑️ Job de teste inválido removido`);
    } catch (e) {
      console.log(`⚠️ Job inválido processado: ${e.message}`);
    }
    
    // 🧪 TESTE 3: Verificar estado da fila
    console.log('\n🧪 === TESTE 3: ESTADO FINAL DA FILA ===');
    const finalCounts = await queue.getJobCounts();
    console.log(`📊 Jobs finais:`, finalCounts);
    
    if (finalCounts.failed === 0) {
      console.log(`✅ SUCESSO: Nenhum job falhado na fila`);
    } else {
      console.log(`⚠️ Ainda há ${finalCounts.failed} job(s) falhado(s)`);
    }
    
    console.log('\n🎉 TESTE DE CORREÇÃO CONCLUÍDO');
    
  } catch (error) {
    console.error(`💥 Erro no teste: ${error.message}`);
  }
}

testUUIDValidation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
  });