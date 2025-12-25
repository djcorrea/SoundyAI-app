// 🎵 SPECTRAL CENTROID CORRECTED - Centro de brilho em Hz
// Conversão correta para Hz refletindo o "centro de brilho" da música

import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🎯 DEBUG THROTTLING GLOBAL
 * Controla logging de dados frame-by-frame para evitar sobrecarga no Railway
 */
const shouldLogFrame = (frame) => process.env.SOUNDY_DEBUG === 'true' && frame % 200 === 0;

/**
 * 🔧 Configurações do Spectral Centroid
 */
const CENTROID_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  MIN_MAGNITUDE_THRESHOLD: 1e-10,
  MIN_TOTAL_MAGNITUDE: 1e-8,
  FREQUENCY_MIN: 20, // Hz - limite inferior audível
  FREQUENCY_MAX: 20000, // Hz - limite superior audível
  PRECISION_DIGITS: 1 // Casas decimais para Hz
};

/**
 * 🎵 Calculadora de Spectral Centroid Profissional
 */
export class SpectralCentroidCalculator {
  
  constructor(sampleRate = 48000, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
    this.nyquistFreq = sampleRate / 2;
    
    // Pre-calcular frequências dos bins
    this.frequencies = this.calculateBinFrequencies();
  }
  
  /**
   * 📊 Calcular frequências para cada bin FFT
   */
  calculateBinFrequencies() {
    const frequencies = [];
    const halfFftSize = Math.floor(this.fftSize / 2);
    
    for (let bin = 0; bin <= halfFftSize; bin++) {
      const frequency = bin * this.frequencyResolution;
      frequencies.push(frequency);
    }
    
    return frequencies;
  }
  
  /**
   * 🎵 Calcular magnitude RMS estéreo
   */
  calculateMagnitudeRMS(leftMagnitude, rightMagnitude) {
    const length = Math.min(leftMagnitude.length, rightMagnitude.length);
    const rmsSpectrum = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      // RMS estéreo: sqrt((L² + R²) / 2)
      const leftEnergy = leftMagnitude[i] * leftMagnitude[i];
      const rightEnergy = rightMagnitude[i] * rightMagnitude[i];
      rmsSpectrum[i] = Math.sqrt((leftEnergy + rightEnergy) / 2);
    }
    
    return rmsSpectrum;
  }
  
  /**
   * 🌟 Calcular Spectral Centroid em Hz (centro de brilho)
   * Fórmula: Σ(frequency[i] * magnitude[i]) / Σ(magnitude[i])
   */
  calculateCentroidHz(leftMagnitude, rightMagnitude, frameIndex = 0) {
    try {
      // Calcular magnitude RMS
      const magnitude = this.calculateMagnitudeRMS(leftMagnitude, rightMagnitude);
      const usableBins = Math.min(magnitude.length, this.frequencies.length);
      
      let weightedSum = 0;
      let totalMagnitude = 0;
      let validBins = 0;
      
      // Calcular centróide ponderado por frequência
      for (let bin = 1; bin < usableBins; bin++) { // Começar do bin 1 (pular DC)
        const frequency = this.frequencies[bin];
        const mag = magnitude[bin];
        
        // Filtrar frequências audíveis e magnitudes válidas
        if (frequency >= CENTROID_CONFIG.FREQUENCY_MIN && 
            frequency <= CENTROID_CONFIG.FREQUENCY_MAX &&
            mag > CENTROID_CONFIG.MIN_MAGNITUDE_THRESHOLD) {
          
          weightedSum += frequency * mag;
          totalMagnitude += mag;
          validBins++;
        }
      }
      
      // Validar energia total suficiente
      if (totalMagnitude < CENTROID_CONFIG.MIN_TOTAL_MAGNITUDE || validBins < 10) {
        return null;
      }
      
      // Calcular centróide final em Hz
      const centroidHz = weightedSum / totalMagnitude;
      
      // Validar resultado
      if (!isFinite(centroidHz) || 
          centroidHz < CENTROID_CONFIG.FREQUENCY_MIN || 
          centroidHz > CENTROID_CONFIG.FREQUENCY_MAX) {
        return null;
      }

      const roundedCentroid = Number(centroidHz.toFixed(CENTROID_CONFIG.PRECISION_DIGITS));
      
      return {
        centroidHz: roundedCentroid,
        totalMagnitude,
        validBins,
        algorithm: 'Weighted_Frequency_RMS',
        brightnessCategory: this.categorizeBrightness(roundedCentroid),
        valid: true
      };
      
    } catch (error) {
      return null;
    }
    }
  }
  
  /**
   * 🌟 Categorizar brilho baseado no centróide
   */
  categorizeBrightness(centroidHz) {
    if (centroidHz < 1000) return 'Muito Escuro';
    if (centroidHz < 2000) return 'Escuro';
    if (centroidHz < 3500) return 'Neutro';
    if (centroidHz < 6000) return 'Brilhante';
    if (centroidHz < 10000) return 'Muito Brilhante';
    return 'Extremamente Brilhante';
  }
}

/**
 * 🔄 Agregador de Spectral Centroid por múltiplos frames
 */
export class SpectralCentroidAggregator {
  
  /**
   * 📊 Agregar centróides de múltiplos frames usando mediana
   */
  static aggregate(centroidsArray) {
    if (!centroidsArray || centroidsArray.length === 0) {
      return null;
    }
    
    // Filtrar apenas resultados válidos
    const validCentroids = centroidsArray
      .filter(c => c && c.valid && c.centroidHz !== null)
      .map(c => c.centroidHz)
      .sort((a, b) => a - b);
    
    if (validCentroids.length === 0) {
      return null;
    }
    
    // Calcular estatísticas
    const medianIndex = Math.floor(validCentroids.length / 2);
    const medianCentroid = validCentroids.length % 2 === 0
      ? (validCentroids[medianIndex - 1] + validCentroids[medianIndex]) / 2
      : validCentroids[medianIndex];
    
    const avgCentroid = validCentroids.reduce((sum, c) => sum + c, 0) / validCentroids.length;
    const minCentroid = validCentroids[0];
    const maxCentroid = validCentroids[validCentroids.length - 1];
    
    const finalCentroid = Number(medianCentroid.toFixed(CENTROID_CONFIG.PRECISION_DIGITS));
    
    return {
      centroidHz: finalCentroid,
      statistics: {
        median: Number(medianCentroid.toFixed(1)),
        average: Number(avgCentroid.toFixed(1)),
        min: Number(minCentroid.toFixed(1)),
        max: Number(maxCentroid.toFixed(1)),
        range: Number((maxCentroid - minCentroid).toFixed(1))
      },
      algorithm: 'Weighted_Frequency_RMS_Aggregated',
      brightnessCategory: new SpectralCentroidCalculator().categorizeBrightness(finalCentroid),
      framesUsed: validCentroids.length,
      processedFrames: validCentroids.length,  // ← CORRIGE: json-output.js busca processedFrames
      valid: true
    };
  }
}

/**
 * 📦 Função principal de exportação
 */
export function calculateSpectralCentroid(leftMagnitude, rightMagnitude, sampleRate = 48000, fftSize = 4096) {
  const calculator = new SpectralCentroidCalculator(sampleRate, fftSize);
  return calculator.calculateCentroidHz(leftMagnitude, rightMagnitude);
}

// 🎯 Log de inicialização (executado apenas 1x na importação do módulo)
if (process.env.SOUNDY_DEBUG === 'true') {
  console.log('🎵 Spectral Centroid Calculator carregado - Centro de brilho em Hz');
}