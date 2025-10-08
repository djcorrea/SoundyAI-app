// SOUNDYAI-ADAPTIVE-SCORE (v1.0)
// Módulo independente — cálculo de score adaptativo baseado nas sugestões

/**
 * Parse de valores de dB sugeridos nas sugestões
 * @param {string|number} s - Valor a ser parseado (ex: "+3dB", "-2.5", 4.2)
 * @returns {number} Valor numérico em dB
 */
export function parseSuggestedDb(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseFloat(String(s).replace('dB','').replace('+','').trim());
  return isNaN(n) ? 0 : (String(s).trim().startsWith('-') ? -Math.abs(n) : Math.abs(n));
}

/**
 * Calcula score de uma banda baseado no quanto foi aplicado vs. sugerido
 * @param {number} measuredNow - Valor atual medido (dB RMS)
 * @param {Object} ticket - Ticket de sugestão com dados originais
 * @returns {number} Score de 0-100 para a banda
 */
export function calcBandScoreFromTicket(measuredNow, ticket) {
  const expected = ticket.stepDb * (ticket.direction === 'cut' ? -1 : 1);
  const applied = measuredNow - ticket.currentValueAtSuggestion;
  const ratio = (expected === 0) ? 0 : applied / expected;

  if (ratio < 0) return 30; // direção errada
  if (ratio <= 1) return Math.round(50 + ratio * 50); // progresso proporcional
  const overshoot = ratio - 1;
  const penalty = Math.min(overshoot * 100, 50);
  return Math.round(100 - penalty);
}

/**
 * Pesos das bandas espectrais para cálculo do score final
 */
export const WEIGHTS = { 
  sub: 0.25, 
  bass: 0.25, 
  lowMid: 0.15, 
  mid: 0.15, 
  highMid: 0.1, 
  air: 0.1 
};

/**
 * Calcula score ponderado baseado nos scores individuais das bandas
 * @param {Object} bandScores - Scores individuais por banda
 * @returns {number} Score final ponderado (0-100)
 */
export function weightedScore(bandScores) {
  let sum = 0, wsum = 0;
  for (const band in bandScores) {
    const w = WEIGHTS[band] || 0.1;
    sum += bandScores[band] * w;
    wsum += w;
  }
  return Math.round(sum / (wsum || 1));
}

/**
 * Função principal - calcula score adaptativo baseado nos tickets de sugestões
 * @param {Object} analysis - Dados da análise atual
 * @param {Object} tickets - Tickets de sugestões salvas anteriormente
 * @returns {Object} Resultado com score e breakdown detalhado
 */
export function calculateAdaptiveScoreFromTickets(analysis, tickets) {
  if (!tickets?.items?.length) {
    return { 
      score: 50, 
      method: 'suggestion_based_adaptive', 
      breakdown: {} 
    };
  }

  const bandScores = {};
  for (const t of tickets.items) {
    const band = t.band;
    const bandNode = analysis?.technicalData?.bandEnergies?.[band];
    if (!bandNode?.rms_db && bandNode?.rms_db !== 0) continue;

    const s = calcBandScoreFromTicket(bandNode.rms_db, t);
    bandScores[band] = s;
  }

  const score = weightedScore(bandScores);
  return { 
    score, 
    method: 'suggestion_based_adaptive', 
    breakdown: { bandScores } 
  };
}