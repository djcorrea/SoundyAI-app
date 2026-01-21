// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🧪 VALIDADOR AUTOMÁTICO - TONAL BALANCE SAFE V1
 * Sistema de testes automáticos para verificar se a implementação está funcionando
 * corretamente na aplicação principal
 */

// 🎯 Função de validação que pode ser executada no console
window.validarTonalBalanceSafe = function() {
    console.group('🛡️ VALIDAÇÃO TONAL BALANCE SAFE V1');
    
    const results = {
        featureFlag: false,
        systemLoaded: false,
        migrationApplied: false,
        functionWorking: false,
        integrationWorking: false,
        overallStatus: 'failed'
    };
    
    // 1. Verificar feature flag
    results.featureFlag = !!window.TONAL_BALANCE_SAFE_V1;
    log(`1️⃣ Feature Flag: ${results.featureFlag ? '✅ ATIVA' : '❌ INATIVA'}`);
    
    // 2. Verificar se sistema carregou
    results.systemLoaded = typeof window.validateSpectralBandsData === 'function' && 
                           typeof window.tonalSummarySafe === 'function';
    log(`2️⃣ Sistema Carregado: ${results.systemLoaded ? '✅ SIM' : '❌ NÃO'}`);
    
    // 3. Verificar se migração foi aplicada
    results.migrationApplied = !!window.tonalBalanceSafeMigrationApplied;
    log(`3️⃣ Migração Aplicada: ${results.migrationApplied ? '✅ SIM' : '❌ NÃO'}`);
    
    // 4. Testar função básica
    if (results.systemLoaded) {
        try {
            const testData = {
                sub: { rms_db: -15.2 },
                low: { rms_db: -8.7 },
                mid: { rms_db: -6.8 },
                high: { rms_db: -11.2 }
            };
            
            const validation = window.validateSpectralBandsData(testData);
            const display = window.tonalSummarySafe(testData);
            
            results.functionWorking = validation.shouldDisplay && display !== '—';
            log(`4️⃣ Função Funcionando: ${results.functionWorking ? '✅ SIM' : '❌ NÃO'} (${display})`);
        } catch (error) {
            log(`4️⃣ Função Funcionando: ❌ ERRO - ${error.message}`);
        }
    } else {
        log(`4️⃣ Função Funcionando: ⏸️ PULAR (sistema não carregado)`);
    }
    
    // 5. Testar integração com audio-analyzer
    try {
        // Verificar se a função global tonalSummary foi substituída
        if (typeof window.tonalSummary === 'function') {
            const testResult = window.tonalSummary({
                sub: { rms_db: -15.0 },
                low: { rms_db: -15.0 },
                mid: { rms_db: -15.0 },
                high: { rms_db: -15.0 }
            });
            
            // Se sistema ativo, valores iguais devem retornar "—"
            const expectedResult = results.featureFlag ? '—' : (testResult.includes('15.0') ? 'valores exibidos' : 'resultado inesperado');
            results.integrationWorking = results.featureFlag ? (testResult === '—') : true;
            
            log(`5️⃣ Integração: ${results.integrationWorking ? '✅ FUNCIONANDO' : '❌ PROBLEMA'} (${testResult})`);
        } else {
            log(`5️⃣ Integração: ⚠️ tonalSummary global não encontrada`);
        }
    } catch (error) {
        log(`5️⃣ Integração: ❌ ERRO - ${error.message}`);
    }
    
    // Status geral
    const criticalIssues = !results.featureFlag || !results.systemLoaded;
    const minorIssues = !results.migrationApplied || !results.functionWorking;
    
    if (!criticalIssues && !minorIssues) {
        results.overallStatus = 'excellent';
        log(`\n🎯 STATUS GERAL: ✅ EXCELENTE - Sistema totalmente funcional!`);
    } else if (!criticalIssues) {
        results.overallStatus = 'good';
        log(`\n🎯 STATUS GERAL: ⚠️ BOM - Sistema funcional com pequenos problemas`);
    } else {
        results.overallStatus = 'failed';
        log(`\n🎯 STATUS GERAL: ❌ FALHANDO - Sistema não funcional`);
    }
    
    // Recomendações
    console.group('💡 RECOMENDAÇÕES');
    if (!results.featureFlag) {
        log('- Ativar feature flag: window.TONAL_BALANCE_SAFE_V1 = true');
    }
    if (!results.systemLoaded) {
        log('- Verificar se tonal-balance-safe-v1.js foi carregado');
        log('- Verificar erros no console durante carregamento');
    }
    if (!results.migrationApplied) {
        log('- Executar migração manual: window.applyTonalBalanceSafeMigration?.()');
    }
    if (results.overallStatus === 'excellent') {
        log('✨ Sistema funcionando perfeitamente! Pode testar análise de áudio.');
    }
    console.groupEnd();
    
    console.groupEnd();
    
    return results;
};

// 🎯 Função para testar com dados reais de uma análise
window.testarComAnaliseReal = function() {
    console.group('🎵 TESTE COM ANÁLISE REAL');
    
    // Simular dados de uma análise real
    const mockAnalysisData = {
        technicalData: {
            tonalBalance: {
                sub: { rms_db: -12.5 },
                low: { rms_db: -8.7 },
                mid: { rms_db: -6.8 },
                high: { rms_db: -11.2 }
            }
        }
    };
    
    log('📊 Dados de entrada:', mockAnalysisData.technicalData.tonalBalance);
    
    // Testar com sistema ativo
    if (window.TONAL_BALANCE_SAFE_V1) {
        if (window.validateSpectralBandsData) {
            const validation = window.validateSpectralBandsData(mockAnalysisData.technicalData.tonalBalance);
            log('🔍 Validação:', validation);
            
            const display = window.tonalSummarySafe(mockAnalysisData.technicalData.tonalBalance);
            log('🎨 Resultado exibição:', display);
        } else {
            log('❌ Funções de validação não disponíveis');
        }
    } else {
        log('⚠️ Sistema não ativo, executando teste básico...');
        
        if (typeof window.tonalSummary === 'function') {
            const result = window.tonalSummary(mockAnalysisData.technicalData.tonalBalance);
            log('📄 Resultado função original:', result);
        }
    }
    
    console.groupEnd();
};

// 🔧 Função para forçar ativação e migração
window.forcarAtivacaoTonalSafe = function() {
    console.group('🔧 FORÇAR ATIVAÇÃO TONAL SAFE');
    
    // Ativar flag
    window.TONAL_BALANCE_SAFE_V1 = true;
    log('✅ Feature flag ativada');
    
    // Tentar carregar sistema se não estiver disponível
    if (typeof window.validateSpectralBandsData !== 'function') {
        log('⚠️ Sistema não carregado. Verificar se tonal-balance-safe-v1.js foi incluído.');
    }
    
    // Forçar migração
    if (typeof window.applyTonalBalanceSafeMigration === 'function') {
        window.applyTonalBalanceSafeMigration();
        log('✅ Migração forçada');
    } else {
        log('⚠️ Função de migração não disponível');
    }
    
    // Validar resultado
    const status = window.validarTonalBalanceSafe();
    
    console.groupEnd();
    
    return status;
};

// 🚀 Auto-executar validação na primeira carga (com delay)
setTimeout(() => {
    if (typeof window.validarTonalBalanceSafe === 'function') {
        log('🛡️ Auto-validação Tonal Balance Safe V1 disponível');
        log('💡 Execute: validarTonalBalanceSafe() para verificar status');
        log('💡 Execute: testarComAnaliseReal() para teste prático');
        log('💡 Execute: forcarAtivacaoTonalSafe() se houver problemas');
        
        // Auto-executar validação básica
        window.validarTonalBalanceSafe();
    }
}, 2000);

log('🛡️ Auto-validador Tonal Balance Safe V1 carregado');
