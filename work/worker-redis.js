/**
 * 🔥 WORKER REDIS — ORQUESTRADOR LEVE (v2: Process Isolation)
 * 
 * ARQUITETURA: 1 JOB = 1 PROCESSO
 * 
 * Este arquivo NÃO executa processamento de áudio.
 * Ele é um orquestrador leve que:
 *   1. Consome jobs da fila BullMQ 'audio-analyzer'
 *   2. Faz fork() de analysis-job.js para CADA job
 *   3. Recebe o resultado via IPC
 *   4. Atualiza o status no PostgreSQL
 *   5. O child process MORRE → memória VOLTA para baseline
 * 
 * ✅ Conexão Redis com retry/backoff automático
 * ✅ Listeners completos para error, failed, completed
 * ✅ Process isolation — ZERO memory leak entre jobs
 * ✅ Timeout e kill de processos órfãos
 * ✅ Métricas de memória por job
 */

import "dotenv/config";
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import pool from './db.js';
import path from "path";
import { fileURLToPath } from "url";
import express from 'express';
import { fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho absoluto do script de análise isolado
const ANALYSIS_JOB_SCRIPT = path.join(__dirname, 'analysis-job.js');

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
    const mem = process.memoryUsage();
    const status = {
      status: 'healthy',
      redis: isRedisReady ? 'connected' : 'disconnected',
      worker: worker ? 'active' : 'inactive',
      architecture: 'process-isolation',
      activeJobs: activeChildProcesses,
      pid: process.pid,
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.json(status);
  });
  
  app.listen(port, () => {
    console.log(`🏥 [HEALTH] Health check server rodando na porta ${port}`);
  });

  // 📊 MONITORAMENTO DE MEMÓRIA DO ORQUESTRADOR (a cada 60s)
  const MEM_MONITOR_INTERVAL = 60000;
  const memInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
    console.log(`[MEM-MONITOR] Orquestrador PID=${process.pid} | RSS=${rssMB}MB | Heap=${heapMB}/${heapTotalMB}MB | Jobs ativos=${activeChildProcesses}`);
    
    // Alerta se orquestrador estiver usando mais de 200MB (deveria ficar ~30-80MB)
    if (mem.rss > 200 * 1024 * 1024) {
      console.warn(`[MEM-MONITOR] ⚠️ RSS acima de 200MB — investigar possível leak no orquestrador`);
    }
  }, MEM_MONITOR_INTERVAL);
  memInterval.unref(); // Não impedir shutdown
}

// ===============================================
// 🎵 AUDIO PROCESSOR FUNCTION
// ===============================================

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
      // 🔐 SANITIZAÇÃO: já feita no processo filho (analysis-job.js) antes do IPC
      
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

// ═══════════════════════════════════════════════════════════
// 🔥 AUDIO PROCESSOR — FORK-BASED (1 JOB = 1 PROCESSO)
// ═══════════════════════════════════════════════════════════

/**
 * Contagem de processos filhos ativos (para métricas e health check)
 */
let activeChildProcesses = 0;

/**
 * Executa um job de análise em processo isolado via fork().
 * 
 * O processo filho (analysis-job.js) recebe os dados do job via IPC,
 * executa todo o processamento pesado (S3 download, FFmpeg, FFT, métricas, AI),
 * envia o resultado de volta via IPC, e morre com process.exit(0).
 * 
 * O orquestrador (este arquivo) recebe o resultado e atualiza o PostgreSQL.
 * 
 * GARANTIA: Quando o processo filho morre, o OS libera TODA a memória.
 * Não importa quantos buffers, caches ou closures foram criados — tudo é destruído.
 */
async function audioProcessor(job) {
  const {
    jobId,
    mode,
    fileName,
    referenceStage,
  } = job.data;

  const displayId = jobId?.substring(0, 8) || 'unknown';

  console.log('[WORKER] ═══════════════════════════════════════');
  console.log(`[WORKER] 🚀 Job recebido: ${displayId}`);
  console.log(`[WORKER] Mode: ${mode || 'genre'} | Stage: ${referenceStage || 'N/A'}`);
  console.log(`[WORKER] Arquivo: ${fileName || 'unknown'}`);
  console.log(`[WORKER] Processos ativos: ${activeChildProcesses}`);
  console.log('[WORKER] ═══════════════════════════════════════');

  // Atualizar status para 'processing' imediatamente
  try {
    await updateJobStatus(jobId, 'processing');
  } catch (err) {
    console.error(`[WORKER] ❌ Falha ao marcar processing: ${err.message}`);
    // Continuar — não é fatal
  }

  const memBefore = process.memoryUsage();
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    // 🔥 FORK: Criar processo filho isolado
    const child = fork(ANALYSIS_JOB_SCRIPT, [], {
      // Herdar variáveis de ambiente (DATABASE_URL, B2_*, OPENAI_API_KEY, etc)
      env: { ...process.env },
      // Silenciar stdout/stderr do filho — redirecionar para o pai
      silent: false,
      // serialization: 'advanced' permite transferir Buffers mais eficientemente se necessário
      serialization: 'json',
    });

    activeChildProcesses++;
    const childPid = child.pid;
    console.log(`[WORKER] 🔀 Fork criado PID=${childPid} para job ${displayId} (ativos: ${activeChildProcesses})`);

    // Timeout de segurança: 5 minutos para o processo inteiro
    const JOB_TIMEOUT = 300000;
    const jobTimeout = setTimeout(() => {
      console.error(`[WORKER] ⏰ Timeout de ${JOB_TIMEOUT / 1000}s para job ${displayId} PID=${childPid}`);
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(new Error(`Job timeout após ${JOB_TIMEOUT / 1000}s: ${fileName}`));
    }, JOB_TIMEOUT);

    // Handler: resultado recebido do filho
    child.on('message', async (msg) => {
      clearTimeout(jobTimeout);

      if (msg.type === 'result') {
        const elapsed = Date.now() - startTime;
        const memAfter = process.memoryUsage();

        console.log(`[WORKER] ═══════════════════════════════════════`);
        console.log(`[WORKER] ✅ Resultado recebido de PID=${childPid}`);
        console.log(`[WORKER] Tempo total: ${elapsed}ms`);
        console.log(`[WORKER] RAM orquestrador: ${(memAfter.rss / 1024 / 1024).toFixed(1)}MB`);
        console.log(`[WORKER] RAM filho (pico): ${msg.metrics?.peakRssMB || '?'}MB`);
        console.log(`[WORKER] Heap filho (pico): ${msg.metrics?.heapUsedMB || '?'}MB`);
        console.log(`[WORKER] ═══════════════════════════════════════`);

        try {
          // Salvar resultado no PostgreSQL
          await updateJobStatus(jobId, msg.status, msg.result);
          console.log(`[WORKER] ✅ Job ${displayId} salvo como ${msg.status}`);
          resolve(msg.result);
        } catch (dbError) {
          console.error(`[WORKER] ❌ Falha ao salvar resultado: ${dbError.message}`);
          reject(dbError);
        }

      } else if (msg.type === 'error') {
        console.error(`[WORKER] ❌ Erro do filho PID=${childPid}: ${msg.error}`);

        // Salvar como failed
        const errorResult = {
          status: 'error',
          error: {
            message: msg.error,
            type: 'worker_pipeline_error',
            phase: 'isolated_process',
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
            engineVersion: 'isolated-process-error',
            pipelinePhase: 'error'
          },
          technicalData: {},
          warnings: [`Isolated process error: ${msg.error}`],
          buildVersion: 'isolated-process-error',
          frontendCompatible: false,
          _worker: {
            source: 'analysis-job-error',
            isolated: true,
            error: true,
            pid: childPid,
            jobId
          }
        };

        try {
          await updateJobStatus(jobId, 'failed', errorResult);
        } catch (dbError) {
          console.error(`[WORKER] ❌ Falha ao salvar failed: ${dbError.message}`);
        }

        reject(new Error(msg.error));
      }
    });

    // Handler: processo filho morreu inesperadamente
    child.on('exit', (code, signal) => {
      activeChildProcesses = Math.max(0, activeChildProcesses - 1);
      clearTimeout(jobTimeout);

      const elapsed = Date.now() - startTime;
      const memAfter = process.memoryUsage();

      console.log(`[WORKER] 💀 Filho PID=${childPid} encerrou (code=${code}, signal=${signal}) em ${elapsed}ms`);
      console.log(`[WORKER] 📊 RAM orquestrador após cleanup: ${(memAfter.rss / 1024 / 1024).toFixed(1)}MB (ativos: ${activeChildProcesses})`);

      // Se exit code > 0 e não recebemos mensagem, é crash
      if (code !== 0 && code !== null) {
        const crashError = new Error(`Processo filho crashou com code=${code} signal=${signal}`);
        
        // Tentar salvar como failed (fire and forget)
        updateJobStatus(jobId, 'failed', {
          status: 'error',
          error: { message: crashError.message, type: 'child_process_crash' },
          score: 0,
          _worker: { source: 'crash', pid: childPid, code, signal }
        }).catch(() => {});

        reject(crashError);
      }
    });

    // Handler: erro no fork
    child.on('error', (err) => {
      activeChildProcesses = Math.max(0, activeChildProcesses - 1);
      clearTimeout(jobTimeout);
      console.error(`[WORKER] ❌ Erro no fork PID=${childPid}: ${err.message}`);
      reject(err);
    });

    // 🚀 ENVIAR DADOS DO JOB PARA O FILHO
    child.send({
      type: 'job',
      data: job.data,
    });
  });
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