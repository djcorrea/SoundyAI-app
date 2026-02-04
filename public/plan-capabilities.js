// 🎯 SISTEMA CENTRALIZADO DE CAPABILITIES - PLANOS SOUNDYAI
// Single source of truth para decisões de acesso por plano
// Implementa suporte correto para Plano Plus

(function() {
    'use strict';

    log('🎯 [CAPABILITIES] Inicializando sistema centralizado de capabilities...');

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
            correctionPlan: false,      // ❌ REMOVIDO 2026-01-06: Agora é DJ/STUDIO only
            askAI: true                 // ✅ Tem "Pedir Ajuda à IA" sempre
        },
        // � STUDIO: Tudo do PRO + extras premium (NOVO 2026-01-06)
        studio: {
            aiHelp: true,               // ✅ Tem "Pedir Ajuda à IA" sempre
            pdf: true,                  // ✅ Tem relatório PDF sempre
            fullSuggestions: true,      // ✅ Tem sugestões sempre
            reference: true,            // ✅ Tem Modo Referência sempre
            correctionPlan: true,       // ✅ Tem Plano de Correção sempre
            askAI: true,                // ✅ Tem "Pedir Ajuda à IA" sempre
            priorityProcessing: true,   // ✅ NOVO: Prioridade de processamento
            studioBadge: true           // ✅ NOVO: Badge STUDIO exclusivo
        },
        // �🎧 DJ BETA: Cópia exata do PRO (acesso temporário 15 dias)
        dj: {
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
     * 
     * ✅ CORREÇÃO 2026-02-04: Bloqueia detecção até Firebase estar pronto
     */
    function detectUserPlan() {
        // ✅ NOVO: Verificar se Firebase está pronto PRIMEIRO
        // Evita fallback prematuro para 'free' antes do auth sincronizar
        if (!window.firebaseReady) {
            log('[CAPABILITIES] ⏳ Firebase não pronto, aguardando sincronização...');
            // Retornar null força código chamador a aguardar waitForUserPlan()
            return null;
        }
        
        // ✅ Lista de planos válidos (ATUALIZADO 2026-01-06: inclui 'studio')
        const VALID_PLANS = ['free', 'plus', 'pro', 'studio', 'dj'];
        
        // 1. Análise atual (mais recente - vem do backend)
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (analysis?.plan && VALID_PLANS.includes(analysis.plan)) {
            log(`[CAPABILITIES] 🔍 Plano detectado via análise: ${analysis.plan}`);
            return analysis.plan;
        }
        
        // 2. Cache local (atualizado via fetchUserPlan do Firestore)
        if (_cachedUserPlan && VALID_PLANS.includes(_cachedUserPlan)) {
            log(`[CAPABILITIES] 🔍 Plano detectado via cache: ${_cachedUserPlan}`);
            return _cachedUserPlan;
        }
        
        // 3. window.userPlan (pode ser setado por outros módulos)
        if (window.userPlan && VALID_PLANS.includes(window.userPlan)) {
            log(`[CAPABILITIES] 🔍 Plano detectado via window.userPlan: ${window.userPlan}`);
            return window.userPlan;
        }
        
        // 4. Fallback - mas avisa que não encontrou plano autenticado
        // Só chega aqui se Firebase estiver pronto e usuário realmente não tiver plano
        warn(`[CAPABILITIES] ⚠️ Plano não detectado (Firebase pronto), usando fallback 'free'. Cache: ${_cachedUserPlan}, window.userPlan: ${window.userPlan}`);
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
                log('[CAPABILITIES] ⏳ Firebase não está pronto ainda');
                return null;
            }
            
            const user = window.auth.currentUser;
            if (!user) {
                log('[CAPABILITIES] ⚠️ Usuário não autenticado');
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
                
                log(`[CAPABILITIES] ✅ Plano carregado do Firestore: ${normalizedPlan} (uid: ${user.uid})`);
                
                // Atualizar cache
                _cachedUserPlan = normalizedPlan;
                window.userPlan = normalizedPlan; // Sincronizar com window.userPlan
                
                return normalizedPlan;
            } else {
                warn('[CAPABILITIES] ⚠️ Documento do usuário não encontrado');
                _cachedUserPlan = 'free';
                return 'free';
            }
        } catch (error) {
            error('[CAPABILITIES] ❌ Erro ao buscar plano do Firestore:', error);
            return null;
        }
    }
    
    /**
     * ⏳ FUNÇÃO CRÍTICA: Aguarda plano estar carregado (SYNC ASYNC)
     * @returns {Promise<string>} Plano do usuário
     */
    function waitForUserPlan() {
        return new Promise((resolve) => {
            // Se já tem cache, retorna imediatamente
            if (_cachedUserPlan) {
                log('[CAPABILITIES] ✅ Plano já em cache:', _cachedUserPlan);
                resolve(_cachedUserPlan);
                return;
            }
            
            // Se não está autenticado, retorna free
            if (!window.auth?.currentUser) {
                log('[CAPABILITIES] ⚠️ Usuário não autenticado - retornando free');
                _cachedUserPlan = 'free';
                resolve('free');
                return;
            }
            
            // Buscar do Firestore e aguardar
            log('[CAPABILITIES] ⏳ Buscando plano do Firestore (AGUARDANDO)...');
            fetchUserPlan().then((plan) => {
                const finalPlan = plan || 'free';
                log(`[CAPABILITIES] ✅ Plano carregado: ${finalPlan}`);
                resolve(finalPlan);
            }).catch((err) => {
                warn('[CAPABILITIES] ❌ Erro ao buscar plano:', err);
                _cachedUserPlan = 'free';
                resolve('free');
            });
        });
    }
    
    /**
     * 🔐 INICIALIZAÇÃO AUTOMÁTICA: Busca plano quando Firebase está pronto
     * ✅ CORREÇÃO 2026-02-04: Melhorado para aguardar Firebase estar realmente pronto
     */
    function initializePlanDetection() {
        // Tentar buscar plano imediatamente se Firebase já estiver pronto
        if (window.auth && window.db && window.firebaseReady) {
            log('[CAPABILITIES] Firebase já pronto, buscando plano...');
            fetchUserPlan().catch(err => warn('[CAPABILITIES] Init fetch falhou:', err));
        }
        
        // ✅ NOVO: Escutar evento firebase:user-ready (mais confiável que onAuthStateChanged)
        window.addEventListener('firebase:user-ready', (event) => {
            log('[CAPABILITIES] 🔥 Firebase user ready - buscando plano...');
            fetchUserPlan().catch(err => warn('[CAPABILITIES] User ready fetch falhou:', err));
        });
        
        // Também escutar mudanças de autenticação (backup)
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
            window.auth.onAuthStateChanged((user) => {
                if (user) {
                    log('[CAPABILITIES] 🔐 Auth state changed - buscando plano...');
                    fetchUserPlan().catch(err => warn('[CAPABILITIES] Auth fetch falhou:', err));
                } else {
                    _cachedUserPlan = null;
                    window.userPlan = 'free';
                }
            });
        }
        
        // Fallback reduzido: tentar novamente após 1s (antes eram 2s)
        setTimeout(() => {
            if (!_cachedUserPlan && window.auth?.currentUser && window.firebaseReady) {
                log('[CAPABILITIES] 🔄 Retry fetch do plano (1s fallback)...');
                fetchUserPlan().catch(err => warn('[CAPABILITIES] Retry falhou:', err));
            }
        }, 1000);
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
     * ✅ CORREÇÃO 2026-02-04: Retorna null se Firebase não estiver pronto
     * @returns {Object|null} { plan, isReduced, analysisMode } ou null se Firebase não pronto
     */
    function getCurrentContext() {
        // Buscar análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        
        // 🔐 CORREÇÃO CRÍTICA: Usar detectUserPlan() que busca de múltiplas fontes
        const plan = detectUserPlan();
        
        // ✅ NOVO: Se detectUserPlan retornou null (Firebase não pronto), retornar null
        if (plan === null) {
            log('[CAPABILITIES] ⏳ getCurrentContext: Firebase não pronto, retornando null');
            return null;
        }
        
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
     * ✅ CORREÇÃO 2026-02-04: Trata caso Firebase não estar pronto
     * @param {string} featureName - Nome da feature: 'aiHelp', 'pdf', 'fullSuggestions'
     * @returns {boolean} true se pode usar, false se bloqueado
     */
    function canUseFeature(featureName) {
        const context = getCurrentContext();
        
        // ✅ NOVO: Se Firebase não estiver pronto (context null), bloquear temporariamente
        if (!context || context.plan === null) {
            log(`[CAPABILITIES] ⏳ Firebase não pronto, bloqueando "${featureName}" temporariamente`);
            return false;  // Bloquear até Firebase estar pronto
        }
        
        const capabilities = CAPABILITIES_MATRIX[context.plan] || CAPABILITIES_MATRIX.free;
        
        // Log para debug
        log(`[CAPABILITIES] Verificando feature: "${featureName}"`, {
            plan: context.plan,
            isReduced: context.isReduced,
            analysisMode: context.analysisMode,
            baseCapability: capabilities[featureName]
        });
        
        // 🔴 PRIORIDADE MÁXIMA: Se está em modo REDUCED, bloqueia features premium
        if (context.isReduced && (featureName === 'aiHelp' || featureName === 'pdf' || featureName === 'fullSuggestions')) {
            log(`[CAPABILITIES] ❌ BLOQUEADO: Modo Reduced (${context.plan})`);
            return false;
        }
        
        // ✅ EXCEÇÃO EXPLÍCITA: Free em modo FULL tem IA e PDF
        if (context.plan === 'free' && context.analysisMode === 'full' && !context.isReduced) {
            if (featureName === 'aiHelp' || featureName === 'pdf') {
                log(`[CAPABILITIES] ✅ PERMITIDO: Free em modo FULL (análises 1-3)`);
                return true;
            }
        }
        
        // 📊 REGRA PADRÃO: Usar capabilities da matriz
        const allowed = capabilities[featureName] === true;
        log(`[CAPABILITIES] ${allowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'}: capability da matriz (${context.plan})`);
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
        log(`[CAPABILITIES] shouldBlockAiHelp() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve bloquear "Baixar Relatório PDF"
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockPdf() {
        const result = !canUseFeature('pdf');
        log(`[CAPABILITIES] shouldBlockPdf() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve bloquear "Modo Referência" (PRO only)
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockReference() {
        const result = !canUseFeature('reference');
        log(`[CAPABILITIES] shouldBlockReference() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve bloquear "Plano de Correção" (PRO only)
     * @returns {boolean} true se deve bloquear
     */
    function shouldBlockCorrectionPlan() {
        const result = !canUseFeature('correctionPlan');
        log(`[CAPABILITIES] shouldBlockCorrectionPlan() → ${result}`);
        return result;
    }
    
    /**
     * Verifica se deve rodar análise FULL
     * @returns {boolean} true se full, false se reduced
     */
    function shouldRunFullAnalysis() {
        const context = getCurrentContext();
        const result = !context.isReduced;
        log(`[CAPABILITIES] shouldRunFullAnalysis() → ${result} (isReduced: ${context.isReduced})`);
        return result;
    }

    /**
     * Verifica se deve bloquear qualquer feature premium
     * (usado pelo premium-blocker para detecção genérica)
     * ✅ ATUALIZADO 2026-01-06: STUDIO adicionado
     * @returns {boolean} true se deve bloquear features premium
     */
    function shouldBlockPremiumFeatures() {
        const context = getCurrentContext();
        
        // Se é PRO, DJ Beta ou STUDIO, nunca bloqueia
        if (context.plan === 'pro' || context.plan === 'dj' || context.plan === 'studio') return false;
        
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
        
        // 🔐 Funções de plano (novas)
        detectUserPlan,
        fetchUserPlan,
        waitForUserPlan,
        
        // Debug e diagnóstico
        _matrix: CAPABILITIES_MATRIX,
        
        // 🔐 Getter para cache interno (debug)
        get _cachedPlan() { return _cachedUserPlan; },
        
        _debug: function() {
            const ctx = getCurrentContext();
            const detectedPlan = detectUserPlan();
            const matrix = {
                'Plano Detectado': detectedPlan,
                'Cache Interno': _cachedUserPlan || '(não definido)',
                'window.userPlan': window.userPlan || '(não definido)',
                'Análise Atual': (window.currentModalAnalysis?.plan) || '(nenhuma)',
                'Modo': ctx.analysisMode,
                'Reduced': ctx.isReduced ? '❌' : '✅',
                'AI Help': canUseFeature('aiHelp') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'PDF': canUseFeature('pdf') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Sugestões Full': canUseFeature('fullSuggestions') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Modo Referência': canUseFeature('reference') ? '✅ PERMITIDO' : '❌ BLOQUEADO',
                'Plano Correção': canUseFeature('correctionPlan') ? '✅ PERMITIDO' : '❌ BLOQUEADO'
            };
            
            log('\n📊 [CAPABILITIES] DIAGNÓSTICO COMPLETO:');
            console.table(matrix);
            log('\n');
            
            return matrix;
        },
        
        // 🔐 Forçar refresh do plano do Firestore
        _refreshPlan: async function() {
            log('[CAPABILITIES] 🔄 Forçando refresh do plano...');
            const plan = await fetchUserPlan();
            log(`[CAPABILITIES] ✅ Plano atualizado: ${plan}`);
            return plan;
        },
        
        _testAllPlans: function() {
            log('\n🧪 [CAPABILITIES] TESTE DE TODOS OS PLANOS:\n');
            
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
                
                log(`\n🔍 ${scenario.desc}`);
                log('   AI Help:', canUseFeature('aiHelp') ? '✅' : '❌');
                log('   PDF:', canUseFeature('pdf') ? '✅' : '❌');
                log('   Sugestões:', canUseFeature('fullSuggestions') ? '✅' : '❌');
                log('   Modo Referência:', canUseFeature('reference') ? '✅' : '❌');
            });
            
            log('\n✅ Teste completo finalizado\n');
        }
    };
    
    log('✅ [CAPABILITIES] Sistema de capabilities carregado com sucesso');
    log('💡 [CAPABILITIES] Use window.PlanCapabilities._debug() para diagnóstico');
    log('🔄 [CAPABILITIES] Use window.PlanCapabilities._refreshPlan() para forçar atualização');
    log('🧪 [CAPABILITIES] Use window.PlanCapabilities._testAllPlans() para testar todos os cenários\n');
    
})();
