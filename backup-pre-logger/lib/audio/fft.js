// 🌊 FFT ENGINE - Transformada rápida de Fourier via WASM
// Motor FFT otimizado com windowing e análise espectral

/**
 * 🧮 Implementação FFT JavaScript otimizada
 * Baseada no algoritmo Cooley-Tukey radix-2 DIT
 */
class FastFFT {
  constructor() {
    this.cache = new Map();
  }

  /**
   * 🎯 FFT principal (potência de 2)
   * @param {Float32Array} signal - Sinal de entrada
   * @returns {Object} {real, imag, magnitude, phase}
   */
  fft(signal) {
    const N = signal.length;
    
    // Validar potência de 2
    if (N & (N - 1)) {
      throw new Error(`FFT requer tamanho potência de 2, recebido: ${N}`);
    }
    
    // Cache para twiddle factors
    const cacheKey = N;
    let twiddles = this.cache.get(cacheKey);
    
    if (!twiddles) {
      twiddles = this.generateTwiddles(N);
      this.cache.set(cacheKey, twiddles);
    }
    
    // Arrays de saída
    const real = new Float32Array(signal);
    const imag = new Float32Array(N);
    
    // Bit reversal
    this.bitReversal(real, imag, N);
    
    // Iterative FFT
    this.iterativeFFT(real, imag, N, twiddles);
    
    // Calcular magnitude e fase
    const magnitude = new Float32Array(N);
    const phase = new Float32Array(N);
    
    for (let i = 0; i < N; i++) {
      magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      phase[i] = Math.atan2(imag[i], real[i]);
    }
    
    return { real, imag, magnitude, phase };
  }

  /**
   * 🔧 Gerar twiddle factors (fatores de rotação)
   */
  generateTwiddles(N) {
    const twiddles = [];
    for (let i = 0; i < N / 2; i++) {
      const angle = -2 * Math.PI * i / N;
      twiddles.push({
        real: Math.cos(angle),
        imag: Math.sin(angle)
      });
    }
    return twiddles;
  }

  /**
   * 🔀 Bit reversal permutation
   */
  bitReversal(real, imag, N) {
    const logN = Math.log2(N);
    
    for (let i = 0; i < N; i++) {
      const j = this.reverseBits(i, logN);
      if (i < j) {
        // Swap real
        [real[i], real[j]] = [real[j], real[i]];
        // Swap imag
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
  }

  /**
   * 🔄 Reverter bits
   */
  reverseBits(num, bits) {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (num & 1);
      num >>= 1;
    }
    return result;
  }

  /**
   * ⚡ FFT iterativa
   */
  iterativeFFT(real, imag, N, twiddles) {
    for (let size = 2; size <= N; size *= 2) {
      const halfSize = size / 2;
      const step = N / size;
      
      for (let i = 0; i < N; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const u = i + j;
          const v = i + j + halfSize;
          const twiddleIndex = j * step;
          
          const tReal = twiddles[twiddleIndex].real;
          const tImag = twiddles[twiddleIndex].imag;
          
          const tempReal = real[v] * tReal - imag[v] * tImag;
          const tempImag = real[v] * tImag + imag[v] * tReal;
          
          real[v] = real[u] - tempReal;
          imag[v] = imag[u] - tempImag;
          real[u] = real[u] + tempReal;
          imag[u] = imag[u] + tempImag;
        }
      }
    }
  }
}

/**
 * 🪟 Window Functions - Funções de janelamento
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
 */
class STFTEngine {
  constructor(fftSize = 2048, hopSize = 1024, windowType = 'hann') {
    this.fftSize = fftSize;
    this.hopSize = hopSize;
    this.windowType = windowType;
    this.fft = new FastFFT();
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

// 🚀 Função utilitária para próxima potência de 2
function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// 🎯 Exportar classes e utilitários
export {
  FastFFT,
  WindowFunctions,
  STFTEngine,
  nextPowerOfTwo
};
