// 🎯 BACKEND ENDPOINTS VERIFICATION
// Verificação dos endpoints necessários para o pipeline Node.js

console.log('🔍 Verificando endpoints do backend...');

/**
 * 🌐 VERIFICAÇÃO DOS ENDPOINTS NECESSÁRIOS
 */
async function verifyBackendEndpoints() {
  const endpoints = [
    { name: 'Presign', path: '/presign', method: 'POST' },
    { name: 'Process', path: '/process', method: 'POST' },
    { name: 'Jobs', path: '/jobs/test', method: 'GET' }
  ];
  
  console.group('🔍 VERIFICAÇÃO DE ENDPOINTS');
  
  let allGood = true;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🌐 Testando ${endpoint.name} (${endpoint.method} ${endpoint.path})...`);
      
      const response = await fetch(endpoint.path, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: endpoint.method === 'POST' ? JSON.stringify({ test: true }) : undefined
      });
      
      if (response.status === 404) {
        console.warn(`⚠️ ${endpoint.name}: Endpoint não encontrado (404)`);
        allGood = false;
      } else if (response.status >= 500) {
        console.error(`❌ ${endpoint.name}: Erro no servidor (${response.status})`);
        allGood = false;
      } else {
        console.log(`✅ ${endpoint.name}: Endpoint disponível (${response.status})`);
      }
      
    } catch (error) {
      console.error(`❌ ${endpoint.name}: Erro de rede`, error.message);
      allGood = false;
    }
  }
  
  if (allGood) {
    console.log('🎯 RESULTADO: Todos os endpoints parecem estar disponíveis!');
  } else {
    console.warn('⚠️ RESULTADO: Alguns endpoints podem não estar configurados.');
    console.warn('💡 Certifique-se de que o servidor Node.js está rodando com os endpoints:');
    console.warn('   - POST /presign (para upload de arquivos)');
    console.warn('   - POST /process (para iniciar análise)');
    console.warn('   - GET /jobs/:id (para consultar status)');
  }
  
  console.groupEnd();
  return allGood;
}

/**
 * 🛠️ FERRAMENTAS DE DEBUG PARA DESENVOLVEDORES
 */
window.debugBackendSystem = function() {
  console.group('🛠️ DEBUG SISTEMA BACKEND');
  
  console.log('📋 Configuração atual:');
  console.log('   - Config:', window.BACKEND_AUDIO_CONFIG);
  console.log('   - Estado:', window.AudioAnalysisState || 'Não carregado');
  
  console.log('🔧 Funções disponíveis:');
  console.log('   - analyzeWithBackend:', typeof window.analyzeWithBackend);
  console.log('   - resetAudioModal:', typeof window.resetAudioModal);
  console.log('   - sendModalAnalysisToChat:', typeof window.sendModalAnalysisToChat);
  console.log('   - downloadModalAnalysis:', typeof window.downloadModalAnalysis);
  
  console.log('🖼️ Elementos DOM:');
  console.log('   - Upload Area:', !!document.getElementById('audioUploadArea'));
  console.log('   - Loading Area:', !!document.getElementById('audioAnalysisLoading'));
  console.log('   - Results Area:', !!document.getElementById('audioAnalysisResults'));
  console.log('   - File Input:', !!document.getElementById('modalAudioFileInput'));
  console.log('   - Technical Data:', !!document.getElementById('modalTechnicalData'));
  
  console.groupEnd();
};

/**
 * 🧪 TESTE COMPLETO DO SISTEMA
 */
window.testBackendSystem = async function() {
  console.group('🧪 TESTE COMPLETO DO SISTEMA BACKEND');
  
  try {
    // 1. Verificar endpoints
    console.log('1️⃣ Verificando endpoints...');
    const endpointsOk = await verifyBackendEndpoints();
    
    // 2. Verificar DOM
    console.log('2️⃣ Verificando elementos DOM...');
    const uploadArea = document.getElementById('audioUploadArea');
    const fileInput = document.getElementById('modalAudioFileInput');
    
    if (!uploadArea || !fileInput) {
      console.error('❌ Elementos DOM não encontrados. Modal pode não estar aberto.');
      console.log('💡 Abra o modal de análise de áudio primeiro.');
    } else {
      console.log('✅ Elementos DOM encontrados');
    }
    
    // 3. Verificar funções
    console.log('3️⃣ Verificando funções...');
    const functionsOk = typeof window.analyzeWithBackend === 'function';
    
    if (functionsOk) {
      console.log('✅ Funções carregadas');
    } else {
      console.error('❌ Funções não carregadas. Verifique se audio-backend-system.js foi carregado.');
    }
    
    // 4. Resultado final
    const allOk = endpointsOk && functionsOk;
    console.log(`🎯 RESULTADO FINAL: ${allOk ? '✅ SISTEMA PRONTO!' : '❌ VERIFICAR PROBLEMAS ACIMA'}`);
    
    if (allOk) {
      console.log('🚀 Para testar com arquivo real:');
      console.log('   1. Abra o modal de análise de áudio');
      console.log('   2. Selecione um arquivo WAV/FLAC/MP3');
      console.log('   3. O sistema usará 100% backend (Node.js Pipeline Fases 5.1-5.5)');
    }
    
  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
  
  console.groupEnd();
};

// Executar verificação automática quando carregado
document.addEventListener('DOMContentLoaded', async function() {
  // Aguardar um pouco para garantir que tudo carregou
  setTimeout(async () => {
    console.log('🔍 Executando verificação automática dos endpoints...');
    await verifyBackendEndpoints();
    
    console.log('💡 Comandos disponíveis no console:');
    console.log('   - debugBackendSystem() - Debug completo do sistema');
    console.log('   - testBackendSystem() - Teste completo');
    console.log('   - verifyBackendEndpoints() - Verificar apenas endpoints');
  }, 2000);
});

console.log('✅ Backend Endpoints Verification carregado');
console.log('💡 Execute testBackendSystem() no console para verificar tudo');
