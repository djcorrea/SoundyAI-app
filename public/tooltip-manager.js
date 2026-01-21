// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🎯 TOOLTIP MANAGER - Sistema Global de Tooltips
 * 
 * Sistema robusto com event delegation para suportar conteúdo dinâmico
 * Não depende de listeners inline - sobrevive a re-renders
 * 
 * USO:
 * <div data-tooltip-title="Título" data-tooltip-body="Descrição">Elemento</div>
 * <div data-tooltip-title="Título" data-tooltip-body="Texto" data-tooltip-variant="warning">Elemento</div>
 */

(function initTooltipManager() {
    'use strict';

    let currentTooltip = null;
    let hideTimeout = null;

    /**
     * Cria o elemento tooltip global (singleton)
     */
    function createTooltipElement() {
        const existing = document.getElementById('soundy-tooltip-global');
        if (existing) return existing;

        const tooltip = document.createElement('div');
        tooltip.id = 'soundy-tooltip-global';
        tooltip.className = 'soundy-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(15, 15, 25, 0.97);
            border: 1px solid rgba(0, 212, 255, 0.4);
            border-radius: 12px;
            padding: 12px 16px;
            font-size: 13px;
            line-height: 1.5;
            color: #e0e8ff;
            max-width: 400px;
            min-width: 200px;
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.7),
                0 0 40px rgba(0, 212, 255, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 999999;
            pointer-events: none;
            opacity: 0;
            transform: translateY(-5px);
            transition: opacity 0.25s ease, transform 0.25s ease;
            word-wrap: break-word;
            white-space: normal;
            display: none;
        `;

        // Estrutura interna
        tooltip.innerHTML = `
            <div class="soundy-tooltip-title" style="
                font-weight: 600;
                font-size: 13px;
                margin-bottom: 6px;
                color: #00d4ff;
                display: none;
            "></div>
            <div class="soundy-tooltip-body" style="
                font-size: 12px;
                color: rgba(224, 232, 255, 0.9);
            "></div>
        `;

        document.body.appendChild(tooltip);
        return tooltip;
    }

    /**
     * Posiciona o tooltip próximo ao elemento alvo
     */
    function positionTooltip(tooltip, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        const padding = 12;
        const arrowSize = 8;
        
        // Posição preferida: abaixo do elemento, centralizado
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.bottom + arrowSize + padding;
        
        // Ajustar se sair da tela (horizontal)
        if (left < padding) {
            left = padding;
        } else if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }
        
        // Ajustar se sair da tela (vertical) - mostrar acima se necessário
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = rect.top - tooltipRect.height - arrowSize - padding;
            
            // Se ainda não couber, forçar dentro da viewport
            if (top < padding) {
                top = padding;
            }
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * Mostra o tooltip
     */
    function showTooltip(targetElement) {
        const title = targetElement.getAttribute('data-tooltip-title');
        const body = targetElement.getAttribute('data-tooltip-body');
        const variant = targetElement.getAttribute('data-tooltip-variant') || 'default';

        if (!body && !title) return;

        // Cancelar hide pendente
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        const tooltip = createTooltipElement();
        const titleEl = tooltip.querySelector('.soundy-tooltip-title');
        const bodyEl = tooltip.querySelector('.soundy-tooltip-body');

        // Preencher conteúdo
        if (title) {
            titleEl.textContent = title;
            titleEl.style.display = 'block';
        } else {
            titleEl.style.display = 'none';
        }

        bodyEl.textContent = body || '';

        // Variante warning (True Peak crítico)
        if (variant === 'warning') {
            tooltip.style.borderColor = 'rgba(255, 107, 107, 0.5)';
            tooltip.style.background = 'rgba(40, 15, 15, 0.97)';
            if (title) {
                titleEl.style.color = '#ff6b6b';
            }
        } else {
            tooltip.style.borderColor = 'rgba(0, 212, 255, 0.4)';
            tooltip.style.background = 'rgba(15, 15, 25, 0.97)';
            if (title) {
                titleEl.style.color = '#00d4ff';
            }
        }

        // Mostrar e posicionar
        tooltip.style.display = 'block';
        
        // Força reflow antes de posicionar
        void tooltip.offsetHeight;
        
        positionTooltip(tooltip, targetElement);

        // Animar entrada
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        });

        currentTooltip = tooltip;
    }

    /**
     * Esconde o tooltip
     */
    function hideTooltip(immediate = false) {
        if (!currentTooltip) return;

        const tooltip = currentTooltip;

        if (immediate) {
            tooltip.style.display = 'none';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(-5px)';
            currentTooltip = null;
        } else {
            // Animar saída
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(-5px)';
            
            hideTimeout = setTimeout(() => {
                tooltip.style.display = 'none';
                currentTooltip = null;
                hideTimeout = null;
            }, 250);
        }
    }

    /**
     * Event delegation - mouseover em qualquer elemento com data-tooltip
     */
    document.addEventListener('mouseover', function(event) {
        const target = event.target.closest('[data-tooltip-title], [data-tooltip-body]');
        
        if (target) {
            showTooltip(target);
        }
    }, { passive: true });

    /**
     * Event delegation - mouseout
     */
    document.addEventListener('mouseout', function(event) {
        const target = event.target.closest('[data-tooltip-title], [data-tooltip-body]');
        
        if (target) {
            hideTooltip(false);
        }
    }, { passive: true });

    /**
     * Esconder ao rolar ou redimensionar
     */
    window.addEventListener('scroll', () => hideTooltip(true), { passive: true });
    window.addEventListener('resize', () => hideTooltip(true), { passive: true });

    log('[TOOLTIP-MANAGER] ✅ Sistema global de tooltips inicializado (event delegation)');

})();
