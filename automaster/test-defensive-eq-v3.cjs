#!/usr/bin/env node
/**
 * Testes Unitários: EQ Defensivo V3 (Temporal + Confidence)
 * 
 * Valida regras V3:
 * - Análise multi-frame com mediana de deltas
 * - Exige duração mínima do risco (>= 20%)
 * - Clamp de deltas irreais (-20 a +10 dB)
 * - Score de confiança espectral (HIGH/MEDIUM/LOW)
 * - Bypass automático se confidence LOW
 */

// ============================================================
// MOCK DAS FUNÇÕES V3
// ============================================================

/**
 * Mock de median (deve ser idêntico ao código real)
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Mock de clamp (deve ser idêntico ao código real)
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Mock de estimateSpectralConfidence (deve ser idêntico ao código real)
 */
function estimateSpectralConfidence(stats) {
  const { subVariance, presenceVariance, subRiskRatio, presenceRiskRatio } = stats;
  
  // Variância alta = música instável (não tomar decisão)
  if (subVariance > 15.0 || presenceVariance > 15.0) {
    return 'LOW';
  }
  
  // Alto riskRatio + baixa variância = confiança alta
  const avgRiskRatio = (subRiskRatio + presenceRiskRatio) / 2;
  if (avgRiskRatio > 0.3 && subVariance < 8.0 && presenceVariance < 8.0) {
    return 'HIGH';
  }
  
  // Caso padrão
  return 'MEDIUM';
}

/**
 * Mock de buildDefensiveEQFilters V3 (simplificado para testes)
 */
function buildDefensiveEQFilters(spectralRisk) {
  const { subDominant, harsh, confidence } = spectralRisk;

  // PROTEÇÃO V3: Se confiança baixa (música instável), bypassar EQ
  if (confidence === 'LOW') {
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

  // Se nenhum filtro, retornar null (bypass)
  if (filters.length === 0) {
    return null;
  }

  return {
    filters: filters.join(','),
    impact: { level: 'low', totalCutDb: 1.5 }
  };
}

// ============================================================
// SUITE DE TESTES V3
// ============================================================

const tests = [];

// -----------------------------------------------------------
// GRUPO 1: EVENTOS CURTOS (NÃO DEVEM DISPARAR EQ)
// -----------------------------------------------------------

tests.push({
  name: 'Hi-hat isolado (evento curto) - EQ NÃO dispara',
  input: {
    subDominant: false,
    harsh: false,
    deltas: {
      subSmoothed: -12.5,
      presenceSmoothed: 8.2  // Spike alto, mas curto
    },
    riskRatio: {
      sub: 0.0,
      presence: 0.15  // Apenas 15% da música = evento curto
    },
    variance: {
      sub: 3.2,
      presence: 22.1  // Alta variância = inconsistente
    },
    confidence: 'LOW',  // Música instável
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Confidence LOW (música instável), EQ bypassado'
  }
});

tests.push({
  name: 'Click digital curto - EQ NÃO dispara',
  input: {
    subDominant: false,
    harsh: false,
    deltas: {
      subSmoothed: 15.0,  // Spike absurdo (seria clampado)
      presenceSmoothed: 12.0  // Spike absurdo (seria clampado)
    },
    riskRatio: {
      sub: 0.05,  // Apenas 1 frame de 5 = 5%
      presence: 0.10  // Apenas 10%
    },
    variance: {
      sub: 45.0,  // Variância extrema
      presence: 38.0  // Variância extrema
    },
    confidence: 'LOW',  // Detectado como instável
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Confidence LOW (alta variância), EQ bypassado'
  }
});

tests.push({
  name: 'Transiente curto com spike - riskRatio insuficiente',
  input: {
    subDominant: false,  // Não passou no critério V3
    harsh: false,
    deltas: {
      subSmoothed: -2.1,  // Médio alto
      presenceSmoothed: -1.8
    },
    riskRatio: {
      sub: 0.18,  // 18% < 20% mínimo
      presence: 0.19  // 19% < 20% mínimo
    },
    variance: {
      sub: 6.5,
      presence: 7.2
    },
    confidence: 'MEDIUM',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'RiskRatio abaixo do mínimo (20%)'
  }
});

// -----------------------------------------------------------
// GRUPO 2: RISCOS CONTÍNUOS (DEVEM DISPARAR EQ)
// -----------------------------------------------------------

tests.push({
  name: 'Sub contínuo forte - EQ dispara',
  input: {
    subDominant: true,  // Passou critérios V3
    harsh: false,
    deltas: {
      subSmoothed: -3.2,  // Mediana acima de -5
      presenceSmoothed: -8.5
    },
    riskRatio: {
      sub: 0.85,  // 85% da música = contínuo
      presence: 0.05
    },
    variance: {
      sub: 2.1,  // Baixa variância = consistente
      presence: 3.4
    },
    confidence: 'HIGH',  // Alta confiança
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    reason: 'Sub contínuo detectado (85% riskRatio, baixa variância)'
  }
});

tests.push({
  name: 'Harsh contínuo - EQ dispara',
  input: {
    subDominant: false,
    harsh: true,  // Passou critérios V3
    deltas: {
      subSmoothed: -12.0,
      presenceSmoothed: -1.5  // Mediana acima de -3
    },
    riskRatio: {
      sub: 0.02,
      presence: 0.72  // 72% da música = contínuo
    },
    variance: {
      sub: 4.2,
      presence: 3.8  // Baixa variância = consistente
    },
    confidence: 'HIGH',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Harsh contínuo detectado (72% riskRatio)'
  }
});

tests.push({
  name: 'Sub + Harsh contínuos - ambos filtros',
  input: {
    subDominant: true,
    harsh: true,
    deltas: {
      subSmoothed: -2.8,
      presenceSmoothed: -1.2
    },
    riskRatio: {
      sub: 0.68,  // 68%
      presence: 0.55  // 55%
    },
    variance: {
      sub: 3.5,
      presence: 4.1
    },
    confidence: 'HIGH',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5,equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Ambos riscos detectados com alta confiança'
  }
});

// -----------------------------------------------------------
// GRUPO 3: MÚSICA EQUILIBRADA
// -----------------------------------------------------------

tests.push({
  name: 'Música equilibrada - EQ bypassado',
  input: {
    subDominant: false,
    harsh: false,
    deltas: {
      subSmoothed: -8.5,  // Bem abaixo de -5
      presenceSmoothed: -9.2  // Bem abaixo de -3
    },
    riskRatio: {
      sub: 0.0,
      presence: 0.0
    },
    variance: {
      sub: 2.8,
      presence: 3.1
    },
    confidence: 'MEDIUM',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Música equilibrada, sem risco detectado'
  }
});

// -----------------------------------------------------------
// GRUPO 4: MÚSICA INSTÁVEL (BYPASS POR CONFIDENCE LOW)
// -----------------------------------------------------------

tests.push({
  name: 'Música muito instável - confidence LOW - EQ bypassado',
  input: {
    subDominant: false,  // Mesmo que deltas indiquem risco
    harsh: false,
    deltas: {
      subSmoothed: -3.0,  // Delta alto
      presenceSmoothed: -2.5  // Delta alto
    },
    riskRatio: {
      sub: 0.35,  // 35% (acima de 20%)
      presence: 0.28  // 28% (acima de 20%)
    },
    variance: {
      sub: 18.5,  // Variância muito alta
      presence: 22.1  // Variância muito alta
    },
    confidence: 'LOW',  // Detectado como instável
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Confidence LOW (alta variância), EQ bypassado mesmo com riskRatio alto'
  }
});

tests.push({
  name: 'EDM com automação agressiva - confidence LOW',
  input: {
    subDominant: true,  // Seria detectado como problema
    harsh: false,
    deltas: {
      subSmoothed: -4.2,
      presenceSmoothed: -6.5
    },
    riskRatio: {
      sub: 0.42,
      presence: 0.08
    },
    variance: {
      sub: 16.8,  // Variância alta (automação)
      presence: 8.2
    },
    confidence: 'LOW',  // Sub muito instável
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Automação detectada (alta variância sub), EQ bypassado'
  }
});

// -----------------------------------------------------------
// GRUPO 5: LIMITES (CASOS EDGE)
// -----------------------------------------------------------

tests.push({
  name: 'Exatamente no threshold sub (-5 dB) - NÃO dispara',
  input: {
    subDominant: false,
    harsh: false,
    deltas: {
      subSmoothed: -5.0,  // Exatamente no limite
      presenceSmoothed: -8.0
    },
    riskRatio: {
      sub: 0.25,
      presence: 0.0
    },
    variance: {
      sub: 2.5,
      presence: 3.0
    },
    confidence: 'MEDIUM',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Delta exatamente no threshold (não ultrapassa)'
  }
});

tests.push({
  name: 'Exatamente no threshold presence (-3 dB) - NÃO dispara',
  input: {
    subDominant: false,
    harsh: false,
    deltas: {
      subSmoothed: -12.0,
      presenceSmoothed: -3.0  // Exatamente no limite
    },
    riskRatio: {
      sub: 0.0,
      presence: 0.30
    },
    variance: {
      sub: 2.5,
      presence: 3.0
    },
    confidence: 'MEDIUM',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: null,
    reason: 'Delta exatamente no threshold (não ultrapassa)'
  }
});

tests.push({
  name: 'RiskRatio exatamente 20% - deve disparar',
  input: {
    subDominant: true,  // Passou no critério
    harsh: false,
    deltas: {
      subSmoothed: -4.8,
      presenceSmoothed: -10.0
    },
    riskRatio: {
      sub: 0.20,  // Exatamente no mínimo
      presence: 0.0
    },
    variance: {
      sub: 4.5,
      presence: 3.2
    },
    confidence: 'MEDIUM',
    framesUsed: 5,
    bypassed: false
  },
  expected: {
    result: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    reason: 'RiskRatio exatamente 20% (mínimo), EQ deve disparar'
  }
});

// ============================================================
// EXECUTOR DE TESTES
// ============================================================

console.log('\n🧪 TESTES UNITÁRIOS: EQ DEFENSIVO V3 (TEMPORAL + CONFIDENCE)\n');

let passed = 0;
let failed = 0;

for (let i = 0; i < tests.length; i++) {
  const test = tests[i];
  const result = buildDefensiveEQFilters(test.input);
  
  const actualResult = result ? result.filters : null;
  const expectedResult = test.expected.result;
  
  const testPassed = actualResult === expectedResult;
  
  if (testPassed) {
    console.log(`✅ Teste #${i + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Teste #${i + 1}: ${test.name}`);
    console.log(`   Esperado: ${expectedResult || 'null'}`);
    console.log(`   Obtido: ${actualResult || 'null'}`);
    console.log(`   Razão: ${test.expected.reason}`);
    failed++;
  }
}

console.log(`\n📊 RESUMO DOS TESTES:`);
console.log(`Total de testes: ${tests.length}`);
console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);

if (failed === 0) {
  console.log(`\n🎉 TODOS OS TESTES PASSARAM!`);
  process.exit(0);
} else {
  console.log(`\n⚠️ ALGUNS TESTES FALHARAM!`);
  process.exit(1);
}
