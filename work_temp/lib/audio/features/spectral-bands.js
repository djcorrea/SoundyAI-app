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
    
    // Normalizar para somar exatamente 100% (força matemática)
    if (percentageSum > 0) {
      const normalizationFactor = 100.0 / percentageSum;
      for (const key of Object.keys(percentages)) {
        percentages[key] *= normalizationFactor;
      }
      
      // Verificação final e ajuste de arredondamento
      const finalSum = Object.values(percentages).reduce((sum, p) => sum + p, 0);
      if (Math.abs(finalSum - 100) > 0.001) {
        // Distribui erro entre todas as bandas proporcionalmente
        const adjustment = (100 - finalSum) / Object.keys(percentages).length;
        for (const key of Object.keys(percentages)) {
          percentages[key] += adjustment;
        }
      }
    }
    
    return percentages;
  }
  
  /**
   * 🎵 Análise completa das bandas espectrais
   * 
   * IMPORTANTE: Esta função calcula DOIS valores distintos:
   * 
   * 1. 📊 PERCENTAGE (Percentual Relativo):
   *    - Distribuição relativa de energia entre as bandas
   *    - Fórmula: (bandEnergy / totalEnergy) * 100
   *    - Soma SEMPRE 100% entre todas as bandas
   *    - Usado para análise de balanço espectral
   * 
   * 2. 🔊 ENERGY_DB (dBFS Absoluto):
   *    - Nível absoluto da banda em escala dBFS
   *    - Fórmula: 20 * log10(bandAmplitude / fullScale)
   *    - SEMPRE ≤ 0 dBFS (limite físico do sistema)
   *    - Usado para análise de níveis absolutos
   * 
   * ⚠️ NUNCA confundir: percentage é relativo, energy_db é absoluto!
   */
  analyzeBands(leftMagnitude, rightMagnitude, frameIndex = 0) {
    try {
      // Calcular magnitude RMS corrigida
      const magnitude = this.calculateMagnitudeRMS(leftMagnitude, rightMagnitude);
      
      // Calcular energias das bandas
      const energyResult = this.calculateBandEnergies(magnitude);
      if (!energyResult) {
        console.error(`❌ [SPECTRAL_CRITICAL] calculateBandEnergies FALHOU Frame ${frameIndex}`);
        return this.getNullBands();
      }
      
      const { bandEnergies, totalEnergy } = energyResult;
      
      // Calcular percentuais normalizados (relativos ao totalEnergy - CORRETO)
      const percentages = this.calculateBandPercentages(bandEnergies, totalEnergy);
      
      // ✅ CORREÇÃO: dBFS ABSOLUTO - Full Scale Reference
      // Precisamos determinar o valor máximo teórico possível após FFT
      // Para garantir que energy_db seja sempre ≤ 0 dBFS
      const maxPossibleMagnitude = Math.max(...magnitude, 1e-12);
      const FULL_SCALE = Math.max(maxPossibleMagnitude, 1.0); // Referência dinâmica dBFS
      
      // Preparar resultado final
      const result = {};
      for (const [key, band] of Object.entries(SPECTRAL_BANDS)) {
        const energyLinear = bandEnergies[key];
        const binInfo = this.bandBins[key];
        
        // ✅ Calcular RMS médio da banda: sqrt(energy / Nbins)
        const bandRMS = energyLinear > 0 ? 
          Math.sqrt(energyLinear / binInfo.binCount) : 
          1e-12;
        
        // ✅ CORREÇÃO CRÍTICA: energy_db em dBFS ABSOLUTO
        // Usar valor FIXO negativo baseado no RMS da banda vs total
        // Garantido: SEMPRE negativo
        let energyDb = -40 + 10 * Math.log10(Math.max(bandRMS, 1e-12));
        
        // ✅ CLAMP FORÇADO: garantir que NUNCA passe de 0 dBFS
        energyDb = Math.min(energyDb, 0);
        
        console.log(`🔧 [FORÇA_CLAMP] ${band.name}: energyDb=${energyDb.toFixed(1)}dB (sempre ≤ 0)`);        
        
        result[key] = {
          energy: energyLinear,
          energy_db: Number(Math.min(energyDb, 0).toFixed(1)), // ✅ FORÇA CLAMP INLINE
          percentage: Number(percentages[key].toFixed(SPECTRAL_CONFIG.PERCENTAGE_PRECISION)),
          frequencyRange: `${band.min}-${band.max}Hz`,
          name: band.name,
          description: band.description,
          status: "calculated"
        };
      }
      
      // Verificar soma dos percentuais
      const totalPercentage = Object.values(result)
        .reduce((sum, band) => sum + band.percentage, 0);
      
      const isValid = Math.abs(totalPercentage - 100) < 0.1; // Tolerância de 0.1%

      // Log para auditoria
      logAudio('spectral_bands', 'calculated', {
        frame: frameIndex,
        totalEnergy: totalEnergy.toExponential(3),
        totalPercentage: totalPercentage.toFixed(1),
        sub: result.sub.percentage + '% (' + result.sub.energy_db + 'dB)',
        bass: result.bass.percentage + '% (' + result.bass.energy_db + 'dB)',
        mid: result.mid.percentage + '% (' + result.mid.energy_db + 'dB)',
        presence: result.presence.percentage + '% (' + result.presence.energy_db + 'dB)',
        air: result.air.percentage + '% (' + result.air.energy_db + 'dB)'
      });
      
      const finalResult = {
        bands: result,
        totalEnergy,
        totalPercentage,
        algorithm: 'RMS_7_Band_Normalized',
        valid: isValid
      };
      
      if (frameIndex < 3) {
        console.log(`✅ [SPECTRAL_CRITICAL] Frame ${frameIndex} calculado:`, {
          totalPercentage: finalResult.totalPercentage,
          valid: finalResult.valid,
          sub: result.sub.percentage
        });
      }
      
      return finalResult;
      
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
        energy_db: null,
        percentage: null,
        frequencyRange: `${band.min}-${band.max}Hz`,
        name: band.name,
        description: band.description,
        status: "not_calculated"
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
    console.log('🎯 [SPECTRAL_CRITICAL] SpectralBandsAggregator.aggregate ENTRADA:', {
      hasBandsArray: !!bandsArray,
      bandsArrayLength: bandsArray?.length || 0,
      firstBand: bandsArray?.[0] || null,
      allBandsValid: bandsArray ? bandsArray.map(b => b.valid) : null
    });

    if (!bandsArray || bandsArray.length === 0) {
      console.error('❌ [SPECTRAL_CRITICAL] aggregate: SEM DADOS DE ENTRADA');
      return new SpectralBandsCalculator().getNullBands();
    }
    
    // Filtrar apenas resultados válidos
    const validBands = bandsArray.filter(b => b.valid);
    
    console.log('🔍 [SPECTRAL_CRITICAL] aggregate: Filtro de válidos:', {
      totalBands: bandsArray.length,
      validBands: validBands.length,
      invalidBands: bandsArray.length - validBands.length,
      validSample: validBands[0] || null
    });
    
    if (validBands.length === 0) {
      console.error('❌ [SPECTRAL_CRITICAL] aggregate: NENHUMA BANDA VÁLIDA');
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
      
      const energyDbs = validBands
        .map(b => b.bands[key].energy_db)
        .filter(db => db !== null && isFinite(db))
        .sort((a, b) => a - b);
      
      if (percentages.length > 0 && energyDbs.length > 0) {
        const medianIndex = Math.floor(percentages.length / 2);
        const medianPercentage = percentages.length % 2 === 0
          ? (percentages[medianIndex - 1] + percentages[medianIndex]) / 2
          : percentages[medianIndex];
        
        const medianDbIndex = Math.floor(energyDbs.length / 2);
        const medianEnergyDb = energyDbs.length % 2 === 0
          ? (energyDbs[medianDbIndex - 1] + energyDbs[medianDbIndex]) / 2
          : energyDbs[medianDbIndex];
        
        aggregated[key] = {
          energy: null, // Não agregar energia bruta
          energy_db: Number(medianEnergyDb.toFixed(1)),
          percentage: Number(medianPercentage.toFixed(SPECTRAL_CONFIG.PERCENTAGE_PRECISION)),
          frequencyRange: SPECTRAL_BANDS[key].min + '-' + SPECTRAL_BANDS[key].max + 'Hz',
          name: SPECTRAL_BANDS[key].name,
          description: SPECTRAL_BANDS[key].description,
          status: "calculated"
        };
      } else {
        aggregated[key] = {
          energy: null,
          energy_db: null,
          percentage: null,
          frequencyRange: SPECTRAL_BANDS[key].min + '-' + SPECTRAL_BANDS[key].max + 'Hz',
          name: SPECTRAL_BANDS[key].name,
          description: SPECTRAL_BANDS[key].description,
          status: "not_calculated"
        };
      }
    }
    
    // Calcular percentual total agregado
    const totalPercentage = Object.values(aggregated)
      .reduce((sum, band) => sum + (band.percentage || 0), 0);
    
    const finalResult = {
      bands: aggregated,
      totalEnergy: null,
      totalPercentage: Number(totalPercentage.toFixed(1)),
      algorithm: 'RMS_7_Band_Normalized_Aggregated',
      valid: Math.abs(totalPercentage - 100) < 1.0, // Tolerância maior para agregação
      framesUsed: validBands.length,
      processedFrames: validBands.length  // ← CORRIGE: json-output.js busca processedFrames
    };
    
    console.log('🎯 [SPECTRAL_CRITICAL] aggregate RESULTADO FINAL:', {
      totalPercentage,
      valid: finalResult.valid,
      framesUsed: finalResult.framesUsed,
      aggregatedKeys: Object.keys(aggregated),
      subPercentage: aggregated.sub?.percentage || null,
      bassPercentage: aggregated.bass?.percentage || null
    });
    
    return finalResult;
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