/**
 * COMANDO RÁPIDO PARA CORRIGIR FUNK BRUXARIA
 * Cole no console do navegador e execute
 */

console.log('🚀 CORRIGINDO FUNK BRUXARIA - FORÇANDO EXTERNAL REFS');

// Ativar debug
window.DEBUG_ANALYZER = true;

// Limpar tudo
delete window.__refDataCache;
window.__refDataCache = {};
window.REFS_BYPASS_CACHE = true;
window.__activeRefData = null;
window.__activeRefGenre = null;
delete window.PROD_AI_REF_DATA;

console.log('💥 Cache limpo, forçando recarga...');

// Forçar recarga
loadReferenceData('funk_bruxaria').then(result => {
    console.log('✅ RECARGA CONCLUÍDA:', {
        version: result.version,
        num_tracks: result.num_tracks,
        lufs_target: result.lufs_target,
        true_peak_target: result.true_peak_target,
        stereo_target: result.stereo_target,
        brilho_band: result.bands?.brilho?.target_db,
        presenca_band: result.bands?.presenca?.target_db
    });
    
    if (result.lufs_target === -14 && result.true_peak_target === -10.6) {
        console.log('🎉 SUCCESS! Valores corretos carregados');
        console.log('🔄 Recarregue a página para ver no painel');
    } else {
        console.error('❌ FAIL! Ainda carregando valores antigos:', {
            expected_lufs: -14,
            got_lufs: result.lufs_target,
            expected_tp: -10.6,
            got_tp: result.true_peak_target
        });
    }
    
    window.REFS_BYPASS_CACHE = false;
}).catch(error => {
    console.error('💥 ERRO:', error);
    window.REFS_BYPASS_CACHE = false;
});
