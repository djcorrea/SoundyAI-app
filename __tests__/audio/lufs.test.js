/**
 * 🧪 TESTES DE AUDITORIA - MÉTRICAS LUFS V2 (ITU-R BS.1770-4 CORRIGIDA)
 * 
 * Validação da implementação corrigida com feature flag
 * Comparação com sinais sintéticos de referência
 */

import { analyzeLUFSv2, calculateLoudnessMetricsV2, K_WEIGHTING_COEFFS_V2, LUFS_CONSTANTS } from '../../work/lib/audio/features/loudness.js';

// Tolerâncias para aprovação
const LUFS_TOLERANCE = 0.5; // ±0.5 LU
const LRA_TOLERANCE = 0.3;  // ±0.3 LU

/**
 * 🎵 Gerador de sinais sintéticos
 */
class SyntheticSignalGenerator {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * 📊 Pink Noise (-20dBFS, 30s)
   * Esperado: ~-20 LUFS ±0.5
   */
  generatePinkNoise(durationSeconds = 30, targetDbfs = -20) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const targetLinear = Math.pow(10, targetDbfs / 20);
    
    // Pink noise using Paul Kellet's algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const white = (Math.random() * 2 - 1);
      
      // Pink filtering
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      
      samples[i] = pink * targetLinear * 0.11; // Normalização
    }
    
    return samples;
  }

  /**
   * 🎼 Sine Wave (1kHz, -18dBFS, 15s)  
   * Esperado: ~-18 LUFS ±0.5
   */
  generateSineWave(frequency = 1000, durationSeconds = 15, targetDbfs = -18) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const targetLinear = Math.pow(10, targetDbfs / 20);
    const omega = 2 * Math.PI * frequency / this.sampleRate;
    
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(omega * i) * targetLinear;
    }
    
    return samples;
  }

  /**
   * 🌐 White Noise (-14dBFS, 30s)
   * Esperado: ~-14 LUFS ±0.5
   */
  generateWhiteNoise(durationSeconds = 30, targetDbfs = -14) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const targetLinear = Math.pow(10, targetDbfs / 20);
    
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      samples[i] = (Math.random() * 2 - 1) * targetLinear;
    }
    
    return samples;
  }

  /**
   * � Silence (para testar gating)
   */
  generateSilence(durationSeconds = 10) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    return new Float32Array(numSamples); // Já zerado
  }

  /**
   * 🎯 Converter mono para estéreo intercalado
   */
  monoToStereoIntercalated(monoSamples) {
    const stereoSamples = new Float32Array(monoSamples.length * 2);
    for (let i = 0; i < monoSamples.length; i++) {
      stereoSamples[i * 2] = monoSamples[i];     // L
      stereoSamples[i * 2 + 1] = monoSamples[i]; // R
    }
    return stereoSamples;
  }
}

/**
 * 🧪 Suite de testes LUFS V2
 */
class LUFSTestSuiteV2 {
  constructor() {
    this.generator = new SyntheticSignalGenerator();
    this.results = [];
  }

  /**
   * 🎯 Teste Pink Noise -20dBFS → -20 LUFS ±0.5
   */
  async testPinkNoise() {
    console.log('🧪 [V2] Testando Pink Noise -20dBFS...');
    
    const monoSamples = this.generator.generatePinkNoise(30, -20);
    const stereoSamples = this.generator.monoToStereoIntercalated(monoSamples);
    
    const result = await analyzeLUFSv2(stereoSamples, 48000, { channels: 2 });
    
    const expected = -20.0;
    const measured = result.integrated;
    const error = Math.abs(measured - expected);
    const passed = error <= LUFS_TOLERANCE;
    
    const testResult = {
      name: 'Pink Noise -20dBFS → -20 LUFS',
      expected,
      measured,
      error,
      tolerance: LUFS_TOLERANCE,
      passed,
      details: {
        short_term: result.shortTerm,
        momentary: result.momentary,
        duration: '30s',
        signal_type: 'pink_noise'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Pink Noise: ${measured.toFixed(2)} LUFS (expected ${expected}, error: ${error.toFixed(2)} LU)`);
    
    return testResult;
  }

  /**
   * 🎼 Teste 1 kHz Tone -18dBFS → -18 LUFS ±0.5
   */
  async testSineWave() {
    console.log('🧪 [V2] Testando 1 kHz Tone -18dBFS...');
    
    const monoSamples = this.generator.generateSineWave(1000, 15, -18);
    const stereoSamples = this.generator.monoToStereoIntercalated(monoSamples);
    
    const result = await analyzeLUFSv2(stereoSamples, 48000, { channels: 2 });
    
    const expected = -18.0;
    const measured = result.integrated;
    const error = Math.abs(measured - expected);
    const passed = error <= LUFS_TOLERANCE;
    
    const testResult = {
      name: '1 kHz Tone -18dBFS → -18 LUFS',
      expected,
      measured,
      error,
      tolerance: LUFS_TOLERANCE,
      passed,
      details: {
        short_term: result.shortTerm,
        momentary: result.momentary,
        duration: '15s',
        signal_type: '1kHz_sine'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} 1kHz Tone: ${measured.toFixed(2)} LUFS (expected ${expected}, error: ${error.toFixed(2)} LU)`);
    
    return testResult;
  }

  /**
   * 🌐 Teste White Noise -14dBFS → -14 LUFS ±0.5
   */
  async testWhiteNoise() {
    console.log('🧪 [V2] Testando White Noise -14dBFS...');
    
    const monoSamples = this.generator.generateWhiteNoise(30, -14);
    const stereoSamples = this.generator.monoToStereoIntercalated(monoSamples);
    
    const result = await analyzeLUFSv2(stereoSamples, 48000, { channels: 2 });
    
    const expected = -14.0;
    const measured = result.integrated;
    const error = Math.abs(measured - expected);
    const passed = error <= LUFS_TOLERANCE;
    
    const testResult = {
      name: 'White Noise -14dBFS → -14 LUFS',
      expected,
      measured,
      error,
      tolerance: LUFS_TOLERANCE,
      passed,
      details: {
        short_term: result.shortTerm,
        momentary: result.momentary,
        duration: '30s',
        signal_type: 'white_noise'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} White Noise: ${measured.toFixed(2)} LUFS (expected ${expected}, error: ${error.toFixed(2)} LU)`);
    
    return testResult;
  }

  /**
   * 🔇 Teste Silence → -∞ LUFS (gated)
   */
  async testSilence() {
    console.log('🧪 [V2] Testando Silence (gating)...');
    
    const monoSamples = this.generator.generateSilence(10);
    const stereoSamples = this.generator.monoToStereoIntercalated(monoSamples);
    
    const result = await analyzeLUFSv2(stereoSamples, 48000, { channels: 2 });
    
    const expected = -Infinity;
    const measured = result.integrated;
    const passed = measured === -Infinity;
    
    const testResult = {
      name: 'Silence → -∞ LUFS (gated)',
      expected,
      measured,
      error: passed ? 0 : Infinity,
      tolerance: 'Exact -Infinity',
      passed,
      details: {
        short_term: result.shortTerm,
        momentary: result.momentary,
        duration: '10s',
        signal_type: 'silence'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Silence: ${measured} LUFS (expected -Infinity)`);
    
    return testResult;
  }

  /**
   * � Teste Sample Rate 44.1 kHz
   */
  async testDifferentSampleRate() {
    console.log('🧪 [V2] Testando 44.1 kHz Sample Rate...');
    
    const generator441 = new SyntheticSignalGenerator(44100);
    const monoSamples = generator441.generatePinkNoise(20, -20);
    const stereoSamples = generator441.monoToStereoIntercalated(monoSamples);
    
    const result = await analyzeLUFSv2(stereoSamples, 44100, { channels: 2 });
    
    const expected = -20.0;
    const measured = result.integrated;
    const error = Math.abs(measured - expected);
    const passed = error <= LUFS_TOLERANCE;
    
    const testResult = {
      name: 'Pink Noise -20dBFS @ 44.1kHz',
      expected,
      measured,
      error,
      tolerance: LUFS_TOLERANCE,
      passed,
      details: {
        sample_rate: 44100,
        duration: '20s',
        signal_type: 'pink_noise_441'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} 44.1kHz: ${measured.toFixed(2)} LUFS (expected ${expected}, error: ${error.toFixed(2)} LU)`);
    
    return testResult;
  }

  /**
   * ⚡ Teste Performance
   */
  async testPerformance() {
    console.log('🧪 [V2] Testando Performance...');
    
    const monoSamples = this.generator.generatePinkNoise(10, -20); // 10s
    const stereoSamples = this.generator.monoToStereoIntercalated(monoSamples);
    
    const startTime = Date.now();
    const result = await analyzeLUFSv2(stereoSamples, 48000, { channels: 2 });
    const processingTime = Date.now() - startTime;
    
    const passed = processingTime < 100; // Menos de 100ms
    
    const testResult = {
      name: 'Performance (<100ms para 10s)',
      expected: '<100ms',
      measured: `${processingTime}ms`,
      error: Math.max(0, processingTime - 100),
      tolerance: '100ms',
      passed,
      details: {
        samples_processed: stereoSamples.length,
        lufs_result: result.integrated.toFixed(1),
        performance_ratio: (10000 / processingTime).toFixed(1) + 'x realtime'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Performance: ${processingTime}ms para 10s de áudio (${(10000/processingTime).toFixed(1)}x realtime)`);
    
    return testResult;
  }

  /**
   * 🏃 Executar todos os testes
   */
  async runAllTests() {
    console.log('🧪 Iniciando Suite de Testes LUFS V2 (ITU-R BS.1770-4 CORRIGIDA)...\n');
    
    // Ativar feature flag
    process.env.FEATURE_FIX_LUFS_PINK_NOISE = 'true';
    process.env.DEBUG_LUFS = 'true';
    
    try {
      await this.testPinkNoise();
      await this.testSineWave();
      await this.testWhiteNoise();
      await this.testSilence();
      await this.testDifferentSampleRate();
      await this.testPerformance();
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
      throw error;
    } finally {
      // Limpar variáveis de ambiente
      delete process.env.FEATURE_FIX_LUFS_PINK_NOISE;
      delete process.env.DEBUG_LUFS;
    }
  }

  /**
   * 📋 Gerar relatório final
   */
  generateReport() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const passRate = (passed / total) * 100;
    
    console.log('\n📋 RELATÓRIO FINAL - LUFS V2 TESTS');
    console.log('==========================================');
    console.log(`Aprovados: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const measuredStr = typeof result.measured === 'number' ? 
        result.measured.toFixed(2) : result.measured;
      console.log(`${status} ${result.name}: ${measuredStr} (±${typeof result.error === 'number' ? result.error.toFixed(2) : result.error})`);
    });
    
    const overallStatus = passRate >= 83 ? 'PASS' : 'FAIL'; // 5/6 testes
    console.log(`\n🎯 STATUS GERAL: ${overallStatus}`);
    
    // Verificação específica do teste crítico (Pink Noise)
    const criticalTest = this.results.find(r => r.name.includes('Pink Noise -20dBFS'));
    if (criticalTest) {
      console.log(`\n🔥 TESTE CRÍTICO (Pink Noise): ${criticalTest.passed ? 'PASS' : 'FAIL'}`);
      console.log(`   Erro atual: ${criticalTest.error.toFixed(2)} LU (tolerância: ±${LUFS_TOLERANCE} LU)`);
    }
    
    return {
      overallStatus,
      passRate,
      results: this.results,
      summary: {
        total,
        passed,
        failed: total - passed,
        criticalTest: criticalTest?.passed || false
      }
    };
  }
}

/**
 * 🔧 Função utilitária para validar K-weighting V2
 */
function validateKWeightingCoefficientsV2() {
  console.log('🔧 Validando Coeficientes K-weighting V2...');
  
  const coeffs = K_WEIGHTING_COEFFS_V2;
  
  // Verificar se os coeficientes estão corretos
  const hShelfValid = (
    coeffs.H_SHELF.b.length === 3 &&
    coeffs.H_SHELF.a.length === 3 &&
    Math.abs(coeffs.H_SHELF.a[0] - 1.0) < 0.001 &&
    Math.abs(coeffs.H_SHELF.b[0] - 1.53512485958697) < 0.001
  );
  
  const hPreValid = (
    coeffs.H_PRE.b.length === 3 &&
    coeffs.H_PRE.a.length === 3 &&
    Math.abs(coeffs.H_PRE.a[0] - 1.0) < 0.001 &&
    Math.abs(coeffs.H_PRE.b[0] - 1.0) < 0.001
  );
  
  console.log(`${hShelfValid ? '✅' : '❌'} H_shelf coefficients valid`);
  console.log(`${hPreValid ? '✅' : '❌'} H_pre coefficients valid`);
  
  return hShelfValid && hPreValid;
}

// Export para uso em testes
export {
  LUFSTestSuiteV2,
  SyntheticSignalGenerator,
  validateKWeightingCoefficientsV2,
  LUFS_TOLERANCE
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.LUFSTestSuiteV2 = LUFSTestSuiteV2;
  window.runLUFSAuditV2 = async () => {
    const suite = new LUFSTestSuiteV2();
    return await suite.runAllTests();
  };
}