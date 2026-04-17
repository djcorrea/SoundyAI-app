/**
 * 🔥 ANALYSIS JOB — PROCESSO ISOLADO
 * 
 * Este arquivo é executado como child_process.fork() pelo worker-redis.js.
 * CADA JOB = 1 PROCESSO → ao finalizar, process.exit(0) libera TODA a memória.
 * 
 * Responsabilidades:
 * - Baixar arquivo do S3/B2
 * - Ler buffer
 * - Executar pipeline completo (decode → segmentação → métricas → scoring)
 * - Enriquecer sugestões com IA
 * - Enviar resultado via IPC (process.send)
 * - Morrer (process.exit)
 * 
 * NÃO mantém:
 * - Conexão Redis
 * - BullMQ Worker
 * - Estado entre jobs
 * - Variáveis globais persistentes
 */

import "dotenv/config";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from './db.js';
import { enrichSuggestionsWithAI } from './lib/ai/suggestion-enricher.js';
import { referenceSuggestionEngine } from './lib/audio/features/reference-suggestion-engine.js';

// Pipeline completo
let processAudioComplete = null;
let runPipeline = null;

try {
  const imported = await import("./api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  runPipeline = imported.runPipeline;
} catch (err) {
  console.error(`[ANALYSIS-JOB] ❌ Falha ao carregar pipeline:`, err.message);
  if (process.send) {
    process.send({ type: 'error', error: `Falha ao carregar pipeline: ${err.message}` });
  }
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════
// S3 CLIENT (efêmero — morre com o processo)
// ═══════════════════════════════════════════════════════════

function createS3Client() {
  return new AWS.S3({
    endpoint: process.env.B2_ENDPOINT,
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    region: 'us-east-005',
    s3ForcePathStyle: true
  });
}

// ═══════════════════════════════════════════════════════════
// DOWNLOAD STREAMING
// ═══════════════════════════════════════════════════════════

async function downloadFileFromBucket(fileKey) {
  const s3 = createS3Client();
  const tempDir = path.join(__dirname, 'temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = path.basename(fileKey);
  const localFilePath = path.join(tempDir, `${Date.now()}-${process.pid}-${fileName}`);

  await new Promise((resolve, reject) => {
    const readStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey
    }).createReadStream();

    const writeStream = fs.createWriteStream(localFilePath);

    const downloadTimeout = setTimeout(() => {
      readStream.destroy(new Error('Download timeout após 2 minutos'));
      writeStream.destroy();
    }, 120000);

    readStream.on('error', (err) => {
      clearTimeout(downloadTimeout);
      writeStream.destroy();
      try { fs.unlinkSync(localFilePath); } catch (_) {}
      reject(new Error(`S3 read error: ${err.message}`));
    });

    writeStream.on('error', (err) => {
      clearTimeout(downloadTimeout);
      readStream.destroy();
      try { fs.unlinkSync(localFilePath); } catch (_) {}
      reject(new Error(`File write error: ${err.message}`));
    });

    writeStream.on('finish', () => {
      clearTimeout(downloadTimeout);
      resolve();
    });

    readStream.pipe(writeStream);
  });

  return localFilePath;
}

// ═══════════════════════════════════════════════════════════
// SANITIZAÇÃO (mesmo do worker-redis.js)
// ═══════════════════════════════════════════════════════════

function sanitizeSuggestionsForReduced(results) {
  if (!results || results.analysisMode !== 'reduced' || !results.isReduced) {
    return results;
  }

  const mapItem = (s = {}) => ({
    ...s,
    categoria: s.categoria ?? s.category ?? null,
    metricKey: s.metricKey ?? s.metric ?? null,
    severity: s.severity ?? null,
    type: s.type ?? null,
    problema: null,
    causa: null,
    solucao: null,
    plugin: null,
    dica: null,
    texto: null,
    content: null,
    details: null,
    raw: null,
    description: null,
    problema_completo: null,
    causa_raiz: null,
    solucao_detalhada: null,
    recommendation: null,
    explanation: null,
  });

  if (Array.isArray(results.suggestions)) {
    results.suggestions = results.suggestions.map(mapItem);
  }
  if (Array.isArray(results.aiSuggestions)) {
    results.aiSuggestions = results.aiSuggestions.map(mapItem);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════
// VALIDAÇÃO JSON
// ═══════════════════════════════════════════════════════════

function validateCompleteJSON(finalJSON, mode, referenceJobId) {
  const missing = [];
  const referenceStage = finalJSON.referenceStage || null;

  if (!finalJSON.technicalData) missing.push('technicalData');
  if (finalJSON.score === undefined || finalJSON.score === null) missing.push('score');
  if (!finalJSON.metadata) missing.push('metadata');

  if (referenceStage === 'base') {
    // Base não precisa de suggestions/aiSuggestions
  } else if (referenceStage === 'compare') {
    if (!Array.isArray(finalJSON.aiSuggestions)) missing.push('aiSuggestions');
    if (!finalJSON.referenceComparison) missing.push('referenceComparison');
  } else if (mode === 'genre' || !mode) {
    if (!Array.isArray(finalJSON.suggestions)) missing.push('suggestions');
  }

  return { valid: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════
// PROCESSADORES DE JOB
// ═══════════════════════════════════════════════════════════

async function processReferenceBase(jobData) {
  const { jobId, fileKey, fileName } = jobData;

  console.log(`[ANALYSIS-JOB][REF-BASE] PID=${process.pid} Job=${jobId?.substring(0, 8)}`);

  let localFilePath = null;

  try {
    localFilePath = await downloadFileFromBucket(fileKey);
    let fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`[ANALYSIS-JOB][REF-BASE] Arquivo: ${fileBuffer.length} bytes`);

    const t0 = Date.now();
    const finalJSON = await processAudioComplete(fileBuffer, fileName || 'unknown.wav', {
      jobId,
      mode: 'reference',
      referenceStage: 'base',
    });

    fileBuffer = null; // liberar imediatamente

    const totalMs = Date.now() - t0;
    console.log(`[ANALYSIS-JOB][REF-BASE] Pipeline concluído em ${totalMs}ms`);

    // Campos específicos de reference base
    finalJSON.success = true;
    finalJSON.status = 'completed';
    finalJSON.mode = 'reference';
    finalJSON.referenceStage = 'base';
    finalJSON.requiresSecondTrack = true;
    finalJSON.referenceJobId = jobId;
    finalJSON.jobId = jobId;
    finalJSON.analysisMode = finalJSON.analysisMode || 'full';
    finalJSON.isReduced = finalJSON.isReduced ?? false;
    finalJSON.aiSuggestions = [];
    finalJSON.suggestions = [];
    finalJSON.referenceComparison = null;

    finalJSON.baseMetrics = {
      lufsIntegrated: finalJSON.technicalData?.lufsIntegrated,
      truePeakDbtp: finalJSON.technicalData?.truePeakDbtp,
      dynamicRange: finalJSON.technicalData?.dynamicRange,
      loudnessRange: finalJSON.technicalData?.loudnessRange,
      stereoWidth: finalJSON.metrics?.stereoImaging?.width,
      spectralBalance: finalJSON.metrics?.spectralBalance
    };

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: 'reference-base',
      workerId: process.pid
    };

    finalJSON._worker = {
      source: 'analysis-job-ref-base',
      isolated: true,
      pid: process.pid,
      jobId
    };

    return { status: 'completed', result: finalJSON };

  } finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (_) {}
    }
  }
}

async function processReferenceCompare(jobData) {
  const { jobId, fileKey, fileName, referenceJobId } = jobData;

  console.log(`[ANALYSIS-JOB][REF-COMPARE] PID=${process.pid} Job=${jobId?.substring(0, 8)}`);

  let localFilePath = null;

  try {
    // Carregar métricas da base
    const refResult = await pool.query(
      'SELECT id, status, results FROM jobs WHERE id = $1',
      [referenceJobId]
    );

    if (refResult.rows.length === 0) {
      throw new Error(`Job de referência ${referenceJobId} não encontrado`);
    }
    const refJob = refResult.rows[0];
    if (refJob.status !== 'completed') {
      throw new Error(`Job de referência status '${refJob.status}' (esperado: completed)`);
    }
    if (!refJob.results) {
      throw new Error('Job de referência não possui resultados');
    }
    const baseMetrics = refJob.results;

    // Download e processamento
    localFilePath = await downloadFileFromBucket(fileKey);
    let fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`[ANALYSIS-JOB][REF-COMPARE] Arquivo: ${fileBuffer.length} bytes`);

    const t0 = Date.now();
    const finalJSON = await processAudioComplete(fileBuffer, fileName || 'unknown.wav', {
      jobId,
      mode: 'reference',
      referenceStage: 'compare',
      referenceJobId,
      preloadedReferenceMetrics: baseMetrics
    });

    fileBuffer = null;

    const totalMs = Date.now() - t0;
    console.log(`[ANALYSIS-JOB][REF-COMPARE] Pipeline concluído em ${totalMs}ms`);

    // Calcular referenceComparison (deltas)
    const baseTech = baseMetrics.technicalData || {};
    const compareTech = finalJSON.technicalData || {};

    const referenceComparison = {
      base: {
        lufsIntegrated: baseTech.lufsIntegrated,
        truePeakDbtp: baseTech.truePeakDbtp,
        dynamicRange: baseTech.dynamicRange,
        loudnessRange: baseTech.loudnessRange,
        fileName: baseMetrics.metadata?.fileName
      },
      current: {
        lufsIntegrated: compareTech.lufsIntegrated,
        truePeakDbtp: compareTech.truePeakDbtp,
        dynamicRange: compareTech.dynamicRange,
        loudnessRange: compareTech.loudnessRange,
        fileName: finalJSON.metadata?.fileName
      },
      deltas: {
        lufsIntegrated: compareTech.lufsIntegrated - baseTech.lufsIntegrated,
        truePeakDbtp: compareTech.truePeakDbtp - baseTech.truePeakDbtp,
        dynamicRange: compareTech.dynamicRange - baseTech.dynamicRange,
        loudnessRange: (compareTech.loudnessRange || 0) - (baseTech.loudnessRange || 0)
      }
    };

    finalJSON.referenceComparison = referenceComparison;

    // Sugestões comparativas
    const comparativeSuggestions = referenceSuggestionEngine(baseMetrics, finalJSON);
    finalJSON.aiSuggestions = Array.isArray(comparativeSuggestions) ? comparativeSuggestions : [];
    finalJSON.suggestions = Array.isArray(comparativeSuggestions) ? comparativeSuggestions : [];

    if (finalJSON.aiSuggestions.length === 0) {
      const fallbackSuggestion = {
        categoria: 'ReferenceAnalysis',
        nivel: 'info',
        problema: 'Comparação A/B concluída',
        solucao: 'Revise as diferenças na tabela de comparação e ajuste conforme necessário.',
        detalhes: {
          deltas: referenceComparison.deltas,
          status: 'fallback-secundario',
          note: 'Músicas com características muito similares'
        },
        aiEnhanced: false,
        enrichmentStatus: 'worker-fallback'
      };
      finalJSON.aiSuggestions.push(fallbackSuggestion);
      finalJSON.suggestions.push(fallbackSuggestion);
    }

    // Campos finais
    finalJSON.success = true;
    finalJSON.status = 'completed';
    finalJSON.mode = 'reference';
    finalJSON.referenceStage = 'compare';
    finalJSON.referenceJobId = referenceJobId;
    finalJSON.jobId = jobId;
    finalJSON.requiresSecondTrack = false;
    finalJSON.analysisMode = finalJSON.analysisMode || 'full';
    finalJSON.isReduced = finalJSON.isReduced ?? false;

    finalJSON.baseMetrics = {
      lufsIntegrated: baseTech.lufsIntegrated,
      truePeakDbtp: baseTech.truePeakDbtp,
      dynamicRange: baseTech.dynamicRange,
      loudnessRange: baseTech.loudnessRange,
      stereoWidth: baseMetrics.metrics?.stereoImaging?.width,
      spectralBalance: baseMetrics.metrics?.spectralBalance,
      fileName: baseMetrics.metadata?.fileName
    };

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: 'reference-compare',
      workerId: process.pid
    };

    finalJSON._worker = {
      source: 'analysis-job-ref-compare',
      isolated: true,
      pid: process.pid,
      jobId
    };

    return { status: 'completed', result: finalJSON };

  } finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (_) {}
    }
  }
}

async function processGenre(jobData) {
  const {
    jobId, fileKey, fileName, mode,
    referenceJobId, genre, genreTargets,
    soundDestination = 'pista',
    planContext
  } = jobData;

  const validSoundDestination = ['pista', 'streaming'].includes(soundDestination) ? soundDestination : 'pista';

  console.log(`[ANALYSIS-JOB][GENRE] PID=${process.pid} Job=${jobId?.substring(0, 8)} Genre=${genre || 'N/A'}`);

  let localFilePath = null;
  let preloadedReferenceMetrics = null;

  try {
    // Validações
    if (!fileKey || !jobId) {
      throw new Error(`Dados do job inválidos`);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      throw new Error(`jobId inválido: '${jobId}' não é um UUID válido`);
    }

    if (!fileKey || typeof fileKey !== 'string' || fileKey.length < 3) {
      throw new Error(`fileKey inválido: '${fileKey}'`);
    }

    // Carregar métricas de referência (se houver)
    if (referenceJobId) {
      try {
        const refResult = await pool.query(
          'SELECT id, status, results FROM jobs WHERE id = $1',
          [referenceJobId]
        );
        if (refResult.rows.length > 0 && refResult.rows[0].status === 'completed' && refResult.rows[0].results) {
          preloadedReferenceMetrics = refResult.rows[0].results;
          console.log('[ANALYSIS-JOB][GENRE] ✅ Métricas ref carregadas');
        }
      } catch (refError) {
        console.error('[ANALYSIS-JOB][GENRE] ❌ Erro ao carregar métricas ref:', refError.message);
      }
    }

    // Download
    const downloadStartTime = Date.now();
    localFilePath = await downloadFileFromBucket(fileKey);
    const downloadTime = Date.now() - downloadStartTime;
    console.log(`[ANALYSIS-JOB][GENRE] ✅ Download em ${downloadTime}ms`);

    // Ler buffer
    let fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`[ANALYSIS-JOB][GENRE] Arquivo: ${fileBuffer.length} bytes`);

    const t0 = Date.now();

    // Criar pseudo-job para runPipeline (mantém compatibilidade)
    const pseudoJob = {
      data: {
        ...jobData,
        soundDestination: validSoundDestination,
      },
      _buffer: fileBuffer,
      _preloadedReferenceMetrics: preloadedReferenceMetrics,
    };

    // Pipeline com timeout
    const pipelinePromise = runPipeline(pseudoJob);

    let _timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      _timeoutId = setTimeout(() => reject(new Error(`Pipeline timeout após 3min: ${fileName}`)), 180000);
    });

    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise])
      .finally(() => {
        if (_timeoutId) clearTimeout(_timeoutId);
      });

    // Liberar buffers
    fileBuffer = null;
    pseudoJob._buffer = null;
    pseudoJob._preloadedReferenceMetrics = null;

    const totalMs = Date.now() - t0;
    console.log(`[ANALYSIS-JOB][GENRE] ✅ Pipeline concluído em ${totalMs}ms`);

    finalJSON.soundDestination = validSoundDestination;

    // planContext
    if (!finalJSON.analysisMode && planContext?.analysisMode) {
      finalJSON.analysisMode = planContext.analysisMode;
    }
    if (!finalJSON.isReduced && finalJSON.analysisMode === 'reduced') {
      finalJSON.isReduced = true;
    }
    if (!finalJSON.limitWarning && finalJSON.analysisMode === 'reduced' && planContext) {
      finalJSON.limitWarning = `Você atingiu o limite de análises completas do plano ${planContext.plan?.toUpperCase() || 'FREE'}. Atualize seu plano para desbloquear análise completa.`;
    }

    // Performance
    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: '5.1-5.4-isolated',
      workerId: process.pid,
      downloadTimeMs: downloadTime
    };

    finalJSON._worker = {
      source: 'analysis-job-genre',
      isolated: true,
      pid: process.pid,
      jobId
    };

    // Garantir suggestions
    if (!finalJSON.suggestions) {
      finalJSON.suggestions = [];
    }

    // AI Enrichment
    try {
      console.log('[ANALYSIS-JOB][GENRE] Iniciando AI enrichment...');
      const metrics = finalJSON.data?.metrics || finalJSON.metrics || null;
      const targets = finalJSON.data?.genreTargets || finalJSON.genreTargets || null;
      const problems = finalJSON.problemsAnalysis || null;

      const enriched = await enrichSuggestionsWithAI(
        finalJSON.suggestions || [],
        {
          metrics,
          targets,
          problems,
          genre: finalJSON.data?.genre || finalJSON.genre || null,
          mode,
          referenceJobId,
        }
      );

      finalJSON.aiSuggestions = Array.isArray(enriched) ? enriched : [];
      console.log(`[ANALYSIS-JOB][GENRE] ✅ AI enrichment: ${finalJSON.aiSuggestions.length} sugestões`);
    } catch (err) {
      console.error('[ANALYSIS-JOB][GENRE] ❌ Erro no enrichment:', err.message);
      finalJSON.aiSuggestions = [];
    }

    // Validação
    const validation = validateCompleteJSON(finalJSON, mode, referenceJobId);
    if (!validation.valid) {
      console.error(`[ANALYSIS-JOB][GENRE] ❌ JSON incompleto: ${validation.missing.join(', ')}`);
      throw new Error(`JSON incompleto: ${validation.missing.join(', ')}`);
    }

    return { status: 'completed', result: finalJSON };

  } finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (_) {}
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ENTRY POINT — RECEBER MENSAGEM VIA IPC
// ═══════════════════════════════════════════════════════════

process.on('message', async (msg) => {
  if (msg.type !== 'job') return;

  const jobData = msg.data;
  const { mode, referenceStage } = jobData;
  const startTime = Date.now();

  const memBefore = process.memoryUsage();
  console.log(`[ANALYSIS-JOB] ═══════════════════════════════════════`);
  console.log(`[ANALYSIS-JOB] 🚀 Job recebido PID=${process.pid}`);
  console.log(`[ANALYSIS-JOB] Job ID: ${jobData.jobId?.substring(0, 8)}`);
  console.log(`[ANALYSIS-JOB] Mode: ${mode} | Stage: ${referenceStage || 'N/A'}`);
  console.log(`[ANALYSIS-JOB] RAM inicial: ${(memBefore.rss / 1024 / 1024).toFixed(1)}MB`);
  console.log(`[ANALYSIS-JOB] ═══════════════════════════════════════`);

  try {
    let outcome;

    if (mode === 'reference' && referenceStage === 'base') {
      outcome = await processReferenceBase(jobData);
    } else if (mode === 'reference' && referenceStage === 'compare') {
      outcome = await processReferenceCompare(jobData);
    } else {
      outcome = await processGenre(jobData);
    }

    // Sanitizar antes de enviar
    if (outcome.result) {
      outcome.result = sanitizeSuggestionsForReduced(outcome.result);
    }

    const memAfter = process.memoryUsage();
    const elapsed = Date.now() - startTime;

    console.log(`[ANALYSIS-JOB] ═══════════════════════════════════════`);
    console.log(`[ANALYSIS-JOB] ✅ Job concluído PID=${process.pid}`);
    console.log(`[ANALYSIS-JOB] Tempo total: ${elapsed}ms`);
    console.log(`[ANALYSIS-JOB] RAM pico: ${(memAfter.rss / 1024 / 1024).toFixed(1)}MB`);
    console.log(`[ANALYSIS-JOB] Heap usado: ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log(`[ANALYSIS-JOB] ═══════════════════════════════════════`);

    // Enviar resultado para o processo pai
    process.send({
      type: 'result',
      status: outcome.status,
      result: outcome.result,
      metrics: {
        elapsed,
        peakRssMB: Math.round(memAfter.rss / 1024 / 1024),
        heapUsedMB: Math.round(memAfter.heapUsed / 1024 / 1024),
      }
    });

  } catch (error) {
    console.error(`[ANALYSIS-JOB] ❌ Erro fatal PID=${process.pid}:`, error.message);

    process.send({
      type: 'error',
      error: error.message,
      stack: error.stack,
    });
  } finally {
    // Fechar pool do DB (o pool pode manter o processo vivo)
    try {
      await pool.end();
    } catch (_) {}

    // 🔥 ESSENCIAL: Garantir morte do processo após envio
    // Pequeno delay para garantir que o IPC flush aconteça
    setTimeout(() => {
      console.log(`[ANALYSIS-JOB] 💀 Encerrando processo PID=${process.pid}`);
      process.exit(0);
    }, 500);
  }
});

// Safety: se o processo pai morrer, este processo também morre
process.on('disconnect', () => {
  console.log(`[ANALYSIS-JOB] ⚠️ Pai desconectou — encerrando PID=${process.pid}`);
  process.exit(1);
});

// Safety: timeout global para processos órfãos (5 minutos)
const ORPHAN_TIMEOUT = 300000;
setTimeout(() => {
  console.error(`[ANALYSIS-JOB] ⏰ Timeout global de ${ORPHAN_TIMEOUT / 1000}s — processo órfão PID=${process.pid}`);
  process.exit(1);
}, ORPHAN_TIMEOUT).unref(); // unref para não impedir exit natural
