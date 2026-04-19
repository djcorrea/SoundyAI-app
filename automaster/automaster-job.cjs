#!/usr/bin/env node
/**
 * automaster-job.cjs — Processo Isolado de Masterização
 *
 * Responsabilidades:
 *   1. Receber dados do job via IPC (process.on('message'))
 *   2. Executar master-pipeline.cjs em subprocess filho
 *   3. Retornar resultado ao worker pai via process.send()
 *   4. Encerrar com process.exit(0) — libera toda a memória ao OS
 *
 * Por que fork em vez de execFile direto no worker?
 *   - IPC é mais confiável que parsing de JSON do stdout
 *   - Permite futuras atualizações de progresso bidirecionais
 *   - Isolamento claro: este processo carrega APENAS o necessário
 *   - Ao encerrar, o OS recupera TODO o heap (V8 + FFmpeg child procs)
 *
 * Uso: chamado exclusivamente via fork() pelo automaster-worker.cjs
 *   NÃO executar diretamente na linha de comando.
 */

'use strict';

require('dotenv').config();

const { execFile } = require('child_process');
const path = require('path');

// ============================================================================
// CONSTANTES
// ============================================================================

const MASTER_PIPELINE_SCRIPT = path.resolve(__dirname, 'master-pipeline.cjs');

// Timeout maior que o timeout interno do run-automaster.cjs (660000ms = 11min)
// Garante que o execFile externo não mate o processo antes do pipeline terminar
const PIPELINE_EXEC_TIMEOUT_MS = 720000; // 12 minutos

// ============================================================================
// EXECUÇÃO DO PIPELINE
// ============================================================================

/**
 * Chama master-pipeline.cjs como child process e parseia o JSON do stdout.
 * Interface de retorno compatível com o que o worker espera:
 *   { pipelineResult: Object, stdout: string, stderr: string }
 *
 * @param {string} inputPath   - Caminho absoluto do WAV de entrada
 * @param {string} outputPath  - Caminho absoluto do WAV de saída
 * @param {string} mode        - Modo DSP (STREAMING|LOW|MEDIUM|HIGH|EXTREME)
 * @param {string[]} flags     - Flags opcionais (ex: ['--safe-mode'])
 * @returns {Promise<{ pipelineResult: Object, stdout: string, stderr: string }>}
 */
function runPipeline(inputPath, outputPath, mode, flags) {
  return new Promise((resolve, reject) => {
    execFile(
      'node',
      [MASTER_PIPELINE_SCRIPT, inputPath, outputPath, mode, ...flags],
      {
        timeout: PIPELINE_EXEC_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        killSignal: 'SIGTERM',
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        // Repassar stderr ao processo pai (aparece nos logs do Railway)
        if (stderr && stderr.trim()) {
          process.stderr.write(
            `[automaster-job] pipeline stderr: ${stderr.trim().substring(0, 2000)}\n`
          );
        }

        // stdout com JSON válido tem prioridade sobre exit code
        // Exit code não-zero pode ser intencional (ex: ABORT_UNSAFE_INPUT, NOT_APT)
        const rawOut = stdout && stdout.trim();
        if (rawOut) {
          const lines = rawOut.split('\n');
          const lastLine = lines[lines.length - 1];

          try {
            const result = JSON.parse(lastLine);
            return resolve({
              pipelineResult: result,
              stdout: rawOut,
              stderr: stderr ? stderr.trim() : '',
            });
          } catch (_parseErr) {
            // stdout existe mas JSON inválido — cair para o reject abaixo
          }
        }

        if (error) return reject(error);
        reject(new Error('master-pipeline retornou saída vazia'));
      }
    );
  });
}

// ============================================================================
// ENTRY POINT — recebe dados via IPC, roda pipeline, envia resultado, encerra
// ============================================================================

process.on('message', async (jobData) => {
  const { inputPath, outputPath, mode, safeMode = false } = jobData || {};

  try {
    // Validação defensiva — worker já validou, mas garantimos aqui também
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('automaster-job: inputPath ausente ou inválido');
    }
    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('automaster-job: outputPath ausente ou inválido');
    }
    if (!mode || typeof mode !== 'string') {
      throw new Error('automaster-job: mode ausente ou inválido');
    }

    const flags = safeMode ? ['--safe-mode'] : [];

    const result = await runPipeline(inputPath, outputPath, mode, flags);

    // Sucesso — retornar resultado ao worker pai
    process.send({ success: true, ...result });

  } catch (error) {
    // Falha — retornar erro estruturado ao worker pai
    process.send({
      success: false,
      error: error.message || String(error),
      code: error.code || 'PIPELINE_ERROR',
    });

  } finally {
    // SEMPRE encerrar — libera heap inteiro ao OS após cada job
    process.exit(0);
  }
});
