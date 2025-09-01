/**
 * Teste de Validação - Correção de Referências Funk Bruxaria
 * Execute no console do navegador após carregar a página
 */

console.log('🎯 INICIANDO VALIDAÇÃO DE REFERÊNCIAS FUNK BRUXARIA');

// 1. Teste direto do JSON publicado
const testExternalJson = async () => {
    try {
        const response = await fetch('/refs/out/funk_bruxaria.json?v=test' + Date.now());
        const json = await response.json();
        const data = json.funk_bruxaria;
        
        console.log('✅ JSON EXTERNO (public/refs/out/funk_bruxaria.json):', {
            version: data.version,
            num_tracks: data.num_tracks,
            lufs_target: data.lufs_target,
            true_peak_target: data.true_peak_target,
            stereo_target: data.stereo_target,
            sub_band: data.bands.sub.target_db,
            presenca_band: data.bands.presenca.target_db
        });
        
        // Validações
        const isCorrect = data.version === '1.0.1' && 
                         data.num_tracks === 29 && 
                         data.lufs_target === -14 && 
                         data.true_peak_target === -10.6 &&
                         data.bands.sub.target_db === -12.5;
        
        console.log(isCorrect ? '✅ JSON VÁLIDO!' : '❌ JSON com valores incorretos!');
        return data;
    } catch (error) {
        console.error('❌ ERRO ao carregar JSON externo:', error);
        return null;
    }
};

// 2. Teste da função de carregamento do sistema
const testSystemLoad = async () => {
    try {
        // Limpar cache forçadamente
        window.REFS_BYPASS_CACHE = true;
        
        // Força reload das referências
        const refData = await loadReferenceData('funk_bruxaria');
        
        console.log('✅ SISTEMA CARREGOU:', {
            version: refData.version,
            num_tracks: refData.num_tracks,
            lufs_target: refData.lufs_target,
            true_peak_target: refData.true_peak_target,
            stereo_target: refData.stereo_target,
            sub_band: refData.bands?.sub?.target_db,
            presenca_band: refData.bands?.presenca?.target_db
        });
        
        // Reset flag
        window.REFS_BYPASS_CACHE = false;
        return refData;
    } catch (error) {
        console.error('❌ ERRO no sistema de carregamento:', error);
        return null;
    }
};

// 3. Executar testes
const runValidation = async () => {
    console.log('\n📋 1. Testando JSON externo...');
    const externalData = await testExternalJson();
    
    console.log('\n📋 2. Testando carregamento do sistema...');
    const systemData = await testSystemLoad();
    
    console.log('\n📋 3. Usando função de diagnóstico...');
    if (typeof window.diagnosRefSources === 'function') {
        window.diagnosRefSources('funk_bruxaria');
    }
    
    // Resultado final
    console.log('\n🎯 RELATÓRIO FINAL:');
    if (externalData && systemData) {
        const match = externalData.version === systemData.version &&
                     externalData.lufs_target === systemData.lufs_target &&
                     externalData.true_peak_target === systemData.true_peak_target;
        
        console.log(match ? '✅ CORREÇÃO APLICADA COM SUCESSO!' : '❌ Sistema ainda usando dados incorretos');
        console.log({
            source: match ? 'external' : 'embedded/fallback',
            path: '/refs/out/funk_bruxaria.json',
            version: systemData.version,
            num_tracks: systemData.num_tracks,
            lufs_target: systemData.lufs_target,
            true_peak_target: systemData.true_peak_target,
            stereo_target: systemData.stereo_target
        });
    }
};

// Executar validação
runValidation();
