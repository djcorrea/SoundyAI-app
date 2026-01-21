// 🚀 VALIDADOR DE INTEGRAÇÃO - Sistema Ultra-Avançado SoundyAI
// Este script monitora e valida se a integração foi bem-sucedida

console.log('🚀 [VALIDADOR] Iniciando validação do Sistema Ultra-Avançado...');

// Aguardar carregamento completo
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        validarIntegracao();
    }, 2000);
});

function validarIntegracao() {
    console.log('🔍 [VALIDADOR] Executando validação completa...');
    
    const resultados = {
        sistemaUltraAvancado: false,
        integracaoModal: false,
        dependenciasCarregadas: false,
        funcionamentoCompleto: false
    };
    
    // 1. Verificar se o sistema ultra-avançado está disponível
    if (typeof window.AdvancedEducationalSuggestionSystem !== 'undefined') {
        resultados.sistemaUltraAvancado = true;
        console.log('✅ [VALIDADOR] Sistema Ultra-Avançado carregado com sucesso');
        
        try {
            const testInstance = new window.AdvancedEducationalSuggestionSystem();
            console.log('✅ [VALIDADOR] Instanciação do sistema bem-sucedida');
            
            // Teste básico de funcionalidade
            const testSuggestion = [{
                type: 'surgical_eq',
                message: 'Teste de integração',
                action: 'Ação de teste'
            }];
            
            const testContext = {
                userLevel: 'intermediate',
                musicGenre: 'electronic'
            };
            
            const testResult = testInstance.generateAdvancedSuggestions(testSuggestion, testContext);
            
            if (testResult && testResult.enhancedSuggestions) {
                resultados.funcionamentoCompleto = true;
                console.log('✅ [VALIDADOR] Funcionalidade do sistema verificada');
            } else {
                console.warn('⚠️ [VALIDADOR] Sistema não retornou resultados esperados');
            }
            
        } catch (error) {
            console.error('❌ [VALIDADOR] Erro ao testar sistema:', error);
        }
    } else {
        console.error('❌ [VALIDADOR] Sistema Ultra-Avançado não encontrado');
    }
    
    // 2. Verificar dependências
    const dependencias = [
        'SuggestionScorer',
        'EnhancedSuggestionEngine', 
        'SuggestionTextGenerator'
    ];
    
    const dependenciasOK = dependencias.every(dep => {
        const disponivel = typeof window[dep] !== 'undefined';
        if (disponivel) {
            console.log(`✅ [VALIDADOR] Dependência ${dep} carregada`);
        } else {
            console.warn(`⚠️ [VALIDADOR] Dependência ${dep} não encontrada`);
        }
        return disponivel;
    });
    
    resultados.dependenciasCarregadas = dependenciasOK;
    
    // 3. Verificar se a integração no modal está ativa
    // Procurar pela função displayModalResults no audio-analyzer-integration.js
    const scripts = document.querySelectorAll('script[src*="audio-analyzer-integration"]');
    if (scripts.length > 0) {
        console.log('✅ [VALIDADOR] Script de integração do modal encontrado');
        resultados.integracaoModal = true;
    } else {
        console.warn('⚠️ [VALIDADOR] Script de integração do modal não encontrado');
    }
    
    // 4. Relatório final
    console.log('\n📊 [VALIDADOR] RELATÓRIO FINAL DE INTEGRAÇÃO:');
    console.log('=====================================');
    console.log(`Sistema Ultra-Avançado: ${resultados.sistemaUltraAvancado ? '✅ OK' : '❌ FALHA'}`);
    console.log(`Dependências: ${resultados.dependenciasCarregadas ? '✅ OK' : '❌ FALHA'}`);
    console.log(`Integração Modal: ${resultados.integracaoModal ? '✅ OK' : '❌ FALHA'}`);
    console.log(`Funcionamento: ${resultados.funcionamentoCompleto ? '✅ OK' : '❌ FALHA'}`);
    
    const todasOK = Object.values(resultados).every(r => r === true);
    
    if (todasOK) {
        console.log('\n🎉 [VALIDADOR] INTEGRAÇÃO COMPLETA E FUNCIONAL!');
        console.log('🚀 O Sistema Ultra-Avançado está pronto para uso no SoundyAI');
        
        // Marcar como pronto globalmente
        window.__ULTRA_ADVANCED_SYSTEM_READY = true;
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('ultraAdvancedSystemReady', {
            detail: { resultados }
        }));
        
    } else {
        console.error('\n❌ [VALIDADOR] INTEGRAÇÃO INCOMPLETA');
        console.error('Alguns componentes não estão funcionando corretamente');
        
        // Sugerir ações corretivas
        if (!resultados.sistemaUltraAvancado) {
            console.error('💡 Verifique se o arquivo advanced-educational-suggestion-system.js está carregado corretamente');
        }
        if (!resultados.dependenciasCarregadas) {
            console.error('💡 Verifique se todos os scripts de dependências estão carregados');
        }
    }
    
    return resultados;
}

// Função para testar integração durante análise de áudio
window.testarSistemaUltraAvancadoNaAnalise = function() {
    console.log('🎯 [VALIDADOR] Testando sistema durante análise de áudio...');
    
    if (!window.__ULTRA_ADVANCED_SYSTEM_READY) {
        console.warn('⚠️ [VALIDADOR] Sistema ainda não está marcado como pronto');
        return false;
    }
    
    // Simular dados de análise
    const mockAnalysis = {
        suggestions: [
            {
                type: 'surgical_eq',
                subtype: 'sibilance', 
                message: 'Teste de sibilância',
                action: 'Aplicar corte de teste'
            }
        ],
        lufs: -16.0,
        truePeak: -1.2,
        detectedGenre: 'electronic'
    };
    
    try {
        const ultraSystem = new window.AdvancedEducationalSuggestionSystem();
        const contextData = {
            originalAnalysis: mockAnalysis,
            userLevel: 'intermediate',
            musicGenre: 'electronic'
        };
        
        const resultado = ultraSystem.generateAdvancedSuggestions(mockAnalysis.suggestions, contextData);
        
        if (resultado && resultado.enhancedSuggestions && resultado.enhancedSuggestions.length > 0) {
            console.log('✅ [VALIDADOR] Teste durante análise: SUCESSO');
            console.log('📊 Sugestões enriquecidas:', resultado.enhancedSuggestions.length);
            return true;
        } else {
            console.error('❌ [VALIDADOR] Teste durante análise: FALHA - Sem sugestões');
            return false;
        }
        
    } catch (error) {
        console.error('❌ [VALIDADOR] Erro durante teste de análise:', error);
        return false;
    }
};

// Monitorar eventos de análise de áudio para validar automaticamente
window.addEventListener('audioAnalysisComplete', function(event) {
    console.log('🎧 [VALIDADOR] Análise de áudio detectada, validando sistema ultra-avançado...');
    setTimeout(() => {
        window.testarSistemaUltraAvancadoNaAnalise();
    }, 500);
});

console.log('🚀 [VALIDADOR] Validador de integração carregado e ativo');