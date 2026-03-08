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
import { enrichSuggestionsWithAI } from './lib/ai/suggestion-enricher.js';
import { referenceSuggestionEngine } from './lib/audio/features/reference-suggestion-engine.js';
import { logMemoryDelta, clearMemoryDelta } from './lib/memory-monitor.js';


// ---------- Importar pipeline completo para análise REAL ----------
let processAudioComplete = null;
let runPipeline = null;

try {
  console.log(`[WORKER-REDIS][${new Date().toISOString()}] -> 📦 Carregando pipeline completo...`);
  const imported = await import("./api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  runPipeline = imported.runPipeline;
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
console.log('🚀 [WORKER]     INICIANDO WORKER REDIS ROBUSTO     ');
console.log('🚀 [WORKER] ═══════════════════════════════════════');
console.log(`📋 [WORKER-INIT] PID: ${process.pid}`);
console.log(`🌍 [WORKER-INIT] ENV: ${process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'development'}`);
console.log(`⏰ [WORKER-INIT] Timestamp: ${new Date().toISOString()}\n`);

// 🔒 VERIFICAÇÃO CRÍTICA: Environment Variables
console.log('🔍 [WORKER] ═══════════════════════════════════════');
console.log('🔍 [WORKER]    VALIDAÇÃO DE VARIÁVEIS CRÍTICAS    ');
console.log('🔍 [WORKER] ═══════════════════════════════════════\n');

const requiredVars = ['REDIS_URL', 'DATABASE_URL', 'B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET_NAME'];
const missingVars = [];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ [WORKER] ${varName} não configurada`);
    missingVars.push(varName);
  } else {
    const value = process.env[varName];
    const masked = value.substring(0, 25) + '...';
    console.log(`✅ [WORKER] ${varName}: ${masked}`);
  }
}

if (missingVars.length > 0) {
  console.error('\n💥 [WORKER] ═══════════════════════════════════════');
  console.error(`💥 [WORKER]   ERRO CRÍTICO: ${missingVars.length} Variáveis Ausentes   `);
  console.error('💥 [WORKER] ═══════════════════════════════════════');
  console.error('💡 [WORKER] Configure no Railway Dashboard → Variables');
  console.error('📋 [WORKER] Variáveis faltando:', missingVars.join(', '));
  console.error('📋 [WORKER] Ambiente:', process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'unknown');
  console.error('💥 [WORKER] Worker NÃO será iniciado\n');
  process.exit(1);
}

console.log('✅ [WORKER] Todas as variáveis obrigatórias configuradas\n');

// 🔧 DETECÇÃO AUTOMÁTICA DE TLS BASEADA NA URL
const isTLS = process.env.REDIS_URL.startsWith('rediss://');
console.log(`🔐 [WORKER] TLS detectado: ${isTLS ? 'SIM' : 'NÃO'}`);

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
    
    // 🔒 Mascarar credenciais do Redis para logs seguros
    const redisUrl = process.env.REDIS_URL || '';
    const maskedRedisUrl = redisUrl.replace(/:\/\/[^@]*@/, '://***@');
    
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
      setTimeout(async () => {
        console.log('🔄 [WORKER-ERROR] Reiniciando Worker...');
        // 🧹 MEMORY FIX: fechar worker antigo antes de criar novo para evitar acúmulo de listeners
        if (worker) {
          try { await worker.close(); } catch (_) {}
          worker = null;
        }
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
    
    // ============================================================================
    // 🚨 CONCORRÊNCIA SEGURA - ANALYSIS WORKER (PATCH 2026-02-23)
    // ============================================================================
    // Railway típico: 2-4 vCPU
    // Analysis pipeline: 2-3 processos FFmpeg por job
    // Fórmula: (FFmpeg/job) × concurrency ≤ vCPU × 2 (margem)
    // Exemplo: (2 FFmpeg) × (2 conc) = 4 processos ≤ 4 vCPU × 2 = 8 → OK
    // ============================================================================

    const DEFAULT_SAFE_CONCURRENCY = 2; // Conservador para Railway 4 vCPU
    const MIN_CONCURRENCY = 1;
    const MAX_SAFE_CONCURRENCY = 6;

    const concurrency = (() => {
      const envValue = Number(process.env.ANALYSIS_CONCURRENCY);
      
      if (!envValue || isNaN(envValue)) {
        console.log(`[WORKER_INIT] ℹ️  ANALYSIS_CONCURRENCY não definida - usando padrão seguro: ${DEFAULT_SAFE_CONCURRENCY}`);
        return DEFAULT_SAFE_CONCURRENCY;
      }
      
      if (envValue < MIN_CONCURRENCY) {
        console.warn(`[WORKER_INIT] ⚠️  ANALYSIS_CONCURRENCY inválido (${envValue}) - usando mínimo: ${MIN_CONCURRENCY}`);
        return MIN_CONCURRENCY;
      }
      
      if (envValue > MAX_SAFE_CONCURRENCY) {
        console.error(`[WORKER_INIT] ❌ ANALYSIS_CONCURRENCY=${envValue} PERIGOSO para Railway!`);
        console.error(`   Analysis pipeline usa 2-3 processos FFmpeg por job.`);
        console.error(`   ${envValue} jobs × 2 FFmpeg = ${envValue * 2} processos simultâneos.`);
        console.error(`   Railway 4 vCPU suporta máximo ${MAX_SAFE_CONCURRENCY} jobs (${MAX_SAFE_CONCURRENCY * 2}-${MAX_SAFE_CONCURRENCY * 3} FFmpeg).`);
        console.error(`   Recomendação: ANALYSIS_CONCURRENCY=2-4`);
        console.error(`   Forçando concurrency para máximo seguro: ${MAX_SAFE_CONCURRENCY}`);
        return MAX_SAFE_CONCURRENCY;
      }
      
      console.log(`[WORKER_INIT] ✅ ANALYSIS_CONCURRENCY=${envValue} (via env)`);
      return envValue;
    })();

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 Analysis Worker Configuration:`);
    console.log(`   Concurrency:  ${concurrency}`);
    console.log(`   FFmpeg/job:   2-3 processos`);
    console.log(`   Max simult:   ${concurrency * 3} processos FFmpeg (worst-case)`);
    console.log(`   Recomendado:  Railway 2-4 vCPU`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 🎯 CRIAR WORKER COM CONEXÃO ESTABELECIDA
    // ⚙️ PARTE 2: Worker com configuração otimizada e lockDuration aumentado
    worker = new Worker('audio-analyzer', audioProcessor, {
      connection: redisConnection,
      concurrency,
      lockDuration: 300000,         // 🧩 MEMORY FIX: 5min de lock (pipeline leva 30-120s; 1min causava reprocessamento duplo)
      stalledInterval: 15000,           // ✅ PARTE 2: Desabilitado (evita travamentos falso-positivos)
      settings: {
        maxStalledCount: 1,         // 🧩 MEMORY FIX: 1 reprocessamento máximo (2 causava duplicação)
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
  
  // 🎯 Detectar referenceStage explícito
  const referenceStage = finalJSON.referenceStage || null;
  
  console.log('[VALIDATION] Validando:', {
    mode,
    referenceStage,
    referenceJobId: referenceJobId ? referenceJobId.substring(0, 8) : 'null'
  });
  
  // ══════════════════════════════════════════════════════════
  // REFERENCE MODE: Validação por stage
  // ══════════════════════════════════════════════════════════
  if (mode === 'reference') {
    if (referenceStage === 'base') {
      // BASE: NÃO exigir suggestions/aiSuggestions/referenceComparison
      console.log('[VALIDATION] Reference BASE - validação mínima');
      
      // Validar apenas métricas técnicas
      if (!finalJSON.technicalData || typeof finalJSON.technicalData !== 'object') {
        missing.push('technicalData');
      }
      if (typeof finalJSON.score !== 'number') {
        missing.push('score');
      }
      if (!finalJSON.metrics) {
        missing.push('metrics');
      }
      
      // Verificar requiresSecondTrack
      if (!finalJSON.requiresSecondTrack) {
        console.warn('[VALIDATION] ⚠️ Base sem requiresSecondTrack - adicionando...');
        finalJSON.requiresSecondTrack = true;
      }
      
    } else if (referenceStage === 'compare') {
      // COMPARE: EXIGIR referenceComparison + suggestions (PODE ser array vazio agora que temos fallback)
      console.log('[VALIDATION] Reference COMPARE - validação completa');
      
      if (!finalJSON.technicalData) missing.push('technicalData');
      if (typeof finalJSON.score !== 'number') missing.push('score');
      if (!finalJSON.metrics) missing.push('metrics');
      
      // Obrigatório: referenceComparison
      if (!finalJSON.referenceComparison || typeof finalJSON.referenceComparison !== 'object') {
        missing.push('referenceComparison');
        console.error('[VALIDATION] ❌ referenceComparison obrigatório para compare');
      }
      
      // ✅ CORREÇÃO: aiSuggestions deve EXISTIR como array, mas pode estar vazio se fallback foi gerado
      // O fallback no reference-suggestion-engine.js garante que nunca estará realmente vazio
      if (!Array.isArray(finalJSON.aiSuggestions)) {
        missing.push('aiSuggestions (deve ser array)');
        console.error('[VALIDATION] ❌ aiSuggestions deve ser array para compare');
      } else if (finalJSON.aiSuggestions.length === 0) {
        // Warn mas NÃO bloquear - o fallback deveria ter preenchido, mas se não preencheu, ainda salvar
        console.warn('[VALIDATION] ⚠️ aiSuggestions vazio - verificar se fallback foi executado');
      } else {
        console.log('[VALIDATION] ✅ aiSuggestions presente com', finalJSON.aiSuggestions.length, 'itens');
      }
      
    } else {
      console.error('[VALIDATION] ❌ Reference sem referenceStage válido:', referenceStage);
      missing.push('referenceStage (deve ser "base" ou "compare")');
    }
  }
  
  // ══════════════════════════════════════════════════════════
  // GENRE MODE: Validação tradicional (INALTERADA)
  // ══════════════════════════════════════════════════════════
  else if (mode === 'genre') {
    console.log('[VALIDATION] Genre mode - validação tradicional');
    
    if (!finalJSON.technicalData) missing.push('technicalData');
    if (typeof finalJSON.score !== 'number') missing.push('score');
    if (!finalJSON.spectralBands) missing.push('spectralBands');
    if (!finalJSON.metrics) missing.push('metrics');
    if (!finalJSON.scoring) missing.push('scoring');
    
    // Genre sempre exige suggestions
    if (!Array.isArray(finalJSON.suggestions) || finalJSON.suggestions.length === 0) {
      missing.push('suggestions');
    }
    if (!Array.isArray(finalJSON.aiSuggestions) || finalJSON.aiSuggestions.length === 0) {
      missing.push('aiSuggestions');
    }
  }
  
  const isValid = missing.length === 0;
  
  if (isValid) {
    console.log('[VALIDATION] ✅ JSON completo - pode marcar COMPLETED');
  } else {
    console.error('[VALIDATION] ❌ JSON incompleto:', missing.join(', '));
  }
  
  return { valid: isValid, missing };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * 🔐 SANITIZAR SUGESTÕES EM MODO REDUCED
 * ═══════════════════════════════════════════════════════════════════
 * Remove texto sensível mas mantém estrutura compatível com o frontend.
 * 
 * OBJETIVO: Garantir que no modo reduced, NENHUM texto real de sugestões
 * chegue ao browser via DevTools/Network tab.
 * 
 * PRESERVA: Arrays, estrutura, campos não sensíveis (categoria, metricKey)
 * REMOVE: Todos os campos textuais (problema, solucao, causa, plugin, etc)
 * ═══════════════════════════════════════════════════════════════════
 */
function sanitizeSuggestionsForReduced(analysis) {
  // ✅ VALIDAÇÃO: Só sanitizar se realmente for modo reduced
  const isReduced = analysis?.isReduced === true || analysis?.analysisMode === 'reduced';
  
  if (!isReduced) {
    console.log('[SANITIZE] ⏭️ Modo FULL - Sem sanitização necessária');
    return analysis;
  }
  
  console.log('[SANITIZE] 🔐 Modo REDUCED detectado - Iniciando sanitização de texto');
  
  // 🧹 PLACEHOLDER SEGURO: null (ou mensagem genérica)
  const placeholder = null;
  
  // 📋 FUNÇÃO SANITIZADORA DE ITEM INDIVIDUAL
  const mapItem = (s = {}) => ({
    ...s,
    // ✅ PRESERVAR: Campos não sensíveis úteis para UI
    categoria: s.categoria ?? s.category ?? null,
    metricKey: s.metricKey ?? s.metric ?? null,
    severity: s.severity ?? null,
    type: s.type ?? null,
    
    // 🔐 REMOVER: Todo texto sensível
    problema: placeholder,
    causa: placeholder,
    solucao: placeholder,
    plugin: placeholder,
    dica: placeholder,
    texto: placeholder,
    content: placeholder,
    details: placeholder,
    raw: placeholder,
    description: placeholder,
    problema_completo: placeholder,
    causa_raiz: placeholder,
    solucao_detalhada: placeholder,
    recommendation: placeholder,
    explanation: placeholder,
  });
  
  // 🧹 SANITIZAR ARRAYS (mantém estrutura, remove texto)
  const sanitizedSuggestions = Array.isArray(analysis.suggestions) 
    ? analysis.suggestions.map(mapItem) 
    : [];
    
  const sanitizedAiSuggestions = Array.isArray(analysis.aiSuggestions) 
    ? analysis.aiSuggestions.map(mapItem) 
    : [];
  
  console.log('[SANITIZE] ✅ Sanitização completa:', {
    mode: analysis.analysisMode || 'reduced',
    originalSuggestions: analysis.suggestions?.length || 0,
    sanitizedSuggestions: sanitizedSuggestions.length,
    originalAiSuggestions: analysis.aiSuggestions?.length || 0,
    sanitizedAiSuggestions: sanitizedAiSuggestions.length,
  });
  
  return {
    ...analysis,
    suggestions: sanitizedSuggestions,
    aiSuggestions: sanitizedAiSuggestions,
  };
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
      // 🔐 SANITIZAÇÃO ANTES DE SALVAR (BACKEND DEFENSE)
      // ────────────────────────────────────────────────────────────────
      // Se modo reduced: remover texto sensível ANTES de res.json()
      results = sanitizeSuggestionsForReduced(results);
      // ────────────────────────────────────────────────────────────────
      
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
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Keys:', Object.keys(results).join(', '));
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Score:', results?.score);
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] Genre no results:', results?.metadata?.genre);
      console.log('🟣 [AUDIT:RESULT-BEFORE-SAVE] results.genre:', results?.genre);
      
      console.log("\n================ AUDITORIA: ANTES DO SALVAMENTO (REDIS) ==============");
      console.log("[ANTES-SAVE] ⏰ Timestamp:", new Date().toISOString());
      console.log("[ANTES-SAVE] 📊 FINAL JSON QUE SERÁ SALVO NO POSTGRES:");
      console.log("[ANTES-SAVE] results.genre:", results.genre);
      console.log("[ANTES-SAVE] results.mode:", results.mode);
      console.log("[ANTES-SAVE] results.data?.genre:", results.data?.genre);
      console.log("[ANTES-SAVE] results.data?.genreTargets:", JSON.stringify(results.data?.genreTargets, null, 2));
      console.log("[ANTES-SAVE] results.data?.metrics:", JSON.stringify(results.data?.metrics, null, 2));
      console.log("[ANTES-SAVE] results.problemsAnalysis?.suggestions (primeiros 3):", JSON.stringify(results.problemsAnalysis?.suggestions?.slice(0, 3), null, 2));
      console.log("[ANTES-SAVE] results.problemsAnalysis?.metadata?.usingConsolidatedData:", results.problemsAnalysis?.metadata?.usingConsolidatedData);
      console.log("[ANTES-SAVE] results.aiSuggestions (primeiros 2):", JSON.stringify(results.aiSuggestions?.slice(0, 2), null, 2));
      console.log("[ANTES-SAVE] 🎯 Verificação de Consistência:");
      console.log("  - Targets no data:", Object.keys(results.data?.genreTargets || {}));
      console.log("  - Número de sugestões problemsAnalysis:", results.problemsAnalysis?.suggestions?.length || 0);
      console.log("  - Número de aiSuggestions:", results.aiSuggestions?.length || 0);
      console.log("======================================================================\n");
      
      console.log('[GENRE-FLOW][S4_BEFORE_SAVE]', {
        jobId,
        hasSuggestions: !!results?.suggestions,
        hasAiSuggestions: !!results?.aiSuggestions,
        firstBaseSuggestion: results?.suggestions?.[0] || null,
        firstAiSuggestion: results?.aiSuggestions?.[0] || null
      });
      
      // ────────────────────────────────────────
      // STEP 3 — LOGAR AS SUGESTÕES NA HORA DE SALVAR EM results.suggestions
      // ────────────────────────────────────────
      console.log("[TRACE_S3_BEFORE_SAVE]", {
        hasSuggestions: Array.isArray(results?.suggestions),
        suggestionCount: results?.suggestions?.length,
        firstSuggestion: results?.suggestions?.[0],
        technical: results?.suggestions?.[0],
        targetValue: results?.suggestions?.[0]?.targetValue,
        currentValue: results?.suggestions?.[0]?.currentValue,
        delta: results?.suggestions?.[0]?.delta,
        deltaNum: results?.suggestions?.[0]?.deltaNum
      });
      
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

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 REFERENCE MODE: FUNÇÕES ISOLADAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 🎯 PROCESSAR REFERENCE BASE (1ª MÚSICA)
 * 
 * CONTRATO:
 * - Não usa genreTargets
 * - Não chama Suggestion Engine
 * - Retorna requiresSecondTrack: true
 * - Salva como COMPLETED com métricas base
 */
async function processReferenceBase(job) {
  const { jobId, fileKey, fileName } = job.data;
  
  console.log('');
  console.log('🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵');
  console.log('🔵 [REFERENCE-BASE] ⚡⚡⚡ FUNÇÃO CHAMADA! ⚡⚡⚡');
  console.log('🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵');
  console.log('[REFERENCE-BASE] ═══════════════════════════════════════');
  console.log('[REFERENCE-BASE] Processando 1ª música (BASE)');
  console.log('[REFERENCE-BASE] Job ID:', jobId);
  console.log('[REFERENCE-BASE] File:', fileName);
  console.log('[REFERENCE-BASE] ═══════════════════════════════════════');

  let localFilePath = null;

  try {
    // Atualizar status
    console.log('[REFERENCE-BASE] 🔄 Definindo status como PROCESSING...');
    await updateJobStatus(jobId, 'processing');
    console.log('[REFERENCE-BASE] ✅ Status PROCESSING salvo com sucesso!');

    // Download do arquivo
    console.log('[REFERENCE-BASE] Baixando arquivo...');
    localFilePath = await downloadFileFromBucket(fileKey);

    // Ler buffer
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log('[REFERENCE-BASE] Arquivo lido:', fileBuffer.length, 'bytes');
    logMemoryDelta('worker', 'ref-base-after-readFile', jobId);

    // Processar via pipeline (SEM genre, SEM suggestion engine)
    console.log('[REFERENCE-BASE] Iniciando pipeline...');
    const t0 = Date.now();
    
    console.log('[REFERENCE-BASE] 🔍 Parâmetros para processAudioComplete:', {
      fileName: fileName || 'unknown.wav',
      fileBufferSize: fileBuffer.length,
      options: {
        jobId,
        mode: 'reference',
        referenceStage: 'base'
      }
    });
    
    const finalJSON = await processAudioComplete(fileBuffer, fileName || 'unknown.wav', {
      jobId,
      mode: 'reference',
      referenceStage: 'base',
      // SEM genre, SEM genreTargets, SEM planContext
    });

    const totalMs = Date.now() - t0;
    console.log('[REFERENCE-BASE] ✅ Pipeline concluído em', totalMs, 'ms');
    console.log('[REFERENCE-BASE] 🔍 Pipeline retornou:', {
      hasTechnicalData: !!finalJSON.technicalData,
      hasScore: finalJSON.score !== undefined,
      hasMetrics: !!finalJSON.metrics,
      keys: Object.keys(finalJSON || {}).slice(0, 15)
    });

    // Adicionar campos específicos de reference base
    finalJSON.success = true; // ✅ Garantir flag de sucesso
    finalJSON.status = 'completed'; // ✅ Status explícito
    finalJSON.mode = 'reference';
    finalJSON.referenceStage = 'base';
    finalJSON.requiresSecondTrack = true;
    finalJSON.referenceJobId = jobId; // Este job é a base para próxima comparação
    finalJSON.jobId = jobId; // ✅ jobId explícito para referência
    
    // 🛡️ CORREÇÃO CRÍTICA: Garantir analysisMode/isReduced para evitar race condition no frontend
    // Análise de referência é sempre "full" - não tem conceito de reduced mode
    finalJSON.analysisMode = finalJSON.analysisMode || 'full';
    finalJSON.isReduced = finalJSON.isReduced ?? false;
    
    console.log('[REFERENCE-BASE] 📊 analysisMode:', finalJSON.analysisMode, '| isReduced:', finalJSON.isReduced);
    
    // ✅ GARANTIR campos obrigatórios para compatibilidade com polling/render
    finalJSON.aiSuggestions = [];
    finalJSON.suggestions = [];
    finalJSON.referenceComparison = null; // Null no base (só existe no compare)
    
    // ✅ ADICIONAR baseMetrics explicitamente (facilita frontend)
    finalJSON.baseMetrics = {
      lufsIntegrated: finalJSON.technicalData?.lufsIntegrated,
      truePeakDbtp: finalJSON.technicalData?.truePeakDbtp,
      dynamicRange: finalJSON.technicalData?.dynamicRange,
      loudnessRange: finalJSON.technicalData?.loudnessRange,
      stereoWidth: finalJSON.metrics?.stereoImaging?.width,
      spectralBalance: finalJSON.metrics?.spectralBalance
    };

    // Performance
    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "reference-base",
      workerId: process.pid
    };

    finalJSON._worker = {
      source: "reference-base-pipeline",
      redis: true,
      pid: process.pid,
      jobId
    };

    console.log('[REFERENCE-BASE] ✅ Análise base concluída');
    console.log('[REFERENCE-BASE] LUFS:', finalJSON.technicalData?.lufsIntegrated || 'N/A');
    console.log('[REFERENCE-BASE] DR:', finalJSON.technicalData?.dynamicRange || 'N/A');
    console.log('[REFERENCE-BASE] TP:', finalJSON.technicalData?.truePeakDbtp || 'N/A');
    console.log('[REFERENCE-BASE] requiresSecondTrack:', finalJSON.requiresSecondTrack);
    console.log('[REFERENCE-BASE] referenceJobId:', finalJSON.referenceJobId);
    console.log('[REFERENCE-BASE] referenceStage:', finalJSON.referenceStage);

    // Salvar como COMPLETED com fallback Redis
    console.log('[REFERENCE-BASE] 💾 Salvando no PostgreSQL como COMPLETED...');
    console.log('[REFERENCE-BASE] 🔍 Dados sendo salvos:', {
      mode: finalJSON.mode,
      referenceStage: finalJSON.referenceStage,
      requiresSecondTrack: finalJSON.requiresSecondTrack,
      referenceJobId: finalJSON.referenceJobId,
      hasAiSuggestions: Array.isArray(finalJSON.aiSuggestions),
      aiSuggestionsLength: finalJSON.aiSuggestions?.length || 0,
      hasSuggestions: Array.isArray(finalJSON.suggestions),
      suggestionsLength: finalJSON.suggestions?.length || 0,
      score: finalJSON.score
    });
    
    try {
      await updateJobStatus(jobId, 'completed', finalJSON);
      console.log('[REFERENCE-BASE] ✅ Status COMPLETED salvo no banco com sucesso!');
    } catch (dbError) {
      console.error('[DB-SAVE-ERROR][REFERENCE-BASE] ❌ Falha ao salvar no Postgres:', dbError.message);
      console.warn('[DB-SAVE-ERROR][REFERENCE-BASE] 🔄 Tentando fallback: salvar no Redis...');
      
      try {
        // Fallback: salvar pelo menos no Redis para API poder servir
        const redisKey = `job:${jobId}:results`;
        await redisClient.set(redisKey, JSON.stringify({
          ...finalJSON,
          status: 'completed',
          _fallback: true,
          _savedAt: new Date().toISOString()
        }), 'EX', 3600); // 1 hora de TTL
        
        console.warn('[DB-SAVE-ERROR][REFERENCE-BASE] ✅ Salvo no Redis como fallback');
        console.warn('[DB-SAVE-ERROR][REFERENCE-BASE] ⚠️ ATENÇÃO: PostgreSQL pode estar com status desatualizado!');
      } catch (redisError) {
        console.error('[DB-SAVE-ERROR][REFERENCE-BASE] ❌ Falha no fallback Redis também:', redisError.message);
        // Continuar - pelo menos o processamento não falhou
      }
    }

    // Limpar arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    logMemoryDelta('worker', 'ref-base-end-success', jobId);
    clearMemoryDelta(jobId);
    return finalJSON;

  } catch (error) {
    console.error('[REFERENCE-BASE] ❌ Erro:', error.message);

    // Limpar arquivo temporário em caso de erro
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    logMemoryDelta('worker', 'ref-base-end-error', jobId);
    clearMemoryDelta(jobId);

    await updateJobStatus(jobId, 'failed', {
      error: error.message,
      mode: 'reference',
      referenceStage: 'base'
    });

    throw error;
  }
}

/**
 * 🎯 PROCESSAR REFERENCE COMPARE (2ª MÚSICA)
 * 
 * CONTRATO:
 * - Carrega métricas da base usando referenceJobId
 * - Calcula referenceComparison (deltas)
 * - Chama referenceSuggestionEngine para gerar sugestões comparativas
 * - Retorna requiresSecondTrack: false
 * - Salva como COMPLETED com comparação
 */
async function processReferenceCompare(job) {
  const { jobId, fileKey, fileName, referenceJobId } = job.data;

  console.log('[REFERENCE-COMPARE] ═══════════════════════════════════════');
  console.log('[REFERENCE-COMPARE] Processando 2ª música (COMPARE)');
  console.log('[REFERENCE-COMPARE] Job ID:', jobId);
  console.log('[REFERENCE-COMPARE] Reference Job ID:', referenceJobId);
  console.log('[REFERENCE-COMPARE] File:', fileName);
  console.log('[REFERENCE-COMPARE] ═══════════════════════════════════════');

  let localFilePath = null;

  try {
    // ETAPA 1: Carregar métricas da base
    console.log('[REFERENCE-COMPARE] Carregando métricas base...');
    
    const refResult = await pool.query(
      'SELECT id, status, results FROM jobs WHERE id = $1',
      [referenceJobId]
    );

    if (refResult.rows.length === 0) {
      throw new Error(`Job de referência ${referenceJobId} não encontrado`);
    }

    const refJob = refResult.rows[0];

    if (refJob.status !== 'completed') {
      throw new Error(`Job de referência está com status '${refJob.status}' (esperado: completed)`);
    }

    if (!refJob.results) {
      throw new Error('Job de referência não possui resultados');
    }

    const baseMetrics = refJob.results;
    console.log('[REFERENCE-COMPARE] ✅ Métricas base carregadas');
    console.log('[REFERENCE-COMPARE] Base LUFS:', baseMetrics.technicalData?.lufsIntegrated || 'N/A');

    // ETAPA 2: Atualizar status e baixar arquivo
    await updateJobStatus(jobId, 'processing');

    console.log('[REFERENCE-COMPARE] Baixando arquivo...');
    localFilePath = await downloadFileFromBucket(fileKey);

    // ETAPA 3: Ler buffer e processar
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log('[REFERENCE-COMPARE] Arquivo lido:', fileBuffer.length, 'bytes');
    logMemoryDelta('worker', 'ref-compare-after-readFile', jobId);

    console.log('[REFERENCE-COMPARE] Iniciando pipeline...');
    const t0 = Date.now();

    const finalJSON = await processAudioComplete(fileBuffer, fileName || 'unknown.wav', {
      jobId,
      mode: 'reference',
      referenceStage: 'compare',
      referenceJobId,
      preloadedReferenceMetrics: baseMetrics
    });

    const totalMs = Date.now() - t0;
    console.log('[REFERENCE-COMPARE] Pipeline concluído em', totalMs, 'ms');

    // ETAPA 4: Calcular referenceComparison (deltas)
    console.log('[REFERENCE-COMPARE] Calculando deltas...');

    const baseTech = baseMetrics.technicalData || {};
    const compareTech = finalJSON.technicalData || {};

    const referenceComparison = {
      base: {
        lufsIntegrated: baseTech.lufsIntegrated,
        truePeakDbtp: baseTech.truePeakDbtp,
        dynamicRange: baseTech.dynamicRange,
        loudnessRange: baseTech.loudnessRange,
        fileName: baseMetrics.metadata?.fileName
      },
      current: {
        lufsIntegrated: compareTech.lufsIntegrated,
        truePeakDbtp: compareTech.truePeakDbtp,
        dynamicRange: compareTech.dynamicRange,
        loudnessRange: compareTech.loudnessRange,
        fileName: finalJSON.metadata?.fileName
      },
      deltas: {
        lufsIntegrated: compareTech.lufsIntegrated - baseTech.lufsIntegrated,
        truePeakDbtp: compareTech.truePeakDbtp - baseTech.truePeakDbtp,
        dynamicRange: compareTech.dynamicRange - baseTech.dynamicRange,
        loudnessRange: (compareTech.loudnessRange || 0) - (baseTech.loudnessRange || 0)
      }
    };

    finalJSON.referenceComparison = referenceComparison;

    console.log('[REFERENCE-COMPARE] Deltas:', {
      LUFS: referenceComparison.deltas.lufsIntegrated.toFixed(2),
      TP: referenceComparison.deltas.truePeakDbtp.toFixed(2),
      DR: referenceComparison.deltas.dynamicRange.toFixed(2)
    });

    // ETAPA 5: Gerar sugestões comparativas via reference engine
    console.log('[REFERENCE-COMPARE] Gerando sugestões comparativas...');

    const comparativeSuggestions = referenceSuggestionEngine(baseMetrics, finalJSON);
    
    // ✅ GARANTIA: Sempre retornar arrays (mesmo que vazios)
    finalJSON.aiSuggestions = Array.isArray(comparativeSuggestions) ? comparativeSuggestions : [];
    finalJSON.suggestions = Array.isArray(comparativeSuggestions) ? comparativeSuggestions : []; // Compatibilidade

    console.log('[REFERENCE-COMPARE] ✅ Geradas', finalJSON.aiSuggestions.length, 'sugestões');
    
    // 🛡️ FALLBACK SECUNDÁRIO: Se engine retornou vazio (não deveria mais acontecer), criar sugestão mínima
    if (finalJSON.aiSuggestions.length === 0) {
      console.warn('[REFERENCE-COMPARE] ⚠️ Engine retornou vazio - aplicando fallback secundário');
      
      const fallbackSuggestion = {
        categoria: 'ReferenceAnalysis',
        nivel: 'info',
        problema: 'Comparação A/B concluída',
        solucao: 'Revise as diferenças na tabela de comparação e ajuste conforme necessário.',
        detalhes: {
          deltas: referenceComparison.deltas,
          status: 'fallback-secundario',
          note: 'Músicas com características muito similares'
        },
        aiEnhanced: false,
        enrichmentStatus: 'worker-fallback'
      };
      
      finalJSON.aiSuggestions.push(fallbackSuggestion);
      finalJSON.suggestions.push(fallbackSuggestion);
      
      console.log('[REFERENCE-COMPARE] ✅ Fallback secundário aplicado:', finalJSON.aiSuggestions.length, 'sugestões');
    }

    // ETAPA 6: Adicionar campos específicos
    finalJSON.success = true; // ✅ Garantir flag de sucesso
    finalJSON.status = 'completed'; // ✅ Status explícito
    finalJSON.mode = 'reference';
    finalJSON.referenceStage = 'compare';
    finalJSON.referenceJobId = referenceJobId;
    finalJSON.jobId = jobId; // ✅ jobId explícito
    finalJSON.requiresSecondTrack = false; // Fluxo completo
    
    // 🛡️ CORREÇÃO CRÍTICA: Garantir analysisMode/isReduced para evitar race condition no frontend
    // Análise de referência é sempre "full" - não tem conceito de reduced mode
    finalJSON.analysisMode = finalJSON.analysisMode || 'full';
    finalJSON.isReduced = finalJSON.isReduced ?? false;
    
    console.log('[REFERENCE-COMPARE] 📊 analysisMode:', finalJSON.analysisMode, '| isReduced:', finalJSON.isReduced);
    
    // ✅ ADICIONAR baseMetrics explicitamente (facilita frontend)
    finalJSON.baseMetrics = {
      lufsIntegrated: baseTech.lufsIntegrated,
      truePeakDbtp: baseTech.truePeakDbtp,
      dynamicRange: baseTech.dynamicRange,
      loudnessRange: baseTech.loudnessRange,
      stereoWidth: baseMetrics.metrics?.stereoImaging?.width,
      spectralBalance: baseMetrics.metrics?.spectralBalance,
      fileName: baseMetrics.metadata?.fileName
    };

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "reference-compare",
      workerId: process.pid
    };

    finalJSON._worker = {
      source: "reference-compare-pipeline",
      redis: true,
      pid: process.pid,
      jobId
    };

    console.log('[REFERENCE-COMPARE] ✅ Comparação concluída');
    console.log('[REFERENCE-COMPARE] Compare LUFS:', compareTech.lufsIntegrated || 'N/A');
    console.log('[REFERENCE-COMPARE] Delta LUFS:', referenceComparison.deltas.lufsIntegrated.toFixed(2));

    // ETAPA 7: Salvar como COMPLETED
    await updateJobStatus(jobId, 'completed', finalJSON);

    // Limpar arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    logMemoryDelta('worker', 'ref-compare-end-success', jobId);
    clearMemoryDelta(jobId);
    return finalJSON;

  } catch (error) {
    console.error('[REFERENCE-COMPARE] ❌ Erro:', error.message);

    // Limpar arquivo temporário em caso de erro
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    logMemoryDelta('worker', 'ref-compare-end-error', jobId);
    clearMemoryDelta(jobId);

    await updateJobStatus(jobId, 'failed', {
      error: error.message,
      mode: 'reference',
      referenceStage: 'compare',
      referenceJobId
    });

    throw error;
  }
}

/**
 * 🎵 AUDIO PROCESSOR PRINCIPAL - ANÁLISE REAL
 */
async function audioProcessor(job) {
  // 🔑 ESTRUTURA ATUALIZADA: suporte para jobId UUID + externalId para logs + referenceJobId + referenceStage
  const {
    jobId,
    externalId,
    fileKey,
    mode,
    fileName,
    referenceJobId,
    referenceStage,
    genre,
    genreTargets,
    soundDestination = 'pista',  // 🆕 STREAMING MODE: 'pista' | 'streaming'
  } = job.data;
  
  // 🆕 STREAMING MODE: Validar e logar soundDestination
  const validSoundDestination = ['pista', 'streaming'].includes(soundDestination) ? soundDestination : 'pista';
  
  // ══════════════════════════════════════════════════════════════════════════════
  // 🎯 ROUTING: DIRECIONAR PARA PIPELINE CORRETO
  // ══════════════════════════════════════════════════════════════════════════════
  
  console.log('[WORKER-ROUTING] ═══════════════════════════════════════');
  console.log('[WORKER-ROUTING] Job ID:', jobId?.substring(0, 8));
  console.log('[WORKER-ROUTING] Mode:', mode);
  console.log('[WORKER-ROUTING] Sound Destination:', validSoundDestination);
  console.log('[WORKER-ROUTING] Reference Stage:', referenceStage || 'UNDEFINED');
  console.log('[WORKER-ROUTING] Reference Job ID:', referenceJobId || 'N/A');
  console.log('[WORKER-ROUTING] Job Data Keys:', Object.keys(job.data || {}));
  console.log('[WORKER-ROUTING] ═══════════════════════════════════════');
  
  // 🎯 REFERENCE MODE: BASE (1ª música)
  if (mode === 'reference' && referenceStage === 'base') {
    console.log('[WORKER-ROUTING] ✅ Condição atendida: mode=reference AND referenceStage=base');
    console.log('[WORKER-ROUTING] ➡️ Direcionando para processReferenceBase()');
    return processReferenceBase(job);
  }
  
  // 🎯 REFERENCE MODE: COMPARE (2ª música)
  if (mode === 'reference' && referenceStage === 'compare') {
    console.log('[WORKER-ROUTING] ➡️ Direcionando para processReferenceCompare()');
    return processReferenceCompare(job);
  }
  
  // 🎯 GENRE MODE: Pipeline tradicional
  if (mode === 'genre' || !mode || !referenceStage) {
    console.log('[WORKER-ROUTING] ➡️ Direcionando para processamento GENRE (pipeline tradicional)');
    // CONTINUAR COM LÓGICA EXISTENTE ABAIXO
  } else {
    // Modo desconhecido
    console.warn('[WORKER-ROUTING] ⚠️ Modo desconhecido:', { mode, referenceStage });
    console.warn('[WORKER-ROUTING] Usando pipeline GENRE como fallback');
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // 🎵 GENRE MODE: LÓGICA ORIGINAL (INALTERADA)
  // ══════════════════════════════════════════════════════════════════════════════
  
  // 🎯 EXTRAÇÃO CRÍTICA: planContext (CORREÇÃO PARA PLANOS)
  let extractedPlanContext = null;
  if (job.data && typeof job.data === 'object') {
    extractedPlanContext = job.data.planContext;
  } else if (typeof job.data === 'string') {
    try {
      const parsed = JSON.parse(job.data);
      extractedPlanContext = parsed.planContext;
    } catch (e) {
      console.warn('[WORKER][GENRE] ⚠️ Falha ao extrair planContext:', e.message);
    }
  }
  
  // 🎯 LOG ESSENCIAL: Job consumido
  console.log('[WORKER][GENRE] Job consumido:', {
    jobId: jobId.substring(0, 8),
    mode,
    genre: genre || 'N/A',
    fileName,
    hasTargets: !!genreTargets,
    hasPlanContext: !!extractedPlanContext
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

    // 🎯 CARREGAR MÉTRICAS DE REFERÊNCIA (se referenceJobId presente)
    if (referenceJobId) {
      console.log('[WORKER][GENRE] Carregando métricas de referência...', referenceJobId.substring(0, 8));
      
      try {
        const refResult = await pool.query(
          `SELECT id, status, results FROM jobs WHERE id = $1`,
          [referenceJobId]
        );
        
        if (refResult.rows.length === 0) {
          console.error('[WORKER][GENRE] ❌ Job de referência não encontrado:', referenceJobId);
        } else {
          const refJob = refResult.rows[0];
          
          if (refJob.status !== 'completed') {
            console.warn('[WORKER][GENRE] ⚠️ Job ref status:', refJob.status);
          } else if (!refJob.results) {
            console.warn('[WORKER][GENRE] ⚠️ Job ref sem resultados');
          } else {
            preloadedReferenceMetrics = refJob.results;
            console.log('[WORKER][GENRE] ✅ Métricas ref carregadas');
          }
        }
      } catch (refError) {
        console.error('[WORKER][GENRE] ❌ Erro ao carregar métricas ref:', refError.message);
      }
    }

    console.log('[WORKER][GENRE] Atualizando status: processing');
    await updateJobStatus(jobId, 'processing');

    console.log('[WORKER][GENRE] Baixando arquivo...', fileKey.split('/').pop());
    const downloadStartTime = Date.now();
    localFilePath = await downloadFileFromBucket(fileKey);
    const downloadTime = Date.now() - downloadStartTime;
    console.log('[WORKER][GENRE] ✅ Arquivo baixado em', downloadTime, 'ms');

    // Ler arquivo para buffer
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log('[WORKER][GENRE] Arquivo lido:', fileBuffer.length, 'bytes');
    logMemoryDelta('worker', 'genre-after-readFile', jobId);

    const t0 = Date.now();
    
    // Processar via pipeline
    console.log('[WORKER][GENRE] Iniciando pipeline...');
    console.log('[WORKER][GENRE] soundDestination para pipeline:', validSoundDestination);
    
    // Setar buffer no job para runPipeline (ephemeral, não serializado)
    job._buffer = fileBuffer;
    job._preloadedReferenceMetrics = preloadedReferenceMetrics;

    const pipelinePromise = runPipeline(job);
    
    let _timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      // 🧹 MEMORY FIX: armazenar timeoutId para cancelar quando o pipeline ganhar a corrida
      _timeoutId = setTimeout(() => reject(new Error(`Pipeline timeout após 3min: ${fileName}`)), 180000);
    });

    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise])
      .finally(() => {
        // Cancelar o timer se o pipeline ganhar antes do timeout
        if (_timeoutId) clearTimeout(_timeoutId);
      });
    const totalMs = Date.now() - t0;
    
    console.log('[WORKER][GENRE] ✅ Pipeline concluído em', totalMs, 'ms');
    console.log('[WORKER][GENRE] LUFS:', finalJSON.technicalData?.lufsIntegrated || 'N/A');
    console.log('[WORKER][GENRE] Score:', finalJSON.score || 0);
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // ✅ OVERRIDE JÁ FOI APLICADO NO PIPELINE (pipeline-complete.js)
    // Targets já vêm corretos para o modo (pista ou streaming)
    // Apenas marcar o modo no resultado final
    // ═══════════════════════════════════════════════════════════════════════════════
    finalJSON.soundDestination = validSoundDestination;
    console.log(`[WORKER][${validSoundDestination.toUpperCase()}] 🎯 Modo ${validSoundDestination} - targets já aplicados no pipeline`);
    
    // Garantir planContext
    if (!finalJSON.analysisMode && extractedPlanContext?.analysisMode) {
      finalJSON.analysisMode = extractedPlanContext.analysisMode;
    }
    if (!finalJSON.isReduced && finalJSON.analysisMode === 'reduced') {
      finalJSON.isReduced = true;
    }
    if (!finalJSON.limitWarning && finalJSON.analysisMode === 'reduced' && extractedPlanContext) {
      finalJSON.limitWarning = `Você atingiu o limite de análises completas do plano ${extractedPlanContext.plan?.toUpperCase() || 'FREE'}. Atualize seu plano para desbloquear análise completa.`;
    }

    // Enriquecer resultado
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
    
    // Garantir suggestions
    if (!finalJSON.suggestions) {
      finalJSON.suggestions = [];
    }
    
    // AI Enrichment
    try {
      console.log('[WORKER][GENRE] Iniciando AI enrichment...');

      const metrics = finalJSON.data?.metrics || finalJSON.metrics || null;
      const targets = finalJSON.data?.genreTargets || finalJSON.genreTargets || null;
      const problems = finalJSON.problemsAnalysis || null;

      const enriched = await enrichSuggestionsWithAI(
        finalJSON.suggestions || [],
        {
          metrics,
          targets,
          problems,
          genre: finalJSON.data?.genre || finalJSON.genre || null,
          mode,
          referenceJobId,
        }
      );

      finalJSON.aiSuggestions = Array.isArray(enriched) ? enriched : [];
      console.log('[WORKER][GENRE] ✅ AI enrichment:', finalJSON.aiSuggestions.length, 'sugestões');

    } catch (err) {
      console.error('[WORKER][GENRE] ❌ Erro no enrichment:', err.message);
      finalJSON.aiSuggestions = [];
    }
    
    // Validar JSON
    const validation = validateCompleteJSON(finalJSON, mode, referenceJobId);
    
    if (!validation.valid) {
      console.error('[WORKER][GENRE] ❌ JSON incompleto:', validation.missing.join(', '));
      
      await updateJobStatus(jobId, 'processing', finalJSON);
      
      if (localFilePath && fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      
      throw new Error(`JSON incompleto: ${validation.missing.join(', ')}`);
    }
    
    console.log('[WORKER][GENRE] ✅ JSON validado - salvando como completed');
    
    await updateJobStatus(jobId, 'completed', finalJSON);
    
    // Limpar arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    logMemoryDelta('worker', 'genre-end-success', jobId);
    clearMemoryDelta(jobId);

    console.log('[WORKER][GENRE] ✅ Job concluído:', {
      jobId: jobId.substring(0, 8),
      score: finalJSON.score || 0,
      suggestions: finalJSON.suggestions?.length || 0,
      aiSuggestions: finalJSON.aiSuggestions?.length || 0
    });

    return finalJSON;

  } catch (error) {
    console.error('[WORKER][GENRE] ❌ Erro:', error.message);
    
    // 🔥 RETORNO DE SEGURANÇA
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
      console.error('[WORKER][GENRE] ❌ Falha ao atualizar status failed:', dbError.message);
    }
    
    // Limpar arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (cleanupError) {
        console.error('[WORKER][GENRE] ❌ Erro ao limpar arquivo:', cleanupError.message);
      }
    }

    logMemoryDelta('worker', 'genre-end-error', jobId);
    clearMemoryDelta(jobId);
    
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