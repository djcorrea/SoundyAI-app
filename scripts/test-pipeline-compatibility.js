// 🔧 TESTE DE COMPATIBILIDADE COM PIPELINE EXISTENTE
// Verifica se as mudanças não quebram o sistema atual

async function testPipelineCompatibility() {
  console.log('🔧 === TESTE DE COMPATIBILIDADE COM PIPELINE ===\n');
  
  try {
    // Import do core-metrics que usa o sistema atualizado
    const coreModule = await import('../work/api/audio/core-metrics.js');
    const { CoreMetricsProcessor } = coreModule;
    
    console.log('✅ Import do core-metrics bem-sucedido');
    
    // Criar processor
    const processor = new CoreMetricsProcessor();
    console.log('✅ CoreMetricsProcessor instanciado');
    
    // Simular métricas completas como o pipeline geraria
    const mockMetrics = {
      // LUFS
      lufs: {
        integrated: -12.5,
        shortTerm: [-12.8, -12.3, -12.7],
        momentary: [-13.1, -12.2, -12.9]
      },
      
      // True Peak
      truePeak: {
        peak: -1.2,
        peaks: [-1.2, -1.5, -1.8]
      },
      
      // Dynamic Range
      dynamics: {
        dynamicRange: 8.5,
        crestFactor: 12.3,
        rms: -18.2
      },
      
      // Stereo
      stereo: {
        correlation: 0.75,
        width: 0.82,
        balance: 0.02
      },
      
      // Bandas espectrais
      centralizedBands: {
        sub_energy_db: -18.0,
        bass_energy_db: -17.5,
        lowMid_energy_db: -22.0,
        mid_energy_db: -20.1,
        highMid_energy_db: -24.5,
        presenca_energy_db: -26.0,
        brilho_energy_db: -27.8
      },
      
      // DC Offset
      dcOffset: {
        maxAbsDC: 0.005,
        avgDC: 0.002
      }
    };
    
    console.log('🧪 Testando com diferentes gêneros...\n');
    
    // Testar com diferentes gêneros
    const testGenres = ['funk_mandela', 'funk_automotivo', 'eletronico', 'trance', 'default'];
    
    for (const genre of testGenres) {
      console.log(`🎵 Teste com gênero: ${genre}`);
      
      try {
        // Simular análise como o pipeline faz
        const problemsModule = await import('../work/lib/audio/features/problems-suggestions-v2.js');
        const { analyzeProblemsAndSuggestionsV2 } = problemsModule;
        
        const result = analyzeProblemsAndSuggestionsV2(mockMetrics, genre);
        
        if (!result || !result.suggestions || !result.summary) {
          console.log(`   ❌ Resultado inválido para ${genre}`);
          continue;
        }
        
        console.log(`   ✅ Análise bem-sucedida:`);
        console.log(`      Sugestões: ${result.suggestions.length}`);
        console.log(`      Rating: ${result.summary.overallRating}`);
        console.log(`      Pronto para release: ${result.summary.readyForRelease}`);
        
        // Verificar se tem sugestão de dynamic range
        const drSuggestion = result.suggestions.find(s => s.metric === 'dynamicRange');
        if (drSuggestion) {
          console.log(`      Dynamic Range: ${drSuggestion.severity} - ${drSuggestion.currentValue}`);
        }
        
        // Verificar compatibilidade dos campos
        const requiredFields = ['genre', 'suggestions', 'summary', 'metadata'];
        const missingFields = requiredFields.filter(field => !result[field]);
        
        if (missingFields.length > 0) {
          console.log(`   ❌ Campos faltando: ${missingFields.join(', ')}`);
        } else {
          console.log(`   ✅ Estrutura de resposta compatível`);
        }
        
      } catch (error) {
        console.log(`   ❌ Erro ao analisar ${genre}: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Teste de valores extremos para verificar robustez
    console.log('🔥 Teste de valores extremos:\n');
    
    const extremeTests = [
      { name: 'DR muito baixo (2 LU)', dr: 2.0 },
      { name: 'DR muito alto (25 LU)', dr: 25.0 },
      { name: 'DR no limite funk_mandela (15 LU)', dr: 15.0 },
      { name: 'DR no limite eletrônico (9 LU)', dr: 9.0 }
    ];
    
    for (const test of extremeTests) {
      console.log(`🧪 ${test.name}:`);
      
      const extremeMetrics = {
        ...mockMetrics,
        dynamics: { dynamicRange: test.dr }
      };
      
      try {
        const problemsModule = await import('../work/lib/audio/features/problems-suggestions-v2.js');
        const { analyzeProblemsAndSuggestionsV2 } = problemsModule;
        
        const result = analyzeProblemsAndSuggestionsV2(extremeMetrics, 'funk_mandela');
        const drSuggestion = result.suggestions.find(s => s.metric === 'dynamicRange');
        
        if (drSuggestion) {
          console.log(`   ${drSuggestion.severity === 'ideal' ? '🟢' : drSuggestion.severity === 'ajuste_leve' ? '🟡' : '🔴'} ${drSuggestion.severity}: ${drSuggestion.message}`);
        } else {
          console.log(`   ❌ Nenhuma sugestão gerada`);
        }
        
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
    console.log('\n🎯 === VERIFICAÇÃO DE RETROCOMPATIBILIDADE ===\n');
    
    // Verificar se ainda funciona sem especificar gênero (default)
    try {
      const problemsModule = await import('../work/lib/audio/features/problems-suggestions-v2.js');
      const { analyzeProblemsAndSuggestions } = problemsModule; // Função de compatibilidade
      
      const result = analyzeProblemsAndSuggestions(mockMetrics); // Sem gênero
      
      if (result && result.suggestions) {
        console.log('✅ Função de compatibilidade funcionando');
        console.log(`   Gênero usado: ${result.genre || 'default'}`);
        console.log(`   Sugestões: ${result.suggestions.length}`);
      } else {
        console.log('❌ Função de compatibilidade quebrada');
      }
      
    } catch (error) {
      console.log(`❌ Erro na retrocompatibilidade: ${error.message}`);
    }
    
    console.log('\n✅ TESTE DE COMPATIBILIDADE CONCLUÍDO!');
    
  } catch (error) {
    console.error('❌ Erro crítico no teste de compatibilidade:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPipelineCompatibility();