/**
 * 🎵 STEMS SEPARATION WORKER - iOS Safe
 * Processa separação de stems em Web Worker para evitar travamento iOS
 * Funcionalidade 100% preservada, performance melhorada
 */

// Import necessário para logging
let caiarLog = (...args) => console.log('[STEMS-WORKER]', ...args);

// Funções auxiliares para processamento
function createEmptyLike(sampleRate, numberOfChannels, length) {
  // Simular AudioBuffer structure para worker
  const buffer = {
    sampleRate,
    numberOfChannels,
    length,
    duration: length / sampleRate,
    channels: []
  };
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    buffer.channels[ch] = new Float32Array(length);
  }
  
  return buffer;
}

function heuristicsSeparationWorker(audioData, options = {}) {
  const t0 = performance.now();
  const { sampleRate, numberOfChannels, length } = audioData;
  
  // Criar buffers de saída
  const bassBuf = createEmptyLike(sampleRate, numberOfChannels, length);
  const drumsBuf = createEmptyLike(sampleRate, numberOfChannels, length);
  const vocalsBuf = createEmptyLike(sampleRate, numberOfChannels, length);
  const otherBuf = createEmptyLike(sampleRate, numberOfChannels, length);
  
  // Parâmetros de filtros
  const fcBass = 200;
  const alphaBass = Math.exp(-2 * Math.PI * fcBass / sampleRate);
  const hpVoc = 180;
  const lpVoc = 4000;
  const aHP = Math.exp(-2 * Math.PI * hpVoc / sampleRate);
  const aLP = Math.exp(-2 * Math.PI * lpVoc / sampleRate);
  const transientThresh = 0.18;
  
  // Processar cada canal
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = audioData.channels[ch];
    const b = bassBuf.channels[ch];
    const d = drumsBuf.channels[ch];
    const v = vocalsBuf.channels[ch];
    const o = otherBuf.channels[ch];
    
    let lpBass = 0, hpStage = 0, lpStage = 0, prev = 0;
    
    // Processamento chunked para evitar travamento
    const chunkSize = 8192; // iOS-safe chunk size
    
    for (let start = 0; start < src.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, src.length);
      
      for (let i = start; i < end; i++) {
        const x = src[i];
        
        // Bass (low-pass)
        lpBass = (1 - alphaBass) * x + alphaBass * lpBass;
        b[i] = lpBass;
        
        // Vocals (band-pass)
        hpStage = (1 - aHP) * hpStage + (1 - aHP) * (x - hpStage);
        lpStage = (1 - aLP) * x + aLP * lpStage;
        const band = hpStage - (hpStage - lpStage);
        v[i] = band;
        
        // Drums (transient detection)
        const diff = x - prev;
        prev = x;
        if (Math.abs(diff) > transientThresh) {
          d[i] = x;
        } else {
          d[i] = 0;
        }
        
        // Other (residual)
        o[i] = x - (b[i] + v[i] + d[i]);
      }
      
      // Yield periodically para não travar worker
      if ((start / chunkSize) % 10 === 0) {
        // Permitir outras operações
        postMessage({ type: 'progress', percentage: (start / src.length) * 100 });
      }
    }
  }
  
  const t1 = performance.now();
  
  return {
    stems: {
      bass: bassBuf,
      drums: drumsBuf,
      vocals: vocalsBuf,
      other: otherBuf
    },
    method: 'heuristic_worker_v1',
    elapsedMs: +(t1 - t0).toFixed(1),
    fallbackUsed: false,
    processedInWorker: true
  };
}

function computeBasicMetrics(audioBuffer) {
  if (!audioBuffer.channels || !audioBuffer.channels[0]) {
    return { peakDb: -Infinity, rmsDb: -Infinity };
  }
  
  const ch0 = audioBuffer.channels[0];
  let peak = 0, sumSq = 0;
  
  for (let i = 0; i < ch0.length; i++) {
    const v = Math.abs(ch0[i]);
    if (v > peak) peak = v;
    sumSq += ch0[i] * ch0[i];
  }
  
  const rms = Math.sqrt(sumSq / Math.max(1, ch0.length));
  const toDb = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  
  return { 
    peakDb: toDb(peak), 
    rmsDb: toDb(rms) 
  };
}

// Handler principal do worker
self.onmessage = async function(event) {
  const { id, type, audioData, options } = event.data;
  
  try {
    caiarLog('WORKER_START', 'Iniciando processamento stems', { 
      duration: audioData.duration, 
      channels: audioData.numberOfChannels 
    });
    
    // Processar separação
    const result = heuristicsSeparationWorker(audioData, options);
    
    // Calcular métricas
    const metrics = {};
    for (const [k, buf] of Object.entries(result.stems)) {
      metrics[k] = computeBasicMetrics(buf);
    }
    
    const finalResult = {
      ...result,
      metrics,
      totalMs: result.elapsedMs
    };
    
    caiarLog('WORKER_DONE', 'Processamento concluído', { 
      method: finalResult.method, 
      ms: finalResult.totalMs 
    });
    
    // Enviar resultado de volta com transferable objects
    const transferList = [];
    for (const stem of Object.values(finalResult.stems)) {
      for (const channel of stem.channels) {
        transferList.push(channel.buffer);
      }
    }
    
    self.postMessage({
      id,
      type: 'complete',
      result: finalResult
    }, transferList);
    
  } catch (error) {
    caiarLog('WORKER_ERROR', 'Erro no processamento', { 
      error: error.message 
    });
    
    self.postMessage({
      id,
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// Indicar que worker está pronto
self.postMessage({ type: 'ready' });
