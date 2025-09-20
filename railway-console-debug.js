// 🚀 SCRIPT DE DEBUG DIRETO PARA RAILWAY - SoundyAI
// Cole este código no console do navegador na Railway para debug imediato

console.log('🚀 Iniciando debug SoundyAI na Railway...');

// 🎯 Dados de teste
const debugAnalysis = {
    metadata: {
        filename: "railway-console-test.wav",
        duration: 180.5,
        sampleRate: 48000,
        channels: 2
    },
    technicalData: {
        lufsIntegrated: -13.2,
        truePeakDbtp: -1.1,
        dynamicRange: 7.5,
        lra: 5.8,
        stereoWidth: 0.78,
        frequencyAnalysis: {
            subbass: 0.68,
            bass: 0.81,
            lowMid: 0.83,
            mid: 0.89,
            highMid: 0.71,
            presenca: 0.64,
            brilho: 0.76
        }
    }
};

const debugReference = {
    "lufs_target": -14.0,
    "lufs_tolerance": 1.0,
    "true_peak_target": -1.0,
    "true_peak_tolerance": 0.5,
    "dr_target": 8.0,
    "dr_tolerance": 2.0,
    "lra_target": 6.0,
    "lra_tolerance": 2.0,
    "stereo_target": 0.8,
    "stereo_tolerance": 0.15,
    "bands": {
        "subbass": { "target": 0.7, "tolerance": 0.1 },
        "bass": { "target": 0.8, "tolerance": 0.1 },
        "lowMid": { "target": 0.85, "tolerance": 0.1 },
        "mid": { "target": 0.9, "tolerance": 0.1 },
        "highMid": { "target": 0.75, "tolerance": 0.1 },
        "presenca": { "target": 0.7, "tolerance": 0.1 },
        "brilho": { "target": 0.8, "tolerance": 0.1 }
    }
};

// 🔍 Função de debug completo
function debugSuggestionsSystem() {
    console.group('🎯 DEBUG SISTEMA DE SUGESTÕES');
    
    try {
        // Verificar dependências
        console.log('📦 Verificando dependências...');
        if (typeof SuggestionScorer === 'undefined') {
            console.error('❌ SuggestionScorer não encontrado');
            return false;
        }
        if (typeof EnhancedSuggestionEngine === 'undefined') {
            console.error('❌ EnhancedSuggestionEngine não encontrado');
            return false;
        }
        console.log('✅ Dependências OK');
        
        // Inicializar engine
        console.log('⚙️ Inicializando engine...');
        const engine = new EnhancedSuggestionEngine({
            maxSuggestions: 10,
            enableHeuristics: true
        });
        console.log('✅ Engine inicializado');
        
        // Processar
        console.log('🎵 Processando análise...');
        const result = engine.processAnalysis(debugAnalysis, debugReference);
        
        // Resultado
        console.log('📊 RESULTADO:');
        console.log(`Sugestões geradas: ${result.suggestions?.length || 0}`);
        console.log(`Tempo processamento: ${result.enhancedMetrics?.processingTimeMs || 0}ms`);
        console.log(`Confiança: ${result.enhancedMetrics?.confidence || 0}`);
        
        // Logs de auditoria
        if (result.auditLog && result.auditLog.length > 0) {
            console.group('📋 LOGS DE AUDITORIA:');
            result.auditLog.forEach(log => {
                const style = log.type.includes('ERROR') ? 'color: red' : 
                             log.type.includes('SUCCESS') ? 'color: green' : 
                             'color: blue';
                console.log(`%c[${log.type}] ${log.message}`, style);
                if (log.data) console.log(log.data);
            });
            console.groupEnd();
        }
        
        // Salvar para debug posterior
        window.__RAILWAY_DEBUG_RESULT = result;
        window.__RAILWAY_DEBUG_ENGINE = engine;
        
        console.log('💾 Resultado salvo em window.__RAILWAY_DEBUG_RESULT');
        console.log('🔧 Engine salvo em window.__RAILWAY_DEBUG_ENGINE');
        
        return result;
        
    } catch (error) {
        console.error('💥 ERRO:', error);
        return null;
    } finally {
        console.groupEnd();
    }
}

// 🔍 Função para testar só extração
function debugExtractionOnly() {
    console.group('⚙️ DEBUG EXTRAÇÃO DE MÉTRICAS');
    
    try {
        const engine = new EnhancedSuggestionEngine();
        
        console.log('📊 Testando normalização...');
        const normalized = engine.normalizeReferenceData(debugReference);
        console.log('Normalizado:', normalized);
        
        console.log('🔍 Testando extração...');
        const metrics = engine.extractMetrics(debugAnalysis, normalized);
        console.log('Métricas extraídas:', metrics);
        console.log(`Total de métricas: ${Object.keys(metrics).length}`);
        
        if (Object.keys(metrics).length === 0) {
            console.error('❌ NENHUMA MÉTRICA EXTRAÍDA!');
            console.log('🔍 Estrutura dos dados de entrada:');
            console.log('Analysis.technicalData:', debugAnalysis.technicalData);
        } else {
            console.log('✅ Métricas extraídas com sucesso');
        }
        
        return metrics;
        
    } catch (error) {
        console.error('💥 ERRO na extração:', error);
        return null;
    } finally {
        console.groupEnd();
    }
}

// 🎯 Executar debug automático
console.log('🎯 Executando debug automático...');
const debugResult = debugSuggestionsSystem();

if (debugResult && debugResult.suggestions && debugResult.suggestions.length === 0) {
    console.log('🔍 Sugestões vazias - executando debug de extração...');
    debugExtractionOnly();
}

// 🛠️ Helpers globais
window.debugSuggestions = debugSuggestionsSystem;
window.debugExtraction = debugExtractionOnly;
window.testSuggestions = function(analysis = debugAnalysis, reference = debugReference) {
    const engine = new EnhancedSuggestionEngine();
    return engine.processAnalysis(analysis, reference);
};

console.log('🚀 Debug concluído! Use as funções:');
console.log('  debugSuggestions() - teste completo');
console.log('  debugExtraction() - só extração');
console.log('  testSuggestions() - teste customizado');