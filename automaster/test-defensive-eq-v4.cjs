#!/usr/bin/env node
/**
 * Testes unitários para EQ Defensivo V4
 * 
 * OBJETIVO V4: Estabilidade estatística para SaaS em escala
 * - Janelas de 2s (granularidade fina, músicas 40s = 20 janelas)
 * - >= 10 janelas válidas (validação rigorosa)
 * - Filtra janelas < -50 LUFS (ignora silêncios localizados)
 * - Estatísticas robustas: median + mean + variance + riskRatio
 * - Decisão multi-critério: 4 condições obrigatórias
 * - Confidence: variance < 120, >= 10 janelas
 * - EQ leve: confidence LOW + riskRatio > 0.6 → aplicar 1 filtro
 * 
 * ESTRUTURA DE RETORNO V4:
 * {
 *   subDominant: boolean,
 *   harsh: boolean,
 *   stats: {
 *     sub: { median, mean, variance, riskRatio },
 *     presence: { median, mean, variance, riskRatio },
 *     windows: { valid, total },
 *     rms: { sub, body, presence }
 *   },
 *   confidence: 'HIGH' | 'MEDIUM' | 'LOW',
 *   bypassed: false
 * }
 */

const assert = require('assert');

// ============================================================
// MOCK DA ESTRUTURA V4
// ============================================================

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function estimateSpectralConfidence(stats) {
  const { subVariance, presenceVariance, subRiskRatio, presenceRiskRatio, validWindows } = stats;
  
  // Poucas janelas = dados insuficientes
  if (validWindows < 10) {
    return 'LOW';
  }
  
  // Variância EXTREMA = música muito instável
  if (subVariance > 120.0 || presenceVariance > 120.0) {
    return 'LOW';
  }
  
  const avgRiskRatio = (subRiskRatio + presenceRiskRatio) / 2;
  
  // Alto riskRatio + baixa variância = HIGH
  if (avgRiskRatio > 0.3 && subVariance < 60.0 && presenceVariance < 60.0) {
    return 'HIGH';
  }
  
  return 'MEDIUM';
}

function buildDefensiveEQFilters(spectralRisk) {
  const { subDominant, harsh, confidence } = spectralRisk;

  // PROTEÇÃO V4: Se confiança baixa (música instável)
  if (confidence === 'LOW') {
    // Mas se riskRatio alto (> 0.6), aplicar EQ leve (apenas 1 filtro)
    const stats = spectralRisk.stats || {};
    const subRiskRatio = stats.sub?.riskRatio || 0;
    const presenceRiskRatio = stats.presence?.riskRatio || 0;
    const maxRiskRatio = Math.max(subRiskRatio, presenceRiskRatio);
    
    if (maxRiskRatio > 0.6) {
      // Aplicar apenas 1 filtro no problema mais crítico
      if (subDominant && subRiskRatio >= presenceRiskRatio) {
        return {
          filters: 'highpass=f=28:poles=2',
          impact: { level: 'low', totalCutDb: 0, affectedBands: ['sub'] }
        };
      } else if (harsh && presenceRiskRatio > subRiskRatio) {
        return {
          filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.0',
          impact: { level: 'low', totalCutDb: 1.0, affectedBands: ['presence'] }
        };
      } else if (subDominant) {
        return {
          filters: 'highpass=f=28:poles=2',
          impact: { level: 'low', totalCutDb: 0, affectedBands: ['sub'] }
        };
      } else if (harsh) {
        return {
          filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.0',
          impact: { level: 'low', totalCutDb: 1.0, affectedBands: ['presence'] }
        };
      }
    }
    
    // Senão, bypass (riskRatio baixo + confidence LOW = dados insuficientes)
    return null;
  }

  const filters = [];

  // Filtro 1: Subgrave excessivo
  if (subDominant) {
    filters.push('highpass=f=28:poles=2');
    filters.push('equalizer=f=55:t=q:w=1.2:g=-1.5');
  }

  // Filtro 2: Harshness excessivo
  if (harsh) {
    filters.push('equalizer=f=4800:t=q:w=1.0:g=-1.5');
  }

  if (filters.length === 0) {
    return null;
  }

  return {
    filters: filters.join(','),
    impact: { level: 'low', totalCutDb: 3.0 }
  };
}

// ============================================================
// TESTES V4
// ============================================================

console.log('========================================');
console.log('TESTES EQ DEFENSIVO V4');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}\n`);
    failed++;
  }
}

// ============================================================
// TESTE 1: Música bem mixada (20 janelas, variance baixa)
// ============================================================
test('V4.1: Música bem mixada → bypass EQ', () => {
  const subDeltas = Array(20).fill(-8.5); // 20 janelas, sub -8.5 dB abaixo do body
  const presenceDeltas = Array(20).fill(-6.2);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  // Decisão V4: 4 condições
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -18.5, body: -10.0, presence: -16.2 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.strictEqual(result, null, 'Música bem mixada deve bypassar EQ');
  assert.strictEqual(subDominant, false, 'subDominant deve ser false');
  assert.strictEqual(harsh, false, 'harsh deve ser false');
  // Confidence MEDIUM é correto: variance baixa mas riskRatio também baixo (0%)
  assert.ok(['MEDIUM', 'HIGH'].includes(confidence), `Confidence deve ser MEDIUM ou HIGH (atual: ${confidence})`);
});

// ============================================================
// TESTE 2: Sub excessivo (20 janelas, baixa variance, riskRatio 40%)
// ============================================================
test('V4.2: Sub excessivo estável → EQ ativado', () => {
  const subDeltas = Array(20).fill(-2.5); // 20 janelas, sub apenas -2.5 dB abaixo (DOMINANTE)
  const presenceDeltas = Array(20).fill(-7.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -12.5, body: -10.0, presence: -17.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.notStrictEqual(result, null, 'EQ deve ser ativado');
  assert.strictEqual(subDominant, true, 'subDominant deve ser true');
  assert.strictEqual(harsh, false, 'harsh deve ser false');
  assert.strictEqual(confidence, 'HIGH', 'Confidence deve ser HIGH (variance baixa + riskRatio alto)');
  assert.ok(result.filters.includes('highpass'), 'Deve incluir highpass');
});

// ============================================================
// TESTE 3: Poucas janelas (< 10) → confidence LOW → bypass
// ============================================================
test('V4.3: Poucas janelas (< 10) + riskRatio baixo → bypass', () => {
  const subDeltas = Array(8).fill(-8.0); // Apenas 8 janelas, sub bem abaixo (sem risco)
  const presenceDeltas = Array(8).fill(-6.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 8
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 8, total: 8 },
      rms: { sub: -18.0, body: -10.0, presence: -16.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.strictEqual(confidence, 'LOW', 'Confidence deve ser LOW (< 10 janelas)');
  assert.strictEqual(result, null, 'EQ deve ser bypassado (confidence LOW + riskRatio <= 0.6)');
});

// ============================================================
// TESTE 4: Variance extrema (> 120) → confidence LOW → bypass
// ============================================================
test('V4.4: Variance extrema (> 120) → confidence LOW → bypass', () => {
  // Música instável: grandes variações entre janelas (drops, breaks)
  const subDeltas = [2, 2, -20, -20, 2, 2, -20, -20, 2, 2, -20, -20, 2, 2, -20, -20, 2, 2, -20, -20];
  const presenceDeltas = Array(20).fill(-6.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -12.0, body: -10.0, presence: -16.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.ok(subVariance > 60.0, `Variance deve ser > 60 (atual: ${subVariance.toFixed(2)})`);
  assert.strictEqual(subDominant, false, 'subDominant deve ser false (variance > 60)');
  assert.strictEqual(result, null, 'EQ deve ser bypassado');
});

// ============================================================
// TESTE 5: Confidence LOW + riskRatio > 0.6 → EQ leve
// ============================================================
test('V4.5: Confidence LOW + riskRatio > 0.6 → EQ leve (1 filtro)', () => {
  // Música curta (9 janelas) mas sub claramente dominante em 70% das janelas
  const subDeltas = [-2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -8.0, -8.0]; // 7/9 = 77.8% riskRatio
  const presenceDeltas = Array(9).fill(-6.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 9
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant: true, // Forçar true para teste (mesmo com variance alta em alguns casos)
    harsh: false,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 9, total: 9 },
      rms: { sub: -12.0, body: -10.0, presence: -16.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.strictEqual(confidence, 'LOW', 'Confidence deve ser LOW (< 10 janelas)');
  assert.ok(subRiskRatio > 0.6, `Sub riskRatio deve ser > 0.6 (atual: ${(subRiskRatio * 100).toFixed(1)}%)`);
  assert.notStrictEqual(result, null, 'EQ leve deve ser aplicado');
  assert.strictEqual(result.filters, 'highpass=f=28:poles=2', 'Deve aplicar apenas 1 filtro (highpass)');
  assert.strictEqual(result.impact.level, 'low', 'Impact deve ser LOW');
});

// ============================================================
// TESTE 6: riskRatio alto mas abaixo de 25% → bypass
// ============================================================
test('V4.6: riskRatio 20% (< 25%) → bypass EQ', () => {
  // 20 janelas, mas apenas 4 com sub dominante (20% riskRatio)
  const subDeltas = [-2.0, -2.0, -2.0, -2.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0, -8.0];
  const presenceDeltas = Array(20).fill(-6.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -12.0, body: -10.0, presence: -16.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.ok(subRiskRatio === 0.2, `Sub riskRatio deve ser 0.2 (20%)`);
  assert.strictEqual(subDominant, false, 'subDominant deve ser false (riskRatio < 25%)');
  assert.strictEqual(result, null, 'EQ deve ser bypassado');
});

// ============================================================
// TESTE 7: Harshness isolado → EQ ativado apenas em presença
// ============================================================
test('V4.7: Harshness isolado → EQ ativado apenas em presença', () => {
  const subDeltas = Array(20).fill(-8.5);
  const presenceDeltas = Array(20).fill(-1.0); // Presença muito forte (harsh)
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -18.5, body: -10.0, presence: -11.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.notStrictEqual(result, null, 'EQ deve ser ativado');
  assert.strictEqual(subDominant, false, 'subDominant deve ser false');
  assert.strictEqual(harsh, true, 'harsh deve ser true');
  assert.strictEqual(confidence, 'HIGH', 'Confidence deve ser HIGH');
  assert.ok(result.filters.includes('equalizer=f=4800'), 'Deve incluir corte em 4.8 kHz');
});

// ============================================================
// TESTE 8: Sub + Harshness simultâneos → EQ completo
// ============================================================
test('V4.8: Sub + Harshness simultâneos → EQ completo', () => {
  const subDeltas = Array(20).fill(-2.5);
  const presenceDeltas = Array(20).fill(-1.0);
  
  const subMedian = median(subDeltas);
  const subMean = mean(subDeltas);
  const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
  const subRiskRatio = subDeltas.filter(d => d > -5.0).length / subDeltas.length;
  
  const presenceMedian = median(presenceDeltas);
  const presenceMean = mean(presenceDeltas);
  const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
  const presenceRiskRatio = presenceDeltas.filter(d => d > -3.0).length / presenceDeltas.length;
  
  const confidence = estimateSpectralConfidence({
    subVariance,
    presenceVariance,
    subRiskRatio,
    presenceRiskRatio,
    validWindows: 20
  });
  
  const subDominant = subMedian > -5.0 && subRiskRatio >= 0.25 && subVariance < 60.0;
  const harsh = presenceMedian > -3.0 && presenceRiskRatio >= 0.25 && presenceVariance < 60.0;
  
  const spectralRisk = {
    subDominant,
    harsh,
    stats: {
      sub: { median: subMedian, mean: subMean, variance: subVariance, riskRatio: subRiskRatio },
      presence: { median: presenceMedian, mean: presenceMean, variance: presenceVariance, riskRatio: presenceRiskRatio },
      windows: { valid: 20, total: 20 },
      rms: { sub: -12.5, body: -10.0, presence: -11.0 }
    },
    confidence,
    bypassed: false
  };
  
  const result = buildDefensiveEQFilters(spectralRisk);
  
  assert.notStrictEqual(result, null, 'EQ deve ser ativado');
  assert.strictEqual(subDominant, true, 'subDominant deve ser true');
  assert.strictEqual(harsh, true, 'harsh deve ser true');
  assert.strictEqual(confidence, 'HIGH', 'Confidence deve ser HIGH');
  assert.ok(result.filters.includes('highpass'), 'Deve incluir highpass');
  assert.ok(result.filters.includes('equalizer=f=4800'), 'Deve incluir corte em 4.8 kHz');
});

// ============================================================
// RESULTADOS
// ============================================================

console.log('\n========================================');
console.log(`RESULTADO: ${passed}/${passed + failed} testes passaram`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
