/**
 * API de Análise de Áudio - Criação de Jobs baseado em FileKey
 * Recebe fileKey de arquivos já uploadados via presigned URL
 * 
 * Refatorado: 7 de setembro de 2025 - Express Router
 */

import express from 'express';
import pkg from "pg";
import { randomUUID } from 'crypto';

const { Pool } = pkg;
const router = express.Router();

// Configuração via variável de ambiente
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '60');

// Extensões aceitas (verificação por fileKey)
const ALLOWED_EXTENSIONS = ['.wav', '.flac', '.mp3'];

// Conexão com Postgres (lazy loading)
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Railway/Postgres
    });
    console.log('[ANALYZE] ✅ Pool PostgreSQL inicializado com sucesso');
  } else if (!pool && !process.env.DATABASE_URL) {
    console.warn('[ANALYZE] ⚠️ DATABASE_URL não configurada - modo mock ativo');
  }
  return pool;
}

/**
 * Validar feature flags
 */
function validateFeatureFlags() {
  return {
    REFERENCE_MODE_ENABLED: process.env.REFERENCE_MODE_ENABLED === 'true' || true, // Default true para desenvolvimento
    FALLBACK_TO_GENRE: process.env.FALLBACK_TO_GENRE === 'true' || true,
    DEBUG_REFERENCE_MODE: process.env.DEBUG_REFERENCE_MODE === 'true' || false
  };
}

/**
 * Validar o tipo de arquivo baseado no fileKey
 */
function validateFileType(fileKey) {
  if (!fileKey || typeof fileKey !== 'string') {
    return false;
  }
  
  // Extrair extensão do fileKey
  const lastDotIndex = fileKey.lastIndexOf('.');
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
    
    // Obter pool com lazy loading
    const dbPool = getPool();
    
    // Se não há pool de conexão, simular criação do job
    if (!dbPool) {
      console.log(`[ANALYZE] 🧪 MODO MOCK - Job simulado criado com sucesso`);
      return {
        id: jobId,
        file_key: fileKey,
        mode: mode,
        status: 'queued',
        file_name: fileName,
        created_at: now
      };
    }
    
    const result = await dbPool.query(
      "INSERT INTO jobs (id, file_key, mode, status, file_name, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [jobId, fileKey, mode, 'queued', fileName, now]
    );
    
    console.log(`[ANALYZE] Job criado com sucesso no PostgreSQL:`, result.rows[0]);
    
    return result.rows[0];
    
  } catch (error) {
    console.error('[ANALYZE] Erro ao criar job no banco:', error);
    throw new Error(`Erro ao criar job de análise: ${error.message}`);
  }
}

/**
 * Obter mensagem de erro amigável
 */
function getErrorMessage(error) {
  const message = error.message;
  
  if (message.includes('fileKey é obrigatório')) {
    return {
      error: 'Parâmetro obrigatório ausente',
      message: 'O parâmetro fileKey é obrigatório',
      code: 'MISSING_FILE_KEY'
    };
  }
  
  if (message.includes('Extensão não suportada')) {
    return {
      error: 'Formato não suportado',
      message: 'Apenas arquivos WAV, FLAC e MP3 são aceitos.',
      code: 'INVALID_FORMAT',
      supportedFormats: ['WAV', 'FLAC', 'MP3']
    };
  }
  
  if (message.includes('Modo de análise inválido')) {
    return {
      error: 'Modo inválido',
      message: 'Modo deve ser "genre" ou "reference"',
      code: 'INVALID_MODE',
      supportedModes: ['genre', 'reference']
    };
  }
  
  if (message.includes('não está disponível')) {
    return {
      error: 'Funcionalidade indisponível',
      message: 'Modo de análise por referência não está disponível no momento',
      code: 'REFERENCE_MODE_DISABLED'
    };
  }
  
  if (message.includes('Erro ao criar job')) {
    return {
      error: 'Erro interno',
      message: 'Erro ao processar solicitação de análise',
      code: 'DATABASE_ERROR'
    };
  }
  
  return {
    error: 'Erro no processamento',
    message: message || 'Erro desconhecido durante o processamento',
    code: 'PROCESSING_ERROR'
  };
}

/**
 * Middleware de CORS para análise de áudio
 */
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

/**
 * POST /analyze - Criar job de análise baseado em fileKey
 */
router.post('/analyze', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log(`[ANALYZE] Nova requisição de criação de job iniciada`);
    
    // Verificar feature flags
    const flags = validateFeatureFlags();
    console.log(`[ANALYZE] Feature flags:`, flags);
    
    // Obter dados do body JSON
    const { fileKey, mode = 'genre', fileName } = req.body;
    
    console.log(`[ANALYZE] Dados recebidos:`, { fileKey, mode, fileName });
    
    // Validar fileKey obrigatório
    if (!fileKey) {
      throw new Error('fileKey é obrigatório');
    }
    
    // Validar tipo de arquivo pela extensão
    if (!validateFileType(fileKey)) {
      throw new Error('Extensão não suportada. Apenas WAV, FLAC e MP3 são aceitos.');
    }
    
    // Validar modo
    if (!['genre', 'reference'].includes(mode)) {
      throw new Error('Modo de análise inválido. Use "genre" ou "reference".');
    }
    
    // Verificar se modo referência está habilitado
    if (mode === 'reference' && !flags.REFERENCE_MODE_ENABLED) {
      throw new Error('Modo de análise por referência não está disponível no momento');
    }
    
    // Criar job no banco de dados
    const jobRecord = await createJobInDatabase(fileKey, mode, fileName);
    
    // Adicionar métricas de performance
    const processingTime = Date.now() - startTime;
    
    console.log(`[ANALYZE] Job criado em ${processingTime}ms - jobId: ${jobRecord.id}, modo: ${mode}`);
    
    res.status(200).json({
      success: true,
      jobId: jobRecord.id,
      message: `Job de análise criado com sucesso para ${mode}`,
      fileKey: fileKey,
      mode: mode,
      fileName: fileName || null,
      createdAt: jobRecord.created_at,
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[ANALYZE] Erro na criação do job:', error);
    console.error('[ANALYZE] Stack:', error.stack);
    
    const errorResponse = getErrorMessage(error);
    const statusCode = error.message.includes('obrigatório') || error.message.includes('inválido') ? 400 : 500;
    
    // Log mínimo para monitoramento
    console.log(`[ANALYZE] Erro processado em ${processingTime}ms:`, {
      code: errorResponse.code,
      mode: req.body?.mode || 'unknown',
      error: errorResponse.error
    });
    
    res.status(statusCode).json({
      success: false,
      ...errorResponse,
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
