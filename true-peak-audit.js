// 🔍 LEVANTAMENTO COMPLETO: Dados de True-Peak Atuais

console.log('[TRUE_PEAK_AUDIT] 🎯 Analisando dados atuais de true-peak...');

// Função para extrair dados de um arquivo de referência
function analyzeReferences(refs, fileName) {
    console.log(`\n📂 ARQUIVO: ${fileName}`);
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const [genre, data] of Object.entries(refs)) {
        const truePeakTarget = data.true_peak_target;
        const tolTruePeak = data.tol_true_peak;
        
        // Classificar target
        let status = '✅ PLAUSÍVEL';
        let issue = null;
        
        if (truePeakTarget < -3.0) {
            status = '❌ MUITO BAIXO';
            issue = `Muito conservativo (${truePeakTarget} < -3.0 dBTP)`;
        } else if (truePeakTarget > 0.0) {
            status = '⚠️ MUITO ALTO';
            issue = `Risco de clipping (${truePeakTarget} > 0.0 dBTP)`;
        } else if (truePeakTarget < -2.5) {
            status = '🟡 CONSERVATIVO';
            issue = `Conservativo mas aceitável`;
        }
        
        const result = {
            genre,
            truePeakTarget,
            tolTruePeak,
            status,
            issue,
            needsFix: truePeakTarget < -3.0 || truePeakTarget > 0.0
        };
        
        results.push(result);
        
        console.log(`🎵 ${genre}:`);
        console.log(`   Target: ${truePeakTarget} dBTP`);
        console.log(`   Tolerance: ${tolTruePeak} dB`);
        console.log(`   Status: ${status}`);
        if (issue) console.log(`   Issue: ${issue}`);
        console.log('');
    }
    
    return results;
}

// Carregar dados dos arquivos
async function loadAndAnalyze() {
    try {
        // Dados fictícios baseados nos valores encontrados no grep
        const currentRefsData = {
            'eletrofunk': { true_peak_target: -2.5, tol_true_peak: 1 },
            'funk': { true_peak_target: -0.8, tol_true_peak: 1 },
            'eletronico': { true_peak_target: -2.8, tol_true_peak: 1 },
            'rock': { true_peak_target: -4.2, tol_true_peak: 1.3 },
            'pop': { true_peak_target: -5.8, tol_true_peak: 1 },
            'classical': { true_peak_target: -11.1, tol_true_peak: 1.3 },
            'jazz': { true_peak_target: -1.2, tol_true_peak: 1 },
            'ambient': { true_peak_target: -3.2, tol_true_peak: 1 }
        };
        
        const results = analyzeReferences(currentRefsData, 'embedded-refs.js');
        
        console.log('\n🎯 RESUMO DA ANÁLISE:');
        console.log('=' .repeat(60));
        
        const needsFix = results.filter(r => r.needsFix);
        const plausible = results.filter(r => !r.needsFix);
        
        console.log(`📊 Total de gêneros: ${results.length}`);
        console.log(`✅ Plausíveis: ${plausible.length}`);
        console.log(`❌ Precisam correção: ${needsFix.length}`);
        
        if (needsFix.length > 0) {
            console.log('\n🔧 GÊNEROS QUE PRECISAM CORREÇÃO:');
            needsFix.forEach(r => {
                console.log(`   ${r.genre}: ${r.truePeakTarget} dBTP → deveria ser -1.0 dBTP`);
            });
        }
        
        console.log('\n📋 PLANO DE CORREÇÃO:');
        console.log('1. Padrão global: -1.0 dBTP');
        console.log('2. Exceção Funk: -0.8 dBTP (já correto)');
        console.log('3. Tolerância padrão: 1.0 dB');
        
        console.log('\n🛡️ VALORES PROBLEMÁTICOS ENCONTRADOS:');
        results.forEach(r => {
            if (r.truePeakTarget < -3.0) {
                console.log(`❌ ${r.genre}: ${r.truePeakTarget} dBTP (muito conservativo)`);
            }
        });
        
        return results;
        
    } catch (error) {
        console.error('[TRUE_PEAK_AUDIT] ❌ Erro:', error);
        return [];
    }
}

// Executar análise
loadAndAnalyze().then(results => {
    console.log('\n[TRUE_PEAK_AUDIT] ✅ Levantamento concluído');
    console.log(`[TRUE_PEAK_AUDIT] 📊 ${results.length} gêneros analisados`);
    
    const problemCount = results.filter(r => r.needsFix).length;
    if (problemCount > 0) {
        console.log(`[TRUE_PEAK_AUDIT] ⚠️ ${problemCount} gêneros precisam correção`);
    } else {
        console.log('[TRUE_PEAK_AUDIT] ✅ Todos os gêneros estão com valores plausíveis');
    }
});
