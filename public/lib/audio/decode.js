// 🎯 AUDIO DECODE - Conversão e preparação de áudio
// Decodificação PCM Float32, 48kHz, stereo com DC removal

// 📊 Estatísticas de decodificação
const DECODE_STATS = {
  TARGET_SAMPLE_RATE: 48000,
  TARGET_BIT_DEPTH: 32,
  TARGET_CHANNELS: 2,
  DC_REMOVAL_ENABLED: true
};

/**
 * 🎤 Decodificar e preparar áudio para análise
 * @param {ArrayBuffer} audioBuffer - Buffer de áudio bruto
 * @param {AudioContext} audioContext - Contexto de áudio web
 * @returns {Promise<Object>} Dados preparados
 */
async function decodeAndPrepareAudio(audioBuffer, audioContext = null) {
  const startTime = Date.now();
  
  try {
    // Criar contexto se necessário
    if (!audioContext) {
      audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)({
        sampleRate: DECODE_STATS.TARGET_SAMPLE_RATE
      });
    }
    
    log('🎤 Decodificando áudio...');
    
    // Decodificar áudio
    const decodedBuffer = await audioContext.decodeAudioData(
      audioBuffer.buffer?.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) || audioBuffer
    );
    
    // Extrair canais
    const leftChannel = decodedBuffer.getChannelData(0);
    const rightChannel = decodedBuffer.numberOfChannels > 1 ? 
      decodedBuffer.getChannelData(1) : 
      new Float32Array(leftChannel); // Duplicar mono para stereo
    
    // Remover DC offset se habilitado
    let leftProcessed = leftChannel;
    let rightProcessed = rightChannel;
    
    if (DECODE_STATS.DC_REMOVAL_ENABLED) {
      log('🔧 Removendo DC offset...');
      leftProcessed = removeDCOffset(leftChannel);
      rightProcessed = removeDCOffset(rightChannel);
    }
    
    // Calcular duração e metadados
    const duration = decodedBuffer.duration;
    const sampleRate = decodedBuffer.sampleRate;
    const channels = decodedBuffer.numberOfChannels;
    const totalSamples = decodedBuffer.length;
    
    const decodeTime = Date.now() - startTime;
    
    log('✅ Áudio decodificado:', {
      duration: `${duration.toFixed(2)}s`,
      sampleRate: `${sampleRate}Hz`,
      channels: channels,
      samples: totalSamples.toLocaleString(),
      decodeTime: `${decodeTime}ms`
    });
    
    return {
      leftChannel: leftProcessed,
      rightChannel: rightProcessed,
      metadata: {
        duration,
        sampleRate,
        channels: Math.min(channels, 2), // Max 2 canais
        totalSamples,
        originalChannels: channels,
        dcRemoved: DECODE_STATS.DC_REMOVAL_ENABLED,
        decodeTime
      },
      audioContext // Retornar para cleanup posterior
    };
    
  } catch (error) {
    error('❌ Erro na decodificação:', error);
    throw new Error(`Falha na decodificação de áudio: ${error.message}`);
  }
}

/**
 * 🧹 Remover DC offset de um canal
 * @param {Float32Array} channelData - Dados do canal
 * @returns {Float32Array} Canal com DC removido
 */
function removeDCOffset(channelData) {
  // Calcular média (DC component)
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i];
  }
  const dcOffset = sum / channelData.length;
  
  // Remover DC offset apenas se significativo (>0.001)
  if (Math.abs(dcOffset) > 0.001) {
    const result = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      result[i] = channelData[i] - dcOffset;
    }
    
    log(`🧹 DC offset removido: ${(dcOffset * 1000).toFixed(3)}mV`);
    return result;
  }
  
  // DC já baixo, retornar original
  return channelData;
}

/**
 * ⚡ Detectar formato de áudio (heurística simples)
 * @param {ArrayBuffer} buffer - Buffer de áudio
 * @returns {String} Formato detectado
 */
function detectAudioFormat(buffer) {
  const view = new Uint8Array(buffer);
  
  // WAV: "RIFF" + 4 bytes + "WAVE"  
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
      view[8] === 0x57 && view[9] === 0x41 && view[10] === 0x56 && view[11] === 0x45) {
    return 'wav';
  }
  
  // MP3: Frame sync (0xFFE ou 0xFFF)
  for (let i = 0; i < Math.min(view.length - 1, 1000); i++) {
    if (view[i] === 0xFF && (view[i + 1] & 0xE0) === 0xE0) {
      return 'mp3';
    }
  }
  
  // FLAC: "fLaC"
  if (view[0] === 0x66 && view[1] === 0x4C && view[2] === 0x61 && view[3] === 0x43) {
    return 'flac';
  }
  
  // M4A/AAC: "ftypM4A"
  for (let i = 0; i < view.length - 7; i++) {
    if (view[i] === 0x66 && view[i+1] === 0x74 && view[i+2] === 0x79 && view[i+3] === 0x70) {
      return 'm4a';
    }
  }
  
  return 'unknown';
}

/**
 * 🔍 Estimar bit depth (heurística baseada na distribuição)
 * @param {AudioBuffer} decodedBuffer - Buffer decodificado
 * @returns {Number} Bit depth estimado
 */
function estimateBitDepth(decodedBuffer) {
  const samples = decodedBuffer.getChannelData(0);
  const sampleSize = Math.min(samples.length, 44100); // 1s max
  
  let uniqueValues = new Set();
  let maxAbsValue = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const value = Math.abs(samples[i]);
    if (value > maxAbsValue) maxAbsValue = value;
    
    // Quantizar para detectar padrões de bit depth
    const quantized = Math.round(samples[i] * 32768) / 32768;
    uniqueValues.add(quantized);
    
    if (uniqueValues.size > 10000) break; // Limitar memória
  }
  
  // Heurística baseada na quantidade de valores únicos
  const uniqueRatio = uniqueValues.size / sampleSize;
  
  if (uniqueRatio < 0.01) return 8;   // Muito poucos valores únicos
  if (uniqueRatio < 0.1) return 16;   // Poucos valores únicos
  if (uniqueRatio > 0.8) return 32;   // Muitos valores únicos (float)
  
  return 24; // Default moderno
}

// 🎯 Exportar funções
export {
  decodeAndPrepareAudio,
  removeDCOffset,
  detectAudioFormat,
  estimateBitDepth,
  DECODE_STATS
};
