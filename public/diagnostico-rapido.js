// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// 🔍 SCRIPT DE DIAGNÓSTICO RÁPIDO - SoundyAI
// Cole este script no console do navegador (F12) e pressione Enter

(async function diagnosticoRapido() {
    log('%c🔍 DIAGNÓSTICO SOUNDYAI - INICIANDO...', 'font-size: 20px; font-weight: bold; color: #00d4ff;');
    log('═'.repeat(60));
    
    const resultados = {
        timestamp: new Date().toISOString(),
        testes: []
    };
    
    // ========================================
    // TESTE 1: Endpoint /api/config
    // ========================================
    log('\n%c📡 TESTE 1: Endpoint /api/config', 'font-size: 16px; font-weight: bold; color: #ffd700;');
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
            log('✅ Endpoint OK:', teste1.detalhes);
        } else {
            error('❌ API Key não configurada no Railway!', teste1.detalhes);
        }
    } catch (error) {
        const teste1 = {
            nome: 'Endpoint Backend',
            status: '❌ ERRO',
            erro: error.message
        };
        resultados.testes.push(teste1);
        error('❌ Erro ao testar endpoint:', error.message);
    }
    
    log('─'.repeat(60));
    
    // ========================================
    // TESTE 2: AI Layer Presente
    // ========================================
    log('\n%c🤖 TESTE 2: AI Suggestion Layer', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
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
        log('✅ AI Layer encontrado:', teste2.detalhes);
    } else {
        teste2.status = '⚠️ NÃO CARREGADO';
        teste2.detalhes = { presente: false };
        warn('⚠️ AI Layer não está carregado. Você está na página principal do app?');
    }
    
    resultados.testes.push(teste2);
    log('─'.repeat(60));
    
    // ========================================
    // TESTE 3: Auto-Config da API Key
    // ========================================
    log('\n%c🔑 TESTE 3: Auto-Config API Key', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
    if (window.aiSuggestionLayer) {
        try {
            // Forçar reload da chave
            window.aiSuggestionLayer.apiKey = null;
            
            log('🔄 Tentando auto-configurar...');
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
                log('✅ API Key auto-configurada com sucesso!', teste3.detalhes);
            } else {
                error('❌ Falha ao auto-configurar API Key');
            }
        } catch (error) {
            const teste3 = {
                nome: 'Auto-Config API Key',
                status: '❌ ERRO',
                erro: error.message
            };
            resultados.testes.push(teste3);
            error('❌ Erro ao auto-configurar:', error.message);
        }
    } else {
        resultados.testes.push({
            nome: 'Auto-Config API Key',
            status: '⚠️ PULADO',
            motivo: 'AI Layer não carregado'
        });
    }
    
    log('─'.repeat(60));
    
    // ========================================
    // TESTE 4: OpenAI Direta (Opcional)
    // ========================================
    log('\n%c🔥 TESTE 4: Validação OpenAI API', 'font-size: 16px; font-weight: bold; color: #ffd700;');
    
    if (resultados.testes[0]?.detalhes?.hasApiKey) {
        try {
            const apiKey = await fetch('/api/config').then(r => r.json()).then(d => d.openaiApiKey);
            
            log('🌐 Testando conexão com OpenAI...');
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
                log('✅ API Key OpenAI é válida!', teste4.detalhes);
            } else {
                error('❌ API Key OpenAI inválida ou expirada!', teste4.detalhes);
            }
        } catch (error) {
            const teste4 = {
                nome: 'OpenAI API Válida',
                status: '❌ ERRO',
                erro: error.message
            };
            resultados.testes.push(teste4);
            error('❌ Erro ao validar OpenAI:', error.message);
        }
    } else {
        resultados.testes.push({
            nome: 'OpenAI API Válida',
            status: '⚠️ PULADO',
            motivo: 'API Key não disponível'
        });
        warn('⚠️ Teste pulado: API Key não disponível');
    }
    
    log('─'.repeat(60));
    
    // ========================================
    // RELATÓRIO FINAL
    // ========================================
    log('\n%c📊 RELATÓRIO FINAL', 'font-size: 18px; font-weight: bold; color: #00ff00;');
    log('═'.repeat(60));
    
    const passou = resultados.testes.filter(t => t.status.includes('✅')).length;
    const falhou = resultados.testes.filter(t => t.status.includes('❌')).length;
    const pulado = resultados.testes.filter(t => t.status.includes('⚠️')).length;
    
    log(`✅ Passou: ${passou}`);
    log(`❌ Falhou: ${falhou}`);
    log(`⚠️ Pulado: ${pulado}`);
    log('');
    
    // Diagnóstico
    if (passou === resultados.testes.length) {
        log('%c🎉 TODOS OS TESTES PASSARAM!', 'font-size: 18px; font-weight: bold; color: #00ff00;');
        log('%cSistema está pronto para usar IA!', 'font-size: 14px; color: #00ff00;');
    } else {
        log('%c⚠️ ALGUNS TESTES FALHARAM', 'font-size: 18px; font-weight: bold; color: #ff6b00;');
        log('%cVerifique os erros acima e siga as correções', 'font-size: 14px; color: #ff6b00;');
        
        // Sugestões de correção
        log('\n%c🔧 SUGESTÕES DE CORREÇÃO:', 'font-size: 16px; font-weight: bold; color: #ffd700;');
        
        if (resultados.testes[0]?.status.includes('❌')) {
            log('1️⃣ Endpoint Backend falhou:');
            log('   → Verifique se OPENAI_API_KEY está configurada no Railway');
            log('   → Acesse: https://railway.app/dashboard → Variables');
        }
        
        if (resultados.testes[1]?.status.includes('⚠️')) {
            log('2️⃣ AI Layer não carregado:');
            log('   → Você está na página principal do app?');
            log('   → Faça hard refresh: Ctrl+Shift+R');
        }
        
        if (resultados.testes[2]?.status.includes('❌')) {
            log('3️⃣ Auto-Config falhou:');
            log('   → Verifique se o endpoint /api/config está retornando API Key');
            log('   → Faça hard refresh: Ctrl+Shift+R');
        }
        
        if (resultados.testes[3]?.status.includes('❌')) {
            log('4️⃣ OpenAI API inválida:');
            log('   → Verifique se a chave API é válida');
            log('   → Teste em: https://platform.openai.com/api-keys');
        }
    }
    
    log('\n═'.repeat(60));
    log('%c📋 RELATÓRIO COMPLETO:', 'font-size: 14px; font-weight: bold;');
    console.table(resultados.testes);
    
    log('\n%c💡 DICA:', 'font-size: 14px; font-weight: bold; color: #00d4ff;');
    log('Copie o objeto abaixo e envie para análise:');
    log(resultados);
    
    return resultados;
})();
