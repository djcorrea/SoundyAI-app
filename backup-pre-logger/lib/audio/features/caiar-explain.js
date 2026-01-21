// CAIAR Explain Module
// Gera um plano de ação auditivo (3–7 passos) a partir de análise técnica + sugestões contextualizadas.
// NÃO altera UI legacy quando CAIAR_ENABLED === false.
// Export principal: generateExplainPlan(analysis, opts?)

import { caiarLog } from './caiar-logger.js';

const MAX_STEPS = 7;
const MIN_STEPS = 3;

function pickGenre(analysis){
  try {
    if (analysis?.adaptiveReference?.genre) return analysis.adaptiveReference.genre.toLowerCase();
    if (typeof window !== 'undefined' && window.PROD_AI_REF_GENRE) return (window.PROD_AI_REF_GENRE+'').toLowerCase();
    const ctx = analysis?._contextDetection; if (ctx?.style) return (ctx.style+'').toLowerCase();
  } catch{}
  return 'generic';
}

function normalizeGenre(g){
  if (!g) return 'generic';
  if (/funk/.test(g) && /mandela|favela|rio|brasil|brasileir/.test(g)) return 'funk_mandela';
  if (/funk/.test(g)) return 'funk';
  if (/trance|psy/.test(g)) return 'trance';
  if (/house|techno/.test(g)) return 'house_tech';
  if (/rap|trap|hip/.test(g)) return 'trap';
  if (/pop/.test(g)) return 'pop';
  return 'generic';
}

function styleBias(norm){
  // Ajusta prioridades por estilo
  switch(norm){
    case 'funk_mandela':
      return { low_end:2.0, kick_attack:2.0, stereo:0.7, surgical:1.0, brightness:1.2 };
    case 'trance':
      return { low_end:1.2, kick_attack:1.5, stereo:1.2, surgical:0.8, brightness:1.1 }; 
    case 'house_tech':
      return { low_end:1.3, kick_attack:1.4, stereo:1.0, surgical:0.9, brightness:1.0 };
    case 'trap':
      return { low_end:1.8, kick_attack:1.6, stereo:0.9, surgical:1.0, brightness:1.1 };
    default:
      return { low_end:1.0, kick_attack:1.0, stereo:1.0, surgical:1.0, brightness:1.0 };
  }
}

function mapSuggestionToCategory(s){
  if (!s) return 'other';
  const t = s.type || '';
  if (/dynamic_eq_sidechain/.test(s.subtype||'')) return 'kick_bass';
  if (/multiband_compression/.test(s.subtype||'')) return 'brightness_control';
  if (/dynamic_eq_narrow/.test(s.subtype||'')) return 'mid_cleanup';
  if (/stereo_adjust/.test(s.subtype||'')) return 'stereo';
  if (/band_group_adjust/.test(t)) return 'broad_tone';
  if (/band_adjust/.test(t)) return 'fine_tone';
  if (/surgical_eq/.test(t)) return 'surgical';
  if (/mastering/.test(t) || /score_attention/.test(t)) return 'global_level';
  if (/low_end_excess|bass_deficient|frequency_imbalance/.test(t)) return 'broad_tone';
  return 'other';
}

function buildRawCandidates(analysis){
  const sugg = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
  const out = [];
  for (const s of sugg) {
    const cat = mapSuggestionToCategory(s);
    let weight = 1;
    switch(cat){
      case 'kick_bass': weight=2.4; break;
      case 'brightness_control': weight=1.8; break;
      case 'mid_cleanup': weight=1.6; break;
      case 'surgical': weight=1.3; break;
      case 'stereo': weight=1.2; break;
      case 'broad_tone': weight=1.5; break;
      case 'fine_tone': weight=1.0; break;
      case 'global_level': weight=2.0; break;
      default: weight=0.8; break;
    }
    // Aumentar se prioridade numérica baixa (mais importante)
    if (Number.isFinite(s.priority)) weight *= (1 + Math.max(0, (50 - s.priority))/100);
    out.push({source: s, cat, weight});
  }
  return out;
}

function applyStyleWeights(cands, bias){
  for (const c of cands) {
    if (c.cat === 'kick_bass') c.weight *= bias.kick_attack || 1;
    if (c.cat === 'broad_tone' || c.cat === 'fine_tone') c.weight *= bias.low_end || 1;
    if (c.cat === 'stereo') c.weight *= bias.stereo || 1;
    if (c.cat === 'surgical' || c.cat === 'mid_cleanup') c.weight *= bias.surgical || 1;
    if (c.cat === 'brightness_control') c.weight *= bias.brightness || 1;
  }
  return cands;
}

function dedupeCategories(cands){
  const chosen = [];
  const seen = new Set();
  for (const c of cands.sort((a,b)=>b.weight-a.weight)) {
    const key = c.cat;
    if (!seen.has(key)) { chosen.push(c); seen.add(key); }
  }
  return chosen;
}

function ensureMinimum(chosen, cands){
  if (chosen.length >= MIN_STEPS) return chosen.slice(0, MAX_STEPS);
  const extra = cands.filter(c=> !chosen.includes(c)).sort((a,b)=>b.weight-a.weight);
  for (const c of extra) {
    if (chosen.length >= MIN_STEPS) break;
    chosen.push(c);
  }
  return chosen.slice(0, MAX_STEPS);
}

function enrichWithPlaceholders(analysis, picked){
  // Se continuamos com menos que MIN_STEPS geramos passos base a partir de métricas
  if (picked.length >= MIN_STEPS) return picked;
  const td = analysis.technicalData || {};
  const place = [];
  try {
    if (Number.isFinite(td.lufsIntegrated) && td.lufsIntegrated < -20) {
      place.push({cat:'global_level', source:{message:'Aumentar loudness integrado', action:'Aplicar limiter suave visando ~ -14 LUFS', subtype:'loudness_gain'}, weight:1.5});
    }
    if (Number.isFinite(td.stereoCorrelation) && td.stereoCorrelation < 0.1) {
      place.push({cat:'stereo', source:{message:'Reforçar mono compatibilidade', action:'Rever fases / reduzir processamento estéreo em agudos', subtype:'stereo_phasing'}, weight:1.1});
    }
    if (Number.isFinite(td.crestFactor) && td.crestFactor < 6) {
      place.push({cat:'dynamics', source:{message:'Recuperar micro-dinâmica', action:'Reduzir compressão bus / usar paralela', subtype:'crest_recover'}, weight:1.2});
    }
  } catch{}
  for (const p of place) {
    if (picked.length >= MAX_STEPS) break;
    if (!picked.some(x=>x.cat===p.cat)) picked.push(p);
  }
  return picked;
}

function extractParametro(base){
  if (Number.isFinite(base.freqHz)) return `${Math.round(base.freqHz)} Hz`;
  if (Array.isArray(base.rangeHz) && base.rangeHz.length===2) return `${Math.round(base.rangeHz[0])}-${Math.round(base.rangeHz[1])} Hz`;
  if (base.band) return base.band;
  if (Number.isFinite(base.gainReductionDb) && Number.isFinite(base.Q)) return `- ${base.gainReductionDb} dB (Q ${base.Q})`;
  if (Number.isFinite(base.gainReductionDb)) return `-${base.gainReductionDb} dB`;
  if (Number.isFinite(base.Q)) return `Q ${base.Q}`;
  return null;
}

function stepFromSuggestion(s, idx){
  const base = s.source || {}; // quando placeholder, já vem com message/action
  const title = buildTitle(base, s.cat, idx);
  const condition = buildCondition(base, s.cat);
  const parametro = extractParametro(base);
  return {
    ordem: idx+1,
    titulo: title,
    acao: buildActionText(base, s.cat),
    porque: buildWhy(base, s.cat),
    condicao: condition,
    origem: base.source || base.subtype || base.type || 'synthetic',
    stem: base.targetStem || base.target_stem || null,
    parametroPrincipal: parametro,
    categorias: [s.cat]
  };
}

function buildTitle(base, cat, idx){
  if (base.subtype === 'dynamic_eq_sidechain') return 'Controlar conflito Kick/Baixo';
  if (base.subtype === 'multiband_compression') return 'Domar agudos dos hi-hats';
  if (base.subtype === 'dynamic_eq_narrow') return 'Limpar médios de backing vocals';
  if (base.subtype === 'stereo_adjust') return 'Ajustar largura estéreo nos agudos';
  if (cat === 'surgical') return 'Cortes cirúrgicos de ressonâncias';
  if (cat === 'broad_tone') return 'Rebalancear bandas principais';
  if (cat === 'fine_tone') return 'Ajuste fino de espectro';
  if (cat === 'global_level') return 'Acertar Loudness / Nível Global';
  return 'Aprimoramento #' + (idx+1);
}

function buildCondition(base, cat){
  if (base.condition) return base.condition;
  if (base.subtype === 'dynamic_eq_sidechain') return 'Só enquanto o kick estiver presente';
  if (base.subtype === 'multiband_compression') return 'Atuar apenas em passagens com hi-hats contínuos';
  if (base.subtype === 'dynamic_eq_narrow') return 'Quando backing vocals entrarem';
  if (base.subtype === 'stereo_adjust') return 'Aplicar apenas se correlação cair <0.15';
  if (cat === 'surgical') return 'Somente nos picos identificados';
  return 'Aplicar conforme necessidade detectada';
}

function buildActionText(base, cat){
  if (base.action) return base.action;
  switch(cat){
    case 'kick_bass': return 'Sidechain dinâmico no baixo sincronizado com o kick (2–3 dB)';
    case 'brightness_control': return 'Compressão multibanda >6 kHz para suavizar hi-hats';
    case 'mid_cleanup': return 'Cortes dinâmicos estreitos em 300–400 Hz';
    case 'stereo': return 'Reduzir lado (Side) em agudos ~15–20%';
    case 'surgical': return 'Cortes pontuais (-2 a -4 dB, Q alto) nas ressonâncias detectadas';
    case 'broad_tone': return 'EQ amplo reequilibrando sub, low, mid, high';
    case 'fine_tone': return 'Micro ajustes ±1–2 dB nas bandas fora da tolerância';
    case 'global_level': return 'Limiter visando -14 LUFS e true peak <= -1 dBTP';
    default: return base.message || 'Ajuste técnico';
  }
}

function buildWhy(base, cat){
  if (base.message) {
    // transformar em justificativa breve
    return base.message
      .replace(/^Ressonância — \[/,'Remover ressonância em ')
      .replace(/Som muito brilhante.*/i,'Excesso de energia em agudos causando fadiga.')
      .replace(/Som escuro.*/i,'Falta de presença e ar nos agudos.')
      .replace(/Excesso de graves.*/i,'Graves mascarando médios e kick.');
  }
  switch(cat){
    case 'kick_bass': return 'Separar transientes do kick e sustain do baixo para punch e definição.';
    case 'brightness_control': return 'Reduzir aspereza e fadiga mantendo brilho controlado.';
    case 'mid_cleanup': return 'Liberar espaço nos médios para vocal principal e clareza.';
    case 'stereo': return 'Evitar fase fraca e foco difuso nos elementos centrais.';
    case 'surgical': return 'Eliminar picos estreitos que geram dureza.';
    case 'broad_tone': return 'Alinhar distribuição de energia às referências.';
    case 'fine_tone': return 'Refinar equilíbrio final sem exageros.';
    case 'global_level': return 'Atingir padrão de loudness competitivo sem clipping.';
    default: return 'Melhorar coerência geral do mix.';
  }
}

export function generateExplainPlan(analysis, opts={}){
  try {
    if (typeof window !== 'undefined' && !window.CAIAR_ENABLED) return null;
    const log = (window && window.__caiarLog) ? window.__caiarLog : caiarLog;
    log('EXPLAIN_START','Gerando plano de ação');
    const genreRaw = pickGenre(analysis);
    const genre = normalizeGenre(genreRaw);
    const bias = styleBias(genre);
    let candidates = buildRawCandidates(analysis);
    candidates = applyStyleWeights(candidates, bias);
    // Ordenar e deduplicar por categoria (mantendo melhor)
    let picked = dedupeCategories(candidates);
    picked = ensureMinimum(picked, candidates);
    picked = enrichWithPlaceholders(analysis, picked);
    // Reordenar lógica: kick/bass -> broad tone -> brightness/mid cleanup -> dynamics/surgical -> stereo -> global
    const orderRank = (c)=>{
      switch(c.cat){
        case 'kick_bass': return 10;
        case 'broad_tone': return 20;
        case 'fine_tone': return 25;
        case 'brightness_control': return 30;
        case 'mid_cleanup': return 35;
        case 'surgical': return 40;
        case 'stereo': return 50;
        case 'global_level': return 60;
        default: return 70;
      }
    };
    picked.sort((a,b)=> orderRank(a)-orderRank(b));
    const steps = picked.slice(0, MAX_STEPS).map((p,i)=> stepFromSuggestion(p, i));
    // Resumo
    const resumo = steps.map(s=> `${s.ordem}. ${s.titulo}: ${s.acao} (${s.porque})`).join('\n');
    const plan = {
      estiloDetectado: genreRaw,
      estiloNormalizado: genre,
      bpm: analysis?._contextDetection?.bpm || null,
      tonalidade: analysis?._contextDetection?.key || null,
      passos: steps,
      totalPassos: steps.length,
      resumo,
      geradoEm: new Date().toISOString(),
      fontes:
        {
          suggestions: (analysis.suggestions||[]).length,
          analysis_matrix: !!analysis.analysis_matrix,
          adaptiveReference: !!analysis.adaptiveReference
        }
    };
    analysis.caiarExplainPlan = plan; // anexar
    log('EXPLAIN_DONE','Plano gerado',{ passos: plan.totalPassos, estilo: plan.estiloNormalizado });
    return plan;
  } catch (e) {
    caiarLog('EXPLAIN_ERROR','Falha gerando plano',{ error: e?.message||String(e) });
    return null;
  }
}

export default { generateExplainPlan };
