/**
 * API de Análise de Áudio - Criação de Jobs baseado em FileKey
 * Recebe fileKey de arquivos já uploadados via presigned URL
 * 
 * Corrigido: 9 de setembro de 2025 - Express Router
 */

import express from "express";
import pkg from "pg";

import { randomUUID } from "crypto";

const { Pool } = pkg;
const router = express.Router();

// Configuração via variável de ambiente
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");

// Extensões aceitas (verificação por fileKey)
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

// Conexão com Postgres (lazy loading)
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
    console.log("[ANALYZE] ✅ Pool PostgreSQL inicializado com sucesso");
  } else if (!pool && !process.env.DATABASE_URL) {
    console.warn("[ANALYZE] ⚠️ DATABASE_URL não configurada - modo mock ativo");
  }
  return pool;
}

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
 * Criar job no banco de dados
 */
async function createJobInDatabase(fileKey, mode, fileName) {
  try {
    const jobId = randomUUID();
    const now = new Date().toISOString();

    console.log(`[ANALYZE] Criando job: ${jobId} para fileKey: ${fileKey}, modo: ${mode}`);

    const dbPool = getPool();

    // Se não há pool de conexão, simular criação do job (modo desenvolvimento/teste)
    if (!dbPool) {
      console.log(`[ANALYZE] 🧪 MODO MOCK - Job simulado criado com sucesso`);
      return {
        id: jobId,
        file_key: fileKey,
        mode: mode,
        status: "queued",
        file_name: fileName,
        created_at: now,
      };
    }

    const result = await dbPool.query(


      `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, mode, "queued", fileName || null]
    );

    console.log(`[ANALYZE] Job criado com sucesso no PostgreSQL:`, result.rows[0]);

    return result.rows[0];
  } catch (error) {
    console.error("[ANALYZE] Erro ao criar job no banco:", error);
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

    console.log(`[ANALYZE] Nova requisição de criação de job iniciada`);

    const flags = validateFeatureFlags();
    console.log(`[ANALYZE] Feature flags:`, flags);

    const { fileKey, mode = "genre", fileName } = req.body;
    console.log(`[ANALYZE] Dados recebidos:`, { fileKey, mode, fileName });

    if (!fileKey) throw new Error("fileKey é obrigatório");

    if (!validateFileType(fileKey)) {
      throw new Error("Extensão não suportada. Apenas WAV, FLAC e MP3 são aceitos.");
    }

    if (!["genre", "reference"].includes(mode)) {
      throw new Error('Modo de análise inválido. Use "genre" ou "reference".');
    }

    if (mode === "reference" && !flags.REFERENCE_MODE_ENABLED) {
      throw new Error("Modo de análise por referência não está disponível no momento");
    }

    const jobRecord = await createJobInDatabase(fileKey, mode, fileName);
    const processingTime = Date.now() - startTime;

    console.log(`[ANALYZE] Job criado em ${processingTime}ms - jobId: ${jobRecord.id}, modo: ${mode}`);

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
    
    console.error("[ANALYZE] Erro na criação do job:", error);

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
