/**
 * 🔍 SOUNDYAI - VALIDADOR DE CONFIGURAÇÃO DE TRACKING
 * 
 * Execute no console do navegador para verificar se o sistema está configurado corretamente.
 * 
 * Como usar:
 * 1. Abrir prelaunch.html ou index.html
 * 2. Abrir console do navegador (F12)
 * 3. Copiar e colar este script
 * 4. Analisar resultado
 * 
 * @version 1.0.0
 */

(function() {
    'use strict';
    
    console.log('🔍 ═══════════════════════════════════════════════════════');
    console.log('🔍 VALIDADOR DE CONFIGURAÇÃO - SOUNDYAI TRACKING');
    console.log('🔍 ═══════════════════════════════════════════════════════\n');
    
    let errors = 0;
    let warnings = 0;
    let success = 0;
    
    // ═══════════════════════════════════════════════════════════════════
    // 1. VERIFICAR GTAG.JS
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('📊 [1/6] Verificando Google Tag (gtag.js)...');
    
    if (typeof gtag === 'function') {
        console.log('   ✅ gtag.js carregado');
        success++;
    } else {
        console.error('   ❌ gtag.js NÃO encontrado');
        console.error('   → Verifique se o script está incluído no HTML');
        errors++;
    }
    
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
        console.log('   ✅ dataLayer inicializado');
        success++;
    } else {
        console.error('   ❌ dataLayer NÃO encontrado');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 2. VERIFICAR TRACKING.JS
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n📦 [2/6] Verificando módulo tracking.js...');
    
    if (window.SoundyTracking) {
        console.log('   ✅ SoundyTracking encontrado');
        success++;
        
        if (typeof window.SoundyTracking.configure === 'function') {
            console.log('   ✅ API disponível');
            success++;
        } else {
            console.error('   ❌ API incompleta');
            errors++;
        }
    } else {
        console.error('   ❌ SoundyTracking NÃO encontrado');
        console.error('   → Incluir <script src="/js/tracking.js" defer></script>');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3. VERIFICAR CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n⚙️ [3/6] Verificando configuração...');
    
    if (window.SoundyTracking) {
        const config = window.SoundyTracking.getConfig?.();
        
        if (config) {
            console.log('   ✅ Configuração carregada');
            success++;
            
            // Verificar IDs
            if (config.conversionId && !config.conversionId.includes('REPLACE_WITH')) {
                console.log('   ✅ Conversion ID preenchido:', config.conversionId);
                success++;
            } else {
                console.warn('   ⚠️ Conversion ID ainda não preenchido');
                console.warn('   → Editar /public/js/tracking-config.js');
                warnings++;
            }
            
            // Verificar labels
            const labels = config.labels || {};
            let labelsOk = 0;
            let labelsNotOk = 0;
            
            Object.entries(labels).forEach(([key, value]) => {
                if (value && !value.includes('REPLACE_WITH') && value !== '') {
                    labelsOk++;
                } else {
                    labelsNotOk++;
                }
            });
            
            if (labelsOk > 0) {
                console.log(`   ✅ ${labelsOk} label(s) preenchido(s)`);
                success++;
            }
            
            if (labelsNotOk > 0) {
                console.warn(`   ⚠️ ${labelsNotOk} label(s) ainda não preenchido(s)`);
                console.warn('   → Editar /public/js/tracking-config.js');
                warnings++;
            }
        } else {
            console.error('   ❌ Configuração não encontrada');
            console.error('   → Incluir <script src="/js/tracking-config.js" defer></script>');
            errors++;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 4. VERIFICAR DEDUPLICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n🔒 [4/6] Verificando sistema de deduplicação...');
    
    if (typeof sessionStorage !== 'undefined') {
        console.log('   ✅ sessionStorage disponível');
        success++;
        
        // Verificar se há eventos já rastreados
        const trackedEvents = Object.keys(sessionStorage)
            .filter(key => key.startsWith('soundy_tracked_'));
        
        if (trackedEvents.length > 0) {
            console.log(`   ℹ️ ${trackedEvents.length} evento(s) já rastreado(s) nesta sessão`);
        } else {
            console.log('   ℹ️ Nenhum evento rastreado ainda');
        }
    } else {
        console.error('   ❌ sessionStorage não disponível');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5. VERIFICAR INTEGRAÇÕES
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n🔗 [5/6] Verificando integrações...');
    
    // Lista de espera
    const waitlistForm = document.querySelector('form');
    const waitlistButton = document.querySelector('button[type="submit"]');
    
    if (waitlistForm) {
        console.log('   ✅ Formulário de lista de espera encontrado');
        success++;
    } else {
        console.warn('   ⚠️ Formulário não encontrado (normal se não estiver em prelaunch.html)');
        warnings++;
    }
    
    // CTAs de vendas
    const salesCTAs = document.querySelectorAll('a[href*="hotmart"], .cta-checkout, .buy-now');
    
    if (salesCTAs.length > 0) {
        console.log(`   ✅ ${salesCTAs.length} CTA(s) de vendas encontrado(s)`);
        success++;
    } else {
        console.warn('   ⚠️ CTAs de vendas não encontrados (normal se não estiver em página de vendas)');
        warnings++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 6. TESTAR TRACKING (SIMULAÇÃO)
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n🧪 [6/6] Teste de disponibilidade...');
    
    if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
        console.log('   ✅ Sistema de tracking ATIVO');
        success++;
        
        // Mostrar métodos disponíveis
        console.log('\n   📋 Métodos disponíveis:');
        const methods = [
            'configure',
            'trackWaitlistSignup',
            'trackCTADemoToSales',
            'trackCTASalesToCheckout',
            'trackPurchase',
            'isEnabled',
            'setDebug',
            'getConfig'
        ];
        
        methods.forEach(method => {
            if (typeof window.SoundyTracking[method] === 'function') {
                console.log(`      ✅ SoundyTracking.${method}()`);
            } else {
                console.warn(`      ⚠️ SoundyTracking.${method}() não encontrado`);
            }
        });
    } else {
        console.error('   ❌ Sistema de tracking INATIVO');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('\n🔍 ═══════════════════════════════════════════════════════');
    console.log('🔍 RESUMO DA VALIDAÇÃO');
    console.log('🔍 ═══════════════════════════════════════════════════════\n');
    
    console.log(`   ✅ Sucesso: ${success}`);
    console.log(`   ⚠️ Avisos: ${warnings}`);
    console.log(`   ❌ Erros: ${errors}\n`);
    
    if (errors === 0 && warnings === 0) {
        console.log('🎉 SISTEMA 100% CONFIGURADO E PRONTO!');
        console.log('   → Você pode fazer testes reais agora');
    } else if (errors === 0) {
        console.log('✅ SISTEMA FUNCIONAL (com avisos não críticos)');
        console.log('   → Preencher IDs em tracking-config.js para ativar completamente');
    } else {
        console.log('❌ SISTEMA COM PROBLEMAS');
        console.log('   → Corrigir os erros acima antes de prosseguir');
    }
    
    console.log('\n📖 Documentação: TRACKING_SETUP.md');
    console.log('🔧 Configuração: /public/js/tracking-config.js');
    console.log('🐛 Debug: Adicionar ?debug=true na URL\n');
    
    console.log('🔍 ═══════════════════════════════════════════════════════\n');
    
    // Retornar resultado
    return {
        success,
        warnings,
        errors,
        status: errors === 0 ? (warnings === 0 ? 'perfect' : 'ready') : 'needs_fix'
    };
})();
