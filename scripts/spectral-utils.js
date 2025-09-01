// 🎼 SPECTRAL UTILS - Utilitários para análise espectral compatível
// Baseado no sistema existente de análise por bandas

/**
 * 📊 Definições de bandas espectrais (compatível com sistema existente)
 */
const SPECTRAL_BANDS = {
  sub: { 
    name: 'sub',
    rangeHz: [20, 60],
    center: 35,
    octaveRange: 1.58
  },
  low_bass: { 
    name: 'low_bass',
    rangeHz: [60, 100],
    center: 77,
    octaveRange: 0.74
  },
  upper_bass: { 
    name: 'upper_bass',
    rangeHz: [100, 200],
    center: 141,
    octaveRange: 1.0
  },
  low_mid: { 
    name: 'low_mid',
    rangeHz: [200, 500],
    center: 316,
    octaveRange: 1.32
  },
  mid: { 
    name: 'mid',
    rangeHz: [500, 2000],
    center: 1000,
    octaveRange: 2.0
  },
  high_mid: { 
    name: 'high_mid',
    rangeHz: [2000, 6000],
    center: 3464,
    octaveRange: 1.58
  },
  brilho: { 
    name: 'brilho',
    rangeHz: [6000, 12000],
    center: 8485,
    octaveRange: 1.0
  },
  presenca: { 
    name: 'presenca',
    rangeHz: [12000, 20000],
    center: 15492,
    octaveRange: 0.74
  }
};

/**
 * 🔧 FFT real simples (implementação Radix-2 básica)
 */
class SimpleFFT {
  static fft(signal) {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({ real: x, imag: 0 }));
    
    // Força potência de 2
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
    if (N < nextPowerOf2) {
      const padded = new Float32Array(nextPowerOf2);
      padded.set(signal);
      return this.fft(Array.from(padded));
    }
    
    // Implementação Cooley-Tukey simples
    const even = [];
    const odd = [];
    
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        even.push(signal[i]);
      } else {
        odd.push(signal[i]);
      }
    }
    
    const evenFFT = this.fft(even);
    const oddFFT = this.fft(odd);
    
    const result = new Array(N);
    
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const wk = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };
      
      const oddTerm = {
        real: wk.real * oddFFT[k].real - wk.imag * oddFFT[k].imag,
        imag: wk.real * oddFFT[k].imag + wk.imag * oddFFT[k].real
      };
      
      result[k] = {
        real: evenFFT[k].real + oddTerm.real,
        imag: evenFFT[k].imag + oddTerm.imag
      };
      
      result[k + N / 2] = {
        real: evenFFT[k].real - oddTerm.real,
        imag: evenFFT[k].imag - oddTerm.imag
      };
    }
    
    return result;
  }
  
  static magnitude(fftResult) {
    return fftResult.map(bin => Math.sqrt(bin.real * bin.real + bin.imag * bin.imag));
  }
  
  static realFFT(signal) {
    const fftResult = this.fft(signal);
    return this.magnitude(fftResult).slice(0, Math.floor(fftResult.length / 2) + 1);
  }
}

/**
 * 🎵 Janela de Hanning
 */
function hanningWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
  }
  return window;
}

/**
 * 🎼 Analisador Espectral Simplificado
 */
class SimpleSpectralAnalyzer {
  constructor(sampleRate = 48000, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.hopSize = fftSize / 4; // 75% overlap
    this.window = hanningWindow(fftSize);
    this.freqBinWidth = sampleRate / fftSize;
    this.bands = SPECTRAL_BANDS;
  }

  analyzeSpectralBalance(leftChannel, rightChannel) {
    console.log('🎼 Analisando balance espectral...');
    
    // Converter para mono para análise espectral
    const monoSignal = this._stereoToMono(leftChannel, rightChannel);
    
    // Calcular espectro médio
    const averageSpectrum = this._calculateAverageSpectrum(monoSignal);
    
    // Analisar por bandas
    const bandAnalysis = this._analyzeBands(averageSpectrum);
    
    // Calcular métricas de balance tonal
    const tonalMetrics = this._calculateTonalMetrics(bandAnalysis);
    
    console.log('✅ Análise espectral concluída');
    
    return {
      bands: bandAnalysis,
      tonalMetrics,
      spectrum: averageSpectrum,
      metadata: {
        fftSize: this.fftSize,
        sampleRate: this.sampleRate,
        freqBinWidth: this.freqBinWidth
      }
    };
  }

  _stereoToMono(leftChannel, rightChannel) {
    const monoSignal = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoSignal[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    return monoSignal;
  }

  _calculateAverageSpectrum(signal) {
    const numFrames = Math.floor((signal.length - this.fftSize) / this.hopSize) + 1;
    const binCount = Math.floor(this.fftSize / 2) + 1;
    const accumulatedSpectrum = new Float32Array(binCount);
    let frameCount = 0;
    
    for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
      const startSample = frameIndex * this.hopSize;
      
      if (startSample + this.fftSize > signal.length) break;
      
      // Extrair janela e aplicar windowing
      const frame = new Float32Array(this.fftSize);
      for (let i = 0; i < this.fftSize; i++) {
        frame[i] = signal[startSample + i] * this.window[i];
      }
      
      // FFT e magnitude
      const spectrum = SimpleFFT.realFFT(Array.from(frame));
      
      // Acumular no espectro médio
      for (let bin = 0; bin < spectrum.length; bin++) {
        accumulatedSpectrum[bin] += spectrum[bin];
      }
      
      frameCount++;
    }
    
    // Calcular média
    if (frameCount > 0) {
      for (let bin = 0; bin < accumulatedSpectrum.length; bin++) {
        accumulatedSpectrum[bin] /= frameCount;
      }
    }
    
    return accumulatedSpectrum;
  }

  _analyzeBands(spectrum) {
    const bandResults = {};
    
    Object.values(this.bands).forEach(band => {
      const analysis = this._analyzeBand(spectrum, band.rangeHz);
      bandResults[band.name] = {
        name: band.name,
        rangeHz: band.rangeHz,
        rms_db: analysis.rmsDb,
        peak_db: analysis.peakDb,
        energy_linear: analysis.energyLinear,
        energy_pct: 0, // Será calculado após normalização
        center_freq: band.center
      };
    });
    
    // Normalizar percentuais de energia
    this._normalizeEnergyPercentages(bandResults);
    
    return bandResults;
  }

  _analyzeBand(spectrum, [lowFreq, highFreq]) {
    const lowBin = Math.max(0, Math.floor(lowFreq / this.freqBinWidth));
    const highBin = Math.min(spectrum.length - 1, Math.floor(highFreq / this.freqBinWidth));
    
    let energySum = 0;
    let peakMagnitude = 0;
    let binCount = 0;
    
    for (let bin = lowBin; bin <= highBin; bin++) {
      const magnitude = spectrum[bin];
      energySum += magnitude * magnitude;
      peakMagnitude = Math.max(peakMagnitude, magnitude);
      binCount++;
    }
    
    const rms = binCount > 0 ? Math.sqrt(energySum / binCount) : 0;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const peakDb = peakMagnitude > 0 ? 20 * Math.log10(peakMagnitude) : -Infinity;
    
    return {
      rmsDb,
      peakDb,
      energyLinear: energySum,
      binCount
    };
  }

  _normalizeEnergyPercentages(bandResults) {
    // Calcular energia total
    const totalEnergy = Object.values(bandResults).reduce((sum, band) => {
      return sum + band.energy_linear;
    }, 0);
    
    // Normalizar para percentuais
    if (totalEnergy > 0) {
      Object.keys(bandResults).forEach(bandName => {
        const energyPct = (bandResults[bandName].energy_linear / totalEnergy) * 100;
        bandResults[bandName].energy_pct = parseFloat(energyPct.toFixed(2));
      });
    }
    
    // Verificar se soma 100% (ajustar se necessário)
    const totalPct = Object.values(bandResults).reduce((sum, band) => sum + band.energy_pct, 0);
    
    if (Math.abs(totalPct - 100.0) > 0.01) {
      const factor = 100.0 / totalPct;
      Object.keys(bandResults).forEach(bandName => {
        bandResults[bandName].energy_pct = parseFloat((bandResults[bandName].energy_pct * factor).toFixed(2));
      });
    }
  }

  _calculateTonalMetrics(bandResults) {
    // Calcular métricas de balance tonal específicas do sistema
    const metrics = {};
    
    // Tilt espectral (grave vs agudo)
    const lowFreqEnergy = (bandResults.sub?.energy_pct || 0) + 
                         (bandResults.low_bass?.energy_pct || 0) + 
                         (bandResults.upper_bass?.energy_pct || 0);
    
    const highFreqEnergy = (bandResults.high_mid?.energy_pct || 0) + 
                          (bandResults.brilho?.energy_pct || 0) + 
                          (bandResults.presenca?.energy_pct || 0);
    
    metrics.spectral_tilt = lowFreqEnergy - highFreqEnergy;
    
    // Balance grave/médio/agudo
    const bassEnergy = lowFreqEnergy;
    const midEnergy = (bandResults.low_mid?.energy_pct || 0) + (bandResults.mid?.energy_pct || 0);
    const trebleEnergy = highFreqEnergy;
    
    metrics.bass_mid_ratio = bassEnergy > 0 ? midEnergy / bassEnergy : 0;
    metrics.mid_treble_ratio = midEnergy > 0 ? trebleEnergy / midEnergy : 0;
    
    // Presença vocal (mid frequencies)
    metrics.vocal_presence = bandResults.mid?.rms_db || -Infinity;
    
    // Clareza (high-mid vs low-mid)
    const clareza = (bandResults.high_mid?.rms_db || -Infinity) - (bandResults.low_mid?.rms_db || -Infinity);
    metrics.clareza = Number.isFinite(clareza) ? clareza : 0;
    
    // Calor (low frequencies balance)
    metrics.calor = bandResults.low_bass?.rms_db || -Infinity;
    
    // Brilho (high frequencies)
    metrics.brilho = bandResults.brilho?.rms_db || -Infinity;
    
    return metrics;
  }
}

/**
 * 🎛️ Calculador de métricas adicionais
 */
class AdditionalMetricsCalculator {
  static calculateStereoMetrics(leftChannel, rightChannel) {
    const n = Math.min(leftChannel.length, rightChannel.length);
    
    // Correlação estéreo (Pearson)
    let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumL += leftChannel[i];
      sumR += rightChannel[i];
      sumLR += leftChannel[i] * rightChannel[i];
      sumL2 += leftChannel[i] * leftChannel[i];
      sumR2 += rightChannel[i] * rightChannel[i];
    }
    
    const meanL = sumL / n;
    const meanR = sumR / n;
    const numerator = sumLR / n - meanL * meanR;
    const denominator = Math.sqrt((sumL2 / n - meanL * meanL) * (sumR2 / n - meanR * meanR));
    
    const correlation = denominator > 0 ? numerator / denominator : 0;
    
    // Largura estéreo (baseada na correlação)
    const stereoWidth = (1 - correlation) / 2;
    
    // Balance L/R
    const rmsL = Math.sqrt(sumL2 / n);
    const rmsR = Math.sqrt(sumR2 / n);
    const balance = rmsL > 0 && rmsR > 0 ? 20 * Math.log10(rmsR / rmsL) : 0;
    
    return {
      correlation: parseFloat(correlation.toFixed(3)),
      width: parseFloat(stereoWidth.toFixed(3)),
      balance_db: parseFloat(balance.toFixed(2)),
      rms_left: parseFloat(rmsL.toFixed(6)),
      rms_right: parseFloat(rmsR.toFixed(6))
    };
  }

  static calculateDynamicRange(leftChannel, rightChannel, sampleRate = 48000) {
    // TT-DR simplificado usando janelas de 300ms
    const windowMs = 300;
    const hopMs = 100;
    const windowSamples = Math.floor(sampleRate * windowMs / 1000);
    const hopSamples = Math.floor(sampleRate * hopMs / 1000);
    
    const rmsValues = [];
    
    for (let start = 0; start < leftChannel.length - windowSamples; start += hopSamples) {
      let sumSquares = 0;
      for (let i = 0; i < windowSamples; i++) {
        const sampleL = leftChannel[start + i];
        const sampleR = rightChannel[start + i];
        const monoSample = (sampleL + sampleR) / 2;
        sumSquares += monoSample * monoSample;
      }
      
      const rms = Math.sqrt(sumSquares / windowSamples);
      if (rms > 0) {
        rmsValues.push(20 * Math.log10(rms));
      }
    }
    
    if (rmsValues.length < 2) return 0;
    
    // Ordenar e calcular percentis
    rmsValues.sort((a, b) => a - b);
    const p10Index = Math.floor(rmsValues.length * 0.10);
    const p95Index = Math.floor(rmsValues.length * 0.95);
    
    const p10 = rmsValues[p10Index];
    const p95 = rmsValues[Math.min(p95Index, rmsValues.length - 1)];
    
    return Math.max(0, p95 - p10);
  }

  static calculateCrestFactor(leftChannel, rightChannel) {
    let maxPeak = 0;
    let rmsSum = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const sampleL = Math.abs(leftChannel[i]);
      const sampleR = Math.abs(rightChannel[i]);
      maxPeak = Math.max(maxPeak, sampleL, sampleR);
      rmsSum += (leftChannel[i] * leftChannel[i] + rightChannel[i] * rightChannel[i]) / 2;
    }
    
    const rms = Math.sqrt(rmsSum / leftChannel.length);
    return rms > 0 ? 20 * Math.log10(maxPeak / rms) : 0;
  }
}

/**
 * 🎛️ Função principal para análise espectral completa
 */
function analyzeSpectralFeatures(leftChannel, rightChannel, sampleRate = 48000, mode = 'full') {
  const analyzer = new SimpleSpectralAnalyzer(sampleRate);
  const spectralResult = analyzer.analyzeSpectralBalance(leftChannel, rightChannel);
  
  if (mode === 'fast') {
    return {
      bands: spectralResult.bands,
      spectrum_avg: spectralResult.spectrum,
      freq_bins_compact: Array.from({ length: spectralResult.spectrum.length }, (_, i) => 
        i * analyzer.freqBinWidth
      )
    };
  }
  
  // Modo completo - incluir métricas adicionais
  const stereoMetrics = AdditionalMetricsCalculator.calculateStereoMetrics(leftChannel, rightChannel);
  const dynamicRange = AdditionalMetricsCalculator.calculateDynamicRange(leftChannel, rightChannel, sampleRate);
  const crestFactor = AdditionalMetricsCalculator.calculateCrestFactor(leftChannel, rightChannel);
  
  return {
    bands: spectralResult.bands,
    tonalMetrics: spectralResult.tonalMetrics,
    stereoMetrics,
    dynamicRange,
    crestFactor,
    spectrum: spectralResult.spectrum,
    metadata: spectralResult.metadata
  };
}

module.exports = {
  SimpleSpectralAnalyzer,
  AdditionalMetricsCalculator,
  SimpleFFT,
  hanningWindow,
  analyzeSpectralFeatures,
  SPECTRAL_BANDS
};
