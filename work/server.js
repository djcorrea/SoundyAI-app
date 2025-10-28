// server.js - API PRINCIPAL DO SOUNDYAI (REDIS WORKERS ONLY)
// 🚀 ARQUITETURA REFATORADA: Apenas API - Workers Redis responsáveis por processamento

import "dotenv/config";
import express from "express";
import cors from "cors";

// Importar rotas da API
import analyzeRouter from "./api/audio/analyze.js";
import jobsRouter from "./api/jobs/[id].js";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS configurado para domínios permitidos ----------
app.use(cors({
  origin: [
    "https://soundyai-app-production.up.railway.app", // domínio principal
    "http://localhost:3000", // desenvolvimento local
    "http://localhost:3001", // desenvolvimento alternativo
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ---------- Middleware para JSON ----------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- Logging middleware ----------
app.use((req, res, next) => {
  console.log(`🌐 [API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ---------- Rotas principais da API ----------
app.use('/api/audio', analyzeRouter);
app.use('/api/jobs', jobsRouter);

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

// ---------- Root endpoint ----------
app.get('/', (req, res) => {
  res.json({
    service: 'SoundyAI API',
    status: 'running',
    architecture: 'redis-workers-only',
    timestamp: new Date().toISOString(),
    endpoints: {
      analyze: '/api/audio/analyze',
      jobs: '/api/jobs/:id',
      health: '/health'
    }
  });
});

// ---------- Rota para gerar URL pré-assinada (preservada do server original) ----------
import AWS from "aws-sdk";

// Configuração Backblaze
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

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
  console.log(`🚀 [API] SoundyAI API rodando na porta ${PORT}`);
  console.log(`🏗️ [API] Arquitetura: Redis Workers Only`);
  console.log(`📍 [API] Endpoints: /api/audio/analyze, /api/jobs/:id, /health`);
  console.log(`🔗 [API] CORS configurado para produção e desenvolvimento`);
});