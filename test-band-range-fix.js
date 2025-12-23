/**
 * 🧪 TEST: Validar correção do bug de target_range nas bandas
 * 
 * Cenário de teste:
 * - Banda "sub" com target_range: {min: -29, max: -23}
 * - Valor medido: -26 dB (DENTRO da faixa)
 * - Esperado: delta = 0, severity = OK, status = 'ok'
 * - Bug antigo: delta != 0, severity incorreto, status = 'high' ou 'low'
 */

import { ProblemsAndSuggestionsAnalyzerV2 } from './work/lib/audio/features/problems-suggestions-v2.js';

console.log('🧪 [TEST] Iniciando teste de correção do bug de target_range\n');

// Criar analyzer
const analyzer = new ProblemsAndSuggestionsAnalyzerV2('funk_automotivo');

// Simular consolidatedData com genreTargets contendo target_range
const consolidatedData = {
  metrics: {
    bands: {
      sub: {
        value: -26.0,  // Valor DENTRO da faixa [-29, -23]
        unit: 'dB'
      }
    }
  },
  genreTargets: {
    bands: {
      sub: {
        target_db: -26,
        target_range: { min: -29, max: -23 },
        tol_db: 0,
        energy_pct: 32.5,
        severity: 'soft'
      }
    }
  }
};

// Executar análise
const suggestions = [];
analyzer.analyzeBand('sub', -26.0, 'Sub Bass (20-60Hz)', suggestions, consolidatedData);

console.log('\n📊 [TEST] Resultado da análise:\n');

if (suggestions.length === 0) {
  console.error('❌ [TEST] FALHOU: Nenhuma sugestão gerada!');
  process.exit(1);
}

const suggestion = suggestions[0];

console.log('Sugestão gerada:', {
  metric: suggestion.metric,
  currentValue: suggestion.currentValue,
  targetValue: suggestion.targetValue,
  delta: suggestion.delta,
  deltaNum: suggestion.deltaNum,
  status: suggestion.status,
  severity: suggestion.severity.label
});

// Validações
const tests = [
  {
    name: 'Delta deve ser 0 (valor dentro do range)',
    condition: suggestion.deltaNum === 0,
    actual: suggestion.deltaNum,
    expected: 0
  },
  {
    name: 'Status deve ser "ok" (não "high" ou "low")',
    condition: suggestion.status === 'ok',
    actual: suggestion.status,
    expected: 'ok'
  },
  {
    name: 'Severity deve ser OK/Ideal',
    condition: suggestion.severity.level === 'ok' || suggestion.severity.level === 'ideal',
    actual: suggestion.severity.level,
    expected: 'ok ou ideal'
  },
  {
    name: 'targetValue deve mostrar range "X a Y dB"',
    condition: suggestion.targetValue.includes('a') && suggestion.targetValue.includes('-29') && suggestion.targetValue.includes('-23'),
    actual: suggestion.targetValue,
    expected: '-29.0 a -23.0 dB'
  },
  {
    name: 'Delta text deve indicar "dentro do range"',
    condition: suggestion.delta.includes('dentro do range'),
    actual: suggestion.delta,
    expected: 'texto contendo "dentro do range"'
  }
];

let passed = 0;
let failed = 0;

console.log('\n🔍 [TEST] Executando validações:\n');

tests.forEach((test, index) => {
  const result = test.condition ? '✅ PASSOU' : '❌ FALHOU';
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   ${result}`);
  console.log(`   Esperado: ${test.expected}`);
  console.log(`   Obtido: ${test.actual}`);
  console.log('');
  
  if (test.condition) {
    passed++;
  } else {
    failed++;
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 [TEST] Resultado final: ${passed}/${tests.length} testes passaram`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
  console.error(`❌ [TEST] ${failed} teste(s) falharam!`);
  process.exit(1);
} else {
  console.log('✅ [TEST] Todos os testes passaram! Correção validada.');
  process.exit(0);
}
