// Script para forçar atualização dos targets em produção
// Adiciona cache-busting dinâmico para garantir que os novos valores sejam carregados

// 1. Limpar todos os caches
if (typeof window !== 'undefined') {
    // Limpar cache interno
    window.__refDataCache = {};
    window.REFS_BYPASS_CACHE = true;
    
    // Forçar recarregamento de referências
    console.log('🔄 Forçando atualização de cache...');
    
    // Adicionar timestamp único para quebrar cache
    const timestamp = Date.now();
    window.CACHE_BUST_TIMESTAMP = timestamp;
    
    console.log('✅ Cache limpo, timestamp:', timestamp);
}

// 2. Função para testar carregamento direto
async function testarCarregamentoNovosTargets() {
    console.log('🧪 TESTE: Carregamento direto dos novos targets');
    
    const urls = [
        `/public/refs/out/funk_mandela.json?v=${Date.now()}`,
        `/refs/out/funk_mandela.json?v=${Date.now()}`
    ];
    
    for (const url of urls) {
        try {
            console.log(`📡 Testando: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const truePeak = data.funk_mandela?.legacy_compatibility?.true_peak_target;
                const versao = data.funk_mandela?.version;
                
                console.log(`✅ ${url}:`);
                console.log(`   True Peak: ${truePeak}`);
                console.log(`   Versão: ${versao}`);
                console.log(`   Status: ${truePeak === -8 ? '🎯 NOVOS VALORES' : '⚠️ VALORES ANTIGOS'}`);
                
                if (truePeak === -8) {
                    console.log('🎉 SUCESSO! Encontrados novos targets!');
                    return data;
                }
            } else {
                console.log(`❌ ${url}: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`💥 ${url}: ${error.message}`);
        }
    }
    
    return null;
}

// 3. Executar teste
testarCarregamentoNovosTargets().then(resultado => {
    if (resultado) {
        console.log('✅ Novos targets encontrados e carregados!');
        
        // Forçar refresh da página para aplicar
        if (typeof window !== 'undefined' && window.loadReferenceData) {
            console.log('🔄 Recarregando referências...');
            window.loadReferenceData('funk_mandela').then(() => {
                console.log('🎯 Referências atualizadas!');
            });
        }
    } else {
        console.log('⚠️ Novos targets ainda não disponíveis. Aguarde alguns minutos.');
    }
}).catch(console.error);

console.log('💡 Para usar este script:');
console.log('1. Abra o console do navegador (F12)');
console.log('2. Cole este código');
console.log('3. Pressione Enter');
console.log('4. Verifique os logs para confirmação');
