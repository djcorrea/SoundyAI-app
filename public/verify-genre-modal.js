// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// 🧪 TESTE DE VERIFICAÇÃO: Modal de Gênero Musical
// Este arquivo verifica se a implementação está conforme especificado

(function() {
    log('🧪 [VERIFICAÇÃO] Iniciando testes do Modal de Gênero Musical...');
    
    // ✅ TESTE 1: Verificar se o HTML foi adicionado
    function testModalHTMLExists() {
        const modal = document.getElementById('newGenreModal');
        if (modal) {
            log('✅ [VERIFICAÇÃO] Modal HTML encontrado');
            return true;
        } else {
            error('❌ [VERIFICAÇÃO] Modal HTML não encontrado');
            return false;
        }
    }
    
    // ✅ TESTE 2: Verificar se as funções existem
    function testFunctionsExist() {
        const functions = ['openGenreModal', 'closeGenreModal', 'applyGenreSelection'];
        let allFound = true;
        
        functions.forEach(func => {
            if (typeof window[func] === 'function') {
                log(`✅ [VERIFICAÇÃO] Função ${func} encontrada`);
            } else {
                error(`❌ [VERIFICAÇÃO] Função ${func} não encontrada`);
                allFound = false;
            }
        });
        
        return allFound;
    }
    
    // ✅ TESTE 3: Verificar feature flag
    function testFeatureFlag() {
        if (typeof window.FEATURE_NEW_GENRE_MODAL !== 'undefined') {
            log(`✅ [VERIFICAÇÃO] Feature flag definida: ${window.FEATURE_NEW_GENRE_MODAL}`);
            return true;
        } else {
            error('❌ [VERIFICAÇÃO] Feature flag não definida');
            return false;
        }
    }
    
    // ✅ TESTE 4: Verificar se os gêneros estão corretos
    function testGenreButtons() {
        const modal = document.getElementById('newGenreModal');
        if (!modal) return false;
        
        const expectedGenres = [
            'funk_mandela', 'funk_automotivo', 'eletronico', 
            'trance', 'funk_bruxaria', 'trap', 'eletrofunk'
        ];
        
        const genreCards = modal.querySelectorAll('.genre-card');
        let allGenresFound = true;
        
        expectedGenres.forEach(genre => {
            const card = modal.querySelector(`[data-genre="${genre}"]`);
            if (card) {
                log(`✅ [VERIFICAÇÃO] Gênero ${genre} encontrado`);
            } else {
                error(`❌ [VERIFICAÇÃO] Gênero ${genre} não encontrado`);
                allGenresFound = false;
            }
        });
        
        log(`📊 [VERIFICAÇÃO] Total de gêneros encontrados: ${genreCards.length}`);
        return allGenresFound;
    }
    
    // ✅ TESTE 5: Verificar integração com applyGenreSelection
    function testApplyGenreIntegration() {
        if (typeof window.applyGenreSelection === 'function') {
            log('✅ [VERIFICAÇÃO] applyGenreSelection está disponível');
            
            // Verificar se mantém a assinatura original
            const originalFunction = window.applyGenreSelection.toString();
            if (originalFunction.includes('genre')) {
                log('✅ [VERIFICAÇÃO] applyGenreSelection aceita parâmetro genre');
                return true;
            } else {
                warn('⚠️ [VERIFICAÇÃO] applyGenreSelection pode ter assinatura alterada');
                return false;
            }
        } else {
            error('❌ [VERIFICAÇÃO] applyGenreSelection não encontrada');
            return false;
        }
    }
    
    // 🎯 EXECUTAR TODOS OS TESTES
    function runAllTests() {
        log('🧪 [VERIFICAÇÃO] Executando bateria de testes...');
        
        const results = {
            modalHTML: testModalHTMLExists(),
            functions: testFunctionsExist(),
            featureFlag: testFeatureFlag(),
            genreButtons: testGenreButtons(),
            applyGenreIntegration: testApplyGenreIntegration()
        };
        
        const passed = Object.values(results).filter(Boolean).length;
        const total = Object.keys(results).length;
        
        log(`📊 [VERIFICAÇÃO] Resultados: ${passed}/${total} testes passaram`);
        
        if (passed === total) {
            log('🎉 [VERIFICAÇÃO] TODOS OS TESTES PASSARAM! Modal implementado corretamente');
        } else {
            warn('⚠️ [VERIFICAÇÃO] Alguns testes falharam. Verifique os logs acima');
        }
        
        return results;
    }
    
    // ✅ TESTE FUNCIONAL: Simular clique em gênero
    function testGenreClick(genreName = 'funk_mandela') {
        log(`🎯 [VERIFICAÇÃO] Testando clique no gênero: ${genreName}`);
        
        const modal = document.getElementById('newGenreModal');
        if (!modal) {
            error('❌ [VERIFICAÇÃO] Modal não encontrado para teste de clique');
            return false;
        }
        
        const genreCard = modal.querySelector(`[data-genre="${genreName}"]`);
        if (!genreCard) {
            error(`❌ [VERIFICAÇÃO] Card do gênero ${genreName} não encontrado`);
            return false;
        }
        
        try {
            // Simular clique
            genreCard.click();
            log(`✅ [VERIFICAÇÃO] Clique simulado no gênero ${genreName}`);
            
            // Verificar se modal fechou
            setTimeout(() => {
                if (modal.classList.contains('hidden')) {
                    log('✅ [VERIFICAÇÃO] Modal fechou após clique');
                } else {
                    warn('⚠️ [VERIFICAÇÃO] Modal não fechou após clique');
                }
            }, 100);
            
            return true;
        } catch (error) {
            error('❌ [VERIFICAÇÃO] Erro ao simular clique:', error);
            return false;
        }
    }
    
    // Expor funções para testes manuais
    window.genreModalTests = {
        runAllTests,
        testGenreClick,
        testModalHTMLExists,
        testFunctionsExist,
        testFeatureFlag,
        testGenreButtons,
        testApplyGenreIntegration
    };
    
    // Executar testes automaticamente quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runAllTests, 1000); // Aguardar scripts carregarem
        });
    } else {
        setTimeout(runAllTests, 1000);
    }
    
    log('🧪 [VERIFICAÇÃO] Sistema de testes carregado. Use window.genreModalTests para testes manuais');
})();