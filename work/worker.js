// work/index.js
import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

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
    console.error(`🚨 Worker unhealthy: ${timeSinceLastCheck}ms sem update`);
    workerHealthy = false;
  }
}, 30000);

// Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
  console.error('🚨 UNCAUGHT EXCEPTION - Worker crashing:', err.message);
  console.error('📜 Stack:', err.stack);
  
  // Tentar cleanup de jobs órfãos antes de sair
  client.query(`
    UPDATE jobs 
    SET status = 'failed', 
        error = 'Worker crashed with uncaught exception: ${err.message}',
        updated_at = NOW()
    WHERE status = 'processing'
  `).catch(cleanupErr => {
    console.error('❌ Failed to cleanup jobs on crash:', cleanupErr);
  }).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION:', reason);
  console.error('📍 Promise:', promise);
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
  console.log("✅ Pipeline completo carregado com sucesso!");
} catch (err) {
  console.error("❌ CRÍTICO: Falha ao carregar pipeline:", err.message);
  console.log("🔍 Debug info:");
  console.log("   import.meta.url:", import.meta.url);
  console.log("   process.cwd():", process.cwd());
  console.log("   __dirname equivalent:", path.dirname(fileURLToPath(import.meta.url)));
  process.exit(1); // encerra só se pipeline não existir
}

// ---------- Importar enrichment de IA ----------
let enrichSuggestionsWithAI = null;

try {
  const imported = await import("./lib/ai/suggestion-enricher.js");
  enrichSuggestionsWithAI = imported.enrichSuggestionsWithAI;
  console.log("✅ Enrichment de IA carregado com sucesso!");
} catch (err) {
  console.warn("⚠️ Enrichment de IA não disponível:", err.message);
  // Não é crítico - worker funciona sem IA
}

// ---------- Conectar ao Postgres ----------
const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();
console.log("✅ Worker conectado ao Postgres");

// ---------- Configuração Backblaze ----------
console.log("🔍 Debug B2 Config:");
console.log("   B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("   B2_APP_KEY:", process.env.B2_APP_KEY?.substring(0,10) + "...");
console.log("   B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("   B2_ENDPOINT:", process.env.B2_ENDPOINT);

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
  console.log(`🔍 Tentando baixar: ${key}`);
  console.log(`🔍 Bucket: ${BUCKET_NAME}`);
  
  const localPath = path.join("/tmp", path.basename(key)); // Railway usa /tmp
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
        console.error(`❌ Erro no stream de leitura para ${key}:`, err.message);
        console.error(`❌ Código do erro:`, err.code);
        console.error(`❌ Status:`, err.statusCode);
        reject(err);
      });
      write.on("error", (err) => {
        clearTimeout(timeout);
        console.error(`❌ Erro no stream de escrita para ${key}:`, err.message);
        reject(err);
      });
      write.on("finish", () => {
        clearTimeout(timeout);
        console.log(`✅ Download concluído para ${key}`);
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
    console.log(`📊 Arquivo lido: ${fileBuffer.length} bytes`);

    const t0 = Date.now();

    // Normalizar tanto o "job" antigo quanto o novo "options"
    // 🎯 Determine if we're in pure genre mode
    const isGenreMode = jobOrOptions.mode === "genre";

    let resolvedGenre = null;

    // 🎯 MODO GÊANERO: sem fallback "default"
    if (isGenreMode) {
        // 🔥 PRIORIZAR job.data.genre (mais confiável que job.genre)
        resolvedGenre =
            jobOrOptions.data?.genre ||
            jobOrOptions.genre ||
            null;

        if (typeof resolvedGenre === "string") {
            resolvedGenre = resolvedGenre.trim();
        }

        if (!resolvedGenre) {
            console.error("[GENRE-ERROR] Modo gênero, mas gênero ausente:", {
              'jobOrOptions.data?.genre': jobOrOptions.data?.genre,
              'jobOrOptions.genre': jobOrOptions.genre,
              'hasData': !!jobOrOptions.data,
              'jobId': jobOrOptions.jobId || jobOrOptions.id
            });
            resolvedGenre = null; // Apenas se REALMENTE não existir
        }
    } else {
        // Para modos diferentes de gênero, pode usar fallback antigo
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
    };

    console.log("[DEBUG-GENRE] pipelineOptions FINAL:", pipelineOptions.genre, pipelineOptions.genreTargets);
    console.log('[GENRE-FLOW][PIPELINE] ▶ Enviando options para processAudioComplete:', pipelineOptions);

    // 🔥 TIMEOUT DE 3 MINUTOS PARA EVITAR TRAVAMENTO
    const pipelinePromise = processAudioComplete(fileBuffer, filename, pipelineOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout após 3 minutos para: ${filename}`));
      }, 180000); // 3 minutos (reduzido de 5)
    });

    console.log(`⚡ Iniciando processamento de ${filename}...`);
    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
    const totalMs = Date.now() - t0;
    
    console.log(`✅ Pipeline concluído em ${totalMs}ms`);

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4",
    };

    finalJSON._worker = { source: "pipeline_complete" };

    return finalJSON;
    
  } catch (error) {
    console.error(`❌ Erro crítico no pipeline para ${filename}:`, error.message);
    
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
      technicalData: {},
      warnings: [`Worker error: ${error.message}`],
      buildVersion: 'worker-error',
      frontendCompatible: false,
      _worker: { source: "pipeline_error", error: true }
    };
  }
}

// ---------- Processar 1 job ----------
async function processJob(job) {
  console.log("📥 Processando job:", job.id);

  let localFilePath = null;
  let heartbeatInterval = null;

  try {
    // 🔥 ATUALIZAR STATUS + VERIFICAR SE FUNCIONOU
    const updateResult = await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );
    
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
    
    // Tentar extrair de job.data (objeto ou string JSON)
    if (job.data && typeof job.data === 'object') {
      extractedGenre = job.data.genre;
      extractedGenreTargets = job.data.genreTargets;
    } else if (typeof job.data === 'string') {
      try {
        const parsed = JSON.parse(job.data);
        extractedGenre = parsed.genre;
        extractedGenreTargets = parsed.genreTargets;
      } catch (e) {
        console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: Falha ao fazer parse de job.data:', e.message);
        throw new Error(`Job ${job.id} possui job.data inválido (não é JSON válido)`);
      }
    } else {
      console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: job.data está null ou tipo inválido:', typeof job.data);
      throw new Error(`Job ${job.id} não possui job.data (null ou undefined)`);
    }
    
    // 🚨 VALIDAÇÃO CRÍTICA: Se genre não for string válida, REJEITAR JOB (NUNCA usar 'default')
    if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
      console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: job.data.genre inválido ou ausente:', {
        extractedGenre,
        type: typeof extractedGenre,
        jobId: job.id.substring(0, 8),
        jobData: job.data
      });
      throw new Error(`Job ${job.id} não possui genre válido em job.data - REJEITADO (nunca usar 'default')`);
    }
    
    const finalGenre = extractedGenre.trim();
    const finalGenreTargets = extractedGenreTargets || null;

    // 🎯 LOG DE AUDITORIA OBRIGATÓRIO
    console.log('[GENRE-TRACE][WORKER-LOADED] ✅ Dados carregados do banco:', {
      jobId: job.id.substring(0, 8),
      jobData: job.data,
      extractedGenre,
      extractedGenreTargets: extractedGenreTargets ? Object.keys(extractedGenreTargets) : null,
      finalGenre,
      hasTargets: !!finalGenreTargets
    });
    
    const options = {
      jobId: job.id,
      reference: job?.reference || null,
      mode: job.mode || 'genre',
      genre: finalGenre,
      genreTargets: finalGenreTargets, // 🎯 NOVO: Passar targets para o pipeline
      referenceJobId: job.reference_job_id || null,
      isReferenceBase: job.is_reference_base || false
    };
    
    console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-FLOW] 📊 Parâmetros enviados para pipeline:');
    console.log('[GENRE-FLOW] genre:', options.genre);
    console.log('[GENRE-FLOW] hasTargets:', !!options.genreTargets);
    console.log('[GENRE-FLOW] targetKeys:', options.genreTargets ? Object.keys(options.genreTargets) : null);
    console.log('[GENRE-TRACE][WORKER-OPTIONS] ✅ Options construído:', {
      genre: options.genre,
      hasTargets: !!options.genreTargets,
      mode: options.mode
    });
    console.log('[GENRE-FLOW] mode:', options.mode);
    console.log('[GENRE-FLOW] referenceJobId:', options.referenceJobId);
    console.log('[GENRE-FLOW] isReferenceBase:', options.isReferenceBase);
    console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ✅ DETECÇÃO DO MODO COMPARISON
    if (job.mode === "comparison") {
      console.log("🎧 [Worker] Iniciando análise comparativa entre faixas...");

      // Baixar arquivo de referência
      const refPath = await downloadFileFromBucket(job.reference_file_key);
      console.log(`🎵 Arquivo de referência pronto: ${refPath}`);

      // Analisar ambos os arquivos
      const userMetrics = await analyzeAudioWithPipeline(localFilePath, options);  // 🔥 USAR OPTIONS
      const refMetrics = await analyzeAudioWithPipeline(refPath, options);  // 🔥 USAR OPTIONS

      // Importar função de comparação
      const { compareMetrics } = await import("../api/audio/pipeline-complete.js");
      const comparison = await compareMetrics(userMetrics, refMetrics);

      // 🔒 GARANTIA: Validar campos obrigatórios antes de salvar no banco
      if (!Array.isArray(comparison.suggestions)) {
        console.error("[SUGGESTIONS_ERROR] suggestions ausente na comparação - aplicando fallback");
        comparison.suggestions = [];
      }
      if (!Array.isArray(comparison.aiSuggestions)) {
        console.error("[SUGGESTIONS_ERROR] aiSuggestions ausente na comparação - aplicando fallback");
        comparison.aiSuggestions = [];
      }

      // Salvar resultado comparativo
      const finalUpdateResult = await client.query(
        `UPDATE jobs SET result = $1, results = $1, status = 'done', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(comparison), job.id]
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
    const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);

    // 🔥 VALIDAÇÃO CRÍTICA: Verificar se genre foi mantido
    console.log('[GENRE-DEBUG][BEFORE-RESULT]', {
      'analysisResult.genre': analysisResult.genre,
      'options.genre': options.genre,
      'job.data.genre': job.data?.genre,
      'finalGenre (do banco)': finalGenre,
      'isNull': analysisResult.genre === null,
      'isUndefined': analysisResult.genre === undefined
    });

    // 🔥 SE analysisResult.genre for null MAS options.genre existir, FORÇAR
    if ((!analysisResult.genre || analysisResult.genre === null) && options.genre) {
      console.warn('[GENRE-FIX] ⚠️ analysisResult.genre é null, mas options.genre existe. Forçando...');
      analysisResult.genre = options.genre;
    }

    // 🔥 CORREÇÃO DEFINITIVA: Forçar genre do usuário em TODAS as estruturas
    const forcedGenre = options.genre;   // Gênero escolhido pelo usuário
    const forcedTargets = options.genreTargets || null;

    const result = {
      ok: true,
      file: job.file_key,
      analyzedAt: new Date().toISOString(),

      ...analysisResult,

      // 🔥 Correção suprema: garantir que a raiz sempre tenha o gênero correto
      genre: forcedGenre,
      mode: job.mode,

      // 🔥 Corrigir summary.genre
      summary: {
        ...(analysisResult.summary || {}),
        genre: forcedGenre
      },

      // 🔥 Corrigir metadata.genre
      metadata: {
        ...(analysisResult.metadata || {}),
        genre: forcedGenre
      },

      // 🔥 Corrigir suggestionMetadata.genre
      suggestionMetadata: {
        ...(analysisResult.suggestionMetadata || {}),
        genre: forcedGenre
      },

      // 🔥 Corrigir data.genre + incluir targets
      data: {
        ...(analysisResult.data || {}),
        genre: forcedGenre,
        genreTargets: forcedTargets
      }
    };

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

    // 🔥 ATUALIZAR STATUS FINAL + VERIFICAR SE FUNCIONOU
    // ✅ CORREÇÃO CRÍTICA: Remover cast ::jsonb (Postgres driver detecta JSON automaticamente)
    const finalUpdateResult = await client.query(
      "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    if (finalUpdateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'done'`);
    }

    console.log(`✅ Job ${job.id} concluído e salvo no banco COM aiSuggestions`);
    
    updateWorkerHealth(); // Marcar como healthy após sucesso
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