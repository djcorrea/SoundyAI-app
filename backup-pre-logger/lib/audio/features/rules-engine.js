// Rules Engine Contextual (v1)
// Gera recomendações específicas (EQ dinâmico, multibanda, stereo) cruzando:
// - analysis_matrix (por stem/banda)
// - adaptiveReference / technicalData / contextDetection
// - stems (_stems.metrics)
// Apenas ativo quando CAIAR_ENABLED=true. Não altera UI legacy sem flag.

import { caiarLog } from './caiar-logger.js';

function safe(v){ return Number.isFinite(v)? v : null; }
function relDb(a,b){ if(!Number.isFinite(a)||!Number.isFinite(b)) return null; return a - b; }

function pickLeadStem(analysis){
  try {
    if (typeof window !== 'undefined' && window.LEAD_STEM) return window.LEAD_STEM;
    const stems = analysis?.analysis_matrix?.stems||{};
    if (stems.vocals) return 'vocals';
    if (stems.lead) return 'lead';
    return 'mix';
  } catch { return 'mix'; }
}

function ensureArray(obj){ return Array.isArray(obj)? obj : (obj? [obj]: []); }

function addSuggestion(list, sug){
  if(!Array.isArray(list)) return;
  const key = sug.type+'|'+(sug.subtype||'')+'|'+(sug.targetStem||'')+'|'+(sug.band||'')+'|'+(sug.freqHz||'');
  if (list.some(s=> (s._key === key))) return;
  sug._key = key;
  list.push(sug);
}

export function generateContextualCorrections(analysis){
  try {
    if (typeof window === 'undefined' || !window.CAIAR_ENABLED) return null;
    const log = window.__caiarLog||function(){};
    const matrix = analysis?.analysis_matrix; if(!matrix) { log('RULES_SKIP','Sem analysis_matrix'); return null; }
    const stems = matrix.stems || {}; const mixBands = stems.mix?.bands || {};
    const suggestions = ensureArray(analysis.suggestions);
    const leadStem = pickLeadStem(analysis);
    const adaptive = analysis?.adaptiveReference || {};
    const refBands = adaptive?.bands || ( (typeof window !== 'undefined' && window.PROD_AI_REF_DATA && window.PROD_AI_REF_DATA.bands) ? window.PROD_AI_REF_DATA.bands : {} );

    const CLASH_LOW_DB = 3;
    const HIGH_BRIGHT_DIFF = 4;
    const MUD_MID_DIFF = 3;

    const bandVal = (stemName, band)=> safe(stems?.[stemName]?.bands?.[band]?.rmsDb || stems?.[stemName]?.bands?.[band]?.rms_db);
    const mixVal = (band)=> bandVal('mix', band);

    // 1. Bass vs Kick Clash
    try {
      const bassLow = bandVal('bass','low');
      const drumsLow = bandVal('drums','low');
      const mixLow = mixVal('low');
      if (Number.isFinite(bassLow) && Number.isFinite(drumsLow) && Number.isFinite(mixLow)) {
        const bassExcess = relDb(bassLow, mixLow);
        const drumsExcess = relDb(drumsLow, mixLow);
        if (bassExcess != null && drumsExcess != null && bassExcess > CLASH_LOW_DB && drumsExcess > CLASH_LOW_DB*0.7) {
          if (leadStem !== 'bass') {
            addSuggestion(suggestions, {
              type:'context_correction', subtype:'dynamic_eq_sidechain', targetStem:'bass', triggerStem:'drums', band:'low', freqHz:100, rangeHz:[80,120], Q:2.0, gainReductionDb:3, condition:'on kick transients', message:'Conflito de energia entre baixo e kick em 80–120 Hz', action:'Aplicar EQ dinâmico (80–120 Hz, Q≈2, redução até 3 dB) sidechainado pelo kick', rationale:{ bassLow, drumsLow, mixLow }, priority:10, source:'rules:context:v1'
            });
          }
        }
      }
    } catch(e){ log('RULE_BASS_KICK_ERROR','Erro regra bass-kick',{error:e?.message}); }

    // 2. Hi-hats brightness
    try {
      const drumsHigh = bandVal('drums','high');
      const mixHigh = mixVal('high');
      const mixMid = mixVal('mid');
      if (Number.isFinite(drumsHigh) && Number.isFinite(mixHigh) && Number.isFinite(mixMid)) {
        const diffHighDrums = relDb(drumsHigh, mixHigh);
        const highVsMid = relDb(mixHigh, mixMid);
        if (diffHighDrums != null && diffHighDrums > HIGH_BRIGHT_DIFF && highVsMid > 2) {
          addSuggestion(suggestions, {
            type:'context_correction', subtype:'multiband_compression', targetStem:'drums', band:'high', freqCrossoverHz:6000, ratio:2.5, attackMs:10, releaseMs:120, gainReductionDb:3, condition:'on sustained hi-hat presence', message:'Brilho excessivo dominado por hi-hats', action:'Compressão multibanda (>6 kHz) ou transient shaper antes de cortar shelf global', rationale:{ drumsHigh, mixHigh, mixMid }, priority:20, source:'rules:context:v1'
          });
        }
      }
    } catch(e){ log('RULE_HIHAT_ERROR','Erro regra hihat',{error:e?.message}); }

    // 3. Backing vocals mid mud
    try {
      const vocalsMid = bandVal('vocals','mid');
      const refMid = refBands?.mid?.target_db;
      const mixMid = mixVal('mid');
      if (Number.isFinite(vocalsMid) && Number.isFinite(mixMid)) {
        const excessMid = relDb(vocalsMid, refMid!=null? refMid : mixMid);
        if (excessMid != null && excessMid > MUD_MID_DIFF) {
          if (leadStem !== 'vocals') {
            addSuggestion(suggestions, {
              type:'context_correction', subtype:'dynamic_eq_narrow', targetStem:'vocals', band:'mid', freqHz:350, Q:6, gainReductionDb:2, condition:'only on backing vocal phrases', message:'Acúmulo de médios em backing vocals', action:'Cortes dinâmicos estreitos (~300–400 Hz, Q6, -2 dB) apenas quando backing vocals ativos', rationale:{ vocalsMid, refMid, mixMid }, priority:30, source:'rules:context:v1'
            });
          }
        }
      }
    } catch(e){ log('RULE_BACKING_ERROR','Erro regra backing',{error:e?.message}); }

    // 4. Stereo high width control
    try {
      const corr = analysis?.technicalData?.stereoCorrelation;
      const mixHigh = mixVal('high');
      const mixMid = mixVal('mid');
      if (Number.isFinite(corr) && corr < 0.1 && Number.isFinite(mixHigh) && Number.isFinite(mixMid)) {
        const highBoost = relDb(mixHigh, mixMid);
        if (highBoost!=null && highBoost>2) {
          addSuggestion(suggestions, {
            type:'context_correction', subtype:'stereo_adjust', targetStem:'mix', band:'high', method:'mid_side_narrow', widthReductionPct:20, condition:'apply only if phase issues present', message:'Largura excessiva em agudos', action:'Reduzir side >6 kHz ~20%, compensar leve com shelf se necessário', rationale:{ corr, mixHigh, mixMid }, priority:40, source:'rules:context:v1'
          });
        }
      }
    } catch(e){ log('RULE_STEREO_ERROR','Erro regra stereo',{error:e?.message}); }

    try {
      analysis.suggestions = suggestions
        .map((s,i)=>({...s,_i:i}))
        .sort((a,b)=> (a.priority||999)-(b.priority||999) || a._i - b._i)
        .map(s=>{ delete s._i; return s; });
    } catch{}

    log('RULES_DONE','Sugestões contextuais geradas', { count: suggestions.length });
    return suggestions;
  } catch (e) {
    caiarLog('RULES_ENGINE_ERROR','Falha geral rules engine',{ error: e?.message||String(e) });
    return null;
  }
}

export default { generateContextualCorrections };
