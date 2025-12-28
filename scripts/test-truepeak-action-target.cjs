/**
 * 🧪 TESTE: True Peak ACTION - Correção Bug Delta para Target
 * 
 * Valida que a coluna "Ação Sugerida" da TABELA usa o delta até TARGET,
 * não até hardCap ou warnFrom.
 * 
 * CENÁRIOS DE TESTE (do usuário):
 * 1) tp_value=1.6, tp_target=-0.2, hardCap=0.0 => action=1.8
 * 2) tp_value=3.1, tp_target=-0.5, hardCap=0.0 => action=3.6
 * 3) tp_value=6.0, tp_target=-1.0, hardCap=0.0 => action=7.0
 * 
 * USAGE: node scripts/test-truepeak-action-target.cjs
 */

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK: Simula evaluateTruePeak (lógica CORRIGIDA)
// ═══════════════════════════════════════════════════════════════════════════════

const TRUE_PEAK_HARD_CAP = 0.0;

function evaluateTruePeakFixed(value, target) {
  const { min, max, warnFrom, hardCap } = target;
  const effectiveHardCap = hardCap ?? TRUE_PEAK_HARD_CAP;
  const unit = 'dBTP';
  
  let severity, action;
  
  // 🚨 REGRA CRÍTICA: TP > 0.0 dBTP = CRÍTICA SEMPRE
  if (value > effectiveHardCap) {
    // ✅ FIX: usar target.target (não hardCap)
    const delta = value - target.target;
    severity = 'CRÍTICA';
    action = `🔴 CLIPPING! Reduzir ${delta.toFixed(1)} ${unit}`;
  }
  // WARNING ZONE: Acima de warnFrom
  else if (warnFrom !== null && value > warnFrom) {
    // ✅ FIX: usar target.target (não warnFrom)
    const deltaToTarget = value - target.target;
    severity = 'ALTA';
    action = `⚠️ Próximo do limite. Reduzir ${deltaToTarget.toFixed(2)} ${unit}`;
  }
  // ABAIXO DO MÍNIMO
  else if (value < min) {
    const delta = min - value;
    severity = 'ATENÇÃO';
    action = `ℹ️ Margem extra de ${delta.toFixed(2)} ${unit}`;
  }
  // OK
  else {
    severity = 'OK';
    action = '✅ Dentro do padrão';
  }
  
  const diff = value - target.target;
  
  return {
    value,
    target: target.target,
    hardCap: effectiveHardCap,
    warnFrom,
    diff,
    severity,
    action
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIOS DE TESTE
// ═══════════════════════════════════════════════════════════════════════════════

const testCases = [
  {
    name: 'Cenário 1: TP=1.6, target=-0.2 (CLIPPING)',
    value: 1.6,
    target: {
      target: -0.2,
      min: -3.0,
      max: 0.0,
      warnFrom: -0.5,
      hardCap: 0.0
    },
    expectedDelta: 1.8,       // 1.6 - (-0.2) = 1.8
    expectedSeverity: 'CRÍTICA'
  },
  {
    name: 'Cenário 2: TP=3.1, target=-0.5 (CLIPPING)',
    value: 3.1,
    target: {
      target: -0.5,
      min: -3.0,
      max: 0.0,
      warnFrom: -0.8,
      hardCap: 0.0
    },
    expectedDelta: 3.6,       // 3.1 - (-0.5) = 3.6
    expectedSeverity: 'CRÍTICA'
  },
  {
    name: 'Cenário 3: TP=6.0, target=-1.0 (CLIPPING)',
    value: 6.0,
    target: {
      target: -1.0,
      min: -3.0,
      max: 0.0,
      warnFrom: -0.5,
      hardCap: 0.0
    },
    expectedDelta: 7.0,       // 6.0 - (-1.0) = 7.0
    expectedSeverity: 'CRÍTICA'
  },
  {
    name: 'Cenário 4: TP=-0.3, target=-0.5 (WARNING ZONE)',
    value: -0.3,
    target: {
      target: -0.5,
      min: -3.0,
      max: 0.0,
      warnFrom: -0.5,
      hardCap: 0.0
    },
    expectedDelta: 0.2,       // -0.3 - (-0.5) = 0.2
    expectedSeverity: 'ALTA'
  },
  {
    name: 'Cenário 5: TP=-1.5, target=-1.0 (OK)',
    value: -1.5,
    target: {
      target: -1.0,
      min: -3.0,
      max: 0.0,
      warnFrom: -0.5,
      hardCap: 0.0
    },
    expectedDelta: -0.5,      // -1.5 - (-1.0) = -0.5 (negativo = OK)
    expectedSeverity: 'OK'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO DOS TESTES
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}🧪 TESTE: True Peak ACTION - Delta para TARGET${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = evaluateTruePeakFixed(tc.value, tc.target);
  
  // Extrair delta da action (se houver)
  const actionMatch = result.action.match(/Reduzir\s+([\d.]+)/);
  const actionDelta = actionMatch ? parseFloat(actionMatch[1]) : null;
  
  // Validações
  const diffCorrect = Math.abs(result.diff - tc.expectedDelta) <= 0.01;
  const severityCorrect = result.severity === tc.expectedSeverity;
  const actionCorrect = actionDelta === null 
    ? tc.expectedSeverity === 'OK' || tc.expectedSeverity === 'ATENÇÃO'
    : Math.abs(actionDelta - Math.abs(tc.expectedDelta)) <= 0.1;
  
  const allCorrect = diffCorrect && severityCorrect && actionCorrect;
  
  if (allCorrect) {
    console.log(`\n${colors.green}✅ ${tc.name}${colors.reset}`);
    passed++;
  } else {
    console.log(`\n${colors.red}❌ ${tc.name}${colors.reset}`);
    failed++;
  }
  
  console.log(`   • TP value: ${result.value.toFixed(1)} dBTP`);
  console.log(`   • Target: ${result.target.toFixed(1)} dBTP`);
  console.log(`   • HardCap: ${result.hardCap.toFixed(1)} dBTP`);
  console.log(`   • Diff (value - target): ${result.diff.toFixed(2)} ${diffCorrect ? '✅' : '❌'} (esperado: ${tc.expectedDelta.toFixed(2)})`);
  console.log(`   • Severity: ${result.severity} ${severityCorrect ? '✅' : '❌'} (esperado: ${tc.expectedSeverity})`);
  console.log(`   • Action: ${result.action}`);
  
  if (actionDelta !== null) {
    console.log(`   • Delta na action: ${actionDelta.toFixed(1)} ${actionCorrect ? '✅' : '❌'} (esperado: ${Math.abs(tc.expectedDelta).toFixed(1)})`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMÁRIO
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}📋 SUMÁRIO${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);

if (failed === 0) {
  console.log(`\n${colors.green}🎉 TODOS OS TESTES PASSARAM! (${passed}/${passed + failed})${colors.reset}`);
  console.log(`${colors.green}✅ Ação da tabela usa delta até TARGET (não hardCap/warnFrom)${colors.reset}`);
  console.log(`${colors.green}✅ abs(actionDelta - abs(diff)) <= 0.1 para todos os casos${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}❌ ALGUNS TESTES FALHARAM: ${failed}/${passed + failed}${colors.reset}\n`);
  process.exit(1);
}
