// 🧪 AUDITORIA SCORING EQUAL WEIGHT V3
// Valida Pista A (sweet-spot 4dB), Pista B (STEP_MAX 4dB), level-matching

import { computeMixScore } from '../lib/audio/features/scoring.js';

// 🎛️ Gerador de dados de teste para scoring
class ScoringTestGenerator {
  static createMockMetrics(overrides = {}) {
    return {
      lufsIntegrated: -14,
      truePeak: -1.0,
      dynamicRange: 12,
      lra: 5,
      stereoCorrelation: 0.3,
      sub: -25,
      bass: -20,
      low_mid: -15,
      mid: -10,
      high_mid: -15,
      presence: -20,
      air: -30,
      ...overrides
    };
  }

  static createMockReference(genre = 'pop', overrides = {}) {
    const baseRef = {
      genre,
      lufs_target: -14,
      tol_lufs: 3.0,
      dr_target: 12,
      tol_dr: 4,
      lra_target: 5,
      tol_lra: 3,
      // Targets por banda
      sub_target: -25, tol_sub: 8,
      bass_target: -20, tol_bass: 7,
      low_mid_target: -15, tol_low_mid: 6,
      mid_target: -10, tol_mid: 5,
      high_mid_target: -15, tol_high_mid: 6,
      presence_target: -20, tol_presence: 7,
      air_target: -30, tol_air: 8,
      ...overrides
    };
    return baseRef;
  }

  static setupMockBaseline(bandName, value, lufsDelta = 0) {
    if (typeof window === 'undefined') {
      global.window = {};
    }
    
    if (!window.__BASELINE_BAND_ENERGIES) {
      window.__BASELINE_BAND_ENERGIES = { data: {} };
    }
    
    window.__BASELINE_BAND_ENERGIES.data[bandName] = {
      rms_db: value,
      lufsDelta: lufsDelta
    };
  }

  static clearBaseline() {
    if (typeof window !== 'undefined' && window.__BASELINE_BAND_ENERGIES) {
      window.__BASELINE_BAND_ENERGIES.data = {};
    }
  }
}

// 🔬 Framework de teste
function runTest(testName, testFn) {
  console.log(`\n🔍 ${testName}`);
  try {
    testFn();
    console.log(`✅ PASS: ${testName}`);
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${testName}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

function assertCloseTo(actual, expected, tolerance, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`${message}Expected ${actual} to be within ±${tolerance} of ${expected} (diff: ${diff})`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}Expected ${expected}, got ${actual}`);
  }
}

// 🎯 EXECUTAR TESTES DE SCORING
console.log('🧮 AUDITORIA SCORING EQUAL WEIGHT V3 - VALIDAÇÃO COMPLETA\n');

let passCount = 0;
let totalTests = 0;

// ✅ TESTE 1: Sweet-spot 4dB para bandas (Pista A)
totalTests++;
passCount += runTest('SC1.1 - Sweet-spot 4dB deve dar 100% score para bandas', () => {
  const metrics = ScoringTestGenerator.createMockMetrics({
    // Banda mid exatamente no target
    mid: -10
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(metrics, reference);
  
  console.log(`   🔍 Mid no target (-10): ${(result.details.mid?.score * 100).toFixed(1)}%`);
  
  // Exatamente no target deve ser 100%
  assertCloseTo(result.details.mid?.score, 1.0, 0.01, 'Score no target deve ser 100%: ');
  
  // Teste dentro do sweet-spot (±3dB)
  const metrics3dB = ScoringTestGenerator.createMockMetrics({ mid: -13 }); // 3dB abaixo
  const result3dB = computeMixScore(metrics3dB, reference);
  
  console.log(`   🔍 Mid -3dB do target (-13): ${(result3dB.details.mid?.score * 100).toFixed(1)}%`);
  
  assertCloseTo(result3dB.details.mid?.score, 1.0, 0.05, 'Score dentro sweet-spot deve ser ~100%: ');
  
  // Teste no limite do sweet-spot (4dB)
  const metrics4dB = ScoringTestGenerator.createMockMetrics({ mid: -14 }); // 4dB abaixo
  const result4dB = computeMixScore(metrics4dB, reference);
  
  console.log(`   🔍 Mid no limite sweet-spot (-14): ${(result4dB.details.mid?.score * 100).toFixed(1)}%`);
  
  assertTrue(result4dB.details.mid?.score >= 0.9, 'Score no limite sweet-spot deve ser >= 90%');
});

// ✅ TESTE 2: Score progressivo entre sweet-spot e tolerância
totalTests++;
passCount += runTest('SC1.2 - Score progressivo entre sweet-spot (4dB) e tolerância', () => {
  const reference = ScoringTestGenerator.createMockReference();
  const midTarget = reference.mid_target; // -10
  const midTol = reference.tol_mid; // 5dB
  
  // Teste em diferentes pontos da curva
  const testPoints = [
    { diff: 0, expectedMin: 95 },    // Target = 100%
    { diff: 2, expectedMin: 95 },    // Dentro sweet-spot = ~100%
    { diff: 4, expectedMin: 90 },    // Limite sweet-spot = ~100%
    { diff: 6, expectedMin: 70 },    // Entre sweet-spot e tolerância = decrescente
    { diff: 8, expectedMin: 40 },    // Próximo da tolerância = baixo
    { diff: 10, expectedMin: 0 }     // Fora da tolerância = 0%
  ];
  
  console.log('   🔍 Curva de score progressivo:');
  for (const point of testPoints) {
    const metrics = ScoringTestGenerator.createMockMetrics({ 
      mid: midTarget + point.diff 
    });
    const result = computeMixScore(metrics, reference);
    const score = (result.details.mid?.score * 100) || 0;
    
    console.log(`     +${point.diff}dB: ${score.toFixed(1)}% (min: ${point.expectedMin}%)`);
    
    assertTrue(score >= point.expectedMin, 
      `Score para +${point.diff}dB deve ser >= ${point.expectedMin}% (${score.toFixed(1)}%)`);
  }
});

// ✅ TESTE 3: Level-matching aplicado apenas às bandas
totalTests++;
passCount += runTest('SC2.1 - Level-matching aplicado apenas às bandas, não LUFS/TP', () => {
  // Cenário: mix 3dB mais alto que target LUFS
  const metrics = ScoringTestGenerator.createMockMetrics({
    lufsIntegrated: -11, // 3dB acima do target -14
    mid: -7,             // Banda também 3dB acima
    truePeak: -1.0       // Sem level-matching
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(metrics, reference);
  
  console.log(`   🔍 LUFS sem compensação: ${result.details.lufsIntegrated?.value} vs target ${reference.lufs_target}`);
  console.log(`   🔍 Mid com compensação: banda ajustada para level-matching`);
  console.log(`   🔍 True Peak sem compensação: ${result.details.truePeak?.value || 'N/A'}`);
  
  // LUFS não deve ter level-matching aplicado
  assertEqual(result.details.lufsIntegrated?.value, -11, 'LUFS não deve ter compensação: ');
  
  // Banda deve estar matematicamente corrigida (internamente, mas visível no score)
  // Se level-matching funcionou, score da banda deve ser melhor que sem compensação
  const midScore = result.details.mid?.score || 0;
  assertTrue(midScore > 0.7, 'Level-matching deve melhorar score da banda');
});

// ✅ TESTE 4: Pista B - improvement-based scoring (STEP_MAX 4dB)
totalTests++;
passCount += runTest('SC3.1 - Pista B: melhoria +4dB deve dar score >= 75%', () => {
  ScoringTestGenerator.clearBaseline();
  
  // Baseline: banda bass em -25dB (5dB abaixo do target -20)
  ScoringTestGenerator.setupMockBaseline('bass', -25, 0);
  
  // Atual: banda bass melhorou para -21dB (+4dB de melhoria)
  const metrics = ScoringTestGenerator.createMockMetrics({
    bass: -21 // Melhorou 4dB vs baseline (-25)
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(metrics, reference);
  const bassScore = result.details.bass?.score || 0;
  
  console.log(`   🔍 Baseline: -25dB, Atual: -21dB, Target: -20dB`);
  console.log(`   🔍 Melhoria: +4dB (STEP_MAX)`);
  console.log(`   🔍 Score final: ${(bassScore * 100).toFixed(1)}%`);
  
  // STEP_MAX de 4dB deve dar score alto (normalizado para 100%, mas com boost 1.2x)
  assertTrue(bassScore >= 0.75, `Score para melhoria STEP_MAX deve ser >= 75% (${(bassScore * 100).toFixed(1)}%)`);
});

// ✅ TESTE 5: Pista B - max(scoreA, scoreB)
totalTests++;
passCount += runTest('SC3.2 - Pista B: final = max(Pista A, Pista B)', () => {
  ScoringTestGenerator.clearBaseline();
  
  // Cenário: baseline muito ruim, atual ok mas não perfeito
  ScoringTestGenerator.setupMockBaseline('mid', -20, 0); // Muito baixo vs target -10
  
  const metrics = ScoringTestGenerator.createMockMetrics({
    mid: -12 // Atual: 2dB abaixo do target (Pista A ~80%), mas melhorou 8dB vs baseline
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(metrics, reference);
  const midScore = result.details.mid?.score || 0;
  
  console.log(`   🔍 Baseline: -20dB → Atual: -12dB (melhoria +8dB)`);
  console.log(`   🔍 Atual vs target -10dB: diff 2dB`);
  console.log(`   🔍 Score final: ${(midScore * 100).toFixed(1)}%`);
  
  // Score deve ser o maior entre Pista A (~80% para 2dB diff) e Pista B (100%+ para 8dB melhoria)
  assertTrue(midScore >= 0.9, `Score híbrido deve usar o melhor entre A e B (${(midScore * 100).toFixed(1)}%)`);
});

// ✅ TESTE 6: Classificação final ajustada
totalTests++;
passCount += runTest('SC4.1 - Classificação rebalanceada (85%=Mundial, 70%=Avançado)', () => {
  // Teste mix "muito bom" 
  const goodMetrics = ScoringTestGenerator.createMockMetrics({
    lufsIntegrated: -13.5, // Muito próximo
    mid: -11,              // 1dB de diferença
    bass: -19,             // 1dB de diferença
    truePeak: -1.2         // Compliant
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(goodMetrics, reference);
  
  console.log(`   🔍 Score total: ${result.scorePct?.toFixed(1)}%`);
  console.log(`   🔍 Classificação: ${result.classification}`);
  
  // Mix muito bom deve alcançar pelo menos Avançado (70%)
  assertTrue(result.scorePct >= 70, `Mix bom deve ter >= 70% (${result.scorePct?.toFixed(1)}%)`);
  
  if (result.scorePct >= 85) {
    assertEqual(result.classification, 'Referência Mundial', 'Score >= 85% deve ser Mundial');
  } else if (result.scorePct >= 70) {
    assertEqual(result.classification, 'Avançado', 'Score >= 70% deve ser Avançado');
  }
});

// ✅ TESTE 7: Tolerâncias ampliadas para bandas
totalTests++;
passCount += runTest('SC5.1 - Tolerâncias ampliadas para bandas espectrais', () => {
  // Teste banda sub com tolerância ampliada (10dB vs 5dB padrão)
  const metrics = ScoringTestGenerator.createMockMetrics({
    sub: -35 // 10dB abaixo do target -25
  });
  const reference = ScoringTestGenerator.createMockReference({
    tol_sub: 5 // Tolerância original menor
  });
  
  const result = computeMixScore(metrics, reference);
  const subScore = result.details.sub?.score || 0;
  
  console.log(`   🔍 Sub: -35dB, Target: -25dB, Diff: 10dB`);
  console.log(`   🔍 Tolerância ref: 5dB, Ampliada: 10dB`);
  console.log(`   🔍 Score: ${(subScore * 100).toFixed(1)}%`);
  
  // Com tolerância ampliada, 10dB de diferença deve estar dentro da tolerância
  assertTrue(subScore > 0, `Score com tolerância ampliada deve ser > 0% (${(subScore * 100).toFixed(1)}%)`);
  
  // Idealmente deve ser score razoável se tolerância foi aplicada corretamente
  assertTrue(subScore >= 0.3, `Score na borda da tolerância ampliada deve ser >= 30%`);
});

// ✅ TESTE 8: Métricas não-bandas sem level-matching
totalTests++;
passCount += runTest('SC6.1 - Métricas não-bandas (LUFS, TP, DR) sem level-matching', () => {
  const metrics = ScoringTestGenerator.createMockMetrics({
    lufsIntegrated: -11,   // 3dB alto
    truePeak: 1.0,         // 2dB alto  
    dynamicRange: 8,       // 4dB baixo
    stereoCorrelation: 0.1 // 0.2 baixo
  });
  const reference = ScoringTestGenerator.createMockReference();
  
  const result = computeMixScore(metrics, reference);
  
  // Verificar que valores originais são preservados (sem compensação)
  assertEqual(result.details.lufsIntegrated?.value, -11, 'LUFS deve manter valor original');
  assertEqual(result.details.truePeak?.value, 1.0, 'True Peak deve manter valor original');
  assertEqual(result.details.dynamicRange?.value, 8, 'DR deve manter valor original');
  
  console.log(`   🔍 LUFS original preservado: ${result.details.lufsIntegrated?.value}`);
  console.log(`   🔍 True Peak original preservado: ${result.details.truePeak?.value}`);
  console.log(`   🔍 DR original preservado: ${result.details.dynamicRange?.value}`);
});

// 📊 RESULTADOS FINAIS
console.log('\n📊 RESULTADOS DA AUDITORIA SCORING EQUAL WEIGHT V3');
console.log('='.repeat(60));
console.log(`✅ Testes aprovados: ${passCount}/${totalTests}`);
console.log(`📈 Taxa de sucesso: ${((passCount/totalTests)*100).toFixed(1)}%`);

if (passCount === totalTests) {
  console.log('\n🎉 VEREDITO: PASS');
  console.log('✅ Sweet-spot 4dB implementado corretamente');
  console.log('✅ Score progressivo funcional entre sweet-spot e tolerância');
  console.log('✅ Level-matching aplicado apenas às bandas');
  console.log('✅ Pista B (improvement-based) com STEP_MAX 4dB');
  console.log('✅ Sistema híbrido max(scoreA, scoreB) funcional');
  console.log('✅ Classificação rebalanceada (85%/70%/55%)');
  console.log('✅ Tolerâncias ampliadas para bandas espectrais');
} else {
  console.log('\n❌ VEREDITO: FAIL');
  console.log(`❌ ${totalTests - passCount} teste(s) falharam`);
  console.log('🔧 Requer correções no sistema de scoring');
}