require('dotenv').config();

// [BOOT] Log imediato — identifica se este arquivo está sendo executado em produção
console.error('[BOOT]', { file: __filename, pid: process.pid, entrypoint: 'workers/automaster-worker.cjs' });

/**
 * ============================================================================
 * AUTOMASTER WORKER - EXECUÇÃO ISOLADA E STATELESS
 * ============================================================================
 * 
 * Worker stateless para executar o pipeline completo de masterização:
 * - Timeout obrigatório (90s)
 * - Totalmente isolado por jobId
 * - Limite de memória (120MB)
 * - Logs estruturados
 * - JSON padronizado
 * - Preparado para scaling horizontal
 * - Isolamento real com workspace temporário
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 3.0.0 (Full Isolation)
 * 
 * GARANTIAS:
 * - NÃO altera core DSP
 * - NÃO modifica pipeline
 * - Stateless (sem variáveis globais de controle)
 * - Seguro para múltiplas instâncias
 * - Cleanup automático de temporários
 * - Processamento isolado por job
 * 
 * ============================================================================
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONSTANTES DE SEGURANÇA
// ============================================================================

const MAX_FILE_MB = 120;
const TIMEOUT_MS = 90000; // 90 segundos
const VALID_MODES = ['STREAMING', 'BALANCED', 'IMPACT'];

const MASTER_PIPELINE_SCRIPT = path.resolve(__dirname, '../automaster/master-pipeline.cjs');
const TMP_BASE_DIR = path.resolve(__dirname, '../tmp');

const JOB_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// VALIDAÇÕES PRÉ-EXECUÇÃO
// ============================================================================

/**
 * Valida se o jobId é válido
 */
function validateJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('jobId deve ser uma string válida');
  }

  if (!JOB_ID_REGEX.test(jobId)) {
    throw new Error('jobId inválido - apenas a-z, A-Z, 0-9, _, - são permitidos');
  }

  if (jobId.length < 3 || jobId.length > 128) {
    throw new Error('jobId deve ter entre 3 e 128 caracteres');
  }

  return jobId;
}

/**
 * Cria workspace temporário isolado para o job
 */
function createJobWorkspace(jobId) {
  const jobTmpDir = path.join(TMP_BASE_DIR, jobId);
  fs.mkdirSync(jobTmpDir, { recursive: true });
  return jobTmpDir;
}

/**
 * Remove workspace temporário do job
 */
function cleanupJobWorkspace(jobId) {
  const jobTmpDir = path.join(TMP_BASE_DIR, jobId);
  if (fs.existsSync(jobTmpDir)) {
    fs.rmSync(jobTmpDir, { recursive: true, force: true });
  }
}

/**
 * Valida se o arquivo de input existe e está no limite de tamanho
 */
function validateInputFile(inputPath) {
  const resolvedPath = path.resolve(inputPath);

  // Verificar existência
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo de input não encontrado: ${inputPath}`);
  }

  // Verificar se é arquivo (não diretório)
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`Path não é um arquivo válido: ${inputPath}`);
  }

  // Verificar tamanho
  const fileSizeMB = stats.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_MB) {
    throw new Error(
      `Arquivo excede o limite de ${MAX_FILE_MB}MB (tamanho: ${fileSizeMB.toFixed(2)}MB)`
    );
  }

  return resolvedPath;
}

/**
 * Valida o modo de masterização
 */
function validateMode(mode) {
  if (!mode || typeof mode !== 'string') {
    throw new Error('Mode deve ser uma string válida');
  }

  const upperMode = mode.toUpperCase();
  if (!VALID_MODES.includes(upperMode)) {
    throw new Error(`Mode inválido: ${mode}. Use: ${VALID_MODES.join(', ')}`);
  }

  return upperMode;
}

/**
 * Valida o path de output
 */
function validateOutputPath(outputPath) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Output path deve ser uma string válida');
  }

  const resolvedPath = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return resolvedPath;
}

/**
 * Verifica se o script master-pipeline.cjs existe
 */
function validatePipelineScript() {
  if (!fs.existsSync(MASTER_PIPELINE_SCRIPT)) {
    throw new Error(
      `Script master-pipeline.cjs não encontrado em: ${MASTER_PIPELINE_SCRIPT}`
    );
  }
}

// ============================================================================
// EXECUÇÃO DO PIPELINE COM TIMEOUT
// ============================================================================

/**
 * Executa o master-pipeline.cjs com timeout e controle
 */
function executePipelineWithTimeout(inputPath, outputPath, mode) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Spawn do processo
    const childProcess = execFile(
      'node',
      [MASTER_PIPELINE_SCRIPT, inputPath, outputPath, mode],
      {
        timeout: TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer para stdout/stderr
        killSignal: 'SIGTERM',
        encoding: 'utf8' // Garantir UTF-8
      },
      (error, stdout, stderr) => {
        const endTime = Date.now();
        const durationMs = endTime - startTime;

        // Timeout ou kill
        if (error) {
          if (error.killed || error.signal === 'SIGTERM') {
            console.error('[WORKER] Processo morto por timeout');
            console.error('[WORKER] Stderr:', stderr);
            return reject({
              type: 'TIMEOUT',
              message: `Processo excedeu timeout de ${TIMEOUT_MS / 1000}s`,
              stderr: stderr ? stderr.trim() : '',
              duration_ms: durationMs
            });
          }

          // Erro de execução
          console.error('[WORKER] Erro de execução:', error.message);
          console.error('[WORKER] Stderr:', stderr);
          return reject({
            type: 'EXECUTION_ERROR',
            message: error.message,
            stderr: stderr ? stderr.trim() : '',
            code: error.code || null,
            duration_ms: durationMs
          });
        }

        // Validar stdout
        if (!stdout || !stdout.trim()) {
          console.error('[WORKER] Pipeline retornou stdout vazio');
          console.error('[WORKER] Stdout:', stdout);
          console.error('[WORKER] Stderr:', stderr);
          return reject({
            type: 'EMPTY_OUTPUT',
            message: 'Pipeline retornou stdout vazio',
            stdout: stdout,
            stderr: stderr ? stderr.trim() : '',
            duration_ms: durationMs
          });
        }

        // Sucesso - capturar última linha do stdout
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];

        console.error(`[WORKER] Pipeline concluído (${durationMs}ms)`);
        console.error(`[WORKER] Stdout linhas: ${lines.length}`);
        console.error(`[WORKER] Última linha (primeiros 100 chars): ${lastLine.substring(0, 100)}`);

        resolve({
          stdout: stdout.trim(),
          lastLine: lastLine,
          stderr: stderr ? stderr.trim() : '',
          duration_ms: durationMs
        });
      }
    );

    // Log do PID para debug
    console.error(`[WORKER] PID: ${childProcess.pid} | Timeout: ${TIMEOUT_MS}ms`);
  });
}

// ============================================================================
// FUNÇÃO PRINCIPAL DO WORKER
// ============================================================================

/**
 * Executa o worker de masterização (stateless com isolamento total)
 */
async function runWorker() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    const errorResponse = {
      success: false,
      jobId: null,
      error: 'Argumentos insuficientes',
      details: 'Uso: node automaster-worker.cjs <jobId> <input.wav> <output.wav> <MODE>',
      usage: {
        modes: VALID_MODES,
        max_file_mb: MAX_FILE_MB,
        timeout_sec: TIMEOUT_MS / 1000
      }
    };

    console.log(JSON.stringify(errorResponse, null, 2));
    process.exit(1);
  }

  const [jobIdArg, inputArg, outputArg, modeArg] = args;
  const startTime = Date.now();

  let jobId;
  let jobWorkspace;
  let inputPath;
  let outputPath;
  let mode;
  let isolatedInput;
  let isolatedOutput;

  try {
    console.error('[WORKER] Iniciando validações...');

    jobId = validateJobId(jobIdArg);
    console.error(`[WORKER] Job ID: ${jobId}`);

    jobWorkspace = createJobWorkspace(jobId);
    console.error(`[WORKER] Workspace: ${jobWorkspace}`);

    validatePipelineScript();

    inputPath = validateInputFile(inputArg);
    console.error(`[WORKER] Input Original: ${path.basename(inputPath)}`);

    outputPath = validateOutputPath(outputArg);
    console.error(`[WORKER] Output Target: ${path.basename(outputPath)}`);

    mode = validateMode(modeArg);
    console.error(`[WORKER] Mode: ${mode}`);

    isolatedInput = path.join(jobWorkspace, 'input.wav');
    isolatedOutput = path.join(jobWorkspace, 'result.wav');

    console.error('[WORKER] Copiando input para workspace isolado...');
    fs.copyFileSync(inputPath, isolatedInput);

    console.error('[WORKER] Executando pipeline isolado...');
    const result = await executePipelineWithTimeout(isolatedInput, isolatedOutput, mode);

    let pipelineResult;
    try {
      // Usar a última linha do stdout para parse (ignora possíveis logs anteriores)
      pipelineResult = JSON.parse(result.lastLine);
      console.error('[WORKER] JSON parseado com sucesso');
    } catch (parseError) {
      console.error('[WORKER] Falha ao parsear JSON');
      console.error('[WORKER] Stdout completo:', result.stdout);
      console.error('[WORKER] Última linha:', result.lastLine);
      console.error('[WORKER] Erro de parse:', parseError.message);
      throw new Error(`Pipeline retornou JSON invalido: ${parseError.message}`);
    }

    if (pipelineResult.status !== 'SUCCESS') {
      throw new Error(`Pipeline falhou: ${JSON.stringify(pipelineResult)}`);
    }

    if (!fs.existsSync(isolatedOutput)) {
      throw new Error('Pipeline não gerou arquivo de output');
    }

    console.error('[WORKER] Movendo resultado para destino final...');
    fs.renameSync(isolatedOutput, outputPath);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const successResponse = {
      success: true,
      jobId: jobId,
      duration_ms: durationMs,
      output: outputPath,
      error: null,
      pipeline_result: pipelineResult
    };

    console.log(JSON.stringify(successResponse, null, 2));
    process.exit(0);

  } catch (error) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    let errorResponse;

    if (error.type === 'TIMEOUT') {
      errorResponse = {
        success: false,
        jobId: jobId || 'unknown',
        duration_ms: error.duration_ms,
        output: null,
        error: 'Timeout excedido',
        details: error.message,
        stderr: error.stderr || null
      };
    } else if (error.type === 'EXECUTION_ERROR') {
      errorResponse = {
        success: false,
        jobId: jobId || 'unknown',
        duration_ms: error.duration_ms,
        output: null,
        error: 'Erro de execução',
        details: error.message,
        code: error.code,
        stderr: error.stderr || null
      };
    } else {
      errorResponse = {
        success: false,
        jobId: jobId || 'unknown',
        duration_ms: durationMs,
        output: null,
        error: error.message || 'Erro desconhecido',
        details: error.stack || null
      };
    }

    console.log(JSON.stringify(errorResponse, null, 2));
    process.exit(1);

  } finally {
    if (jobId) {
      try {
        cleanupJobWorkspace(jobId);
        console.error(`[WORKER] Cleanup: tmp/${jobId}/ removido`);
      } catch (cleanupError) {
        console.error(`[WORKER] Falha no cleanup: ${cleanupError.message}`);
      }
    }

    console.error('[WORKER] Processo finalizado.');
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  runWorker().catch(error => {
    console.error('[WORKER] Erro fatal:', error);
    process.exit(1);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runWorker
};
