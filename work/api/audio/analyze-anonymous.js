/**
 * 🔓 ANÁLISE ANÔNIMA - Endpoint para usuários sem autenticação Firebase
 * 
 * Permite que visitantes não logados façam análises de áudio
 * COM LIMITES: 2 análises por dia
 * 
 * Identificação por:
 * - fingerprint (FingerprintJS do frontend)
 * - IP como fallback/combinação
 * 
 * IMPORTANTE:
 * - Apenas modo "genre" permitido (reference requer conta)
 * - Análise completa (sem modo reduced)
 * - Sem persistência de histórico (apenas resultado imediato)
 * 
 * @version 1.0.0
 * @date 2026-01-02
 */

import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import cors from 'cors';
import { getAudioQueue, getQueueReadyPromise } from '../../lib/queue.js';
import pool from "../../db.js";
import {
  canAnonymousAnalyze,
  registerAnonymousAnalysis
} from '../../lib/anonymousLimiter.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

let queueReady = false;
const queueInit = (async () => {
  console.log('🚀 [ANON_ANALYZE] Inicializando fila...');
  await getQueueReadyPromise();
  queueReady = true;
  console.log('✅ [ANON_ANALYZE] Fila pronta!');
})();

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "150");
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════

function validateFileType(fileKey) {
  if (!fileKey || typeof fileKey !== "string") return false;
  const lastDotIndex = fileKey.lastIndexOf(".");
  if (lastDotIndex === -1) return false;
  const ext = fileKey.substring(lastDotIndex).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// ═══════════════════════════════════════════════════════════════════
// CRIAR JOB ANÔNIMO
// ═══════════════════════════════════════════════════════════════════

/**
 * 🔓 Cria job anônimo usando o MESMO padrão do modo logado
 * 
 * IMPORTANTE:
 * - genre NÃO é coluna da tabela jobs (vai no payload do Redis)
 * - sound_destination NÃO é coluna da tabela jobs (vai no payload do Redis)
 * - O INSERT deve ser IDÊNTICO ao modo logado
 * - O worker processa o payload e popula results.genre
 */
async function createAnonymousJobInDatabase(fileKey, fileName, genre, genreTargets, visitorId, soundDestination = 'pista') {
  const jobId = randomUUID();
  const externalId = `anon-${Date.now()}-${jobId.substring(0, 8)}`;
  
  const validSoundDestination = ['pista', 'streaming'].includes(soundDestination) ? soundDestination : 'pista';
  
  console.log(`📋 [ANON_JOB] Criando job anônimo:`);
  console.log(`   🔑 UUID: ${jobId}`);
  console.log(`   📋 External ID: ${externalId}`);
  console.log(`   📁 Arquivo: ${fileKey}`);
  console.log(`   🎵 Gênero: ${genre}`);
  console.log(`   📡 Destino: ${validSoundDestination}`);
  console.log(`   👤 Visitor: ${visitorId.substring(0, 8)}...`);

  try {
    // Garantir fila pronta
    if (!queueReady) {
      console.log('⏳ [ANON_JOB] Aguardando fila...');
      await queueInit;
    }

    // ✅ ETAPA 1: Enfileirar no Redis (com genre e soundDestination no payload)
    const queue = getAudioQueue();
    
    const payloadParaRedis = {
      jobId,
      externalId,
      fileKey,
      fileName,
      mode: 'genre', // Anônimos sempre usam modo genre
      analysisType: 'genre', // Campo explícito (mesmo padrão do logado)
      genre,                 // 🎯 Genre vai aqui (processado pelo worker)
      genreTargets,          // 🎯 GenreTargets vai aqui (processado pelo worker)
      soundDestination: validSoundDestination, // 🎯 Destino vai aqui
      anonymous: true,
      visitorId,
      planContext: {
        plan: 'anonymous',
        mode: 'full',
        features: {
          aiSuggestions: false, // Anônimos não têm IA suggestions
          pdfReport: false,
          referenceMode: false
        }
      }
    };

    console.log('📩 [ANON_JOB] Enfileirando no Redis...');
    console.log('📦 [ANON_JOB] Payload Redis:', JSON.stringify(payloadParaRedis, null, 2));
    
    const redisJob = await queue.add('process-audio', payloadParaRedis, {
      jobId: externalId,
      priority: 5, // Prioridade mais baixa que usuários pagos
      attempts: 2, // Menos tentativas que usuários pagos
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 5,
      removeOnFail: 3,
    });

    console.log(`✅ [ANON_JOB] Job enfileirado: ${redisJob.id}`);

    // ✅ ETAPA 2: Gravar no PostgreSQL (MESMO SCHEMA do modo logado)
    // NOTA: genre e sound_destination NÃO são colunas da tabela jobs
    // O worker processa o payload do Redis e popula results.genre
    console.log('📝 [ANON_JOB] Gravando no PostgreSQL (schema padrão)...');
    
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, "genre", "queued", fileName || null, null]
    );

    console.log(`✅ [ANON_JOB] Job gravado no PostgreSQL:`, {
      id: result.rows[0].id,
      file_key: result.rows[0].file_key,
      mode: result.rows[0].mode,
      status: result.rows[0].status
    });

    // Retornar com jobId para polling
    return {
      ...result.rows[0],
      jobId: result.rows[0].id // Alias para compatibilidade
    };
    
  } catch (error) {
    console.error(`💥 [ANON_JOB] Erro:`, error.message);
    throw new Error(`Erro ao criar job anônimo: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROTA POST /api/audio/analyze-anonymous
// ═══════════════════════════════════════════════════════════════════

router.post("/", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔓 [ANON_ANALYZE:${requestId}] Nova análise anônima`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🌐 IP: ${req.headers['x-forwarded-for'] || req.socket?.remoteAddress}`);
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 1: EXTRAIR E VALIDAR DADOS
    // ═══════════════════════════════════════════════════════════════
    
    const { 
      fileKey, 
      fileName, 
      genre, 
      genreTargets,
      visitorId,
      soundDestination 
    } = req.body;

    console.log('[ANON_ANALYZE] Payload recebido:', {
      hasFileKey: !!fileKey,
      hasFileName: !!fileName,
      genre,
      hasGenreTargets: !!genreTargets,
      hasVisitorId: !!visitorId,
      visitorIdLength: visitorId?.length,
      soundDestination
    });

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 2: VALIDAR VISITOR ID (FINGERPRINT)
    // ═══════════════════════════════════════════════════════════════
    
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
      console.error(`❌ [ANON_ANALYZE:${requestId}] visitorId inválido`);
      return res.status(400).json({
        success: false,
        error: 'VISITOR_ID_REQUIRED',
        message: 'Identificador de visitante é obrigatório'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 3: VERIFICAR LIMITES ANÔNIMOS
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📊 [ANON_ANALYZE:${requestId}] Verificando limites para visitor: ${visitorId.substring(0, 8)}...`);
    
    const limitCheck = await canAnonymousAnalyze(visitorId, req);
    
    if (!limitCheck.allowed) {
      console.log(`⛔ [ANON_ANALYZE:${requestId}] Limite atingido:`, {
        used: limitCheck.used,
        limit: limitCheck.limit,
        errorCode: limitCheck.errorCode
      });
      
      return res.status(403).json({
        success: false,
        error: limitCheck.errorCode || 'ANONYMOUS_LIMIT_REACHED',
        message: limitCheck.message,
        remaining: limitCheck.remaining,
        limit: limitCheck.limit,
        requiresLogin: true
      });
    }

    console.log(`✅ [ANON_ANALYZE:${requestId}] Limite OK: ${limitCheck.remaining} análises restantes`);

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 4: VALIDAÇÕES BÁSICAS
    // ═══════════════════════════════════════════════════════════════
    
    if (!fileKey) {
      return res.status(400).json({
        success: false,
        error: 'FILE_KEY_REQUIRED',
        message: 'fileKey é obrigatório'
      });
    }

    if (!validateFileType(fileKey)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FORMAT',
        message: 'Apenas arquivos WAV, FLAC e MP3 são aceitos',
        supportedFormats: ['WAV', 'FLAC', 'MP3']
      });
    }

    // Anônimos DEVEM especificar gênero (não podem usar reference mode)
    if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'GENRE_REQUIRED',
        message: 'Selecione um gênero para análise'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 5: CRIAR JOB
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`🎵 [ANON_ANALYZE:${requestId}] Criando job anônimo...`);
    
    const job = await createAnonymousJobInDatabase(
      fileKey,
      fileName,
      genre.trim(),
      genreTargets,
      visitorId,
      soundDestination
    );

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 6: REGISTRAR USO (APÓS SUCESSO)
    // ═══════════════════════════════════════════════════════════════
    
    const registerResult = await registerAnonymousAnalysis(visitorId, req);
    
    console.log(`✅ [ANON_ANALYZE:${requestId}] Análise registrada:`, {
      used: registerResult.used,
      remaining: registerResult.remaining
    });

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 7: RESPOSTA
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ [ANON_ANALYZE:${requestId}] Job criado com sucesso!`);
    console.log(`   🔑 Job ID: ${job.id}`);
    console.log(`   📊 Análises usadas: ${registerResult.used}/${limitCheck.limit}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return res.status(201).json({
      success: true,
      jobId: job.id,
      status: job.status,
      anonymous: true,
      limits: {
        used: registerResult.used || (limitCheck.used + 1),
        remaining: registerResult.remaining ?? (limitCheck.remaining - 1),
        limit: limitCheck.limit
      },
      message: 'Análise iniciada com sucesso!'
    });

  } catch (error) {
    console.error(`❌ [ANON_ANALYZE:${requestId}] Erro:`, error.message);
    console.error(error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao processar análise. Tente novamente.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA GET /api/audio/analyze-anonymous/status
// Verificar status de limites anônimos
// ═══════════════════════════════════════════════════════════════════

router.get("/status", async (req, res) => {
  try {
    const visitorId = req.query.visitorId;
    
    if (!visitorId || visitorId.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'VISITOR_ID_REQUIRED'
      });
    }
    
    const limitCheck = await canAnonymousAnalyze(visitorId, req);
    
    return res.json({
      success: true,
      anonymous: true,
      analyses: {
        used: limitCheck.used || 0,
        remaining: limitCheck.remaining,
        limit: limitCheck.limit,
        allowed: limitCheck.allowed
      }
    });
    
  } catch (error) {
    console.error('[ANON_ANALYZE] Erro ao obter status:', error.message);
    return res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_ERROR'
    });
  }
});

export default router;
