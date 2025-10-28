// 🧪 TESTE COMPLETO DAS CORREÇÕES DE PRECISÃO
// Valida normalização, LUFS, True Peak, correlação, FFT

import { CoreMetricsProcessor } from '../../api/audio/core-metrics.js';
import { normalizeAudioToTargetLUFS } from '../audio/features/normalization.js';
import { auditMetricsCorrections, auditMetricsValidation } from '../audio/features/audit-logging.js';

/**
 * 🎵 Gerador de áudio sintético para testes
 */
function generateTestAudio(type = 'sine', durationSec = 1, sampleRate = 48000) {
  const samples = Math.floor(durationSec * sampleRate);
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  switch (type) {
    case 'sine':
      // Senoide 1kHz mono
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const value = 0.5 * Math.sin(2 * Math.PI * 1000 * t); // -6dB aproximadamente
        leftChannel[i] = value;
        rightChannel[i] = value;
      }
      break;
      
    case 'silence':
      // Silêncio digital
      leftChannel.fill(0);
      rightChannel.fill(0);
      break;
      
    case 'noise':
      // Ruído branco suave
      for (let i = 0; i < samples; i++) {
        leftChannel[i] = (Math.random() - 0.5) * 0.1; // -20dB aproximadamente
        rightChannel[i] = (Math.random() - 0.5) * 0.1;
      }
      break;
      
    case 'stereo_correlation':
      // Canal L: senoide, Canal R: senoide invertida (correlação negativa)
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const value = 0.3 * Math.sin(2 * Math.PI * 440 * t); // 440Hz
        leftChannel[i] = value;
        rightChannel[i] = -value; // Invertido
      }
      break;
      
    case 'hot_signal':
      // Sinal muito alto (> -1dBTP)
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const value = 0.95 * Math.sin(2 * Math.PI * 1000 * t); // Próximo de clipping
        leftChannel[i] = value;
        rightChannel[i] = value;
      }
      break;
  }
  
  return { leftChannel, rightChannel };
}

/**
 * 🎯 Mock da segmentação temporal (simplificado para teste)
 */
function mockTemporalSegmentation(leftChannel, rightChannel, sampleRate = 48000) {
  const frameSize = 4096; // FFT size
  const hopSize = 1024;   // 75% overlap
  
  // Simular frames FFT
  const frameCount = Math.floor((leftChannel.length - frameSize) / hopSize) + 1;
  const framesFFT = {
    left: [],
    right: [],
    count: frameCount,
    timestamps: []
  };
  
  // Simular frames RMS
  const framesRMS = {
    left: [],
    right: [],
    count: frameCount,
    timestamps: []
  };
  
  for (let i = 0; i < frameCount; i++) {
    const startSample = i * hopSize;
    const timestamp = startSample / sampleRate;
    
    // Mock FFT frame (simplificado)
    const fftFrame = {
      real: new Float32Array(frameSize / 2),
      imag: new Float32Array(frameSize / 2),
      magnitude: new Float32Array(frameSize / 2),
      phase: new Float32Array(frameSize / 2)
    };
    
    // Simular magnitude espectral simples
    for (let j = 0; j < frameSize / 2; j++) {
      fftFrame.magnitude[j] = Math.random() * 0.1; // Ruído baixo
    }
    // Adicionar pico em 1kHz para teste de centroide
    const bin1kHz = Math.floor(1000 * frameSize / sampleRate);
    if (bin1kHz < frameSize / 2) {
      fftFrame.magnitude[bin1kHz] = 0.5;
    }
    
    framesFFT.left.push(fftFrame);
    framesFFT.right.push({ ...fftFrame }); // Cópia para canal direito
    framesFFT.timestamps.push(timestamp);
    
    // Mock RMS frame
    let rmsL = 0, rmsR = 0;
    const endSample = Math.min(startSample + frameSize, leftChannel.length);
    for (let s = startSample; s < endSample; s++) {
      rmsL += leftChannel[s] ** 2;
      rmsR += rightChannel[s] ** 2;
    }
    rmsL = Math.sqrt(rmsL / (endSample - startSample));
    rmsR = Math.sqrt(rmsR / (endSample - startSample));
    
    framesRMS.left.push(rmsL);
    framesRMS.right.push(rmsR);
    framesRMS.timestamps.push(timestamp);
  }
  
  return {
    framesFFT,
    framesRMS,
    originalChannels: { left: leftChannel, right: rightChannel },
    timestamps: framesFFT.timestamps,
    metadata: {
      sampleRate,
      frameSize,
      hopSize,
      duration: leftChannel.length / sampleRate
    }
  };
}

/**
 * 🧪 Teste individual de correção
 */
async function testCorrection(testName, audioType, expectedResults = {}) {
  console.log(`\n🧪 ===== TESTE: ${testName} =====`);
  
  try {
    // 1. Gerar áudio sintético
    const audioData = generateTestAudio(audioType, 2.0); // 2 segundos
    console.log(`📊 Áudio gerado: ${audioType}, ${audioData.leftChannel.length} samples`);
    
    // 2. Mock segmentação temporal
    const segmentedAudio = mockTemporalSegmentation(
      audioData.leftChannel, 
      audioData.rightChannel
    );
    console.log(`📦 Segmentação: ${segmentedAudio.framesFFT.count} frames`);
    
    // 3. Processar com core metrics
    const processor = new CoreMetricsProcessor();
    const result = await processor.processMetrics(segmentedAudio, {
      jobId: `test_${audioType}_${Date.now()}`,
      fileName: `test_${audioType}.wav`
    });
    
    // 4. Validar resultados esperados
    console.log(`\n✅ Processamento concluído!`);
    console.log(`📊 LUFS: ${result.lufs?.integrated?.toFixed(2) || 'null'} LUFS`);
    console.log(`🏔️ True Peak: ${result.truePeak?.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    console.log(`🔗 Correlação: ${result.stereo?.correlation?.toFixed(3) || 'null'}`);
    console.log(`🎵 Spectral Centroid: ${result.fft?.spectralCentroid?.toFixed(1) || 'null'} Hz`);
    
    // 5. Verificar expectativas
    let testsPassed = 0;
    let testsTotal = 0;
    
    Object.entries(expectedResults).forEach(([metric, expected]) => {
      testsTotal++;
      const actual = getMetricValue(result, metric);
      const passed = checkExpectation(actual, expected);
      
      console.log(`${passed ? '✅' : '❌'} ${metric}: esperado ${expected}, obtido ${actual}`);
      if (passed) testsPassed++;
    });
    
    const success = testsPassed === testsTotal;
    console.log(`\n📈 Resultado: ${testsPassed}/${testsTotal} testes passaram`);
    console.log(`🧪 ===== FIM TESTE: ${testName} ${success ? '✅' : '❌'} =====`);
    
    return { success, result, testsPassed, testsTotal };
    
  } catch (error) {
    console.error(`❌ Erro no teste ${testName}:`, error.message);
    console.log(`🧪 ===== FIM TESTE: ${testName} ❌ =====`);
    return { success: false, error: error.message };
  }
}

/**
 * 🔍 Obter valor de métrica aninhada
 */
function getMetricValue(result, metric) {
  const path = metric.split('.');
  let value = result;
  
  for (const key of path) {
    value = value?.[key];
  }
  
  return value;
}

/**
 * ✅ Verificar expectativa
 */
function checkExpectation(actual, expected) {
  if (expected === 'null') {
    return actual === null;
  }
  
  if (expected === 'not_null') {
    return actual !== null && actual !== undefined;
  }
  
  if (typeof expected === 'string' && expected.includes('±')) {
    const [target, tolerance] = expected.split('±').map(Number);
    return Math.abs(actual - target) <= tolerance;
  }
  
  if (typeof expected === 'string' && expected.includes('<')) {
    const threshold = parseFloat(expected.substring(1));
    return actual < threshold;
  }
  
  if (typeof expected === 'string' && expected.includes('>')) {
    const threshold = parseFloat(expected.substring(1));
    return actual > threshold;
  }
  
  return actual === expected;
}

/**
 * 🏃‍♂️ Executar bateria completa de testes
 */
async function runAllCorrectionsTests() {
  console.log('🧪 ===== BATERIA COMPLETA DE TESTES DE CORREÇÕES =====');
  
  const tests = [
    {
      name: 'Normalização + LUFS',
      audioType: 'sine',
      expected: {
        'normalization.applied': true,
        'lufs.integrated': '-23±1', // Deve estar próximo de -23 LUFS
        'lufs.originalLUFS': 'not_null'
      }
    },
    {
      name: 'True Peak válido',
      audioType: 'hot_signal',
      expected: {
        'truePeak.maxDbtp': 'not_null',
        'truePeak.maxDbtp': '>-10' // Sinal alto
      }
    },
    {
      name: 'Silêncio digital',
      audioType: 'silence',
      expected: {
        'truePeak.maxDbtp': 'null',
        'stereo.correlation': 'null',
        'normalization.isSilence': true
      }
    },
    {
      name: 'Correlação negativa',
      audioType: 'stereo_correlation',
      expected: {
        'stereo.correlation': '<-0.5', // Canais invertidos
        'stereo.correlation': 'not_null'
      }
    },
    {
      name: 'FFT Spectral Centroid',
      audioType: 'sine',
      expected: {
        'fft.spectralCentroid': '1000±200' // Deve detectar ~1kHz
      }
    }
  ];
  
  const results = [];
  let totalPassed = 0;
  let totalTests = 0;
  
  for (const test of tests) {
    const result = await testCorrection(test.name, test.audioType, test.expected);
    results.push(result);
    
    if (result.success) {
      totalPassed += result.testsPassed || 0;
      totalTests += result.testsTotal || 0;
    }
  }
  
  console.log('\n🏆 ===== RESUMO FINAL =====');
  console.log(`📊 Testes individuais: ${totalPassed}/${totalTests} passaram`);
  console.log(`🧪 Suites de teste: ${results.filter(r => r.success).length}/${results.length} bem-sucedidas`);
  
  const overallSuccess = results.every(r => r.success);
  console.log(`🎯 Resultado geral: ${overallSuccess ? '✅ SUCESSO' : '❌ FALHAS'}`);
  console.log('🏆 ===== FIM BATERIA DE TESTES =====\n');
  
  return { overallSuccess, results, totalPassed, totalTests };
}

// 📤 Exportar para uso
export { runAllCorrectionsTests, testCorrection, generateTestAudio };

console.log('🧪 Sistema de testes de correções carregado');