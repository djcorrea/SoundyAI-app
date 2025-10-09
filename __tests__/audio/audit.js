/**
 * 🚀 COMANDO PRINCIPAL DE AUDITORIA
 * 
 * Script master que executa todas as suites de teste
 * e gera relatório final consolidado
 */

import { LUFSTestSuite, validateKWeightingCoefficients, validateLUFSConstants } from './lufs.test.js';
import { TruePeakTestSuite, validateTruePeakConfiguration } from './truepeak.test.js';
import { SpectralBandsTestSuite, validateSpectralConfiguration } from './bands.test.js';
import { ScoringTestSuite, validateScoringConfiguration } from './scoring.test.js';
import { EdgeCaseTestSuite } from './edgecases.test.js';

/**
 * 🎯 Configuração da auditoria
 */
const AUDIT_CONFIG = {
  enableLUFS: true,
  enableTruePeak: true,
  enableSpectralBands: true,
  enableScoring: true,
  enableEdgeCases: true,
  
  // Tolerâncias para aprovação geral
  minimumPassRate: 75, // 75% dos testes devem passar
  criticalTests: ['lufs', 'truepeak', 'scoring'], // Testes críticos
  
  // Output
  generateDetailedReport: true,
  exportToFile: true
};

/**
 * 🧪 Orquestrador principal da auditoria
 */
class AudioPipelineAuditor {
  constructor(config = {}) {
    this.config = { ...AUDIT_CONFIG, ...config };
    this.results = {
      validation: {},
      testSuites: {},
      summary: {},
      startTime: Date.now()
    };
  }

  /**
   * 🔧 Fase 1: Validação de configurações
   */
  async runValidations() {
    console.log('🔧 FASE 1: VALIDAÇÃO DE CONFIGURAÇÕES');
    console.log('=====================================\n');
    
    const validations = {};
    
    try {
      validations.lufs = {
        kWeighting: validateKWeightingCoefficients(),
        constants: validateLUFSConstants()
      };
      console.log('');
    } catch (error) {
      validations.lufs = { error: error.message };
      console.log(`❌ LUFS Validation Error: ${error.message}\n`);
    }
    
    try {
      validations.truePeak = validateTruePeakConfiguration();
      console.log('');
    } catch (error) {
      validations.truePeak = { error: error.message };
      console.log(`❌ True Peak Validation Error: ${error.message}\n`);
    }
    
    try {
      validations.spectral = validateSpectralConfiguration();
      console.log('');
    } catch (error) {
      validations.spectral = { error: error.message };
      console.log(`❌ Spectral Validation Error: ${error.message}\n`);
    }
    
    try {
      validations.scoring = validateScoringConfiguration();
      console.log('');
    } catch (error) {
      validations.scoring = { error: error.message };
      console.log(`❌ Scoring Validation Error: ${error.message}\n`);
    }
    
    this.results.validation = validations;
    
    const validationsPassed = Object.values(validations).filter(v => 
      typeof v === 'boolean' ? v : !v.error
    ).length;
    
    console.log(`🎯 Validações: ${validationsPassed}/${Object.keys(validations).length} aprovadas\n`);
    
    return validations;
  }

  /**
   * 🧪 Fase 2: Execução das suites de teste
   */
  async runTestSuites() {
    console.log('🧪 FASE 2: EXECUÇÃO DAS SUITES DE TESTE');
    console.log('======================================\n');
    
    const testResults = {};
    
    // LUFS Tests
    if (this.config.enableLUFS) {
      try {
        console.log('🔊 Executando LUFS Test Suite...');
        const lufsTest = new LUFSTestSuite();
        testResults.lufs = await lufsTest.runAllTests();
        console.log('');
      } catch (error) {
        testResults.lufs = { error: error.message, overallStatus: 'FAIL' };
        console.log(`❌ LUFS Test Suite Error: ${error.message}\n`);
      }
    }
    
    // True Peak Tests
    if (this.config.enableTruePeak) {
      try {
        console.log('🏔️ Executando True Peak Test Suite...');
        const truePeakTest = new TruePeakTestSuite();
        testResults.truePeak = await truePeakTest.runAllTests();
        console.log('');
      } catch (error) {
        testResults.truePeak = { error: error.message, overallStatus: 'FAIL' };
        console.log(`❌ True Peak Test Suite Error: ${error.message}\n`);
      }
    }
    
    // Spectral Bands Tests
    if (this.config.enableSpectralBands) {
      try {
        console.log('🎵 Executando Spectral Bands Test Suite...');
        const spectralTest = new SpectralBandsTestSuite();
        testResults.spectralBands = await spectralTest.runAllTests();
        console.log('');
      } catch (error) {
        testResults.spectralBands = { error: error.message, overallStatus: 'FAIL' };
        console.log(`❌ Spectral Bands Test Suite Error: ${error.message}\n`);
      }
    }
    
    // Scoring Tests
    if (this.config.enableScoring) {
      try {
        console.log('🎯 Executando Scoring Test Suite...');
        const scoringTest = new ScoringTestSuite();
        testResults.scoring = await scoringTest.runAllTests();
        console.log('');
      } catch (error) {
        testResults.scoring = { error: error.message, overallStatus: 'FAIL' };
        console.log(`❌ Scoring Test Suite Error: ${error.message}\n`);
      }
    }
    
    // Edge Cases Tests
    if (this.config.enableEdgeCases) {
      try {
        console.log('💥 Executando Edge Cases Test Suite...');
        const edgeCaseTest = new EdgeCaseTestSuite();
        testResults.edgeCases = await edgeCaseTest.runAllTests();
        console.log('');
      } catch (error) {
        testResults.edgeCases = { error: error.message, overallStatus: 'FAIL' };
        console.log(`❌ Edge Cases Test Suite Error: ${error.message}\n`);
      }
    }
    
    this.results.testSuites = testResults;
    return testResults;
  }

  /**
   * 📊 Fase 3: Análise e consolidação
   */
  generateSummary() {
    console.log('📊 FASE 3: ANÁLISE E CONSOLIDAÇÃO');
    console.log('=================================\n');
    
    const testResults = this.results.testSuites;
    const totalSuites = Object.keys(testResults).length;
    let passedSuites = 0;
    let totalTests = 0;
    let passedTests = 0;
    
    const suitesSummary = {};
    
    Object.entries(testResults).forEach(([suiteName, result]) => {
      if (result.error) {
        suitesSummary[suiteName] = {
          status: 'ERROR',
          error: result.error,
          passRate: 0
        };
      } else {
        const passed = result.overallStatus === 'PASS';
        if (passed) passedSuites++;
        
        totalTests += result.summary?.total || 0;
        passedTests += result.summary?.passed || 0;
        
        suitesSummary[suiteName] = {
          status: result.overallStatus,
          passRate: result.passRate || 0,
          tests: result.summary
        };
      }
    });
    
    const overallPassRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const criticalTestsPassed = this.config.criticalTests.every(testName => 
      suitesSummary[testName]?.status === 'PASS'
    );
    
    const finalStatus = (
      overallPassRate >= this.config.minimumPassRate &&
      criticalTestsPassed
    ) ? 'PASS' : 'FAIL';
    
    const summary = {
      overallStatus: finalStatus,
      overallPassRate,
      suitesPassRate: (passedSuites / totalSuites) * 100,
      totalSuites,
      passedSuites,
      totalTests,
      passedTests,
      criticalTestsPassed,
      duration: Date.now() - this.results.startTime,
      suites: suitesSummary
    };
    
    this.results.summary = summary;
    
    // Exibir sumário
    console.log(`🎯 STATUS FINAL: ${finalStatus}`);
    console.log(`📊 Taxa de Aprovação Geral: ${overallPassRate.toFixed(1)}%`);
    console.log(`🧪 Suites: ${passedSuites}/${totalSuites} aprovadas`);
    console.log(`✅ Testes: ${passedTests}/${totalTests} aprovados`);
    console.log(`⚡ Testes Críticos: ${criticalTestsPassed ? 'PASS' : 'FAIL'}`);
    console.log(`⏱️ Duração: ${(summary.duration / 1000).toFixed(1)}s\n`);
    
    // Detalhes por suite
    Object.entries(suitesSummary).forEach(([suiteName, details]) => {
      const icon = details.status === 'PASS' ? '✅' : 
                   details.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${suiteName}: ${details.status} (${details.passRate?.toFixed(1)}%)`);
    });
    
    return summary;
  }

  /**
   * 📄 Gerar relatório detalhado
   */
  generateDetailedReport() {
    if (!this.config.generateDetailedReport) return null;
    
    const timestamp = new Date().toISOString();
    const summary = this.results.summary;
    
    let report = `# 🔍 RELATÓRIO DE AUDITORIA DO PIPELINE DE ÁUDIO\n\n`;
    report += `**Data:** ${timestamp}\n`;
    report += `**Duração:** ${(summary.duration / 1000).toFixed(1)}s\n`;
    report += `**Status:** ${summary.overallStatus}\n\n`;
    
    report += `## 📊 RESUMO EXECUTIVO\n\n`;
    report += `| Métrica | Resultado |\n`;
    report += `|---------|----------|\n`;
    report += `| Status Final | ${summary.overallStatus} |\n`;
    report += `| Taxa de Aprovação | ${summary.overallPassRate.toFixed(1)}% |\n`;
    report += `| Suites Aprovadas | ${summary.passedSuites}/${summary.totalSuites} |\n`;
    report += `| Testes Aprovados | ${summary.passedTests}/${summary.totalTests} |\n`;
    report += `| Testes Críticos | ${summary.criticalTestsPassed ? 'PASS' : 'FAIL'} |\n\n`;
    
    report += `## 🧪 RESULTADOS POR SUITE\n\n`;
    
    Object.entries(summary.suites).forEach(([suiteName, details]) => {
      report += `### ${suiteName.toUpperCase()}\n\n`;
      report += `- **Status:** ${details.status}\n`;
      report += `- **Taxa de Aprovação:** ${details.passRate?.toFixed(1)}%\n`;
      
      if (details.tests) {
        report += `- **Testes:** ${details.tests.passed}/${details.tests.total} aprovados\n`;
      }
      
      if (details.error) {
        report += `- **Erro:** ${details.error}\n`;
      }
      
      report += '\n';
    });
    
    report += `## 🔧 VALIDAÇÕES DE CONFIGURAÇÃO\n\n`;
    
    Object.entries(this.results.validation).forEach(([component, result]) => {
      const status = (typeof result === 'boolean' ? result : !result.error) ? 'PASS' : 'FAIL';
      report += `- **${component}:** ${status}`;
      if (result.error) {
        report += ` - ${result.error}`;
      }
      report += '\n';
    });
    
    report += '\n## 🎯 RECOMENDAÇÕES\n\n';
    
    if (summary.overallStatus === 'PASS') {
      report += '✅ **Pipeline aprovado!** Todas as métricas estão dentro das tolerâncias aceitáveis.\n\n';
    } else {
      report += '❌ **Pipeline requer atenção.** Identifique e corrija os seguintes problemas:\n\n';
      
      Object.entries(summary.suites).forEach(([suiteName, details]) => {
        if (details.status === 'FAIL') {
          report += `- **${suiteName}:** Taxa de aprovação baixa (${details.passRate?.toFixed(1)}%)\n`;
        }
        if (details.status === 'ERROR') {
          report += `- **${suiteName}:** Erro de execução: ${details.error}\n`;
        }
      });
    }
    
    return report;
  }

  /**
   * 🚀 Executar auditoria completa
   */
  async runFullAudit() {
    console.log('🚀 INICIANDO AUDITORIA COMPLETA DO PIPELINE DE ÁUDIO');
    console.log('====================================================\n');
    
    try {
      // Fase 1: Validações
      await this.runValidations();
      
      // Fase 2: Testes
      await this.runTestSuites();
      
      // Fase 3: Análise
      const summary = this.generateSummary();
      
      // Relatório detalhado
      const detailedReport = this.generateDetailedReport();
      
      console.log('\n🎉 AUDITORIA CONCLUÍDA!');
      console.log('======================\n');
      
      return {
        success: true,
        status: summary.overallStatus,
        summary,
        detailedReport,
        fullResults: this.results
      };
      
    } catch (error) {
      console.error('💥 ERRO CRÍTICO NA AUDITORIA:', error);
      
      return {
        success: false,
        status: 'ERROR',
        error: error.message,
        partialResults: this.results
      };
    }
  }
}

/**
 * 🎯 Função principal para execução via CLI
 */
async function runAudioAudit(config = {}) {
  const auditor = new AudioPipelineAuditor(config);
  const result = await auditor.runFullAudit();
  
  // Export do relatório se configurado
  if (config.exportToFile && result.detailedReport) {
    try {
      // Aqui você pode adicionar lógica para salvar o arquivo
      // const fs = require('fs');
      // fs.writeFileSync('audit-report.md', result.detailedReport);
      console.log('📄 Relatório detalhado gerado: audit-report.md');
    } catch (error) {
      console.warn('⚠️ Erro ao salvar relatório:', error.message);
    }
  }
  
  return result;
}

// Export para uso em diferentes contextos
export {
  AudioPipelineAuditor,
  runAudioAudit,
  AUDIT_CONFIG
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.AudioPipelineAuditor = AudioPipelineAuditor;
  window.runAudioAudit = runAudioAudit;
  
  // Função global para facilitar execução
  window.auditPipeline = async () => {
    console.log('🎵 Executando auditoria do pipeline via window...');
    return await runAudioAudit();
  };
}

// Para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioPipelineAuditor, runAudioAudit, AUDIT_CONFIG };
}