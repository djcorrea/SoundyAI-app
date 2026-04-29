// server.js - API PRINCIPAL DO SOUNDYAI (REDIS WORKERS ONLY)
// 🚀 ARQUITETURA REFATORADA: Apenas API - Workers Redis responsáveis por processamento

// [BOOT] Log imediato — identifica qual serviço está rodando este arquivo
console.error('[BOOT]', { file: 'work/server.js', pid: process.pid, entrypoint: 'Procfile web: node work/server.js' });

import "dotenv/config";
import express from "express";
import cors from "cors";

// ✅ CONFIGURAÇÃO CENTRALIZADA DE AMBIENTE
import { detectEnvironment, getCorsConfig } from './config/environment.js';

// Importar rotas da API
import analyzeRouter from "./api/audio/analyze.js";
import analyzeAnonymousRouter from "./api/audio/analyze-anonymous.js"; // 🔓 NOVO: Análise anônima
import jobsRouter from "./api/jobs/[id].js";
import healthRouter from "./api/health/redis.js";
import versionRouter from "./api/health/version.js";
import stripeCheckoutRouter from "./api/stripe/create-checkout-session.js";
import stripeWebhookRouter from "./api/webhook/stripe.js";
import chatAnonymousHandler from "./api/chat-anonymous.js"; // 🔓 NOVO: Chat anônimo

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Detectar ambiente e configurar CORS dinamicamente
const currentEnv = detectEnvironment();
console.log(`🌍 [SERVER] Ambiente: ${currentEnv}`);

// ---------- CORS configurado dinamicamente por ambiente ----------
app.use(cors(getCorsConfig(currentEnv)));

// ---------- Middleware para JSON ----------
// ⚠️ ATENÇÃO: Webhook Stripe precisa de raw body para validar assinatura
// Aplicar express.raw() ANTES de express.json() para a rota específica
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// JSON parser para outras rotas
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- Servir arquivos estáticos da pasta public ----------
// 🎯 CRÍTICO: Servir JSONs de referência e frontend estático
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir pasta public com configuração correta de headers para JSON
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    // Garantir que arquivos .json sejam servidos com Content-Type correto
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  },
  // Não usar index.html como fallback para evitar servir HTML no lugar de JSON
  index: false
}));

console.log('📁 [STATIC] Servindo arquivos estáticos de:', path.join(__dirname, '../public'));
console.log('📁 [STATIC] Arquivos JSON de referência disponíveis em: /refs/out/*.json');

// ---------- Logging middleware ----------
app.use((req, res, next) => {
  console.log(`🌐 [API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ---------- Rotas principais da API ----------

// 🔓 ROTAS ANÔNIMAS PRIMEIRO (mais específicas)
app.use('/api/audio/analyze-anonymous', analyzeAnonymousRouter);
app.post('/api/chat/anonymous', chatAnonymousHandler);

// 🧪 TESTE: Endpoint para verificar se rotas anônimas estão ativas
app.get('/api/anonymous/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rotas anônimas estão funcionando!',
    timestamp: new Date().toISOString(),
    routes: ['/api/chat/anonymous', '/api/audio/analyze-anonymous']
  });
});

// ✅ Rotas autenticadas depois (mais genéricas)
app.use('/api/audio', analyzeRouter); // Inclui /api/audio/analyze e /api/audio/compare
app.use('/api/jobs', jobsRouter);
app.use('/health', healthRouter);
app.use('/api/health/version', versionRouter); // 🔖 Endpoint de versão/rastreabilidade

// ✅ STRIPE: Rotas de pagamento
app.use('/api/stripe', stripeCheckoutRouter);
app.use('/api/webhook/stripe', stripeWebhookRouter);

// ---------- Health check endpoint ----------
app.get('/health', (req, res) => {
  res.json({ 
    status: 'API healthy',
    timestamp: new Date().toISOString(),
    architecture: 'redis-workers-only',
    workers: 'external-redis-workers',
    version: '2.0-redis-refactored'
  });
});

// 📊 ENDPOINT DE MONITORAMENTO DA FILA - ADICIONADO CONFORME SOLICITADO
app.get('/health/queue', async (req, res) => {
  try {
    // Importar módulos necessários
    const { Queue } = await import('bullmq');
    const { getRedisConnection, testRedisConnection, getConnectionMetadata } = await import('./lib/redis-connection.js');
    
    // Teste de conexão
    const connectionTest = await testRedisConnection();
    const metadata = getConnectionMetadata();
    
    // Criar queue para monitoramento
    const redis = getRedisConnection();
    const audioQueue = new Queue('audio-analyzer', { connection: redis });
    
    // ✅ CORRIGIDO: Aguardar queue ficar pronta
    await audioQueue.waitUntilReady();
    
    // Obter estatísticas da fila
    const jobCounts = await audioQueue.getJobCounts();
    const isPaused = await audioQueue.isPaused();
    const workers = await audioQueue.getWorkers();
    
    // Status de saúde (queue ready implícito já que waitUntilReady passou)
    const isHealthy = connectionTest.status === 'healthy' && !isPaused;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      queue: {
        name: 'audio-analyzer',
        isPaused,
        isReady,
        jobCounts,
        workers: workers.length
      },
      redis: {
        connection: connectionTest,
        metadata
      }
    });
    
  } catch (error) {
    console.error(`[HEALTH-QUEUE][${new Date().toISOString()}] -> 🚨 Erro no health check:`, error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ---------- Root endpoint ----------
app.get('/', (req, res) => {
  // Servir index.html do frontend
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ---------- API Info endpoint ----------
app.get('/api', (req, res) => {
  res.json({
    service: 'SoundyAI API',
    status: 'running',
    architecture: 'redis-workers-only',
    timestamp: new Date().toISOString(),
    endpoints: {
      analyze: '/api/audio/analyze',
      jobs: '/api/jobs/:id',
      health: '/health',
      presign: '/api/presign'
    }
  });
});

// ---------- Rota para gerar URL pré-assinada (preservada do server original) ----------
// 🧹 MEMORY OPT: AWS SDK carregado lazily (só quando /api/presign é chamado)
// Economia: ~20-30MB RAM em idle que o SDK AWS ocupa no módulo

const BUCKET_NAME = process.env.B2_BUCKET_NAME;
let _s3Client = null; // instanciado na primeira chamada

async function getS3Client() {
  if (!_s3Client) {
    // Lazy import do AWS SDK — só carrega quando necessário
    const AWS = (await import("aws-sdk")).default;
    _s3Client = new AWS.S3({
      endpoint: "https://s3.us-east-005.backblazeb2.com",
      region: "us-east-005",
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY,
      signatureVersion: "v4",
    });
  }
  return _s3Client;
}

app.get("/api/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;

    if (!ext || !contentType) {
      return res.status(400).json({ 
        error: "Parâmetros 'ext' e 'contentType' são obrigatórios" 
      });
    }

    const allowedExtensions = ['mp3', 'wav', 'flac', 'm4a'];
    if (!allowedExtensions.includes(ext.toLowerCase())) {
      return res.status(400).json({ 
        error: `Extensão '${ext}' não permitida. Use: ${allowedExtensions.join(', ')}` 
      });
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileKey = `uploads/audio_${timestamp}_${randomId}.${ext}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Expires: 600, // 10 minutos
    };

    const s3 = await getS3Client();
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

    console.log(`✅ [API] URL pré-assinada gerada: ${fileKey}`);

    res.json({
      uploadUrl,
      fileKey
    });

  } catch (err) {
    console.error("❌ [API] Erro ao gerar URL pré-assinada:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ---------- Error handling middleware ----------
app.use((err, req, res, next) => {
  console.error('🚨 [API] Erro não capturado:', err.message);
  res.status(500).json({
    error: 'Erro interno do servidor',
    timestamp: new Date().toISOString()
  });
});

// ---------- 404 handler ----------
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ---------- Graceful shutdown ----------
process.on('SIGINT', () => {
  console.log('📥 [API] Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📥 [API] Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

// ---------- Start server ----------
app.listen(PORT, () => {
  const GIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "local-dev";
  const BOOT_INFO = {
    buildTag: "SOUNDYAI_2025_12_18_B",
    gitSha: GIT_SHA,
    entrypoint: "work/server.js",
    jobsHandlerPath: "work/api/jobs/[id].js",
    port: PORT,
    architecture: "redis-workers",
    nodeVersion: process.version,
    pid: process.pid,
    cwd: process.cwd(),
    timestamp: new Date().toISOString()
  };
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 SOUNDYAI API BOOT                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.error('[SOUNDYAI-BOOT]', JSON.stringify(BOOT_INFO, null, 2));
  console.log(`🚀 [API] SoundyAI API rodando na porta ${PORT}`);
  console.log(`🏗️ [API] Arquitetura: Redis Workers Only`);
  console.log(`📍 [API] Endpoints: /api/audio/analyze, /api/jobs/:id, /health`);
  console.log(`📍 [API] Version: GET /api/health/version`);
  console.log(`🔖 [API] Build: ${GIT_SHA.substring(0, 7)}`);
  console.log(`🔗 [API] CORS configurado para produção e desenvolvimento`);
  console.log('═══════════════════════════════════════════════════════════════════');

  // 📊 Monitor de memória do servidor API (a cada 60s)
  const memMonitor = setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MEM-MONITOR][API] PID=${process.pid} | RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB | Heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  }, 60000);
  memMonitor.unref(); // não impedir shutdown graceful
});