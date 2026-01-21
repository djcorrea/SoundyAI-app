import pkg from 'pg';
const { Pool } = pkg;

let pool;

function getPool() {
  if (!pool) {
    // 🚨 CRÍTICO: Validar DATABASE_URL antes de criar pool
    if (!process.env.DATABASE_URL) {
      console.error('💥 [DB] ERRO CRÍTICO: DATABASE_URL não configurado');
      console.error('💡 [DB] Verifique as variáveis no Railway Dashboard → Variables');
      console.error('📋 [DB] Ambiente:', process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'unknown');
      throw new Error('DATABASE_URL environment variable not configured');
    }
    
    // 🔍 Log de diagnóstico (com senha mascarada)
    const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@');
    console.log(`🔗 [DB] Conectando ao PostgreSQL: ${maskedUrl.substring(0, 60)}...`);
    console.log(`🌍 [DB] Ambiente: ${process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'development'}`);
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,                          // Máximo 2 conexões por worker
      idleTimeoutMillis: 30000,        // 30 segundos timeout para conexões ociosas
      connectionTimeoutMillis: 5000,   // 5 segundos timeout para conectar
      allowExitOnIdle: false           // Mantém pool ativo
    });

    pool.on('connect', () => {
      console.log('✅ [DB] Pool de conexão PostgreSQL inicializado com Singleton');
    });

    pool.on('error', (err) => {
      console.error('❌ [DB] Erro na conexão com o banco:', err.message);
      console.error('💡 [DB] Verifique DATABASE_URL no Railway Dashboard');
      console.error('📋 [DB] Código de erro:', err.code);
    });

    // Log apenas na primeira criação do pool
    console.log('🔗 [DB] Singleton PostgreSQL Pool criado - Max: 2 conexões');
  }

  return pool;
}

export default getPool();