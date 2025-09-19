// 🧪 TESTE DA CORREÇÃO DE TRUE PEAK
// Verifica se os valores ficam no range plausível (-∞ a 0 dBTP)

console.log('🧪 [TRUE_PEAK_FIX_TEST] Iniciando teste da correção...');

// Importar módulos necessários
import { analyzeTruePeaks, TruePeakDetector } from './work/lib/audio/features/truepeak.js';

// Função para gerar sinal de teste
function generateTestSignal(amplitude, frequency = 1000, sampleRate = 48000, duration = 0.1) {
  const samples = Math.floor(sampleRate * duration);
  const signal = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    signal[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  
  return signal;
}

// Teste 1: Sinal normal (deve resultar em TP < 0 dBTP)
console.log('\n📊 TESTE 1: Sinal normal (-6 dBFS)');
const signal1 = generateTestSignal(0.5); // -6 dBFS aproximadamente
const result1 = analyzeTruePeaks(signal1, signal1);

console.log(`   Sample Peak esperado: ~-6.02 dBFS`);
console.log(`   True Peak: ${result1.truePeakDbtp?.toFixed(2) || 'null'} dBTP`);
console.log(`   Range OK: ${(result1.truePeakDbtp <= 0) ? '✅' : '❌'}`);

// Teste 2: Sinal alto (pode ativar fallback)
console.log('\n📊 TESTE 2: Sinal alto (-1 dBFS)');
const signal2 = generateTestSignal(0.891); // ~-1 dBFS
const result2 = analyzeTruePeaks(signal2, signal2);

console.log(`   Sample Peak esperado: ~-1.0 dBFS`);
console.log(`   True Peak: ${result2.truePeakDbtp?.toFixed(2) || 'null'} dBTP`);
console.log(`   Range OK: ${(result2.truePeakDbtp <= 0) ? '✅' : '❌'}`);

// Teste 3: Sinal muito alto (deve ativar limitação a 0 dBTP)
console.log('\n📊 TESTE 3: Sinal muito alto (0 dBFS)');
const signal3 = generateTestSignal(1.0); // 0 dBFS
const result3 = analyzeTruePeaks(signal3, signal3);

console.log(`   Sample Peak esperado: 0.0 dBFS`);
console.log(`   True Peak: ${result3.truePeakDbtp?.toFixed(2) || 'null'} dBTP`);
console.log(`   Range OK: ${(result3.truePeakDbtp <= 0) ? '✅' : '❌'}`);

// Teste 4: Silêncio (deve retornar -Infinity)
console.log('\n📊 TESTE 4: Silêncio digital');
const signal4 = new Float32Array(4800).fill(0);
const result4 = analyzeTruePeaks(signal4, signal4);

console.log(`   Sample Peak esperado: -Infinity`);
console.log(`   True Peak: ${result4.truePeakDbtp?.toFixed(2) || '-Infinity'} dBTP`);
console.log(`   Range OK: ${(result4.truePeakDbtp === -Infinity || result4.truePeakDbtp == null) ? '✅' : '❌'}`);

// Resumo dos testes
console.log('\n📋 RESUMO DOS TESTES:');
const tests = [result1, result2, result3, result4];
const validResults = tests.filter(r => r.truePeakDbtp <= 0 || r.truePeakDbtp === -Infinity || r.truePeakDbtp == null);

console.log(`   Testes aprovados: ${validResults.length}/${tests.length}`);
console.log(`   Status: ${validResults.length === tests.length ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);

if (validResults.length === tests.length) {
  console.log('\n🎉 [TRUE_PEAK_FIX_TEST] CORREÇÃO VALIDADA - True Peak está limitado ao range plausível!');
} else {
  console.log('\n⚠️ [TRUE_PEAK_FIX_TEST] FALHA - Ainda há valores impossíveis > 0 dBTP');
}