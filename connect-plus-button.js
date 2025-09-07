/**
 * 🔥 HOTFIX SIMPLES - Conecta botão + ao modal existente
 * Restaura funcionalidade do modal original do usuário
 */

(function() {
    'use strict';
    
    console.log('🔥 [HOTFIX] Conectando botão + ao modal original...');
    
    // Função para conectar o botão + ao openAudioModal existente
    function connectPlusButtonToOriginalModal() {
        // Seletores para encontrar o botão +
        const selectors = [
            '.chatbot-add-btn',
            '.chat-plus-btn', 
            'button[aria-label="Adicionar"]',
            '.chatbot-input-field button:first-child',
            '.chat-input-container button:first-child'
        ];
        
        let plusButton = null;
        
        for (const selector of selectors) {
            plusButton = document.querySelector(selector);
            if (plusButton) {
                console.log(`✅ [HOTFIX] Botão + encontrado: ${selector}`);
                break;
            }
        }
        
        if (plusButton) {
            // Verificar se openAudioModal existe
            if (typeof window.openAudioModal === 'function') {
                console.log('✅ [HOTFIX] Função openAudioModal encontrada!');
                
                // Remover listeners antigos
                const newButton = plusButton.cloneNode(true);
                plusButton.parentNode.replaceChild(newButton, plusButton);
                
                // Adicionar novo listener
                newButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎵 [HOTFIX] Abrindo modal original...');
                    window.openAudioModal();
                });
                
                console.log('🎯 [HOTFIX] Botão + conectado ao modal original!');
                return true;
            } else {
                console.warn('⚠️ [HOTFIX] openAudioModal não encontrada, aguardando...');
                return false;
            }
        } else {
            console.warn('⚠️ [HOTFIX] Botão + não encontrado');
            return false;
        }
    }
    
    // Tentar conectar quando DOM estiver pronto
    function tryConnect() {
        if (!connectPlusButtonToOriginalModal()) {
            // Se não conseguiu, tentar novamente em 1 segundo
            setTimeout(tryConnect, 1000);
        }
    }
    
    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryConnect);
    } else {
        tryConnect();
    }
    
    // Observer para detectar mudanças no DOM
    const observer = new MutationObserver(() => {
        if (document.querySelector('.chatbot-add-btn') && typeof window.openAudioModal === 'function') {
            connectPlusButtonToOriginalModal();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Desconectar observer após 10 segundos
    setTimeout(() => observer.disconnect(), 10000);
    
    console.log('🎯 [HOTFIX] Sistema de conexão inicializado!');
    
})();
