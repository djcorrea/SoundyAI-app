// PM2 Configuration for BullMQ Audio Workers
// Usage: pm2 start scripts/pm2/pm2.config.cjs

module.exports = {
  apps: [{
    name: 'worker-bull',
    script: 'workers/worker.bull.js',
    instances: 'max', // Um worker por core disponível
    exec_mode: 'cluster',
    
    // Configurações de ambiente
    env: {
      NODE_ENV: 'production',
      REDIS_HOST: process.env.REDIS_HOST || 'guided-snapper-23234.upstash.io',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_TLS: process.env.REDIS_TLS || 'true'
    },
    
    // Configurações de restart
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 4000,
    
    // Logs
    log_file: 'logs/worker-bull.log',
    error_file: 'logs/worker-bull-error.log',
    out_file: 'logs/worker-bull-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Health monitoring
    min_uptime: '10s',
    max_restarts: 15,
    
    // Configurações específicas do worker
    node_args: '--max-old-space-size=2048',
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Configurações avançadas
    source_map_support: false,
    instance_var: 'INSTANCE_ID'
  }]
};