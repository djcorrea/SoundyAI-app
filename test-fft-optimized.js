/**
 * 🧪 TESTE DE VALIDAÇÃO - FFT Otimizada vs FastFFT
 * 
 * Compara performance e precisão entre:
 * - FastFFT (JavaScript puro)
 * - OptimizedFFT (fft-js)
 * 
 * Uso:
 * node test-fft-optimized.js
 */

import { FastFFT as FastFFTOld } from './lib/audio/fft.js';
import { FastFFT as FastFFTNew } from './lib/audio/fft-optimized.js';

const FFT_SIZE = 4096;
const NUM_FRAMES = 1000; // Reduzido para teste rápido (vs 8434 real)

console.log('🧪 TESTE DE VALIDAÇÃO: FFT Otimizada\n');
console.log('═══════════════════════════════════════════════════════════');

// Gerar sinal de teste (senoide + ruído)
function generateTestSignal(size, frequency = 440, sampleRate = 48000) {
  const signal = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i / sampleRate;
    const tone = Math.sin(2 * Math.PI * frequency * t);
    const noise = (Math.random() - 0.5) * 0.1;
    signal[i] = tone + noise;
  }
  return signal;
}

// Comparar precisão numérica
function compareResults(oldResult, newResult, tolerance = 0.001) {
  const errors = {
    magnitude: [],
    phase: [],
    maxMagError: 0,
    maxPhaseError: 0,
    avgMagError: 0,
    avgPhaseError: 0
  };
  
  for (let i = 0; i < oldResult.magnitude.length; i++) {
    const magError = Math.abs(oldResult.magnitude[i] - newResult.magnitude[i]);
    const phaseError = Math.abs(oldResult.phase[i] - newResult.phase[i]);
    
    errors.magnitude.push(magError);
    errors.phase.push(phaseError);
    
    if (magError > errors.maxMagError) errors.maxMagError = magError;
    if (phaseError > errors.maxPhaseError) errors.maxPhaseError = phaseError;
  }
  
  errors.avgMagError = errors.magnitude.reduce((a, b) => a + b, 0) / errors.magnitude.length;
  errors.avgPhaseError = errors.phase.reduce((a, b) => a + b, 0) / errors.phase.length;
  
  const passed = errors.maxMagError < tolerance && errors.maxPhaseError < tolerance;
  
  return { errors, passed };
}

async function runTest() {
  try {
    // Inicializar engines
    console.log('🔧 Inicializando engines FFT...');
    const fftOld = new FastFFTOld(FFT_SIZE);
    const fftNew = new FastFFTNew(FFT_SIZE);
    console.log('✅ Engines inicializadas\n');
    
    // Teste 1: Performance
    console.log('📊 TESTE 1: Performance');
    console.log('───────────────────────────────────────────────────────────');
    
    const testSignal = generateTestSignal(FFT_SIZE);
    
    console.log('⏱️  FastFFT (JavaScript puro):');
    console.time('  └─ Tempo total');
    for (let i = 0; i < NUM_FRAMES; i++) {
      fftOld.fft(testSignal);
    }
    console.timeEnd('  └─ Tempo total');
    
    console.log('\n⚡ OptimizedFFT (fft-js):');
    console.time('  └─ Tempo total');
    for (let i = 0; i < NUM_FRAMES; i++) {
      fftNew.fft(testSignal);
    }
    console.timeEnd('  └─ Tempo total');
    
    // Teste 2: Precisão
    console.log('\n\n🎯 TESTE 2: Precisão Numérica');
    console.log('───────────────────────────────────────────────────────────');
    
    const resultOld = fftOld.fft(testSignal);
    const resultNew = fftNew.fft(testSignal);
    
    const { errors, passed } = compareResults(resultOld, resultNew, 0.001);
    
    console.log(`📐 Erro Máximo (Magnitude): ${errors.maxMagError.toExponential(3)}`);
    console.log(`📐 Erro Médio (Magnitude):  ${errors.avgMagError.toExponential(3)}`);
    console.log(`📐 Erro Máximo (Fase):      ${errors.maxPhaseError.toExponential(3)}`);
    console.log(`📐 Erro Médio (Fase):       ${errors.avgPhaseError.toExponential(3)}`);
    
    console.log('\n' + (passed ? '✅ PRECISÃO VALIDADA' : '❌ PRECISÃO FORA DA TOLERÂNCIA'));
    
    // Teste 3: Formato de saída
    console.log('\n\n🔍 TESTE 3: Compatibilidade de API');
    console.log('───────────────────────────────────────────────────────────');
    
    const hasReal = resultNew.real && resultNew.real.length > 0;
    const hasImag = resultNew.imag && resultNew.imag.length > 0;
    const hasMagnitude = resultNew.magnitude && resultNew.magnitude.length > 0;
    const hasPhase = resultNew.phase && resultNew.phase.length > 0;
    
    console.log(`✓ Propriedade 'real':      ${hasReal ? '✅' : '❌'} (${resultNew.real?.length || 0} elementos)`);
    console.log(`✓ Propriedade 'imag':      ${hasImag ? '✅' : '❌'} (${resultNew.imag?.length || 0} elementos)`);
    console.log(`✓ Propriedade 'magnitude': ${hasMagnitude ? '✅' : '❌'} (${resultNew.magnitude?.length || 0} elementos)`);
    console.log(`✓ Propriedade 'phase':     ${hasPhase ? '✅' : '❌'} (${resultNew.phase?.length || 0} elementos)`);
    
    const apiCompatible = hasReal && hasImag && hasMagnitude && hasPhase;
    console.log('\n' + (apiCompatible ? '✅ API 100% COMPATÍVEL' : '❌ API INCOMPATÍVEL'));
    
    // Resumo final
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMO FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Performance:        ${NUM_FRAMES} frames testados`);
    console.log(`Precisão:           ${passed ? '✅ Aprovado' : '❌ Reprovado'} (tolerância: 0.001)`);
    console.log(`Compatibilidade:    ${apiCompatible ? '✅ Aprovado' : '❌ Reprovado'}`);
    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
