// 🎯 SPECTRAL BANDS GRANULAR V1 - Sub-Banda Analysis with σ Tolerances
// Análise espectral granular (step 20 Hz) com tolerâncias estatísticas (σ)
// Status: ideal (≤1σ), adjust (≤2σ), fix (>2σ)
// 100% compatível com pipeline legacy - NÃO recalcula FFT, apenas analisa bins existentes

import { logAudio, makeErr, assertFinite } from '../error-handling.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🎯 Configuração do módulo granular
 */
const GRANULAR_CONFIG = {
  STEP_HZ: 20,                    // Resolução das sub-bandas (20 Hz)
  MIN_ENERGY_THRESHOLD: 1e-12,    // Threshold de energia mínima
  MAX_SUGGESTIONS_PER_GROUP: 3,   // Máximo de sugestões por grupo
  MIN_RELEVANCE_DB: 1.0,          // Desvio mínimo para gerar sugestão (1 dB)
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096
};

/**
 * 🧮 Calcula status baseado no desvio em sigmas
 */
function statusFromDeviation(deviation, toleranceSigma = 1.5) {
  const absDeviation = Math.abs(deviation);
  const oneSigma = toleranceSigma;
  const twoSigma = toleranceSigma * 2;
  
  if (absDeviation <= oneSigma) return 'ideal';
  if (absDeviation <= twoSigma) return 'adjust';
  return 'fix';
}

/**
 * 🎨 Calcula score por grupo baseado nos pesos dos status
 */
function scoreByGroup(subBands, grouping, severityWeights, thresholds) {
  const groupScores = {};
  
  for (const [groupName, subBandIds] of Object.entries(grouping)) {
    const groupSubBands = subBands.filter(sb => subBandIds.includes(sb.id));
    
    if (groupSubBands.length === 0) {
      groupScores[groupName] = { status: 'green', score: 0.0, subBandsCount: 0 };
      continue;
    }
    
    // Somar pontos baseados no status (ideal=0, adjust=1, fix=3)
    const totalPoints = groupSubBands.reduce((sum, sb) => {
      return sum + (severityWeights[sb.status] || 0);
    }, 0);
    
    const avgPoints = totalPoints / groupSubBands.length;
    
    // Definir cor baseado nos thresholds
    let statusColor = 'green';
    if (avgPoints > thresholds.yellowMax) {
      statusColor = 'red';
    } else if (avgPoints > thresholds.greenMax) {
      statusColor = 'yellow';
    }
    
    groupScores[groupName] = {
      status: statusColor,
      score: parseFloat(avgPoints.toFixed(2)),
      subBandsCount: groupSubBands.length
    };
  }
  
  return groupScores;
}

/**
 * 🎤 Constrói sugestões inteligentes baseadas nos desvios
 */
function buildSuggestions(subBands, maxPerGroup = 3, minRelevanceDb = 1.0, language = 'pt-BR') {
  const suggestions = [];
  
  // Filtrar sub-bandas com status 'adjust' ou 'fix' e desvio relevante
  const problematicBands = subBands.filter(sb => 
    (sb.status === 'adjust' || sb.status === 'fix') && 
    Math.abs(sb.deviation) >= minRelevanceDb
  );
  
  // Ordenar por magnitude do desvio (maior primeiro)
  problematicBands.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  
  // Limitar total de sugestões
  const topBands = problematicBands.slice(0, maxPerGroup * 3); // 3 grupos principais
  
  for (const band of topBands) {
    const absDeviation = Math.abs(band.deviation);
    const type = band.deviation < 0 ? 'boost' : 'cut';
    const amount = parseFloat(Math.min(absDeviation, 4.0).toFixed(1)); // Limitar a 4 dB
    const priority = band.status === 'fix' ? 'high' : 'medium';
    
    let message = '';
    if (type === 'boost') {
      message = `Falta energia em ${band.range[0]}–${band.range[1]} Hz — reforçar ~${amount} dB.`;
    } else {
      message = `Excesso em ${band.range[0]}–${band.range[1]} Hz — reduzir ~${amount} dB.`;
    }
    
    suggestions.push({
      freq_range: band.range,
      type,
      amount,
      message,
      deviation: parseFloat(band.deviation.toFixed(2)),
      metric: 'frequency_balance',
      priority
    });
  }
  
  return suggestions;
}

/**
 * 📊 Carrega arquivo de referência JSON por gênero
 */
function loadReferenceSchema(genre = 'techno') {
  try {
    // Caminho relativo ao módulo atual: lib/audio/features/ → references/
    const referencesDir = path.resolve(__dirname, '../../../references');
    const filePath = path.join(referencesDir, `${genre}.v1.json`);
    
    logAudio('granular_bands', 'loading_reference', { genre, path: filePath });
    
    if (!fs.existsSync(filePath)) {
      throw makeErr('granular_bands', `Reference file not found: ${filePath}`, 'reference_not_found');
    }
    
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const reference = JSON.parse(rawData);
    
    // Validação básica do schema
    if (!reference.bands || !Array.isArray(reference.bands)) {
      throw makeErr('granular_bands', 'Invalid reference schema: missing bands array', 'invalid_schema');
    }
    
    if (!reference.grouping || typeof reference.grouping !== 'object') {
      throw makeErr('granular_bands', 'Invalid reference schema: missing grouping object', 'invalid_schema');
    }
    
    logAudio('granular_bands', 'reference_loaded', {
      genre,
      bandsCount: reference.bands.length,
      groupsCount: Object.keys(reference.grouping).length,
      schemaVersion: reference.schemaVersion
    });
    
    return reference;
    
  } catch (error) {
    logAudio('granular_bands', 'reference_load_error', { 
      genre, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * 🌈 Analisa bandas espectrais granulares a partir dos bins FFT existentes
 */
export async function analyzeGranularSpectralBands(framesFFT, options = {}) {
  const { genre = 'techno', jobId } = options;
  
  logAudio('granular_bands', 'start_analysis', { genre, jobId });
  const startTime = Date.now();
  
  try {
    // Validação de entrada
    if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
      throw makeErr('granular_bands', 'Invalid framesFFT: no frames available', 'invalid_input');
    }
    
    // Carregar referência do gênero
    const reference = loadReferenceSchema(genre);
    
    // Extrair configuração
    const stepHz = reference.stepHz || GRANULAR_CONFIG.STEP_HZ;
    const sampleRate = GRANULAR_CONFIG.SAMPLE_RATE;
    const fftSize = GRANULAR_CONFIG.FFT_SIZE;
    const frequencyResolution = sampleRate / fftSize; // ~11.72 Hz
    
    logAudio('granular_bands', 'fft_config', {
      sampleRate,
      fftSize,
      frequencyResolution: frequencyResolution.toFixed(2),
      stepHz,
      framesCount: framesFFT.frames.length
    });
    
    // Processar cada frame FFT e acumular energias por sub-banda
    const subBandEnergies = {}; // { "sub_low": [energy1, energy2, ...], ... }
    
    for (const bandDef of reference.bands) {
      subBandEnergies[bandDef.id] = [];
    }
    
    let validFrames = 0;
    
    for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
      const frame = framesFFT.frames[frameIndex];
      
      if (!frame.leftFFT?.magnitude || !frame.rightFFT?.magnitude) {
        continue;
      }
      
      validFrames++;
      
      // Para cada sub-banda na referência
      for (const bandDef of reference.bands) {
        const [minFreq, maxFreq] = bandDef.range;
        
        // Calcular bins correspondentes
        const minBin = Math.floor(minFreq / frequencyResolution);
        const maxBin = Math.ceil(maxFreq / frequencyResolution);
        
        // Acumular energia RMS stereo (igual ao legacy)
        let sumSquared = 0;
        let binCount = 0;
        
        for (let bin = minBin; bin <= maxBin && bin < frame.leftFFT.magnitude.length; bin++) {
          const leftMag = frame.leftFFT.magnitude[bin] || 0;
          const rightMag = frame.rightFFT.magnitude[bin] || 0;
          
          // RMS stereo: sqrt((L² + R²) / 2)
          const stereoMag = Math.sqrt((leftMag * leftMag + rightMag * rightMag) / 2);
          sumSquared += stereoMag * stereoMag;
          binCount++;
        }
        
        // Energia RMS da banda
        const energy = binCount > 0 ? Math.sqrt(sumSquared / binCount) : 0;
        subBandEnergies[bandDef.id].push(energy);
      }
    }
    
    logAudio('granular_bands', 'frame_processing_complete', {
      validFrames,
      totalFrames: framesFFT.frames.length
    });
    
    // Agregar energias usando mediana (igual ao legacy)
    const granularResults = [];
    
    for (const bandDef of reference.bands) {
      const energies = subBandEnergies[bandDef.id];
      
      if (energies.length === 0) {
        granularResults.push({
          id: bandDef.id,
          range: bandDef.range,
          energyDb: null,
          target: bandDef.target,
          toleranceSigma: bandDef.toleranceSigma,
          deviation: null,
          deviationSigmas: null,
          status: 'no_data'
        });
        continue;
      }
      
      // Calcular mediana das energias
      const sortedEnergies = [...energies].sort((a, b) => a - b);
      const medianIndex = Math.floor(sortedEnergies.length / 2);
      const medianEnergy = sortedEnergies.length % 2 === 0
        ? (sortedEnergies[medianIndex - 1] + sortedEnergies[medianIndex]) / 2
        : sortedEnergies[medianIndex];
      
      // Converter para dB
      const energyDb = medianEnergy > GRANULAR_CONFIG.MIN_ENERGY_THRESHOLD
        ? 20 * Math.log10(medianEnergy)
        : -120;
      
      // Calcular desvio em relação ao target
      const deviation = energyDb - bandDef.target;
      const deviationSigmas = deviation / bandDef.toleranceSigma;
      
      // Determinar status
      const status = statusFromDeviation(deviation, bandDef.toleranceSigma);
      
      granularResults.push({
        id: bandDef.id,
        range: bandDef.range,
        energyDb: parseFloat(energyDb.toFixed(2)),
        target: bandDef.target,
        toleranceSigma: bandDef.toleranceSigma,
        deviation: parseFloat(deviation.toFixed(2)),
        deviationSigmas: parseFloat(deviationSigmas.toFixed(2)),
        status
      });
    }
    
    // Agregar sub-bandas em grupos (7 bandas principais)
    const severityWeights = reference.severity?.weights || { ideal: 0, adjust: 1, fix: 3 };
    const thresholds = reference.severity?.thresholds || { greenMax: 0, yellowMax: 1.5 };
    const groupScores = scoreByGroup(granularResults, reference.grouping, severityWeights, thresholds);
    
    // Gerar sugestões inteligentes
    const suggestionsConfig = reference.suggestions || {};
    const suggestions = buildSuggestions(
      granularResults,
      suggestionsConfig.maxPerGroup || GRANULAR_CONFIG.MAX_SUGGESTIONS_PER_GROUP,
      suggestionsConfig.minRelevanceDb || GRANULAR_CONFIG.MIN_RELEVANCE_DB,
      suggestionsConfig.language || 'pt-BR'
    );
    
    // Estatísticas
    const stats = {
      total: granularResults.length,
      ideal: granularResults.filter(r => r.status === 'ideal').length,
      adjust: granularResults.filter(r => r.status === 'adjust').length,
      fix: granularResults.filter(r => r.status === 'fix').length,
      no_data: granularResults.filter(r => r.status === 'no_data').length
    };
    
    const totalTime = Date.now() - startTime;
    logAudio('granular_bands', 'analysis_complete', {
      genre,
      subBandsTotal: stats.total,
      subBandsIdeal: stats.ideal,
      subBandsAdjust: stats.adjust,
      subBandsFix: stats.fix,
      suggestionsCount: suggestions.length,
      ms: totalTime,
      jobId
    });
    
    // Retornar resultado completo compatível com pipeline
    return {
      algorithm: 'granular_v1',
      referenceGenre: genre,
      schemaVersion: reference.schemaVersion || 1,
      lufsNormalization: reference.lufsNormalization || true,
      framesProcessed: validFrames,
      aggregationMethod: 'median',
      
      // Grupos (7 bandas principais para compatibilidade com front)
      groups: groupScores,
      
      // Estatísticas de sub-bandas
      subBandsTotal: stats.total,
      subBandsIdeal: stats.ideal,
      subBandsAdjust: stats.adjust,
      subBandsFix: stats.fix,
      
      // Dados granulares completos
      granular: granularResults,
      
      // Sugestões inteligentes
      suggestions,
      
      // Flag de validade
      valid: validFrames > 0
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logAudio('granular_bands', 'analysis_error', {
      error: error.message,
      code: error.code || 'unknown',
      ms: totalTime,
      jobId
    });
    throw error;
  }
}

/**
 * 🔄 Converte resultado granular para formato legacy (7 bandas)
 * Usado para manter compatibilidade total com front-end
 */
export function convertGranularToLegacyBands(granularResult) {
  if (!granularResult || !granularResult.groups) {
    return null;
  }
  
  const legacyBands = {
    sub: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.sub?.status || 'calculated',
      frequencyRange: '20-60Hz',
      name: 'Sub'
    },
    bass: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.bass?.status || 'calculated',
      frequencyRange: '60-150Hz',
      name: 'Bass'
    },
    lowMid: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.low_mid?.status || 'calculated',
      frequencyRange: '150-500Hz',
      name: 'Low-Mid'
    },
    mid: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.mid?.status || 'calculated',
      frequencyRange: '500-2000Hz',
      name: 'Mid'
    },
    highMid: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.high_mid?.status || 'calculated',
      frequencyRange: '2000-5000Hz',
      name: 'High-Mid'
    },
    presence: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.presence?.status || 'calculated',
      frequencyRange: '5000-10000Hz',
      name: 'Presence'
    },
    air: {
      energy_db: null,
      percentage: null,
      status: granularResult.groups.air?.status || 'calculated',
      frequencyRange: '10000-20000Hz',
      name: 'Air'
    }
  };
  
  // Calcular energia média e percentuais a partir das sub-bandas granulares
  if (granularResult.granular && Array.isArray(granularResult.granular)) {
    const grouping = {
      sub: ['sub_low', 'sub_high'],
      bass: ['bass_low', 'bass_mid', 'bass_high'],
      lowMid: ['lowmid_low', 'lowmid_high'],
      mid: ['mid_low', 'mid_high'],
      highMid: ['highmid_low', 'highmid_high'],
      presence: ['presence'],
      air: ['air']
    };
    
    for (const [legacyKey, subBandIds] of Object.entries(grouping)) {
      const subBands = granularResult.granular.filter(sb => subBandIds.includes(sb.id));
      
      if (subBands.length > 0) {
        // Média das energias em dB
        const validEnergies = subBands.filter(sb => sb.energyDb !== null).map(sb => sb.energyDb);
        if (validEnergies.length > 0) {
          const avgEnergyDb = validEnergies.reduce((sum, e) => sum + e, 0) / validEnergies.length;
          legacyBands[legacyKey].energy_db = parseFloat(avgEnergyDb.toFixed(2));
        }
      }
    }
    
    // Calcular percentuais normalizados (soma = 100%)
    const totalLinearEnergy = Object.values(legacyBands).reduce((sum, band) => {
      if (band.energy_db !== null && band.energy_db > -120) {
        return sum + Math.pow(10, band.energy_db / 20);
      }
      return sum;
    }, 0);
    
    if (totalLinearEnergy > 0) {
      for (const band of Object.values(legacyBands)) {
        if (band.energy_db !== null && band.energy_db > -120) {
          const linearEnergy = Math.pow(10, band.energy_db / 20);
          band.percentage = parseFloat(((linearEnergy / totalLinearEnergy) * 100).toFixed(2));
        } else {
          band.percentage = 0;
        }
      }
    }
  }
  
  return {
    bands: legacyBands,
    totalPercentage: Object.values(legacyBands).reduce((sum, b) => sum + (b.percentage || 0), 0),
    valid: granularResult.valid,
    algorithm: 'granular_v1'
  };
}

console.log("🎯 Spectral Bands Granular V1 carregado - Análise de sub-bandas com tolerâncias σ");
