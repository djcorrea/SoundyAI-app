/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🧪 TESTES DE VALIDAÇÃO - GOLDEN SCENARIOS
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Testes obrigatórios para garantir consistência entre tabela, sugestões e score.
 * 
 * CENÁRIOS TESTADOS:
 *   1. Funk Mandela com TP > 0 → CRÍTICA
 *   2. Progressive Trance com TP 1.7 → CRÍTICA  
 *   3. Caso dentro do range → OK
 * 
 * EXECUÇÃO:
 *   node work/lib/audio/core/validate-targets.test.js
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { resolveTargets, validateTargets, TRUE_PEAK_HARD_CAP } from './resolveTargets.js';
import { compareWithTargets } from './compareWithTargets.js';

// ════════════════════════════════════════════════════════════════════════════════
// 🎯 CONFIGURAÇÃO DOS TESTES
// ════════════════════════════════════════════════════════════════════════════════

const TESTS_PASSED = { count: 0 };
const TESTS_FAILED = { count: 0, details: [] };

function assert(condition, message) {
  if (condition) {
    TESTS_PASSED.count++;
    console.log(`✅ PASS: ${message}`);
  } else {
    TESTS_FAILED.count++;
    TESTS_FAILED.details.push(message);
    console.error(`❌ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  const pass = actual === expected;
  if (pass) {
    TESTS_PASSED.count++;
    console.log(`✅ PASS: ${message}`);
  } else {
    TESTS_FAILED.count++;
    TESTS_FAILED.details.push(`${message} (esperado: ${expected}, obtido: ${actual})`);
    console.error(`❌ FAIL: ${message} (esperado: ${expected}, obtido: ${actual})`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 📋 CENÁRIO 1: Funk Mandela com True Peak > 0 → CRÍTICA
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📋 CENÁRIO 1: Funk Mandela com True Peak > 0 → CRÍTICA');
console.log('═══════════════════════════════════════════════════════════════\n');

const funkMandelaTargets = {
  lufs_target: -6.5,
  lufs_min: -7.5,
  lufs_max: -5.5,
  true_peak_target: -0.2,
  true_peak_min: -2.5,
  true_peak_max: 0.0, // Hard cap
  true_peak_warn_from: -0.1,
  dr_target: 5,
  dr_min: 4,
  dr_max: 7,
  stereo_target: 0.75,
  stereo_min: 0.6,
  stereo_max: 0.9,
  bands: {
    sub: { target_db: -28, target_range: { min: -34, max: -22 } },
    bass: { target_db: -20, target_range: { min: -26, max: -14 } }
  }
};

const funkMandelaMetrics = {
  lufsIntegrated: -6.8,
  truePeakDbtp: 0.5, // 🚨 ACIMA DE 0 → DEVE SER CRÍTICA
  dynamicRange: 5.2,
  stereoCorrelation: 0.78,
  spectralBands: {
    bands: {
      sub: { energy_db: -30 },
      bass: { energy_db: -22 }
    }
  }
};

try {
  const targets1 = resolveTargets('funk_mandela', 'pista', funkMandelaTargets);
  const result1 = compareWithTargets(funkMandelaMetrics, targets1);
  
  // VALIDAÇÕES
  assert(targets1._resolved === true, 'Targets resolvidos corretamente');
  assert(targets1.truePeak.max === TRUE_PEAK_HARD_CAP, `truePeak.max === ${TRUE_PEAK_HARD_CAP}`);
  
  // True Peak DEVE ser CRÍTICA
  const tpRow = result1.rows.find(r => r.key === 'truePeak');
  assert(tpRow !== undefined, 'Row de truePeak existe');
  assertEquals(tpRow?.severity, 'CRÍTICA', 'True Peak > 0 → severity = CRÍTICA');
  
  // Deve haver issue de True Peak CRÍTICA
  const tpIssue = result1.issues.find(i => i.key === 'truePeak');
  assert(tpIssue !== undefined, 'Issue de truePeak existe');
  assertEquals(tpIssue?.severity, 'CRÍTICA', 'Issue de True Peak = CRÍTICA');
  
  // LUFS deve estar OK (dentro do range)
  const lufsRow = result1.rows.find(r => r.key === 'lufs');
  assertEquals(lufsRow?.severity, 'OK', 'LUFS dentro do range → OK');
  
  console.log('\n📊 Resultado do cenário 1:', {
    rows: result1.rows.length,
    issues: result1.issues.length,
    score: result1.score.total
  });
  
} catch (error) {
  TESTS_FAILED.count++;
  TESTS_FAILED.details.push(`Cenário 1 falhou: ${error.message}`);
  console.error('❌ ERRO no cenário 1:', error);
}

// ════════════════════════════════════════════════════════════════════════════════
// 📋 CENÁRIO 2: Progressive Trance com True Peak 1.7 → CRÍTICA
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📋 CENÁRIO 2: Progressive Trance com True Peak 1.7 → CRÍTICA');
console.log('═══════════════════════════════════════════════════════════════\n');

const tranceTargets = {
  lufs_target: -7.0,
  lufs_min: -8.0,
  lufs_max: -6.0,
  true_peak_target: -0.5,
  true_peak_min: -2.0,
  true_peak_max: 0.0, // Hard cap
  true_peak_warn_from: -0.3,
  dr_target: 6,
  dr_min: 5,
  dr_max: 8,
  stereo_target: 0.65,
  stereo_min: 0.5,
  stereo_max: 0.85
};

const tranceMetrics = {
  lufsIntegrated: -7.2,
  truePeakDbtp: 1.7, // 🚨 MUITO ACIMA DE 0 → DEVE SER CRÍTICA
  dynamicRange: 6.5,
  stereoCorrelation: 0.7
};

try {
  const targets2 = resolveTargets('progressive_trance', 'pista', tranceTargets);
  const result2 = compareWithTargets(tranceMetrics, targets2);
  
  // True Peak DEVE ser CRÍTICA
  const tpRow2 = result2.rows.find(r => r.key === 'truePeak');
  assertEquals(tpRow2?.severity, 'CRÍTICA', 'True Peak 1.7 → severity = CRÍTICA');
  
  // Score deve ser penalizado
  assert(result2.score.total < 80, `Score penalizado (${result2.score.total} < 80)`);
  
  // Issue crítica deve existir
  const tpIssue2 = result2.issues.find(i => i.key === 'truePeak');
  assert(tpIssue2 !== undefined, 'Issue de truePeak existe');
  assertEquals(tpIssue2?.severity, 'CRÍTICA', 'Issue True Peak 1.7 = CRÍTICA');
  assert(tpIssue2?.action?.includes('CLIPPING'), 'Action menciona CLIPPING');
  
  console.log('\n📊 Resultado do cenário 2:', {
    tpSeverity: tpRow2?.severity,
    score: result2.score.total,
    issuesCount: result2.issues.length
  });
  
} catch (error) {
  TESTS_FAILED.count++;
  TESTS_FAILED.details.push(`Cenário 2 falhou: ${error.message}`);
  console.error('❌ ERRO no cenário 2:', error);
}

// ════════════════════════════════════════════════════════════════════════════════
// 📋 CENÁRIO 3: Métricas dentro do range → OK
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📋 CENÁRIO 3: Métricas dentro do range → OK');
console.log('═══════════════════════════════════════════════════════════════\n');

const okTargets = {
  lufs_target: -10.0,
  lufs_min: -12.0,
  lufs_max: -8.0,
  true_peak_target: -1.0,
  true_peak_min: -2.5,
  true_peak_max: 0.0,
  true_peak_warn_from: -0.3,
  dr_target: 8,
  dr_min: 6,
  dr_max: 12,
  stereo_target: 0.7,
  stereo_min: 0.5,
  stereo_max: 0.9
};

const okMetrics = {
  lufsIntegrated: -10.5, // Dentro do range
  truePeakDbtp: -1.2,    // Dentro do range (negativo!)
  dynamicRange: 8.5,     // Dentro do range
  stereoCorrelation: 0.72 // Dentro do range
};

try {
  const targets3 = resolveTargets('generic', 'pista', okTargets);
  const result3 = compareWithTargets(okMetrics, targets3);
  
  // Todas as métricas principais devem ser OK
  const lufsRow3 = result3.rows.find(r => r.key === 'lufs');
  const tpRow3 = result3.rows.find(r => r.key === 'truePeak');
  const drRow3 = result3.rows.find(r => r.key === 'dr');
  const stereoRow3 = result3.rows.find(r => r.key === 'stereo');
  
  assertEquals(lufsRow3?.severity, 'OK', 'LUFS dentro do range → OK');
  assertEquals(tpRow3?.severity, 'OK', 'True Peak -1.2 (dentro do range) → OK');
  assertEquals(drRow3?.severity, 'OK', 'DR dentro do range → OK');
  assertEquals(stereoRow3?.severity, 'OK', 'Stereo dentro do range → OK');
  
  // Não deve haver issues
  assert(result3.issues.length === 0, 'Zero issues (tudo OK)');
  
  // Score alto
  assert(result3.score.total >= 95, `Score alto (${result3.score.total} >= 95)`);
  
  console.log('\n📊 Resultado do cenário 3:', {
    allOk: result3.rows.every(r => r.severity === 'OK'),
    score: result3.score.total,
    issuesCount: result3.issues.length
  });
  
} catch (error) {
  TESTS_FAILED.count++;
  TESTS_FAILED.details.push(`Cenário 3 falhou: ${error.message}`);
  console.error('❌ ERRO no cenário 3:', error);
}

// ════════════════════════════════════════════════════════════════════════════════
// 📋 CENÁRIO 4: validateTargets - Guardrail
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📋 CENÁRIO 4: validateTargets - Guardrail');
console.log('═══════════════════════════════════════════════════════════════\n');

// Targets válidos
const validTargets = resolveTargets('test', 'pista', okTargets);
const validationResult = validateTargets(validTargets);
assert(validationResult.valid === true, 'Targets válidos passam na validação');
assert(validationResult.errors.length === 0, 'Zero erros para targets válidos');

// Targets inválidos (truePeak.max > 0)
const invalidTargets = {
  ...validTargets,
  truePeak: { ...validTargets.truePeak, max: 0.5 } // INVÁLIDO!
};
const invalidResult = validateTargets(invalidTargets);
assert(invalidResult.valid === false, 'Targets com TP.max > 0 são inválidos');
assert(invalidResult.errors.some(e => e.includes('truePeak.max')), 'Erro menciona truePeak.max');

// ════════════════════════════════════════════════════════════════════════════════
// 📊 RESUMO DOS TESTES
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 RESUMO DOS TESTES');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`✅ Testes passados: ${TESTS_PASSED.count}`);
console.log(`❌ Testes falhados: ${TESTS_FAILED.count}`);

if (TESTS_FAILED.count > 0) {
  console.log('\n🚨 FALHAS:');
  TESTS_FAILED.details.forEach((detail, i) => {
    console.log(`   ${i + 1}. ${detail}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES PASSARAM!');
  process.exit(0);
}
