// 🚀 TESTE SIMPLIFICADO - FASE 5.5 CONCORRÊNCIA
// Teste básico do sistema de concorrência

import { getConcurrencyManager, CONCURRENCY_LIMITS } from './api/audio/concurrency-manager.js';

console.log('🚀 TESTE SIMPLIFICADO - FASE 5.5 CONCORRÊNCIA');
console.log('================================================');

async function testBasicConcurrency() {
  try {
    console.log('\n📋 1. TESTANDO CONFIGURAÇÃO BÁSICA');
    
    const manager = getConcurrencyManager();
    console.log('✅ Gerenciador criado');
    
    const stats = manager.getStats();
    console.log('📊 Limites configurados:');
    console.log(`   - FFT Workers: ${CONCURRENCY_LIMITS.MAX_FFT_WORKERS}`);
    console.log(`   - STEMS Workers: ${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS}`);
    console.log(`   - Job Timeout: ${CONCURRENCY_LIMITS.JOB_TIMEOUT}ms`);
    
    console.log('\n📊 Pools disponíveis:');
    Object.entries(stats.pools).forEach(([name, pool]) => {
      console.log(`   - ${name}: ${pool.maxWorkers} workers máximo`);
    });
    
    console.log('\n⚡ 2. TESTANDO EXECUÇÃO DE JOBS');
    
    // Teste simples de job FFT
    const result1 = await manager.executeFFTJob(
      async (data) => {
        console.log(`🔄 Executando job FFT: ${data.message}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: data.message };
      },
      { message: 'Teste FFT básico' }
    );
    
    console.log(`✅ Job FFT concluído: ${result1.message}`);
    
    // Teste simples de job geral
    const result2 = await manager.executeGeneralJob(
      async (data) => {
        console.log(`🔄 Executando job geral: ${data.message}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true, message: data.message };
      },
      { message: 'Teste geral básico' }
    );
    
    console.log(`✅ Job geral concluído: ${result2.message}`);
    
    console.log('\n⚡ 3. TESTANDO MÚLTIPLOS JOBS');
    
    const multipleJobs = [];
    for (let i = 0; i < 3; i++) {
      multipleJobs.push(
        manager.executeFFTJob(
          async (data) => {
            console.log(`🔄 Job múltiplo ${data.id} iniciado`);
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`✅ Job múltiplo ${data.id} concluído`);
            return { id: data.id, processed: true };
          },
          { id: i }
        )
      );
    }
    
    const multipleResults = await Promise.all(multipleJobs);
    console.log(`✅ ${multipleResults.length} jobs múltiplos concluídos`);
    
    console.log('\n📊 4. ESTATÍSTICAS FINAIS');
    await manager.waitForIdle();
    const finalStats = manager.getStats();
    
    console.log(`📊 Jobs ativos: ${finalStats.totalActiveJobs}`);
    console.log(`📊 Jobs na fila: ${finalStats.totalQueuedJobs}`);
    console.log(`📊 Sistema idle: ${finalStats.totalActiveJobs === 0 && finalStats.totalQueuedJobs === 0 ? 'SIM' : 'NÃO'}`);
    
    console.log('\n🎉 TESTE BÁSICO DE CONCORRÊNCIA - SUCESSO!');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE BÁSICO:', error.message);
    throw error;
  }
}

// Executar teste
testBasicConcurrency().catch(error => {
  console.error('❌ Falha no teste:', error);
  process.exit(1);
});
