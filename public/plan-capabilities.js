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
            fullSuggestions: true,      // ✅ TEM sugestões quando em modo FULL
            reference: false,           // ❌ NUNCA tem Modo Referência (PRO only)
            correctionPlan: false,      // ❌ NUNCA tem Plano de Correção (PRO only)
            askAI: true                 // ✅ TEM "Pedir Ajuda à IA" quando em modo FULL
        },
        plus: {
            aiHelp: false,              // ❌ NUNCA tem IA (mesmo em modo full)
            pdf: false,                 // ❌ NUNCA tem PDF (mesmo em modo full)
            fullSuggestions: true,      // ✅ TEM sugestões, mas só enquanto em modo full
            reference: false,           // ❌ NUNCA tem Modo Referência (PRO only)
            correctionPlan: false,      // ❌ NUNCA tem Plano de Correção (PRO only)
            askAI: false                // ❌ NUNCA tem "Pedir Ajuda à IA" (PRO only)
        },
        pro: {
            aiHelp: true,               // ✅ Tem "Pedir Ajuda à IA" sempre
            pdf: true,                  // ✅ Tem relatório PDF sempre
            fullSuggestions: true,      // ✅ Tem sugestões sempre
            reference: true,            // ✅ Tem Modo Referência sempre
            correctionPlan: true,       // ✅ Tem Plano de Correção sempre
            askAI: true                 // ✅ Tem "Pedir Ajuda à IA" sempre
        }
    };

    // ========================================
    // 🔍 DETECÇÃO DE CONTEXTO ATUAL
    // ========================================
    
    // 🔐 Cache do plano do usuário (atualizado via fetchUserPlan)
    let _cachedUserPlan = null;
    
    /**
     * 🔐 FUNÇÃO CRÍTICA: Detecta o plano do usuário de múltiplas fontes
     * Ordem de prioridade:
     * 1. Análise atual (window.currentModalAnalysis?.plan)
     * 2. Cache local (_cachedUserPlan - atualizado via Firestore)
     * 3. window.userPlan (se definido por outro módulo)
     * 4. Fallback: 'free' (APENAS se nenhuma fonte disponível)
     */
    function detectUserPlan() {
        // 1. Análise atual (mais recente - vem do backend)
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (analysis?.plan && ['free', 'plus', 'pro'].includes(analysis.plan)) {
            console.log(`[CAPABILITIES] 🔍 Plano detectado via análise: ${analysis.plan}`);
            return analysis.plan;
        }
        
        // 2. Cache local (atualizado via fetchUserPlan do Firestore)
        if (_cachedUserPlan && ['free', 'plus', 'pro'].includes(_cachedUserPlan)) {
            console.log(`[CAPABILITIES] 🔍 Plano detectado via cache: ${_cachedUserPlan}`);
            return _cachedUserPlan;
        }
        
        // 3. window.userPlan (pode ser setado por outros módulos)
        if (window.userPlan && ['free', 'plus', 'pro'].includes(window.userPlan)) {
            console.log(`[CAPABILITIES] 🔍 Plano detectado via window.userPlan: ${window.userPlan}`);
            return window.userPlan;
        }
        
        // 4. Fallback - mas avisa que não encontrou plano autenticado
        console.warn(`[CAPABILITIES] ⚠️ Plano não detectado, usando fallback 'free'. Cache: ${_cachedUserPlan}, window.userPlan: ${window.userPlan}`);
        return 'free';
    }
    
    /**
     * 🔐 FUNÇÃO ASSÍNCRONA: Busca plano do usuário diretamente do Firestore
     * Deve ser chamada quando o usuário autentica ou quando precisa garantir plano atualizado
     */
    async function fetchUserPlan() {
        try {
            // Verificar se Firebase está pronto
            if (!window.auth || !window.db || !window.firebaseReady) {
                console.log('[CAPABILITIES] ⏳ Firebase não está pronto ainda');
                return null;
            }
            
            const user = window.auth.currentUser;
            if (!user) {
                console.log('[CAPABILITIES] ⚠️ Usuário não autenticado');
                _cachedUserPlan = 'free';
                return 'free';
            }
            
            // Importar funções do Firestore
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            
            const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // 🔐 CRÍTICO: Usar 'plan' (novo) ou 'plano' (legado) com fallback 'free'
                const plan = userData.plan || userData.plano || 'free';
                
                // Normalizar valores legados
                const normalizedPlan = plan === 'gratis' ? 'free' : plan;
                
                console.log(`[CAPABILITIES] ✅ Plano carregado do Firestore: ${normalizedPlan} (uid: ${user.uid})`);
                
                // Atualizar cache
                _cachedUserPlan = normalizedPlan;
                window.userPlan = normalizedPlan; // Sincronizar com window.userPlan
                
                return normalizedPlan;
            } else {
                console.warn('[CAPABILITIES] ⚠️ Documento do usuário não encontrado');
                _cachedUserPlan = 'free';
                return 'free';
            }
        } catch (error) {
            console.error('[CAPABILITIES] ❌ Erro ao buscar plano do Firestore:', error);
            return null;
        }
    }
    
    /**
     * 🔐 INICIALIZAÇÃO AUTOMÁTICA: Busca plano quando Firebase está pronto
     */
    function initializePlanDetection() {
        // Tentar buscar plano imediatamente se Firebase já estiver pronto
        if (window.auth && window.db && window.firebaseReady) {
            fetchUserPlan().catch(err => console.warn('[CAPABILITIES] Init fetch falhou:', err));
        }
        
        // Também escutar mudanças de autenticação
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
            window.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('[CAPABILITIES] 🔐 Auth state changed - buscando plano...');
                    fetchUserPlan().catch(err => console.warn('[CAPABILITIES] Auth fetch falhou:', err));
                } else {
                    _cachedUserPlan = null;
                    window.userPlan = 'free';
                }
            });
        }
        
        // Fallback: tentar novamente após 2 segundos caso Firebase demore
        setTimeout(() => {
            if (!_cachedUserPlan && window.auth?.currentUser) {
                console.log('[CAPABILITIES] 🔄 Retry fetch do plano...');
                fetchUserPlan().catch(err => console.warn('[CAPABILITIES] Retry falhou:', err));
            }
        }, 2000);
    }
    
    // 🚀 Iniciar detecção de plano quando o script carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlanDetection);
    } else {
        // DOM já carregado, aguardar um pouco para Firebase inicializar
        setTimeout(initializePlanDetection, 500);
    }
    
    /**
     * Obtém contexto atual do usuário e análise
     * @returns {Object} { plan, isReduced, analysisMode }
     */
    function getCurrentContext() {
        // Buscar análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        
        // 🔐 CORREÇÃO CRÍTICA: Usar detectUserPlan() que busca de múltiplas fontes
        const plan = detectUserPlan();
        
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
     * Verifica se deve bloquear "Modo Referência" (PRO only)
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockReference() {
        const result = !canUseFeature('reference');
        console.log(`[CAPABILITIES] shouldBlockReference() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve bloquear "Plano de Correção" (PRO only)
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockCorrectionPlan() {
        const result = !canUseFeature('correctionPlan');
        console.log(`[CAPABILITIES] shouldBlockCorrectionPlan() → ${result}`);
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
        shouldBlockReference,
        shouldBlockCorrectionPlan,
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
                'Sugestões Full': canUseFeature('fullSuggestions') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Modo Referência': canUseFeature('reference') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Plano Correção': canUseFeature('correctionPlan') ? '✅ PERMITIDO' : '❌ BLOQUEADO'
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
