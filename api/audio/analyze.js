/**
 * API de Análise de Áudio - Criação de Jobs baseado em FileKey
 * Recebe fileKey de arquivos já uploadados via presigned URL
 * 
 * Refatorado: 7 de setembro de 2025
 */

import pkg from "pg";
import { randomUUID } from 'crypto';

const { Pool } = pkg;

// Configuração via variável de ambiente
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '60');

// Extensões aceitas (verificação por fileKey)
const ALLOWED_EXTENSIONS = ['.wav', '.flac', '.mp3'];

// Configuração de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Conexão com Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres
});

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
async function createJobInDatabase(fileKey, mode) {
  try {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    
    console.log(`[ANALYZE] Criando job: ${jobId} para fileKey: ${fileKey}, modo: ${mode}`);
    
    const result = await pool.query(
      "INSERT INTO jobs (id, file_key, mode, status, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [jobId, fileKey, mode, 'queued', now]
    );
    
    console.log(`[ANALYZE] Job criado com sucesso:`, result.rows[0]);
    
    return result.rows[0].id;
    
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
 * Handler principal da API
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Configurar CORS
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Responder OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Apenas aceitar POST
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Método não permitido',
      message: 'Apenas requisições POST são aceitas',
      code: 'METHOD_NOT_ALLOWED'
    });
    return;
  }
  
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
    const jobId = await createJobInDatabase(fileKey, mode);
    
    // Adicionar métricas de performance
    const processingTime = Date.now() - startTime;
    
    console.log(`[ANALYZE] Job criado em ${processingTime}ms - jobId: ${jobId}, modo: ${mode}`);
    
    res.status(200).json({
      success: true,
      jobId: jobId,
      message: `Job de análise criado com sucesso para ${mode}`,
      fileKey: fileKey,
      mode: mode,
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
}

// Configuração específica para Vercel - JSON parser habilitado
export const config = {
  api: {
    bodyParser: true, // Habilita parser JSON padrão
    responseLimit: false // Remove limite de resposta
  }
};
