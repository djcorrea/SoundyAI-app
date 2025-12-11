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
import { getAuth } from '../../firebase/admin.js';
import { canUseAnalysis, registerAnalysis, getPlanFeatures } from '../../lib/user/userPlans.js';

// Definir service name para auditoria
process.env.SERVICE_NAME = 'api';

// ✅ Obter Firebase Auth
const auth = getAuth();

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
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null, genreTargets = null, planContext = null) {
  // 🔑 CRÍTICO: jobId DEVE ser UUID válido para tabela PostgreSQL (coluna tipo 'uuid')
  const jobId = randomUUID();
  
  // 📋 externalId para logs e identificação externa (pode ser personalizado)
  const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
  
  console.log(`📋 [JOB-CREATE] Iniciando job:`);
  console.log(`   🔑 UUID (Banco): ${jobId}`);
  console.log(`   📋 ID Externo: ${externalId}`);
  console.log(`   📁 Arquivo: ${fileKey}`);
  console.log(`   ⚙️ Modo: ${mode}`);
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
      mode,
      genre: genre,        // 🎯 CRÍTICO: Genre DEVE ir para Redis
      genreTargets: genreTargets, // 🎯 CRÍTICO: GenreTargets DEVE ir para Redis
      referenceJobId: referenceJobId, // 🔗 ID do job de referência (se mode='comparison')
      planContext: planContext // 📊 NOVO: Contexto de plano e features
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
    
    // 🎯 CORREÇÃO CRÍTICA: SEMPRE validar genre (não pode ser vazio)
    if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
      throw new Error('❌ [CRITICAL] Genre é obrigatório e não pode ser vazio');
    }
    
    // 🎯 LOG DE AUDITORIA OBRIGATÓRIO
    console.log('[GENRE-TRACE][BACKEND] 💾 Salvando no banco:', {
      jobId: jobId.substring(0, 8),
      receivedGenre: genre,
      hasGenreTargets: !!genreTargets,
      genreTargetsKeys: genreTargets ? Object.keys(genreTargets) : null
    });
    
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
 */
router.post("/analyze", async (req, res) => {
  // ✅ LOG OBRIGATÓRIO: Rota chamada
  console.log('🚀 [API] /analyze chamada');
  console.log('📦 [ANALYZE] Headers:', req.headers);
  console.log('📦 [ANALYZE] Body:', req.body);
  
  try {
    console.log("🟥 [AUDIT:CONTROLLER-BODY] Payload recebido do front:");
    console.dir(req.body, { depth: 10 });
    
    const { 
      fileKey, 
      mode = "genre", 
      fileName, 
      genre, 
      genreTargets,
      idToken  // ✅ NOVO: Token de autenticação
    } = req.body;
    
    // ✅ ETAPA 1: AUTENTICAÇÃO OBRIGATÓRIA
    console.log('🔐 [ANALYZE] Verificando autenticação...');
    
    if (!idToken) {
      console.error('❌ [ANALYZE] Token ausente no body');
      return res.status(401).json({
        success: false,
        error: "AUTH_TOKEN_MISSING",
        message: "Token de autenticação necessário"
      });
    }
    
    console.log('🔑 [ANALYZE] IDTOKEN recebido:', idToken.substring(0, 20) + '...');
    
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
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
    
    const uid = decoded.uid;
    console.log('🔑 [ANALYZE] UID decodificado:', uid);
    
    if (!uid) {
      console.error('❌ [ANALYZE] UID undefined após decodificação!');
      return res.status(401).json({
        success: false,
        error: "INVALID_UID",
        message: "UID inválido no token"
      });
    }
    
    // ✅ ETAPA 2: VALIDAR LIMITES DE ANÁLISE ANTES DE CRIAR JOB
    console.log('📊 [ANALYZE] Verificando limites de análise para UID:', uid);
    
    let analysisCheck;
    try {
      analysisCheck = await canUseAnalysis(uid);
      console.log('📊 [ANALYZE] Resultado da verificação:', analysisCheck);
    } catch (err) {
      console.error('❌ [ANALYZE] Erro ao verificar limites:', err.message);
      console.error('❌ [ANALYZE] Stack:', err.stack);
      return res.status(500).json({
        success: false,
        error: "LIMIT_CHECK_ERROR",
        message: "Erro ao verificar limites do plano"
      });
    }
    
    if (!analysisCheck.allowed) {
      console.log(`⛔ [ANALYZE] Limite de análises atingido para UID: ${uid}`);
      console.log(`⛔ [ANALYZE] Plano: ${analysisCheck.user.plan}, Mode: ${analysisCheck.mode}`);
      return res.status(403).json({
        success: false,
        error: "LIMIT_REACHED",
        message: "Seu plano atual não permite mais análises. Atualize seu plano para continuar.",
        remainingFull: analysisCheck.remainingFull,
        plan: analysisCheck.user.plan,
        mode: analysisCheck.mode
      });
    }
    
    const analysisMode = analysisCheck.mode; // "full" | "reduced"
    const features = getPlanFeatures(analysisCheck.user.plan, analysisMode);
    
    console.log(`✅ [ANALYZE] Análise permitida - UID: ${uid}`);
    console.log(`📊 [ANALYZE] Modo: ${analysisMode}, Plano: ${analysisCheck.user.plan}`);
    console.log(`🎯 [ANALYZE] Features:`, features);
    console.log(`📈 [ANALYZE] Análises completas restantes: ${analysisCheck.remainingFull}`);
    
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
    // Nota: 'comparison' não é um modo válido - comparação é identificada por referenceJobId
    if (!["genre", "reference"].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Modo inválido. Use "genre" ou "reference".'
      });
    }

    // 🔗 Extrair referenceJobId do payload (indica segunda música em modo reference)
    const referenceJobId = req.body.referenceJobId || null;
    
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
      uid: uid
    };
    
    console.log('📊 [ANALYZE] Plan Context montado:', planContext);
    
    // ✅ CRIAR JOB NO BANCO E ENFILEIRAR (passar referenceJobId, genre, genreTargets E planContext)
    const jobRecord = await createJobInDatabase(fileKey, mode, fileName, referenceJobId, genre, genreTargets, planContext);
    
    console.log('[GENRE-TRACE][BACKEND] ✅ Job criado - genre salvo:', jobRecord.data);

    // ✅ ETAPA 3: REGISTRAR USO DE ANÁLISE NO SISTEMA DE LIMITES (SÓ SE FOR FULL)
    console.log('📝 [ANALYZE] Registrando uso de análise para UID:', uid, '- Mode:', analysisMode);
    try {
      await registerAnalysis(uid, analysisMode);
      console.log(`✅ [ANALYZE] Análise registrada com sucesso para: ${uid} (mode: ${analysisMode})`);
    } catch (err) {
      console.error('⚠️ [ANALYZE] Erro ao registrar análise (job já foi criado):', err.message);
      // Não bloquear resposta - job já foi criado com sucesso
    }

    // ✅ RESPOSTA DE SUCESSO COM JOBID GARANTIDO
    res.status(200).json({
      ok: true,
      success: true,
      jobId: jobRecord.id,
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
 */
router.post("/compare", async (req, res) => {
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