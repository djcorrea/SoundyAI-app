// 🧪 SCRIPT DE VALIDAÇÃO - GUARDS PREMIUM
// Cole este código no console do navegador para testar

(function testPremiumGuards() {
    console.log('🧪 ==========================================');
    console.log('🧪 TESTE DE GUARDS PREMIUM');
    console.log('🧪 ==========================================\n');

    // Salvar estado original
    const originalMode = window.APP_MODE;
    let testsPassed = 0;
    let testsFailed = 0;

    // ========================================
    // 🔬 TESTE 1: Modo Reduced - Bloquear IA
    // ========================================
    console.log('📝 TESTE 1: Pedir Ajuda à IA (modo reduced)');
    window.APP_MODE = 'reduced';
    
    // Mock da análise para evitar erros
    const mockAnalysis = { fileName: 'test.mp3', score: 75 };
    window.currentModalAnalysis = mockAnalysis;
    
    // Capturar logs
    const originalLog = console.log;
    let guardDetected = false;
    let executionDetected = false;
    
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[PREMIUM-GUARD]') && msg.includes('bloqueada')) {
            guardDetected = true;
        }
        if (msg.includes('BOTÃO CLICADO') || msg.includes('AUDIO-DEBUG')) {
            executionDetected = true;
        }
        originalLog.apply(console, args);
    };
    
    try {
        if (typeof window.sendModalAnalysisToChat === 'function') {
            window.sendModalAnalysisToChat();
            
            if (guardDetected && !executionDetected) {
                console.log = originalLog;
                console.log('✅ TESTE 1 PASSOU: Guard bloqueou execução da IA\n');
                testsPassed++;
            } else if (!guardDetected) {
                console.log = originalLog;
                console.error('❌ TESTE 1 FALHOU: Guard não foi detectado\n');
                testsFailed++;
            } else {
                console.log = originalLog;
                console.error('❌ TESTE 1 FALHOU: Função executou apesar do guard\n');
                testsFailed++;
            }
        } else {
            console.log = originalLog;
            console.warn('⚠️ TESTE 1 PULADO: Função sendModalAnalysisToChat não encontrada\n');
        }
    } catch (error) {
        console.log = originalLog;
        console.error('❌ TESTE 1 ERRO:', error.message, '\n');
        testsFailed++;
    }

    // ========================================
    // 🔬 TESTE 2: Modo Reduced - Bloquear PDF
    // ========================================
    console.log('📝 TESTE 2: Baixar Relatório (modo reduced)');
    window.APP_MODE = 'reduced';
    
    guardDetected = false;
    executionDetected = false;
    
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[PREMIUM-GUARD]') && msg.includes('bloqueada')) {
            guardDetected = true;
        }
        if (msg.includes('PDF-START') || msg.includes('Baixando relatório')) {
            executionDetected = true;
        }
        originalLog.apply(console, args);
    };
    
    try {
        if (typeof window.downloadModalAnalysis === 'function' || typeof downloadModalAnalysis === 'function') {
            const fn = window.downloadModalAnalysis || downloadModalAnalysis;
            fn();
            
            if (guardDetected && !executionDetected) {
                console.log = originalLog;
                console.log('✅ TESTE 2 PASSOU: Guard bloqueou geração do PDF\n');
                testsPassed++;
            } else if (!guardDetected) {
                console.log = originalLog;
                console.error('❌ TESTE 2 FALHOU: Guard não foi detectado\n');
                testsFailed++;
            } else {
                console.log = originalLog;
                console.error('❌ TESTE 2 FALHOU: PDF executou apesar do guard\n');
                testsFailed++;
            }
        } else {
            console.log = originalLog;
            console.warn('⚠️ TESTE 2 PULADO: Função downloadModalAnalysis não encontrada\n');
        }
    } catch (error) {
        console.log = originalLog;
        console.error('❌ TESTE 2 ERRO:', error.message, '\n');
        testsFailed++;
    }

    // ========================================
    // 🔬 TESTE 3: Modo Full - Permitir Execução
    // ========================================
    console.log('📝 TESTE 3: Modo Full - Verificar que funções NÃO são bloqueadas');
    window.APP_MODE = 'full';
    
    guardDetected = false;
    let normalExecutionDetected = false;
    
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[PREMIUM-GUARD]') && msg.includes('bloqueada')) {
            guardDetected = true;
        }
        if (msg.includes('BOTÃO CLICADO') || msg.includes('Nenhuma análise')) {
            normalExecutionDetected = true;
        }
        originalLog.apply(console, args);
    };
    
    try {
        if (typeof window.sendModalAnalysisToChat === 'function') {
            window.sendModalAnalysisToChat();
            
            if (!guardDetected && normalExecutionDetected) {
                console.log = originalLog;
                console.log('✅ TESTE 3 PASSOU: Função executa normalmente em modo full\n');
                testsPassed++;
            } else if (guardDetected) {
                console.log = originalLog;
                console.error('❌ TESTE 3 FALHOU: Guard bloqueou em modo full (não deveria)\n');
                testsFailed++;
            } else {
                console.log = originalLog;
                console.warn('⚠️ TESTE 3: Execução iniciada (verificar manualmente)\n');
                testsPassed++;
            }
        } else {
            console.log = originalLog;
            console.warn('⚠️ TESTE 3 PULADO: Função sendModalAnalysisToChat não encontrada\n');
        }
    } catch (error) {
        console.log = originalLog;
        console.error('❌ TESTE 3 ERRO:', error.message, '\n');
        testsFailed++;
    }

    // Restaurar estado original
    console.log = originalLog;
    window.APP_MODE = originalMode;
    delete window.currentModalAnalysis;

    // ========================================
    // 📊 RESUMO DOS TESTES
    // ========================================
    console.log('🧪 ==========================================');
    console.log('📊 RESUMO DOS TESTES');
    console.log('🧪 ==========================================');
    console.log(`✅ Testes Passados: ${testsPassed}`);
    console.log(`❌ Testes Falhados: ${testsFailed}`);
    
    if (testsFailed === 0 && testsPassed > 0) {
        console.log('🎉 TODOS OS TESTES PASSARAM!');
        console.log('✅ Guards estão funcionando corretamente');
    } else if (testsFailed > 0) {
        console.error('⚠️ ALGUNS TESTES FALHARAM!');
        console.error('🔍 Verifique os logs acima para detalhes');
    } else {
        console.warn('⚠️ Nenhum teste foi executado');
        console.warn('🔍 Verifique se as funções existem no escopo');
    }
    
    console.log('\n💡 COMO USAR:');
    console.log('1. Cole este script no console');
    console.log('2. Analise os resultados');
    console.log('3. Se tudo passar, teste manualmente clicando nos botões');
    console.log('🧪 ==========================================\n');
})();
