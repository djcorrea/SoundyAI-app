// 🧪 TESTES AUTOMÁTICOS - Métricas Espectrais
// Validação matemática das 8 métricas espectrais

import { SpectralMetricsCalculator, SpectralMetricsAggregator, serializeSpectralMetrics } from './work/lib/audio/features/spectral-metrics.js';

console.log('🧪 Iniciando testes de métricas espectrais...\n');

/**
 * 🎯 Gerador de sinais de teste
 */
class TestSignalGenerator {
  
  /**
   * 🎵 Gerar sinal senoidal puro (1kHz para teste centroide)
   */
  static generateSineWave(frequency, sampleRate, fftSize) {
    const magnitude = new Float32Array(Math.floor(fftSize / 2) + 1);
    const frequencyResolution = sampleRate / fftSize;
    const targetBin = Math.round(frequency / frequencyResolution);
    
    // Colocar energia apenas no bin da frequência desejada
    magnitude[targetBin] = 1.0;
    
    return magnitude;
  }
  
  /**
   * 🟨 Gerar ruído branco (energia uniforme em todas as frequências)
   */
  static generateWhiteNoise(fftSize) {
    const magnitude = new Float32Array(Math.floor(fftSize / 2) + 1);
    
    // Energia uniforme em todas as frequências (exceto DC)
    for (let i = 1; i < magnitude.length; i++) {
      magnitude[i] = 1.0;
    }
    
    return magnitude;
  }
  
  /**
   * 🟪 Gerar ruído rosa (energia decresce com frequência)
   */
  static generatePinkNoise(sampleRate, fftSize) {
    const magnitude = new Float32Array(Math.floor(fftSize / 2) + 1);
    const frequencyResolution = sampleRate / fftSize;
    
    // Pink noise: energia proporcional a 1/f
    for (let i = 1; i < magnitude.length; i++) {
      const frequency = i * frequencyResolution;
      magnitude[i] = 1.0 / Math.sqrt(frequency);
    }
    
    return magnitude;
  }
}

/**
 * 🎯 Validador de testes
 */
class TestValidator {
  
  static validateCentroid(result, expectedHz, tolerance = 10) {
    const actual = result.spectralCentroidHz;
    if (actual === null) {
      console.log(`❌ Centroide: null (esperado: ${expectedHz}Hz)`);
      return false;
    }
    
    const diff = Math.abs(actual - expectedHz);
    const withinTolerance = diff <= tolerance;
    
    console.log(`${withinTolerance ? '✅' : '❌'} Centroide: ${actual.toFixed(1)}Hz (esperado: ${expectedHz}±${tolerance}Hz, diff: ${diff.toFixed(1)}Hz)`);
    return withinTolerance;
  }
  
  static validateRolloff(result, minExpectedHz, maxExpectedHz) {
    const actual = result.spectralRolloffHz;
    if (actual === null) {
      console.log(`❌ Rolloff: null (esperado: ${minExpectedHz}-${maxExpectedHz}Hz)`);
      return false;
    }
    
    const withinRange = actual >= minExpectedHz && actual <= maxExpectedHz;
    
    console.log(`${withinRange ? '✅' : '❌'} Rolloff: ${actual.toFixed(1)}Hz (esperado: ${minExpectedHz}-${maxExpectedHz}Hz)`);
    return withinRange;
  }
  
  static validateFlatness(result, minExpected, maxExpected) {
    const actual = result.spectralFlatness;
    if (actual === null) {
      console.log(`❌ Flatness: null (esperado: ${minExpected}-${maxExpected})`);
      return false;
    }
    
    const withinRange = actual >= minExpected && actual <= maxExpected;
    
    console.log(`${withinRange ? '✅' : '❌'} Flatness: ${actual.toFixed(3)} (esperado: ${minExpected}-${maxExpected})`);
    return withinRange;
  }
  
  static validateCrest(result, minExpected) {
    const actual = result.spectralCrest;
    if (actual === null) {
      console.log(`❌ Crest: null (esperado: ≥${minExpected})`);
      return false;
    }
    
    const valid = actual >= minExpected;
    
    console.log(`${valid ? '✅' : '❌'} Crest: ${actual.toFixed(2)} (esperado: ≥${minExpected})`);
    return valid;
  }
  
  static validateNotNull(result, metricName) {
    const actual = result[metricName];
    const valid = actual !== null && Number.isFinite(actual);
    
    console.log(`${valid ? '✅' : '❌'} ${metricName}: ${actual?.toFixed?.(2) || 'null'} (esperado: não-null)`);
    return valid;
  }
  
  static validateRange(result, metricName, min, max) {
    const actual = result[metricName];
    if (actual === null) {
      console.log(`❌ ${metricName}: null (esperado: ${min}-${max})`);
      return false;
    }
    
    const valid = actual >= min && actual <= max;
    
    console.log(`${valid ? '✅' : '❌'} ${metricName}: ${actual.toFixed(2)} (esperado: ${min}-${max})`);
    return valid;
  }
}

/**
 * 🧪 Executar todos os testes
 */
async function runAllTests() {
  const sampleRate = 48000;
  const fftSize = 4096;
  const calculator = new SpectralMetricsCalculator(sampleRate, fftSize);
  
  let totalTests = 0;
  let passedTests = 0;
  
  function test(name, testFn) {
    console.log(`\n🔬 ${name}`);
    console.log('='.repeat(50));
    totalTests++;
    
    try {
      const passed = testFn();
      if (passed) {
        passedTests++;
        console.log(`\n✅ PASSOU`);
      } else {
        console.log(`\n❌ FALHOU`);
      }
    } catch (error) {
      console.log(`\n💥 ERRO: ${error.message}`);
    }
  }
  
  // ========= TESTE 1: SINAL SENOIDAL 1KHZ =========
  test('Sinal Senoidal 1kHz - Centroide deve ser ~1000Hz', () => {
    const magnitude = TestSignalGenerator.generateSineWave(1000, sampleRate, fftSize);
    const result = calculator.calculateAllMetrics(magnitude);
    
    let allPassed = true;
    
    allPassed &= TestValidator.validateCentroid(result, 1000, 20);
    allPassed &= TestValidator.validateRolloff(result, 900, 1100);
    allPassed &= TestValidator.validateRange(result, 'spectralFlatness', 0, 1);
    allPassed &= TestValidator.validateCrest(result, 2);
    allPassed &= TestValidator.validateRange(result, 'spectralBandwidthHz', 0, 500);
    allPassed &= TestValidator.validateNotNull(result, 'spectralSpreadHz');
    allPassed &= TestValidator.validateNotNull(result, 'spectralSkewness');
    allPassed &= TestValidator.validateNotNull(result, 'spectralKurtosis');
    
    return allPassed;
  });
  
  // ========= TESTE 2: RUÍDO BRANCO =========
  test('Ruído Branco - Energia uniforme, centroide ~12kHz', () => {
    const magnitude = TestSignalGenerator.generateWhiteNoise(fftSize);
    const result = calculator.calculateAllMetrics(magnitude);
    
    let allPassed = true;
    
    // Para ruído branco, centroide deve estar próximo de Nyquist/2 = 12kHz
    allPassed &= TestValidator.validateCentroid(result, 12000, 2000);
    allPassed &= TestValidator.validateRolloff(result, 18000, 24000);
    allPassed &= TestValidator.validateFlatness(result, 0.8, 1.0); // Deve ser alta para ruído branco
    allPassed &= TestValidator.validateRange(result, 'spectralCrest', 1, 3);
    allPassed &= TestValidator.validateNotNull(result, 'spectralBandwidthHz');
    allPassed &= TestValidator.validateNotNull(result, 'spectralSpreadHz');
    allPassed &= TestValidator.validateNotNull(result, 'spectralSkewness');
    allPassed &= TestValidator.validateNotNull(result, 'spectralKurtosis');
    
    return allPassed;
  });
  
  // ========= TESTE 3: RUÍDO ROSA =========
  test('Ruído Rosa - Energia decresce com frequência', () => {
    const magnitude = TestSignalGenerator.generatePinkNoise(sampleRate, fftSize);
    const result = calculator.calculateAllMetrics(magnitude);
    
    let allPassed = true;
    
    // Para ruído rosa, centroide deve ser menor que ruído branco
    allPassed &= TestValidator.validateCentroid(result, 8000, 3000);
    allPassed &= TestValidator.validateRolloff(result, 10000, 20000);
    allPassed &= TestValidator.validateRange(result, 'spectralFlatness', 0.3, 0.8);
    allPassed &= TestValidator.validateRange(result, 'spectralCrest', 1, 5);
    allPassed &= TestValidator.validateNotNull(result, 'spectralBandwidthHz');
    allPassed &= TestValidator.validateNotNull(result, 'spectralSpreadHz');
    allPassed &= TestValidator.validateNotNull(result, 'spectralSkewness');
    allPassed &= TestValidator.validateNotNull(result, 'spectralKurtosis');
    
    return allPassed;
  });
  
  // ========= TESTE 4: SILÊNCIO =========
  test('Silêncio - Todas as métricas devem ser null', () => {
    const magnitude = new Float32Array(Math.floor(fftSize / 2) + 1); // Zeros
    const result = calculator.calculateAllMetrics(magnitude);
    
    const allNull = Object.values(result).every(v => v === null);
    
    console.log(`Resultado completo: ${JSON.stringify(result, null, 2)}`);
    console.log(`${allNull ? '✅' : '❌'} Todas as métricas são null: ${allNull}`);
    
    return allNull;
  });
  
  // ========= TESTE 5: AGREGAÇÃO =========
  test('Agregação de Múltiplos Frames', () => {
    const frames = [
      TestSignalGenerator.generateSineWave(1000, sampleRate, fftSize),
      TestSignalGenerator.generateSineWave(1500, sampleRate, fftSize),
      TestSignalGenerator.generateSineWave(2000, sampleRate, fftSize)
    ];
    
    const results = frames.map(mag => calculator.calculateAllMetrics(mag));
    const aggregated = SpectralMetricsAggregator.aggregate(results);
    const serialized = serializeSpectralMetrics(aggregated);
    
    let allPassed = true;
    
    // Centroide agregado deve estar próximo da mediana (1500Hz)
    allPassed &= TestValidator.validateCentroid(serialized, 1500, 100);
    allPassed &= TestValidator.validateNotNull(serialized, 'spectralRolloffHz');
    allPassed &= TestValidator.validateNotNull(serialized, 'spectralBandwidthHz');
    allPassed &= TestValidator.validateNotNull(serialized, 'spectralSpreadHz');
    allPassed &= TestValidator.validateNotNull(serialized, 'spectralFlatness');
    allPassed &= TestValidator.validateNotNull(serialized, 'spectralCrest');
    
    console.log(`\n📊 Resultado agregado serializado:`);
    console.log(JSON.stringify(serialized, null, 2));
    
    return allPassed;
  });
  
  // ========= RELATÓRIO FINAL =========
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 RELATÓRIO FINAL: ${passedTests}/${totalTests} testes passaram`);
  
  if (passedTests === totalTests) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Sistema espectral validado.');
  } else {
    console.log(`❌ ${totalTests - passedTests} teste(s) falharam. Verifique a implementação.`);
  }
  
  return passedTests === totalTests;
}

// Executar testes se o arquivo for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Erro nos testes:', error);
    process.exit(1);
  });
}

export { runAllTests, TestSignalGenerator, TestValidator };