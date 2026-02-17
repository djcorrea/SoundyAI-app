#!/usr/bin/env node
/**
 * AutoMaster V1 - Testes de Consistência de Targets
 * 
 * OBJETIVO: Garantir que targets vêm do JSON e modo não altera targets.
 * 
 * Testes:
 *   1. Targets carregados do JSON (não hardcode)
 *   2. Modo não altera targetLufs ou tpCeiling
 *   3. Todos os modos retornam os mesmos targets
 *   4. Targets são preservados em resolveProcessingTargets
 *   5. Processing profiles existem para todos os modos
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Módulos a testar
const { getMasterTargets, VALID_MODES: ADAPTER_MODES } = require('../targets-adapter.cjs');
const { 
  getProcessingProfile, 
  resolveProcessingTargets, 
  validateTargetsPreserved,
  VALID_MODES: PROFILE_MODES
} = require('../processing-profiles.cjs');

// ============================================================
// HELPERS DE TESTE
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    process.stderr.write(`  [PASS] ${name}\n`);
  } catch (error) {
    failedTests++;
    failures.push({ test: name, error: error.message });
    process.stderr.write(`  [FAIL] ${name}\n         ${error.message}\n`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertType(value, type, label) {
  if (typeof value !== type) {
    throw new Error(`${label} deve ser ${type}, recebido ${typeof value}`);
  }
}

// ============================================================
// TESTES: TARGETS-ADAPTER
// ============================================================

async function testTargetsAdapter() {
  process.stderr.write('\n=== TARGETS-ADAPTER ===\n');

  await test('adapter: carrega targets de work/refs/out', async () => {
    const result = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    
    // Verificar que source aponta para work/refs/out
    assertTrue(
      result.source.path.includes('work\\refs\\out') || result.source.path.includes('work/refs/out'),
      `Source path deve incluir work/refs/out: ${result.source.path}`
    );
    
    // Verificar que arquivo existe
    assertTrue(
      fs.existsSync(result.source.path),
      `Arquivo de source deve existir: ${result.source.path}`
    );
  });

  await test('adapter: targetLufs vem do JSON (não hardcode)', async () => {
    const result = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    
    // Ler o JSON diretamente
    const jsonPath = result.source.path;
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    const genreData = data[result.genreKey];
    
    const jsonLufs = genreData.lufs_target || 
                     genreData.legacy_compatibility?.lufs_target;
    
    assertEqual(
      result.targetLufs,
      jsonLufs,
      'targetLufs deve ser exatamente o valor do JSON'
    );
  });

  await test('adapter: modo NÃO altera targetLufs', async () => {
    const streaming = await getMasterTargets({ genreKey: 'trap', mode: 'STREAMING' });
    const balanced = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    const impact = await getMasterTargets({ genreKey: 'trap', mode: 'IMPACT' });
    
    assertEqual(
      streaming.targetLufs,
      balanced.targetLufs,
      'STREAMING e BALANCED devem ter mesmo targetLufs'
    );
    
    assertEqual(
      balanced.targetLufs,
      impact.targetLufs,
      'BALANCED e IMPACT devem ter mesmo targetLufs'
    );
  });

  await test('adapter: modo NÃO altera tpCeiling', async () => {
    const streaming = await getMasterTargets({ genreKey: 'trap', mode: 'STREAMING' });
    const balanced = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    const impact = await getMasterTargets({ genreKey: 'trap', mode: 'IMPACT' });
    
    assertEqual(
      streaming.tpCeiling,
      balanced.tpCeiling,
      'STREAMING e BALANCED devem ter mesmo tpCeiling'
    );
    
    assertEqual(
      balanced.tpCeiling,
      impact.tpCeiling,
      'BALANCED e IMPACT devem ter mesmo tpCeiling'
    );
  });

  await test('adapter: tpCeiling sempre -1.0 (V1)', async () => {
    const result = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    
    assertEqual(
      result.tpCeiling,
      -1.0,
      'tpCeiling deve ser -1.0 (decisão de arquitetura V1)'
    );
  });

  await test('adapter: resolve legacy keys corretamente', async () => {
    // trance é legacy key de progressive_trance
    const result = await getMasterTargets({ genreKey: 'trance', mode: 'BALANCED' });
    
    assertEqual(
      result.genreKey,
      'progressive_trance',
      'trance deve resolver para progressive_trance'
    );
    
    assertTrue(
      result.isLegacyKey === true,
      'isLegacyKey deve ser true'
    );
  });

  await test('adapter: erro se gênero não existe', async () => {
    try {
      await getMasterTargets({ genreKey: 'genero_inexistente', mode: 'BALANCED' });
      throw new Error('Deveria ter lançado erro');
    } catch (error) {
      assertTrue(
        error.message.includes('GENRE_NOT_FOUND'),
        'Erro deve incluir GENRE_NOT_FOUND'
      );
    }
  });
}

// ============================================================
// TESTES: PROCESSING-PROFILES
// ============================================================

async function testProcessingProfiles() {
  process.stderr.write('\n=== PROCESSING-PROFILES ===\n');

  await test('profiles: todos os modos têm perfil definido', async () => {
    const modes = ['STREAMING', 'BALANCED', 'IMPACT'];
    
    modes.forEach(mode => {
      const profile = getProcessingProfile(mode);
      assertType(profile, 'object', `Perfil de ${mode}`);
      assertEqual(profile.mode, mode, `mode do perfil`);
    });
  });

  await test('profiles: STREAMING tem limiter suave', async () => {
    const profile = getProcessingProfile('STREAMING');
    
    assertEqual(profile.limiter.profile, 'soft', 'limiter profile');
    assertTrue(
      profile.limiter.attack_ms > 5,
      'attack_ms deve ser maior que padrão (5ms)'
    );
  });

  await test('profiles: STREAMING sem saturação', async () => {
    const profile = getProcessingProfile('STREAMING');
    
    assertEqual(profile.saturation.enabled, false, 'saturation enabled');
    assertEqual(profile.saturation.intensity, 0.0, 'saturation intensity');
  });

  await test('profiles: BALANCED tem configuração equilibrada', async () => {
    const profile = getProcessingProfile('BALANCED');
    
    assertEqual(profile.limiter.profile, 'balanced', 'limiter profile');
    assertEqual(profile.saturation.enabled, true, 'saturation enabled');
    assertTrue(
      profile.saturation.intensity > 0 && profile.saturation.intensity < 0.5,
      'saturation intensity deve ser leve (0-0.5)'
    );
  });

  await test('profiles: IMPACT tem configuração agressiva', async () => {
    const profile = getProcessingProfile('IMPACT');
    
    assertEqual(profile.limiter.profile, 'aggressive', 'limiter profile');
    assertEqual(profile.saturation.enabled, true, 'saturation enabled');
    assertTrue(
      profile.saturation.intensity >= 0.5,
      'saturation intensity deve ser moderada (>=0.5)'
    );
  });

  await test('profiles: erro se modo inválido', async () => {
    try {
      getProcessingProfile('MODO_INVALIDO');
      throw new Error('Deveria ter lançado erro');
    } catch (error) {
      assertTrue(
        error.message.includes('INVALID_MODE'),
        'Erro deve incluir INVALID_MODE'
      );
    }
  });
}

// ============================================================
// TESTES: INTEGRAÇÃO TARGETS + PROFILES
// ============================================================

async function testIntegration() {
  process.stderr.write('\n=== INTEGRAÇÃO ===\n');

  await test('integração: resolveProcessingTargets preserva targetLufs', async () => {
    const genreTargets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    const resolved = resolveProcessingTargets(genreTargets, 'BALANCED');
    
    assertEqual(
      resolved.targets.lufs,
      genreTargets.targetLufs,
      'targets.lufs deve ser igual a genreTargets.targetLufs'
    );
  });

  await test('integração: resolveProcessingTargets preserva tpCeiling', async () => {
    const genreTargets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    const resolved = resolveProcessingTargets(genreTargets, 'BALANCED');
    
    assertEqual(
      resolved.targets.true_peak,
      genreTargets.tpCeiling,
      'targets.true_peak deve ser igual a genreTargets.tpCeiling'
    );
  });

  await test('integração: trocar modo NÃO altera targets', async () => {
    const genreTargets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    
    const streaming = resolveProcessingTargets(genreTargets, 'STREAMING');
    const balanced = resolveProcessingTargets(genreTargets, 'BALANCED');
    const impact = resolveProcessingTargets(genreTargets, 'IMPACT');
    
    // Todos devem ter os mesmos targets
    assertEqual(streaming.targets.lufs, balanced.targets.lufs, 'LUFS STREAMING vs BALANCED');
    assertEqual(balanced.targets.lufs, impact.targets.lufs, 'LUFS BALANCED vs IMPACT');
    assertEqual(streaming.targets.true_peak, balanced.targets.true_peak, 'TP STREAMING vs BALANCED');
    assertEqual(balanced.targets.true_peak, impact.targets.true_peak, 'TP BALANCED vs IMPACT');
  });

  await test('integração: trocar modo ALTERA comportamento de limiter', async () => {
    const genreTargets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    
    const streaming = resolveProcessingTargets(genreTargets, 'STREAMING');
    const impact = resolveProcessingTargets(genreTargets, 'IMPACT');
    
    // Limiter profiles devem ser diferentes
    assertTrue(
      streaming.processing.limiter.profile !== impact.processing.limiter.profile,
      'Limiter profiles devem ser diferentes entre STREAMING e IMPACT'
    );
    
    // Attack times devem ser diferentes
    assertTrue(
      streaming.processing.limiter.attack_ms !== impact.processing.limiter.attack_ms,
      'Attack times devem ser diferentes'
    );
  });

  await test('integração: validateTargetsPreserved detecta mutação', async () => {
    const genreTargets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
    const resolved = resolveProcessingTargets(genreTargets, 'BALANCED');
    
    // Validação deve passar
    const valid = validateTargetsPreserved(genreTargets, resolved);
    assertEqual(valid, true, 'validateTargetsPreserved deve retornar true');
    
    // Simular mutação
    const mutated = { ...resolved };
    mutated.targets.lufs = -99; // valor errado
    
    try {
      validateTargetsPreserved(genreTargets, mutated);
      throw new Error('Deveria ter detectado mutação');
    } catch (error) {
      assertTrue(
        error.message.includes('TARGET_MUTATION_DETECTED'),
        'Erro deve incluir TARGET_MUTATION_DETECTED'
      );
    }
  });
}

// ============================================================
// TESTES: MÚLTIPLOS GÊNEROS
// ============================================================

async function testMultipleGenres() {
  process.stderr.write('\n=== MÚLTIPLOS GÊNEROS ===\n');

  const testGenres = ['trap', 'funk_mandela', 'funk_bruxaria', 'tech_house'];

  for (const genre of testGenres) {
    await test(`gênero ${genre}: targets carregados corretamente`, async () => {
      const result = await getMasterTargets({ genreKey: genre, mode: 'BALANCED' });
      
      assertType(result.targetLufs, 'number', 'targetLufs');
      assertTrue(!isNaN(result.targetLufs), 'targetLufs não pode ser NaN');
      assertType(result.tpCeiling, 'number', 'tpCeiling');
    });

    await test(`gênero ${genre}: modo não altera targets`, async () => {
      const balanced = await getMasterTargets({ genreKey: genre, mode: 'BALANCED' });
      const impact = await getMasterTargets({ genreKey: genre, mode: 'IMPACT' });
      
      assertEqual(balanced.targetLufs, impact.targetLufs, 'targetLufs');
      assertEqual(balanced.tpCeiling, impact.tpCeiling, 'tpCeiling');
    });
  }
}

// ============================================================
// TESTES: COMPATIBILIDADE
// ============================================================

async function testCompatibility() {
  process.stderr.write('\n=== COMPATIBILIDADE ===\n');

  await test('compatibilidade: VALID_MODES consistente', async () => {
    // targets-adapter e processing-profiles devem ter os mesmos modos
    assertEqual(
      ADAPTER_MODES.length,
      PROFILE_MODES.length,
      'Número de modos deve ser igual'
    );
    
    ADAPTER_MODES.forEach(mode => {
      assertTrue(
        PROFILE_MODES.includes(mode),
        `Modo ${mode} deve existir em processing-profiles`
      );
    });
  });

  await test('compatibilidade: nenhum valor hardcoded de LUFS', async () => {
    // Verificar que automaster-v1.cjs não tem mais LUFS_MIN/LUFS_MAX
    const autoasterPath = path.resolve(__dirname, '..', 'automaster-v1.cjs');
    const content = fs.readFileSync(autoasterPath, 'utf-8');
    
    assertTrue(
      !content.includes('LUFS_MIN') && !content.includes('LUFS_MAX'),
      'automaster-v1.cjs não deve ter LUFS_MIN ou LUFS_MAX hardcoded'
    );
  });

  await test('compatibilidade: nenhum valor hardcoded de TP limites', async () => {
    const autoasterPath = path.resolve(__dirname, '..', 'automaster-v1.cjs');
    const content = fs.readFileSync(autoasterPath, 'utf-8');
    
    assertTrue(
      !content.includes('CEILING_MIN') && !content.includes('CEILING_MAX'),
      'automaster-v1.cjs não deve ter CEILING_MIN ou CEILING_MAX hardcoded'
    );
  });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  process.stderr.write('=== AutoMaster V1 - Testes de Consistência de Targets ===\n');

  await testTargetsAdapter();
  await testProcessingProfiles();
  await testIntegration();
  await testMultipleGenres();
  await testCompatibility();

  // Resultado final
  const result = {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    failures,
    all_passed: failedTests === 0
  };

  process.stderr.write(`\n=== RESULTADO: ${passedTests}/${totalTests} passed, ${failedTests} failed ===\n`);
  console.log(JSON.stringify(result));

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(JSON.stringify({ error: 'TEST_FATAL', message: error.message }));
  process.exit(1);
});
