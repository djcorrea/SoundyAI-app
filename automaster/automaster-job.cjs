#!/usr/bin/env node
/**
 * automaster-job.cjs — Processo Isolado de Masterização
 *
 * Responsabilidades:
 *   1. Receber dados do job via IPC (process.on('message'))
 *   2. Executar runMasterPipeline() DIRETAMENTE (sem execFile intermediário)
 *   3. Retornar resultado ao worker pai via process.send()
 *   4. Encerrar com process.exit(0) — libera toda a memória ao OS
 *
 * Arquitetura:
 *   worker → fork(automaster-job) → runMasterPipeline() → [execFile DSP scripts] → FFmpeg
 *
 *   1 job = 1 processo filho.
 *   master-pipeline.cjs é carregado neste processo e chama os scripts DSP
 *   (measure-audio, check-aptitude, run-automaster, etc.) via execFile — isso é
 *   necessário pois cada script DSP é stateless e encerra sozinho.
 *   Ao encerrar este processo (process.exit), o OS recupera TODO o heap V8.
 *
 * Uso: chamado exclusivamente via fork() pelo automaster-worker.cjs
 *   NÃO executar diretamente na linha de comando.
 */

'use strict';

require('dotenv').config();

// Importação direta — elimina o processo intermediário master-pipeline Node.js
const { runMasterPipeline } = require('./master-pipeline.cjs');

// ============================================================================
// HANDLERS DE ERROS NÃO CAPTURADOS — garantem que o processo sempre responde
// ============================================================================

process.on('uncaughtException', (err) => {
  console.error('[automaster-job] uncaughtException:', err.message);
  try {
    process.send({ success: false, error: err.message, code: 'UNCAUGHT_EXCEPTION' });
  } catch (_) {}
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[automaster-job] unhandledRejection:', msg);
  try {
    process.send({ success: false, error: msg, code: 'UNHANDLED_REJECTION' });
  } catch (_) {}
  process.exit(1);
});

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

    // Chamar pipeline DIRETAMENTE — sem execFile intermediário
    // runMasterPipeline retorna JS object; não há parsing de JSON de stdout
    const pipelineResult = await runMasterPipeline({
      inputPath,
      outputPath,
      mode,
      safeMode,
    });

    // Sucesso — retornar resultado ao worker pai com interface compatível
    // { pipelineResult, stdout, stderr } — mesmo shape que o worker espera
    process.send({
      success: true,
      pipelineResult,
      stdout: '',  // não aplicável na chamada direta
      stderr: '',  // não aplicável na chamada direta
    });

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
