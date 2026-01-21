// Script para verificar se os novos targets estão funcionando após o deploy

log('🔍 VERIFICAÇÃO FINAL - NOVOS TARGETS FUNK MANDELA');
log('='.repeat(60));

async function verificarTargetsProducao() {
    const timestamp = Date.now();
    
    // URLs para testar
    const urls = [
        `https://https://soundyai-app-production.up.railway.app/public/refs/out/funk_mandela.json?v=${timestamp}`,
        `https://https://soundyai-app-production.up.railway.app/refs/out/funk_mandela.json?v=${timestamp}`
    ];
    
    log('🌐 Testando URLs em produção...');
    
    for (const url of urls) {
        try {
            log(`\n📡 Testando: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            log(`   Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                const legacy = data.funk_mandela?.legacy_compatibility;
                
                if (legacy) {
                    log('   📊 TARGETS ENCONTRADOS:');
                    log(`      True Peak: ${legacy.true_peak_target} dBTP (esperado: -8)`);
                    log(`      Tolerância TP: ±${legacy.tol_true_peak} (esperado: 2.5)`);
                    log(`      DR: ${legacy.dr_target} (esperado: 8)`);
                    log(`      Tolerância DR: ±${legacy.tol_dr} (esperado: 1.5)`);
                    log(`      LRA: ${legacy.lra_target} (esperado: 9)`);
                    log(`      Tolerância LRA: ±${legacy.tol_lra} (esperado: 2)`);
                    log(`      Stereo: ${legacy.stereo_target} (esperado: 0.6)`);
                    log(`      Tolerância Stereo: ±${legacy.tol_stereo} (esperado: 0.15)`);
                    
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
                        log('   ✅ SUCESSO! Todos os valores estão corretos!');
                        log(`   📅 Versão: ${data.funk_mandela?.version}`);
                        log(`   🕒 Data: ${data.funk_mandela?.generated_at}`);
                        return true;
                    } else {
                        log('   ❌ Alguns valores ainda estão incorretos');
                    }
                } else {
                    log('   ❌ Seção legacy_compatibility não encontrada');
                }
            } else {
                const text = await response.text();
                log(`   📄 Resposta: ${text.substring(0, 100)}...`);
            }
        } catch (error) {
            log(`   💥 Erro: ${error.message}`);
        }
    }
    
    return false;
}

// Função para testar o sistema de análise
async function testarSistemaAnalise() {
    log('\n🧪 TESTANDO SISTEMA DE ANÁLISE...');
    
    // Verificar se a função loadReferenceData está disponível
    if (typeof window !== 'undefined' && window.loadReferenceData) {
        try {
            log('🔄 Carregando referências funk_mandela...');
            
            // Limpar cache primeiro
            if (window.__refDataCache) {
                delete window.__refDataCache['funk_mandela'];
            }
            window.REFS_BYPASS_CACHE = true;
            
            const refData = await window.loadReferenceData('funk_mandela');
            
            if (refData && refData.true_peak_target) {
                log('✅ Sistema de análise funcionando!');
                log(`   True Peak carregado: ${refData.true_peak_target} dBTP`);
                log(`   Status: ${refData.true_peak_target === -8 ? '🎯 NOVOS VALORES' : '⚠️ VALORES ANTIGOS'}`);
                return refData.true_peak_target === -8;
            } else {
                log('❌ Falha ao carregar dados de referência');
            }
        } catch (error) {
            log(`❌ Erro no sistema de análise: ${error.message}`);
        }
    } else {
        log('⚠️ Função loadReferenceData não disponível (execute no contexto da aplicação)');
    }
    
    return false;
}

// Executar verificações
async function executarVerificacaoCompleta() {
    log('🚀 Iniciando verificação completa...\n');
    
    const prodOk = await verificarTargetsProducao();
    const sistemaOk = await testarSistemaAnalise();
    
    log('\n' + '='.repeat(60));
    log('📋 RESULTADO FINAL:');
    log('='.repeat(60));
    
    if (prodOk && sistemaOk) {
        log('🎉 SUCESSO TOTAL! Novos targets funcionando em produção!');
        log('   ✅ Arquivo JSON atualizado');
        log('   ✅ Sistema de análise funcionando');
        log('   ✅ Cache limpo');
    } else if (prodOk) {
        log('🟡 PARCIAL: JSON atualizado, mas sistema pode estar com cache');
        log('   💡 Dica: Atualize a página (F5) ou aguarde alguns minutos');
    } else {
        log('🔴 PENDENTE: Aguarde o deploy completar (2-5 minutos)');
        log('   ⏳ Vercel ainda está propagando as mudanças');
    }
    
    log('\n💡 Para usar no console do navegador:');
    log('   1. Abra o DevTools (F12)');
    log('   2. Cole este código no console');
    log('   3. Execute a função: executarVerificacaoCompleta()');
}

// Auto-executar se no contexto certo
if (typeof window !== 'undefined') {
    executarVerificacaoCompleta();
} else {
    log('💡 Execute este script no console do navegador para teste completo');
}
