require('dotenv').config();
const { Pool } = require('pg');

// ============================================================================
// 🗄️ POOL POSTGRESQL: Sincronização de status para /api/jobs/:id
// Permite consulta unificada de status junto com jobs do analisador.
// Não crítico: Redis job-store é a fonte primária do automaster-worker.
// ============================================================================
const workerPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

workerPool.on('error', (err) => {
  console.warn('[WORKER-PG] Erro de conexão PostgreSQL (não fatal):', err.message);
});

/**
 * ============================================================================
 * AUTOMASTER WORKER - PROCESSADOR BULLMQ
 * ============================================================================
 * 
 * Worker BullMQ stateless para processamento distribuído de masterização.
 * - Concurrency controlado via env (max 4)
 * - Timeout 120s
 * - Isolamento por job
 * - Storage persistente (R2/S3)
 * - Cleanup automático
 * - Pronto para scaling horizontal
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 5.0.0 (Production-Ready)
 * 
 * GARANTIAS:
 * - NÃO altera core DSP
 * - Stateless total
 * - Seguro para múltiplas instâncias
 * 
 * ============================================================================
 */

const { Worker } = require('bullmq');
const { execFile, fork } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const redis = require('./redis-connection.cjs');
const storageService = require('../services/storage-service.cjs');
const { createServiceLogger, createJobLogger } = require('../services/logger.cjs');
const jobStore = require('../services/job-store.cjs');
const jobLock = require('../services/job-lock.cjs');
const errorClassifier = require('../services/error-classifier.cjs');

// ============================================================================
// LOGGER
// ============================================================================

const logger = createServiceLogger('automaster-worker');

// ============================================================================
// CONSTANTES
// ============================================================================

const WORKER_CONCURRENCY = parseInt(process.env.AUTOMASTER_CONCURRENCY || '1', 10);
const TIMEOUT_MS = 300000; // 300 segundos (5 minutos) - aumentado para áudios longos
// 🏗️ ARCH OPT: fork-per-job em vez de execFile — processo isolado, memória liberada após cada job
const AUTOMASTER_JOB_SCRIPT = path.resolve(__dirname, '../automaster/automaster-job.cjs');
// Timeout do fork = timeout máximo do pipeline interno (11min) + 60s margem
const JOB_FORK_TIMEOUT_MS = 720000; // 12 minutos
const TMP_BASE_DIR = path.resolve(__dirname, '../tmp');

const JOB_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// VALIDAÇÃO DE CONFIGURAÇÃO NO BOOT
// ============================================================================

if (WORKER_CONCURRENCY < 1 || WORKER_CONCURRENCY > 4) {
  logger.error({ concurrency: WORKER_CONCURRENCY }, 'WORKER_CONCURRENCY inválido (deve ser 1-4)');
  process.exit(1);
}

logger.info({ concurrency: WORKER_CONCURRENCY, timeout: TIMEOUT_MS }, 'Worker configurado');

// ============================================================================
// GARANTIR DIRETÓRIOS
// ============================================================================

function ensureDirectories() {
  if (!fsSync.existsSync(TMP_BASE_DIR)) {
    fsSync.mkdirSync(TMP_BASE_DIR, { recursive: true });
  }
}

ensureDirectories();

// ============================================================================
// VALIDAÇÕES
// ============================================================================

const QUEUE_NAME = 'automaster';

// Modos aceitos pela API pública e pelo pipeline DSP
const VALID_MODES = ['STREAMING', 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'];

function validateJobData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Job data inválido');
  }

  const { jobId, inputKey, mode, userId, safeMode = false } = data;

  if (!jobId || typeof jobId !== 'string' || !JOB_ID_REGEX.test(jobId)) {
    throw new Error('jobId inválido');
  }

  if (!inputKey || typeof inputKey !== 'string') {
    throw new Error('inputKey inválido');
  }

  if (!VALID_MODES.includes(mode)) {
    throw new Error(`mode inválido: ${mode}. Modos aceitos: ${VALID_MODES.join(', ')}`);
  }

  return { jobId, inputKey, mode, userId, safeMode: !!safeMode };
}

// ============================================================================
// WORKSPACE ISOLADO
// ============================================================================

async function createJobWorkspace(jobId) {
  const workspace = path.join(TMP_BASE_DIR, jobId);
  await fs.mkdir(workspace, { recursive: true });
  return workspace;
}

async function cleanupJobWorkspace(jobId) {
  const workspace = path.join(TMP_BASE_DIR, jobId);
  try {
    await fs.rm(workspace, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ jobId, error: error.message }, 'Falha no cleanup');
  }
}

// ============================================================================
// EXECUÇÃO DO PIPELINE (via fork — processo isolado com IPC)
// 🏗️ NOVA ARQUITETURA: cada job roda em processo filho próprio.
//    Ao encerrar (process.exit(0)), o OS recupera TODO o heap daquele job.
//    Sem acúmulo de memória entre execuções.
// ============================================================================

async function executePipeline(isolatedInput, isolatedOutput, mode, jobLogger, safeMode = false) {
  jobLogger.info({ mode, safeMode }, 'Forking automaster-job (processo isolado por job)');

  return new Promise((resolve, reject) => {
    // fork() cria processo Node.js filho com canal IPC pré-configurado
    const child = fork(AUTOMASTER_JOB_SCRIPT, [], {
      env: process.env,
      silent: false, // herda stderr/stdout — logs aparecem diretamente no Railway
    });

    let settled = false;
    let safetyTimer = null;

    function settle(result) {
      if (!settled) {
        settled = true;
        if (safetyTimer) clearTimeout(safetyTimer);
        resolve(result);
      }
    }

    function fail(err) {
      if (!settled) {
        settled = true;
        if (safetyTimer) clearTimeout(safetyTimer);
        reject(err);
      }
    }

    // Timeout de segurança — garante que o fork não fica pendurado para sempre
    // O pipeline interno já tem seu próprio timeout (11min); este é a última defesa
    safetyTimer = setTimeout(() => {
      jobLogger.error({ mode }, `automaster-job TIMEOUT após ${JOB_FORK_TIMEOUT_MS / 1000}s — matando processo filho`);
      try { child.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
      fail(new Error(`automaster-job timeout (${JOB_FORK_TIMEOUT_MS / 1000}s)`));
    }, JOB_FORK_TIMEOUT_MS);

    // Não impedir que o worker encerre caso apenas o timer esteja ativo
    if (safetyTimer.unref) safetyTimer.unref();

    // Enviar dados do job imediatamente — IPC bufferiza até o filho estar pronto
    child.send({
      inputPath: isolatedInput,
      outputPath: isolatedOutput,
      mode,
      safeMode,
    });

    child.on('message', (msg) => {
      if (!msg) return;

      if (msg.success === true) {
        jobLogger.info({
          pipelineStatus: msg.pipelineResult && msg.pipelineResult.status,
          pipelineSuccess: msg.pipelineResult && msg.pipelineResult.success,
        }, 'automaster-job retornou sucesso via IPC');
        settle({
          pipelineResult: msg.pipelineResult,
          stdout: msg.stdout || '',
          stderr: msg.stderr || '',
        });
      } else if (msg.success === false) {
        jobLogger.error({ error: msg.error, code: msg.code }, 'automaster-job retornou falha via IPC');
        fail(new Error(msg.error || 'automaster-job retornou falha sem mensagem de erro'));
      }
    });

    child.on('exit', (code, signal) => {
      // Se resultado já foi resolvido (settled=true), exit é esperado — ignorar
      // Caso contrário: processo saiu antes de enviar resultado = erro
      fail(new Error(`automaster-job encerrou inesperadamente (code=${code}, signal=${signal})`));
    });

    child.on('error', (err) => {
      jobLogger.error({ error: err.message }, 'Erro ao criar/comunicar com automaster-job');
      fail(err);
    });
  });
}

// ============================================================================
// PROCESSOR
// ============================================================================

async function processJob(job) {
  console.log('[WORKER] Processing job:', job.id);
  console.log('[PIPELINE] START', JSON.stringify(job.data));
  const startTime = Date.now();
  let jobId = null; let inputKey = null; let mode = null; let userId = null; let safeMode = false;

  try {
    const validated = validateJobData(job.data);
    ({ jobId, inputKey, mode, userId, safeMode } = validated);
  } catch (e) {
    logger.error({ error: e.message, jobDataJobId: job && job.data && job.data.jobId ? job.data.jobId : null }, 'Job inválido (validateJobData falhou)');
    throw e;
  }

  let jobLogger = null;
  jobLogger = createJobLogger(jobId, { mode, userId });
  jobLogger.info('Job iniciado');

  let workspace;
  let lockData = null;
  let heartbeatInterval = null;
  let lostLock = false;

  try {
    // 0. Verificar se job já foi concluído (idempotência)
    const existingJob = await jobStore.getJob(jobId);
    if (existingJob && existingJob.status === 'completed' && existingJob.output_key) {
      jobLogger.warn('Job já concluído, pulando processamento duplicado');
      return {
        success: true,
        jobId,
        output_key: existingJob.output_key,
        cached: true
      };
    }

    // 1. Adquirir lock distribuído
    lockData = await jobLock.acquireLock(jobId);
    if (!lockData) {
      jobLogger.warn('Não conseguiu adquirir lock, job já está sendo processado');
      // Lock contention: não é erro, apenas skip
      return {
        skipped: true,
        reason: 'LOCKED',
        jobId
      };
    }

    jobLogger.info({ workerId: lockData.workerId }, 'Lock adquirido');

    // 2. Iniciar heartbeat do lock (renova a cada 15s)
    heartbeatInterval = setInterval(async () => {
      try {
        const renewed = await jobLock.renewLock(jobId, lockData.workerId);
        if (!renewed) {
          jobLogger.warn({ workerId: lockData.workerId }, 'Perdeu ownership do lock, abortando job');
          lostLock = true;
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      } catch (error) {
        jobLogger.error({ error: error.message, workerId: lockData.workerId }, 'Erro ao renovar lock');
      }
    }, 15000); // 15 segundos

    jobLogger.info('Heartbeat do lock iniciado');

    // 2. Atualizar status para processing
    await jobStore.updateJobStatus(jobId, 'processing', {
      started_at: Date.now(),
      progress: 0
    });

    // 3. Criar workspace isolado (10%)
    await job.updateProgress(10);
    await jobStore.updateProgress(jobId, 10);
    workspace = await createJobWorkspace(jobId);
    const isolatedInput = path.join(workspace, 'input.wav');
    const isolatedOutput = path.join(workspace, 'result.wav');
    jobLogger.info({ workspace }, 'Workspace criado');

    // 4. Download input do storage (25%)
    await job.updateProgress(25);
    await jobStore.updateProgress(jobId, 25);
    console.log('[PIPELINE] Step 1: download start', { inputKey, dest: isolatedInput });
    await storageService.downloadToFile(inputKey, isolatedInput);
    console.log('[PIPELINE] Step 1: download ok');

    // [FILE INTEGRITY] downloaded_input
    try {
      const _dlStat = fsSync.statSync(isolatedInput);
      const _dlHash = await new Promise((resolve) => {
        const hash = crypto.createHash('sha256');
        const stream = fsSync.createReadStream(isolatedInput);
        stream.on('data', d => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', () => resolve('error-reading'));
      });
      console.log('[FILE INTEGRITY] stage: downloaded_input | path:', isolatedInput, '| size_bytes:', _dlStat.size, '| sha256:', _dlHash);
    } catch (_e) {
      console.warn('[FILE INTEGRITY] downloaded_input: erro ao calcular:', _e.message);
    }

    jobLogger.info({ inputKey }, 'Input baixado do storage');

    // 5. Executar pipeline (50%)
    await job.updateProgress(50);
    await jobStore.updateProgress(jobId, 50);
    const dspMode = mode;
    console.log('[PIPELINE] Step 2: ffmpeg start', { mode: dspMode, safeMode, input: isolatedInput, output: isolatedOutput });
    const result = await executePipeline(isolatedInput, isolatedOutput, dspMode, jobLogger, safeMode);
    console.log('[PIPELINE] Step 2: ffmpeg ok', { success: result?.pipelineResult?.success, status: result?.pipelineResult?.status });

    // resultado já vem parseado e validado
    const pipelineResult = result.pipelineResult;

    // Extrair metadados de aviso (postcheck ABORT tratado como completed_with_warning)
    const completedWithWarning = pipelineResult.warning === true &&
                                 pipelineResult.status === 'completed_with_warning';
    const completedSafe = pipelineResult.status === 'completed_safe';
    const completedPrimary = pipelineResult.status === 'completed_primary';

    // ----------------------------------------------------------------
    // NEEDS_CONFIRMATION: problemas técnicos detectados — aguardando confirmacão do usuário
    // Não é erro técnico — não faz retry
    // ----------------------------------------------------------------
    if (pipelineResult.status === 'NEEDS_CONFIRMATION') {
      await jobStore.updateJobStatus(jobId, 'needs_confirmation', {
        error_code: 'NEEDS_CONFIRMATION',
        error_message: ((pipelineResult.problems || []).join('; ') || 'Problemas técnicos detectados').substring(0, 500),
        selected_mode: pipelineResult.mode || '',
        not_apt_reasons: JSON.stringify(pipelineResult.problems || []),
        not_apt_measured: JSON.stringify(pipelineResult.measured || {}),
        confirmation_classifiers: JSON.stringify(pipelineResult.classifiers || {}),
        processing_ms: pipelineResult.processing_ms || 0
      });

      try {
        await workerPool.query(
          `UPDATE jobs
           SET status     = 'needs_confirmation',
               error      = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({ status: 'NEEDS_CONFIRMATION', ...pipelineResult }),
            jobId
          ]
        );
        jobLogger.info({ jobId }, 'PostgreSQL sincronizado: needs_confirmation');
      } catch (pgErr) {
        jobLogger.warn({ error: pgErr.message }, 'Falha ao sincronizar needs_confirmation com PostgreSQL (não crítico)');
      }

      jobLogger.info({ pipelineResult }, 'Job aguardando confirmação do usuário (needs_confirmation)');
      return {
        success: false,
        status: 'NEEDS_CONFIRMATION',
        jobId,
        pipeline_result: pipelineResult
      };
    }

    // Guardrail de aptidão: música não está apta para o modo solicitado (ex.: TRUE_PEAK_TOO_HIGH)
    // Não é erro técnico — resultado semântico estruturado, sem retry
    if (pipelineResult.status === 'NOT_APT') {
      await jobStore.updateJobStatus(jobId, 'not_apt', {
        error_code: 'NOT_APT',
        error_message: ((pipelineResult.reasons || []).join('; ') || 'Música não apta para o modo solicitado').substring(0, 500),
        selected_mode: pipelineResult.mode || '',
        recommended_mode: (pipelineResult.recommended_actions && pipelineResult.recommended_actions[0]) || 'MEDIUM',
        not_apt_reasons: JSON.stringify(pipelineResult.reasons || []),
        not_apt_measured: JSON.stringify(pipelineResult.measured || {}),
        processing_ms: pipelineResult.processing_ms || 0
      });

      try {
        await workerPool.query(
          `UPDATE jobs
           SET status     = 'not_apt',
               error      = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({ status: 'NOT_APT', ...pipelineResult }),
            jobId
          ]
        );
        jobLogger.info({ jobId }, 'PostgreSQL sincronizado: not_apt');
      } catch (pgErr) {
        jobLogger.warn({ error: pgErr.message }, 'Falha ao sincronizar not_apt com PostgreSQL (não crítico)');
      }

      jobLogger.info({ pipelineResult }, 'Job finalizado como not_apt (guardrail — sem retry)');
      return {
        success: false,
        status: 'NOT_APT',
        jobId,
        pipeline_result: pipelineResult
      };
    }

    // Modo incompatível com o áudio: resultado semântico limpo, sem retry
    if (pipelineResult.type === 'MODE_INCOMPATIBLE') {
      await jobStore.updateJobStatus(jobId, 'needs_mode_change', {
        error_code: 'MODE_INCOMPATIBLE',
        error_message: (pipelineResult.reason || 'Modo incompatível com o material de entrada').substring(0, 500),
        selected_mode: pipelineResult.selectedMode || '',
        recommended_mode: pipelineResult.recommendedMode || 'MEDIUM',
        abort_reason: pipelineResult.abort_reason || '',
        processing_ms: pipelineResult.processing_ms || 0
      });

      try {
        await workerPool.query(
          `UPDATE jobs
           SET status     = 'needs_mode_change',
               error      = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({ type: 'MODE_INCOMPATIBLE', ...pipelineResult }),
            jobId
          ]
        );
        jobLogger.info({ jobId }, 'PostgreSQL sincronizado: needs_mode_change');
      } catch (pgErr) {
        jobLogger.warn({ error: pgErr.message }, 'Falha ao sincronizar needs_mode_change com PostgreSQL (não crítico)');
      }

      jobLogger.info({ pipelineResult }, 'Job finalizado como needs_mode_change (sem retry)');
      return {
        success: false,
        type: 'MODE_INCOMPATIBLE',
        jobId,
        pipeline_result: pipelineResult
      };
    }

    if (!pipelineResult.success) {
      throw new Error(`Pipeline falhou: ${JSON.stringify(pipelineResult)}`);
    }

    jobLogger.info({ result: pipelineResult }, 'Pipeline concluído');

    // 6. Verificar output (80%)
    await job.updateProgress(80);
    await jobStore.updateProgress(jobId, 80);
    try {
      await fs.access(isolatedOutput);
    } catch {
      throw new Error('Pipeline não gerou arquivo de output');
    }

    // 7. Verificar lock antes de upload
    if (lostLock) {
      throw new Error('LOCK_LOST: Worker perdeu ownership durante processamento');
    }

    // 8. Upload output para storage (90%)
    await job.updateProgress(90);
    await jobStore.updateProgress(jobId, 90);
    console.log('[PIPELINE] Step 3: upload start', { source: isolatedOutput, jobId });
    const outputKey = await storageService.uploadOutput(isolatedOutput, jobId);
    console.log('[PIPELINE] Step 3: upload ok', { outputKey });
    jobLogger.info({ outputKey }, 'Output enviado ao storage');

    // 8b. Gerar preview 60s MP3 para exibição no modal (não crítico — não bloqueia entrega)
    let previewAfterKey = null;
    try {
      const previewAfterPath = isolatedOutput.replace(/\.wav$/i, '_preview.mp3');
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', [
          '-y', '-i', isolatedOutput,
          '-t', '60', '-q:a', '6', '-ac', '2',
          previewAfterPath
        ], { timeout: 30000 }, (err) => (err ? reject(err) : resolve()));
      });
      const previewBuffer = await fs.readFile(previewAfterPath);
      previewAfterKey = await storageService.uploadFile(
        `preview/${jobId}_after.mp3`,
        previewBuffer,
        'audio/mpeg'
      );
      try { await fs.unlink(previewAfterPath); } catch (_) {}
      jobLogger.info({ previewAfterKey }, 'Preview after gerado e enviado ao storage');
    } catch (previewErr) {
      jobLogger.warn({ error: previewErr.message }, '[PREVIEW] Falha ao gerar preview after (nao critico)');
    }

    // 8c. Extrair métricas para exibição no preview
    console.log('[MASTER-METRICS] Extraindo métricas. Pipeline status:', pipelineResult.status);
    const _lastAttempt = pipelineResult.attempts && pipelineResult.attempts.length
      ? pipelineResult.attempts[pipelineResult.attempts.length - 1]
      : null;
    // BEFORE: aptitude_check.measured tem prioridade; fallback: precheck_initial.metrics
    const _lufsBefore     = pipelineResult.aptitude_check?.measured?.lufs_i
                         ?? pipelineResult.precheck_initial?.metrics?.integrated_lufs
                         ?? null;
    const _tpBefore       = pipelineResult.aptitude_check?.measured?.true_peak_db
                         ?? pipelineResult.precheck_initial?.metrics?.true_peak_db
                         ?? null;
    const _drBefore       = pipelineResult.precheck_initial?.metrics?.estimated_dr ?? null;
    const _headroomBefore = (_tpBefore != null) ? parseFloat((0 - _tpBefore).toFixed(1)) : null;
    // AFTER: postcheck.metrics do último attempt
    const _lufsAfter      = _lastAttempt?.postcheck?.metrics?.lufs_i ?? null;
    const _tpAfter        = _lastAttempt?.postcheck?.metrics?.true_peak_dbtp ?? null;
    const _drAfter        = _lastAttempt?.postcheck?.metrics?.dr ?? null;
    const _headroomAfter  = (_tpAfter != null) ? parseFloat((0 - _tpAfter).toFixed(1)) : null;

    // mix_not_apt: avaliado com base nas métricas ORIGINAIS da faixa (aptitudeCheck.measured),
    // que refletem o arquivo ANTES de qualquer rescue/fix-tp do pipeline.
    // NÃO usar master_result.mix_not_apt: o automaster-v1.cjs executa APÓS o rescue/fix,
    // portanto suas métricas refletem o arquivo já corrigido, não o upload original.
    const _mixNotApt = (
      (_tpBefore   != null && _tpBefore   >= -1.0) ||   // True Peak original >= -1.0 dBTP (clipping ou sem headroom)
      (_lufsBefore != null && _lufsBefore >= -10.0) ||   // LUFS original >= -10.0 (já em nível de masterizado)
      pipelineResult.aptitude_check?.isApt === false     // gate de aptidão já detectou não-apta (TP ou LUFS acima do limite)
    );
    console.log('[WORKER-MIXNOTAPT] tp_before:', _tpBefore, '| lufs_before:', _lufsBefore, '| isApt:', pipelineResult.aptitude_check?.isApt, '| saving mix_not_apt:', _mixNotApt ? '1' : '0');
    console.log('[MASTER-METRICS] BEFORE:', { lufs: _lufsBefore, tp: _tpBefore, dr: _drBefore, headroom: _headroomBefore });
    console.log('[MASTER-METRICS] AFTER:', { lufs: _lufsAfter, tp: _tpAfter, dr: _drAfter, headroom: _headroomAfter });

    // 9. Cleanup (95%)
    await job.updateProgress(95);
    await jobStore.updateProgress(jobId, 95);
    await cleanupJobWorkspace(jobId);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // 10. Verificar lock antes de marcar completed
    if (lostLock) {
      throw new Error('LOCK_LOST: Worker perdeu ownership durante processamento');
    }

    // 11. Atualizar status para completed (Redis — fonte primária)
    const deliveryMode = completedSafe ? 'safe' : completedPrimary ? 'primary' : 'warning';
    await jobStore.updateJobStatus(jobId, 'completed', {
      output_key: outputKey,
      processing_ms: durationMs,
      progress: 100,
      finished_at: endTime,
      warning: completedWithWarning ? '1' : '0',
      recommended_mode: (completedWithWarning || completedSafe) ? (pipelineResult.recommendedMode || 'MEDIUM') : '',
      warning_message: (completedWithWarning || completedSafe) ? (pipelineResult.message || '').substring(0, 500) : '',
      delivery_mode: deliveryMode,
      preview_after_key:  previewAfterKey  || '',
      lufs_before:        _lufsBefore     != null ? String(_lufsBefore)     : '',
      true_peak_before:   _tpBefore       != null ? String(_tpBefore)       : '',
      lufs_after:         _lufsAfter      != null ? String(_lufsAfter)      : '',
      true_peak_after:    _tpAfter        != null ? String(_tpAfter)        : '',
      dr_before:          _drBefore       != null ? String(_drBefore)       : '',
      dr_after:           _drAfter        != null ? String(_drAfter)        : '',
      headroom_before:    _headroomBefore != null ? String(_headroomBefore) : '',
      headroom_after:     _headroomAfter  != null ? String(_headroomAfter)  : '',
      mix_not_apt:        _mixNotApt ? '1' : '0'
    });

    // 11b. Sincronizar com PostgreSQL (permite /api/jobs/:id retornar status correto)
    try {
      await workerPool.query(
        `UPDATE jobs
         SET status       = 'completed',
             result       = $1,
             completed_at = NOW(),
             updated_at   = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            outputKey,
            processingMs: durationMs,
            warning: completedWithWarning,
            recommendedMode: completedWithWarning ? (pipelineResult.recommendedMode || 'MEDIUM') : null,
            warningMessage: completedWithWarning ? (pipelineResult.message || null) : null
          }),
          jobId
        ]
      );
      jobLogger.info({ jobId, warning: completedWithWarning }, 'PostgreSQL sincronizado: completed');
    } catch (pgErr) {
      jobLogger.warn({ error: pgErr.message }, 'Falha ao sincronizar completed com PostgreSQL (não crítico)');
    }

    // 12. Parar heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      jobLogger.info('Heartbeat do lock parado');
    }

    // 13. Liberar lock
    if (lockData) {
      await jobLock.releaseLock(jobId, lockData.workerId);
      lockData = null;
      jobLogger.info('Lock liberado');
    }

    await job.updateProgress(100);

    jobLogger.info({ duration_ms: durationMs }, 'Job concluído');

    return {
      success: true,
      jobId,
      duration_ms: durationMs,
      output_key: outputKey,
      pipeline_result: pipelineResult
    };

  } catch (error) {
    const log = jobLogger || logger;
    // Se jobId não foi validado, não tentar interagir com jobStore/jobLock
    if (!jobId) {
      console.error('[PIPELINE ERROR]', error);
      console.error(error.stack);
      throw error;
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Log completo do erro para diagnóstico (visível nos logs do Railway)
    console.error('[PIPELINE ERROR]', error);
    console.error(error.stack);
    console.error('[PIPELINE ERROR] contexto:', { jobId, mode, inputKey, durationMs });

    // Classificar erro
    const classification = errorClassifier.classifyError(error);
    log.error({ 
      error: error.message, 
      error_type: classification.type,
      error_code: classification.code,
      duration_ms: durationMs 
    }, 'Job falhou');

    // Se perdeu lock, não marcar como failed (outro worker deve estar processando)
    if (classification.code === 'LOCK_LOST') {
      log.warn('Lock perdido, não marcando como failed (outro worker pode ter assumido)');
      return { skipped: true, reason: 'LOCK_LOST', jobId };
    }

    // Obter tentativa atual
    const currentJob = await jobStore.getJob(jobId);
    const attempt = currentJob ? currentJob.attempt : 1;

    // Verificar se deve fazer retry
    const shouldRetry = errorClassifier.shouldRetry(
      classification,
      attempt,
      currentJob ? currentJob.max_attempts : 3
    );

    if (!shouldRetry) {
      // Marcar como failed permanentemente (Redis — fonte primária)
      await jobStore.setJobError(jobId, classification.code, classification.message, attempt);
      log.error({ 
        error_code: classification.code,
        reason: 'Non-recoverable error or max attempts reached'
      }, 'Job marcado como failed permanente');

      // Sincronizar falha permanente com PostgreSQL
      try {
        await workerPool.query(
          `UPDATE jobs
           SET status     = 'failed',
               error      = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [classification.message, jobId]
        );
        log.info({ jobId }, 'PostgreSQL sincronizado: failed');
      } catch (pgErr) {
        log.warn({ error: pgErr.message }, 'Falha ao sincronizar failed com PostgreSQL (não crítico)');
      }
    } else {
      // Incrementar attempt para próximo retry
      await jobStore.incrementAttempt(jobId);
      log.warn({ attempt: attempt + 1 }, 'Erro recuperável, será feito retry');
    }

    // Re-throw para BullMQ tratar retry
    throw error;
  } finally {
    // ═══════════════════════════════════════════════════════════════
    // CLEANUP OBRIGATÓRIO - SEMPRE EXECUTA (mesmo com erro/timeout)
    // ═══════════════════════════════════════════════════════════════
    const log = jobLogger || logger;
    
    // 1. Parar heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      log.info('Heartbeat do lock parado (finally)');
    }

    // 2. Liberar lock distribuído
    if (lockData && jobId) {
      await jobLock.releaseLock(jobId, lockData.workerId).catch(err => {
        log.error({ error: err.message }, 'Falha ao liberar lock (finally)');
      });
    }

    // 3. GARANTIR limpeza de workspace (CRÍTICO para evitar disco cheio)
    if (workspace && jobId) {
      await cleanupJobWorkspace(jobId).catch(err => {
        log.error({ jobId, error: err.message }, 'Falha no cleanup de workspace (finally)');
        // Tentar cleanup manual como último recurso
        try {
          const workspacePath = path.join(TMP_BASE_DIR, jobId);
          if (fsSync.existsSync(workspacePath)) {
            execSync(`rm -rf "${workspacePath}"`, { timeout: 5000 });
            log.warn({ jobId }, 'Cleanup manual com rm -rf bem-sucedido');
          }
        } catch (manualErr) {
          log.error({ jobId, error: manualErr.message }, 'Cleanup manual também falhou - workspace órfão!');
        }
      });
    }
  }
}

// ============================================================================
// WORKER BULLMQ
// ============================================================================

const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redis,
  concurrency: WORKER_CONCURRENCY
});

console.log('[WORKER] Attached to queue:', QUEUE_NAME);

worker.on('completed', (job, result) => {
  if (result && result.skipped === true) {
    logger.info({ jobId: job.id, reason: result.reason }, 'Job skipped');
  } else {
    logger.info({ jobId: job.id, duration_ms: result ? result.duration_ms : undefined }, 'Job concluído');
  }
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, error: err.message }, 'Job falhou');
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, 'Erro interno do worker');
});

worker.on('ready', () => {
  logger.info({ concurrency: WORKER_CONCURRENCY }, 'Worker pronto');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown já em andamento');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Iniciando graceful shutdown');

  try {
    // 1. Pausar consumo da fila
    await worker.pause();
    logger.info('Fila pausada, aguardando jobs ativos');

    // 2. Aguardar jobs ativos finalizarem
    await worker.close();
    logger.info('Todos os jobs ativos finalizados');

    // 3. Fechar conexão Redis
    await redis.quit();
    logger.info('Conexão Redis encerrada');

    logger.info('Shutdown completo');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Erro durante shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

logger.info({
  concurrency: WORKER_CONCURRENCY,
  timeout_ms: TIMEOUT_MS,
  tmp_dir: TMP_BASE_DIR
}, 'AutoMaster Worker iniciado');

module.exports = worker;