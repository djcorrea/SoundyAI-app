require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function removeProblematicJob() {
  try {
    console.log('🚨 REMOÇÃO EMERGENCIAL - JOB PROBLEMÁTICO');
    console.log('=======================================\n');
    
    const jobId = '2965c05b-cefe-4e0b-902a-c7908bc44ce2';
    
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
      
      // 2. Marcar como erro permanente (não remover para auditoria)
      console.log('\n2️⃣ MARCANDO COMO ERRO PERMANENTE...');
      const updateResult = await pool.query(`
        UPDATE jobs 
        SET status = 'error', 
            error = 'Job removido por travamento persistente - arquivo problemático',
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
    
    // 3. Verificar se há outros jobs travados
    console.log('\n3️⃣ VERIFICANDO OUTROS JOBS TRAVADOS...');
    const otherStuckJobs = await pool.query(`
      SELECT id, file_key, status, updated_at
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
      AND id != $1
    `, [jobId]);
    
    if (otherStuckJobs.rows.length > 0) {
      console.log(`   🚨 Encontrados ${otherStuckJobs.rows.length} outros jobs travados:`);
      for (const job of otherStuckJobs.rows) {
        console.log(`      - ${job.id}: ${job.file_key}`);
        
        // Resetar outros jobs travados
        await pool.query(`
          UPDATE jobs 
          SET status = 'queued', 
              error = 'Auto-resetado após limpeza de job problemático',
              updated_at = NOW()
          WHERE id = $1
        `, [job.id]);
        console.log(`      ✅ Job ${job.id} resetado`);
      }
    } else {
      console.log('   ✅ Nenhum outro job travado encontrado');
    }
    
    // 4. Status final
    console.log('\n4️⃣ STATUS FINAL DO SISTEMA...');
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
    
    console.log('\n=======================================');
    console.log('🎯 RESULTADO: Job problemático neutralizado!');
    console.log('✅ Sistema deve voltar ao funcionamento normal');
    console.log('🔍 Arquivo problemático preservado para análise futura');
    console.log('📝 Próximo passo: Investigar por que este arquivo trava o pipeline');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro na remoção emergencial:', error);
    await pool.end();
  }
}

removeProblematicJob();
