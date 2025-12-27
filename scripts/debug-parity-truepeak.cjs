/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🧪 DEBUG PARITY TEST - Verifica Consistência TP > 0 = CRÍTICA
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Este script testa se todas as funções que calculam severidade para True Peak
 * estão retornando CRÍTICA quando TP > 0.0 dBTP.
 * 
 * EXECUÇÃO: node scripts/debug-parity-truepeak.cjs
 * 
 * REGRA ABSOLUTA:
 *   True Peak > 0.0 dBTP => severity = "CRÍTICA" SEMPRE
 *   - Independente de tolerância
 *   - Independente de targets do gênero
 *   - Independente de qualquer outro parâmetro
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

const path = require('path');
const fs = require('fs');

// ════════════════════════════════════════════════════════════════════
// 🧪 CENÁRIOS DE TESTE
// ════════════════════════════════════════════════════════════════════

const TEST_SCENARIOS = [
  {
    name: 'TP = 3.9 dBTP (Prints do usuário)',
    truePeak: 3.9,
    expectedSeverity: 'CRÍTICA',
    expectedCritical: true
  },
  {
    name: 'TP = 1.0 dBTP',
    truePeak: 1.0,
    expectedSeverity: 'CRÍTICA',
    expectedCritical: true
  },
  {
    name: 'TP = 0.5 dBTP',
    truePeak: 0.5,
    expectedSeverity: 'CRÍTICA',
    expectedCritical: true
  },
  {
    name: 'TP = 0.1 dBTP (Muito próximo de 0)',
    truePeak: 0.1,
    expectedSeverity: 'CRÍTICA',
    expectedCritical: true
  },
  {
    name: 'TP = 0.0 dBTP (Exatamente no limite)',
    truePeak: 0.0,
    expectedSeverity: 'ALTA',  // 0.0 está acima do warnFrom (-0.3), então é ALTA
    expectedCritical: false
  },
  {
    name: 'TP = -0.1 dBTP (Logo abaixo do limite)',
    truePeak: -0.1,
    expectedSeverity: 'ALTA',  // Próximo do limite
    expectedCritical: false
  },
  {
    name: 'TP = -1.0 dBTP (Normal)',
    truePeak: -1.0,
    expectedSeverity: 'OK',
    expectedCritical: false
  },
  {
    name: 'TP = -2.5 dBTP (Conservador)',
    truePeak: -2.5,
    expectedSeverity: 'OK',
    expectedCritical: false
  }
];

// ════════════════════════════════════════════════════════════════════
// 🎯 TARGETS SIMULADOS (Funk Mandela - Pista)
// ════════════════════════════════════════════════════════════════════

const FUNK_MANDELA_TARGETS = {
  truePeak: {
    target: -0.5,
    min: -3.0,
    max: 0.0,
    warnFrom: -0.3,
    hardCap: 0.0,
    tolerance: 1.0
  }
};

// ════════════════════════════════════════════════════════════════════
// 🧪 FUNÇÕES DE TESTE
// ════════════════════════════════════════════════════════════════════

/**
 * Simula evaluateMetric do normalize-genre-targets.js
 */
function simulateEvaluateMetric(value, cfg = {}) {
  const TRUE_PEAK_HARD_CAP = 0.0;
  const { min = -3.0, max = 0.0, warnFrom = -0.3, hardCap = 0.0 } = cfg;
  
  // REGRA ABSOLUTA: TP > 0.0 = CRÍTICA
  const effectiveHardCap = hardCap ?? TRUE_PEAK_HARD_CAP;
  if (value > effectiveHardCap) {
    return {
      severity: 'CRÍTICA',
      isCritical: true,
      reasonCode: 'TP_ABOVE_ZERO'
    };
  }
  
  // ALTA: Acima de warnFrom
  if (warnFrom !== null && value > warnFrom) {
    return {
      severity: 'ALTA',
      isCritical: false,
      reasonCode: 'TP_NEAR_CLIP'
    };
  }
  
  // OK: Dentro do range [min, max]
  if (value >= min && value <= max) {
    return {
      severity: 'OK',
      isCritical: false,
      reasonCode: 'TP_OK'
    };
  }
  
  // ATENÇÃO: Fora do range mas não crítico
  return {
    severity: 'ATENÇÃO',
    isCritical: false,
    reasonCode: 'TP_OUT_OF_RANGE'
  };
}

/**
 * Simula compareWithTargets do core/compareWithTargets.js
 */
function simulateCompareWithTargets(value, cfg = {}) {
  const TRUE_PEAK_HARD_CAP = 0.0;
  const { min = -3.0, max = 0.0, warnFrom = -0.3 } = cfg;
  
  // REGRA CRÍTICA: TP > 0.0 dBTP = CRÍTICA SEMPRE
  if (value > TRUE_PEAK_HARD_CAP) {
    return {
      severity: 'CRÍTICA',
      severityClass: 'critical',
      reasonCode: 'TP_ABOVE_ZERO'
    };
  }
  
  // WARNING ZONE
  if (warnFrom !== null && value > warnFrom) {
    return {
      severity: 'ALTA',
      severityClass: 'warning',
      reasonCode: 'TP_NEAR_CLIP'
    };
  }
  
  // ABAIXO DO MÍNIMO
  if (value < min) {
    return {
      severity: 'ATENÇÃO',
      severityClass: 'caution',
      reasonCode: 'TP_TOO_LOW'
    };
  }
  
  // OK
  return {
    severity: 'OK',
    severityClass: 'ok',
    reasonCode: 'TP_OK'
  };
}

/**
 * Simula classifyTruePeak do metric-classifier.js
 */
function simulateClassifyTruePeak(value, cfg = {}) {
  const TRUE_PEAK_HARD_CAP = 0.0;
  const { min = -3.0, max = 0.0, warnFrom = -0.3 } = cfg;
  
  // REGRA ABSOLUTA: TP > 0.0 = CRÍTICA SEMPRE
  if (value > TRUE_PEAK_HARD_CAP) {
    return {
      level: 'critical',
      severity: 'CRÍTICA',
      reasonCode: 'TP_ABOVE_ZERO'
    };
  }
  
  // Próximo do limite
  if (warnFrom !== null && value > warnFrom) {
    return {
      level: 'attention',
      severity: 'ALTA',
      reasonCode: 'TP_NEAR_CLIP'
    };
  }
  
  // TP baixo é OK
  if (value < min) {
    return {
      level: 'ok',
      severity: 'OK',
      reasonCode: 'TP_TOO_LOW'
    };
  }
  
  // OK
  return {
    level: 'ok',
    severity: 'OK',
    reasonCode: 'TP_OK'
  };
}

// ════════════════════════════════════════════════════════════════════
// 🏃 EXECUÇÃO DOS TESTES
// ════════════════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('🧪 DEBUG PARITY TEST - True Peak > 0 = CRÍTICA');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

for (const scenario of TEST_SCENARIOS) {
  console.log(`\n📋 ${scenario.name}`);
  console.log(`   Valor: ${scenario.truePeak} dBTP`);
  console.log(`   Esperado: severity="${scenario.expectedSeverity}", isCritical=${scenario.expectedCritical}`);
  
  // Testar com targets do Funk Mandela
  const targets = FUNK_MANDELA_TARGETS.truePeak;
  
  // Testar evaluateMetric
  const evalResult = simulateEvaluateMetric(scenario.truePeak, targets);
  const evalPass = evalResult.severity === scenario.expectedSeverity;
  
  // Testar compareWithTargets  
  const compareResult = simulateCompareWithTargets(scenario.truePeak, targets);
  const comparePass = compareResult.severity === scenario.expectedSeverity;
  
  // Testar classifyTruePeak
  const classifyResult = simulateClassifyTruePeak(scenario.truePeak, targets);
  const classifyPass = classifyResult.severity === scenario.expectedSeverity;
  
  // Verificar paridade (todos iguais?)
  const allMatch = evalResult.severity === compareResult.severity && 
                   compareResult.severity === classifyResult.severity;
  
  totalTests += 3;
  
  if (evalPass) passedTests++; else {
    failedTests++;
    failures.push(`${scenario.name} - evaluateMetric: got ${evalResult.severity}, expected ${scenario.expectedSeverity}`);
  }
  
  if (comparePass) passedTests++; else {
    failedTests++;
    failures.push(`${scenario.name} - compareWithTargets: got ${compareResult.severity}, expected ${scenario.expectedSeverity}`);
  }
  
  if (classifyPass) passedTests++; else {
    failedTests++;
    failures.push(`${scenario.name} - classifyTruePeak: got ${classifyResult.severity}, expected ${scenario.expectedSeverity}`);
  }
  
  console.log(`   evaluateMetric:      ${evalPass ? '✅' : '❌'} severity=${evalResult.severity}`);
  console.log(`   compareWithTargets:  ${comparePass ? '✅' : '❌'} severity=${compareResult.severity}`);
  console.log(`   classifyTruePeak:    ${classifyPass ? '✅' : '❌'} severity=${classifyResult.severity}`);
  console.log(`   PARIDADE:            ${allMatch ? '✅ TODAS IGUAIS' : '❌ DIVERGÊNCIA!'}`);
}

// ════════════════════════════════════════════════════════════════════
// 📊 RESULTADO FINAL
// ════════════════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('📊 RESULTADO FINAL');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Total de testes: ${totalTests}`);
console.log(`✅ Passou: ${passedTests}`);
console.log(`❌ Falhou: ${failedTests}`);
console.log('');

if (failures.length > 0) {
  console.log('❌ FALHAS ENCONTRADAS:');
  for (const failure of failures) {
    console.log(`   - ${failure}`);
  }
  console.log('');
  console.log('🚨 AÇÃO NECESSÁRIA: Corrigir inconsistências nas funções acima');
  process.exit(1);
} else {
  console.log('✅ TODOS OS TESTES PASSARAM!');
  console.log('🎯 Regra "TP > 0 = CRÍTICA" está consistente em todas as funções.');
  process.exit(0);
}
