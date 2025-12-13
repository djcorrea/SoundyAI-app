// 🧪 TESTE COMPLETO DO GATE SYSTEM
// Cole este código no console do navegador após carregar a página

(function completeGateSystemTest() {
    console.clear();
    console.log('🧪 ========================================');
    console.log('🧪 TESTE COMPLETO: SISTEMA DE GATE PREMIUM');
    console.log('🧪 ========================================\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    // ==========================================
    // TESTE 1: Verificar Instalação
    // ==========================================
    console.log('📋 TESTE 1: Verificando instalação do sistema...');
    
    const modal = document.getElementById('premiumUpgradeModal');
    const styles = document.getElementById('premiumUpgradeStyles');
    const hasGatedAI = typeof window.gatedSendModalAnalysisToChat === 'function';
    const hasGatedPDF = typeof window.gatedDownloadModalAnalysis === 'function';
    const hasOrigAI = typeof window.__orig_sendModalAnalysisToChat === 'function';
    const hasOrigPDF = typeof window.__orig_downloadModalAnalysis === 'function';
    
    console.log(`   Modal criado: ${modal ? '✅' : '❌'}`);
    console.log(`   Estilos carregados: ${styles ? '✅' : '❌'}`);
    console.log(`   gatedSendModalAnalysisToChat: ${hasGatedAI ? '✅' : '❌'}`);
    console.log(`   gatedDownloadModalAnalysis: ${hasGatedPDF ? '✅' : '❌'}`);
    console.log(`   __orig_sendModalAnalysisToChat: ${hasOrigAI ? '✅' : '❌'}`);
    console.log(`   __orig_downloadModalAnalysis: ${hasOrigPDF ? '✅' : '❌'}\n`);
    
    if (modal && hasGatedAI && hasGatedPDF && hasOrigAI && hasOrigPDF) {
        console.log('✅ TESTE 1 PASSOU: Sistema instalado corretamente\n');
        testsPassed++;
    } else {
        console.error('❌ TESTE 1 FALHOU: Sistema não está completo\n');
        testsFailed++;
    }
    
    // ==========================================
    // TESTE 2: Verificar Onclicks Substituídos
    // ==========================================
    console.log('📋 TESTE 2: Verificando onclicks substituídos...');
    
    const buttons = document.querySelectorAll('button[onclick]');
    let aiButtonFixed = false;
    let pdfButtonFixed = false;
    
    buttons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        const text = btn.textContent.trim();
        
        if (text.includes('Pedir Ajuda à IA')) {
            console.log(`   "${text}": ${onclick}`);
            if (onclick.includes('gatedSendModalAnalysisToChat')) {
                aiButtonFixed = true;
            }
        }
        
        if (text.includes('Baixar Relatório')) {
            console.log(`   "${text}": ${onclick}`);
            if (onclick.includes('gatedDownloadModalAnalysis')) {
                pdfButtonFixed = true;
            }
        }
    });
    
    console.log(`\n   Botão IA substituído: ${aiButtonFixed ? '✅' : '❌'}`);
    console.log(`   Botão PDF substituído: ${pdfButtonFixed ? '✅' : '❌'}\n`);
    
    if (aiButtonFixed && pdfButtonFixed) {
        console.log('✅ TESTE 2 PASSOU: Onclicks substituídos corretamente\n');
        testsPassed++;
    } else {
        console.error('❌ TESTE 2 FALHOU: Onclicks não foram substituídos\n');
        testsFailed++;
    }
    
    // ==========================================
    // TESTE 3: Modo Reduced - Bloquear IA
    // ==========================================
    console.log('📋 TESTE 3: Testando bloqueio de IA em modo REDUCED...');
    window.APP_MODE = 'reduced';
    window.currentModalAnalysis = { fileName: 'test.mp3', score: 75 };
    
    // Capturar logs
    const originalWarn = console.warn;
    const originalLog = console.log;
    let gateBlocked = false;
    let functionExecuted = false;
    let modalOpened = false;
    
    console.warn = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[GATE] bloqueado')) {
            gateBlocked = true;
        }
        originalWarn.apply(console, args);
    };
    
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[UPGRADE MODAL] opened')) {
            modalOpened = true;
        }
        if (msg.includes('BOTÃO CLICADO') || msg.includes('AUDIO-DEBUG')) {
            functionExecuted = true;
        }
        originalLog.apply(console, args);
    };
    
    try {
        window.gatedSendModalAnalysisToChat();
        
        setTimeout(() => {
            console.warn = originalWarn;
            console.log = originalLog;
            
            console.log(`   Gate bloqueou: ${gateBlocked ? '✅' : '❌'}`);
            console.log(`   Modal abriu: ${modalOpened ? '✅' : '❌'}`);
            console.log(`   Função NÃO executou: ${!functionExecuted ? '✅' : '❌'}\n`);
            
            if (gateBlocked && modalOpened && !functionExecuted) {
                console.log('✅ TESTE 3 PASSOU: IA bloqueada em modo reduced\n');
                testsPassed++;
            } else {
                console.error('❌ TESTE 3 FALHOU: IA não foi bloqueada corretamente\n');
                testsFailed++;
            }
            
            // Fechar modal para próximo teste
            if (modal) modal.style.display = 'none';
            
            // ==========================================
            // TESTE 4: Modo Reduced - Bloquear PDF
            // ==========================================
            setTimeout(() => {
                console.log('📋 TESTE 4: Testando bloqueio de PDF em modo REDUCED...');
                
                gateBlocked = false;
                functionExecuted = false;
                modalOpened = false;
                
                console.warn = function(...args) {
                    const msg = args.join(' ');
                    if (msg.includes('[GATE] bloqueado')) {
                        gateBlocked = true;
                    }
                    originalWarn.apply(console, args);
                };
                
                console.log = function(...args) {
                    const msg = args.join(' ');
                    if (msg.includes('[UPGRADE MODAL] opened')) {
                        modalOpened = true;
                    }
                    if (msg.includes('PDF-START') || msg.includes('Baixando relatório')) {
                        functionExecuted = true;
                    }
                    originalLog.apply(console, args);
                };
                
                window.gatedDownloadModalAnalysis();
                
                setTimeout(() => {
                    console.warn = originalWarn;
                    console.log = originalLog;
                    
                    console.log(`   Gate bloqueou: ${gateBlocked ? '✅' : '❌'}`);
                    console.log(`   Modal abriu: ${modalOpened ? '✅' : '❌'}`);
                    console.log(`   Função NÃO executou: ${!functionExecuted ? '✅' : '❌'}\n`);
                    
                    if (gateBlocked && modalOpened && !functionExecuted) {
                        console.log('✅ TESTE 4 PASSOU: PDF bloqueado em modo reduced\n');
                        testsPassed++;
                    } else {
                        console.error('❌ TESTE 4 FALHOU: PDF não foi bloqueado corretamente\n');
                        testsFailed++;
                    }
                    
                    // Fechar modal
                    if (modal) modal.style.display = 'none';
                    
                    // ==========================================
                    // TESTE 5: Modo Full - Permitir Execução
                    // ==========================================
                    setTimeout(() => {
                        console.log('📋 TESTE 5: Testando modo FULL (deve permitir)...');
                        window.APP_MODE = 'full';
                        
                        let gatePermitted = false;
                        
                        console.log = function(...args) {
                            const msg = args.join(' ');
                            if (msg.includes('[GATE] permitido')) {
                                gatePermitted = true;
                            }
                            originalLog.apply(console, args);
                        };
                        
                        window.gatedSendModalAnalysisToChat();
                        
                        setTimeout(() => {
                            console.log = originalLog;
                            
                            console.log(`   Gate permitiu: ${gatePermitted ? '✅' : '❌'}\n`);
                            
                            if (gatePermitted) {
                                console.log('✅ TESTE 5 PASSOU: Funções permitidas em modo full\n');
                                testsPassed++;
                            } else {
                                console.error('❌ TESTE 5 FALHOU: Funções bloqueadas em modo full\n');
                                testsFailed++;
                            }
                            
                            // ==========================================
                            // RESUMO FINAL
                            // ==========================================
                            console.log('🧪 ========================================');
                            console.log('📊 RESUMO DOS TESTES');
                            console.log('🧪 ========================================');
                            console.log(`✅ Testes Passados: ${testsPassed}/5`);
                            console.log(`❌ Testes Falhados: ${testsFailed}/5`);
                            
                            if (testsFailed === 0) {
                                console.log('\n🎉 SUCESSO TOTAL! Sistema funcionando perfeitamente!');
                                console.log('✅ Todos os 5 testes passaram');
                            } else if (testsPassed >= 3) {
                                console.warn('\n⚠️ PARCIALMENTE FUNCIONAL');
                                console.warn(`${testsPassed} de 5 testes passaram`);
                            } else {
                                console.error('\n❌ FALHA CRÍTICA');
                                console.error('Sistema não está funcionando corretamente');
                            }
                            
                            console.log('\n💡 PRÓXIMOS PASSOS:');
                            console.log('1. Se tudo passou: teste manualmente clicando nos botões');
                            console.log('2. Defina window.APP_MODE = "reduced" no console');
                            console.log('3. Clique em "Pedir Ajuda à IA" e "Baixar Relatório"');
                            console.log('4. Verifique se modal aparece e NÃO há logs [PDF-START] ou [AUDIO-DEBUG]');
                            console.log('🧪 ========================================\n');
                        }, 100);
                    }, 200);
                }, 100);
            }, 200);
        }, 100);
    } catch (error) {
        console.warn = originalWarn;
        console.log = originalLog;
        console.error('❌ ERRO ao executar teste:', error.message);
        testsFailed++;
    }
})();
