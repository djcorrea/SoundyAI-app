// 🔊 LOUDNESS UTILS - Utilitários para medição precisa de LUFS/LRA
// Implementação simplificada baseada nos módulos existentes

/**
 * 🎛️ Constantes LUFS/EBU R128
 */
const LUFS_CONSTANTS = {
  ABSOLUTE_THRESHOLD: -70.0,    // LUFS absoluto
  RELATIVE_THRESHOLD: -10.0,    // LU relativo ao gated loudness
  BLOCK_DURATION: 0.4,          // 400ms blocks (M)
  SHORT_TERM_DURATION: 3.0,     // 3s short-term (S)
  REFERENCE_LEVEL: -23.0        // EBU R128 reference
};

/**
 * 🔧 Filtro Biquad simples
 */
class SimpleBiquadFilter {
  constructor(coeffs) {
    this.b = coeffs.b;
    this.a = coeffs.a;
    this.reset();
  }

  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(input) {
    const output = this.b[0] * input + this.b[1] * this.x1 + this.b[2] * this.x2
                  - this.a[1] * this.y1 - this.a[2] * this.y2;
    
    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;
    
    return output;
  }

  processChannel(channelData) {
    const output = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      output[i] = this.process(channelData[i]);
    }
    return output;
  }
}

/**
 * 🎚️ K-weighting Filter Chain simplificado
 */
class SimpleKWeightingFilter {
  constructor() {
    // Coeficientes K-weighting simplificados para 48kHz
    const preFilterCoeffs = {
      b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
      a: [1.0, -1.69065929318241, 0.73248077421585]
    };
    
    const rlbFilterCoeffs = {
      b: [1.0, -2.0, 1.0],
      a: [1.0, -1.99004745483398, 0.99007225036621]
    };

    this.preFilter = new SimpleBiquadFilter(preFilterCoeffs);
    this.rlbFilter = new SimpleBiquadFilter(rlbFilterCoeffs);
  }

  processChannel(channelData) {
    // Aplicar filtros em série: Pre-filter -> RLB filter
    const preFiltered = this.preFilter.processChannel(channelData);
    return this.rlbFilter.processChannel(preFiltered);
  }
}

/**
 * 🎯 Medidor LUFS simplificado
 */
class SimpleLUFSMeter {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.blockSize = Math.floor(sampleRate * LUFS_CONSTANTS.BLOCK_DURATION);
    this.hopSize = Math.floor(this.blockSize * 0.25); // 75% overlap
    
    this.kWeightingL = new SimpleKWeightingFilter();
    this.kWeightingR = new SimpleKWeightingFilter();
  }

  calculateLUFS(leftChannel, rightChannel) {
    console.log('🎛️ Calculando LUFS integrado (simplificado)...');
    
    // K-weighting nos canais
    const leftFiltered = this.kWeightingL.processChannel(leftChannel);
    const rightFiltered = this.kWeightingR.processChannel(rightChannel);
    
    // Calcular loudness de cada block (M = 400ms)
    const blockLoudness = this.calculateBlockLoudness(leftFiltered, rightFiltered);
    
    // Calcular short-term loudness (S = 3s)
    const shortTermLoudness = this.calculateShortTermLoudness(blockLoudness);
    
    // Gating para LUFS integrado
    const { integratedLoudness, gatedBlocks } = this.applyGating(blockLoudness);
    
    // LRA simplificado
    const lra = this.calculateLRA(shortTermLoudness);

    console.log(`✅ LUFS calculado: ${integratedLoudness.toFixed(1)} LUFS, LRA: ${lra.toFixed(1)} LU`);

    return {
      lufs_integrated: integratedLoudness,
      lufs_short_term: shortTermLoudness.length > 0 ? shortTermLoudness[shortTermLoudness.length - 1] : integratedLoudness,
      lra: lra,
      gating_stats: {
        total_blocks: blockLoudness.length,
        gated_blocks: gatedBlocks
      }
    };
  }

  calculateBlockLoudness(leftFiltered, rightFiltered) {
    const blocks = [];
    const numBlocks = Math.floor((leftFiltered.length - this.blockSize) / this.hopSize) + 1;
    
    for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
      const startSample = blockIdx * this.hopSize;
      const endSample = Math.min(startSample + this.blockSize, leftFiltered.length);
      
      let sumL = 0;
      let sumR = 0;
      const blockLength = endSample - startSample;
      
      for (let i = startSample; i < endSample; i++) {
        sumL += leftFiltered[i] * leftFiltered[i];
        sumR += rightFiltered[i] * rightFiltered[i];
      }
      
      // Mean square + channel weighting (L=1.0, R=1.0 para stereo)
      const meanSquareL = sumL / blockLength;
      const meanSquareR = sumR / blockLength;
      const totalMeanSquare = meanSquareL + meanSquareR;
      
      // Convert to LUFS (-0.691 offset para referência)
      const loudness = totalMeanSquare > 0 ? 
        -0.691 + 10 * Math.log10(totalMeanSquare) : 
        -Infinity;
      
      blocks.push({
        loudness,
        timestamp: startSample / this.sampleRate
      });
    }
    
    return blocks;
  }

  calculateShortTermLoudness(blockLoudness) {
    const shortTermBlocks = Math.floor(LUFS_CONSTANTS.SHORT_TERM_DURATION / LUFS_CONSTANTS.BLOCK_DURATION);
    const shortTermLoudness = [];
    
    for (let i = 0; i <= blockLoudness.length - shortTermBlocks; i++) {
      let sumLinear = 0;
      let validBlocks = 0;
      
      for (let j = 0; j < shortTermBlocks; j++) {
        const loudness = blockLoudness[i + j].loudness;
        if (loudness > -Infinity) {
          sumLinear += Math.pow(10, loudness / 10);
          validBlocks++;
        }
      }
      
      if (validBlocks > 0) {
        const avgLinear = sumLinear / validBlocks;
        const shortTermLUFS = -0.691 + 10 * Math.log10(avgLinear);
        shortTermLoudness.push(shortTermLUFS);
      }
    }
    
    return shortTermLoudness;
  }

  applyGating(blockLoudness) {
    // Extrair valores de loudness válidos
    const loudnessValues = blockLoudness
      .map(block => block.loudness)
      .filter(loudness => loudness > LUFS_CONSTANTS.ABSOLUTE_THRESHOLD);
    
    if (loudnessValues.length === 0) {
      return { integratedLoudness: -Infinity, gatedBlocks: 0 };
    }
    
    // Primeiro passo: média sem gating relativo
    const firstPassLinear = loudnessValues.reduce((sum, loudness) => {
      return sum + Math.pow(10, loudness / 10);
    }, 0) / loudnessValues.length;
    
    const firstPassLUFS = -0.691 + 10 * Math.log10(firstPassLinear);
    
    // Segundo passo: gating relativo (-10 LU)
    const relativeThreshold = firstPassLUFS + LUFS_CONSTANTS.RELATIVE_THRESHOLD;
    const gatedValues = loudnessValues.filter(loudness => loudness >= relativeThreshold);
    
    if (gatedValues.length === 0) {
      return { integratedLoudness: firstPassLUFS, gatedBlocks: loudnessValues.length };
    }
    
    // Média final dos blocos filtrados
    const gatedLinear = gatedValues.reduce((sum, loudness) => {
      return sum + Math.pow(10, loudness / 10);
    }, 0) / gatedValues.length;
    
    const integratedLoudness = -0.691 + 10 * Math.log10(gatedLinear);
    
    return { integratedLoudness, gatedBlocks: gatedValues.length };
  }

  calculateLRA(shortTermLoudness) {
    if (shortTermLoudness.length === 0) return 0;
    
    // Filtrar valores válidos e ordenar
    const validValues = shortTermLoudness.filter(v => v > LUFS_CONSTANTS.ABSOLUTE_THRESHOLD).sort((a, b) => a - b);
    
    if (validValues.length < 2) return 0;
    
    // Percentis 10% e 95%
    const p10Index = Math.floor(validValues.length * 0.10);
    const p95Index = Math.floor(validValues.length * 0.95);
    
    const p10 = validValues[p10Index];
    const p95 = validValues[Math.min(p95Index, validValues.length - 1)];
    
    return Math.max(0, p95 - p10);
  }
}

/**
 * 🏔️ Detector True Peak simplificado
 */
class SimpleTruePeakDetector {
  constructor(oversamplingFactor = 4) {
    this.oversamplingFactor = oversamplingFactor;
  }

  analyzeTruePeaks(leftChannel, rightChannel) {
    console.log('🏔️ Analisando True Peaks (simplificado)...');
    
    const leftTruePeak = this.detectChannelTruePeak(leftChannel);
    const rightTruePeak = this.detectChannelTruePeak(rightChannel);
    
    const maxTruePeakLinear = Math.max(leftTruePeak.peak, rightTruePeak.peak);
    const maxTruePeakDbtp = maxTruePeakLinear > 0 ? 20 * Math.log10(maxTruePeakLinear) : -Infinity;
    
    // Detecção de clipping simplificada
    const clippingThreshold = 0.99; // -0.09 dBFS
    const totalClipping = leftTruePeak.clipping + rightTruePeak.clipping;
    
    console.log(`✅ True Peak: ${maxTruePeakDbtp.toFixed(2)} dBTP`);
    
    return {
      true_peak_dbtp: maxTruePeakDbtp,
      true_peak_linear: maxTruePeakLinear,
      left_peak_dbtp: leftTruePeak.peak > 0 ? 20 * Math.log10(leftTruePeak.peak) : -Infinity,
      right_peak_dbtp: rightTruePeak.peak > 0 ? 20 * Math.log10(rightTruePeak.peak) : -Infinity,
      clipping_samples: totalClipping,
      clipping_percentage: (totalClipping / (leftChannel.length + rightChannel.length)) * 100,
      exceeds_minus1dbtp: maxTruePeakDbtp > -1.0,
      exceeds_0dbtp: maxTruePeakDbtp > 0.0,
      broadcast_compliant: maxTruePeakDbtp <= -1.0,
      oversampling_factor: this.oversamplingFactor,
      algorithm: 'simple_interpolation'
    };
  }

  detectChannelTruePeak(channel) {
    // Upsampling com interpolação linear simples
    const upsampledLength = channel.length * this.oversamplingFactor;
    const upsampled = new Float32Array(upsampledLength);
    
    // Zero-stuffing + interpolação linear
    for (let i = 0; i < channel.length - 1; i++) {
      const current = channel[i];
      const next = channel[i + 1];
      
      for (let j = 0; j < this.oversamplingFactor; j++) {
        const fraction = j / this.oversamplingFactor;
        upsampled[i * this.oversamplingFactor + j] = current * (1 - fraction) + next * fraction;
      }
    }
    
    // Última amostra
    upsampled[upsampledLength - 1] = channel[channel.length - 1];
    
    // Encontrar peak absoluto
    let maxPeak = 0;
    let clippingCount = 0;
    const clippingThreshold = 0.99;
    
    for (let i = 0; i < upsampled.length; i++) {
      const absSample = Math.abs(upsampled[i]);
      if (absSample > maxPeak) {
        maxPeak = absSample;
      }
      if (absSample >= clippingThreshold) {
        clippingCount++;
      }
    }
    
    return {
      peak: maxPeak,
      clipping: clippingCount
    };
  }
}

/**
 * 🎛️ Função principal para calcular LUFS/LRA
 */
function calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate = 48000) {
  const meter = new SimpleLUFSMeter(sampleRate);
  return meter.calculateLUFS(leftChannel, rightChannel);
}

/**
 * 🏔️ Função principal para analisar True Peaks
 */
function analyzeTruePeaks(leftChannel, rightChannel, sampleRate = 48000) {
  const detector = new SimpleTruePeakDetector(4); // 4x oversampling
  return detector.analyzeTruePeaks(leftChannel, rightChannel);
}

/**
 * 🔧 Calcular ganho de normalização LUFS
 */
function calculateNormalizationGain(currentLUFS, targetLUFS, currentTruePeak, truePeakCeiling) {
  // Ganho básico para atingir target LUFS
  const basicGainDb = targetLUFS - currentLUFS;
  
  // Verificar se True Peak projetado excede o teto
  const projectedTruePeak = currentTruePeak + basicGainDb;
  
  if (projectedTruePeak > truePeakCeiling) {
    // Reduzir ganho para respeitar o teto
    const reduction = projectedTruePeak - truePeakCeiling;
    const finalGainDb = basicGainDb - reduction;
    
    return {
      gainDb: finalGainDb,
      limitedByTruePeak: true,
      reduction: reduction,
      projectedLUFS: targetLUFS - reduction,
      projectedTruePeak: truePeakCeiling
    };
  }
  
  return {
    gainDb: basicGainDb,
    limitedByTruePeak: false,
    reduction: 0,
    projectedLUFS: targetLUFS,
    projectedTruePeak: projectedTruePeak
  };
}

/**
 * 🔊 Aplicar ganho estático (linear)
 */
function applyStaticGain(leftChannel, rightChannel, gainDb) {
  const gainLinear = Math.pow(10, gainDb / 20);
  
  const normalizedLeft = new Float32Array(leftChannel.length);
  const normalizedRight = new Float32Array(rightChannel.length);
  
  for (let i = 0; i < leftChannel.length; i++) {
    normalizedLeft[i] = leftChannel[i] * gainLinear;
    normalizedRight[i] = rightChannel[i] * gainLinear;
  }
  
  return { normalizedLeft, normalizedRight, gainLinear };
}

module.exports = {
  SimpleLUFSMeter,
  SimpleTruePeakDetector,
  SimpleKWeightingFilter,
  calculateLoudnessMetrics,
  analyzeTruePeaks,
  calculateNormalizationGain,
  applyStaticGain,
  LUFS_CONSTANTS
};
