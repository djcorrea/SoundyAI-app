// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// 🛡️ SAFETY GATES SYSTEM - True Peak Warning Gate
// Implementação ULTRA CONSERVADORA - apenas warnings, nunca hard fails
// Não afeta funcionamento do TT-DR ou sistema de scoring existente

/**
 * 🚨 CONFIGURAÇÃO DE GATES DE SEGURANÇA
 * PRINCÍPIO: Avisar, nunca bloquear
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🚨 REGRA ABSOLUTA: TRUE PEAK > 0.0 dBTP = CRÍTICA SEMPRE
 * - 0.0 dBTP é o limite físico digital absoluto
 * - Qualquer valor > 0.0 representa clipping digital inevitável
 * - NÃO HÁ EXCEÇÕES ou tolerâncias para essa regra
 * ════════════════════════════════════════════════════════════════════════════
 */
const SAFETY_GATES_CONFIG = {
  // True Peak Gate
  truePeak: {
    enabled: true,
    warningThreshold: -0.3,    // ⚠️ Próximo do limite
    criticalThreshold: 0.0,    // 🚨 REGRA ABSOLUTA: > 0 dBTP = CRÍTICA SEMPRE
    mode: 'warning_only',      // NUNCA hard fail
    logLevel: 'info'
  },
  
  // Gates futuros (placeholder)
  correlation: {
    enabled: false,            // Desabilitado por enquanto
    threshold: 0.1,
    mode: 'warning_only'
  },
  
  dynamicRange: {
    enabled: false,            // Desabilitado por enquanto
    thresholdByGenre: false
  }
};

/**
 * 🛡️ SISTEMA DE SAFETY GATES
 * Analisa métricas e gera warnings/recommendations
 */
class SafetyGates {
  constructor(config = SAFETY_GATES_CONFIG) {
    this.config = config;
    this.warnings = [];
    this.recommendations = [];
    
    // Contador de ativações para telemetria
    this.activationCount = {
      truePeak: 0,
      correlation: 0,
      dynamicRange: 0
    };
    
    log('🛡️ Safety Gates System inicializado (warning-only mode)');
  }

  /**
   * 🎯 GATE PRINCIPAL: True Peak
   * Detecta true peaks acima de 0 dBTP
   */
  checkTruePeak(truePeakValue, audioMetrics = {}) {
    if (!this.config.truePeak.enabled) return null;
    
    const { warningThreshold, criticalThreshold } = this.config.truePeak;
    
    // Converter para número se necessário
    const truePeak = Number(truePeakValue);
    
    if (!Number.isFinite(truePeak)) {
      warn('🛡️ [SAFETY-GATE] True Peak inválido:', truePeakValue);
      return null;
    }
    
    // Análise de severidade
    let severity = 'info';
    let message = '';
    let recommendation = '';
    
    if (truePeak > criticalThreshold) {
      severity = 'critical';
      message = `True Peak CRÍTICO: ${truePeak.toFixed(2)} dBTP (>${criticalThreshold} dBTP)`;
      recommendation = 'URGENTE: Aplicar limiting agressivo. Risco alto de clipping digital.';
      this.activationCount.truePeak++;
      
    } else if (truePeak > warningThreshold) {
      severity = 'warning';
      message = `True Peak acima do recomendado: ${truePeak.toFixed(2)} dBTP (>${warningThreshold} dBTP)`;
      recommendation = 'Considere aplicar limiting para broadcast compliance (EBU R128).';
      this.activationCount.truePeak++;
      
    } else {
      // Dentro dos padrões
      return {
        type: 'ok',
        gate: 'truePeak',
        value: truePeak,
        message: `True Peak OK: ${truePeak.toFixed(2)} dBTP`,
        passed: true
      };
    }
    
    // Criar warning object
    const warning = {
      type: 'warning',
      gate: 'truePeak',
      severity,
      value: truePeak,
      threshold: warningThreshold,
      message,
      recommendation,
      metadata: {
        broadcastCompliant: truePeak <= -1.0,
        streamingReady: truePeak <= -0.1,
        exceedsZero: truePeak > 0.0,
        timestamp: new Date().toISOString()
      }
    };
    
    // Log baseado na severidade
    if (severity === 'critical') {
      error('🚨 [SAFETY-GATE]', message);
      error('💡 [RECOMMENDATION]', recommendation);
    } else {
      warn('⚠️ [SAFETY-GATE]', message);
      info('💡 [RECOMMENDATION]', recommendation);
    }
    
    // Adicionar à lista de warnings
    this.warnings.push(warning);
    this.recommendations.push(recommendation);
    
    return warning;
  }

  /**
   * 🔍 ANÁLISE COMPLETA
   * Executa todos os gates habilitados
   */
  analyzeAudio(audioMetrics) {
    log('🛡️ [SAFETY-GATES] Iniciando análise de segurança...');
    
    // Reset warnings da análise anterior
    this.warnings = [];
    this.recommendations = [];
    
    const results = {};
    
    // Gate 1: True Peak
    if (audioMetrics.truePeakDbtp !== undefined || audioMetrics.true_peak_dbtp !== undefined) {
      const truePeak = audioMetrics.truePeakDbtp || audioMetrics.true_peak_dbtp;
      results.truePeak = this.checkTruePeak(truePeak, audioMetrics);
    }
    
    // Gates futuros podem ser adicionados aqui
    // if (this.config.correlation.enabled) { ... }
    // if (this.config.dynamicRange.enabled) { ... }
    
    // Resumo da análise
    const summary = {
      totalWarnings: this.warnings.length,
      totalRecommendations: this.recommendations.length,
      criticalIssues: this.warnings.filter(w => w.severity === 'critical').length,
      warningIssues: this.warnings.filter(w => w.severity === 'warning').length,
      allClear: this.warnings.length === 0
    };
    
    log('🛡️ [SAFETY-GATES] Análise completa:', summary);
    
    return {
      results,
      warnings: this.warnings,
      recommendations: this.recommendations,
      summary,
      activationCount: {...this.activationCount}
    };
  }

  /**
   * 📊 TELEMETRIA E ESTATÍSTICAS
   */
  getStats() {
    return {
      config: this.config,
      activationCount: {...this.activationCount},
      warningsGenerated: this.warnings.length,
      lastAnalysis: this.warnings.length > 0 ? this.warnings[this.warnings.length - 1].metadata.timestamp : null
    };
  }

  /**
   * 🔧 CONFIGURAÇÃO DINÂMICA
   * Permite ajustar thresholds sem reinicializar
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    log('🛡️ [SAFETY-GATES] Configuração atualizada:', this.config);
  }
}

/**
 * 🌍 INSTÂNCIA GLOBAL PARA INTEGRAÇÃO
 * Exposta no window para uso pelo sistema principal
 */
let globalSafetyGates = null;

function initializeSafetyGates(config) {
  if (!globalSafetyGates) {
    globalSafetyGates = new SafetyGates(config);
    
    // Expor no window para acesso global
    if (typeof window !== 'undefined') {
      window.SafetyGates = globalSafetyGates;
      window.SAFETY_GATES_CONFIG = SAFETY_GATES_CONFIG;
    }
    
    log('🛡️ Safety Gates System disponível globalmente');
  }
  
  return globalSafetyGates;
}

/**
 * 🎯 FUNÇÃO DE CONVENIÊNCIA
 * Para integração rápida no sistema existente
 */
function checkAudioSafety(audioMetrics) {
  const gates = globalSafetyGates || initializeSafetyGates();
  return gates.analyzeAudio(audioMetrics);
}

// 🚀 AUTO-INICIALIZAÇÃO (se window disponível)
if (typeof window !== 'undefined') {
  // Aguardar DOM ready para inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSafetyGates();
    });
  } else {
    initializeSafetyGates();
  }
}

// 📦 EXPORTS
export {
  SafetyGates,
  SAFETY_GATES_CONFIG,
  initializeSafetyGates,
  checkAudioSafety
};
