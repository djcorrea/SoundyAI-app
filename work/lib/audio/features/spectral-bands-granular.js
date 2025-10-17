// 🌈 SPECTRAL BANDS GRANULAR V1 - Sub-bandas com análise estatística (σ)
// Análise espectral por sub-bandas de 20 Hz com comparação target ± σ
// 100% compatível com pipeline legado - modo aditivo via feature flag

import { logAudio, makeErr, assertFinite } from '../error-handling.js';

/**
 * 🎯 Configurações padrão do sistema granular
 */
const GRANULAR_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  STEP_HZ: 20, // Resolução das sub-bandas
  MIN_ENERGY_THRESHOLD: 1e-12,
  MAX_SUGGESTIONS_PER_GROUP: 3,
  MIN_RELEVANCE_DB: 1.0, // Mínimo desvio para gerar sugestão
  DEFAULT_SIGMA: 1.5
};

/**
 * 🎨 Mapeamento de grupos para bandas legadas (compatibilidade frontend)
 */
const GROUP_TO_LEGACY_BAND = {
  sub: 'sub',
  bass: 'bass',
  low_mid: 'lowMid',
  mid: 'mid',
  high_mid: 'highMid',
  presence: 'presence',
  air: 'air'
};

/**
 * 📊 Status baseado em desvio sigma
 */
function statusFromDeviation(deviation, sigma) {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= sigma) return 'ideal';
  if (absDeviation <= sigma * 2) return 'adjust';
  return 'fix';
}

/**
 * 🎨 Status por grupo baseado em score médio
 */
function statusColorFromScore(avgScore, thresholds) {
  if (avgScore <= thresholds.greenMax) return 'green';
  if (avgScore <= thresholds.yellowMax) return 'yellow';
  return 'red';
}

/**
 * 🌈 ANALISADOR GRANULAR DE BANDAS ESPECTRAIS
 */
export class GranularSpectralAnalyzer {
  
  constructor(sampleRate = 48000, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
    
    logAudio('granular_spectral', 'init', {
      sampleRate,
      fftSize,
      frequencyResolution: this.frequencyResolution.toFixed(2),
      stepHz: GRANULAR_CONFIG.STEP_HZ
    });
  }
  
  /**
   * 🎯 ENTRADA PRINCIPAL: Analisar frames FFT com referência granular
   */
  async analyzeGranularSpectralBands(framesFFT, reference) {
    const startTime = Date.now();
    
    try {
      // Validar entrada
      if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
        throw makeErr('granular_spectral', 'No FFT frames available', 'no_fft_frames');
      }
      
      if (!reference || !reference.bands || !Array.isArray(reference.bands)) {
        throw makeErr('granular_spectral', 'Invalid reference structure', 'invalid_reference');
      }
      
      logAudio('granular_spectral', 'analysis_start', {
        frameCount: framesFFT.frames.length,
        referenceBands: reference.bands.length,
        genre: reference.genre || 'unknown'
      });
      
      // Processar todos os frames e calcular mediana por sub-banda
      const subBandsResults = this.processAllFrames(framesFFT.frames, reference);
      
      // Agregar sub-bandas em grupos
      const groupsResults = this.aggregateSubBandsIntoGroups(
        subBandsResults, 
        reference.grouping,
        reference.severity
      );
      
      // Gerar sugestões inteligentes
      const suggestions = this.buildSuggestions(
        subBandsResults,
        reference.suggestions || {}
      );
      
      // Mapear grupos para bandas legadas (compatibilidade frontend)
      const legacyBands = this.mapGroupsToBands(groupsResults);
      
      const totalTime = Date.now() - startTime;
      
      logAudio('granular_spectral', 'analysis_complete', {
        ms: totalTime,
        subBandsCount: subBandsResults.length,
        groupsCount: Object.keys(groupsResults).length,
        suggestionsCount: suggestions.length,
        legacyBandsCount: Object.keys(legacyBands).length
      });
      
      return {
        algorithm: 'granular_v1',
        bands: legacyBands, // ✅ Compatibilidade frontend (7 bandas)
        groups: groupsResults, // Grupos agregados
        granular: subBandsResults, // Sub-bandas detalhadas
        suggestions: suggestions, // Sugestões inteligentes
        metadata: {
          genre: reference.genre || 'unknown',
          schemaVersion: reference.schemaVersion || 1,
          stepHz: GRANULAR_CONFIG.STEP_HZ,
          framesProcessed: framesFFT.frames.length,
          processingTimeMs: totalTime
        }
      };
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logAudio('granular_spectral', 'error', {
        message: error.message,
        code: error.code || 'unknown',
        ms: totalTime
      });
      throw error;
    }
  }
  
  /**
   * 📊 Processar todos os frames FFT e calcular mediana por sub-banda
   */
  processAllFrames(frames, reference) {
    const subBandsData = {};
    
    // Inicializar estrutura de dados para cada sub-banda da referência
    for (const band of reference.bands) {
      subBandsData[band.id] = {
        id: band.id,
        range: band.range,
        target: band.target,
        toleranceSigma: band.toleranceSigma || GRANULAR_CONFIG.DEFAULT_SIGMA,
        description: band.description || '',
        energiesDb: [] // Array de energias de todos os frames
      };
    }
    
    // Processar cada frame
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      
      if (!frame.leftFFT?.magnitude || !frame.rightFFT?.magnitude) {
        continue;
      }
      
      // Calcular magnitude RMS estéreo
      const rmsSpectrum = this.calculateMagnitudeRMS(
        frame.leftFFT.magnitude,
        frame.rightFFT.magnitude
      );
      
      // Calcular energia para cada sub-banda
      for (const band of reference.bands) {
        const energyDb = this.calculateBandEnergyDb(
          rmsSpectrum,
          band.range[0],
          band.range[1]
        );
        
        if (isFinite(energyDb)) {
          subBandsData[band.id].energiesDb.push(energyDb);
        }
      }
    }
    
    // Calcular mediana e status para cada sub-banda
    const results = [];
    for (const bandData of Object.values(subBandsData)) {
      if (bandData.energiesDb.length === 0) {
        continue;
      }
      
      const medianEnergyDb = this.calculateMedian(bandData.energiesDb);
      const deviation = medianEnergyDb - bandData.target;
      const deviationSigmas = Math.abs(deviation) / bandData.toleranceSigma;
      const status = statusFromDeviation(deviation, bandData.toleranceSigma);
      
      results.push({
        id: bandData.id,
        range: bandData.range,
        energyDb: parseFloat(medianEnergyDb.toFixed(2)),
        target: bandData.target,
        toleranceSigma: bandData.toleranceSigma,
        deviation: parseFloat(deviation.toFixed(2)),
        deviationSigmas: parseFloat(deviationSigmas.toFixed(2)),
        status: status,
        description: bandData.description
      });
    }
    
    return results;
  }
  
  /**
   * 🎵 Calcular magnitude RMS estéreo
   */
  calculateMagnitudeRMS(leftMagnitude, rightMagnitude) {
    const length = Math.min(leftMagnitude.length, rightMagnitude.length);
    const rmsSpectrum = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      const leftEnergy = leftMagnitude[i] * leftMagnitude[i];
      const rightEnergy = rightMagnitude[i] * rightMagnitude[i];
      rmsSpectrum[i] = Math.sqrt((leftEnergy + rightEnergy) / 2);
    }
    
    return rmsSpectrum;
  }
  
  /**
   * 📊 Calcular energia de uma banda em dB
   */
  calculateBandEnergyDb(spectrum, minHz, maxHz) {
    const minBin = Math.max(0, Math.floor(minHz / this.frequencyResolution));
    const maxBin = Math.min(
      Math.floor(this.fftSize / 2),
      Math.ceil(maxHz / this.frequencyResolution)
    );
    
    let totalEnergy = 0;
    let binCount = 0;
    
    for (let bin = minBin; bin <= maxBin; bin++) {
      if (bin < spectrum.length) {
        totalEnergy += spectrum[bin] * spectrum[bin];
        binCount++;
      }
    }
    
    if (binCount === 0 || totalEnergy < GRANULAR_CONFIG.MIN_ENERGY_THRESHOLD) {
      return -100; // Silêncio
    }
    
    // Converter para dB
    const avgEnergy = totalEnergy / binCount;
    return 10 * Math.log10(avgEnergy + 1e-12);
  }
  
  /**
   * 📈 Calcular mediana de um array
   */
  calculateMedian(arr) {
    if (arr.length === 0) return 0;
    
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }
  
  /**
   * 🎨 Agregar sub-bandas em grupos
   */
  aggregateSubBandsIntoGroups(subBands, grouping, severity) {
    const weights = severity?.weights || { ideal: 0, adjust: 1, fix: 3 };
    const thresholds = severity?.thresholds || { greenMax: 0, yellowMax: 1.5 };
    
    const groupsResults = {};
    
    for (const [groupName, bandIds] of Object.entries(grouping)) {
      const groupBands = subBands.filter(sb => bandIds.includes(sb.id));
      
      if (groupBands.length === 0) {
        continue;
      }
      
      // Calcular score médio do grupo
      const totalScore = groupBands.reduce((sum, band) => {
        return sum + weights[band.status];
      }, 0);
      
      const avgScore = totalScore / groupBands.length;
      const statusColor = statusColorFromScore(avgScore, thresholds);
      
      groupsResults[groupName] = {
        status: statusColor,
        score: parseFloat(avgScore.toFixed(2)),
        subBandsCount: groupBands.length,
        description: this.getGroupDescription(groupName, groupBands)
      };
    }
    
    return groupsResults;
  }
  
  /**
   * 📝 Gerar descrição do grupo
   */
  getGroupDescription(groupName, bands) {
    const statusCounts = { ideal: 0, adjust: 0, fix: 0 };
    bands.forEach(b => statusCounts[b.status]++);
    
    if (statusCounts.fix > 0) {
      return `${groupName} com ${statusCounts.fix} sub-banda(s) precisando correção`;
    } else if (statusCounts.adjust > 0) {
      return `${groupName} com ${statusCounts.adjust} sub-banda(s) com desvio moderado`;
    }
    return `${groupName} ideal`;
  }
  
  /**
   * 💡 Construir sugestões inteligentes
   */
  buildSuggestions(subBands, suggestionsConfig) {
    const minDbStep = suggestionsConfig.minDbStep || 1.0;
    const maxDbStep = suggestionsConfig.maxDbStep || 4.0;
    const maxPerGroup = suggestionsConfig.maxPerGroup || GRANULAR_CONFIG.MAX_SUGGESTIONS_PER_GROUP;
    const minRelevanceDb = suggestionsConfig.minRelevanceDb || GRANULAR_CONFIG.MIN_RELEVANCE_DB;
    
    const suggestions = [];
    
    // Filtrar bandas que precisam ajuste ou correção
    const problematicBands = subBands
      .filter(band => band.status === 'adjust' || band.status === 'fix')
      .filter(band => Math.abs(band.deviation) >= minRelevanceDb)
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)); // Ordenar por desvio (maior primeiro)
    
    // Limitar ao máximo de sugestões
    const selectedBands = problematicBands.slice(0, maxPerGroup * 2);
    
    for (const band of selectedBands) {
      const isDeficit = band.deviation < 0; // Falta energia
      const type = isDeficit ? 'boost' : 'cut';
      
      // Calcular quantidade de ajuste (limitada ao range)
      let amount = Math.abs(band.deviation);
      amount = Math.max(minDbStep, Math.min(maxDbStep, amount));
      amount = parseFloat(amount.toFixed(1));
      
      // Construir mensagem
      const freqRange = `${band.range[0]}–${band.range[1]} Hz`;
      const action = isDeficit ? 'reforçar' : 'reduzir';
      const message = `${isDeficit ? 'Falta' : 'Excesso de'} energia em ${freqRange} — ${action} ~${amount} dB${band.description ? ` (${band.description})` : ''}.`;
      
      suggestions.push({
        freq_range: band.range,
        type: type,
        amount: amount,
        message: message,
        deviation: band.deviation,
        metric: 'frequency_balance',
        priority: band.status === 'fix' ? 'high' : 'medium'
      });
    }
    
    return suggestions;
  }
  
  /**
   * 🔄 Mapear grupos para bandas legadas (compatibilidade frontend)
   */
  mapGroupsToBands(groups) {
    const bands = {};
    
    for (const [groupName, groupData] of Object.entries(groups)) {
      const legacyKey = GROUP_TO_LEGACY_BAND[groupName];
      if (legacyKey) {
        bands[legacyKey] = {
          status: groupData.status,
          score: groupData.score,
          description: groupData.description
        };
      }
    }
    
    // Garantir que todas as 7 bandas existam (preencher com neutro se necessário)
    const allBands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    for (const bandKey of allBands) {
      if (!bands[bandKey]) {
        bands[bandKey] = {
          status: 'green',
          score: 0,
          description: `${bandKey} sem dados`
        };
      }
    }
    
    return bands;
  }
}

/**
 * 🚀 FUNÇÃO PÚBLICA: Análise granular de bandas espectrais
 */
export async function analyzeGranularSpectralBands(framesFFT, reference) {
  const analyzer = new GranularSpectralAnalyzer(
    GRANULAR_CONFIG.SAMPLE_RATE,
    GRANULAR_CONFIG.FFT_SIZE
  );
  
  return await analyzer.analyzeGranularSpectralBands(framesFFT, reference);
}

console.log('🌈 Spectral Bands Granular V1 carregado - Sub-bandas com análise σ');
