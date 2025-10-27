// ecosystem.config.cjs - Configuração PM2 Otimizada
module.exports = {
  apps: [
    {
      name: 'app',
      script: 'api/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'audio-worker',
      script: 'worker-redis.js', 
      instances: 1,  // Apenas 1 worker para testar
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: 2  // Baixa concorrência para economizar requests Redis
      }
    }
  ]
};