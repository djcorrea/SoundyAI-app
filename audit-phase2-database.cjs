/**
 * 🔬 AUDITORIA FASE 2 - BANCO DE DADOS
 * Consulta PostgreSQL para inspecionar aiSuggestions do último job completed
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-ct4t5uu8ii6s73djrsi0-a.oregon-postgres.render.com',
  database: 'soundyai',
  user: 'soundyai_user',
  password: 'vYTRVDHCrXKsUDRlKOZcRMNLQNfxZDJz',
  port: 5432,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

async function auditDatabase() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔬 AUDITORIA FASE 2 - ANÁLISE DO BANCO DE DADOS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Query último job completed
    const result = await pool.query(`
      SELECT 
        id,
        status,
        mode,
        created_at,
        results
      FROM jobs 
      WHERE status = 'completed' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.error('❌ Nenhum job completed encontrado!');
      return;
    }

    const job = result.rows[0];
    console.log('📦 JOB ENCONTRADO');
    console.log('  ├─ ID:', job.id);
    console.log('  ├─ Status:', job.status);
    console.log('  ├─ Modo:', job.mode);
    console.log('  └─ Data:', job.created_at);
    console.log('');

    // Extrair aiSuggestions
    const aiSuggestions = job.results?.aiSuggestions;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ANÁLISE DO CAMPO aiSuggestions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!aiSuggestions) {
      console.error('❌ Campo aiSuggestions não existe ou está null!');
      return;
    }

    // Verificar se é array
    if (!Array.isArray(aiSuggestions)) {
      console.error('❌ aiSuggestions não é um array!');
      console.log('   Tipo encontrado:', typeof aiSuggestions);
      console.log('   Valor:', JSON.stringify(aiSuggestions, null, 2));
      return;
    }

    console.log('✅ aiSuggestions é um array válido');
    console.log('   Total de itens:', aiSuggestions.length);
    console.log('');

    // Estatísticas detalhadas
    const stats = {
      total: aiSuggestions.length,
      withAiEnhanced: aiSuggestions.filter(s => s.aiEnhanced === true).length,
      withoutAiEnhanced: aiSuggestions.filter(s => s.aiEnhanced === false).length,
      withProblema: aiSuggestions.filter(s => s.problema && s.problema !== '').length,
      withSolucao: aiSuggestions.filter(s => s.solucao && s.solucao !== '').length,
      withPlugin: aiSuggestions.filter(s => s.pluginRecomendado && s.pluginRecomendado !== 'Plugin não especificado').length,
      withDicaExtra: aiSuggestions.filter(s => s.dicaExtra).length,
      withParametros: aiSuggestions.filter(s => s.parametros).length
    };

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 ESTATÍSTICAS DETALHADAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('  Total de sugestões:', stats.total);
    console.log('  ├─ Com aiEnhanced=true:', stats.withAiEnhanced);
    console.log('  ├─ Com aiEnhanced=false:', stats.withoutAiEnhanced);
    console.log('  ├─ Com problema preenchido:', stats.withProblema);
    console.log('  ├─ Com solucao preenchida:', stats.withSolucao);
    console.log('  ├─ Com plugin recomendado:', stats.withPlugin);
    console.log('  ├─ Com dica extra:', stats.withDicaExtra);
    console.log('  └─ Com parâmetros:', stats.withParametros);
    console.log('');

    // Mostrar estrutura de cada sugestão
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 INSPEÇÃO INDIVIDUAL DAS SUGESTÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    aiSuggestions.forEach((sug, index) => {
      console.log(`[${index + 1}/${stats.total}] Sugestão #${index + 1}`);
      console.log('  ├─ type:', sug.type || '(vazio)');
      console.log('  ├─ message:', sug.message?.substring(0, 60) + '...' || '(vazio)');
      console.log('  ├─ aiEnhanced:', sug.aiEnhanced);
      console.log('  ├─ categoria:', sug.categoria || '(vazio)');
      console.log('  ├─ nivel:', sug.nivel || '(vazio)');
      console.log('  ├─ problema:', sug.problema ? `"${sug.problema.substring(0, 50)}..."` : '(vazio)');
      console.log('  ├─ solucao:', sug.solucao ? `"${sug.solucao.substring(0, 50)}..."` : '(vazio)');
      console.log('  ├─ pluginRecomendado:', sug.pluginRecomendado || '(vazio)');
      console.log('  ├─ dicaExtra:', sug.dicaExtra ? 'Presente' : '(vazio)');
      console.log('  └─ parametros:', sug.parametros ? 'Presente' : '(vazio)');
      console.log('');
    });

    // Conclusão da auditoria
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 CONCLUSÕES DA AUDITORIA FASE 2');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verificar consistência
    const isConsistent = stats.withAiEnhanced === stats.total &&
                        stats.withProblema === stats.total &&
                        stats.withSolucao === stats.total;

    if (isConsistent) {
      console.log('✅ BANCO DE DADOS CONSISTENTE');
      console.log('   Todas as sugestões possuem:');
      console.log('   ├─ aiEnhanced = true');
      console.log('   ├─ problema preenchido');
      console.log('   └─ solucao preenchida');
      console.log('');
      console.log('🟢 Resultado: Merge está funcionando corretamente');
      console.log('🔴 Problema deve estar no FRONTEND ao processar esses dados');
    } else {
      console.log('❌ BANCO DE DADOS INCONSISTENTE');
      console.log('');
      console.log('Problemas identificados:');
      if (stats.withAiEnhanced < stats.total) {
        console.log(`  ├─ ${stats.withoutAiEnhanced} sugestões sem aiEnhanced=true`);
      }
      if (stats.withProblema < stats.total) {
        console.log(`  ├─ ${stats.total - stats.withProblema} sugestões sem problema`);
      }
      if (stats.withSolucao < stats.total) {
        console.log(`  └─ ${stats.total - stats.withSolucao} sugestões sem solucao`);
      }
      console.log('');
      console.log('🔴 Problema está no BACKEND ou MERGE');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await pool.end();
  }
}

auditDatabase();
