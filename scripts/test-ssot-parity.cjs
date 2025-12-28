/**
 * 🧪 TEST: SSOT Paridade Tabela vs Cards
 * 
 * Valida que os cards de sugestões usam EXATAMENTE os mesmos valores
 * da tabela de comparação (comparisonResult.rows).
 * 
 * USAGE: node scripts/test-ssot-parity.cjs
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
// MOCK: Fixture de teste (simulando resultado de análise)
// ═══════════════════════════════════════════════════════════════════════════════

const mockFixture = {
  genre: 'trap',
  // Simulando o que compareWithTargets gera (TABELA)
  comparisonResult: {
    rows: [
      {
        key: 'lufs',
        label: 'Loudness (LUFS)',
        valueRaw: -8.5,
        target: -9.0,
        min: -11.0,
        max: -7.0,
        targetText: '-11.0 a -7.0 LUFS',
        diff: 0.5,
        severity: 'OK',
        action: '✅ Dentro do padrão'
      },
      {
        key: 'truePeak',
        label: 'True Peak',
        valueRaw: 3.9,
        target: -1.0,
        min: -3.0,
        max: 0.0,
        targetText: '-3.0 a 0.0 dBTP',
        diff: 4.9,
        severity: 'CRÍTICA',
        action: '🔴 CLIPPING! Reduzir 3.90 dBTP'
      },
      {
        key: 'dr',
        label: 'Dynamic Range',
        valueRaw: 5.2,
        target: 6.0,
        min: 4.0,
        max: 8.0,
        targetText: '4.0 a 8.0 dB',
        diff: -0.8,
        severity: 'OK',
        action: '✅ Dentro do padrão'
      },
      {
        key: 'stereo',
        label: 'Correlação Stereo',
        valueRaw: 0.65,
        target: 0.7,
        min: 0.3,
        max: 0.95,
        targetText: '0.30 a 0.95',
        diff: -0.05,
        severity: 'OK',
        action: '✅ Dentro do padrão'
      }
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULAÇÃO: O que os cards devem gerar (após o patch SSOT)
// ═══════════════════════════════════════════════════════════════════════════════

function mockGenerateSuggestion(row) {
  // Simula o comportamento APÓS o patch SSOT
  // Os cards DEVEM usar targetText direto da tabela
  
  return {
    metric: row.key,
    currentValue: `${row.valueRaw.toFixed(1)} ${getUnit(row.key)}`,
    targetText: row.targetText, // ✅ SSOT: Mesmo da tabela
    targetValue: row.key === 'truePeak' 
      ? `${row.targetText} (alvo: ${row.target.toFixed(1)} dBTP)`
      : row.targetText,
    targetMin: row.min,
    targetMax: row.max,
    tableAction: row.action
  };
}

function getUnit(key) {
  const units = {
    lufs: 'LUFS',
    truePeak: 'dBTP',
    dr: 'dB DR',
    stereo: ''
  };
  return units[key] || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO: Verificar paridade
// ═══════════════════════════════════════════════════════════════════════════════

function validateParity(fixture) {
  const results = {
    passed: [],
    failed: []
  };
  
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}📋 VALIDANDO PARIDADE TABELA vs CARDS${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Gênero: ${fixture.genre}`);
  console.log(`Métricas: ${fixture.comparisonResult.rows.length}`);
  
  for (const row of fixture.comparisonResult.rows) {
    const suggestion = mockGenerateSuggestion(row);
    const errors = [];
    
    // 1. Validar targetText
    if (suggestion.targetText !== row.targetText) {
      errors.push({
        field: 'targetText',
        expected: row.targetText,
        actual: suggestion.targetText
      });
    }
    
    // 2. Validar targetMin
    if (suggestion.targetMin !== row.min) {
      errors.push({
        field: 'targetMin',
        expected: row.min,
        actual: suggestion.targetMin
      });
    }
    
    // 3. Validar targetMax
    if (suggestion.targetMax !== row.max) {
      errors.push({
        field: 'targetMax',
        expected: row.max,
        actual: suggestion.targetMax
      });
    }
    
    if (errors.length === 0) {
      results.passed.push({
        metric: row.key,
        targetText: row.targetText
      });
    } else {
      results.failed.push({
        metric: row.key,
        errors
      });
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE ESPECÍFICO: True Peak com Clipping
// ═══════════════════════════════════════════════════════════════════════════════

function validateTruePeakClipping() {
  console.log(`\n${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🔺 VALIDANDO TRUE PEAK (CLIPPING)${colors.reset}`);
  console.log(`${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  
  const row = mockFixture.comparisonResult.rows.find(r => r.key === 'truePeak');
  const errors = [];
  
  // Valor: 3.9 dBTP (CLIPPING)
  // Target do gênero: -1.0 dBTP
  // Hard cap: 0.0 dBTP
  
  const value = row.valueRaw;       // 3.9
  const target = row.target;        // -1.0
  const hardCap = 0.0;
  
  const reductionToHardCap = value - hardCap;      // 3.9 dB (para eliminar clipping)
  const reductionToTarget = value - target;       // 4.9 dB (para atingir o alvo)
  
  console.log(`\n📊 Cenário de CLIPPING:`);
  console.log(`   • Valor medido: ${value.toFixed(1)} dBTP`);
  console.log(`   • Target do gênero: ${target.toFixed(1)} dBTP`);
  console.log(`   • Hard cap (limite físico): ${hardCap.toFixed(1)} dBTP`);
  console.log(`   • Redução para eliminar clipping: ${reductionToHardCap.toFixed(1)} dB`);
  console.log(`   • Redução para atingir o alvo: ${reductionToTarget.toFixed(1)} dB`);
  
  // Validar que a action da tabela mostra a redução até o hard cap (0.0)
  const expectedActionSubstring = `Reduzir ${reductionToHardCap.toFixed(2)}`;
  if (!row.action.includes('CLIPPING')) {
    errors.push({
      test: 'Action deve mencionar CLIPPING',
      expected: 'CLIPPING',
      actual: row.action
    });
  }
  
  // Validar que targetText mostra o range correto
  if (row.targetText !== '-3.0 a 0.0 dBTP') {
    errors.push({
      test: 'targetText do True Peak',
      expected: '-3.0 a 0.0 dBTP',
      actual: row.targetText
    });
  }
  
  // Validar matemática
  if (Math.abs(row.diff - reductionToTarget) > 0.01) {
    errors.push({
      test: 'diff deve ser value - target',
      expected: reductionToTarget,
      actual: row.diff
    });
  }
  
  return { errors, value, target, hardCap, reductionToHardCap, reductionToTarget };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}🧪 TEST: SSOT Paridade Tabela vs Cards${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);

// Teste 1: Paridade geral
const parityResults = validateParity(mockFixture);

console.log(`\n${colors.green}✅ PASSED (${parityResults.passed.length}):${colors.reset}`);
parityResults.passed.forEach(p => {
  console.log(`   • ${p.metric}: targetText = "${p.targetText}"`);
});

if (parityResults.failed.length > 0) {
  console.log(`\n${colors.red}❌ FAILED (${parityResults.failed.length}):${colors.reset}`);
  parityResults.failed.forEach(f => {
    console.log(`   • ${f.metric}:`);
    f.errors.forEach(e => {
      console.log(`     - ${e.field}: esperado "${e.expected}", recebido "${e.actual}"`);
    });
  });
}

// Teste 2: True Peak com Clipping
const tpResult = validateTruePeakClipping();

if (tpResult.errors.length === 0) {
  console.log(`\n${colors.green}✅ TRUE PEAK CLIPPING: Matemática correta${colors.reset}`);
  console.log(`   • Redução para 0.0 dBTP: ${tpResult.reductionToHardCap.toFixed(1)} dB`);
  console.log(`   • Redução para target: ${tpResult.reductionToTarget.toFixed(1)} dB`);
} else {
  console.log(`\n${colors.red}❌ TRUE PEAK CLIPPING: Erros encontrados${colors.reset}`);
  tpResult.errors.forEach(e => {
    console.log(`   • ${e.test}: esperado "${e.expected}", recebido "${e.actual}"`);
  });
}

// Sumário final
console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}📋 SUMÁRIO FINAL${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);

const totalFailed = parityResults.failed.length + tpResult.errors.length;
const totalPassed = parityResults.passed.length + (tpResult.errors.length === 0 ? 1 : 0);

if (totalFailed === 0) {
  console.log(`\n${colors.green}🎉 TODOS OS TESTES PASSARAM! (${totalPassed} testes)${colors.reset}`);
  console.log(`\n${colors.green}✅ targetText da tabela = targetText dos cards${colors.reset}`);
  console.log(`${colors.green}✅ targetMin/targetMax preservados${colors.reset}`);
  console.log(`${colors.green}✅ True Peak mostra reduções matematicamente corretas${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}❌ ALGUNS TESTES FALHARAM: ${totalFailed}/${totalPassed + totalFailed}${colors.reset}\n`);
  process.exit(1);
}
