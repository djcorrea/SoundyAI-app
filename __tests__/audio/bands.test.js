/**
 * 🧪 TESTES DE AUDITORIA - BANDAS ESPECTRAIS
 * 
 * Validação do isolamento e precisão das bandas espectrais
 * Testes de separação entre bandas e cálculo RMS
 */

import { SimpleSpectralAnalyzer } from '../../scripts/spectral-utils.js';

// Tolerâncias para aprovação
const BAND_ISOLATION_DB = 15; // Isolamento mínimo entre bandas ≥15dB
const RMS_TOLERANCE_DB = 1.0;  // ±1dB para RMS calculations

/**
 * 🎵 Gerador de sinais targetados por banda
 */
class SpectralSignalGenerator {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    
    // Definição das bandas para teste (compatível com sistema)
    this.testBands = {
      sub: { center: 40, range: [20, 60] },
      bass: { center: 90, range: [60, 120] },
      low_mid: { center: 185, range: [120, 250] },
      mid: { center: 625, range: [250, 1000] },
      high_mid: { center: 2500, range: [1000, 4000] },
      presence: { center: 6000, range: [4000, 8000] },
      air: { center: 12000, range: [8000, 16000] }
    };
  }

  /**
   * 🎯 Sine targeted para banda específica
   */
  generateBandTargetedSine(bandName, amplitude = 0.5, durationSeconds = 5) {
    if (!this.testBands[bandName]) {
      throw new Error(`Banda desconhecida: ${bandName}`);
    }
    
    const frequency = this.testBands[bandName].center;
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const omega = 2 * Math.PI * frequency / this.sampleRate;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const sineValue = Math.sin(omega * i) * amplitude;
      leftChannel[i] = sineValue;
      rightChannel[i] = sineValue;
    }
    
    return { 
      leftChannel, 
      rightChannel, 
      targetBand: bandName,
      frequency,
      expectedDb: 20 * Math.log10(amplitude)
    };
  }

  /**
   * 🌈 White Noise (energia distribuída igualmente)
   */
  generateWhiteNoise(amplitude = 0.3, durationSeconds = 10) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const noise = (Math.random() * 2 - 1) * amplitude;
      leftChannel[i] = noise;
      rightChannel[i] = noise;
    }
    
    return {
      leftChannel,
      rightChannel,
      expectedDistribution: 'uniform',
      expectedDb: 20 * Math.log10(amplitude)
    };
  }

  /**
   * 🎵 Multi-Tone (várias bandas simultaneamente)
   */
  generateMultiTone(bandsConfig, durationSeconds = 5) {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      let totalValue = 0;
      
      for (const [bandName, config] of Object.entries(bandsConfig)) {
        const frequency = this.testBands[bandName].center;
        const amplitude = config.amplitude || 0.2;
        const omega = 2 * Math.PI * frequency / this.sampleRate;
        
        totalValue += Math.sin(omega * i) * amplitude;
      }
      
      leftChannel[i] = totalValue;
      rightChannel[i] = totalValue;
    }
    
    return {
      leftChannel,
      rightChannel,
      bandsConfig,
      type: 'multi_tone'
    };
  }

  /**
   * 📊 Band-limited noise (energia concentrada numa banda)
   */
  generateBandLimitedNoise(bandName, amplitude = 0.4, durationSeconds = 5) {
    const band = this.testBands[bandName];
    const [lowFreq, highFreq] = band.range;
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    
    // Gerar white noise e filtrar (aproximação simples)
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Aproximação: múltiplas sines na banda para simular noise limitado
    const numTones = 10;
    const freqStep = (highFreq - lowFreq) / numTones;
    
    for (let i = 0; i < numSamples; i++) {
      let bandValue = 0;
      
      for (let tone = 0; tone < numTones; tone++) {
        const freq = lowFreq + (tone * freqStep);
        const omega = 2 * Math.PI * freq / this.sampleRate;
        const phase = Math.random() * 2 * Math.PI; // Random phase
        
        bandValue += Math.sin(omega * i + phase) * (amplitude / numTones);
      }
      
      leftChannel[i] = bandValue;
      rightChannel[i] = bandValue;
    }
    
    return {
      leftChannel,
      rightChannel,
      targetBand: bandName,
      frequencyRange: [lowFreq, highFreq],
      expectedDb: 20 * Math.log10(amplitude)
    };
  }
}

/**
 * 🧪 Suite de testes para Bandas Espectrais
 */
class SpectralBandsTestSuite {
  constructor() {
    this.generator = new SpectralSignalGenerator();
    this.analyzer = new SimpleSpectralAnalyzer();
    this.results = [];
  }

  /**
   * 🎯 Teste de isolamento por banda (sines targetados)
   */
  async testBandIsolation() {
    console.log('🧪 Testando Isolamento entre Bandas...');
    
    const isolationResults = [];
    
    for (const bandName of Object.keys(this.generator.testBands)) {
      console.log(`   Testando isolamento: ${bandName}`);
      
      const { leftChannel, rightChannel, frequency } = 
        this.generator.generateBandTargetedSine(bandName, 0.5, 5);
      
      // Analisar com spectral analyzer
      const spectrum = this.analyzer.analyzeAudio(leftChannel);
      const bandResults = spectrum.bands;
      
      // Encontrar energia na banda alvo vs outras bandas
      const targetEnergy = bandResults[bandName]?.rms_db || -Infinity;
      const otherBands = Object.keys(bandResults).filter(b => b !== bandName);
      
      let maxOtherEnergy = -Infinity;
      let maxOtherBand = '';
      
      otherBands.forEach(otherBand => {
        const energy = bandResults[otherBand]?.rms_db || -Infinity;
        if (energy > maxOtherEnergy) {
          maxOtherEnergy = energy;
          maxOtherBand = otherBand;
        }
      });
      
      const isolation = targetEnergy - maxOtherEnergy; // dB
      const passed = isolation >= BAND_ISOLATION_DB;
      
      const isolationTest = {
        band: bandName,
        frequency,
        targetEnergy,
        maxOtherEnergy,
        maxOtherBand,
        isolation,
        passed,
        requirement: `≥${BAND_ISOLATION_DB}dB`
      };
      
      isolationResults.push(isolationTest);
      console.log(`   ${passed ? '✅' : '❌'} ${bandName}: ${isolation.toFixed(1)}dB isolation`);
    }
    
    const overallIsolationPassed = isolationResults.every(r => r.passed);
    
    this.results.push({
      name: 'Band Isolation Test',
      type: 'isolation',
      passed: overallIsolationPassed,
      details: isolationResults,
      summary: {
        totalBands: isolationResults.length,
        passedBands: isolationResults.filter(r => r.passed).length,
        minIsolation: Math.min(...isolationResults.map(r => r.isolation)),
        avgIsolation: isolationResults.reduce((sum, r) => sum + r.isolation, 0) / isolationResults.length
      }
    });
    
    return isolationResults;
  }

  /**
   * 🌈 Teste White Noise (distribuição uniforme)
   */
  async testWhiteNoiseDistribution() {
    console.log('🧪 Testando White Noise Distribution...');
    
    const { leftChannel, rightChannel } = this.generator.generateWhiteNoise(0.3, 10);
    const spectrum = this.analyzer.analyzeAudio(leftChannel);
    const bandResults = spectrum.bands;
    
    // Verificar se energia está distribuída uniformemente (±3dB)
    const energies = Object.values(bandResults).map(band => band.rms_db);
    const validEnergies = energies.filter(e => e > -Infinity);
    
    if (validEnergies.length === 0) {
      throw new Error('Nenhuma energia detectada em white noise');
    }
    
    const meanEnergy = validEnergies.reduce((sum, e) => sum + e, 0) / validEnergies.length;
    const maxDeviation = Math.max(...validEnergies.map(e => Math.abs(e - meanEnergy)));
    
    const passed = maxDeviation <= 3.0; // ±3dB tolerance for white noise
    
    const whiteNoiseTest = {
      name: 'White Noise Distribution',
      meanEnergy,
      maxDeviation,
      passed,
      tolerance: '±3dB',
      details: {
        bandEnergies: bandResults,
        totalBands: Object.keys(bandResults).length,
        validBands: validEnergies.length
      }
    };
    
    this.results.push(whiteNoiseTest);
    console.log(`${passed ? '✅' : '❌'} White Noise: ${maxDeviation.toFixed(1)}dB max deviation from mean`);
    
    return whiteNoiseTest;
  }

  /**
   * 🎵 Teste Multi-Tone (multiple frequencies)
   */
  async testMultiTone() {
    console.log('🧪 Testando Multi-Tone Response...');
    
    const multiToneConfig = {
      sub: { amplitude: 0.3 },
      mid: { amplitude: 0.4 },
      presence: { amplitude: 0.2 }
    };
    
    const { leftChannel, rightChannel } = 
      this.generator.generateMultiTone(multiToneConfig, 5);
    
    const spectrum = this.analyzer.analyzeAudio(leftChannel);
    const bandResults = spectrum.bands;
    
    // Verificar se as bandas alvo estão mais altas que as outras
    const targetBands = Object.keys(multiToneConfig);
    const otherBands = Object.keys(bandResults).filter(b => !targetBands.includes(b));
    
    let correctDetections = 0;
    const detectionDetails = [];
    
    targetBands.forEach(targetBand => {
      const targetEnergy = bandResults[targetBand]?.rms_db || -Infinity;
      const avgOtherEnergy = otherBands.reduce((sum, b) => {
        const energy = bandResults[b]?.rms_db || -Infinity;
        return energy > -Infinity ? sum + energy : sum;
      }, 0) / otherBands.filter(b => bandResults[b]?.rms_db > -Infinity).length;
      
      const advantage = targetEnergy - avgOtherEnergy;
      const detected = advantage >= 6.0; // 6dB advantage expected
      
      if (detected) correctDetections++;
      
      detectionDetails.push({
        band: targetBand,
        targetEnergy,
        avgOtherEnergy,
        advantage,
        detected
      });
    });
    
    const passed = correctDetections === targetBands.length;
    
    const multiToneTest = {
      name: 'Multi-Tone Response',
      passed,
      correctDetections,
      totalTargets: targetBands.length,
      details: detectionDetails,
      requirement: '6dB advantage for target bands'
    };
    
    this.results.push(multiToneTest);
    console.log(`${passed ? '✅' : '❌'} Multi-Tone: ${correctDetections}/${targetBands.length} bands correctly detected`);
    
    return multiToneTest;
  }

  /**
   * 📊 Teste Band-Limited Noise
   */
  async testBandLimitedNoise() {
    console.log('🧪 Testando Band-Limited Noise...');
    
    const testBand = 'mid'; // Testar banda mid
    const { leftChannel, rightChannel } = 
      this.generator.generateBandLimitedNoise(testBand, 0.4, 5);
    
    const spectrum = this.analyzer.analyzeAudio(leftChannel);
    const bandResults = spectrum.bands;
    
    const targetEnergy = bandResults[testBand]?.rms_db || -Infinity;
    const otherBands = Object.keys(bandResults).filter(b => b !== testBand);
    
    // Verificar se energia está concentrada na banda alvo
    let energyInTarget = 0;
    let energyInOthers = 0;
    
    Object.entries(bandResults).forEach(([band, data]) => {
      const energy = data.energy_pct || 0;
      if (band === testBand) {
        energyInTarget += energy;
      } else {
        energyInOthers += energy;
      }
    });
    
    const concentration = energyInTarget / (energyInTarget + energyInOthers);
    const passed = concentration >= 0.6; // 60% da energia na banda alvo
    
    const bandLimitedTest = {
      name: 'Band-Limited Noise',
      testBand,
      targetEnergy,
      energyInTarget,
      energyInOthers,
      concentration,
      passed,
      requirement: '≥60% energy in target band'
    };
    
    this.results.push(bandLimitedTest);
    console.log(`${passed ? '✅' : '❌'} Band-Limited (${testBand}): ${(concentration * 100).toFixed(1)}% energy concentration`);
    
    return bandLimitedTest;
  }

  /**
   * 🏃 Executar todos os testes
   */
  async runAllTests() {
    console.log('🧪 Iniciando Suite de Testes Bandas Espectrais...\n');
    
    try {
      await this.testBandIsolation();
      await this.testWhiteNoiseDistribution();
      await this.testMultiTone();
      await this.testBandLimitedNoise();
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ Erro durante os testes espectrais:', error);
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
    
    console.log('\n📋 RELATÓRIO FINAL - SPECTRAL BANDS TESTS');
    console.log('==========================================');
    console.log(`Aprovados: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      
      if (result.type === 'isolation' && result.details) {
        const summary = result.summary;
        console.log(`   Isolamento: ${summary.passedBands}/${summary.totalBands} bandas, min: ${summary.minIsolation.toFixed(1)}dB`);
      }
    });
    
    const overallStatus = passRate >= 75 ? 'PASS' : 'FAIL';
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
 * 🔧 Validar configuração espectral
 */
function validateSpectralConfiguration() {
  console.log('🔧 Validando Configuração Espectral...');
  
  try {
    const analyzer = new SimpleSpectralAnalyzer();
    console.log('✅ SimpleSpectralAnalyzer: Instanciado corretamente');
    
    // Verificar configurações básicas
    const expectedFFTSize = 4096;
    const expectedHopSize = 1024;
    
    if (analyzer.fftSize === expectedFFTSize) {
      console.log(`✅ FFT Size: ${analyzer.fftSize} (correto)`);
    } else {
      console.log(`❌ FFT Size: ${analyzer.fftSize} (esperado ${expectedFFTSize})`);
    }
    
    if (analyzer.hopSize === expectedHopSize) {
      console.log(`✅ Hop Size: ${analyzer.hopSize} (75% overlap)`);
    } else {
      console.log(`❌ Hop Size: ${analyzer.hopSize} (esperado ${expectedHopSize})`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Spectral Configuration: ${error.message}`);
    return false;
  }
}

// Export para uso em testes
export {
  SpectralBandsTestSuite,
  SpectralSignalGenerator,
  validateSpectralConfiguration
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.SpectralBandsTestSuite = SpectralBandsTestSuite;
  window.runSpectralBandsAudit = async () => {
    const suite = new SpectralBandsTestSuite();
    return await suite.runAllTests();
  };
}