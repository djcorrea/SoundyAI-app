// 🚨 DEBUG EMERGENCIAL - SUGESTÕES NO FRONTEND
// Testando onde o JSON do backend é transformado no objeto analysis

console.log('🚨 [DEBUG-FRONTEND] Iniciando debug de sugestões...');

// Simular o JSON que vem do backend (baseado no que você mostrou)
const backendJSON = {
  "diagnostics": {
    "suggestions": [
      {
        "icon": "🔴",
        "type": "lufs",
        "color": "red",
        "delta": "-8.7 dB",
        "action": "Aumente o loudness usando um limiter suave ou maximizer, elevando gradualmente até -14 dB LUFS.",
        "metric": "lufs",
        "message": "LUFS muito baixo: -22.7 dB (mínimo: -14 dB)",
        "bandName": null,
        "priority": 4,
        "severity": "critical",
        "colorCode": "#ff4444",
        "explanation": "Seu áudio está 8.7 dB abaixo do ideal. Ficará muito baixo comparado a outras músicas.",
        "targetValue": "-14 LUFS",
        "currentValue": "-22.7 LUFS"
      },
      {
        "icon": "🟢",
        "type": "dynamicRange",
        "color": "green",
        "delta": "-1.0 dB",
        "action": "Excelente! Sua compressão está no ponto ideal.",
        "metric": "dynamicRange",
        "message": "🟢 Dynamic Range ideal: 7.0 dB DR",
        "bandName": null,
        "priority": 1,
        "severity": "ok",
        "colorCode": "#00ff88",
        "explanation": "Perfeito equilíbrio entre controle dinâmico e musicalidade para default.",
        "targetValue": "8 dB DR",
        "currentValue": "7.0 dB DR"
      }
    ]
  },
  "technicalData": {
    "problemsAnalysis": {
      "suggestions": [
        {
          "icon": "🔴",
          "type": "lufs",
          "message": "LUFS muito baixo: -22.7 dB (mínimo: -14 dB)"
        }
      ]
    }
  }
};

console.log('📊 [DEBUG] JSON do backend simulado:', backendJSON);

// Verificar onde estão as sugestões
console.log('🔍 [DEBUG] diagnostics.suggestions:', backendJSON.diagnostics?.suggestions?.length || 0);
console.log('🔍 [DEBUG] technicalData.problemsAnalysis.suggestions:', backendJSON.technicalData?.problemsAnalysis?.suggestions?.length || 0);

// Simular como deveria ser o mapeamento correto
function mapBackendToAnalysis(backendData) {
  const analysis = {
    // Copiar dados técnicos
    technicalData: backendData.technicalData,
    
    // 🚨 CRÍTICO: Mapear diagnostics.suggestions para analysis.suggestions
    suggestions: backendData.diagnostics?.suggestions || [],
    
    // Também incluir outras sugestões se existirem
    problems: backendData.diagnostics?.problems || []
  };
  
  console.log('✅ [DEBUG] analysis.suggestions mapeado:', analysis.suggestions.length);
  console.log('🔍 [DEBUG] Primeira sugestão:', analysis.suggestions[0]);
  
  return analysis;
}

// Testar o mapeamento
const analysis = mapBackendToAnalysis(backendJSON);

console.log('🎯 [DEBUG] Testando renderização...');

// Simular a função renderDiagnostics
function testRenderDiagnostics(analysis) {
  console.log('📝 [RENDER] Iniciando renderização de diagnósticos...');
  console.log('📝 [RENDER] analysis.suggestions.length:', analysis.suggestions?.length || 0);
  
  if (analysis.suggestions && analysis.suggestions.length > 0) {
    console.log('✅ [RENDER] TEM SUGESTÕES! Renderizando...');
    
    analysis.suggestions.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.icon} ${s.message}`);
      console.log(`      Tipo: ${s.type}, Severidade: ${s.severity}`);
    });
    
    return 'DIAGNÓSTICOS RENDERIZADOS';
  } else {
    console.log('❌ [RENDER] SEM SUGESTÕES - Mostrando "Sem diagnósticos"');
    return 'Sem diagnósticos';
  }
}

const renderResult = testRenderDiagnostics(analysis);
console.log('🎬 [RESULTADO FINAL]:', renderResult);

// Testar função deduplicateByType
function testDeduplicateByType(suggestions) {
  console.log('🔄 [DEDUP] Testando deduplicação...');
  
  const deduplicateByType = (items) => {
    const seen = new Map();
    const deduplicated = [];
    for (const item of items) {
      console.log(`   🔍 Processando: type="${item?.type}", message="${item?.message?.substring(0, 30)}..."`);
      
      if (!item || !item.type) {
        console.log(`   ❌ Item ignorado: sem campo 'type'`);
        continue;
      }
      
      const existing = seen.get(item.type);
      if (!existing) {
        seen.set(item.type, item);
        deduplicated.push(item);
        console.log(`   ✅ Item adicionado: ${item.type}`);
      } else {
        console.log(`   🔄 Item duplicado: ${item.type}`);
      }
    }
    return deduplicated;
  };
  
  const result = deduplicateByType(suggestions);
  console.log('🔄 [DEDUP] Resultado:', result.length, 'sugestões únicas');
  return result;
}

const deduplicatedSuggestions = testDeduplicateByType(analysis.suggestions);

console.log('🎉 [CONCLUSÃO] O problema está no mapeamento de diagnostics.suggestions para analysis.suggestions!');
console.log('🎯 [SOLUÇÃO] Precisamos corrigir onde o JSON do backend é convertido para o objeto analysis no frontend.');

// Verificar se existe a função audioAnalyzer no contexto atual
if (typeof window !== 'undefined' && window.audioAnalyzer) {
  console.log('🔍 [INFO] window.audioAnalyzer existe');
} else {
  console.log('🔍 [INFO] window.audioAnalyzer NÃO existe (normal no teste)');
}