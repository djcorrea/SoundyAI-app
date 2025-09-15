// 🎯 FASE 5.4: JSON OUTPUT + SCORING
// Constrói saída JSON estruturada e calcula score compatível com front-end

import { computeMixScore } from "../../lib/audio/features/scoring.js";

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3");

/**
 * Gera JSON final estruturado com métricas e score
 */
export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  console.log("🚀 Iniciando geração de JSON final (Fase 5.4)...");
  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw new Error("Core metrics inválidas");
    }

    const technicalData = extractTechnicalData(coreMetrics);
    const scoringResult = computeMixScore(technicalData, reference);

    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata);
    validateFinalJSON(finalJSON);

    console.log("✅ JSON Output gerado com sucesso (Fase 5.4)");
    return finalJSON;
  } catch (error) {
    console.error("❌ Erro na Fase 5.4:", error);
    return createErrorJSON(error, coreMetrics, metadata);
  }
}

/**
 * Extrai dados técnicos das métricas core para o scoring
 */
function extractTechnicalData(coreMetrics) {
  const technicalData = {};

  try {
    // Loudness
    if (coreMetrics.lufs) {
      technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
      technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
      technicalData.lufsMomentary = coreMetrics.lufs.momentary;
      technicalData.lra = coreMetrics.lufs.lra;
    }

    // True Peak
    if (coreMetrics.truePeak) {
      technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
      technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;
    }

    // 🎯 BANDAS ESPECTRAIS REAIS - EXTRAÇÃO ROBUSTA  
    console.log('🔍 [JSON_OUTPUT] Verificação detalhada de bandas espectrais:', {
      hasFFTFrequencyBands: !!(coreMetrics.fft?.frequencyBands?.left),
      hasSpectralBands: !!(coreMetrics.spectralBands),
      hasSpectralBandsAggregated: !!(coreMetrics.spectralBands?.aggregated),
      fftFrequencyBandsKeys: coreMetrics.fft?.frequencyBands?.left ? Object.keys(coreMetrics.fft.frequencyBands.left) : [],
      spectralBandsKeys: coreMetrics.spectralBands ? Object.keys(coreMetrics.spectralBands) : []
    });
    
    // 🚀 PRIORIDADE 1: Bandas espectrais do FFT (7 bandas)
    if (coreMetrics.fft?.frequencyBands?.left) {
      technicalData.bandEnergies = {};
      const bandsFound = [];
      
      for (const [bandName, band] of Object.entries(coreMetrics.fft.frequencyBands.left)) {
        if (typeof band.energy === 'number') {
          technicalData.bandEnergies[bandName] = {
            energy: sanitizeValue(band.energy),
            rms_db: band.energy > 0 ? sanitizeValue(10 * Math.log10(band.energy)) : -120
          };
          bandsFound.push(bandName);
        }
      }
      
      console.log('✅ [JSON_OUTPUT] Bandas espectrais REAIS extraídas do FFT:', bandsFound);
      
      if (coreMetrics.fft.spectralCentroid) {
        technicalData.spectralCentroid = sanitizeValue(coreMetrics.fft.spectralCentroid);
      }
    }
    
    // 🔧 PRIORIDADE 2: Bandas espectrais agregadas alternativas
    else if (coreMetrics.spectralBands?.aggregated) {
      const bands = coreMetrics.spectralBands.aggregated;
      
      console.log('⚠️ [JSON_OUTPUT] Usando bandas espectrais agregadas alternativas:', {
        available: Object.keys(bands),
        processedFrames: bands.processedFrames
      });
      
      technicalData.spectral_balance = {
        sub: sanitizeValue(bands.sub),
        bass: sanitizeValue(bands.bass),
        lowMid: sanitizeValue(bands.lowMid),
        mid: sanitizeValue(bands.mid),
        highMid: sanitizeValue(bands.highMid),
        presence: sanitizeValue(bands.presence),
        air: sanitizeValue(bands.air),
        totalPercentage: 100
      };
      
      console.log('✅ [JSON_OUTPUT] Bandas espectrais agregadas extraídas com sucesso');
    }
    
    // 🔧 PRIORIDADE 3: Procurar bandas em outras estruturas
    else {
      console.log('⚠️ [JSON_OUTPUT] Procurando bandas espectrais em estruturas alternativas...');
      
      // Verificar se há dados de banda em outras propriedades
      const spectralDataFound = {};
      
      // Procurar em propriedades do nível raiz
      const bandNames = ['subBass', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance'];
      for (const bandName of bandNames) {
        if (coreMetrics[bandName] !== undefined) {
          spectralDataFound[bandName] = coreMetrics[bandName];
        }
      }
      
      // Procurar em sub-objetos
      if (coreMetrics.frequency && typeof coreMetrics.frequency === 'object') {
        for (const bandName of bandNames) {
          if (coreMetrics.frequency[bandName] !== undefined) {
            spectralDataFound[bandName] = coreMetrics.frequency[bandName];
          }
        }
      }
      
      if (Object.keys(spectralDataFound).length > 0) {
        technicalData.bandEnergies = {};
        for (const [bandName, value] of Object.entries(spectralDataFound)) {
          technicalData.bandEnergies[bandName] = {
            energy: sanitizeValue(value),
            rms_db: value > 0 ? sanitizeValue(10 * Math.log10(value)) : -120
          };
        }
        console.log('✅ [JSON_OUTPUT] Bandas espectrais encontradas em estruturas alternativas:', Object.keys(spectralDataFound));
      }
    }
    
    // 📊 Log final das bandas extraídas
    const extractedBands = {
      hasFFTBands: !!(technicalData.bandEnergies),
      hasSpectralBalance: !!(technicalData.spectral_balance),
      fftBandCount: technicalData.bandEnergies ? Object.keys(technicalData.bandEnergies).length : 0,
      spectralBalanceCount: technicalData.spectral_balance ? Object.keys(technicalData.spectral_balance).length : 0
    };
    console.log('📊 [JSON_OUTPUT] Resumo de bandas espectrais extraídas:', extractedBands);

    // 🎯 MÉTRICAS ESPECTRAIS REAIS - EXTRAÇÃO ROBUSTA
    console.log('🔍 [JSON_OUTPUT] Verificação detalhada de estruturas FFT:', {
      hasFFT: !!(coreMetrics.fft),
      hasAggregated: !!(coreMetrics.fft?.aggregated),
      hasFrequencyBands: !!(coreMetrics.fft?.frequencyBands),
      hasSpectrograms: !!(coreMetrics.fft?.spectrograms),
      fftKeys: coreMetrics.fft ? Object.keys(coreMetrics.fft) : [],
      aggregatedKeys: coreMetrics.fft?.aggregated ? Object.keys(coreMetrics.fft.aggregated) : [],
      frameCount: coreMetrics.fft?.frameCount || 0
    });
    
    // 🚀 PRIORIDADE 1: Usar métricas agregadas (preferencial)
    console.log('🔍 [JSON_OUTPUT] === DEBUG CONDIÇÕES EXTRAÇÃO ===');
    console.log('🔍 [JSON_OUTPUT] coreMetrics.fft exists:', !!coreMetrics.fft);
    console.log('🔍 [JSON_OUTPUT] coreMetrics.fft.aggregated exists:', !!coreMetrics.fft?.aggregated);
    console.log('🔍 [JSON_OUTPUT] spectralCentroidHz type:', typeof coreMetrics.fft?.aggregated?.spectralCentroidHz);
    console.log('🔍 [JSON_OUTPUT] spectralCentroidHz value:', coreMetrics.fft?.aggregated?.spectralCentroidHz);
    
    // 🔧 CORREÇÃO CRÍTICA: Extração mais robusta que sempre tenta extrair as métricas
    let spectralExtracted = false;
    
    // TENTATIVA 1: FFT.aggregated (ideal)
    if (coreMetrics.fft && coreMetrics.fft.aggregated) {
      
      const spectral = coreMetrics.fft.aggregated;
      console.log('✅ [JSON_OUTPUT] Extraindo métricas espectrais REAIS do FFT agregado:', {
        available: Object.keys(spectral),
        spectralCentroidHz: spectral.spectralCentroidHz,
        spectralRolloffHz: spectral.spectralRolloffHz,
        calculatedAt: spectral.calculatedAt
      });
      
      // Extrair TODAS as métricas espectrais disponíveis - sem filtros!
      if (spectral.spectralCentroidHz !== undefined) {
        technicalData.spectralCentroidHz = sanitizeValue(spectral.spectralCentroidHz);
        spectralExtracted = true;
      }
      if (spectral.spectralRolloffHz !== undefined) {
        technicalData.spectralRolloffHz = sanitizeValue(spectral.spectralRolloffHz);
        spectralExtracted = true;
      }
      if (spectral.spectralBandwidthHz !== undefined) {
        technicalData.spectralBandwidthHz = sanitizeValue(spectral.spectralBandwidthHz);
        spectralExtracted = true;
      }
      if (spectral.spectralSpread !== undefined) {
        technicalData.spectralSpreadHz = sanitizeValue(spectral.spectralSpread);
        spectralExtracted = true;
      }
      if (spectral.spectralFlatness !== undefined) {
        technicalData.spectralFlatness = sanitizeValue(spectral.spectralFlatness);
        spectralExtracted = true;
      }
      if (spectral.spectralCrest !== undefined) {
        technicalData.spectralCrest = sanitizeValue(spectral.spectralCrest);
        spectralExtracted = true;
      }
      if (spectral.spectralSkewness !== undefined) {
        technicalData.spectralSkewness = sanitizeValue(spectral.spectralSkewness);
        spectralExtracted = true;
      }
      if (spectral.spectralKurtosis !== undefined) {
        technicalData.spectralKurtosis = sanitizeValue(spectral.spectralKurtosis);
        spectralExtracted = true;
      }
      if (spectral.zeroCrossingRate !== undefined) {
        technicalData.zeroCrossingRate = sanitizeValue(spectral.zeroCrossingRate);
        spectralExtracted = true;
      }
      if (spectral.spectralFlux !== undefined) {
        technicalData.spectralFlux = sanitizeValue(spectral.spectralFlux);
        spectralExtracted = true;
      }
      
      // Criar aliases para compatibilidade com o modal
      if (technicalData.spectralCentroidHz !== undefined) {
        technicalData.frequenciaCentral = technicalData.spectralCentroidHz;
      }
      if (technicalData.spectralRolloffHz !== undefined) {
        technicalData.limiteAgudos85 = technicalData.spectralRolloffHz;
      }
      
      console.log('✅ [JSON_OUTPUT] Métricas espectrais REAIS extraídas:', Object.keys(technicalData).filter(k => k.includes('spectral') || k.includes('frequencia') || k.includes('limite')));
      
    }
    // 🔧 PRIORIDADE 2: Tentar extrair diretamente do FFT mesmo sem agregadas
    else if (!spectralExtracted && coreMetrics.fft && (coreMetrics.fft.frameCount > 0 || coreMetrics.fft.spectrograms)) {
      
      console.log('⚠️ [JSON_OUTPUT] FFT.aggregated indisponível, tentando extração direta das métricas reais...');
      
      // Verificar se há dados espectrais calculados em outras estruturas
      let foundMetrics = false;
      
      // Tentar extrair de outras propriedades do coreMetrics
      if (coreMetrics.spectralCentroidHz !== undefined) {
        technicalData.spectralCentroidHz = sanitizeValue(coreMetrics.spectralCentroidHz);
        foundMetrics = true;
      }
      if (coreMetrics.spectralRolloffHz !== undefined) {
        technicalData.spectralRolloffHz = sanitizeValue(coreMetrics.spectralRolloffHz);
        foundMetrics = true;
      }
      if (coreMetrics.spectralFlatness !== undefined) {
        technicalData.spectralFlatness = sanitizeValue(coreMetrics.spectralFlatness);
        foundMetrics = true;
      }
      
      // Verificar se há métricas em propriedades alternativas
      const alternativeKeys = ['spectral', 'features', 'analysis'];
      for (const key of alternativeKeys) {
        if (coreMetrics[key] && typeof coreMetrics[key] === 'object') {
          if (coreMetrics[key].spectralCentroidHz !== undefined) {
            technicalData.spectralCentroidHz = sanitizeValue(coreMetrics[key].spectralCentroidHz);
            foundMetrics = true;
          }
          if (coreMetrics[key].spectralRolloffHz !== undefined) {
            technicalData.spectralRolloffHz = sanitizeValue(coreMetrics[key].spectralRolloffHz);
            foundMetrics = true;
          }
        }
      }
      
      if (foundMetrics) {
        console.log('✅ [JSON_OUTPUT] Métricas espectrais REAIS extraídas de estruturas alternativas');
      } else {
        console.warn('⚠️ [JSON_OUTPUT] Métricas espectrais não encontradas em estruturas alternativas');
      }
    }
    
    // 🚨 EXTRAÇÃO FINAL GARANTIDA - buscar em qualquer lugar do coreMetrics
    if (!spectralExtracted) {
      console.log('🔍 [JSON_OUTPUT] BUSCA FINAL por métricas espectrais em todo coreMetrics...');
      
      // Função recursiva para encontrar métricas
      function findMetricInObject(obj, metricName, currentPath = '') {
        if (!obj || typeof obj !== 'object') return null;
        
        for (const [key, value] of Object.entries(obj)) {
          const path = currentPath ? `${currentPath}.${key}` : key;
          
          if (key === metricName && typeof value === 'number') {
            console.log(`✅ [JSON_OUTPUT] Encontrado ${metricName} em ${path}: ${value}`);
            return value;
          }
          
          if (typeof value === 'object' && value !== null) {
            const found = findMetricInObject(value, metricName, path);
            if (found !== null) return found;
          }
        }
        return null;
      }
      
      // Buscar cada métrica específica
      const centroid = findMetricInObject(coreMetrics, 'spectralCentroidHz');
      const rolloff = findMetricInObject(coreMetrics, 'spectralRolloffHz'); 
      const flatness = findMetricInObject(coreMetrics, 'spectralFlatness');
      const flux = findMetricInObject(coreMetrics, 'spectralFlux');
      
      if (centroid !== null) {
        technicalData.spectralCentroidHz = sanitizeValue(centroid);
        spectralExtracted = true;
      }
      if (rolloff !== null) {
        technicalData.spectralRolloffHz = sanitizeValue(rolloff);
        spectralExtracted = true;
      }
      if (flatness !== null) {
        technicalData.spectralFlatness = sanitizeValue(flatness);
        spectralExtracted = true;
      }
      if (flux !== null) {
        technicalData.spectralFlux = sanitizeValue(flux);
        spectralExtracted = true;
      }
      
      if (spectralExtracted) {
        console.log('✅ [JSON_OUTPUT] BUSCA FINAL - métricas encontradas e extraídas!');
      } else {
        console.log('❌ [JSON_OUTPUT] BUSCA FINAL - nenhuma métrica espectral encontrada');
      }
    }
    
    // 🔧 GARANTIR que métricas espectrais sejam sempre adicionadas se existirem
    if (technicalData.spectralCentroidHz !== undefined || technicalData.spectralRolloffHz !== undefined) {
      // Criar aliases obrigatórios para compatibilidade
      technicalData.spectralCentroid = technicalData.spectralCentroidHz || 0;
      technicalData.spectralRolloff = technicalData.spectralRolloffHz || 0;
      
      // Aliases para modal (conforme requisitos)
      technicalData.frequenciaCentral = technicalData.spectralCentroidHz || 0;
      technicalData.limiteAgudos85 = technicalData.spectralRolloffHz || 0;
      technicalData.mudancaEspectral = technicalData.spectralFlux || 0;
      technicalData.uniformidade = technicalData.spectralFlatness || 0;
      
      console.log('✅ [JSON_OUTPUT] Aliases de compatibilidade criados para métricas espectrais');
    }
    
    // 📊 Log final do que foi extraído
    const extractedSpectral = {
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloffHz: technicalData.spectralRolloffHz,
      spectralFlatness: technicalData.spectralFlatness,
      spectralFlux: technicalData.spectralFlux,
      foundMetrics: !!(technicalData.spectralCentroidHz || technicalData.spectralRolloffHz)
    };
    console.log('📊 [JSON_OUTPUT] Resumo de métricas espectrais extraídas:', extractedSpectral);

    // 🎯 FIXADO: Bandas Espectrais agregadas
    if (coreMetrics.spectralBands && coreMetrics.spectralBands.aggregated) {
      const bands = coreMetrics.spectralBands.aggregated;
      
      console.log('🔬 [JSON_OUTPUT] Extraindo bandas espectrais agregadas:', {
        available: Object.keys(bands),
        processedFrames: bands.processedFrames
      });
      
      technicalData.spectral_balance = {
        sub: sanitizeValue(bands.sub),
        bass: sanitizeValue(bands.bass),
        lowMid: sanitizeValue(bands.lowMid),
        mid: sanitizeValue(bands.mid),
        highMid: sanitizeValue(bands.highMid),
        presence: sanitizeValue(bands.presence),
        air: sanitizeValue(bands.air),
        totalPercentage: 100
      };
    }

    // Stereo
    if (coreMetrics.stereo) {
      technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
      technicalData.stereoWidth = coreMetrics.stereo.width;
      technicalData.balanceLR = coreMetrics.stereo.balance;
    }

    // Metadata
    if (coreMetrics.metadata) {
      technicalData.sampleRate = coreMetrics.metadata.sampleRate;
      technicalData.channels = coreMetrics.metadata.channels;
      technicalData.duration = coreMetrics.metadata.duration;
    } else {
      technicalData.sampleRate = coreMetrics.sampleRate || 48000;
      technicalData.channels = coreMetrics.numberOfChannels || 2;
      technicalData.duration = coreMetrics.duration || 0;
    }

    // 🎚️ Dynamic Range Metrics (TT-DR + Crest Factor)
    if (coreMetrics.dynamics) {
      // TT-DR Principal
      technicalData.dynamicRange = sanitizeValue(coreMetrics.dynamics.dynamic_range);
      technicalData.ttDR = sanitizeValue(coreMetrics.dynamics.tt_dr);
      technicalData.p95Rms = sanitizeValue(coreMetrics.dynamics.p95_rms);
      technicalData.p10Rms = sanitizeValue(coreMetrics.dynamics.p10_rms);
      
      // Crest Factor Auxiliar
      technicalData.crestFactor = sanitizeValue(coreMetrics.dynamics.crest_factor_db);
      technicalData.peakDb = sanitizeValue(coreMetrics.dynamics.peak_db);
      technicalData.rmsDb = sanitizeValue(coreMetrics.dynamics.rms_db);
      
      // Compatibilidade legacy
      technicalData.crestLegacy = sanitizeValue(coreMetrics.dynamics.crest_legacy);
      
      console.log('🎚️ [JSON_OUTPUT] Dynamics extraído:', {
        ttDR: technicalData.ttDR,
        dynamicRange: technicalData.dynamicRange,
        crestFactor: technicalData.crestFactor
      });
    } else if (coreMetrics.dr !== undefined) {
      // Fallback para compatibilidade com versões antigas
      technicalData.dynamicRange = sanitizeValue(coreMetrics.dr);
      console.log('⚠️ [JSON_OUTPUT] Using legacy DR field:', technicalData.dynamicRange);
    }

    technicalData.runId = `phase-5-4-${Date.now()}`;
    
    // 🎯 VERIFICAÇÃO FINAL: Garantir que métricas críticas estejam presentes
    const criticalMetrics = {
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloffHz: technicalData.spectralRolloffHz,
      spectralFlatness: technicalData.spectralFlatness,
      bandEnergies: technicalData.bandEnergies,
      spectral_balance: technicalData.spectral_balance
    };
    
    const missingMetrics = [];
    if (criticalMetrics.spectralCentroidHz === undefined) missingMetrics.push('spectralCentroidHz');
    if (criticalMetrics.spectralRolloffHz === undefined) missingMetrics.push('spectralRolloffHz');
    if (criticalMetrics.spectralFlatness === undefined) missingMetrics.push('spectralFlatness');
    if (!criticalMetrics.bandEnergies && !criticalMetrics.spectral_balance) missingMetrics.push('bandEnergies/spectral_balance');
    
    if (missingMetrics.length > 0) {
      console.warn('⚠️ [JSON_OUTPUT] Métricas críticas ausentes, mas continuando:', missingMetrics);
      console.warn('⚠️ [JSON_OUTPUT] Estrutura completa do coreMetrics disponível para debug:', {
        topLevelKeys: Object.keys(coreMetrics),
        fftStructure: coreMetrics.fft ? {
          keys: Object.keys(coreMetrics.fft),
          hasAggregated: !!coreMetrics.fft.aggregated,
          hasFrequencyBands: !!coreMetrics.fft.frequencyBands,
          frameCount: coreMetrics.fft.frameCount
        } : null
      });
    } else {
      console.log('✅ [JSON_OUTPUT] Todas as métricas críticas extraídas com sucesso');
    }
    
    // 📊 Log final das métricas extraídas para o technicalData
    console.log('📊 [JSON_OUTPUT] technicalData final contém:', {
      spectralMetricsCount: [
        'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness', 'spectralFlux',
        'spectralCrest', 'spectralSkewness', 'spectralKurtosis', 'zeroCrossingRate'
      ].filter(key => technicalData[key] !== undefined).length,
      hasBandEnergies: !!technicalData.bandEnergies,
      hasSpectralBalance: !!technicalData.spectral_balance,
      hasAliases: !!(technicalData.frequenciaCentral && technicalData.limiteAgudos85),
      totalKeys: Object.keys(technicalData).length
    });
    
    return technicalData;
  } catch (err) {
    console.error("❌ Erro ao extrair technical data:", err);
    return { runId: `phase-5-4-error-${Date.now()}` };
  }
}

/**
 * Constrói JSON final
 */
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata) {
  const finalJSON = {
    score: sanitizeValue(scoringResult.scorePct),
    classification: scoringResult.classification || "Básico",
    scoringMethod: scoringResult.method || "equal_weight_v3",

    metadata: {
      fileName: metadata.fileName || "unknown",
      fileSize: metadata.fileSize || 0,
      sampleRate: technicalData.sampleRate,
      channels: technicalData.channels,
      duration: technicalData.duration,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.0",
      pipelinePhase: "complete"
    },

    technicalData: {
      lufsIntegrated: sanitizeValue(technicalData.lufsIntegrated),
      lufsShortTerm: sanitizeValue(technicalData.lufsShortTerm),
      lufsMomentary: sanitizeValue(technicalData.lufsMomentary),
      lra: sanitizeValue(technicalData.lra),
      truePeakDbtp: sanitizeValue(technicalData.truePeakDbtp),
      truePeakLinear: sanitizeValue(technicalData.truePeakLinear),
      dynamicRange: sanitizeValue(technicalData.dynamicRange),
      // 🎚️ Dynamic Range Metrics Completos
      ttDR: sanitizeValue(technicalData.ttDR),
      crestFactor: sanitizeValue(technicalData.crestFactor),
      p95Rms: sanitizeValue(technicalData.p95Rms),
      p10Rms: sanitizeValue(technicalData.p10Rms),
      peakDb: sanitizeValue(technicalData.peakDb),
      rmsDb: sanitizeValue(technicalData.rmsDb),
      stereoCorrelation: sanitizeValue(technicalData.stereoCorrelation),
      stereoWidth: sanitizeValue(technicalData.stereoWidth),
      balanceLR: sanitizeValue(technicalData.balanceLR),
      spectralCentroid: sanitizeValue(technicalData.spectralCentroid),
      // 🎯 FIXADO: Métricas espectrais completas
      spectralCentroidHz: sanitizeValue(technicalData.spectralCentroidHz),
      spectralRolloffHz: sanitizeValue(technicalData.spectralRolloffHz),
      spectralBandwidthHz: sanitizeValue(technicalData.spectralBandwidthHz),
      spectralSpreadHz: sanitizeValue(technicalData.spectralSpreadHz),
      spectralFlatness: sanitizeValue(technicalData.spectralFlatness),
      spectralCrest: sanitizeValue(technicalData.spectralCrest),
      spectralSkewness: sanitizeValue(technicalData.spectralSkewness),
      spectralKurtosis: sanitizeValue(technicalData.spectralKurtosis),
      zeroCrossingRate: sanitizeValue(technicalData.zeroCrossingRate),
      spectralFlux: sanitizeValue(technicalData.spectralFlux),
      spectral_balance: technicalData.spectral_balance || {},
      frequencyBands: coreMetrics.fft?.frequencyBands?.left || {},
      bandEnergies: technicalData.bandEnergies || {},
      // 🎵 Métricas espectrais adicionais para o modal
      frequenciaCentral: sanitizeValue(technicalData.spectralCentroidHz), // Alias para compatibilidade
      limiteAgudos85: sanitizeValue(technicalData.spectralRolloffHz), // Rolloff 85%
      mudancaEspectral: sanitizeValue(technicalData.spectralFlux), // Mudança espectral
      uniformidade: sanitizeValue(technicalData.spectralFlatness) // Uniformidade linear vs peaks
    },

    // ===== Métricas Espectrais (nível raiz para compatibilidade frontend) =====
    spectralCentroidHz: sanitizeValue(technicalData.spectralCentroidHz),
    spectralRolloffHz: sanitizeValue(technicalData.spectralRolloffHz),
    spectralBandwidthHz: sanitizeValue(technicalData.spectralBandwidthHz),
    spectralSpreadHz: sanitizeValue(technicalData.spectralSpreadHz),
    spectralFlatness: sanitizeValue(technicalData.spectralFlatness),
    spectralCrest: sanitizeValue(technicalData.spectralCrest),
    spectralSkewness: sanitizeValue(technicalData.spectralSkewness),
    spectralKurtosis: sanitizeValue(technicalData.spectralKurtosis),
    zeroCrossingRate: sanitizeValue(technicalData.zeroCrossingRate),
    spectralFlux: sanitizeValue(technicalData.spectralFlux),

    // ===== Bandas Espectrais =====
    spectralBands: {
      detailed: technicalData.bandEnergies || {},
      simplified: technicalData.spectral_balance || {},
      processedFrames: coreMetrics.spectralBands?.aggregated?.processedFrames || 0,
      hasData: (coreMetrics.spectralBands?.aggregated?.processedFrames || 0) > 0
    },

    // ===== Dynamic Range Metrics =====
    dynamics: {
      // TT-DR Principal (True Technical Dynamic Range)
      ttDR: sanitizeValue(technicalData.ttDR),
      p95Rms: sanitizeValue(technicalData.p95Rms),
      p10Rms: sanitizeValue(technicalData.p10Rms),
      
      // Crest Factor Auxiliar
      crestFactor: sanitizeValue(technicalData.crestFactor),
      peakDb: sanitizeValue(technicalData.peakDb),
      rmsDb: sanitizeValue(technicalData.rmsDb),
      
      // Compatibilidade/Legacy
      dynamicRange: sanitizeValue(technicalData.dynamicRange),
      crestLegacy: sanitizeValue(technicalData.crestLegacy),
      
      // Metadados
      algorithm: 'TT-DR + Crest Factor',
      hasData: !!(technicalData.ttDR || technicalData.dynamicRange || technicalData.crestFactor)
    },

    scoringDetails: {
      method: scoringResult.method,
      totalMetrics: scoringResult.equalWeightDetails?.totalMetrics || 0,
      equalWeight: scoringResult.equalWeightDetails?.equalWeight || 0,
      metricBreakdown: scoringResult.equalWeightDetails?.metricScores || []
    },

    rawMetrics: coreMetrics,
    status: "success",
    processingTime: metadata.processingTime || 0,
    warnings: [],
    buildVersion: "5.4.0-equal-weight-v3",
    pipelineVersion: "node-js-backend",
    frontendCompatible: true
  };

  addWarningsIfNeeded(finalJSON);
  return finalJSON;
}

/**
 * Adiciona warnings automáticos
 */
function addWarningsIfNeeded(finalJSON) {
  const w = [];

  if (finalJSON.technicalData.lufsIntegrated < -30) {
    w.push("LUFS muito baixo - possível sinal de baixo volume");
  }
  if (finalJSON.technicalData.truePeakDbtp > -0.1) {
    w.push("True Peak próximo de 0dB - risco de clipping");
  }
  if (finalJSON.technicalData.stereoCorrelation < 0.1) {
    w.push("Correlação estéreo muito baixa - possível problema de fase");
  }
  if (finalJSON.score < 30) {
    w.push("Score baixo - múltiplas métricas fora dos targets");
  }

  finalJSON.warnings = w;
}

/**
 * Sanitização
 */
function sanitizeValue(value) {
  if (!Number.isFinite(value)) return null;
  return parseFloat(Number(value).toFixed(3));
}

/**
 * Validação final
 */
function validateFinalJSON(finalJSON) {
  const required = ["score", "classification", "technicalData", "metadata"];
  for (const f of required) {
    if (!(f in finalJSON)) throw new Error(`Campo obrigatório ausente: ${f}`);
  }
  if (!Number.isFinite(finalJSON.score)) {
    throw new Error("Score inválido");
  }
  JSON.stringify(finalJSON); // test serialização
}

/**
 * JSON de erro
 */
function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  return {
    status: "error",
    error: { message: error.message, type: "phase_5_4_error", timestamp: new Date().toISOString() },
    score: 50,
    classification: "Básico",
    scoringMethod: "error_fallback",
    metadata: {
      fileName: metadata.fileName || "unknown",
      sampleRate: 48000,
      channels: 2,
      duration: 0,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.0-error",
      pipelinePhase: "error"
    },
    technicalData: { lufsIntegrated: null, truePeakDbtp: null, stereoCorrelation: null, frequencyBands: {} },
    rawMetrics: coreMetrics || {},
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    buildVersion: "5.4.0-error-fallback",
    frontendCompatible: false
  };
}

// Export para testes
export { extractTechnicalData };
