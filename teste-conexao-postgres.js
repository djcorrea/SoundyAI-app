// teste-conexao-postgres.js - Teste rápido de conexão

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testando conexão PostgreSQL...');
console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurado' : 'NÃO CONFIGURADO');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

try {
    const result = await pool.query('SELECT COUNT(*) as total FROM jobs');
    console.log('✅ Conexão OK! Total de jobs:', result.rows[0].total);
    
    const recent = await pool.query(`
        SELECT id, status, created_at, 
               CASE WHEN result IS NOT NULL THEN 'HAS_RESULT' ELSE 'NO_RESULT' END as result_status
        FROM jobs 
        ORDER BY created_at DESC 
        LIMIT 3
    `);
    
    console.log('📊 Jobs mais recentes:');
    recent.rows.forEach((job, i) => {
        console.log(`├─ [${i+1}] ID:${job.id} | ${job.status} | ${job.result_status}`);
    });
    
    await pool.end();
    console.log('🔚 Teste concluído!');
    
} catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    process.exit(1);
}