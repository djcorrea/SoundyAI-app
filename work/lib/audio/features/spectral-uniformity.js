// 🎵 SPECTRAL UNIFORMITY ANALYZER - Análise de Uniformidade Espectral
// Implementação para calcular uniformidade e equilíbrio do espectro de frequência

import { logAudio } from '../error-handling.js';

/**
 * 🎯 Configurações para análise de uniformidade espectral
 */
const UNIFORMITY_CONFIG = {
  // Bandas de frequência para análise (Hz)
  FREQUENCY_BANDS: [
    { name: 'sub_bass', min: 20, max: 60 },
    { name: 'bass', min: 60, max: 250 },
    { name: 'low_mid', min: 250, max: 500 },
    { name: 'mid', min: 500, max: 2000 },
    { name: 'high_mid', min: 2000, max: 4000 },
    { name: 'presence', min: 4000, max: 6000 },
    { name: 'brilliance', min: 6000, max: 20000 }
  ],
  
  // Thresholds para classificação
  UNIFORMITY_THRESHOLDS: {
    EXCELLENT: 0.15,     // Variação < 15% = excelente uniformidade
    GOOD: 0.25,          // Variação < 25% = boa uniformidade  
    FAIR: 0.40,          // Variação < 40% = uniformidade razoável
    POOR: 0.60           // Variação >= 60% = uniformidade ruim
  },
  
  // Parâmetros de análise
  MIN_FFT_SIZE: 1024,
  SMOOTHING_FACTOR: 0.8,
  ENERGY_THRESHOLD: -60  // dB - threshold mínimo para considerar energia significativa
};

/**
 * 🎵 Analisador de Uniformidade Espectral
 */
export class SpectralUniformityAnalyzer {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.config = UNIFORMITY_CONFIG;
  }
  
  /**
   * 📊 Analisar uniformidade espectral
   */
  analyzeSpectralUniformity(fftData, frequencyBins) {
    try {
      if (!fftData || !frequencyBins || fftData.length < this.config.MIN_FFT_SIZE) {
        logAudio('uniformity', 'insufficient_data', { 
          fftLength: fftData?.length || 0,
          binsLength: frequencyBins?.length || 0
        });
        return this.getNullResult();
      }
      
      // Calcular energia por banda de frequência
      const bandEnergies = this.calculateBandEnergies(fftData, frequencyBins);
      
      // Análise de uniformidade
      const uniformityMetrics = this.calculateUniformityMetrics(bandEnergies);
      
      // Análise de balanço espectral
      const spectralBalance = this.analyzeSpectralBalance(bandEnergies);
      
      // Detectar características espectrais
      const characteristics = this.detectSpectralCharacteristics(bandEnergies);
      
      // Calcular score de uniformidade
      const uniformityScore = this.calculateUniformityScore(uniformityMetrics);
      
      const result = {
        // Energia por banda (dB)
        bandEnergies: this.normalizeBandEnergies(bandEnergies),
        
        // Métricas de uniformidade
        uniformity: {
          coefficient: Math.round(uniformityMetrics.coefficient * 1000) / 1000,
          standardDeviation: Math.round(uniformityMetrics.standardDeviation * 100) / 100,
          variance: Math.round(uniformityMetrics.variance * 100) / 100,
          range: Math.round(uniformityMetrics.range * 100) / 100,
          meanDeviation: Math.round(uniformityMetrics.meanDeviation * 100) / 100
        },
        
        // Balanço espectral
        balance: {
          lowMidBalance: Math.round(spectralBalance.lowMidBalance * 100) / 100,
          midHighBalance: Math.round(spectralBalance.midHighBalance * 100) / 100,
          bassPresenceRatio: Math.round(spectralBalance.bassPresenceRatio * 100) / 100,
          overallBalance: Math.round(spectralBalance.overallBalance * 100) / 100
        },
        
        // Características espectrais
        characteristics: {
          dominantBand: characteristics.dominantBand,
          weakestBand: characteristics.weakestBand,
          energyDistribution: characteristics.energyDistribution,
          spectralTilt: Math.round(characteristics.spectralTilt * 100) / 100,
          spectralCentroidBand: characteristics.spectralCentroidBand
        },
        
        // Score e classificação
        score: uniformityScore.score,
        rating: uniformityScore.rating,
        isUniform: uniformityScore.isUniform,
        needsBalancing: uniformityScore.needsBalancing,
        
        // Sugestões de EQ
        eqSuggestions: this.generateEQSuggestions(bandEnergies, uniformityMetrics),
        
        // Métricas de qualidade
        quality: {
          spectralHealth: uniformityScore.spectralHealth,
          mixQuality: uniformityScore.mixQuality,
          mastering: uniformityScore.mastering
        },
        
        // Metadados
        metadata: {
          bandsAnalyzed: this.config.FREQUENCY_BANDS.length,
          sampleRate: this.sampleRate,
          analysisMethod: 'multiband_energy_uniformity'
        }
      };
      
      logAudio('uniformity', 'analysis_completed', {
        coefficient: result.uniformity.coefficient,
        rating: result.rating,
        dominantBand: result.characteristics.dominantBand
      });
      
      return result;
      
    } catch (error) {
      logAudio('uniformity', 'analysis_error', { error: error.message });
      return this.getNullResult();
    }
  }
  
  /**
   * 🔢 Calcular energia por banda de frequência
   */
  calculateBandEnergies(fftData, frequencyBins) {
    const bandEnergies = {};
    
    for (const band of this.config.FREQUENCY_BANDS) {
      let energy = 0;
      let count = 0;
      
      for (let i = 0; i < frequencyBins.length; i++) {
        const freq = frequencyBins[i];
        if (freq >= band.min && freq <= band.max) {
          energy += fftData[i] * fftData[i]; // Energia = magnitude²
          count++;
        }
      }
      
      // Energia média da banda em dB
      const avgEnergy = count > 0 ? energy / count : 0;
      const energyDB = avgEnergy > 0 ? 20 * Math.log10(avgEnergy) : this.config.ENERGY_THRESHOLD;
      
      bandEnergies[band.name] = {
        energy: energyDB,
        binCount: count,
        freqRange: `${band.min}-${band.max}Hz`
      };
    }
    
    return bandEnergies;
  }
  
  /**
   * 📊 Calcular métricas de uniformidade
   */
  calculateUniformityMetrics(bandEnergies) {
    const energyValues = Object.values(bandEnergies).map(band => band.energy);
    const validEnergies = energyValues.filter(e => e > this.config.ENERGY_THRESHOLD);
    
    if (validEnergies.length < 3) {
      return { coefficient: 0, standardDeviation: 0, variance: 0, range: 0, meanDeviation: 0 };
    }
    
    const mean = validEnergies.reduce((sum, val) => sum + val, 0) / validEnergies.length;
    const variance = validEnergies.reduce((sum, val) => sum + (val - mean) ** 2, 0) / validEnergies.length;
    const standardDeviation = Math.sqrt(variance);
    const range = Math.max(...validEnergies) - Math.min(...validEnergies);
    const meanDeviation = validEnergies.reduce((sum, val) => sum + Math.abs(val - mean), 0) / validEnergies.length;
    
    // Coeficiente de uniformidade (0 = perfeitamente uniforme, 1 = muito desigual)
    const coefficient = mean !== 0 ? standardDeviation / Math.abs(mean) : 0;
    
    return {
      coefficient: Math.abs(coefficient),
      standardDeviation,
      variance,
      range,
      meanDeviation
    };
  }
  
  /**
   * ⚖️ Analisar balanço espectral
   */
  analyzeSpectralBalance(bandEnergies) {
    const getEnergy = (bandName) => bandEnergies[bandName]?.energy || this.config.ENERGY_THRESHOLD;
    
    // Balanço graves vs médios
    const bassEnergy = (getEnergy('sub_bass') + getEnergy('bass')) / 2;
    const midEnergy = (getEnergy('low_mid') + getEnergy('mid')) / 2;
    const lowMidBalance = midEnergy !== 0 ? bassEnergy / midEnergy : 0;
    
    // Balanço médios vs agudos
    const highEnergy = (getEnergy('high_mid') + getEnergy('presence') + getEnergy('brilliance')) / 3;
    const midHighBalance = highEnergy !== 0 ? midEnergy / highEnergy : 0;
    
    // Relação graves vs presença
    const presenceEnergy = getEnergy('presence');
    const bassPresenceRatio = presenceEnergy !== 0 ? bassEnergy / presenceEnergy : 0;
    
    // Balanço geral (baseado no desvio do equilíbrio ideal)
    const idealBalance = 1.0;
    const balanceDeviations = [
      Math.abs(lowMidBalance - idealBalance),
      Math.abs(midHighBalance - idealBalance),
      Math.abs(bassPresenceRatio - idealBalance)
    ];
    const overallBalance = 1 - (balanceDeviations.reduce((sum, dev) => sum + dev, 0) / 3);
    
    return {
      lowMidBalance,
      midHighBalance,
      bassPresenceRatio,
      overallBalance: Math.max(0, overallBalance)
    };
  }
  
  /**
   * 🔍 Detectar características espectrais
   */
  detectSpectralCharacteristics(bandEnergies) {
    const energyEntries = Object.entries(bandEnergies);
    
    // Banda dominante (maior energia)
    const dominantEntry = energyEntries.reduce((max, current) => 
      current[1].energy > max[1].energy ? current : max
    );
    
    // Banda mais fraca (menor energia válida)
    const validEntries = energyEntries.filter(([_, band]) => band.energy > this.config.ENERGY_THRESHOLD);
    const weakestEntry = validEntries.reduce((min, current) => 
      current[1].energy < min[1].energy ? current : min
    );
    
    // Distribuição de energia (percentual por banda)
    const totalEnergy = energyEntries.reduce((sum, [_, band]) => 
      sum + Math.max(0, band.energy - this.config.ENERGY_THRESHOLD), 0
    );
    
    const energyDistribution = {};
    energyEntries.forEach(([bandName, band]) => {
      const relativeEnergy = Math.max(0, band.energy - this.config.ENERGY_THRESHOLD);
      energyDistribution[bandName] = totalEnergy > 0 ? 
        Math.round((relativeEnergy / totalEnergy) * 100) : 0;
    });
    
    // Inclinação espectral (tilt)
    const lowFreqEnergy = (bandEnergies.sub_bass?.energy + bandEnergies.bass?.energy) / 2;
    const highFreqEnergy = (bandEnergies.presence?.energy + bandEnergies.brilliance?.energy) / 2;
    const spectralTilt = highFreqEnergy - lowFreqEnergy;
    
    // Banda do centróide espectral (estimativa)
    let maxWeight = 0;
    let spectralCentroidBand = 'mid';
    Object.entries(energyDistribution).forEach(([band, percentage]) => {
      if (percentage > maxWeight) {
        maxWeight = percentage;
        spectralCentroidBand = band;
      }
    });
    
    return {
      dominantBand: dominantEntry[0],
      weakestBand: weakestEntry?.[0] || 'unknown',
      energyDistribution,
      spectralTilt,
      spectralCentroidBand
    };
  }
  
  /**
   * 🏆 Calcular score de uniformidade
   */
  calculateUniformityScore(uniformityMetrics) {
    const coeff = uniformityMetrics.coefficient;
    
    let rating, score, isUniform, needsBalancing;
    
    if (coeff <= this.config.UNIFORMITY_THRESHOLDS.EXCELLENT) {
      rating = 'excellent';
      score = 9 + (1 - coeff / this.config.UNIFORMITY_THRESHOLDS.EXCELLENT);
      isUniform = true;
      needsBalancing = false;
    } else if (coeff <= this.config.UNIFORMITY_THRESHOLDS.GOOD) {
      rating = 'good';
      score = 7 + 2 * (1 - (coeff - this.config.UNIFORMITY_THRESHOLDS.EXCELLENT) / 
        (this.config.UNIFORMITY_THRESHOLDS.GOOD - this.config.UNIFORMITY_THRESHOLDS.EXCELLENT));
      isUniform = true;
      needsBalancing = false;
    } else if (coeff <= this.config.UNIFORMITY_THRESHOLDS.FAIR) {
      rating = 'fair';
      score = 4 + 3 * (1 - (coeff - this.config.UNIFORMITY_THRESHOLDS.GOOD) / 
        (this.config.UNIFORMITY_THRESHOLDS.FAIR - this.config.UNIFORMITY_THRESHOLDS.GOOD));
      isUniform = false;
      needsBalancing = true;
    } else {
      rating = 'poor';
      score = Math.max(1, 4 * (1 - (coeff - this.config.UNIFORMITY_THRESHOLDS.FAIR) / 
        (this.config.UNIFORMITY_THRESHOLDS.POOR - this.config.UNIFORMITY_THRESHOLDS.FAIR)));
      isUniform = false;
      needsBalancing = true;
    }
    
    return {
      score: Math.round(score * 10) / 10,
      rating,
      isUniform,
      needsBalancing,
      spectralHealth: score > 7 ? 'healthy' : score > 4 ? 'moderate' : 'poor',
      mixQuality: score > 8 ? 'professional' : score > 6 ? 'good' : score > 4 ? 'amateur' : 'needs_work',
      mastering: score > 9 ? 'mastered' : 'unmastered'
    };
  }
  
  /**
   * 🎛️ Gerar sugestões de EQ
   */
  generateEQSuggestions(bandEnergies, uniformityMetrics) {
    if (uniformityMetrics.coefficient < this.config.UNIFORMITY_THRESHOLDS.GOOD) {
      return { message: 'Espectro bem balanceado, nenhum ajuste necessário' };
    }
    
    const suggestions = [];
    const energyValues = Object.entries(bandEnergies);
    const meanEnergy = energyValues.reduce((sum, [_, band]) => sum + band.energy, 0) / energyValues.length;
    
    energyValues.forEach(([bandName, band]) => {
      const deviation = band.energy - meanEnergy;
      const thresholdDB = 3; // Sugerir ajuste se desvio > 3dB
      
      if (Math.abs(deviation) > thresholdDB) {
        const action = deviation > 0 ? 'reduzir' : 'aumentar';
        const amount = Math.round(Math.abs(deviation));
        suggestions.push({
          band: bandName,
          action,
          amount: `${amount}dB`,
          frequency: bandEnergies[bandName].freqRange
        });
      }
    });
    
    return suggestions.length > 0 ? suggestions : 
      { message: 'Pequenos ajustes podem melhorar a uniformidade' };
  }
  
  /**
   * 🔧 Normalizar energia das bandas para saída
   */
  normalizeBandEnergies(bandEnergies) {
    const normalized = {};
    Object.entries(bandEnergies).forEach(([bandName, band]) => {
      normalized[bandName] = {
        energy: Math.round(band.energy * 100) / 100,
        freqRange: band.freqRange
      };
    });
    return normalized;
  }
  
  /**
   * 🔇 Resultado nulo para casos de erro
   */
  getNullResult() {
    return {
      bandEnergies: null,
      uniformity: null,
      balance: null,
      characteristics: null,
      score: 0,
      rating: 'unknown',
      isUniform: false,
      needsBalancing: true,
      eqSuggestions: null,
      quality: {
        spectralHealth: 'unknown',
        mixQuality: 'unknown',
        mastering: 'unknown'
      },
      metadata: {
        bandsAnalyzed: 0,
        sampleRate: this.sampleRate,
        analysisMethod: 'error'
      }
    };
  }
}

/**
 * 🎨 Serializador para JSON final
 */
export function serializeSpectralUniformity(uniformityAnalysis) {
  if (!uniformityAnalysis || !uniformityAnalysis.uniformity) {
    return null;
  }
  
  return {
    uniformity: {
      coefficient: Number(uniformityAnalysis.uniformity.coefficient),
      standardDeviation: Number(uniformityAnalysis.uniformity.standardDeviation),
      range: Number(uniformityAnalysis.uniformity.range)
    },
    balance: uniformityAnalysis.balance,
    characteristics: {
      dominantBand: uniformityAnalysis.characteristics.dominantBand,
      spectralTilt: Number(uniformityAnalysis.characteristics.spectralTilt),
      energyDistribution: uniformityAnalysis.characteristics.energyDistribution
    },
    score: Number(uniformityAnalysis.score),
    rating: uniformityAnalysis.rating,
    isUniform: Boolean(uniformityAnalysis.isUniform),
    needsBalancing: Boolean(uniformityAnalysis.needsBalancing),
    quality: {
      spectralHealth: uniformityAnalysis.quality.spectralHealth,
      mixQuality: uniformityAnalysis.quality.mixQuality
    }
  };
}

/**
 * 🔧 Função auxiliar para análise rápida
 */
export function calculateSpectralUniformity(fftData, frequencyBins, sampleRate = 48000) {
  const analyzer = new SpectralUniformityAnalyzer(sampleRate);
  return analyzer.analyzeSpectralUniformity(fftData, frequencyBins);
}

console.log('🎵 Spectral Uniformity Analyzer carregado - Análise de uniformidade espectral');