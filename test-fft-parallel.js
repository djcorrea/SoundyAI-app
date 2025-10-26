/**
 * 🧪 TESTE FFT PARALELO
 * Script para validar implementação Worker Threads FFT
 * Compara performance sequencial vs paralelo
 */

import { calculateFFTParallel, cleanupFFTWorkers } from './work/lib/audio/fft.js';
import { FastFFT } from './work/lib/audio/fft.js';

console.log('🧪 [TEST] Iniciando teste FFT paralelo vs sequencial');

// Função para gerar sinal de teste
function generateTestSignal(size) {
  const signal = new Float32Array(size);
  
  // Sinal composto: frequências 440Hz, 880Hz, 1320Hz
  const sampleRate = 44100;
  
  for (let i = 0; i < size; i++) {
    const t = i / sampleRate;
    signal[i] = 
      0.5 * Math.sin(2 * Math.PI * 440 * t) +    // A4
      0.3 * Math.sin(2 * Math.PI * 880 * t) +    // A5
      0.2 * Math.sin(2 * Math.PI * 1320 * t);    // E6
  }
  
  return signal;
}

async function testFFTSequential(signal, iterations) {
  console.log(`\n🔄 [TEST-SEQ] Testando FFT sequencial: ${iterations} iterações`);
  
  const fastFFT = new FastFFT();
  const startTime = Date.now();
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const result = fastFFT.fft(signal);
      results.push(result);
      
      if ((i + 1) % 10 === 0) {
        console.log(`[TEST-SEQ] Progresso: ${i + 1}/${iterations}`);
      }
    } catch (error) {
      console.error(`[TEST-SEQ] Erro na iteração ${i}:`, error.message);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`✅ [TEST-SEQ] Concluído: ${iterations} FFTs em ${totalTime}ms`);
  console.log(`📊 [TEST-SEQ] Tempo médio por FFT: ${avgTime.toFixed(2)}ms`);
  
  return { totalTime, avgTime, results: results.length };
}

async function testFFTParallel(signal, iterations) {
  console.log(`\n🚀 [TEST-PAR] Testando FFT paralelo: ${iterations} iterações`);
  
  const startTime = Date.now();
  const results = [];
  
  // Processar em lotes de 5 para não sobrecarregar workers
  const batchSize = 5;
  const batches = Math.ceil(iterations / batchSize);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, iterations);
    const batchPromises = [];
    
    for (let i = batchStart; i < batchEnd; i++) {
      const requestId = `test-parallel-${i}`;
      const promise = calculateFFTParallel(signal, { 
        requestId,
        timeout: 10000 
      });
      batchPromises.push(promise);
    }
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`[TEST-PAR] Lote ${batch + 1}/${batches} concluído (${batchResults.length} FFTs)`);
      
    } catch (error) {
      console.error(`[TEST-PAR] Erro no lote ${batch + 1}:`, error.message);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`✅ [TEST-PAR] Concluído: ${results.length}/${iterations} FFTs em ${totalTime}ms`);
  console.log(`📊 [TEST-PAR] Tempo médio por FFT: ${avgTime.toFixed(2)}ms`);
  
  return { totalTime, avgTime, results: results.length };
}

async function runPerformanceTest() {
  try {
    const signalSize = 1024; // 1K samples
    const iterations = 20;   // 20 FFTs para teste
    
    console.log(`\n🎯 [TEST] Configuração:`);
    console.log(`   Signal size: ${signalSize} samples`);
    console.log(`   Iterações: ${iterations}`);
    console.log(`   Workers FFT: máximo 2 por processo`);
    
    // Gerar sinal de teste
    console.log('\n🔧 [TEST] Gerando sinal de teste...');
    const testSignal = generateTestSignal(signalSize);
    console.log(`✅ [TEST] Sinal gerado: ${testSignal.length} samples`);
    
    // Teste sequencial
    const seqResults = await testFFTSequential(testSignal, iterations);
    
    // Aguardar um pouco entre testes
    console.log('\n⏳ [TEST] Aguardando 2s entre testes...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste paralelo
    const parResults = await testFFTParallel(testSignal, iterations);
    
    // Comparação final
    console.log('\n📈 [COMPARISON] Resultados:');
    console.log(`   Sequencial: ${seqResults.totalTime}ms (avg: ${seqResults.avgTime.toFixed(2)}ms)`);
    console.log(`   Paralelo:   ${parResults.totalTime}ms (avg: ${parResults.avgTime.toFixed(2)}ms)`);
    
    const speedup = seqResults.totalTime / parResults.totalTime;
    const efficiency = (speedup - 1) * 100;
    
    if (speedup > 1) {
      console.log(`🚀 [COMPARISON] Speedup: ${speedup.toFixed(2)}x (${efficiency.toFixed(1)}% mais rápido)`);
    } else {
      console.log(`⚠️ [COMPARISON] Overhead: ${(1/speedup).toFixed(2)}x (${Math.abs(efficiency).toFixed(1)}% mais lento)`);
    }
    
    console.log(`📊 [COMPARISON] Taxa sucesso sequencial: ${(seqResults.results/iterations*100).toFixed(1)}%`);
    console.log(`📊 [COMPARISON] Taxa sucesso paralelo: ${(parResults.results/iterations*100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ [TEST] Erro no teste:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup workers
    console.log('\n🧹 [TEST] Limpando workers...');
    cleanupFFTWorkers();
    
    setTimeout(() => {
      console.log('✅ [TEST] Teste concluído');
      process.exit(0);
    }, 1000);
  }
}

// Executar teste
runPerformanceTest().catch(error => {
  console.error('💥 [TEST] Erro fatal:', error);
  cleanupFFTWorkers();
  process.exit(1);
});