require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkJobsSchema() {
    try {
        console.log('🔍 Verificando estrutura da tabela jobs...\n');
        
        const schemaQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'jobs'
            ORDER BY ordinal_position;
        `;
        
        const schemaResult = await pool.query(schemaQuery);
        
        console.log('📋 COLUNAS DA TABELA JOBS:');
        schemaResult.rows.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
        });
        
        console.log('\n🔍 Sample de jobs em processing:');
        
        const sampleQuery = `
            SELECT *
            FROM jobs 
            WHERE status = 'processing'
            ORDER BY created_at DESC
            LIMIT 3
        `;
        
        const sampleResult = await pool.query(sampleQuery);
        
        if (sampleResult.rows.length > 0) {
            console.log(`\n📋 EXEMPLO DE JOB EM PROCESSING:`);
            const job = sampleResult.rows[0];
            Object.keys(job).forEach(key => {
                console.log(`   ${key}: ${job[key]}`);
            });
        } else {
            console.log('\n📝 Nenhum job em processing encontrado');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkJobsSchema();