require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deepAuditJobCycle() {
  console.log('🔍 AUDITORIA PROFUNDA - CICLO INFINITO DE JOBS');
  console.log('=============================================\n');
  
  try {
    // 1. ANÁLISE TEMPORAL DOS JOBS
    console.log('📊 1. ANÁLISE TEMPORAL DOS JOBS:');
    const timeAnalysis = await pool.query(`
      SELECT 
        status,
        COUNT(*) as total,
        MIN(created_at) as primeiro,
        MAX(created_at) as ultimo,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as duracao_media
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY status
      ORDER BY total DESC
    `);
    
    timeAnalysis.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.total} jobs`);
      console.log(`      Primeiro: ${new Date(row.primeiro).toLocaleTimeString()}`);
      console.log(`      Último: ${new Date(row.ultimo).toLocaleTimeString()}`);
      console.log(`      Duração média: ${Math.floor(row.duracao_media || 0)}s`);
      console.log('');
    });

    // 2. PADRÃO DE CRIAÇÃO DE JOBS
    console.log('🔄 2. PADRÃO DE CRIAÇÃO (últimos 10):');
    const creationPattern = await pool.query(`
      SELECT id, file_key, status, created_at, updated_at,
             LAG(created_at) OVER (ORDER BY created_at) as job_anterior,
             EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as intervalo_segundos
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    creationPattern.rows.forEach(job => {
      const id = job.id.substring(0, 8);
      const intervalo = job.intervalo_segundos ? `${Math.floor(job.intervalo_segundos)}s depois` : 'primeiro';
      console.log(`   ${id} | ${job.status} | ${job.file_key} | ${intervalo}`);
    });

    // 3. JOBS DUPLICADOS (MESMO ARQUIVO)
    console.log('\n🔁 3. JOBS DUPLICADOS (mesmo arquivo):');
    const duplicates = await pool.query(`
      SELECT file_key, COUNT(*) as total, 
             array_agg(status) as statuses,
             array_agg(id) as job_ids
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY file_key
      HAVING COUNT(*) > 1
      ORDER BY total DESC
      LIMIT 5
    `);
    
    duplicates.rows.forEach(dup => {
      console.log(`   ${dup.file_key}: ${dup.total} jobs`);
      console.log(`      Status: ${dup.statuses.join(', ')}`);
      console.log(`      IDs: ${dup.job_ids.map(id => id.substring(0,8)).join(', ')}`);
      console.log('');
    });

    // 4. TRANSIÇÕES DE STATUS
    console.log('🔄 4. TRANSIÇÕES DE STATUS (últimos 5 jobs):');
    const transitions = await pool.query(`
      SELECT id, file_key, status, created_at, updated_at,
             EXTRACT(EPOCH FROM (NOW() - created_at)) as idade_total,
             EXTRACT(EPOCH FROM (NOW() - updated_at)) as tempo_sem_update
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    transitions.rows.forEach(job => {
      const id = job.id.substring(0, 8);
      const idade = Math.floor(job.idade_total);
      const semUpdate = Math.floor(job.tempo_sem_update);
      console.log(`   ${id} | ${job.status} | Idade: ${idade}s | Sem update: ${semUpdate}s`);
      console.log(`      Arquivo: ${job.file_key}`);
      console.log('');
    });

    // 5. VERIFICAR RECOVERY AUTOMÁTICO
    console.log('🔧 5. JOBS COM RECOVERY AUTOMÁTICO:');
    const recoveredJobs = await pool.query(`
      SELECT id, file_key, error, created_at
      FROM jobs 
      WHERE error LIKE '%Recovered from orphaned state%'
      AND created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (recoveredJobs.rows.length > 0) {
      console.log(`   ⚠️ ENCONTRADOS ${recoveredJobs.rows.length} jobs com recovery automático:`);
      recoveredJobs.rows.forEach(job => {
        console.log(`      ${job.id.substring(0,8)}: ${job.file_key}`);
      });
    } else {
      console.log('   ✅ Nenhum job com recovery automático recente');
    }

    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro na auditoria:', err);
  }
}

deepAuditJobCycle();