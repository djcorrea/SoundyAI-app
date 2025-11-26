/**
 * 🎵 STEMS MANAGER - iOS Safe + Web Workers
 * Gerencia separação de stems com fallback automático
 * Funcionalidade 100% preservada em todos os dispositivos
 */

import { caiarLog } from './caiar-logger.js';

// Cache de workers para reutilização
let workerPool = [];
const MAX_WORKERS = 2;

// Detecção de capacidades do dispositivo
function detectCapabilities() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hasWebWorkers = typeof Worker !== 'undefined';
  const supportsOfflineContext = (() => {
    try {
      new OfflineAudioContext(1, 1024, 44100);
      return true;
    } catch { 
      return false; 
    }
  })();
  
  return { isIOS, hasWebWorkers, supportsOfflineContext };
}

// Criar worker do pool
function createStemsWorker() {
  try {
    const worker = new Worker('/lib/audio/workers/stems-worker.js');
    return worker;
  } catch (error) {
    caiarLog('WORKER_CREATE_ERROR', 'Falha ao criar worker', { error: error.message });
    return null;
  }
}

// Obter worker disponível
function getAvailableWorker() {
  // Procurar worker livre
  for (const worker of workerPool) {
    if (!worker.busy) {
      worker.busy = true;
      return worker;
    }
  }
  
  // Criar novo se ainda há espaço no pool
  if (workerPool.length < MAX_WORKERS) {
    const worker = createStemsWorker();
    if (worker) {
      worker.busy = true;
      worker.id = Date.now() + Math.random();
      workerPool.push(worker);
      return worker;
    }
  }
  
  return null;
}

// Liberar worker
function releaseWorker(worker) {
  worker.busy = false;
}

// Converter AudioBuffer para transferable data
function audioBufferToTransferable(audioBuffer) {
  const transferableData = {
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    duration: audioBuffer.duration,
    channels: []
  };
  
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    // Criar cópia para transferir
    const copy = new Float32Array(channelData);
    transferableData.channels.push(copy);
  }
  
  return transferableData;
}

// Converter transferable data de volta para AudioBuffer-like
function transferableToAudioBuffer(transferableData) {
  // Criar mock AudioBuffer para compatibilidade
  const mockBuffer = {
    sampleRate: transferableData.sampleRate,
    numberOfChannels: transferableData.numberOfChannels,
    length: transferableData.length,
    duration: transferableData.duration,
    getChannelData: (channel) => transferableData.channels[channel]
  };
  
  return mockBuffer;
}

// Separação via Web Workers
async function separateViaWorker(audioBuffer, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = getAvailableWorker();
    
    if (!worker) {
      reject(new Error('No workers available'));
      return;
    }
    
    const requestId = Date.now() + Math.random();
    let progressCallback = options.onProgress;
    
    // Timeout handler
    const timeout = setTimeout(() => {
      worker.terminate();
      // Remover do pool
      const index = workerPool.findIndex(w => w.id === worker.id);
      if (index >= 0) workerPool.splice(index, 1);
      reject(new Error('Worker timeout'));
    }, options.timeoutMs || 90000);
    
    // Message handler
    worker.onmessage = function(event) {
      const { id, type, result, error } = event.data;
      
      if (type === 'ready') {
        // Worker pronto, enviar dados
        const transferableData = audioBufferToTransferable(audioBuffer);
        const transferList = transferableData.channels.map(ch => ch.buffer);
        
        worker.postMessage({
          id: requestId,
          type: 'process',
          audioData: transferableData,
          options
        }, transferList);
        
      } else if (type === 'progress') {
        if (progressCallback) {
          progressCallback(event.data.percentage);
        }
        
      } else if (type === 'complete' && id === requestId) {
        clearTimeout(timeout);
        releaseWorker(worker);
        
        // Converter stems de volta para AudioBuffer-like objects
        const convertedStems = {};
        for (const [key, stemData] of Object.entries(result.stems)) {
          convertedStems[key] = transferableToAudioBuffer(stemData);
        }
        
        resolve({
          ...result,
          stems: convertedStems
        });
        
      } else if (type === 'error' && id === requestId) {
        clearTimeout(timeout);
        releaseWorker(worker);
        reject(new Error(error.message));
      }
    };
    
    worker.onerror = function(error) {
      clearTimeout(timeout);
      releaseWorker(worker);
      reject(error);
    };
  });
}

// Separação fallback original (heuristic inline)
function heuristicsSeparationInline(audioBuffer, opts = {}) {
  const t0 = performance.now();
  const sr = audioBuffer.sampleRate;
  
  // Usar contexto regular ao invés de OfflineAudioContext no iOS
  const capabilities = detectCapabilities();
  let ctx;
  
  if (capabilities.isIOS || !capabilities.supportsOfflineContext) {
    // iOS: usar processamento inline sem OfflineAudioContext
    caiarLog('STEMS_INLINE_iOS', 'Usando processamento inline iOS-safe');
    return heuristicsSeparationPure(audioBuffer, opts);
  } else {
    // Desktop: usar OfflineAudioContext normal
    ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      audioBuffer.numberOfChannels, 
      audioBuffer.length, 
      sr
    );
  }
  
  // Implementação original para desktop
  const bassBuf = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, sr);
  const drumsBuf = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, sr);
  const vocalsBuf = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, sr);
  const otherBuf = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, sr);
  
  const fcBass = 200;
  const alphaBass = Math.exp(-2 * Math.PI * fcBass / sr);
  const hpVoc = 180;
  const lpVoc = 4000;
  const aHP = Math.exp(-2 * Math.PI * hpVoc / sr);
  const aLP = Math.exp(-2 * Math.PI * lpVoc / sr);
  const transientThresh = 0.18;
  
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const b = bassBuf.getChannelData(ch);
    const d = drumsBuf.getChannelData(ch);
    const v = vocalsBuf.getChannelData(ch);
    const o = otherBuf.getChannelData(ch);
    
    let lpBass = 0, hpStage = 0, lpStage = 0, prev = 0;
    
    for (let i = 0; i < src.length; i++) {
      const x = src[i];
      lpBass = (1 - alphaBass) * x + alphaBass * lpBass;
      b[i] = lpBass;
      hpStage = (1 - aHP) * hpStage + (1 - aHP) * (x - hpStage);
      lpStage = (1 - aLP) * x + aLP * lpStage;
      const band = hpStage - (hpStage - lpStage);
      v[i] = band;
      const diff = x - prev;
      prev = x;
      if (Math.abs(diff) > transientThresh) d[i] = x;
      else d[i] = 0;
      o[i] = x - (b[i] + v[i] + d[i]);
    }
  }
  
  const t1 = performance.now();
  return {
    stems: { bass: bassBuf, drums: drumsBuf, vocals: vocalsBuf, other: otherBuf },
    method: 'heuristic_desktop_v1',
    elapsedMs: +(t1 - t0).toFixed(1),
    fallbackUsed: true
  };
}

// Processamento puramente matemático para iOS (sem OfflineAudioContext)
function heuristicsSeparationPure(audioBuffer, opts = {}) {
  const t0 = performance.now();
  const sr = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  // Criar estruturas de dados puras
  const stems = {
    bass: { 
      sampleRate: sr, numberOfChannels, length, duration: length/sr,
      channels: [] 
    },
    drums: { 
      sampleRate: sr, numberOfChannels, length, duration: length/sr,
      channels: [] 
    },
    vocals: { 
      sampleRate: sr, numberOfChannels, length, duration: length/sr,
      channels: [] 
    },
    other: { 
      sampleRate: sr, numberOfChannels, length, duration: length/sr,
      channels: [] 
    }
  };
  
  // Criar arrays para cada canal
  for (let ch = 0; ch < numberOfChannels; ch++) {
    stems.bass.channels[ch] = new Float32Array(length);
    stems.drums.channels[ch] = new Float32Array(length);
    stems.vocals.channels[ch] = new Float32Array(length);
    stems.other.channels[ch] = new Float32Array(length);
  }
  
  // Adicionar métodos getChannelData para compatibilidade
  for (const [key, stem] of Object.entries(stems)) {
    stem.getChannelData = (channel) => stem.channels[channel];
  }
  
  const fcBass = 200;
  const alphaBass = Math.exp(-2 * Math.PI * fcBass / sr);
  const hpVoc = 180;
  const lpVoc = 4000;
  const aHP = Math.exp(-2 * Math.PI * hpVoc / sr);
  const aLP = Math.exp(-2 * Math.PI * lpVoc / sr);
  const transientThresh = 0.18;
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const b = stems.bass.channels[ch];
    const d = stems.drums.channels[ch];
    const v = stems.vocals.channels[ch];
    const o = stems.other.channels[ch];
    
    let lpBass = 0, hpStage = 0, lpStage = 0, prev = 0;
    
    for (let i = 0; i < src.length; i++) {
      const x = src[i];
      lpBass = (1 - alphaBass) * x + alphaBass * lpBass;
      b[i] = lpBass;
      hpStage = (1 - aHP) * hpStage + (1 - aHP) * (x - hpStage);
      lpStage = (1 - aLP) * x + aLP * lpStage;
      const band = hpStage - (hpStage - lpStage);
      v[i] = band;
      const diff = x - prev;
      prev = x;
      if (Math.abs(diff) > transientThresh) d[i] = x;
      else d[i] = 0;
      o[i] = x - (b[i] + v[i] + d[i]);
    }
  }
  
  const t1 = performance.now();
  return {
    stems: stems,
    method: 'heuristic_pure_iOS_v1',
    elapsedMs: +(t1 - t0).toFixed(1),
    fallbackUsed: false,
    iOSSafe: true
  };
}

function computeBasicMetrics(audioBuffer) {
  const ch0 = audioBuffer.getChannelData ? audioBuffer.getChannelData(0) : audioBuffer.channels[0];
  if (!ch0) return { peakDb: -Infinity, rmsDb: -Infinity };
  
  let peak = 0, sumSq = 0;
  for (let i = 0; i < ch0.length; i++) {
    const v = Math.abs(ch0[i]);
    if (v > peak) peak = v;
    sumSq += ch0[i] * ch0[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, ch0.length));
  const toDb = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  return { peakDb: toDb(peak), rmsDb: toDb(rms) };
}

// Função principal com estratégia adaptativa
export async function separateStems(audioBuffer, options = { timeoutMs: 90000 }) {
  const start = Date.now();
  const capabilities = detectCapabilities();
  
  try {
    caiarLog('STEMS_START', 'Iniciando separação adaptativa', {
      isIOS: capabilities.isIOS,
      hasWebWorkers: capabilities.hasWebWorkers,
      duration: audioBuffer.duration
    });
    
    let result = null;
    
    // ESTRATÉGIA 1: Web Workers (preferência)
    if (capabilities.hasWebWorkers && !options.forceInline) {
      try {
        caiarLog('STEMS_STRATEGY', 'Tentando Web Workers');
        result = await separateViaWorker(audioBuffer, {
          ...options,
          onProgress: options.onProgress
        });
        caiarLog('STEMS_SUCCESS', 'Web Workers executado com sucesso');
      } catch (workerError) {
        caiarLog('STEMS_WORKER_FALLBACK', 'Web Worker falhou, tentando fallback', {
          error: workerError.message
        });
        // Continuar para fallback
      }
    }
    
    // ESTRATÉGIA 2: Fallback inline
    if (!result) {
      caiarLog('STEMS_STRATEGY', 'Usando processamento inline');
      result = heuristicsSeparationInline(audioBuffer, options);
    }
    
    // Calcular métricas
    const metrics = {};
    for (const [k, buf] of Object.entries(result.stems)) {
      metrics[k] = computeBasicMetrics(buf);
    }
    
    const totalMs = Date.now() - start;
    const finalResult = { ...result, totalMs, metrics };
    
    caiarLog('STEMS_DONE', 'Separação concluída', {
      method: finalResult.method,
      ms: totalMs,
      strategy: result.processedInWorker ? 'worker' : 'inline'
    });
    
    return finalResult;
    
  } catch (e) {
    caiarLog('STEMS_ERROR', 'Falha na separação', { error: e?.message || String(e) });
    return null;
  }
}

// Cleanup function
export function cleanupStemsManager() {
  workerPool.forEach(worker => {
    if (worker && typeof worker.terminate === 'function') {
      worker.terminate();
    }
  });
  workerPool = [];
  caiarLog('STEMS_CLEANUP', 'Workers terminados');
}

// Configuração dinâmica
export function configureStemsManager(options = {}) {
  if (options.maxWorkers && options.maxWorkers > 0 && options.maxWorkers <= 4) {
    MAX_WORKERS = options.maxWorkers;
    caiarLog('STEMS_CONFIG', 'Configuração atualizada', { maxWorkers: MAX_WORKERS });
  }
}

export default separateStems;
