/**
 * Teste Direto - Debug do Carregamento de Referências
 * Execute este código no console do navegador
 */

console.log('🧪 TESTE DIRETO DE CARREGAMENTO - FUNK BRUXARIA');

// 1. Teste do JSON externo
const testJsonDirect = async () => {
    console.log('\n📋 1. Testando JSON externo direto...');
    try {
        const url = `/refs/out/funk_bruxaria.json?v=test_${Date.now()}`;
        console.log('🌐 URL:', url);
        
        const response = await fetch(url, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response OK:', response.ok);
        
        if (response.ok) {
            const json = await response.json();
            const data = json.funk_bruxaria;
            
            console.log('✅ JSON CARREGADO:', {
                version: data.version,
                num_tracks: data.num_tracks,
                lufs_target: data.lufs_target,
                true_peak_target: data.true_peak_target,
                brilho_band: data.bands.brilho.target_db,
                presenca_band: data.bands.presenca.target_db
            });
            
            return data;
        } else {
            console.error('❌ Fetch falhou:', response.status, response.statusText);
            return null;
        }
    } catch (error) {
        console.error('💥 Erro no fetch:', error);
        return null;
    }
};

// 2. Testar função loadReferenceData diretamente
const testLoadFunction = async () => {
    console.log('\n📋 2. Testando função loadReferenceData...');
    
    // Ativar debug
    window.DEBUG_ANALYZER = true;
    
    // Limpar cache
    window.REFS_BYPASS_CACHE = true;
    delete window.__refDataCache;
    window.__refDataCache = {};
    
    console.log('🔧 Debug ativado, cache limpo');
    
    try {
        const result = await loadReferenceData('funk_bruxaria');
        console.log('✅ loadReferenceData resultado:', {
            version: result.version,
            num_tracks: result.num_tracks,
            lufs_target: result.lufs_target,
            true_peak_target: result.true_peak_target,
            brilho_band: result.bands?.brilho?.target_db,
            presenca_band: result.bands?.presenca?.target_db
        });
        return result;
    } catch (error) {
        console.error('💥 Erro em loadReferenceData:', error);
        return null;
    }
};

// 3. Verificar estado atual
const checkCurrentState = () => {
    console.log('\n📋 3. Estado atual do sistema...');
    console.log('🏠 __activeRefData:', window.__activeRefData ? {
        version: window.__activeRefData.version,
        lufs_target: window.__activeRefData.lufs_target,
        true_peak_target: window.__activeRefData.true_peak_target,
        brilho_band: window.__activeRefData.bands?.brilho?.target_db,
        presenca_band: window.__activeRefData.bands?.presenca?.target_db
    } : 'null');
    
    console.log('🎯 __activeRefGenre:', window.__activeRefGenre);
    console.log('🔧 REFS_ALLOW_NETWORK:', window.REFS_ALLOW_NETWORK);
    console.log('💾 __refDataCache:', Object.keys(window.__refDataCache || {}));
};

// Executar todos os testes
const runFullTest = async () => {
    checkCurrentState();
    
    const external = await testJsonDirect();
    const loaded = await testLoadFunction();
    
    console.log('\n🎯 RESULTADO FINAL:');
    if (external && loaded) {
        const match = external.version === loaded.version && 
                     external.lufs_target === loaded.lufs_target;
        console.log(match ? '✅ SUCCESS: Sistema carregou dados externos!' : '❌ FAIL: Sistema ainda usa embedded');
    }
    
    // Reativar o painel
    if (loaded) {
        console.log('🔄 Recarregando painel...');
        window.location.reload();
    }
};

// Executar teste completo
runFullTest();
