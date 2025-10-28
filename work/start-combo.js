// start-combo.js - INICIADOR COMBINADO API + WORKER
// 🚀 Executa API e Worker simultaneamente em produção

import { spawn } from 'child_process';
import path from 'path';

console.log(`🚀 [COMBO][${new Date().toISOString()}] -> Iniciando SoundyAI (API + Worker)...`);
console.log(`🌍 [COMBO][${new Date().toISOString()}] -> Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📋 [COMBO][${new Date().toISOString()}] -> PID: ${process.pid}`);

// ---------- Verificar dependências críticas ----------
const requiredEnvs = ['REDIS_URL'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> ERRO CRÍTICO: Variáveis ausentes: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`✅ [COMBO][${new Date().toISOString()}] -> Variáveis de ambiente verificadas`);

// ---------- Iniciar API ----------
console.log(`🌐 [COMBO][${new Date().toISOString()}] -> 🚀 Iniciando API (server.js)...`);
const api = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

// ---------- Iniciar Worker ----------  
console.log(`⚙️ [COMBO][${new Date().toISOString()}] -> 🚀 Iniciando Worker (worker-redis.js)...`);
const worker = spawn('node', ['worker-redis.js'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

// ---------- Event Listeners ----------
api.on('close', (code) => {
  console.error(`🔴 [COMBO][${new Date().toISOString()}] -> API encerrada com código ${code}`);
  if (code !== 0) {
    console.error(`🚨 [COMBO][${new Date().toISOString()}] -> API falhou, encerrando Worker...`);
    worker.kill();
    process.exit(1);
  }
});

worker.on('close', (code) => {
  console.error(`🔴 [COMBO][${new Date().toISOString()}] -> Worker encerrado com código ${code}`);
  if (code !== 0) {
    console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Worker falhou, encerrando API...`);
    api.kill();
    process.exit(1);
  }
});

api.on('error', (err) => {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Erro na API:`, err);
  worker.kill();
  process.exit(1);
});

worker.on('error', (err) => {
  console.error(`🚨 [COMBO][${new Date().toISOString()}] -> Erro no Worker:`, err);
  api.kill();
  process.exit(1);
});

// ---------- Graceful Shutdown ----------
process.on('SIGINT', () => {
  console.log(`📥 [COMBO][${new Date().toISOString()}] -> Recebido SIGINT, encerrando API e Worker...`);
  api.kill('SIGINT');
  worker.kill('SIGINT');
  
  setTimeout(() => {
    console.log(`⏰ [COMBO][${new Date().toISOString()}] -> Timeout atingido, forçando encerramento...`);
    api.kill('SIGKILL');
    worker.kill('SIGKILL');
    process.exit(0);
  }, 10000);
});

process.on('SIGTERM', () => {
  console.log(`📥 [COMBO][${new Date().toISOString()}] -> Recebido SIGTERM, encerrando API e Worker...`);
  api.kill('SIGTERM');
  worker.kill('SIGTERM');
  
  setTimeout(() => {
    console.log(`⏰ [COMBO][${new Date().toISOString()}] -> Timeout atingido, forçando encerramento...`);
    api.kill('SIGKILL');
    worker.kill('SIGKILL');
    process.exit(0);
  }, 10000);
});

// ---------- Health Check Endpoint ----------
import express from 'express';

const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 8082;

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'COMBO healthy',
    timestamp: new Date().toISOString(),
    processes: {
      api: api.killed ? 'dead' : 'running',
      worker: worker.killed ? 'dead' : 'running'
    },
    environment: process.env.NODE_ENV || 'development',
    redis: process.env.REDIS_URL ? 'configured' : 'missing'
  });
});

healthApp.listen(HEALTH_PORT, () => {
  console.log(`🏥 [COMBO][${new Date().toISOString()}] -> Health check rodando na porta ${HEALTH_PORT}`);
});

console.log(`✅ [COMBO][${new Date().toISOString()}] -> API e Worker iniciados com sucesso!`);
console.log(`📍 [COMBO][${new Date().toISOString()}] -> Health check: http://localhost:${HEALTH_PORT}/health`);