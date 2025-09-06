// 🚀 TESTE COMPLETO - FASE 5.5 PERFORMANCE E CONCORRÊNCIA
// Validação do sistema de controle de concorrência e performance

import { processAudioComplete, calculateAudioScore } from './api/audio/pipeline-complete.js';
import { getConcurrencyManager, CONCURRENCY_LIMITS } from './api/audio/concurrency-manager.js';
import { getStemsSystemStatus } from './api/audio/stems-separation.js';
import fs from 'fs';
import path from 'path';

console.log('🚀 INICIANDO TESTE COMPLETO - FASE 5.5 PERFORMANCE E CONCORRÊNCIA');
console.log('========================================================================');

/**
 * 🎯 TESTE PRINCIPAL - Validação completa da Fase 5.5
 */
async function testPhase5_5() {
  const startTime = Date.now();
  
  try {
    console.log('\n📋 1. VALIDAÇÃO DA CONFIGURAÇÃO DE CONCORRÊNCIA');
    await testConcurrencyConfiguration();
    
    console.log('\n⚡ 2. TESTE DE PROCESSAMENTO COM CONCORRÊNCIA');
    await testConcurrentProcessing();
    
    console.log('\n🔄 3. TESTE DE FILA E LIMITAÇÃO');
    await testQueueAndLimiting();
    
    console.log('\n📊 4. TESTE DE PERFORMANCE E MONITORAMENTO');
    await testPerformanceMonitoring();
    
    console.log('\n🎵 5. TESTE DO SISTEMA DE STEMS (PREPARAÇÃO)');
    await testStemsSystemPreparation();
    
    console.log('\n⚡ 6. TESTE DE STRESS CONTROLADO');
    await testControlledStressTest();
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n✅ FASE 5.5 - TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log(`⏱️ Tempo total dos testes: ${totalTime}ms`);
    console.log('\n🎉 SISTEMA DE CONCORRÊNCIA FUNCIONANDO PERFEITAMENTE!');
    
  } catch (error) {
    console.error('\n❌ ERRO NOS TESTES DA FASE 5.5:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * 📋 1. VALIDAR CONFIGURAÇÃO DE CONCORRÊNCIA
 */
async function testConcurrencyConfiguration() {
  console.log('🔧 Validando configuração do gerenciador de concorrência...');
  
  const manager = getConcurrencyManager();
  const stats = manager.getStats();
  
  // Verificar limites configurados
  const expectedLimits = {
    MAX_FFT_WORKERS: 4,
    MAX_STEMS_WORKERS: 2
  };
  
  console.log(`📊 Limites FFT: ${CONCURRENCY_LIMITS.MAX_FFT_WORKERS} (esperado: ${expectedLimits.MAX_FFT_WORKERS})`);
  console.log(`📊 Limites STEMS: ${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS} (esperado: ${expectedLimits.MAX_STEMS_WORKERS})`);
  
  if (CONCURRENCY_LIMITS.MAX_FFT_WORKERS !== expectedLimits.MAX_FFT_WORKERS) {
    throw new Error(`Limite FFT incorreto: ${CONCURRENCY_LIMITS.MAX_FFT_WORKERS} != ${expectedLimits.MAX_FFT_WORKERS}`);
  }
  
  if (CONCURRENCY_LIMITS.MAX_STEMS_WORKERS !== expectedLimits.MAX_STEMS_WORKERS) {
    throw new Error(`Limite STEMS incorreto: ${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS} != ${expectedLimits.MAX_STEMS_WORKERS}`);
  }
  
  // Verificar pools criados
  const requiredPools = ['fft_processing', 'stems_separation', 'general'];
  for (const poolType of requiredPools) {
    if (!stats.pools[poolType]) {
      throw new Error(`Pool obrigatório ausente: ${poolType}`);
    }
    console.log(`✅ Pool ${poolType}: max ${stats.pools[poolType].maxWorkers} workers`);
  }
  
  console.log('✅ Configuração de concorrência validada');
}

/**
 * ⚡ 2. TESTE DE PROCESSAMENTO COM CONCORRÊNCIA
 */
async function testConcurrentProcessing() {
  console.log('🎵 Testando processamento de áudio com controle de concorrência...');
  
  // Usar arquivo de teste do validate.js
  const testFiles = ['mono-teste-referencia.wav', 'silencio.wav'];
  
  for (const fileName of testFiles) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Arquivo ${fileName} não encontrado, pulando teste`);
      continue;
    }
    
    console.log(`🎵 Processando: ${fileName}`);
    const startTime = Date.now();
    
    const fileBuffer = fs.readFileSync(filePath);
    const result = await processAudioComplete(fileBuffer, fileName);
    
    const processingTime = Date.now() - startTime;
    
    // Validar resultado
    if (!result || result.status !== 'success') {
      throw new Error(`Processamento falhou para ${fileName}`);
    }
    
    if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
      throw new Error(`Score inválido para ${fileName}: ${result.score}`);
    }
    
    // Verificar se informações de concorrência estão presentes
    if (!result.metadata.phaseBreakdown.concurrency) {
      throw new Error(`Informações de concorrência ausentes para ${fileName}`);
    }
    
    console.log(`✅ ${fileName}: Score ${result.score}% em ${processingTime}ms`);
    console.log(`   Concorrência: ${result.metadata.phaseBreakdown.concurrency.totalActiveJobs} jobs ativos`);
  }
  
  console.log('✅ Processamento com concorrência funcionando');
}

/**
 * 🔄 3. TESTE DE FILA E LIMITAÇÃO
 */
async function testQueueAndLimiting() {
  console.log('📋 Testando sistema de filas e limitação de concorrência...');
  
  const manager = getConcurrencyManager();
  
  // Criar jobs simples de teste para verificar fila
  const testJobs = [];
  const jobCount = 6; // Mais que o limite de FFT (4)
  
  console.log(`🔄 Criando ${jobCount} jobs de teste (limite FFT: ${CONCURRENCY_LIMITS.MAX_FFT_WORKERS})`);
  
  // Criar jobs que simulam processamento FFT
  for (let i = 0; i < jobCount; i++) {
    const jobPromise = manager.executeFFTJob(
      async (data) => {
        console.log(`⚡ Executando job de teste ${data.id}`);
        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 100));
        return { jobId: data.id, processed: true };
      },
      { id: i, description: `test-job-${i}` },
      { timeout: 5000 }
    );
    
    testJobs.push(jobPromise);
  }
  
  // Aguardar todos os jobs completarem
  const results = await Promise.all(testJobs);
  
  // Verificar se todos foram processados
  if (results.length !== jobCount) {
    throw new Error(`Jobs perdidos: esperado ${jobCount}, recebido ${results.length}`);
  }
  
  for (let i = 0; i < results.length; i++) {
    if (!results[i] || !results[i].processed) {
      throw new Error(`Job ${i} não foi processado corretamente`);
    }
  }
  
  // Verificar estatísticas finais
  const finalStats = manager.getStats();
  console.log(`📊 Jobs ativos finais: ${finalStats.totalActiveJobs}`);
  console.log(`📊 Jobs na fila finais: ${finalStats.totalQueuedJobs}`);
  
  console.log('✅ Sistema de filas e limitação funcionando');
}

/**
 * 📊 4. TESTE DE PERFORMANCE E MONITORAMENTO
 */
async function testPerformanceMonitoring() {
  console.log('📈 Testando monitoramento de performance...');
  
  const manager = getConcurrencyManager();
  
  // Obter estatísticas detalhadas
  const stats = manager.getStats();
  
  // Verificar se estatísticas essenciais estão presentes
  const requiredStatsFields = ['limits', 'pools', 'totalActiveJobs', 'totalQueuedJobs'];
  for (const field of requiredStatsFields) {
    if (!stats.hasOwnProperty(field)) {
      throw new Error(`Campo de estatísticas ausente: ${field}`);
    }
  }
  
  // Verificar estatísticas de cada pool
  for (const [poolType, poolStats] of Object.entries(stats.pools)) {
    console.log(`📊 Pool ${poolType}:`);
    console.log(`   - Max workers: ${poolStats.maxWorkers}`);
    console.log(`   - Jobs ativos: ${poolStats.activeJobs}`);
    console.log(`   - Fila: ${poolStats.queueSize}`);
    console.log(`   - Processando: ${poolStats.isProcessing}`);
    console.log(`   - Completados: ${poolStats.completedJobs}`);
    
    // Verificar se campos obrigatórios estão presentes
    const requiredPoolFields = ['maxWorkers', 'activeJobs', 'queueSize', 'isProcessing'];
    for (const field of requiredPoolFields) {
      if (!poolStats.hasOwnProperty(field)) {
        throw new Error(`Campo de pool ausente: ${poolType}.${field}`);
      }
    }
  }
  
  // Testar aguardar sistema idle
  console.log('⏳ Aguardando sistema ficar idle...');
  await manager.waitForIdle();
  
  const idleStats = manager.getStats();
  if (idleStats.totalActiveJobs > 0 || idleStats.totalQueuedJobs > 0) {
    throw new Error(`Sistema não ficou idle: ${idleStats.totalActiveJobs} ativos, ${idleStats.totalQueuedJobs} na fila`);
  }
  
  console.log('✅ Monitoramento de performance funcionando');
}

/**
 * 🎵 5. TESTE DO SISTEMA DE STEMS (PREPARAÇÃO)
 */
async function testStemsSystemPreparation() {
  console.log('🎭 Testando sistema de stems (preparação para Fase 5.8)...');
  
  // Obter status do sistema
  const stemsStatus = getStemsSystemStatus();
  
  // Verificar se sistema está preparado
  if (!stemsStatus.available) {
    throw new Error('Sistema de stems não está disponível');
  }
  
  if (stemsStatus.implemented) {
    console.log('⚠️ Sistema de stems já implementado (esperado: preparação apenas)');
  }
  
  console.log(`📊 Status: ${stemsStatus.mode}`);
  console.log(`🔧 Modelos suportados: ${stemsStatus.config.supportedModels.join(', ')}`);
  console.log(`⚡ Concorrência máxima: ${stemsStatus.config.maxConcurrent}`);
  console.log(`📁 Tamanho máximo: ${stemsStatus.config.maxFileSize}MB`);
  console.log(`⏱️ Duração máxima: ${stemsStatus.config.maxDuration}s`);
  
  // Verificar configurações essenciais
  if (stemsStatus.config.maxConcurrent !== CONCURRENCY_LIMITS.MAX_STEMS_WORKERS) {
    throw new Error(`Configuração stems inconsistente: ${stemsStatus.config.maxConcurrent} != ${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS}`);
  }
  
  console.log('✅ Sistema de stems preparado para implementação futura');
}

/**
 * ⚡ 6. TESTE DE STRESS CONTROLADO
 */
async function testControlledStressTest() {
  console.log('🔥 Executando teste de stress controlado...');
  
  const manager = getConcurrencyManager();
  
  // Criar múltiplos jobs simultâneos de diferentes tipos
  const mixedJobs = [];
  
  // 8 jobs FFT (limite é 4, então 4 na fila)
  for (let i = 0; i < 8; i++) {
    mixedJobs.push(
      manager.executeFFTJob(
        async (data) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { type: 'fft', id: data.id };
        },
        { id: `fft-${i}` }
      )
    );
  }
  
  // 4 jobs gerais
  for (let i = 0; i < 4; i++) {
    mixedJobs.push(
      manager.executeGeneralJob(
        async (data) => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return { type: 'general', id: data.id };
        },
        { id: `general-${i}` }
      )
    );
  }
  
  console.log(`🔄 Iniciando ${mixedJobs.length} jobs mistos...`);
  
  // Monitorar durante execução
  const monitoringInterval = setInterval(() => {
    const currentStats = manager.getStats();
    console.log(`📊 Status: ${currentStats.totalActiveJobs} ativos, ${currentStats.totalQueuedJobs} na fila`);
  }, 200);
  
  // Aguardar todos completarem
  const stressResults = await Promise.all(mixedJobs);
  
  clearInterval(monitoringInterval);
  
  // Verificar resultados
  if (stressResults.length !== mixedJobs.length) {
    throw new Error(`Jobs perdidos no stress test: ${stressResults.length}/${mixedJobs.length}`);
  }
  
  // Contar por tipo
  const resultsByType = {};
  stressResults.forEach(result => {
    resultsByType[result.type] = (resultsByType[result.type] || 0) + 1;
  });
  
  console.log(`📊 Resultados por tipo:`, resultsByType);
  
  // Verificar se sistema voltou ao estado idle
  await manager.waitForIdle();
  const finalStats = manager.getStats();
  
  if (finalStats.totalActiveJobs > 0 || finalStats.totalQueuedJobs > 0) {
    throw new Error('Sistema não retornou ao estado idle após stress test');
  }
  
  console.log('✅ Teste de stress controlado concluído com sucesso');
}

/**
 * 🎵 EXECUTAR TESTES SE SCRIPT CHAMADO DIRETAMENTE
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  testPhase5_5().catch(error => {
    console.error('❌ Erro fatal nos testes:', error);
    process.exit(1);
  });
}

export default testPhase5_5;
