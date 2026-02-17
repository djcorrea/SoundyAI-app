#!/usr/bin/env node
/**
 * AutoMaster V1 - Master Job (Orquestrador)
 * 
 * ORQUESTRA O FUNIL COMPLETO:
 *   Phase A (PRECHECK): Análise rápida, sem processar, sem crédito.
 *   Phase C (PROCESS): Masterização real, consome crédito.
 * 
 * Phase A retorna:
 *   - Métricas medidas (LUFS-I, TP)
 *   - Targets do gênero (via targets-adapter, somente leitura)
 *   - Gate de aptidão (check-aptitude)
 *   - Recomendação de modo (recommend-mode)
 *   - next_actions para o frontend
 * 
 * Phase C retorna:
 *   - output masterizado
 *   - summary_user com cópia amigável
 *   - max 2 renders (primary + CLEAN fallback)
 * 
 * Regras:
 *   - stdout = JSON puro (SEMPRE)
 *   - TP ceiling fixo -1.0 dBTP para TODOS os modos
 *   - Modo NÃO altera targets do gênero (só estratégia DSP)
 *   - NÃO altera refs/out, NÃO altera analisador, NÃO altera scoring
 *   - Max 2 renders por job
 * 
 * Uso CLI:
 *   node master-job.cjs precheck <inputPath> <genreKey> [mode]
 *   node master-job.cjs process <inputPath> <outputPath> <genreKey> <mode> [--rescue]
 * 
 * Uso Programático:
 *   const { runPrecheck, runProcess } = require('./master-job.cjs');
 *   const precheck = await runPrecheck({ inputPath, genreKey, mode });
 *   const result = await runProcess({ inputPath, outputPath, genreKey, mode, rescue: true });
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

// ============================================================================
// CONSTANTES
// ============================================================================

const TP_CEILING = -1.0; // dBTP fixo para TODOS os modos (V1)
const VALID_MODES = ['STREAMING', 'BALANCED', 'IMPACT'];
const MAX_RENDERS = 2; // primary + CLEAN fallback

// Caminhos dos scripts (todos no mesmo diretório)
const SCRIPTS = {
  measureAudio:   path.resolve(__dirname, 'measure-audio.cjs'),
  checkAptitude:  path.resolve(__dirname, 'check-aptitude.cjs'),
  rescueMode:     path.resolve(__dirname, 'rescue-mode.cjs'),
  postcheck:      path.resolve(__dirname, 'postcheck-audio.cjs'),
  core:           path.resolve(__dirname, 'automaster-v1.cjs'),
};

// Dependências programáticas (sem subprocess)
const { getMasterTargets } = require('./targets-adapter.cjs');
const { recommendMode }    = require('./recommend-mode.cjs');

// ============================================================================
// HELPERS: EXECUÇÃO DE CHILD PROCESSES (JSON-only)
// ============================================================================

const EXEC_OPTS = { maxBuffer: 10 * 1024 * 1024, timeout: 300000 };

/**
 * Executa um script child e parseia JSON do stdout.
 * Trata exit code 1 que retorna JSON válido no stdout (ex: check-aptitude NÃO_APTA).
 */
async function execScript(scriptPath, args = []) {
  try {
    const { stdout } = await execFileAsync('node', [scriptPath, ...args], EXEC_OPTS);
    return JSON.parse(stdout.trim());
  } catch (error) {
    // Alguns scripts usam exit(1) mas retornam JSON no stdout (ex: check-aptitude)
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch (_) {
        // Não é JSON válido — propagar erro original
      }
    }
    throw new Error(`Script falhou [${path.basename(scriptPath)}]: ${error.message}`);
  }
}

// ============================================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================================

function validateInputFile(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('INPUT_INVALID: inputPath deve ser uma string válida');
  }

  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`FILE_NOT_FOUND: ${resolved}`);
  }

  if (!fs.statSync(resolved).isFile()) {
    throw new Error(`NOT_A_FILE: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.wav') {
    throw new Error(`FORMAT_INVALID: apenas WAV suportado (recebido: ${ext})`);
  }

  return resolved;
}

function validateOutputPath(outputPath) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('OUTPUT_INVALID: outputPath deve ser uma string válida');
  }

  const resolved = path.resolve(outputPath);
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.wav') {
    throw new Error(`OUTPUT_FORMAT_INVALID: apenas WAV suportado (recebido: ${ext})`);
  }

  // Garantir que diretório de saída existe
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return resolved;
}

function validateMode(mode) {
  if (!mode) return 'BALANCED'; // default

  const upper = mode.toUpperCase();
  if (!VALID_MODES.includes(upper)) {
    throw new Error(`MODE_INVALID: "${mode}". Valores: ${VALID_MODES.join(', ')}`);
  }
  return upper;
}

function validateGenreKey(genreKey) {
  if (!genreKey || typeof genreKey !== 'string' || genreKey.trim().length === 0) {
    throw new Error('GENRE_INVALID: genreKey é obrigatório');
  }
  return genreKey.toLowerCase().trim();
}

// ============================================================================
// PHASE A: PRECHECK (sem crédito, sem processamento)
// ============================================================================

/**
 * Executa PRECHECK: análise rápida sem processar áudio.
 * Retorna métricas, targets, aptidão, recomendação e next_actions.
 * 
 * @param {Object} params
 * @param {string} params.inputPath - Caminho do WAV
 * @param {string} params.genreKey - Chave do gênero
 * @param {string} [params.mode="BALANCED"] - Modo preferido (para referência)
 * @returns {Promise<Object>} Resultado do precheck
 */
async function runPrecheck({ inputPath, genreKey, mode = 'BALANCED' }) {
  const startTime = Date.now();

  // 1. VALIDAÇÃO
  const resolvedInput = validateInputFile(inputPath);
  const validGenre = validateGenreKey(genreKey);
  const validMode = validateMode(mode);

  // 2. TARGETS DO GÊNERO (via adapter, somente leitura)
  let targets;
  try {
    targets = await getMasterTargets({ genreKey: validGenre, mode: validMode });
  } catch (error) {
    return {
      phase: 'PRECHECK',
      ok: false,
      error: 'GENRE_TARGETS_ERROR',
      message: error.message,
      genreKey: validGenre,
      processing_ms: Date.now() - startTime
    };
  }

  // 3. MEDIÇÃO (via child process — JSON puro)
  let measured;
  try {
    measured = await execScript(SCRIPTS.measureAudio, [resolvedInput]);
  } catch (error) {
    return {
      phase: 'PRECHECK',
      ok: false,
      error: 'MEASUREMENT_FAILED',
      message: error.message,
      genreKey: validGenre,
      targets: { targetLufs: targets.targetLufs, tpCeiling: targets.tpCeiling },
      processing_ms: Date.now() - startTime
    };
  }

  // 4. GATE DE APTIDÃO (usa targetLufs do gênero, não do modo)
  let aptitude;
  try {
    aptitude = await execScript(SCRIPTS.checkAptitude, [
      measured.lufs_i.toString(),
      measured.true_peak_db.toString(),
      targets.targetLufs.toString()
    ]);
  } catch (error) {
    return {
      phase: 'PRECHECK',
      ok: false,
      error: 'APTITUDE_CHECK_FAILED',
      message: error.message,
      genreKey: validGenre,
      measured,
      targets: { targetLufs: targets.targetLufs, tpCeiling: targets.tpCeiling },
      processing_ms: Date.now() - startTime
    };
  }

  // 5. RECOMENDAÇÃO DE MODO (determinística, sem IA)
  const recommendation = recommendMode(
    { lufs_i: measured.lufs_i, true_peak_db: measured.true_peak_db },
    targets.targetLufs
  );

  // 6. MONTAR next_actions PARA O FRONTEND
  const next_actions = [];

  if (aptitude.isApt) {
    next_actions.push('CONFIRM_MODE');
    next_actions.push('START_PROCESS');
  } else {
    next_actions.push('OFFER_RESCUE');
    next_actions.push('SUGGEST_REUPLOAD');
  }

  // 7. RESULTADO FINAL
  return {
    phase: 'PRECHECK',
    ok: true,
    genreKey: targets.genreKey,
    genreKeyRequested: targets.genreKeyRequested,
    isLegacyKey: targets.isLegacyKey,
    mode: validMode,
    targets: {
      targetLufs: targets.targetLufs,
      tpCeiling: targets.tpCeiling,
      tolerances: targets.tolerances,
      source: targets.source
    },
    measured: {
      lufs_i: measured.lufs_i,
      true_peak_db: measured.true_peak_db
    },
    aptitude: {
      isApt: aptitude.isApt,
      reasons: aptitude.reasons || [],
      recommended_actions: aptitude.recommended_actions || []
    },
    recommendation: {
      recommended_mode: recommendation.recommended_mode,
      reason_codes: recommendation.reason_codes,
      user_copy: recommendation.user_copy,
      safe_note: recommendation.safe_note
    },
    next_actions,
    processing_ms: Date.now() - startTime
  };
}

// ============================================================================
// PHASE C: PROCESS (consome crédito, max 2 renders)
// ============================================================================

/**
 * Executa PROCESS: masterização real com targets do gênero.
 * Consome crédito. Max 2 renders (primary + CLEAN fallback).
 * 
 * @param {Object} params
 * @param {string} params.inputPath - WAV de entrada
 * @param {string} params.outputPath - WAV de saída
 * @param {string} params.genreKey - Chave do gênero
 * @param {string} params.mode - Modo confirmado pelo usuário
 * @param {boolean} [params.rescue=false] - Permitir rescue mode
 * @returns {Promise<Object>} Resultado do processamento
 */
async function runProcess({ inputPath, outputPath, genreKey, mode, rescue = false }) {
  const startTime = Date.now();
  let renderCount = 0;
  const attempts = [];

  // 1. VALIDAÇÃO
  const resolvedInput = validateInputFile(inputPath);
  const resolvedOutput = validateOutputPath(outputPath);
  const validGenre = validateGenreKey(genreKey);
  const validMode = validateMode(mode);

  // 2. TARGETS DO GÊNERO (via adapter, somente leitura)
  let targets;
  try {
    targets = await getMasterTargets({ genreKey: validGenre, mode: validMode });
  } catch (error) {
    return {
      phase: 'PROCESS',
      ok: false,
      error: 'GENRE_TARGETS_ERROR',
      message: error.message,
      genreKey: validGenre,
      mode: validMode,
      processing_ms: Date.now() - startTime
    };
  }

  const targetLufs = targets.targetLufs;
  const tpCeiling = targets.tpCeiling; // sempre -1.0

  // 3. MEDIÇÃO INICIAL
  let measured;
  try {
    measured = await execScript(SCRIPTS.measureAudio, [resolvedInput]);
  } catch (error) {
    return {
      phase: 'PROCESS',
      ok: false,
      error: 'MEASUREMENT_FAILED',
      message: error.message,
      genreKey: targets.genreKey,
      mode: validMode,
      processing_ms: Date.now() - startTime
    };
  }

  // 4. GATE DE APTIDÃO (targetLufs do gênero)
  let aptitude;
  try {
    aptitude = await execScript(SCRIPTS.checkAptitude, [
      measured.lufs_i.toString(),
      measured.true_peak_db.toString(),
      targetLufs.toString()
    ]);
  } catch (error) {
    return {
      phase: 'PROCESS',
      ok: false,
      error: 'APTITUDE_CHECK_FAILED',
      message: error.message,
      genreKey: targets.genreKey,
      mode: validMode,
      measured,
      processing_ms: Date.now() - startTime
    };
  }

  // 5. SE NÃO APTA: RESCUE OU ABORT
  let rescueResult = null;
  let inputForMaster = resolvedInput;

  if (!aptitude.isApt) {
    if (!rescue) {
      // Sem rescue → abort
      return {
        phase: 'PROCESS',
        ok: false,
        status: 'NOT_APT',
        error: 'AUDIO_NOT_APT',
        message: 'Áudio não aprovado no gate de aptidão. Rescue mode não autorizado.',
        genreKey: targets.genreKey,
        mode: validMode,
        measured,
        aptitude: {
          isApt: false,
          reasons: aptitude.reasons,
          recommended_actions: aptitude.recommended_actions
        },
        processing_ms: Date.now() - startTime
      };
    }

    // Rescue mode
    const inputDir = path.dirname(resolvedInput);
    const inputName = path.basename(resolvedInput, path.extname(resolvedInput));
    const rescueTmpPath = path.join(inputDir, `${inputName}_rescue_tmp.wav`);

    try {
      rescueResult = await execScript(SCRIPTS.rescueMode, [resolvedInput, rescueTmpPath]);
    } catch (error) {
      return {
        phase: 'PROCESS',
        ok: false,
        error: 'RESCUE_FAILED',
        message: error.message,
        genreKey: targets.genreKey,
        mode: validMode,
        measured,
        processing_ms: Date.now() - startTime
      };
    }

    if (rescueResult.status === 'ABORT_UNSAFE_INPUT') {
      return {
        phase: 'PROCESS',
        ok: false,
        status: 'ABORT_UNSAFE',
        error: 'RESCUE_ABORT',
        message: rescueResult.message || 'Rescue mode não conseguiu corrigir. Re-envie um pré-master sem processamento.',
        genreKey: targets.genreKey,
        mode: validMode,
        measured,
        rescue_details: rescueResult,
        processing_ms: Date.now() - startTime
      };
    }

    if (rescueResult.status === 'RESCUED' && rescueResult.output_path) {
      inputForMaster = rescueResult.output_path;
    }
    // ALREADY_SAFE → continue com input original
  }

  // 6. RENDER PRIMÁRIO (automaster-v1.cjs direto com targets do gênero)
  let primaryResult;
  try {
    renderCount++;
    primaryResult = await execScript(SCRIPTS.core, [
      inputForMaster,
      resolvedOutput,
      targetLufs.toString(),
      tpCeiling.toString()
    ]);
  } catch (error) {
    cleanupTempFiles(rescueResult);
    return {
      phase: 'PROCESS',
      ok: false,
      error: 'MASTER_FAILED',
      message: error.message,
      genreKey: targets.genreKey,
      mode: validMode,
      render_count: renderCount,
      processing_ms: Date.now() - startTime
    };
  }

  // 7. POSTCHECK DO RENDER PRIMÁRIO
  let postcheck1;
  try {
    postcheck1 = await execScript(SCRIPTS.postcheck, [resolvedOutput, validMode]);
  } catch (error) {
    cleanupTempFiles(rescueResult);
    return {
      phase: 'PROCESS',
      ok: false,
      error: 'POSTCHECK_FAILED',
      message: error.message,
      genreKey: targets.genreKey,
      mode: validMode,
      render_count: renderCount,
      processing_ms: Date.now() - startTime
    };
  }

  const attempt1 = {
    type: 'PRIMARY',
    strategy: null,
    target_lufs: targetLufs,
    tp_ceiling: tpCeiling,
    result: primaryResult,
    postcheck: postcheck1
  };
  attempts.push(attempt1);

  // Genre-aware override: o postcheck usa MODE_TARGETS, mas nós usamos genre targets.
  // Se tier1 passou (segurança) e LUFS final está dentro da tolerância do genre target,
  // sobrescrevemos a decisão do postcheck sem modificar o script existente.
  const postcheck1Action = applyGenreAwareOverride(postcheck1, targetLufs, targets.tolerances);

  // Se OK → entregar
  if (postcheck1Action === 'OK') {
    cleanupTempFiles(rescueResult);
    return buildSuccessResult({
      mode: validMode,
      genreKey: targets.genreKey,
      targets,
      measured,
      aptitude,
      rescueResult,
      attempts,
      renderCount,
      resolvedInput,
      resolvedOutput,
      finalDecision: 'DELIVERED_PRIMARY',
      startTime
    });
  }

  // 8. FALLBACK CLEAN (se postcheck sugere e render < MAX_RENDERS)
  if (postcheck1Action === 'FALLBACK_CLEAN' && renderCount < MAX_RENDERS) {
    let cleanResult;
    try {
      renderCount++;
      cleanResult = await execScript(SCRIPTS.core, [
        inputForMaster,
        resolvedOutput,
        targetLufs.toString(),
        tpCeiling.toString(),
        'CLEAN'
      ]);
    } catch (error) {
      cleanupTempFiles(rescueResult);
      return {
        phase: 'PROCESS',
        ok: false,
        error: 'CLEAN_FALLBACK_FAILED',
        message: error.message,
        genreKey: targets.genreKey,
        mode: validMode,
        render_count: renderCount,
        attempts,
        processing_ms: Date.now() - startTime
      };
    }

    // Postcheck do CLEAN
    let postcheck2;
    try {
      postcheck2 = await execScript(SCRIPTS.postcheck, [resolvedOutput, validMode]);
    } catch (error) {
      cleanupTempFiles(rescueResult);
      return {
        phase: 'PROCESS',
        ok: false,
        error: 'POSTCHECK_CLEAN_FAILED',
        message: error.message,
        genreKey: targets.genreKey,
        mode: validMode,
        render_count: renderCount,
        attempts,
        processing_ms: Date.now() - startTime
      };
    }

    const attempt2 = {
      type: 'CLEAN_FALLBACK',
      strategy: 'CLEAN',
      target_lufs: targetLufs,
      tp_ceiling: tpCeiling,
      result: cleanResult,
      postcheck: postcheck2
    };
    attempts.push(attempt2);

    const postcheck2Action = applyGenreAwareOverride(postcheck2, targetLufs, targets.tolerances);

    if (postcheck2Action === 'OK') {
      cleanupTempFiles(rescueResult);
      return buildSuccessResult({
        mode: validMode,
        genreKey: targets.genreKey,
        targets,
        measured,
        aptitude,
        rescueResult,
        attempts,
        renderCount,
        resolvedInput,
        resolvedOutput,
        finalDecision: 'DELIVERED_CLEAN',
        startTime
      });
    }
  }

  // 9. ABORT — todos os renders falharam
  cleanupTempFiles(rescueResult);
  return {
    phase: 'PROCESS',
    ok: false,
    status: 'QUALITY_FAILED',
    error: 'ALL_RENDERS_FAILED',
    message: `Nenhum dos ${renderCount} renders passou no postcheck. Arquivo pode precisar de ajustes manuais.`,
    genreKey: targets.genreKey,
    mode: validMode,
    measured,
    render_count: renderCount,
    attempts,
    processing_ms: Date.now() - startTime
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Override genre-aware para o postcheck.
 * 
 * O postcheck usa MODE_TARGETS (BALANCED=-11, etc.) internamente.
 * Quando usamos genre targets (ex: funk_mandela=-9.2), o postcheck pode flagear
 * uma diferença que não existe (LUFS -9.2 vs mode target -11 = 1.8 LU gap).
 * 
 * Este override:
 *   1. Respeita tier1 do postcheck (segurança: clipping, DR) — NUNCA sobrescreve ABORT
 *   2. Se tier1 OK e LUFS final dentro da tolerância do genre target → OK
 *   3. Caso contrário → mantém decisão original do postcheck
 * 
 * NÃO modifica o postcheck.cjs existente.
 */
function applyGenreAwareOverride(postcheck, genreTargetLufs, tolerances) {
  if (!postcheck) return 'ABORT';

  // Se já é OK, manter
  if (postcheck.recommended_action === 'OK') return 'OK';

  // Se ABORT (tier1 falhou), NUNCA sobrescrever — segurança primeiro
  if (postcheck.recommended_action === 'ABORT') return 'ABORT';

  // Se FALLBACK_CLEAN e tier1 OK, verificar se LUFS está dentro do genre target
  if (postcheck.recommended_action === 'FALLBACK_CLEAN' && postcheck.tiers && postcheck.tiers.tier1_pass) {
    const lufs = postcheck.metrics && postcheck.metrics.lufs_i;
    if (lufs !== null && lufs !== 'not_available' && typeof lufs === 'number') {
      const diff = Math.abs(lufs - genreTargetLufs);
      const tolLufs = (tolerances && tolerances.lufs) || 1.5;

      if (diff <= tolLufs) {
        // LUFS dentro da tolerância do gênero — o postcheck errou por usar mode target
        return 'OK';
      }
    }
  }

  // Manter decisão original
  return postcheck.recommended_action;
}

/**
 * Monta resultado de sucesso padronizado.
 */
function buildSuccessResult({ mode, genreKey, targets, measured, aptitude, rescueResult, attempts, renderCount, resolvedInput, resolvedOutput, finalDecision, startTime }) {
  const lastAttempt = attempts[attempts.length - 1];
  const finalMetrics = lastAttempt && lastAttempt.postcheck && lastAttempt.postcheck.metrics
    ? lastAttempt.postcheck.metrics
    : null;

  return {
    phase: 'PROCESS',
    ok: true,
    status: finalDecision,
    mode,
    genreKey,
    targets: {
      targetLufs: targets.targetLufs,
      tpCeiling: targets.tpCeiling
    },
    input: resolvedInput,
    output: resolvedOutput,
    measured_input: {
      lufs_i: measured.lufs_i,
      true_peak_db: measured.true_peak_db
    },
    aptitude: {
      isApt: aptitude.isApt,
      reasons: aptitude.reasons || []
    },
    rescue_used: rescueResult !== null,
    rescue_details: rescueResult,
    render_count: renderCount,
    attempts,
    final_metrics: finalMetrics,
    summary_user: buildUserSummary({ mode, genreKey, targets, measured, finalDecision, finalMetrics }),
    processing_ms: Date.now() - startTime
  };
}

/**
 * Gera resumo amigável para o usuário.
 */
function buildUserSummary({ mode, genreKey, targets, measured, finalDecision, finalMetrics }) {
  const modeLabels = {
    STREAMING: 'Streaming',
    BALANCED: 'Balanced',
    IMPACT: 'Impact'
  };

  const summary = {
    modo: modeLabels[mode] || mode,
    genero: genreKey,
    lufs_target: targets.targetLufs,
    tp_ceiling: targets.tpCeiling,
    lufs_input: measured.lufs_i,
    decisao: finalDecision === 'DELIVERED_PRIMARY' ? 'Entregue (render primário)' : 'Entregue (fallback conservador)',
  };

  if (finalMetrics) {
    summary.lufs_final = finalMetrics.lufs_i !== 'not_available' ? finalMetrics.lufs_i : null;
    summary.tp_final = finalMetrics.true_peak_dbtp !== 'not_available' ? finalMetrics.true_peak_dbtp : null;
  }

  return summary;
}

/**
 * Limpa arquivos temporários (rescue).
 */
function cleanupTempFiles(rescueResult) {
  if (rescueResult && rescueResult.output_path) {
    try {
      if (fs.existsSync(rescueResult.output_path)) {
        fs.unlinkSync(rescueResult.output_path);
      }
    } catch (_) {
      // Silenciar — cleanup não é crítico
    }
  }
}

// ============================================================================
// SAÍDA JSON
// ============================================================================

function outputResult(result) {
  console.log(JSON.stringify(result));
}

function exitWithError(code, message) {
  console.error(JSON.stringify({ error: code, message }));
  process.exit(1);
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    exitWithError('INVALID_ARGS', 'Uso: node master-job.cjs <precheck|process> ...');
  }

  const phase = args[0].toLowerCase();

  if (phase === 'precheck') {
    // node master-job.cjs precheck <inputPath> <genreKey> [mode]
    if (args.length < 3) {
      exitWithError('INVALID_ARGS', 'Uso: node master-job.cjs precheck <inputPath> <genreKey> [mode]');
    }

    const [, inputPath, genreKey, mode] = args;

    runPrecheck({ inputPath, genreKey, mode: mode || 'BALANCED' })
      .then(result => {
        outputResult(result);
        process.exit(result.ok ? 0 : 1);
      })
      .catch(error => {
        exitWithError('PRECHECK_FATAL', error.message);
      });

  } else if (phase === 'process') {
    // node master-job.cjs process <inputPath> <outputPath> <genreKey> <mode> [--rescue]
    if (args.length < 5) {
      exitWithError('INVALID_ARGS', 'Uso: node master-job.cjs process <inputPath> <outputPath> <genreKey> <mode> [--rescue]');
    }

    const [, inputPath, outputPath, genreKey, mode, ...flags] = args;
    const rescue = flags.includes('--rescue');

    runProcess({ inputPath, outputPath, genreKey, mode, rescue })
      .then(result => {
        outputResult(result);
        process.exit(result.ok ? 0 : 1);
      })
      .catch(error => {
        exitWithError('PROCESS_FATAL', error.message);
      });

  } else {
    exitWithError('PHASE_INVALID', `Fase "${phase}" inválida. Use: precheck ou process`);
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

module.exports = { runPrecheck, runProcess };
