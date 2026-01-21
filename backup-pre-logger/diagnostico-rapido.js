// 🔍 SCRIPT DE DIAGNÓSTICO RÁPIDO - SoundyAI
// Cole este script no console do navegador (F12) e pressione Enter

(async function diagnosticoRapido() {
    console.log('%c🔍 DIAGNÓSTICO SOUNDYAI - INICIANDO...', 'font-size: 20px; font-weight: bold; color: #00d4ff;');
    console.log('═'.repeat(60));
    
    const resultados = {
        timestamp: new Date().toISOString(),
        testes: []
    };
    
    // ========================================
    // TESTE 1: Endpoint /api/config
    // ========================================
    console.log('\n%c📡 TESTE 1: Endpoint /api/config', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    try {
        const startTime = performance.now();
        const response = await fetch('/api/config');
        const endTime = performance.now();
        const data = await response.json();
        
        const teste1 = {
            nome: 'Endpoint Backend',
            status: response.ok ? '✅ PASSOU' : '❌ FALHOU',
            detalhes: {
                httpStatus: response.status,
                tempoResposta: `${(endTime - startTime).toFixed(0)}ms`,
                configured: data.configured,
                hasApiKey: !!data.openaiApiKey && data.openaiApiKey !== 'not-configured',
                keyPreview: data.openaiApiKey ? data.openaiApiKey.substring(0, 10) + '...' : 'N/A'
            }
        };
        
        resultados.testes.push(teste1);
        
        if (teste1.detalhes.hasApiKey) {
            console.log('✅ Endpoint OK:', teste1.detalhes);
        } else {
            console.error('❌ API Key não configurada no Railway!', teste1.detalhes);
        }
    } catch (error) {
        const teste1 = {
            nome: 'Endpoint Backend',
            status: '❌ ERRO',
            erro: error.message
        };
        resultados.testes.push(teste1);
        console.error('❌ Erro ao testar endpoint:', error.message);
    }
    
    console.log('─'.repeat(60));
    
    // ========================================
    // TESTE 2: AI Layer Presente
    // ========================================
    console.log('\n%c🤖 TESTE 2: AI Suggestion Layer', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
    const teste2 = {
        nome: 'AI Layer Carregado',
        status: '❓ VERIFICANDO'
    };
    
    if (window.aiSuggestionLayer) {
        teste2.status = '✅ PASSOU';
        teste2.detalhes = {
            presente: true,
            temApiKey: !!window.aiSuggestionLayer.apiKey,
            apiKeyPreview: window.aiSuggestionLayer.apiKey ? 
                window.aiSuggestionLayer.apiKey.substring(0, 10) + '...' : 'NULL',
            modelo: window.aiSuggestionLayer.model
        };
        console.log('✅ AI Layer encontrado:', teste2.detalhes);
    } else {
        teste2.status = '⚠️ NÃO CARREGADO';
        teste2.detalhes = { presente: false };
        console.warn('⚠️ AI Layer não está carregado. Você está na página principal do app?');
    }
    
    resultados.testes.push(teste2);
    console.log('─'.repeat(60));
    
    // ========================================
    // TESTE 3: Auto-Config da API Key
    // ========================================
    console.log('\n%c🔑 TESTE 3: Auto-Config API Key', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
    if (window.aiSuggestionLayer) {
        try {
            // Forçar reload da chave
            window.aiSuggestionLayer.apiKey = null;
            
            console.log('🔄 Tentando auto-configurar...');
            await window.aiSuggestionLayer.autoConfigureApiKey();
            
            const teste3 = {
                nome: 'Auto-Config API Key',
                status: window.aiSuggestionLayer.apiKey ? '✅ PASSOU' : '❌ FALHOU',
                detalhes: {
                    chaveCarregada: !!window.aiSuggestionLayer.apiKey,
                    keyPreview: window.aiSuggestionLayer.apiKey ? 
                        window.aiSuggestionLayer.apiKey.substring(0, 10) + '...' : 'NULL'
                }
            };
            
            resultados.testes.push(teste3);
            
            if (teste3.detalhes.chaveCarregada) {
                console.log('✅ API Key auto-configurada com sucesso!', teste3.detalhes);
            } else {
                console.error('❌ Falha ao auto-configurar API Key');
            }
        } catch (error) {
            const teste3 = {
                nome: 'Auto-Config API Key',
                status: '❌ ERRO',
                erro: error.message
            };
            resultados.testes.push(teste3);
            console.error('❌ Erro ao auto-configurar:', error.message);
        }
    } else {
        resultados.testes.push({
            nome: 'Auto-Config API Key',
            status: '⚠️ PULADO',
            motivo: 'AI Layer não carregado'
        });
    }
    
    console.log('─'.repeat(60));
    
    // ========================================
    // TESTE 4: OpenAI Direta (Opcional)
    // ========================================
    console.log('\n%c🔥 TESTE 4: Validação OpenAI API', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
    if (resultados.testes[0]?.detalhes?.hasApiKey) {
        try {
            const apiKey = await fetch('/api/config').then(r => r.json()).then(d => d.openaiApiKey);
            
            console.log('🌐 Testando conexão com OpenAI...');
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            
            const teste4 = {
                nome: 'OpenAI API Válida',
                status: response.ok ? '✅ PASSOU' : '❌ FALHOU',
                detalhes: {
                    httpStatus: response.status,
                    valida: response.ok
                }
            };
            
            if (response.ok) {
                const data = await response.json();
                teste4.detalhes.modelosDisponiveis = data.data?.length || 0;
            }
            
            resultados.testes.push(teste4);
            
            if (teste4.status === '✅ PASSOU') {
                console.log('✅ API Key OpenAI é válida!', teste4.detalhes);
            } else {
                console.error('❌ API Key OpenAI inválida ou expirada!', teste4.detalhes);
            }
        } catch (error) {
            const teste4 = {
                nome: 'OpenAI API Válida',
                status: '❌ ERRO',
                erro: error.message
            };
            resultados.testes.push(teste4);
            console.error('❌ Erro ao validar OpenAI:', error.message);
        }
    } else {
        resultados.testes.push({
            nome: 'OpenAI API Válida',
            status: '⚠️ PULADO',
            motivo: 'API Key não disponível'
        });
        console.warn('⚠️ Teste pulado: API Key não disponível');
    }
    
    console.log('─'.repeat(60));
    
    // ========================================
    // RELATÓRIO FINAL
    // ========================================
    console.log('\n%c📊 RELATÓRIO FINAL', 'font-size: 18px; font-weight: bold; color: #00ff00;');
    console.log('═'.repeat(60));
    
    const passou = resultados.testes.filter(t => t.status.includes('✅')).length;
    const falhou = resultados.testes.filter(t => t.status.includes('❌')).length;
    const pulado = resultados.testes.filter(t => t.status.includes('⚠️')).length;
    
    console.log(`✅ Passou: ${passou}`);
    console.log(`❌ Falhou: ${falhou}`);
    console.log(`⚠️ Pulado: ${pulado}`);
    console.log('');
    
    // Diagnóstico
    if (passou === resultados.testes.length) {
        console.log('%c🎉 TODOS OS TESTES PASSARAM!', 'font-size: 18px; font-weight: bold; color: #00ff00;');
        console.log('%cSistema está pronto para usar IA!', 'font-size: 14px; color: #00ff00;');
    } else {
        console.log('%c⚠️ ALGUNS TESTES FALHARAM', 'font-size: 18px; font-weight: bold; color: #ff6b00;');
        console.log('%cVerifique os erros acima e siga as correções', 'font-size: 14px; color: #ff6b00;');
        
        // Sugestões de correção
        console.log('\n%c🔧 SUGESTÕES DE CORREÇÃO:', 'font-size: 16px; font-weight: bold; color: #ffd700;');
        
        if (resultados.testes[0]?.status.includes('❌')) {
            console.log('1️⃣ Endpoint Backend falhou:');
            console.log('   → Verifique se OPENAI_API_KEY está configurada no Railway');
            console.log('   → Acesse: https://railway.app/dashboard → Variables');
        }
        
        if (resultados.testes[1]?.status.includes('⚠️')) {
            console.log('2️⃣ AI Layer não carregado:');
            console.log('   → Você está na página principal do app?');
            console.log('   → Faça hard refresh: Ctrl+Shift+R');
        }
        
        if (resultados.testes[2]?.status.includes('❌')) {
            console.log('3️⃣ Auto-Config falhou:');
            console.log('   → Verifique se o endpoint /api/config está retornando API Key');
            console.log('   → Faça hard refresh: Ctrl+Shift+R');
        }
        
        if (resultados.testes[3]?.status.includes('❌')) {
            console.log('4️⃣ OpenAI API inválida:');
            console.log('   → Verifique se a chave API é válida');
            console.log('   → Teste em: https://platform.openai.com/api-keys');
        }
    }
    
    console.log('\n═'.repeat(60));
    console.log('%c📋 RELATÓRIO COMPLETO:', 'font-size: 14px; font-weight: bold;');
    console.table(resultados.testes);
    
    console.log('\n%c💡 DICA:', 'font-size: 14px; font-weight: bold; color: #00d4ff;');
    console.log('Copie o objeto abaixo e envie para análise:');
    console.log(resultados);
    
    return resultados;
})();
