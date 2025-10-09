/**
 * 🧪 TESTES DE AUDITORIA - SISTEMA DE SCORING
 * 
 * Validação do Equal Weight V3, level-matching, sweet spot,
 * pista A/B, tolerâncias e agregação final
 */

import { computeMixScore, _computeEqualWeightV3 } from '../../lib/audio/features/scoring.js';

// Tolerâncias para aprovação
const SCORE_TOLERANCE = 2.0; // ±2% para scoring
const LEVEL_MATCHING_TOLERANCE = 0.1; // ±0.1dB para level matching

/**
 * 🎯 Gerador de dados sintéticos para scoring
 */
class ScoringDataGenerator {
  constructor() {
    this.baselineReference = this.generateBaselineReference();
  }

  /**
   * 📊 Referência baseline para testes
   */
  generateBaselineReference() {
    return {
      lufs_target: -14,
      tol_lufs: 3.0,
      true_peak_target: -1,
      tol_true_peak: 2.5,
      dr_target: 10,
      tol_dr: 5.0,
      lra_target: 7,
      tol_lra: 5.0,
      stereo_target: 0.3,
      tol_stereo: 0.7,
      bands: {
        sub: { target_db: -17.0, tol_db: 4.0 },
        bass: { target_db: -15.0, tol_db: 3.0 },
        low_mid: { target_db: -18.0, tol_db: 2.5 },
        mid: { target_db: -16.0, tol_db: 2.5 },
        high_mid: { target_db: -19.0, tol_db: 2.5 },
        presence: { target_db: -21.0, tol_db: 3.0 },
        air: { target_db: -23.0, tol_db: 4.0 }
      }
    };
  }

  /**
   * ✨ Dados técnicos perfeitos (100% score esperado)
   */
  generatePerfectTechnicalData() {
    const ref = this.baselineReference;
    
    return {
      lufsIntegrated: ref.lufs_target,
      truePeakDbtp: ref.true_peak_target,
      dr: ref.dr_target,
      lra: ref.lra_target,
      stereoCorrelation: ref.stereo_target,
      stereoWidth: 0.6,
      balanceLR: 0,
      centroid: 2500,
      spectralFlatness: 0.25,
      rolloff85: 8000,
      dcOffset: 0,
      clippingPct: 0,
      bandEnergies: {
        sub: { rms_db: ref.bands.sub.target_db },
        bass: { rms_db: ref.bands.bass.target_db },
        low_mid: { rms_db: ref.bands.low_mid.target_db },
        mid: { rms_db: ref.bands.mid.target_db },
        high_mid: { rms_db: ref.bands.high_mid.target_db },
        presence: { rms_db: ref.bands.presence.target_db },
        air: { rms_db: ref.bands.air.target_db }
      }
    };
  }

  /**
   * 🎯 Sweet Spot Test Data (0-4dB desvios)
   */
  generateSweetSpotData() {
    const perfect = this.generatePerfectTechnicalData();
    
    // Desvios dentro do sweet spot (0-4dB)
    return {
      ...perfect,
      bandEnergies: {
        sub: { rms_db: perfect.bandEnergies.sub.rms_db + 2.0 },     // +2dB (sweet spot)
        bass: { rms_db: perfect.bandEnergies.bass.rms_db - 3.0 },   // -3dB (sweet spot)
        low_mid: { rms_db: perfect.bandEnergies.low_mid.rms_db + 1.0 }, // +1dB (sweet spot)
        mid: { rms_db: perfect.bandEnergies.mid.rms_db + 4.0 },     // +4dB (limite sweet spot)
        high_mid: { rms_db: perfect.bandEnergies.high_mid.rms_db }, // perfeito
        presence: { rms_db: perfect.bandEnergies.presence.rms_db - 2.5 }, // -2.5dB (sweet spot)
        air: { rms_db: perfect.bandEnergies.air.rms_db + 3.5 }      // +3.5dB (sweet spot)
      }
    };
  }

  /**
   * ⚡ Dados com level-matching test
   */
  generateLevelMatchingData(lufsDelta = 3.0) {
    const perfect = this.generatePerfectTechnicalData();
    
    // Simular áudio mais alto/baixo que referência
    const adjustedData = {
      ...perfect,
      lufsIntegrated: perfect.lufsIntegrated + lufsDelta,
      bandEnergies: {}
    };
    
    // Todas as bandas devem ser compensadas pelo lufsDelta
    Object.keys(perfect.bandEnergies).forEach(band => {
      adjustedData.bandEnergies[band] = {
        rms_db: perfect.bandEnergies[band].rms_db + lufsDelta
      };
    });
    
    return adjustedData;
  }

  /**
   * 🔴 Dados problemáticos (baixo score esperado)
   */
  generateProblematicData() {
    const ref = this.baselineReference;
    
    return {
      lufsIntegrated: ref.lufs_target + 8, // muito alto
      truePeakDbtp: 0.5, // clipping
      dr: 3, // muito comprimido
      lra: 1, // sem dinâmica
      stereoCorrelation: 0.95, // muito mono
      stereoWidth: 0.1,
      balanceLR: 0.3, // desbalanceado
      centroid: 4000,
      spectralFlatness: 0.1,
      rolloff85: 12000,
      dcOffset: 0.05, // DC alto
      clippingPct: 2.5, // clipping detectado
      bandEnergies: {
        sub: { rms_db: ref.bands.sub.target_db - 15 }, // muito baixo
        bass: { rms_db: ref.bands.bass.target_db + 12 }, // muito alto
        low_mid: { rms_db: ref.bands.low_mid.target_db - 8 }, // baixo
        mid: { rms_db: ref.bands.mid.target_db + 10 }, // muito alto
        high_mid: { rms_db: ref.bands.high_mid.target_db - 6 }, // baixo
        presence: { rms_db: ref.bands.presence.target_db + 15 }, // muito alto
        air: { rms_db: ref.bands.air.target_db - 20 } // muito baixo
      }
    };
  }

  /**
   * 🟡 Dados intermediários (score médio esperado)
   */
  generateIntermediateData() {
    const ref = this.baselineReference;
    
    return {
      lufsIntegrated: ref.lufs_target + 2, // ligeiramente alto
      truePeakDbtp: ref.true_peak_target - 0.5, // ok
      dr: ref.dr_target - 2, // ligeiramente baixo
      lra: ref.lra_target + 1, // ligeiramente alto
      stereoCorrelation: ref.stereo_target + 0.2, // ok
      stereoWidth: 0.5,
      balanceLR: 0.1,
      centroid: 2800,
      spectralFlatness: 0.2,
      rolloff85: 7500,
      dcOffset: 0.01,
      clippingPct: 0.1,
      bandEnergies: {
        sub: { rms_db: ref.bands.sub.target_db + 6 }, // fora da tolerância
        bass: { rms_db: ref.bands.bass.target_db - 4 }, // fora mas não muito
        low_mid: { rms_db: ref.bands.low_mid.target_db + 3 }, // dentro
        mid: { rms_db: ref.bands.mid.target_db - 1 }, // dentro
        high_mid: { rms_db: ref.bands.high_mid.target_db + 5 }, // fora
        presence: { rms_db: ref.bands.presence.target_db - 2 }, // dentro
        air: { rms_db: ref.bands.air.target_db + 8 } // fora
      }
    };
  }
}

/**
 * 🧪 Suite de testes para Scoring
 */
class ScoringTestSuite {
  constructor() {
    this.generator = new ScoringDataGenerator();
    this.results = [];
  }

  /**
   * ✨ Teste dados perfeitos (100% esperado)
   */
  async testPerfectData() {
    console.log('🧪 Testando Dados Perfeitos (100% score esperado)...');
    
    const technicalData = this.generator.generatePerfectTechnicalData();
    const reference = this.generator.baselineReference;
    
    const result = computeMixScore(technicalData, reference);
    
    const expectedScore = 100;
    const actualScore = result.scorePct;
    const error = Math.abs(actualScore - expectedScore);
    const passed = error <= SCORE_TOLERANCE;
    
    const testResult = {
      name: 'Perfect Data Test',
      expected: expectedScore,
      actual: actualScore,
      error,
      passed,
      details: {
        method: result.method,
        classification: result.classification,
        metricCount: result.equalWeightDetails?.totalMetrics || 'unknown'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Perfect Data: ${actualScore.toFixed(1)}% (expected ${expectedScore}%, error: ${error.toFixed(1)}%)`);
    
    return testResult;
  }

  /**
   * 🎯 Teste Sweet Spot (4dB = 100%)
   */
  async testSweetSpot() {
    console.log('🧪 Testando Sweet Spot (0-4dB = 100%)...');
    
    const technicalData = this.generator.generateSweetSpotData();
    const reference = this.generator.baselineReference;
    
    const result = computeMixScore(technicalData, reference);
    
    // Sweet spot deve resultar em score alto (≥90%)
    const actualScore = result.scorePct;
    const passed = actualScore >= 90;
    
    const testResult = {
      name: 'Sweet Spot Test',
      expected: '≥90%',
      actual: actualScore,
      passed,
      details: {
        method: result.method,
        classification: result.classification,
        sweetSpotRange: '0-4dB deviations'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Sweet Spot: ${actualScore.toFixed(1)}% (expected ≥90%)`);
    
    return testResult;
  }

  /**
   * ⚡ Teste Level-Matching
   */
  async testLevelMatching() {
    console.log('🧪 Testando Level-Matching...');
    
    const lufsDelta = 5.0; // +5dB mais alto
    const technicalData = this.generator.generateLevelMatchingData(lufsDelta);
    const reference = this.generator.baselineReference;
    
    const result = computeMixScore(technicalData, reference);
    
    // Com level-matching correto, as bandas devem ainda ter score alto
    // pois a compensação deve normalizar a diferença de level
    const actualScore = result.scorePct;
    const passed = actualScore >= 85; // Deve ser alto mesmo com LUFS diferente
    
    const testResult = {
      name: 'Level-Matching Test',
      lufsDelta,
      expected: '≥85% (compensated)',
      actual: actualScore,
      passed,
      details: {
        lufsIntegrated: technicalData.lufsIntegrated,
        lufsTarget: reference.lufs_target,
        compensation: 'bands compensated by lufsDelta'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Level-Matching (+${lufsDelta}dB): ${actualScore.toFixed(1)}% (expected ≥85%)`);
    
    return testResult;
  }

  /**
   * 🔴 Teste dados problemáticos (baixo score)
   */
  async testProblematicData() {
    console.log('🧪 Testando Dados Problemáticos (baixo score esperado)...');
    
    const technicalData = this.generator.generateProblematicData();
    const reference = this.generator.baselineReference;
    
    const result = computeMixScore(technicalData, reference);
    
    const actualScore = result.scorePct;
    const passed = actualScore <= 40; // Deve ser baixo
    
    const testResult = {
      name: 'Problematic Data Test',
      expected: '≤40%',
      actual: actualScore,
      passed,
      details: {
        classification: result.classification,
        method: result.method,
        issues: 'clipping, poor dynamics, bad spectral balance'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Problematic Data: ${actualScore.toFixed(1)}% (expected ≤40%)`);
    
    return testResult;
  }

  /**
   * 🟡 Teste dados intermediários
   */
  async testIntermediateData() {
    console.log('🧪 Testando Dados Intermediários...');
    
    const technicalData = this.generator.generateIntermediateData();
    const reference = this.generator.baselineReference;
    
    const result = computeMixScore(technicalData, reference);
    
    const actualScore = result.scorePct;
    const passed = actualScore >= 50 && actualScore <= 80; // Score médio
    
    const testResult = {
      name: 'Intermediate Data Test',
      expected: '50-80%',
      actual: actualScore,
      passed,
      details: {
        classification: result.classification,
        method: result.method,
        quality: 'mixed results'
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Intermediate Data: ${actualScore.toFixed(1)}% (expected 50-80%)`);
    
    return testResult;
  }

  /**
   * 🔄 Teste Reproducibilidade
   */
  async testReproducibility() {
    console.log('🧪 Testando Reproducibilidade...');
    
    const technicalData = this.generator.generateSweetSpotData();
    const reference = this.generator.baselineReference;
    
    // Executar 5 vezes e verificar consistência
    const scores = [];
    for (let i = 0; i < 5; i++) {
      const result = computeMixScore(technicalData, reference);
      scores.push(result.scorePct);
    }
    
    const meanScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const maxDeviation = Math.max(...scores.map(s => Math.abs(s - meanScore)));
    const passed = maxDeviation <= 0.1; // ±0.1% tolerance
    
    const testResult = {
      name: 'Reproducibility Test',
      scores,
      meanScore,
      maxDeviation,
      passed,
      tolerance: '±0.1%',
      details: {
        runs: scores.length,
        consistent: passed
      }
    };
    
    this.results.push(testResult);
    console.log(`${passed ? '✅' : '❌'} Reproducibility: ${maxDeviation.toFixed(3)}% max deviation (expected ≤0.1%)`);
    
    return testResult;
  }

  /**
   * 🏃 Executar todos os testes
   */
  async runAllTests() {
    console.log('🧪 Iniciando Suite de Testes de Scoring...\n');
    
    try {
      await this.testPerfectData();
      await this.testSweetSpot();
      await this.testLevelMatching();
      await this.testProblematicData();
      await this.testIntermediateData();
      await this.testReproducibility();
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ Erro durante os testes de scoring:', error);
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
    
    console.log('\n📋 RELATÓRIO FINAL - SCORING TESTS');
    console.log('===================================');
    console.log(`Aprovados: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    console.log('');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      let scoreInfo = '';
      
      if (typeof result.actual === 'number') {
        scoreInfo = `: ${result.actual.toFixed(1)}%`;
      }
      
      console.log(`${status} ${result.name}${scoreInfo}`);
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
 * 🔧 Validar configurações do scoring
 */
function validateScoringConfiguration() {
  console.log('🔧 Validando Configuração do Scoring...');
  
  try {
    // Teste básico da função
    const testData = {
      lufsIntegrated: -14,
      truePeakDbtp: -1,
      dr: 10
    };
    
    const testRef = {
      lufs_target: -14,
      true_peak_target: -1,
      dr_target: 10
    };
    
    const result = computeMixScore(testData, testRef);
    
    const hasValidScore = Number.isFinite(result.scorePct) && result.scorePct >= 0 && result.scorePct <= 100;
    const hasMethod = !!result.method;
    const hasClassification = !!result.classification;
    
    console.log(`${hasValidScore ? '✅' : '❌'} Score válido: ${result.scorePct}%`);
    console.log(`${hasMethod ? '✅' : '❌'} Método: ${result.method}`);
    console.log(`${hasClassification ? '✅' : '❌'} Classificação: ${result.classification}`);
    
    return hasValidScore && hasMethod && hasClassification;
  } catch (error) {
    console.log(`❌ Scoring Configuration: ${error.message}`);
    return false;
  }
}

// Export para uso em testes
export {
  ScoringTestSuite,
  ScoringDataGenerator,
  validateScoringConfiguration
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.ScoringTestSuite = ScoringTestSuite;
  window.runScoringAudit = async () => {
    const suite = new ScoringTestSuite();
    return await suite.runAllTests();
  };
}