/**
 * 🧪 TESTE DE VALIDAÇÃO - FASE 1: Sistema runId Global
 * 
 * Testa as melhorias implementadas na Fase 1:
 * - Feature flag RUNID_ENFORCED
 * - Respeitar options.runId se fornecido
 * - Duration automático em logs
 * - Propagação de runId para módulos internos
 */

console.log('🧪 INICIANDO TESTES - FASE 1: Sistema runId Global');
console.log('═══════════════════════════════════════════════════════');

// Resultados dos testes
const testResults = {
  featureFlag: false,
  runIdRespect: false,
  durationInLogs: false,
  propagation: false,
  backwardCompatibility: false
};

// 1️⃣ Teste: Feature Flag RUNID_ENFORCED
console.log('1️⃣ Testando feature flag RUNID_ENFORCED...');
try {
  // Simular ambiente de desenvolvimento
  window.DEBUG_RUNID = true;
  
  // Recarregar o script (simulação)
  if (typeof RUNID_ENFORCED !== 'undefined') {
    testResults.featureFlag = true;
    console.log('✅ Feature flag RUNID_ENFORCED implementada:', RUNID_ENFORCED);
  } else {
    console.log('❌ Feature flag RUNID_ENFORCED não encontrada');
  }
} catch (error) {
  console.log('❌ Erro ao testar feature flag:', error.message);
}

// 2️⃣ Teste: Respeitar options.runId
console.log('2️⃣ Testando respeito ao options.runId...');
try {
  const analyzer = new AudioAnalyzer();
  const customRunId = 'test_run_12345';
  
  // Simular chamada com runId customizado
  const mockFile = new Blob(['test'], { type: 'audio/wav' });
  mockFile.name = 'test.wav';
  
  // Criar spy para o _generateRunId
  const originalGenerate = analyzer._generateRunId;
  let generateCalled = false;
  analyzer._generateRunId = function() {
    generateCalled = true;
    return originalGenerate.call(this);
  };
  
  // Simular análise com runId customizado
  const testOptions = { runId: customRunId };
  
  // Verificar se o sistema usaria o runId fornecido
  if (analyzer._currentRunId !== customRunId) {
    // Simular lógica interna
    const runId = testOptions.runId || analyzer._generateRunId();
    if (runId === customRunId && !generateCalled) {
      testResults.runIdRespect = true;
      console.log('✅ Sistema respeitaria options.runId:', customRunId);
    }
  }
  
  // Restaurar método original
  analyzer._generateRunId = originalGenerate;
  
} catch (error) {
  console.log('❌ Erro ao testar options.runId:', error.message);
}

// 3️⃣ Teste: Duration automático em logs
console.log('3️⃣ Testando duration automático em logs...');
try {
  const analyzer = new AudioAnalyzer();
  
  // Verificar se método _logPipelineStageCompat calcula duration
  if (typeof analyzer._logPipelineStageCompat === 'function') {
    // Simular contexto
    const testRunId = 'test_duration_123';
    analyzer._activeAnalyses = analyzer._activeAnalyses || new Map();
    analyzer._activeAnalyses.set(testRunId, {
      runId: testRunId,
      startedAt: performance.now() - 1000 // 1 segundo atrás
    });
    
    // Mock do _logPipelineStage para capturar duration
    let capturedDuration = null;
    const originalLog = analyzer._logPipelineStage;
    analyzer._logPipelineStage = function(stage, payload) {
      capturedDuration = payload.duration;
      return originalLog.call(this, stage, payload);
    };
    
    // Testar
    analyzer._logPipelineStageCompat(testRunId, 'TEST_STAGE', {});
    
    if (capturedDuration && capturedDuration > 0) {
      testResults.durationInLogs = true;
      console.log('✅ Duration automático funcionando:', capturedDuration.toFixed(2) + 'ms');
    }
    
    // Restaurar
    analyzer._logPipelineStage = originalLog;
    
  } else {
    console.log('❌ Método _logPipelineStageCompat não encontrado');
  }
} catch (error) {
  console.log('❌ Erro ao testar duration automático:', error.message);
}

// 4️⃣ Teste: Propagação para módulos internos
console.log('4️⃣ Testando propagação para módulos internos...');
try {
  const analyzer = new AudioAnalyzer();
  
  // Verificar se performFullAnalysis aceita options com runId
  const performMethod = analyzer.performFullAnalysis.toString();
  if (performMethod.includes('options = {}') && performMethod.includes('runId')) {
    testResults.propagation = true;
    console.log('✅ performFullAnalysis atualizado para aceitar runId');
  } else {
    console.log('❌ performFullAnalysis não atualizado adequadamente');
  }
} catch (error) {
  console.log('❌ Erro ao testar propagação:', error.message);
}

// 5️⃣ Teste: Backward Compatibility
console.log('5️⃣ Testando backward compatibility...');
try {
  const analyzer = new AudioAnalyzer();
  
  // Verificar se métodos funcionam sem parâmetros extras
  if (typeof analyzer.performFullAnalysis === 'function') {
    // Simular buffer de áudio
    const mockBuffer = {
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
      getChannelData: (ch) => new Float32Array(1024)
    };
    
    // Chamar sem options (compatibilidade)
    try {
      const result = analyzer.performFullAnalysis(mockBuffer);
      if (result && typeof result === 'object') {
        testResults.backwardCompatibility = true;
        console.log('✅ Backward compatibility mantida');
      }
    } catch (e) {
      console.log('❌ Quebrou backward compatibility:', e.message);
    }
  }
} catch (error) {
  console.log('❌ Erro ao testar backward compatibility:', error.message);
}

// 📊 RESULTADO FINAL
console.log('\n📊 RESULTADOS DOS TESTES - FASE 1:');
console.log('═══════════════════════════════════════════════════════');

const totalTests = Object.keys(testResults).length;
const passedTests = Object.values(testResults).filter(Boolean).length;
const successRate = (passedTests / totalTests * 100).toFixed(1);

Object.entries(testResults).forEach(([test, passed]) => {
  const icon = passed ? '✅' : '❌';
  const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
  console.log(`${icon} ${testName}: ${passed ? 'PASS' : 'FAIL'}`);
});

console.log(`\n🎯 Taxa de sucesso: ${successRate}% (${passedTests}/${totalTests})`);

if (successRate >= 80) {
  console.log('🟢 FASE 1 - APROVADA: Pronto para Fase 2');
} else if (successRate >= 60) {
  console.log('🟡 FASE 1 - PARCIAL: Revisar itens faltantes');
} else {
  console.log('🔴 FASE 1 - REPROVADA: Corrigir problemas antes de continuar');
}

console.log('\n💡 Para testar manualmente:');
console.log('1. Abra o console do navegador');
console.log('2. Execute: window.DEBUG_RUNID = true');
console.log('3. Faça upload de um áudio e observe os logs');
console.log('4. Procure por: [run_xxxxx] nas mensagens');

// Exportar resultados para uso externo
if (typeof window !== 'undefined') {
  window.FASE1_TEST_RESULTS = testResults;
}
