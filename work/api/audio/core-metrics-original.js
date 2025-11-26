// 🎵 CORE METRICS - Fase 5.3 Pipeline Migration
// FFT, LUFS ITU-R BS.1770-4, True Peak 4x Oversampling, Stereo Analysis
// Migração equivalente das métricas do Web Audio API para Node.js

import { FastFFT } from "../../lib/audio/fft.js";
import { calculateLoudnessMetricsCorrected as calculateLoudnessMetrics } from "../../lib/audio/features/loudness.js";
import { TruePeakDetector } from "../../lib/audio/features/truepeak.js";

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
    console.log("✅ Core Metrics Processor inicializado (Fase 5.3)");
  }

  /**
   * PROCESSAMENTO PRINCIPAL
   */
  async processMetrics(segmentedAudio) {
    console.log("🚀 Iniciando cálculo de métricas core (Fase 5.3)...");
    const startTime = Date.now();

    this.validateInputFrom5_2(segmentedAudio);
    const { leftChannel, rightChannel } =
      this.ensureOriginalChannels(segmentedAudio);

    try {
      const fftResults = await this.calculateFFTMetrics(segmentedAudio.framesFFT);
      const lufsResults = await this.calculateLUFSMetrics(
        leftChannel,
        rightChannel,
        segmentedAudio.sampleRate
      );
      const truePeakResults = await this.calculateTruePeakMetrics(
        leftChannel,
        rightChannel,
        segmentedAudio.sampleRate
      );
      const stereoResults = await this.calculateStereoMetrics(
        leftChannel,
        rightChannel
      );

      const processingTime = Date.now() - startTime;

      const results = {
        originalLength: segmentedAudio.originalLength,
        sampleRate: segmentedAudio.sampleRate,
        duration: segmentedAudio.duration,
        numberOfChannels: segmentedAudio.numberOfChannels,

        fft: fftResults,
        lufs: lufsResults,
        truePeak: truePeakResults,
        stereo: stereoResults,

        _metadata: {
          phase: "5.3-core-metrics",
          processingTime,
          calculatedAt: new Date().toISOString(),
          inputSampleRate: segmentedAudio.sampleRate,
          inputChannels: segmentedAudio.numberOfChannels,
          config: {
            fft: {
              size: CORE_METRICS_CONFIG.FFT_SIZE,
              hop: CORE_METRICS_CONFIG.FFT_HOP_SIZE,
              window: CORE_METRICS_CONFIG.WINDOW_TYPE,
            },
            lufs: {
              blockMs: CORE_METRICS_CONFIG.LUFS_BLOCK_DURATION_MS,
              shortTermMs: CORE_METRICS_CONFIG.LUFS_SHORT_TERM_DURATION_MS,
              absoluteThreshold: CORE_METRICS_CONFIG.LUFS_ABSOLUTE_THRESHOLD,
              relativeThreshold: CORE_METRICS_CONFIG.LUFS_RELATIVE_THRESHOLD,
            },
            truePeak: {
              oversampling: CORE_METRICS_CONFIG.TRUE_PEAK_OVERSAMPLING,
            },
          },
        },
      };

      console.log(`✅ Métricas core calculadas em ${processingTime}ms`);
      console.log(
        `   - FFT frames processados: ${fftResults.frameCount}`
      );
      console.log(
        `   - LUFS integrado: ${this.formatValue(lufsResults.integrated, "LUFS")}`
      );
      console.log(
        `   - True Peak máximo: ${this.formatValue(truePeakResults.maxDbtp, "dBTP")}`
      );
      console.log(
        `   - Correlação estéreo: ${this.formatValue(stereoResults.correlation, "", 3)}`
      );

      return results;
    } catch (error) {
      console.error("❌ Erro no cálculo de métricas core:", error.message);
      throw new Error(`CORE_METRICS_ERROR: ${error.message}`);
    }
  }

  ensureOriginalChannels(segmentedAudio) {
    let leftChannel = segmentedAudio.originalLeft;
    let rightChannel = segmentedAudio.originalRight;

    if (!leftChannel || !rightChannel) {
      console.log(
        "⚠️ Canais originais ausentes, reconstruindo dos frames RMS..."
      );
      leftChannel = this.reconstructFromFrames(
        segmentedAudio.framesRMS.left,
        segmentedAudio.framesRMS.hopSize
      );
      rightChannel = this.reconstructFromFrames(
        segmentedAudio.framesRMS.right,
        segmentedAudio.framesRMS.hopSize
      );
    }

    if (
      !leftChannel ||
      !rightChannel ||
      leftChannel.length === 0 ||
      rightChannel.length === 0
    ) {
      throw new Error("INVALID_CHANNELS: Canais de áudio ausentes ou vazios");
    }

    if (!(leftChannel instanceof Float32Array))
      leftChannel = new Float32Array(leftChannel);
    if (!(rightChannel instanceof Float32Array))
      rightChannel = new Float32Array(rightChannel);

    return { leftChannel, rightChannel };
  }

  reconstructFromFrames(frames, hopSize) {
    if (!frames || frames.length === 0) return new Float32Array(0);
    const estimatedLength = (frames.length - 1) * hopSize + frames[0].length;
    const reconstructed = new Float32Array(estimatedLength);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const startIdx = i * hopSize;
      for (
        let j = 0;
        j < frame.length && startIdx + j < reconstructed.length;
        j++
      ) {
        if (j < hopSize || i === frames.length - 1) {
          reconstructed[startIdx + j] = frame[j];
        } else {
          reconstructed[startIdx + j] =
            (reconstructed[startIdx + j] + frame[j]) * 0.5;
        }
      }
    }
    return reconstructed;
  }

  async calculateFFTMetrics(framesFFT) {
    console.log(`📊 Processando ${framesFFT.count} frames FFT...`);
    const startTime = Date.now();
    
    // 🔥 PROTEÇÃO CRÍTICA: Limitar número de frames FFT para evitar travamento
    const maxFrames = Math.min(framesFFT.count, 10000); // máximo 10k frames
    if (framesFFT.count > maxFrames) {
      console.warn(`⚠️ FFT: limitando ${framesFFT.count} → ${maxFrames} frames para evitar travamento`);
    }
    
    const results = {
      frameCount: maxFrames,
      frameSize: framesFFT.frameSize,
      hopSize: framesFFT.hopSize,
      windowType: framesFFT.windowType,
      spectrograms: { left: [], right: [] },
      frequencyBands: { left: {}, right: {} },
      averageSpectrum: { left: null, right: null },
    };

    for (let i = 0; i < maxFrames; i++) {
      // 🔥 TIMEOUT CHECK a cada 100 frames
      if (i % 100 === 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed > 30000) { // 30 segundos max
          console.error(`🚨 FFT timeout após ${elapsed}ms, parando em frame ${i}/${maxFrames}`);
          break;
        }
      }
      
      try {
        const leftFFT = this.fftEngine.fft(framesFFT.left[i]);
        results.spectrograms.left.push({
          magnitude: Array.from(
            leftFFT.magnitude.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)
        ),
        phase: Array.from(
          leftFFT.phase.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)
        ),
        frameIndex: i,
        timestamp: (i * framesFFT.hopSize) / CORE_METRICS_CONFIG.SAMPLE_RATE,
      });

      const rightFFT = this.fftEngine.fft(framesFFT.right[i]);
      results.spectrograms.right.push({
        magnitude: Array.from(
          rightFFT.magnitude.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)
        ),
        phase: Array.from(
          rightFFT.phase.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)
        ),
        frameIndex: i,
        timestamp: (i * framesFFT.hopSize) / CORE_METRICS_CONFIG.SAMPLE_RATE,
      });
      } catch (fftError) {
        console.warn(`⚠️ FFT falhou no frame ${i}:`, fftError.message);
        // Continua para o próximo frame em caso de erro
        continue;
      }
    }

    results.averageSpectrum.left = this.calculateAverageSpectrum(
      results.spectrograms.left
    );
    results.averageSpectrum.right = this.calculateAverageSpectrum(
      results.spectrograms.right
    );

    // 🔧 Ajustado: agora gera 7 bandas espectrais (compatível com json-output.js)
    results.frequencyBands.left = this.calculateFrequencyBands(
      results.averageSpectrum.left
    );
    results.frequencyBands.right = this.calculateFrequencyBands(
      results.averageSpectrum.right
    );

    return results;
  }

  async calculateLUFSMetrics(leftChannel, rightChannel, sampleRate) {
    const leftRMS = this.calculateRMS(leftChannel);
    const rightRMS = this.calculateRMS(rightChannel);
    const avgRMS = (leftRMS + rightRMS) / 2;

    if (avgRMS < 1e-10) return this.createSilentLUFSResult();

    try {
      const lufsResults = calculateLoudnessMetrics(
        leftChannel,
        rightChannel,
        sampleRate
      );
      const integrated = this.sanitizeValue(
        lufsResults.integrated || lufsResults.lufs_integrated,
        -70.0
      );
      const shortTerm = this.sanitizeValue(
        lufsResults.shortTerm || lufsResults.lufs_short_term,
        integrated
      );
      const momentary = this.sanitizeValue(
        lufsResults.momentary || lufsResults.lufs_momentary,
        integrated
      );
      const lra = this.sanitizeValue(
        lufsResults.lra || lufsResults.range,
        0.0
      );

      return {
        integrated,
        shortTerm,
        momentary,
        lra,
        gatingInfo: {
          absoluteThreshold: CORE_METRICS_CONFIG.LUFS_ABSOLUTE_THRESHOLD,
          relativeThreshold: CORE_METRICS_CONFIG.LUFS_RELATIVE_THRESHOLD,
        },
        r128Compliance: {
          integratedWithinRange: integrated >= -27 && integrated <= -20,
          truePeakBelowCeiling: true,
          lraWithinRange: lra <= 20.0,
        },
        standard: "ITU-R BS.1770-4",
        diagnostics: { avgRMS, leftRMS, rightRMS },
      };
    } catch (err) {
      return this.createSilentLUFSResult();
    }
  }

  createSilentLUFSResult() {
    return {
      integrated: -70.0,
      shortTerm: -70.0,
      momentary: -70.0,
      lra: 0.0,
    };
  }

  async calculateTruePeakMetrics(leftChannel, rightChannel) {
    const leftMax = this.calculateAbsMax(leftChannel);
    const rightMax = this.calculateAbsMax(rightChannel);
    if (leftMax < 1e-10 && rightMax < 1e-10)
      return this.createSilentTruePeakResult();

    const leftPeak = this.truePeakDetector.detectTruePeak(leftChannel);
    const rightPeak = this.truePeakDetector.detectTruePeak(rightChannel);

    const maxLinear = Math.max(
      leftPeak.true_peak_linear,
      rightPeak.true_peak_linear
    );
    const maxDbtp =
      maxLinear > 1e-10 ? 20 * Math.log10(maxLinear) : -60.0;

    return {
      maxDbtp,
      maxLinear,
      channels: {
        left: leftPeak,
        right: rightPeak,
      },
    };
  }

  createSilentTruePeakResult() {
    return { maxDbtp: -60.0, maxLinear: 0.0 };
  }

  async calculateStereoMetrics(leftChannel, rightChannel) {
    const correlation = this.calculateCorrelation(leftChannel, rightChannel);
    const width = this.calculateStereoWidth(leftChannel, rightChannel);
    let balance = this.calculateStereoBalance(leftChannel, rightChannel);
    balance = Math.max(-1, Math.min(1, balance));

    return { correlation, width, balance };
  }

  calculateAverageSpectrum(spectrograms) {
    if (!spectrograms.length) return [];
    const spectrumLength = spectrograms[0].magnitude.length;
    const avg = new Array(spectrumLength).fill(0);
    for (const frame of spectrograms) {
      for (let i = 0; i < spectrumLength; i++) avg[i] += frame.magnitude[i];
    }
    return avg.map((v) => v / spectrograms.length);
  }

  // 🔧 Corrigido: agora gera 7 bandas espectrais, compatíveis com o json-output
  calculateFrequencyBands(averageSpectrum) {
    const nyquist = CORE_METRICS_CONFIG.SAMPLE_RATE / 2;
    const binSize = nyquist / (averageSpectrum.length - 1);

    const bands = {
      subBass: { min: 20, max: 60, energy: 0 },
      bass: { min: 60, max: 120, energy: 0 },
      lowMid: { min: 120, max: 500, energy: 0 },
      mid: { min: 500, max: 2000, energy: 0 },
      highMid: { min: 2000, max: 4000, energy: 0 },
      presence: { min: 4000, max: 8000, energy: 0 },
      brilliance: { min: 8000, max: 20000, energy: 0 },
    };

    for (const [name, band] of Object.entries(bands)) {
      const minBin = Math.floor(band.min / binSize);
      const maxBin = Math.floor(band.max / binSize);
      let energy = 0;
      for (let i = minBin; i <= maxBin && i < averageSpectrum.length; i++) {
        energy += averageSpectrum[i] ** 2;
      }
      band.energy = energy;
    }

    return bands;
  }

  validateInputFrom5_2(segmentedAudio) {
    const required = [
      "originalLength",
      "sampleRate",
      "duration",
      "numberOfChannels",
      "framesFFT",
      "framesRMS",
    ];
    for (const field of required) {
      if (!segmentedAudio.hasOwnProperty(field))
        throw new Error(`INVALID_INPUT_5_2: Missing ${field}`);
    }
    if (segmentedAudio.sampleRate !== CORE_METRICS_CONFIG.SAMPLE_RATE) {
      console.warn(
        `⚠️ SAMPLE_RATE_MISMATCH: Esperado ${CORE_METRICS_CONFIG.SAMPLE_RATE}, recebido ${segmentedAudio.sampleRate}`
      );
    }
  }

  sanitizeValue(v, fb) {
    return isNaN(v) || !isFinite(v) ? fb : v;
  }
  formatValue(v, unit = "", d = 1) {
    return isNaN(v) || !isFinite(v) ? `--${unit}` : `${v.toFixed(d)}${unit}`;
  }
  calculateRMS(ch) {
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] ** 2;
    return Math.sqrt(sum / ch.length);
  }
  calculateAbsMax(ch) {
    let max = 0;
    for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]));
    return max;
  }
  calculateCorrelation(L, R) {
    const len = Math.min(L.length, R.length);
    let meanL = 0,
      meanR = 0;
    for (let i = 0; i < len; i++) {
      meanL += L[i];
      meanR += R[i];
    }
    meanL /= len;
    meanR /= len;
    let cov = 0,
      varL = 0,
      varR = 0;
    for (let i = 0; i < len; i++) {
      const dL = L[i] - meanL,
        dR = R[i] - meanR;
      cov += dL * dR;
      varL += dL ** 2;
      varR += dR ** 2;
    }
    return Math.sqrt(varL * varR) > 0 ? cov / Math.sqrt(varL * varR) : 0.0;
  }
  calculateStereoWidth(L, R) {
    const len = Math.min(L.length, R.length);
    let sumDiff = 0,
      sumSum = 0;
    for (let i = 0; i < len; i++) {
      const d = L[i] - R[i],
        s = L[i] + R[i];
      sumDiff += d ** 2;
      sumSum += s ** 2;
    }
    return sumSum > 0 ? Math.sqrt(sumDiff / sumSum) : 0.0;
  }
  calculateStereoBalance(L, R) {
    const lRMS = this.calculateRMS(L),
      rRMS = this.calculateRMS(R);
    const total = lRMS + rRMS;
    return total > 0 ? (rRMS - lRMS) / total : 0.0;
  }
}

/**
 * Funções de alto nível
 */
export async function calculateCoreMetrics(segmentedAudio) {
  const p = new CoreMetricsProcessor();
  return await p.processMetrics(segmentedAudio);
}

export async function processAudioWithCoreMetrics(fileBuffer, filename) {
  const { decodeAudioFile } = await import("./audio-decoder.js");
  const { segmentAudioTemporal } = await import("./temporal-segmentation.js");

  const audioData = await decodeAudioFile(fileBuffer, filename);
  const segmentedData = segmentAudioTemporal(audioData);
  segmentedData.originalLeft = audioData.leftChannel;
  segmentedData.originalRight = audioData.rightChannel;

  const metricsData = await calculateCoreMetrics(segmentedData);

  return {
    phase1: audioData,
    phase2: segmentedData,
    phase3: metricsData,
    pipeline: {
      version: "5.3",
      phases: [
        "5.1-decoding",
        "5.2-temporal-segmentation",
        "5.3-core-metrics",
      ],
      decodedFrom: filename,
      totalProcessingTime:
        (metricsData._metadata?.processingTime || 0) +
        (segmentedData._metadata?.processingTime || 0) +
        (audioData._metadata?.processingTime || 0),
    },
  };
}

export { CORE_METRICS_CONFIG, CoreMetricsProcessor };
