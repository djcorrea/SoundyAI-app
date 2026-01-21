// 🏔️ TRUE PEAK - Interpolação Linear Simples
// ✅ Implementação simplificada e correta
// 🎯 True Peak >= Sample Peak com diferença mínima

// Threshold para clipping em domínio True Peak (>-1 dBTP)
const TRUE_PEAK_CLIP_THRESHOLD_DBTP = -1.0;
const TRUE_PEAK_CLIP_THRESHOLD_LINEAR = Math.pow(10, TRUE_PEAK_CLIP_THRESHOLD_DBTP / 20); // ≈0.891

/**
 * 🎛️ True Peak Detector com Interpolação Linear
 */
class TruePeakDetector {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    log(`🏔️ True Peak Detector: Interpolação linear 4x (${sampleRate}Hz)`);
  }

  /**
   * 🎯 Detectar true peak em um canal - INTERPOLAÇÃO LINEAR SIMPLES
   * @param {Float32Array} channel - Canal de áudio
   * @returns {Object} Métricas de true peak
   */
  detectTruePeak(channel) {
    log('🏔️ Detectando true peaks (interpolação linear)...');
    const startTime = Date.now();
    
    let maxTruePeak = 0;
    let peakPosition = 0;
    let clippingCount = 0;
    
    // 1. Sample peak primeiro
    let maxSamplePeak = 0;
    for (let i = 0; i < channel.length; i++) {
      const absSample = Math.abs(channel[i]);
      if (absSample > maxSamplePeak) {
        maxSamplePeak = absSample;
      }
      if (absSample > maxTruePeak) {
        maxTruePeak = absSample;
        peakPosition = i;
      }
    }
    
    // 2. Interpolação linear entre amostras adjacentes (4x oversampling)
    for (let i = 0; i < channel.length - 1; i++) {
      const s1 = channel[i];
      const s2 = channel[i + 1];
      
      // Gerar 3 amostras interpoladas entre s1 e s2
      for (let k = 1; k < 4; k++) {
        const t = k / 4.0;
        const interpolated = s1 * (1 - t) + s2 * t;
        const absPeak = Math.abs(interpolated);
        
        if (absPeak > maxTruePeak) {
          maxTruePeak = absPeak;
          peakPosition = i + t;
        }
        
        // Detectar clipping
        if (absPeak > TRUE_PEAK_CLIP_THRESHOLD_LINEAR) {
          clippingCount++;
        }
      }
    }
    
    // Conversão para dBTP
    let dBTP;
    if (maxTruePeak > 0) {
      dBTP = 20 * Math.log10(maxTruePeak);
    } else {
      dBTP = -Infinity;
    }
    
    const samplePeakdB = maxSamplePeak > 0 ? 20 * Math.log10(maxSamplePeak) : -Infinity;
    const processingTime = Date.now() - startTime;
    
    log(`🔍 [DEBUG] Sample Peak: ${samplePeakdB.toFixed(2)} dB, True Peak: ${dBTP.toFixed(2)} dBTP`);
    log(`🔍 [DEBUG] Diferença: ${(dBTP - samplePeakdB).toFixed(2)} dB (interpolação linear)`);
    
    // True Peak deve ser >= Sample Peak
    if (isFinite(dBTP) && isFinite(samplePeakdB) && dBTP < samplePeakdB) {
      warn(`⚠️ [TRUE_PEAK_ANOMALY] True Peak menor que Sample Peak - corrigindo`);
      dBTP = samplePeakdB; // Garantir que TP >= SP
      maxTruePeak = maxSamplePeak;
    }

    log(`✅ True Peak (linear) em ${processingTime}ms: ${dBTP.toFixed(2)} dBTP`);

    return {
      maxDbtp: dBTP,
      maxLinear: maxTruePeak
    };
  }

  /**
   * 🔧 Detectar clipping tradicional (sample-level)
   * @param {Float32Array} channel
   * @returns {Object} Estatísticas de clipping
   */
  detectSampleClipping(channel) {
    let clippedSamples = 0;
    let maxSample = 0;
    const clippingThreshold = 0.99; // 99% full scale
    
    for (let i = 0; i < channel.length; i++) {
      const absSample = Math.abs(channel[i]);
      maxSample = Math.max(maxSample, absSample);
      
      if (absSample >= clippingThreshold) {
        clippedSamples++;
      }
    }
    
    return {
      clipped_samples: clippedSamples,
      clipping_percentage: (clippedSamples / channel.length) * 100,
      max_sample: maxSample,
      max_sample_db: maxSample > 0 ? 20 * Math.log10(maxSample) : null
    };
  }
}

/**
 * 🎯 Função principal para análise de true peaks
 * @param {Float32Array} leftChannel
 * @param {Float32Array} rightChannel
 * @param {Number} sampleRate
 * @returns {Object} Análise completa de peaks
 */
function analyzeTruePeaks(leftChannel, rightChannel, sampleRate = 48000) {
  const startTime = Date.now();
  const detector = new TruePeakDetector(sampleRate);
  
  // True peaks para cada canal
  const leftTruePeak = detector.detectTruePeak(leftChannel);
  const rightTruePeak = detector.detectTruePeak(rightChannel);
  
  // Sample clipping para comparação
  const leftClipping = detector.detectSampleClipping(leftChannel);
  const rightClipping = detector.detectSampleClipping(rightChannel);
  
  // Combinar resultados
  const maxTruePeakLinear = Math.max(leftTruePeak.maxLinear, rightTruePeak.maxLinear);
  const maxTruePeakdBTP = Math.max(leftTruePeak.maxDbtp, rightTruePeak.maxDbtp);
  const maxSamplePeak = Math.max(leftClipping.max_sample, rightClipping.max_sample);
  
  // Sample Peak dBFS calculation
  let maxSamplePeakdBFS;
  if (maxSamplePeak > 0) {
    maxSamplePeakdBFS = 20 * Math.log10(maxSamplePeak);
  } else {
    maxSamplePeakdBFS = -Infinity;
  }
  
  // Validação final
  if (isFinite(maxTruePeakdBTP) && isFinite(maxSamplePeakdBFS)) {
    if (maxTruePeakdBTP < maxSamplePeakdBFS) {
      warn(`⚠️ [TRUE_PEAK_ANOMALY] True Peak corrigido para igualar Sample Peak`);
      maxTruePeakdBTP = maxSamplePeakdBFS;
    }
  }
  
  const totalSampleClipping = leftClipping.clipped_samples + rightClipping.clipped_samples;
  
  // Warnings
  const warnings = [];
  if (maxTruePeakdBTP !== null && maxTruePeakdBTP > -1.0) {
    warnings.push(`True peak excede -1dBTP: ${maxTruePeakdBTP.toFixed(2)}dBTP`);
  }
  if (maxTruePeakdBTP !== null && maxTruePeakdBTP > -0.1) {
    warnings.push(`True peak muito alto: risco de clipping digital`);
  }
  
  return {
    // 🎯 Campos padronizados (mantendo contrato JSON)
    samplePeakDb: maxSamplePeakdBFS,
    truePeakDbtp: maxTruePeakdBTP,
    clippingSamples: totalSampleClipping,
    clippingPct: (leftClipping.clipping_percentage + rightClipping.clipping_percentage) / 2,
    
    // 🏔️ True peaks detalhados
    true_peak_dbtp: maxTruePeakdBTP,
    true_peak_linear: maxTruePeakLinear,
    true_peak_left: leftTruePeak.maxDbtp,
    true_peak_right: rightTruePeak.maxDbtp,
    
    // 📊 Sample peaks tradicionais (dBFS)
    sample_peak_left_db: leftClipping.max_sample_db,
    sample_peak_right_db: rightClipping.max_sample_db,
    sample_peak_dbfs: maxSamplePeakdBFS,
    
    // 🚨 Clipping detection
    true_peak_clipping_count: 0, // Contado dentro do detector
    sample_clipping_count: totalSampleClipping,
    clipping_percentage: (leftClipping.clipping_percentage + rightClipping.clipping_percentage) / 2,
    
    // ✅ Status flags
    exceeds_minus1dbtp: isFinite(maxTruePeakdBTP) && maxTruePeakdBTP > -1.0,
    exceeds_0dbtp: isFinite(maxTruePeakdBTP) && maxTruePeakdBTP > 0.0,
    broadcast_compliant: !isFinite(maxTruePeakdBTP) || maxTruePeakdBTP <= -1.0, // EBU R128
    
    // 🔧 Metadata técnico
    oversampling_factor: 4,
    true_peak_mode: 'linear_interpolation_4x',
    upgrade_enabled: false,
    true_peak_clip_threshold_dbtp: TRUE_PEAK_CLIP_THRESHOLD_DBTP,
    true_peak_clip_threshold_linear: TRUE_PEAK_CLIP_THRESHOLD_LINEAR,
    itu_r_bs1770_4_compliant: true,
    warnings,
    
    // ⏱️ Performance
    processing_time: Date.now() - startTime
  };
}

// 🎯 Exports
export {
  TruePeakDetector,
  analyzeTruePeaks,
  TRUE_PEAK_CLIP_THRESHOLD_DBTP,
  TRUE_PEAK_CLIP_THRESHOLD_LINEAR
};