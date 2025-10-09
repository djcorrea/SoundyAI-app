// 🎯 TESTE DE TOLERÂNCIAS DE DINÂMICA (LU RANGE) POR GÊNERO MUSICAL
// Valida se as especificações do usuário foram implementadas corretamente

import { ProblemsAndSuggestionsAnalyzerV2 } from '../work/lib/audio/features/problems-suggestions-v2.js';

/**
 * 🧪 CENÁRIOS DE TESTE - Dynamic Range por Gênero
 */
const TEST_SCENARIOS = [
  // 🎭 FUNK MANDELA - 8 LU target, ≤15 LU aceitável
  {
    genre: 'funk_mandela',
    expected: { target: 8.0, tolerance: 7.0 },
    testValues: [
      { dr: 8.0, expectedLevel: 'ideal', description: 'Target exato' },
      { dr: 8.2, expectedLevel: 'ideal', description: 'Dentro de 30% da tolerância' },
      { dr: 12.0, expectedLevel: 'ajuste_leve', description: 'Dentro da tolerância' },
      { dr: 15.0, expectedLevel: 'ajuste_leve', description: 'Limite da tolerância' },
      { dr: 16.0, expectedLevel: 'corrigir', description: 'Fora da tolerância' },
      { dr: 4.0, expectedLevel: 'corrigir', description: 'Muito baixo' }
    ]
  },
  
  // 🚗 FUNK AUTOMOTIVO - ≤14 LU aceitável (target: 8, tolerance: 6)
  {
    genre: 'funk_automotivo',
    expected: { target: 8.0, tolerance: 6.0 },
    testValues: [
      { dr: 8.0, expectedLevel: 'ideal', description: 'Target exato' },
      { dr: 14.0, expectedLevel: 'ajuste_leve', description: 'Limite aceitável' },
      { dr: 15.0, expectedLevel: 'corrigir', description: 'Acima do aceitável' }
    ]
  },
  
  // 🎹 ELETRÔNICO - 6 LU target, ≤9 LU aceitável  
  {
    genre: 'eletronico',
    expected: { target: 6.0, tolerance: 3.0 },
    testValues: [
      { dr: 6.0, expectedLevel: 'ideal', description: 'Target exato' },
      { dr: 6.8, expectedLevel: 'ideal', description: 'Dentro de 30% da tolerância' },
      { dr: 9.0, expectedLevel: 'ajuste_leve', description: 'Limite aceitável' },
      { dr: 10.0, expectedLevel: 'corrigir', description: 'Acima do aceitável' },
      { dr: 3.0, expectedLevel: 'corrigir', description: 'Muito baixo' }
    ]
  },
  
  // 🎶 TRANCE - ≤10 LU aceitável (target: 7, tolerance: 3)
  {
    genre: 'trance',
    expected: { target: 7.0, tolerance: 3.0 },
    testValues: [
      { dr: 7.0, expectedLevel: 'ideal', description: 'Target exato' },
      { dr: 10.0, expectedLevel: 'ajuste_leve', description: 'Limite aceitável' },
      { dr: 11.0, expectedLevel: 'corrigir', description: 'Acima do aceitável' }
    ]
  }
];

/**
 * 🔬 Executar Testes de Validação
 */
async function runDynamicRangeToleranceTests() {
  console.log('🎯 === TESTE DE TOLERÂNCIAS DE DINÂMICA POR GÊNERO ===\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`🎵 Testando gênero: ${scenario.genre.toUpperCase()}`);
    console.log(`   Target: ${scenario.expected.target} LU, Tolerance: ${scenario.expected.tolerance} LU`);
    
    // Criar analyzer para o gênero
    const analyzer = new ProblemsAndSuggestionsAnalyzerV2(scenario.genre);
    
    // Verificar se os thresholds estão corretos
    const actualThreshold = analyzer.thresholds.dr;
    if (actualThreshold.target !== scenario.expected.target || 
        actualThreshold.tolerance !== scenario.expected.tolerance) {
      console.log(`   ❌ CONFIGURAÇÃO INCORRETA:`);
      console.log(`      Esperado: target=${scenario.expected.target}, tolerance=${scenario.expected.tolerance}`);
      console.log(`      Atual: target=${actualThreshold.target}, tolerance=${actualThreshold.tolerance}`);
      continue;
    }
    
    console.log(`   ✅ Configuração correta no analyzer`);
    
    // Testar cada valor de dynamic range
    for (const testCase of scenario.testValues) {
      totalTests++;
      
      // Simular métricas de áudio com apenas dynamic range
      const mockMetrics = {
        dynamics: {
          dynamicRange: testCase.dr
        }
      };
      
      try {
        // Executar análise
        const result = analyzer.analyzeWithEducationalSuggestions(mockMetrics);
        
        // Encontrar sugestão de dynamic range
        const drSuggestion = result.suggestions.find(s => s.metric === 'dynamicRange');
        
        if (!drSuggestion) {
          failedTests.push({
            genre: scenario.genre,
            dr: testCase.dr,
            expected: testCase.expectedLevel,
            actual: 'não encontrado',
            description: testCase.description
          });
          console.log(`   ❌ ${testCase.description}: Sugestão não encontrada`);
          continue;
        }
        
        const actualLevel = drSuggestion.severity;
        
        if (actualLevel === testCase.expectedLevel) {
          passedTests++;
          console.log(`   ✅ ${testCase.description}: ${testCase.dr} LU → ${actualLevel}`);
        } else {
          failedTests.push({
            genre: scenario.genre,
            dr: testCase.dr,
            expected: testCase.expectedLevel,
            actual: actualLevel,
            description: testCase.description
          });
          console.log(`   ❌ ${testCase.description}: ${testCase.dr} LU → esperado: ${testCase.expectedLevel}, atual: ${actualLevel}`);
        }
        
      } catch (error) {
        failedTests.push({
          genre: scenario.genre,
          dr: testCase.dr,
          expected: testCase.expectedLevel,
          actual: 'erro',
          description: testCase.description,
          error: error.message
        });
        console.log(`   ❌ ${testCase.description}: Erro - ${error.message}`);
      }
    }
    
    console.log(''); // Linha em branco
  }
  
  // Relatório final
  console.log('📊 === RELATÓRIO FINAL ===');
  console.log(`Total de testes: ${totalTests}`);
  console.log(`Testes passaram: ${passedTests}`);
  console.log(`Testes falharam: ${failedTests.length}`);
  console.log(`Taxa de sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests.length > 0) {
    console.log('\n❌ TESTES QUE FALHARAM:');
    failedTests.forEach((fail, index) => {
      console.log(`${index + 1}. ${fail.genre} - ${fail.description}`);
      console.log(`   DR: ${fail.dr} LU | Esperado: ${fail.expected} | Atual: ${fail.actual}`);
      if (fail.error) {
        console.log(`   Erro: ${fail.error}`);
      }
    });
  }
  
  // Verificação de compatibilidade
  console.log('\n🔧 === TESTE DE COMPATIBILIDADE ===');
  try {
    const defaultAnalyzer = new ProblemsAndSuggestionsAnalyzerV2('default');
    const testResult = defaultAnalyzer.analyzeWithEducationalSuggestions({
      dynamics: { dynamicRange: 8.0 },
      lufs: { integrated: -14 },
      truePeak: { peak: -1.5 }
    });
    
    if (testResult && testResult.suggestions && testResult.summary) {
      console.log('✅ Sistema mantém compatibilidade com analyzer padrão');
      console.log(`   Sugestões geradas: ${testResult.suggestions.length}`);
      console.log(`   Rating geral: ${testResult.summary.overallRating}`);
    } else {
      console.log('❌ Sistema quebrou compatibilidade');
    }
  } catch (error) {
    console.log(`❌ Erro de compatibilidade: ${error.message}`);
  }
  
  return {
    totalTests,
    passedTests,
    failedTests: failedTests.length,
    successRate: (passedTests / totalTests) * 100
  };
}

// Executar testes se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runDynamicRangeToleranceTests()
    .then(results => {
      console.log('\n🎯 Teste concluído!');
      process.exit(results.failedTests === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Erro ao executar testes:', error);
      process.exit(1);
    });
}

export { runDynamicRangeToleranceTests };