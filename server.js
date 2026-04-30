// server.js

// [BOOT] Log antes de qualquer supressão — console.error nunca é noop'd
console.error('[BOOT]', { file: 'server.js (root)', pid: process.pid, entrypoint: 'railway.json startCommand: node server.js' });

// ============================================================================
// 🔇 CONTROLE GLOBAL DE LOGS — Variável Railway: DEBUG_LOGS=true
// Padrão (sem a variável): nenhum log aparece nos logs do Railway.
// Para ativar: adicione DEBUG_LOGS=true nas variáveis do projeto Railway.
// console.error é SEMPRE exibido (erros críticos de startup/crash).
// ============================================================================
if (process.env.DEBUG_LOGS !== 'true') {
  const _noop = () => {};
  console.log   = _noop;
  console.info  = _noop;
  console.warn  = _noop;
  console.debug = _noop;
}

import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import { execFile, exec, execSync, spawn } from "child_process";
import { promisify } from "util";
// 🧹 MEMORY OPT: decision-engine.cjs REMOVIDO — nunca era chamado diretamente no server.js
// O processamento de áudio/DSP ocorre APENAS no automaster-worker (processo filho)

// ============================================================================
// AutoMaster — imports estáticos (CJS é suportado por ESM via default import)
// ============================================================================
import automasterQueueModule from './queue/automaster-queue.cjs';
import storageServiceModule from './services/storage-service.cjs';
import jobStoreModule from './services/job-store.cjs';
import { v4 as uuidv4 } from 'uuid';
import { ensureAutomasterSchema } from './db/ensure-automaster-schema.js';

import pkg from "pg";
const { Pool } = pkg;

// ============================================================================
// 🗄️ POOL POSTGRESQL: Compartilhado para registros de jobs AutoMaster
// Permite consulta de status via /api/jobs/:id junto com jobs do analisador.
// ============================================================================
const jobsPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

jobsPool.on('error', (err) => {
  console.error('⚠️ [JOBS-POOL] Erro de conexão PostgreSQL (não fatal):', err.message);
});

const execAsync = promisify(exec);

// 🔑 IMPORTANTE: Carregar .env ANTES de importar outros módulos
dotenv.config();

// ✅ CONFIGURAÇÃO CENTRALIZADA DE AMBIENTE
import { detectEnvironment, getCorsConfig } from './work/config/environment.js';

// Rotas principais
// 🔧 FIX: Usar arquivo correto que suporta referenceJobId e enfileira no Redis/BullMQ
import analyzeRoute from "./work/api/audio/analyze.js";
import jobsRoute from "./api/jobs/[id].js"; // 👈 rota de jobs conectada ao Postgres

// 🚨 VALIDAÇÃO CRÍTICA DE AMBIENTE
console.log('\n🔍 [SERVER] ═══════════════════════════════════════');
console.log('🔍 [SERVER]    VALIDAÇÃO DE VARIÁVEIS CRÍTICAS    ');
console.log('🔍 [SERVER] ═══════════════════════════════════════\n');

const criticalVars = {
  'DATABASE_URL': process.env.DATABASE_URL,
  'REDIS_URL': process.env.REDIS_URL,
  'FIREBASE_SERVICE_ACCOUNT': process.env.FIREBASE_SERVICE_ACCOUNT,
  'B2_KEY_ID': process.env.B2_KEY_ID,
  'B2_APP_KEY': process.env.B2_APP_KEY,
  'B2_BUCKET_NAME': process.env.B2_BUCKET_NAME,
  'B2_ENDPOINT': process.env.B2_ENDPOINT,
  'B2_DOWNLOAD_URL': process.env.B2_DOWNLOAD_URL,
};

let hasErrors = false;

for (const [key, value] of Object.entries(criticalVars)) {
  if (!value) {
    console.error(`❌ [SERVER] ERRO: ${key} não configurada`);
    hasErrors = true;
  } else {
    // Mascarar valores sensíveis
    let displayValue = value.toString();
    if (key.includes('URL') || key.includes('KEY') || key.includes('TOKEN')) {
      displayValue = displayValue.substring(0, 25) + '...';
    } else if (key === 'FIREBASE_SERVICE_ACCOUNT') {
      displayValue = JSON.parse(value).project_id || 'configurado';
    }
    console.log(`✅ [SERVER] ${key}: ${displayValue}`);
  }
}

if (hasErrors) {
  console.error('\n💥 [SERVER] ═══════════════════════════════════════');
  console.error('💥 [SERVER]    ERRO CRÍTICO: Variáveis Ausentes   ');
  console.error('💥 [SERVER] ═══════════════════════════════════════');
  console.error('💡 [SERVER] Configure no Railway Dashboard → Variables');
  console.error('📋 [SERVER] Ambiente:', process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'unknown');
  console.error('💥 [SERVER] Servidor NÃO será iniciado\n');
  process.exit(1);
}

console.log('✅ [SERVER] Todas as variáveis críticas configuradas\n');

// 🎵 VALIDAÇÃO DE FFMPEG (necessário para AutoMaster V1)
console.log('🔍 [SERVER] ═══════════════════════════════════════');
console.log('🔍 [SERVER]      VERIFICAÇÃO DO FFMPEG            ');
console.log('🔍 [SERVER] ═══════════════════════════════════════\n');

try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  console.log('✅ [SERVER] FFmpeg detectado no ambiente');
  console.log('🎵 [SERVER] AutoMaster V1 pronto para processar áudio\n');
} catch (error) {
  console.error('❌ [SERVER] FFmpeg NÃO encontrado no ambiente');
  console.error('⚠️  [SERVER] AutoMaster V1 falhará ao processar áudio');
  console.error('💡 [SERVER] Certifique-se de que o railway.json inclui FFmpeg nos packages\n');
}

// 📋 Logs de configuração (manter para compatibilidade)
console.log("📂 Arquivo .env carregado");
console.log("B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("B2_APP_KEY:", process.env.B2_APP_KEY);
console.log("B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("B2_ENDPOINT:", process.env.B2_ENDPOINT);
console.log("🗄️ DATABASE_URL:", process.env.DATABASE_URL ? "✅ Configurada" : "❌ Não configurada");
console.log("🔗 REDIS_URL:", process.env.REDIS_URL ? "✅ Configurada" : "❌ Não configurada");
console.log("🎯 FILA BULLMQ: 'audio-analyzer' (API com BullMQ ativada)");

const app = express();
// Confiar no proxy reverso (Railway/Vercel) para obter o IP real do cliente
app.set('trust proxy', 1);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Path absoluto para arquivos estáticos (Railway-compatible)
const publicPath = path.join(process.cwd(), "public");

// 🔍 Debug: Log paths para diagnóstico
console.log('\n📂 [SERVER] ═══════════════════════════════════════');
console.log('📂 [SERVER]    CONFIGURAÇÃO DE PATHS             ');
console.log('📂 [SERVER] ═══════════════════════════════════════');
console.log('📂 Static path:', publicPath);
console.log('📂 __dirname:', __dirname);
console.log('📂 cwd:', process.cwd());
console.log('📂 [SERVER] ═══════════════════════════════════════\n');

// ✅ Detectar ambiente e configurar CORS dinamicamente
const currentEnv = detectEnvironment();
console.log(`🌍 [SERVER-ROOT] Ambiente: ${currentEnv}`);

// Middlewares
// ⚠️ ATENÇÃO: Webhook Stripe precisa de raw body para validar assinatura HMAC
// Aplicar express.raw() ANTES de express.json() para a rota específica
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// ✅ CORS configurado com domínios permitidos
const allowedOrigins = [
  "https://soundyai.com.br",
  "https://www.soundyai.com.br",
  "https://soundyai-app-soundyai-teste.up.railway.app",
  "https://soundyai-app-automaster.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn("CORS bloqueou origem:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 👉 ROTA RAIZ PRIMEIRO: abre a home
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "home.html"));
});

// 👉 Aliases para o app (index)
app.get(["/index", "/index.html", "/app", "/home"], (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});



// 🔑 Rotas explícitas para páginas de autenticação e masterização
// Garante que nunca retornem 404, independente de CDN ou cache
app.get(["/login", "/login.html"], (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});
app.get(["/master", "/master.html"], (req, res) => {
  res.sendFile(path.join(publicPath, "master.html"));
});
// Compatibilidade: /auth.html -> /login.html (preserva query string)
app.get("/auth.html", (req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/login.html' + qs);
});
// � MODO DEMO: Rota especial que serve index.html mas ativa modo demo
app.get(["/demo", "/demo.html"], (req, res) => {
  console.log('🔥 [DEMO] Servindo index.html em modo demo');
  res.sendFile(path.join(publicPath, "index.html"));
});

// �👉 Servir arquivos estáticos SEM index automático
// 🔥 FORÇA NO-CACHE para arquivos .js (evitar cache no Railway CDN)
// 🎵 Configura MIME type correto para arquivos WAV
app.use(
  express.static(publicPath, {
    index: false,
    setHeaders: (res, filePath) => {
      // Força no-cache para JS e HTML (evitar CDN/browser cacheando versões antigas)
      if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        console.log('🔥 [NO-CACHE] Servindo:', path.basename(filePath));
      }
      // Configura MIME type correto para arquivos WAV
      if (filePath.endsWith('.wav')) {
        res.setHeader('Content-Type', 'audio/wav');
        console.log('🎵 [WAV] Servindo:', path.basename(filePath));
      }
    }
  })
);
console.log('✅ [EXPRESS.STATIC] Servidor de arquivos estáticos configurado\n');

// Rotas da API
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatWithImagesRoute from "./api/chat-with-images.js";
import chatRoute from "./api/chat.js";
import createPreferenceRoute from "./api/create-preference.js";
import deleteAccountRoute from "./api/delete-account.js";
import mercadopagoRoute from "./api/mercadopago.js";
import uploadAudioRoute from "./api/upload-audio.js";

// 🔓 ROTAS ANÔNIMAS - DESATIVADAS 2026-02-02
// ✅ Para reativar: descomente as linhas abaixo
// import chatAnonymousHandler from "./work/api/chat-anonymous.js";
// import analyzeAnonymousRoute from "./work/api/audio/analyze-anonymous.js";
import uploadImageRoute from "./api/upload-image.js";
import voiceMessageRoute from "./api/voice-message.js";
import webhookRoute from "./api/webhook.js";
import presignRoute from "./api/presign.js";

// 🎯 CORRECTION PLAN: Plano de Correção com IA
import correctionPlanHandler from "./api/correction-plan.js";

// 🔥 DEMO: Controle de limite 100% backend
import demoRouter from "./work/api/demo/index.js";

// ✅ STRIPE: Rotas de pagamento recorrente
import stripeCheckoutRouter from "./work/api/stripe/create-checkout-session.js";
import stripeCancelRouter from "./work/api/stripe/cancel-subscription.js";
import stripeWebhookRouter from "./work/api/webhook/stripe.js";

// ✅ MERCADO PAGO: Crédito avulso (single_credit)
import mpCreatePaymentRouter from './work/api/mp/create-payment.js';
import mpWebhookRouter from './work/api/webhook/mp.js';

// 🔐 AUTH MIDDLEWARE + CRÉDITOS: AutoMaster
import { verifyFirebaseToken } from './work/lib/auth/verify-token-middleware.js';
import { createJobWithTransaction, consumeJobCredit, releaseUserLock } from './work/lib/automaster/jobs.js';
import { getFirestore, getAuth } from './firebase/admin.js';

// 🛡️ ANTI-ABUSE: Fingerprint + IP rate limiting para free users
import { getUserPlan, hasPaidPlan, checkFreeUsage, registerFreeUsage, isIPAllowed } from './services/usage-control.js';

// 🎓 HOTMART: Webhook para combo Curso + PLUS 1 mês
import hotmartWebhookRouter from "./api/webhook/hotmart.js";

// 🔍 VERIFY PURCHASE: Verificação manual de compra e ativação de plano
import verifyPurchaseRouter from "./api/verify-purchase.js";

// 🕐 HISTÓRICO DE ANÁLISES: Apenas para usuários PRO e STUDIO
import historyRouter from "./api/history/index.js";

// 📧 WAITLIST: Cadastro na lista de espera + envio de e-mail
import waitlistRouter from "./api/waitlist.js";

// 🚀 LAUNCH: Sistema de disparo de e-mails de lançamento
import launchRouter from "./api/launch.js";

// 📊 TRACKING: Funil de conversão
import trackRoute from "./api/track.js";

// ═══════════════════════════════════════════════════════════════════
// 🔓 ROTAS ANÔNIMAS - DESATIVADAS 2026-02-02 (Forçar login obrigatório)
// ✅ Para reativar: descomente o bloco abaixo e reimporte os handlers
// ═══════════════════════════════════════════════════════════════════

/*
// 🔓 Chat anônimo (5 mensagens/dia)
app.post("/api/chat/anonymous", async (req, res) => {
  console.log('[ANONYMOUS-CHAT] 📥 POST /api/chat/anonymous recebido');
  try {
    await chatAnonymousHandler(req, res);
  } catch (error) {
    console.error('[ANONYMOUS-CHAT] ❌ Erro:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'INTERNAL_ERROR', 
        message: 'Erro ao processar chat anônimo' 
      });
    }
  }
});

// 🔓 Análise anônima (1 análise PERMANENTE - sem reset)
app.use("/api/audio/analyze-anonymous", analyzeAnonymousRoute);

// 🔓 Endpoint de teste para verificar se as rotas anônimas estão funcionando
app.get("/api/anonymous/status", (req, res) => {
  res.json({
    status: 'ok',
    message: 'Rotas anônimas registradas no server.js da raiz',
    timestamp: new Date().toISOString(),
    routes: ['/api/chat/anonymous', '/api/audio/analyze-anonymous']
  });
});

console.log('🔓 [ANONYMOUS] Rotas anônimas registradas:');
console.log('   - POST /api/chat/anonymous');
console.log('   - POST /api/audio/analyze-anonymous');
console.log('   - GET /api/anonymous/status');
*/

console.log('⚠️  [ANONYMOUS] Rotas anônimas DESATIVADAS (login obrigatório)');


// ═══════════════════════════════════════════════════════════════════
// � ROTAS DEMO - Controle de limite 100% backend
// ═══════════════════════════════════════════════════════════════════
app.use("/api/demo", demoRouter);
console.log('🔥 [DEMO] Rotas demo registradas:');
console.log('   - POST /api/demo/can-analyze');
console.log('   - GET /api/demo/status');

// ═══════════════════════════════════════════════════════════════════
// �🔐 ROTAS AUTENTICADAS
// ═══════════════════════════════════════════════════════════════════

app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);
app.use("/api/chat", chatRoute);
app.use("/api/create-preference", createPreferenceRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/voice", voiceMessageRoute);

// ═══════════════════════════════════════════════════════════════════
// ⚠️ WEBHOOKS ESPECÍFICOS - DEVEM SER REGISTRADOS ANTES DO GENÉRICO
// ═══════════════════════════════════════════════════════════════════
// CRÍTICO: Express processa rotas na ordem de registro.
// Rotas mais específicas (/api/webhook/hotmart) DEVEM vir ANTES
// de rotas genéricas (/api/webhook) para evitar interceptação.

// 🎓 HOTMART: Webhook para combo Curso + PLUS 1 mês
app.use('/api/webhook/hotmart', hotmartWebhookRouter);
console.log('🎓 [HOTMART] Webhook registrado: POST /api/webhook/hotmart');

// ✅ STRIPE: Webhook de pagamento recorrente
app.use('/api/webhook/stripe', stripeWebhookRouter);
console.log('✅ [STRIPE] Webhook registrado: POST /api/webhook/stripe');

// ✅ MERCADO PAGO: Webhook de crédito avulso
app.use('/api/webhook/mp', mpWebhookRouter);
console.log('✅ [MP] Webhook registrado: GET+POST /api/webhook/mp');

// ✅ MERCADO PAGO: Criação de preferência
app.use('/api/mp/create-payment', mpCreatePaymentRouter);
console.log('✅ [MP] Create-payment registrado: POST /api/mp/create-payment');

// 📦 MERCADOPAGO: Webhook genérico (DEVE ser o último /api/webhook/*)
app.use("/api/webhook", webhookRoute);
console.log('📦 [MERCADOPAGO] Webhook genérico registrado: POST /api/webhook');

app.use("/api", presignRoute);

// ✅ STRIPE: Registrar rotas de pagamento (DEPOIS das rotas gerais)
app.use('/api/stripe', stripeCheckoutRouter);
app.use('/api/stripe/cancel-subscription', stripeCancelRouter);

// 🔍 VERIFY PURCHASE: Endpoint de verificação manual de compra
app.use('/api/verify-purchase', verifyPurchaseRouter);
console.log('🔍 [VERIFY-PURCHASE] Endpoints registrados:');
console.log('   - POST /api/verify-purchase (ativar plano se compra encontrada)');
console.log('   - GET /api/verify-purchase/status (apenas consultar status)');

// Rotas de análise
app.use("/api/audio", analyzeRoute);
app.use("/api/jobs", jobsRoute); // ✅ rota de jobs conectada ao banco

// 🕐 HISTÓRICO DE ANÁLISES: Apenas para usuários PRO e STUDIO
app.use("/api/history", historyRouter);
console.log('🕐 [HISTORY] Rotas de histórico registradas:');
console.log('   - POST /api/history (salvar nova análise)');
console.log('   - GET /api/history (listar histórico do usuário PRO/STUDIO)');
console.log('   - GET /api/history/:id (buscar análise específica)');
console.log('   - DELETE /api/history/:id (remover análise do histórico)');

// 📧 WAITLIST: Cadastro na lista de espera com envio de e-mail
app.use("/api/waitlist", waitlistRouter);

// 📊 TRACKING: Funil de conversão (fire-and-forget, sempre responde 200)
app.use("/api/track", trackRoute);
console.log('📊 [TRACKING] Rota registrada: POST /api/track');

// ═══════════════════════════════════════════════════════════════════
// 🔗 REFERRAL SYSTEM V3: Sistema de Afiliados (backend-first)
// ═══════════════════════════════════════════════════════════════════
import trackVisitorRoute from "./api/referral/track-visitor.js";
import linkRegistrationRoute from "./api/referral/link-registration.js";
import partnerDashboardRoute from "./api/partner/dashboard.js";

app.use("/api/referral/track-visitor", trackVisitorRoute);
app.use("/api/referral/link-registration", linkRegistrationRoute);
app.use("/api/partner/dashboard", partnerDashboardRoute);
console.log('🔗 [REFERRAL-V3] Sistema de afiliados registrado:');
console.log('   - POST /api/referral/track-visitor (rastrear visitante com ?ref)');
console.log('   - POST /api/referral/link-registration (vincular cadastro)');
console.log('📊 [PARTNER-DASH] Painel de afiliados registrado:');
console.log('   - GET /api/partner/dashboard?partnerId=X (métricas READ-ONLY)');
console.log('📧 [WAITLIST] Rotas registradas:');
console.log('   - POST /api/waitlist (cadastrar lead + enviar e-mail)');
console.log('   - GET /api/waitlist/count (contar leads)');

// 🚀 LAUNCH: Sistema de disparo de e-mails de lançamento (protegido por chave)
app.use("/api/launch", launchRouter);
console.log('🚀 [LAUNCH] Rotas registradas:');
console.log('   - POST /api/launch/blast (disparo em massa - requer chave)');
console.log('   - POST /api/launch/test (envio de teste - requer chave)');
console.log('   - GET /api/launch/status (verificar status - requer chave)');
console.log('   - POST /api/launch/schedule-check (verificação agendada - requer chave)');

// 🎯 CORRECTION PLAN: Rota para gerar plano de correção com IA
app.post("/api/correction-plan", async (req, res) => {
  console.log('[CORRECTION-PLAN] 📥 POST /api/correction-plan recebido');
  try {
    await correctionPlanHandler(req, res);
  } catch (error) {
    console.error('[CORRECTION-PLAN] ❌ Erro:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'INTERNAL_ERROR', 
        message: 'Erro ao processar plano de correção' 
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🚀 AUTOMASTER V1: Sistema de masterização automática
// ═══════════════════════════════════════════════════════════════════

// Middleware de upload para AutoMaster
const automasterUpload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/x-wav'];
    if (allowedTypes.includes(file.mimetype) || /\.(wav|mp3|flac)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use WAV, MP3 ou FLAC'));
    }
  }
});

// Servir pasta de masters gerados
app.use('/masters', express.static(path.join(process.cwd(), 'uploads')));
console.log('🎚️ [AUTOMASTER] Pasta /masters configurada para servir arquivos');

// 📊 PRÉ-ANÁLISE: Valida se mix está apta para masterização
app.post('/api/analyze-for-master', verifyFirebaseToken, automasterUpload.single('file'), async (req, res) => {
  console.log('📊 [AUTOMASTER] PRÉ-ANÁLISE iniciada');

  // Validação de fileKey para evitar path traversal
  const SAFE_FILEKEY_RE = /^[a-zA-Z0-9/_\-.]+$/;

  let tempFilePath = null; // caminho de arquivo temporário a ser limpo no finally

  try {
    const genre = req.body.genre || 'unknown';

    if (req.file) {
      // Fluxo manual: arquivo enviado diretamente via FormData
      console.log('✅ [AUTOMASTER] Arquivo recebido (upload direto):', req.file.originalname);
      tempFilePath = req.file.path;
    } else if (req.body.fileKey) {
      // Fluxo contínuo: arquivo já está no storage B2 — download para uso local
      const fileKey = req.body.fileKey;

      if (typeof fileKey !== 'string' || fileKey.length > 500 || !SAFE_FILEKEY_RE.test(fileKey)) {
        console.error('❌ [AUTOMASTER] fileKey inválido na pré-análise:', fileKey);
        return res.status(400).json({ error: 'fileKey inválido' });
      }

      console.log('✅ [AUTOMASTER] Pré-análise via fileKey:', fileKey);
      const fileBuffer = await storageServiceModule.downloadFile(fileKey);

      tempFilePath = path.join(os.tmpdir(), `pre_analysis_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
      await fs.promises.writeFile(tempFilePath, fileBuffer);
    } else {
      console.error('❌ [AUTOMASTER] Nenhum arquivo ou fileKey enviado na pré-análise');
      return res.status(400).json({ error: 'Arquivo não enviado. Envie um arquivo ou forneça um fileKey.' });
    }

    console.log('🎵 [AUTOMASTER] Gênero:', genre);
    console.log('📁 [AUTOMASTER] Path local:', tempFilePath);

    // TODO: Integrar com analisador real de áudio usando tempFilePath
    // Por enquanto, retorna resposta válida simulada
    const response = {
      apt: true,
      lufs: -18.2,
      truePeak: -1.5,
      headroom: 6.5,
      clipping: false,
      tonalBalance: 'balanced',
      recommendedMode: 'MEDIUM',
      message: 'Mix analisada e apta para masterização'
    };

    console.log('✅ [AUTOMASTER] Pré-análise concluída:', response);
    return res.json(response);

  } catch (err) {
    console.error('❌ [AUTOMASTER] Erro na pré-análise:', err);
    return res.status(500).json({ error: 'Erro na análise', details: err.message });
  } finally {
    // Limpar arquivo temporário após análise (download de B2 ou upload direto)
    if (tempFilePath) {
      setTimeout(() => {
        fs.unlink(tempFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.warn('⚠️ [AUTOMASTER] Erro ao deletar arquivo temporário:', unlinkErr);
          } else {
            console.log('🗑️ [AUTOMASTER] Arquivo temporário removido:', tempFilePath);
          }
        });
      }, 1000);
    }
  }
});

// 🎚️ PROCESSAMENTO ASSÍNCRONO: Enfileira masterização automática
app.post('/api/automaster', verifyFirebaseToken, automasterUpload.single('file'), async (req, res) => {
  console.log('🎚️ [AUTOMASTER] INÍCIO - Enfileirando job');

  // Validação de fileKey para evitar path traversal
  const SAFE_FILEKEY_RE = /^[a-zA-Z0-9/_\-.]+$/;

  try {
    // ─── ANTI-ABUSE: Fingerprint + IP check para usuários free ───────────────
    // Executado ANTES de qualquer I/O para falhar rapidamente.
    // Usuários com plano pago ignoram este bloco.
    const _usageUid  = req.user.uid;
    const _userPlan  = await getUserPlan(_usageUid).catch(() => 'free');

    console.log('[AUTOMASTER] uid:', _usageUid, '| plan:', _userPlan);

    if (_userPlan === 'free') {
      const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.ip
               || '0.0.0.0';
      const _fp = (typeof req.body.fingerprintId === 'string')
                  ? req.body.fingerprintId.trim().substring(0, 128)
                  : '';

      console.log('[AUTOMASTER] fingerprintId recebido:', _fp ? _fp.substring(0, 12) + '…' : '(vazio)', '| ip:', _ip);

      if (!_fp) {
        // Sem fingerprintId: pode ser falha no carregamento do script — aplica apenas IP check
        console.warn('[AUTOMASTER] fingerprintId ausente para usuário free (aplicando apenas IP check):', _usageUid);
        if (!isIPAllowed(_ip)) {
          return res.status(403).json({
            error:   'FREE_LIMIT_REACHED',
            code:    'FREE_LIMIT_REACHED',
            message: 'Limite gratuito atingido. Aguarde 24h ou faça upgrade para continuar.',
            reason:  'IP_LIMIT_REACHED',
          });
        }
        // IP OK e sem fingerprint → permitir mas registrar IP
        req._freeUsageContext = { userId: _usageUid, fingerprintId: '', ip: _ip };
      } else {
        const _usageCheck = await checkFreeUsage({ userId: _usageUid, fingerprintId: _fp, ip: _ip });
        if (!_usageCheck.allowed) {
          console.warn('[AUTOMASTER] FREE_LIMIT_REACHED uid:', _usageUid, 'reason:', _usageCheck.reason);
          return res.status(403).json({
            error:   'FREE_LIMIT_REACHED',
            code:    'FREE_LIMIT_REACHED',
            message: 'Limite gratuito atingido. Aguarde 24h ou faça upgrade para continuar.',
            reason:  _usageCheck.reason,
          });
        }

        // Salvar referências para registerFreeUsage após enfileirar com sucesso
        req._freeUsageContext = { userId: _usageUid, fingerprintId: _fp, ip: _ip };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Resolver o buffer de áudio: fileKey (fluxo contínuo) ou arquivo direto (fluxo manual)
    let fileBuffer = null;
    let fileLabel  = null; // apenas para logs

    if (req.file) {
      // Fluxo manual: arquivo recebido via FormData
      fileLabel  = req.file.originalname;
      fileBuffer = await fs.promises.readFile(req.file.path);
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('⚠️ [AUTOMASTER] Erro ao deletar temp (upload direto):', err);
        else     console.log('🗑️ [AUTOMASTER] Arquivo temporário removido (upload direto)');
      });
    } else if (req.body.fileKey) {
      // Fluxo contínuo: arquivo já está no storage B2
      const fileKey = req.body.fileKey;
      if (typeof fileKey !== 'string' || fileKey.length > 500 || !SAFE_FILEKEY_RE.test(fileKey)) {
        console.error('❌ [AUTOMASTER] fileKey inválido:', fileKey);
        return res.status(400).json({ error: 'fileKey inválido' });
      }
      fileLabel  = fileKey;
      fileBuffer = await storageServiceModule.downloadFile(fileKey);
      console.log('✅ [AUTOMASTER] Arquivo baixado do storage via fileKey:', fileKey);
    } else {
      console.error('❌ [AUTOMASTER] Nenhum arquivo ou fileKey enviado');
      return res.status(400).json({ error: 'Arquivo não enviado. Envie um arquivo ou forneça um fileKey.' });
    }

    // 2. Validar modo
    const VALID_MODES = ['STREAMING', 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
    const rawMode = req.body.mode;
    const mode = rawMode ? rawMode.toString().toUpperCase().trim() : null;

    console.log('[AUTOMASTER] Mode recebido:', mode);

    // Fallback seguro: modo ausente → MEDIUM
    const resolvedMode = mode || 'MEDIUM';

    if (!VALID_MODES.includes(resolvedMode)) {
      console.error('❌ [AUTOMASTER] Modo inválido:', resolvedMode);
      return res.status(400).json({
        error: 'INVALID_MODE',
        received: resolvedMode,
        validModes: VALID_MODES
      });
    }

    // Dependências carregadas via import estático no topo do arquivo
    const automasterQueue = automasterQueueModule;
    const storageService = storageServiceModule;
    const jobStore = jobStoreModule;

    // Validar que o módulo da fila está disponível (Queue é lazy — Redis só conecta no 1º add())
    // Erros de conexão com Redis surfaceiam ao chamar add() mais abaixo (tratados no try/catch)
    if (!automasterQueue || typeof automasterQueue.add !== 'function') {
      console.error('[AUTOMASTER] automasterQueueModule inválido:', {
        queueType: typeof automasterQueue,
        addType: typeof automasterQueue?.add
      });
      return res.status(503).json({
        error: 'QUEUE_UNAVAILABLE',
        message: 'Fila de processamento indisponível'
      });
    }

    // ─── GERAR JOB ID ────────────────────────────────────────────────────────
    const jobId = uuidv4();
    console.log('🆔 [AUTOMASTER] Job ID:', jobId);

    // ─── CHECK + LOCK + CRIAR JOB (FIRESTORE TRANSACTION) ───────────────────
    // Verifica em uma única transaction atômica:
    //   1. User lock (sem job ativo simultâneo)
    //   2. Elegibilidade de crédito (plano/trial/saldo)
    // NÃO consome crédito aqui — consumo acontece APÓS sucesso do DSP.
    let firestoreJobCreated = false;
    try {
      await createJobWithTransaction(req.user.uid, jobId, {
        fileKey:  req.body.fileKey || null,
        mode:     resolvedMode,
      });
      firestoreJobCreated = true;
    } catch (jobErr) {
      console.error('❌ [AUTOMASTER] Erro ao criar job Firestore:', jobErr.message);
      const code   = jobErr.code || 'JOB_CREATE_ERROR';
      const status = code === 'NO_CREDITS' ? 402
                   : code === 'PROCESS_ALREADY_RUNNING' ? 409
                   : code === 'USER_NOT_FOUND' ? 404
                   : 500;
      return res.status(status).json({ error: code, message: jobErr.message, code });
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log('✅ [AUTOMASTER] Arquivo resolvido:', fileLabel);
    console.log('⚙️ [AUTOMASTER] Modo (resolvido):', resolvedMode);

    // Contexto completo do request (visível nos logs do Railway)
    console.log('[AUTOMASTER] Criando job com dados:', {
      mode: resolvedMode,
      fileLabel,
      fileSize: fileBuffer.length,
      userId: req.user?.uid || 'anonymous',
      nodeEnv: process.env.NODE_ENV,
      hasRedisUrl: !!process.env.REDIS_URL || !!process.env.REDIS_PRIVATE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    });

    // 4. Upload para storage (input) — sempre sob input/{jobId}.wav para o worker
    console.log('☁️ [AUTOMASTER] Fazendo upload para storage...');
    const inputKey = `input/${jobId}.wav`;
    await storageService.uploadFile(inputKey, fileBuffer, 'audio/wav');
    console.log('✅ [AUTOMASTER] Upload concluído:', inputKey);

    // [FILE INTEGRITY] upload_received
    const _uploadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    console.log('[FILE INTEGRITY] stage: upload_received | path:', inputKey, '| size_bytes:', fileBuffer.length, '| sha256:', _uploadHash);

    // 5. Criar job no job-store (Redis)
    console.log('[AUTOMASTER] Pré-jobStore.createJob — jobId:', jobId, '| inputKey:', inputKey, '| mode:', resolvedMode);
    await jobStore.createJob(jobId, {
      inputKey: inputKey,
      mode: resolvedMode,
      userId: req.user?.uid || 'anonymous',
      original_filename: fileLabel || null
    });

    // 6. Adicionar job à fila BullMQ
    console.log('[AUTOMASTER] Pré-BullMQ.add — payload:', {
      jobId,
      inputKey,
      mode: resolvedMode,
      userId: req.user?.uid || 'anonymous'
    });
    await automasterQueue.add('process', {
      jobId,
      inputKey,
      mode: resolvedMode,
      userId: req.user?.uid || 'anonymous'
    }, {
      jobId, // ID explícito para idempotência
      priority: req.user?.isPremium ? 1 : 5 // Priorização por tier
    });

    console.log('✅ [AUTOMASTER] Job enfileirado com sucesso');

    // 7. Registrar job no PostgreSQL (para status unificado via /api/jobs/:id)
    // Não crítico: Redis job-store é a fonte primária para automaster
    try {
      await jobsPool.query(
        `INSERT INTO jobs (id, file_key, mode, type, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'automaster', 'queued', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [jobId, inputKey, resolvedMode]
      );
      console.log('✅ [AUTOMASTER] Job registrado no PostgreSQL (jobId:', jobId, ')');
    } catch (pgErr) {
      // Não bloquear o fluxo — Redis continua sendo o estado canônico
      console.warn('⚠️ [AUTOMASTER] Falha ao registrar no PostgreSQL (não crítico):', pgErr.message);
    }

    // 9. Responder imediatamente (NÃO esperar processamento)
    // Registrar uso free antes de responder (fire-and-forget, não bloqueia)
    if (req._freeUsageContext) {
      registerFreeUsage(req._freeUsageContext).catch(err =>
        console.warn('[AUTOMASTER] registerFreeUsage error (non-fatal):', err.message)
      );
    }

    return res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      message: 'Job de masterização criado com sucesso',
      estimatedTime: resolvedMode === 'STREAMING' ? 40 : resolvedMode === 'LOW' ? 30 : resolvedMode === 'MEDIUM' ? 60 : 120,
      statusUrl: `/api/automaster/status/${jobId}`
    });

  } catch (error) {
    console.error('[AUTOMASTER] ERRO REAL AO CRIAR JOB:', error.message);
    console.error('[AUTOMASTER] STACK:', error.stack);
    console.error('[AUTOMASTER] Contexto do erro:', {
      errorName: error.name,
      errorCode: error.code,
      requestMode: req.body?.mode,
      hasFile: !!req.file
    });

    // Cleanup em caso de erro
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    // Se o job Firestore foi criado antes do erro (upload/redis falharam),
    // liberar o lock para o usuário não ficar preso.
    if (firestoreJobCreated && req.user?.uid && jobId) {
      releaseUserLock(req.user.uid, jobId).catch(() => {});
    }

    return res.status(500).json({
      error: 'JOB_CREATION_FAILED',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// 🔍 STATUS: Consulta status de um job de masterização
app.get('/api/automaster/status/:jobId', verifyFirebaseToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    console.log('🔍 [AUTOMASTER-STATUS] Consultando job:', jobId);

    const job = await jobStoreModule.getJob(jobId);

    if (!job) {
      return res.status(404).json({ 
        error: 'Job não encontrado',
        jobId 
      });
    }

    console.log('✅ [AUTOMASTER-STATUS] Job encontrado:', job.status);

    // Montar resposta baseada no status
    const response = {
      jobId,
      status: job.status,
      progress: job.progress || 0,
      createdAt: job.created_at,
      mode: job.mode
    };

    // Adicionar campos específicos por status
    if (job.status === 'processing') {
      response.startedAt = job.started_at;
      response.message = 'Processando masterização...';
    } else if (job.status === 'completed') {
      response.finishedAt = job.finished_at;
      response.processingMs = job.processing_ms;
      response.outputKey = job.output_key;

      // ── PAYWALL: Verificar plano antes de gerar URL de download ─────────────
      // Usuários free recebem downloadBlocked=true — download exige upgrade.
      // Usuários pagos recebem downloadUrl normalmente.
      const _statusUserPlan = await getUserPlan(req.user.uid).catch(() => 'free');
      const _statusIsPaid   = ['plus', 'pro', 'dj', 'studio'].includes(_statusUserPlan);

      if (_statusIsPaid) {
        // Gerar URL assinada para download (30 minutos — tempo suficiente para download)
        // Filename passado para forçar Content-Disposition: attachment no B2 —
        // sem isso, browser tenta reproduzir o WAV inline ao usar <a href> diretamente.
        if (job.output_key) {
          const originalName = job.original_filename || jobId;
          const safeName = originalName
            .replace(/\.[^/.]+$/, '')            // remove extensão
            .replace(/[^a-zA-Z0-9\-]/g, '_');   // chars inválidos → _
          const dlFilename = `Master SoundyAI_${safeName}.wav`;
          response.downloadUrl = await storageServiceModule.generateSignedUrl(job.output_key, 1800, dlFilename);
        }
      } else {
        // Free: bloquear download — não gerar URL assinada
        response.downloadBlocked     = true;
        response.downloadBlockedCode = 'FREE_PLAN';
        response.downloadUrl         = null;
        console.log('[AUTOMASTER-STATUS] Download bloqueado (plano free) — uid:', req.user.uid, 'jobId:', jobId);
      }
      // ────────────────────────────────────────────────────────────────────────

      // Preview URLs: antes = input original, depois = preview 60s gerado no worker
      if (job.input_key) {
        response.previewBefore = await storageServiceModule.generateSignedUrl(job.input_key, 1800);
      }
      if (job.preview_after_key) {
        response.previewAfter = await storageServiceModule.generateSignedUrl(job.preview_after_key, 1800);
      }

      // Métricas para exibição no modal de preview
      const _tpBeforeNum   = job.true_peak_before ? parseFloat(job.true_peak_before) : null;
      const _lufsBeforeNum = job.lufs_before      ? parseFloat(job.lufs_before)      : null;

      // mix_not_apt: usar flag salvo pelo worker OU recalcular a partir das métricas originais
      // (defense-in-depth: se o worker não salvou o flag, o servidor detecta pelos valores brutos)
      const _mixNotAptFlag    = job.mix_not_apt === '1';
      const _mixNotAptMetrics = (
        (_tpBeforeNum   != null && _tpBeforeNum   >= -1.0) ||   // True Peak original >= -1.0 dBTP
        (_lufsBeforeNum != null && _lufsBeforeNum >= -10.0)     // LUFS original >= -10.0 (já masterizado)
      );
      const _mixNotApt = _mixNotAptFlag || _mixNotAptMetrics;

      console.log('[API-MIXNOTAPT] job_id:', jobId,
        '| mix_not_apt_field:', job.mix_not_apt,
        '| flag:', _mixNotAptFlag,
        '| from_metrics:', _mixNotAptMetrics,
        '| final:', _mixNotApt,
        '| tp_before:', _tpBeforeNum,
        '| lufs_before:', _lufsBeforeNum);

      response.metrics = {
        lufsBefore:     _lufsBeforeNum,
        truePeakBefore: _tpBeforeNum,
        lufsAfter:      job.lufs_after       ? parseFloat(job.lufs_after)       : null,
        truePeakAfter:  job.true_peak_after  ? parseFloat(job.true_peak_after)  : null,
        drBefore:       job.dr_before        ? parseFloat(job.dr_before)        : null,
        drAfter:        job.dr_after         ? parseFloat(job.dr_after)         : null,
        headroomBefore: job.headroom_before  ? parseFloat(job.headroom_before)  : null,
        headroomAfter:  job.headroom_after   ? parseFloat(job.headroom_after)   : null,
        mixNotApt:      _mixNotApt,
      };

      response.message = 'Masterização concluída com sucesso';

      // delivery_mode indica o caminho usado: primary | safe | warning
      if (job.delivery_mode) {
        response.deliveryMode = job.delivery_mode;
        if (job.delivery_mode === 'safe') {
          response.message = 'Masterização segura concluída com sucesso';
        }
      }

      // Aviso de proteção sônica: job completado mas modo era agressivo
      if (job.warning === '1') {
        response.warning = true;
        response.recommendedMode = job.recommended_mode || 'MEDIUM';
        response.warningMessage = job.warning_message || 'A música já está próxima do limite seguro. Aplicar esse modo poderia degradar a qualidade.';
        response.message = 'Masterização concluída com aviso de proteção sônica';
      }

      // ── CONSUMIR CRÉDITO APÓS SUCESSO (idempotente) ──────────────────────────
      // Apenas aqui, após o DSP ter concluído com sucesso, o crédito é debitado.
      // A função é idempotente: se já consumido (poll anterior), silencia e continua.
      consumeJobCredit(req.user.uid, jobId).catch(err =>
        console.error('⚠️ [AUTOMASTER-STATUS] consumeJobCredit error (não fatal):', err.message)
      );
    } else if (job.status === 'needs_confirmation') {
      // Problemas técnicos detectados — aguardando confirmação do usuário para masterização segura
      response.status = 'needs_confirmation';
      response.problems = (() => { try { return JSON.parse(job.not_apt_reasons || '[]'); } catch { return []; } })();
      response.measured  = (() => { try { return JSON.parse(job.not_apt_measured  || '{}'); } catch { return {}; } })();
      response.classifiers = (() => { try { return JSON.parse(job.confirmation_classifiers || '{}'); } catch { return {}; } })();
      response.mode = job.selected_mode || job.mode;
      response.message = 'Seu áudio apresenta limitações técnicas. Vamos aplicar um processamento seguro para preservar a qualidade.';
    } else if (job.status === 'not_apt') {
      // Guardrail de aptidão: música não apta para o modo solicitado
      response.status = 'not_apt';
      response.mode = job.selected_mode;
      response.reasons = (() => { try { return JSON.parse(job.not_apt_reasons || '[]'); } catch { return []; } })();
      response.measured = (() => { try { return JSON.parse(job.not_apt_measured || '{}'); } catch { return {}; } })();
      response.recommendedActions = job.recommended_mode ? [job.recommended_mode] : ['MEDIUM'];
      response.message = 'Música não recomendada para o modo selecionado';

      // ── LIBERAR LOCK SEM COBRANÇA (modo incompatível — não é erro do usuário) ─
      releaseUserLock(req.user.uid, jobId).catch(err =>
        console.error('⚠️ [AUTOMASTER-STATUS] releaseUserLock (not_apt) error:', err.message)
      );
    } else if (job.status === 'needs_mode_change') {
      // Proteção sônica: modo incompatível com o material — não é falha técnica
      response.type = 'MODE_INCOMPATIBLE';
      response.selectedMode = job.selected_mode;
      response.recommendedMode = job.recommended_mode;
      response.reason = job.error_message;
      response.abortReason = job.abort_reason;
      response.message = 'Modo selecionado incompatível com o material de entrada';

      // ── LIBERAR LOCK SEM COBRANÇA ─────────────────────────────────────────────
      releaseUserLock(req.user.uid, jobId).catch(err =>
        console.error('⚠️ [AUTOMASTER-STATUS] releaseUserLock (needs_mode_change) error:', err.message)
      );
    } else if (job.status === 'failed') {
      response.error = job.error;
      response.errorCode = job.error_code;
      response.failedAt = job.failed_at;
      response.attempt = job.attempt;
      response.message = 'Falha no processamento';

      // Compatibilidade: jobs antigos que gravaram como failed com error_code MODE_INCOMPATIBLE
      if (job.error_code === 'MODE_INCOMPATIBLE') {
        response.type = 'MODE_INCOMPATIBLE';
        response.selectedMode = job.selected_mode;
        response.recommendedMode = job.recommended_mode;
        response.reason = job.error_message;
        response.abortReason = job.abort_reason;
        response.message = 'Modo selecionado incompatível com o material de entrada';
      }

      // ── LIBERAR LOCK SEM COBRANÇA (DSP falhou) ───────────────────────────────
      releaseUserLock(req.user.uid, jobId).catch(err =>
        console.error('⚠️ [AUTOMASTER-STATUS] releaseUserLock (failed) error:', err.message)
      );
    } else if (job.status === 'queued') {
      response.message = 'Aguardando na fila...';
    }

    return res.json(response);

  } catch (error) {
    console.error('❌ [AUTOMASTER-STATUS] Erro ao consultar status:', error);
    return res.status(500).json({
      error: 'Falha ao consultar status',
      details: error.message
    });
  }
});

// 🔄 CONFIRMAR MASTERIZAÇÃO SEGURA: Re-enfileira job com safeMode=true após confirmação do usuário
app.post('/api/automaster/confirm/:jobId', verifyFirebaseToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    console.log('🔄 [AUTOMASTER-CONFIRM] Confirmando masterização segura para job:', jobId);

    const job = await jobStoreModule.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado', jobId });
    }

    if (job.user_id && job.user_id !== 'anonymous' && job.user_id !== req.user.uid) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (job.status !== 'needs_confirmation') {
      return res.status(409).json({
        error: 'Job não está aguardando confirmação',
        currentStatus: job.status,
        jobId
      });
    }

    const inputKey = job.input_key || job.file_key;
    const mode = job.mode;
    const userId = job.user_id;

    if (!inputKey || !mode) {
      return res.status(500).json({ error: 'Dados do job incompletos para re-enfileiramento', jobId });
    }

    // Resetar status para queued
    await jobStoreModule.updateJobStatus(jobId, 'queued', {
      progress: 0,
      safe_mode: '1'
    });

    // Re-enfileirar com safeMode=true (automasterQueueModule já importado no topo)
    await automasterQueueModule.add('process', {
      jobId,
      inputKey,
      mode,
      userId: userId || 'anonymous',
      safeMode: true
    }, {
      jobId: `${jobId}_safe_${Date.now()}`,
      priority: 1 // prioridade alta para não deixar usuário esperando
    });

    console.log('✅ [AUTOMASTER-CONFIRM] Job re-enfileirado com safeMode:', jobId);

    return res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      safeMode: true,
      message: 'Masterização segura iniciada com sucesso',
      statusUrl: `/api/automaster/status/${jobId}`
    });

  } catch (error) {
    console.error('❌ [AUTOMASTER-CONFIRM] Erro:', error.message);
    return res.status(500).json({
      error: 'Falha ao confirmar masterização segura',
      details: error.message
    });
  }
});

// 📥 PROXY DOWNLOAD: Faz download do arquivo final pelo servidor (evita CORS com URLs assinadas)
//
// SOLUÇÃO PARA net::ERR_FAILED 200 (OK):
//   Causa: buffer completo (50-100 MB) → timeout do proxy antes de terminar de enviar.
//   Fix:   pipe stream direto do B2 para o browser — dados fluem em paralelo,
//          sem esperar download completo, sem guardar arquivo inteiro em RAM.
app.get('/api/automaster/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    // ── AUTENTICAÇÃO: aceitar token via header (XHR) ou query param (navegação direta) ──
    let rawToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.split('Bearer ')[1].trim();
    } else if (req.query.token && typeof req.query.token === 'string') {
      rawToken = req.query.token.trim();
    }
    if (!rawToken) {
      return res.status(401).json({ error: 'unauthorized', message: 'Token de autenticação ausente.' });
    }
    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(rawToken);
      uid = decoded.uid;
    } catch (authErr) {
      console.error('❌ [PROXY-DOWNLOAD] Token inválido:', authErr.message);
      return res.status(401).json({ error: 'unauthorized', message: 'Token inválido ou expirado.' });
    }
    // ──────────────────────────────────────────────────────────────────────────

    console.log('[PROXY-DOWNLOAD] Iniciando download — uid:', uid, 'jobId:', jobId);

    const job = await jobStoreModule.getJob(jobId);

    if (!job || job.status !== 'completed' || !job.output_key) {
      return res.status(404).json({ error: 'Download não disponível' });
    }

    if (job.user_id && job.user_id !== 'anonymous' && job.user_id !== uid) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // ── PAYWALL: Plano pago OU crédito avulso (creditsLimit > creditsUsed) ───
    const _dlUserPaid = await hasPaidPlan(uid).catch(() => false);

    let _dlHasCredit = false;
    if (!_dlUserPaid) {
      try {
        const _snap = await getFirestore().collection('usuarios').doc(uid).get();
        const _data = _snap.exists ? (_snap.data() || {}) : {};
        const _used  = Math.max(typeof _data.creditsUsed  === 'number' ? _data.creditsUsed  : 0, 0);
        const _limit = Math.max(typeof _data.creditsLimit === 'number' ? _data.creditsLimit : 0, 0);
        _dlHasCredit = _limit > _used;
        console.log(`[AUTOMASTER-DOWNLOAD] Crédito avulso — uid: ${uid} | creditsUsed: ${_used} | creditsLimit: ${_limit} | hasCredit: ${_dlHasCredit}`);
      } catch (_snapErr) {
        console.error('[AUTOMASTER-DOWNLOAD] Erro ao verificar crédito avulso:', _snapErr.message);
      }
    }

    if (!_dlUserPaid && !_dlHasCredit) {
      console.log('[AUTOMASTER-DOWNLOAD] Bloqueado (free + sem crédito) — uid:', uid, 'jobId:', jobId);
      return res.status(403).json({
        error:   'FREE_USED',
        code:    'FREE_USED',
        message: 'Download disponível apenas para planos pagos. Faça upgrade para baixar sua master.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const originalName = job.original_filename || jobId;
    const safeName = originalName
      .replace(/\.[^/.]+$/, '')            // remove extensão
      .replace(/[^a-zA-Z0-9\-]/g, '_');   // chars inválidos → _
    const dlFilename = `Master SoundyAI_${safeName}.wav`;

    // Abrir stream do B2 — sem bufferizar em memória
    const { stream, contentLength } = await storageServiceModule.getFileStream(job.output_key);

    // ── DIAGNÓSTICO: logar início, tamanho e eventos do stream ────────────────
    const dlStart = Date.now();
    console.log(JSON.stringify({
      event: 'download_start',
      jobId,
      outputKey: job.output_key,
      contentLength,        // null = B2 não retornou tamanho (possível problema)
      timestamp: new Date().toISOString(),
    }));

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${dlFilename}"`);
    res.setHeader('Cache-Control', 'no-store');
    // Content-Length removido: era a causa do download_client_abort imediato.
    // Valor incorreto ou divergente do stream real fazia o proxy/browser abortar em ~300ms.
    // Node gerencia Transfer-Encoding: chunked automaticamente sem Content-Length.

    // Pipe: dados do B2 → browser em tempo real, sem buffer intermediário
    stream.pipe(res);

    // ── DIAGNÓSTICO: stream concluiu com sucesso ───────────────────────────────
    stream.on('end', () => {
      console.log(JSON.stringify({
        event: 'download_stream_end',
        jobId,
        durationMs: Date.now() - dlStart,
        timestamp: new Date().toISOString(),
      }));
    });

    // ── DIAGNÓSTICO: stream falhou (ex: B2 fechou conexão) ────────────────────
    stream.on('error', (streamErr) => {
      console.error(JSON.stringify({
        event: 'download_stream_error',
        jobId,
        error: streamErr.message,
        durationMs: Date.now() - dlStart,
        timestamp: new Date().toISOString(),
      }));
      if (!res.headersSent) {
        res.status(500).json({ error: 'Falha no download', details: streamErr.message });
      } else {
        res.end();
      }
    });

    // ── DIAGNÓSTICO: cliente fechou a conexão antes do fim ────────────────────
    // Causas: usuário cancelou, proxy timeout, aba fechada
    res.on('close', () => {
      const finished = res.writableEnded;
      if (!finished) {
        console.warn(JSON.stringify({
          event: 'download_client_abort',
          jobId,
          durationMs: Date.now() - dlStart,
          note: 'Conexão fechada pelo cliente/proxy ANTES do fim — possível timeout ou cancelamento',
          timestamp: new Date().toISOString(),
        }));
      }
    });

  } catch (error) {
    console.error('❌ [PROXY-DOWNLOAD] Erro:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Falha no download', details: error.message });
    }
  }
});

// ⚠️ ENDPOINT LEGADO (MANTER POR COMPATIBILIDADE - MAS NÃO USAR)
// Este endpoint foi migrado para processamento assíncrono acima
// Mantido apenas para não quebrar integrações antigas
app.post('/api/automaster-legacy-sync', automasterUpload.single('file'), async (req, res) => {
  console.warn('⚠️ [AUTOMASTER-LEGACY] Endpoint síncrono (DEPRECATED)');
  return res.status(410).json({
    error: 'Endpoint descontinuado',
    message: 'Use /api/automaster (assíncrono) em vez deste endpoint',
    migration: {
      newEndpoint: '/api/automaster',
      statusEndpoint: '/api/automaster/status/:jobId'
    }
  });
});

// 💳 CONFIRMAR DOWNLOAD: Registra download após masterização
// O crédito já foi consumido atomicamente em /api/automaster ANTES do DSP.
// Este endpoint apenas valida auth, registra o evento e retorna saldo atual.
app.post('/api/automaster/consume-credit', verifyFirebaseToken, async (req, res) => {
  console.log('💳 [AUTOMASTER] Registro de download iniciado — uid:', req.user.uid);

  try {
    const { mode, fileName } = req.body;
    console.log('⚙️ [AUTOMASTER] Modo no download:', mode);
    console.log('📁 [AUTOMASTER] Arquivo no download:', fileName);

    // Buscar saldo atual para retornar ao front
    const db   = getFirestore();
    const snap = await db.collection('usuarios').doc(req.user.uid).get();

    if (!snap.exists) {
      return res.json({ success: true, message: 'Download registrado', creditsRemaining: 0, creditsUsed: 0, creditsLimit: 0 });
    }

    const data         = snap.data();
    const creditsUsed  = typeof data.creditsUsed  === 'number' ? data.creditsUsed  : 0;
    const creditsLimit = typeof data.creditsLimit === 'number' ? data.creditsLimit : 0;
    const remaining    = Math.max(0, creditsLimit - creditsUsed);

    console.log('✅ [AUTOMASTER] Download registrado — used:', creditsUsed, '/', creditsLimit);
    return res.json({
      success: true,
      message: 'Download registrado',
      creditsRemaining: remaining,
      creditsUsed,
      creditsLimit,
      plan: data.plan || 'free',
    });

  } catch (err) {
    console.error('❌ [AUTOMASTER] Erro ao registrar download:', err);
    return res.status(500).json({ error: 'Erro ao registrar download', details: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// � FEEDBACK DE MASTER: coleta avaliação 👍/👎 do usuário
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/automaster/feedback
 * Salva o feedback (liked: true/false) do usuário sobre uma master concluída.
 * Idempotente por jobId: a mesma escrita sobrescreve qualquer envio anterior.
 * Não bloqueia o usuário se falhar — tratado como fire-and-forget no frontend.
 *
 * Body: { jobId: string, liked: boolean }
 * Auth: requer token Firebase válido
 */
app.post('/api/automaster/feedback', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { jobId, liked, genre: bodyGenre } = req.body;

    if (typeof jobId !== 'string' || !jobId.trim()) {
      return res.status(400).json({ error: 'jobId inválido.' });
    }
    if (typeof liked !== 'boolean') {
      return res.status(400).json({ error: 'liked deve ser boolean.' });
    }

    const db = getFirestore();

    // Verificar se o job pertence ao usuário antes de salvar
    const jobSnap = await db.collection('automasterJobs').doc(jobId.trim()).get();
    if (!jobSnap.exists || jobSnap.data().uid !== uid) {
      return res.status(403).json({ error: 'Job não encontrado ou não pertence ao usuário.' });
    }

    // Buscar plano e email em paralelo (Firestore + Firebase Auth)
    const [userSnap, userRecord] = await Promise.all([
      db.collection('usuarios').doc(uid).get(),
      getAuth().getUser(uid).catch(() => null),
    ]);

    const plan  = userSnap.exists ? (userSnap.data().plan || 'free') : 'free';
    const email = userRecord?.email ?? null;

    // Mode vem do Firestore (gravado na criação do job)
    const jobData = jobSnap.data();
    const mode = jobData.mode ?? null;

    // Genre vem do frontend (seletor de gênero musical da análise) — null se não enviado
    const genre = (typeof bodyGenre === 'string' && bodyGenre.trim()) ? bodyGenre.trim() : null;

    // lufs_out e tp_out vêm do Redis (job-store) — gravados pelo worker após processamento
    let lufs_out = null;
    let tp_out   = null;

    try {
      const redisJob = await jobStoreModule.getJob(jobId.trim());
      if (redisJob) {
        lufs_out = redisJob.lufs_after       ? parseFloat(redisJob.lufs_after)       : null;
        tp_out   = redisJob.true_peak_after  ? parseFloat(redisJob.true_peak_after)  : null;
      }
    } catch (redisErr) {
      // Não crítico — feedback salva sem métricas
      console.warn('[FEEDBACK] Falha ao buscar métricas do Redis (não crítico):', redisErr.message);
    }

    // Salvar feedback — idempotente por userId+jobId (1 feedback por usuário por job)
    await db.collection('automaster_feedback').doc(`${uid}_${jobId.trim()}`).set({
      userId:    uid,
      email,
      jobId:     jobId.trim(),
      liked,
      plan,
      mode,
      genre,
      lufs_out,
      tp_out,
      createdAt: Date.now(),
    });

    console.log(`👍 [FEEDBACK] uid=${uid} jobId=${jobId} liked=${liked} mode=${mode} genre=${genre} lufs=${lufs_out} tp=${tp_out}`);
    return res.json({ success: true });

  } catch (err) {
    console.error('❌ [FEEDBACK] Erro ao salvar feedback:', err);
    return res.status(500).json({ error: 'Erro ao salvar feedback.' });
  }
});

// ════════════════════════════════════════════════════════════════
// �📜 HISTÓRICO DE MASTERS: salva e lista masterizações do usuário
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/user/masters/save
 * Salva uma entrada no histórico de masters do usuário.
 * Chamado pelo frontend no momento do download (fire-and-forget).
 * Idempotente: usa jobId como ID do documento Firestore.
 */
app.post('/api/user/masters/save', verifyFirebaseToken, async (req, res) => {
  try {
    const uid   = req.user.uid;
    const { jobId } = req.body;

    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    // Busca o job no Redis para obter metadados
    const job = await jobStoreModule.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }
    if (job.status !== 'completed' || !job.output_key) {
      return res.status(400).json({ error: 'Job não está completo ou sem output' });
    }
    // Garante que o job pertence ao usuário autenticado
    if (job.user_id && job.user_id !== 'anonymous' && job.user_id !== uid) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const db        = getFirestore();
    const docRef    = db.collection('usuarios').doc(uid)
                        .collection('masters').doc(jobId);
    const existing  = await docRef.get();

    // Idempotência: se já existe, retorna sucesso sem sobrescrever
    if (existing.exists) {
      return res.json({ success: true, alreadyExists: true });
    }

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 dias

    await docRef.set({
      jobId,
      fileName:   job.original_filename || jobId,
      storageKey: job.output_key,
      mode:       job.mode || null,
      createdAt:  now.toISOString(),
      expiresAt:  expiresAt.toISOString(),
    });

    console.log(`✅ [HISTORY] Histórico salvo — uid:${uid} jobId:${jobId}`);
    return res.json({ success: true });

  } catch (err) {
    console.error('❌ [HISTORY] Erro ao salvar histórico:', err.message);
    return res.status(500).json({ error: 'Erro ao salvar histórico', details: err.message });
  }
});

/**
 * GET /api/user/masters
 * Retorna a lista de masters do usuário autenticado, ordenada por data decrescente.
 * Exclui entradas expiradas (>30 dias).
 */
app.get('/api/user/masters', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const db  = getFirestore();

    const snapshot = await db.collection('usuarios').doc(uid)
                             .collection('masters')
                             .orderBy('createdAt', 'desc')
                             .limit(50)
                             .get();

    const now     = new Date();
    const masters = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filtra entradas expiradas
      if (data.expiresAt && new Date(data.expiresAt) < now) return;
      masters.push({
        jobId:      data.jobId,
        fileName:   data.fileName,
        storageKey: data.storageKey,
        mode:       data.mode,
        createdAt:  data.createdAt,
        expiresAt:  data.expiresAt,
      });
    });

    return res.json({ success: true, masters });

  } catch (err) {
    console.error('❌ [HISTORY] Erro ao listar histórico:', err.message);
    return res.status(500).json({ error: 'Erro ao listar histórico', details: err.message });
  }
});

/**
 * GET /api/user/masters/:jobId/download
 * Gera URL assinada fresca (30 min) para re-download de um item do histórico.
 * Verifica que o usuário é dono do registro antes de gerar a URL.
 */
app.get('/api/user/masters/:jobId/download', verifyFirebaseToken, async (req, res) => {
  try {
    const uid    = req.user.uid;
    const { jobId } = req.params;

    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    const db     = getFirestore();
    const doc    = await db.collection('usuarios').doc(uid)
                           .collection('masters').doc(jobId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Item não encontrado no histórico' });
    }

    const data = doc.data();
    const now  = new Date();

    // Verifica expiração (30 dias)
    if (data.expiresAt && new Date(data.expiresAt) < now) {
      return res.status(410).json({ error: 'Arquivo expirado (>30 dias)' });
    }

    if (!data.storageKey) {
      return res.status(500).json({ error: 'storageKey ausente no registro' });
    }

    // Gera nome seguro para download
    const safeName = (data.fileName || jobId)
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9\-]/g, '_');
    const dlFilename = `Master SoundyAI_${safeName}.wav`;

    // Gera URL assinada fresca (30 minutos)
    const signedUrl = await storageServiceModule.generateSignedUrl(
      data.storageKey,
      1800,
      dlFilename
    );

    return res.json({ success: true, downloadUrl: signedUrl, fileName: data.fileName });

  } catch (err) {
    console.error('❌ [HISTORY] Erro ao gerar URL de download:', err.message);
    return res.status(500).json({ error: 'Erro ao gerar URL de download', details: err.message });
  }
});

console.log('🚀 [AUTOMASTER-V1] Rotas registradas:');
console.log('   - POST /api/analyze-for-master (pré-análise)');
console.log('   - POST /api/automaster (processamento)');
console.log('   - POST /api/automaster/consume-credit (consumo de crédito)');
console.log('   - GET /masters/* (arquivos masterizados)');
console.log('   - POST /api/user/masters/save (salvar histórico)');
console.log('   - GET /api/user/masters (listar histórico)');
console.log('   - GET /api/user/masters/:jobId/download (re-download histórico)');

// ---------- ROTA DE CONFIGURAÇÃO DA API KEY (RAILWAY) ----------
app.get("/api/config", (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // Nunca expor a chave completa, apenas confirmar que existe
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    const masked = openaiApiKey.substring(0, 10) + '...';
    console.log('🔑 [CONFIG-API] API Key disponível:', masked);
    
    res.json({
      aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
      configured: true
    });
  } else {
    console.warn('⚠️ [CONFIG-API] API Key NÃO configurada no Railway');
    res.json({
      openaiApiKey: 'not-configured',
      configured: false
    });
  }
});

// ---------- ROTA REVOLUCIONÁRIA DE SUGESTÕES IA ----------
app.post("/api/suggestions", async (req, res) => {
  try {
    const { suggestions, metrics, genre } = req.body;

    console.log(`🚀 [AI-API] Recebidas ${suggestions?.length || 0} sugestões para processamento`);

    // Validação dos dados de entrada
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      console.error("❌ [AI-API] Lista de sugestões inválida");
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória e não pode estar vazia",
        received: suggestions
      });
    }

    // Se não tiver API key, retornar erro (não fallback)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.error("⚠️ [AI-API] OpenAI API Key não configurada");
      return res.status(503).json({
        success: false,
        error: 'API Key da IA não configurada',
        source: 'error',
        message: 'Configure OPENAI_API_KEY nas variáveis de ambiente'
      });
    }

    console.log(`📋 [AI-API] Construindo prompt para ${suggestions.length} sugestões do gênero: ${genre || 'geral'}`);

    // Construir prompt para TODAS as sugestões
    const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

    console.log(`🤖 [AI-API] Enviando prompt para OpenAI...`);

    // Chamar OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 🚀 UPGRADE: Modelo mais inteligente e barato,
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em pré-masterização e mixagem, com foco em análise técnica objetiva.

CONTEXTO: Você está analisando uma MIX em fase PRÉ-MASTER — NÃO o produto final masterizado.

REGRAS ABSOLUTAS:
1. Gere APENAS sugestões baseadas nestas 4 métricas: LUFS, True Peak, Dynamic Range (DR), Crest Factor.
2. PROIBIDO gerar sugestões sobre: bandas de frequência, EQ, ajustes de Hz, estéreo, imagem estéreo, loudness para streaming ou plataformas, loudness competitivo.
3. NÃO fale como se fosse o produto final. Fale como avaliação técnica da mix antes da masterização.
4. Linguagem: objetiva, técnica, direta. Sem exageros, sem "nível Grammy", sem "top 100".
5. Gere no máximo 3 sugestões no array. Se houver menos problemas reais, gere menos.
6. Cada sugestão DEVE ter o campo "metric" preenchido com exatamente um dos valores: "lufs", "truePeak", "dr" ou "crestFactor".
7. Se não houver problemas reais nessas 4 métricas, retorne um array vazio: []

FORMATO JSON OBRIGATÓRIO (ARRAY de no máximo 3 itens, ou vazio):
[
  {
    "metric": "lufs|truePeak|dr|crestFactor",
    "problema": "Descrição objetiva: [Métrica] está em [valor medido], valor esperado é [alvo]. Ex: 'LUFS está em -8 dBFS, o que é alto para uma mix em fase pré-master.'",
    "causa": "Impacto técnico direto na etapa de masterização. Ex: 'Um LUFS alto nesta etapa reduz o headroom disponível para o processamento de master.'",
    "solucao": "Ação prática e direta sobre a mix. Ex: 'Reduza o ganho geral da mix para aproximar o LUFS de -18 a -14 dBFS antes da masterização.'",
    "dica_extra": "Contexto técnico adicional relevante para esta etapa de pré-master.",
    "plugin": "Ferramenta de medição ou ajuste específica para esta métrica."
  }
]

EXEMPLO CORRETO:
[
  {
    "metric": "lufs",
    "problema": "LUFS Integrado está em -8 dBFS. Para uma mix em fase pré-master, o valor está muito alto.",
    "causa": "Sua mix está com LUFS muito alto para essa etapa, o que pode comprometer a masterização. O headroom necessário para compressão e limitação está reduzido.",
    "solucao": "Reduza o nível geral da mix. O ideal para uma mix pré-master é entre -18 e -14 LUFS. Verifique se há camadas com ganho excessivo acumulado.",
    "dica_extra": "Evite usar um limiter para compensar o LUFS agora. Deixe esse ajuste para a etapa de master.",
    "plugin": "Youlean Loudness Meter (grátis) ou iZotope Insight para monitoramento."
  }
]

RESPONDA EXCLUSIVAMENTE COM JSON VÁLIDO (ARRAY), sem markdown, sem texto extra.
`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 4500, // 🚀 Mais tokens para respostas detalhadas
        top_p: 0.95,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      console.error("❌ Erro na API da OpenAI:", openaiResponse.status, openaiResponse.statusText);
      throw new Error(`OpenAI API retornou ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    let aiSuggestion = openaiData.choices[0]?.message?.content || "";

    // 🔒 Sanitização extra antes do parse
    aiSuggestion = aiSuggestion
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    if (!aiSuggestion) {
      throw new Error('Resposta vazia da IA');
    }

    // Processar resposta da IA (JSON array com itens enriquecidos)
    const expected = suggestions.length;
    const { items: parsedItems, repaired } = safeParseEnrichedArray(aiSuggestion, expected);
    console.log(`[AI-PROCESSING] JSON ${repaired ? 'REPARADO' : 'OK'} - itens parseados: ${parsedItems.length}/${expected}`);

    // Garantir cardinalidade: preencher faltantes com fallback das originais
    let enhancedSuggestions = ensureCardinality(parsedItems, suggestions);

    // Normalização de prioridade
    let normalizedCount = 0;
    enhancedSuggestions = enhancedSuggestions.map((sug) => {
      const isAI = sug.ai_enhanced === true;
      const rootPriority = typeof sug.priority === 'string' ? sug.priority : (isAI ? 'alta' : undefined);
      const meta = sug.metadata || {};
      const metaPriority = typeof meta.priority === 'string' ? meta.priority : (isAI ? 'alta' : undefined);
      if (isAI && (rootPriority !== 'alta' || metaPriority !== 'alta')) normalizedCount++;
      return {
        ...sug,
        priority: rootPriority || (isAI ? 'alta' : 'média'),
        metadata: { ...meta, priority: metaPriority || (isAI ? 'alta' : 'média') },
      };
    });
    console.log(`[AI-NORMALIZE] priority aplicados (alta) nas enriquecidas: ${normalizedCount}`);

    console.log(`✅ [AI-API] Processamento concluído:`, {
      suggestionsOriginais: suggestions.length,
      suggestionsEnriquecidas: enhancedSuggestions.length,
      sucessoTotal: enhancedSuggestions.length === suggestions.length ? 'SIM' : 'PARCIAL'
    });

    // Garantir que todas têm priority string antes de enviar
    const finalEnhanced = enhancedSuggestions.map((sug) => ({
      ...sug,
      metadata: {
        ...(sug.metadata || {}),
        priority: typeof sug?.metadata?.priority === 'string' ? sug.metadata.priority : 'alta',
      },
    }));

    res.json({
      success: true,
      enhancedSuggestions: finalEnhanced,
      source: 'ai',
      message: `${finalEnhanced.length} sugestões enriquecidas pela IA`,
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: finalEnhanced.length,
        genre: genre || 'não especificado',
        processingTime: Date.now(),
        aiSuccess: finalEnhanced.filter(s=>s.ai_enhanced === true).length,
        aiErrors: Math.max(0, suggestions.length - finalEnhanced.filter(s=>s.ai_enhanced === true).length)
      }
    });

  } catch (error) {
    console.error("❌ [AI-API] Erro crítico no processamento:", error.message);
    const originals = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
    const fallback = originals.map((s) => fallbackFromOriginal(s));
    console.log(`[AI-PROCESSING] Fallback total aplicado: ${fallback.length}/${originals.length}`);
    res.status(200).json({
      success: true,
      enhancedSuggestions: fallback,
      source: 'ai',
      message: `${fallback.length} sugestões (fallback) enviadas`,
      metadata: {
        originalCount: originals.length,
        enhancedCount: fallback.length,
        aiSuccess: 0,
        aiErrors: originals.length
      }
    });
  }
});

// 🎛️ Função auxiliar para garantir caps por banda (limites máximos em dB)
function clampDeltaByBand(band, delta) {
  const caps = {
    sub: 6,           // Sub (20–60Hz): ±6 dB
    bass: 6,          // Bass (60–150Hz): ±6 dB  
    low_mid: 5,       // Low-Mid (150–500Hz): ±5 dB
    mid: 5,           // Mid (500Hz–2kHz): ±5 dB
    high_mid: 5,      // High-Mid (2–5kHz): ±5 dB
    presence: 5,      // Presence (5–10kHz): ±5 dB
    air: 4,           // Air (10–20kHz): ±4 dB
    
    // Aliases para compatibilidade
    lowMid: 5,
    highMid: 5,
    presenca: 5,
    brilho: 4
  };
  
  const maxCap = caps[band] || 5; // Default 5 dB se banda não encontrada
  return Math.max(-maxCap, Math.min(maxCap, delta));
}

// 📊 Função para calcular ajuste proporcional baseado no delta
function calculateProportionalAdjustment(delta, band) {
  const caps = {
    sub: 6, bass: 6, low_mid: 5, mid: 5, high_mid: 5, presence: 5, air: 4,
    lowMid: 5, highMid: 5, presenca: 5, brilho: 4
  };
  
  const clampedDelta = clampDeltaByBand(band, delta);
  const absDelta = Math.abs(clampedDelta);
  
  let minAdjust, maxAdjust;
  
  // Proporcionalidade: quanto maior o delta, maior o ajuste (respeitando caps)
  if (absDelta <= 3) {
    // Diferença pequena: correção mínima (30-60% do delta)
    minAdjust = Math.max(1, Math.floor(absDelta * 0.3));
    maxAdjust = Math.max(2, Math.ceil(absDelta * 0.6));
  } else if (absDelta <= 6) {
    // Diferença moderada: ajuste intermediário (50-75% do delta)
    minAdjust = Math.max(2, Math.floor(absDelta * 0.5));
    maxAdjust = Math.max(3, Math.ceil(absDelta * 0.75));
  } else {
    // Diferença grande: ajuste máximo permitido pelo cap (75-100% do delta)
    minAdjust = Math.max(3, Math.floor(absDelta * 0.75));
    maxAdjust = Math.min(caps[band] || 5, Math.ceil(absDelta * 1.0));
  }
  
  // Garantir que não ultrapasse os caps
  const maxCap = caps[band] || 5;
  minAdjust = Math.min(minAdjust, maxCap);
  maxAdjust = Math.min(maxAdjust, maxCap);
  
  // Manter sinal do delta original
  const sign = clampedDelta >= 0 ? '+' : '-';
  
  return {
    range: `${sign}${minAdjust} a ${sign}${maxAdjust} dB`,
    direction: clampedDelta > 0 ? 'reforçar' : 'reduzir',
    intensity: absDelta <= 3 ? 'suavemente' : absDelta <= 6 ? 'moderadamente' : 'com mais ênfase'
  };
}

// 🔧 Função para preprocessar sugestões aplicando caps e calculando ajustes proporcionais
function preprocessSuggestions(suggestions) {
  return suggestions.map((s, i) => {
    let enhancedSuggestion = { ...s };
    
    // Se a sugestão tem dados técnicos com delta e banda, calcular ajuste proporcional
    if (s.technical && s.technical.delta && s.subtype) {
      const band = s.subtype.toLowerCase();
      const adjustment = calculateProportionalAdjustment(s.technical.delta, band);
      
      enhancedSuggestion.adjustmentGuide = {
        originalDelta: s.technical.delta,
        suggestedRange: adjustment.range,
        direction: adjustment.direction,
        intensity: adjustment.intensity,
        band: band
      };
    }
    
    return enhancedSuggestion;
  });
}

// Função para construir o prompt da IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const preprocessedSuggestions = preprocessSuggestions(suggestions);

  const suggestionsList = preprocessedSuggestions.map((s, i) => {
    let entry = `${i + 1}. MÉTRICA: ${s.metric || s.key || 'N/A'} — ${s.message || s.title || 'Sugestão'}`;
    if (s.currentValue !== undefined && s.targetValue !== undefined) {
      entry += ` (valor atual: ${s.currentValue}${s.unit || ''}, alvo: ${s.targetValue}${s.unit || ''})`;
    }
    return entry;
  }).join('\n');

  const metricsInfo = metrics ? `MÉTRICAS DA MIX (pré-master):
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU
- LRA: ${metrics.lra || 'N/A'} LU
- Crest Factor: ${metrics.crestFactor || 'N/A'} dB` : '';

  const expected = Math.min(suggestions.length, 3);
  return `Analise as seguintes detecções de uma MIX em fase pré-master para o gênero: ${genre || 'não especificado'}.

DETECÇÕES:
${suggestionsList}

${metricsInfo}

Gere exatamente ${expected} sugestão(ões) em formato JSON (ARRAY).
Cada item DEVE ter o campo "metric" preenchido com: "lufs", "truePeak", "dr" ou "crestFactor".
NÃO gere sugestões de EQ, bandas de frequência, estéreo ou loudness para distribuição.
Se não houver problemas reais nessas métricas, retorne um array vazio: []
`;
}

// Função para obter contexto educativo e musical do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA - LINGUAGEM E PRIORIDADES:
- LINGUAGEM: Use termos do funk ("grave pesado", "vocal cristalino", "pancada no peito")
- SUB/BASS (20-150Hz): PRIORITÁRIO - Deve "bater no peito" sem mascarar o kick
  • Plugin ideal: Waves Renaissance Bass, FabFilter Pro-MB
  • Dica: Side-chain com kick, preserve groove 
- MÉDIOS (200Hz-2kHz): Vocal sempre em evidência, cuidado com máscara
  • Plugin ideal: FabFilter Pro-Q3, Waves C6
  • Dica: EQ complementar (corta onde vocal precisa brilhar)
- AGUDOS (5-15kHz): Controlado, nunca agressivo
  • Plugin ideal: De-Esser nativo, Waves DeEsser
  • Resultado: "Hi-hat crocante, vocal inteligível"
- TARGETS: DR 4-6 | True Peak -1dBTP | LUFS -8 a -12`,
    
    trance: `
🎵 CONTEXTO TRANCE - LINGUAGEM E PRIORIDADES:  
- LINGUAGEM: Use termos eletrônicos ("kick punchy", "lead cortante", "atmosfera ampla")
- SUB (20-60Hz): Limpo e controlado para não competir com kick
  • Plugin ideal: FabFilter Pro-Q3 high-pass, Waves Renaissance Bass
  • Dica: Mono até 100Hz, side-chain com kick
- KICK (60-120Hz): Deve ser o protagonista dos graves
  • Plugin ideal: FabFilter Pro-MB, compressão multibanda
  • Resultado: "Kick perfurado, presença definida"
- LEADS (2-8kHz): Brilhantes mas não agressivos, com espaço para vocal
  • Plugin ideal: FabFilter Pro-Q3, harmonic exciter sutil
  • Dica: Use EQ dinâmico para não brigar com vocal
- REVERB/DELAY: Equilibrado, sem máscara
  • Resultado: "Atmosfera ampla, leads definidos, kick presente"
- TARGETS: DR 3-5 | True Peak -0.5dBTP | LUFS -6 a -9`,
    
    bruxaria: `
🎵 CONTEXTO BRUXARIA - LINGUAGEM E PRIORIDADES:
- LINGUAGEM: Use termos atmosféricos ("texturas orgânicas", "ambiência natural", "dinâmica respirante")
- GRAVES (20-100Hz): Livres e orgânicos, nunca over-processed
  • Plugin ideal: EQ vintage (Neve, API emulation), compressão suave
  • Dica: Preserve transientes naturais, menos side-chain
- MÉDIOS (200Hz-2kHz): Atmosféricos, com espaço para respirar
  • Plugin ideal: EQ analógico modelado, compressão ótica
  • Resultado: "Vozes orgânicas, instrumentos com corpo natural"
- AGUDOS (5-20kHz): Texturizados, nunca limpos demais
  • Plugin ideal: EQ vintage, tape saturation sutil
  • Dica: Harmônicos naturais, evite filtros digitais duros
- DINÂMICA: Preserve variações naturais, menos limitação
  • Resultado: "Mix respirante, texturas ricas, ambiência natural"
- TARGETS: DR 6-12 | True Peak -3 a -1dBTP | LUFS -12 a -16`,

    electronic: `
🎵 CONTEXTO ELETRÔNICO GERAL:
- LINGUAGEM: "Precisão digital", "punch eletrônico", "clareza sintética"
- SUB (20-80Hz): Controlado digitalmente, mono perfeito
  • Plugin ideal: FabFilter Pro-Q3, análise em tempo real
- MÉDIOS: Separação precisa entre elementos sintéticos  
  • Plugin ideal: EQ dinâmico, compressão multibanda
- AGUDOS: Cristalinos mas não metálicos
  • Resultado: "Sínteses definidas, espacialização precisa"
- TARGETS: DR 4-8 | True Peak -1dBTP | LUFS -8 a -12`,

    hip_hop: `
🎵 CONTEXTO HIP HOP:
- LINGUAGEM: "Boom bap", "vocal na frente", "groove pesado"
- SUB/KICK: Deve "bater forte" sem distorção
  • Plugin ideal: Waves CLA Bass, side-chain com vocal
- VOCAL: SEMPRE protagonista, clareza total
  • Plugin ideal: Waves CLA Vocals, De-Esser obrigatório
- SAMPLES: Preserve caráter original, evite over-processing
  • Resultado: "Vocal cristalino, beat pesado, samples com alma"
- TARGETS: DR 5-8 | True Peak -1dBTP | LUFS -9 a -13`
  };
  
  return contexts[genre] || contexts[detectGenreType(genre)] || `
🎵 CONTEXTO MUSICAL GERAL:
- LINGUAGEM: Seja educativo e musical, evite jargões técnicos pesados
- GRAVES: Balance presença vs. limpeza, preserve groove natural
  • Plugin ideal: EQ nativo da DAW, compressor suave
- MÉDIOS: Foque na inteligibilidade, evite máscara entre elementos
  • Plugin ideal: FabFilter Pro-Q3, EQ dinâmico
- AGUDOS: Brilho sem agressividade, preserve naturalidade
  • Plugin ideal: De-Esser nativo, EQ shelf suave
- FILOSOFIA: "Realce a musicalidade, preserve a emoção"
- RESULTADO: "Mix equilibrado, musical e profissional"`;
}

// Função auxiliar para detectar tipo de gênero
function detectGenreType(genre) {
  if (!genre) return null;
  
  const genreLower = genre.toLowerCase();
  
  if (genreLower.includes('funk') || genreLower.includes('mandela')) return 'funk_mandela';
  if (genreLower.includes('trance') || genreLower.includes('progressive')) return 'trance';  
  if (genreLower.includes('brux') || genreLower.includes('ambient')) return 'bruxaria';
  if (genreLower.includes('electronic') || genreLower.includes('edm') || genreLower.includes('house')) return 'electronic';
  if (genreLower.includes('hip') || genreLower.includes('rap') || genreLower.includes('trap')) return 'hip_hop';
  
  return null;
}

// 🧪 Função de teste para validar caps e proporcionalidade
function testRealisticSuggestions() {
  console.log('🧪 [TESTE] Validando sistema de caps e proporcionalidade...');
  
  const testCases = [
    { band: 'sub', delta: -2.5, expected: 'ajuste mínimo (1-2 dB)' },
    { band: 'bass', delta: -7.0, expected: 'ajuste máximo limitado ao cap (6 dB)' },
    { band: 'mid', delta: 4.5, expected: 'ajuste intermediário (2-4 dB)' },
    { band: 'presence', delta: -12.0, expected: 'ajuste máximo limitado ao cap (5 dB)' },
    { band: 'air', delta: 2.0, expected: 'ajuste mínimo (1-2 dB)' }
  ];
  
  testCases.forEach(test => {
    const clampedDelta = clampDeltaByBand(test.band, test.delta);
    const adjustment = calculateProportionalAdjustment(test.delta, test.band);
    
    console.log(`📊 Banda: ${test.band} | Delta original: ${test.delta} dB`);
    console.log(`   ✂️ Delta limitado: ${clampedDelta} dB`);
    console.log(`   🎯 Ajuste sugerido: ${adjustment.range}`);
    console.log(`   📝 Esperado: ${test.expected}`);
    console.log(`   ✅ Status: ${Math.abs(clampedDelta) <= (test.band === 'air' ? 4 : test.band.includes('mid') || test.band === 'presence' ? 5 : 6) ? 'PASSOU' : 'FALHOU'}\n`);
  });
  
  return true;
}

// Helpers de parse e fallback
function safeParseEnrichedArray(aiContent, expectedLength) {
  let repaired = false;
  try {
    const clean = aiContent.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return { items: parsed, repaired };
    if (parsed && Array.isArray(parsed.suggestions)) return { items: parsed.suggestions, repaired };
    throw new Error('Formato inválido: não é array');
  } catch (e1) {
    try {
      const onlyArray = extractJsonArray(aiContent);
      const fixed = fixTrailingCommas(onlyArray);
      const parsed2 = JSON.parse(fixed);
      repaired = true;
      if (Array.isArray(parsed2)) return { items: parsed2, repaired };
      return { items: [], repaired };
    } catch (e2) {
      console.error('[AI-PROCESSING] Falha no parse/reparo de JSON:', e1.message, '|', e2.message);
      return { items: [], repaired };
    }
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new Error('Array não encontrado');
  return text.slice(start, end + 1);
}

function fixTrailingCommas(jsonStr) {
  return jsonStr
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\u0000/g, '');
}

function ensureCardinality(parsedItems, originalSuggestions) {
  const expected = originalSuggestions.length;
  const result = [];
  for (let i = 0; i < expected; i++) {
    const aiItem = parsedItems[i];
    if (aiItem && typeof aiItem === 'object') {
      result.push(normalizeEnrichedItem(aiItem, true));
    } else {
      result.push(fallbackFromOriginal(originalSuggestions[i]));
    }
  }
  return result;
}

function normalizeEnrichedItem(item, aiEnhanced) {
  return {
    problema: item.problema || '',
    causa: item.causa || '',
    solucao: item.solucao || '',
    dica_extra: item.dica_extra || '',
    plugin: item.plugin || '',
    resultado: item.resultado || '',
    ai_enhanced: aiEnhanced === true,
    priority: 'alta',
    metadata: { priority: 'alta' }
  };
}

function fallbackFromOriginal(s) {
  return {
    problema: `⚠️ ${s.message || s.title || 'Problema detectado'}`,
    causa: 'Análise automática identificou desvio dos padrões de referência',
    solucao: `🛠️ ${s.action || s.description || 'Ajuste recomendado pelo sistema'}`,
    dica_extra: '💡 Valide em diferentes sistemas de áudio',
    plugin: '🎹 EQ/Compressor nativo da DAW ou gratuito',
    resultado: '✅ Melhoria de clareza e compatibilidade',
    ai_enhanced: false,
    priority: 'média',
    metadata: { priority: 'média' }
  };
}


// ═══════════════════════════════════════════════════════════════
// 🔐 BUILD INFO: Checksum e rastreabilidade
// ═══════════════════════════════════════════════════════════════
function calculateHandlerChecksum() {
  const handlerPath = path.join(__dirname, 'work', 'api', 'jobs', '[id].js');
  try {
    const content = fs.readFileSync(handlerPath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  } catch (err) {
    return 'unknown';
  }
}

function logBuildInfo() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔐 BUILD INFORMATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Service Name: SoundyAI API');
  console.log('Build Signature: REF-BASE-FIX-2025-12-18');
  console.log('Build SHA:', process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev');
  console.log('Handler Checksum (MD5):', calculateHandlerChecksum());
  console.log('Handler Path: work/api/jobs/[id].js');
  console.log('Node Version:', process.version);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);

  // 📦 Worker AutoMaster inline (ativo quando AUTOMASTER_INLINE_WORKER !== 'false')
  // Desative definindo AUTOMASTER_INLINE_WORKER=false no Railway para usar servico separado.
  if (process.env.AUTOMASTER_INLINE_WORKER !== 'false') {
    const workerPath = path.resolve(__dirname, 'queue/automaster-worker.cjs');
    console.log('[INLINE-WORKER] Iniciando worker AutoMaster:', workerPath);

    function spawnWorker() {
      // [ENV AUDIT] Confirmar vars B2 no momento do spawn — valor real herdado pelo worker
      console.log('[ENV SERVER] B2 env vars no spawn:', {
        B2_ENDPOINT:    process.env.B2_ENDPOINT    || '(undefined)',
        B2_BUCKET_NAME: process.env.B2_BUCKET_NAME || '(undefined)',
        B2_KEY_ID:      process.env.B2_KEY_ID      ? '(set)' : '(undefined)',
        B2_APP_KEY:     process.env.B2_APP_KEY     ? '(set)' : '(undefined)',
        B2_DOWNLOAD_URL: process.env.B2_DOWNLOAD_URL || '(undefined)',
      });

      const workerProc = spawn(process.execPath, [workerPath], {
        env: process.env,
        stdio: 'inherit' // compartilha stdout/stderr com o servidor (visível nos logs do Railway)
      });

      console.log('[INLINE-WORKER] Worker PID:', workerProc.pid);

      workerProc.on('exit', (code, signal) => {
        console.warn(`[INLINE-WORKER] Worker finalizou (code=${code}, signal=${signal}). Reiniciando em 3s...`);
        setTimeout(spawnWorker, 3000);
      });

      workerProc.on('error', (err) => {
        console.error('[INLINE-WORKER] Erro ao spawnar worker:', err.message);
      });
    }

    spawnWorker();
  } else {
    console.log('[INLINE-WORKER] Desabilitado — usando servico de worker separado no Railway.');
  }

  // 🗄️ Migration AutoMaster — garante colunas sem derrubar o boot
  await ensureAutomasterSchema(jobsPool);
  
  // 🔐 Log de build info para rastreabilidade
  logBuildInfo();
  
  // 🎬 Verificar se FFmpeg está instalado (necessário para AutoMaster V1)
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎬 VERIFICAÇÃO FFMPEG (AutoMaster V1)');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 5000 });
    const versionLine = ffmpegVersion.split('\n')[0];
    console.log('✅ [SYSTEM] FFmpeg detectado:', versionLine);
    console.log('✅ [SYSTEM] AutoMaster V1 pronto para conversão de áudio');
  } catch (err) {
    console.error('❌ [SYSTEM] FFmpeg NÃO encontrado');
    console.error('⚠️  [SYSTEM] AutoMaster V1 não funcionará sem FFmpeg');
    console.error('💡 [SYSTEM] Certifique-se de que railway.json possui "nixpacks": { "packages": ["ffmpeg"] }');
  }
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // 🧪 Executar testes de validação na inicialização (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔧 [DEV] Executando testes de validação...');
    testRealisticSuggestions();
  }

  // 📊 Monitor de memória do SoundyAI-app (a cada 60s)
  const memMonitor = setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MEM-MONITOR][soundyai-app] PID=${process.pid} | RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB | Heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  }, 60000);
  memMonitor.unref();
});

export default app;