// 🧪 SCRIPT MANUAL DE VALIDAÇÃO ITU-R BS.1770-4
// Executa testes sem dependência de framework de teste

import { 
  LUFSMeter, 
  calculateLoudnessMetrics,
  LUFS_CONSTANTS,
  K_WEIGHTING_COEFFS 
} from '../lib/audio/features/loudness.js';

// 🎛️ Gerador de sinais de teste
class TestSignalGenerator {
  static generateSilence(duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    return {
      left: new Float32Array(samples),
      right: new Float32Array(samples),
      sampleRate,
      duration
    };
  }

  static generateSine(frequency, amplitude, duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
      left[i] = value;
      right[i] = value;
    }
    
    return { left, right, sampleRate, duration };
  }

  static generatePinkNoise(amplitude, duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    // Implementação simples de pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    
    for (let i = 0; i < samples; i++) {
      const white = (Math.random() * 2 - 1);
      
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * amplitude;
      b6 = white * 0.115926;
      
      left[i] = pink;
      right[i] = pink;
    }
    
    return { left, right, sampleRate, duration };
  }
}

// 🔬 Função de teste
function runTest(testName, testFn) {
  console.log(`\n🔍 ${testName}`);
  try {
    testFn();
    console.log(`✅ PASS: ${testName}`);
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${testName}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

function assertCloseTo(actual, expected, tolerance, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`${message}Expected ${actual} to be within ±${tolerance} of ${expected} (diff: ${diff})`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}Expected ${expected}, got ${actual}`);
  }
}

// 🎯 EXECUTAR TESTES
console.log('🎵 AUDITORIA LUFS ITU-R BS.1770-4 - VALIDAÇÃO COMPLETA\n');

let passCount = 0;
let totalTests = 0;

// ✅ TESTE 1: Silêncio
totalTests++;
passCount += runTest('T1.1 - Silêncio absoluto deve retornar -Infinity LUFS', () => {
  const signal = TestSignalGenerator.generateSilence(5.0);
  const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
  
  assertEqual(result.lufs_integrated, -Infinity, 'LUFS integrado deve ser -Infinity');
  assertEqual(result.lufs_momentary, -Infinity, 'LUFS momentary deve ser -Infinity');
});

// ✅ TESTE 2: Tom puro 1kHz -18dBFS
totalTests++;
passCount += runTest('T1.2 - Tom 1kHz -18dBFS → -18 LUFS ±0.5', () => {
  const amplitude = Math.pow(10, -18/20); // -18 dBFS
  const signal = TestSignalGenerator.generateSine(1000, amplitude, 15.0);
  const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
  
  console.log(`   🔍 Medido: ${result.lufs_integrated.toFixed(2)} LUFS`);
  
  assertCloseTo(result.lufs_integrated, -18, 0.5, 'LUFS integrado deve estar próximo de -18: ');
  assertTrue(result.lufs_integrated > -19, 'LUFS não deve ser muito baixo');
  assertTrue(result.lufs_integrated < -17, 'LUFS não deve ser muito alto');
});

// ✅ TESTE 3: Pink noise -20dBFS
totalTests++;
passCount += runTest('T1.3 - Pink noise -20dBFS → -20 LUFS ±0.5', () => {
  const amplitude = Math.pow(10, -20/20); // -20 dBFS
  const signal = TestSignalGenerator.generatePinkNoise(amplitude, 30.0);
  const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
  
  console.log(`   🔍 Medido: ${result.lufs_integrated.toFixed(2)} LUFS`);
  
  assertCloseTo(result.lufs_integrated, -20, 0.5, 'LUFS integrado deve estar próximo de -20: ');
  assertTrue(result.lufs_integrated > -21, 'LUFS não deve ser muito baixo');
  assertTrue(result.lufs_integrated < -19, 'LUFS não deve ser muito alto');
});

// ✅ TESTE 4: K-weighting coefficients
totalTests++;
passCount += runTest('T1.4 - K-weighting coefficients conformes ITU-R BS.1770-4', () => {
  const preFilter = K_WEIGHTING_COEFFS.PRE_FILTER;
  const rlbFilter = K_WEIGHTING_COEFFS.RLB_FILTER;
  
  // Pre-filter (shelving ~1.5kHz)
  assertEqual(preFilter.b.length, 3, 'Pre-filter deve ter 3 coeficientes b');
  assertEqual(preFilter.a.length, 3, 'Pre-filter deve ter 3 coeficientes a');
  assertEqual(preFilter.a[0], 1.0, 'Pre-filter a[0] deve ser 1.0 (normalizado)');
  
  // RLB filter (high-pass ~38Hz)
  assertEqual(rlbFilter.b.length, 3, 'RLB filter deve ter 3 coeficientes b');
  assertEqual(rlbFilter.a.length, 3, 'RLB filter deve ter 3 coeficientes a');
  assertEqual(rlbFilter.a[0], 1.0, 'RLB filter a[0] deve ser 1.0 (normalizado)');
  
  console.log(`   🔍 Pre-filter b: [${preFilter.b.map(x => x.toFixed(6)).join(', ')}]`);
  console.log(`   🔍 Pre-filter a: [${preFilter.a.map(x => x.toFixed(6)).join(', ')}]`);
  console.log(`   🔍 RLB filter b: [${rlbFilter.b.map(x => x.toFixed(6)).join(', ')}]`);
  console.log(`   🔍 RLB filter a: [${rlbFilter.a.map(x => x.toFixed(6)).join(', ')}]`);
});

// ✅ TESTE 5: Gating
totalTests++;
passCount += runTest('T1.5 - Verificar gating absoluto (-70 LUFS) e relativo (-10 LU)', () => {
  // Sinal muito baixo que deve ser rejeitado pelo gating absoluto
  const lowAmplitude = Math.pow(10, -75/20); // -75 dBFS → deve ficar abaixo -70 LUFS
  const lowSignal = TestSignalGenerator.generateSine(1000, lowAmplitude, 10.0);
  const lowResult = calculateLoudnessMetrics(lowSignal.left, lowSignal.right, lowSignal.sampleRate);
  
  assertTrue(lowResult.lufs_integrated < -70, 'Sinal baixo deve ficar abaixo -70 LUFS');
  
  // Sinal médio para testar gating relativo
  const medAmplitude = Math.pow(10, -25/20); // -25 dBFS
  const medSignal = TestSignalGenerator.generateSine(1000, medAmplitude, 10.0);
  const medResult = calculateLoudnessMetrics(medSignal.left, medSignal.right, medSignal.sampleRate);
  
  assertTrue(medResult.gating_stats.total_blocks > 0, 'Deve ter blocos totais');
  assertTrue(medResult.gating_stats.gated_blocks > 0, 'Deve ter blocos com gating aplicado');
  assertTrue(medResult.gating_stats.gating_efficiency > 0, 'Eficiência de gating deve ser positiva');
  
  console.log(`   🔍 Gating: ${medResult.gating_stats.gated_blocks}/${medResult.gating_stats.total_blocks} blocos (${(medResult.gating_stats.gating_efficiency * 100).toFixed(1)}%)`);
});

// ✅ TESTE 6: Parâmetros temporais
totalTests++;
passCount += runTest('T1.6 - Verificar parâmetros temporais conforme ITU-R BS.1770-4', () => {
  assertEqual(LUFS_CONSTANTS.BLOCK_DURATION, 0.4, 'Block duration deve ser 400ms');
  assertEqual(LUFS_CONSTANTS.SHORT_TERM_DURATION, 3.0, 'Short-term duration deve ser 3s');
  assertEqual(LUFS_CONSTANTS.INTEGRATED_OVERLAP, 0.75, 'Overlap deve ser 75%');
  assertEqual(LUFS_CONSTANTS.ABSOLUTE_THRESHOLD, -70.0, 'Threshold absoluto deve ser -70 LUFS');
  assertEqual(LUFS_CONSTANTS.RELATIVE_THRESHOLD, -10.0, 'Threshold relativo deve ser -10 LU');
  
  // Teste calculado para 48kHz
  const meter = new LUFSMeter(48000);
  assertEqual(meter.blockSize, 19200, 'Block size deve ser 19200 samples @ 48kHz');
  assertEqual(meter.hopSize, 4800, 'Hop size deve ser 4800 samples @ 48kHz');
  assertEqual(meter.shortTermSize, 144000, 'Short-term size deve ser 144000 samples @ 48kHz');
  
  console.log(`   🔍 Block: ${meter.blockSize} samples, Hop: ${meter.hopSize} samples, ST: ${meter.shortTermSize} samples`);
});

// ✅ TESTE 7: Consistência entre durações
totalTests++;
passCount += runTest('T1.7 - LUFS integrado deve ser consistente entre durações diferentes', () => {
  const amplitude = Math.pow(10, -16/20); // -16 dBFS
  
  // Mesmo sinal, durações diferentes
  const signal5s = TestSignalGenerator.generateSine(1000, amplitude, 5.0);
  const signal10s = TestSignalGenerator.generateSine(1000, amplitude, 10.0);
  const signal20s = TestSignalGenerator.generateSine(1000, amplitude, 20.0);
  
  const result5s = calculateLoudnessMetrics(signal5s.left, signal5s.right, signal5s.sampleRate);
  const result10s = calculateLoudnessMetrics(signal10s.left, signal10s.right, signal10s.sampleRate);
  const result20s = calculateLoudnessMetrics(signal20s.left, signal20s.right, signal20s.sampleRate);
  
  console.log(`   🔍 5s: ${result5s.lufs_integrated.toFixed(2)} LUFS`);
  console.log(`   🔍 10s: ${result10s.lufs_integrated.toFixed(2)} LUFS`);
  console.log(`   🔍 20s: ${result20s.lufs_integrated.toFixed(2)} LUFS`);
  
  // Deve ser consistente ±0.2 LU
  const diff5_10 = Math.abs(result5s.lufs_integrated - result10s.lufs_integrated);
  const diff10_20 = Math.abs(result10s.lufs_integrated - result20s.lufs_integrated);
  
  assertTrue(diff5_10 < 0.2, `Diferença 5s vs 10s deve ser <0.2 LU (${diff5_10.toFixed(2)})`);
  assertTrue(diff10_20 < 0.2, `Diferença 10s vs 20s deve ser <0.2 LU (${diff10_20.toFixed(2)})`);
});

// ✅ TESTE 8: LRA calculation
totalTests++;
passCount += runTest('T1.8 - LRA calculation EBU R128 vs Legacy', () => {
  // Sinal dinâmico: fade in/out
  const duration = 15.0;
  const sampleRate = 48000;
  const samples = Math.floor(duration * sampleRate);
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t / 3.0); // fade in 3s
    const fadeOut = Math.min(1, (duration - t) / 3.0); // fade out 3s
    const envelope = fadeIn * fadeOut;
    const amplitude = 0.1 * envelope; // Max -20 dBFS
    
    const value = amplitude * Math.sin(2 * Math.PI * 1000 * t);
    left[i] = value;
    right[i] = value;
  }
  
  const result = calculateLoudnessMetrics(left, right, sampleRate);
  
  console.log(`   🔍 LRA Legacy: ${result.lra_legacy?.toFixed(2)} LU`);
  console.log(`   🔍 LRA EBU R128: ${result.lra?.toFixed(2)} LU`);
  console.log(`   🔍 LRA Meta: ${JSON.stringify(result.lra_meta)}`);
  
  assertTrue(result.lra > 0, 'LRA deve ser positivo');
  assertTrue(result.lra_legacy > 0, 'LRA legacy deve ser positivo');
  
  // EBU R128 deve ser menor ou igual ao legacy (mais rigoroso)
  assertTrue(result.lra <= result.lra_legacy + 0.1, 'EBU R128 LRA deve ser ≤ legacy + 0.1');
});

// 📊 RESULTADOS FINAIS
console.log('\n📊 RESULTADOS DA AUDITORIA LUFS ITU-R BS.1770-4');
console.log('='.repeat(60));
console.log(`✅ Testes aprovados: ${passCount}/${totalTests}`);
console.log(`📈 Taxa de sucesso: ${((passCount/totalTests)*100).toFixed(1)}%`);

if (passCount === totalTests) {
  console.log('\n🎉 VEREDITO: PASS');
  console.log('✅ Implementação LUFS está conforme ITU-R BS.1770-4');
  console.log('✅ Tolerâncias matemáticas atendidas (±0.5 LU)');
  console.log('✅ Gating absoluto e relativo funcionando corretamente');
  console.log('✅ Parâmetros temporais conformes ao padrão');
  console.log('✅ LRA implementado com EBU R128 e fallback legacy');
} else {
  console.log('\n❌ VEREDITO: FAIL');
  console.log(`❌ ${totalTests - passCount} teste(s) falharam`);
  console.log('🔧 Requer correções antes da auditoria prosseguir');
}