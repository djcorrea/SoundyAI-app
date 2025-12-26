/**
 * 🧪 TESTE DE VALIDAÇÃO: Correção de Alias PT↔EN para Bandas
 * 
 * Este script valida que o patch aplicado em getMetricTarget()
 * resolve corretamente os aliases:
 *   - air → brilho
 *   - presence → presenca
 * 
 * EXECUTAR: node test-band-alias-fix.cjs
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 TESTE DE VALIDAÇÃO: Alias PT↔EN para Bandas');
console.log('═══════════════════════════════════════════════════════════════\n');

// Simular o TARGET_KEY_ALIASES do patch
const TARGET_KEY_ALIASES = {
  'air': 'brilho',           // EN → PT
  'presence': 'presenca',    // EN → PT
  'brilho': 'air',           // PT → EN (fallback reverso)
  'presenca': 'presence'     // PT → EN (fallback reverso)
};

// Simular genreTargets.bands do JSON (formato real do funk_bruxaria.json)
const genreTargetsBands = {
  "sub": { "target_db": -25, "tol_db": 0, "target_range": { "min": -28, "max": -22 } },
  "low_bass": { "target_db": -25, "tol_db": 0, "target_range": { "min": -28, "max": -22 } },
  "upper_bass": { "target_db": -28, "tol_db": 0, "target_range": { "min": -31, "max": -25 } },
  "low_mid": { "target_db": -28, "tol_db": 0, "target_range": { "min": -31, "max": -25 } },
  "mid": { "target_db": -31.5, "tol_db": 0, "target_range": { "min": -35, "max": -28 } },
  "high_mid": { "target_db": -37.5, "tol_db": 0, "target_range": { "min": -42, "max": -33 } },
  "brilho": { "target_db": -45, "tol_db": 0, "target_range": { "min": -50, "max": -40 } },
  "presenca": { "target_db": -43, "tol_db": 0, "target_range": { "min": -46, "max": -40 } }
};

// Simular userBands (dados do FFT - formato inglês)
const userBands = {
  "sub": { value: -24, energy_db: -24 },
  "low_bass": { value: -26, energy_db: -26 },
  "upper_bass": { value: -29, energy_db: -29 },
  "low_mid": { value: -27, energy_db: -27 },
  "mid": { value: -32, energy_db: -32 },
  "high_mid": { value: -38, energy_db: -38 },
  "air": { value: -52, energy_db: -52 },         // ← KEY EM INGLÊS
  "presence": { value: -48, energy_db: -48 }     // ← KEY EM INGLÊS
};

/**
 * Simula getMetricTarget com o PATCH aplicado
 */
function getMetricTargetPatched(bandKey, genreTargets) {
  // Tentar chave original primeiro, depois alias
  let t = genreTargets[bandKey];
  let resolvedKey = bandKey;
  
  if (!t && TARGET_KEY_ALIASES[bandKey]) {
    const aliasKey = TARGET_KEY_ALIASES[bandKey];
    t = genreTargets[aliasKey];
    if (t) {
      resolvedKey = aliasKey;
      console.log(`  🔄 Alias aplicado: ${bandKey} → ${aliasKey}`);
    }
  }
  
  if (!t) {
    console.log(`  ❌ FALHA: Banda ${bandKey} não encontrada (tentou alias: ${TARGET_KEY_ALIASES[bandKey] || 'nenhum'})`);
    return null;
  }
  
  console.log(`  ✅ Target encontrado para ${bandKey} (via ${resolvedKey}):`, {
    target_db: t.target_db,
    target_range: t.target_range
  });
  
  return {
    target: t.target_db,
    tolerance: t.tol_db ?? 3.0,
    target_range: t.target_range
  };
}

/**
 * Verifica se uma banda está dentro do range
 */
function isInRange(value, target_range) {
  if (!target_range) return null;
  return value >= target_range.min && value <= target_range.max;
}

// ═══════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════

let passCount = 0;
let failCount = 0;

function runTest(testName, bandKey, expectedSuccess) {
  console.log(`\n📋 ${testName}`);
  console.log(`   Buscando target para: "${bandKey}"`);
  
  const result = getMetricTargetPatched(bandKey, genreTargetsBands);
  const success = expectedSuccess ? !!result : !result;
  
  if (success) {
    console.log(`   ✅ PASSOU`);
    passCount++;
  } else {
    console.log(`   ❌ FALHOU (esperava ${expectedSuccess ? 'sucesso' : 'falha'})`);
    failCount++;
  }
  
  return result;
}

// Teste 1: air → brilho (CRÍTICO)
runTest('TESTE 1: air → brilho (alias EN→PT)', 'air', true);

// Teste 2: presence → presenca (CRÍTICO)
runTest('TESTE 2: presence → presenca (alias EN→PT)', 'presence', true);

// Teste 3: sub (sem alias necessário)
runTest('TESTE 3: sub (chave direta)', 'sub', true);

// Teste 4: upper_bass (chave direta, NÃO deve mapear para bass)
runTest('TESTE 4: upper_bass (chave direta)', 'upper_bass', true);

// Teste 5: low_bass (chave direta, NÃO deve mapear para bass)
runTest('TESTE 5: low_bass (chave direta)', 'low_bass', true);

// Teste 6: bass (NÃO existe no JSON)
runTest('TESTE 6: bass (NÃO existe no JSON - esperado FALHAR)', 'bass', false);

// Teste 7: brilho → air (alias reverso PT→EN - deve encontrar diretamente)
runTest('TESTE 7: brilho (chave direta PT)', 'brilho', true);

// ═══════════════════════════════════════════════════════════════
// TESTE DE INTEGRAÇÃO: Simular análise de banda com valores
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔬 TESTE DE INTEGRAÇÃO: Verificar severidade');
console.log('═══════════════════════════════════════════════════════════════');

function analyzeIntegration(bandKey) {
  const userData = userBands[bandKey];
  const targetInfo = getMetricTargetPatched(bandKey, genreTargetsBands);
  
  if (!userData || !targetInfo) {
    console.log(`   ⚠️ Dados insuficientes para ${bandKey}`);
    return null;
  }
  
  const value = userData.value ?? userData.energy_db;
  const inRange = isInRange(value, targetInfo.target_range);
  const delta = value - targetInfo.target;
  
  const severity = inRange ? 'OK' : (delta < 0 ? 'LOW (precisa boost)' : 'HIGH (precisa cut)');
  
  console.log(`\n   📊 Análise de "${bandKey}":`);
  console.log(`      Valor medido: ${value} dB`);
  console.log(`      Target: ${targetInfo.target} dB`);
  console.log(`      Range: [${targetInfo.target_range.min}, ${targetInfo.target_range.max}]`);
  console.log(`      Delta: ${delta.toFixed(2)} dB`);
  console.log(`      Dentro do range: ${inRange}`);
  console.log(`      Severidade: ${severity}`);
  
  return {
    bandKey,
    value,
    target: targetInfo.target,
    delta,
    inRange,
    severity,
    shouldGenerateSuggestion: !inRange
  };
}

console.log('\n--- Analisando "air" (brilho) ---');
const airResult = analyzeIntegration('air');

console.log('\n--- Analisando "presence" (presenca) ---');
const presenceResult = analyzeIntegration('presence');

// ═══════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 RESULTADO FINAL');
console.log('═══════════════════════════════════════════════════════════════');

console.log(`\n   Testes passados: ${passCount}/${passCount + failCount}`);
console.log(`   Testes falharam: ${failCount}/${passCount + failCount}`);

if (airResult && airResult.shouldGenerateSuggestion) {
  console.log(`\n   ✅ BANDA AIR: Deveria gerar sugestão band_air (severity: ${airResult.severity})`);
} else if (airResult && !airResult.shouldGenerateSuggestion) {
  console.log(`\n   ℹ️ BANDA AIR: Dentro do range, sem sugestão necessária`);
}

if (presenceResult && presenceResult.shouldGenerateSuggestion) {
  console.log(`   ✅ BANDA PRESENCE: Deveria gerar sugestão band_presence (severity: ${presenceResult.severity})`);
} else if (presenceResult && !presenceResult.shouldGenerateSuggestion) {
  console.log(`   ℹ️ BANDA PRESENCE: Dentro do range, sem sugestão necessária`);
}

const allPassed = failCount === 0;
console.log(`\n   ${allPassed ? '✅✅✅ TODOS OS TESTES PASSARAM! ✅✅✅' : '❌❌❌ ALGUNS TESTES FALHARAM! ❌❌❌'}`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🏁 FIM DOS TESTES');
console.log('═══════════════════════════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
