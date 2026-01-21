// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// Script para forçar carregamento do notebook e teclado
document.addEventListener('DOMContentLoaded', function() {
    log('🔍 Verificando carregamento do notebook e teclado...');
    
    const notebook = document.querySelector('.notebook');
    const teclado = document.querySelector('.teclado');
    
    function forceElementVisibility(element, name) {
        if (element) {
            // Forçar visibilidade
            element.style.opacity = '1';
            element.style.visibility = 'visible';
            element.style.transform = 'none';
            element.style.display = 'block';
            
            // Verificar se a imagem carregou
            if (element.complete && element.naturalHeight !== 0) {
                log(`✅ ${name} carregado com sucesso`);
            } else {
                log(`⚠️ ${name} não carregou, tentando recarregar...`);
                
                // Tentar recarregar a imagem
                const originalSrc = element.src;
                element.src = '';
                setTimeout(() => {
                    element.src = originalSrc;
                }, 100);
                
                // Listener para quando carregar
                element.addEventListener('load', () => {
                    log(`✅ ${name} recarregado com sucesso`);
                    element.style.opacity = '1';
                });
                
                element.addEventListener('error', () => {
                    log(`❌ Erro ao carregar ${name}`);
                    // Tentar versão PNG como fallback
                    if (element.src.includes('.webp')) {
                        const fallbackSrc = element.src.replace('.webp', '.png');
                        log(`🔄 Tentando fallback PNG para ${name}: ${fallbackSrc}`);
                        element.src = fallbackSrc;
                    }
                });
            }
        } else {
            log(`❌ Elemento ${name} não encontrado no DOM`);
        }
    }
    
    // Aplicar para notebook e teclado
    forceElementVisibility(notebook, 'notebook');
    forceElementVisibility(teclado, 'teclado');
    
    // Verificação adicional após 2 segundos
    setTimeout(() => {
        log('🔍 Verificação final de visibilidade...');
        
        if (notebook) {
            const notebookVisible = window.getComputedStyle(notebook).opacity !== '0';
            log(`📊 Notebook visível: ${notebookVisible}`);
            if (!notebookVisible) {
                notebook.style.opacity = '1';
                notebook.style.visibility = 'visible';
            }
        }
        
        if (teclado) {
            const tecladoVisible = window.getComputedStyle(teclado).opacity !== '0';
            log(`📊 Teclado visível: ${tecladoVisible}`);
            if (!tecladoVisible) {
                teclado.style.opacity = '1';
                teclado.style.visibility = 'visible';
            }
        }
    }, 2000);
});

// Verificação adicional quando a página carregar completamente
window.addEventListener('load', function() {
    log('🚀 Página carregada completamente, verificando elementos...');
    
    const notebook = document.querySelector('.notebook');
    const teclado = document.querySelector('.teclado');
    
    if (notebook) {
        log('📋 Notebook:', {
            src: notebook.src,
            complete: notebook.complete,
            naturalHeight: notebook.naturalHeight,
            opacity: window.getComputedStyle(notebook).opacity,
            visibility: window.getComputedStyle(notebook).visibility
        });
    }
    
    if (teclado) {
        log('📋 Teclado:', {
            src: teclado.src,
            complete: teclado.complete,
            naturalHeight: teclado.naturalHeight,
            opacity: window.getComputedStyle(teclado).opacity,
            visibility: window.getComputedStyle(teclado).visibility
        });
    }
});
