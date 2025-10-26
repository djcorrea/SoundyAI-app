/**
 * 🔍 VERIFICADOR DE TÍTULOS DOS CARDS
 * Script de debug para validar se os títulos estão sendo renderizados corretamente
 */

(function() {
    console.log('🔍 Verificador de Títulos dos Cards - INICIADO');
    console.log('📅 Versão CSS: 20251024-titles');
    
    // Aguardar carregamento do DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verificarTitulos);
    } else {
        verificarTitulos();
    }
    
    function verificarTitulos() {
        console.log('🔍 Iniciando verificação de títulos...');
        
        // Aguardar 2 segundos para garantir que o modal foi renderizado
        setTimeout(() => {
            const technicalData = document.getElementById('modalTechnicalData');
            
            if (!technicalData) {
                console.warn('⚠️ Container #modalTechnicalData não encontrado');
                console.log('💡 Aguardando análise de áudio...');
                observarCriacaoDeCards();
                return;
            }
            
            const cards = technicalData.querySelectorAll('.cards-grid .card');
            console.log(`📦 Total de cards encontrados: ${cards.length}`);
            
            if (cards.length === 0) {
                console.warn('⚠️ Nenhum card encontrado. Aguardando análise de áudio...');
                observarCriacaoDeCards();
                return;
            }
            
            cards.forEach((card, index) => {
                const titulo = card.querySelector('.card-title');
                
                console.group(`📋 Card ${index + 1}`);
                
                if (titulo) {
                    console.log('✅ Título encontrado:', titulo.textContent.trim());
                    console.log('📐 Dimensões:', {
                        offsetWidth: titulo.offsetWidth,
                        offsetHeight: titulo.offsetHeight,
                        clientWidth: titulo.clientWidth,
                        clientHeight: titulo.clientHeight
                    });
                    console.log('🎨 Estilos computados:');
                    const computedStyle = window.getComputedStyle(titulo);
                    console.table({
                        'text-align': computedStyle.textAlign,
                        'font-family': computedStyle.fontFamily.substring(0, 50),
                        'font-size': computedStyle.fontSize,
                        'text-transform': computedStyle.textTransform,
                        'letter-spacing': computedStyle.letterSpacing,
                        'color': computedStyle.color,
                        'background': computedStyle.background.substring(0, 50),
                        'display': computedStyle.display,
                        'visibility': computedStyle.visibility,
                        'opacity': computedStyle.opacity,
                        'width': computedStyle.width,
                        'margin-bottom': computedStyle.marginBottom,
                        'padding-bottom': computedStyle.paddingBottom,
                        'border-bottom': computedStyle.borderBottom
                    });
                    
                    // Verificar se está visível
                    const rect = titulo.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0;
                    console.log('👁️ Visível na tela:', isVisible);
                    if (isVisible) {
                        console.log('📍 Posição:', { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
                    }
                } else {
                    console.error('❌ Título NÃO encontrado!');
                    console.log('📄 HTML do card (primeiros 300 chars):', card.innerHTML.substring(0, 300) + '...');
                }
                
                console.groupEnd();
            });
            
            // Verificar se existem títulos esperados
            const titulosEsperados = [
                'MÉTRICAS PRINCIPAIS',
                'MÉTRICAS AVANÇADAS',
                'SUB SCORES',
                'BANDAS ESPECTRAIS'
            ];
            
            const titulosEncontrados = Array.from(cards)
                .map(card => {
                    const titulo = card.querySelector('.card-title');
                    return titulo ? titulo.textContent.trim() : null;
                })
                .filter(t => t !== null);
            
            console.group('📊 Resumo da Verificação');
            console.log('Títulos esperados:', titulosEsperados);
            console.log('Títulos encontrados:', titulosEncontrados);
            
            const todosEncontrados = titulosEsperados.every(esperado => 
                titulosEncontrados.some(encontrado => encontrado.includes(esperado))
            );
            
            if (todosEncontrados) {
                console.log('%c✅ TODOS OS TÍTULOS FORAM ENCONTRADOS!', 'color: #00ff00; font-size: 16px; font-weight: bold;');
            } else {
                console.error('%c❌ ALGUNS TÍTULOS ESTÃO FALTANDO!', 'color: #ff0000; font-size: 16px; font-weight: bold;');
                const faltando = titulosEsperados.filter(esperado => 
                    !titulosEncontrados.some(encontrado => encontrado.includes(esperado))
                );
                console.error('Faltando:', faltando);
            }
            console.groupEnd();
            
            // Verificar cache do CSS
            const linkCSS = document.querySelector('link[href*="audio-analyzer.css"]');
            if (linkCSS) {
                console.log('📁 CSS carregado:', linkCSS.href);
            }
            
        }, 2000);
    }
    
    function observarCriacaoDeCards() {
        console.log('👀 Observando criação de cards...');
        
        const observer = new MutationObserver((mutations) => {
            const technicalData = document.getElementById('modalTechnicalData');
            if (technicalData) {
                const cards = technicalData.querySelectorAll('.cards-grid .card');
                if (cards.length > 0) {
                    console.log('🎉 Cards foram criados! Re-verificando...');
                    observer.disconnect();
                    setTimeout(verificarTitulos, 500);
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Adicionar comando global para verificação manual
    window.verificarTitulosCards = verificarTitulos;
    console.log('💡 Execute no console: verificarTitulosCards()');
    console.log('📌 OU aguarde o upload de um áudio para verificação automática');
})();
