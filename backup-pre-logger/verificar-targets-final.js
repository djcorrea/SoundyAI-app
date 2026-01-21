// Script para verificar se os novos targets estão funcionando após o deploy

console.log('🔍 VERIFICAÇÃO FINAL - NOVOS TARGETS FUNK MANDELA');
console.log('='.repeat(60));

async function verificarTargetsProducao() {
    const timestamp = Date.now();
    
    // URLs para testar
    const urls = [
        `https://https://soundyai-app-production.up.railway.app/public/refs/out/funk_mandela.json?v=${timestamp}`,
        `https://https://soundyai-app-production.up.railway.app/refs/out/funk_mandela.json?v=${timestamp}`
    ];
    
    console.log('🌐 Testando URLs em produção...');
    
    for (const url of urls) {
        try {
            console.log(`\n📡 Testando: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            console.log(`   Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                const legacy = data.funk_mandela?.legacy_compatibility;
                
                if (legacy) {
                    console.log('   📊 TARGETS ENCONTRADOS:');
                    console.log(`      True Peak: ${legacy.true_peak_target} dBTP (esperado: -8)`);
                    console.log(`      Tolerância TP: ±${legacy.tol_true_peak} (esperado: 2.5)`);
                    console.log(`      DR: ${legacy.dr_target} (esperado: 8)`);
                    console.log(`      Tolerância DR: ±${legacy.tol_dr} (esperado: 1.5)`);
                    console.log(`      LRA: ${legacy.lra_target} (esperado: 9)`);
                    console.log(`      Tolerância LRA: ±${legacy.tol_lra} (esperado: 2)`);
                    console.log(`      Stereo: ${legacy.stereo_target} (esperado: 0.6)`);
                    console.log(`      Tolerância Stereo: ±${legacy.tol_stereo} (esperado: 0.15)`);
                    
                    // Verificar se são os valores corretos
                    const valoresCorretos = 
                        legacy.true_peak_target === -8 &&
                        legacy.tol_true_peak === 2.5 &&
                        legacy.dr_target === 8 &&
                        legacy.tol_dr === 1.5 &&
                        legacy.lra_target === 9 &&
                        legacy.tol_lra === 2 &&
                        legacy.stereo_target === 0.6 &&
                        legacy.tol_stereo === 0.15;
                    
                    if (valoresCorretos) {
                        console.log('   ✅ SUCESSO! Todos os valores estão corretos!');
                        console.log(`   📅 Versão: ${data.funk_mandela?.version}`);
                        console.log(`   🕒 Data: ${data.funk_mandela?.generated_at}`);
                        return true;
                    } else {
                        console.log('   ❌ Alguns valores ainda estão incorretos');
                    }
                } else {
                    console.log('   ❌ Seção legacy_compatibility não encontrada');
                }
            } else {
                const text = await response.text();
                console.log(`   📄 Resposta: ${text.substring(0, 100)}...`);
            }
        } catch (error) {
            console.log(`   💥 Erro: ${error.message}`);
        }
    }
    
    return false;
}

// Função para testar o sistema de análise
async function testarSistemaAnalise() {
    console.log('\n🧪 TESTANDO SISTEMA DE ANÁLISE...');
    
    // Verificar se a função loadReferenceData está disponível
    if (typeof window !== 'undefined' && window.loadReferenceData) {
        try {
            console.log('🔄 Carregando referências funk_mandela...');
            
            // Limpar cache primeiro
            if (window.__refDataCache) {
                delete window.__refDataCache['funk_mandela'];
            }
            window.REFS_BYPASS_CACHE = true;
            
            const refData = await window.loadReferenceData('funk_mandela');
            
            if (refData && refData.true_peak_target) {
                console.log('✅ Sistema de análise funcionando!');
                console.log(`   True Peak carregado: ${refData.true_peak_target} dBTP`);
                console.log(`   Status: ${refData.true_peak_target === -8 ? '🎯 NOVOS VALORES' : '⚠️ VALORES ANTIGOS'}`);
                return refData.true_peak_target === -8;
            } else {
                console.log('❌ Falha ao carregar dados de referência');
            }
        } catch (error) {
            console.log(`❌ Erro no sistema de análise: ${error.message}`);
        }
    } else {
        console.log('⚠️ Função loadReferenceData não disponível (execute no contexto da aplicação)');
    }
    
    return false;
}

// Executar verificações
async function executarVerificacaoCompleta() {
    console.log('🚀 Iniciando verificação completa...\n');
    
    const prodOk = await verificarTargetsProducao();
    const sistemaOk = await testarSistemaAnalise();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESULTADO FINAL:');
    console.log('='.repeat(60));
    
    if (prodOk && sistemaOk) {
        console.log('🎉 SUCESSO TOTAL! Novos targets funcionando em produção!');
        console.log('   ✅ Arquivo JSON atualizado');
        console.log('   ✅ Sistema de análise funcionando');
        console.log('   ✅ Cache limpo');
    } else if (prodOk) {
        console.log('🟡 PARCIAL: JSON atualizado, mas sistema pode estar com cache');
        console.log('   💡 Dica: Atualize a página (F5) ou aguarde alguns minutos');
    } else {
        console.log('🔴 PENDENTE: Aguarde o deploy completar (2-5 minutos)');
        console.log('   ⏳ Vercel ainda está propagando as mudanças');
    }
    
    console.log('\n💡 Para usar no console do navegador:');
    console.log('   1. Abra o DevTools (F12)');
    console.log('   2. Cole este código no console');
    console.log('   3. Execute a função: executarVerificacaoCompleta()');
}

// Auto-executar se no contexto certo
if (typeof window !== 'undefined') {
    executarVerificacaoCompleta();
} else {
    console.log('💡 Execute este script no console do navegador para teste completo');
}
