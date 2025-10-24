// 🎵 CORE METRICS - Fase 5.3 Pipeline Migration - CORRIGIDO
// FFT, LUFS ITU-R BS.1770-4, True Peak 4x Oversampling, Stereo Analysis
// Migração equivalente das métricas do Web Audio API para Node.js com fail-fast

// 🚀 OTIMIZAÇÃO #3: FFT otimizada com fft-js (ganho: 60-90s → 5-10s)
import { FastFFT } from "../../lib/audio/fft-optimized.js";
import { calculateLoudnessMetrics } from "../../lib/audio/features/loudness.js";
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
import { calculateBpm } from "./bpm-analyzer.js";

// 🚀 OTIMIZAÇÃO #5: Paralelização com Worker Threads (ganho: 60-100s → 20-40s)
import { runWorkersParallel } from "../../lib/audio/worker-manager.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';

// Sistema de tratamento de erros padronizado
import { makeErr, logAudio, assertFinite, ensureFiniteArray } from '../../lib/audio/error-handling.js';

// Caminho base para workers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKERS_DIR = join(__dirname, '../../workers');

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
 * 🎯 AUDITORIA DE PERFORMANCE - Log de Tempo por Etapa
 */
function logStep(label, start) {
  const end = performance.now();
  const time = (end - start).toFixed(2);
  console.log(`⏱️  [${label}] levou ${time} ms (${(time / 1000).toFixed(2)} s)`);
  return end;
}

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
      activeAnalyzers: ['problems_suggestions_v2'],
      skippedAnalyzers: ['dominant_frequencies_class', 'dc_offset', 'spectral_uniformity']
    });
  }

  /**
   * PROCESSAMENTO PRINCIPAL COM FAIL-FAST
   */
  async processMetrics(segmentedAudio, options = {}) {
    console.log('\n\n🚀 ===== AUDITORIA DE TEMPO INICIADA =====');
    const globalStart = performance.now();
    
    const jobId = options.jobId || 'unknown';
    const fileName = options.fileName || 'unknown';
    
    logAudio('core_metrics', 'start_processing', { fileName, jobId });
    const startTime = Date.now();

    try {
      // ========= VALIDAÇÃO DE ENTRADA =========
      this.validateInputFrom5_2(segmentedAudio);
      const { leftChannel, rightChannel } = this.ensureOriginalChannels(segmentedAudio);

      // ========= NORMALIZAÇÃO PRÉ-ANÁLISE A -23 LUFS =========
      const t1 = performance.now();
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
      const t2 = logStep('Normalização', t1);

      // ========= 🚀 PARALELIZAÇÃO: FFT, LUFS, TRUE PEAK E BPM EM PARALELO =========
      const t3 = performance.now();
      console.log('\n🚀 [PARALELIZAÇÃO] Iniciando análises em Worker Threads...');
      console.time('⏱️  Tempo Total Paralelo');
      
      const [fftResults, lufsMetrics, truePeakMetrics, bpmResult] = await runWorkersParallel([
        {
          name: 'FFT + Spectral Analysis',
          path: join(WORKERS_DIR, 'fft-worker.js'),
          data: {
            framesFFT: segmentedAudio.framesFFT,
            jobId
          }
        },
        {
          name: 'LUFS ITU-R BS.1770-4',
          path: join(WORKERS_DIR, 'lufs-worker.js'),
          data: {
            leftChannel: normalizedLeft,
            rightChannel: normalizedRight,
            sampleRate: CORE_METRICS_CONFIG.SAMPLE_RATE,
            jobId
          }
        },
        {
          name: 'True Peak 4x Oversampling',
          path: join(WORKERS_DIR, 'truepeak-worker.js'),
          data: {
            leftChannel: normalizedLeft,
            rightChannel: normalizedRight,
            sampleRate: CORE_METRICS_CONFIG.SAMPLE_RATE,
            tempFilePath: options.tempFilePath,
            jobId
          }
        },
        {
          name: 'BPM Detection (30s limit)',
          path: join(WORKERS_DIR, 'bpm-worker.js'),
          data: {
            leftChannel: normalizedLeft,
            rightChannel: normalizedRight,
            sampleRate: CORE_METRICS_CONFIG.SAMPLE_RATE,
            jobId
          }
        }
      ], { timeout: 120000 }); // 2 minutos timeout
      
      console.timeEnd('⏱️  Tempo Total Paralelo');
      console.log('✅ [PARALELIZAÇÃO] Todas as análises concluídas simultaneamente!\n');
      const t4 = logStep('Workers Paralelos (FFT+LUFS+BPM+TP)', t3);
      
      // Validar resultados dos workers
      assertFinite(fftResults, 'core_metrics');
      assertFinite(lufsMetrics, 'core_metrics');
      assertFinite(truePeakMetrics, 'core_metrics');
      
      // Extrair spectralBands e spectralCentroid do fftResults (agora retornados pelo worker)
      const spectralBandsResults = fftResults.spectralBands;
      const spectralCentroidResults = {
        centroidHz: fftResults.spectralCentroidHz,
        centroidNormalized: fftResults.spectralCentroidNormalized
      };

      // ========= ANÁLISE ESTÉREO CORRIGIDA =========
      const t5 = performance.now();
      logAudio('core_metrics', 'stereo_start', { length: normalizedLeft.length });
      const stereoMetrics = await this.calculateStereoMetricsCorrect(normalizedLeft, normalizedRight, { jobId });
      assertFinite(stereoMetrics, 'core_metrics');
      const t6 = logStep('Stereo Metrics', t5);

      // ========= MÉTRICAS DE DINÂMICA CORRIGIDAS =========
      const t7 = performance.now();
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
      const t8 = logStep('Dynamics Metrics', t7);

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

      // ========= BPM JÁ CALCULADO NO WORKER PARALELO =========
      // BPM foi calculado junto com FFT, LUFS e TruePeak via Worker Thread
      coreMetrics.bpm = bpmResult?.bpm || null;
      coreMetrics.bpmConfidence = bpmResult?.confidence || null;
      
      if (bpmResult?.bpm) {
        console.log("[AUDIO] bpm_calculated stage=core_metrics", {
          bpm: bpmResult.bpm,
          confidence: bpmResult.confidence,
          source: 'worker_thread_parallel'
        });
      } else {
        console.warn('[BPM] Não detectado (worker retornou null)');
      }

      // ========= ANÁLISE DE PROBLEMAS E SUGESTÕES =========
      // Usando função standalone
      const t9 = performance.now();
      let problemsAnalysis = {
        problems: [],
        suggestions: [],
        quality: { overall: null, details: null },
        priorityRecommendations: []
      };
      
      try {
        problemsAnalysis = analyzeProblemsAndSuggestions(coreMetrics);
        console.log('[SUCCESS] Problems Analysis calculado via função standalone');
      } catch (error) {
        console.log('[SKIP_METRIC] problemsAnalysis: erro na função standalone -', error.message);
        // Manter estrutura padrão
      }
      
      // Adicionar análise de problemas aos resultados
      coreMetrics.problems = problemsAnalysis.problems;
      coreMetrics.suggestions = problemsAnalysis.suggestions;
      coreMetrics.qualityAssessment = problemsAnalysis.quality;
      coreMetrics.priorityRecommendations = problemsAnalysis.priorityRecommendations;
      const t10 = logStep('Problems & Suggestions Analysis', t9);

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

      logStep('⏳ TOTAL PIPELINE', globalStart);
      console.log('🏁 ===== AUDITORIA FINALIZADA =====\n\n');

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
      
      // 🚀 OTIMIZAÇÃO #3: Medição de performance FFT otimizada
      console.log(`[FFT_OPTIMIZED] Iniciando análise de ${maxFrames} frames...`);
      console.time('⚡ FFT Analysis Total');
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
      
      // 🚀 OTIMIZAÇÃO #3: Log de ganho de performance
      const fftElapsed = Date.now() - startTime;
      console.timeEnd('⚡ FFT Analysis Total');
      console.log(`[FFT_OPTIMIZED] ✅ ${maxFrames} frames processados em ${(fftElapsed / 1000).toFixed(2)}s`);
      console.log(`[FFT_OPTIMIZED] 📊 Performance: ~${(fftElapsed / maxFrames).toFixed(2)}ms por frame`);
      console.log(`[FFT_OPTIMIZED] 🎯 Ganho esperado vs FastFFT JS: ~85-90% (60-90s → 5-10s)`);
      
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
   * Cálculo True Peak 100% via FFmpeg (sem fallback)
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
        if (truePeakMetrics.true_peak_dbtp > 50 || truePeakMetrics.true_peak_dbtp < -200) {
          throw makeErr('core_metrics', `True peak out of realistic range: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'truepeak_range_error');
        }
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
   */
  async calculateSpectralBandsMetrics(framesFFT, options = {}) {
    const { jobId } = options;
    
    try {
      // Debug detalhado da estrutura recebida
      logAudio('spectral_bands', 'input_debug', { 
        hasFramesFFT: !!framesFFT,
        hasFrames: !!(framesFFT && framesFFT.frames),
        frameCount: framesFFT?.frames?.length || 0,
        framesFFTKeys: framesFFT ? Object.keys(framesFFT) : null,
        jobId 
      });

      if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
        logAudio('spectral_bands', 'no_frames', { 
          reason: !framesFFT ? 'no_framesFFT' : !framesFFT.frames ? 'no_frames_array' : 'empty_frames_array',
          jobId 
        });
        return this.spectralBandsCalculator.getNullBands();
      }

      // Debug: verificar estrutura dos frames
      const firstFrame = framesFFT.frames[0];
      logAudio('spectral_bands', 'frame_structure_debug', { 
        frameCount: framesFFT.frames.length,
        firstFrameKeys: Object.keys(firstFrame),
        hasLeftFFT: !!firstFrame.leftFFT,
        hasRightFFT: !!firstFrame.rightFFT,
        leftFFTKeys: firstFrame.leftFFT ? Object.keys(firstFrame.leftFFT) : null,
        hasMagnitude: !!firstFrame.leftFFT?.magnitude,
        magnitudeLength: firstFrame.leftFFT?.magnitude?.length || 0
      });

      const bandsResults = [];
      let validFrames = 0;
      let invalidFrames = 0;
      
      for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
        const frame = framesFFT.frames[frameIndex];
        
        // Debug mais detalhado dos frames
        if (frameIndex < 3) { // Log dos primeiros 3 frames
          logAudio('spectral_bands', 'frame_detail_debug', {
            frameIndex,
            frameKeys: Object.keys(frame),
            hasLeftFFT: !!frame.leftFFT,
            hasRightFFT: !!frame.rightFFT,
            leftFFTKeys: frame.leftFFT ? Object.keys(frame.leftFFT) : null,
            leftMagnitudeLength: frame.leftFFT?.magnitude?.length || 0,
            rightMagnitudeLength: frame.rightFFT?.magnitude?.length || 0,
            jobId
          });
        }
        
        if (frame.leftFFT?.magnitude && frame.rightFFT?.magnitude) {
          const result = this.spectralBandsCalculator.analyzeBands(
            frame.leftFFT.magnitude,
            frame.rightFFT.magnitude,
            frameIndex
          );
          
          if (result.valid) {
            bandsResults.push(result);
            validFrames++;
          } else {
            invalidFrames++;
          }
        } else {
          invalidFrames++;
          if (frameIndex < 3) { // Log detalhado dos primeiros frames inválidos
            logAudio('spectral_bands', 'invalid_frame', {
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
      const aggregatedBands = SpectralBandsAggregator.aggregate(bandsResults);
      
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

/**
 * calculateBpm(framesFFT, sampleRate)
 * Detecção de BPM via autocorrelação da onset envelope (spectral flux positivo),
 * reutilizando exatamente os frames gerados na Fase 5.2 (fftSize=4096, hop=1024, janela Hann),
 * conforme regras críticas do pipeline. Não recalcula FFT.
 *
 * Entrada:
 * - framesFFT: objeto com estrutura { frames: [{ leftFFT: { magnitude }, rightFFT: { magnitude } }, ...] }
 *              também aceita formato alternativo { left: [...], right: [...] } com objetos FFT contendo magnitude.
 * - sampleRate: taxa de amostragem (esperado 48000 Hz)
 *
 * Saída:
 * - { bpm: number|null, confidence: number|null }
 */
export async function calculateBpmLegacy(framesFFT, sampleRate = CORE_METRICS_CONFIG.SAMPLE_RATE) {
  try {
    // Validar entrada mínima
    if (!framesFFT) {
      logAudio('bpm', 'skip', { reason: 'no_framesFFT' });
      return { bpm: null, confidence: null };
    }

    // Extrair lista de frames independente do formato
    let frames = [];
    if (Array.isArray(framesFFT.frames)) {
      frames = framesFFT.frames;
    } else if (Array.isArray(framesFFT.left) && Array.isArray(framesFFT.right)) {
      // Emparelhar left/right por índice
      const count = Math.min(framesFFT.left.length, framesFFT.right.length);
      for (let i = 0; i < count; i++) {
        frames.push({ leftFFT: framesFFT.left[i], rightFFT: framesFFT.right[i] });
      }
    } else {
      logAudio('bpm', 'skip', { reason: 'unknown_frames_structure' });
      return { bpm: null, confidence: null };
    }

    const hop = CORE_METRICS_CONFIG.FFT_HOP_SIZE || 1024;
    const dt = hop / (sampleRate || CORE_METRICS_CONFIG.SAMPLE_RATE);

    // Limitar quantidade de frames para conter custo (≈ até ~30s de áudio)
    const MAX_FRAMES = 1500; // 1500 * 1024 / 48000 ≈ 32s
    const totalFrames = Math.min(frames.length, MAX_FRAMES);
    if (totalFrames < 16) {
      logAudio('bpm', 'skip', { reason: 'too_few_frames', totalFrames });
      return { bpm: null, confidence: null };
    }

    // Construir onset envelope via spectral flux (apenas diferenças positivas)
    let prevMag = null;
    const flux = [];
    for (let i = 0; i < totalFrames; i++) {
      const f = frames[i];
      const L = f?.leftFFT?.magnitude;
      const R = f?.rightFFT?.magnitude;
      if (!L || !R || L.length !== R.length || L.length === 0) {
        // pular frames inválidos
        continue;
      }
      // Combinar magnitudes L/R usando RMS (mesmo método do pipeline)
      const mag = new Float32Array(L.length);
      for (let k = 0; k < L.length; k++) {
        const l = L[k];
        const r = R[k];
        mag[k] = Math.sqrt(((l * l) + (r * r)) / 2);
      }
      if (prevMag) {
        let sum = 0;
        const len = mag.length;
        for (let k = 0; k < len; k++) {
          const d = mag[k] - prevMag[k];
          if (d > 0) sum += d;
        }
        flux.push(sum);
      }
      prevMag = mag;
    }

    if (flux.length < 8) {
      logAudio('bpm', 'skip', { reason: 'too_few_flux', fluxLen: flux.length });
      return { bpm: null, confidence: null };
    }

    // Normalização simples do envelope (zero-mean + unit variance aprox)
    const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
    let variance = 0;
    for (let i = 0; i < flux.length; i++) variance += (flux[i] - mean) ** 2;
    variance /= Math.max(1, flux.length - 1);
    const std = Math.sqrt(Math.max(variance, 1e-12));
    const x = flux.map(v => (v - mean) / std);

    // Busca de BPM por correlação em janelas de lag correspondentes (70–175 BPM)
    const minBPM = 70;
    const maxBPM = 175;
    const candidates = [];
    for (let bpm = minBPM; bpm <= maxBPM; bpm += 0.5) {
      const periodSec = 60 / bpm;
      const lag = Math.round(periodSec / dt);
      if (lag <= 1 || lag >= x.length - 2) continue;

      // Correlação normalizada x[t] com x[t+lag]
      let num = 0, denA = 0, denB = 0;
      for (let t = 0; t + lag < x.length; t++) {
        const a = x[t];
        const b = x[t + lag];
        num += a * b;
        denA += a * a;
        denB += b * b;
      }
      const r = num / Math.sqrt(Math.max(denA, 1e-12) * Math.max(denB, 1e-12));
      candidates.push({ bpm, r });
    }

    if (!candidates.length) {
      logAudio('bpm', 'skip', { reason: 'no_candidates' });
      return { bpm: null, confidence: null };
    }

    // Escolher maior correlação e calcular confiança relativa
    candidates.sort((a, b) => b.r - a.r);
    const best = candidates[0];
    const second = candidates[1] || { r: 0 };
    const rawConf = Math.max(0, best.r - second.r);
    // Misturar com magnitude absoluta da melhor correlação
    let confidence = Math.min(1, rawConf * 0.6 + Math.max(0, best.r) * 0.4);

    // Resultado
    const result = {
      bpm: Number.isFinite(best.bpm) ? +best.bpm.toFixed(2) : null,
      confidence: Number.isFinite(confidence) ? +confidence.toFixed(3) : null
    };

    logAudio('bpm', 'computed', { bpm: result.bpm, confidence: result.confidence, framesUsed: totalFrames });
    return result;
  } catch (error) {
    logAudio('bpm', 'error', { message: error.message });
    return { bpm: null, confidence: null };
  }
}