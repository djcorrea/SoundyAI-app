/**
 * API de Análise de Áudio - Criação de Jobs baseado em FileKey
 * Recebe fileKey de arquivos já uploadados via presigned URL
 * 
 * Corrigido: 9 de setembro de 2025 - Express Router
 */

import express from "express";
import { randomUUID } from "crypto";
import { audioQueue } from "../../queue/redis.js";
import pool from "../../db.js";

const router = express.Router();

// 🔍 INSTRUMENTAÇÃO: Verificar configuração Redis na inicialização
console.log(`[BACKEND-INIT][${new Date().toISOString()}] -> 🔧 Configuração Redis carregada`);
console.log(`[BACKEND-INIT][${new Date().toISOString()}] -> 🎯 Fila importada: '${audioQueue.name}'`);
console.log(`[BACKEND-INIT][${new Date().toISOString()}] -> 🔗 Fonte: work/queue/redis.js (mesma do worker)`);

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
async function createJobInDatabase(fileKey, mode, fileName) {
  try {
    const jobId = randomUUID();
    const now = new Date().toISOString();

    console.log(`[BACKEND][${new Date().toISOString()}] -> 📋 Criando job: ${jobId} para fileKey: ${fileKey}, modo: ${mode}`);

    // 🧪 MODO DEBUG: Forçar modo mock se pool não estiver funcionando
    if (!pool || true) { // TEMPORÁRIO: forçar modo mock para teste
      console.log(`[BACKEND][${new Date().toISOString()}] -> 🧪 MODO MOCK/DEBUG - Job simulado criado com sucesso`);
      
      // Enfileirar no Redis mesmo em modo mock - INSTRUMENTAÇÃO ULTRA-DETALHADA
      try {
        console.log(`[BACKEND][${new Date().toISOString()}] -> 📥 INICIANDO enfileiramento no Redis (modo mock)...`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> 🎯 Fila de destino: '${audioQueue.name}' | Job type: 'analyze'`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> � Host Redis: guided-snapper-23234.upstash.io`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> 📦 Job ID gerado: ${jobId}`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> �📦 Dados completos do job:`, JSON.stringify({
          jobId,
          fileKey,
          mode,
          fileName: fileName || null
        }, null, 2));
        console.log(`[BACKEND][${new Date().toISOString()}] -> ⚙️ Opções BullMQ: attempts=3, backoff=exponential(5s), removeOnComplete=50`);
        
        const addedJob = await audioQueue.add('analyze', {
          jobId,
          fileKey,
          mode,
          fileName: fileName || null
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 100
        });
        
        console.log(`[BACKEND][${new Date().toISOString()}] -> ✅ Job ${jobId} enfileirado com sucesso!`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 BullMQ ID retornado: ${addedJob.id}`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> 📊 Fila confirmada: '${addedJob.queueName}' | Job name: '${addedJob.name}'`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> ⏰ Timestamp BullMQ: ${new Date(addedJob.timestamp).toISOString()}`);
        console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 Status do job adicionado (modo mock):`, {
          mockJobId: jobId,
          bullmqId: addedJob.id,
          queueName: addedJob.queueName,
          jobName: addedJob.name,
          timestamp: addedJob.timestamp,
          attempts: addedJob.opts?.attempts
        });
      } catch (redisError) {
        console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO CRÍTICO ao enfileirar no Redis (modo mock):`, redisError.message);
        console.error(`[BACKEND][${new Date().toISOString()}] -> 📊 CONTEXTO DO ERRO:`);
        console.error(`[BACKEND][${new Date().toISOString()}] ->    - Fila: '${audioQueue.name}'`);
        console.error(`[BACKEND][${new Date().toISOString()}] ->    - Job Type: 'analyze'`);
        console.error(`[BACKEND][${new Date().toISOString()}] ->    - Job ID: '${jobId}'`);
        console.error(`[BACKEND][${new Date().toISOString()}] ->    - Host Redis: guided-snapper-23234.upstash.io`);
        console.error(`[BACKEND][${new Date().toISOString()}] ->    - Modo: Mock (Postgres indisponível)`);
        console.error(`[BACKEND][${new Date().toISOString()}] -> 📜 Stack trace completo:`, redisError.stack);
        throw new Error(`Erro ao enfileirar job no Redis: ${redisError.message}`);
      }
      
      return {
        id: jobId,
        file_key: fileKey,
        mode: mode,
        status: "queued",
        file_name: fileName,
        created_at: now,
      };
    }

    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, mode, "queued", fileName || null]
    );

    console.log(`[BACKEND][${new Date().toISOString()}] -> ✅ Job criado com sucesso no PostgreSQL:`, result.rows[0]);

    // 🚀 ENFILEIRAR NO REDIS após criar no banco - INSTRUMENTAÇÃO ULTRA-DETALHADA
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📥 INICIANDO enfileiramento no Redis...`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🎯 Fila de destino: '${audioQueue.name}' | Job type: 'analyze'`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🔧 Host Redis: guided-snapper-23234.upstash.io`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📦 Job ID PostgreSQL: ${jobId}`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📦 Dados completos do job:`, JSON.stringify({
      jobId,
      fileKey,
      mode,
      fileName: fileName || null
    }, null, 2));
    console.log(`[BACKEND][${new Date().toISOString()}] -> ⚙️ Opções BullMQ: attempts=3, backoff=exponential(5s), removeOnComplete=50`);
    
    try {
      const addedJob = await audioQueue.add('analyze', {
        jobId,
        fileKey,
        mode,
        fileName: fileName || null
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100
      });

      console.log(`[BACKEND][${new Date().toISOString()}] -> ✅ Job ${jobId} enfileirado no Redis com sucesso!`);
      console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 BullMQ ID retornado: ${addedJob.id}`);
      console.log(`[BACKEND][${new Date().toISOString()}] -> 📊 Fila confirmada: '${addedJob.queueName}' | Job name: '${addedJob.name}'`);
      console.log(`[BACKEND][${new Date().toISOString()}] -> ⏰ Timestamp BullMQ: ${new Date(addedJob.timestamp).toISOString()}`);
      console.log(`[BACKEND][${new Date().toISOString()}] -> 🔍 Status do job adicionado:`, {
        postgresJobId: jobId,
        bullmqId: addedJob.id,
        queueName: addedJob.queueName,
        jobName: addedJob.name,
        timestamp: addedJob.timestamp,
        attempts: addedJob.opts?.attempts
      });
    } catch (redisError) {
      console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO CRÍTICO ao enfileirar no Redis:`, redisError.message);
      console.error(`[BACKEND][${new Date().toISOString()}] -> 📊 CONTEXTO DO ERRO:`);
      console.error(`[BACKEND][${new Date().toISOString()}] ->    - Fila: '${audioQueue.name}'`);
      console.error(`[BACKEND][${new Date().toISOString()}] ->    - Job Type: 'analyze'`);
      console.error(`[BACKEND][${new Date().toISOString()}] ->    - Job ID: '${jobId}'`);
      console.error(`[BACKEND][${new Date().toISOString()}] ->    - Host Redis: guided-snapper-23234.upstash.io`);
      console.error(`[BACKEND][${new Date().toISOString()}] -> 📜 Stack trace completo:`, redisError.stack);
      throw new Error(`Erro ao enfileirar job no Redis: ${redisError.message}`);
    }

    return result.rows[0];
  } catch (error) {
    console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO CRÍTICO ao criar job no banco:`, error.message);
    console.error(`[BACKEND][${new Date().toISOString()}] -> Stack trace:`, error.stack);
    throw new Error(`Erro ao criar job de análise: ${error.message}`);
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
router.post("/analyze", async (req, res) => {
  const startTime = Date.now();

  try {

    console.log(`[BACKEND][${new Date().toISOString()}] -> 🚀 Nova requisição de criação de job iniciada`);
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📥 Request body:`, req.body);

    const flags = validateFeatureFlags();
    console.log(`[BACKEND][${new Date().toISOString()}] -> 🚩 Feature flags:`, flags);

    const { fileKey, mode = "genre", fileName } = req.body;
    console.log(`[BACKEND][${new Date().toISOString()}] -> 📋 Dados extraídos: fileKey=${fileKey}, mode=${mode}, fileName=${fileName}`);

    if (!fileKey) {
      console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO: fileKey é obrigatório`);
      throw new Error("fileKey é obrigatório");
    }

    if (!validateFileType(fileKey)) {
      console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO: Extensão não suportada para ${fileKey}`);
      throw new Error("Extensão não suportada. Apenas WAV, FLAC e MP3 são aceitos.");
    }

    if (!["genre", "reference"].includes(mode)) {
      console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO: Modo inválido '${mode}'`);
      throw new Error('Modo de análise inválido. Use "genre" ou "reference".');
    }

    if (mode === "reference" && !flags.REFERENCE_MODE_ENABLED) {
      console.error(`[BACKEND][${new Date().toISOString()}] -> ❌ ERRO: Modo reference desabilitado`);
      throw new Error("Modo de análise por referência não está disponível no momento");
    }

    console.log(`[BACKEND][${new Date().toISOString()}] -> ✅ Validações passaram, criando job...`);

    const jobRecord = await createJobInDatabase(fileKey, mode, fileName);
    const processingTime = Date.now() - startTime;

    console.log(`[BACKEND][${new Date().toISOString()}] -> 🎉 Job criado com sucesso em ${processingTime}ms - jobId: ${jobRecord.id}, modo: ${mode}`);

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
