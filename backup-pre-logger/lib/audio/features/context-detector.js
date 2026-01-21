// Context Detector: BPM, Tonalidade, Key Confidence, Densidade (onset rate + RMS médio)
// Objetivo: rápido, sem dependências externas, robusto o suficiente para ±1–2 BPM em casos comuns.
// Não altera UI; consumidor lê via window.__AUDIO_CONTEXT_DETECTION ou analysis._contextDetection (somente se CAIAR_ENABLED=true).

import { caiarLog } from './caiar-logger.js';

// Krumhansl major/minor profiles (pitch class weights)
const KRUMHANSL_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KRUMHANSL_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function hanning(N){ const w=new Float32Array(N); for(let n=0;n<N;n++) w[n]=0.5-0.5*Math.cos(2*Math.PI*n/(N-1)); return w; }
function magnitudeFFTReal(buf){ // naive DFT fallback
  const N = buf.length;
  return dftMag(buf);
}
function dftMag(buf){ const N=buf.length; const out=new Float32Array(N/2); const twopi=2*Math.PI; for(let k=0;k<out.length;k++){ let re=0, im=0; for(let n=0;n<N;n++){ const ang=twopi*k*n/N; const v=buf[n]; re+=v*Math.cos(ang); im-=v*Math.sin(ang);} out[k]=Math.sqrt(re*re+im*im); } return out; }

function computeOnsetEnvelope(channel, sampleRate){
  const hop = 1024; const win = 2048; const N = channel.length; const env=[]; const window = hanning(win);
  let prevSpec=null; let time=[];
  for(let start=0; start+win<=N; start+=hop){
    const frame = new Float32Array(win);
    for(let i=0;i<win;i++) frame[i]=channel[start+i]*window[i];
    const mag = magnitudeFFTReal(frame);
    if(prevSpec){
      let flux=0; for(let k=0;k<mag.length;k++){ const d=mag[k]-prevSpec[k]; if(d>0) flux+=d; }
      env.push(flux);
      time.push(start/sampleRate);
    }
    prevSpec=mag;
  }
  if(env.length){ const max = Math.max(...env); if(max>0){ for(let i=0;i<env.length;i++) env[i]/=max; } }
  return { env, time };
}

function autocorrelateTempo(env, time){
  if(env.length<8) return null;
  const mean = env.reduce((a,b)=>a+b,0)/env.length;
  const x = env.map(v=>v-mean);
  const dt = (time[time.length-1]-time[0]) / (env.length-1) || 0.01;
  const minBPM=60, maxBPM=200;
  const results=[];
  for(let bpm=minBPM; bpm<=maxBPM; bpm+=0.5){
    const periodSec = 60/bpm; const lag = Math.round(periodSec/dt); if(lag<=1 || lag>=x.length-1) continue;
    let num=0, denomA=0, denomB=0; for(let i=0;i+lag<x.length;i++){ const a=x[i], b=x[i+lag]; num+=a*b; denomA+=a*a; denomB+=b*b; }
    const r = num/Math.sqrt((denomA||1)*(denomB||1));
    results.push({ bpm, r });
  }
  results.sort((a,b)=>b.r-a.r);
  if(!results.length) return null;
  const best = results[0];
  const second = results[1] || { r:0 };
  let conf = Math.max(0, best.r - second.r);
  conf = Math.min(1, (conf*0.6) + Math.max(0,best.r)*0.4);
  return { bpm: best.bpm, confidence: +conf.toFixed(3), bestR: best.r };
}

function aggregateChromagram(channel, sampleRate){
  const hop = 4096; const win = 8192; if(channel.length < win) return null;
  const window = hanning(win);
  const chroma = new Float32Array(12);
  const A4=440; const fRef = A4;
  for(let start=0; start+win<=channel.length; start+=hop){
    const frame=new Float32Array(win); for(let i=0;i<win;i++) frame[i]=channel[start+i]*window[i];
    const mag = magnitudeFFTReal(frame);
    const binHz = sampleRate / (2*mag.length*1.0);
    for(let k=1;k<mag.length;k++){
      const freq = k*binHz; if(freq<27.5 || freq>5000) continue;
      const m = mag[k]; if(!m) continue;
      const noteNum = 12 * Math.log2(freq / fRef) + 57;
      const pc = ((Math.round(noteNum) % 12)+12)%12;
      chroma[pc] += m;
    }
  }
  const total = chroma.reduce((a,b)=>a+b,0) || 1;
  for(let i=0;i<12;i++) chroma[i]/=total;
  return chroma;
}

function correlateKey(chroma){
  if(!chroma) return null;
  const rotate = (arr,n)=> arr.map((_,i)=> arr[(i+n)%12]);
  const results=[];
  for(let r=0;r<12;r++){
    const maj = rotate(KRUMHANSL_MAJOR,r); const min = rotate(KRUMHANSL_MINOR,r);
    const dotMaj = maj.reduce((s,v,i)=>s+v*chroma[i],0);
    const dotMin = min.reduce((s,v,i)=>s+v*chroma[i],0);
    results.push({ keyIndex:r, mode:'major', score:dotMaj });
    results.push({ keyIndex:r, mode:'minor', score:dotMin });
  }
  results.sort((a,b)=>b.score-a.score);
  const best = results[0]; const second = results[1]||{score:0};
  const maxScore = best.score||1;
  let conf = (best.score - second.score)/(Math.abs(maxScore)||1);
  conf = Math.max(0, Math.min(1, conf));
  const KEY_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return { key: KEY_NAMES[best.keyIndex] + (best.mode==='major'?'':'m'), confidence:+conf.toFixed(3) };
}

function computeDensity(channel, sampleRate){
  const win = Math.round(sampleRate*0.25);
  const hop = Math.round(win/2);
  if(win<8) return { onsetRate:null, rmsMean:null };
  const rmsVals=[]; const onsets=[];
  let prevEnergy=null; let t=0;
  for(let start=0; start+win<=channel.length; start+=hop){
    let sum=0; for(let i=0;i<win;i++){ const v=channel[start+i]; sum+=v*v; }
    const rms = Math.sqrt(sum/win); const energy = rms*rms;
    rmsVals.push(rms);
    if(prevEnergy!=null){ const diff = energy - prevEnergy; if(diff > prevEnergy*0.35) onsets.push(t); }
    prevEnergy=energy; t += hop/sampleRate;
  }
  const duration = channel.length / sampleRate;
  const onsetRate = onsets.length / Math.max(0.001,duration);
  const rmsMean = rmsVals.reduce((a,b)=>a+b,0)/Math.max(1,rmsVals.length);
  return { onsetRate:+onsetRate.toFixed(3), rmsMean:+rmsMean.toFixed(5) };
}

export async function detectAudioContext(audioBuffer, opts={}){
  try {
    if(!audioBuffer || audioBuffer.length===0) return null;
    const channel = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate || 48000;
    if(audioBuffer.duration < 2) return { bpm:null, bpmConfidence:null, key:null, keyConfidence:null, arrangementDensity:{ onsetRate:null, windowRmsMean:null }, _skipped:true };
    caiarLog('CTX_START','Detecção de contexto iniciada', { duration: audioBuffer.duration, sr });
    const { env, time } = computeOnsetEnvelope(channel, sr);
    const tempoRes = autocorrelateTempo(env, time) || { bpm:null, confidence:null };
    const chroma = aggregateChromagram(channel, sr);
    const keyRes = correlateKey(chroma) || { key:null, confidence:null };
    const density = computeDensity(channel, sr);
    const ctx = {
      bpm: tempoRes.bpm ? +tempoRes.bpm.toFixed(2) : null,
      bpmConfidence: tempoRes.confidence,
      key: keyRes.key,
      keyConfidence: keyRes.confidence,
      arrangementDensity: { onsetRate: density.onsetRate, windowRmsMean: density.rmsMean }
    };
    caiarLog('CTX_DONE','Detecção de contexto concluída', ctx);
    return ctx;
  } catch (e) {
    caiarLog('CTX_ERROR','Falha na detecção de contexto', { error: e?.message||String(e) });
    return null;
  }
}

export default detectAudioContext;
