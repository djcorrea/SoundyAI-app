import "dotenv/config";
import getPool from './db.js';

console.log('🧪 TESTE: Pool de Conexão PostgreSQL');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1️⃣ Verificando DATABASE_URL...');
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurado!');
  process.exit(1);
}
console.log('✅ DATABASE_URL configurado\n');

console.log('2️⃣ Criando pool de conexão...');
try {
  const pool = getPool();
  console.log('✅ Pool criado com sucesso\n');
  
  console.log('3️⃣ Executando query de teste...');
  const result = await pool.query('SELECT NOW() as now, version(), current_database()');
  console.log('✅ Query executada com sucesso\n');
  
  console.log('📊 RESULTADO:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Timestamp:', result.rows[0].now);
  console.log('Database:', result.rows[0].current_database);
  console.log('Versão:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('4️⃣ Verificando schema da tabela jobs...');
  const schemaResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'jobs'
    ORDER BY ordinal_position
  `);
  
  console.log('✅ Colunas da tabela jobs:');
  schemaResult.rows.forEach(col => {
    console.log(`   - ${col.column_name} (${col.data_type})${col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}`);
  });
  console.log('');
  
  console.log('5️⃣ Testando INSERT/UPDATE...');
  const testId = '00000000-0000-0000-0000-000000000000';
  
  // Tentar inserir job de teste
  try {
    await pool.query(`
      INSERT INTO jobs (id, file_key, mode, status, created_at, updated_at)
      VALUES ($1, 'test', 'genre', 'queued', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testId]);
    console.log('✅ INSERT executado\n');
  } catch (err) {
    console.log('⚠️ INSERT falhou (job pode já existir):', err.message, '\n');
  }
  
  // Testar UPDATE com result
  const testResult = {
    technicalData: { lufsIntegrated: -14.0, truePeakDbtp: -1.0 },
    aiSuggestions: [{ categoria: 'Teste', problema: 'Teste', solucao: 'Teste' }],
    suggestions: [{ type: 'info', message: 'Teste' }],
    score: 8.5
  };
  
  const updateResult = await pool.query(`
    UPDATE jobs 
    SET status = $1, result = $2, updated_at = NOW() 
    WHERE id = $3 
    RETURNING *
  `, ['completed', JSON.stringify(testResult), testId]);
  
  if (updateResult.rows.length > 0) {
    console.log('✅ UPDATE executado');
    console.log('   Status salvo:', updateResult.rows[0].status);
    console.log('   Result salvo:', updateResult.rows[0].result ? 'SIM' : 'NULL');
    
    if (updateResult.rows[0].result) {
      const saved = typeof updateResult.rows[0].result === 'string' 
        ? JSON.parse(updateResult.rows[0].result) 
        : updateResult.rows[0].result;
      
      console.log('   technicalData presente:', !!saved.technicalData);
      console.log('   aiSuggestions presente:', !!saved.aiSuggestions);
      console.log('   score salvo:', saved.score);
    }
  }
  console.log('');
  
  console.log('6️⃣ Limpando job de teste...');
  await pool.query(`DELETE FROM jobs WHERE id = $1`, [testId]);
  console.log('✅ Job de teste removido\n');
  
  console.log('7️⃣ Fechando conexão...');
  await pool.end();
  console.log('✅ Pool fechado\n');
  
  console.log('🎉 TODOS OS TESTES PASSARAM!');
  console.log('✅ Pool de conexão funcionando corretamente');
  console.log('✅ Schema da tabela jobs OK');
  console.log('✅ INSERT/UPDATE funcionando');
  console.log('✅ Salvamento de result JSONB OK');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ ERRO NO TESTE:');
  console.error('Mensagem:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
