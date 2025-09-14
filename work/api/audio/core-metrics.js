// 🎵 CORE METRICS - Fase 5.3 Pipeline Migration - CORRIGIDO
// FFT, LUFS ITU-R BS.1770-4, True Peak 4x Oversampling, Stereo Analysis
// Migração equivalente das métricas do Web Audio API para Node.js com fail-fast

import { FastFFT } from "../../lib/audio/fft.js";
import { calculateLoudnessMetrics } from "../../lib/audio/features/loudness.js";
import { TruePeakDetector, analyzeTruePeaks } from "../../lib/audio/features/truepeak.js";
import { normalizeAudioToTargetLUFS, validateNormalization } from "../../lib/audio/features/normalization.js";
import { auditMetricsCorrections, auditMetricsValidation } from "../../lib/audio/features/audit-logging.js";

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
    this.truePeakDetector = new TruePeakDetector();
    this.cache = { hannWindow: new Map(), fftResults: new Map() };
    logAudio('core_metrics', 'init', { config: CORE_METRICS_CONFIG });
  }

  /**
   * PROCESSAMENTO PRINCIPAL COM FAIL-FAST
   */
  async processMetrics(segmentedAudio, options = {}) {
    const jobId = options.jobId || 'unknown';
    const fileName = options.fileName || 'unknown';
    
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

      // ========= CÁLCULO DE MÉTRICAS FFT =========
      logAudio('core_metrics', 'fft_start', { frames: segmentedAudio.framesFFT?.count });
      const fftResults = await this.calculateFFTMetrics(segmentedAudio.framesFFT, { jobId });
      assertFinite(fftResults, 'core_metrics');

      // ========= CÁLCULO LUFS ITU-R BS.1770-4 =========
      logAudio('core_metrics', 'lufs_start', { frames: segmentedAudio.framesRMS?.count });
      const lufsMetrics = await this.calculateLUFSMetrics(normalizedLeft, normalizedRight, { jobId });
      assertFinite(lufsMetrics, 'core_metrics');

      // ========= TRUE PEAK 4X OVERSAMPLING =========
      logAudio('core_metrics', 'truepeak_start', { channels: 2 });
      const truePeakMetrics = await this.calculateTruePeakMetrics(normalizedLeft, normalizedRight, { jobId });
      assertFinite(truePeakMetrics, 'core_metrics');

      // ========= ANÁLISE ESTÉREO =========
      logAudio('core_metrics', 'stereo_start', { length: normalizedLeft.length });
      const stereoMetrics = await this.calculateStereoMetrics(normalizedLeft, normalizedRight, { jobId });
      assertFinite(stereoMetrics, 'core_metrics');

      // ========= MONTAGEM DE RESULTADO =========
      const coreMetrics = {
        fft: fftResults,
        lufs: {
          ...lufsMetrics,
          // Adicionar dados de normalização aos LUFS
          originalLUFS: normalizationResult.originalLUFS,
          normalizedTo: -23.0,
          gainAppliedDB: normalizationResult.gainAppliedDB
        },
        truePeak: truePeakMetrics,
        stereo: stereoMetrics,
        rms: segmentedAudio.framesRMS, // Passar direto da segmentação
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
        spectralCentroid: [],
        spectralRolloff: [],
        spectralFlatness: []
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
          // 🔍 DEBUG: Verificar frame de entrada
          const leftFrame = leftFrames[i];
          const rightFrame = rightFrames[i];
          
          if (!leftFrame || leftFrame.length === 0) {
            throw makeErr('core_metrics', `Empty left frame at index ${i}`, 'empty_left_frame');
          }
          if (!rightFrame || rightFrame.length === 0) {
            throw makeErr('core_metrics', `Empty right frame at index ${i}`, 'empty_right_frame');
          }

          // FFT para canal esquerdo
          const leftFFT = this.fftEngine.fft(leftFrame);
          
          // 🔍 DEBUG: Verificar resultado FFT esquerdo
          if (!leftFFT || !leftFFT.magnitude || leftFFT.magnitude.length === 0) {
            throw makeErr('core_metrics', `FFT left result invalid at frame ${i}`, 'invalid_fft_left');
          }
          
          ensureFiniteArray(leftFFT.magnitude, 'core_metrics', `left_magnitude_frame_${i}`);
          fftResults.left.push(leftFFT);

          // FFT para canal direito
          const rightFFT = this.fftEngine.fft(rightFrame);
          
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

          // Métricas espectrais
          const centroid = this.calculateSpectralCentroid(magnitude);
          const rolloff = this.calculateSpectralRolloff(magnitude);
          const flatness = this.calculateSpectralFlatness(magnitude);

          // CORREÇÃO: aceitar null para centroid (silêncio absoluto)
          if ((centroid !== null && !isFinite(centroid)) || !isFinite(rolloff) || !isFinite(flatness)) {
            throw makeErr('core_metrics', `Invalid spectral metrics at frame ${i}`, 'invalid_spectral_metrics');
          }

          fftResults.spectralCentroid.push(centroid);
          fftResults.spectralRolloff.push(rolloff);
          fftResults.spectralFlatness.push(flatness);

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
      
      // ========= AGREGAÇÃO ESPECTRAL =========
      // Agregar spectralCentroid de array para valor único em Hz
      const validCentroids = fftResults.spectralCentroid.filter(c => c !== null && isFinite(c));
      if (validCentroids.length > 0) {
        // Usar mediana para robustez contra outliers
        validCentroids.sort((a, b) => a - b);
        const medianIndex = Math.floor(validCentroids.length / 2);
        fftResults.spectralCentroidHz = validCentroids.length % 2 === 0 
          ? (validCentroids[medianIndex - 1] + validCentroids[medianIndex]) / 2
          : validCentroids[medianIndex];
          
        logAudio('core_metrics', 'spectral_centroid_aggregated', {
          frames: validCentroids.length,
          centroidHz: fftResults.spectralCentroidHz.toFixed(1),
          min: validCentroids[0].toFixed(1),
          max: validCentroids[validCentroids.length - 1].toFixed(1)
        });
      } else {
        fftResults.spectralCentroidHz = null;
        logAudio('core_metrics', 'spectral_centroid_null', { 
          reason: 'No valid centroid values found' 
        });
      }
      
      // Manter array original para compatibilidade, mas adicionar valor agregado
      fftResults.spectralCentroid = fftResults.spectralCentroidHz;
      
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
   * Cálculo True Peak com oversampling 4x
   */
  async calculateTruePeakMetrics(leftChannel, rightChannel, options = {}) {
    const jobId = options.jobId || 'unknown';
    
    try {
      logAudio('core_metrics', 'truepeak_calculation', { 
        samples: leftChannel.length, 
        oversampling: CORE_METRICS_CONFIG.TRUE_PEAK_OVERSAMPLING,
        jobId: jobId.substring(0,8) 
      });

      const truePeakMetrics = await analyzeTruePeaks(
        leftChannel, 
        rightChannel, 
        CORE_METRICS_CONFIG.SAMPLE_RATE
      );

      // Validar True Peak
      if (!isFinite(truePeakMetrics.true_peak_dbtp) || !isFinite(truePeakMetrics.true_peak_linear)) {
        throw makeErr('core_metrics', `Invalid true peak values: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'invalid_truepeak');
      }

      // Verificar range realista
      if (truePeakMetrics.true_peak_dbtp > 20 || truePeakMetrics.true_peak_dbtp < -100) {
        throw makeErr('core_metrics', `True peak out of realistic range: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'truepeak_range_error');
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

  calculateSpectralCentroid(magnitude) {
    // IMPLEMENTAÇÃO MATEMÁTICA PADRÃO: centroid = Σ(f * magnitude(f)) / Σ magnitude(f)
    let weightedSum = 0;
    let totalMagnitude = 0;
    
    const sampleRate = CORE_METRICS_CONFIG.SAMPLE_RATE;
    const fftSize = CORE_METRICS_CONFIG.FFT_SIZE;
    const frequencyResolution = sampleRate / fftSize; // Hz por bin
    
    // Começar do bin 1 para evitar DC component (0 Hz)
    for (let i = 1; i < magnitude.length; i++) {
      const frequency = i * frequencyResolution; // f em Hz
      const magnitudeValue = magnitude[i];
      
      weightedSum += frequency * magnitudeValue; // Σ(f * magnitude(f))
      totalMagnitude += magnitudeValue; // Σ magnitude(f)
    }
    
    // Retornar valor numérico em Hz ou null para silêncio absoluto
    if (totalMagnitude <= 0) {
      return null; // Silêncio absoluto - não mascarar com 0
    }
    
    const centroidHz = weightedSum / totalMagnitude;
    
    // Validação do resultado
    if (!isFinite(centroidHz) || centroidHz < 0 || centroidHz > sampleRate / 2) {
      return null; // Resultado inválido
    }
    
    return centroidHz; // Retorna sempre Number em Hz
  }

  calculateSpectralRolloff(magnitude, threshold = 0.85) {
    const totalEnergy = magnitude.reduce((sum, val) => sum + val ** 2, 0);
    const targetEnergy = totalEnergy * threshold;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitude.length; i++) {
      cumulativeEnergy += magnitude[i] ** 2;
      if (cumulativeEnergy >= targetEnergy) {
        return i / magnitude.length;
      }
    }
    return 1.0;
  }

  calculateSpectralFlatness(magnitude) {
    let geometricMean = 1;
    let arithmeticMean = 0;
    let validBins = 0;
    
    for (let i = 1; i < magnitude.length; i++) {
      if (magnitude[i] > 0) {
        geometricMean *= Math.pow(magnitude[i], 1 / (magnitude.length - 1));
        arithmeticMean += magnitude[i];
        validBins++;
      }
    }
    
    if (validBins === 0) return 0;
    
    arithmeticMean /= validBins;
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
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