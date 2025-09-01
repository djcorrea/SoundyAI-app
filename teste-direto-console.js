// 🎯 TESTE DIRETO - COPIE E COLE NO CONSOLE
// Funciona independente do carregamento dos arquivos

(function() {
    console.log('🎯 TESTE DIRETO DO SISTEMA UNIFICADO - INICIANDO...');
    
    // Verificar se sistema está carregado
    console.log('1️⃣ Feature Flag:', window.STATUS_SUGGESTION_UNIFIED_V1 ? '✅ ATIVA' : '❌ INATIVA');
    console.log('2️⃣ Função Principal:', typeof window.calcularStatusSugestaoUnificado === 'function' ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL');
    console.log('3️⃣ Migração:', typeof window.createEnhancedDiffCellMigrado === 'function' ? '✅ CARREGADA' : '❌ NÃO CARREGADA');
    console.log('4️⃣ Validador:', typeof window.validateUnifiedSystem === 'function' ? '✅ DISPONÍVEL' : '❌ NÃO DISPONÍVEL');
    
    // Se sistema não carregou, mostrar diagnóstico
    if (!window.calcularStatusSugestaoUnificado) {
        console.group('🔍 DIAGNÓSTICO DE CARREGAMENTO');
        
        // Verificar se arquivos foram carregados
        const scripts = Array.from(document.querySelectorAll('script[src*="status-suggestion"]'));
        console.log('Scripts encontrados:', scripts.length);
        scripts.forEach(script => {
            console.log('  -', script.src, script.loaded ? 'CARREGADO' : 'PENDENTE');
        });
        
        // Tentar carregar manualmente
        console.log('🔄 Tentando carregar sistema...');
        
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src + '?v=' + Date.now();
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };
        
        // Carregar arquivos em sequência
        loadScript('/status-suggestion-unified-v1.js')
            .then(() => loadScript('/status-migration-v1.js'))
            .then(() => loadScript('/force-unified-activation.js'))
            .then(() => {
                console.log('✅ Arquivos carregados! Execute novamente: testarSistemaUnificado()');
                
                // Ativar sistema manualmente
                window.STATUS_SUGGESTION_UNIFIED_V1 = true;
                if (window.applyUnifiedSystemPatches) {
                    window.applyUnifiedSystemPatches();
                }
                
                // Testar agora
                setTimeout(() => {
                    if (window.calcularStatusSugestaoUnificado) {
                        console.log('🎉 SISTEMA CARREGADO E FUNCIONANDO!');
                        testarFuncionalidade();
                    }
                }, 100);
            })
            .catch(err => {
                console.error('❌ Erro ao carregar:', err);
                console.log('💡 Solução: Recarregue a página');
            });
        
        console.groupEnd();
        return;
    }
    
    // Sistema carregado, executar testes
    testarFuncionalidade();
    
    function testarFuncionalidade() {
        console.group('🧪 TESTES FUNCIONAIS');
        
        const casos = [
            { valor: -14.0, alvo: -14, tolerancia: 1, esperado: 'ideal' },
            { valor: -15.5, alvo: -14, tolerancia: 1, esperado: 'ajustar' }, 
            { valor: -17.0, alvo: -14, tolerancia: 1, esperado: 'corrigir' }
        ];
        
        let todosPassaram = true;
        
        casos.forEach((caso, i) => {
            const resultado = window.calcularStatusSugestaoUnificado(
                caso.valor, caso.alvo, caso.tolerancia, 'LUFS', 'Teste'
            );
            
            const passou = resultado.status === caso.esperado;
            todosPassaram = todosPassaram && passou;
            
            console.log(`${passou ? '✅' : '❌'} Caso ${i+1}: ${caso.valor}LUFS → ${resultado.status} (esperado: ${caso.esperado})`);
            
            // Verificar bug de sugestão em ideal
            if (resultado.status === 'ideal' && resultado.sugestao !== null) {
                console.error('   🚨 BUG: Status ideal gerou sugestão!');
                todosPassaram = false;
            }
            
            // Mostrar sugestão se existe
            if (resultado.sugestao) {
                console.log(`   💡 Sugestão: ${resultado.sugestao.texto}`);
            }
        });
        
        console.log(`\n🎯 RESULTADO FINAL: ${todosPassaram ? '✅ TODOS OS TESTES PASSARAM!' : '❌ ALGUNS TESTES FALHARAM'}`);
        
        // Teste de performance
        const inicio = performance.now();
        for (let i = 0; i < 1000; i++) {
            window.calcularStatusSugestaoUnificado(-14 + Math.random() * 10, -14, 1);
        }
        const fim = performance.now();
        const tempo = ((fim - inicio) / 1000).toFixed(3);
        console.log(`⚡ Performance: ${tempo}ms por 1000 chamadas (${(parseFloat(tempo)).toFixed(6)}ms/chamada)`);
        
        console.groupEnd();
        
        if (todosPassaram) {
            console.log('🎉 SISTEMA UNIFICADO FUNCIONANDO PERFEITAMENTE! 🚀');
        } else {
            console.log('⚠️ Sistema com problemas - verificar implementação');
        }
    }
    
})();
