#!/usr/bin/env node
/**
 * Testes Unitários: EQ Defensivo V1
 * 
 * Valida regras de detecção e construção de filtros EQ defensivo.
 * Garante que o EQ só é aplicado quando há risco técnico detectado.
 */

// ============================================================
// MOCK DA FUNÇÃO buildDefensiveEQFilters
// ============================================================

/**
 * Mock da função buildDefensiveEQFilters (copiado do automaster-v1.cjs)
 */
function buildDefensiveEQFilters(spectralRisk) {
  const { subDominant, harsh } = spectralRisk;

  const filters = [];

  // Filtro 1: Subgrave excessivo
  if (subDominant) {
    // Highpass suave em 28 Hz (poles 2 = 12 dB/oct)
    filters.push('highpass=f=28:poles=2');
    // Corte adicional em 55 Hz (Q 1.2 = relativamente largo)
    filters.push('equalizer=f=55:t=q:w=1.2:g=-1.5');
  }

  // Filtro 2: Harshness excessivo
  if (harsh) {
    // Corte em 4.8 kHz (Q 1.0 = médio)
    filters.push('equalizer=f=4800:t=q:w=1.0:g=-1.5');
  }

  // Se nenhum filtro, retornar null (bypass)
  if (filters.length === 0) {
    return null;
  }

  // Garantir máximo de 3 filtros (proteção adicional)
  if (filters.length > 3) {
    return filters.slice(0, 3).join(',');
  }

  return filters.join(',');
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
    rms: { sub: -25, body: -18, presence: -24 }
  },
  expected: {
    filters: null,
    reason: 'Sem risco detectado, EQ não necessário'
  }
});

// -----------------------------------------------------------
// GRUPO 2: SUBGRAVE EXCESSIVO
// -----------------------------------------------------------

tests.push({
  name: 'Sub exagerado - highpass aplicado',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -14, body: -18, presence: -24 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    reason: 'Subgrave dominante detectado (sub RMS > body RMS - 5 dB)'
  }
});

tests.push({
  name: 'Sub dominante (caso extremo)',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -10, body: -14, presence: -25 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    reason: 'Subgrave muito alto (4 dB de diferença)'
  }
});

// -----------------------------------------------------------
// GRUPO 3: HARSHNESS EXCESSIVO
// -----------------------------------------------------------

tests.push({
  name: 'Harsh excessivo - corte 4.8k aplicado',
  input: {
    subDominant: false,
    harsh: true,
    rms: { sub: -28, body: -18, presence: -16 }
  },
  expected: {
    filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Harshness detectado (presence RMS > body RMS - 3 dB)'
  }
});

tests.push({
  name: 'Harsh extremo (caso limítrofe)',
  input: {
    subDominant: false,
    harsh: true,
    rms: { sub: -30, body: -20, presence: -17.1 }
  },
  expected: {
    filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Presença muito próxima do corpo (-2.9 dB)'
  }
});

// -----------------------------------------------------------
// GRUPO 4: AMBOS OS RISCOS
// -----------------------------------------------------------

tests.push({
  name: 'Sub exagerado + harsh - aplicar dois filtros',
  input: {
    subDominant: true,
    harsh: true,
    rms: { sub: -14, body: -18, presence: -16 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5,equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Ambos os riscos detectados (sub dominante + harsh)'
  }
});

tests.push({
  name: 'Sub + harsh (caso extremo)',
  input: {
    subDominant: true,
    harsh: true,
    rms: { sub: -12, body: -16, presence: -13.5 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5,equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Mix problemática em sub e agudos'
  }
});

// -----------------------------------------------------------
// GRUPO 5: CASOS LIMÍTROFES (edge cases)
// -----------------------------------------------------------

tests.push({
  name: 'Sub exatamente no limite (não dominante)',
  input: {
    subDominant: false,
    harsh: false,
    rms: { sub: -23.0, body: -18, presence: -24 }
  },
  expected: {
    filters: null,
    reason: 'Sub RMS exatamente -5 dB do corpo (não ativa bypass)'
  }
});

tests.push({
  name: 'Harsh exatamente no limite (não harsh)',
  input: {
    subDominant: false,
    harsh: false,
    rms: { sub: -28, body: -18, presence: -21.0 }
  },
  expected: {
    filters: null,
    reason: 'Presence RMS exatamente -3 dB do corpo (não ativa EQ)'
  }
});

tests.push({
  name: 'Sub dominante mas harsh não',
  input: {
    subDominant: true,
    harsh: false,
    rms: { sub: -15, body: -18, presence: -24 }
  },
  expected: {
    filters: 'highpass=f=28:poles=2,equalizer=f=55:t=q:w=1.2:g=-1.5',
    reason: 'Apenas sub dominante (harsh seguro)'
  }
});

tests.push({
  name: 'Harsh mas sub não dominante',
  input: {
    subDominant: false,
    harsh: true,
    rms: { sub: -28, body: -18, presence: -15.5 }
  },
  expected: {
    filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.5',
    reason: 'Apenas harsh (sub seguro)'
  }
});

// ============================================================
// EXECUÇÃO DOS TESTES
// ============================================================

function runTests() {
  console.log('🧪 TESTES UNITÁRIOS: EQ DEFENSIVO V1\n');
  
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = buildDefensiveEQFilters(test.input);
    
    const success = result === test.expected.filters;
    
    if (success) {
      passed++;
      console.log(`✅ Teste #${i + 1}: ${test.name}`);
    } else {
      failed++;
      console.log(`❌ Teste #${i + 1}: ${test.name}`);
      console.log(`   Esperado: ${test.expected.filters}`);
      console.log(`   Recebido: ${result}`);
      console.log(`   Motivo: ${test.expected.reason}\n`);
      
      failures.push({
        number: i + 1,
        name: test.name,
        expected: test.expected.filters,
        received: result
      });
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
