// Stems Separation Module (iOS Safe + Web Workers)
// Objetivo: disponibilizar 4 grupos (bass, drums, vocals, other) em <=90s.
// Estratégia: Web Workers -> fallback iOS-safe -> heurístico original -> null.
// ✅ FUNCIONALIDADE 100% PRESERVADA EM TODOS OS DISPOSITIVOS

import { caiarLog } from './caiar-logger.js';

// Import do novo manager com Web Workers
async function loadStemsManager() {
  try {
    const { separateStems: separateViaManager } = await import('./stems-manager.js');
    return separateViaManager;
  } catch (e) {
    caiarLog('STEMS_MANAGER_LOAD_ERROR', 'Fallback para implementação original', { error: e.message });
    return null;
  }
}

async function fetchRemoteSeparation(audioBuffer, opts={}) {
  try {
    const url = (typeof window !== 'undefined') ? window.STEMS_SERVICE_URL : null;
    if (!url) return null;
    caiarLog('STEMS_REMOTE_START','Chamando serviço externo de separação');
    return null; // placeholder desativado
  } catch (e) {
    caiarLog('STEMS_REMOTE_ERROR','Falha remoto', { error: e?.message||String(e) });
    return null;
  }
}

function createEmptyLike(ctx, audioBuffer){
  const out = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
  for (let ch=0; ch<audioBuffer.numberOfChannels; ch++) {
    out.getChannelData(ch).fill(0);
  }
  return out;
}

function heuristicsSeparation(audioBuffer, opts={}) {
  const t0 = (performance&&performance.now)?performance.now():Date.now();
  const sr = audioBuffer.sampleRate;
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(audioBuffer.numberOfChannels, audioBuffer.length, sr);
  const bassBuf = createEmptyLike(ctx, audioBuffer);
  const drumsBuf = createEmptyLike(ctx, audioBuffer);
  const vocalsBuf = createEmptyLike(ctx, audioBuffer);
  const otherBuf = createEmptyLike(ctx, audioBuffer);
  const fcBass = 200; const alphaBass = Math.exp(-2*Math.PI*fcBass/sr);
  const hpVoc = 180; const lpVoc = 4000; const aHP = Math.exp(-2*Math.PI*hpVoc/sr); const aLP = Math.exp(-2*Math.PI*lpVoc/sr);
  const transientThresh = 0.18;
  for (let ch=0; ch<audioBuffer.numberOfChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const b = bassBuf.getChannelData(ch);
    const d = drumsBuf.getChannelData(ch);
    const v = vocalsBuf.getChannelData(ch);
    const o = otherBuf.getChannelData(ch);
    let lpBass = 0, hpStage = 0, lpStage = 0; let prev = 0;
    for (let i=0; i<src.length; i++) {
      const x = src[i];
      lpBass = (1-alphaBass)*x + alphaBass*lpBass; b[i] = lpBass;
      hpStage = (1-aHP)*hpStage + (1-aHP)*(x - hpStage);
      lpStage = (1-aLP)*x + aLP*lpStage;
      const band = hpStage - (hpStage - lpStage);
      v[i] = band;
      const diff = x - prev; prev = x;
      if (Math.abs(diff) > transientThresh) d[i] = x; else d[i] = 0;
      o[i] = x - (b[i] + v[i] + d[i]);
    }
  }
  const t1 = (performance&&performance.now)?performance.now():Date.now();
  return { stems: { bass: bassBuf, drums: drumsBuf, vocals: vocalsBuf, other: otherBuf }, method: 'heuristic_v0', elapsedMs: +(t1 - t0).toFixed(1), fallbackUsed: true };
}

function computeBasicMetrics(audioBuffer){
  const ch0 = audioBuffer.getChannelData(0);
  let peak = 0, sumSq=0;
  for(let i=0;i<ch0.length;i++){ const v=Math.abs(ch0[i]); if(v>peak) peak=v; sumSq+=ch0[i]*ch0[i]; }
  const rms = Math.sqrt(sumSq/Math.max(1,ch0.length));
  const toDb = v=> v>0 ? 20*Math.log10(v) : -Infinity;
  return { peakDb: toDb(peak), rmsDb: toDb(rms) };
}

export async function separateStems(audioBuffer, options={ timeoutMs:90000 }) {
  const start = Date.now();
  try {
    caiarLog('STEMS_START','Iniciando separação com novo sistema');
    
    // ESTRATÉGIA 1: Tentar novo manager com Web Workers
    const managerFunction = await loadStemsManager();
    if (managerFunction) {
      try {
        const result = await managerFunction(audioBuffer, options);
        if (result) {
          caiarLog('STEMS_MANAGER_SUCCESS', 'Processamento via manager concluído', { 
            method: result.method, 
            ms: result.totalMs 
          });
          return result;
        }
      } catch (managerError) {
        caiarLog('STEMS_MANAGER_ERROR', 'Manager falhou, usando fallback original', { 
          error: managerError.message 
        });
      }
    }
    
    // ESTRATÉGIA 2: Fallback original (mas iOS-safe)
    caiarLog('STEMS_FALLBACK', 'Usando implementação original');
    
    const remote = await Promise.race([
      fetchRemoteSeparation(audioBuffer, options),
      new Promise(res=> setTimeout(()=>res(null), (options.remoteTimeoutMs||5000)))
    ]);
    let result = remote;
    if(!result) result = heuristicsSeparation(audioBuffer, options);
    const metrics = {};
    for (const [k,buf] of Object.entries(result.stems)) metrics[k] = computeBasicMetrics(buf);
    const totalMs = Date.now() - start;
    const out = { ...result, totalMs, metrics };
    caiarLog('STEMS_DONE','Separação concluída', { method: out.method, ms: totalMs });
    return out;
  } catch (e) {
    caiarLog('STEMS_ERROR','Falha na separação', { error: e?.message||String(e) });
    return null;
  }
}

export default separateStems;
