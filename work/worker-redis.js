/**
 * 🔥 WORKER REDIS ROBUSTO - PRODUÇÃO READY
 * ✅ Conexão Redis com retry/backoff automático
 * ✅ Listeners completos para error, failed, completed
 * ✅ Logs claros para todos os eventos críticos
 * ✅ Inicialização apenas após Redis estabelecido
 * ✅ Tratamento de falhas silenciosas eliminado
 * ✅ Configuração TLS para Upstash/produção
 */

import "dotenv/config";
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import pool from './db.js';
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from 'express';

// ---------- Importar pipeline completo para análise REAL ----------
let processAudioComplete = null;

try {
  console.log(`[WORKER-REDIS][${new Date().toISOString()}] -> 📦 Carregando pipeline completo...`);
  const imported = await import("./api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  console.log(`[WORKER-REDIS][${new Date().toISOString()}] -> ✅ Pipeline completo carregado com sucesso!`);
} catch (err) {
  console.error(`[WORKER-REDIS][${new Date().toISOString()}] -> ❌ CRÍTICO: Falha ao carregar pipeline:`, err.message);
  console.error(`[WORKER-REDIS][${new Date().toISOString()}] -> Stack trace:`, err.stack);
  process.exit(1);
}

// 🏷️ Definir service name para auditoria
process.env.SERVICE_NAME = 'worker';

// 🚀 LOG INICIAL: Worker iniciando
console.log('🚀 [WORKER] ═══════════════════════════════════════');
console.log('🚀 [WORKER] INICIANDO WORKER REDIS ROBUSTO');
console.log('🚀 [WORKER] ═══════════════════════════════════════');
console.log(`📋 [WORKER-INIT] PID: ${process.pid}`);
console.log(`🌍 [WORKER-INIT] ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`⏰ [WORKER-INIT] Timestamp: ${new Date().toISOString()}`);

// 🔒 VERIFICAÇÃO CRÍTICA: Environment Variables
if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL não está definida. Abortando inicialização do worker.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('💥 [WORKER-INIT] ERRO CRÍTICO: DATABASE_URL não configurado');
  console.error('💡 [WORKER-INIT] Solução: Verificar arquivo .env na pasta work/');
  process.exit(1);
}

// 🚀 LOG DA URL REDIS PARA DEBUG (com senha mascarada)
const maskedRedisUrl = process.env.REDIS_URL.replace(/:[^:]*@/, ':***@');
console.log('🚀 REDIS_URL atual:', maskedRedisUrl);

// 🔧 DETECÇÃO AUTOMÁTICA DE TLS BASEADA NA URL
const isTLS = process.env.REDIS_URL.startsWith('rediss://');
console.log(`🔐 TLS detectado: ${isTLS ? 'SIM' : 'NÃO'}`);

console.log('✅ [WORKER-INIT] Variables: Redis e PostgreSQL configurados');

// 🔧 CONFIGURAÇÃO REDIS COM RETRY/BACKOFF ROBUSTO
// ⚙️ PARTE 2: Configuração ajustada para evitar timeouts
const REDIS_CONFIG = {
  connectTimeout: 15000,            // ✅ PARTE 2: Reduzido para 15s
  maxRetriesPerRequest: null,       // ✅ Obrigatório para BullMQ
  enableReadyCheck: false,          // ✅ Melhora performance
  keepAlive: 30000,                 // ✅ PARTE 2: Reduzido para 30s
  commandTimeout: 30000,            // ✅ PARTE 2: Aumentado para 30s
  lazyConnect: false,               // ✅ Conectar imediatamente
  family: 4,                        // ✅ IPv4
  
  // 🔐 TLS SOMENTE SE A URL FOR rediss://
  ...(isTLS && { tls: { rejectUnauthorized: false } }),
  
  // 🔄 RETRY STRATEGY ROBUSTO
  retryStrategy: (times) => {
    const delay = Math.min(times * 2000, 30000); // Max 30s delay
    console.log(`🔄 [REDIS-RETRY] Tentativa ${times}: próxima em ${delay}ms`);
    return delay;
  },
  
  retryDelayOnFailover: 2000,       // ✅ 2s delay em failover
  enableAutoPipelining: true,       // ✅ Performance
  
  // 🔄 RECONEXÃO AUTOMÁTICA
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  }
};

// 🌐 VARIÁVEIS GLOBAIS PARA CONEXÃO E WORKER
let redisConnection = null;
let worker = null;
let isRedisReady = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 10;

/**
 * 🔗 CRIAR CONEXÃO REDIS COM LOGS DETALHADOS
 */
async function createRedisConnection() {
  return new Promise((resolve, reject) => {
    connectionAttempts++;
    
    console.log(`🔌 [REDIS-CONNECT] Tentativa ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`);
    console.log(`🔌 [REDIS-CONNECT] URL: ${maskedRedisUrl}`);
    
    const redis = new Redis(process.env.REDIS_URL, REDIS_CONFIG);
    
    // 📡 EVENT LISTENERS DETALHADOS
    redis.on('connect', () => {
      console.log('🟡 [REDIS-CONNECT] Conexão iniciada...');
    });
    
    redis.on('ready', async () => {
      try {
        const clientId = await redis.client('id');
        const serverInfo = await redis.info('server');
        const redisVersion = serverInfo.match(/redis_version:([\d.]+)/)?.[1] || 'unknown';
        
        console.log('✅ [REDIS-CONNECT] Conexão bem-sucedida');
        console.log(`✅ [REDIS-READY] Client ID: ${clientId}`);
        console.log(`✅ [REDIS-READY] Redis Version: ${redisVersion}`);
        console.log(`✅ [REDIS-READY] PID: ${process.pid}`);
        
        isRedisReady = true;
        redisConnection = redis;
        resolve(redis);
        
      } catch (err) {
        console.error('💥 [REDIS-READY] Erro ao obter informações:', err.message);
        console.log('✅ [REDIS-CONNECT] Conexão bem-sucedida');
        isRedisReady = true;
        redisConnection = redis;
        resolve(redis); // Continua mesmo com erro de info
      }
    });
    
    redis.on('error', (err) => {
      console.error('💥 [REDIS-ERROR] Tipo:', err.code || 'UNKNOWN');
      console.error('💥 [REDIS-ERROR] Mensagem:', err.message);
      console.error('💥 [REDIS-ERROR] Host:', err.address || 'unknown');
      
      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        console.error(`💥 [REDIS-ERROR] Máximo de tentativas atingido (${MAX_CONNECTION_ATTEMPTS})`);
        reject(err);
      }
    });
    
    redis.on('reconnecting', (delay) => {
      console.log(`🔄 [REDIS-RECONNECT] Reconectando em ${delay}ms...`);
    });
    
    redis.on('end', () => {
      console.log('🔌 [REDIS-END] Conexão encerrada');
      isRedisReady = false;
    });
    
    redis.on('close', () => {
      console.log('🚪 [REDIS-CLOSE] Conexão fechada');
      isRedisReady = false;
    });
    
    // ⏰ TIMEOUT DE SEGURANÇA
    setTimeout(() => {
      if (!isRedisReady) {
        console.error('⏰ [REDIS-TIMEOUT] Timeout na conexão Redis (30s)');
        reject(new Error('Redis connection timeout'));
      }
    }, 30000);
  });
}

/**
 * 🔧 CONFIGURAR EVENT LISTENERS DO WORKER
 */
function setupWorkerEventListeners() {
  if (!worker) return;
  
  console.log('🎧 [WORKER-EVENTS] Configurando listeners...');
  
  // ✅ LISTENER: WORKER PRONTO
  worker.on('ready', () => {
    console.log('🟢 [WORKER-READY] Worker pronto para processar jobs!');
    console.log(`🎯 [WORKER-READY] Fila: 'audio-analyzer'`);
    console.log(`⚙️ [WORKER-READY] PID: ${process.pid}`);
  });
  
  // ✅ LISTENER: JOB RECEBIDO
  worker.on('active', (job) => {
    const { jobId, externalId, fileKey, mode } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    
    console.log('🎧 [JOB-RECEIVED] ═══════════════════════════════');
    console.log('🎧 [JOB-RECEIVED] Job recebido e iniciando processamento');
    console.log(`🎧 [JOB-RECEIVED] Redis Job ID: ${job.id}`);
    console.log(`🎧 [JOB-RECEIVED] Display ID: ${displayId}`);
    console.log(`🎧 [JOB-RECEIVED] Arquivo: ${fileKey?.split('/').pop() || 'unknown'}`);
    console.log(`🎧 [JOB-RECEIVED] Modo: ${mode || 'unknown'}`);
    console.log(`🎧 [JOB-RECEIVED] Tentativa: ${job.attemptsMade + 1}/${job.opts.attempts}`);
  });
  
  // ✅ LISTENER: JOB CONCLUÍDO
  worker.on('completed', (job, result) => {
    const { jobId, externalId, fileKey } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    
    console.log('✅ [JOB-COMPLETED] ═══════════════════════════════');
    console.log('✅ [JOB-COMPLETED] Job concluído com sucesso!');
    console.log(`✅ [JOB-COMPLETED] Redis Job ID: ${job.id}`);
    console.log(`✅ [JOB-COMPLETED] Display ID: ${displayId}`);
    console.log(`✅ [JOB-COMPLETED] Arquivo: ${fileKey?.split('/').pop() || 'unknown'}`);
    console.log(`✅ [JOB-COMPLETED] Duração: ${result?.processingTime || 'N/A'}ms`);
    console.log(`✅ [JOB-COMPLETED] Status: ${result?.status || 'success'}`);
  });
  
  // ✅ LISTENER: JOB FALHOU
  worker.on('failed', (job, err) => {
    const { jobId, externalId, fileKey } = job?.data || {};
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    
    console.error('❌ [JOB-FAILED] ═══════════════════════════════');
    console.error('❌ [JOB-FAILED] Job falhou!');
    console.error(`❌ [JOB-FAILED] Redis Job ID: ${job?.id || 'unknown'}`);
    console.error(`❌ [JOB-FAILED] Display ID: ${displayId}`);
    console.error(`❌ [JOB-FAILED] Arquivo: ${fileKey?.split('/').pop() || 'unknown'}`);
    console.error(`❌ [JOB-FAILED] Erro: ${err.message}`);
    console.error(`❌ [JOB-FAILED] Tentativa: ${job?.attemptsMade || 0}/${job?.opts?.attempts || 'N/A'}`);
    
    // Stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.error(`❌ [JOB-FAILED] Stack: ${err.stack}`);
    }
  });
  
  // ✅ LISTENER: ERRO DO WORKER
  worker.on('error', (err) => {
    console.error('🚨 [WORKER-ERROR] ═══════════════════════════════');
    console.error('🚨 [WORKER-ERROR] Erro crítico no Worker!');
    console.error(`🚨 [WORKER-ERROR] Tipo: ${err.name || 'UnknownError'}`);
    console.error(`🚨 [WORKER-ERROR] Mensagem: ${err.message}`);
    console.error(`🚨 [WORKER-ERROR] PID: ${process.pid}`);
    
    // Stack trace completo em caso de erro crítico
    console.error(`🚨 [WORKER-ERROR] Stack: ${err.stack}`);
    
    // Tentar reconectar em caso de erro de conexão
    if (err.message.includes('Connection') || err.message.includes('Redis')) {
      console.log('🔄 [WORKER-ERROR] Tentando reconectar em 5 segundos...');
      setTimeout(() => {
        console.log('🔄 [WORKER-ERROR] Reiniciando Worker...');
        initializeWorker();
      }, 5000);
    }
  });
  
  // ✅ LISTENER: JOB TRAVADO
  worker.on('stalled', (job) => {
    const { jobId, externalId, fileKey } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    
    console.warn('🐌 [JOB-STALLED] ═══════════════════════════════');
    console.warn('🐌 [JOB-STALLED] Job travado - será reprocessado');
    console.warn(`🐌 [JOB-STALLED] Redis Job ID: ${job.id}`);
    console.warn(`🐌 [JOB-STALLED] Display ID: ${displayId}`);
    console.warn(`🐌 [JOB-STALLED] Arquivo: ${fileKey?.split('/').pop() || 'unknown'}`);
  });
  
  console.log('✅ [WORKER-EVENTS] Todos os listeners configurados!');
}

/**
 * 🚀 INICIALIZAÇÃO PRINCIPAL DO WORKER
 */
async function initializeWorker() {
  try {
    console.log('⏳ [WORKER-INIT] Iniciando processo de inicialização...');
    
    // 🔗 ETAPA 1: ESTABELECER CONEXÃO REDIS
    console.log('🔗 [WORKER-INIT] Etapa 1: Conectando ao Redis...');
    
    await createRedisConnection();
    
    if (!isRedisReady || !redisConnection) {
      throw new Error('Falha ao estabelecer conexão Redis');
    }
    
    // ⚙️ ETAPA 2: CONFIGURAR WORKER
    console.log('⚙️ [WORKER-INIT] Etapa 2: Configurando Worker BullMQ...');
    
    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 3;
    console.log(`⚙️ [WORKER-INIT] Concorrência: ${concurrency}`);
    
    // 🎯 CRIAR WORKER COM CONEXÃO ESTABELECIDA
    // ⚙️ PARTE 2: Worker com configuração otimizada e lockDuration aumentado
    worker = new Worker('audio-analyzer', audioProcessor, {
      connection: redisConnection,
      concurrency,
      lockDuration: 60000,          // ✅ PARTE 2: 1min de lock (reduzido de 3min)
      stalledInterval: 15000,           // ✅ PARTE 2: Desabilitado (evita travamentos falso-positivos)
      settings: {
        maxStalledCount: 2,         // Max 2 travamentos
        keepAlive: 60000,           // 1min keepalive
        batchSize: 1,               // Processar 1 job por vez
        delayedDebounce: 10000,     // 10s delay debounce
      }
    });
    
    console.log('✅ [WORKER-INIT] Worker BullMQ criado com sucesso!');
    console.log(`✅ [WORKER-INIT] Fila: 'audio-analyzer'`);
    
    // 🎧 ETAPA 3: CONFIGURAR EVENT LISTENERS
    console.log('🎧 [WORKER-INIT] Etapa 3: Configurando event listeners...');
    setupWorkerEventListeners();
    
    // 🏥 ETAPA 4: HEALTH CHECK SERVER
    console.log('🏥 [WORKER-INIT] Etapa 4: Iniciando health check server...');
    startHealthCheckServer();
    
    console.log('🎉 [WORKER-INIT] ═══════════════════════════════════════');
    console.log('🎉 [WORKER-INIT] WORKER INICIALIZADO COM SUCESSO!');
    console.log('🎉 [WORKER-INIT] ═══════════════════════════════════════');
    console.log(`🎯 [WORKER-INIT] Aguardando jobs na fila 'audio-analyzer'...`);
    
  } catch (error) {
    console.error('💥 [WORKER-INIT] ═══════════════════════════════════════');
    console.error('💥 [WORKER-INIT] FALHA NA INICIALIZAÇÃO DO WORKER!');
    console.error('💥 [WORKER-INIT] ═══════════════════════════════════════');
    console.error(`💥 [WORKER-INIT] Erro: ${error.message}`);
    console.error(`💥 [WORKER-INIT] Stack: ${error.stack}`);
    
    // 🔄 RETRY AUTOMÁTICO EM CASO DE FALHA
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const retryDelay = Math.min(connectionAttempts * 5000, 30000); // Max 30s
      console.log(`🔄 [WORKER-INIT] Tentando novamente em ${retryDelay}ms...`);
      
      setTimeout(() => {
        console.log('🔄 [WORKER-INIT] Reiniciando inicialização...');
        initializeWorker();
      }, retryDelay);
    } else {
      console.error('💥 [WORKER-INIT] Máximo de tentativas atingido. Encerrando processo.');
      process.exit(1);
    }
  }
}

/**
 * 🏥 HEALTH CHECK SERVER PARA RAILWAY/PRODUÇÃO
 */
function startHealthCheckServer() {
  const app = express();
  const port = process.env.PORT || 8081;
  
  app.get('/health', (req, res) => {
    const status = {
      status: 'healthy',
      redis: isRedisReady ? 'connected' : 'disconnected',
      worker: worker ? 'active' : 'inactive',
      pid: process.pid,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.json(status);
  });
  
  app.listen(port, () => {
    console.log(`🏥 [HEALTH] Health check server rodando na porta ${port}`);
  });
}

// ===============================================
// 🎵 AUDIO PROCESSOR FUNCTION
// ===============================================

/**
 * 🛡️ FIX: Validar se JSON está completo antes de marcar como completed
 * Retorna { valid: boolean, missing: string[] }
 * 
 * IMPORTANTE: suggestions e aiSuggestions SÓ são obrigatórios no SEGUNDO job (comparação A/B)
 * No PRIMEIRO job (análise individual), arrays vazios são VÁLIDOS
 */
function validateCompleteJSON(finalJSON, mode, referenceJobId) {
  const missing = [];
  
  // 🎯 Detectar se é o PRIMEIRO ou SEGUNDO job do fluxo A/B
  const isFirstJob = !referenceJobId || referenceJobId === null;
  const isSecondJob = mode === 'reference' && referenceJobId && referenceJobId !== null;
  
  console.log('[WORKER-VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WORKER-VALIDATION] 🔍 VALIDANDO JSON ANTES DE MARCAR COMPLETED');
  console.log('[WORKER-VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[WORKER-VALIDATION] Modo: ${mode}`);
  console.log(`[WORKER-VALIDATION] ReferenceJobId: ${referenceJobId || 'null'}`);
  console.log(`[WORKER-VALIDATION] Tipo de análise: ${isFirstJob ? 'PRIMEIRO JOB (individual)' : 'SEGUNDO JOB (comparação A/B)'}`);
  console.log('[WORKER-VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 1. Validar suggestions (base)
  // 🎯 FIX: Só validar se for SEGUNDO job (comparação A/B)
  if (isSecondJob) {
    if (!Array.isArray(finalJSON.suggestions) || finalJSON.suggestions.length === 0) {
      missing.push('suggestions (array vazio ou ausente)');
      console.error('[WORKER-VALIDATION] ❌ suggestions: AUSENTE ou VAZIO (obrigatório para comparação A/B)');
    } else {
      console.log(`[WORKER-VALIDATION] ✅ suggestions: ${finalJSON.suggestions.length} itens`);
    }
  } else {
    // Primeiro job: suggestions vazias são VÁLIDAS
    console.log(`[WORKER-VALIDATION] ⏭️ suggestions: ${finalJSON.suggestions?.length || 0} itens (OPCIONAL para primeiro job)`);
  }
  
  // 2. Validar aiSuggestions (IA enriquecida)
  // 🎯 FIX: Só validar se for SEGUNDO job (comparação A/B)
  if (isSecondJob) {
    if (!Array.isArray(finalJSON.aiSuggestions) || finalJSON.aiSuggestions.length === 0) {
      missing.push('aiSuggestions (array vazio ou ausente)');
      console.error('[WORKER-VALIDATION] ❌ aiSuggestions: AUSENTE ou VAZIO (obrigatório para comparação A/B)');
    } else {
      console.log(`[WORKER-VALIDATION] ✅ aiSuggestions: ${finalJSON.aiSuggestions.length} itens`);
    }
  } else {
    // Primeiro job: aiSuggestions vazias são VÁLIDAS
    console.log(`[WORKER-VALIDATION] ⏭️ aiSuggestions: ${finalJSON.aiSuggestions?.length || 0} itens (OPCIONAL para primeiro job)`);
  }
  
  // 3. Validar technicalData
  if (!finalJSON.technicalData || typeof finalJSON.technicalData !== 'object') {
    missing.push('technicalData (ausente ou inválido)');
    console.error('[WORKER-VALIDATION] ❌ technicalData: AUSENTE');
  } else {
    const hasLUFS = typeof finalJSON.technicalData.lufsIntegrated === 'number';
    const hasPeak = typeof finalJSON.technicalData.truePeakDbtp === 'number';
    const hasDR = typeof finalJSON.technicalData.dynamicRange === 'number';
    
    if (!hasLUFS) missing.push('technicalData.lufsIntegrated');
    if (!hasPeak) missing.push('technicalData.truePeakDbtp');
    if (!hasDR) missing.push('technicalData.dynamicRange');
    
    console.log(`[WORKER-VALIDATION] ✅ technicalData: presente`);
    console.log(`[WORKER-VALIDATION]    - LUFS: ${hasLUFS ? finalJSON.technicalData.lufsIntegrated : 'AUSENTE'}`);
    console.log(`[WORKER-VALIDATION]    - Peak: ${hasPeak ? finalJSON.technicalData.truePeakDbtp : 'AUSENTE'}`);
    console.log(`[WORKER-VALIDATION]    - DR: ${hasDR ? finalJSON.technicalData.dynamicRange : 'AUSENTE'}`);
  }
  
  // 4. Validar score
  if (typeof finalJSON.score !== 'number') {
    missing.push('score (ausente ou não numérico)');
    console.error('[WORKER-VALIDATION] ❌ score: AUSENTE');
  } else {
    console.log(`[WORKER-VALIDATION] ✅ score: ${finalJSON.score}`);
  }
  
  // 5. Validar spectralBands
  if (!finalJSON.spectralBands || typeof finalJSON.spectralBands !== 'object') {
    missing.push('spectralBands (ausente)');
    console.error('[WORKER-VALIDATION] ❌ spectralBands: AUSENTE');
  } else {
    console.log('[WORKER-VALIDATION] ✅ spectralBands: presente');
  }
  
  // 6. Validar metrics
  if (!finalJSON.metrics || typeof finalJSON.metrics !== 'object') {
    missing.push('metrics (ausente)');
    console.error('[WORKER-VALIDATION] ❌ metrics: AUSENTE');
  } else {
    console.log('[WORKER-VALIDATION] ✅ metrics: presente');
  }
  
  // 7. Validar scoring
  if (!finalJSON.scoring || typeof finalJSON.scoring !== 'object') {
    missing.push('scoring (ausente)');
    console.error('[WORKER-VALIDATION] ❌ scoring: AUSENTE');
  } else {
    console.log('[WORKER-VALIDATION] ✅ scoring: presente');
  }
  
  // 8. Validar referenceComparison se necessário
  if (mode === 'reference' && referenceJobId) {
    if (!finalJSON.referenceComparison || typeof finalJSON.referenceComparison !== 'object') {
      missing.push('referenceComparison (necessário para modo reference)');
      console.error('[WORKER-VALIDATION] ❌ referenceComparison: AUSENTE (obrigatório para modo reference)');
    } else {
      console.log('[WORKER-VALIDATION] ✅ referenceComparison: presente');
    }
  }
  
  const isValid = missing.length === 0;
  
  console.log('[WORKER-VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (isValid) {
    console.log('[WORKER-VALIDATION] ✅✅✅ JSON COMPLETO - PODE MARCAR COMO COMPLETED');
  } else {
    console.error('[WORKER-VALIDATION] ❌❌❌ JSON INCOMPLETO - NÃO PODE MARCAR COMO COMPLETED');
    console.error(`[WORKER-VALIDATION] Campos faltando (${missing.length}):`, missing);
  }
  console.log('[WORKER-VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return { valid: isValid, missing };
}

/**
 * Atualizar status do job no PostgreSQL
 */
async function updateJobStatus(jobId, status, results = null) {
  try {
    // 🔒 VALIDAÇÃO CRÍTICA: Verificar UUID antes de executar query
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [DB-UPDATE] ERRO: jobId inválido para PostgreSQL: '${jobId}'`);
      console.error(`💥 [DB-UPDATE] IGNORANDO atualização - UUID inválido não pode ser usado no banco`);
      return null; // Retorna null mas não quebra o processamento
    }

    let query;
    let params;

    if (results) {
      // ✅ LOGS DE AUDITORIA PRÉ-SALVAMENTO - SUGGESTIONS BASE
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE] 💾 SALVANDO RESULTS NO POSTGRES`);
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE] Job ID: ${jobId}`);
      console.log(`[AI-AUDIT][SAVE] Status: ${status}`);
      console.log(`[AI-AUDIT][SAVE] has suggestions?`, Array.isArray(results.suggestions));
      console.log(`[AI-AUDIT][SAVE] suggestions length:`, results.suggestions?.length || 0);
      console.log(`[AI-AUDIT][SAVE] suggestions type:`, typeof results.suggestions);
      
      // 🤖 LOGS DE AUDITORIA - AI SUGGESTIONS
      console.log(`[AI-AUDIT][SAVE] has aiSuggestions?`, Array.isArray(results.aiSuggestions));
      console.log(`[AI-AUDIT][SAVE] aiSuggestions length:`, results.aiSuggestions?.length || 0);
      console.log(`[AI-AUDIT][SAVE] aiSuggestions type:`, typeof results.aiSuggestions);
      
      if (!results.aiSuggestions || results.aiSuggestions.length === 0) {
        console.error(`[AI-AUDIT][SAVE] ❌ CRÍTICO: results.aiSuggestions AUSENTE no objeto results!`);
        console.error(`[AI-AUDIT][SAVE] ⚠️ Postgres irá salvar SEM aiSuggestions!`);
        console.error(`[AI-AUDIT][SAVE] Keys presentes:`, Object.keys(results).slice(0, 10));
      } else {
        console.log(`[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com ${results.aiSuggestions.length} itens`);
      }
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      console.log('\n\n🟣🟣🟣 [AUDIT:RESULT-BEFORE-SAVE] Resultado final antes de retornar:');
      console.dir(results, { depth: 10 });
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Genre no results:', results?.metadata?.genre);
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] results.genre:', results?.genre);
      
      query = `UPDATE jobs SET status = $1, results = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [status, JSON.stringify(results), jobId];
    } else {
      query = `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params = [status, jobId];
    }

    const result = await pool.query(query, params);
    console.log(`📝 [DB-UPDATE][${new Date().toISOString()}] -> Job ${jobId} status updated to '${status}'`);
    
    // ✅ LOGS DE AUDITORIA PÓS-SALVAMENTO
    if (results && result.rows[0]) {
      const savedResults = typeof result.rows[0].results === 'string' 
        ? JSON.parse(result.rows[0].results) 
        : result.rows[0].results;
      
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] ✅ JOB SALVO NO POSTGRES`);
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] Job ID:`, result.rows[0].id);
      console.log(`[AI-AUDIT][SAVE.after] Status:`, result.rows[0].status);
      console.log(`[AI-AUDIT][SAVE.after] has suggestions in DB?`, Array.isArray(savedResults.suggestions));
      console.log(`[AI-AUDIT][SAVE.after] suggestions length in DB:`, savedResults.suggestions?.length || 0);
      
      // 🤖 VERIFICAÇÃO CRÍTICA: aiSuggestions no banco
      console.log(`[AI-AUDIT][SAVE.after] has aiSuggestions in DB?`, Array.isArray(savedResults.aiSuggestions));
      console.log(`[AI-AUDIT][SAVE.after] aiSuggestions length in DB:`, savedResults.aiSuggestions?.length || 0);
      
      if (!savedResults.aiSuggestions || savedResults.aiSuggestions.length === 0) {
        console.error(`[AI-AUDIT][SAVE.after] ❌❌❌ CRÍTICO: aiSuggestions NÃO FOI SALVO NO POSTGRES! ❌❌❌`);
        console.error(`[AI-AUDIT][SAVE.after] ⚠️ API irá retornar SEM aiSuggestions!`);
        console.error(`[AI-AUDIT][SAVE.after] ⚠️ Frontend não receberá enriquecimento IA!`);
      } else {
        console.log(`[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO! ✅✅✅`);
        console.log(`[AI-AUDIT][SAVE.after] ${savedResults.aiSuggestions.length} itens enriquecidos disponíveis para frontend`);
      }
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error(`💥 [DB-ERROR][${new Date().toISOString()}] -> Failed to update job ${jobId}:`, error.message);
    
    // 🔍 DIAGNÓSTICO ESPECÍFICO para erros UUID
    if (error.message.includes('invalid input syntax for type uuid')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: jobId '${jobId}' não é UUID válido para PostgreSQL`);
      console.error(`💡 [DB-ERROR] SOLUÇÃO: Verificar se API está gerando UUIDs corretos`);
    }
    throw error;
  }
}

/**
 * Download arquivo do S3/Backblaze B2
 */
async function downloadFileFromBucket(fileKey) {
  console.log(`⬇️ [DOWNLOAD][${new Date().toISOString()}] -> Starting download: ${fileKey}`);
  
  const s3 = new AWS.S3({
    endpoint: process.env.B2_ENDPOINT,
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    region: 'us-east-005',
    s3ForcePathStyle: true
  });

  const tempDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'temp');
  
  // Criar diretório temp se não existir
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = path.basename(fileKey);
  const localFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

  try {
    const data = await s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey
    }).promise();

    fs.writeFileSync(localFilePath, data.Body);
    console.log(`✅ [DOWNLOAD][${new Date().toISOString()}] -> File saved: ${localFilePath}`);
    
    return localFilePath;
  } catch (error) {
    console.error(`💥 [DOWNLOAD][${new Date().toISOString()}] -> Failed to download ${fileKey}:`, error.message);
    throw error;
  }
}

/**
 * 🎵 AUDIO PROCESSOR PRINCIPAL - ANÁLISE REAL
 */
async function audioProcessor(job) {
  // 🔑 ESTRUTURA ATUALIZADA: suporte para jobId UUID + externalId para logs + referenceJobId
  const { jobId, externalId, fileKey, mode, fileName, referenceJobId } = job.data;
  
  console.log("\n🔵🔵 [AUDIT:WORKER-ENTRY] Worker recebeu job:");
  console.log("🔵 [AUDIT:WORKER-ENTRY] Arquivo:", import.meta.url);
  console.dir(job.data, { depth: 10 });
  
  console.log("\n\n🔵🔵🔵 [AUDIT:WORKER-ENTRY] Job recebido pelo worker:");
  console.dir(job.data, { depth: 10 });
  console.log("🔵 [AUDIT:WORKER-ENTRY] Genre recebido:", job.data?.genre);
  console.log("🔵 [AUDIT:WORKER-ENTRY] GenreTargets recebido:", job.data?.genreTargets);
  console.log("🔵 [AUDIT:WORKER-ENTRY] Mode recebido:", job.data?.mode);
  console.log("🔵 [AUDIT:WORKER-ENTRY] FileKey recebido:", job.data?.fileKey);
  console.log("🔵 [AUDIT:WORKER-ENTRY] JobId recebido:", job.data?.jobId);
  
  // 🎯 AUDIT: LOG INICIAL - Job consumido da fila
  console.log('🔍 [AUDIT_CONSUME] ═══════════════════════════════════════');
  console.log(`🔍 [AUDIT_CONSUME] Job consumido da fila Redis`);
  console.log(`🔍 [AUDIT_CONSUME] Redis Job ID: ${job.id}`);
  console.log(`🔍 [AUDIT_CONSUME] PostgreSQL UUID: ${jobId}`);
  console.log(`🔍 [AUDIT_CONSUME] Mode: ${mode || 'undefined'}`);
  console.log(`🔍 [AUDIT_CONSUME] Reference Job ID: ${referenceJobId || 'null'}`);
  console.log(`🔍 [AUDIT_CONSUME] File Key: ${fileKey}`);
  console.log(`🔍 [AUDIT_CONSUME] File Name: ${fileName || 'unknown'}`);
  console.log(`🔍 [AUDIT_CONSUME] External ID: ${externalId || 'não definido'}`);
  console.log(`🔍 [AUDIT_CONSUME] Job Name: ${job.name}`);
  console.log(`🔍 [AUDIT_CONSUME] Timestamp: ${new Date().toISOString()}`);
  console.log('🔍 [AUDIT_CONSUME] ═══════════════════════════════════════');
  
  // 🎯 AUDIT: Validação de modo reference
  if (mode === 'reference') {
    console.log('🎯 [AUDIT_MODE] Modo REFERENCE detectado');
    
    if (!referenceJobId) {
      console.warn('⚠️ [AUDIT_BYPASS] ═══════════════════════════════════════');
      console.warn('⚠️ [AUDIT_BYPASS] ALERTA: Job com mode=reference MAS sem referenceJobId!');
      console.warn(`⚠️ [AUDIT_BYPASS] Job ID: ${job.id}`);
      console.warn(`⚠️ [AUDIT_BYPASS] Modo: ${mode}`);
      console.warn(`⚠️ [AUDIT_BYPASS] ReferenceJobId: ${referenceJobId}`);
      console.warn('⚠️ [AUDIT_BYPASS] Este é provavelmente o PRIMEIRO job (música base)');
      console.warn('⚠️ [AUDIT_BYPASS] Job SERÁ PROCESSADO normalmente');
      console.warn('⚠️ [AUDIT_BYPASS] ═══════════════════════════════════════');
    } else {
      console.log('✅ [AUDIT_MODE] Job REFERENCE com referenceJobId presente');
      console.log(`✅ [AUDIT_MODE] Este é o SEGUNDO job (comparação)`);
      console.log(`✅ [AUDIT_MODE] Referenciando job: ${referenceJobId}`);
    }
  } else {
    console.log(`🎯 [AUDIT_MODE] Modo: ${mode || 'genre (default)'}`);
  }
  
  // 🎯 AUDIT: Validação CRÍTICA - job deve ser processado?
  console.log('✅ [AUDIT_PROCESS] ═══════════════════════════════════════');
  console.log('✅ [AUDIT_PROCESS] Job VÁLIDO para processamento');
  console.log(`✅ [AUDIT_PROCESS] Redis Job ID: ${job.id}`);
  console.log(`✅ [AUDIT_PROCESS] Iniciando pipeline de análise...`);
  console.log('✅ [AUDIT_PROCESS] ═══════════════════════════════════════');
  
  // ✅ REGRA 4: LOG OBRIGATÓRIO - Worker recebendo job
  console.log('🎧 [WORKER] Recebendo job', job.id, job.data);
  console.log(`🎧 [WORKER-DEBUG] Job name: '${job.name}' | Esperado: 'process-audio'`);
  console.log(`🔑 [WORKER-DEBUG] UUID (Banco): ${jobId}`);
  console.log(`📋 [WORKER-DEBUG] External ID: ${externalId || 'não definido'}`);
  console.log(`🔗 [WORKER-DEBUG] Reference Job ID: ${referenceJobId || 'nenhum'}`);
  
  // ✅ VERIFICAÇÃO CRÍTICA: Confirmar se é o job correto
  if (job.name !== 'process-audio') {
    console.warn(`⚠️ [WORKER] Job com nome inesperado: '${job.name}' (esperado: 'process-audio')`);
  }
  
  console.log(`🎵 [PROCESS][${new Date().toISOString()}] -> INICIANDO job ${job.id}`, {
    jobId,
    externalId: externalId || 'legacy',
    fileKey,
    mode,
    fileName,
    referenceJobId,
    jobName: job.name,
    timestamp: new Date(job.timestamp).toISOString(),
    attempts: job.attemptsMade + 1
  });

  let localFilePath = null;
  let preloadedReferenceMetrics = null;

  try {
    // ✅ REGRA 5: Validação de dados obrigatória
    if (!job.data || !fileKey || !jobId) {
      console.error('💥 [PROCESSOR] ERRO: Dados do job inválidos:', job.data);
      throw new Error(`Dados do job inválidos: ${JSON.stringify(job.data)}`);
    }

    // 🔒 VALIDAÇÃO CRÍTICA: Verificar se jobId é UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [PROCESSOR] ERRO: jobId não é UUID válido: '${jobId}'`);
      console.error(`💥 [PROCESSOR] SOLUÇÃO: Job será processado mas não atualizado no PostgreSQL`);
      console.error(`💥 [PROCESSOR] UUID esperado: formato '12345678-1234-1234-1234-123456789abc'`);
      throw new Error(`jobId inválido: '${jobId}' não é um UUID válido. Formato esperado: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
    }

    console.log(`✅ [PROCESSOR] jobId UUID válido: ${jobId}`);
    
    // ✅ VALIDAÇÃO DE S3: Verificar se fileKey tem formato válido
    if (!fileKey || typeof fileKey !== 'string' || fileKey.length < 3) {
      console.error(`💥 [PROCESSOR] ERRO: fileKey inválido: '${fileKey}'`);
      throw new Error(`fileKey inválido: '${fileKey}'`);
    }

    console.log(`✅ [PROCESSOR] fileKey válido: ${fileKey}`);

    // 🎯 CARREGAR MÉTRICAS DE REFERÊNCIA ANTES DO PROCESSAMENTO PESADO
    // 🔗 Se referenceJobId está presente, significa que é a SEGUNDA música (comparação)
    if (referenceJobId) {
      console.log('🔍 [AUDIT_REFERENCE] ═══════════════════════════════════════');
      console.log(`🔍 [AUDIT_REFERENCE] Modo: ${mode} | Detectada SEGUNDA música`);
      console.log(`🔍 [AUDIT_REFERENCE] Tentando carregar métricas do job: ${referenceJobId}`);
      console.log('🔍 [AUDIT_REFERENCE] ═══════════════════════════════════════');
      
      try {
        const refResult = await pool.query(
          `SELECT id, status, results FROM jobs WHERE id = $1`,
          [referenceJobId]
        );
        
        console.log(`🔍 [AUDIT_REFERENCE] Query executada - Linhas retornadas: ${refResult.rows.length}`);
        
        if (refResult.rows.length === 0) {
          console.error('❌ [AUDIT_REFERENCE] ERRO: Job de referência NÃO ENCONTRADO no banco!');
          console.error(`❌ [AUDIT_REFERENCE] Reference Job ID buscado: ${referenceJobId}`);
          console.error('❌ [AUDIT_REFERENCE] Possível causa: UUID incorreto ou job não criado');
          console.error('❌ [AUDIT_REFERENCE] Análise prosseguirá sem comparação');
        } else {
          const refJob = refResult.rows[0];
          console.log(`🔍 [AUDIT_REFERENCE] Job de referência encontrado!`);
          console.log(`🔍 [AUDIT_REFERENCE] Status do job ref: ${refJob.status}`);
          console.log(`🔍 [AUDIT_REFERENCE] Tem resultados: ${refJob.results ? 'SIM' : 'NÃO'}`);
          
          if (refJob.status !== 'completed') {
            console.warn(`⚠️ [AUDIT_REFERENCE] ALERTA: Job ref com status '${refJob.status}' (esperado: 'completed')`);
            console.warn(`⚠️ [AUDIT_REFERENCE] Job pode estar: pending, processing, ou failed`);
            console.warn(`⚠️ [AUDIT_REFERENCE] Análise prosseguirá sem comparação`);
          } else if (!refJob.results) {
            console.warn(`⚠️ [AUDIT_REFERENCE] ALERTA: Job ref completed mas sem resultados!`);
            console.warn(`⚠️ [AUDIT_REFERENCE] Análise prosseguirá sem comparação`);
          } else {
            preloadedReferenceMetrics = refJob.results;
            console.log('✅ [AUDIT_REFERENCE] ═══════════════════════════════════════');
            console.log('✅ [AUDIT_REFERENCE] Métricas de referência CARREGADAS com sucesso!');
            console.log(`✅ [AUDIT_REFERENCE] Score ref: ${preloadedReferenceMetrics.score || 'N/A'}`);
            console.log(`✅ [AUDIT_REFERENCE] LUFS ref: ${preloadedReferenceMetrics.technicalData?.lufsIntegrated || 'N/A'} LUFS`);
            console.log(`✅ [AUDIT_REFERENCE] DR ref: ${preloadedReferenceMetrics.technicalData?.dynamicRange || 'N/A'} dB`);
            console.log(`✅ [AUDIT_REFERENCE] TP ref: ${preloadedReferenceMetrics.technicalData?.truePeakDbtp || 'N/A'} dBTP`);
            console.log(`✅ [AUDIT_REFERENCE] File ref: ${preloadedReferenceMetrics.metadata?.fileName || 'N/A'}`);
            console.log('✅ [AUDIT_REFERENCE] ═══════════════════════════════════════');
          }
        }
      } catch (refError) {
        console.error('❌ [AUDIT_REFERENCE] ═══════════════════════════════════════');
        console.error('❌ [AUDIT_REFERENCE] ERRO ao carregar métricas de referência!');
        console.error(`❌ [AUDIT_REFERENCE] Reference Job ID: ${referenceJobId}`);
        console.error(`❌ [AUDIT_REFERENCE] Error Type: ${refError.name}`);
        console.error(`❌ [AUDIT_REFERENCE] Error Message: ${refError.message}`);
        console.error('❌ [AUDIT_REFERENCE] Análise prosseguirá sem comparação');
        console.error('❌ [AUDIT_REFERENCE] ═══════════════════════════════════════');
        // Não falhar o job principal, continuar sem comparação
      }
    } else if (mode === 'reference') {
      console.log('🎯 [AUDIT_REFERENCE] ═══════════════════════════════════════');
      console.log(`🎯 [AUDIT_REFERENCE] Modo: ${mode} | PRIMEIRA música`);
      console.log(`🎯 [AUDIT_REFERENCE] Reference Job ID: ${referenceJobId || 'null'}`);
      console.log('🎯 [AUDIT_REFERENCE] Este job será a BASE para comparação futura');
      console.log('🎯 [AUDIT_REFERENCE] Nenhuma métrica de referência necessária');
      console.log('🎯 [AUDIT_REFERENCE] ═══════════════════════════════════════');
    }

    console.log(`📝 [PROCESS][${new Date().toISOString()}] -> Atualizando status para processing no PostgreSQL...`);
    await updateJobStatus(jobId, 'processing');

    console.log(`⬇️ [PROCESS][${new Date().toISOString()}] -> Iniciando download do arquivo: ${fileKey}`);
    const downloadStartTime = Date.now();
    localFilePath = await downloadFileFromBucket(fileKey);
    const downloadTime = Date.now() - downloadStartTime;
    console.log(`🎵 [PROCESS][${new Date().toISOString()}] -> Arquivo baixado em ${downloadTime}ms: ${localFilePath}`);

    // 🎵 PROCESSAMENTO REAL VIA PIPELINE COMPLETO
    console.log(`🔄 [PROCESS][${new Date().toISOString()}] -> Iniciando análise de áudio REAL via pipeline...`);
    
    // Ler arquivo para buffer
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`📊 [WORKER-REDIS] Arquivo lido: ${fileBuffer.length} bytes`);

    const t0 = Date.now();
    
    // 🔥 TIMEOUT DE 3 MINUTOS PARA EVITAR TRAVAMENTO
    // 🎯 PASSAR MÉTRICAS DE REFERÊNCIA PRELOADED PARA EVITAR ASYNC MID-PIPELINE
    
    // 🔍 LOG DIAGNÓSTICO COMPLETO
    const isComparison = referenceJobId && preloadedReferenceMetrics;
    console.log(`🎯 [WORKER-ANALYSIS] ═══════════════════════════════`);
    console.log(`🎯 [WORKER-ANALYSIS] Modo: ${mode}`);
    console.log(`🎯 [WORKER-ANALYSIS] Reference Job ID: ${referenceJobId || 'nenhum'}`);
    console.log(`🎯 [WORKER-ANALYSIS] Métricas preloaded: ${preloadedReferenceMetrics ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`🎯 [WORKER-ANALYSIS] Tipo de análise: ${isComparison ? 'COMPARAÇÃO (2ª música)' : 'SIMPLES (1ª música ou genre)'}`);
    console.log(`🎯 [WORKER-ANALYSIS] ═══════════════════════════════`);
    
    const pipelinePromise = processAudioComplete(fileBuffer, fileName || 'unknown.wav', {
      jobId: jobId,
      mode: mode,
      referenceJobId: referenceJobId,
      preloadedReferenceMetrics: preloadedReferenceMetrics // ← MÉTRICAS CARREGADAS NO INÍCIO
    });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout após 3 minutos para: ${fileName}`));
      }, 180000);
    });

    console.log(`⚡ [WORKER-REDIS] Iniciando processamento de ${fileName}...`);
    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
    const totalMs = Date.now() - t0;
    
    console.log(`✅ [WORKER-REDIS] Pipeline concluído em ${totalMs}ms`);

    // Enriquecer resultado com informações do worker
    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4-redis",
      workerId: process.pid,
      downloadTimeMs: downloadTime
    };

    finalJSON._worker = { 
      source: "pipeline_complete", 
      redis: true,
      pid: process.pid,
      jobId: jobId
    };
    
    console.log(`✅ [PROCESS][${new Date().toISOString()}] -> Processamento REAL concluído com sucesso`);
    console.log(`📊 [PROCESS] LUFS: ${finalJSON.technicalData?.lufsIntegrated || 'N/A'} | Peak: ${finalJSON.technicalData?.truePeakDbtp || 'N/A'}dBTP | Score: ${finalJSON.score || 0}`);
    
    // ✅ GARANTIR QUE SUGGESTIONS NUNCA SEJA UNDEFINED
    if (!finalJSON.suggestions) {
      console.warn(`[AI-AUDIT][SAVE.before] ⚠️ finalJSON.suggestions estava undefined - inicializando como array vazio`);
      finalJSON.suggestions = [];
    }
    
    // ✅ LOGS DE AUDITORIA PRÉ-SALVAMENTO - SUGGESTIONS BASE
    console.log(`[AI-AUDIT][SAVE.before] has suggestions?`, Array.isArray(finalJSON.suggestions), "len:", finalJSON.suggestions?.length || 0);
    
    if (!finalJSON.suggestions || finalJSON.suggestions.length === 0) {
      console.error(`[AI-AUDIT][SAVE.before] ❌ CRÍTICO: finalJSON.suggestions está vazio ou undefined!`);
      console.error(`[AI-AUDIT][SAVE.before] finalJSON keys:`, Object.keys(finalJSON));
    } else {
      console.log(`[AI-AUDIT][SAVE.before] ✅ finalJSON.suggestions contém ${finalJSON.suggestions.length} itens`);
      console.log(`[AI-AUDIT][SAVE.before] Sample:`, finalJSON.suggestions[0]);
    }
    
    // 🤖 LOGS DE AUDITORIA PRÉ-SALVAMENTO - AI SUGGESTIONS (ULTRA V2)
    console.log(`[AI-AUDIT][SAVE.before] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[AI-AUDIT][SAVE.before] 🤖 AUDITORIA aiSuggestions`);
    console.log(`[AI-AUDIT][SAVE.before] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[AI-AUDIT][SAVE.before] has aiSuggestions?`, Array.isArray(finalJSON.aiSuggestions));
    console.log(`[AI-AUDIT][SAVE.before] aiSuggestions length:`, finalJSON.aiSuggestions?.length || 0);
    console.log(`[AI-AUDIT][SAVE.before] aiSuggestions type:`, typeof finalJSON.aiSuggestions);
    
    if (!finalJSON.aiSuggestions || finalJSON.aiSuggestions.length === 0) {
      console.error(`[AI-AUDIT][SAVE.before] ❌ CRÍTICO: finalJSON.aiSuggestions está vazio ou undefined!`);
      console.error(`[AI-AUDIT][SAVE.before] Mode:`, mode);
      console.error(`[AI-AUDIT][SAVE.before] ReferenceJobId:`, referenceJobId);
      console.error(`[AI-AUDIT][SAVE.before] ⚠️ ISSO CAUSARÁ AUSÊNCIA DE aiSuggestions NO FRONTEND!`);
    } else {
      console.log(`[AI-AUDIT][SAVE.before] ✅ finalJSON.aiSuggestions contém ${finalJSON.aiSuggestions.length} itens`);
      console.log(`[AI-AUDIT][SAVE.before] Sample aiSuggestion:`, {
        aiEnhanced: finalJSON.aiSuggestions[0]?.aiEnhanced,
        enrichmentStatus: finalJSON.aiSuggestions[0]?.enrichmentStatus,
        categoria: finalJSON.aiSuggestions[0]?.categoria,
        nivel: finalJSON.aiSuggestions[0]?.nivel,
        hasProblema: !!finalJSON.aiSuggestions[0]?.problema,
        hasSolucao: !!finalJSON.aiSuggestions[0]?.solucao
      });
    }
    console.log(`[AI-AUDIT][SAVE.before] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 🛡️ FIX: VALIDAR JSON ANTES DE MARCAR COMO COMPLETED
    const validation = validateCompleteJSON(finalJSON, mode, referenceJobId);
    
    if (!validation.valid) {
      console.error('[WORKER] ❌❌❌ JSON INCOMPLETO - AGUARDANDO MÓDULOS FALTANTES');
      console.error('[WORKER] Campos ausentes:', validation.missing);
      console.error('[WORKER] Status permanecerá como "processing"');
      console.error('[WORKER] Job NÃO será marcado como completed');
      
      // Salvar com status processing para frontend continuar aguardando
      await updateJobStatus(jobId, 'processing', finalJSON);
      
      // Limpar arquivo temporário
      if (localFilePath && fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`🗑️ [PROCESS][${new Date().toISOString()}] -> Arquivo temporário removido: ${localFilePath}`);
      }
      
      // Retornar erro para BullMQ tentar novamente
      throw new Error(`JSON incompleto: ${validation.missing.join(', ')}`);
    }
    
    console.log('[WORKER] ✅✅✅ JSON VALIDADO - MARCANDO COMO COMPLETED');
    
    // 🎯 AUDIT: LOG DE CONCLUSÃO
    console.log('✅ [AUDIT_COMPLETE] ═══════════════════════════════════════');
    console.log('✅ [AUDIT_COMPLETE] Job CONCLUÍDO com sucesso');
    console.log(`✅ [AUDIT_COMPLETE] Redis Job ID: ${job.id}`);
    console.log(`✅ [AUDIT_COMPLETE] PostgreSQL UUID: ${jobId}`);
    console.log(`✅ [AUDIT_COMPLETE] Status: completed`);
    console.log(`✅ [AUDIT_COMPLETE] Mode: ${mode}`);
    console.log(`✅ [AUDIT_COMPLETE] Reference Job ID: ${referenceJobId || 'nenhum'}`);
    console.log(`✅ [AUDIT_COMPLETE] Score: ${finalJSON.score || 0}`);
    console.log(`✅ [AUDIT_COMPLETE] LUFS: ${finalJSON.technicalData?.lufsIntegrated || 'N/A'} LUFS`);
    console.log(`✅ [AUDIT_COMPLETE] DR: ${finalJSON.technicalData?.dynamicRange || 'N/A'} dB`);
    console.log(`✅ [AUDIT_COMPLETE] True Peak: ${finalJSON.technicalData?.truePeakDbtp || 'N/A'} dBTP`);
    console.log(`✅ [AUDIT_COMPLETE] Suggestions: ${finalJSON.suggestions?.length || 0} items`);
    console.log(`✅ [AUDIT_COMPLETE] aiSuggestions: ${finalJSON.aiSuggestions?.length || 0} items`);
    console.log(`✅ [AUDIT_COMPLETE] Processing Time: ${totalMs}ms`);
    console.log(`✅ [AUDIT_COMPLETE] Timestamp: ${new Date().toISOString()}`);
    console.log('✅ [AUDIT_COMPLETE] ═══════════════════════════════════════');
    
    await updateJobStatus(jobId, 'completed', finalJSON);
    
    // Limpar arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log(`🗑️ [PROCESS][${new Date().toISOString()}] -> Arquivo temporário removido: ${localFilePath}`);
    }

    return finalJSON;

  } catch (error) {
    console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Erro no processamento:`, error.message);
    
    console.log("🔴 [AUDIT:GENRE-ERROR] Gênero chegou NU no pipeline!");
    console.log("🔴 [AUDIT:GENRE-ERROR] job.data ===>");
    console.dir(job.data, { depth: 10 });
    
    // 🎯 AUDIT: LOG DE ERRO
    console.error('❌ [AUDIT_ERROR] ═══════════════════════════════════════');
    console.error('❌ [AUDIT_ERROR] Job FALHOU durante processamento');
    console.error(`❌ [AUDIT_ERROR] Redis Job ID: ${job.id}`);
    console.error(`❌ [AUDIT_ERROR] PostgreSQL UUID: ${jobId}`);
    console.error(`❌ [AUDIT_ERROR] Mode: ${mode}`);
    console.error(`❌ [AUDIT_ERROR] Reference Job ID: ${referenceJobId || 'nenhum'}`);
    console.error(`❌ [AUDIT_ERROR] File Key: ${fileKey}`);
    console.error(`❌ [AUDIT_ERROR] Error Type: ${error.name || 'UnknownError'}`);
    console.error(`❌ [AUDIT_ERROR] Error Message: ${error.message}`);
    console.error(`❌ [AUDIT_ERROR] Timestamp: ${new Date().toISOString()}`);
    
    // Stack trace completo para diagnóstico
    if (error.stack) {
      console.error(`❌ [AUDIT_ERROR] Stack Trace:`);
      console.error(error.stack);
    }
    
    // Informações adicionais sobre o estado do job
    console.error(`❌ [AUDIT_ERROR] Job Attempt: ${job.attemptsMade + 1}/${job.opts?.attempts || 'N/A'}`);
    console.error(`❌ [AUDIT_ERROR] Local File Path: ${localFilePath || 'não baixado'}`);
    console.error(`❌ [AUDIT_ERROR] Reference Metrics Loaded: ${preloadedReferenceMetrics ? 'SIM' : 'NÃO'}`);
    console.error('❌ [AUDIT_ERROR] ═══════════════════════════════════════');
    
    // 🔥 RETORNO DE SEGURANÇA em caso de erro no pipeline
    const errorResult = {
      status: 'error',
      error: {
        message: error.message,
        type: 'worker_pipeline_error',
        phase: 'worker_redis_processing',
        timestamp: new Date().toISOString()
      },
      score: 0,
      classification: 'Erro Crítico',
      scoringMethod: 'worker_redis_error_fallback',
      metadata: {
        fileName: fileName || 'unknown',
        fileSize: 0,
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        processedAt: new Date().toISOString(),
        engineVersion: 'worker-redis-error',
        pipelinePhase: 'error'
      },
      technicalData: {},
      warnings: [`Worker Redis error: ${error.message}`],
      buildVersion: 'worker-redis-error',
      frontendCompatible: false,
      _worker: { 
        source: "pipeline_error", 
        error: true, 
        redis: true,
        pid: process.pid,
        jobId: jobId
      }
    };
    
    try {
      await updateJobStatus(jobId, 'failed', errorResult);
    } catch (dbError) {
      console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Falha ao atualizar status do job para failed:`, dbError.message);
    }
    
    // Limpar arquivo temporário em caso de erro
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        console.log(`🗑️ [PROCESS][${new Date().toISOString()}] -> Arquivo temporário removido após erro: ${localFilePath}`);
      } catch (cleanupError) {
        console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Erro ao limpar arquivo temporário:`, cleanupError.message);
      }
    }
    
    throw error;
  }
}

// ===============================================
// 🚀 INICIALIZAÇÃO E SHUTDOWN GRACEFUL
// ===============================================

// 🚀 INICIAR WORKER
console.log('🚀 [WORKER] Iniciando aplicação Worker Redis...');
initializeWorker();

// 🔄 GRACEFUL SHUTDOWN
process.on('SIGINT', async () => {
  console.log(`📥 [SIGNAL][${new Date().toISOString()}] -> Received SIGINT`);
  await gracefulShutdown('SIGINT');
});

process.on('SIGTERM', async () => {
  console.log(`📥 [SIGNAL][${new Date().toISOString()}] -> Received SIGTERM`);
  await gracefulShutdown('SIGTERM');
});

async function gracefulShutdown(signal) {
  console.log(`📥 [SHUTDOWN][${new Date().toISOString()}] -> Iniciando shutdown graceful - Motivo: ${signal}`);
  
  try {
    if (worker) {
      console.log(`🔄 [SHUTDOWN][${new Date().toISOString()}] -> Fechando Worker...`);
      await worker.close();
      console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Worker fechado com sucesso`);
    }
    
    if (redisConnection) {
      console.log(`🔄 [SHUTDOWN][${new Date().toISOString()}] -> Fechando conexão Redis...`);
      await redisConnection.quit();
      console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Conexão Redis fechada`);
    }
    
    console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Shutdown graceful concluído`);
    process.exit(0);
    
  } catch (error) {
    console.error(`💥 [SHUTDOWN][${new Date().toISOString()}] -> Erro durante shutdown:`, error.message);
    process.exit(1);
  }
}