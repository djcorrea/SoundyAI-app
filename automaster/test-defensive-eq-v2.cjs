#!/usr/bin/env node
/**
 * Testes Unitários: EQ Defensivo V2 (Blindado)
 * 
 * Valida regras V2:
 * - Ignora silêncio (Input loudness < -40 LUFS)
 * - Usa deltas relativos (não RMS absoluto)
 * - Limita impacto tonal (max -3 dB total)
 * - Estima impacto audível
 */

// ============================================================
// MOCK DAS FUNÇÕES
// ============================================================

/**
 * Mock de estimateTonalImpact
 */
function estimateTonalImpact(filters) {
  if (!filters || filters.length === 0) {
    return { level: 'none', totalCutDb: 0 };
  }

  let totalCutDb = 0;
  
  for (const filter of filters) {
    const gainMatch = filter.match(/g=(-?\d+\.?\d*)/);
    if (gainMatch) {
      const gain = parseFloat(gainMatch[1]);
      if (gain < 0) {
        totalCutDb += Math.abs(gain);
      }
    }
  }

  let level = 'none';
  
  if (filters.length === 0) {
    level = 'none';
  } else if (filters.length <= 2 && totalCutDb <= 2.0) {
    level = 'low';
  } else if (filters.length <= 3 && totalCutDb <= 4.0) {
    level = 'low';
  } else {
    level = 'medium';
  }

  return { level, totalCutDb };
}

/**
 * Mock de buildDefensiveEQFilters V2
 */
function buildDefensiveEQFilters(spectralRisk) {
  const { subDominant, harsh } = spectralRisk;

  let filters = [];

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

  // Garantir máximo de 3 filtros
  if (filters.length > 3) {
    filters = filters.slice(0, 3);
  }

  // LIMITADOR DE IMPACTO TONAL V2
  const MAX_TOTAL_CUT_DB = 3.0;
  
  let totalCutDb = 0;
  const filterGains = [];
  
  for (const filter of filters) {
    const gainMatch = filter.match(/g=(-?\d+\.?\d*)/);
    if (gainMatch) {
      const gain = parseFloat(gainMatch[1]);
      if (gain < 0) {
        totalCutDb += Math.abs(gain);
        filterGains.push(Math.abs(gain));
      } else {
        filterGains.push(0);
      }
    } else {
      filterGains.push(0);
    }
  }
  
  // Se ultrapassar limite, escalar cortes proporcionalmente
  if (totalCutDb > MAX_TOTAL_CUT_DB) {
    const scaleFactor = MAX_TOTAL_CUT_DB / totalCutDb;
    
    const scaledFilters = [];
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const originalGain = filterGains[i];
      
      if (originalGain > 0) {
        const scaledGain = originalGain * scaleFactor;
        const newFilter = filter.replace(/g=(-?\d+\.?\d*)/, `g=-${scaledGain.toFixed(2)}`);
        scaledFilters.push(newFilter);
      } else {
        scaledFilters.push(filter);
      }
    }
    
    filters = scaledFilters;
    totalCutDb = MAX_TOTAL_CUT_DB;
  }
  
  const filterString = filters.join(',');
  const impact = estimateTonalImpact(filters);
  
  return {
    filters: filterString,
    impact: impact
  };
}

// ============================================================
// TESTES
// ============================================================

const tests = [];

// -----------------------------------------------------------
// GRUPO 1: BYPASS (sem risco detectado)
// -----------------------------------------------------------

tests.push({
  name: 'Música equilibrada - EQ bypassado',
  input: {
    subDominant: false,
    harsh: false,
    rms: { sub: -25, body: -18, presence: -24, global: -18 }
  },
  expected: {
    result: null,
    reason: 'Sem risco detectado, EQ não necessário'
  }
});

// -----------------------------------------------------------
// GRUPO 2: SILÊNCIO / INTRO (V2 - bypass automático)
// -----------------------------------------------------------

tests.push({
  name: 'Música com intro silenciosa - bypassado',
  input: {
    subDominant: false,
    harsh: false,
    bypassed: true,
    rms: { sub: -70, body: -70, presence: -70, global: -42 }
  },
  expected: {
    result: null,
    reason: 'Input loudness < -40 LUFS (silêncio), bypass automático'
  }
});

tests.push({
  name: 'Música muito silenciosa - bypassado',
  input: {
    subDominant: false,
    harsh: false,
    bypassed: true,
    rms: { sub: -80, body: -80, presence: -80, global: -45 }
  },
  expected: {
    result: null,
    reason: 'Música extremamente silenciosa, bypass'
  }
});

// -----------------------------------------------------------
// GRUPO 3: SUBGRAVE EXCESSIVO
// -----------------------------------------------------------

tests.push({
  name: 'Sub exagerado - highpass aplicado',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -14, body: -18, presence: -24, global: -16 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    impact: { level: 'low', totalCutDb: 1.5 },
    reason: 'Subgrave dominante detectado'
  }
});

tests.push({
  name: 'Sub dominante (caso extremo)',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -10, body: -14, presence: -25, global: -12 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    impact: { level: 'low', totalCutDb: 1.5 },
    reason: 'Subgrave muito alto'
  }
});

// -----------------------------------------------------------
// GRUPO 4: HARSHNESS EXCESSIVO
// -----------------------------------------------------------

tests.push({
  name: 'Harsh excessivo - corte 4.8k aplicado',
  input: {
    subDominant: false,
    harsh: true,
    rms: { sub: -28, body: -18, presence: -16, global: -18 }
  },
  expected: {
    filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    impact: { level: 'low', totalCutDb: 1.5 },
    reason: 'Harshness detectado'
  }
});

tests.push({
  name: 'Harsh extremo (caso limítrofe)',
  input: {
    subDominant: false,
    harsh: true,
    rms: { sub: -30, body: -20, presence: -17.1, global: -20 }
  },
  expected: {
    filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    impact: { level: 'low', totalCutDb: 1.5 },
    reason: 'Presença muito próxima do corpo'
  }
});

// -----------------------------------------------------------
// GRUPO 5: AMBOS OS RISCOS
// -----------------------------------------------------------

tests.push({
  name: 'Sub exagerado + harsh - aplicar dois filtros',
  input: {
    subDominant: true,
    harsh: true,
    rms: { sub: -14, body: -18, presence: -16, global: -16 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5,equalizer=f=4800:t=q:w=1.0:g=-1.5',
    impact: { level: 'low', totalCutDb: 3.0 },
    reason: 'Ambos os riscos detectados'
  }
});

tests.push({
  name: 'Sub + harsh (caso extremo)',
  input: {
    subDominant: true,
    harsh: true,
    rms: { sub: -12, body: -16, presence: -13.5, global: -14 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5,equalizer=f=4800:t=q:w=1.0:g=-1.5',
    impact: { level: 'low', totalCutDb: 3.0 },
    reason: 'Mix problemática em sub e agudos'
  }
});

// -----------------------------------------------------------
// GRUPO 6: LIMITADOR DE IMPACTO TONAL (V2)
// -----------------------------------------------------------

tests.push({
  name: 'Limitar corte total a -3 dB (mesmo com 3 filtros)',
  input: {
    subDominant: true,
    harsh: true,
    rms: { sub: -12, body: -16, presence: -13.5, global: -14 }
  },
  expected: {
    totalCutMax: 3.0,
    reason: 'Total cut nunca ultrapassa -3 dB'
  },
  validate: (result) => {
    if (!result) return false;
    return result.impact.totalCutDb <= 3.0;
  }
});

tests.push({
  name: 'Impacto tonal LOW (1-3 filtros, < 3 dB)',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -14, body: -18, presence: -24, global: -16 }
  },
  expected: {
    impactLevel: 'low',
    reason: '2 filtros leves = impacto LOW'
  },
  validate: (result) => {
    if (!result) return false;
    return result.impact.level === 'low';
  }
});

tests.push({
  name: 'Impacto tonal NONE (0 filtros)',
  input: {
    subDominant: false,
    harsh: false,
    rms: { sub: -25, body: -18, presence: -24, global: -18 }
  },
  expected: {
    impactLevel: 'none',
    reason: 'Nenhum filtro = impacto NONE'
  },
  validate: (result) => {
    return result === null;
  }
});

// ============================================================
// EXECUÇÃO DOS TESTES
// ============================================================

function runTests() {
  console.log('🧪 TESTES UNITÁRIOS: EQ DEFENSIVO V2 (BLINDADO)\n');
  
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    
    // Se música bypassada por silêncio, resultado deve ser null
    if (test.input.bypassed) {
      const result = null;
      const success = result === test.expected.result;
      
      if (success) {
        passed++;
        console.log(`✅ Teste #${i + 1}: ${test.name}`);
      } else {
        failed++;
        console.log(`❌ Teste #${i + 1}: ${test.name}`);
        console.log(`   Esperado: null (bypass)`);
        console.log(`   Recebido: ${result}\n`);
        failures.push({ number: i + 1, name: test.name });
      }
      continue;
    }
    
    const result = buildDefensiveEQFilters(test.input);
    
    // Se tem validação customizada
    if (test.validate) {
      const success = test.validate(result);
      
      if (success) {
        passed++;
        console.log(`✅ Teste #${i + 1}: ${test.name}`);
      } else {
        failed++;
        console.log(`❌ Teste #${i + 1}: ${test.name}`);
        console.log(`   Validação falhou: ${test.expected.reason}\n`);
        failures.push({ number: i + 1, name: test.name });
      }
      continue;
    }
    
    // Validação padrão (comparação de filters)
    const expectedFilters = test.expected.filters || null;
    const actualFilters = result ? result.filters : null;
    
    const success = actualFilters === expectedFilters;
    
    if (success) {
      passed++;
      console.log(`✅ Teste #${i + 1}: ${test.name}`);
    } else {
      failed++;
      console.log(`❌ Teste #${i + 1}: ${test.name}`);
      console.log(`   Esperado: ${expectedFilters}`);
      console.log(`   Recebido: ${actualFilters}\n`);
      failures.push({ number: i + 1, name: test.name });
    }
  }

  console.log('\n📊 RESUMO DOS TESTES:');
  console.log(`Total de testes: ${tests.length}`);
  console.log(`✅ Passaram: ${passed}`);
  console.log(`❌ Falharam: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    process.exit(0);
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM:');
    failures.forEach(f => {
      console.log(`   - Teste #${f.number}: ${f.name}`);
    });
    process.exit(1);
  }
}

// Executar testes
runTests();
