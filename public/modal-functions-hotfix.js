// 🚀 MODAL FUNCTIONS HOTFIX - Carregamento Imediato
// Definir funções de modal ANTES de qualquer outro script

console.log('🚀 Carregando funções de modal (hotfix)...');

// Listener para evento customizado como fallback
window.addEventListener('chat:analyze-audio-request', function() {
  console.log('📡 Evento chat:analyze-audio-request recebido');
  setTimeout(() => {
    if (typeof window.openAudioModal === 'function') {
      console.log('🔄 Executando openAudioModal via evento customizado');
      window.openAudioModal();
    }
  }, 50);
});

// ⚡ DEFINIR FUNÇÕES ESSENCIAIS IMEDIATAMENTE
(function() {
  'use strict';
  
  // Estado global básico
  window.AudioModalState = {
    isOpen: false,
    currentModal: null
  };
  
  // 🎯 ABRIR MODAL DE ANÁLISE DE ÁUDIO
  window.openAudioModal = function() {
    console.log('🎵 [HOTFIX] Abrindo modal de análise de áudio');
    console.log('🔍 [HOTFIX] Estado atual do DOM:', document.readyState);
    
    try {
      // Fechar modal de seleção se aberto
      const modeModal = document.getElementById('analysisModeModal');
      if (modeModal) {
        modeModal.style.display = 'none';
        console.log('🔧 [HOTFIX] Modal de modo fechado');
      }
      
      // Abrir modal de análise
      const modal = document.getElementById('audioAnalysisModal');
      console.log('🔍 [HOTFIX] Modal encontrado:', !!modal);
      
      if (modal) {
        modal.style.display = 'flex';
        window.AudioModalState.isOpen = true;
        window.AudioModalState.currentModal = 'analysis';
        
        // Reset básico do modal
        resetAudioModalBasic();
        
        console.log('✅ [HOTFIX] Modal de análise aberto com sucesso');
        
        // Configurar input de arquivo se não foi configurado
        if (typeof window.setupFileInput === 'function') {
          setTimeout(() => {
            window.setupFileInput();
            console.log('🔧 [HOTFIX] Input de arquivo configurado');
          }, 100);
        }
        
      } else {
        console.error('❌ [HOTFIX] Modal audioAnalysisModal não encontrado no DOM');
        console.log('🔍 [HOTFIX] Modais disponíveis:', 
          Array.from(document.querySelectorAll('[id*="modal"], [id*="Modal"]')).map(m => m.id));
      }
      
    } catch (error) {
      console.error('❌ [HOTFIX] Erro ao abrir modal:', error);
    }
  };
  
  // 🔧 FECHAR MODAL DE ANÁLISE DE ÁUDIO
  window.closeAudioModal = function() {
    console.log('🔧 [HOTFIX] Fechando modal de análise de áudio');
    
    try {
      const modal = document.getElementById('audioAnalysisModal');
      if (modal) {
        modal.style.display = 'none';
        window.AudioModalState.isOpen = false;
        window.AudioModalState.currentModal = null;
        
        // Reset básico
        resetAudioModalBasic();
        
        console.log('✅ [HOTFIX] Modal fechado');
      }
    } catch (error) {
      console.error('❌ [HOTFIX] Erro ao fechar modal:', error);
    }
  };
  
  // 🎯 ABRIR MODAL DE SELEÇÃO DE MODO
  window.openModeSelectionModal = function() {
    console.log('🎯 [HOTFIX] Abrindo modal de seleção de modo');
    
    try {
      const modal = document.getElementById('analysisModeModal');
      if (modal) {
        modal.style.display = 'flex';
        window.AudioModalState.isOpen = true;
        window.AudioModalState.currentModal = 'mode';
        console.log('✅ [HOTFIX] Modal de seleção aberto');
      } else {
        console.warn('⚠️ [HOTFIX] Modal de seleção não encontrado, abrindo análise direta');
        window.openAudioModal();
      }
    } catch (error) {
      console.error('❌ [HOTFIX] Erro ao abrir modal de seleção:', error);
      // Fallback
      window.openAudioModal();
    }
  };
  
  // 🔧 FECHAR MODAL DE SELEÇÃO DE MODO
  window.closeModeSelectionModal = function() {
    console.log('🔧 [HOTFIX] Fechando modal de seleção de modo');
    
    try {
      const modal = document.getElementById('analysisModeModal');
      if (modal) {
        modal.style.display = 'none';
        
        if (window.AudioModalState.currentModal === 'mode') {
          window.AudioModalState.isOpen = false;
          window.AudioModalState.currentModal = null;
        }
        
        console.log('✅ [HOTFIX] Modal de seleção fechado');
      }
    } catch (error) {
      console.error('❌ [HOTFIX] Erro ao fechar modal de seleção:', error);
    }
  };
  
  // 🔄 RESET BÁSICO DO MODAL
  function resetAudioModalBasic() {
    try {
      // Mostrar área de upload
      const uploadArea = document.getElementById('audioUploadArea');
      const loadingArea = document.getElementById('audioAnalysisLoading'); 
      const resultsArea = document.getElementById('audioAnalysisResults');
      
      if (uploadArea) uploadArea.style.display = 'block';
      if (loadingArea) loadingArea.style.display = 'none';
      if (resultsArea) resultsArea.style.display = 'none';
      
      // Reset do input de arquivo
      const fileInput = document.getElementById('modalAudioFileInput');
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('❌ [HOTFIX] Erro no reset básico:', error);
    }
  }
  
  window.resetAudioModalBasic = resetAudioModalBasic;
  
  // 🎯 FUNÇÃO PARA SELECIONAR MODO DE ANÁLISE
  window.selectAnalysisMode = function(mode) {
    console.log(`🎯 [HOTFIX] Modo selecionado: ${mode}`);
    
    try {
      // Fechar modal de seleção
      window.closeModeSelectionModal();
      
      // Abrir modal de análise
      window.openAudioModal();
      
      // Atualizar título baseado no modo
      const title = document.getElementById('audioModalTitle');
      const subtitle = document.getElementById('audioModalSubtitle');
      
      if (mode === 'genre') {
        if (title) title.textContent = '🎵 Análise por Gênero';
        if (subtitle) {
          subtitle.style.display = 'block';
          subtitle.textContent = 'Comparação com padrões profissionais do gênero';
        }
      } else if (mode === 'reference') {
        if (title) title.textContent = '🎯 Análise por Referência';
        if (subtitle) {
          subtitle.style.display = 'block';
          subtitle.textContent = 'Comparação com música de referência específica';
        }
      }
      
    } catch (error) {
      console.error('❌ [HOTFIX] Erro ao selecionar modo:', error);
    }
  };
  
  console.log('✅ [HOTFIX] Funções de modal definidas');
  
})();

// 🔧 VERIFICAÇÃO PERIÓDICA
function verifyModalFunctions() {
  const functions = ['openAudioModal', 'closeAudioModal', 'openModeSelectionModal', 'closeModeSelectionModal'];
  const missing = functions.filter(fn => typeof window[fn] !== 'function');
  
  if (missing.length > 0) {
    console.warn(`⚠️ [HOTFIX] Funções ausentes: ${missing.join(', ')}`);
    return false;
  }
  
  console.log('✅ [HOTFIX] Todas as funções de modal estão disponíveis');
  return true;
}

// Verificar após carregamento
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    verifyModalFunctions();
    
    // Testar se o popover consegue encontrar as funções
    console.log('🧪 [HOTFIX] Testando disponibilidade para popover:');
    console.log('   window.openAudioModal:', typeof window.openAudioModal);
    
  }, 1000);
});

console.log('🚀 Modal Functions Hotfix carregado');
