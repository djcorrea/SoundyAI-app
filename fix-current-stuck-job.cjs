require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixCurrentStuckJob() {
  try {
    console.log('🚨 CORREÇÃO EMERGENCIAL - JOB ATUAL TRAVADO');
    console.log('==========================================\n');
    
    const jobId = 'a77b431f-264a-49f6-800a-9950af9d9a17';
    
    // 1. Verificar detalhes do job problemático
    console.log('1️⃣ ANALISANDO JOB PROBLEMÁTICO...');
    const jobDetails = await pool.query(`
      SELECT id, file_key, status, created_at, updated_at, error
      FROM jobs 
      WHERE id = $1
    `, [jobId]);
    
    if (jobDetails.rows.length > 0) {
      const job = jobDetails.rows[0];
      console.log(`   📊 Job encontrado: ${job.id}`);
      console.log(`   📁 Arquivo: ${job.file_key}`);
      console.log(`   📊 Status: ${job.status}`);
      console.log(`   📅 Criado: ${job.created_at}`);
      console.log(`   🔄 Atualizado: ${job.updated_at}`);
      console.log(`   ❌ Erro: ${job.error || 'nenhum'}`);
      
      // 2. Marcar como erro permanente
      console.log('\n2️⃣ MARCANDO COMO ERRO PERMANENTE...');
      const updateResult = await pool.query(`
        UPDATE jobs 
        SET status = 'error', 
            error = 'Arquivo causa travamento no pipeline - segundo arquivo problemático detectado',
            updated_at = NOW()
        WHERE id = $1
        RETURNING status
      `, [jobId]);
      
      if (updateResult.rows.length > 0) {
        console.log(`   ✅ Job marcado como erro: ${updateResult.rows[0].status}`);
        console.log(`   📝 Razão: Arquivo causa travamento consistente no pipeline`);
        console.log(`   🔍 Arquivo preservado para investigação: ${job.file_key}`);
      }
      
    } else {
      console.log('   ⚠️ Job não encontrado - pode já ter sido processado');
    }
    
    // 3. Status final
    console.log('\n3️⃣ STATUS FINAL DO SISTEMA...');
    const finalStatus = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('   📊 Jobs por status:');
    finalStatus.rows.forEach(row => {
      console.log(`      - ${row.status}: ${row.count}`);
    });
    
    console.log('\n==========================================');
    console.log('🎯 RESULTADO: Segundo job problemático neutralizado!');
    console.log('✅ Sistema deve voltar ao funcionamento normal');
    console.log('🔍 Dois arquivos problemáticos já identificados');
    console.log('📝 Padrão: Alguns arquivos causam travamento no pipeline');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro na correção emergencial:', error);
    await pool.end();
  }
}

fixCurrentStuckJob();
