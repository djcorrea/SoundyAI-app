// 🎯 SISTEMA CENTRALIZADO DE CAPABILITIES - PLANOS SOUNDYAI
// Single source of truth para decisões de acesso por plano
// Implementa suporte correto para Plano Plus

(function() {
    'use strict';

    console.log('🎯 [CAPABILITIES] Inicializando sistema centralizado de capabilities...');

    // ========================================
    // 📊 MATRIZ DE CAPABILITIES POR PLANO
    // ========================================
    
    const CAPABILITIES_MATRIX = {
        free: {
            aiHelp: true,               // ✅ TEM IA quando em modo FULL (1-3 análises)
            pdf: true,                  // ✅ TEM PDF quando em modo FULL (1-3 análises)
            fullSuggestions: true       // ✅ TEM sugestões quando em modo FULL
        },
        plus: {
            aiHelp: false,              // ❌ NUNCA tem IA (mesmo em modo full)
            pdf: false,                 // ❌ NUNCA tem PDF (mesmo em modo full)
            fullSuggestions: true       // ✅ TEM sugestões, mas só enquanto em modo full
        },
        pro: {
            aiHelp: true,               // ✅ Tem "Pedir Ajuda à IA" sempre
            pdf: true,                  // ✅ Tem relatório PDF sempre
            fullSuggestions: true       // ✅ Tem sugestões sempre
        }
    };

    // ========================================
    // 🔍 DETECÇÃO DE CONTEXTO ATUAL
    // ========================================
    
    /**
     * Obtém contexto atual do usuário e análise
     * @returns {Object} { plan, isReduced, analysisMode }
     */
    function getCurrentContext() {
        // Buscar análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        
        // Determinar plano
        const plan = analysis?.plan || window.userPlan || 'free';
        
        // Determinar se está em modo reduced
        const isReduced = analysis?.isReduced === true || 
                         analysis?.analysisMode === 'reduced' ||
                         window.APP_MODE === 'reduced';
        
        // Determinar modo de análise
        const analysisMode = analysis?.analysisMode || 
                            (window.APP_MODE === 'reduced' ? 'reduced' : 'full');
        
        return {
            plan: plan,
            isReduced: isReduced,
            analysisMode: analysisMode
        };
    }

    // ========================================
    // 🎯 FUNÇÃO PRINCIPAL: canUseFeature
    // ========================================
    
    /**
     * Verifica se o usuário pode usar uma feature específica
     * @param {string} featureName - Nome da feature: 'aiHelp', 'pdf', 'fullSuggestions'
     * @returns {boolean} true se pode usar, false se bloqueado
     */
    function canUseFeature(featureName) {
        const context = getCurrentContext();
        const capabilities = CAPABILITIES_MATRIX[context.plan] || CAPABILITIES_MATRIX.free;
        
        // Log para debug
        console.log(`[CAPABILITIES] Verificando feature: "${featureName}"`, {
            plan: context.plan,
            isReduced: context.isReduced,
            analysisMode: context.analysisMode,
            baseCapability: capabilities[featureName]
        });
        
        // 🔴 PRIORIDADE MÁXIMA: Se está em modo REDUCED, bloqueia features premium
        if (context.isReduced && (featureName === 'aiHelp' || featureName === 'pdf' || featureName === 'fullSuggestions')) {
            console.log(`[CAPABILITIES] ❌ BLOQUEADO: Modo Reduced (${context.plan})`);
            return false;
        }
        
        // ✅ EXCEÇÃO EXPLÍCITA: Free em modo FULL tem IA e PDF
        if (context.plan === 'free' && context.analysisMode === 'full' && !context.isReduced) {
            if (featureName === 'aiHelp' || featureName === 'pdf') {
                console.log(`[CAPABILITIES] ✅ PERMITIDO: Free em modo FULL (análises 1-3)`);
                return true;
            }
        }
        
        // 📊 REGRA PADRÃO: Usar capabilities da matriz
        const allowed = capabilities[featureName] === true;
        console.log(`[CAPABILITIES] ${allowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'}: capability da matriz (${context.plan})`);
        return allowed;
    }

    // ========================================
    // 🛡️ FUNÇÕES AUXILIARES ESPECÍFICAS
    // ========================================
    
    /**
     * Verifica se deve bloquear "Pedir Ajuda à IA"
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockAiHelp() {
        const result = !canUseFeature('aiHelp');
        console.log(`[CAPABILITIES] shouldBlockAiHelp() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve bloquear "Baixar Relatório PDF"
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockPdf() {
        const result = !canUseFeature('pdf');
        console.log(`[CAPABILITIES] shouldBlockPdf() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve rodar análise FULL
     * @returns {boolean} true se full, false se reduced
     */
    function shouldRunFullAnalysis() {
        const context = getCurrentContext();
        const result = !context.isReduced;
        console.log(`[CAPABILITIES] shouldRunFullAnalysis() → ${result} (isReduced: ${context.isReduced})`);
        return result;
    }

    /**
     * Verifica se deve bloquear qualquer feature premium
     * (usado pelo premium-blocker para detecção genérica)
     * @returns {boolean} true se deve bloquear features premium
     */
    function shouldBlockPremiumFeatures() {
        const context = getCurrentContext();
        
        // Se é PRO, nunca bloqueia
        if (context.plan === 'pro') return false;
        
        // Se é FREE/PLUS, bloqueia IA e PDF sempre
        return true;
    }

    // ========================================
    // 🌐 EXPOR API GLOBAL
    // ========================================
    
    window.PlanCapabilities = {
        // Funções principais
        canUseFeature,
        shouldBlockAiHelp,
        shouldBlockPdf,
        shouldRunFullAnalysis,
        shouldBlockPremiumFeatures,
        getCurrentContext,
        
        // Debug e diagnóstico
        _matrix: CAPABILITIES_MATRIX,
        
        _debug: function() {
            const ctx = getCurrentContext();
            const matrix = {
                'Plano': ctx.plan,
                'Modo': ctx.analysisMode,
                'Reduced': ctx.isReduced ? '❌' : '✅',
                'AI Help': canUseFeature('aiHelp') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'PDF': canUseFeature('pdf') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Sugestões Full': canUseFeature('fullSuggestions') ? '✅ PERMITIDO' : '❌ BLOQUEADO'
            };
            
            console.log('\n📊 [CAPABILITIES] DIAGNÓSTICO COMPLETO:');
            console.table(matrix);
            console.log('\n');
            
            return matrix;
        },
        
        _testAllPlans: function() {
            console.log('\n🧪 [CAPABILITIES] TESTE DE TODOS OS PLANOS:\n');
            
            const scenarios = [
                { plan: 'free', mode: 'full', desc: 'Free - Modo Full' },
                { plan: 'free', mode: 'reduced', desc: 'Free - Modo Reduced' },
                { plan: 'plus', mode: 'full', desc: 'Plus - Modo Full (dentro do limite)' },
                { plan: 'plus', mode: 'reduced', desc: 'Plus - Modo Reduced (após limite)' },
                { plan: 'pro', mode: 'full', desc: 'Pro - Modo Full' }
            ];
            
            scenarios.forEach(scenario => {
                // Simular contexto
                window.currentModalAnalysis = {
                    plan: scenario.plan,
                    analysisMode: scenario.mode,
                    isReduced: scenario.mode === 'reduced'
                };
                
                const ctx = getCurrentContext();
                
                console.log(`\n🔍 ${scenario.desc}`);
                console.log('   AI Help:', canUseFeature('aiHelp') ? '✅' : '❌');
                console.log('   PDF:', canUseFeature('pdf') ? '✅' : '❌');
                console.log('   Sugestões:', canUseFeature('fullSuggestions') ? '✅' : '❌');
            });
            
            console.log('\n✅ Teste completo finalizado\n');
        }
    };
    
    console.log('✅ [CAPABILITIES] Sistema de capabilities carregado com sucesso');
    console.log('💡 [CAPABILITIES] Use window.PlanCapabilities._debug() para diagnóstico');
    console.log('🧪 [CAPABILITIES] Use window.PlanCapabilities._testAllPlans() para testar todos os cenários\n');
    
})();
