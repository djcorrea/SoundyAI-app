// 🎵 SPECTRAL METRICS - Implementação correta com fórmulas matemáticas padrão
// Schema numérico único, sem objetos/arrays/strings

import { makeErr } from '../error-handling.js';

/**
 * 🎯 Configurações e constantes
 */
const SPECTRAL_CONFIG = {
  EPS: 1e-12,           // Evitar divisão por zero
  ROLLOFF_THRESHOLD: 0.85,  // 85% por padrão
  MIN_VALID_ENERGY: 1e-10   // Energia mínima para cálculos válidos
};

/**
 * 📊 Schema de saída das métricas espectrais
 * @typedef {Object} SpectralMetrics
 * @property {number|null} spectralCentroidHz - Centroide espectral em Hz
 * @property {number|null} spectralRolloffHz - Rolloff 85% em Hz  
 * @property {number|null} spectralBandwidthHz - Largura de banda em Hz
 * @property {number|null} spectralSpreadHz - Desvio padrão espectral em Hz
 * @property {number|null} spectralFlatness - Planura espectral [0-1]
 * @property {number|null} spectralCrest - Fator de crista
 * @property {number|null} spectralSkewness - Assimetria espectral
 * @property {number|null} spectralKurtosis - Curtose espectral
 */

/**
 * 🧮 Utilitário para sanitização numérica
 */
const num = (v) => (Number.isFinite(v) ? v : null);

/**
 * 🎵 Calculadora de métricas espectrais completas
 */
export class SpectralMetricsCalculator {
  constructor(sampleRate, fftSize) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
    this.nyquistFreq = sampleRate / 2;
    this.numBins = Math.floor(fftSize / 2) + 1; // 0..N/2 inclusive
    
    // Pre-calcular frequências para eficiência
    this.frequencies = new Float32Array(this.numBins);
    for (let i = 0; i < this.numBins; i++) {
      this.frequencies[i] = i * this.frequencyResolution;
    }
  }
  
  /**
   * 📊 Calcular todas as métricas espectrais de uma magnitude
   */
  calculateAllMetrics(magnitude, frameIndex = 0) {
    try {
      // Validação da entrada
      if (!magnitude || magnitude.length === 0) {
        return this.getNullMetrics();
      }
      
      // Usar apenas meia-espectro (0..N/2)
      const halfSpectrum = magnitude.slice(0, this.numBins);
      
      // Calcular energia (magnitude ao quadrado)
      const mag2 = new Float32Array(this.numBins);
      let totalEnergy = 0;
      let totalMagnitude = 0;
      
      for (let i = 0; i < this.numBins; i++) {
        mag2[i] = halfSpectrum[i] * halfSpectrum[i];
        totalEnergy += mag2[i];
        totalMagnitude += halfSpectrum[i];
      }
      
      // Verificar energia mínima
      if (totalEnergy <= SPECTRAL_CONFIG.MIN_VALID_ENERGY) {
        return this.getNullMetrics();
      }
      
      // Calcular todas as métricas
      const centroidHz = this.calculateCentroid(mag2, totalEnergy);
      const rolloffHz = this.calculateRolloff(mag2, totalEnergy);
      const { spreadHz, bandwidthHz } = this.calculateSpreadAndBandwidth(mag2, totalEnergy, centroidHz);
      const flatness = this.calculateFlatness(halfSpectrum);
      const crest = this.calculateCrest(halfSpectrum, totalMagnitude);
      const { skewness, kurtosis } = this.calculateMoments(mag2, totalEnergy, centroidHz);
      
      return {
        spectralCentroidHz: num(centroidHz),
        spectralRolloffHz: num(rolloffHz),
        spectralBandwidthHz: num(bandwidthHz),
        spectralSpreadHz: num(spreadHz),
        spectralFlatness: num(flatness),
        spectralCrest: num(crest),
        spectralSkewness: num(skewness),
        spectralKurtosis: num(kurtosis)
      };
      
    } catch (error) {
      return this.getNullMetrics();
    }
  }
  
  /**
   * 🎯 Calcular centroide espectral em Hz
   */
  calculateCentroid(mag2, totalEnergy) {
    let weightedSum = 0;
    
    // Σ(freq[i] * mag2[i]) / Σ mag2[i]
    for (let i = 1; i < this.numBins; i++) { // Pular DC (i=0)
      weightedSum += this.frequencies[i] * mag2[i];
    }
    
    const centroidHz = weightedSum / totalEnergy;
    
    // Validação de range
    if (!isFinite(centroidHz) || centroidHz < 0 || centroidHz > this.nyquistFreq) {
      return null;
    }
    
    return centroidHz;
  }
  
  /**
   * 📈 Calcular rolloff espectral em Hz (85% por padrão)
   */
  calculateRolloff(mag2, totalEnergy, threshold = SPECTRAL_CONFIG.ROLLOFF_THRESHOLD) {
    const targetEnergy = threshold * totalEnergy;
    let cumulativeEnergy = 0;
    
    for (let i = 0; i < this.numBins; i++) {
      cumulativeEnergy += mag2[i];
      if (cumulativeEnergy >= targetEnergy) {
        return this.frequencies[i];
      }
    }
    
    // Se chegou até aqui, retornar Nyquist
    return this.nyquistFreq;
  }
  
  /**
   * 📐 Calcular spread e bandwidth espectrais
   */
  calculateSpreadAndBandwidth(mag2, totalEnergy, centroidHz) {
    if (centroidHz === null) {
      return { spreadHz: null, bandwidthHz: null };
    }
    
    let variance = 0;
    
    // variance = Σ((freq[i] - μ)² * mag2[i]) / Σ mag2[i]
    for (let i = 1; i < this.numBins; i++) {
      const freqDiff = this.frequencies[i] - centroidHz;
      variance += (freqDiff * freqDiff) * mag2[i];
    }
    
    variance /= totalEnergy;
    const spreadHz = Math.sqrt(variance);
    const bandwidthHz = spreadHz; // Convenção: bandwidth = spread
    
    return {
      spreadHz: isFinite(spreadHz) ? spreadHz : null,
      bandwidthHz: isFinite(bandwidthHz) ? bandwidthHz : null
    };
  }
  
  /**
   * 📊 Calcular planura espectral (flatness)
   */
  calculateFlatness(magnitude) {
    let arithmeticSum = 0;
    let logSum = 0;
    let validBins = 0;
    
    // Pular DC component
    for (let i = 1; i < this.numBins; i++) {
      const mag2 = magnitude[i] * magnitude[i];
      if (mag2 > SPECTRAL_CONFIG.EPS) {
        arithmeticSum += mag2;
        logSum += Math.log(mag2 + SPECTRAL_CONFIG.EPS);
        validBins++;
      }
    }
    
    if (validBins === 0) return null;
    
    const arithmeticMean = arithmeticSum / validBins;
    const geometricMean = Math.exp(logSum / validBins);
    
    const flatness = geometricMean / (arithmeticMean + SPECTRAL_CONFIG.EPS);
    
    return isFinite(flatness) ? Math.min(flatness, 1.0) : null;
  }
  
  /**
   * 🏔️ Calcular fator de crista
   */
  calculateCrest(magnitude, totalMagnitude) {
    if (totalMagnitude <= SPECTRAL_CONFIG.EPS) return null;
    
    let maxMagnitude = 0;
    for (let i = 1; i < this.numBins; i++) { // Pular DC
      maxMagnitude = Math.max(maxMagnitude, magnitude[i]);
    }
    
    const meanMagnitude = totalMagnitude / this.numBins;
    const crest = maxMagnitude / (meanMagnitude + SPECTRAL_CONFIG.EPS);
    
    return isFinite(crest) ? crest : null;
  }
  
  /**
   * 📏 Calcular momentos espectrais (skewness e kurtosis)
   */
  calculateMoments(mag2, totalEnergy, centroidHz) {
    if (centroidHz === null) {
      return { skewness: null, kurtosis: null };
    }
    
    let m2 = 0, m3 = 0, m4 = 0;
    
    for (let i = 1; i < this.numBins; i++) {
      const z = this.frequencies[i] - centroidHz;
      const z2 = z * z;
      const z3 = z2 * z;
      const z4 = z3 * z;
      
      m2 += z2 * mag2[i];
      m3 += z3 * mag2[i];
      m4 += z4 * mag2[i];
    }
    
    m2 /= totalEnergy;
    m3 /= totalEnergy;
    m4 /= totalEnergy;
    
    const skewness = m3 / (Math.pow(m2, 1.5) + SPECTRAL_CONFIG.EPS);
    const kurtosis = m4 / (m2 * m2 + SPECTRAL_CONFIG.EPS);
    
    return {
      skewness: isFinite(skewness) ? skewness : null,
      kurtosis: isFinite(kurtosis) ? kurtosis : null
    };
  }
  
  /**
   * 🔇 Métricas nulas para casos de energia insuficiente
   */
  getNullMetrics() {
    return {
      spectralCentroidHz: null,
      spectralRolloffHz: null,
      spectralBandwidthHz: null,
      spectralSpreadHz: null,
      spectralFlatness: null,
      spectralCrest: null,
      spectralSkewness: null,
      spectralKurtosis: null
    };
  }
}

/**
 * 📦 Agregador de métricas espectrais por frames
 */
export class SpectralMetricsAggregator {
  
  /**
   * 🔄 Agregar array de métricas em valores únicos
   */
  static aggregate(metricsArray) {
    if (!metricsArray || metricsArray.length === 0) {
      return new SpectralMetricsCalculator(48000, 4096).getNullMetrics();
    }
    
    const result = {};
    const keys = Object.keys(metricsArray[0]);
    
    for (const key of keys) {
      const validValues = metricsArray
        .map(m => m[key])
        .filter(v => v !== null && isFinite(v));
        
      if (validValues.length === 0) {
        result[key] = null;
      } else {
        // Usar mediana para robustez
        validValues.sort((a, b) => a - b);
        const medianIndex = Math.floor(validValues.length / 2);
        result[key] = validValues.length % 2 === 0
          ? (validValues[medianIndex - 1] + validValues[medianIndex]) / 2
          : validValues[medianIndex];
      }
    }
    
    return result;
  }
}

/**
 * 🎨 Serializador para JSON final
 */
export function serializeSpectralMetrics(metrics) {
  return {
    spectralCentroidHz: num(metrics.spectralCentroidHz)?.toFixed ? 
      Number(metrics.spectralCentroidHz.toFixed(2)) : null,
    spectralRolloffHz: num(metrics.spectralRolloffHz)?.toFixed ? 
      Number(metrics.spectralRolloffHz.toFixed(2)) : null,
    spectralBandwidthHz: num(metrics.spectralBandwidthHz)?.toFixed ? 
      Number(metrics.spectralBandwidthHz.toFixed(2)) : null,
    spectralSpreadHz: num(metrics.spectralSpreadHz)?.toFixed ? 
      Number(metrics.spectralSpreadHz.toFixed(2)) : null,
    spectralFlatness: num(metrics.spectralFlatness) ?? null,
    spectralCrest: num(metrics.spectralCrest) ?? null,
    spectralSkewness: num(metrics.spectralSkewness) ?? null,
    spectralKurtosis: num(metrics.spectralKurtosis) ?? null
  };
}