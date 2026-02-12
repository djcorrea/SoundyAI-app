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

const VALID_MODES = ['STREAMING', 'BALANCED', 'IMPACT'];

const PRECHECK_SCRIPT = path.resolve(__dirname, 'precheck-audio.cjs');
const FIX_TP_SCRIPT = path.resolve(__dirname, 'fix-true-peak.cjs');
const RUN_AUTOMASTER_SCRIPT = path.resolve(__dirname, 'run-automaster.cjs');

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

async function runMaster(inputPath, outputPath, mode) {
  try {
    const { stdout } = await execFileAsync(
      'node',
      [RUN_AUTOMASTER_SCRIPT, inputPath, outputPath, mode],
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

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

async function runMasterPipeline({ inputPath, outputPath, mode }) {
  const startTime = Date.now();

  const resolvedInput = validateInput(inputPath);
  const resolvedOutput = validateOutput(outputPath);
  const validMode = validateMode(mode);

  let precheckInitial;
  try {
    precheckInitial = await runPrecheck(resolvedInput);
  } catch (error) {
    throw new Error(`Precheck inicial falhou: ${error.message}`);
  }

  let truePeakFixApplied = false;
  let precheckAfterFix = null;
  let inputUsed = resolvedInput;

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

        inputUsed = fixedPath;

        try {
          precheckAfterFix = await runPrecheck(inputUsed);
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
    masterResult = await runMaster(inputUsed, resolvedOutput, validMode);
  } catch (error) {
    throw new Error(`Masterizacao falhou: ${error.message}`);
  } finally {
    if (truePeakFixApplied && inputUsed !== resolvedInput) {
      try {
        if (fs.existsSync(inputUsed)) {
          fs.unlinkSync(inputUsed);
        }
      } catch (cleanupError) {
        // Silenciar erro de cleanup
      }
    }
  }

  const endTime = Date.now();
  const processingMs = endTime - startTime;

  return {
    success: true,
    mode: validMode,
    input: resolvedInput,
    output: resolvedOutput,
    processing_ms: processingMs,
    true_peak_fix_applied: truePeakFixApplied,
    precheck_initial: precheckInitial,
    precheck_after_fix: precheckAfterFix,
    master_result: {
      target_lufs: masterResult.target_lufs,
      final_lufs: masterResult.final_lufs,
      target_tp: masterResult.target_tp,
      final_tp: masterResult.final_tp
    }
  };
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Erro: argumentos insuficientes');
    console.error('Uso: node master-pipeline.cjs <inputPath> <outputPath> <mode>');
    console.error('Modos validos: STREAMING, BALANCED, IMPACT');
    process.exit(1);
  }

  const [inputPath, outputPath, mode] = args;

  runMasterPipeline({ inputPath, outputPath, mode })
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  runMasterPipeline
};
