/**
 * Audio Temporal Segmentation - Fase 5.2 do Pipeline de Migração
 *
 * Segmentação temporal de áudio decodificado para preparar blocos de FFT, RMS e LUFS
 * Recebe Float32Array da Fase 5.1 e gera frames prontos para análise
 *
 * Requisitos críticos:
 * - Sample rate fixo: 48000 Hz
 * - FFT: fftSize=4096, hopSize=1024, janela Hann
 * - RMS/LUFS: blocos 300ms (14400 samples), hop 100ms (4800 samples)
 * - Determinístico e preciso, sem aproximações
 * - Zero-padding automático para blocos incompletos
 *
 * Implementação corrigida: Setembro 2025
 */

// Configurações fixas (IDÊNTICAS à auditoria do pipeline)
const SAMPLE_RATE = 48000;

// Configurações FFT
const FFT_SIZE = 4096;
const FFT_HOP_SIZE = 1024; // 75% overlap
const WINDOW_TYPE = "hann";

// Configurações RMS/LUFS
const RMS_BLOCK_DURATION_MS = 300; // 300ms
const RMS_HOP_DURATION_MS = 100; // 100ms
const RMS_BLOCK_SAMPLES = Math.round(
  (RMS_BLOCK_DURATION_MS / 1000) * SAMPLE_RATE
); // 14400 samples
const RMS_HOP_SAMPLES = Math.round(
  (RMS_HOP_DURATION_MS / 1000) * SAMPLE_RATE
); // 4800 samples

// Utilitário de log condicional
function logDebug(...args) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

/**
 * Gerar janela Hann com fórmula exata
 * w[n] = 0.5 - 0.5 * cos((2πn)/(N-1)), 0 ≤ n < N
 */
function generateHannWindow(length) {
  const window = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1));
  }
  return window;
}

/**
 * Aplicar janela Hann
 */
function applyWindow(frame, window) {
  if (frame.length !== window.length) {
    throw new Error(
      `WINDOW_SIZE_MISMATCH: Frame=${frame.length}, Window=${window.length}`
    );
  }
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    windowed[i] = frame[i] * window[i];
  }
  return windowed;
}

/**
 * Extrair frame de áudio com zero-padding
 */
function extractFrame(audioData, startSample, frameSize) {
  const frame = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    const sampleIndex = startSample + i;
    frame[i] = sampleIndex < audioData.length ? audioData[sampleIndex] : 0.0;
  }
  return frame;
}

/**
 * Segmentar áudio para FFT
 */
function segmentForFFT(audioData) {
  const frames = [];
  const hannWindow = generateHannWindow(FFT_SIZE);
  const totalSamples = audioData.length;

  const numFrames = Math.ceil((totalSamples - FFT_SIZE) / FFT_HOP_SIZE) + 1;
  logDebug(
    `[TEMPORAL_SEG] FFT: ${totalSamples} samples → ${numFrames} frames (${FFT_SIZE} samples, hop ${FFT_HOP_SIZE})`
  );

  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const startSample = frameIndex * FFT_HOP_SIZE;
    const rawFrame = extractFrame(audioData, startSample, FFT_SIZE);
    const windowedFrame = applyWindow(rawFrame, hannWindow);
    frames.push(windowedFrame);
  }

  return frames;
}

/**
 * Segmentar áudio para RMS/LUFS
 */
function segmentForRMS(audioData) {
  const frames = [];
  const totalSamples = audioData.length;
  const numBlocks = Math.ceil(totalSamples / RMS_HOP_SAMPLES);

  logDebug(
    `[TEMPORAL_SEG] RMS: ${totalSamples} samples → ${numBlocks} blocos (${RMS_BLOCK_SAMPLES} samples, hop ${RMS_HOP_SAMPLES})`
  );

  for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
    const startSample = blockIndex * RMS_HOP_SAMPLES;
    const block = extractFrame(audioData, startSample, RMS_BLOCK_SAMPLES);
    frames.push(block);
  }

  if (frames.length === 0 && totalSamples > 0) {
    frames.push(extractFrame(audioData, 0, RMS_BLOCK_SAMPLES));
    logDebug(`[TEMPORAL_SEG] RMS: Criado bloco único com zero-padding`);
  }

  return frames;
}

/**
 * Função principal: Segmentação temporal completa
 */
export function segmentAudioTemporal(audioBufferLike) {
  const startTime = Date.now();
  try {
    logDebug(`[TEMPORAL_SEG] Iniciando segmentação temporal`);

    if (!audioBufferLike?.leftChannel || !audioBufferLike?.rightChannel) {
      throw new Error(
        "MISSING_CHANNELS: leftChannel e rightChannel são obrigatórios"
      );
    }
    if (audioBufferLike.sampleRate !== SAMPLE_RATE) {
      throw new Error(
        `SAMPLE_RATE_MISMATCH: Esperado ${SAMPLE_RATE}Hz, recebido ${audioBufferLike.sampleRate}Hz`
      );
    }

    const { leftChannel, rightChannel } = audioBufferLike;
    if (leftChannel.length !== rightChannel.length) {
      throw new Error(
        `CHANNEL_LENGTH_MISMATCH: L=${leftChannel.length}, R=${rightChannel.length}`
      );
    }

    logDebug(
      `[TEMPORAL_SEG] Processando: ${leftChannel.length} samples por canal, ${audioBufferLike.duration.toFixed(
        3
      )}s`
    );

    const leftFFTFrames = segmentForFFT(leftChannel);
    const rightFFTFrames = segmentForFFT(rightChannel);
    const leftRMSFrames = segmentForRMS(leftChannel);
    const rightRMSFrames = segmentForRMS(rightChannel);

    if (leftFFTFrames.length !== rightFFTFrames.length) {
      throw new Error(
        `FFT_FRAMES_MISMATCH: L=${leftFFTFrames.length}, R=${rightFFTFrames.length}`
      );
    }
    if (leftRMSFrames.length !== rightRMSFrames.length) {
      throw new Error(
        `RMS_FRAMES_MISMATCH: L=${leftRMSFrames.length}, R=${rightRMSFrames.length}`
      );
    }

    const processingTime = Date.now() - startTime;
    logDebug(`[TEMPORAL_SEG] Segmentação concluída em ${processingTime}ms`);

    return {
      // Informações de entrada
      originalLength: leftChannel.length,
      sampleRate: SAMPLE_RATE,
      duration: audioBufferLike.duration,
      numberOfChannels: 2,

      // Preservar canais originais
      originalLeft: leftChannel,
      originalRight: rightChannel,

      // Frames FFT
      framesFFT: {
        left: leftFFTFrames,
        right: rightFFTFrames,
        frameSize: FFT_SIZE,
        hopSize: FFT_HOP_SIZE,
        windowType: WINDOW_TYPE,
        count: leftFFTFrames.length,
      },

      // Frames RMS/LUFS
      framesRMS: {
        left: leftRMSFrames,
        right: rightRMSFrames,
        frameSize: RMS_BLOCK_SAMPLES,
        hopSize: RMS_HOP_SAMPLES,
        blockDurationMs: RMS_BLOCK_DURATION_MS,
        hopDurationMs: RMS_HOP_DURATION_MS,
        count: leftRMSFrames.length,
      },

      // Metadados
      _metadata: {
        phase: "5.2-temporal-segmentation",
        processingTime,
        segmentedAt: new Date().toISOString(),
        fftConfig: {
          size: FFT_SIZE,
          hop: FFT_HOP_SIZE,
          window: WINDOW_TYPE,
        },
        rmsConfig: {
          blockMs: RMS_BLOCK_DURATION_MS,
          hopMs: RMS_HOP_DURATION_MS,
          blockSamples: RMS_BLOCK_SAMPLES,
          hopSamples: RMS_HOP_SAMPLES,
        },
      },
      
      // 🔧 Campo obrigatório para fase 5.3 (core-metrics)
      originalChannels: audioBufferLike.numberOfChannels || 2,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[TEMPORAL_SEG] Erro após ${processingTime}ms:`, error);
    const enhancedError = new Error(
      `TEMPORAL_SEGMENTATION_FAILED: ${error.message}`
    );
    enhancedError.originalError = error;
    enhancedError.processingTime = processingTime;
    enhancedError.phase = "5.2-temporal-segmentation";
    throw enhancedError;
  }
}

/**
 * Validar configuração de segmentação
 */
export function validateSegmentationConfig() {
  return {
    sampleRate: SAMPLE_RATE,
    fft: {
      size: FFT_SIZE,
      hop: FFT_HOP_SIZE,
      overlap: `${(
        ((FFT_SIZE - FFT_HOP_SIZE) / FFT_SIZE) *
        100
      ).toFixed(1)}%`,
      window: WINDOW_TYPE,
    },
    rms: {
      blockDurationMs: RMS_BLOCK_DURATION_MS,
      hopDurationMs: RMS_HOP_DURATION_MS,
      blockSamples: RMS_BLOCK_SAMPLES,
      hopSamples: RMS_HOP_SAMPLES,
    },
  };
}

/**
 * Utilitário: Calcular timing dos frames
 */
export function calculateFrameTiming(audioLengthSamples) {
  const audioDuration = audioLengthSamples / SAMPLE_RATE;

  const fftFrameCount = Math.ceil(
    (audioLengthSamples - FFT_SIZE) / FFT_HOP_SIZE
  ) + 1;
  const fftTimestamps = [];
  for (let i = 0; i < fftFrameCount; i++) {
    fftTimestamps.push((i * FFT_HOP_SIZE) / SAMPLE_RATE);
  }

  const rmsFrameCount = Math.ceil(audioLengthSamples / RMS_HOP_SAMPLES);
  const rmsTimestamps = [];
  for (let i = 0; i < rmsFrameCount; i++) {
    rmsTimestamps.push((i * RMS_HOP_SAMPLES) / SAMPLE_RATE);
  }

  return {
    audioDuration,
    fft: {
      frameCount: fftFrameCount,
      timestamps: fftTimestamps,
      lastFrameAt: fftTimestamps[fftTimestamps.length - 1] || 0,
    },
    rms: {
      frameCount: rmsFrameCount,
      timestamps: rmsTimestamps,
      lastFrameAt: rmsTimestamps[rmsTimestamps.length - 1] || 0,
    },
  };
}

export default segmentAudioTemporal;
