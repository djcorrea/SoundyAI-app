// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🎯 FORÇADOR DE ATIVAÇÃO - SISTEMA UNIFICADO
 * 
 * Garante que o sistema unificado seja aplicado mesmo se houver conflitos
 * Executa patches agressivos para substituir completamente o sistema legacy
 */

(function() {
    'use strict';
    
    // === [SAFE-GUARD BOOT] ====================================
    if (!window.audioAnalyzer || !window.CACHE_CTX_AWARE_V1_API || !window.refsReady) {
        warn("⏳ ForceActivator adiado: sistema ainda não está pronto.");
        log("Estado atual:", {
            audioAnalyzer: !!window.audioAnalyzer,
            CACHE_CTX_AWARE_V1_API: !!window.CACHE_CTX_AWARE_V1_API,
            refsReady: !!window.refsReady
        });

        // Escuta o evento que marca a inicialização real do sistema de áudio
        document.addEventListener("analysisReady", () => {
            log("✅ ForceActivator executado após sistema pronto (analysisReady).");
            try {
                // Re-executa a IIFE completa quando o sistema estiver pronto
                if (!window.FORCE_ACTIVATOR_ALREADY_RUN) {
                    window.STATUS_SUGGESTION_UNIFIED_V1 = true;
                    safeForceActivator();
                }
            } catch (err) {
                error("❌ Erro ao aplicar ForceActivator pós-ready:", err);
            }
        }, { once: true });

        // Não continua agora — aguarda o evento
        return;
    }
    // ===========================================================
    
    // Força ativação imediata
    window.STATUS_SUGGESTION_UNIFIED_V1 = true;
    
    // 🎯 CONTADOR DE TENTATIVAS E FUNÇÃO SEGURA PARA METRICS CORE
    let forceCheckAttempts = 0;
    
    function safeForceActivator() {
        const ready =
            window.audioAnalyzer &&
            window.audioAnalyzer.metrics &&
            window.audioAnalyzer.metrics.truePeak &&
            window.audioAnalyzer.metrics.dynamicRange &&
            window.CACHE_CTX_AWARE_V1_API &&
            window.refsReady === true;

        if (!ready) {
            if (forceCheckAttempts < 10) {
                log("⏳ ForceActivator aguardando métricas core...");
                forceCheckAttempts++;
                setTimeout(safeForceActivator, 300);
            } else {
                warn("⚠️ ForceActivator cancelado após 10 tentativas.");
            }
            return;
        }

        log("✅ ForceActivator executado após sistema pronto (metrics core detectadas)");
        forceUnifiedSystemApplication();
    }
    
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
        
        // 🔍 AUDITORIA: Registrar estado do sistema no momento da ativação
        const timestamp = new Date().toISOString();
        const auditData = {
            timestamp,
            audioAnalyzer: typeof window.audioAnalyzer !== 'undefined' ? 'defined' : 'undefined',
            cacheCtxAware: typeof window.CACHE_CTX_AWARE_V1_API !== 'undefined' ? 'defined' : 'undefined',
            refsReady: typeof window.refsReady !== 'undefined' ? window.refsReady : 'undefined',
            genre: typeof window.currentGenre !== 'undefined' ? window.currentGenre : 'undefined',
            audioLoaded: typeof window.audioLoaded !== 'undefined' ? window.audioLoaded : 'undefined',
            stackTrace: new Error().stack
        };
        
        log('🎯 [FORCE-ACTIVATOR] Sistema unificado aplicado agressivamente');
        log('--- FORCE-ACTIVATOR AUDIT ---');
        log('Timestamp:', auditData.timestamp);
        log('audioAnalyzer:', auditData.audioAnalyzer);
        log('CACHE_CTX_AWARE_V1_API:', auditData.cacheCtxAware);
        log('refsReady:', auditData.refsReady);
        log('genre:', auditData.genre);
        log('audioLoaded:', auditData.audioLoaded);
        log('Stack trace:', auditData.stackTrace);
        log('-------------------------------');
    }
    
    // Aplicar imediatamente e reforçar periodicamente
    if (window.FORCE_ACTIVATOR_ALREADY_RUN) {
        warn("⏩ ForceActivator já foi executado, ignorando chamada duplicada.");
        return;
    }
    window.FORCE_ACTIVATOR_ALREADY_RUN = true;
    
    safeForceActivator();
    
    // Reforçar após carregamento de outros scripts (com proteção anti-duplicação)
    setTimeout(() => {
        if (!window.FORCE_ACTIVATOR_ALREADY_RUN) {
            safeForceActivator();
        }
    }, 100);
    setTimeout(() => {
        if (!window.FORCE_ACTIVATOR_ALREADY_RUN) {
            safeForceActivator();
        }
    }, 500);
    setTimeout(() => {
        if (!window.FORCE_ACTIVATOR_ALREADY_RUN) {
            safeForceActivator();
        }
    }, 1000);
    
    // Observar mudanças no DOM que possam recriar elementos
    if (window.MutationObserver) {
        const observer = new MutationObserver(() => {
            if (!window.FORCE_ACTIVATOR_ALREADY_RUN) {
                safeForceActivator();
            }
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
    window.safeForceActivator = safeForceActivator;
    
    log('🚀 [FORCE-ACTIVATOR] Forçador de ativação carregado');
    
    // 🔍 AUDITORIA INICIAL: Estado no momento do carregamento do script
    log('--- FORCE-ACTIVATOR INITIAL STATE ---');
    log('DOMContentLoaded fired:', document.readyState !== 'loading');
    log('document.readyState:', document.readyState);
    log('window.audioAnalyzer:', typeof window.audioAnalyzer);
    log('window.CACHE_CTX_AWARE_V1_API:', typeof window.CACHE_CTX_AWARE_V1_API);
    log('window.refsReady:', window.refsReady);
    log('window.currentGenre:', window.currentGenre);
    log('window.audioLoaded:', window.audioLoaded);
    log('Loaded via script tag in index.html (no defer)');
    log('------------------------------------');
    
})();
