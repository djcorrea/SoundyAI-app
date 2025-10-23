/**
 * 🧪 TESTE DE VALIDAÇÃO - True Peak FFmpeg vs Loop JavaScript
 * 
 * Compara performance e precisão entre:
 * - Loop JavaScript (4x oversampling manual)
 * - FFmpeg ebur128 (nativo C/C++)
 * 
 * Uso:
 * node test-truepeak-ffmpeg.js
 */

import { analyzeTruePeaksFFmpeg, calculateTruePeakJS } from './lib/audio/features/truepeak-ffmpeg.js';

console.log('🧪 TESTE DE VALIDAÇÃO: True Peak FFmpeg\n');
console.log('═══════════════════════════════════════════════════════════');

// Gerar sinal de teste (senoide 440 Hz)
function generateTestTone(frequency, durationSec, amplitude, sampleRate = 48000) {
  const numSamples = durationSec * sampleRate;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
    left[i] = value;
    right[i] = value * 0.9; // Canal direito levemente menor
  }
  
  return { left, right };
}

// Comparar precisão numérica
function comparePrecision(resultJS, resultFFmpeg, testName) {
  const diff = Math.abs(resultJS.true_peak_dbtp - resultFFmpeg.true_peak_dbtp);
  const passed = diff < 0.1; // Tolerância: 0.1 dB
  
  console.log(`\n📊 ${testName}`);
  console.log(`   Loop JS:    ${resultJS.true_peak_dbtp.toFixed(3)} dBTP`);
  console.log(`   FFmpeg:     ${resultFFmpeg.true_peak_dbtp.toFixed(3)} dBTP`);
  console.log(`   Diferença:  ${diff.toFixed(3)} dB ${passed ? '✅' : '❌'}`);
  
  return { diff, passed };
}

async function runTest() {
  try {
    console.log('🔧 Gerando sinal de teste (3 segundos @ 440 Hz)...\n');
    
    // Teste 1: Senoide 0 dBFS (amplitude máxima)
    console.log('📊 TESTE 1: Senoide 0 dBFS (amplitude 1.0)');
    console.log('───────────────────────────────────────────────────────────');
    
    const test1 = generateTestTone(440, 3, 1.0);
    
    console.log('⏱️  Loop JavaScript:');
    console.time('  └─ Tempo');
    const result1JS = calculateTruePeakJS(test1.left, test1.right);
    console.timeEnd('  └─ Tempo');
    
    console.log('\n⚡ FFmpeg ebur128:');
    console.time('  └─ Tempo');
    const result1FFmpeg = await analyzeTruePeaksFFmpeg(test1.left, test1.right);
    console.timeEnd('  └─ Tempo');
    
    const precision1 = comparePrecision(result1JS, result1FFmpeg, 'Precisão Teste 1');
    
    // Teste 2: Senoide -3 dBFS
    console.log('\n\n📊 TESTE 2: Senoide -3 dBFS (amplitude 0.707)');
    console.log('───────────────────────────────────────────────────────────');
    
    const test2 = generateTestTone(440, 3, 0.707);
    
    console.log('⏱️  Loop JavaScript:');
    console.time('  └─ Tempo');
    const result2JS = calculateTruePeakJS(test2.left, test2.right);
    console.timeEnd('  └─ Tempo');
    
    console.log('\n⚡ FFmpeg ebur128:');
    console.time('  └─ Tempo');
    const result2FFmpeg = await analyzeTruePeaksFFmpeg(test2.left, test2.right);
    console.timeEnd('  └─ Tempo');
    
    const precision2 = comparePrecision(result2JS, result2FFmpeg, 'Precisão Teste 2');
    
    // Teste 3: Senoide -10 dBFS
    console.log('\n\n📊 TESTE 3: Senoide -10 dBFS (amplitude 0.316)');
    console.log('───────────────────────────────────────────────────────────');
    
    const test3 = generateTestTone(440, 3, 0.316);
    
    console.log('⏱️  Loop JavaScript:');
    console.time('  └─ Tempo');
    const result3JS = calculateTruePeakJS(test3.left, test3.right);
    console.timeEnd('  └─ Tempo');
    
    console.log('\n⚡ FFmpeg ebur128:');
    console.time('  └─ Tempo');
    const result3FFmpeg = await analyzeTruePeaksFFmpeg(test3.left, test3.right);
    console.timeEnd('  └─ Tempo');
    
    const precision3 = comparePrecision(result3JS, result3FFmpeg, 'Precisão Teste 3');
    
    // Teste 4: Performance com sinal longo (3 minutos)
    console.log('\n\n⚡ TESTE 4: Performance (3 minutos)');
    console.log('───────────────────────────────────────────────────────────');
    
    const test4 = generateTestTone(440, 180, 0.5); // 3 min
    console.log(`📏 Tamanho: ${test4.left.length.toLocaleString()} samples`);
    
    console.log('\n⏱️  Loop JavaScript (3 min):');
    const startJS = Date.now();
    calculateTruePeakJS(test4.left, test4.right);
    const timeJS = Date.now() - startJS;
    console.log(`  └─ Tempo: ${timeJS}ms (${(timeJS / 1000).toFixed(2)}s)`);
    
    console.log('\n⚡ FFmpeg ebur128 (3 min):');
    const startFFmpeg = Date.now();
    await analyzeTruePeaksFFmpeg(test4.left, test4.right);
    const timeFFmpeg = Date.now() - startFFmpeg;
    console.log(`  └─ Tempo: ${timeFFmpeg}ms (${(timeFFmpeg / 1000).toFixed(2)}s)`);
    
    const speedup = ((timeJS / timeFFmpeg) * 100).toFixed(0);
    console.log(`\n🚀 Ganho de Performance: ${speedup}% mais rápido`);
    
    // Resumo final
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMO FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    
    const allPassed = precision1.passed && precision2.passed && precision3.passed;
    const maxDiff = Math.max(precision1.diff, precision2.diff, precision3.diff);
    
    console.log(`Precisão:           ${allPassed ? '✅ Aprovado' : '❌ Reprovado'}`);
    console.log(`Diferença Máxima:   ${maxDiff.toFixed(3)} dB (tolerância: 0.1 dB)`);
    console.log(`Performance (3min): Loop JS: ${(timeJS / 1000).toFixed(2)}s | FFmpeg: ${(timeFFmpeg / 1000).toFixed(2)}s`);
    console.log(`Ganho:              ${speedup}% mais rápido com FFmpeg`);
    
    console.log('\n✅ TESTE CONCLUÍDO');
    
    if (!allPassed) {
      console.error('\n❌ ALGUNS TESTES FALHARAM - Revisar implementação');
      process.exit(1);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
