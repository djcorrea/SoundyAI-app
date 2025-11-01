/**
 * Audio Temporal Segmentation - Fase 5.2 do Pipeline - CORRIGIDO
 * 
 * Segmentação temporal com validações rigorosas, política de canais explícita,
 * windowSize/hopSize explícitos e contagens consistentes.
 * 
 * FAIL-FAST: Qualquer inconsistência vira erro com stage="segmentation"
 */

// Sistema de tratamento de erros padronizado
import { makeErr, ensureFiniteArray, logAudio, assertFinite } from '../../lib/audio/error-handling.js';
import { FastFFT } from '../../lib/audio/fft.js';

// ========= CONFIGURAÇÕES FIXAS (AUDITORIA) =========
const SAMPLE_RATE = 48000;

// Configurações FFT (explícitas e documentadas)
const FFT_SIZE = 4096;
const FFT_HOP_SIZE = 1024; // 75% overlap = (4096-1024)/4096 = 75%
const WINDOW_TYPE = "hann";

// Configurações RMS/LUFS (explícitas e documentadas)
const RMS_BLOCK_DURATION_MS = 300; // 300ms
const RMS_HOP_DURATION_MS = 100;   // 100ms
const RMS_BLOCK_SAMPLES = Math.round((RMS_BLOCK_DURATION_MS / 1000) * SAMPLE_RATE); // 14400 samples
const RMS_HOP_SAMPLES = Math.round((RMS_HOP_DURATION_MS / 1000) * SAMPLE_RATE);     // 4800 samples

// ========= POLÍTICA DE CANAIS (EXPLÍCITA) =========
// MESMA POLÍTICA DA FASE 5.1: Sempre estéreo (2 canais)
// Se entrada não for estéreo, é erro - não convertemos aqui
// Analisamos L e R separadamente, mantendo consistência

/**
 * Gerar janela Hann determinística 
 * w[n] = 0.5 - 0.5 * cos((2πn)/(N-1)), 0 ≤ n < N
 */
function generateHannWindow(length) {
  if (!Number.isInteger(length) || length <= 0) {
    throw makeErr('segmentation', `Tamanho de janela inválido: ${length}`, 'invalid_window_size');
  }
  
  const window = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1));
  }
  
  // Validar que janela não contém NaN/Infinity
  ensureFiniteArray(window, 'segmentation', 'Hann window');
  
  return window;
}

/**
 * Aplicar janela com validação rigorosa
 */
function applyWindow(frame, window) {
  if (frame.length !== window.length) {
    throw makeErr('segmentation', `Frame/window size mismatch: frame=${frame.length}, window=${window.length}`, 'window_size_mismatch');
  }
  
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    // Validar individualmente para detectar NaN
    if (!Number.isFinite(frame[i])) {
      throw makeErr('segmentation', `Frame contém valor não finito no índice ${i}: ${frame[i]}`, 'non_finite_frame_sample');
    }
    windowed[i] = frame[i] * window[i];
  }
  
  return windowed;
}

/**
 * Extrair frame com zero-padding seguro
 */
function extractFrame(audioData, startSample, frameSize) {
  if (!Number.isInteger(startSample) || startSample < 0) {
    throw makeErr('segmentation', `startSample inválido: ${startSample}`, 'invalid_start_sample');
  }
  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw makeErr('segmentation', `frameSize inválido: ${frameSize}`, 'invalid_frame_size');
  }
  
  const frame = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    const sampleIndex = startSample + i;
    frame[i] = sampleIndex < audioData.length ? audioData[sampleIndex] : 0.0;
  }
  
  return frame;
}

/**
 * Segmentar canal para FFT com validações
 */
function segmentChannelForFFT(audioData, channelName) {
  const frames = [];
  const hannWindow = generateHannWindow(FFT_SIZE);
  const totalSamples = audioData.length;
  
  // Inicializar FFT engine
  const fftEngine = new FastFFT();
  
  // Calcular número de frames de forma determinística
  const numFrames = Math.floor((totalSamples - FFT_SIZE) / FFT_HOP_SIZE) + 1;
  
  if (numFrames <= 0) {
    throw makeErr('segmentation', `Áudio muito curto para FFT: ${totalSamples} samples < ${FFT_SIZE} required`, 'audio_too_short_fft');
  }
  
  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const startSample = frameIndex * FFT_HOP_SIZE;
    
    // Proteção contra overflow
    if (startSample >= totalSamples) {
      break; // Último frame pode ser menor
    }
    
    const rawFrame = extractFrame(audioData, startSample, FFT_SIZE);
    const windowedFrame = applyWindow(rawFrame, hannWindow);
    
    // ⚡ CORREÇÃO CRÍTICA: Executar FFT real para obter magnitude e phase
    try {
      const fftResult = fftEngine.fft(windowedFrame);
      
      // Criar objeto frame com magnitude e phase (como esperado por core-metrics.js)
      const frameWithFFT = {
        magnitude: fftResult.magnitude,
        phase: fftResult.phase,
        real: fftResult.real,
        imag: fftResult.imag
      };
      
      frames.push(frameWithFFT);
    } catch (fftError) {
      throw makeErr('segmentation', `Erro FFT no frame ${frameIndex} de ${channelName}: ${fftError.message}`, 'fft_calculation_error');
    }
  }
  
  if (frames.length === 0) {
    throw makeErr('segmentation', `Nenhum frame FFT gerado para canal ${channelName}`, 'no_fft_frames');
  }
  
  return frames;
}

/**
 * Segmentar canal para RMS/LUFS com validações
 */
function segmentChannelForRMS(audioData, channelName) {
  const frames = [];
  const rmsValues = []; // ⚡ NOVO: Array para valores RMS calculados
  const totalSamples = audioData.length;
  
  // Calcular número de blocos de forma determinística
  const numBlocks = Math.ceil(totalSamples / RMS_HOP_SAMPLES);
  
  if (numBlocks <= 0) {
    throw makeErr('segmentation', `Áudio muito curto para RMS: ${totalSamples} samples`, 'audio_too_short_rms');
  }
  
  for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
    const startSample = blockIndex * RMS_HOP_SAMPLES;
    
    // Último bloco pode ser menor, mas sempre aplicamos zero-padding
    const block = extractFrame(audioData, startSample, RMS_BLOCK_SAMPLES);
    frames.push(block);
    
    // ⚡ CORREÇÃO CRÍTICA: Calcular RMS real de cada bloco
    let sumSquares = 0;
    for (let i = 0; i < block.length; i++) {
      sumSquares += block[i] * block[i];
    }
    const rmsValue = Math.sqrt(sumSquares / block.length);
    
    // ✅ DEBUG RMS: Log valores calculados
    if (blockIndex === 0) {
      console.log(`[DEBUG RMS CALC] Canal ${channelName}, Bloco 0: rmsValue=${rmsValue}, isFinite=${isFinite(rmsValue)}, block.length=${block.length}`);
    }
    
    // ✅ CORREÇÃO: Aceitar valores RMS reais (incluindo zero para silêncio)
    // REMOVIDO: lógica de 1e-8 artificial que causava -160 dB
    if (isFinite(rmsValue)) {
      rmsValues.push(rmsValue);  // Aceita 0, 0.001, 0.05, etc
    } else {
      // Apenas para NaN/Infinity (erro de cálculo), usar zero
      rmsValues.push(0);
    }
  }
  
  if (frames.length === 0) {
    throw makeErr('segmentation', `Nenhum frame RMS gerado para canal ${channelName}`, 'no_rms_frames');
  }
  
  // ✅ DEBUG RMS: Log valores finais
  console.log(`[DEBUG RMS FINAL] Canal ${channelName}: frames=${frames.length}, rmsValues=${rmsValues.length}, primeiro RMS=${rmsValues[0]?.toFixed(6)}, último RMS=${rmsValues[rmsValues.length-1]?.toFixed(6)}`);
  
  return { frames, rmsValues }; // ⚡ RETORNAR AMBOS: frames brutos e valores RMS
}

/**
 * Validar entrada da Fase 5.1
 */
function validateAudioInput(audioBufferLike) {
  if (!audioBufferLike) {
    throw makeErr('segmentation', 'Entrada de áudio ausente', 'missing_audio_input');
  }
  
  // Validar estrutura obrigatória
  if (!audioBufferLike.leftChannel || !audioBufferLike.rightChannel) {
    throw makeErr('segmentation', 'leftChannel e rightChannel são obrigatórios', 'missing_channels');
  }
  
  // Validar sample rate
  if (audioBufferLike.sampleRate !== SAMPLE_RATE) {
    throw makeErr('segmentation', `Sample rate inválido: esperado ${SAMPLE_RATE}Hz, recebido ${audioBufferLike.sampleRate}Hz`, 'invalid_sample_rate');
  }
  
  // Validar que canais têm mesmo tamanho
  if (audioBufferLike.leftChannel.length !== audioBufferLike.rightChannel.length) {
    throw makeErr('segmentation', `Canais com tamanhos diferentes: L=${audioBufferLike.leftChannel.length}, R=${audioBufferLike.rightChannel.length}`, 'channel_length_mismatch');
  }
  
  // Validar que canais não estão vazios
  if (audioBufferLike.leftChannel.length === 0) {
    throw makeErr('segmentation', 'Canais de áudio vazios', 'empty_channels');
  }
  
  // Validar que canais são Float32Array ou compatível
  ensureFiniteArray(audioBufferLike.leftChannel, 'segmentation', 'left channel');
  ensureFiniteArray(audioBufferLike.rightChannel, 'segmentation', 'right channel');
  
  return {
    leftChannel: audioBufferLike.leftChannel,
    rightChannel: audioBufferLike.rightChannel,
    sampleRate: audioBufferLike.sampleRate,
    duration: audioBufferLike.duration,
    numberOfChannels: audioBufferLike.numberOfChannels || 2
  };
}

/**
 * Gerar timestamps para frames
 */
function generateTimestamps(frameCount, hopSizeInSamples, sampleRate) {
  const timestamps = new Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    timestamps[i] = (i * hopSizeInSamples) / sampleRate;
  }
  return timestamps;
}

/**
 * Função principal: Segmentação temporal completa - FASE 5.2
 */
export function segmentAudioTemporal(audioBufferLike, options = {}) {
  const stage = 'segmentation';
  const startTime = Date.now();
  const jobId = options.jobId || 'unknown';

  try {
    logAudio(stage, 'start', { fileName: options.fileName, jobId });

    // ========= VALIDAÇÃO DE ENTRADA =========
    const validatedAudio = validateAudioInput(audioBufferLike);
    const { leftChannel, rightChannel, sampleRate, duration, numberOfChannels } = validatedAudio;

    // ========= SEGMENTAÇÃO FFT =========
    const leftFFTFrames = segmentChannelForFFT(leftChannel, 'left');
    const rightFFTFrames = segmentChannelForFFT(rightChannel, 'right');

    // Validar consistência
    if (leftFFTFrames.length !== rightFFTFrames.length) {
      throw makeErr(stage, `FFT frames inconsistentes: L=${leftFFTFrames.length}, R=${rightFFTFrames.length}`, 'fft_frame_count_mismatch');
    }

    // ========= SEGMENTAÇÃO RMS =========
    const leftRMSResult = segmentChannelForRMS(leftChannel, 'left');
    const rightRMSResult = segmentChannelForRMS(rightChannel, 'right');

    // Validar consistência
    if (leftRMSResult.frames.length !== rightRMSResult.frames.length) {
      throw makeErr(stage, `RMS frames inconsistentes: L=${leftRMSResult.frames.length}, R=${rightRMSResult.frames.length}`, 'rms_frame_count_mismatch');
    }

    // ========= GERAR TIMESTAMPS =========
    const fftTimestamps = generateTimestamps(leftFFTFrames.length, FFT_HOP_SIZE, sampleRate);
    const rmsTimestamps = generateTimestamps(leftRMSResult.frames.length, RMS_HOP_SAMPLES, sampleRate);

    // ========= RESULTADO ESTRUTURADO =========
    const processingTime = Date.now() - startTime;

    const result = {
      // Informações de entrada preservadas
      originalLength: leftChannel.length,
      sampleRate: SAMPLE_RATE,
      duration,
      numberOfChannels,

      // 🔥 CORREÇÃO CRÍTICA: originalChannels no formato esperado pelo core-metrics
      originalChannels: {
        left: leftChannel,
        right: rightChannel
      },

      // Frames FFT com metadados completos
      framesFFT: {
        left: leftFFTFrames,
        right: rightFFTFrames,
        frameSize: FFT_SIZE,
        hopSize: FFT_HOP_SIZE,
        windowType: WINDOW_TYPE,
        count: leftFFTFrames.length,
        timestamps: fftTimestamps,
        overlapPercent: ((FFT_SIZE - FFT_HOP_SIZE) / FFT_SIZE) * 100,
        // 🔥 NOVO: Campo frames combinado para core-metrics
        frames: leftFFTFrames.map((leftFrame, index) => ({
          leftFFT: leftFrame,
          rightFFT: rightFFTFrames[index],
          timestamp: fftTimestamps[index],
          frameIndex: index
        }))
      },

      // Frames RMS/LUFS com metadados completos
      framesRMS: {
        left: leftRMSResult.rmsValues,  // ⚡ USAR VALORES RMS CALCULADOS 
        right: rightRMSResult.rmsValues, // ⚡ USAR VALORES RMS CALCULADOS
        frames: {
          left: leftRMSResult.frames,   // Frames brutos para LUFS se necessário
          right: rightRMSResult.frames
        },
        frameSize: RMS_BLOCK_SAMPLES,
        hopSize: RMS_HOP_SAMPLES,
        blockDurationMs: RMS_BLOCK_DURATION_MS,
        hopDurationMs: RMS_HOP_DURATION_MS,
        count: leftRMSResult.rmsValues.length,
        timestamps: rmsTimestamps
      },

      // 🔥 CORREÇÃO CRÍTICA: timestamps no root para core-metrics
      timestamps: {
        fft: fftTimestamps,
        rms: rmsTimestamps
      },

      // Metadados da fase
      _metadata: {
        stage: '5.2-segmentation',
        processingTime,
        segmentedAt: new Date().toISOString(),
        channelPolicy: 'separate_stereo_analysis',
        
        // Configurações explícitas (para auditoria)
        config: {
          sampleRate: SAMPLE_RATE,
          fft: {
            size: FFT_SIZE,
            hop: FFT_HOP_SIZE,
            window: WINDOW_TYPE,
            overlapPercent: ((FFT_SIZE - FFT_HOP_SIZE) / FFT_SIZE) * 100
          },
          rms: {
            blockMs: RMS_BLOCK_DURATION_MS,
            hopMs: RMS_HOP_DURATION_MS,
            blockSamples: RMS_BLOCK_SAMPLES,
            hopSamples: RMS_HOP_SAMPLES
          }
        },
        
        // Contagens para validação
        counts: {
          originalSamples: leftChannel.length,
          fftFrames: leftFFTFrames.length,
          rmsFrames: leftRMSResult.rmsValues.length,
          fftTimestamps: fftTimestamps.length,
          rmsTimestamps: rmsTimestamps.length
        }
      }
    };

    // ========= VALIDAÇÃO FINAL =========
    // Verificar que não introduzimos NaN/Infinity
    if (result.framesFFT.count !== result.framesRMS.count) {
      // Isso é normal - números diferentes de frames
      // Apenas log para auditoria
      console.log(`[SEGMENTATION] Frame counts: FFT=${result.framesFFT.count}, RMS=${result.framesRMS.count}`);
    }

    // Validar timestamps
    ensureFiniteArray(fftTimestamps, stage, 'FFT timestamps');
    ensureFiniteArray(rmsTimestamps, stage, 'RMS timestamps');

    logAudio(stage, 'done', {
      ms: processingTime,
      meta: {
        fftFrames: result.framesFFT.count,
        rmsFrames: result.framesRMS.count,
        duration: duration.toFixed(2),
        sampleRate: sampleRate
      }
    });

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log do erro
    logAudio(stage, 'error', {
      code: error.code || 'unknown',
      message: error.message,
      stackSnippet: error.stackSnippet
    });
    
    // Re-propagar erro estruturado
    if (error.stage === stage) {
      throw error; // Já é nosso erro estruturado
    }
    
    // Erro inesperado - estruturar
    throw makeErr(stage, error.message || String(error), 'unexpected_error');
  }
}

/**
 * Validar configuração de segmentação (para testes)
 */
export function validateSegmentationConfig() {
  return {
    sampleRate: SAMPLE_RATE,
    fft: {
      size: FFT_SIZE,
      hop: FFT_HOP_SIZE,
      overlap: `${(((FFT_SIZE - FFT_HOP_SIZE) / FFT_SIZE) * 100).toFixed(1)}%`,
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
 * Calcular timing dos frames (utilitário)
 */
export function calculateFrameTiming(audioLengthSamples) {
  const audioDuration = audioLengthSamples / SAMPLE_RATE;

  const fftFrameCount = Math.floor((audioLengthSamples - FFT_SIZE) / FFT_HOP_SIZE) + 1;
  const rmsFrameCount = Math.ceil(audioLengthSamples / RMS_HOP_SAMPLES);

  return {
    audioDuration,
    fft: {
      frameCount: fftFrameCount,
      lastFrameAt: ((fftFrameCount - 1) * FFT_HOP_SIZE) / SAMPLE_RATE,
    },
    rms: {
      frameCount: rmsFrameCount,
      lastFrameAt: ((rmsFrameCount - 1) * RMS_HOP_SAMPLES) / SAMPLE_RATE,
    },
  };
}

export default segmentAudioTemporal;