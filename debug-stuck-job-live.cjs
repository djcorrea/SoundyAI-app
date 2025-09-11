require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugStuckJob() {
  try {
    console.log('🔬 DEBUG DETALHADO - JOB TRAVADO');
    console.log('================================\n');
    
    // 1. Encontrar o job travado
    const stuckJob = await pool.query(`
      SELECT * FROM jobs 
      WHERE status = 'processing' 
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    
    if (stuckJob.rows.length === 0) {
      console.log('✅ Nenhum job travado encontrado');
      await pool.end();
      return;
    }
    
    const job = stuckJob.rows[0];
    console.log('📊 JOB TRAVADO ENCONTRADO:');
    console.log(`   🆔 ID: ${job.id}`);
    console.log(`   📁 Arquivo: ${job.file_key}`);
    console.log(`   📅 Criado: ${job.created_at}`);
    console.log(`   🔄 Atualizado: ${job.updated_at}`);
    console.log(`   📊 Status: ${job.status}`);
    console.log(`   ❌ Erro: ${job.error || 'nenhum'}`);
    console.log(`   📋 Resultado: ${job.result ? 'existe' : 'vazio'}`);
    
    // 2. Verificar se o arquivo existe no bucket
    console.log('\n🔍 VERIFICANDO ARQUIVO NO BUCKET...');
    
    // Simulo verificação (sem acessar o bucket por agora)
    const fileSize = job.file_key ? `${job.file_key.length} chars` : 'unknown';
    console.log(`   📁 Chave do arquivo: ${job.file_key}`);
    console.log(`   📏 Tamanho da chave: ${fileSize}`);
    
    // 3. Resetar job para retentar processamento COM LOG DETALHADO
    console.log('\n🔄 RESETANDO JOB PARA RETRY COM LOGS...');
    
    await pool.query(`
      UPDATE jobs 
      SET status = 'queued', 
          error = 'Reset para debug - job travado detectado',
          updated_at = NOW()
      WHERE id = $1
    `, [job.id]);
    
    console.log('✅ Job resetado para queued - worker deve processar em ~5 segundos');
    
    // 4. Monitorar por 30 segundos
    console.log('\n👁️ MONITORANDO PROCESSAMENTO POR 30 SEGUNDOS...');
    
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const updated = await pool.query(`
        SELECT status, error, updated_at FROM jobs WHERE id = $1
      `, [job.id]);
      
      if (updated.rows.length > 0) {
        const current = updated.rows[0];
        console.log(`   ${i*5+5}s - Status: ${current.status}, Erro: ${current.error || 'nenhum'}`);
        
        if (current.status === 'done' || current.status === 'completed') {
          console.log('🎉 JOB PROCESSADO COM SUCESSO!');
          break;
        }
        
        if (current.status === 'failed' || current.status === 'error') {
          console.log('❌ JOB FALHOU NOVAMENTE:');
          console.log(`   Erro: ${current.error}`);
          break;
        }
        
        if (current.status === 'processing' && i >= 4) {
          console.log('🚨 JOB TRAVOU NOVAMENTE - PROBLEMA NO PIPELINE!');
          console.log('   Possíveis causas:');
          console.log('   - FFmpeg não consegue decodificar este arquivo');
          console.log('   - Arquivo muito grande/corrompido');
          console.log('   - Worker Railway com problema de memória');
          console.log('   - Bug no pipeline em uma das fases 5.1-5.4');
          break;
        }
      }
    }
    
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro no debug:', err.message);
    await pool.end();
  }
}

debugStuckJob();
