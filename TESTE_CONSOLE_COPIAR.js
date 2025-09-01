/* 
🎯 COLE ESTE SCRIPT INTEIRO NO CONSOLE DO NAVEGADOR
Vai testar o sistema unificado e mostrar se está funcionando
*/

console.clear();
console.log('🎯 TESTE DIRETO - SISTEMA UNIFICADO STATUS/SUGESTÃO V1');
console.log('================================================');

// Verificação básica
console.log('1️⃣ Feature Flag:', window.STATUS_SUGGESTION_UNIFIED_V1 ? '✅ ATIVA' : '❌ INATIVA');
console.log('2️⃣ Função Principal:', typeof window.calcularStatusSugestaoUnificado === 'function' ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL');

// Se não estiver carregado, tentar carregar
if (!window.calcularStatusSugestaoUnificado) {
    console.log('⏳ Sistema não carregado. Tentando carregar...');
    
    // Carregar scripts manualmente
    const scripts = [
        '/status-suggestion-unified-v1.js',
        '/status-migration-v1.js', 
        '/force-unified-activation.js'
    ];
    
    let scriptsCarregados = 0;
    
    scripts.forEach(src => {
        const script = document.createElement('script');
        script.src = src + '?v=' + Date.now();
        script.onload = () => {
            scriptsCarregados++;
            console.log(`✅ Carregado: ${src}`);
            
            if (scriptsCarregados === scripts.length) {
                console.log('🎉 Todos os scripts carregados! Testando em 1 segundo...');
                setTimeout(executarTeste, 1000);
            }
        };
        script.onerror = () => {
            console.error(`❌ Erro ao carregar: ${src}`);
        };
        document.head.appendChild(script);
    });
} else {
    executarTeste();
}

function executarTeste() {
    console.log('\n🧪 EXECUTANDO TESTES FUNCIONAIS...');
    
    if (!window.calcularStatusSugestaoUnificado) {
        console.error('❌ Função principal ainda não disponível');
        return;
    }
    
    // Casos de teste
    const casos = [
        { valor: -14.0, alvo: -14, tolerancia: 1, esperado: 'ideal', desc: 'Valor ideal' },
        { valor: -15.0, alvo: -14, tolerancia: 1, esperado: 'ideal', desc: 'Limite da tolerância' },
        { valor: -15.5, alvo: -14, tolerancia: 1, esperado: 'ajustar', desc: 'Precisa ajustar' },
        { valor: -16.0, alvo: -14, tolerancia: 1, esperado: 'ajustar', desc: 'Limite 2x tolerância' },
        { valor: -17.0, alvo: -14, tolerancia: 1, esperado: 'corrigir', desc: 'Precisa corrigir' }
    ];
    
    let passou = 0;
    let falhou = 0;
    
    casos.forEach((caso, i) => {
        const resultado = window.calcularStatusSugestaoUnificado(
            caso.valor, caso.alvo, caso.tolerancia, 'LUFS', 'Teste'
        );
        
        const correto = resultado.status === caso.esperado;
        if (correto) passou++; else falhou++;
        
        console.log(`${correto ? '✅' : '❌'} Teste ${i+1}: ${caso.desc}`);
        console.log(`   ${caso.valor}LUFS → ${resultado.status} (esperado: ${caso.esperado})`);
        
        // Verificar bug de sugestão em ideal
        if (resultado.status === 'ideal' && resultado.sugestao !== null) {
            console.error('   🚨 BUG CRÍTICO: Status ideal gerou sugestão!');
            falhou++;
        } else if (resultado.status === 'ideal') {
            console.log('   ✅ Status ideal sem sugestão (correto)');
        }
        
        // Mostrar sugestão se existe
        if (resultado.sugestao) {
            console.log(`   💡 Sugestão: ${resultado.sugestao.texto}`);
        }
        
        console.log('   ──────────────────');
    });
    
    console.log('\n🎯 RESULTADO FINAL:');
    console.log(`✅ Passou: ${passou}`);
    console.log(`❌ Falhou: ${falhou}`);
    
    if (falhou === 0) {
        console.log('🎉 SISTEMA UNIFICADO FUNCIONANDO PERFEITAMENTE! 🚀');
        console.log('✨ Todos os testes passaram, sistema pronto para uso!');
    } else {
        console.log('⚠️ Sistema com problemas - alguns testes falharam');
    }
    
    // Teste de célula HTML
    if (window.criarCelulaDiferenca) {
        console.log('\n🎨 TESTE CRIAÇÃO DE CÉLULA HTML:');
        const celula = window.criarCelulaDiferenca(-15.5, -14, 1, 'LUFS', 'Teste Visual');
        console.log('HTML gerado:', celula.includes('AJUSTAR') ? '✅ CORRETO' : '❌ INCORRETO');
    }
    
    console.log('\n🎯 Sistema testado com sucesso!');
}
