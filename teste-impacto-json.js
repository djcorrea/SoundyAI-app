// 🔍 TESTE DE IMPACTO - Mudanças no funk_mandela.json
// Este script verifica se alterações no JSON realmente afetam o cálculo de score

console.group('🧪 TESTE DE IMPACTO DO JSON');

// 1. Verificar se dados de referência foram carregados
console.log('1️⃣ Verificando carregamento de dados...');
console.log('   window.PROD_AI_REF_DATA:', !!window.PROD_AI_REF_DATA);
console.log('   __activeRefData disponível:', typeof __activeRefData !== 'undefined');

if (window.PROD_AI_REF_DATA) {
    console.log('✅ Dados de referência carregados');
    console.log('   LUFS target:', window.PROD_AI_REF_DATA.lufs_target);
    console.log('   LUFS tolerance:', window.PROD_AI_REF_DATA.tol_lufs);
    
    if (window.PROD_AI_REF_DATA.bands && window.PROD_AI_REF_DATA.bands.mid) {
        console.log('   Mid target:', window.PROD_AI_REF_DATA.bands.mid.target_db);
        console.log('   Mid tolerance:', window.PROD_AI_REF_DATA.bands.mid.tol_db);
    }
} else {
    console.log('❌ Dados de referência não carregados');
}

// 2. Testar função calculateMetricScore diretamente
console.log('\n2️⃣ Testando calculateMetricScore...');

if (typeof window.calculateMetricScore === 'function') {
    console.log('✅ calculateMetricScore disponível');
    
    // Teste com valores baseados no JSON atual
    // JSON tem: mid.target_db: -23, tol_db: 2.5
    const testCases = [
        { value: -23.0, name: 'Exato no target (-23.0)' },
        { value: -25.5, name: 'Na borda da tolerância (-23 - 2.5)' },
        { value: -20.5, name: 'Na outra borda da tolerância (-23 + 2.5)' },
        { value: -28.0, name: 'Fora da tolerância (-28.0)' },
        { value: -31.3, name: 'Caso do usuário (-31.3)' }  // Valor mencionado pelo usuário
    ];
    
    console.log('   Testando com target: -23, tolerance: 2.5');
    
    testCases.forEach(testCase => {
        const score = window.calculateMetricScore(
            testCase.value,
            -23,      // target do JSON
            2.5,      // tolerance do JSON
            'mid',
            { yellowMin: 70, bufferFactor: 1.5 }
        );
        
        const distance = Math.abs(testCase.value - (-23));
        const withinTolerance = distance <= 2.5;
        
        console.log(`   ${testCase.name}: Score ${score}/100 ${withinTolerance ? '🟢' : '🔴'}`);
    });
    
} else {
    console.log('❌ calculateMetricScore não disponível');
}

// 3. Testar computeMixScore se disponível
console.log('\n3️⃣ Testando computeMixScore...');

if (typeof window.computeMixScore === 'function' && window.PROD_AI_REF_DATA) {
    console.log('✅ computeMixScore disponível');
    
    // Mock de dados técnicos para teste
    const mockTechnicalData = {
        lufsIntegrated: -10.5,  // Perto do LUFS target
        truePeakDbtp: -1.2,
        dr: 8.0,
        lra: 2.8,
        stereoCorrelation: 0.8,
        // Bandas espectrais
        spectralBands: {
            mid: { energy_db: -31.3 }  // Valor mencionado pelo usuário
        }
    };
    
    console.log('   Testando com dados mock...');
    const result = window.computeMixScore(mockTechnicalData, window.PROD_AI_REF_DATA);
    console.log('   Resultado:', result);
    console.log('   Score final:', result?.scorePct);
    
} else {
    console.log('❌ computeMixScore não disponível ou sem dados de referência');
}

// 4. Verificar se alterações no JSON seriam detectadas
console.log('\n4️⃣ Simulando alteração no JSON...');

if (window.PROD_AI_REF_DATA) {
    console.log('   Valores atuais:');
    console.log('   - LUFS target:', window.PROD_AI_REF_DATA.lufs_target);
    console.log('   - Mid target:', window.PROD_AI_REF_DATA.bands?.mid?.target_db);
    
    console.log('\n   💡 Para testar impacto de mudanças:');
    console.log('   1. Altere o funk_mandela.json');
    console.log('   2. Execute: window.REFS_BYPASS_CACHE = true');
    console.log('   3. Recarregue a página ou force reload das refs');
    console.log('   4. Execute este teste novamente');
}

console.groupEnd();

// Função helper para re-executar teste
window.testJsonImpact = function() {
    // Limpar dados e forçar recarga
    if (typeof loadReferenceData === 'function') {
        window.REFS_BYPASS_CACHE = true;
        loadReferenceData('funk_mandela').then(() => {
            console.log('🔄 Dados recarregados, executando novo teste...');
            // Re-executar o teste (copiar o código acima)
        });
    } else {
        console.log('❌ loadReferenceData não disponível');
    }
};

console.log('💡 Execute window.testJsonImpact() para testar após alterações no JSON');