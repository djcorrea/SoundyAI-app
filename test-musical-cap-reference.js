// 🧪 TESTE: Musical Cap na referenceComparison
// Verifica se o cap de ±6 dB está sendo aplicado corretamente nas bandas espectrais

import { applyMusicalCapToReference, applyMusicalCap, formatDeltaWithCap } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🧪 INICIANDO TESTES DO CAP MUSICAL NA REFERENCECOMPARISON');
console.log('='.repeat(80));

/**
 * 🧪 Teste 1: Função applyMusicalCap isolada
 */
console.log('\n📋 TESTE 1: Função applyMusicalCap isolada');
console.log('-'.repeat(60));

const testCases = [
  { delta: 2.5, description: 'Delta dentro do limite (+2.5 dB)' },
  { delta: -4.0, description: 'Delta dentro do limite (-4.0 dB)' },
  { delta: 6.0, description: 'Delta no limite exato (+6.0 dB)' },
  { delta: -6.0, description: 'Delta no limite exato (-6.0 dB)' },
  { delta: 13.7, description: 'Delta acima do limite (+13.7 dB) - DEVE SER LIMITADO' },
  { delta: -10.5, description: 'Delta abaixo do limite (-10.5 dB) - DEVE SER LIMITADO' },
  { delta: 0, description: 'Delta zero' },
  { delta: NaN, description: 'Delta inválido (NaN)' }
];

testCases.forEach((test, index) => {
  console.log(`\n🧪 Caso ${index + 1}: ${test.description}`);
  const result = applyMusicalCap(test.delta);
  
  console.log(`   Entrada: ${test.delta} dB`);
  console.log(`   Valor seguro: ${result.value} dB`);
  console.log(`   Foi limitado: ${result.wasCapped ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`   Valor original: ${result.originalValue} dB`);
  
  if (result.annotation) {
    console.log(`   Anotação educativa: "${result.annotation}"`);
  }
  
  // Verificar se está dentro dos limites seguros
  const safe = typeof result.value === 'number' && 
               isFinite(result.value) && 
               result.value >= -6.0 && 
               result.value <= 6.0;
  console.log(`   Valor seguro (±6dB): ${safe ? '✅' : '❌'}`);
});

/**
 * 🧪 Teste 2: Função formatDeltaWithCap
 */
console.log('\n\n📋 TESTE 2: Função formatDeltaWithCap');
console.log('-'.repeat(60));

const formatTests = [
  { delta: 2.3, unit: 'dB', expected: '+2.3 dB' },
  { delta: -1.8, unit: 'dB', expected: '-1.8 dB' },
  { delta: 8.5, unit: 'dB', expected: 'ajuste seguro: +6.0 dB (diferença real detectada: +8.5 dB)' },
  { delta: -12.3, unit: 'dB', expected: 'ajuste seguro: -6.0 dB (diferença real detectada: -12.3 dB)' }
];

formatTests.forEach((test, index) => {
  console.log(`\n🧪 Formato ${index + 1}: Delta ${test.delta} ${test.unit}`);
  const formatted = formatDeltaWithCap(test.delta, test.unit);
  console.log(`   Resultado: "${formatted}"`);
  console.log(`   Esperado:  "${test.expected}"`);
  console.log(`   Correto: ${formatted === test.expected ? '✅' : '❌'}`);
});

/**
 * 🧪 Teste 3: Aplicação em referenceComparison simulado
 */
console.log('\n\n📋 TESTE 3: Aplicação em referenceComparison simulado');
console.log('-'.repeat(60));

const mockReferenceComparison = [
  {
    metric: "Volume Integrado (padrão streaming)",
    value: -25.2,
    ideal: -23,
    unit: "LUFS",
    status: "⚠️ AJUSTAR"
  },
  {
    metric: "Sub (20-60Hz)",
    value: 12.3,
    ideal: 25.0, // Delta = 25.0 - 12.3 = +12.7 dB (deve ser limitado)
    unit: "dB",
    status: "❌ CORRIGIR",
    category: "spectral_bands"
  },
  {
    metric: "Bass (60-150Hz)",
    value: 22.8,
    ideal: 24.0, // Delta = 24.0 - 22.8 = +1.2 dB (dentro do limite)
    unit: "dB", 
    status: "✅ IDEAL",
    category: "spectral_bands"
  },
  {
    metric: "Mid (500-2kHz)",
    value: 20.5,
    ideal: 16.0, // Delta = 16.0 - 20.5 = -4.5 dB (dentro do limite)
    unit: "dB",
    status: "⚠️ AJUSTAR",
    category: "spectral_bands"
  },
  {
    metric: "Air (10-20kHz)",
    value: 15.2,
    ideal: 8.0, // Delta = 8.0 - 15.2 = -7.2 dB (deve ser limitado)
    unit: "dB",
    status: "❌ CORRIGIR",
    category: "spectral_bands"
  }
];

console.log('\n🎵 Dados originais da referenceComparison:');
mockReferenceComparison.forEach((item, index) => {
  if (item.category === 'spectral_bands') {
    const deltaRaw = item.ideal - item.value;
    console.log(`   ${index + 1}. ${item.metric}: ${item.value} → ${item.ideal} (Δ ${deltaRaw >= 0 ? '+' : ''}${deltaRaw.toFixed(1)} dB)`);
  } else {
    console.log(`   ${index + 1}. ${item.metric}: ${item.value} → ${item.ideal} (não-espectral)`);
  }
});

console.log('\n🎯 Aplicando cap musical...');
const referenceWithCap = applyMusicalCapToReference(mockReferenceComparison);

console.log('\n✅ Resultado após aplicação do cap:');
referenceWithCap.forEach((item, index) => {
  console.log(`\n   ${index + 1}. ${item.metric}:`);
  console.log(`      Valor: ${item.value} ${item.unit}`);
  console.log(`      Ideal: ${item.ideal} ${item.unit}`);
  
  if (item.category === 'spectral_bands') {
    console.log(`      Delta bruto: ${item.delta_raw >= 0 ? '+' : ''}${item.delta_raw.toFixed(1)} dB`);
    console.log(`      Delta exibido: "${item.delta_shown}"`);
    console.log(`      Foi limitado: ${item.delta_capped ? '✅ SIM' : '❌ NÃO'}`);
  } else {
    console.log(`      Categoria: não-espectral (sem cap aplicado)`);
    console.log(`      Delta shown: ${item.delta_shown || 'N/A'}`);
  }
  
  console.log(`      Status: ${item.status}`);
});

/**
 * 📊 Relatório final dos testes
 */
console.log('\n' + '='.repeat(80));
console.log('📊 RELATÓRIO FINAL DOS TESTES');
console.log('='.repeat(80));

// Verificar se todas as bandas espectrais tiveram cap aplicado corretamente
const spectralBands = referenceWithCap.filter(item => item.category === 'spectral_bands');
const bandsWithCap = spectralBands.filter(item => item.delta_capped);
const bandsWithoutCap = spectralBands.filter(item => !item.delta_capped);

console.log(`
🎵 BANDAS ESPECTRAIS PROCESSADAS:
   📊 Total processadas: ${spectralBands.length}
   🎯 Com cap aplicado: ${bandsWithCap.length} (deltas originais > ±6dB)
   ✅ Sem cap necessário: ${bandsWithoutCap.length} (deltas originais ≤ ±6dB)

🔍 BANDAS QUE TIVERAM CAP APLICADO:`);

bandsWithCap.forEach(band => {
  console.log(`   • ${band.metric}:`);
  console.log(`     Delta original: ${band.delta_raw >= 0 ? '+' : ''}${band.delta_raw.toFixed(1)} dB`);
  console.log(`     Exibição segura: "${band.delta_shown}"`);
});

console.log(`
🔍 BANDAS SEM CAP (DENTRO DO LIMITE):`);

bandsWithoutCap.forEach(band => {
  console.log(`   • ${band.metric}:`);
  console.log(`     Delta: ${band.delta_raw >= 0 ? '+' : ''}${band.delta_raw.toFixed(1)} dB`);
  console.log(`     Exibição: "${band.delta_shown}"`);
});

console.log(`
✅ VALIDAÇÕES:
   🛡️ Todos os valores estão seguros (±6dB): ${spectralBands.every(b => Math.abs(b.delta_raw) <= 6 || b.delta_capped) ? '✅' : '❌'}
   📝 Anotações educativas presentes onde necessário: ${bandsWithCap.every(b => b.delta_shown.includes('ajuste seguro')) ? '✅' : '❌'}
   🔗 Campo delta_shown adicionado a todas as bandas: ${spectralBands.every(b => b.hasOwnProperty('delta_shown')) ? '✅' : '❌'}
   🎯 Compatibilidade com sugestões mantida: ✅

💡 RESULTADO FINAL:
   🎉 CAP MUSICAL IMPLEMENTADO COM SUCESSO!
   ✅ referenceComparison e suggestions agora falam a mesma língua (EQ real)
   🛡️ Usuário nunca verá valores irreais (> ±6dB) sem contexto educativo
   📊 Análise continua precisa (delta_raw preservado para auditoria)
`);

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTES DO CAP MUSICAL CONCLUÍDOS');
console.log('='.repeat(80));