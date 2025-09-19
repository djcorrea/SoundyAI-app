// 🎭 STEREO METRICS CORRECTED - Correlação e Largura Estéreo
// Implementação correta de correlação (-1 a +1) e largura estéreo (0 a 1)

import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🔧 Configurações das métricas estéreo
 */
const STEREO_CONFIG = {
  MIN_SAMPLES: 1024, // Mínimo de amostras para análise confiável
  MAX_SAMPLES: 96000, // Máximo para evitar processamento excessivo (2s @ 48kHz)
  CORRELATION_PRECISION: 3,
  WIDTH_PRECISION: 3,
  MIN_RMS_THRESHOLD: 1e-8, // Limiar para detectar sinal válido
  WINDOW_SIZE: 4096, // Tamanho da janela para análise por segmentos
  HOP_SIZE: 2048 // Sobreposição de 50%
};

/**
 * 🎭 Calculadora de Métricas Estéreo Profissionais
 */
export class StereoMetricsCalculator {
  
  constructor() {
    logAudio('stereo_metrics', 'init', {
      minSamples: STEREO_CONFIG.MIN_SAMPLES,
      maxSamples: STEREO_CONFIG.MAX_SAMPLES,
      windowSize: STEREO_CONFIG.WINDOW_SIZE
    });
  }
  
  /**
   * 📊 Validar entrada estéreo
   */
  validateStereoInput(leftChannel, rightChannel) {
    if (!leftChannel || !rightChannel) {
      return { valid: false, reason: 'missing_channels' };
    }
    
    if (leftChannel.length !== rightChannel.length) {
      return { valid: false, reason: 'length_mismatch' };
    }
    
    if (leftChannel.length < STEREO_CONFIG.MIN_SAMPLES) {
      return { valid: false, reason: 'insufficient_samples' };
    }
    
    // Verificar se há sinal válido
    const leftRMS = this.calculateRMS(leftChannel);
    const rightRMS = this.calculateRMS(rightChannel);
    
    if (leftRMS < STEREO_CONFIG.MIN_RMS_THRESHOLD && 
        rightRMS < STEREO_CONFIG.MIN_RMS_THRESHOLD) {
      return { valid: false, reason: 'insufficient_signal' };
    }
    
    return { 
      valid: true, 
      length: leftChannel.length,
      leftRMS,
      rightRMS
    };
  }
  
  /**
   * 📈 Calcular RMS de um canal
   */
  calculateRMS(channel) {
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    return Math.sqrt(sum / channel.length);
  }
  
  /**
   * 🔗 Calcular correlação estéreo (-1 a +1)
   * Fórmula: Pearson correlation coefficient
   */
  calculateStereoCorrelation(leftChannel, rightChannel) {
    const validation = this.validateStereoInput(leftChannel, rightChannel);
    if (!validation.valid) {
      logAudio('stereo_correlation', 'validation_failed', { reason: validation.reason });
      return null;
    }
    
    try {
      const length = leftChannel.length;
      
      // Calcular médias
      let leftSum = 0, rightSum = 0;
      for (let i = 0; i < length; i++) {
        leftSum += leftChannel[i];
        rightSum += rightChannel[i];
      }
      const leftMean = leftSum / length;
      const rightMean = rightSum / length;
      
      // Calcular correlação de Pearson
      let numerator = 0;
      let leftVariance = 0;
      let rightVariance = 0;
      
      for (let i = 0; i < length; i++) {
        const leftDiff = leftChannel[i] - leftMean;
        const rightDiff = rightChannel[i] - rightMean;
        
        numerator += leftDiff * rightDiff;
        leftVariance += leftDiff * leftDiff;
        rightVariance += rightDiff * rightDiff;
      }
      
      const denominator = Math.sqrt(leftVariance * rightVariance);
      
      if (denominator < STEREO_CONFIG.MIN_RMS_THRESHOLD) {
        logAudio('stereo_correlation', 'zero_variance', { 
          leftVariance: leftVariance.toExponential(3),
          rightVariance: rightVariance.toExponential(3)
        });
        return null;
      }
      
      const correlation = numerator / denominator;
      
      // Validar resultado
      if (!isFinite(correlation)) {
        logAudio('stereo_correlation', 'invalid_result', { correlation });
        return null;
      }
      
      // Garantir range [-1, +1]
      const clampedCorrelation = Math.max(-1, Math.min(1, correlation));
      const roundedCorrelation = Number(clampedCorrelation.toFixed(STEREO_CONFIG.CORRELATION_PRECISION));
      
      logAudio('stereo_correlation', 'calculated', {
        correlation: roundedCorrelation,
        samples: length,
        leftRMS: validation.leftRMS.toExponential(3),
        rightRMS: validation.rightRMS.toExponential(3),
        category: this.categorizeCorrelation(roundedCorrelation)
      });
      
      return {
        correlation: roundedCorrelation,
        samples: length,
        algorithm: 'Pearson_Correlation',
        category: this.categorizeCorrelation(roundedCorrelation),
        valid: true
      };
      
    } catch (error) {
      logAudio('stereo_correlation', 'calculation_error', { error: error.message });
      return null;
    }
  }
  
  /**
   * 📏 Calcular largura estéreo (0 a 1)
   * Baseado na diferença entre canais vs soma dos canais
   */
  calculateStereoWidth(leftChannel, rightChannel) {
    const validation = this.validateStereoInput(leftChannel, rightChannel);
    if (!validation.valid) {
      logAudio('stereo_width', 'validation_failed', { reason: validation.reason });
      return null;
    }
    
    try {
      const length = leftChannel.length;
      
      // Calcular sinais Mid/Side
      let midRMS = 0;
      let sideRMS = 0;
      
      for (let i = 0; i < length; i++) {
        const mid = (leftChannel[i] + rightChannel[i]) / 2; // Mono (centro)
        const side = (leftChannel[i] - rightChannel[i]) / 2; // Diferença estéreo
        
        midRMS += mid * mid;
        sideRMS += side * side;
      }
      
      midRMS = Math.sqrt(midRMS / length);
      sideRMS = Math.sqrt(sideRMS / length);
      
      // Calcular largura baseada na proporção Side/Mid
      let width;
      if (midRMS < STEREO_CONFIG.MIN_RMS_THRESHOLD) {
        // Se Mid é muito baixo, usar apenas Side
        width = sideRMS > STEREO_CONFIG.MIN_RMS_THRESHOLD ? 1.0 : 0.0;
      } else {
        // Fórmula: width = 2 * Side / (Mid + Side)
        const totalEnergy = midRMS + sideRMS;
        width = totalEnergy > 0 ? (2 * sideRMS) / totalEnergy : 0.0;
      }
      
      // Garantir range [0, 1]
      const clampedWidth = Math.max(0, Math.min(1, width));
      const roundedWidth = Number(clampedWidth.toFixed(STEREO_CONFIG.WIDTH_PRECISION));
      
      logAudio('stereo_width', 'calculated', {
        width: roundedWidth,
        midRMS: midRMS.toExponential(3),
        sideRMS: sideRMS.toExponential(3),
        samples: length,
        category: this.categorizeWidth(roundedWidth)
      });
      
      return {
        width: roundedWidth,
        midRMS,
        sideRMS,
        samples: length,
        algorithm: 'Mid_Side_Energy_Ratio',
        category: this.categorizeWidth(roundedWidth),
        valid: true
      };
      
    } catch (error) {
      logAudio('stereo_width', 'calculation_error', { error: error.message });
      return null;
    }
  }
  
  /**
   * 🏷️ Categorizar correlação estéreo
   */
  categorizeCorrelation(correlation) {
    if (correlation === null) return 'Invalid';
    if (correlation > 0.8) return 'Muito Correlacionado';
    if (correlation > 0.5) return 'Correlacionado';
    if (correlation > 0.2) return 'Moderadamente Correlacionado';
    if (correlation > -0.2) return 'Descorrelacionado';
    if (correlation > -0.5) return 'Negativamente Correlacionado';
    return 'Fortemente Anti-correlacionado';
  }
  
  /**
   * 🏷️ Categorizar largura estéreo
   */
  categorizeWidth(width) {
    if (width === null) return 'Invalid';
    if (width < 0.2) return 'Mono/Muito Estreito';
    if (width < 0.4) return 'Estreito';
    if (width < 0.6) return 'Moderado';
    if (width < 0.8) return 'Largo';
    return 'Muito Largo';
  }
  
  /**
   * 🎭 Análise completa de métricas estéreo
   */
  analyzeStereoMetrics(leftChannel, rightChannel, frameIndex = 0) {
    const correlation = this.calculateStereoCorrelation(leftChannel, rightChannel);
    const width = this.calculateStereoWidth(leftChannel, rightChannel);
    
    const result = {
      correlation: correlation ? correlation.correlation : null,
      width: width ? width.width : null,
      correlationData: correlation,
      widthData: width,
      frameIndex,
      valid: correlation !== null && width !== null
    };
    
    if (result.valid) {
      logAudio('stereo_metrics', 'analysis_complete', {
        frame: frameIndex,
        correlation: result.correlation,
        width: result.width,
        correlationCategory: correlation.category,
        widthCategory: width.category
      });
    }
    
    return result;
  }
}

/**
 * 🔄 Agregador de métricas estéreo por múltiplos frames
 */
export class StereoMetricsAggregator {
  
  /**
   * 📊 Agregar métricas de múltiplos frames
   */
  static aggregate(metricsArray) {
    if (!metricsArray || metricsArray.length === 0) {
      return {
        correlation: null,
        width: null,
        valid: false
      };
    }
    
    // Filtrar apenas resultados válidos
    const validMetrics = metricsArray.filter(m => m.valid);
    if (validMetrics.length === 0) {
      return {
        correlation: null,
        width: null,
        valid: false
      };
    }
    
    // Agregar correlações usando mediana
    const correlations = validMetrics
      .map(m => m.correlation)
      .filter(c => c !== null)
      .sort((a, b) => a - b);
    
    const widths = validMetrics
      .map(m => m.width)
      .filter(w => w !== null)
      .sort((a, b) => a - b);
    
    let finalCorrelation = null;
    let finalWidth = null;
    
    if (correlations.length > 0) {
      const medianIndex = Math.floor(correlations.length / 2);
      finalCorrelation = correlations.length % 2 === 0
        ? (correlations[medianIndex - 1] + correlations[medianIndex]) / 2
        : correlations[medianIndex];
      finalCorrelation = Number(finalCorrelation.toFixed(STEREO_CONFIG.CORRELATION_PRECISION));
    }
    
    if (widths.length > 0) {
      const medianIndex = Math.floor(widths.length / 2);
      finalWidth = widths.length % 2 === 0
        ? (widths[medianIndex - 1] + widths[medianIndex]) / 2
        : widths[medianIndex];
      finalWidth = Number(finalWidth.toFixed(STEREO_CONFIG.WIDTH_PRECISION));
    }
    
    const calculator = new StereoMetricsCalculator();
    
    return {
      correlation: finalCorrelation,
      width: finalWidth,
      correlationCategory: finalCorrelation !== null ? 
        calculator.categorizeCorrelation(finalCorrelation) : null,
      widthCategory: finalWidth !== null ? 
        calculator.categorizeWidth(finalWidth) : null,
      framesUsed: validMetrics.length,
      algorithm: 'Aggregated_Median',
      valid: finalCorrelation !== null && finalWidth !== null
    };
  }
}

/**
 * 📦 Funções principais de exportação
 */
export function calculateStereoCorrelation(leftChannel, rightChannel) {
  const calculator = new StereoMetricsCalculator();
  return calculator.calculateStereoCorrelation(leftChannel, rightChannel);
}

export function calculateStereoWidth(leftChannel, rightChannel) {
  const calculator = new StereoMetricsCalculator();
  return calculator.calculateStereoWidth(leftChannel, rightChannel);
}

export function analyzeStereoMetrics(leftChannel, rightChannel) {
  const calculator = new StereoMetricsCalculator();
  return calculator.analyzeStereoMetrics(leftChannel, rightChannel);
}

console.log('🎭 Stereo Metrics Calculator carregado - Correlação (-1 a +1) e Largura (0 a 1)');