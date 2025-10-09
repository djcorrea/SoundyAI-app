/**
 * 🧪 TESTES DE AUDITORIA - TRUE PEAK (dBTP)
 * 
 * Validação da implementação EBU Tech 3341
 * Testes com sinais críticos para intersample peaks
 */

import { TruePeakDetector, analyzeTruePeaks, TRUE_PEAK_CLIP_THRESHOLD_DBTP } from '../../lib/audio/features/truepeak.js';

// Tolerâncias para aprovação
const TRUEPEAK_TOLERANCE = 0.1; // ±0.1 dB

/**
 * 🎵 Gerador de sinais críticos para True Peak
 */
class TruePeakSignalGenerator {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * 🎼 Sine 997Hz -0.3dBFS (intersample peak test)
   * Este sinal deve produzir True Peak > 0 dBTP devido à reconstrução
   */
  generateIntersamplePeakSine(frequency = 997, durationSeconds = 5, targetDbfs = -0.3) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const targetLinear = Math.pow(10, targetDbfs / 20);
    const omega = 2 * Math.PI * frequency / this.sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const sineValue = Math.sin(omega * i) * targetLinear;
      leftChannel[i] = sineValue;
      rightChannel[i] = sineValue;
    }
    
    return { leftChannel, rightChannel };
  }

  /**
   * 📊 Hard Clipped Sine (sample clipping test)
   */
  generateClippedSine(frequency = 1000, durationSeconds = 3, clippingLevel = 0.95) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const omega = 2 * Math.PI * frequency / this.sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      let sineValue = Math.sin(omega * i);
      
      // Hard clipping
      if (sineValue > clippingLevel) sineValue = clippingLevel;
      if (sineValue < -clippingLevel) sineValue = -clippingLevel;
      
      leftChannel[i] = sineValue;
      rightChannel[i] = sineValue;
    }
    
    return { leftChannel, rightChannel };
  }

  /**
   * 📈 Impulse Train (Dirac impulses)
   * Testa resposta a transientes
   */
  generateImpulseTrain(impulseSpacing = 0.1, amplitude = 0.8, durationSeconds = 2) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const spacingSamples = Math.floor(this.sampleRate * impulseSpacing);
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i += spacingSamples) {
      if (i < numSamples) {
        leftChannel[i] = amplitude;
        rightChannel[i] = amplitude;
      }
    }
    
    return { leftChannel, rightChannel };
  }

  /**
   * 🔄 Sine Sweep (frequency sweep para testar diferentes frequências)
   */
  generateSineSweep(startFreq = 20, endFreq = 20000, durationSeconds = 5, amplitude = 0.5) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    const freqRange = endFreq - startFreq;
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const progress = t / durationSeconds;
      const currentFreq = startFreq + (freqRange * progress);
      const phase = 2 * Math.PI * currentFreq * t;
      
      const sineValue = Math.sin(phase) * amplitude;
      leftChannel[i] = sineValue;
      rightChannel[i] = sineValue;
    }
    
    return { leftChannel, rightChannel };
  }

  /**
   * 🎚️ DC + Sine (teste com DC offset)
   */
  generateDCPlusSine(frequency = 1000, dcLevel = 0.1, sineLevel = 0.7, durationSeconds = 3) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const omega = 2 * Math.PI * frequency / this.sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const sineValue = Math.sin(omega * i) * sineLevel;
      const totalValue = dcLevel + sineValue;
      
      leftChannel[i] = totalValue;
      rightChannel[i] = totalValue;
    }
    
    return { leftChannel, rightChannel };
  }
}

/**
 * 🧪 Suite de testes True Peak
 */
class TruePeakTestSuite {
  constructor() {
    this.generator = new TruePeakSignalGenerator();
    this.results = [];
  }

  /**
   * 🎯 Teste Intersample Peak (997Hz)
   */
  async testIntersamplePeak() {
    console.log('🧪 Testando Intersample Peak (997Hz -0.3dBFS)...');
    
    const { leftChannel, rightChannel } = this.generator.generateIntersamplePeakSine(997, 5, -0.3);
    const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
    
    // True Peak deve ser > Sample Peak e > 0 dBTP
    const truePeak = result.truePeakDbtp;
    const samplePeak = result.samplePeakDb;
    const exceedsZero = truePeak > 0;
    const exceedsSample = truePeak > samplePeak;
    
    const testResult = {
      name: 'Intersample Peak (997Hz)',
      truePeak,
      samplePeak,
      exceedsZero,
      exceedsSample,
      passed: exceedsZero && exceedsSample,
      details: {
        frequency: '997Hz',
        input_level: '-0.3dBFS',
        oversampling: result.oversampling_factor,
        mode: result.true_peak_mode
      }
    };
    
    this.results.push(testResult);
    console.log(`${testResult.passed ? '✅' : '❌'} Intersample Peak: TP=${truePeak.toFixed(2)}dBTP, SP=${samplePeak.toFixed(2)}dB`);
    console.log(`   Exceeds 0dBTP: ${exceedsZero}, Exceeds Sample: ${exceedsSample}`);
    
    return testResult;
  }

  /**
   * 🔥 Teste Clipped Sine
   */
  async testClippedSine() {
    console.log('🧪 Testando Clipped Sine...');
    
    const { leftChannel, rightChannel } = this.generator.generateClippedSine(1000, 3, 0.95);
    const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
    
    // True Peak deve detectar clipping (>= clipping level)
    const truePeak = result.truePeakDbtp;
    const clippingDetected = result.exceeds_minus1dbtp;
    const expectedMinDbtp = 20 * Math.log10(0.95); // ~-0.4dBTP
    
    const testResult = {
      name: 'Clipped Sine',
      truePeak,
      expectedMin: expectedMinDbtp,
      clippingDetected,
      passed: truePeak >= expectedMinDbtp - TRUEPEAK_TOLERANCE,
      details: {
        clipping_level: '0.95 full scale',
        sample_clipping_count: result.sample_clipping_count,
        clipping_percentage: result.clipping_percentage
      }
    };
    
    this.results.push(testResult);
    console.log(`${testResult.passed ? '✅' : '❌'} Clipped Sine: ${truePeak.toFixed(2)}dBTP (expected >=${expectedMinDbtp.toFixed(2)})`);
    
    return testResult;
  }

  /**
   * ⚡ Teste Impulse Train
   */
  async testImpulseTrain() {
    console.log('🧪 Testando Impulse Train...');
    
    const { leftChannel, rightChannel } = this.generator.generateImpulseTrain(0.1, 0.8, 2);
    const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
    
    // True Peak deve ser >= Sample Peak
    const truePeak = result.truePeakDbtp;
    const samplePeak = result.samplePeakDb;
    const expected = 20 * Math.log10(0.8); // ~-1.9dBTP
    const error = Math.abs(truePeak - expected);
    
    const testResult = {
      name: 'Impulse Train',
      truePeak,
      samplePeak,
      expected,
      error,
      passed: error <= TRUEPEAK_TOLERANCE && truePeak >= samplePeak,
      details: {
        impulse_amplitude: '0.8',
        spacing: '0.1s',
        interpolation_benefit: truePeak - samplePeak
      }
    };
    
    this.results.push(testResult);
    console.log(`${testResult.passed ? '✅' : '❌'} Impulse Train: TP=${truePeak.toFixed(2)}dBTP, SP=${samplePeak.toFixed(2)}dB`);
    
    return testResult;
  }

  /**
   * 🔄 Teste Sine Sweep
   */
  async testSineSweep() {
    console.log('🧪 Testando Sine Sweep (20Hz-20kHz)...');
    
    const { leftChannel, rightChannel } = this.generator.generateSineSweep(20, 20000, 5, 0.5);
    const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
    
    // True Peak deve ser próximo ao nível de entrada (0.5 = -6dBFS)
    const truePeak = result.truePeakDbtp;
    const expected = 20 * Math.log10(0.5); // -6.02dBTP
    const error = Math.abs(truePeak - expected);
    
    const testResult = {
      name: 'Sine Sweep (20Hz-20kHz)',
      truePeak,
      expected,
      error,
      passed: error <= 1.0, // Tolerância maior para sweep
      details: {
        freq_range: '20Hz-20kHz',
        duration: '5s',
        amplitude: '0.5 (-6dBFS)',
        frequency_dependent_behavior: 'Sweep tests all frequencies'
      }
    };
    
    this.results.push(testResult);
    console.log(`${testResult.passed ? '✅' : '❌'} Sine Sweep: ${truePeak.toFixed(2)}dBTP (expected ${expected.toFixed(2)}, error: ${error.toFixed(2)}dB)`);
    
    return testResult;
  }

  /**
   * 🎚️ Teste DC + Sine
   */
  async testDCPlusSine() {
    console.log('🧪 Testando DC + Sine...');
    
    const { leftChannel, rightChannel } = this.generator.generateDCPlusSine(1000, 0.1, 0.7, 3);
    const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
    
    // Peak total = DC + sine amplitude = 0.1 + 0.7 = 0.8
    const truePeak = result.truePeakDbtp;
    const expected = 20 * Math.log10(0.8); // ~-1.9dBTP
    const error = Math.abs(truePeak - expected);
    
    const testResult = {
      name: 'DC + Sine',
      truePeak,
      expected,
      error,
      passed: error <= TRUEPEAK_TOLERANCE,
      details: {
        dc_level: '0.1',
        sine_amplitude: '0.7', 
        total_peak: '0.8',
        tests_dc_handling: true
      }
    };
    
    this.results.push(testResult);
    console.log(`${testResult.passed ? '✅' : '❌'} DC + Sine: ${truePeak.toFixed(2)}dBTP (expected ${expected.toFixed(2)}, error: ${error.toFixed(2)}dB)`);
    
    return testResult;
  }

  /**
   * 🏃 Executar todos os testes
   */
  async runAllTests() {
    console.log('🧪 Iniciando Suite de Testes True Peak...\n');
    
    try {
      await this.testIntersamplePeak();
      await this.testClippedSine();
      await this.testImpulseTrain();
      await this.testSineSweep();
      await this.testDCPlusSine();
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ Erro durante os testes True Peak:', error);
      throw error;
    }
  }

  /**
   * 📋 Gerar relatório final
   */
  generateReport() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const passRate = (passed / total) * 100;
    
    console.log('\n📋 RELATÓRIO FINAL - TRUE PEAK TESTS');
    console.log('======================================');
    console.log(`Aprovados: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}: ${result.truePeak.toFixed(2)}dBTP`);
    });
    
    const overallStatus = passRate >= 80 ? 'PASS' : 'FAIL';
    console.log(`\n🎯 STATUS GERAL: ${overallStatus}`);
    
    return {
      overallStatus,
      passRate,
      results: this.results,
      summary: {
        total,
        passed,
        failed: total - passed
      }
    };
  }
}

/**
 * 🔧 Validar configurações True Peak
 */
function validateTruePeakConfiguration() {
  console.log('🔧 Validando Configuração True Peak...');
  
  const tests = [
    {
      name: 'Clip Threshold',
      value: TRUE_PEAK_CLIP_THRESHOLD_DBTP,
      expected: -1.0,
      tolerance: 0.001
    }
  ];
  
  let allValid = true;
  tests.forEach(test => {
    const valid = Math.abs(test.value - test.expected) < test.tolerance;
    console.log(`${valid ? '✅' : '❌'} ${test.name}: ${test.value}dBTP (expected ${test.expected})`);
    if (!valid) allValid = false;
  });
  
  // Teste básico do detector
  try {
    const detector = new TruePeakDetector(48000);
    const testSignal = new Float32Array(1024);
    testSignal[0] = 0.5; // Impulse
    
    const result = detector.detectTruePeak(testSignal);
    const hasValidResult = Number.isFinite(result.maxDbtp);
    
    console.log(`${hasValidResult ? '✅' : '❌'} Detector Instance: ${hasValidResult ? 'Valid' : 'Invalid'}`);
    if (!hasValidResult) allValid = false;
  } catch (error) {
    console.log(`❌ Detector Instance: Error - ${error.message}`);
    allValid = false;
  }
  
  return allValid;
}

// Export para uso em testes
export {
  TruePeakTestSuite,
  TruePeakSignalGenerator,
  validateTruePeakConfiguration
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.TruePeakTestSuite = TruePeakTestSuite;
  window.runTruePeakAudit = async () => {
    const suite = new TruePeakTestSuite();
    return await suite.runAllTests();
  };
}