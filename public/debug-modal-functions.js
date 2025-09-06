// 🔧 DEBUG MODAL FUNCTIONS
// Script para verificar se as funções de modal estão funcionando

console.log('🔧 Verificando funções de modal...');

function debugModalFunctions() {
  console.group('🔧 DEBUG FUNÇÕES DE MODAL');
  
  // Verificar se as funções estão definidas
  const modalFunctions = {
    'openAudioModal': window.openAudioModal,
    'closeAudioModal': window.closeAudioModal,
    'openModeSelectionModal': window.openModeSelectionModal,
    'closeModeSelectionModal': window.closeModeSelectionModal,
    'resetAudioModal': window.resetAudioModal,
    'analyzeWithBackend': window.analyzeWithBackend
  };
  
  console.log('📋 Status das funções:');
  Object.entries(modalFunctions).forEach(([name, func]) => {
    const status = typeof func === 'function' ? '✅ Definida' : '❌ Não definida';
    console.log(`   ${name}: ${status}`);
  });
  
  // Verificar elementos DOM
  console.log('🖼️ Elementos DOM:');
  const elements = {
    'analysisModeModal': document.getElementById('analysisModeModal'),
    'audioAnalysisModal': document.getElementById('audioAnalysisModal'),
    'modalAudioFileInput': document.getElementById('modalAudioFileInput'),
    'modalTechnicalData': document.getElementById('modalTechnicalData')
  };
  
  Object.entries(elements).forEach(([name, element]) => {
    const status = element ? '✅ Encontrado' : '❌ Não encontrado';
    console.log(`   ${name}: ${status}`);
  });
  
  // Verificar popovers
  console.log('🔲 Popovers:');
  const plusButtons = document.querySelectorAll('.chat-plus-btn');
  console.log(`   Botões "+" encontrados: ${plusButtons.length}`);
  
  plusButtons.forEach((btn, index) => {
    const configured = btn.hasAttribute('data-popover-configured');
    console.log(`   Botão ${index + 1}: ${configured ? '✅ Configurado' : '❌ Não configurado'}`);
  });
  
  console.groupEnd();
}

// Função para testar modal manualmente
function testOpenModal() {
  console.log('🧪 Testando abertura de modal...');
  
  if (typeof window.openAudioModal === 'function') {
    try {
      window.openAudioModal();
      console.log('✅ Modal aberto com sucesso');
    } catch (error) {
      console.error('❌ Erro ao abrir modal:', error);
    }
  } else {
    console.error('❌ Função openAudioModal não encontrada');
  }
}

// Função para verificar popover
function testPopover() {
  console.log('🧪 Testando popover...');
  
  const plusBtn = document.querySelector('.chat-plus-btn');
  if (plusBtn) {
    console.log('✅ Botão + encontrado');
    
    // Simular clique
    try {
      plusBtn.click();
      console.log('✅ Clique simulado');
      
      // Verificar se popover abriu
      setTimeout(() => {
        const popover = document.querySelector('.chatplus-popover[aria-hidden="false"]');
        if (popover) {
          console.log('✅ Popover aberto');
          
          // Procurar opção de análise
          const analyzeBtn = popover.querySelector('[data-action="analyze"]');
          if (analyzeBtn) {
            console.log('✅ Opção "Analisar música" encontrada');
          } else {
            console.log('❌ Opção "Analisar música" não encontrada');
          }
        } else {
          console.log('❌ Popover não abriu');
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Erro ao simular clique:', error);
    }
  } else {
    console.log('❌ Botão + não encontrado');
  }
}

// Função para forçar reconfiguração dos popovers
function reconfigurePopovers() {
  console.log('🔄 Forçando reconfiguração dos popovers...');
  
  // Remover configurações existentes
  const plusButtons = document.querySelectorAll('.chat-plus-btn');
  plusButtons.forEach(btn => {
    btn.removeAttribute('data-popover-configured');
  });
  
  // Remover popovers existentes
  const popovers = document.querySelectorAll('.chatplus-popover');
  popovers.forEach(pop => pop.remove());
  
  // Tentar encontrar e executar a função de setup do index.html
  try {
    const welcomeContainer = document.querySelector('.chatbot-input-field.chat-input-container');
    const welcomePlusBtn = welcomeContainer?.querySelector('.chatbot-add-btn.chat-plus-btn');
    
    const activeContainer = document.querySelector('.chatbot-active-input-field.chat-input-container');
    const activePlusBtn = activeContainer?.querySelector('.chatbot-add-btn.chat-plus-btn');
    
    // Simular a função setupPopoverForContainer que está no index.html
    // Nota: Esta função não está exposta globalmente, então precisamos recriar a lógica
    
    console.log('💡 Para reconfigurar completamente, recarregue a página');
    
  } catch (error) {
    console.error('❌ Erro na reconfiguração:', error);
  }
}

// Exportar funções para o console
window.debugModalFunctions = debugModalFunctions;
window.testOpenModal = testOpenModal;
window.testPopover = testPopover;
window.reconfigurePopovers = reconfigurePopovers;

// Executar debug automático
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    console.log('💡 Funções de debug disponíveis:');
    console.log('   debugModalFunctions() - Verificar status completo');
    console.log('   testOpenModal() - Testar abertura de modal');
    console.log('   testPopover() - Testar funcionamento do popover');
    console.log('   reconfigurePopovers() - Reconfigurar popovers');
    
    // Debug automático
    debugModalFunctions();
  }, 2000);
});

console.log('🔧 Debug Modal Functions carregado');
