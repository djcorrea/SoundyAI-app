// CAIAR Validation Suite
// Objetivo: medir cobertura de métricas dentro da tolerância e simular impacto das correções sugeridas.
// Gated por window.CAIAR_ENABLED. Não altera fluxo padrão quando desativado.

import { caiarLog } from '../features/caiar-logger.js';

const DEFAULT_TEST_COUNT = 10;

function ensureCtx(){
  if (typeof window === 'undefined') throw new Error('Browser only');
  if (!window.__VALID_AUDIO_CTX__) {
    window.__VALID_AUDIO_CTX__ = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window.__VALID_AUDIO_CTX__;
}

// Frequências por banda (alinhado ao analyzer)
const BAND_RANGES = {
  sub: [20,60],
  low_bass:[60,120],
  upper_bass:[120,250],
  low_mid:[250,500],
  mid:[500,2000],
  high_mid:[2000,6000],
  brilho:[6000,12000],
  presenca:[12000,18000]
};

function synthTestSet(count=DEFAULT_TEST_COUNT){
  const ctx = ensureCtx();
  const sr = ctx.sampleRate;
  const out = [];
  const dur = 25; // segundos por faixa (limitado)
  const makeBuf = ()=> ctx.createBuffer(2, dur*sr, sr);
  const profiles = [
    { name:'kick_bass_heavy', genre:'funk_mandela', build:(b)=>fillKickBass(b,sr,50,100) },
    { name:'bright_hats', genre:'trance', build:(b)=>fillNoiseBand(b,sr,8000,12000,0.4) },
    { name:'muddy_mid', genre:'trap', build:(b)=>fillNoiseBand(b,sr,250,450,0.5) },
    { name:'stereo_wide_high', genre:'trance', build:(b)=>fillWideHigh(b,sr) },
    { name:'sub_weak', genre:'funk_mandela', build:(b)=>fillWeakSub(b,sr) },
    { name:'balanced_ref_like', genre:'trance', build:(b)=>fillBalanced(b,sr) },
    { name:'harsh_high_mid', genre:'eletronico', build:(b)=>fillNoiseBand(b,sr,3000,6000,0.45) },
    { name:'mono_dull', genre:'trap', build:(b)=>fillMonoDull(b,sr) },
    { name:'dynamic_roomy', genre:'eletronico', build:(b)=>fillDynamic(b,sr) },
    { name:'clippy_sub', genre:'funk_mandela', build:(b)=>fillClippySub(b,sr) }
  ].slice(0,count);
  for (const p of profiles){
    const buf = makeBuf();
    p.build(buf);
    out.push({ name: p.name, buffer: buf, genre: p.genre });
  }
  return out;
}

// ===== Synth Helpers =====
function fillKickBass(buf,sr,fKick=50,fBass=100){
  for (let ch=0; ch<buf.numberOfChannels; ch++){
    const d = buf.getChannelData(ch);
    for (let i=0;i<d.length;i++){
      const t = i/sr;
      const env = Math.exp(-t*4) * ((i % (sr*0.5)) < sr*0.1 ? 1 : 0.3);
      d[i] += Math.sin(2*Math.PI*fKick*t)*env*0.9 + Math.sin(2*Math.PI*fBass*t)*0.3;
    }
  }
}
function fillNoiseBand(buf,sr,fl,fh,amp){
  for (let ch=0; ch<2; ch++){
    const d=buf.getChannelData(ch);
    for (let i=0;i<d.length;i++){
      const white = (Math.random()*2-1);
      // crude band-pass via difference of two integrators
      const t=i/sr; const center=(fl+fh)/2; const mod=Math.sin(2*Math.PI*0.25*t)*0.2+1;
      d[i]+= white * amp * mod * (center>4000?0.7:1);
    }
  }
}
function fillWideHigh(buf,sr){ fillNoiseBand(buf,sr,6000,12000,0.35); // decorrelate R channel
  const r=buf.getChannelData(1); for (let i=0;i<r.length;i++){ r[i]*=(Math.random()>0.5?1:-1); }
}
function fillWeakSub(buf,sr){ fillNoiseBand(buf,sr,500,3000,0.25); }
function fillBalanced(buf,sr){ fillNoiseBand(buf,sr,80,12000,0.2); }
function fillMonoDull(buf,sr){ const l=buf.getChannelData(0); const r=buf.getChannelData(1); for(let i=0;i<l.length;i++){ const t=i/sr; const s=Math.sin(2*Math.PI*220*t)*0.2; l[i]+=s; r[i]+=s; } }
function fillDynamic(buf,sr){ const l=buf.getChannelData(0); const r=buf.getChannelData(1); for(let i=0;i<l.length;i++){ const t=i/sr; const env=( (i%(sr*2))<sr ? 1:0.3); const s=Math.sin(2*Math.PI*440*t)*0.25*env; l[i]+=s; r[i]+=s*0.9; } }
function fillClippySub(buf,sr){ const l=buf.getChannelData(0); const r=buf.getChannelData(1); for(let i=0;i<l.length;i++){ const t=i/sr; let s=Math.sin(2*Math.PI*55*t)*1.1; s=Math.max(-1,Math.min(1,s)); l[i]+=s; r[i]+=s; } }

// ===== Coverage Calculation =====
function metricsCoverage(analysis, ref){
  const tech = analysis?.technicalData||{};
  if (!ref) return { count:0, inside:0, pct:0 };
  const checks = [];
  const add=(val,target,tol,key)=>{ if(Number.isFinite(val)&&Number.isFinite(target)&&Number.isFinite(tol)) checks.push(Math.abs(val-target)<=tol?1:0); };
  add(tech.lufsIntegrated, ref.lufs_target, ref.tol_lufs,'lufs');
  add(tech.truePeakDbtp, ref.true_peak_target, ref.tol_true_peak,'tp');
  add(tech.dynamicRange, ref.dr_target, ref.tol_dr,'dr');
  add(tech.lra, ref.lra_target, ref.tol_lra,'lra');
  add(tech.stereoCorrelation, ref.stereo_target, ref.tol_stereo,'stereo');
  // Bands
  if (tech.bandEnergies && ref.bands){
    for (const [band, rb] of Object.entries(ref.bands)){
      if (!rb || rb._target_na) continue;
      const loc = tech.bandEnergies[band];
      if (loc && Number.isFinite(loc.rms_db) && Number.isFinite(rb.target_db) && Number.isFinite(rb.tol_db)){
        checks.push(Math.abs(loc.rms_db - rb.target_db) <= rb.tol_db ? 1:0);
      }
    }
  }
  const inside = checks.reduce((a,b)=>a+b,0);
  const pct = checks.length? inside / checks.length : 0;
  return { count: checks.length, inside, pct };
}

// ===== Simulation of Corrections (approximate) =====
function simulateCorrections(buffer, suggestions){
  if (!suggestions||!suggestions.length) return buffer;
  // Copiar
  const ctx = ensureCtx();
  const clone = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch=0; ch<buffer.numberOfChannels; ch++) clone.getChannelData(ch).set(buffer.getChannelData(ch));
  // Aplicar ajustes simplificados por banda (ganho multiplicativo)
  const gains = []; // [{range:[f1,f2], gainLinear:...}]
  for (const s of suggestions.slice(0,6)){
    const type = s.subtype || s.type || '';
    if (/dynamic_eq_sidechain/.test(type)) {
      gains.push({ range:[60,140], gainLinear: dbToLinear(-(s.gainReductionDb||3)*0.6) });
    } else if (/stereo_adjust/.test(type)) {
      // reduzir side acima de 6k -> pós loop
      gains.push({ stereoHigh: true, factor:0.85 });
    } else if (/multiband_compression/.test(type)) {
      gains.push({ range:[6000,12000], gainLinear: dbToLinear(-2) });
    } else if (/dynamic_eq_narrow/.test(type)) {
      const f = s.freqHz||350; gains.push({ range:[f*0.8,f*1.2], gainLinear: dbToLinear(-(s.gainReductionDb||2)) });
    } else if (/band_adjust/.test(type)) {
      // Parse diff em detalhes se existir
      const band = s.message && s.message.match(/Banda (\w+)/i); if (band){
        const br = BAND_RANGES[band[1]]; if (br){
          const m = s.details && s.details.match(/Diferença ([+\-]?[0-9.]+)/);
          const diff = m? parseFloat(m[1]): (s.diffDb||0);
          gains.push({ range: br, gainLinear: dbToLinear(-diff*0.6) });
        }
      }
    } else if (/surgical_eq/.test(type)) {
      const m = s.message && s.message.match(/\[(\d+)Hz\]/); if (m){
        const f = parseFloat(m[1]); gains.push({ range:[f*0.9,f*1.1], gainLinear: dbToLinear(-2) });
      }
    }
  }
  if (!gains.length) return clone;
  // FFT frame approach (coarse): process in overlapping frames and scale bins
  const fftSize = 1024; const hop = 512;
  const win = new Float32Array(fftSize); for (let i=0;i<fftSize;i++){ win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(fftSize-1)); }
  for (let ch=0; ch<clone.numberOfChannels; ch++){
    const data = clone.getChannelData(ch);
    for (let pos=0; pos+fftSize<=data.length; pos+=hop){
      const frame = new Float32Array(fftSize);
      for (let i=0;i<fftSize;i++) frame[i]=data[pos+i]*win[i];
      const specR = new Float32Array(fftSize);
      const specI = new Float32Array(fftSize);
      fft(frame,specR,specI);
      const sr = clone.sampleRate; const binHz = sr/fftSize;
      for (let k=0;k<fftSize/2;k++){
        const f = k*binHz;
        let scale = 1;
        for (const g of gains){
          if (g.range && f>=g.range[0] && f<=g.range[1]) scale*= g.gainLinear;
        }
        specR[k]*=scale; specI[k]*=scale;
      }
      // iFFT real simplificado
      ifft(frame,specR,specI);
      for (let i=0;i<fftSize;i++) data[pos+i] = data[pos+i]*0.5 + frame[i]*win[i];
    }
  }
  // stereo high width reduction
  if (gains.some(g=>g.stereoHigh) && clone.numberOfChannels>1){
    const L=clone.getChannelData(0), R=clone.getChannelData(1); const sr=clone.sampleRate;
    const cutoff=6000; const rc= 1/(2*Math.PI*cutoff); const dt=1/sr; const a= dt/(rc+dt);
    // crude low-pass to extract low part -> subtract to isolate highs, scale side highs
    for (let i=1;i<L.length;i++){
      L[i] = L[i]; R[i]=R[i]; // placeholder (skipped detailed implementation for performance)
    }
    // Simplistic side attenuation
    for (let i=0;i<L.length;i++){ const mid=0.5*(L[i]+R[i]); const side=0.5*(L[i]-R[i])*0.85; L[i]=mid+side; R[i]=mid-side; }
  }
  return clone;
}

function dbToLinear(db){ return Math.pow(10, db/20); }

// Minimal FFT (radix-2 Cooley–Tukey) for small size
function fft(time, outR, outI){
  const N=time.length; let i=0,j=0; for(;i<N;i++){ outR[i]=time[i]; outI[i]=0; }
  for(i=0;i<N;i++){ if (j>i){ const tr=outR[i]; outR[i]=outR[j]; outR[j]=tr; const ti=outI[i]; outI[i]=outI[j]; outI[j]=ti; } let m=N>>1; while(m>=1 && j>=m){ j-=m; m>>=1; } j+=m; }
  for(let size=2; size<=N; size<<=1){ const half=size>>1; const step=Math.PI*2/size; for(let start=0; start<N; start+=size){ for(let k=0;k<half;k++){ const angle= step*k; const wr=Math.cos(angle), wi=-Math.sin(angle); const i1=start+k, i2=i1+half; const tr=wr*outR[i2]-wi*outI[i2]; const ti=wr*outI[i2]+wi*outR[i2]; outR[i2]=outR[i1]-tr; outI[i2]=outI[i1]-ti; outR[i1]+=tr; outI[i1]+=ti; } } }
}
function ifft(out,timeR,timeI){ // misuse param names for brevity
  const N=timeR.length; const rR=new Float32Array(N), rI=new Float32Array(N);
  for(let i=0;i<N;i++){ rR[i]=timeR[i]; rI[i]=-timeI[i]; }
  fft(rR,rR,rI); for(let i=0;i<N;i++){ out[i]=rR[i]/N; }
}

export async function runValidationSuite(opts={}){
  if (typeof window !== 'undefined' && !window.CAIAR_ENABLED) { caiarLog('VALID_SKIP','Suite ignorada (flag off)'); return null; }
  const analyzer = window.audioAnalyzer;
  if (!analyzer) throw new Error('audioAnalyzer indisponível');
  const testSet = opts.testSet || synthTestSet();
  const results = [];
  for (const track of testSet){
    const genre = track.genre || (window.PROD_AI_REF_GENRE||'trance');
    // garantir referência carregada
    if (window.applyGenreSelection) await window.applyGenreSelection(genre);
    const before = await analyzer.analyzeAudioBufferDirect(track.buffer, track.name+'_before');
    const ref = window.PROD_AI_REF_DATA || null;
    const covBefore = metricsCoverage(before, ref);
    // coletar sugestões relevantes
    const sugg = before?.suggestions?.filter(s=> /dynamic_eq|band_adjust|surgical_eq|stereo_adjust|multiband_compression/.test(s.type+s.subtype)) || [];
    const modifiedBuffer = simulateCorrections(track.buffer, sugg);
    const after = await analyzer.analyzeAudioBufferDirect(modifiedBuffer, track.name+'_after');
    const covAfter = metricsCoverage(after, ref);
    results.push({
      name: track.name,
      genre,
      coverageBefore: covBefore,
      coverageAfter: covAfter,
      coverageDelta: +(covAfter.pct - covBefore.pct).toFixed(4),
      suggestionsApplied: sugg.length,
      metrics: {
        lufsBefore: before?.technicalData?.lufsIntegrated,
        lufsAfter: after?.technicalData?.lufsIntegrated,
        drBefore: before?.technicalData?.dynamicRange,
        drAfter: after?.technicalData?.dynamicRange,
        lraBefore: before?.technicalData?.lra,
        lraAfter: after?.technicalData?.lra,
        stereoBefore: before?.technicalData?.stereoCorrelation,
        stereoAfter: after?.technicalData?.stereoCorrelation
      }
    });
  }
  const improved = results.filter(r=> r.coverageDelta>0).length;
  const avgDelta = results.reduce((a,b)=>a+b.coverageDelta,0)/Math.max(1,results.length);
  const summary = { total: results.length, improved, pctImproved: improved/results.length, avgDelta, results };
  if (typeof window !== 'undefined') window.__VALIDATION_RESULTS__ = summary;
  caiarLog('VALID_DONE','Suite concluída', summary);
  return summary;
}

// Subjetivo: gerar formulário dinâmico (1-5) para punch, vocal, sub, fadiga
export function renderSubjectiveForm(containerId='validationSubjective'){ if (typeof document==='undefined') return;
  const res = window.__VALIDATION_RESULTS__; if (!res) return;
  let c = document.getElementById(containerId); if(!c){ c=document.createElement('div'); c.id=containerId; document.body.appendChild(c);} c.innerHTML='';
  const metrics=['punch','clarezaVocal','defSub','fadigaAgudos'];
  const labels={ punch:'Punch', clarezaVocal:'Clareza Vocal', defSub:'Def. Sub', fadigaAgudos:'Fadiga Agudos (menor=melhor)' };
  const tbl = document.createElement('table'); tbl.className='subjective-table';
  tbl.innerHTML='<thead><tr><th>Faixa</th>'+metrics.map(m=>'<th>'+labels[m]+' Antes</th><th>'+labels[m]+' Depois</th>').join('')+'</tr></thead>';
  const tb = document.createElement('tbody');
  res.results.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+r.name+'</td>'+metrics.map(m=> `<td>${ratingSelect(r.name,m,'before')}</td><td>${ratingSelect(r.name,m,'after')}</td>`).join('');
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); c.appendChild(tbl);
  const btn=document.createElement('button'); btn.textContent='Consolidar Avaliação Subjetiva'; btn.onclick=()=> finalizeSubjectiveRatings(); c.appendChild(btn);
}
function ratingSelect(track,metric,phase){ const id=`subj_${track}_${metric}_${phase}`; return `<select id="${id}" style="background:#0e1422;color:#fff;border:1px solid #1f2b40;padding:2px 4px;font-size:11px;">${[1,2,3,4,5].map(v=>`<option value='${v}'>${v}</option>`).join('')}</select>`; }

export function finalizeSubjectiveRatings(){ const res=window.__VALIDATION_RESULTS__; if(!res) return;
  const metrics=['punch','clarezaVocal','defSub','fadigaAgudos'];
  let improvedTracks=0; const trackImprovements=[];
  for (const r of res.results){ let improved=0; for (const m of metrics){ const b=parseInt(valOf(r.name,m,'before'),10); const a=parseInt(valOf(r.name,m,'after'),10); if(!isNaN(b)&&!isNaN(a)) { if (m==='fadigaAgudos'){ if (a<b) improved++; } else if (a>b) improved++; } }
    if (improved>=2) improvedTracks++; trackImprovements.push({ name:r.name, improvedMetrics: improved }); }
  const subjectiveSummary={ improvedTracks, pctImproved: improvedTracks/res.results.length, trackImprovements };
  window.__VALIDATION_SUBJECTIVE__ = subjectiveSummary; caiarLog('VALID_SUBJECTIVE','Subjetivo consolidado', subjectiveSummary); return subjectiveSummary; }
function valOf(track,metric,phase){ const el=document.getElementById(`subj_${track}_${metric}_${phase}`); return el? el.value: 'NaN'; }

export function generateValidationReport(){ const res=window.__VALIDATION_RESULTS__; if(!res) return null; const subj=window.__VALIDATION_SUBJECTIVE__||{}; const passSubjective = subj.pctImproved!=null ? (subj.pctImproved >= 0.7) : null; const report={ timestamp:new Date().toISOString(), objective:res, subjective:subj, passSubjective, criteria:{ subjectiveGoal:'>=70% faixas melhoram >=2 itens' } }; return report; }

export default { runValidationSuite, generateValidationReport, renderSubjectiveForm };
