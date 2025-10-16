/**
 * 🧪 TESTES BÁSICOS: Módulo Granular V1
 * 
 * Testes unitários para validar o funcionamento do módulo de análise granular.
 * 
 * Como executar:
 * ```bash
 * node work/tests/spectral-bands-granular.test.js
 * ```
 */

import { 
  analyzeGranularSpectralBands,
  aggregateSubBandsIntoGroups,
  buildSuggestions,
  DEFAULT_GRANULAR_BANDS,
  DEFAULT_GROUPING,
  DEFAULT_SEVERITY,
  freqToBin,
  linearToDb,
  statusFromDeviation
} from '../lib/audio/features/spectral-bands-granular.js';

// ============================================================================
// HELPERS DE TESTE
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message) {
  const passed = actual === expected;
  if (passed) {
    console.log(`✅ ${message}: ${actual}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}: esperado ${expected}, obtido ${actual}`);
    testsFailed++;
  }
}

function assertAlmostEqual(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const passed = diff <= tolerance;
  if (passed) {
    console.log(`✅ ${message}: ${actual} ≈ ${expected} (Δ=${diff.toFixed(4)})`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}: esperado ${expected}, obtido ${actual} (Δ=${diff.toFixed(4)} > ${tolerance})`);
    testsFailed++;
  }
}

// ============================================================================
// MOCK: FFT FRAMES
// ============================================================================

function generateMockFFTFrames(frameCount = 10, fftSize = 4096) {
  const frames = [];
  
  for (let i = 0; i < frameCount; i++) {
    const left = { magnitude: new Array(fftSize / 2).fill(0) };
    const right = { magnitude: new Array(fftSize / 2).fill(0) };
    
    // Simular energia em diferentes faixas
    for (let bin = 0; bin < fftSize / 2; bin++) {
      // Energia decrescente com a frequência (simulando espectro típico)
      const decay = Math.exp(-bin / 500);
      const randomVariation = 0.8 + Math.random() * 0.4;
      
      left.magnitude[bin] = decay * randomVariation * 0.5;
      right.magnitude[bin] = decay * randomVariation * 0.5;
    }
    
    frames.push({ left, right });
  }
  
  return frames;
}

// ============================================================================
// TESTES UNITÁRIOS
// ============================================================================

console.log('\n🧪 INICIANDO TESTES DO MÓDULO GRANULAR V1\n');
console.log('='.repeat(60));

// --- Teste 1: Constantes Carregadas ---
console.log('\n📋 Teste 1: Constantes e Configuração');
assert(DEFAULT_GRANULAR_BANDS.length === 13, 'DEFAULT_GRANULAR_BANDS tem 13 bandas');
assert(Object.keys(DEFAULT_GROUPING).length === 7, 'DEFAULT_GROUPING tem 7 grupos');
assert(DEFAULT_SEVERITY.weights.ideal === 0, 'Peso ideal = 0');
assert(DEFAULT_SEVERITY.weights.adjust === 1, 'Peso adjust = 1');
assert(DEFAULT_SEVERITY.weights.fix === 3, 'Peso fix = 3');

// --- Teste 2: Utilitários ---
console.log('\n🔧 Teste 2: Funções Utilitárias');

const bin100Hz = freqToBin(100, 48000, 4096);
assertAlmostEqual(bin100Hz, 8.5, 1, 'freqToBin(100Hz) ≈ 8-9');

const bin1000Hz = freqToBin(1000, 48000, 4096);
assertAlmostEqual(bin1000Hz, 85.3, 2, 'freqToBin(1000Hz) ≈ 85');

const db1 = linearToDb(1.0);
assertAlmostEqual(db1, 0, 0.01, 'linearToDb(1.0) = 0 dB');

const db2 = linearToDb(0.5);
assertAlmostEqual(db2, -6.02, 0.1, 'linearToDb(0.5) ≈ -6 dB');

const status1 = statusFromDeviation(0.5, 1.5);
assertEqual(status1, 'ideal', 'Desvio 0.5σ → ideal');

const status2 = statusFromDeviation(2.0, 1.5);
assertEqual(status2, 'adjust', 'Desvio 2.0σ → adjust');

const status3 = statusFromDeviation(3.5, 1.5);
assertEqual(status3, 'fix', 'Desvio 3.5σ → fix');

// --- Teste 3: Análise Granular ---
console.log('\n🎯 Teste 3: Análise Granular Completa');

const mockFrames = generateMockFFTFrames(100, 4096);

(async () => {
  try {
    const result = await analyzeGranularSpectralBands(mockFrames);
    
    assert(result.algorithm === 'granular_v1', 'Algorithm = granular_v1');
    assert(result.granular.length === 13, 'Granular tem 13 sub-bandas');
    assert(Object.keys(result.groups).length === 7, 'Groups tem 7 bandas principais');
    assert(Array.isArray(result.suggestions), 'Suggestions é um array');
    assert(result.framesProcessed === 100, 'Frames processados = 100');
    assert(result.aggregationMethod === 'median', 'Método de agregação = median');
    
    // ✅ NOVO: Validar campo .bands (compatibilidade legacy)
    assert(result.bands, 'Resultado tem campo bands');
    assert(typeof result.bands === 'object', 'Bands é um objeto');
    assert(Object.keys(result.bands).length === 7, 'Bands tem 7 chaves');
    
    // Validar estrutura de banda legada
    const bandKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    for (const key of bandKeys) {
      assert(key in result.bands, `Banda ${key} existe`);
      const band = result.bands[key];
      assert('energy_db' in band, `${key} tem energy_db`);
      assert('percentage' in band, `${key} tem percentage`);
      assert('range' in band, `${key} tem range`);
      assert('name' in band, `${key} tem name`);
      assert('status' in band, `${key} tem status`);
      
      // Validar tipos
      assert(band.energy_db === null || typeof band.energy_db === 'number', `${key}.energy_db é null ou number`);
      assert(typeof band.percentage === 'number', `${key}.percentage é number`);
      assert(typeof band.range === 'string', `${key}.range é string`);
      assert(typeof band.name === 'string', `${key}.name é string`);
      assert(typeof band.status === 'string', `${key}.status é string`);
    }
    
    console.log(`\n✅ Validação de .bands:`);
    console.log(`   - Sub: energy_db=${result.bands.sub.energy_db}, percentage=${result.bands.sub.percentage}%`);
    console.log(`   - Bass: energy_db=${result.bands.bass.energy_db}, percentage=${result.bands.bass.percentage}%`);
    
    // Verificar estrutura de sub-banda
    const firstSubBand = result.granular[0];
    assert('id' in firstSubBand, 'Sub-banda tem campo id');
    assert('range' in firstSubBand, 'Sub-banda tem campo range');
    assert('energyDb' in firstSubBand, 'Sub-banda tem campo energyDb');
    assert('target' in firstSubBand, 'Sub-banda tem campo target');
    assert('deviation' in firstSubBand, 'Sub-banda tem campo deviation');
    assert('status' in firstSubBand, 'Sub-banda tem campo status');
    
    // Verificar estrutura de grupo
    const subGroup = result.groups.sub;
    assert('status' in subGroup, 'Grupo tem campo status');
    assert('score' in subGroup, 'Grupo tem campo score');
    assert('subBandsCount' in subGroup, 'Grupo tem campo subBandsCount');
    assertEqual(subGroup.subBandsCount, 2, 'Grupo sub tem 2 sub-bandas');
    
    // Verificar contadores
    const total = result.subBandsIdeal + result.subBandsAdjust + result.subBandsFix;
    assertEqual(total, 13, 'Total de sub-bandas = 13');
    
    console.log(`\n📊 Resultado da Análise Mock:`);
    console.log(`   - Sub-bandas ideais: ${result.subBandsIdeal}`);
    console.log(`   - Sub-bandas adjust: ${result.subBandsAdjust}`);
    console.log(`   - Sub-bandas fix: ${result.subBandsFix}`);
    console.log(`   - Sugestões geradas: ${result.suggestions.length}`);
    
    // --- Teste 4: Agregação ---
    console.log('\n🔄 Teste 4: Agregação em Grupos');
    
    const mockSubBands = [
      { id: 'sub_low', status: 'ideal' },
      { id: 'sub_high', status: 'adjust' },
      { id: 'bass_low', status: 'ideal' },
      { id: 'bass_mid', status: 'ideal' },
      { id: 'bass_high', status: 'fix' }
    ];
    
    const mockGrouping = {
      sub: ['sub_low', 'sub_high'],
      bass: ['bass_low', 'bass_mid', 'bass_high']
    };
    
    const groups = aggregateSubBandsIntoGroups(mockSubBands, mockGrouping, DEFAULT_SEVERITY);
    
    // Sub: (0 + 1) / 2 = 0.5 → yellow
    assertAlmostEqual(groups.sub.score, 0.5, 0.01, 'Grupo sub score = 0.5');
    assertEqual(groups.sub.status, 'yellow', 'Grupo sub status = yellow');
    
    // Bass: (0 + 0 + 3) / 3 = 1.0 → yellow
    assertAlmostEqual(groups.bass.score, 1.0, 0.01, 'Grupo bass score = 1.0');
    assertEqual(groups.bass.status, 'yellow', 'Grupo bass status = yellow');
    
    // --- Teste 5: Sugestões ---
    console.log('\n💡 Teste 5: Geração de Sugestões');
    
    const mockSubBandsForSuggestions = [
      { id: 'sub_high', range: [40, 60], status: 'adjust', deviation: -2.5 },
      { id: 'mid_high', range: [1000, 2000], status: 'fix', deviation: 3.8 },
      { id: 'bass_low', range: [60, 90], status: 'ideal', deviation: 0.3 }
    ];
    
    const suggestions = buildSuggestions(
      mockSubBandsForSuggestions,
      { sub: ['sub_high'], mid: ['mid_high'], bass: ['bass_low'] },
      DEFAULT_SUGGESTIONS_CONFIG
    );
    
    assert(suggestions.length >= 2, 'Gerou pelo menos 2 sugestões (adjust + fix)');
    
    const highPrioritySuggestion = suggestions.find(s => s.priority === 'high');
    assert(highPrioritySuggestion !== undefined, 'Tem sugestão de alta prioridade');
    assertEqual(highPrioritySuggestion.type, 'cut', 'Sugestão high é cut (desvio positivo)');
    
    const mediumPrioritySuggestion = suggestions.find(s => s.priority === 'medium');
    assert(mediumPrioritySuggestion !== undefined, 'Tem sugestão de média prioridade');
    assertEqual(mediumPrioritySuggestion.type, 'boost', 'Sugestão medium é boost (desvio negativo)');
    
    console.log(`\n💡 Sugestões geradas (${suggestions.length}):`);
    suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.priority.toUpperCase()}] ${s.type} ${s.amount} dB em ${s.freq_range[0]}-${s.freq_range[1]} Hz`);
    });
    
    // --- Teste 6: Validação de Entrada ---
    console.log('\n🛡️ Teste 6: Validação de Entrada');
    
    try {
      await analyzeGranularSpectralBands(null);
      console.error('❌ Deveria lançar erro para entrada null');
      testsFailed++;
    } catch (error) {
      console.log('✅ Lança erro para entrada null');
      testsPassed++;
    }
    
    try {
      await analyzeGranularSpectralBands([]);
      console.error('❌ Deveria lançar erro para array vazio');
      testsFailed++;
    } catch (error) {
      console.log('✅ Lança erro para array vazio');
      testsPassed++;
    }
    
    // --- Resumo Final ---
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMO DOS TESTES\n');
    console.log(`✅ Testes passados: ${testsPassed}`);
    console.log(`❌ Testes falhos: ${testsFailed}`);
    console.log(`📈 Taxa de sucesso: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`);
    
    if (testsFailed === 0) {
      console.log('🎉 TODOS OS TESTES PASSARAM!\n');
      process.exit(0);
    } else {
      console.log('⚠️ ALGUNS TESTES FALHARAM. Revisar implementação.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO NOS TESTES:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
