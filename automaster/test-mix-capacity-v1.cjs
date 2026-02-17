#!/usr/bin/env node
/**
 * Testes Unitários: evaluateMixCapacity() V1-Safe
 * 
 * Valida: ordem de validações, hard stops, caps obrigatórios, invariantes determinísticos
 * Status: 100% determinístico, zero IA/ML, zero randomização
 */

const fs = require('fs');
const path = require('path');

// Importar função do automaster-v1.cjs (sem executar)
const automasterCode = fs.readFileSync(path.join(__dirname, 'automaster-v1.cjs'), 'utf8');

// Extrair apenas a função evaluateMixCapacity
const evaluateMixCapacityMatch = automasterCode.match(/function evaluateMixCapacity\(options\) \{[\s\S]+?\n\}/);
if (!evaluateMixCapacityMatch) {
  console.error('❌ ERRO: Não foi possível extrair evaluateMixCapacity() do automaster-v1.cjs');
  process.exit(1);
}

// Criar função isolada para testes
const evaluateMixCapacity = eval(`(${evaluateMixCapacityMatch[0]})`);

// Contador de testes
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * Função auxiliar de teste
 */
function test(name, input, expected) {
  totalTests++;
  
  try {
    const result = evaluateMixCapacity(input);
    
    // Validar cada campo do resultado
    let passed = true;
    let errors = [];
    
    if (expected.canPush !== undefined && result.canPush !== expected.canPush) {
      passed = false;
      errors.push(`canPush: esperado ${expected.canPush}, recebido ${result.canPush}`);
    }
    
    if (expected.pushStrength !== undefined && result.pushStrength !== expected.pushStrength) {
      passed = false;
      errors.push(`pushStrength: esperado ${expected.pushStrength}, recebido ${result.pushStrength}`);
    }
    
    if (expected.recommendedLufsOffset !== undefined) {
      const offsetDiff = Math.abs(result.recommendedLufsOffset - expected.recommendedLufsOffset);
      if (offsetDiff > 0.01) { // Tolerância de 0.01 LU
        passed = false;
        errors.push(`recommendedLufsOffset: esperado ${expected.recommendedLufsOffset}, recebido ${result.recommendedLufsOffset}`);
      }
    }
    
    if (expected.reasonContains !== undefined) {
      if (!result.reason.includes(expected.reasonContains)) {
        passed = false;
        errors.push(`reason: esperado conter "${expected.reasonContains}", recebido "${result.reason}"`);
      }
    }
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${name}`);
    } else {
      failedTests++;
      console.error(`❌ ${name}`);
      errors.forEach(err => console.error(`   ${err}`));
      console.error(`   Input: ${JSON.stringify(input)}`);
      console.error(`   Expected: ${JSON.stringify(expected)}`);
      console.error(`   Result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    failedTests++;
    console.error(`❌ ${name} - EXCEPTION`);
    console.error(`   ${error.message}`);
    console.error(`   Input: ${JSON.stringify(input)}`);
  }
}

console.log('🧪 TESTES UNITÁRIOS: evaluateMixCapacity() V1-Safe\n');

// ============================================================
// TESTES OBRIGATÓRIOS (especificados pelo usuário)
// ============================================================

console.log('📋 TESTES OBRIGATÓRIOS (edge cases críticos)\n');

// Teste #1: delta = 0.4, crest=12, sub dominante → offset final = 0.4 (NUNCA 0.5)
test('OBRIGATÓRIO #1: Delta 0.4 + crest 12 + sub dominante → offset DEVE SER 0.4', {
  crestFactor: 12.0,
  subRms: -16.0,  // sub dominante: -16 - (-14) = -2 > -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -10.4,
  targetLufs: -10.0, // delta = 0.4
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 0.4, // cap pelo delta (não 0.5 do sub dominante)
  reasonContains: 'sub_dominant_cap'
});

// Teste #2: delta = -0.2, crest=12, sub dominante → offset final = 0
test('OBRIGATÓRIO #2: Delta negativo (-0.2) → offset DEVE SER 0', {
  crestFactor: 12.0,
  subRms: -16.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -9.8,   // current ACIMA do target
  targetLufs: -10.0,   // delta = -0.2 (negativo)
  isFallback: false
}, {
  canPush: false,
  pushStrength: 'none',
  recommendedLufsOffset: 0,
  reasonContains: 'delta_negative'
});

// Teste #3: abs(delta)=0.8, crest=14 → offset final = 0
test('OBRIGATÓRIO #3: Delta 0.8 (abaixo de 1.0) → offset DEVE SER 0', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -10.8,
  targetLufs: -10.0, // delta = 0.8 (< 1.0 threshold)
  isFallback: false
}, {
  canPush: false,
  pushStrength: 'none',
  recommendedLufsOffset: 0,
  reasonContains: 'already_close_to_target'
});

// ============================================================
// TESTES DE VALIDAÇÃO DE MÉTRICAS
// ============================================================

console.log('\n📋 VALIDAÇÃO DE MÉTRICAS\n');

test('Métricas válidas: null crestFactor', {
  crestFactor: null,
  subRms: -20.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'missing_metrics'
});

test('Métricas válidas: NaN subRms', {
  crestFactor: 10.0,
  subRms: NaN,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'missing_metrics'
});

test('Métricas válidas: undefined bodyRms', {
  crestFactor: 10.0,
  subRms: -20.0,
  bodyRms: undefined,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'missing_metrics'
});

// ============================================================
// TESTES DE HARD STOPS
// ============================================================

console.log('\n📋 HARD STOPS (ordem importa)\n');

test('Hard stop: unstableDynamics = true', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: true,
  currentLufs: -15.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'unstable_dynamics'
});

test('Hard stop: delta negativo', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -9.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'delta_negative'
});

test('Hard stop: delta exatamente 1.0 (limiar)', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -11.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'already_close_to_target'
});

test('Hard stop: crest 5.9 (abaixo de 6)', {
  crestFactor: 5.9,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0
}, {
  canPush: false,
  recommendedLufsOffset: 0,
  reasonContains: 'low_crest'
});

// ============================================================
// TESTES DE BASE OFFSET POR CREST
// ============================================================

console.log('\n📋 BASE OFFSET POR CREST (determinístico)\n');

test('Crest 12.0+ (high): offset base 1.0', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 1.0,
  reasonContains: 'crest_high'
});

test('Crest 9.0-12.0 (medium): offset base 0.7', {
  crestFactor: 10.5,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'medium',
  recommendedLufsOffset: 0.7,
  reasonContains: 'crest_medium'
});

test('Crest 6.0-9.0 (low): offset base 0.3', {
  crestFactor: 7.5,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'low',
  recommendedLufsOffset: 0.3,
  reasonContains: 'crest_low'
});

// ============================================================
// TESTES DE SUB DOMINANTE CAP
// ============================================================

console.log('\n📋 SUB DOMINANTE CAP (não return cedo)\n');

test('Sub dominante + crest high: cap 0.5 (não 1.0)', {
  crestFactor: 14.0,
  subRms: -15.0,  // sub dominante: -15 - (-14) = -1 > -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 0.5, // cap aplicado (não 1.0)
  reasonContains: 'sub_dominant_cap'
});

test('Sub dominante + crest medium: cap 0.5 (não 0.7)', {
  crestFactor: 10.0,
  subRms: -16.0,  // sub dominante: -16 - (-14) = -2 > -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'medium',
  recommendedLufsOffset: 0.5, // cap aplicado (não 0.7)
  reasonContains: 'sub_dominant_cap'
});

test('Sub dominante + crest low: sem cap (0.3 < 0.5)', {
  crestFactor: 7.0,
  subRms: -16.0,  // sub dominante: -16 - (-14) = -2 > -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'low',
  recommendedLufsOffset: 0.3, // 0.3 < 0.5, sem cap aplicado
  reasonContains: 'crest_low' // sem sub_dominant_cap (cap não afetou)
});

test('Sub OK (não dominante): sem cap', {
  crestFactor: 14.0,
  subRms: -22.0,  // sub OK: -22 - (-14) = -8 < -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 1.0 // sem cap (sub OK)
});

// ============================================================
// TESTES DE CAP FINAL OBRIGATÓRIO
// ============================================================

console.log('\n📋 CAP FINAL OBRIGATÓRIO (delta e 1.0)\n');

test('Cap pelo delta: delta 2.0 < offset 1.0', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -12.0,
  targetLufs: -10.0, // delta = 2.0
  isFallback: false
}, {
  canPush: true,
  recommendedLufsOffset: 1.0 // offset 1.0 < delta 2.0, sem cap
});

test('Cap pelo delta: delta 0.5 < offset 1.0', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -10.5,
  targetLufs: -10.0, // delta = 0.5 (mas já falhou no hard stop > 1.0, este é caso hipotético)
  isFallback: false
}, {
  canPush: false, // hard stop já bloqueou (delta < 1.0)
  recommendedLufsOffset: 0
});

test('Cap máximo 1.0: offset nunca excede 1.0', {
  crestFactor: 20.0, // crest altíssimo (hipotético)
  subRms: -30.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -20.0,
  targetLufs: -10.0, // delta = 10.0 (enorme)
  isFallback: false
}, {
  canPush: true,
  recommendedLufsOffset: 1.0 // clamp máximo em 1.0
});

// ============================================================
// TESTES DE FALLBACK CAP
// ============================================================

console.log('\n📋 FALLBACK CAP (0.7 LU max se isFallback=true)\n');

test('Fallback: crest high (1.0) → cap 0.7', {
  crestFactor: 14.0,
  subRms: -20.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: true
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 0.7, // cap aplicado (não 1.0)
  reasonContains: 'fallback_cap'
});

test('Fallback: crest medium (0.7) → sem cap (já é 0.7)', {
  crestFactor: 10.0,
  subRms: -20.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: true
}, {
  canPush: true,
  pushStrength: 'medium',
  recommendedLufsOffset: 0.7, // 0.7 = 0.7, cap não muda nada
  reasonContains: 'fallback_cap'
});

test('Fallback: crest low (0.3) → sem cap (0.3 < 0.7)', {
  crestFactor: 7.0,
  subRms: -20.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: true
}, {
  canPush: true,
  pushStrength: 'low',
  recommendedLufsOffset: 0.3, // 0.3 < 0.7, sem cap aplicado
  reasonContains: 'fallback_cap'
});

test('Fallback: sub dominante (0.5) + crest high → cap 0.5', {
  crestFactor: 14.0,
  subRms: -16.0,  // sub dominante
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: true
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 0.5, // sub cap 0.5 < fallback cap 0.7
  reasonContains: 'sub_dominant_cap'
});

test('Sem fallback: crest high mantém 1.0', {
  crestFactor: 14.0,
  subRms: -22.0,
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -15.0,
  targetLufs: -10.0,
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 1.0 // sem fallback cap
});

// ============================================================
// TESTES ADICIONAIS: FALLBACK CONSERVADOR
// ============================================================

console.log('\n📋 FALLBACK CONSERVADOR (delta pequeno bloqueado)\n');

test('Fallback conservador: delta 0.8 + sub dominante → offset 0', {
  crestFactor: 12.0,
  subRms: -16.0,  // sub dominante: -16 - (-14) = -2 > -6
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -10.8,
  targetLufs: -10.0, // delta = 0.8 (< 1.0)
  isFallback: true
}, {
  canPush: false,
  pushStrength: 'none',
  recommendedLufsOffset: 0,
  reasonContains: 'already_close_to_target'
});

test('Sub dominance -6.0 exato: isSubDominant = false', {
  crestFactor: 12.0,
  subRms: -20.0,  // sub dominance: -20 - (-14) = -6.0 (exato, não dominante)
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -12.0,
  targetLufs: -10.0, // delta = 2.0 (> 1.0, passa hard stop)
  isFallback: false
}, {
  canPush: true,
  pushStrength: 'high',
  recommendedLufsOffset: 1.0 // sem cap (não é sub dominante)
});

// ============================================================
// RESUMO DOS TESTES
// ============================================================

console.log('\n' + '='.repeat(60));
console.log(`📊 RESUMO DOS TESTES`);
console.log('='.repeat(60));
console.log(`Total de testes: ${totalTests}`);
console.log(`✅ Passaram: ${passedTests}`);
console.log(`❌ Falharam: ${failedTests}`);
console.log('='.repeat(60));

if (failedTests === 0) {
  console.log('\n🎉 TODOS OS TESTES PASSARAM!');
  console.log('evaluateMixCapacity() V1-Safe está correto e robusto.\n');
  process.exit(0);
} else {
  console.error(`\n❌ ${failedTests} TESTE(S) FALHARAM!`);
  console.error('Revisar implementação de evaluateMixCapacity().\n');
  process.exit(1);
}
