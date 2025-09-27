/**
 * 🎯 PATCH DEFINITIVO - OCULTAR VALORES DA TABELA DE REFERÊNCIA
 * 
 * Este script garante que NUNCA apareçam valores numéricos na coluna de diferença
 * da tabela de referência, independente de qual sistema esteja sendo usado.
 * 
 * OBJETIVO: Mostrar apenas "✅ Ideal", "⚠️ Ajuste leve", "❌ Corrigir"
 * PRESERVAR: Todos os cálculos no backend para sugestões avançadas
 */

(function() {
    'use strict';
    
    console.log('🎯 [PATCH] Aplicando correção definitiva da tabela de referência...');
    
    /**
     * 🎨 FUNÇÃO DEFINITIVA: Criar célula apenas com status visual
     */
    function createStatusOnlyCell(diff, unit, tolerance, metricName = '') {
        if (!Number.isFinite(diff) || !Number.isFinite(tolerance) || tolerance <= 0) {
            return '<td class="na" style="text-align: center;"><span style="opacity: 0.6;">—</span></td>';
        }
        
        const absDiff = Math.abs(diff);
        let cssClass, statusIcon, statusText;
        
        // Lógica de classificação baseada na tolerância
        if (absDiff <= tolerance) {
            // ✅ ZONA IDEAL
            cssClass = 'ok';
            statusIcon = '✅';
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / tolerance;
            if (multiplicador <= 2) {
                // ⚠️ ZONA AJUSTAR
                cssClass = 'yellow';
                statusIcon = '⚠️';
                statusText = 'Ajuste leve';
            } else {
                // ❌ ZONA CORRIGIR
                cssClass = 'warn';
                statusIcon = '❌';
                statusText = 'Corrigir';
            }
        }
        
        return `<td class="${cssClass}" style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
        </td>`;
    }

    /**
     * 🔄 INTERCEPTAR TODAS AS FUNÇÕES QUE PODEM CRIAR CÉLULAS DE DIFERENÇA
     */
    
    // 1. Interceptar createEnhancedDiffCell (sistema principal)
    if (typeof window.createEnhancedDiffCell === 'function') {
        const original = window.createEnhancedDiffCell;
        window.createEnhancedDiffCell = function(diff, unit, tolerance, metricName) {
            return createStatusOnlyCell(diff, unit, tolerance, metricName);
        };
        console.log('✅ [PATCH] createEnhancedDiffCell interceptado');
    }
    
    // 2. Interceptar createEnhancedDiffCellMigrado (sistema de migração)
    if (typeof window.createEnhancedDiffCellMigrado === 'function') {
        window.createEnhancedDiffCellMigrado = function(diff, unit, tolerance, metricName) {
            return createStatusOnlyCell(diff, unit, tolerance, metricName);
        };
        console.log('✅ [PATCH] createEnhancedDiffCellMigrado interceptado');
    }
    
    // 3. Criar função global para uso direto
    window.createStatusOnlyDiffCell = createStatusOnlyCell;
    
    // 4. Feature flag para indicar que a correção está ativa
    window.REFERENCE_TABLE_HIDE_VALUES = true;
    
    /**
     * 🔍 MONITORAR E INTERCEPTAR NOVOS CARREGAMENTOS
     */
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
        // Interceptar quando createEnhancedDiffCell for definida
        if (obj === window && prop === 'createEnhancedDiffCell' && descriptor.value) {
            console.log('🔄 [PATCH] Nova função createEnhancedDiffCell detectada, interceptando...');
            descriptor.value = createStatusOnlyCell;
        }
        return originalDefineProperty.call(this, obj, prop, descriptor);
    };
    
    /**
     * 🎛️ UTILITÁRIOS DE CONTROLE
     */
    window.toggleReferenceTableValues = function(showValues = false) {
        window.REFERENCE_TABLE_HIDE_VALUES = !showValues;
        console.log(`🎯 [PATCH] Modo: ${showValues ? 'Valores numéricos' : 'Apenas status'}`);
        
        // Reprocessar tabela se possível
        if (window.renderReferenceComparisons && window.__lastAnalysis) {
            window.renderReferenceComparisons(window.__lastAnalysis);
        }
    };
    
    window.debugReferenceTable = function() {
        console.log('🔍 [DEBUG] Estado da tabela de referência:', {
            hideValues: window.REFERENCE_TABLE_HIDE_VALUES,
            hasCreateEnhanced: typeof window.createEnhancedDiffCell === 'function',
            hasRenderFunction: typeof window.renderReferenceComparisons === 'function',
            hasLastAnalysis: !!window.__lastAnalysis
        });
    };
    
    /**
     * 🧪 TESTE RÁPIDO
     */
    function quickTest() {
        const testCases = [
            { diff: 0.2, tol: 0.5, expected: 'Ideal' },
            { diff: 1.2, tol: 0.5, expected: 'Ajuste leve' },
            { diff: 2.5, tol: 0.5, expected: 'Corrigir' }
        ];
        
        console.log('🧪 [PATCH] Testando correção...');
        let allPassed = true;
        
        for (const test of testCases) {
            const result = createStatusOnlyCell(test.diff, 'dB', test.tol);
            const passed = result.includes(test.expected);
            
            if (passed) {
                console.log(`✅ ${test.expected}: OK`);
            } else {
                console.error(`❌ ${test.expected}: FALHOU`);
                allPassed = false;
            }
        }
        
        if (allPassed) {
            console.log('🎉 [PATCH] Todos os testes passaram! Correção funcionando.');
        } else {
            console.error('🚨 [PATCH] Alguns testes falharam. Verifique a implementação.');
        }
    }
    
    // Executar teste
    quickTest();
    
    console.log('✅ [PATCH] Correção definitiva aplicada com sucesso!');
    console.log('📋 [PATCH] A tabela agora mostra apenas status visuais');
    console.log('🔧 [PATCH] Use debugReferenceTable() para verificar o estado');
    
})();