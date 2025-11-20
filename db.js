import pkg from 'pg';
const { Pool } = pkg;

let pool;

function getPool() {
  if (!pool) {
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
      console.error('❌ [DB] Erro na conexão com o banco:', err);
    });

    // Log apenas na primeira criação do pool
    console.log('🔗 [DB] Singleton PostgreSQL Pool criado - Max: 2 conexões');
  }

  return pool;
}

export default getPool;  // ← CORRIGIDO: exporta função, não execução