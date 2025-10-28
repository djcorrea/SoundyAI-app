// start-combo.js - INICIADOR COMBINADO API + WORKER
// 🚀 Executa API e Worker simultaneamente em produção

import { spawn } from 'child_process';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`🚀 [COMBO][${new Date().toISOString()}] -> Iniciando SoundyAI (API + Worker)...`);
console.log(`🌍 [COMBO][${new Date().toISOString()}] -> Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📋 [COMBO][${new Date().toISOString()}] -> PID: ${process.pid}`);
console.log(`📁 [COMBO][${new Date().toISOString()}] -> Working Directory: ${process.cwd()}`);

// ---------- Verificar dependências críticas ----------
const requiredEnvs = ['REDIS_URL'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> ERRO CRÍTICO: Variáveis ausentes: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`✅ [COMBO][${new Date().toISOString()}] -> Variáveis de ambiente verificadas`);

// ---------- Caminhos dos arquivos ----------
const serverPath = path.join(__dirname, 'server.js');
const workerPath = path.join(__dirname, 'worker-redis.js');

console.log(`📂 [COMBO][${new Date().toISOString()}] -> Caminho API: ${serverPath}`);
console.log(`📂 [COMBO][${new Date().toISOString()}] -> Caminho Worker: ${workerPath}`);

// ---------- Variáveis de controle ----------
let apiProcess = null;
let workerProcess = null;
let isShuttingDown = false;

// ---------- Função para encerrar processos ----------
function killProcesses() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`📥 [COMBO][${new Date().toISOString()}] -> Encerrando API e Worker...`);
  
  if (apiProcess && !apiProcess.killed) {
    console.log(`🔴 [COMBO][${new Date().toISOString()}] -> Encerrando API...`);
    apiProcess.kill('SIGTERM');
  }
  
  if (workerProcess && !workerProcess.killed) {
    console.log(`🔴 [COMBO][${new Date().toISOString()}] -> Encerrando Worker...`);
    workerProcess.kill('SIGTERM');
  }
  
  setTimeout(() => {
    console.log(`⏰ [COMBO][${new Date().toISOString()}] -> Timeout atingido, forçando encerramento...`);
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill('SIGKILL');
    }
    if (workerProcess && !workerProcess.killed) {
      workerProcess.kill('SIGKILL');
    }
    process.exit(0);
  }, 10000);
}

// ---------- Iniciar API ----------
console.log(`🌐 [COMBO][${new Date().toISOString()}] -> 🚀 Iniciando API (work/server.js)...`);
apiProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname
});

// ---------- Iniciar Worker ----------  
console.log(`⚙️ [COMBO][${new Date().toISOString()}] -> 🚀 Iniciando Worker (work/worker-redis.js)...`);
workerProcess = spawn('node', [workerPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname
});

// ---------- Event Listeners API ----------
apiProcess.on('close', (code) => {
  console.log(`🔴 [COMBO][${new Date().toISOString()}] -> API encerrada com código ${code}`);
  if (code !== 0 && !isShuttingDown) {
    console.error(`🚨 [COMBO][${new Date().toISOString()}] -> API falhou, encerrando Worker...`);
    killProcesses();
    setTimeout(() => process.exit(1), 2000);
  }
});

apiProcess.on('error', (err) => {
  console.error(`� [COMBO][${new Date().toISOString()}] -> Erro na API:`, err.message);
  if (!isShuttingDown) {
    killProcesses();
    setTimeout(() => process.exit(1), 2000);
  }
});

// ---------- Event Listeners Worker ----------
workerProcess.on('close', (code) => {
  console.log(`� [COMBO][${new Date().toISOString()}] -> Worker encerrado com código ${code}`);
  if (code !== 0 && !isShuttingDown) {
    console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Worker falhou, encerrando API...`);
    killProcesses();
    setTimeout(() => process.exit(1), 2000);
  }
});

workerProcess.on('error', (err) => {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Erro no Worker:`, err.message);
  if (!isShuttingDown) {
    killProcesses();
    setTimeout(() => process.exit(1), 2000);
  }
});

// ---------- Graceful Shutdown ----------
process.on('SIGINT', () => {
  console.log(`📥 [COMBO][${new Date().toISOString()}] -> Recebido SIGINT, encerrando API e Worker...`);
  killProcesses();
});

process.on('SIGTERM', () => {
  console.log(`📥 [COMBO][${new Date().toISOString()}] -> Recebido SIGTERM, encerrando API e Worker...`);
  killProcesses();
});

process.on('uncaughtException', (err) => {
  console.error(`� [COMBO][${new Date().toISOString()}] -> Uncaught Exception:`, err.message);
  killProcesses();
  setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Unhandled Rejection:`, reason);
  killProcesses();
  setTimeout(() => process.exit(1), 2000);
});

// ---------- Health Check Endpoint ----------
const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 8082;

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'COMBO healthy',
    timestamp: new Date().toISOString(),
    processes: {
      api: apiProcess && !apiProcess.killed ? 'running' : 'dead',
      worker: workerProcess && !workerProcess.killed ? 'running' : 'dead'
    },
    environment: process.env.NODE_ENV || 'development',
    redis: process.env.REDIS_URL ? 'configured' : 'missing',
    pids: {
      combo: process.pid,
      api: apiProcess?.pid || null,
      worker: workerProcess?.pid || null
    }
  });
});

healthApp.listen(HEALTH_PORT, () => {
  console.log(`🏥 [COMBO][${new Date().toISOString()}] -> Health check rodando na porta ${HEALTH_PORT}`);
});

// ---------- Aguardar inicialização ----------
setTimeout(() => {
  console.log(`✅ [COMBO][${new Date().toISOString()}] -> API e Worker iniciados com sucesso!`);
  console.log(`📍 [COMBO][${new Date().toISOString()}] -> Health check: http://localhost:${HEALTH_PORT}/health`);
  console.log(`🎯 [COMBO][${new Date().toISOString()}] -> Aguardando jobs para processamento...`);
}, 2000);