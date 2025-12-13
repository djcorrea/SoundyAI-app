// 🧪 TESTE RÁPIDO DE VALIDAÇÃO - Cole no Console do Navegador
// Execute após recarregar a página com Ctrl+Shift+R

(function quickTest() {
    console.clear();
    console.log('🧪 ========================================');
    console.log('🧪 TESTE RÁPIDO: GUARDS PREMIUM NATIVOS');
    console.log('🧪 ========================================\n');
    
    // 1️⃣ Verificar se funções existem
    console.log('📋 PASSO 1: Verificando se funções existem...');
    const hasSendChat = typeof window.sendModalAnalysisToChat === 'function';
    const hasDownloadPDF = typeof window.downloadModalAnalysis === 'function' || 
                           typeof downloadModalAnalysis === 'function';
    
    console.log(`   sendModalAnalysisToChat: ${hasSendChat ? '✅' : '❌'}`);
    console.log(`   downloadModalAnalysis: ${hasDownloadPDF ? '✅' : '❌'}\n`);
    
    if (!hasSendChat && !hasDownloadPDF) {
        console.error('❌ ERRO: Funções não encontradas! Recarregue a página.');
        return;
    }
    
    // 2️⃣ Verificar se guards nativos estão presentes
    console.log('📋 PASSO 2: Verificando guards nativos...');
    
    if (hasSendChat) {
        const source = window.sendModalAnalysisToChat.toString();
        const hasGuard = source.includes('[PREMIUM-GUARD]') || 
                        source.includes('window.APP_MODE === \'reduced\'');
        console.log(`   sendModalAnalysisToChat guard: ${hasGuard ? '✅' : '❌'}`);
        
        if (!hasGuard) {
            console.error('   ⚠️ GUARD NÃO ENCONTRADO! Verifique audio-analyzer-integration.js');
        }
    }
    
    if (hasDownloadPDF) {
        const fn = window.downloadModalAnalysis || downloadModalAnalysis;
        const source = fn.toString();
        const hasGuard = source.includes('[PREMIUM-GUARD]') || 
                        source.includes('window.APP_MODE === \'reduced\'');
        console.log(`   downloadModalAnalysis guard: ${hasGuard ? '✅' : '❌'}\n`);
        
        if (!hasGuard) {
            console.error('   ⚠️ GUARD NÃO ENCONTRADO! Verifique audio-analyzer-integration.js\n');
        }
    }
    
    // 3️⃣ Teste Funcional: Modo Reduced
    console.log('📋 PASSO 3: Testando bloqueio em modo REDUCED...');
    window.APP_MODE = 'reduced';
    window.currentModalAnalysis = { fileName: 'test.mp3', score: 75 };
    
    // Capturar logs
    const originalWarn = console.warn;
    const originalLog = console.log;
    let guardBlocked = false;
    let functionExecuted = false;
    
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[PREMIUM-GUARD]') && msg.includes('bloqueada')) {
            guardBlocked = true;
        }
        if (msg.includes('BOTÃO CLICADO') || msg.includes('PDF-START')) {
            functionExecuted = true;
        }
        originalLog.apply(console, args);
    };
    
    console.warn = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[PREMIUM-GUARD]') || msg.includes('bloqueada')) {
            guardBlocked = true;
        }
        originalWarn.apply(console, args);
    };
    
    // Testar sendModalAnalysisToChat
    if (hasSendChat) {
        try {
            window.sendModalAnalysisToChat();
            
            setTimeout(() => {
                console.log = originalLog;
                console.warn = originalWarn;
                
                if (guardBlocked && !functionExecuted) {
                    console.log('   ✅ sendModalAnalysisToChat: BLOQUEADO CORRETAMENTE');
                } else if (!guardBlocked) {
                    console.error('   ❌ sendModalAnalysisToChat: GUARD NÃO EXECUTOU!');
                } else {
                    console.error('   ❌ sendModalAnalysisToChat: FUNÇÃO EXECUTOU (não deveria)!');
                }
            }, 100);
        } catch (error) {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error('   ❌ ERRO ao testar sendModalAnalysisToChat:', error.message);
        }
    }
    
    // 4️⃣ Instruções para teste manual
    setTimeout(() => {
        console.log('\n📋 PASSO 4: TESTE MANUAL (você deve fazer)');
        console.log('   1. Verifique se APP_MODE está "reduced":');
        console.log('      → window.APP_MODE');
        console.log('   2. Clique no botão "Pedir Ajuda à IA"');
        console.log('      → Deve abrir modal de upgrade');
        console.log('      → NÃO deve aparecer [AUDIO-DEBUG]');
        console.log('   3. Clique no botão "Baixar Relatório"');
        console.log('      → Deve abrir modal de upgrade');
        console.log('      → NÃO deve aparecer [PDF-START]\n');
        
        console.log('📋 PASSO 5: TESTE EM MODO FULL');
        console.log('   Execute no console:');
        console.log('   → window.APP_MODE = "full"');
        console.log('   → Clique nos botões novamente');
        console.log('   → Deve funcionar normalmente\n');
        
        console.log('🧪 ========================================');
        console.log('🧪 TESTE AUTOMÁTICO CONCLUÍDO');
        console.log('🧪 Siga as instruções acima para teste manual');
        console.log('🧪 ========================================\n');
    }, 200);
})();
