/**
 * Script de Teste - Validação dos Patches de Merge Completo
 * 
 * Testa se API retorna TODOS os campos após correção:
 * - technicalData
 * - aiSuggestions
 * - suggestions
 * - spectralBands
 * - score
 */

const API_BASE = process.env.API_URL || 'http://localhost:8080';

async function testCompleteMerge() {
  console.log('🧪 TESTE: Validação de Merge Completo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // 1. Buscar último job completed
    console.log('📋 1. Buscando último job completed...');
    
    const jobId = process.argv[2];
    if (!jobId) {
      console.error('❌ Uso: node test-complete-merge.js <job_id>');
      console.error('   Exemplo: node test-complete-merge.js a1b2c3d4-...');
      process.exit(1);
    }
    
    // 2. Buscar job na API
    console.log(`🔍 2. Buscando job ${jobId}...\n`);
    
    const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`API retornou ${response.status}: ${response.statusText}`);
    }
    
    const job = await response.json();
    
    // 3. Validar campos críticos
    console.log('✅ 3. Job encontrado! Validando campos...\n');
    
    const checks = {
      'ID presente': !!job.id,
      'Status presente': !!job.status,
      'Status = completed': job.status === 'completed',
      'technicalData presente': !!job.technicalData,
      'technicalData é objeto': typeof job.technicalData === 'object',
      'aiSuggestions presente': Array.isArray(job.aiSuggestions),
      'aiSuggestions não vazio': job.aiSuggestions?.length > 0,
      'suggestions presente': Array.isArray(job.suggestions),
      'spectralBands presente': !!job.spectralBands,
      'genreBands presente': !!job.genreBands,
      'score presente': typeof job.score === 'number',
      'score > 0': job.score > 0,
      'performance presente': !!job.performance
    };
    
    // Exibir resultados
    console.log('📊 RESULTADOS DA VALIDAÇÃO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let passed = 0;
    let failed = 0;
    
    for (const [check, result] of Object.entries(checks)) {
      const icon = result ? '✅' : '❌';
      console.log(`${icon} ${check}`);
      if (result) passed++;
      else failed++;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Passou: ${passed}/${Object.keys(checks).length}`);
    console.log(`📉 Falhou: ${failed}/${Object.keys(checks).length}\n`);
    
    // 4. Exibir detalhes dos campos
    if (job.technicalData) {
      console.log('🎵 TECHNICAL DATA:');
      console.log(`   LUFS: ${job.technicalData.lufsIntegrated || 'N/A'} LUFS`);
      console.log(`   True Peak: ${job.technicalData.truePeakDbtp || 'N/A'} dBTP`);
      console.log(`   Dynamic Range: ${job.technicalData.dynamicRange || 'N/A'} dB`);
      console.log('');
    }
    
    if (job.aiSuggestions && job.aiSuggestions.length > 0) {
      console.log(`🤖 AI SUGGESTIONS: ${job.aiSuggestions.length} itens`);
      const first = job.aiSuggestions[0];
      console.log(`   Categoria: ${first.categoria || 'N/A'}`);
      console.log(`   AI Enhanced: ${first.aiEnhanced || false}`);
      console.log(`   Enrichment Status: ${first.enrichmentStatus || 'N/A'}`);
      console.log('');
    }
    
    if (job.suggestions && job.suggestions.length > 0) {
      console.log(`💡 SUGGESTIONS: ${job.suggestions.length} itens`);
      console.log('');
    }
    
    console.log(`🎯 SCORE: ${job.score || 0}`);
    console.log('');
    
    // 5. Conclusão
    if (failed === 0) {
      console.log('🎉 TESTE PASSOU! Todos os campos estão presentes.');
      console.log('✅ Merge completo funcionando corretamente.');
      process.exit(0);
    } else {
      console.error('❌ TESTE FALHOU! Alguns campos estão ausentes.');
      console.error('⚠️  Verifique os logs da API para diagnosticar.');
      
      // Exibir JSON completo para debug
      console.log('\n🔍 JSON COMPLETO (para debug):');
      console.log(JSON.stringify(job, null, 2));
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar teste
testCompleteMerge();
