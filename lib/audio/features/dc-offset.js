// ⚡ DC OFFSET ANALYZER - Detecção de Offset de Corrente Contínua
// Implementação para calcular DC offset nos canais de áudio

import { logAudio } from '../error-handling.js';

/**
 * 🎯 Configurações para análise de DC Offset
 */
const DC_OFFSET_CONFIG = {
  SIGNIFICANT_THRESHOLD: 0.01,     // Threshold para considerar offset significativo (1%)
  WARNING_THRESHOLD: 0.05,        // Threshold para warning (5%)
  CRITICAL_THRESHOLD: 0.1,        // Threshold crítico (10%)
  SAMPLE_WINDOW: 4096,            // Janela de amostragem para análise detalhada
  MIN_SAMPLES: 1024               // Mínimo de amostras para análise válida
};

/**
 * ⚡ Analisador de DC Offset
 */
export class DCOffsetAnalyzer {
  constructor() {
    this.config = DC_OFFSET_CONFIG;
  }
  
  /**
   * 📊 Analisar DC offset em canais de áudio
   */
  analyzeDCOffset(leftChannel, rightChannel) {
    try {
      if (!leftChannel || !rightChannel || 
          leftChannel.length < this.config.MIN_SAMPLES ||
          rightChannel.length < this.config.MIN_SAMPLES) {
        logAudio('dc_offset', 'insufficient_samples', { 
          leftLength: leftChannel?.length || 0,
          rightLength: rightChannel?.length || 0
        });
        return this.getNullResult();
      }
      
      // Análise básica (média geral)
      const leftDC = this.calculateChannelDC(leftChannel);
      const rightDC = this.calculateChannelDC(rightChannel);
      
      // Análise detalhada por janelas
      const leftWindowed = this.calculateWindowedDC(leftChannel);
      const rightWindowed = this.calculateWindowedDC(rightChannel);
      
      // Determinar severidade
      const maxAbsDC = Math.max(Math.abs(leftDC), Math.abs(rightDC));
      const severity = this.determineSeverity(maxAbsDC);
      
      // Análise de variação temporal
      const temporalVariation = this.analyzeTemporalVariation(leftWindowed, rightWindowed);
      
      const result = {
        // DC Offset por canal
        leftDC: Math.round(leftDC * 10000) / 10000,        // 4 decimais
        rightDC: Math.round(rightDC * 10000) / 10000,      // 4 decimais
        
        // Métricas derivadas
        averageDC: Math.round(((leftDC + rightDC) / 2) * 10000) / 10000,
        maxAbsDC: Math.round(maxAbsDC * 10000) / 10000,
        dcImbalance: Math.round((leftDC - rightDC) * 10000) / 10000,
        
        // Análise por janelas
        windowed: {
          left: {
            mean: Math.round(this.mean(leftWindowed) * 10000) / 10000,
            std: Math.round(this.standardDeviation(leftWindowed) * 10000) / 10000,
            min: Math.round(Math.min(...leftWindowed) * 10000) / 10000,
            max: Math.round(Math.max(...leftWindowed) * 10000) / 10000
          },
          right: {
            mean: Math.round(this.mean(rightWindowed) * 10000) / 10000,
            std: Math.round(this.standardDeviation(rightWindowed) * 10000) / 10000,
            min: Math.round(Math.min(...rightWindowed) * 10000) / 10000,
            max: Math.round(Math.max(...rightWindowed) * 10000) / 10000
          }
        },
        
        // Variação temporal
        temporalVariation: Math.round(temporalVariation * 10000) / 10000,
        
        // Classificação
        severity: severity.level,
        hasSignificantDC: maxAbsDC >= this.config.SIGNIFICANT_THRESHOLD,
        needsCorrection: maxAbsDC >= this.config.WARNING_THRESHOLD,
        isCritical: maxAbsDC >= this.config.CRITICAL_THRESHOLD,
        
        // Métricas de qualidade
        quality: {
          isStable: temporalVariation < 0.01,
          isBalanced: Math.abs(leftDC - rightDC) < this.config.SIGNIFICANT_THRESHOLD,
          overallQuality: severity.score
        },
        
        // Informações técnicas
        metadata: {
          samplesAnalyzed: Math.min(leftChannel.length, rightChannel.length),
          windowsAnalyzed: Math.min(leftWindowed.length, rightWindowed.length),
          analysisMethod: 'windowed_mean_with_temporal_analysis'
        }
      };
      
      logAudio('dc_offset', 'analysis_completed', {
        leftDC: result.leftDC,
        rightDC: result.rightDC,
        severity: result.severity,
        needsCorrection: result.needsCorrection
      });
      
      return result;
      
    } catch (error) {
      logAudio('dc_offset', 'analysis_error', { error: error.message });
      return this.getNullResult();
    }
  }
  
  /**
   * 📊 Calcular DC offset médio para um canal
   */
  calculateChannelDC(channel) {
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i];
    }
    return sum / channel.length;
  }
  
  /**
   * 🪟 Calcular DC offset por janelas
   */
  calculateWindowedDC(channel) {
    const windowSize = this.config.SAMPLE_WINDOW;
    const windows = [];
    
    for (let i = 0; i < channel.length; i += windowSize) {
      const windowEnd = Math.min(i + windowSize, channel.length);
      const window = channel.slice(i, windowEnd);
      
      if (window.length >= windowSize / 2) { // Aceitar janelas com pelo menos 50% do tamanho
        windows.push(this.calculateChannelDC(window));
      }
    }
    
    return windows;
  }
  
  /**
   * ⏱️ Analisar variação temporal do DC offset
   */
  analyzeTemporalVariation(leftWindows, rightWindows) {
    if (leftWindows.length < 2 || rightWindows.length < 2) {
      return 0;
    }
    
    // Calcular variação para cada canal
    const leftVariation = this.standardDeviation(leftWindows);
    const rightVariation = this.standardDeviation(rightWindows);
    
    // Retornar variação máxima
    return Math.max(leftVariation, rightVariation);
  }
  
  /**
   * 🎯 Determinar severidade do DC offset
   */
  determineSeverity(maxAbsDC) {
    if (maxAbsDC < this.config.SIGNIFICANT_THRESHOLD) {
      return { level: 'none', score: 10 };
    } else if (maxAbsDC < this.config.WARNING_THRESHOLD) {
      return { level: 'minor', score: 7 };
    } else if (maxAbsDC < this.config.CRITICAL_THRESHOLD) {
      return { level: 'moderate', score: 4 };
    } else {
      return { level: 'severe', score: 1 };
    }
  }
  
  /**
   * 📊 Calcular média
   */
  mean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * 📊 Calcular desvio padrão
   */
  standardDeviation(values) {
    if (values.length < 2) return 0;
    
    const mean = this.mean(values);
    const squaredDiffs = values.map(val => (val - mean) ** 2);
    const variance = this.mean(squaredDiffs);
    return Math.sqrt(variance);
  }
  
  /**
   * 🔇 Resultado nulo para casos de erro
   */
  getNullResult() {
    return {
      leftDC: null,
      rightDC: null,
      averageDC: null,
      maxAbsDC: null,
      dcImbalance: null,
      windowed: null,
      temporalVariation: null,
      severity: 'unknown',
      hasSignificantDC: false,
      needsCorrection: false,
      isCritical: false,
      quality: {
        isStable: false,
        isBalanced: false,
        overallQuality: 0
      },
      metadata: {
        samplesAnalyzed: 0,
        windowsAnalyzed: 0,
        analysisMethod: 'error'
      }
    };
  }
}

/**
 * 🎨 Serializador para JSON final
 */
export function serializeDCOffset(dcAnalysis) {
  if (!dcAnalysis || dcAnalysis.leftDC === null) {
    return null;
  }
  
  return {
    leftDC: Number(dcAnalysis.leftDC),
    rightDC: Number(dcAnalysis.rightDC),
    averageDC: Number(dcAnalysis.averageDC),
    maxAbsDC: Number(dcAnalysis.maxAbsDC),
    dcImbalance: Number(dcAnalysis.dcImbalance),
    severity: dcAnalysis.severity,
    hasSignificantDC: Boolean(dcAnalysis.hasSignificantDC),
    needsCorrection: Boolean(dcAnalysis.needsCorrection),
    isCritical: Boolean(dcAnalysis.isCritical),
    temporalVariation: Number(dcAnalysis.temporalVariation),
    quality: {
      isStable: Boolean(dcAnalysis.quality?.isStable),
      isBalanced: Boolean(dcAnalysis.quality?.isBalanced),
      overallQuality: Number(dcAnalysis.quality?.overallQuality || 0)
    }
  };
}

/**
 * 🔧 Função auxiliar para análise rápida
 */
export function calculateDCOffset(leftChannel, rightChannel) {
  const analyzer = new DCOffsetAnalyzer();
  return analyzer.analyzeDCOffset(leftChannel, rightChannel);
}

console.log('⚡ DC Offset Analyzer carregado - Detecção de corrente contínua');