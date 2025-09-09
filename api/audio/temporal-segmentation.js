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
 * Implementação: Setembro 2025
 */

// Configurações fixas (IDÊNTICAS à auditoria do pipeline)
const SAMPLE_RATE = 48000;

// Configurações FFT
const FFT_SIZE = 4096;
const FFT_HOP_SIZE = 1024; // 75% overlap
const WINDOW_TYPE = 'hann';

// Configurações RMS/LUFS
const RMS_BLOCK_DURATION_MS = 300; // 300ms
const RMS_HOP_DURATION_MS = 100;   // 100ms
const RMS_BLOCK_SAMPLES = Math.round((RMS_BLOCK_DURATION_MS / 1000) * SAMPLE_RATE); // 14400 samples
const RMS_HOP_SAMPLES = Math.round((RMS_HOP_DURATION_MS / 1000) * SAMPLE_RATE);     // 4800 samples

/**
 * Gerar janela Hann com fórmula exata
 * w[n] = 0.5 - 0.5 * cos((2πn)/(N-1)), 0 ≤ n < N
 * 
 * @param {number} length - Tamanho da janela
 * @returns {Float32Array} - Coeficientes da janela Hann
 */
function generateHannWindow(length) {
  const window = new Float32Array(length);
  
  for (let n = 0; n < length; n++) {
    window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1));
  }
  
  return window;
}

/**
 * Aplicar janela de windowing a um frame de áudio
 * 
 * @param {Float32Array} frame - Frame de áudio
 * @param {Float32Array} window - Coeficientes da janela
 * @returns {Float32Array} - Frame com janela aplicada
 */
function applyWindow(frame, window) {
  if (frame.length !== window.length) {
    throw new Error(`WINDOW_SIZE_MISMATCH: Frame=${frame.length}, Window=${window.length}`);
  }
  
  const windowed = new Float32Array(frame.length);
  
  for (let i = 0; i < frame.length; i++) {
    windowed[i] = frame[i] * window[i];
  }
  
  return windowed;
}

/**
 * Extrair frame de áudio com zero-padding se necessário
 * 
 * @param {Float32Array} audioData - Dados de áudio completos
 * @param {number} startSample - Sample inicial do frame
 * @param {number} frameSize - Tamanho do frame
 * @returns {Float32Array} - Frame extraído (com zero-padding se necessário)
 */
function extractFrame(audioData, startSample, frameSize) {
  const frame = new Float32Array(frameSize);
  
  for (let i = 0; i < frameSize; i++) {
    const sampleIndex = startSample + i;
    
    if (sampleIndex < audioData.length) {
      frame[i] = audioData[sampleIndex];
    } else {
      frame[i] = 0.0; // Zero-padding
    }
  }
  
  return frame;
}

/**
 * Segmentar áudio para frames FFT
 * 
 * @param {Float32Array} audioData - Dados de áudio de um canal
 * @returns {Array<Float32Array>} - Array de frames FFT com janela Hann aplicada
 */
function segmentForFFT(audioData) {
  const frames = [];
  const hannWindow = generateHannWindow(FFT_SIZE);
  
  // Calcular número de frames possíveis
  const totalSamples = audioData.length;
  const numFrames = Math.floor((totalSamples - FFT_SIZE) / FFT_HOP_SIZE) + 1;
  
  console.log(`[TEMPORAL_SEG] FFT: ${totalSamples} samples → ${numFrames} frames (${FFT_SIZE} samples, hop ${FFT_HOP_SIZE})`);
  
  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const startSample = frameIndex * FFT_HOP_SIZE;
    
    // Extrair frame raw
    const rawFrame = extractFrame(audioData, startSample, FFT_SIZE);
    
    // Aplicar janela Hann
    const windowedFrame = applyWindow(rawFrame, hannWindow);
    
    frames.push(windowedFrame);
  }
  
  // Verificar se precisamos de um frame final (caso o áudio não complete um frame)
  const lastFrameStart = (numFrames - 1) * FFT_HOP_SIZE;
  if (lastFrameStart + FFT_SIZE < totalSamples) {
    const finalStartSample = totalSamples - FFT_SIZE;
    if (finalStartSample > lastFrameStart + FFT_HOP_SIZE) {
      const finalRawFrame = extractFrame(audioData, finalStartSample, FFT_SIZE);
      const finalWindowedFrame = applyWindow(finalRawFrame, hannWindow);
      frames.push(finalWindowedFrame);
      console.log(`[TEMPORAL_SEG] FFT: Adicionado frame final em sample ${finalStartSample}`);
    }
  }
  
  return frames;
}

/**
 * Segmentar áudio para frames RMS/LUFS
 * 
 * @param {Float32Array} audioData - Dados de áudio de um canal
 * @returns {Array<Float32Array>} - Array de frames RMS (sem janela)
 */
function segmentForRMS(audioData) {
  const frames = [];
  const totalSamples = audioData.length;
  
  // Calcular número de blocos baseado no hop
  const numBlocks = Math.floor(totalSamples / RMS_HOP_SAMPLES);
  
  console.log(`[TEMPORAL_SEG] RMS: ${totalSamples} samples → ${numBlocks} blocos (${RMS_BLOCK_SAMPLES} samples, hop ${RMS_HOP_SAMPLES})`);
  
  for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
    const startSample = blockIndex * RMS_HOP_SAMPLES;
    
    // Verificar se o bloco completo cabe no áudio
    if (startSample + RMS_BLOCK_SAMPLES <= totalSamples) {
      const block = extractFrame(audioData, startSample, RMS_BLOCK_SAMPLES);
      frames.push(block);
    } else {
      // Último bloco com zero-padding
      const block = extractFrame(audioData, startSample, RMS_BLOCK_SAMPLES);
      frames.push(block);
      console.log(`[TEMPORAL_SEG] RMS: Bloco ${blockIndex} com zero-padding (${totalSamples - startSample} samples válidos)`);
      break;
    }
  }
  
  // Garantir que temos pelo menos um bloco
  if (frames.length === 0 && totalSamples > 0) {
    const singleBlock = extractFrame(audioData, 0, RMS_BLOCK_SAMPLES);
    frames.push(singleBlock);
    console.log(`[TEMPORAL_SEG] RMS: Criado bloco único com zero-padding para áudio curto`);
  }
  
  return frames;
}

/**
 * Função principal: Segmentação temporal completa
 * 
 * @param {Object} audioBufferLike - Objeto retornado pela Fase 5.1 (audio-decoder.js)
 * @returns {Object} - Frames segmentados prontos para análise
 */
export function segmentAudioTemporal(audioBufferLike) {
  const startTime = Date.now();
  
  try {
    console.log(`[TEMPORAL_SEG] Iniciando segmentação temporal`);
    
    // Validar entrada (compatibilidade com Fase 5.1)
    if (!audioBufferLike || typeof audioBufferLike !== 'object') {
      throw new Error('INVALID_INPUT: audioBufferLike deve ser um objeto');
    }
    
    if (!audioBufferLike.leftChannel || !audioBufferLike.rightChannel) {
      throw new Error('MISSING_CHANNELS: leftChannel e rightChannel são obrigatórios');
    }
    
    if (audioBufferLike.sampleRate !== SAMPLE_RATE) {
      throw new Error(`SAMPLE_RATE_MISMATCH: Esperado ${SAMPLE_RATE}Hz, recebido ${audioBufferLike.sampleRate}Hz`);
    }
    
    const leftChannel = audioBufferLike.leftChannel;
    const rightChannel = audioBufferLike.rightChannel;
    
    if (leftChannel.length !== rightChannel.length) {
      throw new Error(`CHANNEL_LENGTH_MISMATCH: L=${leftChannel.length}, R=${rightChannel.length}`);
    }
    
    console.log(`[TEMPORAL_SEG] Processando: ${leftChannel.length} samples por canal, ${audioBufferLike.duration.toFixed(3)}s`);
    
    // Segmentar canal esquerdo para FFT
    const leftFFTFrames = segmentForFFT(leftChannel);
    console.log(`[TEMPORAL_SEG] Canal esquerdo: ${leftFFTFrames.length} frames FFT`);
    
    // Segmentar canal direito para FFT  
    const rightFFTFrames = segmentForFFT(rightChannel);
    console.log(`[TEMPORAL_SEG] Canal direito: ${rightFFTFrames.length} frames FFT`);
    
    // Segmentar canal esquerdo para RMS
    const leftRMSFrames = segmentForRMS(leftChannel);
    console.log(`[TEMPORAL_SEG] Canal esquerdo: ${leftRMSFrames.length} frames RMS`);
    
    // Segmentar canal direito para RMS
    const rightRMSFrames = segmentForRMS(rightChannel);
    console.log(`[TEMPORAL_SEG] Canal direito: ${rightRMSFrames.length} frames RMS`);
    
    // Validação de consistência
    if (leftFFTFrames.length !== rightFFTFrames.length) {
      throw new Error(`FFT_FRAMES_MISMATCH: L=${leftFFTFrames.length}, R=${rightFFTFrames.length}`);
    }
    
    if (leftRMSFrames.length !== rightRMSFrames.length) {
      throw new Error(`RMS_FRAMES_MISMATCH: L=${leftRMSFrames.length}, R=${rightRMSFrames.length}`);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[TEMPORAL_SEG] Segmentação concluída em ${processingTime}ms`);
    
    // Estrutura de retorno
    const segmentedData = {
      // Informações de entrada
      originalLength: leftChannel.length,
      sampleRate: SAMPLE_RATE,
      duration: audioBufferLike.duration,
      numberOfChannels: 2,
      
      // Frames FFT (com janela Hann aplicada)
      framesFFT: {
        left: leftFFTFrames,
        right: rightFFTFrames,
        frameSize: FFT_SIZE,
        hopSize: FFT_HOP_SIZE,
        windowType: WINDOW_TYPE,
        count: leftFFTFrames.length
      },
      
      // Frames RMS/LUFS (sem janela)
      framesRMS: {
        left: leftRMSFrames,
        right: rightRMSFrames,
        frameSize: RMS_BLOCK_SAMPLES,
        hopSize: RMS_HOP_SAMPLES,
        blockDurationMs: RMS_BLOCK_DURATION_MS,
        hopDurationMs: RMS_HOP_DURATION_MS,
        count: leftRMSFrames.length
      },
      
      // Metadados de processamento
      _metadata: {
        phase: '5.2-temporal-segmentation',
        processingTime: processingTime,
        segmentedAt: new Date().toISOString(),
        fftConfig: {
          size: FFT_SIZE,
          hop: FFT_HOP_SIZE,
          window: WINDOW_TYPE
        },
        rmsConfig: {
          blockMs: RMS_BLOCK_DURATION_MS,
          hopMs: RMS_HOP_DURATION_MS,
          blockSamples: RMS_BLOCK_SAMPLES,
          hopSamples: RMS_HOP_SAMPLES
        }
      }
    };
    
    return segmentedData;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[TEMPORAL_SEG] Erro após ${processingTime}ms:`, error);
    
    // Re-throw com contexto adicional
    const enhancedError = new Error(`TEMPORAL_SEGMENTATION_FAILED: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.processingTime = processingTime;
    enhancedError.phase = '5.2-temporal-segmentation';
    
    throw enhancedError;
  }
}

/**
 * Validar configuração de segmentação
 */
export function validateSegmentationConfig() {
  const config = {
    sampleRate: SAMPLE_RATE,
    fft: {
      size: FFT_SIZE,
      hop: FFT_HOP_SIZE,
      overlap: ((FFT_SIZE - FFT_HOP_SIZE) / FFT_SIZE * 100).toFixed(1) + '%',
      window: WINDOW_TYPE
    },
    rms: {
      blockDurationMs: RMS_BLOCK_DURATION_MS,
      hopDurationMs: RMS_HOP_DURATION_MS,
      blockSamples: RMS_BLOCK_SAMPLES,
      hopSamples: RMS_HOP_SAMPLES
    }
  };
  
  console.log(`[TEMPORAL_SEG] Configuração validada:`, JSON.stringify(config, null, 2));
  return config;
}

/**
 * Utilitário: Calcular timing dos frames
 */
export function calculateFrameTiming(audioLengthSamples) {
  const audioDuration = audioLengthSamples / SAMPLE_RATE;
  
  // FFT frames
  const fftFrameCount = Math.floor((audioLengthSamples - FFT_SIZE) / FFT_HOP_SIZE) + 1;
  const fftTimestamps = [];
  for (let i = 0; i < fftFrameCount; i++) {
    fftTimestamps.push((i * FFT_HOP_SIZE) / SAMPLE_RATE);
  }
  
  // RMS frames
  const rmsFrameCount = Math.floor(audioLengthSamples / RMS_HOP_SAMPLES);
  const rmsTimestamps = [];
  for (let i = 0; i < rmsFrameCount; i++) {
    rmsTimestamps.push((i * RMS_HOP_SAMPLES) / SAMPLE_RATE);
  }
  
  return {
    audioDuration,
    fft: {
      frameCount: fftFrameCount,
      timestamps: fftTimestamps,
      lastFrameAt: fftTimestamps[fftTimestamps.length - 1] || 0
    },
    rms: {
      frameCount: rmsFrameCount,
      timestamps: rmsTimestamps,
      lastFrameAt: rmsTimestamps[rmsTimestamps.length - 1] || 0
    }
  };
}

// Export da função principal
export default segmentAudioTemporal;
