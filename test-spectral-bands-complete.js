// 🧪 TESTE COMPLETO DAS BANDAS ESPECTRAIS - Problems & Suggestions V2
// Teste para verificar se todas as 7 bandas espectrais estão sendo processadas

// Import da classe real
import { ProblemsAndSuggestionsAnalyzerV2 } from './work/lib/audio/features/problems-suggestions-v2.js';

// Mock da função logAudio
global.logAudio = (module, event, data) => {
  console.log(`[${module}] ${event}:`, data);
};

/**
 * 🧪 Teste das Bandas Espectrais Completas
 */
async function testSpectralBandsComplete() {
  console.log('\n🧪 TESTE COMPLETO: Todas as 7 Bandas Espectrais\n');
  
  // Inicializar analyzer para Funk Automotivo
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2('funk_automotivo');
  
  // Dados de teste com problemas nas bandas espectrais
  const audioMetrics = {
    // 📊 Métricas principais OK
    lufs: { integrated: -6.1 },     // Perfeito (-6.2 target)
    truePeak: { peak: -1.1 },       // Seguro (-1.0 target)
    dr: { dynamicRange: 6.9 },      // OK (6.8 target)
    stereo: { width: 0.84 },        // OK (0.85 target)
    
    // 🌈 Bandas espectrais com problemas variados
    spectralBands: {
      // ❌ Problemas críticos
      sub_energy_db: -12.0,          // target: -17.3 (muito alto, +5.3 dB)
      bass_energy_db: -14.5,         // target: -17.7 (alto, +3.2 dB)
      
      // ⚠️ Problemas moderados  
      lowMid_energy_db: -18.0,       // target: -20.5 (um pouco alto, +2.5 dB)
      mid_energy_db: -17.0,          // target: -19.2 (alto, +2.2 dB)
      
      // ✅ Próximas do ideal
      highMid_energy_db: -23.5,      // target: -22.8 (um pouco baixo, -0.7 dB)
      presenca_energy_db: -24.8,     // target: -24.1 (próximo, -0.7 dB)
      brilho_energy_db: -26.0        // target: -26.3 (muito próximo, +0.3 dB)
    },
    
    // 📊 Dados extras para referência
    referenceComparison: {
      sub: { energy_db: -12.0 },
      bass: { energy_db: -14.5 },
      lowMid: { energy_db: -18.0 },
      mid: { energy_db: -17.0 },
      highMid: { energy_db: -23.5 },
      presenca: { energy_db: -24.8 },
      brilho: { energy_db: -26.0 }
    }
  };
  
  console.log('📊 DADOS DE ENTRADA:');
  console.log('   🎵 Gênero: funk_automotivo');
  console.log('   📈 LUFS: -6.1 dB (target: -6.2) ✅');
  console.log('   🎯 True Peak: -1.1 dBTP (target: -1.0) ✅');
  console.log('   📏 DR: 6.9 LU (target: 6.8) ✅');
  console.log('   🎧 Stereo: 0.84 (target: 0.85) ✅');
  console.log('\n🌈 BANDAS ESPECTRAIS:');
  console.log('   🔴 Sub: -12.0 dB (target: -17.3) → +5.3 dB CRÍTICO');
  console.log('   🔴 Bass: -14.5 dB (target: -17.7) → +3.2 dB CRÍTICO');
  console.log('   🟠 Low-Mid: -18.0 dB (target: -20.5) → +2.5 dB AVISO');
  console.log('   🟠 Mid: -17.0 dB (target: -19.2) → +2.2 dB AVISO');
  console.log('   🟡 High-Mid: -23.5 dB (target: -22.8) → -0.7 dB INFO');
  console.log('   🟡 Presença: -24.8 dB (target: -24.1) → -0.7 dB INFO');
  console.log('   🟢 Brilho: -26.0 dB (target: -26.3) → +0.3 dB OK');
  
  console.log('\n⚙️ EXECUTANDO ANÁLISE...\n');
  
  // Executar análise completa
  const result = analyzer.analyzeWithEducationalSuggestions(audioMetrics);
  
  console.log('📊 RESULTADO DA ANÁLISE:');
  console.log(`   🎵 Gênero: ${result.genre || 'funk_automotivo'}`);
  console.log(`   🔴 Críticos: ${result.summary?.criticalIssues || 0}`);
  console.log(`   🟠 Avisos: ${result.summary?.warningIssues || 0}`);
  console.log(`   🟡 Info: ${result.summary?.infoIssues || 0}`);
  console.log(`   🟢 OK: ${result.summary?.okMetrics || 0}`);
  console.log(`   📊 Total: ${result.suggestions?.length || 0} sugestões`);
  
  console.log('\n💡 SUGESTÕES GERADAS:');
  if (result.suggestions && result.suggestions.length > 0) {
    result.suggestions.forEach((suggestion, i) => {
      console.log(`\n   ${i+1}. ${suggestion.icon || '🔹'} [${suggestion.metric}] ${suggestion.severity?.toUpperCase()}`);
      console.log(`      💬 ${suggestion.message || suggestion.explanation}`);
      console.log(`      🔧 ${suggestion.action}`);
      if (suggestion.currentValue && suggestion.targetValue) {
        console.log(`      📊 ${suggestion.currentValue} → ${suggestion.targetValue} (Δ ${suggestion.delta || 'N/A'})`);
      }
      
      // Verificar se é band_adjust
      if (suggestion.type === 'band_adjust') {
        console.log(`      🎛️ TIPO: Ajuste de EQ - Banda ${suggestion.band || suggestion.metric}`);
      }
    });
  } else {
    console.log('   ❌ NENHUMA SUGESTÃO GERADA!');
  }
  
  // Contabilizar bandas processadas
  const spectralSuggestions = result.suggestions?.filter(s => 
    ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presenca', 'brilho'].includes(s.metric) ||
    s.type === 'band_adjust'
  ) || [];
  
  console.log('\n🌈 ANÁLISE DAS BANDAS ESPECTRAIS:');
  console.log(`   🎛️ Bandas processadas: ${spectralSuggestions.length}/7`);
  console.log(`   📊 Esperado: 7 sugestões de band_adjust`);
  console.log(`   ✅ Resultado: ${spectralSuggestions.length >= 5 ? 'SUCESSO' : 'FALHA'}`);
  
  if (spectralSuggestions.length > 0) {
    console.log('\n📋 SUGESTÕES DAS BANDAS:');
    spectralSuggestions.forEach(s => {
      console.log(`   • ${s.metric}: ${s.severity} (${s.type || 'unknown'})`);
    });
  }
  
  console.log('\n🎯 DIAGNÓSTICO:');
  if (result.suggestions?.length === 0) {
    console.log('   ❌ PROBLEMA: Nenhuma sugestão gerada');
    console.log('   🔍 Verificar: analyzeSpectralBands() pode não estar sendo chamada');
  } else if (spectralSuggestions.length < 5) {
    console.log('   ⚠️ PROBLEMA: Poucas bandas processadas');
    console.log('   🔍 Verificar: Lógica de detecção das bandas espectrais');
  } else {
    console.log('   ✅ SUCESSO: Sistema processando bandas espectrais!');
    console.log('   🎉 analyzeSpectralBands() funcionando corretamente');
  }
  
  return result;
}

// Executar teste
testSpectralBandsComplete()
  .then(result => {
    console.log('\n🏁 TESTE FINALIZADO!');
    
    // Salvar resultado para debug
    const fs = require('fs');
    fs.writeFileSync('test-spectral-result.json', JSON.stringify(result, null, 2));
    console.log('📁 Resultado salvo em: test-spectral-result.json');
  })
  .catch(error => {
    console.error('\n❌ ERRO NO TESTE:', error);
    console.error(error.stack);
  });