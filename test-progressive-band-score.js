// 🧪 TESTE RÁPIDO - SCORE PROGRESSIVO PARA BANDAS
// Validação das mudanças implementadas

console.log('🧪 Testando Score Progressivo para Bandas...');

// Simular dados de teste
const testData = {
    metrics: {
        // Métricas globais (devem permanecer inalteradas)
        lufsIntegrated: -14.5,
        truePeakDbtp: -0.8,
        dynamicRange: 8.5,
        lra: 6.5,
        stereoCorrelation: 0.4,
        
        // Bandas espectrais para testar progressividade
        bandEnergies: {
            sub: { rms_db: -15.0 },      // 2 dB de diferença
            bass: { rms_db: -10.0 },     // 4 dB de diferença  
            mid: { rms_db: -8.0 },       // 6 dB de diferença
            high_mid: { rms_db: -12.0 }, // No alvo
            air: { rms_db: -18.0 }       // 8 dB de diferença (na borda da tolerância)
        }
    }
};

const testReference = {
    lufs_target: -14,
    tol_lufs: 2,
    true_peak_target: -1,
    tol_true_peak: 1,
    dr_target: 8,
    tol_dr: 2,
    
    bands: {
        sub: { target_db: -17.0, tol_db: 10 },      // Tolerância ampliada aplicada
        bass: { target_db: -14.0, tol_db: 5 },      // Original menor que ampliada (9), deve usar 9
        mid: { target_db: -14.0, tol_db: 7 },       // Igual à ampliada
        high_mid: { target_db: -12.0, tol_db: 6 },  // Igual à ampliada  
        air: { target_db: -10.0, tol_db: 12 }       // Original maior, deve preservar 12
    }
};

// Ativar debug para ver logs
if (typeof window !== 'undefined') {
    window.DEBUG_PROGRESSIVE_SCORE = true;
}

console.log('📊 Cenários de teste:');
console.log('  sub: -15 vs -17 ±10 → diff=2dB, esperado ~80-90%');
console.log('  bass: -10 vs -14 ±9 → diff=4dB, esperado ~55-65%');  
console.log('  mid: -8 vs -14 ±7 → diff=6dB, esperado ~15-25%');
console.log('  high_mid: -12 vs -12 ±6 → diff=0dB, esperado 100%');
console.log('  air: -18 vs -10 ±12 → diff=8dB, esperado ~30-40%');

try {
    // Testar se as funções existem
    if (typeof computeMixScore === 'function') {
        console.log('✅ computeMixScore encontrado');
        
        const result = computeMixScore(testData.metrics, testReference);
        
        console.log('\n📈 RESULTADO DO TESTE:');
        console.log(`Score final: ${result.scorePct}%`);
        console.log(`Classificação: ${result.classification}`);
        console.log(`Método: ${result.method}`);
        
        // Verificar se bandas estão sendo processadas
        if (result.perMetric) {
            const bandMetrics = result.perMetric.filter(m => m.key.startsWith('band_'));
            console.log(`\n🎵 Bandas processadas: ${bandMetrics.length}`);
            
            bandMetrics.forEach(m => {
                console.log(`  ${m.key}: ${m.value.toFixed(1)} vs ${m.target.toFixed(1)} ±${m.tol.toFixed(1)} → ${m.scorePct.toFixed(1)}% (${m.status})`);
            });
        }
        
        // Verificar se métricas globais não mudaram
        const globalMetrics = result.perMetric ? result.perMetric.filter(m => !m.key.startsWith('band_')) : [];
        console.log(`\n🌍 Métricas globais: ${globalMetrics.length} (devem ter comportamento inalterado)`);
        
    } else {
        console.error('❌ computeMixScore não disponível - carregue o arquivo scoring.js primeiro');
    }
    
} catch (error) {
    console.error('❌ Erro no teste:', error);
}

// Desativar debug
if (typeof window !== 'undefined') {
    window.DEBUG_PROGRESSIVE_SCORE = false;
}

console.log('\n🎯 Para rollback: PROGRESSIVE_BAND_SCORE = false');