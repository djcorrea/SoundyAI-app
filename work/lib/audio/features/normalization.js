// 🎛️ NORMALIZAÇÃO PRÉ-ANÁLISE - Fase 5.1.5
// Normalização automática para -23 LUFS antes de toda análise
// Preserva LUFS original como offset para relatório final

import { calculateLoudnessMetricsCorrected as calculateLoudnessMetrics } from '../features/loudness.js';
import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🎯 CONFIGURAÇÕES DE NORMALIZAÇÃO
 */
const NORMALIZATION_CONFIG = {
  TARGET_LUFS: -23.0,           // EBU R128 reference level
  MIN_GAIN_DB: -20.0,           // Máximo de redução permitida
  MAX_GAIN_DB: 20.0,            // Máximo de aumento permitido
  SILENCE_THRESHOLD_LUFS: -80.0, // Considerar silêncio se LUFS < -80
  QUICK_LUFS_DURATION: 1.0      // Usar 1s para cálculo rápido inicial
};

/**
 * 🔧 Calcular LUFS rápido para normalização
 * Versão otimizada que usa apenas 1 segundo do áudio para calcular ganho
 */
async function calculateQuickLUFS(leftChannel, rightChannel, sampleRate) {
  try {
    // Usar apenas os primeiros N segundos para cálculo rápido
    const quickDuration = Math.min(NORMALIZATION_CONFIG.QUICK_LUFS_DURATION, leftChannel.length / sampleRate);
    const quickSamples = Math.floor(quickDuration * sampleRate);
    
    const quickLeft = leftChannel.slice(0, quickSamples);
    const quickRight = rightChannel.slice(0, quickSamples);
    
    logAudio('normalization', 'quick_lufs_start', { 
      duration: quickDuration,
      samples: quickSamples 
    });
    
    const lufsResult = await calculateLoudnessMetrics(quickLeft, quickRight, sampleRate);
    
    if (!lufsResult || !isFinite(lufsResult.lufs_integrated)) {
      throw new Error('Invalid LUFS calculation result');
    }
    
    return lufsResult.lufs_integrated;
    
  } catch (error) {
    logAudio('normalization', 'quick_lufs_error', { error: error.message });
    throw makeErr('normalization', `Quick LUFS calculation failed: ${error.message}`, 'quick_lufs_error');
  }
}

/**
 * 🎛️ Normalizar áudio para target LUFS
 * @param {Object} audioData - Dados de áudio com leftChannel e rightChannel
 * @param {number} sampleRate - Sample rate do áudio
 * @param {Object} options - Opções de normalização
 * @returns {Object} Áudio normalizado + metadata de normalização
 */
export async function normalizeAudioToTargetLUFS(audioData, sampleRate, options = {}) {
  const startTime = Date.now();
  const jobId = options.jobId || 'unknown';
  const targetLUFS = options.targetLUFS || NORMALIZATION_CONFIG.TARGET_LUFS;
  
  logAudio('normalization', 'start', { 
    targetLUFS, 
    jobId: jobId.substring(0, 8),
    duration: audioData.leftChannel.length / sampleRate 
  });
  
  try {
    // 1. Calcular LUFS original (rápido)
    const originalLUFS = await calculateQuickLUFS(
      audioData.leftChannel, 
      audioData.rightChannel, 
      sampleRate
    );
    
    logAudio('normalization', 'original_lufs', { 
      originalLUFS: originalLUFS.toFixed(2) 
    });
    
    // 2. Verificar se é silêncio digital
    if (originalLUFS < NORMALIZATION_CONFIG.SILENCE_THRESHOLD_LUFS) {
      logAudio('normalization', 'silence_detected', { originalLUFS });
      
      return {
        leftChannel: audioData.leftChannel,
        rightChannel: audioData.rightChannel,
        normalizationApplied: false,
        originalLUFS,
        targetLUFS,
        gainAppliedDB: 0,
        isSilence: true,
        processingTime: Date.now() - startTime,
        metadata: {
          stage: 'normalization',
          status: 'silence_detected',
          reason: 'Audio below silence threshold'
        }
      };
    }
    
    // 3. Calcular ganho necessário
    const gainLU = targetLUFS - originalLUFS;
    const gainDB = gainLU; // LU = dB para ganho
    
    // 4. Verificar limites de ganho
    if (gainDB < NORMALIZATION_CONFIG.MIN_GAIN_DB) {
      logAudio('normalization', 'gain_limited', { 
        requestedGain: gainDB, 
        appliedGain: NORMALIZATION_CONFIG.MIN_GAIN_DB 
      });
      throw makeErr('normalization', `Required gain ${gainDB.toFixed(1)}dB exceeds minimum limit`, 'gain_limit_exceeded');
    }
    
    if (gainDB > NORMALIZATION_CONFIG.MAX_GAIN_DB) {
      logAudio('normalization', 'gain_limited', { 
        requestedGain: gainDB, 
        appliedGain: NORMALIZATION_CONFIG.MAX_GAIN_DB 
      });
      throw makeErr('normalization', `Required gain ${gainDB.toFixed(1)}dB exceeds maximum limit`, 'gain_limit_exceeded');
    }
    
    // 5. Aplicar ganho linear
    const gainLinear = Math.pow(10, gainDB / 20);
    
    logAudio('normalization', 'applying_gain', { 
      gainDB: gainDB.toFixed(2), 
      gainLinear: gainLinear.toFixed(4) 
    });
    
    // 6. Criar canais normalizados
    const normalizedLeft = new Float32Array(audioData.leftChannel.length);
    const normalizedRight = new Float32Array(audioData.rightChannel.length);
    
    for (let i = 0; i < audioData.leftChannel.length; i++) {
      normalizedLeft[i] = audioData.leftChannel[i] * gainLinear;
    }
    
    for (let i = 0; i < audioData.rightChannel.length; i++) {
      normalizedRight[i] = audioData.rightChannel[i] * gainLinear;
    }
    
    // 7. Verificar clipping
    const leftClipping = normalizedLeft.some(sample => Math.abs(sample) >= 0.99);
    const rightClipping = normalizedRight.some(sample => Math.abs(sample) >= 0.99);
    
    if (leftClipping || rightClipping) {
      logAudio('normalization', 'clipping_detected', { leftClipping, rightClipping });
      // Não falhar por clipping, apenas alertar
    }
    
    const processingTime = Date.now() - startTime;
    
    logAudio('normalization', 'completed', {
      originalLUFS: originalLUFS.toFixed(2),
      targetLUFS: targetLUFS.toFixed(2),
      gainApplied: gainDB.toFixed(2),
      processingTime,
      hasClipping: leftClipping || rightClipping
    });
    
    // 8. Retornar resultado completo
    return {
      leftChannel: normalizedLeft,
      rightChannel: normalizedRight,
      normalizationApplied: true,
      originalLUFS,
      targetLUFS,
      gainAppliedDB: gainDB,
      gainAppliedLinear: gainLinear,
      isSilence: false,
      hasClipping: leftClipping || rightClipping,
      processingTime,
      metadata: {
        stage: 'normalization',
        status: 'success',
        config: NORMALIZATION_CONFIG
      }
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logAudio('normalization', 'failed', { 
      error: error.message, 
      processingTime 
    });
    
    // Fallback seguro: retornar áudio original sem normalização
    return {
      leftChannel: audioData.leftChannel,
      rightChannel: audioData.rightChannel,
      normalizationApplied: false,
      originalLUFS: null,
      targetLUFS,
      gainAppliedDB: 0,
      isSilence: false,
      hasClipping: false,
      processingTime,
      error: error.message,
      metadata: {
        stage: 'normalization',
        status: 'failed',
        fallback: 'original_audio_preserved'
      }
    };
  }
}

/**
 * 📊 Validar normalização aplicada
 */
export async function validateNormalization(normalizedAudio, sampleRate, expectedLUFS) {
  try {
    const actualLUFS = await calculateQuickLUFS(
      normalizedAudio.leftChannel,
      normalizedAudio.rightChannel,
      sampleRate
    );
    
    const tolerance = 0.5; // ±0.5 LU tolerance
    const isValid = Math.abs(actualLUFS - expectedLUFS) <= tolerance;
    
    logAudio('normalization', 'validation', {
      expected: expectedLUFS.toFixed(2),
      actual: actualLUFS.toFixed(2),
      difference: (actualLUFS - expectedLUFS).toFixed(2),
      isValid
    });
    
    return {
      isValid,
      actualLUFS,
      expectedLUFS,
      difference: actualLUFS - expectedLUFS
    };
    
  } catch (error) {
    logAudio('normalization', 'validation_failed', { error: error.message });
    return {
      isValid: false,
      error: error.message
    };
  }
}

console.log('🎛️ Normalização Pré-Análise carregada - Target -23 LUFS');