// 🧪 TESTE DE VALIDAÇÃO: SYNC GATE TABELA ↔ SUGESTÕES
// Valida que o sync gate está funcionando corretamente

import { normalizeMetricKey, extractTableSeverityMap, filterSuggestionsByTableSeverity } from '../work/lib/audio/utils/table-suggestions-sync.js';

console.log('🧪 INICIANDO TESTES DO SYNC GATE\n');

// ═══════════════════════════════════════════════════════════════
// TESTE 1: Normalização de chaves
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 1: Normalização de chaves');
console.log('─'.repeat(60));

const testKeys = [
  ['lufsIntegrated', 'lufs'],
  ['truePeakDbtp', 'truePeak'],
  ['tt_dr', 'dr'],
  ['dr_stat', 'dr'],
  ['band_low_mid', 'band_low_mid'],
  ['lowMid', 'band_low_mid'],
  ['band_lowMid', 'band_low_mid'],
  ['sub', 'band_sub'],
  ['stereoCorrelation', 'stereoCorrelation']
];

let passedKeys = 0;
for (const [input, expected] of testKeys) {
  const result = normalizeMetricKey(input);
  const passed = result === expected;
  console.log(`  ${passed ? '✅' : '❌'} ${input} → ${result} ${!passed ? `(esperado: ${expected})` : ''}`);
  if (passed) passedKeys++;
}

console.log(`\n📊 Resultado: ${passedKeys}/${testKeys.length} testes passaram\n`);

// ═══════════════════════════════════════════════════════════════
// TESTE 2: Extração de mapa de severidade
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 2: Extração de mapa de severidade');
console.log('─'.repeat(60));

const mockPerMetric = [
  { key: 'lufsIntegrated', status: 'ALTO', severity: 'media', value: -12.5, target: -16.0, diff: 3.5 },
  { key: 'truePeakDbtp', status: 'ALTO', severity: 'alta', value: -0.5, target: -1.0, diff: 0.5 },
  { key: 'stereoCorrelation', status: 'OK', severity: null, value: 0.85, target: 0.80, diff: 0.05 },
  { key: 'band_sub', status: 'BAIXO', severity: 'leve', value: -32.0, target: -28.0, diff: -4.0 },
  { key: 'band_low_mid', status: 'OK', severity: null, value: -26.0, target: -26.0, diff: 0 }
];

const severityMap = extractTableSeverityMap(mockPerMetric);

console.log(`  Total de métricas: ${severityMap.size}`);
console.log(`  Métricas OK: ${Array.from(severityMap.values()).filter(v => v.level === 'ok').length}`);
console.log(`  Métricas não-OK: ${Array.from(severityMap.values()).filter(v => v.level !== 'ok').length}`);

console.log('\n  Detalhes:');
for (const [key, severity] of severityMap.entries()) {
  console.log(`    ${severity.level === 'ok' ? '🟢' : '🟡'} ${key}: ${severity.label} (${severity.status})`);
}

const expectedOk = 2;
const expectedNonOk = 3;
const actualOk = Array.from(severityMap.values()).filter(v => v.level === 'ok').length;
const actualNonOk = Array.from(severityMap.values()).filter(v => v.level !== 'ok').length;

console.log(`\n📊 Resultado: ${actualOk === expectedOk && actualNonOk === expectedNonOk ? '✅ PASSOU' : '❌ FALHOU'}`);
console.log(`  OK: ${actualOk}/${expectedOk} | Não-OK: ${actualNonOk}/${expectedNonOk}\n`);

// ═══════════════════════════════════════════════════════════════
// TESTE 3: Filtragem de sugestões
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 3: Filtragem de sugestões');
console.log('─'.repeat(60));

const mockSuggestions = [
  { metric: 'lufs', message: 'Loudness alto', severity: { level: 'warning' } },
  { metric: 'truePeak', message: 'True peak alto', severity: { level: 'critical' } },
  { metric: 'stereoCorrelation', message: 'Stereo OK', severity: { level: 'ok' } }, // DEVE SER REMOVIDA
  { metric: 'band_sub', message: 'Sub baixo', severity: { level: 'warning' } },
  { metric: 'band_low_mid', message: 'Low mid OK', severity: { level: 'ok' } } // DEVE SER REMOVIDA
];

console.log(`  Input: ${mockSuggestions.length} sugestões`);

const filtered = filterSuggestionsByTableSeverity(mockSuggestions, severityMap, 'test');

console.log(`  Output: ${filtered.length} sugestões`);

const expectedFiltered = 3; // lufs, truePeak, band_sub (sem as 2 OK)
const passed = filtered.length === expectedFiltered;

console.log(`\n📊 Resultado: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
console.log(`  Esperado: ${expectedFiltered} | Obtido: ${filtered.length}`);

console.log('\n  Sugestões filtradas:');
for (const sug of filtered) {
  console.log(`    ✅ ${sug.metric}: ${sug.severity.label}`);
}

// ═══════════════════════════════════════════════════════════════
// TESTE 4: Verificação de completude
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 TESTE 4: Verificação de completude');
console.log('─'.repeat(60));

const presentKeys = new Set(filtered.map(s => normalizeMetricKey(s.metric)));
const missingKeys = [];

for (const [key, severity] of severityMap.entries()) {
  if (severity.level !== 'ok' && !presentKeys.has(key)) {
    missingKeys.push(key);
  }
}

console.log(`  Métricas não-OK esperadas: 3 (lufs, truePeak, band_sub)`);
console.log(`  Sugestões presentes: ${presentKeys.size}`);
console.log(`  Métricas faltando: ${missingKeys.length}`);

const completeness = missingKeys.length === 0;
console.log(`\n📊 Resultado: ${completeness ? '✅ COMPLETUDE OK' : '❌ FALTAM SUGESTÕES'}`);

if (missingKeys.length > 0) {
  console.log(`  Métricas sem sugestão:`, missingKeys);
}

// ═══════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📊 RESUMO DOS TESTES');
console.log('═'.repeat(60));

const allPassed = passedKeys === testKeys.length && 
                  actualOk === expectedOk && 
                  actualNonOk === expectedNonOk &&
                  passed &&
                  completeness;

console.log(`
  Teste 1 - Normalização de chaves: ${passedKeys === testKeys.length ? '✅' : '❌'} (${passedKeys}/${testKeys.length})
  Teste 2 - Extração de severidade: ${actualOk === expectedOk && actualNonOk === expectedNonOk ? '✅' : '❌'}
  Teste 3 - Filtragem de sugestões: ${passed ? '✅' : '❌'}
  Teste 4 - Verificação completude: ${completeness ? '✅' : '❌'}
`);

console.log('═'.repeat(60));
console.log(`🎯 RESULTADO FINAL: ${allPassed ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);
console.log('═'.repeat(60));

process.exit(allPassed ? 0 : 1);
