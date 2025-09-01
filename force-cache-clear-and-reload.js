/**
 * FORÇA LIMPEZA DE CACHE E RELOAD - Execute no console do navegador
 * Este script força a interface a recarregar os dados corretos dos JSONs
 */

console.log('🧹 INICIANDO LIMPEZA COMPLETA DE CACHE...');

// 1. Limpar todos os caches da aplicação
console.log('1️⃣ Limpando caches da aplicação...');
window.REFS_BYPASS_CACHE = true;
delete window.__refDataCache;
window.__refDataCache = {};
delete window.__activeRefData;
delete window.__activeRefGenre;
delete window.PROD_AI_REF_DATA;

// 2. Limpar storage do navegador
console.log('2️⃣ Limpando storage do navegador...');
localStorage.clear();
sessionStorage.clear();

// 3. Ativar debug para ver o que está acontecendo
console.log('3️⃣ Ativando debug...');
window.__DEBUG_ANALYZER__ = true;

// 4. Testar fetch direto do JSON para confirmar valores
console.log('4️⃣ Testando fetch direto...');
fetch("/refs/out/funk_mandela.json?v=" + Date.now(), {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
})
.then(r => r.json())
.then(data => {
    const bands = data.funk_mandela.legacy_compatibility.bands;
    console.log('✅ VALORES CORRETOS CONFIRMADOS:');
    console.log('📊 Sub:', bands.sub.target_db, 'dB (era +27.50, agora', bands.sub.target_db, ')');
    console.log('📊 Low Bass:', bands.low_bass.target_db, 'dB');
    console.log('📊 Upper Bass:', bands.upper_bass.target_db, 'dB');
    console.log('📊 Presença:', bands.presenca.target_db, 'dB');
    console.log('📊 LUFS:', data.funk_mandela.legacy_compatibility.lufs_target);
    
    console.log('\n🔄 FORÇANDO RELOAD DA PÁGINA...');
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
})
.catch(err => {
    console.error('❌ Erro no fetch:', err);
    console.log('🔄 Fazendo reload mesmo assim...');
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
});

console.log('⏳ Aguardando reload em 1 segundo...');
