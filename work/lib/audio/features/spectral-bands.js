// 🌈 SPECTRAL BANDS CORRECTED - 7 Bandas Profissionais
// Sub, Bass, Low-Mid, Mid, High-Mid, Presence, Air com soma ≈ 100%

import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🎯 Definição das 7 bandas espectrais profissionais
 */
const SPECTRAL_BANDS = {
  sub: { min: 20, max: 60, name: 'Sub', description: 'Sub-bass/Graves profundos' },
  bass: { min: 60, max: 150, name: 'Bass', description: 'Bass/Graves' },
  lowMid: { min: 150, max: 500, name: 'Low-Mid', description: 'Médios graves' },
  mid: { min: 500, max: 2000, name: 'Mid', description: 'Médios' },
  highMid: { min: 2000, max: 5000, name: 'High-Mid', description: 'Médios agudos' },
  presence: { min: 5000, max: 10000, name: 'Presence', description: 'Presença/Brilho' },
  air: { min: 10000, max: 20000, name: 'Air', description: 'Ar/Agudos extremos' }
};

/**
 * 🔧 Configurações da análise espectral
 */
const SPECTRAL_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  MIN_ENERGY_THRESHOLD: 1e-12,
  NORMALIZATION_FACTOR: 1e-6, // Para evitar valores muito pequenos
  PERCENTAGE_PRECISION: 2 // Casas decimais para percentuais
};

/**
 * 🌈 Calculadora de Bandas Espectrais Profissionais
 */
export class SpectralBandsCalculator {
  
  constructor(sampleRate = 48000, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
    this.nyquistFreq = sampleRate / 2;
    
    // Pre-calcular bins das bandas
    this.bandBins = this.calculateBandBins();
    
    logAudio('spectral_bands', 'init', {
      sampleRate,
      fftSize,
      frequencyResolution: this.frequencyResolution.toFixed(2),
      bandsCount: Object.keys(SPECTRAL_BANDS).length
    });
  }
  
  /**
   * 📊 Calcular bins FFT para cada banda
   */
  calculateBandBins() {
    const bandBins = {};
    
    for (const [key, band] of Object.entries(SPECTRAL_BANDS)) {
      const minBin = Math.max(0, Math.floor(band.min / this.frequencyResolution));
      const maxBin = Math.min(
        Math.floor(this.fftSize / 2),
        Math.ceil(band.max / this.frequencyResolution)
      );
      
      bandBins[key] = {
        minBin,
        maxBin,
        binCount: maxBin - minBin + 1,
        actualMinFreq: minBin * this.frequencyResolution,
        actualMaxFreq: maxBin * this.frequencyResolution
      };
    }
    
    return bandBins;
  }
  
  /**
   * 🎵 Calcular magnitude corrigida usando RMS
   * Corrigido: usar RMS em vez de média simples
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
   * 🌈 Calcular energia das 7 bandas espectrais
   */
  calculateBandEnergies(magnitude) {
    const bandEnergies = {};
    let totalEnergy = 0;
    
    // Calcular energia para cada banda
    for (const [key, binInfo] of Object.entries(this.bandBins)) {
      let bandEnergy = 0;
      
      for (let bin = binInfo.minBin; bin <= binInfo.maxBin; bin++) {
        if (bin < magnitude.length) {
          // Usar energia (magnitude²) para cálculo correto
          const energy = magnitude[bin] * magnitude[bin];
          bandEnergy += energy;
          totalEnergy += energy;
        }
      }
      
      bandEnergies[key] = bandEnergy;
    }
    
    // Validar energia total
    if (totalEnergy < SPECTRAL_CONFIG.MIN_ENERGY_THRESHOLD) {
      logAudio('spectral_bands', 'insufficient_energy', { 
        totalEnergy: totalEnergy.toExponential(3) 
      });
      return null;
    }
    
    return { bandEnergies, totalEnergy };
  }
  
  /**
   * 📈 Calcular percentuais e normalizar para somar 100%
   */
  calculateBandPercentages(bandEnergies, totalEnergy) {
    const percentages = {};
    let percentageSum = 0;
    
    // Calcular percentuais brutos
    for (const [key, energy] of Object.entries(bandEnergies)) {
      const percentage = (energy / totalEnergy) * 100;
      percentages[key] = percentage;
      percentageSum += percentage;
    }
    
    // Normalizar para somar exatamente 100%
    if (percentageSum > 0) {
      const normalizationFactor = 100 / percentageSum;
      for (const key of Object.keys(percentages)) {
        percentages[key] *= normalizationFactor;
      }
    }
    
    return percentages;
  }
  
  /**
   * 🎵 Análise completa das bandas espectrais
   */
  analyzeBands(leftMagnitude, rightMagnitude, frameIndex = 0) {
    try {
      // Calcular magnitude RMS corrigida
      const magnitude = this.calculateMagnitudeRMS(leftMagnitude, rightMagnitude);
      
      // Calcular energias das bandas
      const energyResult = this.calculateBandEnergies(magnitude);
      if (!energyResult) {
        return this.getNullBands();
      }
      
      const { bandEnergies, totalEnergy } = energyResult;
      
      // Calcular percentuais normalizados
      const percentages = this.calculateBandPercentages(bandEnergies, totalEnergy);
      
      // Preparar resultado final
      const result = {};
      for (const [key, band] of Object.entries(SPECTRAL_BANDS)) {
        result[key] = {
          energy: bandEnergies[key],
          percentage: Number(percentages[key].toFixed(SPECTRAL_CONFIG.PERCENTAGE_PRECISION)),
          frequencyRange: `${band.min}-${band.max}Hz`,
          name: band.name,
          description: band.description
        };
      }
      
      // Verificar soma dos percentuais
      const totalPercentage = Object.values(result)
        .reduce((sum, band) => sum + band.percentage, 0);
      
      // Log para auditoria
      logAudio('spectral_bands', 'calculated', {
        frame: frameIndex,
        totalEnergy: totalEnergy.toExponential(3),
        totalPercentage: totalPercentage.toFixed(1),
        sub: result.sub.percentage + '%',
        bass: result.bass.percentage + '%',
        mid: result.mid.percentage + '%',
        presence: result.presence.percentage + '%',
        air: result.air.percentage + '%'
      });
      
      return {
        bands: result,
        totalEnergy,
        totalPercentage,
        algorithm: 'RMS_7_Band_Normalized',
        valid: Math.abs(totalPercentage - 100) < 0.1 // Tolerância de 0.1%
      };
      
    } catch (error) {
      logAudio('spectral_bands', 'calculation_error', { 
        frame: frameIndex, 
        error: error.message 
      });
      return this.getNullBands();
    }
  }
  
  /**
   * 🔇 Bandas nulas para casos de energia insuficiente
   */
  getNullBands() {
    const result = {};
    for (const [key, band] of Object.entries(SPECTRAL_BANDS)) {
      result[key] = {
        energy: null,
        percentage: null,
        frequencyRange: `${band.min}-${band.max}Hz`,
        name: band.name,
        description: band.description
      };
    }
    
    return {
      bands: result,
      totalEnergy: null,
      totalPercentage: null,
      algorithm: 'RMS_7_Band_Normalized',
      valid: false
    };
  }
}

/**
 * 🔄 Agregador de bandas espectrais por múltiplos frames
 */
export class SpectralBandsAggregator {
  
  /**
   * 📊 Agregar resultados de múltiplos frames
   */
  static aggregate(bandsArray) {
    if (!bandsArray || bandsArray.length === 0) {
      return new SpectralBandsCalculator().getNullBands();
    }
    
    // Filtrar apenas resultados válidos
    const validBands = bandsArray.filter(b => b.valid);
    if (validBands.length === 0) {
      return new SpectralBandsCalculator().getNullBands();
    }
    
    const aggregated = {};
    const bandKeys = Object.keys(SPECTRAL_BANDS);
    
    // Agregar cada banda usando mediana para robustez
    for (const key of bandKeys) {
      const percentages = validBands
        .map(b => b.bands[key].percentage)
        .filter(p => p !== null && isFinite(p))
        .sort((a, b) => a - b);
      
      if (percentages.length > 0) {
        const medianIndex = Math.floor(percentages.length / 2);
        const medianPercentage = percentages.length % 2 === 0
          ? (percentages[medianIndex - 1] + percentages[medianIndex]) / 2
          : percentages[medianIndex];
        
        aggregated[key] = {
          energy: null, // Não agregar energia bruta
          percentage: Number(medianPercentage.toFixed(SPECTRAL_CONFIG.PERCENTAGE_PRECISION)),
          frequencyRange: SPECTRAL_BANDS[key].min + '-' + SPECTRAL_BANDS[key].max + 'Hz',
          name: SPECTRAL_BANDS[key].name,
          description: SPECTRAL_BANDS[key].description
        };
      } else {
        aggregated[key] = {
          energy: null,
          percentage: null,
          frequencyRange: SPECTRAL_BANDS[key].min + '-' + SPECTRAL_BANDS[key].max + 'Hz',
          name: SPECTRAL_BANDS[key].name,
          description: SPECTRAL_BANDS[key].description
        };
      }
    }
    
    // Calcular percentual total agregado
    const totalPercentage = Object.values(aggregated)
      .reduce((sum, band) => sum + (band.percentage || 0), 0);
    
    return {
      bands: aggregated,
      totalEnergy: null,
      totalPercentage: Number(totalPercentage.toFixed(1)),
      algorithm: 'RMS_7_Band_Normalized_Aggregated',
      valid: Math.abs(totalPercentage - 100) < 1.0, // Tolerância maior para agregação
      framesUsed: validBands.length,
      processedFrames: validBands.length  // ← CORRIGE: json-output.js busca processedFrames
    };
  }
}

/**
 * 📦 Função principal de exportação
 */
export function calculateSpectralBands(leftMagnitude, rightMagnitude, sampleRate = 48000, fftSize = 4096) {
  const calculator = new SpectralBandsCalculator(sampleRate, fftSize);
  return calculator.analyzeBands(leftMagnitude, rightMagnitude);
}

console.log('🌈 Spectral Bands Calculator carregado - 7 bandas profissionais com soma 100%');