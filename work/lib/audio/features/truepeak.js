// 🏔️ TRUE PEAK - Oversampling 4× (legado) e modo upgrade 8× com FIR polyphase
// Implementação ITU-R BS.1770-4 para detecção de true peaks
// Upgrade adiciona filtro windowed-sinc 192 taps (8×) atrás de feature flags (AUDIT_MODE / TP_UPGRADE)

/**
 * 🎯 FIR Polyphase Coefficients para oversampling 4×
 * Baseado em filtro anti-aliasing Nyquist para 192kHz
 */
const POLYPHASE_COEFFS = {
  // Coeficientes do filtro FIR (48 taps, cutoff ~20kHz para 4× upsample)
  TAPS: [
    0.0, -0.000015258789, -0.000015258789, -0.000015258789,
    -0.000030517578, -0.000030517578, -0.000061035156, -0.000076293945,
    -0.000122070312, -0.000137329102, -0.000198364258, -0.000244140625,
    -0.000320434570, -0.000396728516, -0.000534057617, -0.000686645508,
    -0.000869750977, -0.001098632812, -0.001373291016, -0.001693725586,
    -0.002075195312, -0.002532958984, -0.003051757812, -0.003646850586,
    -0.004333496094, -0.005126953125, -0.006011962891, -0.007003784180,
    -0.008117675781, -0.009368896484, -0.010772705078, -0.012344360352,
    -0.014099121094, -0.016052246094, -0.018218994141, -0.020614624023,
    -0.023254394531, -0.026153564453, -0.029327392578, -0.032791137695,
    -0.036560058594, -0.040649414062, -0.045074462891, -0.049850463867,
    -0.054992675781, -0.060516357422, -0.066436767578, -0.072769165039
  ],
  LENGTH: 48,
  UPSAMPLING_FACTOR: 4
};

// 🔐 Feature flags (não quebrar comportamento existente por default)
const AUDIT_MODE = typeof process !== 'undefined' && process.env && process.env.AUDIT_MODE === '1';
// Ativa upgrade se TP_UPGRADE=1 OU (AUDIT_MODE e TP_UPGRADE != 0)
const TP_UPGRADE = typeof process !== 'undefined' && process.env && (
  process.env.TP_UPGRADE === '1' || (AUDIT_MODE && process.env.TP_UPGRADE !== '0')
);

// 🧪 Função para desenhar lowpass windowed-sinc para oversampling
function designWindowedSincLowpass(upsamplingFactor = 8, totalTaps = 192) {
  // Cutoff ~ Nyquist original => π / upsamplingFactor (em rad/s normalizados)
  const cutoff = Math.PI / upsamplingFactor; // radianos
  const taps = new Array(totalTaps).fill(0);
  const M = totalTaps - 1;
  for (let n = 0; n < totalTaps; n++) {
    const k = n - M / 2;
    // Sinc principal (sin(x)/x) para lowpass
    let sinc;
    if (Math.abs(k) < 1e-12) {
      sinc = cutoff / Math.PI; // limite quando k -> 0
    } else {
      sinc = Math.sin(cutoff * k) / (Math.PI * k);
    }
    // Hamming window
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / M);
    taps[n] = sinc * w;
  }
  // Normalização (ganho unidade em DC)
  const sum = taps.reduce((a, b) => a + b, 0);
  for (let i = 0; i < taps.length; i++) taps[i] /= sum;
  return taps;
}

// 📈 Coeficientes upgrade (gerados dinamicamente para evitar poluir bundle se não usados)
let POLYPHASE_COEFFS_UPGRADED = null;
function getUpgradedCoeffs() {
  if (!POLYPHASE_COEFFS_UPGRADED) {
    const taps = designWindowedSincLowpass(8, 192); // 192 taps, 8×
    POLYPHASE_COEFFS_UPGRADED = {
      TAPS: taps,
      LENGTH: taps.length,
      UPSAMPLING_FACTOR: 8
    };
  }
  return POLYPHASE_COEFFS_UPGRADED;
}

/**
 * 🎛️ True Peak Detector com Oversampling
 */
// Threshold unificado para clipping em domínio True Peak (>-1 dBTP)
const TRUE_PEAK_CLIP_THRESHOLD_DBTP = -1.0;
const TRUE_PEAK_CLIP_THRESHOLD_LINEAR = Math.pow(10, TRUE_PEAK_CLIP_THRESHOLD_DBTP / 20); // ≈0.891

class TruePeakDetector {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.upgradeEnabled = !!TP_UPGRADE;
    this.coeffs = this.upgradeEnabled ? getUpgradedCoeffs() : POLYPHASE_COEFFS;
    this.upsampleRate = sampleRate * this.coeffs.UPSAMPLING_FACTOR;
    this.delayLine = new Float32Array(this.coeffs.LENGTH);
    this.delayIndex = 0;
    console.log(`🏔️ True Peak Detector: ${sampleRate}Hz → ${this.upsampleRate}Hz oversampling (${this.upgradeEnabled ? 'upgrade 8× / 192 taps' : 'legacy 4× / 48 taps'})`);
  }

  /**
   * 🎯 Detectar true peak em um canal
   * @param {Float32Array} channel - Canal de áudio
   * @returns {Object} Métricas de true peak
   */
  detectTruePeak(channel) {
    console.log('🏔️ Detectando true peaks...');
    const startTime = Date.now();
    
    let maxTruePeak = 0;
    let peakPosition = 0;
    let clippingCount = 0; // contagem de eventos de clipping em domínio oversampled (true peak)
    
    // Reset delay line
    this.delayLine.fill(0);
    this.delayIndex = 0;
    
    // Processar cada sample com oversampling (4× legacy ou 8× upgrade)
    for (let i = 0; i < channel.length; i++) {
      const inputSample = channel[i];
      
      // Upsample e calcular interpolated peaks
      const upsampledPeaks = this.upsamplePolyphase(inputSample);
      
      // Encontrar peak máximo entre os upsampled values
      for (let j = 0; j < upsampledPeaks.length; j++) {
        const absPeak = Math.abs(upsampledPeaks[j]);
        
        if (absPeak > maxTruePeak) {
          maxTruePeak = absPeak;
          peakPosition = i + (j / this.coeffs.UPSAMPLING_FACTOR);
        }
        
  // Detectar clipping em true peak usando threshold unificado
  if (absPeak > TRUE_PEAK_CLIP_THRESHOLD_LINEAR) {
          clippingCount++;
        }
      }
    }
    
    // Converter para dBTP - CORREÇÃO: usar null para silêncio, não -Infinity
    let maxTruePeakdBTP;
    if (maxTruePeak > 0) {
      maxTruePeakdBTP = 20 * Math.log10(maxTruePeak);
    } else if (maxTruePeak === 0) {
      // Silêncio digital: -Infinity matemático, mas reportar como null
      maxTruePeakdBTP = null;
    } else {
      // Erro: true peak não pode ser negativo
      console.warn(`⚠️ True Peak negativo detectado: ${maxTruePeak}`);
      maxTruePeakdBTP = null;
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ True Peak detectado em ${processingTime}ms:`, {
      peak: `${maxTruePeakdBTP.toFixed(2)} dBTP`,
      position: `${peakPosition.toFixed(1)} samples`,
      clipping: clippingCount > 0 ? `${clippingCount} clips` : 'none'
    });
    
    return {
      true_peak_linear: maxTruePeak,
      true_peak_dbtp: maxTruePeakdBTP,
      peak_position: peakPosition,
      clipping_count: clippingCount,
      exceeds_minus1dbtp: maxTruePeakdBTP > -1.0,
      true_peak_clip_threshold_dbtp: TRUE_PEAK_CLIP_THRESHOLD_DBTP,
      true_peak_clip_threshold_linear: TRUE_PEAK_CLIP_THRESHOLD_LINEAR,
      processing_time: processingTime,
      oversampling_factor: this.coeffs.UPSAMPLING_FACTOR,
      true_peak_mode: this.upgradeEnabled ? 'oversampling8x_192tap' : 'legacy4x_48tap',
      upgrade_enabled: this.upgradeEnabled
    };
  }

  /**
   * 🔄 Upsample genérico polyphase (4× ou 8×)
   * Mantém API legada (método upsample4x segue chamando este quando modo legacy).
   */
  upsamplePolyphase(inputSample) {
    this.delayLine[this.delayIndex] = inputSample;
    this.delayIndex = (this.delayIndex + 1) % this.coeffs.LENGTH;
    const factor = this.coeffs.UPSAMPLING_FACTOR;
    const upsampled = new Float32Array(factor);
    for (let phase = 0; phase < factor; phase++) {
      let output = 0;
      for (let tap = 0; tap < this.coeffs.LENGTH; tap += factor) {
        const coeffIndex = tap + phase;
        if (coeffIndex < this.coeffs.TAPS.length) {
          const delayIndex = (this.delayIndex - tap + this.coeffs.LENGTH) % this.coeffs.LENGTH;
          output += this.delayLine[delayIndex] * this.coeffs.TAPS[coeffIndex];
        }
      }
      // Filtro polyphase já aplica ganho correto - remover ganho duplo
      upsampled[phase] = output;
    }
    return upsampled;
  }

  // ⚠️ Legado: manter para evitar quebra caso algum código externo chame diretamente
  upsample4x(inputSample) {
    return this.upsamplePolyphase(inputSample);
  }

  /**
   * 🔧 Detectar clipping tradicional e sample peak
   * ✅ CORRIGIDO: Sample Peak é diferente de True Peak - sem oversampling
   * @param {Float32Array} channel
   * @returns {Object} Estatísticas de clipping e sample peak tradicional
   */
  detectSampleClipping(channel) {
    let clippedSamples = 0;
    let maxSampleLinear = 0;
    const clippingThreshold = 0.99; // 99% full scale para clipping detection
    
    // ✅ SAMPLE PEAK: buscar o maior valor absoluto nas amostras originais
    // IMPORTANTE: Isso é diferente do True Peak que usa oversampling/interpolação
    for (let i = 0; i < channel.length; i++) {
      const absSample = Math.abs(channel[i]);
      
      // Sample Peak: valor máximo absoluto sem interpolação
      if (absSample > maxSampleLinear) {
        maxSampleLinear = absSample;
      }
      
      // Clipping detection: threshold de 99%
      if (absSample >= clippingThreshold) {
        clippedSamples++;
      }
    }
    
    return {
      clipped_samples: clippedSamples,
      clipping_percentage: (clippedSamples / channel.length) * 100,
      max_sample: maxSampleLinear,
      max_sample_db: maxSampleLinear > 0 ? 20 * Math.log10(maxSampleLinear) : null,
      // Metadados para diferenciação
      algorithm: 'traditional_sample_peak',
      note: 'Sample Peak ≠ True Peak (sem oversampling)',
      samples_analyzed: channel.length
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
  const detector = new TruePeakDetector(sampleRate);
  
  // True peaks para cada canal
  const leftTruePeak = detector.detectTruePeak(leftChannel);
  const rightTruePeak = detector.detectTruePeak(rightChannel);
  
  // Sample clipping para comparação
  const leftClipping = detector.detectSampleClipping(leftChannel);
  const rightClipping = detector.detectSampleClipping(rightChannel);
  
  // Combinar resultados
  const maxTruePeak = Math.max(leftTruePeak.true_peak_linear, rightTruePeak.true_peak_linear);
  let maxTruePeakdBTP;
  if (maxTruePeak > 0) {
    maxTruePeakdBTP = 20 * Math.log10(maxTruePeak);
  } else {
    maxTruePeakdBTP = null; // Silêncio digital
  }
  const totalClipping = leftTruePeak.clipping_count + rightTruePeak.clipping_count;
  
  // Warnings
  const warnings = [];
  if (maxTruePeakdBTP !== null && maxTruePeakdBTP > -1.0) {
    warnings.push(`True peak excede -1dBTP: ${maxTruePeakdBTP.toFixed(2)}dBTP`);
  }
  if (maxTruePeakdBTP !== null && maxTruePeakdBTP > -0.1) {
    warnings.push(`True peak muito alto: risco de clipping digital`);
  }
  if (totalClipping > 0) {
    warnings.push(`${totalClipping} amostras com true peak clipping detectado`);
  }
  
  return {
    // True peaks
    true_peak_dbtp: maxTruePeakdBTP,
    true_peak_linear: maxTruePeak,
    true_peak_left: leftTruePeak.true_peak_dbtp,
    true_peak_right: rightTruePeak.true_peak_dbtp,
    
    // Sample peaks (tradicional)
    sample_peak_left_db: leftClipping.max_sample_db,
    sample_peak_right_db: rightClipping.max_sample_db,
    
    // Clipping detection
  true_peak_clipping_count: totalClipping,
    sample_clipping_count: leftClipping.clipped_samples + rightClipping.clipped_samples,
    clipping_percentage: (leftClipping.clipping_percentage + rightClipping.clipping_percentage) / 2,
    
    // Status flags
    exceeds_minus1dbtp: maxTruePeakdBTP > -1.0,
    exceeds_0dbtp: maxTruePeakdBTP > 0.0,
    broadcast_compliant: maxTruePeakdBTP <= -1.0, // EBU R128
    
  // Metadata (reflete modo do detector — left/right iguais)
  oversampling_factor: detector.coeffs.UPSAMPLING_FACTOR,
  true_peak_mode: leftTruePeak.true_peak_mode,
  upgrade_enabled: leftTruePeak.upgrade_enabled,
  true_peak_clip_threshold_dbtp: TRUE_PEAK_CLIP_THRESHOLD_DBTP,
  true_peak_clip_threshold_linear: TRUE_PEAK_CLIP_THRESHOLD_LINEAR,
    warnings,
    
    // Performance
  processing_time: leftTruePeak.processing_time + rightTruePeak.processing_time
  };
}

// 🎯 Exports
export {
  TruePeakDetector,
  analyzeTruePeaks,
  POLYPHASE_COEFFS,
  TRUE_PEAK_CLIP_THRESHOLD_DBTP,
  TRUE_PEAK_CLIP_THRESHOLD_LINEAR
};
