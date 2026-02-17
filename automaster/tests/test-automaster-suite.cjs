#!/usr/bin/env node
/**
 * AutoMaster V1 - Suite de Testes
 * 
 * Testa todos os componentes do funil AutoMaster:
 *   1. targets-adapter.cjs   — resolução de gênero + targets
 *   2. recommend-mode.cjs    — recomendação determinística
 *   3. master-job.cjs        — PRECHECK + PROCESS
 * 
 * Cada teste valida:
 *   - JSON puro no stdout (sem lixo)
 *   - Contrato de saída (campos obrigatórios)
 *   - Regras de negócio (modo, targets, aptidão)
 * 
 * Uso: node test-automaster-suite.cjs [--with-audio]
 * 
 * Flags:
 *   --with-audio   Inclui testes de processamento real (mais lentos, requer WAV)
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);
const EXEC_OPTS = { maxBuffer: 10 * 1024 * 1024, timeout: 300000 };

// ============================================================================
// TEST FRAMEWORK MÍNIMO
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  return fn()
    .then(() => {
      passedTests++;
      process.stderr.write(`  [PASS] ${name}\n`);
    })
    .catch(error => {
      failedTests++;
      failures.push({ name, error: error.message });
      process.stderr.write(`  [FAIL] ${name}: ${error.message}\n`);
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function assertType(value, type, label) {
  if (typeof value !== type) {
    throw new Error(`${label}: esperado tipo ${type}, recebido ${typeof value}`);
  }
}

function assertIncludes(arr, item, label) {
  if (!Array.isArray(arr) || !arr.includes(item)) {
    throw new Error(`${label}: array não contém "${item}"`);
  }
}

async function execScriptJSON(scriptPath, args = []) {
  try {
    const { stdout } = await execFileAsync('node', [scriptPath, ...args], EXEC_OPTS);
    return { json: JSON.parse(stdout.trim()), exitCode: 0, raw: stdout.trim() };
  } catch (error) {
    // Tentar stdout primeiro, depois stderr (alguns scripts usam console.error)
    const stdoutStr = (error.stdout || '').trim();
    const stderrStr = (error.stderr || '').trim();
    const candidates = [stdoutStr, stderrStr];

    for (const candidate of candidates) {
      if (candidate) {
        try {
          return { json: JSON.parse(candidate), exitCode: error.code || 1, raw: candidate };
        } catch (_) {
          // Não é JSON válido, tentar próximo
        }
      }
    }

    throw new Error(`Script retornou saída inválida. Exit: ${error.code}. Stdout: ${stdoutStr.substring(0, 200)}. Stderr: ${stderrStr.substring(0, 200)}`);
  }
}

function isJSONOnly(raw) {
  // Deve começar com { e terminar com }
  const trimmed = raw.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

// ============================================================================
// PATHS
// ============================================================================

const AUTOMASTER_DIR = path.resolve(__dirname, '..');
const ADAPTER     = path.join(AUTOMASTER_DIR, 'targets-adapter.cjs');
const RECOMMEND   = path.join(AUTOMASTER_DIR, 'recommend-mode.cjs');
const MASTER_JOB  = path.join(AUTOMASTER_DIR, 'master-job.cjs');
const MUSICAS_DIR = path.join(AUTOMASTER_DIR, '..', 'musicas');

// ============================================================================
// TESTES: targets-adapter.cjs
// ============================================================================

async function runAdapterTests() {
  process.stderr.write('\n=== TARGETS-ADAPTER ===\n');

  await test('adapter: trap retorna targetLufs -10.5', async () => {
    const { json, raw } = await execScriptJSON(ADAPTER, ['trap', 'BALANCED']);
    assert(isJSONOnly(raw), 'stdout não é JSON puro');
    assertEqual(json.genreKey, 'trap', 'genreKey');
    assertEqual(json.targetLufs, -10.5, 'targetLufs');
    assertEqual(json.tpCeiling, -1, 'tpCeiling');
    assertEqual(json.mode, 'BALANCED', 'mode');
    assert(!json.isLegacyKey, 'não deve ser legacy');
  });

  await test('adapter: funk_mandela retorna targetLufs -9.2', async () => {
    const { json } = await execScriptJSON(ADAPTER, ['funk_mandela']);
    assertEqual(json.genreKey, 'funk_mandela', 'genreKey');
    assertEqual(json.targetLufs, -9.2, 'targetLufs');
    assertEqual(json.tpCeiling, -1, 'tpCeiling');
  });

  await test('adapter: trance resolve para progressive_trance (legacy)', async () => {
    const { json } = await execScriptJSON(ADAPTER, ['trance', 'STREAMING']);
    assertEqual(json.genreKey, 'progressive_trance', 'genreKey');
    assertEqual(json.genreKeyRequested, 'trance', 'genreKeyRequested');
    assert(json.isLegacyKey, 'deve ser legacy');
    assertEqual(json.mode, 'STREAMING', 'mode');
  });

  await test('adapter: gênero inexistente retorna erro GENRE_NOT_FOUND', async () => {
    const { json, exitCode } = await execScriptJSON(ADAPTER, ['genero_fake']);
    assertEqual(exitCode, 1, 'exit code');
    assert(json.error && json.error.includes('GENRE_NOT_FOUND'), 'deve conter GENRE_NOT_FOUND');
  });

  await test('adapter: tpCeiling é -1.0 para TODOS os modos', async () => {
    for (const mode of ['STREAMING', 'BALANCED', 'IMPACT']) {
      const { json } = await execScriptJSON(ADAPTER, ['trap', mode]);
      assertEqual(json.tpCeiling, -1, `tpCeiling para ${mode}`);
    }
  });

  await test('adapter: modo não altera targetLufs', async () => {
    const results = [];
    for (const mode of ['STREAMING', 'BALANCED', 'IMPACT']) {
      const { json } = await execScriptJSON(ADAPTER, ['edm', mode]);
      results.push(json.targetLufs);
    }
    assertEqual(results[0], results[1], 'STREAMING vs BALANCED');
    assertEqual(results[1], results[2], 'BALANCED vs IMPACT');
  });

  await test('adapter: contrato de saída tem todos os campos', async () => {
    const { json } = await execScriptJSON(ADAPTER, ['house', 'BALANCED']);
    assertType(json.genreKey, 'string', 'genreKey');
    assertType(json.genreKeyRequested, 'string', 'genreKeyRequested');
    assertType(json.isLegacyKey, 'boolean', 'isLegacyKey');
    assertType(json.mode, 'string', 'mode');
    assertType(json.targetLufs, 'number', 'targetLufs');
    assertType(json.tpCeiling, 'number', 'tpCeiling');
    assertType(json.tolerances, 'object', 'tolerances');
    assertType(json.tolerances.lufs, 'number', 'tolerances.lufs');
    assertType(json.tolerances.tp, 'number', 'tolerances.tp');
    assertType(json.source, 'object', 'source');
    assertType(json.source.path, 'string', 'source.path');
  });
}

// ============================================================================
// TESTES: recommend-mode.cjs
// ============================================================================

async function runRecommendTests() {
  process.stderr.write('\n=== RECOMMEND-MODE ===\n');

  await test('recommend: input muito alto → STREAMING', async () => {
    const { json, raw } = await execScriptJSON(RECOMMEND, ['-8.5', '-0.3', '-11']);
    assert(isJSONOnly(raw), 'stdout não é JSON puro');
    assertEqual(json.recommended_mode, 'STREAMING', 'recommended_mode');
    assertIncludes(json.reason_codes, 'VERY_LOUD_INPUT', 'reason_codes');
  });

  await test('recommend: input moderado → BALANCED', async () => {
    const { json } = await execScriptJSON(RECOMMEND, ['-12', '-2.5', '-11']);
    assertEqual(json.recommended_mode, 'BALANCED', 'recommended_mode');
  });

  await test('recommend: input muito dinâmico → BALANCED com nota sobre IMPACT', async () => {
    const { json } = await execScriptJSON(RECOMMEND, ['-18', '-5', '-11']);
    assertEqual(json.recommended_mode, 'BALANCED', 'recommended_mode');
    assertIncludes(json.reason_codes, 'DYNAMIC_MIX', 'reason_codes');
    assertIncludes(json.reason_codes, 'GOOD_HEADROOM', 'reason_codes');
  });

  await test('recommend: low headroom TP → STREAMING', async () => {
    const { json } = await execScriptJSON(RECOMMEND, ['-10.5', '-0.8', '-10.5']);
    assertEqual(json.recommended_mode, 'STREAMING', 'recommended_mode');
    assertIncludes(json.reason_codes, 'LOW_HEADROOM', 'reason_codes');
  });

  await test('recommend: sem args → erro INVALID_ARGS', async () => {
    const { json, exitCode } = await execScriptJSON(RECOMMEND, []);
    assertEqual(exitCode, 1, 'exit code');
    assertEqual(json.error, 'INVALID_ARGS', 'error code');
  });

  await test('recommend: contrato de saída completo', async () => {
    const { json } = await execScriptJSON(RECOMMEND, ['-14', '-3', '-11']);
    assertType(json.recommended_mode, 'string', 'recommended_mode');
    assert(Array.isArray(json.reason_codes), 'reason_codes deve ser array');
    assertType(json.user_copy, 'string', 'user_copy');
    assertType(json.safe_note, 'string', 'safe_note');
    assertType(json.analysis, 'object', 'analysis');
    assertType(json.analysis.lufs_i, 'number', 'analysis.lufs_i');
    assertType(json.analysis.true_peak_db, 'number', 'analysis.true_peak_db');
  });
}

// ============================================================================
// TESTES: master-job.cjs (requer áudio WAV)
// ============================================================================

async function runMasterJobTests() {
  process.stderr.write('\n=== MASTER-JOB ===\n');

  // Verificar se existem arquivos de teste
  const testFile = path.join(MUSICAS_DIR, 'LUZ DO LUAR - DJ Corrêa Original - MASTER.wav');
  const bassFile = path.join(MUSICAS_DIR, 'bass sequencia do soca soca.wav');
  const hasTestAudio = fs.existsSync(testFile);
  const hasBassAudio = fs.existsSync(bassFile);

  if (!hasTestAudio) {
    process.stderr.write('  [SKIP] Áudio de teste não encontrado. Use --with-audio.\n');
    return;
  }

  await test('master-job: CLI sem args → erro', async () => {
    const { json, exitCode } = await execScriptJSON(MASTER_JOB, []);
    assertEqual(exitCode, 1, 'exit code');
    assert(json.error !== undefined, 'deve ter campo error');
  });

  await test('master-job: precheck retorna JSON puro', async () => {
    const { json, raw } = await execScriptJSON(MASTER_JOB, ['precheck', testFile, 'trap', 'BALANCED']);
    assert(isJSONOnly(raw), 'stdout não é JSON puro');
    assertEqual(json.phase, 'PRECHECK', 'phase');
    assertEqual(json.ok, true, 'ok');
  });

  await test('master-job: precheck tem contrato completo', async () => {
    const { json } = await execScriptJSON(MASTER_JOB, ['precheck', testFile, 'trap']);
    assertEqual(json.phase, 'PRECHECK', 'phase');
    assertType(json.genreKey, 'string', 'genreKey');
    assertType(json.targets, 'object', 'targets');
    assertType(json.targets.targetLufs, 'number', 'targets.targetLufs');
    assertType(json.targets.tpCeiling, 'number', 'targets.tpCeiling');
    assertType(json.measured, 'object', 'measured');
    assertType(json.measured.lufs_i, 'number', 'measured.lufs_i');
    assertType(json.measured.true_peak_db, 'number', 'measured.true_peak_db');
    assertType(json.aptitude, 'object', 'aptitude');
    assertType(json.aptitude.isApt, 'boolean', 'aptitude.isApt');
    assertType(json.recommendation, 'object', 'recommendation');
    assertType(json.recommendation.recommended_mode, 'string', 'recommendation.recommended_mode');
    assert(Array.isArray(json.next_actions), 'next_actions deve ser array');
    assertType(json.processing_ms, 'number', 'processing_ms');
  });

  await test('master-job: precheck com gênero inválido → ok false + error', async () => {
    const { json } = await execScriptJSON(MASTER_JOB, ['precheck', testFile, 'genero_fake']);
    assertEqual(json.phase, 'PRECHECK', 'phase');
    assertEqual(json.ok, false, 'ok');
    assert(json.error !== undefined, 'deve ter campo error');
  });

  await test('master-job: precheck com legacy key resolve corretamente', async () => {
    const { json } = await execScriptJSON(MASTER_JOB, ['precheck', testFile, 'trance']);
    assertEqual(json.phase, 'PRECHECK', 'phase');
    assertEqual(json.ok, true, 'ok');
    assertEqual(json.genreKey, 'progressive_trance', 'genreKey resolvido');
    assertEqual(json.isLegacyKey, true, 'isLegacyKey');
  });

  if (hasBassAudio) {
    await test('master-job: precheck com áudio NÃO_APTA → next_actions corretas', async () => {
      const { json } = await execScriptJSON(MASTER_JOB, ['precheck', bassFile, 'funk_mandela', 'IMPACT']);
      assertEqual(json.phase, 'PRECHECK', 'phase');
      assertEqual(json.ok, true, 'ok');
      assertEqual(json.aptitude.isApt, false, 'não deve ser apto');
      assertIncludes(json.next_actions, 'OFFER_RESCUE', 'next_actions');
      assertIncludes(json.next_actions, 'SUGGEST_REUPLOAD', 'next_actions');
    });

    await test('master-job: process sem rescue → NOT_APT (exit 1)', async () => {
      const tmpOut = path.join(MUSICAS_DIR, `_test_norescue_${Date.now()}.wav`);
      const { json, exitCode } = await execScriptJSON(MASTER_JOB, ['process', bassFile, tmpOut, 'funk_mandela', 'BALANCED']);
      assertEqual(json.phase, 'PROCESS', 'phase');
      assertEqual(json.ok, false, 'ok');
      assertEqual(json.status, 'NOT_APT', 'status');
      assertEqual(exitCode, 1, 'exit code');
      // Limpar
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    });
  }
}

// ============================================================================
// TESTES COM PROCESSAMENTO REAL (--with-audio)
// ============================================================================

async function runAudioProcessingTests() {
  process.stderr.write('\n=== PROCESS (ÁUDIO REAL) ===\n');

  const testFile = path.join(MUSICAS_DIR, 'LUZ DO LUAR - DJ Corrêa Original - MASTER.wav');
  const bassFile = path.join(MUSICAS_DIR, 'bass sequencia do soca soca.wav');

  if (!fs.existsSync(testFile)) {
    process.stderr.write('  [SKIP] LUZ DO LUAR não encontrado.\n');
    return;
  }

  await test('process: APTA → DELIVERED_PRIMARY com targets do gênero', async () => {
    const tmpOut = path.join(MUSICAS_DIR, `_test_process_primary_${Date.now()}.wav`);
    try {
      const { json } = await execScriptJSON(MASTER_JOB, ['process', testFile, tmpOut, 'trap', 'BALANCED']);
      assertEqual(json.phase, 'PROCESS', 'phase');
      assertEqual(json.ok, true, 'ok');
      assertEqual(json.status, 'DELIVERED_PRIMARY', 'status');
      assertEqual(json.genreKey, 'trap', 'genreKey');
      assertEqual(json.targets.targetLufs, -10.5, 'targetLufs do gênero');
      assertEqual(json.targets.tpCeiling, -1, 'tpCeiling');
      assertEqual(json.render_count, 1, 'render_count');
      assert(json.summary_user !== undefined, 'deve ter summary_user');
      assertType(json.processing_ms, 'number', 'processing_ms');
      // Verificar que output existe
      assert(fs.existsSync(tmpOut), 'arquivo de saída deve existir');
    } finally {
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
  });

  await test('process: max 2 renders garantido', async () => {
    const tmpOut = path.join(MUSICAS_DIR, `_test_maxrender_${Date.now()}.wav`);
    try {
      const { json } = await execScriptJSON(MASTER_JOB, ['process', testFile, tmpOut, 'trap', 'BALANCED']);
      assert(json.render_count <= 2, `render_count deve ser <= 2, recebido: ${json.render_count}`);
    } finally {
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
  });

  if (fs.existsSync(bassFile)) {
    await test('process: rescue + genre-aware override → DELIVERED', async () => {
      const tmpOut = path.join(MUSICAS_DIR, `_test_rescue_${Date.now()}.wav`);
      try {
        const { json } = await execScriptJSON(MASTER_JOB, ['process', bassFile, tmpOut, 'funk_mandela', 'BALANCED', '--rescue']);
        assertEqual(json.phase, 'PROCESS', 'phase');
        assertEqual(json.ok, true, 'ok');
        assert(json.rescue_used, 'rescue_used deve ser true');
        assert(json.render_count <= 2, `render_count <= 2`);
        assert(json.summary_user !== undefined, 'deve ter summary_user');
      } finally {
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
      }
    });
  }

  await test('process: sample rate preservado (não força 44.1k)', async () => {
    const tmpOut = path.join(MUSICAS_DIR, `_test_sr_${Date.now()}.wav`);
    try {
      const { json } = await execScriptJSON(MASTER_JOB, ['process', testFile, tmpOut, 'trap', 'BALANCED']);
      assertEqual(json.ok, true, 'ok');
      assert(fs.existsSync(tmpOut), 'arquivo deve existir');
      
      // Verificar sample rate do output
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=sample_rate',
        '-of', 'json',
        tmpOut
      ], EXEC_OPTS);
      
      const probeData = JSON.parse(stdout);
      const outSR = parseInt(probeData.streams[0].sample_rate, 10);
      
      // Verificar SR do input
      const { stdout: inStdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=sample_rate',
        '-of', 'json',
        testFile
      ], EXEC_OPTS);
      
      const inProbeData = JSON.parse(inStdout);
      const inSR = parseInt(inProbeData.streams[0].sample_rate, 10);
      
      assertEqual(outSR, inSR, 'sample rate deve ser preservado');
    } finally {
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
  });

  await test('process: contrato JSON inclui measured_by e fix_applied', async () => {
    const tmpOut = path.join(MUSICAS_DIR, `_test_contract_${Date.now()}.wav`);
    try {
      const { json } = await execScriptJSON(MASTER_JOB, ['process', testFile, tmpOut, 'trap', 'STREAMING']);
      assertEqual(json.ok, true, 'ok');
      
      // Verificar campos das attempts
      assert(Array.isArray(json.attempts), 'attempts deve ser array');
      assert(json.attempts.length > 0, 'deve ter pelo menos 1 attempt');
      
      const firstAttempt = json.attempts[0];
      assert(firstAttempt.result !== undefined, 'attempt deve ter result');
      
      // O automaster-v1.cjs retorna measured_by e fix_applied
      if (firstAttempt.result.measured_by !== undefined) {
        assertEqual(firstAttempt.result.measured_by, 'measure-audio', 'measured_by');
      }
      
      assertType(firstAttempt.result.fix_applied, 'boolean', 'fix_applied');
    } finally {
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
  });
}

// ============================================================================
// RUNNER
// ============================================================================

async function main() {
  const withAudio = process.argv.includes('--with-audio');

  process.stderr.write('=== AutoMaster V1 - Suite de Testes ===\n');

  // Testes unitários (sem áudio, rápidos)
  await runAdapterTests();
  await runRecommendTests();

  // Testes de integração (requer áudio)
  await runMasterJobTests();

  // Testes de processamento real (lentos, opcional)
  if (withAudio) {
    await runAudioProcessingTests();
  } else {
    process.stderr.write('\n[INFO] Use --with-audio para testes de processamento real.\n');
  }

  // Resultado final (JSON no stdout)
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
