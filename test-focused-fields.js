// 🧪 TESTE FOCADO - Verificar se campos delta_raw e delta_capped estão sendo definidos

import { ProblemsAndSuggestionsAnalyzerV2 } from './work/lib/audio/features/problems-suggestions-v2.js';

console.log('🧪 Teste focado - Verificação de campos...\n');

// Mock simples com uma banda com valor extremo
const mockMetrics = {
  centralizedBands: {
    bass: 15.0      // Muito alto - deve ser limitado 
  },
  lufs: -14.2,
  truePeak: -1.3
};

const analyzer = new ProblemsAndSuggestionsAnalyzerV2('eletronico');
const result = analyzer.analyzeWithEducationalSuggestions(mockMetrics);

// Procurar pela sugestão de bass
const bassSuggestion = result.suggestions.find(s => s.metric === 'band_bass');

if (bassSuggestion) {
  console.log('🎯 Sugestão de Bass encontrada:');
  console.log('Metric:', bassSuggestion.metric);
  console.log('Current Value:', bassSuggestion.currentValue);
  console.log('Target Value:', bassSuggestion.targetValue);
  console.log('Delta (formatted):', bassSuggestion.delta);
  console.log('Delta Raw:', bassSuggestion.delta_raw);
  console.log('Delta Capped:', bassSuggestion.delta_capped);
  console.log('Band Name:', bassSuggestion.bandName);
  console.log('Action:', bassSuggestion.action);
  
  console.log('\n🔍 Verificações:');
  console.log('✅ Delta raw definido:', bassSuggestion.delta_raw !== undefined);
  console.log('✅ Delta capped definido:', bassSuggestion.delta_capped !== undefined);
  console.log('✅ Delta formatado:', bassSuggestion.delta);
  
  // Calcular delta esperado
  const currentValue = parseFloat(bassSuggestion.currentValue);
  const targetValue = parseFloat(bassSuggestion.targetValue);
  const expectedDelta = currentValue - targetValue;
  
  console.log('✅ Delta calculado esperado:', expectedDelta.toFixed(1), 'dB');
  console.log('✅ Delta raw reportado:', bassSuggestion.delta_raw?.toFixed(1) || 'undefined', 'dB');
  console.log('✅ Valores coincidem:', Math.abs(expectedDelta - (bassSuggestion.delta_raw || 0)) < 0.1);
  
} else {
  console.log('❌ Sugestão de bass não encontrada');
  console.log('Sugestões disponíveis:', result.suggestions.map(s => s.metric));
}

console.log('\n🎯 Todas as sugestões:');
result.suggestions.forEach((sug, i) => {
  console.log(`${i + 1}. ${sug.metric}: delta_raw=${sug.delta_raw}, delta_capped=${sug.delta_capped}`);
});