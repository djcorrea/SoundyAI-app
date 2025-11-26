// ecosystem.config.cjs - CONFIGURAÇÃO REDIS WORKERS ONLY (ARQUITETURA REFATORADA)
// 🚀 ESCALABILIDADE: 50+ jobs simultâneos sem conflitos
module.exports = {
  apps: [
    {
      name: 'soundy-api',
      script: 'server.js',          // ✅ API pura - sem processamento
      instances: 2,                 // 2 instâncias da API para alta disponibilidade
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log'
    },
    {
      name: 'soundy-workers',
      script: 'worker-redis.js',     // ✅ Worker Redis exclusivo
      instances: 10,                // 10 workers Redis
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: 5       // 5 jobs por worker = 50 total simultâneos
      },
      error_file: './logs/workers-error.log',
      out_file: './logs/workers-out.log',
      log_file: './logs/workers-combined.log'
    }
    // ❌ REMOVIDO: index.js (worker legacy)
    // ❌ REMOVIDO: api/server.js (substituído por server.js)
  ]
};