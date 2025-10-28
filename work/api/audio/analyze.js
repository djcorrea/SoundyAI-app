/**
 * 🎵 API de Análise de Áudio - Versão Robusta com Inicialização Síncrona
 * Recebe fileKey de arquivos já uploadados via presigned URL
 * 
 * ✅ CORRIGIDO: Timing de inicialização - Queue só aceita requisições quando pronta
 * ✅ CORRIGIDO: Conexão centralizada via lib/queue.js
 * ✅ CORRIGIDO: Sem IIFE não aguardada
 */

import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import { getQueueReadyPromise, getAudioQueue } from '../../lib/queue.js';
import pool from "../../db.js";

// Definir service name para auditoria
process.env.SERVICE_NAME = 'api';

const router = express.Router();

// 🚀 INICIALIZAÇÃO SÍNCRONA: Aguardar queue estar pronta antes de aceitar requisições
let queueInitialized = false;
const queueReadyPromise = getQueueReadyPromise();

// Log do início da inicialização
console.log(`🚀 [API-INIT][${new Date().toISOString()}] -> Starting queue initialization...`);

queueReadyPromise
  .then((result) => {
    queueInitialized = true;
    console.log(`✅ [API-INIT][${new Date().toISOString()}] -> Queue initialization completed successfully!`);
    console.log(`📊 [API-INIT][${new Date().toISOString()}] -> Ready at: ${result.timestamp}`);
  })
  .catch((error) => {
    console.error(`💥 [API-INIT][${new Date().toISOString()}] -> Queue initialization FAILED:`, error.message);
    console.error(`💥 [API-INIT][${new Date().toISOString()}] -> Stack trace:`, error.stack);
  });

// Configuração via variável de ambiente
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");

// Extensões aceitas (verificação por fileKey)
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

/**
 * Validar feature flags
 */
function validateFeatureFlags() {
  return {
    REFERENCE_MODE_ENABLED: process.env.REFERENCE_MODE_ENABLED === "true" || true, // Default true
    FALLBACK_TO_GENRE: process.env.FALLBACK_TO_GENRE === "true" || true,
    DEBUG_REFERENCE_MODE: process.env.DEBUG_REFERENCE_MODE === "true" || false,
  };
}

/**
 * Validar o tipo de arquivo baseado no fileKey
 */
function validateFileType(fileKey) {
  if (!fileKey || typeof fileKey !== "string") {
    return false;
  }

  const lastDotIndex = fileKey.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return false;
  }

  const ext = fileKey.substring(lastDotIndex).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Criar job no banco de dados E enfileirar no Redis
 */
/**
 * ✅ FUNÇÃO ROBUSTA: Criar job no banco e enfileirar no Redis
 * Garantias: Só executa quando queue estiver pronta
 */
async function createJobInDatabase(fileKey, mode, fileName) {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  
  console.log(`📋 [JOB-CREATE][${now}] -> Creating job: ${jobId} | fileKey: ${fileKey} | mode: ${mode}`);

  try {
    // 🚀 CRÍTICO: Aguardar queue estar pronta antes de qualquer operação
    if (!queueInitialized) {
      console.log(`⏳ [JOB-CREATE][${new Date().toISOString()}] -> Queue not ready, waiting...`);
      console.log('[API] ⏳ aguardando queueReadyPromise (implementa waitUntilReady)...');
      await queueReadyPromise;
      console.log('[API] ✅ Queue pronta após waitUntilReady!');
      console.log(`✅ [JOB-CREATE][${new Date().toISOString()}] -> Queue ready, proceeding with job creation`);
    }

    // ✅ FLUXO PRINCIPAL: PostgreSQL disponível - CRIAR NO BANCO PRIMEIRO
    console.log(`💾 [JOB-CREATE][${new Date().toISOString()}] -> Creating job in PostgreSQL...`);
    
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, mode, "queued", fileName || null]
    );

    console.log(`✅ [JOB-CREATE][${new Date().toISOString()}] -> Job created in PostgreSQL:`, result.rows[0]);

    // 🚀 APÓS SALVAR NO POSTGRES → ENFILEIRAR NO REDIS
    try {
      console.log(`📤 [JOB-ENQUEUE][${new Date().toISOString()}] -> Starting job enqueue process...`);
      console.log('📩 [API] Enfileirando job...');
      console.log('[API] Queue pronta. Enfileirando...');
      
      // Obter queue centralizada
      const audioQueue = getAudioQueue();
      console.log('[API] 🔍 Obteve audioQueue - verificando se é a mesma que Worker usa...');
      
      // 🔍 VERIFICAR STATUS DA FILA ANTES DE ADICIONAR JOB
      const queueCountsBefore = await audioQueue.getJobCounts();
      console.log(`📊 [JOB-ENQUEUE][${new Date().toISOString()}] -> Queue counts before:`, queueCountsBefore);
      
      // ✅ GARANTIR QUE A FILA NÃO ESTÁ PAUSADA
      await audioQueue.resume();
      console.log(`▶️ [JOB-ENQUEUE][${new Date().toISOString()}] -> Queue resumed (not paused)`);
      
      // ✅ ENFILEIRAR JOB COM ID ÚNICO
      const uniqueJobId = `audio-${jobId}-${Date.now()}`;
      
      console.log(`🎯 [JOB-ENQUEUE][${new Date().toISOString()}] -> Adding job to queue with ID: ${uniqueJobId}`);
      console.log('[API] 📤 Adicionando job com await audioQueue.add()...');
      console.log('[API] 🎯 Nome da fila: audio-analyzer (mesmo que Worker)');
      console.log('[API] 🎯 Job name: process-audio');
      console.log('[API] 🎯 Payload:', { jobId, fileKey, fileName, mode });
      
      const redisJob = await audioQueue.add('process-audio', {
        jobId: jobId,
        fileKey,
        fileName,
        mode
      }, {
        jobId: uniqueJobId,
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });
      
      console.log('✅ [API] Job enfileirado:', redisJob.id);
      console.log('[API] ✅ Job enfileirado:', redisJob.id);
      console.log(`✅ [JOB-ENQUEUE][${new Date().toISOString()}] -> Job successfully enqueued!`);
      console.log(`📋 [JOB-ENQUEUE][${new Date().toISOString()}] -> Redis Job ID: ${redisJob.id} | JobID: ${jobId}`);
      
      // 🔍 VERIFICAR STATUS DA FILA APÓS ADICIONAR JOB
      const queueCountsAfter = await audioQueue.getJobCounts();
      console.log(`📊 [JOB-ENQUEUE][${new Date().toISOString()}] -> Queue counts after:`, queueCountsAfter);
      
      // Verificar se realmente foi adicionado
      const delta = queueCountsAfter.waiting - queueCountsBefore.waiting;
      if (delta > 0) {
        console.log(`🎉 [JOB-ENQUEUE][${new Date().toISOString()}] -> Job confirmed in queue (+${delta} waiting jobs)`);
      } else {
        console.warn(`⚠️ [JOB-ENQUEUE][${new Date().toISOString()}] -> Warning: No increase in waiting jobs detected`);
      }

    } catch (enqueueError) {
      console.error('[API] ❌ Erro ao enfileirar job:', enqueueError.message);
      console.error('[API] ❌ Stack trace do enqueue:', enqueueError.stack);
      console.error(`💥 [JOB-ENQUEUE][${new Date().toISOString()}] -> CRITICAL: Failed to enqueue job:`, enqueueError.message);
      console.error(`💥 [JOB-ENQUEUE][${new Date().toISOString()}] -> Stack trace:`, enqueueError.stack);
      
      // Atualizar status no banco para refletir falha de enfileiramento
      await pool.query(
        `UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [jobId]
      );
      
      throw new Error(`Failed to enqueue job in Redis: ${enqueueError.message}`);
    }

    return result.rows[0];
    
  } catch (error) {
    console.error(`💥 [JOB-CREATE][${new Date().toISOString()}] -> CRITICAL ERROR creating job:`, error.message);
    console.error(`💥 [JOB-CREATE][${new Date().toISOString()}] -> Stack trace:`, error.stack);
    throw new Error(`Error creating analysis job: ${error.message}`);
  }
}

/**
 * Obter mensagem de erro amigável
 */
function getErrorMessage(error) {
  const message = error.message;

  if (message.includes("fileKey é obrigatório")) {
    return {
      error: "Parâmetro obrigatório ausente",
      message: "O parâmetro fileKey é obrigatório",
      code: "MISSING_FILE_KEY",
    };
  }

  if (message.includes("Extensão não suportada")) {
    return {
      error: "Formato não suportado",
      message: "Apenas arquivos WAV, FLAC e MP3 são aceitos.",
      code: "INVALID_FORMAT",
      supportedFormats: ["WAV", "FLAC", "MP3"],
    };
  }

  if (message.includes("Modo de análise inválido")) {
    return {
      error: "Modo inválido",
      message: 'Modo deve ser "genre" ou "reference"',
      code: "INVALID_MODE",
      supportedModes: ["genre", "reference"],
    };
  }

  if (message.includes("não está disponível")) {
    return {
      error: "Funcionalidade indisponível",
      message: "Modo de análise por referência não está disponível no momento",
      code: "REFERENCE_MODE_DISABLED",
    };
  }

  if (message.includes("Erro ao criar job")) {
    return {
      error: "Erro interno",
      message: "Erro ao processar solicitação de análise",
      code: "DATABASE_ERROR",
    };
  }

  return {
    error: "Erro no processamento",
    message: message || "Erro desconhecido durante o processamento",
    code: "PROCESSING_ERROR",
  };
}

/**
 * Middleware de CORS
 */
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

/*
 * POST /api/audio/analyze - Criar job de análise baseado em fileKey
 */
/**
 * ✅ ROTA ROBUSTA: Análise de áudio com verificação de inicialização
 * Garantias: Só processa requisições quando queue estiver pronta
 */
router.post("/analyze", async (req, res) => {
  const startTime = Date.now();

  // ✅ LOG OBRIGATÓRIO: Início da rota
  console.log('🚀 [API] /analyze chamada');
  console.log('[API] 🚀 Rota /analyze chamada');
  
  try {
    console.log(`🚀 [API-REQUEST][${new Date().toISOString()}] -> New job creation request started`);
    console.log(`📥 [API-REQUEST][${new Date().toISOString()}] -> Request body:`, req.body);

    // 🚀 CRÍTICO: Verificar se queue está inicializada antes de processar
    if (!queueInitialized) {
      console.log(`⏳ [API-REQUEST][${new Date().toISOString()}] -> Queue not ready, waiting for initialization...`);
      console.log('[API] ⏳ Aguardando queue estar pronta (waitUntilReady)...');
      
      try {
        await queueReadyPromise;
        console.log('[API] ✅ Queue pronta! Prosseguindo...');
        console.log(`✅ [API-REQUEST][${new Date().toISOString()}] -> Queue ready, proceeding with request`);
      } catch (initError) {
        console.error('[API] ❌ Falha na inicialização da queue:', initError.message);
        console.error(`💥 [API-REQUEST][${new Date().toISOString()}] -> Queue initialization failed:`, initError.message);
        return res.status(503).json({
          success: false,
          error: "Service temporarily unavailable",
          message: "Queue system is not ready. Please try again in a few moments.",
          code: "QUEUE_NOT_READY"
        });
      }
    }

    const flags = validateFeatureFlags();
    console.log(`🚩 [API-REQUEST][${new Date().toISOString()}] -> Feature flags:`, flags);

    const { fileKey, mode = "genre", fileName } = req.body;
    console.log('[API] Dados recebidos:', { fileKey, mode, fileName });
    console.log(`📋 [API-REQUEST][${new Date().toISOString()}] -> Extracted data: fileKey=${fileKey}, mode=${mode}, fileName=${fileName}`);

    if (!fileKey) {
      console.error(`❌ [API-REQUEST][${new Date().toISOString()}] -> ERROR: fileKey is required`);
      throw new Error("fileKey é obrigatório");
    }

    if (!validateFileType(fileKey)) {
      console.error(`❌ [API-REQUEST][${new Date().toISOString()}] -> ERROR: Unsupported extension for ${fileKey}`);
      throw new Error("Extensão não suportada. Apenas WAV, FLAC e MP3 são aceitos.");
    }

    if (!["genre", "reference"].includes(mode)) {
      console.error(`❌ [API-REQUEST][${new Date().toISOString()}] -> ERROR: Invalid mode '${mode}'`);
      throw new Error('Modo de análise inválido. Use "genre" ou "reference".');
    }

    if (mode === "reference" && !flags.REFERENCE_MODE_ENABLED) {
      console.error(`❌ [API-REQUEST][${new Date().toISOString()}] -> ERROR: Reference mode disabled`);
      throw new Error("Modo de análise por referência não está disponível no momento");
    }

    console.log(`✅ [API-REQUEST][${new Date().toISOString()}] -> Validations passed, creating job...`);

    // ✅ LOG ANTES: Chamada createJobInDatabase
    console.log('[API] 📤 Iniciando createJobInDatabase...', { fileKey, mode, fileName });
    
    const jobRecord = await createJobInDatabase(fileKey, mode, fileName);
    
    // ✅ LOG DEPOIS: Chamada createJobInDatabase
    console.log('[API] ✅ createJobInDatabase concluída:', { jobId: jobRecord.id, status: jobRecord.status });
    
    const processingTime = Date.now() - startTime;

    console.log(`🎉 [API-REQUEST][${new Date().toISOString()}] -> Job created successfully in ${processingTime}ms - jobId: ${jobRecord.id}, mode: ${mode}`);

    // 🔑 Alinhado com o frontend
    res.status(200).json({
      success: true,
      jobId: jobRecord.id,
      fileKey: jobRecord.file_key,
      mode: jobRecord.mode,
      fileName: jobRecord.file_name || null,
      status: jobRecord.status,
      createdAt: jobRecord.created_at,
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // ✅ LOGS DE ERRO DETALHADOS
    console.error('[API] ❌ Erro ao processar rota /analyze:', error.message);
    console.error('[API] ❌ Stack trace:', error.stack);
    console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO CRÍTICO na criação do job:`, error.message);
    console.error(`[BACKEND][${new Date().toISOString()}] -> Stack trace:`, error.stack);

    const errorResponse = getErrorMessage(error);
    const statusCode =
      error.message.includes("obrigatório") || error.message.includes("inválido") ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      ...errorResponse,
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;