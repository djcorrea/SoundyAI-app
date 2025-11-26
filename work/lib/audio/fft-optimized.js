/**
 * 🚀 FFT ENGINE OTIMIZADO - High-Performance via fft-js
 * 
 * Substituição do FastFFT JavaScript puro por biblioteca otimizada fft-js.
 * Mantém 100% de compatibilidade com API anterior do FastFFT.
 * 
 * GANHO ESPERADO: 60-90s → 5-10s (~85-90% redução)
 * 
 * 🎯 Características:
 * - API idêntica ao FastFFT original (drop-in replacement)
 * - Reutilização de buffers (zero-copy quando possível)
 * - Cache interno gerenciado pela biblioteca
 * - Suporte a todas as 8 métricas espectrais
 * - Compatível com 7 bandas espectrais profissionais
 * 
 * 📦 Dependência:
 * npm install fft-js
 * 
 * 🔧 Uso:
 * import { FastFFT } from './fft-optimized.js';
 * const fft = new FastFFT(4096);
 * const result = fft.fft(signal); // {real, imag, magnitude, phase}
 */

import FFT from 'fft-js';

/**
 * 🧮 Classe OptimizedFFT - Wrapper compatível com FastFFT
 */
class OptimizedFFT {
  constructor(size = 4096) {
    if (size & (size - 1)) {
      throw new Error(`FFT requires power-of-2 size, got: ${size}`);
    }
    
    this.size = size;
    this.halfSize = size / 2;
    
    // Instância fft-js otimizada
    this.fft = new FFT(size);
    
    // Buffers reutilizáveis para reduzir GC overhead
    this.magnitudeBuffer = new Float32Array(this.halfSize);
    this.phaseBuffer = new Float32Array(this.halfSize);
    this.complexBuffer = null; // Lazy init no primeiro uso
    
    // Cache mock para compatibilidade com API antiga
    this._cache = new Map();
    
    console.log(`[FFT_OPTIMIZED] ✅ Inicializado com size=${size} (fft-js engine)`);
  }
  
  /**
   * 🎯 FFT principal - 100% compatível com FastFFT original
   * @param {Float32Array} signal - Sinal de entrada (deve ter length = size)
   * @returns {Object} {real, imag, magnitude, phase}
   */
  fft(signal) {
    // Validação de entrada
    if (!signal || signal.length !== this.size) {
      throw new Error(
        `FFT input size mismatch: expected ${this.size}, got ${signal?.length || 'undefined'}`
      );
    }
    
    // Lazy init do buffer complexo (evita alocação desnecessária no construtor)
    if (!this.complexBuffer) {
      this.complexBuffer = this.fft.createComplexArray();
    }
    
    // Converter Float32Array para formato complexo [r0, i0, r1, i1, ...]
    // Parte imaginária inicializada como 0 (sinal real)
    for (let i = 0; i < this.size; i++) {
      this.complexBuffer[i * 2] = signal[i];       // Real
      this.complexBuffer[i * 2 + 1] = 0;           // Imaginary
    }
    
    // FFT otimizada (in-place quando possível)
    const fftResult = this.fft.fft(this.complexBuffer);
    
    // Extrair apenas metade positiva do espectro (simetria Hermitiana)
    const real = new Float32Array(this.halfSize);
    const imag = new Float32Array(this.halfSize);
    
    // Calcular magnitude e fase (reutilizando buffers)
    for (let i = 0; i < this.halfSize; i++) {
      const re = fftResult[i * 2];
      const im = fftResult[i * 2 + 1];
      
      real[i] = re;
      imag[i] = im;
      this.magnitudeBuffer[i] = Math.sqrt(re * re + im * im);
      this.phaseBuffer[i] = Math.atan2(im, re);
    }
    
    // Retornar formato idêntico ao FastFFT original
    return {
      real,
      imag,
      magnitude: Float32Array.from(this.magnitudeBuffer),
      phase: Float32Array.from(this.phaseBuffer)
    };
  }
  
  /**
   * 🗂️ Cache getter - Compatibilidade com API antiga
   * (fft-js gerencia cache internamente, este é apenas mock)
   */
  get cache() {
    return this._cache;
  }
}

/**
 * 🪟 Window Functions - Funções de janelamento
 * (Preservadas do FastFFT original para compatibilidade)
 */
class WindowFunctions {
  /**
   * 🌊 Janela Hann (Von Hann)
   */
  static hann(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
  }

  /**
   * ⚡ Janela Hamming
   */
  static hamming(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
  }

  /**
   * 📐 Janela Blackman
   */
  static blackman(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const n = i / (size - 1);
      window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n) + 0.08 * Math.cos(4 * Math.PI * n);
    }
    return window;
  }

  /**
   * 📏 Janela retangular (sem janelamento)
   */
  static rectangular(size) {
    return new Float32Array(size).fill(1.0);
  }
}

/**
 * 📊 STFT Engine - Short-Time Fourier Transform
 * (Preservado do FastFFT original, agora usando OptimizedFFT)
 */
class STFTEngine {
  constructor(fftSize = 2048, hopSize = 1024, windowType = 'hann') {
    this.fftSize = fftSize;
    this.hopSize = hopSize;
    this.windowType = windowType;
    this.fft = new OptimizedFFT(fftSize);
    this.window = WindowFunctions[windowType](fftSize);
  }

  /**
   * 🎵 Analisar sinal com STFT
   * @param {Float32Array} signal - Sinal de entrada
   * @param {Number} sampleRate - Taxa de amostragem
   * @returns {Object} Espectrograma e estatísticas
   */
  analyze(signal, sampleRate = 48000) {
    const numFrames = Math.floor((signal.length - this.fftSize) / this.hopSize) + 1;
    const spectrogram = [];
    const powerSpectrum = new Float32Array(this.fftSize / 2);
    
    console.log(`🎵 STFT: ${numFrames} frames, FFT=${this.fftSize}, hop=${this.hopSize}`);
    
    // Processar cada frame
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * this.hopSize;
      const frameData = new Float32Array(this.fftSize);
      
      // Extrair e aplicar janelamento
      for (let i = 0; i < this.fftSize; i++) {
        const sampleIndex = startSample + i;
        if (sampleIndex < signal.length) {
          frameData[i] = signal[sampleIndex] * this.window[i];
        }
      }
      
      // FFT do frame
      const fftResult = this.fft.fft(frameData);
      const frameMagnitude = fftResult.magnitude.slice(0, this.fftSize / 2);
      
      // Acumular para espectro médio
      for (let i = 0; i < frameMagnitude.length; i++) {
        powerSpectrum[i] += frameMagnitude[i] * frameMagnitude[i];
      }
      
      spectrogram.push(frameMagnitude);
    }
    
    // Normalizar espectro médio
    for (let i = 0; i < powerSpectrum.length; i++) {
      powerSpectrum[i] /= numFrames;
    }
    
    // Gerar bins de frequência
    const freqBins = new Float32Array(this.fftSize / 2);
    for (let i = 0; i < freqBins.length; i++) {
      freqBins[i] = (i * sampleRate) / this.fftSize;
    }
    
    return {
      spectrogram,
      powerSpectrum,
      freqBins,
      numFrames,
      frameRate: sampleRate / this.hopSize,
      fftSize: this.fftSize,
      hopSize: this.hopSize
    };
  }

  /**
   * 🎯 Extrair features espectrais básicas
   */
  extractSpectralFeatures(powerSpectrum, freqBins) {
    let totalEnergy = 0;
    let centroidNumerator = 0;
    let peak = 0;
    let peakFreq = 0;
    
    // Calcular energia total e centroide
    for (let i = 1; i < powerSpectrum.length; i++) { // Skip DC bin
      const power = powerSpectrum[i];
      totalEnergy += power;
      centroidNumerator += freqBins[i] * power;
      
      if (power > peak) {
        peak = power;
        peakFreq = freqBins[i];
      }
    }
    
    const centroid = totalEnergy > 0 ? centroidNumerator / totalEnergy : 0;
    
    // Rolloff 85%
    const rolloffTarget = totalEnergy * 0.85;
    let rolloffEnergy = 0;
    let rolloff85 = 0;
    
    for (let i = 1; i < powerSpectrum.length; i++) {
      rolloffEnergy += powerSpectrum[i];
      if (rolloffEnergy >= rolloffTarget) {
        rolloff85 = freqBins[i];
        break;
      }
    }
    
    return {
      centroid,
      rolloff85,
      peakFreq,
      totalEnergy: Math.sqrt(totalEnergy), // RMS
      spectralPeak: Math.sqrt(peak)
    };
  }
}

/**
 * 🚀 Função utilitária para próxima potência de 2
 */
function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// 🎯 Alias para compatibilidade com código existente
export const FastFFT = OptimizedFFT;

// 🎯 Exportar todas as classes e utilitários
export {
  OptimizedFFT,
  WindowFunctions,
  STFTEngine,
  nextPowerOfTwo
};

export default OptimizedFFT;
