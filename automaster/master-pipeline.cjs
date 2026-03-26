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
const crypto = require('crypto');

const execFileAsync = promisify(execFile);

async function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', () => resolve('error-reading'));
  });
}

// ============================================================================
// CONSTANTES
// ============================================================================

const VALID_MODES = ['STREAMING', 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'];

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
      { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
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
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
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
      { maxBuffer: 10 * 1024 * 1024, timeout: 180000 }
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
  let stdout;

  try {
    const result = await execFileAsync(
      'node',
      [PRECHECK_SCRIPT, inputPath],
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );
    stdout = result.stdout;
  } catch (error) {
    stdout = error.stdout;

    if (!stdout) {
      throw new Error(`Erro ao executar precheck: ${error.message}`);
    }

    console.warn('[PRECHECK NON-ZERO EXIT] usando stdout mesmo com erro');
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (syntaxErr) {
    throw new Error(`Precheck retornou JSON invalido: ${syntaxErr.message}`);
  }

  console.error('[PRECHECK RESULT]', parsed);

  if (parsed.status === 'BLOCKED') {
    throw new Error(parsed.reason || 'Arquivo invalido para masterizacao');
  }

  if (parsed.status === 'INTERNAL_ERROR') {
    throw new Error(`Precheck interno falhou: ${parsed.reason}`);
  }

  return parsed;
}

async function runFixTruePeak(inputPath) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [FIX_TP_SCRIPT, inputPath],
      { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
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
      { maxBuffer: 10 * 1024 * 1024, timeout: 330000 }
    );

    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Masterizacao retornou JSON invalido: ${error.message}`);
    }
    throw new Error(`Erro ao executar masterizacao: ${error.message}`);
  }
}

/**
 * SAFE MODE: entrega o arquivo com APENAS correção de True Peak.
 * Não executa loudnorm, não altera LUFS.
 * Se TP <= -1.0 dBTP → copia direto para outputPath.
 * Se TP > -1.0 dBTP  → aplica fix-true-peak (ganho negativo) e copia resultado.
 */
async function runSafeModeDelivery(inputPath, outputPath) {
  console.error('[SAFE-MODE-DELIVERY] Iniciando entrega somente-TP (sem loudnorm)');

  // 1. Medir TP do arquivo de entrada
  const measured = await runMeasureAudio(inputPath);
  const inputTP = measured.true_peak_db;
  const inputLUFS = measured.lufs_i;

  console.error(`[SAFE-MODE-DELIVERY] TP medido: ${inputTP.toFixed(2)} dBTP | LUFS: ${inputLUFS.toFixed(2)}`);

  const TARGET_TP = -1.0;

  if (inputTP <= TARGET_TP) {
    // TP já está dentro do limite — copiar arquivo sem modificar
    console.error(`[SAFE-MODE-DELIVERY] TP OK (${inputTP.toFixed(2)} <= ${TARGET_TP}) — copiando arquivo sem modificação`);
    fs.copyFileSync(inputPath, outputPath);

    return {
      success: true,
      targetI: inputLUFS,   // LUFS preservado
      originalTarget: inputLUFS,
      targetAdjusted: false,
      targetTP: TARGET_TP,
      usedTP: TARGET_TP,
      pre_gain_db: 0,
      ceiling_trim_db: 0,
      high_rms_clamp_applied: false,
      dynamic_unstable: false,
      pumping_risk: false,
      sub_dominant: false,
      final_lufs: inputLUFS,
      final_tp: inputTP,
      reference_lufs: inputLUFS,
      reference_lufs_pre_limiter: inputLUFS,
      lufsError: 0,
      tpError: inputTP - TARGET_TP,
      fallback_used: false,
      fix_applied: false,
      fix_details: null,
      duration: 0,
      outputSize: 0,
      measured_by: 'safe-mode-passthrough',
      measurement_failed: false,
      measurement_error: null,
      mode_result: 'SAFE-PASSTHROUGH',
      impact_aborted: false,
      abort_reason: null,
      mix_class: 'SAFE'
    };
  }

  // TP acima do limite — aplicar fix-true-peak (ganho negativo)
  console.error(`[SAFE-MODE-DELIVERY] TP acima do limite (${inputTP.toFixed(2)} > ${TARGET_TP}) — aplicando fix de TP`);

  const fixResult = await runFixTruePeak(inputPath);

  if (fixResult.status === 'ERROR') {
    throw new Error(`fix-true-peak falhou em safe delivery: ${fixResult.message}`);
  }

  // fix-true-peak cria <input>_safe.wav no mesmo diretório
  const inputDir = path.dirname(inputPath);
  const inputBase = path.basename(inputPath, path.extname(inputPath));
  const safePath = path.join(inputDir, `${inputBase}_safe.wav`);

  let sourceForOutput;
  if (fixResult.status === 'FIXED' && fs.existsSync(safePath)) {
    sourceForOutput = safePath;
  } else {
    // fix retornou OK (já estava dentro — não deveria chegar aqui, mas protegeção)
    console.error('[SAFE-MODE-DELIVERY] fix-true-peak reportou OK inesperadamente — copiando original');
    sourceForOutput = inputPath;
  }

  fs.copyFileSync(sourceForOutput, outputPath);

  // Limpar _safe.wav temporário
  if (sourceForOutput === safePath && fs.existsSync(safePath)) {
    try { fs.unlinkSync(safePath); } catch (_) {}
  }

  // Medir TP final
  const finalMeasured = await runMeasureAudio(outputPath);
  const finalTP = finalMeasured.true_peak_db;
  const finalLUFS = finalMeasured.lufs_i;
  const gainApplied = fixResult.applied_gain_db || 0;

  console.error(`[SAFE-MODE-DELIVERY] ✅ Entregue: TP ${inputTP.toFixed(2)} → ${finalTP.toFixed(2)} dBTP | LUFS: ${inputLUFS.toFixed(2)} → ${finalLUFS.toFixed(2)} (delta ${(finalLUFS - inputLUFS).toFixed(2)} LU, gain: ${gainApplied} dB)`);

  return {
    success: true,
    targetI: inputLUFS,
    originalTarget: inputLUFS,
    targetAdjusted: false,
    targetTP: TARGET_TP,
    usedTP: TARGET_TP,
    pre_gain_db: gainApplied,
    ceiling_trim_db: 0,
    high_rms_clamp_applied: false,
    dynamic_unstable: false,
    pumping_risk: false,
    sub_dominant: false,
    final_lufs: finalLUFS,
    final_tp: finalTP,
    reference_lufs: inputLUFS,
    reference_lufs_pre_limiter: inputLUFS,
    lufsError: Math.abs(finalLUFS - inputLUFS),
    tpError: finalTP - TARGET_TP,
    fallback_used: true,
    fix_applied: true,
    fix_details: fixResult,
    duration: 0,
    outputSize: 0,
    measured_by: 'safe-mode-tp-fix',
    measurement_failed: false,
    measurement_error: null,
    mode_result: 'SAFE-TP-FIXED',
    impact_aborted: false,
    abort_reason: null,
    mix_class: 'SAFE'
  };
}

async function runPostcheck(outputPath, mode) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [POSTCHECK_SCRIPT, outputPath, mode],
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
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
  HIGH:       -9,
  EXTREME:    -9
};

async function runMasterPipeline({ inputPath, outputPath, mode, rescueMode = false, safeMode = false }) {
  const startTime = Date.now();

  const resolvedInput = validateInput(inputPath);
  const resolvedOutput = validateOutput(outputPath);
  const validMode = validateMode(mode);
  const targetLufs = MODE_TARGET_LUFS[validMode];

  // Modo efetivo pode ser downgraded para MEDIUM em safeMode
  let effectiveMode = validMode;
  // Coletores de problemas para NEEDS_CONFIRMATION / completed_safe
  const problems = [];
  const classifiers = {};

  // ============================================================
  // GATE DE APTIDÃO (CONSERVADOR)
  // ============================================================

  let initialMeasure;
  try {
    const _t0 = Date.now();
    console.error('[STEP] measure-audio start');
    initialMeasure = await runMeasureAudio(resolvedInput);
    console.error(`[STEP] measure-audio done ${Date.now() - _t0}ms`);
  } catch (error) {
    console.error('[STEP] measure-audio error:', error.message);
    throw new Error(`Medição inicial falhou: ${error.message}`);
  }

  let aptitudeCheck;
  try {
    const _t1 = Date.now();
    console.error('[STEP] check-aptitude start');
    aptitudeCheck = await runCheckAptitude(
      initialMeasure.lufs_i,
      initialMeasure.true_peak_db,
      targetLufs
    );
    console.error(`[STEP] check-aptitude done ${Date.now() - _t1}ms`);
  } catch (error) {
    console.error('[STEP] check-aptitude error:', error.message);
    throw new Error(`Checagem de aptidão falhou: ${error.message}`);
  }

  // Classificar problemas de aptidão
  if (!aptitudeCheck.isApt) {
    (aptitudeCheck.reasons || []).forEach(r => {
      problems.push(r);
      if (r.includes('TRUE_PEAK')) classifiers.input_risky = true;
      if (r.includes('LUFS_TOO_HIGH')) classifiers.input_risky = true;
    });

    if (!safeMode) {
      // Fluxo sem confirmação: pedir confirmação do usuário
      return {
        ok: false,
        status: 'NEEDS_CONFIRMATION',
        problems,
        classifiers,
        mode: validMode,
        measured: aptitudeCheck.measured,
        recommended_actions: aptitudeCheck.recommended_actions,
        processing_ms: Date.now() - startTime
      };
    }

    // safeMode: forçar rescue interno para corrigir TP antes do precheck
    if (!rescueMode) rescueMode = true;
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
      const _t2 = Date.now();
      console.error('[STEP] rescue-mode start');
      rescueResult = await runRescueMode(resolvedInput, tmpRescuePath);
      console.error(`[STEP] rescue-mode done ${Date.now() - _t2}ms`);
    } catch (error) {
      console.error('[STEP] rescue-mode error:', error.message);
      throw new Error(`Rescue Mode falhou: ${error.message}`);
    }

    // Verificar resultado do rescue
    if (rescueResult.status === 'ABORT_UNSAFE_INPUT') {
      if (safeMode) {
        // Safe mode: incapaz de corrigir TP via ganho, mas continuando com best-effort
        classifiers.input_risky = true;
        classifiers.tp_uncorrectable = true;
        problems.push('True Peak não corrigível por ganho — processamento seguro ativo');
        console.error('[PIPELINE][SAFE-MODE] ABORT_UNSAFE_INPUT: continuando com input original (best-effort)');
        inputUsedForPipeline = resolvedInput;
      } else {
        return {
          ok: false,
          status: 'NEEDS_CONFIRMATION',
          problems: [
            'Arquivo possui picos inter-sample que impedem correção automática. Reenvie um pré-master sem processamento prévio.'
          ],
          classifiers: { input_risky: true, tp_uncorrectable: true },
          mode: validMode,
          measured: aptitudeCheck.measured,
          rescue_details: rescueResult,
          processing_ms: Date.now() - startTime
        };
      }
    }

    // Se rescue criou arquivo, usar esse arquivo como input
    if (rescueResult.status === 'RESCUED' && rescueResult.output_path) {
      inputUsedForPipeline = rescueResult.output_path;
    }
  }

  // ============================================================
  // PRECHECK (existente)
  // ============================================================

  // [FILE INTEGRITY] precheck_input
  try {
    const _piStat = fs.statSync(inputUsedForPipeline);
    const _piHash = await hashFile(inputUsedForPipeline);
    console.log('[FILE INTEGRITY] stage: precheck_input | path:', inputUsedForPipeline, '| size_bytes:', _piStat.size, '| sha256:', _piHash);
  } catch (_e) {
    console.warn('[FILE INTEGRITY] precheck_input: erro ao calcular:', _e.message);
  }

  // Normalizar áudio antes do precheck para garantir consistência entre ambientes
  const normalizedPath = inputUsedForPipeline.replace(/\.wav$/i, '_normalized.wav');
  try {
    console.error('[STEP] precheck-normalize start');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputUsedForPipeline,
      '-vn',
      '-acodec', 'pcm_s24le',
      '-ar', '44100',
      '-ac', '2',
      normalizedPath
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    console.log('[PRECHECK NORMALIZED INPUT]', {
      original: inputUsedForPipeline,
      normalized: normalizedPath
    });
    console.error('[STEP] precheck-normalize done');
  } catch (normalizeError) {
    console.warn('[PRECHECK NORMALIZE FAILED] usando input original:', normalizeError.message);
  }

  // [FILE INTEGRITY] normalized_precheck_input
  if (fs.existsSync(normalizedPath)) {
    try {
      const _npStat = fs.statSync(normalizedPath);
      const _npHash = await hashFile(normalizedPath);
      console.log('[FILE INTEGRITY] stage: normalized_precheck_input | path:', normalizedPath, '| size_bytes:', _npStat.size, '| sha256:', _npHash);
    } catch (_e) {
      console.warn('[FILE INTEGRITY] normalized_precheck_input: erro ao calcular:', _e.message);
    }
  }

  const precheckInput = fs.existsSync(normalizedPath) ? normalizedPath : inputUsedForPipeline;

  let precheckInitial;
  try {
    const _t3 = Date.now();
    console.error('[STEP] precheck start');
    precheckInitial = await runPrecheck(precheckInput);
    console.error(`[STEP] precheck done ${Date.now() - _t3}ms`);
    if (precheckInitial && precheckInitial.metrics) {
      const _m = precheckInitial.metrics;
      console.log('[PRECHECK METRICS] path:', precheckInput, '| lufs:', _m.integrated_lufs, '| tp:', _m.true_peak_db, '| dr:', _m.estimated_dr, '| lra:', _m.lra, '| duration:', _m.duration_sec);
    }
  } catch (error) {
    console.error('[STEP] precheck error:', error.message);
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
        const _t4 = Date.now();
        console.error('[STEP] fix-true-peak start');
        fixResult = await runFixTruePeak(resolvedInput);
        console.error(`[STEP] fix-true-peak done ${Date.now() - _t4}ms`);
      } catch (error) {
        console.error('[STEP] fix-true-peak error:', error.message);
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
          const _t5 = Date.now();
          console.error('[STEP] precheck-after-fix start');
          precheckAfterFix = await runPrecheck(inputUsedForMaster);
          console.error(`[STEP] precheck-after-fix done ${Date.now() - _t5}ms`);
        } catch (error) {
          console.error('[STEP] precheck-after-fix error:', error.message);
          throw new Error(`Precheck pos-correcao falhou: ${error.message}`);
        }

        if (precheckAfterFix.status === 'BLOCKED') {
          if (safeMode) {
            // safeMode: aceitar mesmo após falha no fix — best-effort
            classifiers.input_problematic = true;
            problems.push(`Precheck persistiu BLOCKED após correção TP: ${precheckAfterFix.reason}`);
            console.error('[PIPELINE][SAFE-MODE] Precheck ainda BLOCKED após fix TP — continuando mesmo assim');
          } else {
            throw new Error(
              `Audio continua BLOCKED apos correcao TP: ${precheckAfterFix.reason}`
            );
          }
        }
      } else if (fixResult.status === 'OK') {
        throw new Error(
          'Inconsistencia: Precheck reportou TP alto mas fix-true-peak reportou OK'
        );
      }
    } else if (safeMode) {
      // safeMode: precheck BLOCKED por razão qualitativa (DR, silêncio, duração)
      // Classificar e continuar — nunca bloquear em safeMode
      classifiers.input_problematic = true;
      if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('dynamic range')) {
        classifiers.crushed_mix = true;
        problems.push(`Mix over-compressed detectada: ${precheckInitial.reason}`);
      } else if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('silêncio')) {
        classifiers.mostly_silence = true;
        problems.push(`Silêncio excessivo detectado: ${precheckInitial.reason}`);
      } else if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('curta')) {
        classifiers.too_short = true;
        problems.push(`Faixa muito curta: ${precheckInitial.reason}`);
      } else {
        problems.push(`Bloqueio técnico detectado (contornado em modo seguro): ${precheckInitial.reason}`);
      }
      console.error(`[PIPELINE][SAFE-MODE] Precheck BLOCKED contornado: ${precheckInitial.reason}`);
    } else {
      // Sem safeMode: problemas de qualidade → NEEDS_CONFIRMATION antes de tentar
      const blockProblems = [precheckInitial.reason];
      const blockClassifiers = {};
      if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('dynamic range')) {
        blockClassifiers.crushed_mix = true;
      } else if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('silêncio')) {
        blockClassifiers.mostly_silence = true;
      } else if (precheckInitial.reason && precheckInitial.reason.toLowerCase().includes('curta')) {
        blockClassifiers.too_short = true;
      } else {
        blockClassifiers.input_problematic = true;
      }
      return {
        ok: false,
        status: 'NEEDS_CONFIRMATION',
        problems: blockProblems,
        classifiers: blockClassifiers,
        mode: validMode,
        measured: null,
        processing_ms: Date.now() - startTime
      };
    }
  }

  let masterResult;
  try {
    const _t6 = Date.now();
    console.error(`[STEP] master start (mode=${validMode} safeMode=${safeMode})`);
    if (safeMode) {
      // SAFE MODE: apenas correção de TP — sem loudnorm, sem alteração de LUFS
      console.error('[PIPELINE][SAFE-MODE] Bypassing loudnorm — executando entrega somente-TP');
      masterResult = await runSafeModeDelivery(inputUsedForMaster, resolvedOutput);
    } else {
      masterResult = await runMaster(inputUsedForMaster, resolvedOutput, validMode);
    }
    console.error(`[STEP] master done ${Date.now() - _t6}ms`);
  } catch (error) {
    console.error('[STEP] master error:', error.message);
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
    const abortMsg = ABORT_REASONS[masterResult.abort_reason] || 'Modo incompatível com o material de entrada';

    if (safeMode) {
      // safeMode: downgrade silencioso para MEDIUM e re-processar
      classifiers.loudness_exceeded = true;
      problems.push(`${abortMsg} (downgrade automático para MEDIUM)`);
      effectiveMode = 'MEDIUM';
      console.error(`[PIPELINE][SAFE-MODE] Downgrade automático: ${validMode} → MEDIUM (${masterResult.abort_reason})`);
      try {
        const _t6b = Date.now();
        console.error('[STEP] master-medium-downgrade start');
        masterResult = await runMaster(inputUsedForMaster, resolvedOutput, 'MEDIUM');
        console.error(`[STEP] master-medium-downgrade done ${Date.now() - _t6b}ms`);
      } catch (err) {
        console.error('[STEP] master-medium-downgrade error:', err.message);
        throw new Error(`Masterização MEDIUM (safe fallback) falhou: ${err.message}`);
      }
    } else {
      // Sem safeMode: pedir confirmação antes de prosseguir
      return {
        ok: false,
        status: 'NEEDS_CONFIRMATION',
        problems: [abortMsg],
        classifiers: { loudness_exceeded: true },
        mode: validMode,
        abort_reason: masterResult.abort_reason || null,
        processing_ms: Date.now() - startTime
      };
    }
  }

  // Pós-checagem técnica e fallback CLEAN (no máximo uma tentativa adicional)
  let postcheck;
  try {
    const _t7 = Date.now();
    console.error('[STEP] postcheck start');
    postcheck = await runPostcheck(resolvedOutput, effectiveMode);
    console.error(`[STEP] postcheck done ${Date.now() - _t7}ms`);
  } catch (err) {
    console.error('[STEP] postcheck error:', err.message);
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

    if (safeMode) {
      // safeMode: entregar arquivo mesmo com postcheck ABORT (proteção sônica não impede entrega)
      return {
        ok: true,
        success: true,
        status: 'completed_safe',
        warning: true,
        reason: 'postcheck_abort_safe_delivered',
        recommendedMode: 'MEDIUM',
        message: 'Masterização segura concluída. TP acima do limite ideal — considere um pré-master mais limpo.',
        abort_details: abortDetails,
        mode: effectiveMode,
        input: resolvedInput,
        output: resolvedOutput,
        processing_ms: Date.now() - startTime,
        problems,
        classifiers,
        attempts: [primaryAttempt],
        final_decision: 'COMPLETED_SAFE'
      };
    }

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

  // Se OK, entregar primary ou safe dependendo se havia problemas
  if (postcheck && postcheck.recommended_action === 'OK') {
    const hasSafeProblems = safeMode && problems.length > 0;
    return {
      ok: true,
      success: true,
      status: hasSafeProblems ? 'completed_safe' : 'completed_primary',
      mode: effectiveMode,
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
      problems: hasSafeProblems ? problems : undefined,
      classifiers: hasSafeProblems ? classifiers : undefined,
      final_decision: hasSafeProblems ? 'DELIVERED_SAFE' : 'DELIVERED_PRIMARY'
    };
  }

  // Se sugerido FALLBACK_CLEAN, executar CLEAN strategy (mantendo targets do modo solicitado)
  if (postcheck && postcheck.recommended_action === 'FALLBACK_CLEAN') {
    let fallbackResult;
    try {
      const _t8 = Date.now();
      console.error('[STEP] fallback-clean start');
      fallbackResult = await runMaster(inputUsedForMaster, resolvedOutput, effectiveMode, 'CLEAN');
      console.error(`[STEP] fallback-clean done ${Date.now() - _t8}ms`);
    } catch (err) {
      console.error('[STEP] fallback-clean error:', err.message);
      throw new Error(`Fallback CLEAN falhou: ${err.message}`);
    }

    // re-run postcheck (sempre avaliando contra o modo efetivo)
    let postcheck2;
    try {
      const _t9 = Date.now();
      console.error('[STEP] postcheck-after-clean start');
      postcheck2 = await runPostcheck(resolvedOutput, effectiveMode);
      console.error(`[STEP] postcheck-after-clean done ${Date.now() - _t9}ms`);
    } catch (err) {
      console.error('[STEP] postcheck-after-clean error:', err.message);
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
      const hasSafeProblems2 = safeMode && problems.length > 0;
      return {
        ok: true,
        success: true,
        status: hasSafeProblems2 ? 'completed_safe' : 'completed_primary',
        mode: effectiveMode,
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
        problems: hasSafeProblems2 ? problems : undefined,
        classifiers: hasSafeProblems2 ? classifiers : undefined,
        final_decision: hasSafeProblems2 ? 'DELIVERED_SAFE_CLEAN' : 'DELIVERED_CLEAN'
      };
    }

    // ABORT ou qualquer outro resultado após CLEAN: output existe e é válido
    const abortDetails2 = (postcheck2 && postcheck2.tiers && postcheck2.tiers.reasons && postcheck2.tiers.reasons.length)
      ? postcheck2.tiers.reasons.join('; ')
      : 'Modo agressivo demais para esta mix (persistiu após fallback CLEAN)';

    if (safeMode) {
      return {
        ok: true,
        success: true,
        status: 'completed_safe',
        warning: true,
        reason: 'postcheck_abort_after_clean_safe_delivered',
        recommendedMode: 'MEDIUM',
        message: 'Masterização segura concluída após fallback CLEAN.',
        abort_details: abortDetails2,
        mode: effectiveMode,
        input: resolvedInput,
        output: resolvedOutput,
        processing_ms: Date.now() - startTime,
        problems,
        classifiers,
        attempts: [primaryAttempt, fallbackAttempt],
        final_decision: 'COMPLETED_SAFE_AFTER_CLEAN'
      };
    }

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
  const safeMode = flags.includes('--safe-mode');

  runMasterPipeline({ inputPath, outputPath, mode, rescueMode, safeMode })
    .then(result => {
      process.stdout.write(JSON.stringify(result));
      process.exit(0); // sempre 0: o JSON é o contrato, não o exit code
    })
    .catch(error => {
      // Erros não tratados: emitir JSON de erro estruturado para que o worker possa parsear
      const errResult = {
        ok: false,
        success: false,
        error: error.message || String(error)
      };
      process.stdout.write(JSON.stringify(errResult));
      process.exit(0); // sempre 0: evitar que execFile rejeite antes de ler stdout
    });
}

module.exports = {
  runMasterPipeline
};
