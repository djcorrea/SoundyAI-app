/**
 * 🔍 DEBUG FIRST ANALYSIS CTA V5 STATE
 * 
 * Função de depuração para verificar o estado completo do sistema de gating
 * da primeira análise (CTA V5), incluindo:
 * - Plano do usuário (free/pro/premium)
 * - Se é primeira análise
 * - Estado do lock (ativo/inativo)
 * - Blur aplicado (computed style)
 * - Botões bloqueados (disabled/pointer-events)
 * - Performance Mode ativo
 * 
 * USO:
 * window.debugFirstCtaState()
 */
window.debugFirstCtaState = function() {
    console.log('\n🔍 ===== DEBUG: FIRST ANALYSIS CTA V5 STATE =====\n');
    
    // ========================================================================
    // 1️⃣ INFORMAÇÕES DO USUÁRIO
    // ========================================================================
    const userPlan = window.CURRENT_USER_PLAN || 'unknown';
    const isFirstAnalysis = !localStorage.getItem('soundy_first_analysis_cta_shown');
    const lockActive = window.FIRST_ANALYSIS_LOCK?.isLocked?.() || false;
    const perfModeActive = document.body.classList.contains('perf-mode');
    
    console.log('👤 USUÁRIO:');
    console.table({
        plano: userPlan,
        primeiraAnalise: isFirstAnalysis ? '✅ SIM (deve mostrar CTA)' : '❌ NÃO',
        lockAtivo: lockActive ? '🔒 ATIVO (bloqueado)' : '🔓 INATIVO',
        performanceMode: perfModeActive ? '⚡ ATIVO' : '❌ INATIVO'
    });
    
    // ========================================================================
    // 2️⃣ ELEMENTOS COM BLUR (MÉTRICAS/SUGESTÕES)
    // ========================================================================
    const blurSelectors = [
        '.cta-blur-overlay',
        '.premium-gate-overlay',
        '[data-cta-locked]',
        '[data-premium-gate]',
        '[data-critical-ui]'
    ];
    
    const blurElements = [];
    blurSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            blurElements.push({
                seletor: selector,
                className: el.className,
                filter: computedStyle.filter,
                pointerEvents: computedStyle.pointerEvents,
                display: computedStyle.display,
                visibility: computedStyle.visibility
            });
        });
    });
    
    console.log('\n🌫️ ELEMENTOS COM BLUR (devem ter filter: blur(...)):');
    if (blurElements.length > 0) {
        console.table(blurElements);
        
        // Validar se blur está aplicado
        const withBlur = blurElements.filter(el => el.filter !== 'none' && el.filter.includes('blur'));
        const withoutBlur = blurElements.filter(el => el.filter === 'none' || !el.filter.includes('blur'));
        
        if (withBlur.length > 0) {
            console.log(`✅ ${withBlur.length} elemento(s) COM blur aplicado`);
        }
        if (withoutBlur.length > 0) {
            console.warn(`⚠️ ${withoutBlur.length} elemento(s) SEM blur (PROBLEMA!)`);
            console.warn('   → Performance Mode pode estar removendo blur');
        }
    } else {
        console.warn('⚠️ Nenhum elemento com blur encontrado');
        console.warn('   → CTA V5 pode não estar ativo ainda');
    }
    
    // ========================================================================
    // 3️⃣ BOTÕES PREMIUM (DEVEM ESTAR BLOQUEADOS)
    // ========================================================================
    const buttonSelectors = [
        '#btn-ask-ai',
        '#btn-download-pdf',
        '#btn-correction-plan',
        '[data-premium-button]'
    ];
    
    const buttons = [];
    buttonSelectors.forEach(selector => {
        const btn = document.querySelector(selector);
        if (btn) {
            const computedStyle = window.getComputedStyle(btn);
            buttons.push({
                seletor: selector,
                id: btn.id || 'N/A',
                disabled: btn.disabled ? '🔒 SIM' : '❌ NÃO',
                pointerEvents: computedStyle.pointerEvents,
                opacity: computedStyle.opacity,
                cursor: computedStyle.cursor
            });
        }
    });
    
    console.log('\n🔘 BOTÕES PREMIUM (devem estar bloqueados):');
    if (buttons.length > 0) {
        console.table(buttons);
        
        // Validar se estão bloqueados
        const blocked = buttons.filter(btn => 
            btn.disabled === '🔒 SIM' || btn.pointerEvents === 'none'
        );
        const unblocked = buttons.filter(btn => 
            btn.disabled === '❌ NÃO' && btn.pointerEvents !== 'none'
        );
        
        if (blocked.length > 0) {
            console.log(`✅ ${blocked.length} botão(ões) BLOQUEADO(S)`);
        }
        if (unblocked.length > 0) {
            console.warn(`⚠️ ${unblocked.length} botão(ões) DESBLOQUEADO(S) (PROBLEMA!)`);
        }
    } else {
        console.warn('⚠️ Nenhum botão premium encontrado');
        console.warn('   → Botões podem não estar renderizados ainda');
    }
    
    // ========================================================================
    // 4️⃣ MODAL DE UPGRADE (CTA V5)
    // ========================================================================
    const modalSelectors = [
        '.upgrade-cta-modal',
        '#upgrade-cta-modal',
        '[data-cta-modal]'
    ];
    
    const modals = [];
    modalSelectors.forEach(selector => {
        const modal = document.querySelector(selector);
        if (modal) {
            const computedStyle = window.getComputedStyle(modal);
            modals.push({
                seletor: selector,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity,
                zIndex: computedStyle.zIndex
            });
        }
    });
    
    console.log('\n📢 MODAL DE UPGRADE (CTA V5):');
    if (modals.length > 0) {
        console.table(modals);
        const visible = modals.filter(m => m.display !== 'none' && m.visibility !== 'hidden');
        if (visible.length > 0) {
            console.log('✅ Modal visível');
        } else {
            console.log('ℹ️ Modal oculto (normal antes de 35s)');
        }
    } else {
        console.log('ℹ️ Modal não encontrado (pode não estar renderizado)');
    }
    
    // ========================================================================
    // 5️⃣ FUNÇÕES CRÍTICAS
    // ========================================================================
    console.log('\n🔧 FUNÇÕES CRÍTICAS:');
    console.table({
        'displayModalResults': typeof window.displayModalResults === 'function' ? '✅ Existe' : '❌ NÃO encontrada',
        '__displayModalResultsOriginal': typeof window.__displayModalResultsOriginal === 'function' ? '✅ Existe' : '❌ NÃO encontrada',
        'FIRST_ANALYSIS_LOCK': typeof window.FIRST_ANALYSIS_LOCK === 'object' ? '✅ Existe' : '❌ NÃO encontrada',
        'premiumWatcher': typeof window.premiumWatcher === 'object' ? '✅ Existe' : '❌ NÃO encontrada'
    });
    
    // ========================================================================
    // 6️⃣ DIAGNÓSTICO FINAL
    // ========================================================================
    console.log('\n🏁 DIAGNÓSTICO FINAL:');
    
    const issues = [];
    
    // Verificar se Performance Mode está removendo blur
    if (perfModeActive && blurElements.some(el => el.filter === 'none')) {
        issues.push('⚠️ Performance Mode está removendo filter: blur dos elementos críticos');
        issues.push('   → Verificar exceções CSS em performance-mode.css linha ~42');
    }
    
    // Verificar se lock está ativo quando deveria
    if (isFirstAnalysis && userPlan === 'free' && !lockActive) {
        issues.push('⚠️ Lock DEVERIA estar ativo (primeira análise + plano free)');
        issues.push('   → Verificar inicialização de first-analysis-upgrade-cta.js');
    }
    
    // Verificar se botões estão desbloqueados quando deveriam estar bloqueados
    if (lockActive && buttons.some(btn => btn.disabled === '❌ NÃO' && btn.pointerEvents !== 'none')) {
        issues.push('⚠️ Botões DEVERIAM estar bloqueados (lock ativo)');
        issues.push('   → Verificar aplicação de disabled e pointer-events: none');
    }
    
    // Verificar se blur foi removido quando deveria estar ativo
    if (lockActive && blurElements.some(el => el.filter === 'none' || !el.filter.includes('blur'))) {
        issues.push('⚠️ Blur DEVERIA estar aplicado (lock ativo)');
        issues.push('   → Performance Mode pode estar neutralizando blur');
    }
    
    if (issues.length > 0) {
        console.error('\n❌ PROBLEMAS DETECTADOS:');
        issues.forEach(issue => console.error(issue));
    } else {
        console.log('\n✅ Nenhum problema detectado. Sistema funcionando corretamente.');
    }
    
    console.log('\n🔍 ===== FIM DO DEBUG =====\n');
};

console.log('✅ Função window.debugFirstCtaState() carregada. Use: window.debugFirstCtaState()');
