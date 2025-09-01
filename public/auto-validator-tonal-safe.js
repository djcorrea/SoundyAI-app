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
    console.log(`1️⃣ Feature Flag: ${results.featureFlag ? '✅ ATIVA' : '❌ INATIVA'}`);
    
    // 2. Verificar se sistema carregou
    results.systemLoaded = typeof window.validateSpectralBandsData === 'function' && 
                           typeof window.tonalSummarySafe === 'function';
    console.log(`2️⃣ Sistema Carregado: ${results.systemLoaded ? '✅ SIM' : '❌ NÃO'}`);
    
    // 3. Verificar se migração foi aplicada
    results.migrationApplied = !!window.tonalBalanceSafeMigrationApplied;
    console.log(`3️⃣ Migração Aplicada: ${results.migrationApplied ? '✅ SIM' : '❌ NÃO'}`);
    
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
            console.log(`4️⃣ Função Funcionando: ${results.functionWorking ? '✅ SIM' : '❌ NÃO'} (${display})`);
        } catch (error) {
            console.log(`4️⃣ Função Funcionando: ❌ ERRO - ${error.message}`);
        }
    } else {
        console.log(`4️⃣ Função Funcionando: ⏸️ PULAR (sistema não carregado)`);
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
            
            console.log(`5️⃣ Integração: ${results.integrationWorking ? '✅ FUNCIONANDO' : '❌ PROBLEMA'} (${testResult})`);
        } else {
            console.log(`5️⃣ Integração: ⚠️ tonalSummary global não encontrada`);
        }
    } catch (error) {
        console.log(`5️⃣ Integração: ❌ ERRO - ${error.message}`);
    }
    
    // Status geral
    const criticalIssues = !results.featureFlag || !results.systemLoaded;
    const minorIssues = !results.migrationApplied || !results.functionWorking;
    
    if (!criticalIssues && !minorIssues) {
        results.overallStatus = 'excellent';
        console.log(`\n🎯 STATUS GERAL: ✅ EXCELENTE - Sistema totalmente funcional!`);
    } else if (!criticalIssues) {
        results.overallStatus = 'good';
        console.log(`\n🎯 STATUS GERAL: ⚠️ BOM - Sistema funcional com pequenos problemas`);
    } else {
        results.overallStatus = 'failed';
        console.log(`\n🎯 STATUS GERAL: ❌ FALHANDO - Sistema não funcional`);
    }
    
    // Recomendações
    console.group('💡 RECOMENDAÇÕES');
    if (!results.featureFlag) {
        console.log('- Ativar feature flag: window.TONAL_BALANCE_SAFE_V1 = true');
    }
    if (!results.systemLoaded) {
        console.log('- Verificar se tonal-balance-safe-v1.js foi carregado');
        console.log('- Verificar erros no console durante carregamento');
    }
    if (!results.migrationApplied) {
        console.log('- Executar migração manual: window.applyTonalBalanceSafeMigration?.()');
    }
    if (results.overallStatus === 'excellent') {
        console.log('✨ Sistema funcionando perfeitamente! Pode testar análise de áudio.');
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
    
    console.log('📊 Dados de entrada:', mockAnalysisData.technicalData.tonalBalance);
    
    // Testar com sistema ativo
    if (window.TONAL_BALANCE_SAFE_V1) {
        if (window.validateSpectralBandsData) {
            const validation = window.validateSpectralBandsData(mockAnalysisData.technicalData.tonalBalance);
            console.log('🔍 Validação:', validation);
            
            const display = window.tonalSummarySafe(mockAnalysisData.technicalData.tonalBalance);
            console.log('🎨 Resultado exibição:', display);
        } else {
            console.log('❌ Funções de validação não disponíveis');
        }
    } else {
        console.log('⚠️ Sistema não ativo, executando teste básico...');
        
        if (typeof window.tonalSummary === 'function') {
            const result = window.tonalSummary(mockAnalysisData.technicalData.tonalBalance);
            console.log('📄 Resultado função original:', result);
        }
    }
    
    console.groupEnd();
};

// 🔧 Função para forçar ativação e migração
window.forcarAtivacaoTonalSafe = function() {
    console.group('🔧 FORÇAR ATIVAÇÃO TONAL SAFE');
    
    // Ativar flag
    window.TONAL_BALANCE_SAFE_V1 = true;
    console.log('✅ Feature flag ativada');
    
    // Tentar carregar sistema se não estiver disponível
    if (typeof window.validateSpectralBandsData !== 'function') {
        console.log('⚠️ Sistema não carregado. Verificar se tonal-balance-safe-v1.js foi incluído.');
    }
    
    // Forçar migração
    if (typeof window.applyTonalBalanceSafeMigration === 'function') {
        window.applyTonalBalanceSafeMigration();
        console.log('✅ Migração forçada');
    } else {
        console.log('⚠️ Função de migração não disponível');
    }
    
    // Validar resultado
    const status = window.validarTonalBalanceSafe();
    
    console.groupEnd();
    
    return status;
};

// 🚀 Auto-executar validação na primeira carga (com delay)
setTimeout(() => {
    if (typeof window.validarTonalBalanceSafe === 'function') {
        console.log('🛡️ Auto-validação Tonal Balance Safe V1 disponível');
        console.log('💡 Execute: validarTonalBalanceSafe() para verificar status');
        console.log('💡 Execute: testarComAnaliseReal() para teste prático');
        console.log('💡 Execute: forcarAtivacaoTonalSafe() se houver problemas');
        
        // Auto-executar validação básica
        window.validarTonalBalanceSafe();
    }
}, 2000);

console.log('🛡️ Auto-validador Tonal Balance Safe V1 carregado');
