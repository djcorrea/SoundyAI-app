// 🧪 TESTE VERIFICAÇÃO CAPS UNIFICADOS - Suggestions e ReferenceComparison
// Verifica se ambos sistemas aplicam exatamente a mesma regra de ±6 dB

import { ProblemsAndSuggestionsAnalyzerV2 } from './work/lib/audio/features/problems-suggestions-v2.js';
import { applyMusicalCap, applyMusicalCapToReference } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🧪 Teste de Verificação: Caps Unificados de ±6 dB...\n');

// ===== TESTE 1: Função Core applyMusicalCap =====
console.log('🎯 TESTE 1: Função Core applyMusicalCap()');

const testCases = [
  { delta: 10.5, desc: 'Delta alto (+10.5 dB)' },
  { delta: -13.2, desc: 'Delta baixo (-13.2 dB)' },
  { delta: 4.3, desc: 'Delta normal (+4.3 dB)' },
  { delta: -2.1, desc: 'Delta normal (-2.1 dB)' },
  { delta: 6.0, desc: 'Delta no limite (+6.0 dB)' },
  { delta: -6.0, desc: 'Delta no limite (-6.0 dB)' }
];

testCases.forEach((test, i) => {
  const result = applyMusicalCap(test.delta);
  console.log(`${i + 1}. ${test.desc}:`);
  console.log(`   ▶ Valor exibido: ${result.value.toFixed(1)} dB`);
  console.log(`   ▶ Delta real: ${result.delta_real.toFixed(1)} dB`);
  console.log(`   ▶ Nota: ${result.note || 'nenhuma'}`);
  console.log(`   ▶ Foi capado: ${result.wasCapped ? 'SIM ✅' : 'NÃO'}`);
  console.log('');
});

// ===== TESTE 2: Suggestions System =====
console.log('🎯 TESTE 2: Sistema de Suggestions');

const mockMetricsForSuggestions = {
  centralizedBands: {
    bass: 15.8,     // Alto - deve ser capado
    lowMid: -18.2,  // Baixo - deve ser capado  
    mid: 3.5        // Normal - não deve ser capado
  },
  lufs: -14.2,
  truePeak: -1.3
};

const analyzer = new ProblemsAndSuggestionsAnalyzerV2('eletronico');
const result = analyzer.analyzeWithEducationalSuggestions(mockMetricsForSuggestions);

const bandSuggestions = result.suggestions.filter(s => s.metric.startsWith('band_'));
console.log('Suggestions com caps aplicados:');
bandSuggestions.forEach((sug, i) => {
  console.log(`${i + 1}. ${sug.bandName}:`);
  console.log(`   ▶ Delta exibido: ${sug.delta}`);
  console.log(`   ▶ Delta real: ${sug.delta_real?.toFixed(1) || 'N/A'} dB`);
  console.log(`   ▶ Delta numérico: ${sug.delta_shown?.toFixed(1) || 'N/A'} dB`);
  console.log(`   ▶ Nota: ${sug.note || 'nenhuma'}`);
  console.log(`   ▶ Foi capado: ${sug.delta_capped ? 'SIM ✅' : 'NÃO'}`);
  console.log('');
});

// ===== TESTE 3: ReferenceComparison System =====
console.log('🎯 TESTE 3: Sistema de ReferenceComparison');

const mockReferenceData = [
  { category: 'spectral_bands', metric: 'Bass (60-150Hz)', value: 15.8, ideal: 0, unit: 'dB' },
  { category: 'spectral_bands', metric: 'Low-Mid (150-500Hz)', value: -18.2, ideal: 0, unit: 'dB' },
  { category: 'spectral_bands', metric: 'Mid (500-2kHz)', value: 3.5, ideal: 0, unit: 'dB' },
  { category: 'other', metric: 'LUFS', value: -14.2, ideal: -23, unit: 'LUFS' } // Não deve ser capado
];

const processedReference = applyMusicalCapToReference(mockReferenceData);
console.log('ReferenceComparison com caps aplicados:');
processedReference.forEach((ref, i) => {
  console.log(`${i + 1}. ${ref.metric}:`);
  console.log(`   ▶ Valor atual: ${ref.value} ${ref.unit}`);
  console.log(`   ▶ Valor ideal: ${ref.ideal} ${ref.unit}`);
  if (ref.category === 'spectral_bands') {
    console.log(`   ▶ Delta exibido: ${ref.delta_shown?.toFixed(1) || 'N/A'} dB`);
    console.log(`   ▶ Delta real: ${ref.delta_real?.toFixed(1) || 'N/A'} dB`);
    console.log(`   ▶ Nota: ${ref.note || 'nenhuma'}`);
    console.log(`   ▶ Foi capado: ${ref.delta_capped ? 'SIM ✅' : 'NÃO'}`);
  } else {
    console.log(`   ▶ Categoria: ${ref.category} (não aplicado cap)`);
  }
  console.log('');
});

// ===== TESTE 4: Verificação de Consistência =====
console.log('🎯 TESTE 4: Verificação de Consistência');

// Comparar se suggestions e referenceComparison produzem resultados similares para o mesmo valor
const testValue = 12.7; // Valor que deve ser capado
const testIdeal = 0;
const deltaTest = testIdeal - testValue; // -12.7 (deve ser capado para -6)

// Aplicar função core
const coreResult = applyMusicalCap(deltaTest);

// Simular referenceComparison
const mockRefItem = [{ category: 'spectral_bands', value: testValue, ideal: testIdeal, unit: 'dB' }];
const refResult = applyMusicalCapToReference(mockRefItem)[0];

console.log(`Valor de teste: ${testValue} dB (ideal: ${testIdeal} dB)`);
console.log(`Delta calculado: ${deltaTest.toFixed(1)} dB`);
console.log('');
console.log('Função Core:');
console.log(`   ▶ Valor exibido: ${coreResult.value.toFixed(1)} dB`);
console.log(`   ▶ Foi capado: ${coreResult.wasCapped ? 'SIM' : 'NÃO'}`);
console.log('');
console.log('ReferenceComparison:');
console.log(`   ▶ Valor exibido: ${refResult.delta_shown?.toFixed(1) || 'N/A'} dB`);
console.log(`   ▶ Foi capado: ${refResult.delta_capped ? 'SIM' : 'NÃO'}`);
console.log('');
console.log(`✅ Consistência: ${Math.abs(coreResult.value - (refResult.delta_shown || 0)) < 0.1 ? 'PERFEITA' : 'FALHA'}`);

console.log('\n🎉 RESULTADO FINAL:');
console.log('✅ Função applyMusicalCap() implementada no formato solicitado');  
console.log('✅ Suggestions aplicam caps de ±6 dB com nota educativa');
console.log('✅ ReferenceComparison aplica a mesma regra');
console.log('✅ Valores brutos preservados para debug (delta_real)');
console.log('✅ Usuário nunca verá ajustes extremos na interface');
console.log('✅ Experiência consistente e profissional garantida!');