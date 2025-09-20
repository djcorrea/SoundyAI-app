// 🧪 TESTE RÁPIDO DO SISTEMA CORRIGIDO

// Simular dados de teste do Funk Mandela
const testAnalysis = {
    technicalData: {
        lufsIntegrated: -7.56,        // vs -7.80 ±2.50 → OK
        truePeakDbtp: 0.30,           // vs -1.00 → +1.30 excesso (CRÍTICO)
        dynamicRange: 12.69,          // vs 7.80 ±1.50 → +4.89 (CRÍTICO)
        volumeConsistencyLU: 14.09,   // vs 2.50 ±1.50 → +11.59 (CRÍTICO)
        stereoCorrelation: 0.65,      // vs 0.85 ±0.25 → -0.20 (OK)
        bandEnergies: [
            { rms_db: -12.3, energy_percentage: 32.5 }, // sub
            { rms_db: -15.7, energy_percentage: 28.8 }, // bass
            { rms_db: -19.5, energy_percentage: 11.0 }, // upper_bass
            { rms_db: -16.7, energy_percentage: 14.4 }, // low_mid
            { rms_db: -15.9, energy_percentage: 17.4 }, // mid
            { rms_db: -20.9, energy_percentage: 7.3 }   // high_mid
        ]
    }
};

// Simular referência Funk Mandela
const testReference = {
    funk_mandela: {
        legacy_compatibility: {
            lufs_target: -7.8,
            true_peak_target: -1.0,
            dr_target: 7.8,
            stereo_target: 0.85,
            tol_lufs: 2.5,
            tol_true_peak: 1.0,
            tol_dr: 1.5,
            tol_stereo: 0.25,
            bands: {
                sub: { target_db: -17.3, tol_db: 3.0 },
                bass: { target_db: -17.7, tol_db: 3.0 },
                upper_bass: { target_db: -21.5, tol_db: 3.0 },
                low_mid: { target_db: -18.7, tol_db: 2.5 },
                mid: { target_db: -17.9, tol_db: 2.5 },
                high_mid: { target_db: -22.9, tol_db: 2.5 }
            }
        }
    }
};

// Carregar e testar o sistema
async function testarSistemaCorrigido() {
    try {
        // Carregar sistema
        const response = await fetch('public/suggestion-system-unified.js');
        const systemCode = await response.text();
        eval(systemCode);
        
        if (!window.suggestionSystem) {
            console.error('❌ Sistema não carregado');
            return;
        }
        
        console.log('✅ Sistema carregado com sucesso');
        
        // Testar processamento
        const startTime = performance.now();
        const result = window.suggestionSystem.process(testAnalysis, testReference);
        const endTime = performance.now();
        
        console.log('🎯 RESULTADOS DO TESTE:');
        console.log(`⏱️ Tempo de processamento: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`📊 Sugestões geradas: ${result.suggestions.length}`);
        
        // Verificar critérios de aceite
        console.log('\n📋 VERIFICAÇÃO DOS CRITÉRIOS:');
        
        // 1. DR deve estar correto
        const drSuggestion = result.suggestions.find(s => s.metric === 'dr');
        if (drSuggestion) {
            const expectedDelta = 12.69 - 7.8; // +4.89
            const deltaCorrect = Math.abs(drSuggestion.delta - expectedDelta) < 0.1;
            console.log(`✅ DR Delta: ${drSuggestion.delta.toFixed(2)} (esperado: +4.89) - ${deltaCorrect ? 'CORRETO' : 'INCORRETO'}`);
            console.log(`✅ DR Direção: ${drSuggestion.direction} (esperado: reduce) - ${drSuggestion.direction === 'reduce' ? 'CORRETO' : 'INCORRETO'}`);
            console.log(`✅ DR Severidade: ${drSuggestion.severity.level} (z=${drSuggestion.z_score.toFixed(2)})`);
        }
        
        // 2. True Peak deve estar correto
        const tpSuggestion = result.suggestions.find(s => s.metric === 'true_peak');
        if (tpSuggestion) {
            const expectedDelta = 0.30 - (-1.0); // +1.30
            const deltaCorrect = Math.abs(tpSuggestion.delta - expectedDelta) < 0.1;
            console.log(`✅ True Peak Delta: ${tpSuggestion.delta.toFixed(2)} (esperado: +1.30) - ${deltaCorrect ? 'CORRETO' : 'INCORRETO'}`);
            console.log(`✅ True Peak Direção: ${tpSuggestion.direction} (esperado: reduce) - ${tpSuggestion.direction === 'reduce' ? 'CORRETO' : 'INCORRETO'}`);
        }
        
        // 3. LUFS deve estar OK (verde)
        const lufsSuggestion = result.suggestions.find(s => s.metric === 'lufs');
        const lufsOK = !lufsSuggestion; // Não deve gerar sugestão se estiver OK
        console.log(`✅ LUFS dentro da tolerância: ${lufsOK ? 'CORRETO (sem sugestão)' : 'INCORRETO (gerou sugestão)'}`);
        
        // 4. Verificar bandas
        const bandSuggestions = result.suggestions.filter(s => s.metric.startsWith('band:'));
        console.log(`✅ Bandas processadas: ${bandSuggestions.length} sugestões`);
        
        // 5. Verificar textos educativos
        const hasEducationalTexts = result.suggestions.every(s => 
            s.title && s.explanation && s.solution &&
            s.title.length > 5 && s.explanation.length > 20 && s.solution.length > 20
        );
        console.log(`✅ Textos educativos: ${hasEducationalTexts ? 'COMPLETOS' : 'INCOMPLETOS'}`);
        
        // 6. Verificar severidade por cores
        const hasSeverity = result.suggestions.every(s => 
            s.severity && s.z_score && 
            ['green', 'yellow', 'orange', 'red'].includes(s.severity.level)
        );
        console.log(`✅ Severidade por cores: ${hasSeverity ? 'IMPLEMENTADA' : 'FALTANDO'}`);
        
        // Mostrar todas as sugestões
        console.log('\n📝 TODAS AS SUGESTÕES:');
        result.suggestions.forEach((s, i) => {
            console.log(`${i+1}. [${s.severity.level.toUpperCase()}] ${s.title}`);
            console.log(`   📊 ${s.measured} → ${s.target} (Δ: ${s.delta > 0 ? '+' : ''}${s.delta.toFixed(2)} ${s.unit})`);
            console.log(`   💡 ${s.explanation}`);
            console.log(`   🔧 ${s.solution}`);
            console.log('');
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Executar teste se estiver no Node.js
if (typeof require !== 'undefined') {
    testarSistemaCorrigido();
}

// Exportar para uso em HTML
if (typeof window !== 'undefined') {
    window.testarSistemaCorrigido = testarSistemaCorrigido;
}