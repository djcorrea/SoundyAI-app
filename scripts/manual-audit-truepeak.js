// 🧪 AUDITORIA TRUE PEAK - EBU Tech 3341
// Testa oversampling, interpolação e conformidade ITU-R BS.1770-4

import { 
  TruePeakDetector, 
  analyzeTruePeaks,
  TRUE_PEAK_CLIP_THRESHOLD_DBTP,
  TRUE_PEAK_CLIP_THRESHOLD_LINEAR
} from '../lib/audio/features/truepeak.js';

// 🎛️ Gerador de sinais de teste para True Peak
class TruePeakTestGenerator {
  static generateTestTone(frequency, amplitude, duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
      left[i] = value;
      right[i] = value;
    }
    
    return { left, right, sampleRate, duration, frequency, amplitude };
  }

  // 🔥 Gerar sinal com intersample peaks conhecidos
  static generateIntersamplePeak(sampleRate = 48000) {
    // Frequência próxima de Nyquist/4 para maximizar intersample peaks
    const freq = 997; // Hz - valor usado em testes EBU
    const amplitude = Math.pow(10, -0.3/20); // -0.3 dBFS - deve gerar TP > 0 dBTP
    const duration = 5.0;
    
    return this.generateTestTone(freq, amplitude, duration, sampleRate);
  }

  // 📌 Sinal clipado artificialmente
  static generateClippedSignal(clipLevel = 0.99, duration = 3.0, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let value = 1.1 * Math.sin(2 * Math.PI * 1000 * t); // Amplitudar > full scale
      
      // Clip hard
      value = Math.max(-clipLevel, Math.min(clipLevel, value));
      
      left[i] = value;
      right[i] = value;
    }
    
    return { left, right, sampleRate, duration, clipLevel };
  }

  // 🔇 Sinal zero (silêncio)
  static generateSilence(duration = 2.0, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    // Arrays já inicializados com zeros
    
    return { left, right, sampleRate, duration };
  }
}

// 🔬 Framework de teste simples
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

// 🎯 EXECUTAR TESTES TRUE PEAK
console.log('🏔️ AUDITORIA TRUE PEAK EBU Tech 3341 - VALIDAÇÃO COMPLETA\n');

let passCount = 0;
let totalTests = 0;

// ✅ TESTE 1: Silêncio deve retornar -∞
totalTests++;
passCount += runTest('TP1.1 - Silêncio absoluto deve retornar -Infinity dBTP', () => {
  const signal = TruePeakTestGenerator.generateSilence(2.0);
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  
  assertEqual(result.truePeakDbtp, -Infinity, 'True Peak deve ser -Infinity');
  assertEqual(result.samplePeakDb, -Infinity, 'Sample Peak deve ser -Infinity');
  assertTrue(result.broadcast_compliant, 'Silêncio deve ser broadcast compliant');
});

// ✅ TESTE 2: True Peak >= Sample Peak sempre
totalTests++;
passCount += runTest('TP1.2 - True Peak deve ser >= Sample Peak sempre', () => {
  const signal = TruePeakTestGenerator.generateTestTone(1000, 0.5, 3.0); // -6 dBFS
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  
  console.log(`   🔍 Sample Peak: ${result.samplePeakDb?.toFixed(2)} dBFS`);
  console.log(`   🔍 True Peak: ${result.truePeakDbtp?.toFixed(2)} dBTP`);
  
  if (isFinite(result.truePeakDbtp) && isFinite(result.samplePeakDb)) {
    assertTrue(result.truePeakDbtp >= result.samplePeakDb, 
      `True Peak (${result.truePeakDbtp?.toFixed(2)}) deve ser >= Sample Peak (${result.samplePeakDb?.toFixed(2)})`);
  }
  
  // Para tom puro, diferença deve ser pequena
  if (isFinite(result.truePeakDbtp) && isFinite(result.samplePeakDb)) {
    const diff = result.truePeakDbtp - result.samplePeakDb;
    assertTrue(diff <= 1.0, `Diferença TP-SP deve ser ≤ 1 dB para tom puro (${diff?.toFixed(2)} dB)`);
  }
});

// ✅ TESTE 3: Sinal com intersample peaks
totalTests++;
passCount += runTest('TP1.3 - Sinal 997Hz -0.3dBFS deve gerar TP > 0 dBTP', () => {
  const signal = TruePeakTestGenerator.generateIntersamplePeak();
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  
  console.log(`   🔍 997Hz -0.3dBFS → Sample Peak: ${result.samplePeakDb?.toFixed(2)} dBFS`);
  console.log(`   🔍 997Hz -0.3dBFS → True Peak: ${result.truePeakDbtp?.toFixed(2)} dBTP`);
  
  // Sample peak deve estar próximo de -0.3 dBFS
  assertCloseTo(result.samplePeakDb, -0.3, 0.2, 'Sample peak deve estar próximo de -0.3 dBFS: ');
  
  // True peak deve ser maior que sample peak (intersample peak detectado)
  if (isFinite(result.truePeakDbtp) && isFinite(result.samplePeakDb)) {
    assertTrue(result.truePeakDbtp > result.samplePeakDb, 
      'True Peak deve detectar intersample peak maior que sample peak');
    
    // Para 997Hz próximo de Nyquist/4, esperamos True Peak > 0 dBTP
    assertTrue(result.truePeakDbtp > 0, 
      `True Peak deve exceder 0 dBTP para 997Hz (${result.truePeakDbtp?.toFixed(2)} dBTP)`);
  }
  
  assertTrue(result.exceeds_0dbtp, 'Flag exceeds_0dbtp deve estar ativa');
  assertTrue(!result.broadcast_compliant, 'Não deve ser broadcast compliant (TP > -1 dBTP)');
});

// ✅ TESTE 4: Oversampling factor
totalTests++;
passCount += runTest('TP1.4 - Verificar oversampling factor >= 4x', () => {
  const signal = TruePeakTestGenerator.generateTestTone(1000, 0.1, 1.0);
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  
  assertTrue(result.oversampling_factor >= 4, 
    `Oversampling deve ser >= 4x (atual: ${result.oversampling_factor}x)`);
  
  assertEqual(result.oversampling_factor, 4, 'Oversampling configurado para 4x');
  assertEqual(result.true_peak_mode, 'linear_interpolation_4x', 'Modo de interpolação correto');
  assertTrue(result.itu_r_bs1770_4_compliant, 'Deve declarar conformidade ITU-R BS.1770-4');
  
  console.log(`   🔍 Oversampling: ${result.oversampling_factor}x`);
  console.log(`   🔍 Modo: ${result.true_peak_mode}`);
});

// ✅ TESTE 5: Detecção de clipping
totalTests++;
passCount += runTest('TP1.5 - Detecção de clipping sample vs true peak', () => {
  const signal = TruePeakTestGenerator.generateClippedSignal(0.99);
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  
  console.log(`   🔍 Clipped @ 99%: Sample Peak: ${result.samplePeakDb?.toFixed(2)} dBFS`);
  console.log(`   🔍 Clipped @ 99%: True Peak: ${result.truePeakDbtp?.toFixed(2)} dBTP`);
  console.log(`   🔍 Sample clipping: ${result.sample_clipping_count} samples`);
  console.log(`   🔍 Clipping %: ${result.clipping_percentage?.toFixed(2)}%`);
  
  // Deve detectar clipping em nível de sample
  assertTrue(result.sample_clipping_count > 0, 'Deve detectar clipping em samples');
  assertTrue(result.clipping_percentage > 0, 'Porcentagem de clipping deve ser > 0');
  
  // Sample peak deve estar próximo do nível de clip (99% = -0.086 dBFS)
  const expectedSamplePeak = 20 * Math.log10(0.99);
  assertCloseTo(result.samplePeakDb, expectedSamplePeak, 0.1, 'Sample peak deve estar próximo do clip level: ');
  
  // True peak pode ser maior que sample peak devido a reconstrução
  if (isFinite(result.truePeakDbtp) && isFinite(result.samplePeakDb)) {
    assertTrue(result.truePeakDbtp >= result.samplePeakDb, 'True Peak >= Sample Peak mesmo com clipping');
  }
});

// ✅ TESTE 6: Thresholds de clipping
totalTests++;
passCount += runTest('TP1.6 - Verificar thresholds de clipping configurados', () => {
  assertEqual(TRUE_PEAK_CLIP_THRESHOLD_DBTP, -1.0, 'Threshold dBTP deve ser -1.0');
  
  const expectedLinear = Math.pow(10, -1.0/20); // ≈0.891
  assertCloseTo(TRUE_PEAK_CLIP_THRESHOLD_LINEAR, expectedLinear, 0.001, 'Threshold linear deve corresponder a -1.0 dBTP: ');
  
  console.log(`   🔍 Threshold dBTP: ${TRUE_PEAK_CLIP_THRESHOLD_DBTP} dBTP`);
  console.log(`   🔍 Threshold Linear: ${TRUE_PEAK_CLIP_THRESHOLD_LINEAR.toFixed(6)} (≈${expectedLinear.toFixed(6)})`);
});

// ✅ TESTE 7: Flags de status
totalTests++;
passCount += runTest('TP1.7 - Verificar flags de status e warnings', () => {
  // Teste com sinal alto (-0.5 dBFS)
  const highSignal = TruePeakTestGenerator.generateTestTone(1000, Math.pow(10, -0.5/20), 2.0);
  const highResult = analyzeTruePeaks(highSignal.left, highSignal.right, highSignal.sampleRate);
  
  console.log(`   🔍 Alto (-0.5dBFS): TP=${highResult.truePeakDbtp?.toFixed(2)} dBTP`);
  console.log(`   🔍 Exceeds -1dBTP: ${highResult.exceeds_minus1dbtp}`);
  console.log(`   🔍 Exceeds 0dBTP: ${highResult.exceeds_0dbtp}`);
  console.log(`   🔍 Broadcast compliant: ${highResult.broadcast_compliant}`);
  console.log(`   🔍 Warnings: ${highResult.warnings?.length || 0}`);
  
  // Deve exceder -1 dBTP e não ser broadcast compliant
  if (isFinite(highResult.truePeakDbtp) && highResult.truePeakDbtp > -1.0) {
    assertTrue(highResult.exceeds_minus1dbtp, 'Flag exceeds_minus1dbtp deve estar ativa');
    assertTrue(!highResult.broadcast_compliant, 'Não deve ser broadcast compliant');
    assertTrue(Array.isArray(highResult.warnings), 'Deve retornar array de warnings');
  }
  
  // Teste com sinal baixo (-10 dBFS)
  const lowSignal = TruePeakTestGenerator.generateTestTone(1000, Math.pow(10, -10/20), 2.0);
  const lowResult = analyzeTruePeaks(lowSignal.left, lowSignal.right, lowSignal.sampleRate);
  
  console.log(`   🔍 Baixo (-10dBFS): TP=${lowResult.truePeakDbtp?.toFixed(2)} dBTP`);
  console.log(`   🔍 Broadcast compliant: ${lowResult.broadcast_compliant}`);
  
  // Deve ser broadcast compliant
  assertTrue(lowResult.broadcast_compliant, 'Sinal baixo deve ser broadcast compliant');
  assertTrue(!lowResult.exceeds_minus1dbtp, 'Flag exceeds_minus1dbtp deve estar inativa');
  assertTrue(!lowResult.exceeds_0dbtp, 'Flag exceeds_0dbtp deve estar inativa');
});

// ✅ TESTE 8: Processamento canais L/R separados
totalTests++;
passCount += runTest('TP1.8 - Processamento independente de canais L/R', () => {
  // Criar sinal assimétrico: L alto, R baixo
  const duration = 2.0;
  const sampleRate = 48000;
  const samples = Math.floor(duration * sampleRate);
  
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  
  const ampL = 0.8; // Alto
  const ampR = 0.2; // Baixo
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    left[i] = ampL * Math.sin(2 * Math.PI * 1000 * t);
    right[i] = ampR * Math.sin(2 * Math.PI * 1000 * t);
  }
  
  const result = analyzeTruePeaks(left, right, sampleRate);
  
  console.log(`   🔍 Canal L: ${result.true_peak_left?.toFixed(2)} dBTP`);
  console.log(`   🔍 Canal R: ${result.true_peak_right?.toFixed(2)} dBTP`);
  console.log(`   🔍 Max Combined: ${result.truePeakDbtp?.toFixed(2)} dBTP`);
  
  // Canal L deve ser maior que R
  if (isFinite(result.true_peak_left) && isFinite(result.true_peak_right)) {
    assertTrue(result.true_peak_left > result.true_peak_right, 
      `Canal L (${result.true_peak_left?.toFixed(2)}) deve ser > Canal R (${result.true_peak_right?.toFixed(2)})`);
  }
  
  // True peak geral deve ser o máximo entre os canais
  if (isFinite(result.truePeakDbtp) && isFinite(result.true_peak_left) && isFinite(result.true_peak_right)) {
    const expectedMax = Math.max(result.true_peak_left, result.true_peak_right);
    assertCloseTo(result.truePeakDbtp, expectedMax, 0.01, 'True peak deve ser o máximo dos canais: ');
  }
});

// ✅ TESTE 9: Performance temporal
totalTests++;
passCount += runTest('TP1.9 - Verificar performance processing time', () => {
  const signal = TruePeakTestGenerator.generateTestTone(1000, 0.5, 10.0); // 10 segundos
  const startTime = Date.now();
  const result = analyzeTruePeaks(signal.left, signal.right, signal.sampleRate);
  const actualTime = Date.now() - startTime;
  
  console.log(`   🔍 Reported time: ${result.processing_time}ms`);
  console.log(`   🔍 Actual time: ${actualTime}ms`);
  console.log(`   🔍 Time per second of audio: ${(result.processing_time / 10).toFixed(1)}ms/s`);
  
  assertTrue(result.processing_time > 0, 'Processing time deve ser reportado');
  assertTrue(result.processing_time < 5000, 'Processing time deve ser < 5s para 10s de áudio');
  
  // Processing time reportado deve estar próximo do real (±100ms)
  assertCloseTo(result.processing_time, actualTime, 100, 'Processing time reportado vs real: ');
});

// 📊 RESULTADOS FINAIS
console.log('\n📊 RESULTADOS DA AUDITORIA TRUE PEAK EBU Tech 3341');
console.log('='.repeat(60));
console.log(`✅ Testes aprovados: ${passCount}/${totalTests}`);
console.log(`📈 Taxa de sucesso: ${((passCount/totalTests)*100).toFixed(1)}%`);

if (passCount === totalTests) {
  console.log('\n🎉 VEREDITO: PASS');
  console.log('✅ Implementação True Peak está conforme EBU Tech 3341');
  console.log('✅ Oversampling 4x com interpolação linear funcional');
  console.log('✅ True Peak >= Sample Peak sempre mantido');
  console.log('✅ Detecção de intersample peaks funcionando');
  console.log('✅ Flags de status e warnings corretos');
  console.log('✅ Thresholds de clipping conformes (-1 dBTP)');
} else {
  console.log('\n❌ VEREDITO: FAIL');
  console.log(`❌ ${totalTests - passCount} teste(s) falharam`);
  console.log('🔧 Requer correções na implementação True Peak');
}