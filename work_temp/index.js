// work/index.js - HEALTH CHECK APENAS
// ❌ WORKER LEGACY REMOVIDO - Redis workers responsáveis por todo processamento
import "dotenv/config";
import express from "express";

// ❌ REMOVIDO: Worker health monitoring (movido para worker-redis.js)
// ❌ REMOVIDO: Exception handlers (movidos para worker-redis.js)  
// ❌ REMOVIDO: Pipeline imports (movidos para worker-redis.js)
// ❌ REMOVIDO: PostgreSQL client (movido para worker-redis.js)
// ❌ REMOVIDO: Backblaze config (movido para worker-redis.js)

console.log("🏥 [INDEX] Health check server only - No worker processing");

// ❌ REMOVIDO: Função downloadFileFromBucket (movida para worker-redis.js)
// Legacy worker functions removed - Redis workers handle all processing

// ❌ REMOVIDO: Função analyzeAudioWithPipeline (movida para worker-redis.js)
// Legacy audio processing removed - Redis workers handle all pipeline execution

// ❌ REMOVIDO: Função processJob (movida para worker-redis.js)
// Legacy job processing removed - Redis workers handle all job execution

// ❌ REMOVIDO: Recovery de jobs órfãos (movido para worker-redis.js)
// Legacy job recovery removed - Redis workers handle orphaned job recovery

// ❌ REMOVIDO: Loop de processamento de jobs (movido para worker-redis.js)
// Legacy job processing loop removed - Redis workers handle all job polling

console.log("✅ [INDEX] Servidor de health check iniciado - Workers Redis responsáveis pelo processamento");

// ---------- Servidor Express APENAS para Health Check ----------
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ 
    status: 'Health check server only - Redis workers active', 
    timestamp: new Date().toISOString(),
    worker: 'disabled - redis only',
    architecture: 'redis-workers-only'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    worker: 'redis-only',
    timestamp: new Date().toISOString(),
    legacy_worker: 'disabled'
  });
});

app.listen(PORT, () => {
  console.log(`� [INDEX] Health check server rodando na porta ${PORT} - Redis workers responsáveis pelo processamento`);
});
