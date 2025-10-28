/**
 * 🎵 API de Análise de Áudio - Versão Corrigida para Enfileiramento
 * ✅ CORRIGIDO: Inicialização global assíncrona para garantir fila pronta
 * ✅ CORRIGIDO: Verificação obrigatória antes de enfileirar
 * ✅ CORRIGIDO: Logs de diagnóstico completos
 * 
 * 🔑 IMPORTANTE - POLÍTICA DE UUID:
 * ═══════════════════════════════════════════════════════════════
 * ▶ jobId: SEMPRE deve ser randomUUID() válido para PostgreSQL
 * ▶ externalId: Campo separado para IDs customizados/logs
 * ▶ PostgreSQL: Coluna 'id' é tipo 'uuid' - aceita apenas UUIDs
 * ▶ Redis: BullMQ aceita qualquer string como jobId
 * 
 * 🚨 ERRO 22P02 (invalid input syntax for type uuid):
 * ═══════════════════════════════════════════════════════════════
 * ▶ CAUSA: String não-UUID enviada para coluna PostgreSQL tipo 'uuid'
 * ▶ SOLUÇÃO: Sempre usar randomUUID() para jobId principal
 * ▶ LOGS: externalId pode usar formato personalizado para debug
 */

import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import { getAudioQueue, getQueueReadyPromise } from '../../lib/queue.js';
import pool from "../../db.js";

// Definir service name para auditoria
process.env.SERVICE_NAME = 'api';

const router = express.Router();

// ✅ INICIALIZAÇÃO GLOBAL ASSÍNCRONA OBRIGATÓRIA
let queueReady = false;
const queueInit = (async () => {
  console.log('🚀 [API-INIT] Iniciando inicialização da fila...');
  await getQueueReadyPromise();
  queueReady = true;
  console.log('✅ [API-INIT] Fila inicializada com sucesso!');
})();

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
 * ✅ FUNÇÃO CORRIGIDA: Enfileirar PRIMEIRO, PostgreSQL DEPOIS
 * 🔑 IMPORTANTE: jobId DEVE SEMPRE SER UUID VÁLIDO para PostgreSQL
 * Ordem obrigatória: Redis → PostgreSQL (previne jobs órfãos)
 */
async function createJobInDatabase(fileKey, mode, fileName) {
  // 🔑 CRÍTICO: jobId DEVE ser UUID válido para tabela PostgreSQL (coluna tipo 'uuid')
  const jobId = randomUUID();
  
  // 📋 externalId para logs e identificação externa (pode ser personalizado)
  const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
  
  console.log(`📋 [JOB-CREATE] Iniciando job:`);
  console.log(`   🔑 UUID (Banco): ${jobId}`);
  console.log(`   📋 ID Externo: ${externalId}`);
  console.log(`   📁 Arquivo: ${fileKey}`);
  console.log(`   ⚙️ Modo: ${mode}`);

  try {
    // ✅ ETAPA 1: GARANTIR QUE FILA ESTÁ PRONTA
    if (!queueReady) {
      console.log('⏳ [JOB-CREATE] Aguardando fila inicializar...');
      await queueInit;
      console.log('✅ [JOB-CREATE] Fila pronta para enfileiramento!');
    }

    // ✅ ETAPA 2: ENFILEIRAR PRIMEIRO (REDIS)
    const queue = getAudioQueue();
    console.log('📩 [API] Enfileirando job no Redis...');
    
    const redisJob = await queue.add('process-audio', {
      jobId: jobId,        // 🔑 UUID para PostgreSQL
      externalId: externalId, // 📋 ID customizado para logs
      fileKey,
      fileName,
      mode
    }, {
      jobId: externalId,   // 📋 BullMQ job ID (pode ser customizado)
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    });
    
    console.log(`✅ [API] Job enfileirado com sucesso:`);
    console.log(`   🔑 UUID (Banco): ${jobId}`);
    console.log(`   📋 Redis Job ID: ${redisJob.id}`);
    console.log(`   📋 ID Externo: ${externalId}`);

    // ✅ ETAPA 3: GRAVAR NO POSTGRESQL DEPOIS
    console.log('📝 [API] Gravando no PostgreSQL com UUID...');
    
    // 🔑 CRÍTICO: Usar jobId (UUID) na coluna 'id' do PostgreSQL
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, mode, "queued", fileName || null]
    );

    console.log(`✅ [API] Gravado no PostgreSQL:`, {
      id: result.rows[0].id,
      fileKey: result.rows[0].file_key,
      status: result.rows[0].status,
      mode: result.rows[0].mode
    });
    console.log('🎯 [API] Fluxo completo - Redis ➜ PostgreSQL concluído!');

    return result.rows[0];
      
  } catch (error) {
    console.error(`💥 [JOB-CREATE] Erro crítico:`, error.message);
    
    // Se erro foi no PostgreSQL, job já está no Redis (o que é seguro)
    // Worker pode processar e atualizar status depois
    if (error.message.includes('PostgreSQL') || error.code?.startsWith('2')) {
      console.warn(`⚠️ [JOB-CREATE] Job ${jobId} enfileirado mas falha no PostgreSQL - Worker pode recuperar`);
    }
    
    throw new Error(`Erro ao criar job: ${error.message}`);
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

/**
 * ✅ ROTA SIMPLIFICADA: POST /analyze com verificação obrigatória da fila
 * Foco: Garantir fila pronta antes de processar qualquer requisição
 */
router.post("/analyze", async (req, res) => {
  // ✅ LOG OBRIGATÓRIO: Rota chamada
  console.log('🚀 [API] /analyze chamada');
  
  try {
    const { fileKey, mode = "genre", fileName } = req.body;
    
    // ✅ VALIDAÇÕES BÁSICAS
    if (!fileKey) {
      return res.status(400).json({
        success: false,
        error: "fileKey é obrigatório"
      });
    }

    if (!validateFileType(fileKey)) {
      return res.status(400).json({
        success: false,
        error: "Extensão não suportada. Apenas WAV, FLAC e MP3 são aceitos."
      });
    }

    if (!["genre", "reference"].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Modo inválido. Use "genre" ou "reference".'
      });
    }

    // ✅ VERIFICAÇÃO OBRIGATÓRIA DA FILA
    if (!queueReady) {
      console.log('⏳ [API] Aguardando fila inicializar...');
      await queueInit;
    }

    // ✅ OBTER INSTÂNCIA DA FILA
    const queue = getAudioQueue();
    
    // ✅ CRIAR JOB NO BANCO E ENFILEIRAR
    const jobRecord = await createJobInDatabase(fileKey, mode, fileName);

    // ✅ RESPOSTA DE SUCESSO
    res.status(200).json({
      success: true,
      jobId: jobRecord.id,
      fileKey: jobRecord.file_key,
      mode: jobRecord.mode,
      fileName: jobRecord.file_name || null,
      status: jobRecord.status,
      createdAt: jobRecord.created_at
    });

  } catch (error) {
    // ✅ LOG DE ERRO OBRIGATÓRIO
    console.error('❌ [API] Erro na rota /analyze:', error.message);
    
    // ✅ RESPOSTA DE ERRO COM STATUS 500
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;