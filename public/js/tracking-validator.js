// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

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
    
    log('🔍 ═══════════════════════════════════════════════════════');
    log('🔍 VALIDADOR DE CONFIGURAÇÃO - SOUNDYAI TRACKING');
    log('🔍 ═══════════════════════════════════════════════════════\n');
    
    let errors = 0;
    let warnings = 0;
    let success = 0;
    
    // ═══════════════════════════════════════════════════════════════════
    // 1. VERIFICAR GTAG.JS
    // ═══════════════════════════════════════════════════════════════════
    
    log('📊 [1/6] Verificando Google Tag (gtag.js)...');
    
    if (typeof gtag === 'function') {
        log('   ✅ gtag.js carregado');
        success++;
    } else {
        error('   ❌ gtag.js NÃO encontrado');
        error('   → Verifique se o script está incluído no HTML');
        errors++;
    }
    
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
        log('   ✅ dataLayer inicializado');
        success++;
    } else {
        error('   ❌ dataLayer NÃO encontrado');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 2. VERIFICAR TRACKING.JS
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n📦 [2/6] Verificando módulo tracking.js...');
    
    if (window.SoundyTracking) {
        log('   ✅ SoundyTracking encontrado');
        success++;
        
        if (typeof window.SoundyTracking.configure === 'function') {
            log('   ✅ API disponível');
            success++;
        } else {
            error('   ❌ API incompleta');
            errors++;
        }
    } else {
        error('   ❌ SoundyTracking NÃO encontrado');
        error('   → Incluir <script src="/js/tracking.js" defer></script>');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3. VERIFICAR CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n⚙️ [3/6] Verificando configuração...');
    
    if (window.SoundyTracking) {
        const config = window.SoundyTracking.getConfig?.();
        
        if (config) {
            log('   ✅ Configuração carregada');
            success++;
            
            // Verificar IDs
            if (config.conversionId && !config.conversionId.includes('REPLACE_WITH')) {
                log('   ✅ Conversion ID preenchido:', config.conversionId);
                success++;
            } else {
                warn('   ⚠️ Conversion ID ainda não preenchido');
                warn('   → Editar /public/js/tracking-config.js');
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
                log(`   ✅ ${labelsOk} label(s) preenchido(s)`);
                success++;
            }
            
            if (labelsNotOk > 0) {
                warn(`   ⚠️ ${labelsNotOk} label(s) ainda não preenchido(s)`);
                warn('   → Editar /public/js/tracking-config.js');
                warnings++;
            }
        } else {
            error('   ❌ Configuração não encontrada');
            error('   → Incluir <script src="/js/tracking-config.js" defer></script>');
            errors++;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 4. VERIFICAR DEDUPLICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n🔒 [4/6] Verificando sistema de deduplicação...');
    
    if (typeof sessionStorage !== 'undefined') {
        log('   ✅ sessionStorage disponível');
        success++;
        
        // Verificar se há eventos já rastreados
        const trackedEvents = Object.keys(sessionStorage)
            .filter(key => key.startsWith('soundy_tracked_'));
        
        if (trackedEvents.length > 0) {
            log(`   ℹ️ ${trackedEvents.length} evento(s) já rastreado(s) nesta sessão`);
        } else {
            log('   ℹ️ Nenhum evento rastreado ainda');
        }
    } else {
        error('   ❌ sessionStorage não disponível');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5. VERIFICAR INTEGRAÇÕES
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n🔗 [5/6] Verificando integrações...');
    
    // Lista de espera
    const waitlistForm = document.querySelector('form');
    const waitlistButton = document.querySelector('button[type="submit"]');
    
    if (waitlistForm) {
        log('   ✅ Formulário de lista de espera encontrado');
        success++;
    } else {
        warn('   ⚠️ Formulário não encontrado (normal se não estiver em prelaunch.html)');
        warnings++;
    }
    
    // CTAs de vendas
    const salesCTAs = document.querySelectorAll('a[href*="hotmart"], .cta-checkout, .buy-now');
    
    if (salesCTAs.length > 0) {
        log(`   ✅ ${salesCTAs.length} CTA(s) de vendas encontrado(s)`);
        success++;
    } else {
        warn('   ⚠️ CTAs de vendas não encontrados (normal se não estiver em página de vendas)');
        warnings++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 6. TESTAR TRACKING (SIMULAÇÃO)
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n🧪 [6/6] Teste de disponibilidade...');
    
    if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
        log('   ✅ Sistema de tracking ATIVO');
        success++;
        
        // Mostrar métodos disponíveis
        log('\n   📋 Métodos disponíveis:');
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
                log(`      ✅ SoundyTracking.${method}()`);
            } else {
                warn(`      ⚠️ SoundyTracking.${method}() não encontrado`);
            }
        });
    } else {
        error('   ❌ Sistema de tracking INATIVO');
        errors++;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════════
    
    log('\n🔍 ═══════════════════════════════════════════════════════');
    log('🔍 RESUMO DA VALIDAÇÃO');
    log('🔍 ═══════════════════════════════════════════════════════\n');
    
    log(`   ✅ Sucesso: ${success}`);
    log(`   ⚠️ Avisos: ${warnings}`);
    log(`   ❌ Erros: ${errors}\n`);
    
    if (errors === 0 && warnings === 0) {
        log('🎉 SISTEMA 100% CONFIGURADO E PRONTO!');
        log('   → Você pode fazer testes reais agora');
    } else if (errors === 0) {
        log('✅ SISTEMA FUNCIONAL (com avisos não críticos)');
        log('   → Preencher IDs em tracking-config.js para ativar completamente');
    } else {
        log('❌ SISTEMA COM PROBLEMAS');
        log('   → Corrigir os erros acima antes de prosseguir');
    }
    
    log('\n📖 Documentação: TRACKING_SETUP.md');
    log('🔧 Configuração: /public/js/tracking-config.js');
    log('🐛 Debug: Adicionar ?debug=true na URL\n');
    
    log('🔍 ═══════════════════════════════════════════════════════\n');
    
    // Retornar resultado
    return {
        success,
        warnings,
        errors,
        status: errors === 0 ? (warnings === 0 ? 'perfect' : 'ready') : 'needs_fix'
    };
})();
