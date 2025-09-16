// 🔍 AUDITORIA COMPLETA - Sistema de Bandas Espectrais
// Identificar problemas de mapeamento entre cálculos e referências

console.log('🔍 ===== AUDITORIA: Sistema de Bandas Espectrais =====');

// 1. VERIFICAR ESTRUTURA DOS DADOS DE REFERÊNCIA
const verificarEstruturadeReferencia = async () => {
    console.log('\n📋 1. VERIFICANDO ESTRUTURA DE REFERÊNCIA...');
    
    try {
        // Carregar arquivo de referência Funk Mandela
        const response = await fetch('./refs/funk_mandela.json');
        const refData = await response.json();
        
        console.log('✅ Arquivo carregado:', Object.keys(refData));
        
        const funkData = refData.funk_mandela;
        console.log('🎯 Estrutura:', Object.keys(funkData));
        
        // Verificar se existe legacy_compatibility.bands
        if (funkData.legacy_compatibility?.bands) {
            console.log('✅ legacy_compatibility.bands encontrado');
            console.log('🎵 Bandas disponíveis:', Object.keys(funkData.legacy_compatibility.bands));
            
            // Mostrar estrutura de cada banda
            Object.entries(funkData.legacy_compatibility.bands).forEach(([band, data]) => {
                console.log(`  ${band}:`, {
                    target_db: data.target_db,
                    tol_db: data.tol_db,
                    energy_pct: data.energy_pct
                });
            });
        } else {
            console.error('❌ legacy_compatibility.bands NÃO encontrado');
        }
        
        // Verificar hybrid_processing.spectral_bands
        if (funkData.hybrid_processing?.spectral_bands) {
            console.log('✅ hybrid_processing.spectral_bands encontrado');
            console.log('🎵 Bandas espectrais:', Object.keys(funkData.hybrid_processing.spectral_bands));
        }
        
        return funkData;
        
    } catch (error) {
        console.error('❌ Erro ao carregar referência:', error);
        return null;
    }
};

// 2. VERIFICAR MAPEAMENTO DE NOMES
const verificarMapeamentoNomes = () => {
    console.log('\n🗺️ 2. VERIFICANDO MAPEAMENTO DE NOMES...');
    
    // Nomes usados no cálculo (analysis.metrics.bands)
    const nomesCalculados = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    
    // Nomes usados na referência
    const nomesReferencia = ['sub', 'low_bass', 'upper_bass', 'low_mid', 'mid', 'high_mid', 'brilho', 'presenca'];
    
    console.log('📊 Nomes no cálculo:', nomesCalculados);
    console.log('📋 Nomes na referência:', nomesReferencia);
    
    // Verificar inconsistências
    const mapeamentoAtual = {
        sub: 'sub',                 // ✅ Match
        bass: 'low_bass',          // ⚠️ Diferente
        lowMid: 'low_mid',         // ⚠️ Camel vs Snake
        mid: 'mid',                // ✅ Match
        highMid: 'high_mid',       // ⚠️ Camel vs Snake
        presence: 'presenca',      // ⚠️ Diferente
        air: 'brilho'              // ⚠️ Totalmente diferente
    };
    
    console.log('🔄 Mapeamento necessário:', mapeamentoAtual);
    
    return mapeamentoAtual;
};

// 3. SIMULAR CARREGAMENTO DE DADOS
const simularAnalysisData = () => {
    console.log('\n🧪 3. SIMULANDO DADOS DE ANÁLISE...');
    
    // Simular estrutura típica de analysis.metrics.bands
    const simulatedBands = {
        sub: { energy_db: -18.5 },
        bass: { energy_db: -16.2 },
        lowMid: { energy_db: -19.8 },
        mid: { energy_db: -15.1 },
        highMid: { energy_db: -23.4 },
        presence: { energy_db: -28.9 },
        air: { energy_db: -31.2 }
    };
    
    console.log('📊 Bandas simuladas (cálculo):', simulatedBands);
    
    return simulatedBands;
};

// 4. TESTAR MAPEAMENTO ATUAL
const testarMapeamentoAtual = (refData, simulatedBands) => {
    console.log('\n🧬 4. TESTANDO MAPEAMENTO ATUAL...');
    
    if (!refData?.legacy_compatibility?.bands) {
        console.error('❌ Dados de referência não encontrados');
        return;
    }
    
    const refBands = refData.legacy_compatibility.bands;
    const mapeamento = {
        sub: 'sub',
        bass: 'low_bass',
        lowMid: 'low_mid',
        mid: 'mid',
        highMid: 'high_mid',
        presence: 'presenca',
        air: 'brilho'
    };
    
    console.log('🔄 Testando mapeamento...');
    
    Object.entries(simulatedBands).forEach(([calcBand, calcData]) => {
        const refBandKey = mapeamento[calcBand];
        const refBandData = refBands[refBandKey];
        
        if (refBandData) {
            const difference = calcData.energy_db - refBandData.target_db;
            const withinTolerance = Math.abs(difference) <= refBandData.tol_db;
            
            console.log(`  ${calcBand} → ${refBandKey}:`);
            console.log(`    Calculado: ${calcData.energy_db}dB`);
            console.log(`    Target: ${refBandData.target_db}dB`);
            console.log(`    Diferença: ${difference.toFixed(2)}dB`);
            console.log(`    Status: ${withinTolerance ? '✅ OK' : '⚠️ Fora da tolerância'}`);
        } else {
            console.error(`  ❌ ${calcBand} → ${refBandKey}: Referência não encontrada`);
        }
    });
};

// 5. EXECUTAR AUDITORIA COMPLETA
const executarAuditoriaCompleta = async () => {
    console.log('🚀 Iniciando auditoria completa...');
    
    const refData = await verificarEstruturadeReferencia();
    const mapeamento = verificarMapeamentoNomes();
    const simulatedBands = simularAnalysisData();
    
    if (refData) {
        testarMapeamentoAtual(refData, simulatedBands);
    }
    
    console.log('\n📝 RESUMO DA AUDITORIA:');
    console.log('1. ✅ Estrutura de referência verificada');
    console.log('2. ⚠️ Inconsistências de nomeação identificadas');
    console.log('3. ✅ Simulação de dados realizada');
    console.log('4. 🔄 Mapeamento testado');
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('- Normalizar nomes das bandas (camelCase vs snake_case)');
    console.log('- Ajustar função de mapeamento no renderReferenceComparisons');
    console.log('- Adicionar logs de debug para identificar dados em tempo real');
    console.log('- Garantir que todas as 7 bandas apareçam na UI');
};

// Executar quando a página carregar
if (typeof window !== 'undefined') {
    window.addEventListener('load', executarAuditoriaCompleta);
    
    // Também disponibilizar função global para testes manuais
    window.auditoriaBandas = executarAuditoriaCompleta;
}

// Para Node.js ou ambiente de teste
if (typeof module !== 'undefined') {
    module.exports = {
        verificarEstruturadeReferencia,
        verificarMapeamentoNomes,
        simularAnalysisData,
        testarMapeamentoAtual,
        executarAuditoriaCompleta
    };
}