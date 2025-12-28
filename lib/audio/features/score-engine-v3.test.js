/**
 * =============================================================================
 * TESTES UNITÁRIOS - Score Engine V3
 * =============================================================================
 * 
 * Testes para validar o funcionamento do Score Engine V3
 * Execute no browser console após carregar a aplicação
 * 
 * @version 3.0.0
 */

// ============================================================================
// DADOS DE TESTE
// ============================================================================

const TEST_TECHNICAL_DATA = {
  // Caso PERFEITO - deve dar score alto
  perfect: {
    lufsIntegrated: -9.0,
    truePeakDbtp: -1.0,
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 0,
    bands: {
      sub: { avg_db: -28 },
      low_bass: { avg_db: -20 },
      upper_bass: { avg_db: -16 },
      low_mid: { avg_db: -14 },
      mid: { avg_db: -12 },
      high_mid: { avg_db: -16 },
      brilho: { avg_db: -20 },
      presenca: { avg_db: -24 }
    }
  },
  
  // Caso com TRUE PEAK CRÍTICO (> 0) - DEVE TRIGGERAR GATE
  clipping: {
    lufsIntegrated: -9.0,
    truePeakDbtp: 0.5, // CRÍTICO!
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 0,
    bands: {
      sub: { avg_db: -28 },
      low_bass: { avg_db: -20 }
    }
  },
  
  // Caso com TRUE PEAK muito próximo de 0 - warning
  nearClipping: {
    lufsIntegrated: -9.0,
    truePeakDbtp: -0.05,
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 0,
    bands: {}
  },
  
  // Caso com LUFS fora do range
  loudnessIssue: {
    lufsIntegrated: -5.0, // Muito alto!
    truePeakDbtp: -1.0,
    dr: 4, // DR muito baixo
    lra: 3,
    crestFactor: 6,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 0,
    bands: {}
  },
  
  // Caso com problemas de stereo
  stereoIssue: {
    lufsIntegrated: -9.0,
    truePeakDbtp: -1.0,
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.05, // Fase problemática
    stereoWidth: 0.95, // Muito largo
    balanceLR: 0.35, // Desbalanceado
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 0,
    bands: {}
  },
  
  // Caso com DC Offset alto
  dcOffsetIssue: {
    lufsIntegrated: -9.0,
    truePeakDbtp: -1.0,
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.08, // Alto!
    clippingPct: 0,
    bands: {}
  },
  
  // Caso com clipping severo (>5%)
  severeClipping: {
    lufsIntegrated: -9.0,
    truePeakDbtp: -0.5,
    dr: 8,
    lra: 7,
    crestFactor: 10,
    stereoCorrelation: 0.5,
    stereoWidth: 0.55,
    balanceLR: 0.0,
    centroid: 3000,
    spectralFlatness: 0.2,
    rolloff85: 8000,
    dcOffset: 0.0,
    clippingPct: 8.0, // Muito alto!
    bands: {}
  }
};

const TEST_REFERENCE_DATA = {
  genre_id: 'funk_mandela',
  legacy_compatibility: {
    lufs_target: -9,
    lufs_min: -12,
    lufs_max: -7,
    true_peak_target: -1,
    true_peak_min: -3,
    true_peak_max: 0,
    dr_target: 8,
    dr_min: 4,
    dr_max: 12,
    bands: {
      sub: { target_range: { min: -34, max: -22 }, target_db: -28 },
      low_bass: { target_range: { min: -26, max: -14 }, target_db: -20 }
    }
  }
};

// ============================================================================
// FUNÇÕES DE TESTE
// ============================================================================

/**
 * Testa a função scoreByTargetRange
 */
function testScoreByTargetRange() {
  console.log('\n📊 TESTE: scoreByTargetRange');
  console.log('═'.repeat(50));
  
  if (!window.ScoreEngineV3?.scoreByTargetRange) {
    console.error('❌ ScoreEngineV3.scoreByTargetRange não disponível');
    return false;
  }
  
  const fn = window.ScoreEngineV3.scoreByTargetRange;
  const tests = [
    // [value, target, min, max, expected_min, expected_max, description]
    [-1.0, -1.0, -3.0, 0.0, 100, 100, 'No target exato = 100'],
    [-3.0, -1.0, -3.0, 0.0, 0, 10, 'No limite mínimo = ~0'],
    [0.0, -1.0, -3.0, 0.0, 0, 10, 'No limite máximo = ~0'],
    [-2.0, -1.0, -3.0, 0.0, 30, 70, 'Entre target e min'],
    [-0.5, -1.0, -3.0, 0.0, 30, 70, 'Entre target e max'],
    [-4.0, -1.0, -3.0, 0.0, 0, 0, 'Fora do range (abaixo) = 0'],
    [1.0, -1.0, -3.0, 0.0, 0, 0, 'Fora do range (acima) = 0'],
    [null, -1.0, -3.0, 0.0, 0, 0, 'Valor null = 0'],
    [NaN, -1.0, -3.0, 0.0, 0, 0, 'Valor NaN = 0'],
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(([value, target, min, max, expectedMin, expectedMax, desc]) => {
    const result = fn(value, target, min, max, 1.5);
    const success = result >= expectedMin && result <= expectedMax;
    
    if (success) {
      console.log(`✅ ${desc}: ${result} (esperado: ${expectedMin}-${expectedMax})`);
      passed++;
    } else {
      console.error(`❌ ${desc}: ${result} (esperado: ${expectedMin}-${expectedMax})`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed}/${tests.length} testes passaram`);
  return failed === 0;
}

/**
 * Testa a função scoreTruePeak com GATE
 */
function testScoreTruePeak() {
  console.log('\n🚨 TESTE: scoreTruePeak (GATE CRÍTICO)');
  console.log('═'.repeat(50));
  
  if (!window.ScoreEngineV3?.scoreTruePeak) {
    console.error('❌ ScoreEngineV3.scoreTruePeak não disponível');
    return false;
  }
  
  const fn = window.ScoreEngineV3.scoreTruePeak;
  const tests = [
    // [truePeak, target, min, max, expectedGate, gateType, description]
    [0.5, -1.0, -3.0, 0.0, true, 'TRUE_PEAK_CRITICAL', 'TP > 0 = GATE CRÍTICO'],
    [0.01, -1.0, -3.0, 0.0, true, 'TRUE_PEAK_CRITICAL', 'TP = 0.01 = GATE CRÍTICO'],
    [0.0, -1.0, -3.0, 0.0, false, null, 'TP = 0 exato = sem gate (no limite)'],
    [-0.05, -1.0, -3.0, 0.0, true, 'TRUE_PEAK_WARNING', 'TP = -0.05 = WARNING'],
    [-1.0, -1.0, -3.0, 0.0, false, null, 'TP = -1 (target) = sem gate'],
    [-2.0, -1.0, -3.0, 0.0, false, null, 'TP = -2 = sem gate'],
    [null, -1.0, -3.0, 0.0, true, 'INVALID_DATA', 'TP null = INVALID gate'],
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(([tp, target, min, max, expectedGate, expectedType, desc]) => {
    const result = fn(tp, target, min, max);
    const gateMatch = result.gateTriggered === expectedGate;
    const typeMatch = expectedType === null ? !result.gateType : result.gateType === expectedType;
    const success = gateMatch && typeMatch;
    
    if (success) {
      console.log(`✅ ${desc}: gate=${result.gateTriggered}, type=${result.gateType}`);
      passed++;
    } else {
      console.error(`❌ ${desc}: gate=${result.gateTriggered} (esperado: ${expectedGate}), type=${result.gateType} (esperado: ${expectedType})`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed}/${tests.length} testes passaram`);
  return failed === 0;
}

/**
 * Testa o cálculo completo do V3
 */
async function testComputeScoreV3() {
  console.log('\n🎯 TESTE: computeScoreV3 (Cálculo Completo)');
  console.log('═'.repeat(50));
  
  if (!window.ScoreEngineV3?.computeScore) {
    console.error('❌ ScoreEngineV3.computeScore não disponível');
    return false;
  }
  
  const tests = [
    {
      name: 'Caso Perfeito',
      data: TEST_TECHNICAL_DATA.perfect,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 70, maxScore: 100, noGates: true }
    },
    {
      name: 'True Peak Crítico (TP > 0)',
      data: TEST_TECHNICAL_DATA.clipping,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 0, maxScore: 35, hasGate: 'TRUE_PEAK_CRITICAL' }
    },
    {
      name: 'True Peak Warning (-0.05)',
      data: TEST_TECHNICAL_DATA.nearClipping,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 30, maxScore: 70, hasGate: 'TRUE_PEAK_WARNING' }
    },
    {
      name: 'Loudness Fora do Range',
      data: TEST_TECHNICAL_DATA.loudnessIssue,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 20, maxScore: 60 }
    },
    {
      name: 'Problemas de Stereo',
      data: TEST_TECHNICAL_DATA.stereoIssue,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 40, maxScore: 80 }
    },
    {
      name: 'DC Offset Alto',
      data: TEST_TECHNICAL_DATA.dcOffsetIssue,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 40, maxScore: 85, hasGate: 'DC_OFFSET_HIGH' }
    },
    {
      name: 'Clipping Severo (>5%)',
      data: TEST_TECHNICAL_DATA.severeClipping,
      ref: TEST_REFERENCE_DATA,
      mode: 'streaming',
      expectations: { minScore: 0, maxScore: 50, hasGate: 'CLIPPING_SEVERE' }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await window.ScoreEngineV3.computeScore(
        test.data,
        test.ref,
        test.mode,
        test.ref?.genre_id
      );
      
      // Verificar score no range esperado
      const scoreOk = result.scorePct >= test.expectations.minScore && 
                      result.scorePct <= test.expectations.maxScore;
      
      // Verificar gates
      let gateOk = true;
      if (test.expectations.noGates) {
        gateOk = result.gatesApplied.length === 0;
      }
      if (test.expectations.hasGate) {
        gateOk = result.gatesApplied.some(g => g.type === test.expectations.hasGate);
      }
      
      const success = scoreOk && gateOk;
      
      if (success) {
        console.log(`✅ ${test.name}: score=${result.scorePct} (esperado: ${test.expectations.minScore}-${test.expectations.maxScore}), gates=${result.gatesApplied.map(g=>g.type).join(',') || 'none'}`);
        passed++;
      } else {
        console.error(`❌ ${test.name}: score=${result.scorePct} (esperado: ${test.expectations.minScore}-${test.expectations.maxScore}), gates=${result.gatesApplied.map(g=>g.type).join(',') || 'none'}`);
        console.log('   Resultado completo:', result);
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name}: ERRO - ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Resultado: ${passed}/${tests.length} testes passaram`);
  return failed === 0;
}

/**
 * Testa comparação V3 vs Sistema Atual
 */
async function testV3vsCurrentComparison() {
  console.log('\n🔄 TESTE: Comparação V3 vs Sistema Atual');
  console.log('═'.repeat(50));
  
  if (!window.compareScoreV3) {
    console.error('❌ window.compareScoreV3 não disponível');
    return false;
  }
  
  try {
    const comparison = await window.compareScoreV3(
      TEST_TECHNICAL_DATA.perfect,
      TEST_REFERENCE_DATA,
      'streaming',
      'funk_mandela'
    );
    
    console.log('📊 Comparação:');
    console.log(`   Sistema Atual: ${comparison.current?.scorePct || 'N/A'}%`);
    console.log(`   V3: ${comparison.v3?.scorePct || 'N/A'}%`);
    console.log(`   Delta: ${comparison.delta ?? 'N/A'} pontos`);
    console.log(`   V3 Disponível: ${comparison.v3Available}`);
    
    if (comparison.v3) {
      console.log('\n📋 Subscores V3:');
      Object.entries(comparison.v3.subscores || {}).forEach(([key, val]) => {
        console.log(`   ${key}: ${val.score}`);
      });
      
      if (comparison.v3.gatesApplied?.length > 0) {
        console.log('\n🚨 Gates Aplicados:');
        comparison.v3.gatesApplied.forEach(g => {
          console.log(`   ${g.type}: ${g.reason}`);
        });
      }
    }
    
    return comparison.v3Available;
  } catch (error) {
    console.error('❌ Erro na comparação:', error);
    return false;
  }
}

/**
 * Executa todos os testes
 */
async function runAllV3Tests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     SCORE ENGINE V3 - SUITE DE TESTES UNITÁRIOS    ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n⏱️ Iniciando testes em ${new Date().toLocaleTimeString()}`);
  
  const results = {
    scoreByTargetRange: testScoreByTargetRange(),
    scoreTruePeak: testScoreTruePeak(),
    computeScoreV3: await testComputeScoreV3(),
    comparison: await testV3vsCurrentComparison()
  };
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║              RESUMO DOS TESTES                     ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`   ${name}: ${status}`);
    if (passed) totalPassed++;
    else totalFailed++;
  });
  
  console.log('\n' + '─'.repeat(55));
  
  if (totalFailed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Score Engine V3 está funcionando corretamente.');
  } else {
    console.error(`❌ ${totalFailed} grupo(s) de testes falharam.`);
    console.log('📝 Verifique os logs acima para detalhes.');
  }
  
  console.log(`\n⏱️ Testes concluídos em ${new Date().toLocaleTimeString()}`);
  
  return results;
}

// ============================================================================
// REGISTRAR NO WINDOW
// ============================================================================

if (typeof window !== 'undefined') {
  window.ScoreEngineV3Tests = {
    testScoreByTargetRange,
    testScoreTruePeak,
    testComputeScoreV3,
    testV3vsCurrentComparison,
    runAll: runAllV3Tests,
    testData: TEST_TECHNICAL_DATA,
    testReference: TEST_REFERENCE_DATA
  };
  
  console.log('🧪 Score Engine V3 Tests carregados. Execute: window.ScoreEngineV3Tests.runAll()');
}

// Export para uso como módulo
export {
  testScoreByTargetRange,
  testScoreTruePeak,
  testComputeScoreV3,
  testV3vsCurrentComparison,
  runAllV3Tests,
  TEST_TECHNICAL_DATA,
  TEST_REFERENCE_DATA
};
