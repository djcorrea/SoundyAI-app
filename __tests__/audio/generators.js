/**
 * 🎵 GERADOR DE SINAIS SINTÉTICOS
 * 
 * Biblioteca central para geração de sinais de teste
 * para validação do pipeline de áudio
 */

/**
 * 🎛️ Configurações padrão para geração de sinais
 */
const DEFAULT_CONFIG = {
  sampleRate: 48000,
  amplitude: 0.5,
  duration: 5.0
};

/**
 * 🎼 Gerador de sinais musicais e de teste
 */
class TestSignalGenerator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 🎵 Sine wave simples
   */
  generateSine(frequency, amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const numSamples = Math.floor(sr * dur);
    const omega = 2 * Math.PI * frequency / sr;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(omega * i) * amp;
      leftChannel[i] = value;
      rightChannel[i] = value;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      frequency,
      amplitude: amp,
      duration: dur,
      type: 'sine'
    };
  }

  /**
   * 🌸 Pink noise (1/f spectrum)
   */
  generatePinkNoise(amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const numSamples = Math.floor(sr * dur);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Paul Kellet's pink noise algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    
    for (let i = 0; i < numSamples; i++) {
      const white = (Math.random() * 2 - 1);
      
      // Pink filtering
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      
      // Slight stereo decorrelation
      leftChannel[i] = pink * amp;
      rightChannel[i] = pink * amp * (1 + (Math.random() - 0.5) * 0.02);
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      amplitude: amp,
      duration: dur,
      type: 'pink_noise'
    };
  }

  /**
   * ⚪ White noise
   */
  generateWhiteNoise(amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const numSamples = Math.floor(sr * dur);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      leftChannel[i] = (Math.random() * 2 - 1) * amp;
      rightChannel[i] = (Math.random() * 2 - 1) * amp;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      amplitude: amp,
      duration: dur,
      type: 'white_noise'
    };
  }

  /**
   * 🔄 Frequency sweep (chirp)
   */
  generateSweep(startFreq, endFreq, amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const numSamples = Math.floor(sr * dur);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    const freqRange = endFreq - startFreq;
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sr;
      const progress = t / dur;
      const currentFreq = startFreq + (freqRange * progress);
      const phase = 2 * Math.PI * currentFreq * t;
      
      const value = Math.sin(phase) * amp;
      leftChannel[i] = value;
      rightChannel[i] = value;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      startFreq,
      endFreq,
      amplitude: amp,
      duration: dur,
      type: 'sweep'
    };
  }

  /**
   * ⚡ Impulse train
   */
  generateImpulseTrain(impulseSpacing, amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const numSamples = Math.floor(sr * dur);
    const spacingSamples = Math.floor(sr * impulseSpacing);
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i += spacingSamples) {
      if (i < numSamples) {
        leftChannel[i] = amp;
        rightChannel[i] = amp;
      }
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      impulseSpacing,
      amplitude: amp,
      duration: dur,
      type: 'impulse_train'
    };
  }

  /**
   * 🎚️ Step response (multiple levels)
   */
  generateStepResponse(levels, stepDuration = 2, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const samplesPerStep = Math.floor(sr * stepDuration);
    const totalSamples = samplesPerStep * levels.length;
    
    const leftChannel = new Float32Array(totalSamples);
    const rightChannel = new Float32Array(totalSamples);
    
    for (let step = 0; step < levels.length; step++) {
      const startSample = step * samplesPerStep;
      const endSample = startSample + samplesPerStep;
      const level = levels[step];
      
      for (let i = startSample; i < endSample; i++) {
        // Pink noise at specific level
        const noise = (Math.random() * 2 - 1) * Math.pow(10, level / 20);
        leftChannel[i] = noise;
        rightChannel[i] = noise;
      }
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      levels,
      stepDuration,
      duration: levels.length * stepDuration,
      type: 'step_response'
    };
  }

  /**
   * 🎵 Multi-tone (multiple frequencies)
   */
  generateMultiTone(frequencies, amplitudes = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const dur = duration !== null ? duration : this.config.duration;
    const amps = amplitudes || frequencies.map(() => this.config.amplitude / frequencies.length);
    
    const numSamples = Math.floor(sr * dur);
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      let totalValue = 0;
      
      frequencies.forEach((freq, idx) => {
        const omega = 2 * Math.PI * freq / sr;
        const amp = amps[idx] || amps[0];
        totalValue += Math.sin(omega * i) * amp;
      });
      
      leftChannel[i] = totalValue;
      rightChannel[i] = totalValue;
    }
    
    return {
      leftChannel,
      rightChannel,
      sampleRate: sr,
      frequencies,
      amplitudes: amps,
      duration: dur,
      type: 'multi_tone'
    };
  }

  /**
   * 🎶 Musical chord (harmonic content)
   */
  generateChord(fundamentalFreq, harmonics = [1, 2, 3, 4], amplitude = null, duration = null, sampleRate = null) {
    const sr = sampleRate || this.config.sampleRate;
    const amp = amplitude !== null ? amplitude : this.config.amplitude;
    const dur = duration !== null ? duration : this.config.duration;
    
    const frequencies = harmonics.map(h => fundamentalFreq * h);
    const amplitudes = harmonics.map((h, i) => amp / (i + 1)); // Decreasing amplitude
    
    return this.generateMultiTone(frequencies, amplitudes, dur, sr);
  }
}

/**
 * 🧪 Sinais específicos para testes de conformidade
 */
class ConformanceTestSignals extends TestSignalGenerator {
  /**
   * 📊 EBU Test Signals para LUFS
   */
  generateEBUTestSignal(testType = 'R128_1kHz') {
    switch (testType) {
      case 'R128_1kHz':
        // 1kHz sine at -20dBFS for LUFS calibration
        return this.generateSine(1000, Math.pow(10, -20/20), 30, 48000);
        
      case 'R128_PinkNoise':
        // Pink noise at -20dBFS for 30 seconds
        return this.generatePinkNoise(Math.pow(10, -20/20), 30, 48000);
        
      case 'R128_Silence':
        // Silence for gating test
        return {
          leftChannel: new Float32Array(48000 * 10),
          rightChannel: new Float32Array(48000 * 10),
          sampleRate: 48000,
          type: 'silence'
        };
        
      default:
        throw new Error(`Unknown EBU test signal: ${testType}`);
    }
  }

  /**
   * 🏔️ True Peak test signals
   */
  generateTruePeakTestSignal(testType = 'intersample_997Hz') {
    switch (testType) {
      case 'intersample_997Hz':
        // 997Hz sine at -0.3dBFS (known to cause intersample peaks)
        return this.generateSine(997, Math.pow(10, -0.3/20), 5, 48000);
        
      case 'clipped_1kHz':
        // Hard clipped 1kHz
        const signal = this.generateSine(1000, 0.95, 3, 48000);
        // Apply hard clipping
        for (let i = 0; i < signal.leftChannel.length; i++) {
          if (signal.leftChannel[i] > 0.95) signal.leftChannel[i] = 0.95;
          if (signal.leftChannel[i] < -0.95) signal.leftChannel[i] = -0.95;
          if (signal.rightChannel[i] > 0.95) signal.rightChannel[i] = 0.95;
          if (signal.rightChannel[i] < -0.95) signal.rightChannel[i] = -0.95;
        }
        return signal;
        
      default:
        throw new Error(`Unknown True Peak test signal: ${testType}`);
    }
  }

  /**
   * 🎵 Spectral test signals (band isolation)
   */
  generateSpectralTestSignal(bandName) {
    const bandFrequencies = {
      sub: 40,
      bass: 90,
      low_mid: 185,
      mid: 625,
      high_mid: 2500,
      presence: 6000,
      air: 12000
    };
    
    const frequency = bandFrequencies[bandName];
    if (!frequency) {
      throw new Error(`Unknown spectral band: ${bandName}`);
    }
    
    return this.generateSine(frequency, 0.5, 5, 48000);
  }
}

// Export para uso em testes
export {
  TestSignalGenerator,
  ConformanceTestSignals,
  DEFAULT_CONFIG
};

// Execução direta se chamado como script
if (typeof window !== 'undefined') {
  window.TestSignalGenerator = TestSignalGenerator;
  window.ConformanceTestSignals = ConformanceTestSignals;
}