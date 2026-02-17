/**
 * Hub Redirect Handler
 * Processa parâmetros de redirecionamento do hub.html
 * Para ser incluído no index.html
 */

(function() {
  'use strict';
  
  log('[HUB-REDIRECT] Inicializando handler de redirecionamento');
  
  // Aguardar DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHubRedirect);
  } else {
    initHubRedirect();
  }
  
  function initHubRedirect() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Verificar parâmetro openAnalyze
      if (urlParams.get('openAnalyze') === 'true') {
        log('[HUB-REDIRECT] Parâmetro openAnalyze detectado, abrindo modal de análise');
        
        // Google Analytics
        if (typeof gtag === 'function') {
          gtag('event', 'hub_redirect_analyze', {
            'source': 'hub'
          });
        }
        
        // Aguardar um pouco para garantir que a página carregou
        setTimeout(() => {
          // Tentar múltiplas formas de abrir o modal de análise
          
          // Método 1: Trigger no botão de upload se existir
          const uploadButton = document.querySelector('[data-action="upload"]') || 
                              document.querySelector('.upload-button') ||
                              document.querySelector('#uploadButton');
          
          if (uploadButton) {
            log('[HUB-REDIRECT] Acionando botão de upload');
            uploadButton.click();
          } 
          // Método 2: Chamar função global se existir
          else if (typeof window.openUploadModal === 'function') {
            log('[HUB-REDIRECT] Chamando função openUploadModal');
            window.openUploadModal();
          }
          // Método 3: Chamar função de análise se existir
          else if (typeof window.startAnalysis === 'function') {
            log('[HUB-REDIRECT] Chamando função startAnalysis');
            window.startAnalysis();
          }
          // Método 4: Trigger evento customizado
          else {
            log('[HUB-REDIRECT] Disparando evento customizado open-analyze');
            const event = new CustomEvent('open-analyze', { 
              detail: { source: 'hub' }
            });
            document.dispatchEvent(event);
          }
          
          // Limpar URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
      }
      
      // Verificar parâmetro openMaster
      if (urlParams.get('openMaster') === 'true') {
        log('[HUB-REDIRECT] Parâmetro openMaster detectado, abrindo masterização');
        
        // Google Analytics
        if (typeof gtag === 'function') {
          gtag('event', 'hub_redirect_master', {
            'source': 'hub'
          });
        }
        
        // Aguardar um pouco para garantir que a página carregou
        setTimeout(() => {
          // Tentar múltiplas formas de abrir masterização
          
          // Método 1: Chamar função global se existir
          if (typeof window.openMasterModal === 'function') {
            log('[HUB-REDIRECT] Chamando função openMasterModal');
            window.openMasterModal();
          }
          // Método 2: Trigger no botão de master se existir
          else {
            const masterButton = document.querySelector('[data-action="master"]') || 
                                document.querySelector('.master-button') ||
                                document.querySelector('#masterButton');
            
            if (masterButton) {
              log('[HUB-REDIRECT] Acionando botão de masterização');
              masterButton.click();
            } else {
              log('[HUB-REDIRECT] Disparando evento customizado open-master');
              const event = new CustomEvent('open-master', { 
                detail: { source: 'hub' }
              });
              document.dispatchEvent(event);
            }
          }
          
          // Limpar URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
      }
      
    } catch (error) {
      error('[HUB-REDIRECT] Erro ao processar redirecionamento:', error);
    }
  }
  
  log('[HUB-REDIRECT] Handler configurado');
  
})();
