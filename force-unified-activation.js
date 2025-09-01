/**
 * 🎯 FORÇADOR DE ATIVAÇÃO - SISTEMA UNIFICADO
 * 
 * Garante que o sistema unificado seja aplicado mesmo se houver conflitos
 * Executa patches agressivos para substituir completamente o sistema legacy
 */

(function() {
    'use strict';
    
    // Força ativação imediata
    window.STATUS_SUGGESTION_UNIFIED_V1 = true;
    
    // Intercepta e substitui qualquer tentativa de usar sistema legacy
    function forceUnifiedSystemApplication() {
        
        // Patch agressivo para createEnhancedDiffCell
        if (window.createEnhancedDiffCell && !window.createEnhancedDiffCellOriginal) {
            window.createEnhancedDiffCellOriginal = window.createEnhancedDiffCell;
        }
        
        // Substitui com versão unificada
        window.createEnhancedDiffCell = function(diff, unit, tolerance, metricName = '') {
            // Se sistema unificado disponível, usar sempre
            if (window.criarCelulaDiferenca && window.calcularStatusSugestaoUnificado) {
                // Converter diff para valor/alvo (assumindo alvo = 0 para diferenças)
                return window.criarCelulaDiferenca(diff, 0, tolerance, unit, metricName);
            }
            
            // Fallback melhorado que nunca gera sugestão para ideal
            let cssClass = 'na';
            let statusText = '';
            let suggestion = '';
            
            if (Number.isFinite(diff) && Number.isFinite(tolerance) && tolerance > 0) {
                const absDiff = Math.abs(diff);
                
                if (absDiff <= tolerance) {
                    cssClass = 'ok';
                    statusText = '✅ IDEAL';
                    suggestion = ''; // NUNCA sugestão se ideal
                } else {
                    const n = absDiff / tolerance;
                    if (n <= 2) {
                        cssClass = 'yellow';
                        statusText = '⚠️ AJUSTAR';
                        suggestion = diff > 0 ? '↓ DIMINUIR' : '↑ AUMENTAR';
                    } else {
                        cssClass = 'warn';
                        statusText = '🚨 CORRIGIR';
                        suggestion = diff > 0 ? '↓↓ REDUZIR' : '↑↑ ELEVAR';
                    }
                }
            }
            
            const diffValue = Number.isFinite(diff) ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit}` : '—';
            
            return `<td class="${cssClass}">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div style="font-size: 12px; font-weight: 600;">${diffValue}</div>
                    <div style="font-size: 10px; opacity: 0.8;">${statusText}</div>
                    ${suggestion ? `<div style="font-size: 9px; color: #666;">${suggestion}</div>` : ''}
                </div>
            </td>`;
        };
        
        // Intercepta qualquer lógica de status fragmentada
        window.determineStatus = function(value, target, tolerance) {
            if (window.calcularStatusSugestaoUnificado) {
                const resultado = window.calcularStatusSugestaoUnificado(value, target, tolerance);
                return {
                    status: resultado.status.toUpperCase(),
                    cssClass: resultado.cor,
                    suggestion: resultado.sugestao ? resultado.sugestao.texto : ''
                };
            }
            
            // Fallback consistente
            const diff = value - target;
            const absDiff = Math.abs(diff);
            
            if (absDiff <= tolerance) {
                return { status: 'IDEAL', cssClass: 'ok', suggestion: '' };
            } else if (absDiff <= 2 * tolerance) {
                return { 
                    status: 'AJUSTAR', 
                    cssClass: 'yellow', 
                    suggestion: diff > 0 ? 'DIMINUIR' : 'AUMENTAR' 
                };
            } else {
                return { 
                    status: 'CORRIGIR', 
                    cssClass: 'warn', 
                    suggestion: diff > 0 ? 'REDUZIR' : 'ELEVAR' 
                };
            }
        };
        
        // Substitui contador de problemas
        window.countProblems = function(metrics) {
            if (window.contarProblemasUnificado) {
                return window.contarProblemasUnificado(metrics);
            }
            
            // Fallback
            let problems = 0;
            for (const metric of metrics) {
                const status = window.determineStatus(metric.valor || metric.value, 
                                                   metric.alvo || metric.target, 
                                                   metric.tolerancia || metric.tolerance);
                if (status.status !== 'IDEAL') problems++;
            }
            return { total: problems, details: [] };
        };
        
        console.log('🎯 [FORCE-ACTIVATOR] Sistema unificado aplicado agressivamente');
    }
    
    // Aplicar imediatamente e reforçar periodicamente
    forceUnifiedSystemApplication();
    
    // Reforçar após carregamento de outros scripts
    setTimeout(forceUnifiedSystemApplication, 100);
    setTimeout(forceUnifiedSystemApplication, 500);
    setTimeout(forceUnifiedSystemApplication, 1000);
    
    // Observar mudanças no DOM que possam recriar elementos
    if (window.MutationObserver) {
        const observer = new MutationObserver(() => {
            forceUnifiedSystemApplication();
        });
        
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }
    
    // Expor função para reforço manual
    window.forceUnifiedSystem = forceUnifiedSystemApplication;
    
    console.log('🚀 [FORCE-ACTIVATOR] Forçador de ativação carregado');
    
})();
