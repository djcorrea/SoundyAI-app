// 🎯 TESTE SIMPLIFICADO DE TOLERÂNCIAS DE DINÂMICA
// Valida configurações básicas do sistema por gênero

async function testBasicThresholds() {
  console.log('🎯 === TESTE BÁSICO DE CONFIGURAÇÕES ===\n');
  
  // Import dinâmico para evitar problemas
  try {
    const module = await import('../work/lib/audio/features/problems-suggestions-v2.js');
    const { ProblemsAndSuggestionsAnalyzerV2 } = module;
    
    // Testar cada gênero
    const genres = ['funk_mandela', 'funk_automotivo', 'eletronico', 'trance'];
    
    for (const genre of genres) {
      console.log(`🎵 Testando: ${genre}`);
      
      const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre);
      const drThreshold = analyzer.thresholds.dr;
      
      console.log(`   Target: ${drThreshold.target} LU`);
      console.log(`   Tolerance: ${drThreshold.tolerance} LU`);
      console.log(`   Limite aceitável: ${drThreshold.target + drThreshold.tolerance} LU`);
      
      // Teste básico com valor ideal
      const mockMetrics = {
        dynamics: { dynamicRange: drThreshold.target }
      };
      
      const result = analyzer.analyzeWithEducationalSuggestions(mockMetrics);
      const drSuggestion = result.suggestions.find(s => s.metric === 'dynamicRange');
      
      if (drSuggestion) {
        console.log(`   ✅ Resultado para target: ${drSuggestion.severity} - ${drSuggestion.message}`);
      } else {
        console.log(`   ❌ Nenhuma sugestão gerada`);
      }
      
      console.log('');
    }
    
    console.log('✅ Teste básico concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBasicThresholds();