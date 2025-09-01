/**
 * 🎵 SPECTRAL BALANCE ANALYZER
 * Análise de balanço espectral com cálculo interno em porcentagem de energia
 * e manutenção da compatibilidade com exibição em dB
 */

export interface SpectralBandConfig {
  name: string;
  hzLow: number;
  hzHigh: number;
}

export interface SpectralBandResult {
  name: string;
  hzLow: number;
  hzHigh: number;
  energy: number;       // soma linear |X|² da banda
  energyPct: number;    // (band_energy / total_energy) * 100
  rmsDb: number;        // valor RMS em dB (mantido para compatibilidade)
}

export interface SpectralBalanceResult {
  bands: SpectralBandResult[];
  summary3Bands: {
    Low: { energyPct: number; rmsDb: number };
    Mid: { energyPct: number; rmsDb: number };
    High: { energyPct: number; rmsDb: number };
  };
  totalEnergy: number;
  processedFrames: number;
  fftSize: number;
  sampleRate: number;
}

export interface SpectralBalanceConfig {
  bands: SpectralBandConfig[];
  sampleRate: number;
  fftSize?: number;
  hopSize?: number;
  windowType?: 'hann' | 'hamming' | 'blackman' | 'rectangular';
  referenceDb?: number; // Referência para conversão dB (padrão: 0 dBFS)
}

// Configurações padrão das bandas (6-7 bandas)
export const DEFAULT_BANDS_7: SpectralBandConfig[] = [
  { name: 'Sub Bass', hzLow: 20, hzHigh: 60 },
  { name: 'Bass', hzLow: 60, hzHigh: 120 },
  { name: 'Low Mid', hzLow: 120, hzHigh: 250 },
  { name: 'Mid', hzLow: 250, hzHigh: 1000 },
  { name: 'High Mid', hzLow: 1000, hzHigh: 4000 },
  { name: 'High', hzLow: 4000, hzHigh: 8000 },
  { name: 'Presence', hzLow: 8000, hzHigh: 16000 }
];

// Configuração de 3 bandas (resumo)
export const DEFAULT_BANDS_3: SpectralBandConfig[] = [
  { name: 'Low', hzLow: 20, hzHigh: 250 },
  { name: 'Mid', hzLow: 250, hzHigh: 4000 },
  { name: 'High', hzLow: 4000, hzHigh: 16000 }
];

/**
 * 🪟 Implementação de janela de Hann para análise espectral
 */
function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
  }
  return window;
}

/**
 * 🧮 FFT simplificada (Cooley-Tukey radix-2)
 * Para produção, seria substituída por uma biblioteca otimizada
 */
function simpleFFT(signal: Float32Array): { real: Float32Array; imag: Float32Array; magnitude: Float32Array } {
  const N = signal.length;
  
  // Verificar se é potência de 2
  if (N & (N - 1)) {
    throw new Error(`FFT requer tamanho potência de 2, recebido: ${N}`);
  }
  
  const real = new Float32Array(signal);
  const imag = new Float32Array(N);
  
  // Bit reversal
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let j = 0;
    for (let bit = 0; bit < bits; bit++) {
      j = (j << 1) | ((i >> bit) & 1);
    }
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  
  // FFT iterativa
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const step = N / size;
    
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const u = i + j;
        const v = i + j + halfSize;
        const angle = -2 * Math.PI * j * step / N;
        
        const tReal = real[v] * Math.cos(angle) - imag[v] * Math.sin(angle);
        const tImag = real[v] * Math.sin(angle) + imag[v] * Math.cos(angle);
        
        real[v] = real[u] - tReal;
        imag[v] = imag[u] - tImag;
        real[u] = real[u] + tReal;
        imag[u] = imag[u] + tImag;
      }
    }
  }
  
  // Calcular magnitude
  const magnitude = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  return { real, imag, magnitude };
}

/**
 * 🔧 Converter frequência para índice de bin FFT
 */
function freqToBin(freq: number, sampleRate: number, fftSize: number): number {
  return Math.round((freq * fftSize) / sampleRate);
}

/**
 * 🎵 Classe principal para análise de balanço espectral
 */
export class SpectralBalanceAnalyzer {
  private config: SpectralBalanceConfig;
  private window: Float32Array;
  
  constructor(config: SpectralBalanceConfig) {
    this.config = {
      fftSize: 4096,
      hopSize: 2048,
      windowType: 'hann',
      referenceDb: 0,
      ...config
    };
    
    // Verificar se fftSize é potência de 2
    const fftSize = this.config.fftSize!;
    if (fftSize & (fftSize - 1)) {
      throw new Error(`FFT size deve ser potência de 2, recebido: ${fftSize}`);
    }
    
    // Criar janela
    this.window = createHannWindow(fftSize);
    
    console.log(`🎵 SpectralBalanceAnalyzer: FFT=${fftSize}, bands=${config.bands.length}, sr=${config.sampleRate}Hz`);
  }
  
  /**
   * 🔬 Analisar balanço espectral de um sinal de áudio
   */
  analyze(audioData: Float32Array): SpectralBalanceResult {
    console.log('🔬 Iniciando análise de balanço espectral...');
    const startTime = Date.now();
    
    const fftSize = this.config.fftSize!;
    const hopSize = this.config.hopSize!;
    const sampleRate = this.config.sampleRate;
    
    // Processar múltiplos frames se o áudio for longo
    const numFrames = Math.floor((audioData.length - fftSize) / hopSize) + 1;
    const actualFrames = Math.min(numFrames, 50); // Limitar para performance
    
    // Acumuladores de energia por banda
    const bandEnergies = new Array(this.config.bands.length).fill(0);
    let totalEnergy = 0;
    let processedFrames = 0;
    
    for (let frame = 0; frame < actualFrames; frame++) {
      const startSample = frame * hopSize;
      const frameData = new Float32Array(fftSize);
      
      // Extrair frame e aplicar janela
      for (let i = 0; i < fftSize; i++) {
        const sampleIndex = startSample + i;
        if (sampleIndex < audioData.length) {
          frameData[i] = audioData[sampleIndex] * this.window[i];
        }
      }
      
      try {
        // FFT do frame
        const fftResult = simpleFFT(frameData);
        const spectrum = fftResult.magnitude;
        
        // Processar apenas até Nyquist (metade do spectrum)
        const nyquistBin = fftSize / 2;
        
        // Acumular energia por banda
        for (let bandIdx = 0; bandIdx < this.config.bands.length; bandIdx++) {
          const band = this.config.bands[bandIdx];
          const startBin = Math.max(1, freqToBin(band.hzLow, sampleRate, fftSize)); // Skip DC
          const endBin = Math.min(nyquistBin - 1, freqToBin(band.hzHigh, sampleRate, fftSize));
          
          let bandEnergy = 0;
          for (let bin = startBin; bin <= endBin; bin++) {
            const power = spectrum[bin] * spectrum[bin]; // |X|²
            bandEnergy += power;
          }
          
          bandEnergies[bandIdx] += bandEnergy;
        }
        
        // Acumular energia total (20 Hz - Nyquist)
        const totalStartBin = Math.max(1, freqToBin(20, sampleRate, fftSize));
        const totalEndBin = nyquistBin - 1;
        
        for (let bin = totalStartBin; bin <= totalEndBin; bin++) {
          const power = spectrum[bin] * spectrum[bin];
          totalEnergy += power;
        }
        
        processedFrames++;
      } catch (error) {
        console.warn(`Erro no frame ${frame}:`, error);
        continue;
      }
    }
    
    // Normalizar pelas frames processadas
    if (processedFrames > 0) {
      for (let i = 0; i < bandEnergies.length; i++) {
        bandEnergies[i] /= processedFrames;
      }
      totalEnergy /= processedFrames;
    }
    
    // Calcular porcentagens e dB
    const bands: SpectralBandResult[] = [];
    const referenceEnergy = Math.pow(10, this.config.referenceDb! / 10); // Conversão dB para linear
    
    for (let i = 0; i < this.config.bands.length; i++) {
      const band = this.config.bands[i];
      const energy = bandEnergies[i];
      
      // Porcentagem de energia
      const energyPct = totalEnergy > 0 ? (energy / totalEnergy) * 100 : 0;
      
      // Converter para dB (mantendo compatibilidade)
      let rmsDb = -Infinity;
      if (energy > 0) {
        const rms = Math.sqrt(energy);
        rmsDb = 10 * Math.log10(rms / referenceEnergy);
      }
      
      bands.push({
        name: band.name,
        hzLow: band.hzLow,
        hzHigh: band.hzHigh,
        energy,
        energyPct,
        rmsDb
      });
    }
    
    // Calcular resumo de 3 bandas
    const summary3Bands = this.calculateSummary3Bands(bands);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Análise de balanço espectral concluída em ${processingTime}ms`);
    console.log(`📊 Processados ${processedFrames} frames, energia total: ${totalEnergy.toExponential(2)}`);
    
    return {
      bands,
      summary3Bands,
      totalEnergy,
      processedFrames,
      fftSize,
      sampleRate
    };
  }
  
  /**
   * 📊 Calcular resumo de 3 bandas a partir das bandas detalhadas
   */
  private calculateSummary3Bands(bands: SpectralBandResult[]): SpectralBalanceResult['summary3Bands'] {
    const summary = {
      Low: { energyPct: 0, rmsDb: -Infinity },
      Mid: { energyPct: 0, rmsDb: -Infinity },
      High: { energyPct: 0, rmsDb: -Infinity }
    };
    
    // Mapear bandas para categorias Low/Mid/High
    for (const band of bands) {
      let category: 'Low' | 'Mid' | 'High';
      
      if (band.hzHigh <= 250) {
        category = 'Low';
      } else if (band.hzLow >= 4000) {
        category = 'High';
      } else {
        category = 'Mid';
      }
      
      // Somar energias e porcentagens
      summary[category].energyPct += band.energyPct;
      
      // Para dB, usar energia linear e reconverter
      if (band.energy > 0) {
        const currentLinear = summary[category].rmsDb === -Infinity ? 0 : Math.pow(10, summary[category].rmsDb / 10);
        const newLinear = currentLinear + band.energy;
        summary[category].rmsDb = 10 * Math.log10(newLinear);
      }
    }
    
    return summary;
  }
}

/**
 * 🎯 Função utilitária para análise rápida com configurações padrão
 */
export function analyzeSpectralBalance(
  audioData: Float32Array,
  sampleRate: number,
  bandConfig: SpectralBandConfig[] = DEFAULT_BANDS_7
): SpectralBalanceResult {
  const config: SpectralBalanceConfig = {
    bands: bandConfig,
    sampleRate,
    fftSize: 4096,
    hopSize: 2048,
    windowType: 'hann'
  };
  
  const analyzer = new SpectralBalanceAnalyzer(config);
  return analyzer.analyze(audioData);
}

/**
 * 🔄 Converter canal estéreo para mono (soma de energia)
 */
export function stereoToMono(leftChannel: Float32Array, rightChannel: Float32Array): Float32Array {
  const length = Math.min(leftChannel.length, rightChannel.length);
  const mono = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    // Soma de energia (não amplitude) para preservar potência total
    const leftPower = leftChannel[i] * leftChannel[i];
    const rightPower = rightChannel[i] * rightChannel[i];
    mono[i] = Math.sqrt(leftPower + rightPower);
  }
  
  return mono;
}

/**
 * 📈 Normalizar áudio para análise consistente
 */
export function normalizeAudio(audioData: Float32Array, targetRMS: number = 0.1): Float32Array {
  // Calcular RMS atual
  let sumSquares = 0;
  for (let i = 0; i < audioData.length; i++) {
    sumSquares += audioData[i] * audioData[i];
  }
  const currentRMS = Math.sqrt(sumSquares / audioData.length);
  
  if (currentRMS === 0) {
    return audioData; // Evitar divisão por zero
  }
  
  // Calcular fator de normalização
  const gain = targetRMS / currentRMS;
  
  // Aplicar ganho
  const normalized = new Float32Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    normalized[i] = audioData[i] * gain;
  }
  
  return normalized;
}

// Exportar configurações padrão
export { DEFAULT_BANDS_7 as DEFAULT_BANDS };
