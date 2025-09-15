// 🎵 DOMINANT FREQUENCIES - Análise de Picos Espectrais
// Implementação para identificar frequências dominantes no espectro

import { logAudio } from '../error-handling.js';

/**
 * 🎯 Configurações para análise de frequências dominantes
 */
const DOMINANT_FREQ_CONFIG = {
  MIN_MAGNITUDE_THRESHOLD: 0.01,  // Magnitude mínima para considerar um pico
  MIN_FREQUENCY: 20,              // Frequência mínima em Hz
  MAX_FREQUENCY: 20000,           // Frequência máxima em Hz
  MIN_PEAK_SEPARATION: 50,        // Separação mínima entre picos em Hz
  MAX_DOMINANT_FREQUENCIES: 10,   // Máximo de frequências a retornar
  PEAK_PROMINENCE_THRESHOLD: 0.02 // Threshold para prominência do pico
};

/**
 * 🔍 Analisador de Frequências Dominantes
 */
export class DominantFrequencyAnalyzer {
  constructor(sampleRate, fftSize) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
    this.numBins = Math.floor(fftSize / 2) + 1;
    
    // Pre-calcular array de frequências
    this.frequencies = new Float32Array(this.numBins);
    for (let i = 0; i < this.numBins; i++) {
      this.frequencies[i] = i * this.frequencyResolution;
    }
  }
  
  /**
   * 📊 Analisar um frame individual para picos espectrais
   */
  analyzeFrame(magnitude, frameIndex = 0) {
    try {
      if (!magnitude || magnitude.length === 0) {
        return [];
      }
      
      // Usar apenas meia-espectro
      const halfSpectrum = magnitude.slice(0, this.numBins);
      
      // Encontrar picos locais
      const peaks = this.findSpectralPeaks(halfSpectrum);
      
      // Filtrar por frequência e magnitude
      const validPeaks = peaks.filter(peak => {
        const freq = this.frequencies[peak.bin];
        return freq >= DOMINANT_FREQ_CONFIG.MIN_FREQUENCY &&
               freq <= DOMINANT_FREQ_CONFIG.MAX_FREQUENCY &&
               peak.magnitude >= DOMINANT_FREQ_CONFIG.MIN_MAGNITUDE_THRESHOLD;
      });
      
      // Converter para formato final
      return validPeaks.map(peak => ({
        frequency: Math.round(this.frequencies[peak.bin] * 10) / 10, // 1 decimal
        magnitude: Math.round(peak.magnitude * 1000) / 1000, // 3 decimais
        bin: peak.bin,
        prominence: Math.round(peak.prominence * 1000) / 1000,
        frameIndex
      }));
      
    } catch (error) {
      logAudio('dominant_freq', 'frame_error', { 
        frame: frameIndex, 
        error: error.message 
      });
      return [];
    }
  }
  
  /**
   * 🏔️ Encontrar picos espectrais usando algoritmo de detecção de picos
   */
  findSpectralPeaks(spectrum) {
    const peaks = [];
    
    // Algoritmo simples de detecção de picos
    for (let i = 2; i < spectrum.length - 2; i++) {
      const current = spectrum[i];
      const prev1 = spectrum[i - 1];
      const prev2 = spectrum[i - 2];
      const next1 = spectrum[i + 1];
      const next2 = spectrum[i + 2];
      
      // Verificar se é um pico local (maior que vizinhos)
      if (current > prev1 && current > next1 && 
          current > prev2 && current > next2) {
        
        // Calcular prominência (diferença com os vizinhos)
        const prominence = current - Math.max(prev1, next1);
        
        if (prominence >= DOMINANT_FREQ_CONFIG.PEAK_PROMINENCE_THRESHOLD) {
          peaks.push({
            bin: i,
            magnitude: current,
            prominence: prominence
          });
        }
      }
    }
    
    // Ordenar por magnitude (picos mais altos primeiro)
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    
    // Aplicar separação mínima entre picos
    const filteredPeaks = this.applySeparationFilter(peaks);
    
    // Limitar número máximo
    return filteredPeaks.slice(0, DOMINANT_FREQ_CONFIG.MAX_DOMINANT_FREQUENCIES);
  }
  
  /**
   * 📏 Aplicar filtro de separação mínima entre picos
   */
  applySeparationFilter(peaks) {
    const filtered = [];
    
    for (const peak of peaks) {
      const freq = this.frequencies[peak.bin];
      
      // Verificar se está muito próximo de um pico já selecionado
      const tooClose = filtered.some(existing => {
        const existingFreq = this.frequencies[existing.bin];
        return Math.abs(freq - existingFreq) < DOMINANT_FREQ_CONFIG.MIN_PEAK_SEPARATION;
      });
      
      if (!tooClose) {
        filtered.push(peak);
      }
    }
    
    return filtered;
  }
}

/**
 * 🔄 Agregador de Frequências Dominantes por múltiplos frames
 */
export class DominantFrequencyAggregator {
  
  /**
   * 📦 Agregar frequências dominantes de múltiplos frames
   */
  static aggregate(frameResults) {
    if (!frameResults || frameResults.length === 0) {
      return [];
    }
    
    // Coletar todas as frequências de todos os frames
    const allFrequencies = [];
    frameResults.forEach(frameResult => {
      if (Array.isArray(frameResult)) {
        frameResult.forEach(freq => {
          if (freq && typeof freq.frequency === 'number') {
            allFrequencies.push(freq);
          }
        });
      }
    });
    
    if (allFrequencies.length === 0) {
      return [];
    }
    
    // Agrupar frequências similares (±25Hz)
    const groupedFrequencies = this.groupSimilarFrequencies(allFrequencies, 25);
    
    // Calcular estatísticas para cada grupo
    const aggregatedFrequencies = groupedFrequencies.map(group => {
      const frequencies = group.map(f => f.frequency);
      const magnitudes = group.map(f => f.magnitude);
      const prominences = group.map(f => f.prominence);
      
      return {
        frequency: Math.round(this.median(frequencies) * 10) / 10,
        meanMagnitude: Math.round(this.mean(magnitudes) * 1000) / 1000,
        maxMagnitude: Math.round(Math.max(...magnitudes) * 1000) / 1000,
        meanProminence: Math.round(this.mean(prominences) * 1000) / 1000,
        occurrences: group.length,
        consistency: Math.round((group.length / frameResults.length) * 100) / 100
      };
    });
    
    // Ordenar por consistência * magnitude máxima (frequências mais importantes)
    aggregatedFrequencies.sort((a, b) => {
      const scoreA = a.consistency * a.maxMagnitude;
      const scoreB = b.consistency * b.maxMagnitude;
      return scoreB - scoreA;
    });
    
    // Retornar top 10
    return aggregatedFrequencies.slice(0, 10);
  }
  
  /**
   * 🔗 Agrupar frequências similares
   */
  static groupSimilarFrequencies(frequencies, tolerance) {
    const groups = [];
    
    frequencies.forEach(freq => {
      // Encontrar grupo existente
      let group = groups.find(g => {
        return g.some(existing => 
          Math.abs(existing.frequency - freq.frequency) <= tolerance
        );
      });
      
      if (group) {
        group.push(freq);
      } else {
        groups.push([freq]);
      }
    });
    
    return groups;
  }
  
  /**
   * 📊 Calcular mediana
   */
  static median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  /**
   * 📊 Calcular média
   */
  static mean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

/**
 * 🎨 Serializador para JSON final
 */
export function serializeDominantFrequencies(frequencies) {
  if (!Array.isArray(frequencies)) {
    return [];
  }
  
  return frequencies.map(freq => ({
    frequency: Number(freq.frequency),
    magnitude: Number(freq.meanMagnitude || freq.magnitude),
    maxMagnitude: Number(freq.maxMagnitude || freq.magnitude),
    occurrences: Number(freq.occurrences || 1),
    consistency: Number(freq.consistency || 0),
    prominence: Number(freq.meanProminence || freq.prominence || 0)
  }));
}

console.log('🎵 Dominant Frequency Analyzer carregado - Análise de picos espectrais');