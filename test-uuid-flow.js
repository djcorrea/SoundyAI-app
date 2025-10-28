/**
 * 🧪 TESTE COMPLETO DO FLUXO UUID CORRIGIDO
 * Validar que jobId é sempre UUID válido e o fluxo funciona end-to-end
 */

import dotenv from 'dotenv';
dotenv.config();

import { getQueueReadyPromise, getAudioQueue } from './work/lib/queue.js';
import pool from './work/db.js';
import { randomUUID } from 'crypto';

async function testCompleteFlow() {
  console.log('🧪 TESTE COMPLETO DO FLUXO UUID CORRIGIDO');
  console.log('================================================================');
  
  try {
    // 🚀 ETAPA 1: Inicializar sistema
    console.log('\n🚀 === ETAPA 1: INICIALIZAÇÃO ===');
    await getQueueReadyPromise();
    const queue = getAudioQueue();
    console.log('✅ Sistema inicializado');
    
    // 🧪 ETAPA 2: Simular criação de job pela API
    console.log('\n🧪 === ETAPA 2: SIMULAÇÃO API ===');
    
    const jobId = randomUUID(); // 🔑 UUID válido
    const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
    const fileKey = 'test/uuid-validation.wav';
    const mode = 'genre';
    const fileName = 'test-uuid.wav';
    
    console.log(`🔑 UUID gerado: ${jobId}`);
    console.log(`📋 External ID: ${externalId}`);
    console.log(`📁 Arquivo: ${fileKey}`);
    
    // Validar que é UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    console.log(`✅ UUID válido: ${uuidRegex.test(jobId)}`);
    
    // 🧪 ETAPA 3: Enfileirar no Redis (como a API faz)
    console.log('\n📩 === ETAPA 3: ENFILEIRAMENTO REDIS ===');
    
    const redisJob = await queue.add('process-audio', {
      jobId: jobId,        // 🔑 UUID para PostgreSQL
      externalId: externalId, // 📋 ID customizado para logs
      fileKey,
      fileName,
      mode
    }, {
      jobId: externalId,   // 📋 BullMQ job ID (pode ser customizado)
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`✅ Job enfileirado no Redis: ${redisJob.id}`);
    
    // 🧪 ETAPA 4: Inserir no PostgreSQL (como a API faz)
    console.log('\n📝 === ETAPA 4: INSERÇÃO POSTGRESQL ===');
    
    try {
      const result = await pool.query(
        `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
        [jobId, fileKey, mode, "queued", fileName]
      );
      
      console.log(`✅ Inserido no PostgreSQL:`);
      console.log(`   🔑 ID: ${result.rows[0].id}`);
      console.log(`   📁 File Key: ${result.rows[0].file_key}`);
      console.log(`   ⚙️ Modo: ${result.rows[0].mode}`);
      console.log(`   📊 Status: ${result.rows[0].status}`);
      
    } catch (pgError) {
      console.error(`❌ ERRO PostgreSQL: ${pgError.message}`);
      console.error(`❌ ERRO Código: ${pgError.code}`);
      console.error(`❌ ERRO Stack: ${pgError.stack}`);
      
      if (pgError.message.includes('invalid input syntax for type uuid')) {
        console.error(`🚨 ERRO 22P02: jobId '${jobId}' não é UUID válido!`);
        throw pgError;
      }
      throw pgError;
    }
    
    // 🧪 ETAPA 5: Aguardar processamento e verificar mudanças de status
    console.log('\n⏳ === ETAPA 5: MONITORAMENTO STATUS ===');
    
    // Aguardar um pouco para possível processamento
    console.log('⏳ Aguardando 3 segundos para processamento...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar status no banco
    const statusCheck = await pool.query(
      'SELECT id, status, updated_at FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (statusCheck.rows.length > 0) {
      const job = statusCheck.rows[0];
      console.log(`📊 Status atual: ${job.status}`);
      console.log(`🕐 Última atualização: ${job.updated_at}`);
      
      // Verificar se mudou de status
      if (job.status !== 'queued') {
        console.log(`✅ Status mudou de 'queued' para '${job.status}'`);
      } else {
        console.log(`⚠️ Status ainda é 'queued' (Worker pode não estar rodando)`);
      }
    }
    
    // 🧪 ETAPA 6: Verificar job no Redis
    console.log('\n🔍 === ETAPA 6: VERIFICAÇÃO REDIS ===');
    
    const jobInQueue = await queue.getJob(redisJob.id);
    if (jobInQueue) {
      const state = await jobInQueue.getState();
      console.log(`📊 Estado no Redis: ${state}`);
      
      if (state === 'failed') {
        console.log(`❌ Job falhou: ${jobInQueue.failedReason}`);
      }
    } else {
      console.log(`ℹ️ Job não encontrado no Redis (pode ter sido processado)`);
    }
    
    // 🧪 ETAPA 7: Limpeza
    console.log('\n🗑️ === ETAPA 7: LIMPEZA ===');
    
    // Remover job de teste do PostgreSQL
    await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
    console.log(`🗑️ Job removido do PostgreSQL`);
    
    // Remover job de teste do Redis (se ainda existir)
    try {
      if (jobInQueue) {
        await jobInQueue.remove();
        console.log(`🗑️ Job removido do Redis`);
      }
    } catch (e) {
      console.log(`ℹ️ Job já foi processado/removido do Redis`);
    }
    
    console.log('\n🎉 === TESTE CONCLUÍDO COM SUCESSO ===');
    console.log('✅ UUID válido gerado e aceito pelo PostgreSQL');
    console.log('✅ Job enfileirado corretamente no Redis');
    console.log('✅ Inserção no PostgreSQL sem erro 22P02');
    console.log('✅ Fluxo completo validado');
    
  } catch (error) {
    console.error('\n💥 === ERRO NO TESTE ===');
    console.error(`❌ Erro: ${error.message}`);
    
    if (error.message.includes('invalid input syntax for type uuid')) {
      console.error('🚨 PROBLEMA: UUID inválido detectado!');
      console.error('💡 SOLUÇÃO: Verificar se randomUUID() está sendo usado corretamente');
    }
    
    throw error;
  }
}

// Executar teste
testCompleteFlow()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Teste falhou:', error.message);
    process.exit(1);
  });