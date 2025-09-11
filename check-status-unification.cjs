/**
 * Script para verificar unificação de status no banco de dados
 * Verifica se há jobs com status 'done' vs 'completed' 
 */

import pkg from 'pg';
const { Pool } = pkg;

// 🔑 Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function checkStatusUnification() {
  try {
    console.log('🔍 VERIFICANDO UNIFICAÇÃO DE STATUS');
    console.log('==================================\n');
    
    // 1. Contar jobs por status
    console.log('📊 DISTRIBUIÇÃO ATUAL DE STATUS:');
    const statusCount = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    statusCount.rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count} jobs`);
    });
    
    // 2. Verificar jobs específicos com 'done'
    console.log('\n🔍 JOBS COM STATUS "done":');
    const doneJobs = await pool.query(`
      SELECT id, file_key, created_at, completed_at 
      FROM jobs 
      WHERE status = 'done' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (doneJobs.rows.length > 0) {
      console.log(`   📋 Encontrados ${doneJobs.rows.length} jobs (mostrando últimos 5):`);
      doneJobs.rows.forEach(job => {
        console.log(`   - ${job.id}: ${job.file_key} (${job.created_at})`);
      });
    } else {
      console.log('   ✅ Nenhum job com status "done" encontrado');
    }
    
    // 3. Verificar jobs específicos com 'completed'
    console.log('\n🔍 JOBS COM STATUS "completed":');
    const completedJobs = await pool.query(`
      SELECT id, file_key, created_at, completed_at 
      FROM jobs 
      WHERE status = 'completed' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (completedJobs.rows.length > 0) {
      console.log(`   📋 Encontrados ${completedJobs.rows.length} jobs (mostrando últimos 5):`);
      completedJobs.rows.forEach(job => {
        console.log(`   - ${job.id}: ${job.file_key} (${job.created_at})`);
      });
    } else {
      console.log('   ✅ Nenhum job com status "completed" encontrado');
    }
    
    // 4. Verificar total de jobs finalizados
    console.log('\n📈 RESUMO DE JOBS FINALIZADOS:');
    const finishedCount = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'done') as done_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status IN ('done', 'completed')) as total_finished
      FROM jobs
    `);
    
    const stats = finishedCount.rows[0];
    console.log(`   🟢 Status "completed": ${stats.completed_count}`);
    console.log(`   🟡 Status "done": ${stats.done_count}`);
    console.log(`   📊 Total finalizados: ${stats.total_finished}`);
    
    if (parseInt(stats.done_count) > 0) {
      console.log('\n⚠️ AÇÃO RECOMENDADA:');
      console.log('   Jobs com status "done" encontrados no banco.');
      console.log('   A API de normalização (/api/jobs/[id]) vai convertê-los para "completed".');
      console.log('   Novos jobs vão usar apenas "completed" após as correções implementadas.');
    } else {
      console.log('\n✅ SITUAÇÃO ATUAL:');
      console.log('   Banco já está limpo - apenas status "completed" encontrado.');
    }
    
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro ao verificar status:', err.message);
    await pool.end();
  }
}

checkStatusUnification();
