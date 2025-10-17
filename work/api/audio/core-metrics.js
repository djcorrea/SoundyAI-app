// 🎵 CORE METRICS - Fase 5.3 Pipeline Migration - CORRIGIDO
// FFT, LUFS ITU-R BS.1770-4, True Peak 4x Oversampling, Stereo Analysis
// Migração equivalente das métricas do Web Audio API para Node.js com fail-fast

import { FastFFT } from "../../lib/audio/fft.js";
import { calculateLoudnessMetricsCorrected as calculateLoudnessMetrics } from "../../lib/audio/features/loudness.js";
import { analyzeTruePeaksFFmpeg } from "../../lib/audio/features/truepeak-ffmpeg.js";
import { normalizeAudioToTargetLUFS, validateNormalization } from "../../lib/audio/features/normalization.js";
import { auditMetricsCorrections, auditMetricsValidation } from "../../lib/audio/features/audit-logging.js";
import { SpectralMetricsCalculator, SpectralMetricsAggregator, serializeSpectralMetrics } from "../../lib/audio/features/spectral-metrics.js";
import { calculateDynamicsMetrics } from "../../lib/audio/features/dynamics-corrected.js";
import { calculateSpectralBands, SpectralBandsCalculator, SpectralBandsAggregator } from "../../lib/audio/features/spectral-bands.js";
import { calculateSpectralCentroid, SpectralCentroidCalculator, SpectralCentroidAggregator } from "../../lib/audio/features/spectral-centroid.js";
import { analyzeStereoMetrics, StereoMetricsCalculator, StereoMetricsAggregator } from "../../lib/audio/features/stereo-metrics.js";
import { calculateDominantFrequencies } from "../../lib/audio/features/dominant-frequencies.js";
import { calculateDCOffset } from "../../lib/audio/features/dc-offset.js";
import { calculateSpectralUniformity } from "../../lib/audio/features/spectral-uniformity.js";
import { analyzeProblemsAndSuggestionsV2 } from "../../lib/audio/features/problems-suggestions-v2.js";

// 🌈 GRANULAR V1: Sistema de análise espectral por sub-bandas (feature flag)
import { analyzeGranularSpectralBands } from "../../lib/audio/features/spectral-bands-granular.js";

// Sistema de tratamento de erros padronizado
import { makeErr, logAudio, assertFinite, ensureFiniteArray } from '../../lib/audio/error-handling.js';

/**
 * 🎯 CONFIGURAÇÕES DA FASE 5.3 (AUDITORIA)
 */
const CORE_METRICS_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  FFT_HOP_SIZE: 1024,
  WINDOW_TYPE: "hann",

  // LUFS ITU-R BS.1770-4
  LUFS_BLOCK_DURATION_MS: 400,
  LUFS_SHORT_TERM_DURATION_MS: 3000,
  LUFS_ABSOLUTE_THRESHOLD: -70.0,
  LUFS_RELATIVE_THRESHOLD: -10.0,

  // True Peak
  TRUE_PEAK_OVERSAMPLING: 4,
};

/**
 * 🧮 Instâncias dos processadores de áudio
 */
class CoreMetricsProcessor {
  constructor() {
    this.fftEngine = new FastFFT();
    this.cache = { hannWindow: new Map(), fftResults: new Map() };
    
    // NOVO: Inicializar calculadores corrigidos
    this.spectralCalculator = new SpectralMetricsCalculator(
      CORE_METRICS_CONFIG.SAMPLE_RATE,
      CORE_METRICS_CONFIG.FFT_SIZE
    );
    this.spectralBandsCalculator = new SpectralBandsCalculator(
      CORE_METRICS_CONFIG.SAMPLE_RATE,
      CORE_METRICS_CONFIG.FFT_SIZE
    );
    this.spectralCentroidCalculator = new SpectralCentroidCalculator(
      CORE_METRICS_CONFIG.SAMPLE_RATE,
      CORE_METRICS_CONFIG.FFT_SIZE
    );
    this.stereoMetricsCalculator = new StereoMetricsCalculator();
    
    // SKIP: Analisadores removidos temporariamente para evitar quebras
    // this.dominantFreqAnalyzer = new DominantFrequencyAnalyzer();
    // this.dcOffsetAnalyzer = new DCOffsetAnalyzer();
    // this.spectralUniformityAnalyzer = new SpectralUniformityAnalyzer(CORE_METRICS_CONFIG.SAMPLE_RATE);
    // this.problemsAnalyzer = new ProblemsAndSuggestionsAnalyzer();
    
    logAudio('core_metrics', 'init', { 
      config: CORE_METRICS_CONFIG,
      correctedModules: ['spectral_bands', 'spectral_centroid', 'stereo_metrics', 'dynamics'],
      activeAnalyzers: ['problems_suggestions'],
      skippedAnalyzers: ['dominant_frequencies_class', 'dc_offset', 'spectral_uniformity']
    });
  }

  /**
   * PROCESSAMENTO PRINCIPAL COM FAIL-FAST
   */
  async processMetrics(segmentedAudio, options = {}) {
    const jobId = options.jobId || 'unknown';
    const fileName = options.fileName || 'unknown';
    
    // Flag para desativar sistema de sugestões via ambiente
    const DISABLE_SUGGESTIONS = process.env.DISABLE_SUGGESTIONS === 'true';
    
    logAudio('core_metrics', 'start_processing', { fileName, jobId });
    const startTime = Date.now();

    try {
      // ========= VALIDAÇÃO DE ENTRADA =========
      this.validateInputFrom5_2(segmentedAudio);
      const { leftChannel, rightChannel } = this.ensureOriginalChannels(segmentedAudio);

      // ========= NORMALIZAÇÃO PRÉ-ANÁLISE A -23 LUFS =========
      logAudio('core_metrics', 'normalization_start', { targetLUFS: -23.0 });
      const normalizationResult = await normalizeAudioToTargetLUFS(
        { leftChannel, rightChannel },
        CORE_METRICS_CONFIG.SAMPLE_RATE,
        { jobId, targetLUFS: -23.0 }
      );
      
      // Usar canais normalizados para todas as análises
      const normalizedLeft = normalizationResult.leftChannel;
      const normalizedRight = normalizationResult.rightChannel;
      
      logAudio('core_metrics', 'normalization_completed', { 
        applied: normalizationResult.normalizationApplied,
        originalLUFS: normalizationResult.originalLUFS,
        gainDB: normalizationResult.gainAppliedDB 
      });

      // ========= CÁLCULO DE MÉTRICAS FFT CORRIGIDAS =========
      logAudio('core_metrics', 'fft_start', { frames: segmentedAudio.framesFFT?.count });
      const fftResults = await this.calculateFFTMetrics(segmentedAudio.framesFFT, { jobId });
      assertFinite(fftResults, 'core_metrics');

      // ========= BANDAS ESPECTRAIS CORRIGIDAS (7 BANDAS) =========
      logAudio('core_metrics', 'spectral_bands_start', { 
        hasFramesFFT: !!segmentedAudio.framesFFT,
        frameCount: segmentedAudio.framesFFT?.frames?.length || 0
      });
      const spectralBandsResults = await this.calculateSpectralBandsMetrics(segmentedAudio.framesFFT, { 
        jobId, 
        reference: options.reference // 🆕 GRANULAR V1: Passar referência para feature flag
      });
      
      // ========= SPECTRAL CENTROID CORRIGIDO (Hz) =========
      logAudio('core_metrics', 'spectral_centroid_start', {
        hasFramesFFT: !!segmentedAudio.framesFFT,
        frameCount: segmentedAudio.framesFFT?.frames?.length || 0
      });
      const spectralCentroidResults = await this.calculateSpectralCentroidMetrics(segmentedAudio.framesFFT, { jobId });

      // ========= CÁLCULO LUFS ITU-R BS.1770-4 =========
      logAudio('core_metrics', 'lufs_start', { frames: segmentedAudio.framesRMS?.count });
      const lufsMetrics = await this.calculateLUFSMetrics(normalizedLeft, normalizedRight, { jobId });
      assertFinite(lufsMetrics, 'core_metrics');

      // ========= TRUE PEAK FFmpeg (SEM FALLBACK) =========
      logAudio('core_metrics', 'truepeak_start', { channels: 2, method: 'ffmpeg_ebur128' });
      const truePeakMetrics = await this.calculateTruePeakMetrics(normalizedLeft, normalizedRight, { 
        jobId, 
        tempFilePath: options.tempFilePath 
      });
      assertFinite(truePeakMetrics, 'core_metrics');

      // ========= ANÁLISE ESTÉREO CORRIGIDA =========
      logAudio('core_metrics', 'stereo_start', { length: normalizedLeft.length });
      const stereoMetrics = await this.calculateStereoMetricsCorrect(normalizedLeft, normalizedRight, { jobId });
      assertFinite(stereoMetrics, 'core_metrics');

      // ========= MÉTRICAS DE DINÂMICA CORRIGIDAS =========
      logAudio('core_metrics', 'dynamics_start', { length: normalizedLeft.length });
      const dynamicsMetrics = calculateDynamicsMetrics(
        normalizedLeft, 
        normalizedRight, 
        CORE_METRICS_CONFIG.SAMPLE_RATE,
        lufsMetrics.lra // Usar LRA já calculado
      );
      
      if (dynamicsMetrics.dynamicRange !== null) {
        logAudio('core_metrics', 'dynamics_calculated', {
          dr: dynamicsMetrics.dynamicRange.toFixed(2),
          crest: dynamicsMetrics.crestFactor?.toFixed(2) || 'null',
          lra: dynamicsMetrics.lra?.toFixed(2) || 'null'
        });
      }

      // ========= ANÁLISE AUXILIAR - VERSÃO SIMPLIFICADA SEM CLASSES =========
      // 🚨 IMPORTANTE: Usando apenas funções standalone para evitar erros de classe

      console.log('[PIPELINE] Iniciando análise de métricas auxiliares (standalone functions)');
      
      // DC Offset - FUNÇÃO STANDALONE SIMPLES
      let dcOffsetMetrics = null;
      try {
        dcOffsetMetrics = calculateDCOffset(normalizedLeft, normalizedRight);
        console.log('[SUCCESS] DC Offset calculado via função standalone');
      } catch (error) {
        console.log('[SKIP_METRIC] dcOffset: erro na função standalone -', error.message);
        dcOffsetMetrics = null;
      }
      
      // Dominant Frequencies - FUNÇÃO STANDALONE
      let dominantFreqMetrics = null;
      try {
        if (fftResults.magnitudeSpectrum && fftResults.magnitudeSpectrum.length > 0) {
          const spectrum = fftResults.magnitudeSpectrum[0];
          console.log('[DEBUG_DOMINANT] Espectro recebido:', {
            length: spectrum.length,
            maxValue: Math.max(...spectrum),
            avgValue: spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length,
            first5: spectrum.slice(0, 5),
            nonZeroCount: spectrum.filter(v => v > 0.001).length
          });
          
          dominantFreqMetrics = calculateDominantFrequencies(
            fftResults.magnitudeSpectrum[0], // Usar primeiro frame
            CORE_METRICS_CONFIG.SAMPLE_RATE,
            CORE_METRICS_CONFIG.FFT_SIZE
          );
          console.log('[DEBUG_DOMINANT] Resultado da função:', dominantFreqMetrics);
          console.log('[SUCCESS] Dominant Frequencies calculado via função standalone');
        } else {
          console.log('[DEBUG_DOMINANT] FFT spectrum não disponível:', {
            hasSpectrum: !!fftResults.magnitudeSpectrum,
            spectrumLength: fftResults.magnitudeSpectrum?.length || 0
          });
        }
      } catch (error) {
        console.log('[SKIP_METRIC] dominantFrequencies: erro na função standalone -', error.message);
        dominantFreqMetrics = null;
      }
      
      // Spectral Uniformity - FUNÇÃO STANDALONE
      let spectralUniformityMetrics = null;
      try {
        if (fftResults.magnitudeSpectrum && fftResults.magnitudeSpectrum.length > 0) {
          const representativeSpectrum = fftResults.magnitudeSpectrum[0];
          const binCount = representativeSpectrum.length;
          const frequencyBins = Array.from({length: binCount}, (_, i) => 
            (i * CORE_METRICS_CONFIG.SAMPLE_RATE) / (2 * binCount)
          );
          
          console.log('[DEBUG_UNIFORMITY] Dados de entrada:', {
            spectrumLength: representativeSpectrum.length,
            binsLength: frequencyBins.length,
            sampleRate: CORE_METRICS_CONFIG.SAMPLE_RATE,
            first5Values: representativeSpectrum.slice(0, 5),
            first5Bins: frequencyBins.slice(0, 5)
          });
          
          spectralUniformityMetrics = calculateSpectralUniformity(
            representativeSpectrum,
            frequencyBins,
            CORE_METRICS_CONFIG.SAMPLE_RATE
          );
          
          console.log('[DEBUG_UNIFORMITY] Resultado da função:', spectralUniformityMetrics);
          console.log('[SUCCESS] Spectral Uniformity calculado via função standalone');
        } else {
          console.log('[DEBUG_UNIFORMITY] FFT spectrum não disponível');
        }
      } catch (error) {
        console.log('[SKIP_METRIC] spectralUniformity: erro na função standalone -', error.message);
        spectralUniformityMetrics = null;
      }

      // ========= CÁLCULO DE BPM =========
      let bmpMetrics = { bpm: null, bpmConfidence: null }; // ✅ CORREÇÃO: bmpConfidence → bpmConfidence
      try {
        bmpMetrics = this.calculateBpmMetrics(normalizedLeft, normalizedRight, { jobId });
        console.log('[SUCCESS] BPM calculado via método da classe');
      } catch (error) {
        console.log('[SKIP_METRIC] BPM: erro no método da classe -', error.message);
        bmpMetrics = { bpm: null, bpmConfidence: null, bpmSource: 'ERROR' }; // ✅ CORREÇÃO: incluir bpmSource
      }

      // ========= MONTAGEM DE RESULTADO CORRIGIDO =========
      const coreMetrics = {
        fft: fftResults,
        spectralBands: spectralBandsResults, // ✅ NOVO: 7 bandas profissionais
        spectralCentroid: spectralCentroidResults, // ✅ NOVO: Centro de brilho em Hz
        lufs: {
          ...lufsMetrics,
          // Adicionar dados de normalização aos LUFS
          originalLUFS: normalizationResult.originalLUFS,
          normalizedTo: -23.0,
          gainAppliedDB: normalizationResult.gainAppliedDB
        },
        truePeak: truePeakMetrics,
        stereo: stereoMetrics, // ✅ CORRIGIDO: Correlação (-1 a +1) e Width (0 a 1)
        dynamics: dynamicsMetrics, // ✅ CORRIGIDO: DR, Crest Factor, LRA
        rms: this.processRMSMetrics(segmentedAudio.framesRMS), // ✅ NOVO: Processar métricas RMS
        
        // ========= NOVOS ANALISADORES =========
        dcOffset: dcOffsetMetrics, // ✅ NOVO: DC Offset analysis
        dominantFrequencies: dominantFreqMetrics, // ✅ NOVO: Dominant frequencies
        spectralUniformity: spectralUniformityMetrics, // ✅ NOVO: Spectral uniformity
        bpm: bmpMetrics.bpm, // ✅ NOVO: Beats Per Minute
        bpmConfidence: bmpMetrics.bpmConfidence, // ✅ CORREÇÃO: BPM Confidence (corrigido bmpConfidence → bpmConfidence)
        bpmSource: bmpMetrics.bpmSource, // ✅ NOVO: Fonte do cálculo BPM (NORMAL, FALLBACK_STRICT, etc)
        
        normalization: {
          applied: normalizationResult.normalizationApplied,
          originalLUFS: normalizationResult.originalLUFS,
          targetLUFS: normalizationResult.targetLUFS,
          gainAppliedDB: normalizationResult.gainAppliedDB,
          gainAppliedLinear: normalizationResult.gainAppliedLinear,
          isSilence: normalizationResult.isSilence,
          hasClipping: normalizationResult.hasClipping,
          processingTime: normalizationResult.processingTime
        },
        metadata: {
          processingTime: Date.now() - startTime,
          sampleRate: CORE_METRICS_CONFIG.SAMPLE_RATE,
          fftSize: CORE_METRICS_CONFIG.FFT_SIZE,
          stage: 'core_metrics_completed',
          normalizationEnabled: true,
          jobId
        }
      };

      // ========= ANÁLISE DE PROBLEMAS E SUGESTÕES V2 =========
      // Sistema educativo com criticidade por cores
      let problemsAnalysis = {
        genre: 'default',
        suggestions: [],
        problems: [],
        summary: {
          overallRating: 'Análise não disponível',
          readyForRelease: false,
          criticalIssues: 0,
          warningIssues: 0,
          okMetrics: 0,
          totalAnalyzed: 0,
          score: 0
        },
        metadata: {
          totalSuggestions: 0,
          criticalCount: 0,
          warningCount: 0,
          okCount: 0,
          analysisDate: new Date().toISOString(),
          version: '2.0.0'
        }
      };
      
      if (!DISABLE_SUGGESTIONS) {
        try {
          // Detectar gênero a partir das opções ou usar default
          const detectedGenre = options.genre || options.reference?.genre || 'default';
          
          console.log("[SUGGESTIONS] Ativas (V2 rodando normalmente).");
          problemsAnalysis = analyzeProblemsAndSuggestionsV2(coreMetrics, detectedGenre);
          logAudio('core_metrics', 'problems_analysis_success', { 
            genre: detectedGenre,
            totalSuggestions: problemsAnalysis.suggestions.length,
            criticalCount: problemsAnalysis.metadata.criticalCount,
            warningCount: problemsAnalysis.metadata.warningCount
          });
        } catch (error) {
          logAudio('core_metrics', 'problems_analysis_error', { error: error.message });
          // Manter estrutura padrão definida acima
        }
      } else {
        console.log("[SUGGESTIONS] Desativadas via flag de ambiente.");
        problemsAnalysis = null; // garante consistência no JSON
      }
      
      // Adicionar análise de problemas aos resultados com estrutura V2
      coreMetrics.problems = problemsAnalysis?.problems || [];
      coreMetrics.suggestions = problemsAnalysis?.suggestions || [];
      coreMetrics.qualityAssessment = problemsAnalysis?.summary || problemsAnalysis?.quality || {};
      coreMetrics.priorityRecommendations = problemsAnalysis?.priorityRecommendations || [];
      coreMetrics.suggestionMetadata = problemsAnalysis?.metadata || {};

      // ========= VALIDAÇÃO FINAL =========
      try {
        assertFinite(coreMetrics, 'core_metrics');
      } catch (validationError) {
        throw makeErr('core_metrics', `Final validation failed: ${validationError.message}`, 'validation_error');
      }

      // ========= AUDITORIA DE CORREÇÕES =========
      auditMetricsCorrections(coreMetrics, { leftChannel, rightChannel }, normalizationResult);
      
      // ========= VALIDAÇÃO DE MÉTRICAS =========
      const validationResult = auditMetricsValidation(coreMetrics);
      if (!validationResult.allValid) {
        logAudio('core_metrics', 'validation_warnings', { 
          invalidMetrics: validationResult.validations.filter(v => !v.valid).length 
        });
      }

      const totalTime = Date.now() - startTime;
      logAudio('core_metrics', 'completed', { 
        ms: totalTime, 
        lufs: lufsMetrics.integrated,
        peak: truePeakMetrics.maxDbtp,
        correlation: stereoMetrics.correlation
      });

      return coreMetrics;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      // Log estruturado do erro
      logAudio('core_metrics', 'error', {
        code: error.code || 'unknown',
        message: error.message,
        ms: totalTime,
        stage: 'core_metrics'
      });

      // Se já é um erro estruturado, re-propagar
      if (error.stage === 'core_metrics') {
        throw error;
      }

      // Estruturar erro genérico
      throw makeErr('core_metrics', `Core metrics failed: ${error.message}`, 'core_metrics_error');
    }
  }

  /**
   * Validação rigorosa da entrada da Fase 5.2
   */
  validateInputFrom5_2(segmentedAudio) {
    const requiredFields = ['framesFFT', 'framesRMS', 'originalChannels', 'timestamps'];

    for (const field of requiredFields) {
      if (!segmentedAudio[field]) {
        throw makeErr('core_metrics', `Invalid input from Phase 5.2: Missing ${field}`, 'invalid_input_5_2');
      }
    }

    // Validar estrutura FFT
    if (!segmentedAudio.framesFFT.left || !segmentedAudio.framesFFT.right) {
      throw makeErr('core_metrics', 'Invalid FFT frames: missing left/right channels', 'invalid_fft_frames');
    }

    // Validar estrutura RMS
    if (!segmentedAudio.framesRMS.left || !segmentedAudio.framesRMS.right) {
      throw makeErr('core_metrics', 'Invalid RMS frames: missing left/right channels', 'invalid_rms_frames');
    }

    // Validar count consistency
    if (segmentedAudio.framesFFT.count !== segmentedAudio.framesFFT.left.length) {
      throw makeErr('core_metrics', 'FFT count mismatch with actual frames', 'fft_count_mismatch');
    }

    if (segmentedAudio.framesRMS.count !== segmentedAudio.framesRMS.left.length) {
      throw makeErr('core_metrics', 'RMS count mismatch with actual frames', 'rms_count_mismatch');
    }
  }

  /**
   * Extrai canais originais com validação
   */
  ensureOriginalChannels(segmentedAudio) {
    if (!segmentedAudio.originalChannels) {
      throw makeErr('core_metrics', 'Missing originalChannels from Phase 5.2', 'missing_original_channels');
    }

    const { left: leftChannel, right: rightChannel } = segmentedAudio.originalChannels;

    if (!leftChannel || !rightChannel) {
      throw makeErr('core_metrics', 'Invalid channels: missing left or right channel', 'invalid_channels');
    }

    if (leftChannel.length === 0 || rightChannel.length === 0) {
      throw makeErr('core_metrics', 'Empty audio channels detected', 'empty_channels');
    }

    // Validar que são Float32Array
    try {
      ensureFiniteArray(leftChannel, 'core_metrics');
      ensureFiniteArray(rightChannel, 'core_metrics');
    } catch (error) {
      throw makeErr('core_metrics', `Channel validation failed: ${error.message}`, 'channel_validation_error');
    }

    return { leftChannel, rightChannel };
  }

  /**
   * Cálculo de métricas FFT com validação rigorosa
   */
  async calculateFFTMetrics(framesFFT, options = {}) {
    const jobId = options.jobId || 'unknown';
    
    try {
      const { left: leftFrames, right: rightFrames, count } = framesFFT;
      
      if (count === 0) {
        throw makeErr('core_metrics', 'No FFT frames to process', 'no_fft_frames');
      }

      // 🔥 CORREÇÃO: Limpar cache FFT para evitar estado corrompido
      this.fftEngine.cache.clear();

      logAudio('core_metrics', 'fft_processing', { count, jobId: jobId.substring(0,8) });

      const fftResults = {
        left: [],
        right: [],
        magnitudeSpectrum: [],
        phaseSpectrum: [],
        
        // NOVO: Arrays para 8 métricas espectrais completas
        spectralCentroidHz: [],
        spectralRolloffHz: [],
        spectralBandwidthHz: [],
        spectralSpreadHz: [],
        spectralFlatness: [],
        spectralCrest: [],
        spectralSkewness: [],
        spectralKurtosis: [],
        
        // LEGACY: manter compatibilidade
        spectralCentroid: [],
        spectralRolloff: []
      };

      const maxFrames = Math.min(count, 1000); // Limitar frames para evitar timeout
      const startTime = Date.now();

      for (let i = 0; i < maxFrames; i++) {
        // Timeout protection
        const elapsed = Date.now() - startTime;
        if (elapsed > 30000) { // 30s timeout
          logAudio('core_metrics', 'fft_timeout', { 
            processed: i, 
            total: maxFrames, 
            elapsed 
          });
          break;
        }

        try {
          // 🔍 DEBUG: Verificar frame de entrada (agora são objetos FFT já calculados)
          const leftFrame = leftFrames[i];
          const rightFrame = rightFrames[i];
          
          // ⚡ CORREÇÃO CRÍTICA: Frames agora são objetos {magnitude, phase, real, imag}
          if (!leftFrame || !leftFrame.magnitude || leftFrame.magnitude.length === 0) {
            throw makeErr('core_metrics', `Empty or invalid left FFT frame at index ${i}`, 'empty_left_frame');
          }
          if (!rightFrame || !rightFrame.magnitude || rightFrame.magnitude.length === 0) {
            throw makeErr('core_metrics', `Empty or invalid right FFT frame at index ${i}`, 'empty_right_frame');
          }

          // ⚡ USAR FFT JÁ CALCULADO - sem refazer cálculo
          const leftFFT = leftFrame;  // Já é {magnitude, phase, real, imag}
          const rightFFT = rightFrame;  // Já é {magnitude, phase, real, imag}
          
          // 🔍 DEBUG: Verificar resultado FFT esquerdo
          if (!leftFFT || !leftFFT.magnitude || leftFFT.magnitude.length === 0) {
            throw makeErr('core_metrics', `FFT left result invalid at frame ${i}`, 'invalid_fft_left');
          }
          
          ensureFiniteArray(leftFFT.magnitude, 'core_metrics', `left_magnitude_frame_${i}`);
          fftResults.left.push(leftFFT);

          // 🔍 DEBUG: Verificar resultado FFT direito
          if (!rightFFT || !rightFFT.magnitude || rightFFT.magnitude.length === 0) {
            throw makeErr('core_metrics', `FFT right result invalid at frame ${i}`, 'invalid_fft_right');
          }
          
          ensureFiniteArray(rightFFT.magnitude, 'core_metrics', `right_magnitude_frame_${i}`);
          fftResults.right.push(rightFFT);

          // Magnitude spectrum (combinado)
          const magnitude = this.calculateMagnitudeSpectrum(leftFFT, rightFFT);
          ensureFiniteArray(magnitude, 'core_metrics');
          fftResults.magnitudeSpectrum.push(magnitude);

          // NOVO: Métricas espectrais completas (8 métricas)
          const spectralMetrics = this.calculateSpectralMetrics(magnitude, i);

          // Adicionar todas as métricas aos arrays de resultados
          fftResults.spectralCentroidHz.push(spectralMetrics.spectralCentroidHz);
          fftResults.spectralRolloffHz.push(spectralMetrics.spectralRolloffHz);
          fftResults.spectralBandwidthHz.push(spectralMetrics.spectralBandwidthHz);
          fftResults.spectralSpreadHz.push(spectralMetrics.spectralSpreadHz);
          fftResults.spectralFlatness.push(spectralMetrics.spectralFlatness);
          fftResults.spectralCrest.push(spectralMetrics.spectralCrest);
          fftResults.spectralSkewness.push(spectralMetrics.spectralSkewness);
          fftResults.spectralKurtosis.push(spectralMetrics.spectralKurtosis);

          // LEGACY: manter compatibilidade com nomes antigos
          fftResults.spectralCentroid.push(spectralMetrics.spectralCentroidHz);
          fftResults.spectralRolloff.push(spectralMetrics.spectralRolloffHz);

        } catch (fftError) {
          logAudio('core_metrics', 'fft_frame_error', { 
            frame: i, 
            error: fftError.message 
          });
          
          // Fail-fast: não continuar com FFT corrompido
          throw makeErr('core_metrics', `FFT processing failed at frame ${i}: ${fftError.message}`, 'fft_processing_error');
        }
      }

      fftResults.processedFrames = fftResults.left.length;
      
      // ========= NOVA AGREGAÇÃO ESPECTRAL COMPLETA =========
      
      // Preparar array de métricas para agregação
      const metricsArray = [];
      for (let i = 0; i < fftResults.spectralCentroidHz.length; i++) {
        metricsArray.push({
          spectralCentroidHz: fftResults.spectralCentroidHz[i],
          spectralRolloffHz: fftResults.spectralRolloffHz[i],
          spectralBandwidthHz: fftResults.spectralBandwidthHz[i],
          spectralSpreadHz: fftResults.spectralSpreadHz[i],
          spectralFlatness: fftResults.spectralFlatness[i],
          spectralCrest: fftResults.spectralCrest[i],
          spectralSkewness: fftResults.spectralSkewness[i],
          spectralKurtosis: fftResults.spectralKurtosis[i]
        });
      }
      
      // Usar o novo agregador
      const aggregatedSpectral = SpectralMetricsAggregator.aggregate(metricsArray);
      
      // Serializar para o formato final
      const finalSpectral = serializeSpectralMetrics(aggregatedSpectral);
      
      // Criar estrutura aggregated para compatibilidade com json-output.js
      fftResults.aggregated = {
        ...finalSpectral,
        // LEGACY: manter compatibilidade com nomes antigos
        spectralCentroid: finalSpectral.spectralCentroidHz,
        spectralRolloff: finalSpectral.spectralRolloffHz
      };
      
      // Também adicionar no nível raiz para compatibilidade
      Object.assign(fftResults, finalSpectral);
      
      // LEGACY: manter compatibilidade com nomes antigos no nível raiz
      fftResults.spectralCentroid = finalSpectral.spectralCentroidHz;
      fftResults.spectralRolloff = finalSpectral.spectralRolloffHz;
      
      // Log da agregação
      logAudio('core_metrics', 'spectral_aggregated', {
        frames: metricsArray.length,
        centroidHz: finalSpectral.spectralCentroidHz?.toFixed?.(1) || 'null',
        rolloffHz: finalSpectral.spectralRolloffHz?.toFixed?.(1) || 'null',
        bandwidthHz: finalSpectral.spectralBandwidthHz?.toFixed?.(1) || 'null',
        flatness: finalSpectral.spectralFlatness?.toFixed?.(3) || 'null'
      });
      
      // 🔥 DEBUG CRITICAL: Log completo das métricas espectrais agregadas
      console.log("[AUDIT] Spectral aggregated result:", {
        spectralCentroidHz: finalSpectral.spectralCentroidHz,
        spectralRolloffHz: finalSpectral.spectralRolloffHz,
        spectralBandwidthHz: finalSpectral.spectralBandwidthHz,
        spectralFlatness: finalSpectral.spectralFlatness,
        spectralCrest: finalSpectral.spectralCrest,
        spectralSkewness: finalSpectral.spectralSkewness,
        spectralKurtosis: finalSpectral.spectralKurtosis,
        framesProcessed: metricsArray.length
      });
      
      // 🔥 DEBUG CRITICAL: Log da estrutura aggregated criada
      console.log("[AUDIT] FFT aggregated structure created:", {
        hasAggregated: !!fftResults.aggregated,
        aggregatedKeys: Object.keys(fftResults.aggregated || {}),
        spectralCentroidHz: fftResults.aggregated?.spectralCentroidHz,
        spectralRolloffHz: fftResults.aggregated?.spectralRolloffHz
      });
      
      // Verificação final
      if (fftResults.processedFrames === 0) {
        throw makeErr('core_metrics', 'No FFT frames were successfully processed', 'no_fft_processed');
      }

      logAudio('core_metrics', 'fft_completed', { 
        processed: fftResults.processedFrames, 
        requested: count 
      });

      return fftResults;

    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error;
      }
      throw makeErr('core_metrics', `FFT metrics calculation failed: ${error.message}`, 'fft_calculation_error');
    }
  }

  /**
   * Cálculo de métricas LUFS ITU-R BS.1770-4
   */
  async calculateLUFSMetrics(leftChannel, rightChannel, options = {}) {
    const jobId = options.jobId || 'unknown';
    
    try {
      logAudio('core_metrics', 'lufs_calculation', { 
        samples: leftChannel.length, 
        jobId: jobId.substring(0,8) 
      });

      const lufsMetrics = await calculateLoudnessMetrics(
        leftChannel, 
        rightChannel, 
        CORE_METRICS_CONFIG.SAMPLE_RATE // Usar a sample rate da config
      );

      // Mapear campos da saída para estrutura esperada
      const mappedMetrics = {
        integrated: lufsMetrics.lufs_integrated,
        shortTerm: lufsMetrics.lufs_short_term,
        momentary: lufsMetrics.lufs_momentary,
        lra: lufsMetrics.lra,
        // Manter campos originais para compatibilidade
        ...lufsMetrics
      };

      // Validar métricas LUFS mapeadas
      const requiredFields = ['integrated', 'shortTerm', 'momentary', 'lra'];
      for (const field of requiredFields) {
        if (!isFinite(mappedMetrics[field])) {
          throw makeErr('core_metrics', `Invalid LUFS ${field}: ${mappedMetrics[field]}`, 'invalid_lufs_metric');
        }
      }

      // Verificar ranges realistas para LUFS
      if (mappedMetrics.integrated < -80 || mappedMetrics.integrated > 20) {
        throw makeErr('core_metrics', `LUFS integrated out of realistic range: ${mappedMetrics.integrated}`, 'lufs_range_error');
      }

      return mappedMetrics;

    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error;
      }
      throw makeErr('core_metrics', `LUFS calculation failed: ${error.message}`, 'lufs_calculation_error');
    }
  }

  /**
   * Cálculo True Peak com FFmpeg (sem fallback)
   */
  async calculateTruePeakMetrics(leftChannel, rightChannel, options = {}) {
    const jobId = options.jobId || 'unknown';
    const tempFilePath = options.tempFilePath;
    
    try {
      logAudio('core_metrics', 'truepeak_calculation', { 
        samples: leftChannel.length, 
        method: 'ffmpeg_ebur128',
        hasTempFile: !!tempFilePath,
        jobId: jobId.substring(0,8) 
      });

      if (!tempFilePath) {
        throw makeErr('core_metrics', 'tempFilePath é obrigatório para cálculo FFmpeg True Peak', 'missing_temp_file');
      }

      const truePeakMetrics = await analyzeTruePeaksFFmpeg(
        leftChannel, 
        rightChannel, 
        CORE_METRICS_CONFIG.SAMPLE_RATE,
        tempFilePath
      );

      // Validar True Peak - apenas se não for null
      if (truePeakMetrics.true_peak_dbtp !== null) {
        if (!isFinite(truePeakMetrics.true_peak_dbtp)) {
          throw makeErr('core_metrics', `Invalid true peak value: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'invalid_truepeak');
        }

        // Verificar range realista (True Peak não deve exceder limites extremos)
        if (truePeakMetrics.true_peak_dbtp > 50 || truePeakMetrics.true_peak_dbtp < -200) {
          throw makeErr('core_metrics', `True peak out of realistic range: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'truepeak_range_error');
        }

        // Log warning se exceder -1 dBTP
        if (truePeakMetrics.true_peak_dbtp > -1.0) {
          logAudio('core_metrics', 'truepeak_warning', { 
            value: truePeakMetrics.true_peak_dbtp, 
            message: 'True Peak > -1 dBTP detectado - possível clipping',
            jobId: jobId.substring(0,8) 
          });
        }
      } else {
        logAudio('core_metrics', 'truepeak_null', { 
          message: 'FFmpeg não conseguiu calcular True Peak',
          error: truePeakMetrics.error,
          jobId: jobId.substring(0,8) 
        });
      }

      // Padronizar estrutura do True Peak para compatibilidade
      const standardizedTruePeak = {
        maxDbtp: truePeakMetrics.true_peak_dbtp,
        maxLinear: truePeakMetrics.true_peak_linear,
        // Manter campos originais para completude
        ...truePeakMetrics
      };

      return standardizedTruePeak;

    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error;
      }
      throw makeErr('core_metrics', `True peak calculation failed: ${error.message}`, 'truepeak_calculation_error');
    }
  }

  /**
   * Cálculo de métricas estéreo
   */
  async calculateStereoMetrics(leftChannel, rightChannel, options = {}) {
    const jobId = options.jobId || 'unknown';
    
    try {
      logAudio('core_metrics', 'stereo_calculation', { 
        samples: leftChannel.length, 
        jobId: jobId.substring(0,8) 
      });

      // Correlação estéreo
      const correlation = this.calculateStereoCorrelation(leftChannel, rightChannel);
      
      // Balance L/R
      const balance = this.calculateStereoBalance(leftChannel, rightChannel);
      
      // Width estéreo
      const width = this.calculateStereoWidth(leftChannel, rightChannel);

      const stereoMetrics = {
        correlation,
        balance,
        width,
        isMonoCompatible: Math.abs(correlation) > 0.7,
        hasPhaseIssues: correlation < -0.5
      };

      // Validar métricas estéreo
      if (!isFinite(correlation) || !isFinite(balance) || !isFinite(width)) {
        throw makeErr('core_metrics', `Invalid stereo metrics: corr=${correlation}, bal=${balance}, width=${width}`, 'invalid_stereo_metrics');
      }

      return stereoMetrics;

    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error;
      }
      throw makeErr('core_metrics', `Stereo calculation failed: ${error.message}`, 'stereo_calculation_error');
    }
  }

  // ========= MÉTODOS PARA MÉTRICAS CORRIGIDAS =========

  /**
   * 🌈 Calcular bandas espectrais corrigidas (7 bandas profissionais)
   * 🆕 GRANULAR V1: Suporte a feature flag ANALYZER_ENGINE
   */
  async calculateSpectralBandsMetrics(framesFFT, options = {}) {
    const { jobId, reference } = options;
    
    // 🚀 FEATURE FLAG: Roteador condicional legacy vs granular_v1
    const engine = process.env.ANALYZER_ENGINE || 'legacy';
    
    if (engine === 'granular_v1' && reference) {
      logAudio('spectral_bands', 'routing_to_granular_v1', { jobId, referenceGenre: reference.genre });
      return await this.calculateGranularSubBands(framesFFT, reference, { jobId });
    }
    
    // ✅ LEGACY: Comportamento original (inalterado)
    logAudio('spectral_bands', 'routing_to_legacy', { jobId, engine });
    return await this.calculateSpectralBandsLegacy(framesFFT, { jobId });
  }
  
  /**
   * 🌈 GRANULAR V1: Análise espectral por sub-bandas
   */
  async calculateGranularSubBands(framesFFT, reference, options = {}) {
    const { jobId } = options;
    
    try {
      logAudio('granular_bands', 'start', { jobId, referenceGenre: reference.genre || 'unknown' });
      
      const granularResult = await analyzeGranularSpectralBands(framesFFT, reference);
      
      logAudio('granular_bands', 'completed', {
        jobId,
        subBandsCount: granularResult.granular?.length || 0,
        suggestionsCount: granularResult.suggestions?.length || 0,
        algorithm: granularResult.algorithm
      });
      
      return granularResult;
      
    } catch (error) {
      console.error('💥 [GRANULAR_BANDS] ERRO:', { error: error.message, stack: error.stack, jobId });
      logAudio('granular_bands', 'error', { error: error.message, jobId });
      
      // Fallback para legacy em caso de erro
      console.warn('⚠️ [GRANULAR_BANDS] Fallback para legacy devido a erro');
      return await this.calculateSpectralBandsLegacy(framesFFT, { jobId });
    }
  }
  
  /**
   * 🌈 LEGACY: Calcular bandas espectrais (7 bandas profissionais) - PRESERVADO
   */
  async calculateSpectralBandsLegacy(framesFFT, options = {}) {
    const { jobId } = options;
    
    try {
      // 🎯 DEBUG CRÍTICO: Rastrear por que bandas não são calculadas
      console.log('🔍 [SPECTRAL_BANDS_CRITICAL] Início do cálculo:', {
        hasFramesFFT: !!framesFFT,
        hasFrames: !!(framesFFT && framesFFT.frames),
        frameCount: framesFFT?.frames?.length || 0,
        framesFFTKeys: framesFFT ? Object.keys(framesFFT) : null,
        jobId 
      });

      if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
        console.error('❌ [SPECTRAL_BANDS_CRITICAL] SEM FRAMES FFT:', { 
          reason: !framesFFT ? 'no_framesFFT' : !framesFFT.frames ? 'no_frames_array' : 'empty_frames_array',
          jobId 
        });
        return this.spectralBandsCalculator.getNullBands();
      }

      // 🔍 Debug: verificar estrutura dos frames em detalhes
      const firstFrame = framesFFT.frames[0];
      console.log('🔍 [SPECTRAL_BANDS_CRITICAL] Estrutura dos frames:', { 
        frameCount: framesFFT.frames.length,
        firstFrameKeys: Object.keys(firstFrame),
        hasLeftFFT: !!firstFrame.leftFFT,
        hasRightFFT: !!firstFrame.rightFFT,
        leftFFTKeys: firstFrame.leftFFT ? Object.keys(firstFrame.leftFFT) : null,
        hasMagnitude: !!firstFrame.leftFFT?.magnitude,
        magnitudeLength: firstFrame.leftFFT?.magnitude?.length || 0,
        magnitudeSample: firstFrame.leftFFT?.magnitude?.slice(0, 5) || null // Primeira amostra
      });

      const bandsResults = [];
      let validFrames = 0;
      let invalidFrames = 0;
      
      for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
        const frame = framesFFT.frames[frameIndex];
        
        // 🔍 Debug mais detalhado dos frames críticos
        if (frameIndex < 5) { // Log dos primeiros 5 frames
          console.log(`🔍 [SPECTRAL_BANDS_CRITICAL] Frame ${frameIndex}:`, {
            frameKeys: Object.keys(frame),
            hasLeftFFT: !!frame.leftFFT,
            hasRightFFT: !!frame.rightFFT,
            leftFFTKeys: frame.leftFFT ? Object.keys(frame.leftFFT) : null,
            leftMagnitudeLength: frame.leftFFT?.magnitude?.length || 0,
            rightMagnitudeLength: frame.rightFFT?.magnitude?.length || 0,
            leftMagnitudeSample: frame.leftFFT?.magnitude?.slice(0, 3) || null,
            leftMagnitudeMax: frame.leftFFT?.magnitude ? Math.max(...frame.leftFFT.magnitude) : null,
            jobId
          });
        }
        
        // 🎯 CORREÇÃO CRÍTICA: Acessar magnitude corretamente
        // A estrutura é: frame.leftFFT.magnitude e frame.rightFFT.magnitude
        if (frame.leftFFT?.magnitude && frame.rightFFT?.magnitude) {
          console.log(`✅ [SPECTRAL_BANDS_CRITICAL] Frame ${frameIndex} VÁLIDO - Analisando bandas...`);
          
          const result = this.spectralBandsCalculator.analyzeBands(
            frame.leftFFT.magnitude,
            frame.rightFFT.magnitude,
            frameIndex
          );
          
          console.log(`🎯 [SPECTRAL_BANDS_CRITICAL] Frame ${frameIndex} resultado:`, {
            valid: result.valid,
            totalPercentage: result.totalPercentage,
            bandsKeys: result.bands ? Object.keys(result.bands) : null,
            sampleBand: result.bands?.sub || null
          });
          
          if (result.valid) {
            bandsResults.push(result);
            validFrames++;
          } else {
            console.warn(`⚠️ [SPECTRAL_BANDS_CRITICAL] Frame ${frameIndex} inválido:`, result);
            invalidFrames++;
          }
        } else {
          console.error(`❌ [SPECTRAL_BANDS_CRITICAL] Frame ${frameIndex} SEM DADOS FFT:`, {
            hasLeftFFT: !!frame.leftFFT,
            hasRightFFT: !!frame.rightFFT,
            leftMagnitude: !!frame.leftFFT?.magnitude,
            rightMagnitude: !!frame.rightFFT?.magnitude,
            actualStructure: {
              frameKeys: Object.keys(frame),
              leftFFTType: typeof frame.leftFFT,
              rightFFTType: typeof frame.rightFFT
            },
            jobId
          });
          invalidFrames++;
        }
      }

      console.log('🎯 [SPECTRAL_BANDS_CRITICAL] Agregando resultados:', {
        bandsResultsCount: bandsResults.length,
        validFrames,
        invalidFrames,
        totalFrames: framesFFT.frames.length
      });

      // Agregar resultados
      const aggregatedBands = SpectralBandsAggregator.aggregate(bandsResults);
      
      console.log('🎯 [SPECTRAL_BANDS_CRITICAL] Resultado final da agregação:', {
        aggregatedBands,
        valid: aggregatedBands?.valid,
        totalPercentage: aggregatedBands?.totalPercentage,
        bandsKeys: aggregatedBands?.bands ? Object.keys(aggregatedBands.bands) : null
      });

      logAudio('spectral_bands', 'completed', {
        validFrames,
        invalidFrames,
        totalFrames: framesFFT.frames.length,
        bandsResultsCount: bandsResults.length,
        totalPercentage: aggregatedBands?.totalPercentage || null,
        jobId
      });

      return aggregatedBands;

    } catch (error) {
      console.error('💥 [SPECTRAL_BANDS_CRITICAL] ERRO CRÍTICO:', { error: error.message, stack: error.stack, jobId });
      logAudio('spectral_bands', 'error', { error: error.message, jobId });
      return this.spectralBandsCalculator.getNullBands();
    }
  }

  /**
   * 🎵 Calcular spectral centroid corrigido (Hz)
   */
  async calculateSpectralCentroidMetrics(framesFFT, options = {}) {
    const { jobId } = options;
    
    try {
      // Debug detalhado da estrutura recebida
      logAudio('spectral_centroid', 'input_debug', { 
        hasFramesFFT: !!framesFFT,
        hasFrames: !!(framesFFT && framesFFT.frames),
        frameCount: framesFFT?.frames?.length || 0,
        jobId 
      });

      if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
        logAudio('spectral_centroid', 'no_frames', { 
          reason: !framesFFT ? 'no_framesFFT' : !framesFFT.frames ? 'no_frames_array' : 'empty_frames_array',
          jobId 
        });
        return null;
      }

      const centroidResults = [];
      let validFrames = 0;
      let invalidFrames = 0;
      
      for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
        const frame = framesFFT.frames[frameIndex];
        
        if (frame.leftFFT?.magnitude && frame.rightFFT?.magnitude) {
          const result = this.spectralCentroidCalculator.calculateCentroidHz(
            frame.leftFFT.magnitude,
            frame.rightFFT.magnitude,
            frameIndex
          );
          
          if (result && result.valid) {
            centroidResults.push(result);
            validFrames++;
          } else {
            invalidFrames++;
          }
        } else {
          invalidFrames++;
          if (frameIndex < 3) { // Log detalhado dos primeiros frames inválidos
            logAudio('spectral_centroid', 'invalid_frame', {
              frameIndex,
              hasLeftFFT: !!frame.leftFFT,
              hasRightFFT: !!frame.rightFFT,
              leftMagnitude: !!frame.leftFFT?.magnitude,
              rightMagnitude: !!frame.rightFFT?.magnitude,
              jobId
            });
          }
        }
      }

      // Agregar resultados
      const aggregatedCentroid = SpectralCentroidAggregator.aggregate(centroidResults);
      
      logAudio('spectral_centroid', 'completed', {
        validFrames,
        invalidFrames,
        totalFrames: framesFFT.frames.length,
        centroidResultsCount: centroidResults.length,
        centroidHz: aggregatedCentroid?.centroidHz || null,
        jobId
      });

      return aggregatedCentroid;

    } catch (error) {
      logAudio('spectral_centroid', 'error', { error: error.message, jobId });
      return null;
    }
  }

  /**
   * 🎭 Análise estéreo corrigida
   */
  async calculateStereoMetricsCorrect(leftChannel, rightChannel, options = {}) {
    const { jobId } = options;
    
    try {
      // Usar novo calculador de métricas estéreo
      const result = this.stereoMetricsCalculator.analyzeStereoMetrics(leftChannel, rightChannel);
      
      if (!result.valid) {
        logAudio('stereo_metrics', 'invalid_result', { jobId });
        return {
          correlation: null,
          width: null,
          balance: 0.0, // Compatibilidade com código existente
          valid: false
        };
      }
      
      logAudio('stereo_metrics', 'completed', {
        correlation: result.correlation,
        width: result.width,
        jobId
      });
      
      return {
        correlation: result.correlation,
        width: result.width,
        balance: 0.0, // Compatibilidade - balance não é usado nas novas métricas
        correlationCategory: result.correlationData?.category,
        widthCategory: result.widthData?.category,
        algorithm: 'Corrected_Stereo_Metrics',
        valid: true
      };

    } catch (error) {
      logAudio('stereo_metrics', 'error', { error: error.message, jobId });
      return {
        correlation: null,
        width: null,
        balance: 0.0,
        valid: false
      };
    }
  }

  // ========= MÉTODOS AUXILIARES (sem mudanças na lógica) =========
  
  calculateMagnitudeSpectrum(leftFFT, rightFFT) {
    // leftFFT e rightFFT são objetos com propriedades {real, imag, magnitude, phase}
    const leftMagnitude = leftFFT.magnitude;
    const rightMagnitude = rightFFT.magnitude;
    
    // CORREÇÃO: Combinar magnitudes L/R usando RMS (não média aritmética)
    const magnitude = new Float32Array(leftMagnitude.length);
    for (let i = 0; i < magnitude.length; i++) {
      // RMS da magnitude stereo: sqrt((L² + R²) / 2)
      magnitude[i] = Math.sqrt((leftMagnitude[i] ** 2 + rightMagnitude[i] ** 2) / 2);
    }
    return magnitude;
  }

  // ========= MÉTRICA ESPECTRAL COMPLETA =========
  // NOVO: Sistema com 8 métricas espectrais com fórmulas matemáticas padrão
  
  calculateSpectralMetrics(magnitude, frameIndex = 0) {
    try {
      return this.spectralCalculator.calculateAllMetrics(magnitude, frameIndex);
      
    } catch (error) {
      logAudio('spectral', 'calculator_error', { 
        frame: frameIndex, 
        error: error.message 
      });
      
      // Fallback para null metrics
      return this.spectralCalculator.getNullMetrics();
    }
  }

  // ========= MÉTODOS LEGADOS DEPRECIADOS (compatibilidade) =========
  
  calculateSpectralCentroid(magnitude) {
    const metrics = this.calculateSpectralMetrics(magnitude);
    return metrics.spectralCentroidHz;
  }

  calculateSpectralRolloff(magnitude, threshold = 0.85) {
    const metrics = this.calculateSpectralMetrics(magnitude);
    return metrics.spectralRolloffHz;
  }

  calculateSpectralFlatness(magnitude) {
    const metrics = this.calculateSpectralMetrics(magnitude);
    return metrics.spectralFlatness;
  }

  calculateStereoCorrelation(leftChannel, rightChannel) {
    const length = Math.min(leftChannel.length, rightChannel.length);
    
    // Verificar se há dados suficientes
    if (length < 2) {
      return null; // Dados insuficientes
    }
    
    let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
    
    for (let i = 0; i < length; i++) {
      sumL += leftChannel[i];
      sumR += rightChannel[i];
      sumLR += leftChannel[i] * rightChannel[i];
      sumL2 += leftChannel[i] ** 2;
      sumR2 += rightChannel[i] ** 2;
    }
    
    const meanL = sumL / length;
    const meanR = sumR / length;
    const covariance = (sumLR / length) - (meanL * meanR);
    const varianceL = (sumL2 / length) - (meanL ** 2);
    const varianceR = (sumR2 / length) - (meanR ** 2);
    
    // Verificar se existe variância em ambos os canais
    if (varianceL <= 0 || varianceR <= 0) {
      // Canal constante ou silêncio: correlação indefinida
      return null;
    }
    
    const stdL = Math.sqrt(varianceL);
    const stdR = Math.sqrt(varianceR);
    const correlation = covariance / (stdL * stdR);
    
    // Verificar se o resultado é válido (deve estar entre -1 e 1)
    if (!isFinite(correlation) || Math.abs(correlation) > 1.001) {
      return null; // Resultado inválido
    }
    
    // Clampar para range válido por precisão numérica
    return Math.max(-1, Math.min(1, correlation));
  }

  calculateStereoBalance(leftChannel, rightChannel) {
    const rmsL = Math.sqrt(leftChannel.reduce((sum, val) => sum + val ** 2, 0) / leftChannel.length);
    const rmsR = Math.sqrt(rightChannel.reduce((sum, val) => sum + val ** 2, 0) / rightChannel.length);
    
    const totalRms = rmsL + rmsR;
    return totalRms > 0 ? (rmsR - rmsL) / totalRms : 0;
  }

  calculateStereoWidth(leftChannel, rightChannel) {
    const length = Math.min(leftChannel.length, rightChannel.length);
    let sideMagnitude = 0;
    let midMagnitude = 0;
    
    for (let i = 0; i < length; i++) {
      const mid = (leftChannel[i] + rightChannel[i]) / 2;
      const side = (leftChannel[i] - rightChannel[i]) / 2;
      midMagnitude += mid ** 2;
      sideMagnitude += side ** 2;
    }
    
    return midMagnitude > 0 ? Math.sqrt(sideMagnitude / midMagnitude) : 0;
  }

  /**
   * 📊 Processar métricas RMS dos frames para métricas agregadas
   */
  processRMSMetrics(framesRMS) {
    try {
      if (!framesRMS || !framesRMS.left || !framesRMS.right || framesRMS.count === 0) {
        logAudio('core_metrics', 'rms_invalid_input', { hasLeft: !!framesRMS?.left, hasRight: !!framesRMS?.right, count: framesRMS?.count });
        return {
          left: null,
          right: null,
          average: null,
          peak: null,
          count: framesRMS?.count || 0
        };
      }

      // Calcular RMS médio para cada canal
      const leftFrames = framesRMS.left;
      const rightFrames = framesRMS.right;
      
      // Filtrar apenas valores válidos (não-zero, não-NaN, não-Infinity)
      const validLeftFrames = leftFrames.filter(val => val > 0 && isFinite(val));
      const validRightFrames = rightFrames.filter(val => val > 0 && isFinite(val));
      
      if (validLeftFrames.length === 0 || validRightFrames.length === 0) {
        logAudio('core_metrics', 'rms_no_valid_frames', { 
          leftValid: validLeftFrames.length, 
          rightValid: validRightFrames.length,
          leftTotal: leftFrames.length,
          rightTotal: rightFrames.length 
        });
        return {
          left: null,
          right: null,
          average: null,
          peak: null,
          count: framesRMS.count
        };
      }
      
      // RMS médio por canal (já são valores RMS por frame)
      const leftRMS = this.calculateArrayAverage(validLeftFrames);
      const rightRMS = this.calculateArrayAverage(validRightFrames);
      
      // RMS médio total
      const averageRMS = (leftRMS + rightRMS) / 2;
      
      // Peak RMS (maior valor RMS entre todos os frames válidos)
      const peakRMS = Math.max(
        Math.max(...validLeftFrames),
        Math.max(...validRightFrames)
      );

      // Converter para dB (com segurança)
      const leftRMSDb = leftRMS > 0 ? 20 * Math.log10(leftRMS) : -120; // Floor -120dB
      const rightRMSDb = rightRMS > 0 ? 20 * Math.log10(rightRMS) : -120;
      const averageRMSDb = averageRMS > 0 ? 20 * Math.log10(averageRMS) : -120;
      const peakRMSDb = peakRMS > 0 ? 20 * Math.log10(peakRMS) : -120;

      logAudio('core_metrics', 'rms_processed', { 
        leftRMSDb: leftRMSDb.toFixed(2), 
        rightRMSDb: rightRMSDb.toFixed(2), 
        averageRMSDb: averageRMSDb.toFixed(2),
        peakRMSDb: peakRMSDb.toFixed(2),
        frameCount: framesRMS.count,
        validFrames: Math.min(validLeftFrames.length, validRightFrames.length)
      });

      return {
        left: leftRMSDb,
        right: rightRMSDb,
        average: averageRMSDb,
        peak: peakRMSDb,
        count: framesRMS.count
      };

    } catch (error) {
      logAudio('core_metrics', 'rms_processing_error', { error: error.message });
      return {
        left: null,
        right: null,
        average: null,
        peak: null,
        count: framesRMS?.count || 0
      };
    }
  }

  /**
   * 🎵 Calcular BPM (Beats Per Minute) usando music-tempo + autocorrelação
   * Implementação confiável com cross-validation e correção harmônica
   */
  calculateBpmMetrics(leftChannel, rightChannel, options = {}) {
    const jobId = options.jobId || 'unknown';
    
    try {
      logAudio('core_metrics', 'bpm_calculation_start', { 
        samples: leftChannel.length, 
        method: 'music_tempo_plus_autocorrelation',
        jobId: jobId.substring(0,8) 
      });

      // Validar entrada
      if (!leftChannel || !rightChannel || leftChannel.length === 0) {
        console.warn('[WORKER][BPM] Canais inválidos ou vazios');
        return { bpm: null, bpmConfidence: null, bpmSource: 'INVALID_INPUT' };
      }

      if (leftChannel.length < CORE_METRICS_CONFIG.SAMPLE_RATE * 10) { // Mín. 10 segundos
        console.warn('[WORKER][BPM] Sinal muito curto para análise de BPM (< 10s)');
        return { bpm: null, bpmConfidence: null, bpmSource: 'TOO_SHORT' };
      }

      // Combinar canais para mono (RMS stereo)
      const monoSignal = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        monoSignal[i] = Math.sqrt((leftChannel[i] ** 2 + rightChannel[i] ** 2) / 2);
      }

      const sampleRate = CORE_METRICS_CONFIG.SAMPLE_RATE;
      const BPM_MIN = 60;
      const BPM_MAX = 180;
      const CONFIDENCE_THRESHOLD = 0.5; // ✅ Usar threshold do fallback rígido

      console.log(`[WORKER][BPM] Processando sinal: ${monoSignal.length} amostras @ ${sampleRate}Hz`);

      // ========= MÉTODO 1: MUSIC-TEMPO (PRINCIPAL) =========
      const musicTempoBpm = this.calculateMusicTempoBpm(monoSignal, sampleRate, BPM_MIN, BPM_MAX);
      
      // ========= MÉTODO 2: AUTOCORRELAÇÃO (SECUNDÁRIO) =========
      const autocorrBpm = this.calculateAutocorrelationBpm(monoSignal, sampleRate, BPM_MIN, BPM_MAX);
      
      console.log(`[WORKER][BPM] Método 1 (music-tempo): ${musicTempoBpm.bpm} (conf: ${musicTempoBpm.confidence.toFixed(2)})`);
      console.log(`[WORKER][BPM] Método 2 (autocorr): ${autocorrBpm.bpm} (conf: ${autocorrBpm.confidence.toFixed(2)})`);

      // ========= CROSS-VALIDATION REFORÇADA =========
      const musicTempoResult = { bpm: musicTempoBpm.bpm, confidence: musicTempoBpm.confidence, source: 'music-tempo' };
      const autocorrResult   = { bpm: autocorrBpm.bpm, confidence: autocorrBpm.confidence, source: 'autocorr' };

      const consolidated = this.crossValidateBpmResults(musicTempoResult, autocorrResult);

      // Preparar technicalData
      const technicalData = {};

      if (consolidated) {
        technicalData.bpm = consolidated.bpm;
        technicalData.bpmConfidence = consolidated.confidence;
        technicalData.bpmSource = consolidated.source; // ✅ CORREÇÃO: bmpSource → bpmSource
        console.log('[WORKER][BPM] Final:', consolidated);
      } else {
        technicalData.bpm = null;
        technicalData.bpmConfidence = Math.max(
          Number(musicTempoResult.confidence) || 0,
          Number(autocorrResult.confidence) || 0
        );
        technicalData.bpmSource = 'UNKNOWN'; // ✅ CORREÇÃO: bmpSource → bpmSource
        console.log('[WORKER][BPM] Final: null (conf baixa / métodos discordantes)');
      }

      logAudio('core_metrics', 'bpm_calculation_completed', { 
        bpm: technicalData.bpm,
        confidence: technicalData.bpmConfidence?.toFixed?.(2) || technicalData.bpmConfidence || 0,
        source: technicalData.bpmSource, // ✅ CORREÇÃO: bmpSource → bpmSource
        method1: musicTempoResult,
        method2: autocorrResult,
        jobId: jobId.substring(0,8) 
      });

      return { 
        bpm: technicalData.bpm, 
        bpmConfidence: technicalData.bpmConfidence,
        bpmSource: technicalData.bpmSource // ✅ CORREÇÃO: bmpSource → bpmSource
      };

    } catch (error) {
      console.error("[WORKER][BPM] Erro ao calcular BPM:", error);
      logAudio('core_metrics', 'bpm_calculation_error', { 
        error: error.message,
        jobId: jobId.substring(0,8) 
      });
      
      return { 
        bpm: null, 
        bpmConfidence: null,
        bpmSource: 'ERROR'
      };
    }
  }

  // ========= MÉTODO 1: MUSIC-TEMPO (PRINCIPAL) =========
  calculateMusicTempoBpm(signal, sampleRate, minBpm, maxBpm) {
    try {
      console.log(`[WORKER][BPM] Music-tempo: processando ${signal.length} amostras @ ${sampleRate}Hz`);
      
      // TODO: Integrar com music-tempo library quando disponível
      // Por enquanto, usar implementação robusta de onset detection
      
      // Converter para formato esperado pela library (se necessário)
      const audioBuffer = Array.from(signal);
      
      // Detecção de BPM usando análise espectral e onset detection melhor
      const result = this.calculateAdvancedOnsetBpm(signal, sampleRate, minBpm, maxBpm);
      
      console.log(`[WORKER][BPM] Music-tempo resultado: ${result.bpm} (conf: ${result.confidence.toFixed(2)})`);
      
      return result;
      
    } catch (error) {
      console.error(`[WORKER][BPM] Erro no music-tempo: ${error.message}`);
      return { bpm: null, confidence: 0 };
    }
  }

  // ========= ADVANCED ONSET DETECTION (SUBSTITUTO TEMPORÁRIO DO MUSIC-TEMPO) =========
  calculateAdvancedOnsetBpm(signal, sampleRate, minBpm, maxBpm) {
    const onsets = [];
    const windowSize = Math.floor(sampleRate * 0.023); // 23ms janela (mais precisa)
    const hopSize = Math.floor(windowSize / 2); // 50% overlap (mais frames)
    
    let previousSpectralFlux = 0;
    
    // Onset detection com spectral flux melhorado
    for (let i = windowSize; i < signal.length - windowSize; i += hopSize) {
      let currentEnergy = 0;
      let previousEnergy = 0;
      let spectralFlux = 0;
      
      // Calcular energia atual e anterior
      for (let j = 0; j < windowSize; j++) {
        const currentSample = signal[i + j];
        const previousSample = signal[i - windowSize + j];
        
        currentEnergy += currentSample * currentSample;
        previousEnergy += previousSample * previousSample;
        
        // Spectral flux: diferença positiva de energia
        const energyDiff = currentEnergy - previousEnergy;
        if (energyDiff > 0) {
          spectralFlux += energyDiff;
        }
      }
      
      // Normalizar energia
      currentEnergy = Math.sqrt(currentEnergy / windowSize);
      previousEnergy = Math.sqrt(previousEnergy / windowSize);
      
      // Onset detection com múltiplos critérios
      const energyThreshold = Math.max(0.001, previousEnergy * 1.5);
      const fluxThreshold = previousSpectralFlux * 1.3;
      
      const isOnset = currentEnergy > energyThreshold && 
                     currentEnergy > previousEnergy * 1.3 &&
                     spectralFlux > fluxThreshold;
      
      if (isOnset) {
        onsets.push(i / sampleRate);
      }
      
      previousSpectralFlux = spectralFlux;
    }

    console.log(`[WORKER][BPM] Advanced onset detection: ${onsets.length} onsets detectados`);
    
    return this.calculateBpmFromOnsets(onsets, minBpm, maxBpm, sampleRate);
  }

  // ========= MÉTODO 2: AUTOCORRELAÇÃO MELHORADA (SECUNDÁRIO) =========
  calculateAutocorrelationBpm(signal, sampleRate, minBpm, maxBpm) {
    try {
      console.log(`[WORKER][BPM] Autocorrelação: processando ${signal.length} amostras`);
      
      // Aplicar filtro passa-baixa para focar em componentes rítmicos
      const filteredSignal = this.applyLowPassFilter(signal, sampleRate, 200); // 200Hz cutoff
      
      // Downsampling para performance (menor fator para mais precisão)
      const downsampleFactor = 2; // 24kHz em vez de 12kHz
      const downsampledSignal = [];
      for (let i = 0; i < filteredSignal.length; i += downsampleFactor) {
        downsampledSignal.push(filteredSignal[i]);
      }
      
      const newSampleRate = sampleRate / downsampleFactor;
      const minPeriod = Math.floor(newSampleRate * 60 / maxBpm);
      const maxPeriod = Math.floor(newSampleRate * 60 / minBpm);
      
      console.log(`[WORKER][BPM] Autocorr range: ${minPeriod}-${maxPeriod} samples (${maxBpm}-${minBpm} BPM)`);
      
      let bestBpm = null;
      let bestScore = 0;
      let secondBestScore = 0;
      
      // Normalizar signal para autocorrelação
      const mean = downsampledSignal.reduce((sum, val) => sum + val, 0) / downsampledSignal.length;
      const normalizedSignal = downsampledSignal.map(val => val - mean);
      
      // Calcular autocorrelação normalizada para diferentes lags
      for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        let correlation = 0;
        let sumSquares1 = 0;
        let sumSquares2 = 0;
        let count = 0;
        
        for (let i = 0; i < normalizedSignal.length - lag; i++) {
          const val1 = normalizedSignal[i];
          const val2 = normalizedSignal[i + lag];
          
          correlation += val1 * val2;
          sumSquares1 += val1 * val1;
          sumSquares2 += val2 * val2;
          count++;
        }
        
        if (count > 0 && sumSquares1 > 0 && sumSquares2 > 0) {
          // Autocorrelação normalizada (Pearson correlation)
          const normalizedCorrelation = correlation / Math.sqrt(sumSquares1 * sumSquares2);
          
          if (normalizedCorrelation > bestScore) {
            secondBestScore = bestScore;
            bestScore = normalizedCorrelation;
            bestBpm = Math.round(newSampleRate * 60 / lag);
          } else if (normalizedCorrelation > secondBestScore) {
            secondBestScore = normalizedCorrelation;
          }
        }
      }
      
      // Confiança baseada na diferença entre primeiro e segundo picos
      const confidenceBoost = bestScore - secondBestScore;
      const rawConfidence = Math.max(0, bestScore);
      const confidence = Math.min(1, rawConfidence + confidenceBoost * 0.5);
      
      console.log(`[WORKER][BPM] Autocorr resultado: ${bestBpm} BPM, score: ${bestScore.toFixed(3)}, conf: ${confidence.toFixed(3)}`);
      
      return { bpm: bestBpm, confidence: confidence };
      
    } catch (error) {
      console.error(`[WORKER][BPM] Erro na autocorrelação: ${error.message}`);
      return { bpm: null, confidence: 0 };
    }
  }

  // ========= FILTRO PASSA-BAIXA SIMPLES =========
  applyLowPassFilter(signal, sampleRate, cutoffFreq) {
    // Implementação simples de filtro passa-baixa (butter worth de primeira ordem)
    const dt = 1.0 / sampleRate;
    const RC = 1.0 / (cutoffFreq * 2 * Math.PI);
    const alpha = dt / (RC + dt);
    
    const filtered = new Float32Array(signal.length);
    filtered[0] = signal[0];
    
    for (let i = 1; i < signal.length; i++) {
      filtered[i] = alpha * signal[i] + (1 - alpha) * filtered[i - 1];
    }
    
    return filtered;
  }

  // ========= CÁLCULO BPM A PARTIR DE ONSETS =========
  calculateBpmFromOnsets(onsets, minBpm, maxBpm, sampleRate) {
    if (onsets.length < 4) {
      return { bpm: null, confidence: 0 };
    }

    // Calcular intervalos entre onsets
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i-1]);
    }

    // Histograma com bins mais precisos
    const histogramBins = {};
    intervals.forEach(interval => {
      const bpm = 60 / interval;
      const roundedBpm = Math.round(bpm);
      
      if (roundedBpm >= minBpm && roundedBpm <= maxBpm) {
        histogramBins[roundedBpm] = (histogramBins[roundedBpm] || 0) + 1;
      }
    });

    if (Object.keys(histogramBins).length === 0) {
      return { bpm: null, confidence: 0 };
    }

    // Encontrar BPM mais frequente
    let maxCount = 0;
    let detectedBpm = null;
    
    for (const [bpm, count] of Object.entries(histogramBins)) {
      if (count > maxCount) {
        maxCount = count;
        detectedBpm = parseInt(bpm);
      }
    }

    // Confiança melhorada baseada em consistência
    const confidence = maxCount / intervals.length;
    const consistencyBonus = Object.keys(histogramBins).length < 5 ? 0.2 : 0; // Bonus se poucos candidatos
    const finalConfidence = Math.min(1, confidence + consistencyBonus);
    
    return { bpm: detectedBpm, confidence: finalConfidence };
  }

  // ========= CROSS-VALIDATION REFORÇADA (NOVA VERSÃO) =========
  crossValidateBpmResults(method1, method2) {
    const m1 = method1 || { bpm: null, confidence: 0, source: 'unknown' };
    const m2 = method2 || { bpm: null, confidence: 0, source: 'unknown' };

    const has1 = Number.isFinite(m1?.bpm);
    const has2 = Number.isFinite(m2?.bpm);

    // ✅ NOVOS THRESHOLDS MAIS FLEXÍVEIS
    const STRONG_THRESHOLD = 0.45;      // Confiança forte (era 0.70)
    const MIN_ACCEPTABLE = 0.30;        // Confiança mínima aceitável (era 0.50)
    const VERY_WEAK = 0.10;            // Confiança muito fraca
    const AGREEMENT_TOL = 3;           // Tolerância para concordância (era 2)
    const CLOSE_TOL = 2;               // Tolerância para valores próximos

    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    const diff = (has1 && has2) ? Math.abs(m1.bpm - m2.bpm) : Infinity;

    const isHarmonic = (a, b) => {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return (
        Math.abs(a - b) <= CLOSE_TOL ||
        Math.abs(a - 2 * b) <= CLOSE_TOL ||
        Math.abs(a - b / 2) <= CLOSE_TOL
      );
    };

    // ✅ MAPEAMENTO PARA FONTES ESPECIFICADAS
    const mapSourceName = (chosen, reason) => {
      if (!chosen || !Number.isFinite(chosen.bpm)) return null;
      
      let finalSource = 'cross-validated'; // Default
      
      // ✅ REGRAS DE MAPEAMENTO FLEXÍVEL:
      if (reason?.includes('m1-') && m1.source === 'music-tempo') {
        finalSource = 'music-tempo';
      } else if (reason?.includes('m1-') && m1.source === 'autocorr') {
        finalSource = 'autocorr';
      } else if (reason?.includes('m2-') && m2.source === 'music-tempo') {
        finalSource = 'music-tempo';
      } else if (reason?.includes('m2-') && m2.source === 'autocorr') {
        finalSource = 'autocorr';
      } else if (reason === 'only-method1' && m1.source === 'music-tempo') {
        finalSource = 'music-tempo';
      } else if (reason === 'only-method1' && m1.source === 'autocorr') {
        finalSource = 'autocorr';
      } else if (reason === 'only-method2' && m2.source === 'music-tempo') {
        finalSource = 'music-tempo';
      } else if (reason === 'only-method2' && m2.source === 'autocorr') {
        finalSource = 'autocorr';
      } else if (reason?.includes('agreement') || reason?.includes('harmonic')) {
        finalSource = 'cross-validated';
      } else if (reason?.includes('weak') || reason?.includes('close') || reason?.includes('fallback')) {
        finalSource = 'fallback';
      }
      
      return {
        bpm: Math.round(chosen.bpm),
        confidence: clamp01(chosen.confidence),
        source: finalSource
      };
    };

    console.log(`[WORKER][BPM] Cross-validation FLEXÍVEL: m1=${m1.bpm}(${clamp01(m1.confidence).toFixed(2)}) vs m2=${m2.bpm}(${clamp01(m2.confidence).toFixed(2)}), diff=${diff.toFixed(1)}`);

    // casos com apenas um válido
    if (has1 && !has2) {
      console.log(`[WORKER][BPM] ✅ Apenas método 1 válido - usando m1`);
      return mapSourceName(m1, 'only-method1');
    }
    if (!has1 && has2) {
      console.log(`[WORKER][BPM] ✅ Apenas método 2 válido - usando m2`);
      return mapSourceName(m2, 'only-method2');
    }
    if (!has1 && !has2) {
      console.log(`[WORKER][BPM] ❌ Nenhum método válido`);
      return null;
    }

    // ✅ NOVA CLASSIFICAÇÃO FLEXÍVEL
    const m1Strong = m1.confidence >= STRONG_THRESHOLD;
    const m2Strong = m2.confidence >= STRONG_THRESHOLD;
    const m1Acceptable = m1.confidence >= MIN_ACCEPTABLE;
    const m2Acceptable = m2.confidence >= MIN_ACCEPTABLE;
    const m1VeryWeak = m1.confidence < VERY_WEAK;
    const m2VeryWeak = m2.confidence < VERY_WEAK;

    console.log(`[WORKER][BPM] Análise flexível: m1_strong=${m1Strong}(${m1.confidence.toFixed(2)}), m2_strong=${m2Strong}(${m2.confidence.toFixed(2)}), diff=${diff.toFixed(1)}`);

    // ✅ REGRA 1: MÉTODOS CONCORDAM (diff < 3 BPM) E PELO MENOS UM >= 0.3
    if (diff < AGREEMENT_TOL && (m1Acceptable || m2Acceptable)) {
      const avg = (m1.bpm + m2.bpm) / 2;
      const avgConfidence = (m1.confidence + m2.confidence) / 2;
      console.log(`[WORKER][BPM] ✅ REGRA 1: Métodos concordam (diff=${diff.toFixed(1)}) e pelo menos um >= 0.3`);
      console.log(`[WORKER][BPM] ✅ Aceito: BPM médio ${avg.toFixed(0)}, confiança média ${avgConfidence.toFixed(2)}`);
      return mapSourceName({ bpm: avg, confidence: avgConfidence }, 'agreement-flexible');
    }

    // ✅ REGRA 2: UM FORTE (>= 0.45) E OUTRO MUITO FRACO (< 0.1)
    if (m1Strong && m2VeryWeak) {
      console.log(`[WORKER][BPM] ✅ REGRA 2: Método 1 forte (${m1.confidence.toFixed(2)}) vs método 2 muito fraco (${m2.confidence.toFixed(2)})`);
      console.log(`[WORKER][BPM] ✅ Aceito: BPM ${m1.bpm}, método 1 dominante`);
      return mapSourceName({ ...m1 }, 'm1-dominant');
    }
    if (m2Strong && m1VeryWeak) {
      console.log(`[WORKER][BPM] ✅ REGRA 2: Método 2 forte (${m2.confidence.toFixed(2)}) vs método 1 muito fraco (${m1.confidence.toFixed(2)})`);
      console.log(`[WORKER][BPM] ✅ Aceito: BPM ${m2.bpm}, método 2 dominante`);
      return mapSourceName({ ...m2 }, 'm2-dominant');
    }

    // ✅ REGRA 3: AMBOS FRACOS MAS PRÓXIMOS (±2 BPM)
    if (!m1Strong && !m2Strong && diff <= CLOSE_TOL) {
      const chosen = m1.confidence >= m2.confidence ? m1 : m2;
      console.log(`[WORKER][BPM] ⚠️ REGRA 3: Ambos fracos mas próximos (diff=${diff.toFixed(1)})`);
      console.log(`[WORKER][BPM] ⚠️ Aceito: BPM ${chosen.bpm}, maior confiança ${chosen.confidence.toFixed(2)}`);
      return mapSourceName({ ...chosen }, 'weak-but-close');
    }

    // ✅ CASOS ESPECIAIS: UM MÉTODO FORTE (sem considerar o outro)
    if (m1Strong && !m2Strong) {
      console.log(`[WORKER][BPM] ✅ CASO ESPECIAL: Método 1 forte (${m1.confidence.toFixed(2)}), ignorando método 2`);
      return mapSourceName({ ...m1 }, 'm1-strong-solo');
    }
    if (m2Strong && !m1Strong) {
      console.log(`[WORKER][BPM] ✅ CASO ESPECIAL: Método 2 forte (${m2.confidence.toFixed(2)}), ignorando método 1`);
      return mapSourceName({ ...m2 }, 'm2-strong-solo');
    }

    // ✅ RELAÇÃO HARMÔNICA COMO ÚLTIMO RECURSO
    if (isHarmonic(m1.bpm, m2.bpm) && (m1Acceptable || m2Acceptable)) {
      const chosen = m1.confidence >= m2.confidence ? m1 : m2;
      console.log(`[WORKER][BPM] 🎵 HARMÔNICA: Relação detectada com confiança aceitável`);
      console.log(`[WORKER][BPM] 🎵 Aceito: BPM ${chosen.bpm}, confiança ${chosen.confidence.toFixed(2)}`);
      return mapSourceName({ ...chosen }, 'harmonic-acceptable');
    }

    // ❌ REJEITAR: Baixa confiança geral
    console.log(`[WORKER][BPM] ❌ REJEITADO: Métodos discordantes ou confiança insuficiente`);
    console.log(`[WORKER][BPM] ❌ m1: ${m1.bpm}(${m1.confidence.toFixed(2)}), m2: ${m2.bpm}(${m2.confidence.toFixed(2)}), diff: ${diff.toFixed(1)}`);
    return null;
  }

  // ========= CORREÇÃO HARMÔNICA E VALIDAÇÃO =========
  checkAndCorrectHarmonics(bmp, confidence, minBpm, maxBpm) {
    if (!bmp) return { bpm: null, confidence: 0, wasHarmonicCorrected: false };

    let correctedBpm = bpm;
    let correctedConfidence = confidence;
    let wasHarmonicCorrected = false;

    console.log(`[WORKER][BPM] Verificando harmônicos para ${bpm} BPM (conf: ${confidence.toFixed(2)})`);

    // Correção de harmônicos: se BPM está fora do range preferido (80-150)
    if (correctedBpm > 150) {
      // Tentar dividir por 2
      const halfBpm = Math.round(correctedBpm / 2);
      if (halfBpm >= minBpm && halfBpm <= 150) {
        console.log(`[WORKER][BPM] 🎵 Correção harmônica: ${correctedBpm} → ${halfBpm} (÷2)`);
        correctedBpm = halfBpm;
        correctedConfidence *= 0.95; // Pequena penalidade por correção
        wasHarmonicCorrected = true;
      }
    } else if (correctedBpm < 80) {
      // Tentar multiplicar por 2
      const doubleBpm = correctedBpm * 2;
      if (doubleBpm <= maxBpm && doubleBpm >= 80) {
        console.log(`[WORKER][BPM] 🎵 Correção harmônica: ${correctedBpm} → ${doubleBpm} (×2)`);
        correctedBpm = doubleBpm;
        correctedConfidence *= 0.95; // Pequena penalidade por correção
        wasHarmonicCorrected = true;
      }
    }

    return { 
      bpm: correctedBpm, 
      confidence: correctedConfidence, 
      wasHarmonicCorrected 
    };
  }

  // ========= VALIDAÇÃO COM THRESHOLD DE CONFIANÇA =========
  validateAndCorrectHarmonics(result, minBpm, maxBpm, confidenceThreshold, source = 'UNKNOWN') {
    if (!result.bpm) return { bpm: null, confidence: 0, source: source };

    const corrected = this.checkAndCorrectHarmonics(result.bpm, result.confidence, minBpm, maxBpm);
    
    // Aplicar threshold de confiança
    if (corrected.confidence < confidenceThreshold) {
      console.log(`[WORKER][BPM] ❌ Confiança baixa: ${corrected.confidence.toFixed(2)} < ${confidenceThreshold} - descartando resultado`);
      return { bpm: null, confidence: corrected.confidence, source: source };
    }

    console.log(`[WORKER][BPM] ✅ Validação aprovada: ${corrected.bpm} BPM (conf: ${corrected.confidence.toFixed(2)})`);
    return { 
      bpm: corrected.bpm, 
      confidence: corrected.confidence, 
      source: corrected.wasHarmonicCorrected ? `${source}_HARMONIC` : source 
    };
  }

  // ========= FALLBACK RÍGIDO - ACEITA CONFIANÇA >= 0.5 =========
  applyStrictFallback(result, minBpm, maxBpm) {
    if (!result.bpm) return { bpm: null, confidence: 0, source: 'FALLBACK_FAILED' };

    let correctedBpm = result.bpm;
    let confidence = result.confidence;

    // Correção de harmônicos mesmo com confiança baixa (mas >= 0.5)
    if (correctedBpm > 150) {
      const halfBpm = Math.round(correctedBpm / 2);
      if (halfBpm >= minBpm && halfBpm <= 150) {
        console.log(`[WORKER][BPM] FALLBACK: Correção harmônica ${correctedBpm} → ${halfBpm} (÷2)`);
        correctedBpm = halfBpm;
        confidence *= 0.95; // Pequena penalidade por correção
      }
    } else if (correctedBpm < 80) {
      const doubleBpm = correctedBpm * 2;
      if (doubleBpm <= maxBpm && doubleBpm >= 80) {
        console.log(`[WORKER][BPM] FALLBACK: Correção harmônica ${correctedBpm} → ${doubleBpm} (×2)`);
        correctedBpm = doubleBpm;
        confidence *= 0.95; // Pequena penalidade por correção
      }
    }

    // Verificar se está no range válido
    if (correctedBpm < minBpm || correctedBpm > maxBpm) {
      console.log(`[WORKER][BPM] FALLBACK: BPM ${correctedBpm} fora do range ${minBpm}-${maxBpm} - descartando`);
      return { bpm: null, confidence: confidence, source: 'FALLBACK_OUT_OF_RANGE' };
    }

    // Aplicar threshold mínimo de 0.5 para fallback rígido
    if (confidence < 0.5) {
      console.log(`[WORKER][BPM] FALLBACK: Confiança ${confidence.toFixed(2)} < 0.5 - descartando`);
      return { bpm: null, confidence: confidence, source: 'FALLBACK_CONFIDENCE_TOO_LOW' };
    }

    console.log(`[WORKER][BPM] FALLBACK: Aceito BPM ${correctedBpm} com confiança ${confidence.toFixed(2)}`);
    return { bpm: correctedBpm, confidence: confidence, source: 'FALLBACK_STRICT' };
  }

  // ========= VERIFICAÇÃO DE HARMÔNICOS ENTRE MÉTODOS =========
  checkHarmonics(result1, result2) {
    const bpm1 = result1.bpm;
    const bpm2 = result2.bpm;
    
    // Verificar se bpm2 é aproximadamente 2x bpm1
    if (Math.abs(bpm2 - bpm1 * 2) <= 3) {
      // Preferir o BPM menor (mais provável ser o correto)
      return result1.confidence > result2.confidence * 0.8 ? result1 : { bpm: bpm1, confidence: (result1.confidence + result2.confidence) / 2 };
    }
    
    // Verificar se bpm1 é aproximadamente 2x bpm2
    if (Math.abs(bpm1 - bpm2 * 2) <= 3) {
      // Preferir o BPM menor (mais provável ser o correto)
      return result2.confidence > result1.confidence * 0.8 ? result2 : { bpm: bpm2, confidence: (result1.confidence + result2.confidence) / 2 };
    }
    
    return null;
  }

  /**
   * 📈 Calcular média de um array (helper function)
   */
  calculateArrayAverage(array) {
    if (!array || array.length === 0) return 0;
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
  }
}

// ========= PONTO DE ENTRADA PÚBLICO =========

const coreMetricsProcessor = new CoreMetricsProcessor();

export async function calculateCoreMetrics(segmentedAudio, options = {}) {
  try {
    return await coreMetricsProcessor.processMetrics(segmentedAudio, options);
  } catch (error) {
    // Garantir que qualquer erro saia estruturado
    if (error.stage === 'core_metrics') {
      throw error;
    }
    throw makeErr('core_metrics', `Core metrics processing failed: ${error.message}`, 'core_metrics_entry_error');
  }
}

// Exportar classe para testes
export { CoreMetricsProcessor };

console.log('✅ Core Metrics Processor inicializado (Fase 5.3) - CORRIGIDO com fail-fast');