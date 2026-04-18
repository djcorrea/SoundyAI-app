/**
 * 🎵 API de Análise de Áudio - Versão Corrigida para Enfileiramento
 * ✅ CORRIGIDO: Inicialização global assíncrona para garantir fila pronta
 * ✅ CORRIGIDO: Verificação obrigatória antes de enfileirar
 * ✅ CORRIGIDO: Logs de diagnóstico completos
 * ✅ CORRIGIDO: Modo "comparison" aceito (01/11/2025)
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
import { getAuth, getFirestore } from '../../firebase/admin.js';
import { canUseAnalysis, registerAnalysis, getPlanFeatures } from '../../lib/user/userPlans.js';
import { analysisLimiter } from '../../lib/rateLimiterRedis.js'; // ✅ V3: Rate limiting GLOBAL via Redis

// 🔐 ENTITLEMENTS: Sistema de controle de acesso por plano
import { getUserPlan, hasEntitlement, buildPlanRequiredResponse } from '../../lib/entitlements.js';

// 🔥 DEMO: Controle de limite 100% backend
import { canDemoAnalyze, registerDemoUsage, generateDemoId, extractDemoParams } from '../../../lib/demo-control.js';


// Definir service name para auditoria
process.env.SERVICE_NAME = 'api';

// 🧹 MEMORY OPT: getAuth() chamado lazily — Firebase Admin SDK só inicializa
// na primeira requisição autenticada, não na carga do módulo (~15-20MB economizados em idle)
let _auth = null;
function getAuthLazy() {
  if (!_auth) {
    _auth = getAuth();
  }
  return _auth;
}

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
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "150");

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
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null, genreTargets = null, planContext = null, analysisType = null, referenceStage = null, soundDestination = 'pista') {
  // 🔑 CRÍTICO: jobId DEVE ser UUID válido para tabela PostgreSQL (coluna tipo 'uuid')
  const jobId = randomUUID();
  
  // 🆕 Normalizar analysisType (usar analysisType se presente, senão usar mode)
  const finalAnalysisType = analysisType || mode;
  const finalReferenceStage = referenceStage || null;
  
  // 🆕 STREAMING MODE: Validar soundDestination
  const validSoundDestination = ['pista', 'streaming'].includes(soundDestination) ? soundDestination : 'pista';
  
  // 📋 externalId para logs e identificação externa (pode ser personalizado)
  const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
  
  console.log(`📋 [JOB-CREATE] Iniciando job:`);
  console.log(`   🔑 UUID (Banco): ${jobId}`);
  console.log(`   📋 ID Externo: ${externalId}`);
  console.log(`   📁 Arquivo: ${fileKey}`);
  console.log(`   ⚙️ Modo: ${mode}`);
  console.log(`   📡 Sound Destination: ${validSoundDestination}`);
  console.log(`   🎵 Gênero: ${genre || 'não especificado'}`);
  console.log(`   🎯 Targets: ${genreTargets ? 'presentes' : 'ausentes'}`);
  console.log(`   🔗 Reference Job ID: ${referenceJobId || 'nenhum'}`);
  console.log(`   📊 Plan Context:`, planContext);

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
    
    console.log("🟥 [AUDIT:CONTROLLER-QUEUE] Payload enviado para BullMQ:");
    console.dir({
      jobId: jobId,
      externalId: externalId,
      fileKey,
      fileName,
      mode,
      genre: genre,
      genreTargets: genreTargets,
      referenceJobId: referenceJobId
    }, { depth: 10 });
    
    console.log('\n\n===== [DEBUG-CONTROLLER-PAYLOAD] Payload que VAI para o Redis (WORK) =====');
    console.dir({
      jobId: jobId,
      externalId: externalId,
      fileKey,
      fileName,
      mode,
      genre: genre,
      genreTargets: genreTargets,
      referenceJobId: referenceJobId
    }, { depth: 10 });
    console.log('===============================================================\n\n');
    
    // 🟥🟥 AUDITORIA: QUEM ESTÁ CRIANDO O JOB
    const payloadParaRedis = {
      jobId: jobId,        // 🔑 UUID para PostgreSQL
      externalId: externalId, // 📋 ID customizado para logs
      fileKey,
      fileName,
      mode,                // Mantido por compatibilidade
      analysisType: finalAnalysisType,  // 🆕 Campo explícito: 'genre' | 'reference'
      referenceStage: finalReferenceStage, // 🆕 Para reference: 'base' | 'compare'
      soundDestination: validSoundDestination, // 🆕 STREAMING MODE: 'pista' | 'streaming'
      genre: genre,        // 🎯 Genre (obrigatório apenas em genre e reference base)
      genreTargets: genreTargets, // 🎯 GenreTargets (obrigatório apenas em genre e reference base)
      referenceJobId: referenceJobId, // 🔗 ID do job de referência (se referenceStage='compare')
      planContext: planContext // 📊 Contexto de plano e features
    };
    
    console.log("🟥🟥 [AUDIT:JOB-CREATOR] Este arquivo está CRIANDO um job AGORA:");
    console.log("🟥 [AUDIT:JOB-CREATOR] Arquivo:", import.meta.url);
    console.log("🟥 [AUDIT:JOB-CREATOR] Payload enviado para a fila:");
    console.dir(payloadParaRedis, { depth: 10 });
    
    const redisJob = await queue.add('process-audio', payloadParaRedis, {
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
    
    // 🎯 CORREÇÃO: Validação de genre APENAS em mode='genre'
    // Reference mode NÃO exige genre (independente de ser base ou compare)
    
    const isGenreMode = mode === 'genre' || finalAnalysisType === 'genre';
    const isReferenceMode = mode === 'reference' || finalAnalysisType === 'reference';
    
    if (isGenreMode) {
      // APENAS mode='genre' exige genre obrigatório
      if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
        throw new Error('❌ [CRITICAL] Genre é obrigatório no modo "genre"');
      }
      
      console.log('[BACKEND-VALIDATION] 💾 Salvando job genre:', {
        mode,
        jobId: jobId.substring(0, 8),
        genre,
        hasGenreTargets: !!genreTargets
      });
    } else if (isReferenceMode) {
      // Reference mode: genre é OPCIONAL (não validar)
      console.log('[BACKEND-VALIDATION] 💾 Salvando job reference:', {
        mode,
        jobId: jobId.substring(0, 8),
        referenceJobId: referenceJobId || 'nenhum (primeira track)',
        genrePresent: !!genre,
        genreIgnored: true
      });
    }
    
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      [jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null]
    );

    console.log(`✅ [API] Gravado no PostgreSQL:`, {
      id: result.rows[0].id,
      fileKey: result.rows[0].file_key,
      status: result.rows[0].status,
      mode: result.rows[0].mode,
      referenceFor: result.rows[0].reference_for
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
 * ✅ FUNÇÃO PARA CRIAR JOB DE COMPARAÇÃO
 * 🎯 Cria job de comparação entre duas músicas (user vs reference)
 * Ordem obrigatória: Redis → PostgreSQL (previne jobs órfãos)
 */
async function createComparisonJobInDatabase(userFileKey, referenceFileKey, userFileName, refFileName) {
  // 🔑 CRÍTICO: jobId DEVE ser UUID válido para tabela PostgreSQL (coluna tipo 'uuid')
  const jobId = randomUUID();
  
  // 📋 externalId para logs e identificação externa (pode ser personalizado)
  const externalId = `comparison-${Date.now()}-${jobId.substring(0, 8)}`;
  
  console.log(`🎧 [COMPARISON-CREATE] Iniciando job de comparação:`);
  console.log(`   🔑 UUID (Banco): ${jobId}`);
  console.log(`   📋 ID Externo: ${externalId}`);
  console.log(`   📁 Arquivo Usuário: ${userFileKey}`);
  console.log(`   📁 Arquivo Referência: ${referenceFileKey}`);
  console.log(`   ⚙️ Modo: comparison`);

  try {
    // ✅ ETAPA 1: GARANTIR QUE FILA ESTÁ PRONTA
    if (!queueReady) {
      console.log('⏳ [COMPARISON-CREATE] Aguardando fila inicializar...');
      await queueInit;
      console.log('✅ [COMPARISON-CREATE] Fila pronta para enfileiramento!');
    }

    // ✅ ETAPA 2: ENFILEIRAR PRIMEIRO (REDIS)
    const queue = getAudioQueue();
    console.log('📩 [API] Enfileirando job de comparação no Redis...');
    
    // 🟥🟥 AUDITORIA: QUEM ESTÁ CRIANDO O JOB DE COMPARAÇÃO
    const payloadParaRedis = {
      jobId: jobId,        // 🔑 UUID para PostgreSQL
      externalId: externalId, // 📋 ID customizado para logs
      fileKey: userFileKey,
      referenceFileKey: referenceFileKey,
      fileName: userFileName,
      refFileName: refFileName,
      mode: 'comparison'
    };
    
    console.log("🟥🟥 [AUDIT:JOB-CREATOR] Este arquivo está CRIANDO um job de COMPARAÇÃO AGORA:");
    console.log("🟥 [AUDIT:JOB-CREATOR] Arquivo:", import.meta.url);
    console.log("🟥 [AUDIT:JOB-CREATOR] Payload enviado para a fila:");
    console.dir(payloadParaRedis, { depth: 10 });
    
    const redisJob = await queue.add('process-audio', payloadParaRedis, {
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
    
    console.log(`✅ [API] Job de comparação enfileirado com sucesso:`);
    console.log(`   🔑 UUID (Banco): ${jobId}`);
    console.log(`   📋 Redis Job ID: ${redisJob.id}`);
    console.log(`   📋 ID Externo: ${externalId}`);

    // ✅ ETAPA 3: GRAVAR NO POSTGRESQL DEPOIS
    console.log('📝 [API] Gravando job de comparação no PostgreSQL com UUID...');
    
    // 🔑 CRÍTICO: Usar jobId (UUID) na coluna 'id' do PostgreSQL
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, reference_file_key, mode, status, file_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      [jobId, userFileKey, referenceFileKey, "comparison", "queued", userFileName || null]
    );

    console.log(`✅ [API] Job de comparação gravado no PostgreSQL:`, {
      id: result.rows[0].id,
      fileKey: result.rows[0].file_key,
      referenceFileKey: result.rows[0].reference_file_key,
      status: result.rows[0].status,
      mode: result.rows[0].mode
    });
    console.log('🎯 [API] Fluxo completo comparação - Redis ➜ PostgreSQL concluído!');

    return result.rows[0];
      
  } catch (error) {
    console.error(`💥 [COMPARISON-CREATE] Erro crítico:`, error.message);
    
    // Se erro foi no PostgreSQL, job já está no Redis (o que é seguro)
    // Worker pode processar e atualizar status depois
    if (error.message.includes('PostgreSQL') || error.code?.startsWith('2')) {
      console.warn(`⚠️ [COMPARISON-CREATE] Job ${jobId} enfileirado mas falha no PostgreSQL - Worker pode recuperar`);
    }
    
    throw new Error(`Erro ao criar job de comparação: ${error.message}`);
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
      message: 'Modo deve ser "genre", "reference" ou "comparison"',
      code: "INVALID_MODE",
      supportedModes: ["genre", "reference", "comparison"],
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
 * ✅ PROTEÇÃO: Rate limiting (10 req/min por IP)
 */
router.post("/analyze", analysisLimiter, async (req, res) => {
  // 🔍 PR1: Log instrumentação - Request recebido
  const requestTraceId = `API-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  console.log(`[PR1-TRACE] ${requestTraceId} ═══════════════════════════════════════`);
  console.log(`[PR1-TRACE] ${requestTraceId} ENDPOINT /analyze RECEBEU REQUEST`);
  console.log(`[PR1-TRACE] ${requestTraceId} Timestamp: ${new Date().toISOString()}`);
  
  // ✅ LOG OBRIGATÓRIO: Rota chamada
  console.log('🚀 [API] /analyze chamada');
  console.log('📦 [ANALYZE] Headers:', req.headers);
  console.log('📦 [ANALYZE] Body:', req.body);
  
  // 🔍 PR1: Log payload recebido (SEM token)
  const { fileKey, mode, fileName, genre, genreTargets, referenceJobId, hasTargets } = req.body;
  console.log(`[PR1-TRACE] ${requestTraceId} PAYLOAD RECEBIDO:`, {
    fileKey: fileKey ? `${fileKey.substring(0, 30)}...` : null,
    mode,
    fileName,
    genre: genre || null,
    hasGenreTargets: !!genreTargets,
    genreTargetsKeys: genreTargets ? Object.keys(genreTargets).length : 0,
    referenceJobId: referenceJobId || null,
    hasTargets: hasTargets || null,
    idToken: req.body.idToken ? '***masked***' : 'absent',
  });
  
  // 🔍 PR1: Validar invariantes do payload
  // 🆕 PR2: VALIDAÇÃO RÍGIDA e CORREÇÃO de payload
  if (mode === 'reference' && referenceJobId) {
    // Segunda música reference - REMOVER genre/genreTargets se presentes
    if (genre || genreTargets) {
      console.warn(`[PR2-CORRECTION] ${requestTraceId} ⚠️ Reference segunda track tem genre/targets - REMOVENDO`);
      console.log(`[PR2-CORRECTION] ${requestTraceId} Antes: genre=${genre}, targets=${!!genreTargets}`);
      
      // Limpar do req.body para não propagar
      delete req.body.genre;
      delete req.body.genreTargets;
      delete req.body.hasTargets;
      
      console.log(`[PR2-CORRECTION] ${requestTraceId} Depois: payload limpo para reference puro`);
    }
    console.log(`[PR1-INVARIANT] ${requestTraceId} ✅ Reference segunda track - modo reference puro`);
  } else if (mode === 'reference' && !referenceJobId) {
    // Primeira música reference - pode ter genre (para análise base)
    console.log(`[PR1-TRACE] ${requestTraceId} ✅ First reference track - genre=${genre} is acceptable`);
  } else if (mode === 'genre') {
    // Modo genre - deve ter genre e genreTargets
    if (!genre) {
      console.warn(`[PR1-INVARIANT] ${requestTraceId} ⚠️ mode=genre BUT no genre provided`);
    }
    if (!genreTargets) {
      console.warn(`[PR1-INVARIANT] ${requestTraceId} ⚠️ mode=genre BUT no genreTargets provided`);
    }
  }
  
  try {
    console.log("🟥 [AUDIT:CONTROLLER-BODY] Payload recebido do front:");
    console.dir(req.body, { depth: 10 });
    
    const { 
      fileKey, 
      mode = "genre",  // Mantido por compatibilidade
      analysisType,    // 🆕 Campo explícito: 'genre' | 'reference'
      referenceStage,  // 🆕 Para reference: 'base' | 'compare'
      soundDestination = 'pista',  // 🆕 STREAMING MODE: 'pista' | 'streaming' - default seguro
      fileName, 
      genre, 
      genreTargets,
      idToken  // ✅ NOVO: Token de autenticação
    } = req.body;
    
    // 🆕 STREAMING MODE: Validar e logar soundDestination
    const validSoundDestination = ['pista', 'streaming'].includes(soundDestination) ? soundDestination : 'pista';
    console.log(`📡 [ANALYZE] Sound Destination: ${validSoundDestination} (original: ${soundDestination})`);
    
    // ✅ NORMALIZAR: usar analysisType se presente, senão fallback para mode
    const finalAnalysisType = analysisType || mode;
    const finalReferenceStage = referenceStage || null;
    
    console.log('[ANALYZE] Tipo de análise:', {
      analysisType: finalAnalysisType,
      referenceStage: finalReferenceStage,
      hasGenre: !!genre,
      hasReferenceJobId: !!req.body.referenceJobId
    });
    
    // ═══════════════════════════════════════════════════════════
    // 🔥 MODO DEMO: Controle 100% BACKEND (anti-burla)
    // ═══════════════════════════════════════════════════════════
    const isDemoMode = req.headers['x-demo-mode'] === 'true' || req.query.mode === 'demo';
    const demoVisitorId = req.headers['x-demo-visitor'] || 'unknown';
    let demoId = null;
    
    if (isDemoMode) {
      console.log('🔥 [ANALYZE] MODO DEMO detectado - visitor:', demoVisitorId);
      
      // 🔴 VERIFICAÇÃO BACKEND: Checar se demo já foi usado
      try {
        const demoCheck = await canDemoAnalyze(req);
        demoId = demoCheck.demoId;
        
        if (!demoCheck.allowed) {
          console.log('🚫 [ANALYZE] DEMO BLOQUEADO pelo backend:', demoCheck.reason);
          return res.status(403).json({
            success: false,
            error: 'DEMO_LIMIT_REACHED',
            message: 'Você já utilizou sua análise demonstrativa gratuita.',
            reason: demoCheck.reason,
            analysesCount: demoCheck.analysesCount,
            maxAnalyses: demoCheck.maxAnalyses,
            // Sinalizar para frontend mostrar modal de conversão
            showConversionModal: true,
            checkoutRequired: true
          });
        }
        
        console.log('✅ [ANALYZE] DEMO permitido pelo backend:', {
          demoId: demoId?.substring(0, 16) + '...',
          remaining: demoCheck.remaining
        });
      } catch (demoErr) {
        console.error('⚠️ [ANALYZE] Erro ao verificar demo (fail-open):', demoErr.message);
        // Fail-open: em caso de erro, permitir (não perder venda potencial)
      }
    }
    
    // ✅ ETAPA 1: AUTENTICAÇÃO (bypass para demo)
    console.log('🔐 [ANALYZE] Verificando autenticação...');
    
    let uid;
    let decoded;
    
    if (isDemoMode) {
      // 🔥 DEMO MODE: Usar demoId como UID (mais confiável que visitorId)
      uid = `demo_${demoId || demoVisitorId}`;
      decoded = { uid, demo: true, demoId };
      console.log('🔥 [ANALYZE] Usando UID demo:', uid);
    } else {
      // Fluxo normal de autenticação
      if (!idToken) {
        console.error('❌ [ANALYZE] Token ausente no body');
        return res.status(401).json({
          success: false,
          error: "AUTH_TOKEN_MISSING",
          message: "Token de autenticação necessário"
        });
      }
      
      // 🆕 MOVER PARA ANTES DAS VALIDAÇÕES (previne 'Cannot access before initialization')
      const referenceJobId = req.body.referenceJobId || null;
      console.log('🔑 [ANALYZE] IDTOKEN recebido:', idToken.substring(0, 20) + '...');
      
      try {
        decoded = await getAuthLazy().verifyIdToken(idToken);
        console.log('✅ [ANALYZE] Token verificado com sucesso');
      } catch (err) {
        console.error('❌ [ANALYZE] Erro ao verificar token:', err.message);
        console.error('❌ [ANALYZE] Stack:', err.stack);
        return res.status(401).json({
          success: false,
          error: "AUTH_ERROR",
          message: "Token inválido ou expirado"
        });
      }
      
      uid = decoded.uid;
      console.log('🔑 [ANALYZE] UID decodificado:', uid);
      
      if (!uid) {
        console.error('❌ [ANALYZE] UID undefined após decodificação!');
        return res.status(401).json({
          success: false,
          error: "INVALID_UID",
          message: "UID inválido no token"
        });
      }
    }
    
    // 🆕 MOVER referenceJobId para fora do bloco else
    const referenceJobId = req.body.referenceJobId || null;
    
    // ═══════════════════════════════════════════════════════════
    // 🔐 ENTITLEMENTS: Verificar permissão para modo referência (PRO only)
    // ═══════════════════════════════════════════════════════════
    if (!isDemoMode && (finalAnalysisType === 'reference' || mode === 'reference')) {
      console.log('🔐 [ENTITLEMENTS] Modo referência detectado - verificando permissão...');
      
      // Buscar documento do usuário no Firestore para determinar plano
      const db = getFirestore();
      const userDoc = await db.collection('usuarios').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const userPlan = getUserPlan(userData);
      
      console.log(`🔐 [ENTITLEMENTS] Plano do usuário: ${userPlan}`);
      
      if (!hasEntitlement(userPlan, 'reference')) {
        console.log(`🔐 [ENTITLEMENTS] ❌ BLOQUEADO: Modo Referência requer PRO, usuário tem ${userPlan}`);
        return res.status(403).json(buildPlanRequiredResponse('reference', userPlan));
      }
      
      console.log(`🔐 [ENTITLEMENTS] ✅ Modo Referência permitido para plano ${userPlan}`);
    }
    
    // ✅ ETAPA 2: VALIDAR LIMITES DE ANÁLISE ANTES DE CRIAR JOB
    console.log('📊 [ANALYZE] Verificando limites de análise para UID:', uid);
    
    let analysisCheck;
    
    if (isDemoMode) {
      // 🔥 DEMO: Limite já foi validado acima pelo backend
      // Aqui só montamos o objeto para compatibilidade
      analysisCheck = { 
        allowed: true, 
        demo: true, 
        demoId,
        mode: 'full', 
        user: { plan: 'demo' }, 
        remainingFull: 1 
      };
      console.log('🔥 [ANALYZE] DEMO MODE: Limite validado pelo backend');
    } else {
      try {
        analysisCheck = await canUseAnalysis(uid);
        console.log('📊 [ANALYZE] Resultado da verificação:', analysisCheck);
      } catch (err) {
        console.error('❌ [ANALYZE] Erro ao verificar limites:', err.message);
        console.error('❌ [ANALYZE] Stack:', err.stack);
        return res.status(500).json({
          success: false,
          error: "LIMIT_CHECK_ERROR",
          scope: 'analysis',
          message: "Erro ao verificar limites do plano"
        });
      }
    
      if (!analysisCheck.allowed) {
        console.log(`⛔ [ANALYZE] Limite de análises atingido para UID: ${uid}`);
        console.log(`⛔ [ANALYZE] Plano: ${analysisCheck.user.plan}, Mode: ${analysisCheck.mode}`);
        
        // ✅ Calcular data de reset (primeiro dia do próximo mês)
        const now = new Date();
        const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        
        // ✅ Obter limites do plano para meta
        const planLimits = {
          free: { cap: 1 },
          plus: { cap: 20 },
          pro: { cap: 60 },
          studio: { cap: 400 }
        };
        const limits = planLimits[analysisCheck.user.plan] || planLimits.free;
        const used = analysisCheck.user.analysesMonth || 0;
        
        // ✅ Determinar feature baseado no modo de análise
        const analysisFeature = mode === 'reference' ? 'analysis_reference' : 'analysis_genre';
        
        return res.status(403).json({
          success: false,
          // 🎯 NOVO CONTRATO: scope + code + feature + plan + meta
          code: analysisCheck.errorCode || "LIMIT_REACHED",
          scope: 'analysis',
          feature: analysisFeature,
          plan: analysisCheck.user.plan,
          meta: {
            cap: limits.cap,
            used: used,
            remaining: analysisCheck.remainingFull,
            resetDate: resetDate
          },
          // ✅ LEGADO: Manter campos antigos para retrocompatibilidade
          error: analysisCheck.errorCode || "LIMIT_REACHED",
          message: 'Limite de análises atingido', // Mensagem genérica, frontend usa mapper
          remainingFull: analysisCheck.remainingFull,
          mode: analysisCheck.mode
        });
      }
    }
    
    const analysisMode = analysisCheck.mode; // "full" | "reduced"
    const features = getPlanFeatures(analysisCheck.user?.plan || 'demo', analysisMode);
    
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`📊 [ANALYZE] MODO DE ANÁLISE DECIDIDO`);
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`  Modo: ${analysisMode.toUpperCase()}`);
    console.log(`  Plano: ${analysisCheck.user?.plan || 'demo'}`);
    console.log(`  Análises usadas: ${analysisCheck.user?.analysesMonth || 0}`);
    console.log(`  Análises full restantes: ${analysisCheck.remainingFull}`);
    console.log(`  UID: ${uid}`);
    if (analysisMode === 'reduced') {
      console.log(`  ⚠️ REDUCED: Backend enviará JSON completo`);
      console.log(`  ⚠️ REDUCED: Frontend aplicará máscaras nas métricas avançadas`);
    } else {
      console.log(`  ✅ FULL: Todas as métricas serão exibidas sem restrições`);
    }
    console.log(`═══════════════════════════════════════════════════════\n`);
    
    console.log(`✅ [ANALYZE] Análise permitida - UID: ${uid}`);
    console.log(`🎯 [ANALYZE] Features:`, features);
    
    // 🎯 LOG DE AUDITORIA OBRIGATÓRIO
    console.log('[GENRE-TRACE][BACKEND] 📥 Payload recebido do frontend:', {
      genre,
      hasGenreTargets: !!genreTargets,
      genreTargetsKeys: genreTargets ? Object.keys(genreTargets) : null,
      mode,
      fileKey
    });
    
    // 🧠 LOG DE DEBUG: Modo recebido
    console.log('🧠 Modo de análise recebido:', mode);
    
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

    // 🎯 VALIDAÇÃO DE MODO: Aceita 'genre' e 'reference'
    if (!["genre", "reference"].includes(finalAnalysisType)) {
      return res.status(400).json({
        success: false,
        error: 'Modo inválido. Use "genre" ou "reference".'
      });
    }
    
    // 🔒 VALIDAÇÃO DE GENRE baseada em analysisType
    if (finalAnalysisType === 'genre') {
      // MODO GENRE: Genre é OBRIGATÓRIO
      if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Genre é obrigatório para análise por gênero'
        });
      }
    } else if (finalAnalysisType === 'reference') {
      // MODO REFERENCE: Genre NÃO é obrigatório (reference é independente de gênero)
      // Validar apenas referenceJobId na segunda track
      if (finalReferenceStage === 'compare' || referenceJobId) {
        // Segunda track: referenceJobId OBRIGATÓRIO
        if (!referenceJobId) {
          return res.status(400).json({
            success: false,
            error: 'referenceJobId é obrigatório para segunda track de referência'
          });
        }
      }
      // Primeira track: nenhuma validação adicional (genre opcional)
    }


    // 🧠 DEBUG: Log do modo e referenceJobId
    console.log('🧠 [ANALYZE] Modo:', mode);
    console.log('🔗 [ANALYZE] Reference Job ID:', referenceJobId || 'nenhum');
    
    if (mode === 'reference' && referenceJobId) {
      console.log('🎯 [ANALYZE] Segunda música detectada - será comparada com job:', referenceJobId);
    } else if (mode === 'reference' && !referenceJobId) {
      console.log('🎯 [ANALYZE] Primeira música em modo reference - aguardará segunda');
    }

    // ✅ VERIFICAÇÃO OBRIGATÓRIA DA FILA
    if (!queueReady) {
      console.log('⏳ [API] Aguardando fila inicializar...');
      await queueInit;
    }

    // ✅ OBTER INSTÂNCIA DA FILA
    const queue = getAudioQueue();
    
    console.log("🟥 [AUDIT:CONTROLLER-PAYLOAD] Payload enviado para Postgres:");
    console.dir({ fileKey, mode, fileName, referenceJobId, genre, genreTargets }, { depth: 10 });
    
    // ✅ MONTAR PLAN CONTEXT PARA O PIPELINE
    const planContext = {
      plan: analysisCheck.user.plan,
      analysisMode: analysisMode, // "full" | "reduced"
      features: features,
      uid: uid,
      // 🎯 FIRST ANALYSIS CTA: Informar se é primeira análise FREE
      hasCompletedFirstFreeAnalysis: analysisCheck.user.hasCompletedFirstFreeAnalysis || false,
      isFirstFreeAnalysis: !analysisCheck.user.hasCompletedFirstFreeAnalysis && analysisCheck.user.plan === 'free' && analysisMode === 'full'
    };
    
    console.log('📊 [ANALYZE] Plan Context montado:', planContext);
    
    // ✅ CRIAR JOB NO BANCO E ENFILEIRAR (passar todos os parâmetros incluindo analysisType e referenceStage)
    const jobRecord = await createJobInDatabase(
      fileKey, 
      mode,  // mantido por compatibilidade
      fileName, 
      referenceJobId, 
      genre, 
      genreTargets, 
      planContext,
      finalAnalysisType,    // 🆕 Campo explícito
      finalReferenceStage,  // 🆕 Campo explícito
      validSoundDestination // 🆕 STREAMING MODE: 'pista' | 'streaming'
    );
    
    console.log('[ANALYZE] ✅ Job criado:', {
      jobId: jobRecord.id,
      analysisType: finalAnalysisType,
      referenceStage: finalReferenceStage,
      soundDestination: validSoundDestination,
      hasGenre: !!genre
    });

    // ✅ ETAPA 3: REGISTRAR USO DE ANÁLISE NO SISTEMA DE LIMITES (SÓ SE FOR FULL)
    // 🔥 DEMO MODE: Não registrar uso no banco
    if (!isDemoMode) {
      console.log('📝 [ANALYZE] Registrando uso de análise para UID:', uid, '- Mode:', analysisMode);
      try {
        await registerAnalysis(uid, analysisMode);
        console.log(`✅ [ANALYZE] Análise registrada com sucesso para: ${uid} (mode: ${analysisMode})`);
      } catch (err) {
        console.error('⚠️ [ANALYZE] Erro ao registrar análise (job já foi criado):', err.message);
        // Não bloquear resposta - job já foi criado com sucesso
      }
    } else {
      console.log('🔥 [ANALYZE] DEMO MODE: Pulando registro de uso no banco');
    }

    // 🔥 DEMO: Registrar uso APÓS job criado com sucesso
    if (isDemoMode && demoId) {
      try {
        const demoResult = await registerDemoUsage(req);
        console.log('🔥 [ANALYZE] Demo registrado no backend:', {
          demoId: demoId.substring(0, 16) + '...',
          success: demoResult.success,
          blocked: demoResult.blocked
        });
      } catch (demoErr) {
        console.error('⚠️ [ANALYZE] Erro ao registrar demo (não crítico):', demoErr.message);
      }
    }

    // ✅ RESPOSTA DE SUCESSO COM JOBID GARANTIDO
    res.status(200).json({
      ok: true,
      success: true,
      jobId: jobRecord.id,
      demoMode: isDemoMode || false,
      demoBlocked: isDemoMode, // Sinaliza que próxima tentativa será bloqueada
      job: {
        id: jobRecord.id,
        status: jobRecord.status,
        mode: jobRecord.mode,
      },
      fileKey: jobRecord.file_key,
      mode: jobRecord.mode,
      fileName: jobRecord.file_name || null,
      status: jobRecord.status,
      createdAt: jobRecord.created_at
    });

  } catch (error) {
    // ✅ LOG DE ERRO OBRIGATÓRIO
    console.error('❌ [API] Erro na rota /analyze:', error.message);
    console.error('❌ [API] Stack:', error.stack);
    
    // ✅ RESPOSTA DE ERRO COM STATUS 500
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ✅ NOVA ROTA: POST /compare para análise comparativa
 * 🎯 Cria job de comparação entre duas músicas (user vs reference)
 * ✅ PROTEÇÃO: Rate limiting (10 req/min por IP)
 */
router.post("/compare", analysisLimiter, async (req, res) => {
  // ✅ LOG OBRIGATÓRIO: Rota chamada
  console.log('🎧 [API] /compare chamada');
  
  try {
    const { userFileKey, referenceFileKey, userFileName, refFileName } = req.body;
    
    // ✅ VALIDAÇÕES BÁSICAS
    if (!userFileKey) {
      return res.status(400).json({
        success: false,
        error: "userFileKey é obrigatório"
      });
    }

    if (!referenceFileKey) {
      return res.status(400).json({
        success: false,
        error: "referenceFileKey é obrigatório"
      });
    }

    if (!validateFileType(userFileKey)) {
      return res.status(400).json({
        success: false,
        error: "Extensão não suportada para arquivo do usuário. Apenas WAV, FLAC e MP3 são aceitos."
      });
    }

    if (!validateFileType(referenceFileKey)) {
      return res.status(400).json({
        success: false,
        error: "Extensão não suportada para arquivo de referência. Apenas WAV, FLAC e MP3 são aceitos."
      });
    }

    // ✅ VERIFICAÇÃO OBRIGATÓRIA DA FILA
    if (!queueReady) {
      console.log('⏳ [API] Aguardando fila inicializar...');
      await queueInit;
    }

    // ✅ OBTER INSTÂNCIA DA FILA
    const queue = getAudioQueue();
    
    // ✅ CRIAR JOB DE COMPARAÇÃO NO BANCO E ENFILEIRAR
    const jobRecord = await createComparisonJobInDatabase(userFileKey, referenceFileKey, userFileName, refFileName);

    console.log("🎧 Novo job de comparação criado:", jobRecord.id);

    // ✅ RESPOSTA DE SUCESSO COM JOBID GARANTIDO
    res.status(200).json({
      ok: true,
      success: true,
      jobId: jobRecord.id,
      job: {
        id: jobRecord.id,
        status: jobRecord.status || "queued",
        mode: "comparison"
      },
      mode: "comparison"
    });

  } catch (error) {
    // ✅ LOG DE ERRO OBRIGATÓRIO
    console.error('❌ [API] Erro na rota /compare:', error.message);
    
    // ✅ RESPOSTA DE ERRO COM STATUS 500
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;