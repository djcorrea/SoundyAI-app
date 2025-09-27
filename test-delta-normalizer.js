// 🧪 TESTES DE VALIDAÇÃO: Delta Normalizer - Etapa 1
// Validação completa da normalização de deltas espectrais

import { 
  normalizeDelta, 
  normalizeSpectralDeltas, 
  isNormalizedDeltaSafe,
  getDeltaNormalizationReport,
  DELTA_NORMALIZER_CONFIG 
} from './lib/audio/features/delta-normalizer.js';

console.log('🧪 INICIANDO TESTES DE VALIDAÇÃO DO DELTA NORMALIZER');
console.log('='.repeat(80));

/**
 * 🎯 Casos de teste baseados nos exemplos fornecidos
 */
const testCases = [
  {
    name: 'Exemplo 1: Delta insignificante',
    input: 0.3,
    expected: 0,
    description: 'Delta +0.3 dB deve ser ignorado (< 0.5 dB)'
  },
  {
    name: 'Exemplo 2: Ajuste leve negativo',
    input: -1.5,
    expected: -1.5,
    description: 'Delta -1.5 dB deve ser preservado integral (0.5-2 dB)'
  },
  {
    name: 'Exemplo 3: Compressão suave positiva',
    input: 4.2,
    expected: 3.36, // 4.2 * 0.8 = 3.36
    description: 'Delta +4.2 dB deve ser comprimido para +3.36 dB (soft-knee 0.8x)'
  },
  {
    name: 'Exemplo 4: Cap máximo negativo',
    input: -12,
    expected: -6,
    description: 'Delta -12 dB deve ser limitado a -6 dB (cap máximo)'
  }
];

/**
 * 🎯 Casos de teste adicionais para cobertura completa
 */
const additionalTests = [
  // Testes de limites exatos
  { name: 'Limite exato 0.5 dB', input: 0.5, expected: 0.5 },
  { name: 'Limite exato -0.5 dB', input: -0.5, expected: -0.5 },
  { name: 'Limite exato 2.0 dB', input: 2.0, expected: 1.6 }, // 2.0 * 0.8
  { name: 'Limite exato -2.0 dB', input: -2.0, expected: -1.6 }, // -2.0 * 0.8
  { name: 'Limite exato 6.0 dB', input: 6.0, expected: 6.0 }, // Cap positivo
  { name: 'Limite exato -6.0 dB', input: -6.0, expected: -6.0 },
  
  // Casos extremos
  { name: 'Zero exato', input: 0, expected: 0 },
  { name: 'Delta muito pequeno', input: 0.1, expected: 0 },
  { name: 'Delta muito grande positivo', input: 50, expected: 6 },
  { name: 'Delta muito grande negativo', input: -100, expected: -6 },
  
  // Casos de erro
  { name: 'NaN', input: NaN, expected: 0 },
  { name: 'Infinity', input: Infinity, expected: 0 },
  { name: 'Negative Infinity', input: -Infinity, expected: 0 }
];

/**
 * 🧪 Executar teste individual
 */
function runSingleTest(testCase, isMainExample = false) {
  console.log(`\n${isMainExample ? '🎯' : '🔍'} TESTE: ${testCase.name}`);
  console.log('-'.repeat(60));
  
  const result = normalizeDelta(testCase.input);
  const tolerance = 0.01; // Tolerância para comparação de float
  const passed = Math.abs(result - testCase.expected) < tolerance;
  
  // Gerar relatório detalhado
  const report = getDeltaNormalizationReport(testCase.input, result);
  
  console.log(`   Entrada: ${testCase.input} dB`);
  console.log(`   Esperado: ${testCase.expected} dB`);
  console.log(`   Resultado: ${result} dB`);
  console.log(`   ${report.rule} → ${report.action}`);
  console.log(`   Redução aplicada: ${report.reduction} dB`);
  console.log(`   Seguro: ${report.safe ? '✅' : '❌'}`);
  console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  if (testCase.description) {
    console.log(`   📝 ${testCase.description}`);
  }
  
  if (!passed) {
    console.log(`   ⚠️ DIVERGÊNCIA: Diferença de ${Math.abs(result - testCase.expected).toFixed(3)} dB`);
  }
  
  return passed;
}

/**
 * 🧪 Executar todos os testes principais (exemplos fornecidos)
 */
console.log('\n📋 EXECUTANDO TESTES PRINCIPAIS (EXEMPLOS FORNECIDOS)');
console.log('='.repeat(80));

let mainTestsPassed = 0;
let mainTestsTotal = testCases.length;

testCases.forEach(testCase => {
  const passed = runSingleTest(testCase, true);
  if (passed) mainTestsPassed++;
});

/**
 * 🧪 Executar testes adicionais
 */
console.log('\n📋 EXECUTANDO TESTES ADICIONAIS (COBERTURA COMPLETA)');
console.log('='.repeat(80));

let additionalTestsPassed = 0;
let additionalTestsTotal = additionalTests.length;

additionalTests.forEach(testCase => {
  const passed = runSingleTest(testCase, false);
  if (passed) additionalTestsPassed++;
});

/**
 * 🧪 Teste de processamento de múltiplas bandas
 */
console.log('\n📋 TESTE DE MÚLTIPLAS BANDAS ESPECTRAIS');
console.log('='.repeat(80));

const spectralDeltas = {
  sub: -12.0,    // Deve virar -6.0 (cap)
  bass: 4.2,     // Deve virar 3.36 (soft-knee)
  lowMid: -1.5,  // Deve permanecer -1.5 (leve)
  mid: 0.3,      // Deve virar 0 (insignificante)
  highMid: 2.8,  // Deve virar 2.24 (soft-knee)
  presence: 8.5, // Deve virar 6.0 (cap)
  air: -0.8      // Deve permanecer -0.8 (leve)
};

const expectedResults = {
  sub: -6.0,
  bass: 3.36,
  lowMid: -1.5,
  mid: 0,
  highMid: 2.24, // 2.8 * 0.8
  presence: 6.0,
  air: -0.8
};

console.log('\n🎵 Processando deltas de todas as bandas espectrais...');
const normalizedBands = normalizeSpectralDeltas(spectralDeltas);

let bandsTestPassed = 0;
let bandsTestTotal = Object.keys(spectralDeltas).length;

for (const [band, originalDelta] of Object.entries(spectralDeltas)) {
  const normalizedDelta = normalizedBands[band];
  const expected = expectedResults[band];
  const tolerance = 0.01;
  const passed = Math.abs(normalizedDelta - expected) < tolerance;
  
  console.log(`   ${band.toUpperCase()}: ${originalDelta} dB → ${normalizedDelta} dB (esperado: ${expected} dB) ${passed ? '✅' : '❌'}`);
  
  if (passed) bandsTestPassed++;
}

/**
 * 🧪 Teste de validação de segurança
 */
console.log('\n📋 TESTE DE VALIDAÇÃO DE SEGURANÇA');
console.log('='.repeat(80));

const safetyTestValues = [-6.0, -3.2, 0, 2.1, 6.0, -7.0, 8.5];
let safetyTestsPassed = 0;

safetyTestValues.forEach(value => {
  const safe = isNormalizedDeltaSafe(value);
  const expectedSafe = value >= -6.0 && value <= 6.0;
  const passed = safe === expectedSafe;
  
  console.log(`   ${value} dB → Seguro: ${safe} (esperado: ${expectedSafe}) ${passed ? '✅' : '❌'}`);
  
  if (passed) safetyTestsPassed++;
});

/**
 * 📊 Relatório final dos testes
 */
console.log('\n' + '='.repeat(80));
console.log('📊 RELATÓRIO FINAL DOS TESTES');
console.log('='.repeat(80));

const totalTests = mainTestsTotal + additionalTestsTotal + bandsTestTotal + safetyTestValues.length;
const totalPassed = mainTestsPassed + additionalTestsPassed + bandsTestPassed + safetyTestsPassed;

console.log(`
🎯 TESTES PRINCIPAIS (Exemplos fornecidos):
   ✅ Passou: ${mainTestsPassed}/${mainTestsTotal} (${((mainTestsPassed/mainTestsTotal)*100).toFixed(1)}%)
   ${mainTestsPassed === mainTestsTotal ? '✅ TODOS OS EXEMPLOS FUNCIONANDO!' : '❌ ALGUNS EXEMPLOS FALHARAM!'}

🔍 TESTES ADICIONAIS (Cobertura completa):
   ✅ Passou: ${additionalTestsPassed}/${additionalTestsTotal} (${((additionalTestsPassed/additionalTestsTotal)*100).toFixed(1)}%)

🎵 TESTE DE MÚLTIPLAS BANDAS:
   ✅ Passou: ${bandsTestPassed}/${bandsTestTotal} (${((bandsTestPassed/bandsTestTotal)*100).toFixed(1)}%)

🛡️ TESTES DE SEGURANÇA:
   ✅ Passou: ${safetyTestsPassed}/${safetyTestValues.length} (${((safetyTestsPassed/safetyTestValues.length)*100).toFixed(1)}%)

📊 RESULTADO GERAL:
   ✅ Total passou: ${totalPassed}/${totalTests} (${((totalPassed/totalTests)*100).toFixed(1)}%)
   ${totalPassed === totalTests ? '🎉 TODOS OS TESTES PASSARAM!' : '⚠️ ALGUNS TESTES FALHARAM!'}
`);

/**
 * 📋 Validação das configurações
 */
console.log('\n📋 VALIDAÇÃO DAS CONFIGURAÇÕES');
console.log('='.repeat(80));

console.log('🔧 Configurações do Delta Normalizer:');
Object.entries(DELTA_NORMALIZER_CONFIG).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`);
});

/**
 * 🎯 Verificações de integridade
 */
console.log('\n🎯 VERIFICAÇÕES DE INTEGRIDADE');
console.log('='.repeat(80));

const integrityChecks = [
  {
    name: 'Thresholds em ordem crescente',
    check: () => DELTA_NORMALIZER_CONFIG.INSIGNIFICANT_THRESHOLD < 
                 DELTA_NORMALIZER_CONFIG.LIGHT_ADJUSTMENT_THRESHOLD &&
                 DELTA_NORMALIZER_CONFIG.LIGHT_ADJUSTMENT_THRESHOLD < 
                 DELTA_NORMALIZER_CONFIG.SOFT_KNEE_THRESHOLD
  },
  {
    name: 'Soft-knee factor entre 0 e 1',
    check: () => DELTA_NORMALIZER_CONFIG.SOFT_KNEE_FACTOR > 0 && 
                 DELTA_NORMALIZER_CONFIG.SOFT_KNEE_FACTOR < 1
  },
  {
    name: 'Limites seguros simétricos',
    check: () => Math.abs(DELTA_NORMALIZER_CONFIG.MIN_SAFE_DELTA) === 
                 DELTA_NORMALIZER_CONFIG.MAX_SAFE_DELTA
  },
  {
    name: 'Cap máximo igual aos limites seguros',
    check: () => DELTA_NORMALIZER_CONFIG.MAX_DELTA_CAP === 
                 DELTA_NORMALIZER_CONFIG.MAX_SAFE_DELTA
  }
];

let integrityPassed = 0;
integrityChecks.forEach(check => {
  const passed = check.check();
  console.log(`   ${check.name}: ${passed ? '✅' : '❌'}`);
  if (passed) integrityPassed++;
});

console.log(`\n🔍 Integridade: ${integrityPassed}/${integrityChecks.length} verificações passaram`);

if (totalPassed === totalTests && integrityPassed === integrityChecks.length) {
  console.log('\n🎉 DELTA NORMALIZER VALIDADO COM SUCESSO!');
  console.log('✅ Pronto para integração no pipeline espectral');
} else {
  console.log('\n⚠️ DELTA NORMALIZER PRECISA DE AJUSTES');
  console.log('❌ Corrija os testes falhando antes da integração');
}

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTES DE VALIDAÇÃO CONCLUÍDOS');
console.log('='.repeat(80));