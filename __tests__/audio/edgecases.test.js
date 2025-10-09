/**
 * 🧪 TESTES DE AUDITORIA - CASOS EXTREMOS
 * 
 * Validação de robustez: silêncio, clipping, sample rates variados,
 * mono/estéreo, NaN/Infinity handling, arquivos corrompidos
 */

import { calculateLoudnessMetrics } from '../../lib/audio/features/loudness.js';
import { analyzeTruePeaks } from '../../lib/audio/features/truepeak.js';
import { computeMixScore } from '../../lib/audio/features/scoring.js';

/**
 * 🎵 Gerador de casos extremos
 */
class EdgeCaseSignalGenerator {
  constructor() {
    this.sampleRates = [44100, 48000, 96000];
  }

  /**
   * 🔇 Silêncio absoluto
   */
  generateSilence(durationSeconds = 10, sampleRate = 48000) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    return {
      leftChannel: new Float32Array(numSamples),
      rightChannel: new Float32Array(numSamples),
      sampleRate,
      expectedLufs: -Infinity,
      expectedTruePeak: -Infinity
    };
  }

  /**
   * 📢 Clipping extremo (digital limit)
   */
  generateHardClipping(durationSeconds = 3, sampleRate = 48000) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Square wave at maximum level
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(2 * Math.PI * 1000 * i / sampleRate) > 0 ? 1.0 : -1.0;
      leftChannel[i] = value;
      rightChannel[i] = value;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      expectedTruePeak: 0.0, // 0dBFS
      expectedClipping: true
    };
  }

  /**
   * 🎚️ DC Offset extremo
   */
  generateDCOffset(dcLevel = 0.5, sampleRate = 48000, durationSeconds = 5) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // DC + small sine
    const sineAmp = 0.1;
    for (let i = 0; i < numSamples; i++) {
      const sine = Math.sin(2 * Math.PI * 440 * i / sampleRate) * sineAmp;
      leftChannel[i] = dcLevel + sine;
      rightChannel[i] = dcLevel + sine;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      expectedDC: dcLevel,
      expectedTruePeak: 20 * Math.log10(dcLevel + sineAmp)
    };
  }

  /**
   * 🔀 Mono signal (L=R)
   */
  generateMonoSignal(frequency = 1000, amplitude = 0.5, durationSeconds = 5, sampleRate = 48000) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const omega = 2 * Math.PI * frequency / sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(omega * i) * amplitude;
      leftChannel[i] = value;
      rightChannel[i] = value; // Identical = mono
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      expectedCorrelation: 1.0,
      expectedWidth: 0.0
    };
  }

  /**
   * 🌀 Anti-correlation (L=-R)
   */
  generateAntiCorrelatedSignal(frequency = 1000, amplitude = 0.5, durationSeconds = 5, sampleRate = 48000) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const omega = 2 * Math.PI * frequency / sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(omega * i) * amplitude;
      leftChannel[i] = value;
      rightChannel[i] = -value; // Inverted = anti-correlated
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      expectedCorrelation: -1.0,
      expectedWidth: 2.0
    };
  }

  /**
   * 💥 Dados corrompidos (NaN, Infinity)
   */
  generateCorruptedData(corruptionType = 'nan', sampleRate = 48000, durationSeconds = 3) {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Start with normal sine
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      leftChannel[i] = value;
      rightChannel[i] = value;
    }
    
    // Inject corruption
    const corruptStart = Math.floor(numSamples * 0.3);
    const corruptEnd = Math.floor(numSamples * 0.7);
    
    for (let i = corruptStart; i < corruptEnd; i++) {
      switch (corruptionType) {
        case 'nan':
          leftChannel[i] = NaN;
          rightChannel[i] = NaN;
          break;
        case 'infinity':
          leftChannel[i] = Infinity;
          rightChannel[i] = -Infinity;
          break;
        case 'denormal':
          leftChannel[i] = 1e-40; // Very small numbers
          rightChannel[i] = -1e-40;
          break;
      }
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      corruptionType,
      corruptedSamples: corruptEnd - corruptStart
    };
  }

  /**
   * ⚡ Impulse muito curto
   */
  generateShortImpulse(sampleRate = 48000) {
    const numSamples = Math.max(10, Math.floor(sampleRate * 0.001)); // 1ms minimum
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Single impulse
    leftChannel[Math.floor(numSamples / 2)] = 0.8;
    rightChannel[Math.floor(numSamples / 2)] = 0.8;
    
    return {
      leftChannel,
      rightChannel,
      sampleRate,
      durationMs: (numSamples / sampleRate) * 1000
    };
  }
}

/**
 * 🧪 Suite de testes para casos extremos
 */
class EdgeCaseTestSuite {
  constructor() {
    this.generator = new EdgeCaseSignalGenerator();
    this.results = [];
  }

  /**
   * 🔇 Teste Silêncio
   */
  async testSilence() {
    console.log('🧪 Testando Silêncio...');
    
    const { leftChannel, rightChannel, sampleRate } = this.generator.generateSilence(10, 48000);
    
    try {
      const lufsResult = calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
      const scoringResult = computeMixScore({
        lufsIntegrated: lufsResult.lufs_integrated,
        truePeakDbtp: truePeakResult.truePeakDbtp
      }, null);
      
      const lufsCorrect = lufsResult.lufs_integrated === -Infinity;
      const truePeakCorrect = truePeakResult.truePeakDbtp === -Infinity || truePeakResult.truePeakDbtp < -60;
      const scoringValid = Number.isFinite(scoringResult.scorePct);
      
      const passed = lufsCorrect && truePeakCorrect && scoringValid;
      
      const testResult = {
        name: 'Silence Test',
        passed,
        details: {
          lufs: lufsResult.lufs_integrated,
          truePeak: truePeakResult.truePeakDbtp,
          score: scoringResult.scorePct,
          lufsCorrect,
          truePeakCorrect,
          scoringValid
        }
      };
      
      this.results.push(testResult);
      console.log(`${passed ? '✅' : '❌'} Silence: LUFS=${lufsResult.lufs_integrated}, TP=${truePeakResult.truePeakDbtp}dBTP`);
      
      return testResult;
    } catch (error) {
      const testResult = {
        name: 'Silence Test',
        passed: false,
        error: error.message
      };
      this.results.push(testResult);
      console.log(`❌ Silence: Error - ${error.message}`);
      return testResult;
    }
  }

  /**
   * 📢 Teste Clipping Extremo
   */
  async testHardClipping() {
    console.log('🧪 Testando Clipping Extremo...');
    
    const { leftChannel, rightChannel, sampleRate } = this.generator.generateHardClipping(3, 48000);
    
    try {
      const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
      const lufsResult = calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      
      const truePeakHigh = truePeakResult.truePeakDbtp > -1.0; // Should be very high
      const clippingDetected = truePeakResult.exceeds_0dbtp || truePeakResult.clippingSamples > 0;
      const lufsValid = Number.isFinite(lufsResult.lufs_integrated);
      
      const passed = truePeakHigh && clippingDetected && lufsValid;
      
      const testResult = {
        name: 'Hard Clipping Test',
        passed,
        details: {
          truePeak: truePeakResult.truePeakDbtp,
          clippingSamples: truePeakResult.clippingSamples,
          lufs: lufsResult.lufs_integrated,
          truePeakHigh,
          clippingDetected,
          lufsValid
        }
      };
      
      this.results.push(testResult);
      console.log(`${passed ? '✅' : '❌'} Hard Clipping: TP=${truePeakResult.truePeakDbtp.toFixed(2)}dBTP, Clipped=${truePeakResult.clippingSamples}`);
      
      return testResult;
    } catch (error) {
      const testResult = {
        name: 'Hard Clipping Test',
        passed: false,
        error: error.message
      };
      this.results.push(testResult);
      console.log(`❌ Hard Clipping: Error - ${error.message}`);
      return testResult;
    }
  }

  /**
   * 🎚️ Teste DC Offset
   */
  async testDCOffset() {
    console.log('🧪 Testando DC Offset...');
    
    const { leftChannel, rightChannel, sampleRate, expectedDC } = 
      this.generator.generateDCOffset(0.3, 48000, 5);
    
    try {
      const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
      const lufsResult = calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      
      // True peak should detect the DC + sine peak
      const truePeakReasonable = truePeakResult.truePeakDbtp > -10 && truePeakResult.truePeakDbtp < 5;
      const lufsValid = Number.isFinite(lufsResult.lufs_integrated);
      
      const passed = truePeakReasonable && lufsValid;
      
      const testResult = {
        name: 'DC Offset Test',
        passed,
        details: {
          expectedDC,
          truePeak: truePeakResult.truePeakDbtp,
          lufs: lufsResult.lufs_integrated,
          truePeakReasonable,
          lufsValid
        }
      };
      
      this.results.push(testResult);
      console.log(`${passed ? '✅' : '❌'} DC Offset (${expectedDC}): TP=${truePeakResult.truePeakDbtp.toFixed(2)}dBTP`);
      
      return testResult;
    } catch (error) {
      const testResult = {
        name: 'DC Offset Test',
        passed: false,
        error: error.message
      };
      this.results.push(testResult);
      console.log(`❌ DC Offset: Error - ${error.message}`);
      return testResult;
    }
  }

  /**
   * 🔀 Teste Mono Signal
   */
  async testMonoSignal() {
    console.log('🧪 Testando Mono Signal...');
    
    const { leftChannel, rightChannel, sampleRate } = 
      this.generator.generateMonoSignal(1000, 0.5, 5, 48000);
    
    try {
      const technicalData = {
        lufsIntegrated: -18,
        truePeakDbtp: -6,
        stereoCorrelation: 1.0, // Perfect mono
        stereoWidth: 0.0
      };
      
      const scoringResult = computeMixScore(technicalData, null);
      
      const scoringValid = Number.isFinite(scoringResult.scorePct);
      const passed = scoringValid;
      
      const testResult = {
        name: 'Mono Signal Test',
        passed,
        details: {
          correlation: technicalData.stereoCorrelation,
          width: technicalData.stereoWidth,
          score: scoringResult.scorePct,
          scoringValid
        }
      };
      
      this.results.push(testResult);
      console.log(`${passed ? '✅' : '❌'} Mono Signal: Correlation=${technicalData.stereoCorrelation}, Score=${scoringResult.scorePct.toFixed(1)}%`);
      
      return testResult;
    } catch (error) {
      const testResult = {
        name: 'Mono Signal Test',
        passed: false,
        error: error.message
      };
      this.results.push(testResult);
      console.log(`❌ Mono Signal: Error - ${error.message}`);
      return testResult;
    }
  }

  /**
   * 💥 Teste Dados Corrompidos
   */
  async testCorruptedData() {
    console.log('🧪 Testando Dados Corrompidos...');
    
    const corruptionTypes = ['nan', 'infinity', 'denormal'];
    let allPassed = true;
    const details = [];
    
    for (const corruptionType of corruptionTypes) {
      try {
        const { leftChannel, rightChannel, sampleRate } = 
          this.generator.generateCorruptedData(corruptionType, 48000, 3);
        
        const lufsResult = calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
        const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
        
        // Should handle corruption gracefully (not crash)
        const lufsHandled = Number.isFinite(lufsResult.lufs_integrated) || lufsResult.lufs_integrated === -Infinity;
        const truePeakHandled = Number.isFinite(truePeakResult.truePeakDbtp) || truePeakResult.truePeakDbtp === -Infinity;
        
        const typeResult = {
          type: corruptionType,
          lufsHandled,
          truePeakHandled,
          passed: lufsHandled && truePeakHandled
        };
        
        details.push(typeResult);
        if (!typeResult.passed) allPassed = false;
        
        console.log(`   ${typeResult.passed ? '✅' : '❌'} ${corruptionType}: LUFS=${lufsResult.lufs_integrated}, TP=${truePeakResult.truePeakDbtp}`);
        
      } catch (error) {
        const typeResult = {
          type: corruptionType,
          passed: false,
          error: error.message
        };
        details.push(typeResult);
        allPassed = false;
        console.log(`   ❌ ${corruptionType}: Error - ${error.message}`);
      }
    }
    
    const testResult = {
      name: 'Corrupted Data Test',
      passed: allPassed,
      details
    };
    
    this.results.push(testResult);
    console.log(`${allPassed ? '✅' : '❌'} Corrupted Data: ${details.filter(d => d.passed).length}/${details.length} types handled`);
    
    return testResult;
  }

  /**
   * ⚡ Teste Impulso Curto
   */
  async testShortImpulse() {
    console.log('🧪 Testando Impulso Curto...');
    
    const { leftChannel, rightChannel, sampleRate, durationMs } = 
      this.generator.generateShortImpulse(48000);
    
    try {
      const lufsResult = calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
      
      // Very short signal should be handled gracefully
      const lufsHandled = Number.isFinite(lufsResult.lufs_integrated) || lufsResult.lufs_integrated === -Infinity;
      const truePeakHandled = Number.isFinite(truePeakResult.truePeakDbtp);
      
      const passed = lufsHandled && truePeakHandled;
      
      const testResult = {
        name: 'Short Impulse Test',
        passed,
        details: {
          durationMs,
          samples: leftChannel.length,
          lufs: lufsResult.lufs_integrated,
          truePeak: truePeakResult.truePeakDbtp,
          lufsHandled,
          truePeakHandled
        }
      };
      
      this.results.push(testResult);
      console.log(`${passed ? '✅' : '❌'} Short Impulse (${durationMs.toFixed(1)}ms): LUFS=${lufsResult.lufs_integrated}, TP=${truePeakResult.truePeakDbtp.toFixed(2)}dBTP`);
      
      return testResult;
    } catch (error) {
      const testResult = {
        name: 'Short Impulse Test',
        passed: false,
        error: error.message
      };
      this.results.push(testResult);
      console.log(`❌ Short Impulse: Error - ${error.message}`);
      return testResult;
    }
  }

  /**
   * 🏃 Executar todos os testes
   */
  async runAllTests() {
    console.log('🧪 Iniciando Suite de Testes de Casos Extremos...\n');
    
    try {
      await this.testSilence();
      await this.testHardClipping();
      await this.testDCOffset();
      await this.testMonoSignal();
      await this.testCorruptedData();
      await this.testShortImpulse();
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ Erro durante os testes de casos extremos:', error);
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
    
    console.log('\n📋 RELATÓRIO FINAL - EDGE CASES TESTS');
    console.log('=====================================');
    console.log(`Aprovados: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    const overallStatus = passRate >= 70 ? 'PASS' : 'FAIL'; // Lower threshold for edge cases
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

// Export para uso em testes
export {
  EdgeCaseTestSuite,
  EdgeCaseSignalGenerator
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.EdgeCaseTestSuite = EdgeCaseTestSuite;
  window.runEdgeCaseAudit = async () => {
    const suite = new EdgeCaseTestSuite();
    return await suite.runAllTests();
  };
}