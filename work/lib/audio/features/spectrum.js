// 📊 SPECTRUM ANALYZER - Análise espectral com features avançadas
// Centroide, rolloff, flux, harmonics e envelope espectral

import { STFTEngine } from '../fft.js';

/**
 * 🌈 Spectrum Analyzer Engine
 */
class SpectrumAnalyzer {
  constructor(fftSize = 4096, hopSize = 1024, windowType = 'hann') {
    this.fftSize = fftSize;
    this.hopSize = hopSize;
    this.stft = new STFTEngine(fftSize, hopSize, windowType);
  }

  /**
   * 🎵 Análise espectral completa
   * @param {Float32Array} signal - Sinal para análise
   * @param {Number} sampleRate - Taxa de amostragem
   * @returns {Object} Features espectrais
   */
  analyze(signal, sampleRate = 48000) {
    const startTime = Date.now();
    
    // STFT
    const stftResult = this.stft.analyze(signal, sampleRate);
    const { powerSpectrum, freqBins, spectrogram } = stftResult;
    
    // Features básicas
  const basicFeatures = this.calculateBasicFeatures(powerSpectrum, freqBins);
    
    // Centroide espectral temporal
    const centroidEvolution = this.calculateSpectralCentroidEvolution(spectrogram, freqBins);
    
    // Rolloff dinâmico
    const rolloffFeatures = this.calculateRolloffFeatures(powerSpectrum, freqBins);
    
    // Flux espectral
    const fluxFeatures = this.calculateSpectralFlux(spectrogram);
    
    // Análise harmônica
    const harmonicFeatures = this.analyzeHarmonics(powerSpectrum, freqBins);
    
    // Envelope espectral
    const envelopeFeatures = this.calculateSpectralEnvelope(powerSpectrum, freqBins);
    
    const processingTime = Date.now() - startTime;
    
    return {
      // Features básicas
  centroid_hz: basicFeatures.centroid,
  rolloff50_hz: basicFeatures.rolloff50,
  rolloff85_hz: basicFeatures.rolloff85,
      rolloff95_hz: rolloffFeatures.rolloff95,
      
      // Flux
      spectral_flux: fluxFeatures.meanFlux,
      flux_variation: fluxFeatures.fluxVariation,
      
      // Harmônicos
  harmonic_ratio: harmonicFeatures.harmonicRatio,
  thd_ratio: harmonicFeatures.thdRatio,
  thd_percent: harmonicFeatures.thdPercent,
      inharmonicity: harmonicFeatures.inharmonicity,
      fundamental_freq: harmonicFeatures.fundamentalFreq,
      
      // Envelope
      spectral_tilt: envelopeFeatures.tilt,
      spectral_slope: envelopeFeatures.slope,
      spectral_kurtosis: envelopeFeatures.kurtosis,
      
      // Distribuição temporal
      centroid_mean: centroidEvolution.mean,
      centroid_std: centroidEvolution.std,
      centroid_range: centroidEvolution.range,
      
      // Metadata
      fft_size: this.fftSize,
      hop_size: this.hopSize,
      num_frames: spectrogram.length,
      processing_time: processingTime,
      
      // Raw data (compactado)
      spectrum_avg: this.compactSpectrum(powerSpectrum, 256),
      freq_bins_compact: this.compactFreqBins(freqBins, 256)
    };
  }

  /**
   * 📊 Features espectrais básicas
   */
  calculateBasicFeatures(powerSpectrum, freqBins) {
    let totalEnergy = 0;
    let centroidNumerator = 0;
    let peak = 0;
    let peakFreq = 0;
    
    // Skip DC bin
    for (let i = 1; i < powerSpectrum.length; i++) {
      const power = powerSpectrum[i];
      const freq = freqBins[i];
      
      totalEnergy += power;
      centroidNumerator += freq * power;
      
      if (power > peak) {
        peak = power;
        peakFreq = freq;
      }
    }
    
    const centroid = totalEnergy > 0 ? centroidNumerator / totalEnergy : 0;
    
    // Rolloff 50% e 85%
    const rolloffTarget50 = totalEnergy * 0.50;
    const rolloffTarget85 = totalEnergy * 0.85;
    let rolloffEnergy = 0;
    let rolloff50 = 0;
    let rolloff85 = 0;
    for (let i = 1; i < powerSpectrum.length; i++) {
      rolloffEnergy += powerSpectrum[i];
      if (!rolloff50 && rolloffEnergy >= rolloffTarget50) rolloff50 = freqBins[i];
      if (!rolloff85 && rolloffEnergy >= rolloffTarget85) { rolloff85 = freqBins[i]; break; }
    }
    
    return {
      centroid,
  rolloff50,
  rolloff85,
      peakFreq,
      totalEnergy: Math.sqrt(totalEnergy),
      spectralPeak: Math.sqrt(peak)
    };
  }

  /**
   * 🎯 Evolução temporal do centroide
   */
  calculateSpectralCentroidEvolution(spectrogram, freqBins) {
    const centroids = [];
    
    for (const frame of spectrogram) {
      let totalEnergy = 0;
      let centroidNumerator = 0;
      
      for (let i = 1; i < frame.length; i++) {
        const power = frame[i] * frame[i]; // Power
        totalEnergy += power;
        centroidNumerator += freqBins[i] * power;
      }
      
      const centroid = totalEnergy > 0 ? centroidNumerator / totalEnergy : 0;
      centroids.push(centroid);
    }
    
    if (centroids.length === 0) {
      return { mean: 0, std: 0, range: 0 };
    }
    
    // Estatísticas
    const mean = centroids.reduce((sum, c) => sum + c, 0) / centroids.length;
    const variance = centroids.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / centroids.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...centroids);
    const max = Math.max(...centroids);
    
    return { mean, std, range: max - min, values: centroids };
  }

  /**
   * 📈 Features de rolloff avançadas
   */
  calculateRolloffFeatures(powerSpectrum, freqBins) {
    const totalEnergy = powerSpectrum.slice(1).reduce((sum, p) => sum + p, 0);
    
    const rolloffs = [0.85, 0.90, 0.95, 0.99];
    const results = {};
    
    for (const percentage of rolloffs) {
      const target = totalEnergy * percentage;
      let energy = 0;
      let rolloffFreq = 0;
      
      for (let i = 1; i < powerSpectrum.length; i++) {
        energy += powerSpectrum[i];
        if (energy >= target) {
          rolloffFreq = freqBins[i];
          break;
        }
      }
      
      const key = `rolloff${Math.round(percentage * 100)}`;
      results[key] = rolloffFreq;
    }
    
    return results;
  }

  /**
   * 🌊 Flux espectral (mudança entre frames)
   */
  calculateSpectralFlux(spectrogram) {
    if (spectrogram.length < 2) {
      return { meanFlux: 0, fluxVariation: 0, fluxValues: [] };
    }
    
    const fluxValues = [];
    
    for (let frameIdx = 1; frameIdx < spectrogram.length; frameIdx++) {
      const currentFrame = spectrogram[frameIdx];
      const previousFrame = spectrogram[frameIdx - 1];
      
      let flux = 0;
      for (let binIdx = 1; binIdx < currentFrame.length; binIdx++) {
        const diff = currentFrame[binIdx] - previousFrame[binIdx];
        flux += diff > 0 ? diff : 0; // Half-wave rectification
      }
      
      fluxValues.push(flux);
    }
    
    const meanFlux = fluxValues.reduce((sum, f) => sum + f, 0) / fluxValues.length;
    const variance = fluxValues.reduce((sum, f) => sum + Math.pow(f - meanFlux, 2), 0) / fluxValues.length;
    
    return {
      meanFlux,
      fluxVariation: Math.sqrt(variance),
      fluxValues: fluxValues.slice(0, 100) // Limitar para não explodir JSON
    };
  }

  /**
   * 🎼 Análise harmônica
   */
  analyzeHarmonics(powerSpectrum, freqBins) {
    // Encontrar pico fundamental
    let maxPower = 0;
    let fundamentalBin = 0;
    let fundamentalFreq = 0;
    
    // Procurar na faixa típica de fundamentais (80-1000 Hz)
    const minBin = this.freqToBin(80, freqBins);
    const maxBin = this.freqToBin(1000, freqBins);
    
    for (let i = minBin; i <= maxBin && i < powerSpectrum.length; i++) {
      if (powerSpectrum[i] > maxPower) {
        maxPower = powerSpectrum[i];
        fundamentalBin = i;
        fundamentalFreq = freqBins[i];
      }
    }
    
    if (fundamentalFreq === 0) {
      return {
        harmonicRatio: 0,
        inharmonicity: 0,
        fundamentalFreq: 0,
        harmonicPeaks: []
      };
    }
    
    // Buscar harmônicos (2f, 3f, 4f, 5f, 6f)
    const harmonicPeaks = [];
  let harmonicEnergy = 0;
  let fundamentalPower = maxPower;
    let totalEnergyInRange = 0;
    
    for (let harmonic = 1; harmonic <= 6; harmonic++) {
      const expectedFreq = fundamentalFreq * harmonic;
      const expectedBin = this.freqToBin(expectedFreq, freqBins);
      
      // Buscar pico próximo ao harmônico esperado (±5% tolerância)
      const tolerance = Math.ceil(expectedBin * 0.05);
      const startBin = Math.max(0, expectedBin - tolerance);
      const endBin = Math.min(powerSpectrum.length - 1, expectedBin + tolerance);
      
      let peakPower = 0;
      let peakBin = expectedBin;
      
      for (let i = startBin; i <= endBin; i++) {
        if (powerSpectrum[i] > peakPower) {
          peakPower = powerSpectrum[i];
          peakBin = i;
        }
      }
      
      harmonicPeaks.push({
        harmonic,
        expectedFreq,
        actualFreq: freqBins[peakBin],
        power: peakPower,
        deviation: Math.abs(freqBins[peakBin] - expectedFreq)
      });
      
      harmonicEnergy += peakPower;
    }
    
    // Calcular energia total na faixa de interesse
    for (let i = minBin; i <= Math.min(maxBin * 6, powerSpectrum.length - 1); i++) {
      totalEnergyInRange += powerSpectrum[i];
    }
    
    // Métricas harmônicas
    const harmonicRatio = totalEnergyInRange > 0 ? harmonicEnergy / totalEnergyInRange : 0;
    // THD: raiz quadrada da soma das potências dos harmônicos (exclui fundamental) / fundamental
    let thdRatio = 0;
    if (fundamentalPower > 0 && harmonicPeaks.length > 1) {
      const sumHarmonic = harmonicPeaks.slice(1).reduce((acc,h)=>acc + h.power, 0);
      thdRatio = Math.sqrt(sumHarmonic) / Math.sqrt(fundamentalPower);
    }
    const thdPercent = thdRatio * 100;
    
    // Inharmonicity média
    const meanDeviation = harmonicPeaks.reduce((sum, h) => sum + h.deviation, 0) / harmonicPeaks.length;
    const inharmonicity = meanDeviation / fundamentalFreq;
    
    return {
  harmonicRatio,
  thdRatio,
  thdPercent,
      inharmonicity,
      fundamentalFreq,
      harmonicPeaks: harmonicPeaks.slice(0, 4) // Top 4 para JSON
    };
  }

  /**
   * 📐 Envelope espectral (formato geral)
   */
  calculateSpectralEnvelope(powerSpectrum, freqBins) {
    // Skip DC e Nyquist
    const validSpectrum = powerSpectrum.slice(1, -1);
    const validFreqs = freqBins.slice(1, -1);
    
    if (validSpectrum.length < 3) {
      return { tilt: 0, slope: 0, kurtosis: 0 };
    }
    
    // Tilt espectral (energia low/high)
    const midPoint = Math.floor(validSpectrum.length / 2);
    const lowEnergy = validSpectrum.slice(0, midPoint).reduce((sum, p) => sum + p, 0);
    const highEnergy = validSpectrum.slice(midPoint).reduce((sum, p) => sum + p, 0);
    const tilt = highEnergy > 0 ? lowEnergy / highEnergy : 0;
    
    // Slope espectral (regressão linear em dB)
    const spectrumDb = validSpectrum.map(p => p > 0 ? 10 * Math.log10(p) : -80);
    const logFreqs = validFreqs.map(f => Math.log10(f));
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = spectrumDb.length;
    
    for (let i = 0; i < n; i++) {
      const x = logFreqs[i];
      const y = spectrumDb[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Kurtosis (curtose do espectro)
    const mean = sumY / n;
    const variance = spectrumDb.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0) / n;
    const fourthMoment = spectrumDb.reduce((sum, y) => sum + Math.pow(y - mean, 4), 0) / n;
    const kurtosis = variance > 0 ? fourthMoment / Math.pow(variance, 2) : 0;
    
    return { tilt, slope, kurtosis };
  }

  /**
   * 🔧 Utility: Frequência para bin
   */
  freqToBin(freq, freqBins) {
    for (let i = 0; i < freqBins.length; i++) {
      if (freqBins[i] >= freq) return i;
    }
    return freqBins.length - 1;
  }

  /**
   * 📦 Compactar espectro para JSON
   */
  compactSpectrum(spectrum, targetSize) {
    if (spectrum.length <= targetSize) return Array.from(spectrum);
    
    const step = spectrum.length / targetSize;
    const compacted = new Float32Array(targetSize);
    
    for (let i = 0; i < targetSize; i++) {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      let sum = 0;
      
      for (let j = start; j < end; j++) {
        sum += spectrum[j];
      }
      
      compacted[i] = sum / (end - start);
    }
    
    return Array.from(compacted);
  }

  /**
   * 📍 Compactar freq bins
   */
  compactFreqBins(freqBins, targetSize) {
    if (freqBins.length <= targetSize) return Array.from(freqBins);
    
    const step = freqBins.length / targetSize;
    const compacted = new Float32Array(targetSize);
    
    for (let i = 0; i < targetSize; i++) {
      const index = Math.floor(i * step);
      compacted[i] = freqBins[index];
    }
    
    return Array.from(compacted);
  }
}

/**
 * 🎯 Função principal para análise espectral
 * @param {Float32Array} signal - Sinal para análise (mono ou canal dominante)
 * @param {Number} sampleRate - Taxa de amostragem
 * @param {String} quality - Qualidade da análise
 * @returns {Object} Features espectrais completas
 */
function analyzeSpectralFeatures(signal, sampleRate = 48000, quality = 'balanced') {
  // Configurações por qualidade
  const configs = {
    fast: { fftSize: 2048, hopSize: 1024 },
    balanced: { fftSize: 4096, hopSize: 1024 },
    accurate: { fftSize: 8192, hopSize: 2048 }
  };
  
  const config = configs[quality] || configs.balanced;
  const analyzer = new SpectrumAnalyzer(config.fftSize, config.hopSize);
  
  return analyzer.analyze(signal, sampleRate);
}

// 🎯 Exports
export {
  SpectrumAnalyzer,
  analyzeSpectralFeatures
};
