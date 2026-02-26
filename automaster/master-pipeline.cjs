/**
 * AUTOMASTER V1 - MASTER PIPELINE
 * 
 * Pipeline autônomo para execução via child_process.exec
 * Retorna SOMENTE JSON no stdout (sem banners, emojis ou logs decorativos)
 * 
 * Uso: node master-pipeline.cjs <inputPath> <outputPath> <mode>
 * 
 * Sucesso: exit(0) + JSON no stdout
 * Erro: exit(1) + mensagem no stderr
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

// ============================================================================
// CONSTANTES
// ============================================================================

const VALID_MODES = ['STREAMING', 'LOW', 'MEDIUM', 'HIGH'];

const MEASURE_AUDIO_SCRIPT = path.resolve(__dirname, 'measure-audio.cjs');
const CHECK_APTITUDE_SCRIPT = path.resolve(__dirname, 'check-aptitude.cjs');
const RESCUE_MODE_SCRIPT = path.resolve(__dirname, 'rescue-mode.cjs');
const PRECHECK_SCRIPT = path.resolve(__dirname, 'precheck-audio.cjs');
const FIX_TP_SCRIPT = path.resolve(__dirname, 'fix-true-peak.cjs');
const RUN_AUTOMASTER_SCRIPT = path.resolve(__dirname, 'run-automaster.cjs');
const POSTCHECK_SCRIPT = path.resolve(__dirname, 'postcheck-audio.cjs');

// ============================================================================
// FUNÇÕES AUXILIARES SILENCIOSAS
// ============================================================================

function validateInput(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('inputPath deve ser uma string valida');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de input nao encontrado: ${inputPath}`);
  }

  const stats = fs.statSync(inputPath);
  if (!stats.isFile()) {
    throw new Error(`inputPath nao e um arquivo: ${inputPath}`);
  }

  return path.resolve(inputPath);
}

function validateMode(mode) {
  if (!mode || typeof mode !== 'string') {
    throw new Error('mode deve ser uma string valida');
  }

  const upperMode = mode.toUpperCase();
  if (!VALID_MODES.includes(upperMode)) {
    throw new Error(`Mode invalido: ${mode}. Use: ${VALID_MODES.join(', ')}`);
  }

  return upperMode;
}

function validateOutput(outputPath) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('outputPath deve ser uma string valida');
  }

  return path.resolve(outputPath);
}

async function runMeasureAudio(inputPath) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [MEASURE_AUDIO_SCRIPT, inputPath],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Medição retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao medir audio: ${error.message}`);
  }
}

async function runCheckAptitude(lufs_i, true_peak_db, targetLufs) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [CHECK_APTITUDE_SCRIPT, lufs_i.toString(), true_peak_db.toString(), targetLufs.toString()],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    // Exit code 1 significa NÃO_APTA, mas stdout contém o JSON correto
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch (parseError) {
        throw new Error(`Checagem de aptidão retornou JSON invalido: ${parseError.message}`);
      }
    }
    throw new Error(`Erro ao checar aptidão: ${error.message}`);
  }
}

async function runRescueMode(inputPath, tmpOutputPath) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [RESCUE_MODE_SCRIPT, inputPath, tmpOutputPath],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    // Exit code 1 pode ser ABORT_UNSAFE, mas stdout contém o JSON
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch (parseError) {
        throw new Error(`Rescue Mode retornou JSON invalido: ${parseError.message}`);
      }
    }
    throw new Error(`Erro ao executar Rescue Mode: ${error.message}`);
  }
}

async function runPrecheck(inputPath) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [PRECHECK_SCRIPT, inputPath],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Precheck retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao executar precheck: ${error.message}`);
  }
}

async function runFixTruePeak(inputPath) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [FIX_TP_SCRIPT, inputPath],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Fix True Peak retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao executar fix-true-peak: ${error.message}`);
  }
}

async function runMaster(inputPath, outputPath, mode, strategy) {
  try {
    const args = [RUN_AUTOMASTER_SCRIPT, inputPath, outputPath, mode];
    if (strategy) args.push(strategy);

    const { stdout } = await execFileAsync(
      'node',
      args,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Masterizacao retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao executar masterizacao: ${error.message}`);
  }
}

async function runPostcheck(outputPath, mode) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [POSTCHECK_SCRIPT, outputPath, mode],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Postcheck retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao executar postcheck: ${error.message}`);
  }
}

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

// Mapeamento de modos para target LUFS (usado no gate de aptidão)
const MODE_TARGET_LUFS = {
  STREAMING: -14,
  LOW:       -14,
  MEDIUM:    -11,
  HIGH:       -9
};

async function runMasterPipeline({ inputPath, outputPath, mode, rescueMode = false }) {
  const startTime = Date.now();

  const resolvedInput = validateInput(inputPath);
  const resolvedOutput = validateOutput(outputPath);
  const validMode = validateMode(mode);
  const targetLufs = MODE_TARGET_LUFS[validMode];

  // ============================================================
  // GATE DE APTIDÃO (CONSERVADOR)
  // ============================================================

  let initialMeasure;
  try {
    initialMeasure = await runMeasureAudio(resolvedInput);
  } catch (error) {
    throw new Error(`Medição inicial falhou: ${error.message}`);
  }

  let aptitudeCheck;
  try {
    aptitudeCheck = await runCheckAptitude(
      initialMeasure.lufs_i,
      initialMeasure.true_peak_db,
      targetLufs
    );
  } catch (error) {
    throw new Error(`Checagem de aptidão falhou: ${error.message}`);
  }

  // Se NÃO APTA e rescue mode NÃO solicitado: retornar objeto estruturado
  if (!aptitudeCheck.isApt && !rescueMode) {
    return {
      ok: false,
      status: 'NOT_APT',
      mode: validMode,
      reasons: aptitudeCheck.reasons,
      measured: aptitudeCheck.measured,
      recommended_actions: aptitudeCheck.recommended_actions,
      processing_ms: Date.now() - startTime
    };
  }

  // ============================================================
  // RESCUE MODE (se solicitado)
  // ============================================================

  let rescueResult = null;
  let inputUsedForPipeline = resolvedInput;

  if (rescueMode) {
    const inputDir = path.dirname(resolvedInput);
    const inputName = path.basename(resolvedInput, path.extname(resolvedInput));
    const tmpRescuePath = path.join(inputDir, `${inputName}_rescue_tmp.wav`);

    try {
      rescueResult = await runRescueMode(resolvedInput, tmpRescuePath);
    } catch (error) {
      throw new Error(`Rescue Mode falhou: ${error.message}`);
    }

    // Verificar resultado do rescue
    if (rescueResult.status === 'ABORT_UNSAFE_INPUT') {
      return {
        ok: false,
        status: 'ABORT_UNSAFE_INPUT',
        mode: validMode,
        message: rescueResult.message,
        measured: aptitudeCheck.measured,
        rescue_details: rescueResult,
        processing_ms: Date.now() - startTime
      };
    }

    // Se rescue criou arquivo, usar esse arquivo como input
    if (rescueResult.status === 'RESCUED' && rescueResult.output_path) {
      inputUsedForPipeline = rescueResult.output_path;
    }
  }

  // ============================================================
  // PRECHECK (existente)
  // ============================================================

  let precheckInitial;
  try {
    precheckInitial = await runPrecheck(inputUsedForPipeline);
  } catch (error) {
    throw new Error(`Precheck inicial falhou: ${error.message}`);
  }

  let truePeakFixApplied = false;
  let precheckAfterFix = null;
  let inputUsedForMaster = inputUsedForPipeline;

  if (precheckInitial.status === 'BLOCKED') {
    const isTPIssue = precheckInitial.reason && 
                      precheckInitial.reason.toLowerCase().includes('true peak');

    if (isTPIssue) {
      let fixResult;
      try {
        fixResult = await runFixTruePeak(resolvedInput);
      } catch (error) {
        throw new Error(`Fix True Peak falhou: ${error.message}`);
      }

      if (fixResult.status === 'FIXED') {
        truePeakFixApplied = true;

        const inputDir = path.dirname(resolvedInput);
        const inputName = path.basename(resolvedInput, path.extname(resolvedInput));
        const fixedPath = path.join(inputDir, `${inputName}_safe.wav`);

        if (!fs.existsSync(fixedPath)) {
          throw new Error(`Arquivo corrigido nao encontrado: ${fixedPath}`);
        }

        inputUsedForMaster = fixedPath;

        try {
          precheckAfterFix = await runPrecheck(inputUsedForMaster);
        } catch (error) {
          throw new Error(`Precheck pos-correcao falhou: ${error.message}`);
        }

        if (precheckAfterFix.status === 'BLOCKED') {
          throw new Error(
            `Audio continua BLOCKED apos correcao TP: ${precheckAfterFix.reason}`
          );
        }
      } else if (fixResult.status === 'OK') {
        throw new Error(
          'Inconsistencia: Precheck reportou TP alto mas fix-true-peak reportou OK'
        );
      }
    } else {
      throw new Error(
        `Audio BLOCKED: ${precheckInitial.reason}. Correcao automatica nao disponivel`
      );
    }
  }

  let masterResult;
  try {
    masterResult = await runMaster(inputUsedForMaster, resolvedOutput, validMode);
  } catch (error) {
    throw new Error(`Masterizacao falhou: ${error.message}`);
  } finally {
    if (truePeakFixApplied && inputUsedForMaster !== inputUsedForPipeline) {
      try {
        if (fs.existsSync(inputUsedForMaster)) {
          fs.unlinkSync(inputUsedForMaster);
        }
      } catch (cleanupError) {
        // Silenciar erro de cleanup
      }
    }

    // Limpar arquivo rescue temporário se foi criado
    if (rescueResult && rescueResult.output_path && fs.existsSync(rescueResult.output_path)) {
      try {
        fs.unlinkSync(rescueResult.output_path);
      } catch (cleanupError) {
        // Silenciar erro de cleanup
      }
    }
  }

  // Verificar compatibilidade de modo (HIGH pode ser incompatível com determinados materiais)
  if (masterResult && masterResult.impact_aborted === true) {
    const ABORT_REASONS = {
      LIMITER_OVERLOAD: 'Limiter aplicou compressão excessiva — pumping audível detectado',
      CREST_COLLAPSE:   'Dinâmica colapsada — brick-wall limiting comprometeria a faixa'
    };
    return {
      ok: false,
      success: false,
      type: 'MODE_INCOMPATIBLE',
      selectedMode: validMode,
      recommendedMode: 'MEDIUM',
      reason: ABORT_REASONS[masterResult.abort_reason] || 'Modo incompatível com o material de entrada',
      abort_reason: masterResult.abort_reason || null,
      processing_ms: Date.now() - startTime
    };
  }

  // Pós-checagem técnica e fallback CLEAN (no máximo uma tentativa adicional)
  let postcheck;
  try {
    postcheck = await runPostcheck(resolvedOutput, validMode);
  } catch (err) {
    throw new Error(`Postcheck falhou: ${err.message}`);
  }

  // Log do resultado para diagnóstico em Railway
  console.error('[PIPELINE] Postcheck result:', JSON.stringify({
    status: postcheck && postcheck.status,
    recommended_action: postcheck && postcheck.recommended_action,
    lufs: postcheck && postcheck.metrics && postcheck.metrics.lufs_i,
    tp: postcheck && postcheck.metrics && postcheck.metrics.true_peak_dbtp,
    dr: postcheck && postcheck.metrics && postcheck.metrics.dr,
    reasons: postcheck && postcheck.tiers && postcheck.tiers.reasons
  }));

  // Construir tentativa primaria
  const primaryAttempt = {
    type: 'PRIMARY',
    mode_requested: validMode,
    strategy_used: null,
    master_result: masterResult,
    postcheck
  };

  // Proteção sônica: ABORT é uma decisão semântica, não um erro técnico
  // Output foi gerado com sucesso; apenas a verificação de modo foi acionada
  if (postcheck && postcheck.recommended_action === 'ABORT') {
    const abortDetails = (postcheck.tiers && postcheck.tiers.reasons && postcheck.tiers.reasons.length)
      ? postcheck.tiers.reasons.join('; ')
      : 'Modo agressivo demais para esta mix';
    return {
      ok: true,
      success: true,
      status: 'completed_with_warning',
      warning: true,
      reason: 'unsafe_mode',
      recommendedMode: 'MEDIUM',
      message: 'A música já está próxima do limite seguro. Aplicar esse modo poderia degradar a qualidade.',
      abort_details: abortDetails,
      mode: validMode,
      input: resolvedInput,
      output: resolvedOutput,
      processing_ms: Date.now() - startTime,
      attempts: [primaryAttempt],
      final_decision: 'COMPLETED_WITH_WARNING'
    };
  }

  // Se OK, entregar primary
  if (postcheck && postcheck.recommended_action === 'OK') {
    return {
      ok: true,
      success: true,
      mode: validMode,
      input: resolvedInput,
      output: resolvedOutput,
      processing_ms: Date.now() - startTime,
      aptitude_check: aptitudeCheck,
      rescue_mode_used: rescueMode,
      rescue_result: rescueResult,
      true_peak_fix_applied: truePeakFixApplied,
      precheck_initial: precheckInitial,
      precheck_after_fix: precheckAfterFix,
      attempts: [primaryAttempt],
      used_fallback: false,
      final_decision: 'DELIVERED_PRIMARY'
    };
  }

  // Se sugerido FALLBACK_CLEAN, executar CLEAN strategy (mantendo targets do modo solicitado)
  if (postcheck && postcheck.recommended_action === 'FALLBACK_CLEAN') {
    let fallbackResult;
    try {
      fallbackResult = await runMaster(inputUsedForMaster, resolvedOutput, validMode, 'CLEAN');
    } catch (err) {
      throw new Error(`Fallback CLEAN falhou: ${err.message}`);
    }

    // re-run postcheck (sempre avaliando contra o modo solicitado)
    let postcheck2;
    try {
      postcheck2 = await runPostcheck(resolvedOutput, validMode);
    } catch (err) {
      throw new Error(`Postcheck pós-CLEAN falhou: ${err.message}`);
    }

    const fallbackAttempt = {
      type: 'CLEAN',
      mode_requested: validMode,
      strategy_used: 'CLEAN',
      master_result: fallbackResult,
      postcheck: postcheck2
    };

    if (postcheck2 && postcheck2.recommended_action === 'OK') {
      return {
        ok: true,
        success: true,
        mode: validMode,
        input: resolvedInput,
        output: resolvedOutput,
        processing_ms: Date.now() - startTime,
        aptitude_check: aptitudeCheck,
        rescue_mode_used: rescueMode,
        rescue_result: rescueResult,
        true_peak_fix_applied: truePeakFixApplied,
        precheck_initial: precheckInitial,
        precheck_after_fix: precheckAfterFix,
        attempts: [primaryAttempt, fallbackAttempt],
        used_fallback: true,
        final_decision: 'DELIVERED_CLEAN'
      };
    }

    // ABORT ou qualquer outro resultado após CLEAN: proteção sônica, output existe e é válido
    const abortDetails2 = (postcheck2 && postcheck2.tiers && postcheck2.tiers.reasons && postcheck2.tiers.reasons.length)
      ? postcheck2.tiers.reasons.join('; ')
      : 'Modo agressivo demais para esta mix (persistiu após fallback CLEAN)';
    return {
      ok: true,
      success: true,
      status: 'completed_with_warning',
      warning: true,
      reason: 'unsafe_mode',
      recommendedMode: 'MEDIUM',
      message: 'A música já está próxima do limite seguro. Aplicar esse modo poderia degradar a qualidade.',
      abort_details: abortDetails2,
      mode: validMode,
      input: resolvedInput,
      output: resolvedOutput,
      processing_ms: Date.now() - startTime,
      attempts: [primaryAttempt, fallbackAttempt],
      final_decision: 'COMPLETED_WITH_WARNING_AFTER_CLEAN'
    };
  }

  // Caso desconhecido, abortar
  throw new Error(`Postcheck recomendou ação inesperada: ${postcheck ? postcheck.recommended_action : 'none'}`);
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Erro: argumentos insuficientes');
    console.error('Uso: node master-pipeline.cjs <inputPath> <outputPath> <mode> [--rescue]');
    console.error('Modos validos: STREAMING, LOW, MEDIUM, HIGH');
    console.error('Opcoes:');
    console.error('  --rescue    Executar Rescue Mode (gain-only) se necessario');
    process.exit(1);
  }

  const [inputPath, outputPath, mode, ...flags] = args;
  const rescueMode = flags.includes('--rescue');

  runMasterPipeline({ inputPath, outputPath, mode, rescueMode })
    .then(result => {
      process.stdout.write(JSON.stringify(result));
      process.exit(result.ok === false && result.type !== 'MODE_INCOMPATIBLE' ? 1 : 0);
    })
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  runMasterPipeline
};
