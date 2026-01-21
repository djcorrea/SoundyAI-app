// reference-normalizer.js
// 🎯 Normalização ISOLADA para análise de referência
// NÃO inclui lógica de gênero, targets ou suggestions baseadas em padrões

(function() {
  'use strict';

  /**
   * Normalizar dados APENAS para referência
   * @param {Object} analysis - Resultado da análise
   * @returns {Object} Dados normalizados SOMENTE com métricas (sem targets/genre)
   */
  function normalizeReferenceAnalysisData(analysis) {
    if (!analysis) {
      console.error('[REF-NORMALIZE] ❌ Análise inválida');
      return null;
    }

    console.log('[REF-NORMALIZE] 🎯 Normalizando análise de referência');
    console.log('[REF-NORMALIZE] Modo:', analysis.mode);
    console.log('[REF-NORMALIZE] referenceStage:', analysis.referenceStage);

    // Extrair métricas técnicas (podem estar em vários lugares)
    const tech = analysis.technicalData || analysis.tech || {};
    const spectral = analysis.spectralAnalysis || analysis.spectral || {};

    const normalized = {
      // IDs e metadata
      jobId: analysis.jobId || analysis.id,
      mode: 'reference',
      referenceStage: analysis.referenceStage || (analysis.isReferenceBase ? 'base' : 'compare'),
      
      // Metadata básica
      metadata: {
        fileName: analysis.metadata?.fileName || analysis.fileName || 'unknown',
        fileSize: analysis.metadata?.fileSize || analysis.fileSize,
        duration: analysis.metadata?.duration || analysis.duration,
        format: analysis.metadata?.format || analysis.format,
        sampleRate: analysis.metadata?.sampleRate || analysis.sampleRate,
        bitDepth: analysis.metadata?.bitDepth || analysis.bitDepth,
        channels: analysis.metadata?.channels || analysis.channels
      },

      // Métricas técnicas
      technicalData: {
        lufsIntegrated: tech.lufsIntegrated || analysis.lufsIntegrated,
        truePeakDbtp: tech.truePeakDbtp || analysis.truePeakDbtp,
        dynamicRange: tech.dynamicRange || analysis.dynamicRange,
        stereoCorrelation: tech.stereoCorrelation || analysis.stereoCorrelation,
        lra: tech.lra || analysis.lra,
        rmsEnergy: tech.rmsEnergy || analysis.rmsEnergy,
        crestFactor: tech.crestFactor || analysis.crestFactor
      },

      // Análise espectral
      spectralAnalysis: {
        spectralBands: spectral.spectralBands || []
      },

      // ⚠️ CRÍTICO: NÃO incluir:
      // - genre
      // - genreTargets
      // - selectedGenre
      // - targets baseados em gênero
      // Para referência BASE: NÃO incluir suggestions
      // Para referência COMPARE: incluir suggestions SE existirem (são baseadas em comparação)
    };

    // Se for COMPARE, incluir dados de comparação
    if (analysis.referenceStage === 'compare') {
      normalized.referenceJobId = analysis.referenceJobId;
      normalized.referenceComparison = analysis.referenceComparison;
      
      // Suggestions no modo compare são baseadas em COMPARAÇÃO, não em gênero
      if (analysis.suggestions && Array.isArray(analysis.suggestions)) {
        normalized.suggestions = analysis.suggestions;
      }
      
      if (analysis.aiSuggestions && Array.isArray(analysis.aiSuggestions)) {
        normalized.aiSuggestions = analysis.aiSuggestions;
      }
    }

    // Se for BASE, marcar que requer segunda track
    if (analysis.referenceStage === 'base' || analysis.isReferenceBase) {
      normalized.requiresSecondTrack = true;
      normalized.referenceJobId = analysis.jobId;
    }

    console.log('[REF-NORMALIZE] ✅ Normalização completa');
    console.log('[REF-NORMALIZE] Stage:', normalized.referenceStage);
    console.log('[REF-NORMALIZE] LUFS:', normalized.technicalData.lufsIntegrated);
    console.log('[REF-NORMALIZE] DR:', normalized.technicalData.dynamicRange);

    return normalized;
  }

  /**
   * Verificar se análise está contaminada com dados de gênero
   * @param {Object} analysis
   * @returns {Array<string>} Lista de contaminações encontradas
   */
  function detectGenreContamination(analysis) {
    const contaminations = [];

    if (analysis.genre) {
      contaminations.push('genre presente');
    }

    if (analysis.genreTargets) {
      contaminations.push('genreTargets presente');
    }

    if (analysis.selectedGenre) {
      contaminations.push('selectedGenre presente');
    }

    if (analysis.targets && !analysis.referenceJobId) {
      // Targets sem referenceJobId indica targets de gênero
      contaminations.push('targets de gênero presente');
    }

    if (contaminations.length > 0) {
      console.warn('[REF-NORMALIZE] ⚠️ Contaminação de gênero detectada:', contaminations);
    }

    return contaminations;
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXPOR GLOBALMENTE
  // ════════════════════════════════════════════════════════════════════════
  
  window.normalizeReferenceAnalysisData = normalizeReferenceAnalysisData;
  window.detectGenreContamination = detectGenreContamination;

  console.log('[REF-NORMALIZE] ✅ Módulo carregado');

})();
