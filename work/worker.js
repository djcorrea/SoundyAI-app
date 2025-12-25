// work/index.js
import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import logger from "./lib/logger.js";

// ---------- Worker Health Monitoring ----------
let workerHealthy = true;
let lastHealthCheck = Date.now();

function updateWorkerHealth() {
  workerHealthy = true;
  lastHealthCheck = Date.now();
}

// Monitor de saúde a cada 30 segundos
setInterval(() => {
  const timeSinceLastCheck = Date.now() - lastHealthCheck;
  if (timeSinceLastCheck > 120000) { // 2 minutos sem health check
    logger.error(`Worker unhealthy: ${timeSinceLastCheck}ms sem update`);
    workerHealthy = false;
  }
}, 30000);

// Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION - Worker crashing:', err.message, err.stack);
  
  // Tentar cleanup de jobs órfãos antes de sair
  client.query(`
    UPDATE jobs 
    SET status = 'failed', 
        error = 'Worker crashed with uncaught exception: ${err.message}',
        updated_at = NOW()
    WHERE status = 'processing'
  `).catch(cleanupErr => {
    logger.error('Failed to cleanup jobs on crash:', cleanupErr);
  }).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION:', reason);
  // Não mata o worker imediatamente, mas registra o problema
  workerHealthy = false;
});

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Importar pipeline completo ----------
let processAudioComplete = null;

try {
  const imported = await import("../api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  logger.info("Pipeline completo carregado");
} catch (err) {
  logger.error("CRÍTICO: Falha ao carregar pipeline:", err.message, { cwd: process.cwd() });
  process.exit(1);
}

// ---------- Importar enrichment de IA ----------
let enrichSuggestionsWithAI = null;

try {
  const imported = await import("./lib/ai/suggestion-enricher.js");
  enrichSuggestionsWithAI = imported.enrichSuggestionsWithAI;
  logger.info("AI enrichment carregado");
} catch (err) {
  logger.warn("AI enrichment não disponível:", err.message);
}

// ---------- Conectar ao Postgres ----------
const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();
logger.info("Worker conectado ao Postgres");

// Configuração Backblaze (sem logs de debug)

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
});
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Baixar arquivo do bucket ----------
async function downloadFileFromBucket(key) {
  logger.debug(`Baixando: ${key}`);
  const localPath = path.join("/tmp", path.basename(key));
  return new Promise(async (resolve, reject) => {
    try {
      const write = fs.createWriteStream(localPath);
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
      const response = await s3.send(command);
      const read = response.Body;

      // 🔥 TIMEOUT DE 2 MINUTOS - EVITA DOWNLOAD INFINITO
      const timeout = setTimeout(() => {
        write.destroy();
        if (read && read.destroy) read.destroy();
        reject(new Error(`Download timeout após 2 minutos para: ${key}`));
      }, 120000);

      read.on("error", (err) => {
        clearTimeout(timeout);
        logger.error(`Stream leitura erro para ${key}:`, err.message, { code: err.code });
        reject(err);
      });
      write.on("error", (err) => {
        clearTimeout(timeout);
        logger.error(`Stream escrita erro para ${key}:`, err.message);
        reject(err);
      });
      write.on("finish", () => {
        clearTimeout(timeout);
        logger.debug(`Download concluído: ${key}`);
        resolve(localPath);
      });

      read.pipe(write);
    } catch (err) {
      reject(err);
    }
  });
}

// ---------- Análise REAL via pipeline ----------
// 🔧 FUNÇÃO CORRIGIDA: agora passa genre/mode/jobId corretamente
async function analyzeAudioWithPipeline(localFilePath, jobOrOptions) {
  const filename = path.basename(localFilePath);
  
  try {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    const t0 = Date.now();

    const isGenreMode = jobOrOptions.mode === "genre";
    let resolvedGenre = null;

    if (isGenreMode) {
        resolvedGenre =
            jobOrOptions.genre ||
            jobOrOptions.data?.genre ||
            null;

        if (typeof resolvedGenre === "string") {
            resolvedGenre = resolvedGenre.trim();
        }

        if (!resolvedGenre) {
            logger.error("[GENRE-ERROR] Modo gênero sem gênero válido", { mode: jobOrOptions.mode, genre: jobOrOptions.genre });
            resolvedGenre = null;
        }
    } else {
        resolvedGenre =
            jobOrOptions.genre ||
            jobOrOptions.data?.genre ||
            jobOrOptions.genre_detected ||
            "default";
    }

    const pipelineOptions = {
      // ID do job
      jobId: jobOrOptions.jobId || jobOrOptions.id || null,

      // Referência (quando existir)
      reference: jobOrOptions.reference || jobOrOptions.reference_file_key || null,

      // Modo de análise: 'genre', 'comparison', etc.
      mode: jobOrOptions.mode || 'genre',

      // 🎯 CORREÇÃO CRÍTICA: Genre sem fallback "default" no modo genre
      genre: resolvedGenre,

      // 🎯 NOVO: Propagar genreTargets
      genreTargets:
        jobOrOptions.genreTargets ||
        jobOrOptions.data?.genreTargets ||
        null,

      // Dados de comparação, se existirem
      referenceJobId:
        jobOrOptions.referenceJobId ||
        jobOrOptions.reference_job_id ||
        null,

      isReferenceBase:
        jobOrOptions.isReferenceBase ??
        jobOrOptions.is_reference_base ??
        false,

      planContext:
        jobOrOptions.planContext ||
        jobOrOptions.data?.planContext ||
        null,
    };

    const pipelinePromise = processAudioComplete(fileBuffer, filename, pipelineOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout após 3 minutos para: ${filename}`));
      }, 180000);
    });

    logger.debug(`Iniciando pipeline: ${filename}`);
    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
    const totalMs = Date.now() - t0;
    
    logger.info(`Pipeline concluído: ${filename}`, { duration_ms: totalMs });

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4",
    };

    finalJSON._worker = { source: "pipeline_complete" };

    return finalJSON;
    
  } catch (error) {
    logger.error(`Erro crítico no pipeline: ${filename}`, error.message, { stack: error.stack });
    
    // 🔥 RETORNO DE SEGURANÇA - NÃO MATA O WORKER
    return {
      status: 'error',
      error: {
        message: error.message,
        type: 'worker_pipeline_error',
        phase: 'worker_processing',
        timestamp: new Date().toISOString()
      },
      score: 0,
      classification: 'Erro Crítico',
      scoringMethod: 'worker_error_fallback',
      metadata: {
        fileName: filename,
        fileSize: 0,
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        processedAt: new Date().toISOString(),
        engineVersion: 'worker-error',
        pipelinePhase: 'error'
      },
      technicalData: {
        lufsIntegrated: null,
        truePeakDbtp: null,
        dynamicRange: null,
        crestFactor: null,
        stereoCorrelation: null,
        spectral_balance: null,
        _error: 'pipeline_failed'
      },
      warnings: [`Worker error: ${error.message}`],
      buildVersion: 'worker-error',
      frontendCompatible: false,
      _worker: { source: "pipeline_error", error: true }
    };
  }
}

// ---------- Processar 1 job ----------
async function processJob(job) {
  logger.info(`Processando job: ${job.id.substring(0,8)}`, { mode: job.data?.mode, genre: job.data?.genre });

  let localFilePath = null;
  let heartbeatInterval = null;

  try {
    
    if (updateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'processing'`);
    }

    // 🔥 HEARTBEAT A CADA 30 SEGUNDOS
    heartbeatInterval = setInterval(async () => {
      try {
        await client.query(
          "UPDATE jobs SET updated_at = NOW() WHERE id = $1 AND status = 'processing'",
          [job.id]
        );
        console.log(`💓 Heartbeat enviado para job ${job.id}`);
      } catch (err) {
        console.warn(`⚠️ Falha no heartbeat para job ${job.id}:`, err.message);
      }
    }, 30000);

    localFilePath = await downloadFileFromBucket(job.file_key);
    console.log(`🎵 Arquivo pronto para análise: ${localFilePath}`);

    // 🔍 VALIDAÇÃO BÁSICA DE ARQUIVO
    console.log(`🔍 [${job.id.substring(0,8)}] Validando arquivo antes do pipeline...`);
    const stats = await fs.promises.stat(localFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (stats.size < 1000) {
      throw new Error(`File too small: ${stats.size} bytes (minimum 1KB required)`);
    }
    
    if (fileSizeMB > 100) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)} MB (maximum 100MB allowed)`);
    }
    
    console.log(`✅ [${job.id.substring(0,8)}] Arquivo validado (${fileSizeMB.toFixed(2)} MB)`);

    console.log("🚀 Rodando pipeline completo...");
    // Update health before intensive processing
    updateWorkerHealth();

    // ✅ PASSO 1: GARANTIR QUE O GÊNERO CHEGA NO PIPELINE
    console.log('[GENRE-TRACE][WORKER-INPUT] 🔍 Job recebido do banco:', {
      'job.id': job.id.substring(0, 8),
      'job.data (raw type)': typeof job.data,
      'job.data (raw value)': job.data,
      'job.mode': job.mode
    });
    
    // 🎯 CORREÇÃO CRÍTICA: Extrair genre E genreTargets com validação explícita
    let extractedGenre = null;
    let extractedGenreTargets = null;
    let extractedAnalysisType = null;
    let extractedReferenceStage = null;
    
    // Tentar extrair de job.data (objeto ou string JSON)
    if (job.data && typeof job.data === 'object') {
      extractedGenre = job.data.genre;
      extractedGenreTargets = job.data.genreTargets;
      extractedAnalysisType = job.data.analysisType || job.mode || job.data.mode;
      extractedReferenceStage = job.data.referenceStage;
    } else if (typeof job.data === 'string') {
      try {
        const parsed = JSON.parse(job.data);
        extractedGenre = parsed.genre;
        extractedGenreTargets = parsed.genreTargets;
        extractedAnalysisType = parsed.analysisType || job.mode;
        extractedReferenceStage = parsed.referenceStage;
      } catch (e) {
        logger.error('[WORKER] Parse error job.data:', e.message);
        extractedAnalysisType = job.mode || 'genre';
      }
    } else {
      logger.error('[WORKER] job.data null ou inválido');
      extractedAnalysisType = job.mode || 'genre';
    }
    
    // 🚨 VALIDAÇÃO: Genre obrigatório APENAS em analysisType='genre'
    // Reference mode NÃO exige genre (independente de base ou compare)
    
    // 🔥 CORREÇÃO CRÍTICA: Prevenir fallback 'genre' quando mode='reference'
    const finalAnalysisType = (job.mode === 'reference' || extractedAnalysisType === 'reference') 
      ? 'reference' 
      : (extractedAnalysisType || 'genre');
    const finalReferenceStage = extractedReferenceStage || null;
    
    const isGenreMode = finalAnalysisType === 'genre';
    const isReferenceMode = finalAnalysisType === 'reference';
    
    if (isGenreMode) {
      if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
        logger.error('[WORKER-VALIDATION] Genre ausente em analysisType=genre', {
          extractedGenre,
          analysisType: finalAnalysisType,
          jobId: job.id.substring(0, 8)
        });
        throw new Error(`Job ${job.id} - analysisType='genre' requer genre válido`);
      }
      logger.debug('[WORKER-VALIDATION] Genre válido:', { genre: extractedGenre });
    }
    
    const finalGenre = extractedGenre ? extractedGenre.trim() : null;
    const finalGenreTargets = extractedGenreTargets || null;

    let extractedPlanContext = null;
    if (job.data && typeof job.data === 'object') {
      extractedPlanContext = job.data.planContext;
    } else if (typeof job.data === 'string') {
      try {
        const parsed = JSON.parse(job.data);
        extractedPlanContext = parsed.planContext;
      } catch (e) {
        logger.debug('[PLAN-CONTEXT] Falha ao extrair planContext:', e.message);
      }
    }

    // 🎯 LOG DE AUDITORIA OBRIGATÓRIO
    console.log('[AUDIT-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-WORKER] job.id:', job.id);
    console.log('[AUDIT-WORKER] job.mode:', job.mode);
    console.log('[AUDIT-WORKER] analysisType:', finalAnalysisType);
    console.log('[AUDIT-WORKER] referenceStage:', finalReferenceStage);
    console.log('[AUDIT-WORKER] job.data.genre:', job.data?.genre);
    console.log('[AUDIT-WORKER] job.data.genreTargets:', job.data?.genreTargets ? 'PRESENTE' : 'AUSENTE');
    console.log('[AUDIT-WORKER] job.data.planContext:', extractedPlanContext ? 'PRESENTE' : 'AUSENTE');
    console.log('[AUDIT-WORKER] extractedGenre:', extractedGenre);
    console.log('[AUDIT-WORKER] finalGenre (trimmed):', finalGenre);
    console.log('[AUDIT-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const options = {
      jobId: job.id,
      reference: job?.reference || null,
      mode: job.mode || 'genre',
      analysisType: finalAnalysisType,  // 🆕 Campo explícito
      referenceStage: finalReferenceStage,  // 🆕 Campo explícito
      genre: finalGenre,
      genreTargets: finalGenreTargets, // 🎯 NOVO: Passar targets para o pipeline
      referenceJobId: job.reference_job_id || null,
      isReferenceBase: job.is_reference_base || false,
      planContext: extractedPlanContext || null  // 🎯 CRÍTICO: Passar planContext para o pipeline
    };
    
    // 🔥 PATCH 1: GARANTIR QUE options.genre RECEBE O GÊNERO DE data (APENAS EM GENRE MODE)
    if (finalAnalysisType === 'genre' && job.data && job.data.genre && !options.genre) {
      options.genre = job.data.genre;
      console.log('[AUDIT-FIX] Propagando job.data.genre para options.genre:', options.genre);
    }
    
    // 🚫 GUARD CRÍTICO: NÃO carregar genre em reference mode
    if (isReferenceMode) {
      console.log('[REFERENCE-MODE] ✅ Pulando pipeline de genre - modo comparação A/B');
      console.log('[REFERENCE-MODE] referenceStage:', finalReferenceStage);
      // Genre não é necessário em reference mode
    } else if (isGenreMode) {
      console.log('[GENRE-MODE] ✅ Pipeline com genre:', options.genre);
    }
    
    console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-FLOW] 📊 Parâmetros enviados para pipeline:');
    console.log('[GENRE-FLOW] mode:', options.mode);
    console.log('[GENRE-FLOW] analysisType:', options.analysisType);
    console.log('[GENRE-FLOW] genre:', options.genre);
    console.log('[GENRE-FLOW] hasTargets:', !!options.genreTargets);
    console.log('[GENRE-FLOW] targetKeys:', options.genreTargets ? Object.keys(options.genreTargets) : null);
    console.log('[AUDIT-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-WORKER] OPTIONS ENVIADO PARA PIPELINE:');
    console.log('[AUDIT-WORKER] options.genre:', options.genre);
    console.log('[AUDIT-WORKER] options.genreTargets:', options.genreTargets ? 'PRESENTE' : 'AUSENTE');
    console.log('[AUDIT-WORKER] options.mode:', options.mode);
    console.log('[AUDIT-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (job.mode === "comparison") {
      logger.info("Iniciando análise comparativa");

      const refPath = await downloadFileFromBucket(job.reference_file_key);
      logger.debug(`Arquivo de referência pronto: ${refPath}`);

      const userMetrics = await analyzeAudioWithPipeline(localFilePath, job);
      const refMetrics = await analyzeAudioWithPipeline(refPath, job);

      const { compareMetrics } = await import("../api/audio/pipeline-complete.js");
      const comparison = await compareMetrics(userMetrics, refMetrics);

      const forcedGenre = options.genre || job.data?.genre;

      const comparisonResult = {
        ...comparison,
        genre: forcedGenre,
        mode: job.mode,
        
        summary: {
          ...(comparison.summary || {}),
          genre: forcedGenre
        },
        
        metadata: {
          ...(comparison.metadata || {}),
          genre: forcedGenre
        },
        
        suggestionMetadata: {
          ...(comparison.suggestionMetadata || {}),
          genre: forcedGenre
        }
      };

      if (!Array.isArray(comparisonResult.suggestions)) {
        logger.warn("[SUGGESTIONS_ERROR] suggestions ausente - aplicando fallback");
        comparisonResult.suggestions = [];
      }
      if (!Array.isArray(comparisonResult.aiSuggestions)) {
        logger.warn("[SUGGESTIONS_ERROR] aiSuggestions ausente - aplicando fallback");
        comparisonResult.aiSuggestions = [];
      }

      const originalPayloadComparison = job.data || {};
      const safeGenreComparison = 
        (forcedGenre && forcedGenre !== 'default' && forcedGenre !== null)
          ? forcedGenre
          : originalPayloadComparison.genre ||
            options.genre ||
            comparisonResult.summary?.genre ||
            comparisonResult.data?.genre ||
            'default';

      comparisonResult.genre = safeGenreComparison;
      if (comparisonResult.summary) comparisonResult.summary.genre = safeGenreComparison;
      if (comparisonResult.metadata) comparisonResult.metadata.genre = safeGenreComparison;
      if (comparisonResult.suggestionMetadata) comparisonResult.suggestionMetadata.genre = safeGenreComparison;

      const finalUpdateResult = await client.query(
        `UPDATE jobs SET result = $1, results = $1, status = 'done', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(comparisonResult), job.id]
      );

      if (finalUpdateResult.rowCount === 0) {
        throw new Error(`Falha ao atualizar job de comparação ${job.id} para status 'done'`);
      }

      console.log("✅ [Worker] Job de comparação concluído:", job.id);
      
      // Limpar arquivo de referência
      try {
        await fs.promises.unlink(refPath);
      } catch (e) {
        console.warn("⚠️ Não foi possível remover arquivo de referência temporário:", e?.message);
      }
      
      updateWorkerHealth();
      return;
    }

    // Fluxo normal para jobs de análise única
    console.log("\n================ AUDITORIA: PRÉ-PIPELINE ================");
    console.log("[PRÉ-PIPELINE] options.genre:", options.genre);
    console.log("[PRÉ-PIPELINE] options.genreTargets:", options.genreTargets);
    console.log("[PRÉ-PIPELINE] job.data.genre:", job.data?.genre);
    console.log("============================================================\n");
    
    const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);
    
    console.log("\n================ AUDITORIA: PÓS-PIPELINE ================");
    console.log("[PÓS-PIPELINE] analysisResult.data.genreTargets existe?:", !!analysisResult?.data?.genreTargets);
    console.log("[PÓS-PIPELINE] analysisResult.data.metrics existe?:", !!analysisResult?.data?.metrics);
    console.log("[PÓS-PIPELINE] analysisResult.problemsAnalysis existe?:", !!analysisResult?.problemsAnalysis);
    console.log("[PÓS-PIPELINE] Campo de targets vindo do pipeline:", JSON.stringify(analysisResult?.data?.genreTargets, null, 2));
    console.log("[PÓS-PIPELINE] Número de sugestões geradas:", analysisResult?.problemsAnalysis?.suggestions?.length || 0);
    console.log("============================================================\n");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎯 CORREÇÃO CRÍTICA: RESOLUÇÃO FINAL DE GÊNERO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Helper para garantir que gênero NUNCA se perca no pipeline
    function resolveGenreForOutput(job, analysis, options = {}) {
      const mode = options.mode || job.data?.mode || analysis.mode || null;

      const genreFromJob = job.data?.genre || null;
      const genreFromOptions = options.genre || null;

      // Tenta pegar o gênero que o pipeline já detectou/propagou
      const genreFromAnalysis =
        analysis?.genre ||
        analysis?.detectedGenre ||
        analysis?.summary?.genre ||
        analysis?.technicalData?.problemsAnalysis?.qualityAssessment?.genre ||
        null;

      // Fallback FINAL: se o job foi criado com genre, ele é soberano
      const resolvedGenre =
        genreFromAnalysis ||
        genreFromOptions ||
        genreFromJob ||
        null;

      console.log('\n\n🟠🟠🟠 [AUDIT:GENRE-CHECK] Resolução de gênero no worker:');
      console.log('🟠 [AUDIT:GENRE-CHECK] mode:', mode);
      console.log('🟠 [AUDIT:GENRE-CHECK] genreFromJob:', genreFromJob);
      console.log('🟠 [AUDIT:GENRE-CHECK] genreFromOptions:', genreFromOptions);
      console.log('🟠 [AUDIT:GENRE-CHECK] genreFromAnalysis:', genreFromAnalysis);
      console.log('🟠 [AUDIT:GENRE-CHECK] resolvedGenre (FINAL):', resolvedGenre);
      console.log('🟠 [AUDIT:GENRE-CHECK] results?.metadata?.detectedGenre:', analysis?.metadata?.detectedGenre);
      
      console.log('[RESOLVE-GENRE] 🔍 Resolução de gênero:', {
        mode,
        genreFromJob,
        genreFromOptions,
        genreFromAnalysis,
        resolvedGenre
      });

      // Se estamos em modo genre, gênero é obrigatório
      if (mode === "genre" && (!resolvedGenre || typeof resolvedGenre !== "string")) {
        console.error('\n\n🔴🔴🔴 [AUDIT:GENRE-ERROR] ERRO CRÍTICO: Modo genre sem gênero válido!');
        console.error('🔴 [AUDIT:GENRE-ERROR] mode:', mode);
        console.error('🔴 [AUDIT:GENRE-ERROR] genreFromJob:', genreFromJob);
        console.error('🔴 [AUDIT:GENRE-ERROR] genreFromOptions:', genreFromOptions);
        console.error('🔴 [AUDIT:GENRE-ERROR] genreFromAnalysis:', genreFromAnalysis);
        console.error('🔴 [AUDIT:GENRE-ERROR] resolvedGenre:', resolvedGenre);
        console.error('🔴 [AUDIT:GENRE-ERROR] job.data completo:');
        console.dir(job.data, { depth: 10 });
        
        console.error('[RESOLVE-GENRE] ❌ ERRO CRÍTICO: modo genre sem gênero válido!', {
          mode,
          genreFromJob,
          genreFromOptions,
          genreFromAnalysis,
          resolvedGenre
        });
        throw new Error(
          "[GENRE-ERROR] Pipeline recebeu modo genre SEM gênero válido - NUNCA usar default"
        );
      }

      // Injeta o gênero resolvido de volta na análise para o resto do pipeline usar
      if (resolvedGenre) {
        if (!analysis.genre) analysis.genre = resolvedGenre;
        if (!analysis.detectedGenre) analysis.detectedGenre = resolvedGenre;

        if (!analysis.summary) analysis.summary = {};
        if (!analysis.summary.genre) analysis.summary.genre = resolvedGenre;

        if (!analysis.metadata) analysis.metadata = {};
        if (!analysis.metadata.genre) analysis.metadata.genre = resolvedGenre;

        if (!analysis.suggestionMetadata) analysis.suggestionMetadata = {};
        if (!analysis.suggestionMetadata.genre) analysis.suggestionMetadata.genre = resolvedGenre;

        if (!analysis.technicalData) analysis.technicalData = {};
        if (!analysis.technicalData.problemsAnalysis) {
          analysis.technicalData.problemsAnalysis = {};
        }
        if (!analysis.technicalData.problemsAnalysis.qualityAssessment) {
          analysis.technicalData.problemsAnalysis.qualityAssessment = {};
        }
        if (!analysis.technicalData.problemsAnalysis.qualityAssessment.genre) {
          analysis.technicalData.problemsAnalysis.qualityAssessment.genre = resolvedGenre;
        }

        if (!analysis.data) analysis.data = {};
        if (!analysis.data.genre) analysis.data.genre = resolvedGenre;

        console.log('[RESOLVE-GENRE] ✅ Gênero injetado em todas as estruturas:', resolvedGenre);
      }

      return { mode, resolvedGenre };
    }

    // 🎯 APLICAR RESOLUÇÃO DE GÊNERO IMEDIATAMENTE APÓS RECEBER DO PIPELINE
    const { mode: resolvedMode, resolvedGenre } = resolveGenreForOutput(job, analysisResult, options);
    
    console.log('[RESOLVE-GENRE] ✅ Resolução completa:', {
      resolvedMode,
      resolvedGenre,
      'analysisResult.genre após inject': analysisResult.genre
    });

    // 🔥 AUDITORIA: Genre ANTES do merge
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-AUDIT] ANTES DO MERGE:');
    console.log('[GENRE-AUDIT] options.genre:', options.genre);
    console.log('[GENRE-AUDIT] analysisResult.genre:', analysisResult.genre);
    console.log('[GENRE-AUDIT] analysisResult.summary?.genre:', analysisResult.summary?.genre);
    console.log('[GENRE-AUDIT] analysisResult.metadata?.genre:', analysisResult.metadata?.genre);
    console.log('[GENRE-AUDIT] analysisResult.suggestionMetadata?.genre:', analysisResult.suggestionMetadata?.genre);
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log("\n================ AUDITORIA: PRÉ-MERGE RESULT ================");
    console.log("[PRÉ-MERGE] analysisResult.data.genreTargets:", JSON.stringify(analysisResult?.data?.genreTargets, null, 2));
    console.log("[PRÉ-MERGE] analysisResult.data.metrics:", JSON.stringify(analysisResult?.data?.metrics, null, 2));
    console.log("[PRÉ-MERGE] analysisResult.problemsAnalysis.suggestions (primeiros 2):", JSON.stringify(analysisResult?.problemsAnalysis?.suggestions?.slice(0, 2), null, 2));
    console.log("[PRÉ-MERGE] Verificação de uso de fallback:");
    console.log("  - metadata.usingConsolidatedData:", analysisResult?.problemsAnalysis?.metadata?.usingConsolidatedData);
    console.log("============================================================\n");

    // 🔥 CORREÇÃO DEFINITIVA: Usar resolvedGenre do helper (já validado)
    const forcedGenre = resolvedGenre || options.genre;   // Gênero já resolvido e validado
    const forcedTargets = options.genreTargets || null;

    // 🛡️ Helper: Merge sem sobrescrever genre com null/undefined
    const mergePreservingGenre = (base, override, forcedGenreValue) => {
      const merged = { ...base, ...override };
      // Se genre for null, undefined ou string vazia, forçar o correto
      if (!merged.genre || merged.genre === null || merged.genre === undefined) {
        merged.genre = forcedGenreValue;
      }
      return merged;
    };

    // 🔥 CORREÇÃO CRÍTICA: NÃO usar spread de analysisResult (copia estruturas com genre: null)
    // Copiar campos EXPLICITAMENTE para garantir controle total
    const result = {
      ok: true,
      file: job.file_key,
      analyzedAt: new Date().toISOString(),

      // 🔥 Genre SEMPRE forçado na raiz
      genre: forcedGenre,
      mode: job.mode,

      // 🔥 Merge inteligente: preserva genre mesmo se vier null
      summary: mergePreservingGenre(
        analysisResult.summary || {},
        {},
        forcedGenre
      ),

      metadata: mergePreservingGenre(
        analysisResult.metadata || {},
        {},
        forcedGenre
      ),

      suggestionMetadata: mergePreservingGenre(
        analysisResult.suggestionMetadata || {},
        {},
        forcedGenre
      ),

      data: mergePreservingGenre(
        analysisResult.data || {},
        { genreTargets: forcedTargets },
        forcedGenre
      ),
      
      // 🔥 Campos EXPLÍCITOS de analysisResult (sem spread cego)
      suggestions: analysisResult.suggestions || [],
      aiSuggestions: analysisResult.aiSuggestions || [],
      problems: analysisResult.problems || [],
      problemsAnalysis: analysisResult.problemsAnalysis || { problems: [], suggestions: [] },
      diagnostics: analysisResult.diagnostics || {},
      scoring: analysisResult.scoring || {},
      technicalData: analysisResult.technicalData || {},
      
      // Campos técnicos opcionais
      lufs: analysisResult.lufs,
      truePeak: analysisResult.truePeak,
      dynamicRange: analysisResult.dynamicRange,
      spectralBalance: analysisResult.spectralBalance,
      score: analysisResult.score,
      readyForRelease: analysisResult.readyForRelease,
      overallRating: analysisResult.overallRating
    };

    // 🔥 AUDITORIA: Genre DEPOIS do merge
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-AUDIT] DEPOIS DO MERGE:');
    console.log('[GENRE-AUDIT] result.genre:', result.genre);
    console.log('[GENRE-AUDIT] result.summary?.genre:', result.summary?.genre);
    console.log('[GENRE-AUDIT] result.metadata?.genre:', result.metadata?.genre);
    console.log('[GENRE-AUDIT] result.suggestionMetadata?.genre:', result.suggestionMetadata?.genre);
    console.log('[GENRE-AUDIT] result.data?.genre:', result.data?.genre);
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ✅ ENRIQUECIMENTO DE IA SÍNCRONO (ANTES de salvar no banco)
    const shouldEnrich = result.mode !== 'genre' || !job.is_reference_base;
    if (enrichSuggestionsWithAI && shouldEnrich && Array.isArray(result.suggestions) && result.suggestions.length > 0) {
      console.log("[AI-ENRICH] 🤖 Iniciando enrichment IA ANTES de salvar job...");
      console.log("[AI-ENRICH] Suggestions base:", result.suggestions.length);
      console.log("[AI-ENRICH] Genre do result:", result.genre || result.metadata?.genre);
      
      try {
        // 🎯 CORREÇÃO: No modo genre, NUNCA usar 'default' como fallback
        const isGenreMode = result.mode === 'genre';
        const enrichmentGenre = isGenreMode
          ? (result.genre || result.data?.genre || result.metadata?.genre || null)
          : (result.genre || result.metadata?.genre || result.summary?.genre || 'default');
        
        console.log('[AI-ENRICH] 📊 Contexto para enrichment:', {
          fileName: result.metadata?.fileName,
          genre: enrichmentGenre,
          mode: result.mode,
          hasSummary: !!result.summary,
          summaryGenre: result.summary?.genre
        });
        
        // ✅ AGUARDAR o enrichment (SÍNCRONO)
        const enriched = await enrichSuggestionsWithAI(result.suggestions, {
          fileName: result.metadata?.fileName || 'unknown',
          genre: enrichmentGenre,
          mode: result.mode,
          scoring: result.scoring,
          metrics: result,
          userMetrics: result,
          referenceComparison: result.referenceComparison,
          referenceFileName: result.referenceFileName
        });
        
        // ✅ Inserir aiSuggestions NO result ANTES de salvar
        if (Array.isArray(enriched) && enriched.length > 0) {
          result.aiSuggestions = enriched;
          result._aiEnhanced = true;
          console.log(`[AI-ENRICH] ✅ ${enriched.length} sugestões enriquecidas pela IA`);
          console.log(`[AI-ENRICH] 📋 Amostra da primeira sugestão:`, enriched[0]);
        } else {
          console.warn("[AI-ENRICH] ⚠️ Nenhuma sugestão enriquecida gerada");
          console.warn("[AI-ENRICH] ⚠️ Retorno de enrichSuggestionsWithAI:", enriched);
          result.aiSuggestions = [];
          result._aiEnhanced = false;
        }
        
      } catch (enrichError) {
        console.error("[AI-ENRICH] ❌ Erro no enrichment:", enrichError.message);
        console.error("[AI-ENRICH] ❌ Stack:", enrichError.stack);
        result.aiSuggestions = [];
        result._aiEnhanced = false;
      }
    } else {
      console.log("[AI-ENRICH] ⏭️ Pulando enrichment IA:", {
        hasEnricher: !!enrichSuggestionsWithAI,
        mode: result.mode,
        isReferenceBase: job.is_reference_base,
        hasSuggestions: result.suggestions?.length > 0,
        suggestionsCount: result.suggestions?.length || 0
      });
      result.aiSuggestions = [];
      result._aiEnhanced = false;
    }

    // 🔒 GARANTIA: Validar campos obrigatórios DEPOIS do enrichment
    if (!Array.isArray(result.suggestions)) {
      console.error("[SUGGESTIONS_ERROR] suggestions ausente ou inválido - aplicando fallback");
      result.suggestions = [];
    }
    if (!Array.isArray(result.aiSuggestions)) {
      console.error("[SUGGESTIONS_ERROR] aiSuggestions ausente ou inválido - aplicando fallback");
      result.aiSuggestions = [];
    }
    
    console.log("\n================ AUDITORIA: ANTES DO SALVAMENTO ==============");
    console.log("[ANTES-SAVE] ⏰ Timestamp:", new Date().toISOString());
    console.log("[ANTES-SAVE] 📊 FINAL JSON QUE SERÁ SALVO NO POSTGRES:");
    console.log("[ANTES-SAVE] result.genre:", result.genre);
    console.log("[ANTES-SAVE] result.mode:", result.mode);
    console.log("[ANTES-SAVE] result.data.genre:", result.data?.genre);
    console.log("[ANTES-SAVE] result.data.genreTargets:", JSON.stringify(result.data?.genreTargets, null, 2));
    console.log("[ANTES-SAVE] result.data.metrics:", JSON.stringify(result.data?.metrics, null, 2));
    console.log("[ANTES-SAVE] result.problemsAnalysis.suggestions (primeiros 3):", JSON.stringify(result.problemsAnalysis?.suggestions?.slice(0, 3), null, 2));
    console.log("[ANTES-SAVE] result.problemsAnalysis.metadata.usingConsolidatedData:", result.problemsAnalysis?.metadata?.usingConsolidatedData);
    console.log("[ANTES-SAVE] result.aiSuggestions (primeiros 2):", JSON.stringify(result.aiSuggestions?.slice(0, 2), null, 2));
    console.log("[ANTES-SAVE] 🎯 Verificação de Consistência:");
    console.log("  - Targets no data:", Object.keys(result.data?.genreTargets || {}));
    console.log("  - Número de sugestões problemsAnalysis:", result.problemsAnalysis?.suggestions?.length || 0);
    console.log("  - Número de aiSuggestions:", result.aiSuggestions?.length || 0);
    console.log("===============================================================\n");
    
    if (!result.problemsAnalysis || typeof result.problemsAnalysis !== 'object') {
      console.error("[SUGGESTIONS_ERROR] problemsAnalysis ausente - aplicando fallback");
      result.problemsAnalysis = { problems: [], suggestions: [] };
    }

    console.log("[✅ VALIDATION] Campos validados DEPOIS do enrichment:", {
      suggestions: result.suggestions.length,
      aiSuggestions: result.aiSuggestions.length,
      _aiEnhanced: result._aiEnhanced,
      hasProblemAnalysis: !!result.problemsAnalysis,
      hasTechnicalData: !!(result.lufs || result.truePeak),
      hasScore: result.score !== undefined
    });
    
    // 📊 LOG DE AUDITORIA FINAL: Antes de persistir no banco
    console.log('[GENRE-FLOW][WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-FLOW][WORKER] 🎯 VALIDAÇÃO FINAL ANTES DE SALVAR:');
    console.log('[GENRE-FLOW][WORKER] result.genre:', result.genre);
    console.log('[GENRE-FLOW][WORKER] result.summary.genre:', result.summary?.genre);
    console.log('[GENRE-FLOW][WORKER] result.suggestionMetadata.genre:', result.suggestionMetadata?.genre);
    console.log('[GENRE-FLOW][WORKER] result.mode:', result.mode);
    console.log('[GENRE-FLOW][WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🔥 AUDITORIA: Genre ANTES DE SALVAR NO POSTGRES
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-AUDIT] FINAL (antes de salvar no Postgres):');
    console.log('[GENRE-AUDIT] result.genre:', result.genre);
    console.log('[GENRE-AUDIT] result.summary?.genre:', result.summary?.genre);
    console.log('[GENRE-AUDIT] result.metadata?.genre:', result.metadata?.genre);
    console.log('[GENRE-AUDIT] result.suggestionMetadata?.genre:', result.suggestionMetadata?.genre);
    console.log('[GENRE-AUDIT] result.data?.genre:', result.data?.genre);
    console.log('[GENRE-AUDIT] JSON.stringify length:', JSON.stringify(result).length);
    console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🎯 LOG DE AUDITORIA OBRIGATÓRIO
    console.log('[GENRE-TRACE][WORKER-RESULT] 💾 Resultado final antes de salvar:', {
      jobId: job.id.substring(0, 8),
      'result.genre': result.genre,
      'options.genre original': options.genre,
      hasGenreTargets: !!options.genreTargets,
      mode: result.mode
    });
    
    console.log('[AI-AUDIT][SUGGESTIONS_STATUS] 💾 WORKER SALVANDO:', {
      jobId: job.id.substring(0, 8),
      mode: result.mode,
      genre: result.genre,
      summaryGenre: result.summary?.genre,
      problems: result.problemsAnalysis?.problems?.length || 0,
      baseSuggestions: result.suggestions.length,
      aiSuggestions: result.aiSuggestions.length,
      _aiEnhanced: result._aiEnhanced,
      score: result.score,
      hasAllFields: !!(result.suggestions && result.aiSuggestions && result.problemsAnalysis)
    });

    // 🎯 LOG OBRIGATÓRIO: Estado final do result ANTES de salvar
    console.log("[RESULT-FIX] FINAL GENRE BEFORE RETURN:", {
      fromPipeline: analysisResult.genre,
      fromOptions: options.genre,
      fromJobData: job.data?.genre,
      finalResultGenre: result.genre,
      finalResultDataGenre: result.data?.genre,
      hasGenreTargets: !!result.data?.genreTargets,
      mode: result.mode
    });

    // 🔥 LOG DE AUDITORIA FINAL: Verificar TODOS os campos genre
    console.log("[GENRE-AUDIT-FINAL]", {
      resultGenre: result.genre,
      summaryGenre: result.summary?.genre,
      metadataGenre: result.metadata?.genre,
      suggestionMetadataGenre: result.suggestionMetadata?.genre,
      dataGenre: result.data?.genre,
      receivedGenre: options.genre,
      jobGenre: job.data?.genre
    });

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔥 PATCH DEFINITIVO V2: CRIAR OBJETO RESULTS SEPARADO PARA GARANTIA ABSOLUTA
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PROBLEMA ROOT CAUSE: result e results compartilhavam mesmo objeto JSON
    // SOLUÇÃO: Criar resultsForDb separado com GARANTIA de genre correto
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 🎯 PASSO 1: Extrair genre com prioridade absoluta
    const genreFromJob =
      job.data?.genre ||
      job.payload?.genre ||
      options.genre ||
      result?.genre ||
      result?.data?.genre ||
      result?.summary?.genre ||
      result?.metadata?.genre ||
      null;

    console.log('[GENRE-PATCH-V2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-PATCH-V2] 🎯 Extraindo genre prioritário:');
    console.log('[GENRE-PATCH-V2]    job.data.genre:', job.data?.genre);
    console.log('[GENRE-PATCH-V2]    job.payload.genre:', job.payload?.genre);
    console.log('[GENRE-PATCH-V2]    options.genre:', options.genre);
    console.log('[GENRE-PATCH-V2]    result.genre:', result?.genre);
    console.log('[GENRE-PATCH-V2]    ➡️ GÉNERO FINAL:', genreFromJob);
    console.log('[GENRE-PATCH-V2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 🎯 PASSO 2: Forçar genre no objeto result (para compatibilidade)
    if (genreFromJob) {
        result.genre = genreFromJob;
        result.summary = result.summary || {};
        result.summary.genre = genreFromJob;
        result.metadata = result.metadata || {};
        result.metadata.genre = genreFromJob;
        result.suggestionMetadata = result.suggestionMetadata || {};
        result.suggestionMetadata.genre = genreFromJob;
        result.data = result.data || {};
        result.data.genre = genreFromJob;
    }

    // 🎯 PASSO 3: Criar resultsForDb SEPARADO com estrutura garantida
    const resultsForDb = {
      // ✅ GARANTIA ABSOLUTA: Genre correto na raiz
      genre: genreFromJob,
      
      // ✅ Mode, score e classification
      mode: result.mode || job.mode || 'genre',
      score: result.score ?? 0,
      classification: result.classification || 'Análise Concluída',
      scoringMethod: result.scoringMethod || 'default',
      
      // ✅ Data com genre garantido
      data: {
        genre: genreFromJob,
        genreTargets: (() => {
          // 🔥 PATCH CRÍTICO: Garantir genreTargets em modo genre
          if (options.mode === 'genre' || result.mode === 'genre') {
            const fromResult = result.data?.genreTargets || result.genreTargets || null;
            const fromOptions = options.genreTargets || null;
            const fromMetadata = result.metadata?.genreTargets || null;
            
            // Tentar extrair de referenceData/referenceComparison se não houver
            let fromReference = null;
            if (!fromResult && !fromOptions && !fromMetadata) {
              const ref = result.referenceComparisonMetrics || result.referenceComparison || result.referenceData || null;
              if (ref) {
                fromReference = ref.bands || ref.spectral_bands || 
                               (ref.targets && (ref.targets.bands || ref.targets.spectral_bands)) || null;
              }
            }
            
            const finalTargets = fromResult || fromOptions || fromMetadata || fromReference || null;
            
            console.log('[GENRE-TARGETS-FINAL] ✅ data.genreTargets no JSON final:', {
              hasGenreTargets: !!finalTargets,
              keys: finalTargets ? Object.keys(finalTargets) : null,
              source: fromResult ? 'result.data' : fromOptions ? 'options' : fromMetadata ? 'metadata' : fromReference ? 'reference' : 'none'
            });
            
            return finalTargets;
          }
          
          // Modo não-genre: usar o que vier do result
          return result.data?.genreTargets || result.genreTargets || null;
        })(),
        ...result.data
      },
      
      // ✅ Summary com genre garantido
      summary: {
        genre: genreFromJob,
        ...result.summary
      },
      
      // ✅ Metadata com genre garantido
      metadata: {
        genre: genreFromJob,
        fileName: result.metadata?.fileName || result.fileName || job.file_key,
        fileSize: result.metadata?.fileSize || 0,
        duration: result.metadata?.duration || 0,
        sampleRate: result.metadata?.sampleRate || 48000,
        channels: result.metadata?.channels || 2,
        processedAt: new Date().toISOString(),
        ...result.metadata
      },
      
      // ✅ SuggestionMetadata com genre garantido
      suggestionMetadata: {
        genre: genreFromJob,
        ...result.suggestionMetadata
      },
      
      // ✅ Métricas técnicas
      technicalData: (() => {
        // 🔥 VALIDAÇÃO CRÍTICA: NUNCA salvar technicalData vazio
        if (!result.technicalData || typeof result.technicalData !== 'object') {
          console.error('[WORKER-CRITICAL] result.technicalData ausente ou inválido:', typeof result.technicalData);
          throw new Error('[WORKER-ERROR] result.technicalData está ausente - pipeline falhou');
        }
        const keys = Object.keys(result.technicalData);
        if (keys.length === 0) {
          console.error('[WORKER-CRITICAL] result.technicalData está vazio:', result.technicalData);
          throw new Error('[WORKER-ERROR] result.technicalData está vazio - pipeline não gerou métricas');
        }
        // Validar campos essenciais
        const essentialFields = ['lufsIntegrated', 'truePeakDbtp', 'dynamicRange', 'spectral_balance'];
        const missingFields = essentialFields.filter(f => result.technicalData[f] === undefined);
        if (missingFields.length > 0) {
          console.warn('[WORKER-WARNING] Campos essenciais ausentes:', missingFields);
        }
        console.log('[WORKER-VALIDATION] ✅ technicalData válido com', keys.length, 'campos');
        return result.technicalData;
      })(),
      loudness: result.loudness || {},
      dynamics: result.dynamics || {},
      truePeak: result.truePeak || {},
      energy: result.energy || {},
      // ❌ REMOVIDO: bands duplicado - usar apenas technicalData.spectral_balance
      // bands: result.bands || result.spectralBands || {},
      
      // ✅ Suggestions e AI
      suggestions: result.suggestions || [],
      aiSuggestions: result.aiSuggestions || [],
      problemsAnalysis: result.problemsAnalysis || {},
      diagnostics: result.diagnostics || {},
      
      // ✅ Performance e metadata
      performance: result.performance || {},
      ok: true,
      file: job.file_key,
      analyzedAt: result.analyzedAt || new Date().toISOString(),
      _aiEnhanced: result._aiEnhanced || false,
      _worker: result._worker || { source: 'pipeline_complete' }
    };

    console.log('[GENRE-PATCH-V2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-PATCH-V2] 📦 resultsForDb criado:');
    console.log('[GENRE-PATCH-V2]    resultsForDb.genre:', resultsForDb.genre);
    console.log('[GENRE-PATCH-V2]    resultsForDb.data.genre:', resultsForDb.data.genre);
    console.log('[GENRE-PATCH-V2]    resultsForDb.summary.genre:', resultsForDb.summary.genre);
    console.log('[GENRE-PATCH-V2]    resultsForDb.metadata.genre:', resultsForDb.metadata.genre);
    console.log('[GENRE-PATCH-V2]    resultsForDb.suggestionMetadata.genre:', resultsForDb.suggestionMetadata.genre);
    console.log('[GENRE-PATCH-V2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 🚨 BLINDAGEM FINAL: NUNCA salvar genre null/default em modo genre
    if (options.mode === 'genre' && (!resultsForDb.genre || resultsForDb.genre === 'default')) {
      console.error('[RESULTS-ERROR] Tentativa de salvar results.genre NULL/DEFAULT:', {
        pipelineGenre: resultsForDb.genre,
        expectedGenre: options.genre,
        mode: options.mode
      });
      throw new Error('[GENRE-ERROR] Falha crítica: results.genre não pode ser null/default em modo genre');
    }

    // 🚨 LOG DE AUDITORIA FINAL
    console.log('[AUDIT-RESULTS] Validação final antes de salvar:', {
      resultsGenre: resultsForDb.genre,
      optionsGenre: options.genre,
      mode: options.mode,
      isValid: resultsForDb.genre === options.genre
    });

    // 🎯 PASSO 4: Serializar AMBOS os objetos
    const resultJSON = JSON.stringify(result);      // Para campo 'result' (compatibilidade)
    const resultsJSON = JSON.stringify(resultsForDb); // Para campo 'results' (GARANTIA)

    console.log('\n\n🟣🟣🟣 [AUDIT:RESULT-BEFORE-SAVE] Resultado ANTES de salvar no Postgres:');
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] resultsForDb.genre:', resultsForDb.genre);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] resultsForDb.mode:', resultsForDb.mode);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] resultsForDb.data?.genre:', resultsForDb.data?.genre);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] resultsForDb.summary?.genre:', resultsForDb.summary?.genre);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] resultsForDb.metadata?.genre:', resultsForDb.metadata?.genre);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Genre original (job.data):', job.data?.genre);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] JSON length:', resultsJSON.length);
    console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Será salvo no campo results da tabela jobs');

    // 🔍 LOG PARANOID NÍVEL 1: VERIFICAR SERIALIZAÇÃO
    console.log("[GENRE-PARANOID][PRE-UPDATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[GENRE-PARANOID][PRE-UPDATE] 📊 result (compatibilidade):");
    console.log("[GENRE-PARANOID][PRE-UPDATE]    result.genre:", result.genre);
    console.log("[GENRE-PARANOID][PRE-UPDATE]    JSON length:", resultJSON.length);
    
    console.log("[GENRE-PARANOID][PRE-UPDATE] 📦 resultsForDb (GARANTIA):");
    console.log("[GENRE-PARANOID][PRE-UPDATE]    resultsForDb.genre:", resultsForDb.genre);
    console.log("[GENRE-PARANOID][PRE-UPDATE]    resultsForDb.data.genre:", resultsForDb.data.genre);
    console.log("[GENRE-PARANOID][PRE-UPDATE]    JSON length:", resultsJSON.length);
    
    // Parse para validar
    const parsedResult = JSON.parse(resultJSON);
    const parsedResults = JSON.parse(resultsJSON);
    
    console.log("[GENRE-PARANOID][PRE-UPDATE] ✅ Validação pós-parse:");
    console.log("[GENRE-PARANOID][PRE-UPDATE]    parsedResult.genre:", parsedResult.genre);
    console.log("[GENRE-PARANOID][PRE-UPDATE]    parsedResults.genre:", parsedResults.genre);
    console.log("[GENRE-PARANOID][PRE-UPDATE]    parsedResults.data.genre:", parsedResults.data?.genre);
    
    // 🚨 ALERTA SE GENRE FOI PERDIDO
    if (!parsedResults.genre || parsedResults.genre === null) {
      console.error("[GENRE-PARANOID][PRE-UPDATE] 🚨🚨🚨 GENRE NULL EM resultsJSON!");
      console.error("[GENRE-PARANOID][PRE-UPDATE] genreFromJob original:", genreFromJob);
      console.error("[GENRE-PARANOID][PRE-UPDATE] resultsForDb.genre:", resultsForDb.genre);
      console.error("[GENRE-PARANOID][PRE-UPDATE] parsedResults.genre:", parsedResults.genre);
    }
    console.log("[GENRE-PARANOID][PRE-UPDATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 🔥 AUDITORIA CRÍTICA: Verificar technicalData ANTES de salvar
    console.log('\n\n🔥🔥🔥 [AUDIT-TECHNICAL-DATA] WORKER PRE-SAVE 🔥🔥🔥');
    console.log('[AUDIT-TECHNICAL-DATA] resultsForDb.technicalData:', {
      exists: !!resultsForDb.technicalData,
      type: typeof resultsForDb.technicalData,
      isEmpty: resultsForDb.technicalData && Object.keys(resultsForDb.technicalData).length === 0,
      keys: resultsForDb.technicalData ? Object.keys(resultsForDb.technicalData) : [],
      hasSampleFields: {
        lufsIntegrated: resultsForDb.technicalData?.lufsIntegrated,
        truePeakDbtp: resultsForDb.technicalData?.truePeakDbtp,
        dynamicRange: resultsForDb.technicalData?.dynamicRange,
        spectral_balance: !!resultsForDb.technicalData?.spectral_balance
      }
    });
    console.log('[AUDIT-TECHNICAL-DATA] resultsForDb outros campos:', {
      hasScore: resultsForDb.score !== undefined,
      scoreValue: resultsForDb.score,
      hasClassification: !!resultsForDb.classification,
      hasData: !!resultsForDb.data,
      hasDataGenreTargets: !!resultsForDb.data?.genreTargets,
      hasSuggestions: Array.isArray(resultsForDb.suggestions),
      suggestionsCount: resultsForDb.suggestions?.length || 0
    });
    console.log('🔥🔥🔥 [AUDIT-TECHNICAL-DATA] END 🔥🔥🔥\n\n');

    // 🔥 ATUALIZAR STATUS FINAL: USAR resultsJSON SEPARADO
    console.log('[AUDIT-DB-SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-DB-SAVE] 🎯 Salvando no PostgreSQL:');
    console.log('[AUDIT-DB-SAVE]    job.id:', job.id);
    console.log('[AUDIT-DB-SAVE]    Campo result = resultJSON (length:', resultJSON.length, ')');
    console.log('[AUDIT-DB-SAVE]    Campo results = resultsJSON (length:', resultsJSON.length, ')');
    console.log('[AUDIT-DB-SAVE]    Genre esperado:', genreFromJob);
    console.log('[AUDIT-DB-SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 🔥 PATCH: Salvar finalJSON em results com status completed
    const finalUpdateResult = await client.query(
      `UPDATE jobs 
       SET results = $1::jsonb, 
           status = 'completed', 
           completed_at = NOW(),
           updated_at = NOW() 
       WHERE id = $2`,
      [resultsJSON, job.id]
    );

    if (finalUpdateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'completed'`);
    }

    console.log('[WORKER] ✅ Job finalizado e salvo:', {
      jobId: job.id,
      status: 'completed',
      resultsSize: resultsJSON.length,
      genre: resultsForDb.genre
    });

    updateWorkerHealth();
    
    // 🔥 RETORNAR: { results: finalJSON }
    return { results: resultsForDb };

  } catch (err) {
    console.error("❌ Erro no job:", err);
    
    // 🔥 ATUALIZAR STATUS ERRO + VERIFICAR SE FUNCIONOU
    try {
      const errorUpdateResult = await client.query(
        "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
        ["failed", err?.message ?? String(err), job.id]
      );
      
      if (errorUpdateResult.rowCount === 0) {
        console.error(`🚨 CRÍTICO: Falha ao atualizar job ${job.id} para status 'failed'`);
      }
    } catch (updateErr) {
      console.error(`🚨 CRÍTICO: Erro ao atualizar status de erro para job ${job.id}:`, updateErr);
    }
    // não mata o worker — deixa continuar processando próximos jobs
  } finally {
    // 🔥 PARAR HEARTBEAT
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (e) {
        console.warn("⚠️ Não foi possível remover arquivo temporário:", e?.message);
      }
    }
  }
}

// ---------- Recovery de jobs órfãos ----------
async function recoverOrphanedJobs() {
  try {
    console.log("🔄 Verificando jobs órfãos...");
    
    // 🚫 PRIMEIRO: Blacklist jobs problemáticos
    console.log("🚫 Verificando jobs problemáticos para blacklist...");
    const problematicJobs = await client.query(`
      SELECT file_key, COUNT(*) as failure_count, 
             ARRAY_AGG(id ORDER BY created_at DESC) as job_ids
      FROM jobs 
      WHERE error LIKE '%Recovered from orphaned state%' 
      OR error LIKE '%Pipeline timeout%'
      OR error LIKE '%FFmpeg%'
      OR error LIKE '%Memory%'
      GROUP BY file_key 
      HAVING COUNT(*) >= 3
    `);

    if (problematicJobs.rows.length > 0) {
      for (const row of problematicJobs.rows) {
        console.log(`🚫 Blacklisting file: ${row.file_key} (${row.failure_count} failures)`);
        
        // Marcar todos os jobs relacionados como failed permanentemente
        await client.query(`
          UPDATE jobs 
          SET status = 'failed', 
              error = $1, 
              updated_at = NOW()
          WHERE file_key = $2 
          AND status IN ('queued', 'processing')
        `, [
          `BLACKLISTED: File failed ${row.failure_count} times - likely corrupted/problematic`,
          row.file_key
        ]);
      }
      
      console.log(`🚫 Blacklisted ${problematicJobs.rows.length} problematic files`);
    } else {
      console.log("✅ Nenhum job problemático encontrado para blacklist");
    }
    
    // 🔄 DEPOIS: Recuperar jobs órfãos restantes (mas não blacklisted)
    const result = await client.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      AND error NOT LIKE '%BLACKLISTED%'
      RETURNING id, file_key
    `);

    if (result.rows.length > 0) {
      console.log(`🔄 Recuperados ${result.rows.length} jobs órfãos:`, result.rows.map(r => r.id.substring(0,8)));
    }
  } catch (err) {
    console.error("❌ Erro ao recuperar jobs órfãos:", err);
  }
}

// 🔥 RECOVERY A CADA 5 MINUTOS
setInterval(recoverOrphanedJobs, 300000);
recoverOrphanedJobs(); // Executa na inicialização

// ---------- Loop de jobs ----------
let isRunning = false;
async function processJobs() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 🔍 Verificar saúde do worker
    if (!workerHealthy) {
      console.warn("⚠️ Worker não está healthy - pulando cycle");
      return;
    }
    
    updateWorkerHealth(); // Update health check
    console.log("🔄 Worker verificando jobs...");
    const res = await client.query(
      "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
    );

    if (res.rows.length > 0) {
      await processJob(res.rows[0]);
    } else {
      console.log("📭 Nenhum job novo.");
    }
  } catch (e) {
    console.error("❌ Erro no loop de jobs:", e);
  } finally {
    isRunning = false;
  }
}

setInterval(processJobs, 5000);
processJobs();

console.log("🟪 [WORK-INIT] Work iniciado. Aguardando jobs...");

// FUNÇÃO enrichJobWithAI REMOVIDA - Enrichment agora é SÍNCRONO no fluxo principal

// ---------- Servidor Express para Railway ----------
const app = express();
const PORT = process.env.WORKER_PORT || 8081; // ✅ Usar porta diferente para o worker

app.get('/', (req, res) => {
  res.json({ 
    status: 'Worker rodando', 
    timestamp: new Date().toISOString(),
    worker: 'active'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    worker: 'active',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Worker + API rodando na porta ${PORT}`);
});