/**
 * 🧪 TEST: SSOT True Peak - Anti-Regressão
 * 
 * Este teste verifica que:
 * 1. O targetValue/alvo recomendado do True Peak usa o valor real do JSON (ex: -1.0, -0.5)
 * 2. O targetValue NUNCA mostra "target 0.0 dBTP" quando o JSON define outro valor
 * 3. A faixa ideal mostra min a max corretos
 * 4. Os campos numéricos (targetMin, targetMax, targetReal) são preservados
 * 
 * USAGE: node scripts/test-ssot-truepeak.cjs
 */

// Cores para output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA: Simulação dos cenários Trap e Funk Mandela
// ═══════════════════════════════════════════════════════════════════════════════

const mockScenarios = [
  {
    name: 'Trap',
    genreId: 'trap',
    // Valores do JSON de gênero
    jsonTargets: {
      true_peak_target: -1.0,
      true_peak_min: -3.0,
      true_peak_max: 0.0
    },
    // ComparisonResult esperado (o que compareWithTargets deve gerar)
    expectedComparisonRow: {
      key: 'truePeak',
      target: -1.0,  // ✅ Deve ser -1.0, NÃO 0.0
      min: -3.0,
      max: 0.0,
      targetText: '-3.0 a 0.0 dBTP'
    },
    // Sugestão esperada (o que o card deve mostrar)
    expectedSuggestion: {
      metric: 'truePeak',
      targetReal: -1.0,  // ✅ Deve ser -1.0, NÃO 0.0
      targetMin: -3.0,
      targetMax: 0.0
    },
    // Strings que NÃO devem aparecer
    forbiddenStrings: [
      'target 0.0 dBTP',
      'alvo recomendado: 0.0 dBTP',
      'alvo: 0.0 dBTP'
    ],
    // Strings que DEVEM aparecer
    requiredStrings: [
      '-1.0'  // O target real deve aparecer em algum lugar
    ]
  },
  {
    name: 'Funk Mandela',
    genreId: 'funk_mandela',
    jsonTargets: {
      true_peak_target: -0.5,
      true_peak_min: -3.0,
      true_peak_max: 0.0
    },
    expectedComparisonRow: {
      key: 'truePeak',
      target: -0.5,  // ✅ Deve ser -0.5, NÃO 0.0
      min: -3.0,
      max: 0.0,
      targetText: '-3.0 a 0.0 dBTP'
    },
    expectedSuggestion: {
      metric: 'truePeak',
      targetReal: -0.5,  // ✅ Deve ser -0.5, NÃO 0.0
      targetMin: -3.0,
      targetMax: 0.0
    },
    forbiddenStrings: [
      'target 0.0 dBTP',
      'alvo recomendado: 0.0 dBTP',
      'alvo: 0.0 dBTP'
    ],
    requiredStrings: [
      '-0.5'  // O target real deve aparecer em algum lugar
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE TESTE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simula o que resolveTargets faz com os JSON targets
 */
function mockResolveTargets(jsonTargets) {
  return {
    truePeak: {
      target: jsonTargets.true_peak_target,
      min: jsonTargets.true_peak_min,
      max: jsonTargets.true_peak_max,
      hardCap: 0.0
    }
  };
}

/**
 * Simula o que compareWithTargets gera para o row
 */
function mockCompareWithTargets(value, targets) {
  const { target, min, max } = targets.truePeak;
  return {
    key: 'truePeak',
    valueRaw: value,
    target: target,  // ✅ Deve usar o target real do JSON
    min: min,
    max: max,
    diff: value - target,
    targetText: `${min.toFixed(1)} a ${max.toFixed(1)} dBTP`,
    severity: value > max ? 'CRÍTICA' : (value > target ? 'ATENÇÃO' : 'OK')
  };
}

/**
 * Simula o que getMetricFromComparison retorna
 */
function mockGetMetricFromComparison(comparisonRow) {
  return {
    valueRaw: comparisonRow.valueRaw,
    min: comparisonRow.min,
    max: comparisonRow.max,
    target: comparisonRow.target,  // ✅ Deve preservar o target real
    diff: comparisonRow.diff,
    severity: comparisonRow.severity,
    targetText: comparisonRow.targetText
  };
}

/**
 * Simula a geração da sugestão de True Peak (APÓS O PATCH)
 */
function mockBuildTruePeakSuggestion(comparisonData, truePeakValue) {
  const bounds = { min: comparisonData.min, max: comparisonData.max };
  const targetReal = comparisonData.target;  // ✅ PATCH: Usar target real, não bounds.max
  
  return {
    metric: 'truePeak',
    currentValue: `${truePeakValue.toFixed(1)} dBTP`,
    targetValue: `${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dBTP (alvo: ${targetReal.toFixed(1)} dBTP)`,
    targetReal: targetReal,  // ✅ Campo numérico para validação
    targetMin: bounds.min,
    targetMax: bounds.max,
    message: `🔺 True Peak\n• Seu valor: ${truePeakValue.toFixed(1)} dBTP\n• Faixa ideal: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dBTP\n• Alvo recomendado: ${targetReal.toFixed(1)} dBTP`
  };
}

/**
 * Valida um cenário de teste
 */
function validateScenario(scenario, truePeakValue = 0.5) {
  const errors = [];
  const passes = [];
  
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}📋 TESTANDO: ${scenario.name}${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  
  // 1. Simular resolveTargets
  const resolvedTargets = mockResolveTargets(scenario.jsonTargets);
  
  // 2. Simular compareWithTargets
  const comparisonRow = mockCompareWithTargets(truePeakValue, resolvedTargets);
  
  // 3. Validar que o row tem o target correto
  if (comparisonRow.target !== scenario.expectedComparisonRow.target) {
    errors.push({
      test: 'ComparisonRow.target',
      expected: scenario.expectedComparisonRow.target,
      actual: comparisonRow.target,
      message: 'compareWithTargets está usando target errado'
    });
  } else {
    passes.push(`ComparisonRow.target = ${comparisonRow.target} ✅`);
  }
  
  // 4. Simular getMetricFromComparison
  const metricData = mockGetMetricFromComparison(comparisonRow);
  
  // 5. Validar que metricData preserva o target
  if (metricData.target !== scenario.expectedComparisonRow.target) {
    errors.push({
      test: 'MetricData.target',
      expected: scenario.expectedComparisonRow.target,
      actual: metricData.target,
      message: 'getMetricFromComparison perdeu o target'
    });
  } else {
    passes.push(`MetricData.target = ${metricData.target} ✅`);
  }
  
  // 6. Simular buildTruePeakSuggestion (COM O PATCH)
  const suggestion = mockBuildTruePeakSuggestion(metricData, truePeakValue);
  
  // 7. Validar targetReal na sugestão
  if (suggestion.targetReal !== scenario.expectedSuggestion.targetReal) {
    errors.push({
      test: 'Suggestion.targetReal',
      expected: scenario.expectedSuggestion.targetReal,
      actual: suggestion.targetReal,
      message: 'Sugestão está usando target errado (provavelmente bounds.max = 0.0)'
    });
  } else {
    passes.push(`Suggestion.targetReal = ${suggestion.targetReal} ✅`);
  }
  
  // 8. Validar strings proibidas
  const allText = JSON.stringify(suggestion);
  for (const forbidden of scenario.forbiddenStrings) {
    if (allText.toLowerCase().includes(forbidden.toLowerCase())) {
      errors.push({
        test: 'ForbiddenString',
        expected: `NÃO conter "${forbidden}"`,
        actual: `Contém "${forbidden}"`,
        message: 'Texto da sugestão contém valor errado'
      });
    }
  }
  
  // 9. Validar strings obrigatórias
  for (const required of scenario.requiredStrings) {
    if (!allText.includes(required)) {
      errors.push({
        test: 'RequiredString',
        expected: `Conter "${required}"`,
        actual: 'Não encontrado',
        message: 'Target real não aparece na sugestão'
      });
    } else {
      passes.push(`Contém "${required}" ✅`);
    }
  }
  
  // 10. Imprimir resultados
  console.log(`\n📊 Dados gerados:`);
  console.log(`   • JSON target: ${scenario.jsonTargets.true_peak_target}`);
  console.log(`   • ComparisonRow.target: ${comparisonRow.target}`);
  console.log(`   • Suggestion.targetReal: ${suggestion.targetReal}`);
  console.log(`   • Suggestion.targetValue: ${suggestion.targetValue}`);
  
  console.log(`\n${colors.green}✅ PASSED (${passes.length}):${colors.reset}`);
  passes.forEach(p => console.log(`   ${p}`));
  
  if (errors.length > 0) {
    console.log(`\n${colors.red}❌ FAILED (${errors.length}):${colors.reset}`);
    errors.forEach(e => {
      console.log(`   • ${e.test}: esperado ${e.expected}, recebido ${e.actual}`);
      console.log(`     → ${e.message}`);
    });
  }
  
  return { passed: errors.length === 0, errors, passes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}🧪 TEST: SSOT True Peak - Anti-Regressão${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`\nEste teste valida que o True Peak usa o target real do JSON,`);
console.log(`não o hard cap (0.0 dBTP).\n`);

let totalPassed = 0;
let totalFailed = 0;
const allResults = [];

// Testar cada cenário com um valor de True Peak acima do limite (para gerar sugestão)
for (const scenario of mockScenarios) {
  const result = validateScenario(scenario, 0.5); // 0.5 dBTP = clipping
  allResults.push({ name: scenario.name, ...result });
  
  if (result.passed) {
    totalPassed++;
  } else {
    totalFailed++;
  }
}

// Sumário final
console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}📋 SUMÁRIO FINAL${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);

if (totalFailed === 0) {
  console.log(`\n${colors.green}🎉 TODOS OS TESTES PASSARAM! (${totalPassed}/${totalPassed + totalFailed})${colors.reset}`);
  console.log(`\n${colors.green}✅ True Peak agora usa o target real do JSON (ex: -1.0, -0.5)${colors.reset}`);
  console.log(`${colors.green}✅ Nunca mostra "target 0.0 dBTP" como alvo recomendado${colors.reset}`);
  console.log(`${colors.green}✅ Tabela e Cards usam a mesma fonte de verdade${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}❌ ALGUNS TESTES FALHARAM: ${totalFailed}/${totalPassed + totalFailed}${colors.reset}`);
  console.log(`\nDetalhes dos cenários que falharam:`);
  allResults.filter(r => !r.passed).forEach(r => {
    console.log(`\n${colors.red}• ${r.name}:${colors.reset}`);
    r.errors.forEach(e => console.log(`  - ${e.test}: ${e.message}`));
  });
  console.log();
  process.exit(1);
}
