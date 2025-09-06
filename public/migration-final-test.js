// 🧪 TESTE FINAL DA MIGRAÇÃO WEB AUDIO → BACKEND
// Script para validar que a migração foi bem-sucedida

console.log('🧪 Iniciando teste final da migração...');

/**
 * 🎯 CLASSE DE TESTE DA MIGRAÇÃO
 */
class MigrationTestSuite {
  constructor() {
    this.results = {
      oldSystemRemoved: false,
      newSystemLoaded: false,
      endpointsVerified: false,
      domElementsPresent: false,
      integrationWorking: false
    };
    this.errors = [];
  }

  /**
   * 🧪 EXECUTAR TODOS OS TESTES
   */
  async runAllTests() {
    console.group('🧪 TESTE FINAL DA MIGRAÇÃO');
    console.log('🎯 Verificando migração completa: Web Audio API → Backend Node.js');
    
    try {
      // 1. Verificar remoção do sistema antigo
      await this.testOldSystemRemoved();
      
      // 2. Verificar carregamento do novo sistema
      await this.testNewSystemLoaded();
      
      // 3. Verificar endpoints do backend
      await this.testBackendEndpoints();
      
      // 4. Verificar elementos DOM
      await this.testDOMElements();
      
      // 5. Verificar integração
      await this.testIntegration();
      
      // 6. Relatório final
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
      this.errors.push(`Erro geral: ${error.message}`);
    }
    
    console.groupEnd();
    return this.results;
  }

  /**
   * 1️⃣ VERIFICAR REMOÇÃO DO SISTEMA ANTIGO
   */
  async testOldSystemRemoved() {
    console.log('1️⃣ Verificando remoção do sistema Web Audio API...');
    
    const oldFunctions = [
      'initializeAudioAnalyzerIntegration',
      'loadAudioAnalyzer',
      'startAnalysis',
      'analyzeAudioFile' // se existir
    ];
    
    let removedCount = 0;
    oldFunctions.forEach(funcName => {
      if (typeof window[funcName] === 'undefined') {
        removedCount++;
      } else {
        this.errors.push(`Função antiga ainda existe: ${funcName}`);
      }
    });
    
    // Verificar scripts removidos no DOM
    const oldScripts = [
      'audio-analyzer.js',
      'audio-analyzer-integration.js'
    ];
    
    let scriptsRemoved = 0;
    oldScripts.forEach(scriptName => {
      const found = document.querySelector(`script[src*="${scriptName}"]`);
      if (!found) {
        scriptsRemoved++;
      } else {
        this.errors.push(`Script antigo ainda carregado: ${scriptName}`);
      }
    });
    
    this.results.oldSystemRemoved = (removedCount === oldFunctions.length) && 
                                   (scriptsRemoved === oldScripts.length);
    
    if (this.results.oldSystemRemoved) {
      console.log('✅ Sistema antigo removido com sucesso');
    } else {
      console.log('❌ Sistema antigo ainda presente');
    }
  }

  /**
   * 2️⃣ VERIFICAR CARREGAMENTO DO NOVO SISTEMA
   */
  async testNewSystemLoaded() {
    console.log('2️⃣ Verificando carregamento do sistema backend...');
    
    const newFunctions = [
      'analyzeWithBackend',
      'resetAudioModal',
      'sendModalAnalysisToChat',
      'downloadModalAnalysis'
    ];
    
    let loadedCount = 0;
    newFunctions.forEach(funcName => {
      if (typeof window[funcName] === 'function') {
        loadedCount++;
      } else {
        this.errors.push(`Função nova não encontrada: ${funcName}`);
      }
    });
    
    // Verificar scripts carregados
    const newScripts = [
      'audio-backend-system.js',
      'backend-endpoints-verification.js'
    ];
    
    let scriptsLoaded = 0;
    newScripts.forEach(scriptName => {
      const found = document.querySelector(`script[src*="${scriptName}"]`);
      if (found) {
        scriptsLoaded++;
      } else {
        this.errors.push(`Script novo não encontrado: ${scriptName}`);
      }
    });
    
    this.results.newSystemLoaded = (loadedCount === newFunctions.length) && 
                                  (scriptsLoaded === newScripts.length);
    
    if (this.results.newSystemLoaded) {
      console.log('✅ Sistema backend carregado com sucesso');
    } else {
      console.log('❌ Sistema backend não carregado completamente');
    }
  }

  /**
   * 3️⃣ VERIFICAR ENDPOINTS DO BACKEND
   */
  async testBackendEndpoints() {
    console.log('3️⃣ Verificando endpoints do backend...');
    
    const endpoints = [
      { path: '/presign', method: 'POST' },
      { path: '/process', method: 'POST' },
      { path: '/jobs/test', method: 'GET' }
    ];
    
    let workingEndpoints = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.path, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: endpoint.method === 'POST' ? JSON.stringify({ test: true }) : undefined
        });
        
        // Considerar sucesso se não for 404 (endpoint existe)
        if (response.status !== 404) {
          workingEndpoints++;
        } else {
          this.errors.push(`Endpoint não encontrado: ${endpoint.method} ${endpoint.path}`);
        }
        
      } catch (error) {
        this.errors.push(`Erro no endpoint ${endpoint.path}: ${error.message}`);
      }
    }
    
    this.results.endpointsVerified = workingEndpoints === endpoints.length;
    
    if (this.results.endpointsVerified) {
      console.log('✅ Endpoints do backend verificados');
    } else {
      console.log('⚠️ Alguns endpoints podem não estar configurados');
    }
  }

  /**
   * 4️⃣ VERIFICAR ELEMENTOS DOM
   */
  async testDOMElements() {
    console.log('4️⃣ Verificando elementos DOM...');
    
    const requiredElements = [
      'audioUploadArea',
      'audioAnalysisLoading', 
      'audioAnalysisResults',
      'modalTechnicalData'
    ];
    
    let foundElements = 0;
    requiredElements.forEach(elementId => {
      const element = document.getElementById(elementId);
      if (element) {
        foundElements++;
      } else {
        this.errors.push(`Elemento DOM não encontrado: ${elementId}`);
      }
    });
    
    this.results.domElementsPresent = foundElements === requiredElements.length;
    
    if (this.results.domElementsPresent) {
      console.log('✅ Elementos DOM presentes');
    } else {
      console.log('❌ Elementos DOM ausentes (modal pode não estar aberto)');
    }
  }

  /**
   * 5️⃣ VERIFICAR INTEGRAÇÃO
   */
  async testIntegration() {
    console.log('5️⃣ Verificando integração do sistema...');
    
    // Verificar configurações
    const configExists = window.BACKEND_AUDIO_CONFIG || window.BACKEND_CONFIG;
    if (!configExists) {
      this.errors.push('Configuração do backend não encontrada');
    }
    
    // Verificar se o input de arquivo tem listener
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput && !fileInput.hasAttribute('data-backend-setup')) {
      this.errors.push('Input de arquivo não configurado para backend');
    }
    
    this.results.integrationWorking = configExists && 
                                     (fileInput ? fileInput.hasAttribute('data-backend-setup') : true);
    
    if (this.results.integrationWorking) {
      console.log('✅ Integração funcionando');
    } else {
      console.log('❌ Problemas na integração');
    }
  }

  /**
   * 📊 GERAR RELATÓRIO FINAL
   */
  generateReport() {
    console.log('\n📊 RELATÓRIO FINAL DA MIGRAÇÃO');
    console.log('=' .repeat(50));
    
    const testResults = [
      { name: 'Sistema antigo removido', result: this.results.oldSystemRemoved },
      { name: 'Sistema backend carregado', result: this.results.newSystemLoaded },
      { name: 'Endpoints verificados', result: this.results.endpointsVerified },
      { name: 'Elementos DOM presentes', result: this.results.domElementsPresent },
      { name: 'Integração funcionando', result: this.results.integrationWorking }
    ];
    
    let passedTests = 0;
    testResults.forEach(test => {
      const status = test.result ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      if (test.result) passedTests++;
    });
    
    console.log('=' .repeat(50));
    console.log(`📈 RESULTADO: ${passedTests}/${testResults.length} testes passaram`);
    
    if (passedTests === testResults.length) {
      console.log('🎉 MIGRAÇÃO COMPLETA E FUNCIONAL!');
      console.log('🚀 Sistema 100% backend pronto para produção');
    } else {
      console.log('⚠️ MIGRAÇÃO PARCIAL - Verificar erros:');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (this.errors.length === 0 || passedTests >= 3) {
      console.log('\n💡 PRÓXIMOS PASSOS:');
      console.log('1. Configurar endpoints do backend Node.js');
      console.log('2. Testar upload de arquivo real');
      console.log('3. Verificar processamento completo');
      console.log('4. Validar resultados equivalentes');
    }
  }
}

/**
 * 🎯 FUNÇÃO GLOBAL PARA EXECUTAR TESTE
 */
window.testFinalMigration = async function() {
  const testSuite = new MigrationTestSuite();
  return await testSuite.runAllTests();
};

/**
 * 🔧 UTILITÁRIOS DE DEBUG
 */
window.debugMigrationStatus = function() {
  console.group('🔧 STATUS DA MIGRAÇÃO');
  
  console.log('📦 Scripts carregados:');
  const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
  scripts.forEach(src => {
    if (src.includes('audio-') || src.includes('backend-')) {
      console.log(`   • ${src.split('/').pop()}`);
    }
  });
  
  console.log('🔧 Funções globais (audio):');
  Object.keys(window).forEach(key => {
    if (key.toLowerCase().includes('audio') || key.toLowerCase().includes('analyze')) {
      console.log(`   • ${key}: ${typeof window[key]}`);
    }
  });
  
  console.log('🎯 Estado do sistema:');
  console.log(`   • AudioAnalysisState: ${typeof window.AudioAnalysisState}`);
  console.log(`   • BACKEND_CONFIG: ${typeof window.BACKEND_AUDIO_CONFIG}`);
  
  console.groupEnd();
};

// Executar teste automaticamente após carregamento
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    console.log('💡 Execute no console para testar a migração:');
    console.log('   • testFinalMigration() - Teste completo');
    console.log('   • debugMigrationStatus() - Status detalhado');
  }, 3000);
});

console.log('✅ Teste de Migração carregado');
console.log('💡 Execute: testFinalMigration()');
