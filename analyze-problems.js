/**
 * 🔍 ANÁLISE DETALHADA DOS PROBLEMAS DETECTADOS
 * Baseado no diagnóstico que encontrou 2 problemas críticos
 */

import dotenv from 'dotenv';
dotenv.config();

import { getQueueReadyPromise, getAudioQueue } from './work/lib/queue.js';

async function analyzeProblems() {
  console.log('🔍 ANÁLISE DETALHADA DOS PROBLEMAS DETECTADOS');
  console.log('================================================================');
  
  try {
    await getQueueReadyPromise();
    const queue = getAudioQueue();
    
    // 🚨 PROBLEMA 1: Job falhado detectado
    console.log('\n🚨 === PROBLEMA 1: JOB FALHADO ===');
    const failedJobs = await queue.getFailed(0, 10);
    
    for (const job of failedJobs) {
      console.log(`❌ Job ID: ${job.id}`);
      console.log(`   - Nome: ${job.name}`);
      console.log(`   - Data: ${JSON.stringify(job.data, null, 2)}`);
      console.log(`   - Erro: ${job.failedReason}`);
      console.log(`   - Tentativas: ${job.attemptsMade}/${job.opts.attempts}`);
      console.log(`   - Criado: ${new Date(job.timestamp).toISOString()}`);
      console.log(`   - Stack trace:`, job.stacktrace?.slice(0, 500) || 'Não disponível');
      
      // Analisar o tipo de erro
      if (job.failedReason?.includes('Key not found')) {
        console.log(`🔍 DIAGNÓSTICO: Erro "Key not found" indica problema no download do arquivo S3`);
        console.log(`💡 CAUSA PROVÁVEL: Arquivo 'teste123' não existe no bucket S3`);
      }
      
      if (job.failedReason?.includes('uuid')) {
        console.log(`🔍 DIAGNÓSTICO: Erro UUID indica problema na validação do jobId`);
        console.log(`💡 CAUSA PROVÁVEL: jobId '${job.data.jobId}' não é um UUID válido`);
      }
    }
    
    // 🚨 PROBLEMA 2: Erro no teste de enfileiramento
    console.log('\n🚨 === PROBLEMA 2: ERRO UUID NO TESTE ===');
    console.log(`❌ Erro detectado: "invalid input syntax for type uuid: 'test-1761668038564'"`);
    console.log(`🔍 DIAGNÓSTICO: Worker/PostgreSQL espera UUID válido mas recebeu string simples`);
    console.log(`💡 CAUSA: Função audioProcessor não está validando formato UUID do jobId`);
    
    // Verificar o que está sendo enviado vs o que é esperado
    console.log('\n📊 === ANÁLISE DE FORMATO ===');
    console.log(`✅ jobId correto (UUID): '123e4567-e89b-12d3-a456-426614174000'`);
    console.log(`❌ jobId incorreto: 'test-1761668038564'`);
    console.log(`❌ jobId incorreto: 'teste123'`);
    
    // Sugestões de correção
    console.log('\n🔧 === SUGESTÕES DE CORREÇÃO ===');
    console.log(`1. VALIDAÇÃO DE UUID:`);
    console.log(`   - Adicionar validação no audioProcessor`);
    console.log(`   - Verificar se jobId é UUID válido antes de usar`);
    console.log(`   - Gerar UUID automático se inválido`);
    
    console.log(`\n2. VALIDAÇÃO DE ARQUIVO:`);
    console.log(`   - Verificar se fileKey existe no S3 antes de processar`);
    console.log(`   - Adicionar tratamento graceful para arquivos não encontrados`);
    
    console.log(`\n3. TRATAMENTO DE ERRO:`);
    console.log(`   - Melhorar logs de erro no Worker`);
    console.log(`   - Adicionar retry lógico para casos específicos`);
    
  } catch (error) {
    console.error(`💥 Erro na análise: ${error.message}`);
  }
}

analyzeProblems()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
  });