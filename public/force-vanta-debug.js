// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🔧 FORCE VANTA DEBUG - Garantir que Vanta inicia
 * Temporário para debug
 */
(function() {
    log('🔧 [Force Vanta] Script de debug carregado');
    
    // Aguardar DOM e libs
    window.addEventListener('load', () => {
        log('🔧 [Force Vanta] Page loaded, esperando 2 segundos...');
        
        setTimeout(() => {
            log('🔧 [Force Vanta] Verificando estado...');
            
            // Verificar se EffectsController existe
            if (window.EffectsController) {
                log('✅ [Force Vanta] EffectsController encontrado');
                window.EffectsController.debug();
                
                // Verificar se Vanta está rodando
                const state = window.EffectsController.getState();
                log('🔧 [Force Vanta] Estado atual:', {
                    tier: state.currentTier,
                    hasVanta: state.hasVanta,
                    isKilled: state.isKilled,
                    visible: state.isDocumentVisible,
                    focused: state.isWindowFocused,
                    modal: state.isModalOpen,
                    reducedMotion: state.prefersReducedMotion
                });
                
                // Se não tem Vanta, tentar forçar
                if (!state.hasVanta && !state.isKilled) {
                    log('⚠️ [Force Vanta] Vanta não está rodando, forçando reinit...');
                    window.EffectsController.reinit();
                    
                    setTimeout(() => {
                        const newState = window.EffectsController.getState();
                        if (newState.hasVanta) {
                            log('✅ [Force Vanta] Vanta iniciado com sucesso!');
                        } else {
                            error('❌ [Force Vanta] Falha ao iniciar Vanta:', newState);
                        }
                    }, 1000);
                }
            } else {
                error('❌ [Force Vanta] EffectsController não encontrado!');
                
                // Verificar se libs estão carregadas
                log('🔧 [Force Vanta] Libs disponíveis:', {
                    VANTA: typeof VANTA !== 'undefined',
                    THREE: typeof THREE !== 'undefined',
                    elemento: !!document.getElementById('vanta-bg')
                });
            }
        }, 2000);
    });
})();
