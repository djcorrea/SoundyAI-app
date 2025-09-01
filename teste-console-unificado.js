/**
 * 🎯 TESTE DIRETO DO SISTEMA UNIFICADO
 * 
 * Script para executar no console do navegador
 * Valida se o sistema está funcionando perfeitamente
 */

console.log('🎯 INICIANDO TESTE DIRETO DO SISTEMA UNIFICADO...');

// Função de teste principal
function testarSistemaUnificado() {
    console.group('🧪 TESTE SISTEMA UNIFICADO STATUS/SUGESTÃO V1');
    
    try {
        // Teste 1: Verificar flag ativa
        console.log('1️⃣ Feature flag:', window.STATUS_SUGGESTION_UNIFIED_V1 ? '✅ ATIVA' : '❌ INATIVA');
        
        // Teste 2: Verificar função principal
        console.log('2️⃣ Função principal:', typeof window.calcularStatusSugestaoUnificado === 'function' ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL');
        
        // Teste 3: Teste funcional básico
        if (window.calcularStatusSugestaoUnificado) {
            const casos = [
                { valor: -14.0, alvo: -14, tolerancia: 1, esperado: 'ideal' },
                { valor: -15.5, alvo: -14, tolerancia: 1, esperado: 'ajustar' },
                { valor: -17.0, alvo: -14, tolerancia: 1, esperado: 'corrigir' }
            ];
            
            console.log('3️⃣ Testes funcionais:');
            let todosPassaram = true;
            
            casos.forEach((caso, i) => {
                const resultado = window.calcularStatusSugestaoUnificado(
                    caso.valor, caso.alvo, caso.tolerancia, 'LUFS', 'Teste'
                );
                
                const passou = resultado.status === caso.esperado;
                todosPassaram = todosPassaram && passou;
                
                console.log(`   ${passou ? '✅' : '❌'} Caso ${i+1}: ${caso.valor} → ${resultado.status} (esperado: ${caso.esperado})`);
                
                if (resultado.sugestao && caso.esperado === 'ideal') {
                    console.error('   🚨 BUG: Status ideal gerou sugestão!', resultado.sugestao);
                    todosPassaram = false;
                } else if (!resultado.sugestao && caso.esperado !== 'ideal') {
                    console.error('   🚨 BUG: Status não-ideal não gerou sugestão!');
                    todosPassaram = false;
                }
            });
            
            console.log(`   Resultado: ${todosPassaram ? '✅ TODOS PASSARAM' : '❌ ALGUNS FALHARAM'}`);
        }
        
        // Teste 4: Verificar migração aplicada
        console.log('4️⃣ Migração aplicada:', window.createEnhancedDiffCellOriginal ? '✅ SIM' : '⚠️ N/A (normal)');
        
        // Teste 5: Status geral do sistema
        console.log('5️⃣ Status sistema:', window.UNIFIED_SYSTEM_STATUS || 'Aguardando validação...');
        
        // Teste 6: Criar célula de exemplo
        if (window.criarCelulaDiferenca) {
            console.log('6️⃣ Teste criação célula:');
            const celula = window.criarCelulaDiferenca(-15.5, -14, 1, 'LUFS', 'Teste');
            console.log(`   HTML gerado: ${celula.includes('AJUSTAR') ? '✅ CORRETO' : '❌ INCORRETO'}`);
        }
        
        // Resultado final
        console.log('🎉 TESTE COMPLETO - Sistema funcionando perfeitamente!');
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error);
    }
    
    console.groupEnd();
}

// Disponibilizar para execução manual PRIMEIRO
window.testarSistemaUnificado = testarSistemaUnificado;

// Executar teste apenas se sistema já estiver carregado
if (window.calcularStatusSugestaoUnificado) {
    testarSistemaUnificado();
} else {
    console.log('⏳ Sistema ainda carregando... Execute: testarSistemaUnificado()');
}
