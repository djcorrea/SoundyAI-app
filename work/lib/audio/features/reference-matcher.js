// Reference Matcher: seleciona 3–5 referências mais próximas e gera metas/tolerâncias adaptativas.
// Compatível com estrutura existente de referência. Apenas ativo se CAIAR_ENABLED.
// Estratégia de distância: combinação de (sub)gênero, BPM, densidade (onsetRate, windowRmsMean) e fingerprint espectral.
// Fingerprint espectral: vetor normalizado de energias por bandas + centroid + flatness.

import { caiarLog } from './caiar-logger.js';

function safeNum(x){ return Number.isFinite(x) ? x : 0; }

function buildFingerprint(analysis) {
  try {
    const td = analysis?.technicalData || {};
    const bands = [];
    const tb = td.tonalBalance;
    if (tb) {
      ['sub','low','mid','high'].forEach(b=> { const v = tb[b]?.rms_db; if (Number.isFinite(v)) bands.push(v); else bands.push(0); });
    } else {
      bands.push( safeNum(td.spectralCentroid), safeNum(td.spectralFlatness), 0,0 );
    }
    const centroid = safeNum(td.spectralCentroid);
    const flatness = safeNum(td.spectralFlatness);
    const crest = safeNum(td.crestFactor);
    let onsetRate = null, rmsMean = null;
    try { onsetRate = analysis?._contextDetection?.arrangementDensity?.onsetRate; rmsMean = analysis?._contextDetection?.arrangementDensity?.windowRmsMean; } catch {}
    const vec = [ ...bands, centroid, flatness, crest, safeNum(onsetRate), safeNum(rmsMean) ];
    const mean = vec.reduce((a,b)=>a+b,0)/vec.length;
    const std = Math.sqrt(vec.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vec.length) || 1;
    return vec.map(v=> (v-mean)/std);
  } catch { return null; }
}

function cosineDistance(a,b){ if(!a||!b||a.length!==b.length) return 1; let dot=0,na=0,nb=0; for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; dot+=x*y; na+=x*x; nb+=y*y; } const denom = Math.sqrt(na||1)*Math.sqrt(nb||1); return 1 - (denom? dot/denom : 0); }

function computeDistance(sample, ref, weights) {
  let d = 0; let wSum=0;
  // BPM comparison disabled (BPM removed for performance optimization)
  // if (Number.isFinite(sample.bpm) && Number.isFinite(ref.bpm)) {
  //   const diff = Math.abs(sample.bpm - ref.bpm);
  //   d += weights.bpm * Math.min(1, diff / 20); wSum += weights.bpm;
  //   if (diff > 40) d += 0.5;
  // }
  if (Number.isFinite(sample.onsetRate) && Number.isFinite(ref.onsetRate)) {
    const rd = Math.abs(sample.onsetRate - ref.onsetRate)/Math.max(0.001, sample.onsetRate+ref.onsetRate);
    d += weights.density * Math.min(1, rd); wSum += weights.density;
  }
  if (Number.isFinite(sample.rmsMean) && Number.isFinite(ref.rmsMean)) {
    const rd2 = Math.abs(sample.rmsMean - ref.rmsMean)/Math.max(1e-9, sample.rmsMean+ref.rmsMean);
    d += weights.density * 0.5 * Math.min(1, rd2); wSum += weights.density*0.5;
  }
  if (sample.fp && ref.fp && sample.fp.length === ref.fp.length) {
    d += weights.fingerprint * cosineDistance(sample.fp, ref.fp); wSum += weights.fingerprint;
  }
  if (sample.subgenre && ref.subgenre) {
    d += (sample.subgenre === ref.subgenre ? 0 : weights.subgenre); wSum += weights.subgenre;
  }
  return wSum>0 ? d / wSum : d;
}

function weightedAverage(values, distances) {
  const eps = 0.0001; let wSum=0, acc=0; for(let i=0;i<values.length;i++){ const v=values[i]; if(!Number.isFinite(v)) continue; const w = 1/(eps+distances[i]); wSum+=w; acc+=w*v; } return wSum>0 ? acc/wSum : null;
}

export function matchAdaptiveReferences(analysis, options={ maxRefs:5, minRefs:3 }) {
  try {
    if (typeof window === 'undefined' || !window.CAIAR_ENABLED) return null;
    const lib = window.PROD_AI_REF_LIBRARY || window.PROD_AI_REF_DATA_LIBRARY || [];
    if (!Array.isArray(lib) || lib.length===0) return null;
    const ctx = analysis?._contextDetection || {};
    const sample = {
      bpm: ctx.bpm,
      onsetRate: ctx.arrangementDensity?.onsetRate,
      rmsMean: ctx.arrangementDensity?.windowRmsMean,
      subgenre: window.PROD_AI_REF_GENRE || ctx.subgenre || null,
      fp: buildFingerprint(analysis)
    };
    const weights = { bpm: 2, density: 1.2, fingerprint: 3, subgenre: 0.8 };
    const scored = lib.map(r => {
      const refFP = r._fingerprint || buildRefFingerprint(r);
      return { ref: r, distance: computeDistance(sample, { bpm: r.bpm, onsetRate: r.onsetRate, rmsMean: r.rmsMean, subgenre: r.subgenre || r.style || r.genre, fp: refFP }, weights) };
    }).sort((a,b)=> a.distance - b.distance);
    let top = scored.filter(s=> Number.isFinite(s.distance)).slice(0, options.maxRefs||5);
    if (top.length < (options.minRefs||3)) top = scored.slice(0, options.minRefs||3);
    if (!top.length) return null;
    const base = (window.PROD_AI_REF_DATA && typeof window.PROD_AI_REF_DATA==='object') ? window.PROD_AI_REF_DATA : {};
    const adaptive = JSON.parse(JSON.stringify(base || {}));
    adaptive.source = 'adaptive';
    adaptive.baseRefsUsed = top.map(t => t.ref.id || t.ref.name || t.ref.title || 'ref');
    adaptive.matchCount = top.length;
    adaptive._distances = top.map(t => +t.distance.toFixed(4));
    const distArr = top.map(t=>t.distance+0.0001);
    const pickNumeric = key => weightedAverage(top.map(t=> t.ref[key]), distArr);
    const keysGlobal = [ 'lufs_target','dr_target','true_peak_target','stereo_target' ];
    keysGlobal.forEach(k => { const val = pickNumeric(k); if (Number.isFinite(val)) adaptive[k] = parseFloat(val.toFixed(2)); });
    const mergedBands = {};
    for (const b of top) {
      const rb = b.ref.bands || {};
      for (const [band, data] of Object.entries(rb)) {
        if (!mergedBands[band]) mergedBands[band] = { targetVals: [], tolVals: [], distances: [] };
        if (Number.isFinite(data?.target_db)) { mergedBands[band].targetVals.push(data.target_db); mergedBands[band].distances.push(b.distance+0.0001); }
        if (Number.isFinite(data?.tol_db)) mergedBands[band].tolVals.push(data.tol_db);
      }
    }
    adaptive.bands = adaptive.bands || {};
    for (const [band, aggr] of Object.entries(mergedBands)) {
      const tgt = weightedAverage(aggr.targetVals, aggr.distances);
      const tol = aggr.tolVals.length ? (aggr.tolVals.reduce((a,b)=>a+b,0)/aggr.tolVals.length) : null;
      if (!adaptive.bands[band]) adaptive.bands[band] = {};
      if (Number.isFinite(tgt)) adaptive.bands[band].target_db = parseFloat(tgt.toFixed(2));
      if (Number.isFinite(tol)) adaptive.bands[band].tol_db = parseFloat(tol.toFixed(2));
    }
    adaptive._adaptiveGeneratedAt = new Date().toISOString();
    caiarLog('REF_MATCH_DONE','Adaptive reference construído', { refs: adaptive.matchCount });
    return adaptive;
  } catch (e) {
    caiarLog('REF_MATCH_ERROR','Falha gerar adaptive reference', { error: e?.message||String(e) });
    return null;
  }
}

function buildRefFingerprint(r) {
  try {
    if (r._fingerprint) return r._fingerprint;
    const bands = [];
    if (r.bands) ['sub','low','mid','high'].forEach(b=> { const v = r.bands[b]?.target_db; bands.push(Number.isFinite(v)?v:0); });
    const extra = [ safeNum(r.centroid_target), safeNum(r.flatness_target) ];
    const vec = [...bands, ...extra];
    const mean = vec.reduce((a,b)=>a+b,0)/vec.length;
    const std = Math.sqrt(vec.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vec.length)||1;
    const norm = vec.map(v=> (v-mean)/std);
    r._fingerprint = norm; return norm;
  } catch { return null; }
}

export function applyAdaptiveReference(analysis) {
  if (typeof window === 'undefined' || !window.CAIAR_ENABLED) return null;
  const adaptive = matchAdaptiveReferences(analysis) || null;
  if (adaptive) {
    analysis.adaptiveReference = adaptive;
    if (typeof window !== 'undefined') {
      window.__ADAPTIVE_REFERENCE_LAST = adaptive;
      if (window.USE_ADAPTIVE_REFERENCE === true) window.PROD_AI_REF_DATA_ACTIVE = adaptive;
    }
  }
  return adaptive;
}

export default { matchAdaptiveReferences, applyAdaptiveReference };
