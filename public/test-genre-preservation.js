// 🧪 TESTE AUTOMATIZADO: Preservação de Gênero
// Verifica se o gênero selecionado é preservado durante todo o fluxo

async function testGenrePreservation() {
    console.group('🧪 TESTE: Preservação de Gênero');
    
    // Setup
    const testGenre = 'funk_bh';
    let passed = 0;
    let failed = 0;
    
    try {
        // 1. Simular seleção de gênero
        log('1️⃣ Simulando seleção de gênero...');
        if (typeof applyGenreSelection !== 'function') {
            throw new Error('applyGenreSelection não encontrado');
        }
        
        await applyGenreSelection(testGenre);
        
        // Verificar se targets foram carregados
        if (!window.__activeRefData) {
            failed++;
            error('❌ FALHA: Targets não foram carregados');
        } else {
            passed++;
            log('✅ PASSOU: Targets carregados');
        }
        
        // Verificar se gênero foi salvo
        if (window.PROD_AI_REF_GENRE !== testGenre) {
            failed++;
            error('❌ FALHA: Gênero não foi salvo', {
                esperado: testGenre,
                recebido: window.PROD_AI_REF_GENRE
            });
        } else {
            passed++;
            log('✅ PASSOU: Gênero salvo corretamente');
        }
        
        // 2. Simular abertura do modal de análise
        log('2️⃣ Simulando abertura do modal...');
        
        const genreBefore = window.PROD_AI_REF_GENRE;
        const targetsBefore = window.__activeRefData;
        
        // Chamar a função que causa o bug
        openAnalysisModalForGenre();
        
        // Aguardar DOM renderizar
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 3. Verificar se gênero foi preservado
        const genreAfter = window.PROD_AI_REF_GENRE;
        const targetsAfter = window.__activeRefData;
        
        if (genreAfter !== genreBefore) {
            failed++;
            error('❌ FALHA: Gênero foi perdido após abrir modal', {
                antes: genreBefore,
                depois: genreAfter
            });
        } else {
            passed++;
            log('✅ PASSOU: Gênero preservado após modal');
        }
        
        if (!targetsAfter || targetsAfter !== targetsBefore) {
            failed++;
            error('❌ FALHA: Targets foram perdidos após abrir modal');
        } else {
            passed++;
            log('✅ PASSOU: Targets preservados após modal');
        }
        
        // 4. Verificar dropdown (se existir)
        const dropdown = document.getElementById('audioRefGenreSelect');
        if (dropdown) {
            if (dropdown.value !== testGenre) {
                failed++;
                error('❌ FALHA: Dropdown não tem gênero correto', {
                    esperado: testGenre,
                    recebido: dropdown.value
                });
            } else {
                passed++;
                log('✅ PASSOU: Dropdown com gênero correto');
            }
        } else {
            warn('⚠️ AVISO: Dropdown não encontrado (pode ser normal)');
        }
        
        // 5. Verificar contexto protegido (se implementado)
        if (window.GENRE_CONTEXT) {
            const context = window.GENRE_CONTEXT.get();
            if (context.genre !== testGenre) {
                failed++;
                error('❌ FALHA: GENRE_CONTEXT perdido', {
                    esperado: testGenre,
                    recebido: context.genre
                });
            } else {
                passed++;
                log('✅ PASSOU: GENRE_CONTEXT preservado');
            }
        }
        
    } catch (error) {
        failed++;
        error('❌ ERRO NO TESTE:', error);
    }
    
    // Resultado
    log('\n📊 RESULTADO:');
    log(`✅ Passou: ${passed}`);
    log(`❌ Falhou: ${failed}`);
    log(`📈 Taxa de sucesso: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        log('%c🎉 TODOS OS TESTES PASSARAM!', 'color:#00FF88;font-weight:bold;font-size:16px;');
    } else {
        log('%c⚠️ ALGUNS TESTES FALHARAM', 'color:#FF6B6B;font-weight:bold;font-size:16px;');
    }
    
    console.groupEnd();
    
    return { passed, failed, total: passed + failed };
}

// Expor globalmente
window.testGenrePreservation = testGenrePreservation;

// Auto-executar se em modo de teste
if (window.location.search.includes('test=genre')) {
    window.addEventListener('load', () => {
        setTimeout(testGenrePreservation, 2000);
    });
}

log('✅ Teste de preservação de gênero carregado');
log('   Execute: testGenrePreservation()');
