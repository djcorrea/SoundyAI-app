/**
 * 🧪 TESTE DO HOOK DE AUDITORIA
 * 
 * Este teste verifica se o hook de auditoria está capturando 
 * corretamente os parâmetros do método processAnalysis
 */

// Mock do ambiente browser
global.window = {};
global.console = console;

// Importar o enhanced-suggestion-engine
require('./public/enhanced-suggestion-engine.js');

// Dados de teste
const testAnalysis = {
    lufs_integrated: -12.5,
    true_peak_dbtp: -0.8,
    dynamic_range: 8.2,
    lra: 3.1,
    stereo_correlation: 0.88,
    spectral_bands: {
        sub: { energy_db: -18.5 },
        bass: { energy_db: -16.2 },
        lowMid: { energy_db: -15.8 },
        mid: { energy_db: -14.5 },
        highMid: { energy_db: -17.9 },
        presence: { energy_db: -21.2 },
        air: { energy_db: -24.8 }
    }
};

const testRefData = {
    "rock": {
        "hybrid_processing": {
            "original_metrics": {
                "lufs_integrated": -10.0,
                "true_peak_dbtp": -1.0,
                "dynamic_range": 9.5,
                "lra": 4.2,
                "stereo_correlation": 0.92
            },
            "spectral_bands": {
                "sub": { "target_db": -19.0, "tol_db": 2.5 },
                "low_bass": { "target_db": -17.5, "tol_db": 2.2 },
                "low_mid": { "target_db": -16.8, "tol_db": 2.0 },
                "mid": { "target_db": -15.2, "tol_db": 1.8 },
                "high_mid": { "target_db": -18.5, "tol_db": 2.3 },
                "presenca": { "target_db": -22.1, "tol_db": 2.8 },
                "brilho": { "target_db": -25.8, "tol_db": 3.0 }
            }
        }
    }
};

console.log('🧪 TESTE DO HOOK DE AUDITORIA');
console.log('============================================================\n');

// Verificar se o hook foi instalado
console.log('🔍 Verificando se hook está ativo...');
if (typeof window.__DEBUG_ANALYSIS__ === 'undefined' && 
    typeof window.__DEBUG_REF__ === 'undefined') {
    console.log('✅ Hook não executado ainda (esperado)');
} else {
    console.log('⚠️ Variáveis de debug já existem');
}

// Executar processAnalysis para testar o hook
console.log('\n📞 Chamando processAnalysis...');
try {
    const engine = window.enhancedSuggestionEngine;
    const result = engine.processAnalysis(testAnalysis, testRefData);
    
    console.log('\n✅ processAnalysis executado com sucesso');
    console.log('📊 Resultado:', result?.length || 0, 'sugestões geradas');
    
} catch (error) {
    console.log('\n❌ Erro ao executar processAnalysis:', error.message);
}

// Verificar se o hook capturou os dados
console.log('\n🔍 Verificando captura do hook...');

if (window.__DEBUG_ANALYSIS__) {
    console.log('✅ window.__DEBUG_ANALYSIS__ capturado:');
    console.log('   • LUFS:', window.__DEBUG_ANALYSIS__.lufs_integrated);
    console.log('   • True Peak:', window.__DEBUG_ANALYSIS__.true_peak_dbtp);
    console.log('   • Dynamic Range:', window.__DEBUG_ANALYSIS__.dynamic_range);
    console.log('   • Bandas:', Object.keys(window.__DEBUG_ANALYSIS__.spectral_bands || {}));
} else {
    console.log('❌ window.__DEBUG_ANALYSIS__ não foi capturado');
}

if (window.__DEBUG_REF__) {
    console.log('✅ window.__DEBUG_REF__ capturado:');
    console.log('   • Estrutura:', Object.keys(window.__DEBUG_REF__));
    console.log('   • Primeiro gênero:', Object.keys(window.__DEBUG_REF__)[0]);
} else {
    console.log('❌ window.__DEBUG_REF__ não foi capturado');
}

if (window.__DEBUG_OPTIONS__) {
    console.log('✅ window.__DEBUG_OPTIONS__ capturado:', window.__DEBUG_OPTIONS__);
} else {
    console.log('⚠️ window.__DEBUG_OPTIONS__ não foi capturado (pode ser undefined se não foram passadas options)');
}

console.log('\n🏁 TESTE CONCLUÍDO!');
console.log('============================================================');

// Testar acesso aos dados capturados
console.log('\n🔬 TESTE DE INSPEÇÃO DOS DADOS CAPTURADOS:');
if (window.__DEBUG_ANALYSIS__ && window.__DEBUG_REF__) {
    console.log('📊 Análise capturada tem', Object.keys(window.__DEBUG_ANALYSIS__).length, 'propriedades');
    console.log('📚 Referência capturada tem', Object.keys(window.__DEBUG_REF__).length, 'gêneros');
    console.log('✅ Hook funcionando perfeitamente - dados disponíveis para inspeção!');
} else {
    console.log('❌ Hook não capturou dados corretamente');
}