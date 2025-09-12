/**
 * 🔍 AUDITORIA COMPLETA: Descobrir onde está o problema com as métricas
 * 
 * Este script verifica:
 * 1. Se as métricas estão sendo calculadas
 * 2. Se estão chegando na UI
 * 3. Se as funções getMetric estão funcionando
 * 4. Se há problemas na passagem de dados
 */

console.log('🔍 [AUDITORIA] Iniciando auditoria completa das métricas...');

// 1. VERIFICAR SE BACKEND ESTÁ ATIVO
async function verificarBackend() {
    console.log('🔍 [BACKEND] Verificando se backend está respondendo...');
    
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('✅ [BACKEND] Backend respondendo:', data);
        return true;
    } catch (error) {
        console.error('❌ [BACKEND] Backend não responde:', error);
        return false;
    }
}

// 2. VERIFICAR ANÁLISE ATUAL
function verificarAnaliseAtual() {
    console.log('🔍 [ANÁLISE] Verificando currentModalAnalysis...');
    
    if (!window.currentModalAnalysis) {
        console.warn('⚠️ [ANÁLISE] currentModalAnalysis é null/undefined');
        return null;
    }
    
    console.log('✅ [ANÁLISE] currentModalAnalysis existe:', typeof window.currentModalAnalysis);
    
    // Verificar estrutura
    const analysis = window.currentModalAnalysis;
    console.log('🔍 [ANÁLISE] Chaves principais:', Object.keys(analysis || {}));
    
    if (analysis.technicalData) {
        console.log('🔍 [ANÁLISE] technicalData chaves:', Object.keys(analysis.technicalData));
        
        // Verificar métricas específicas
        const metricas = ['lufsIntegrated', 'truePeakDbtp', 'peak', 'rms', 'dynamicRange', 'stereoCorrelation'];
        
        metricas.forEach(metrica => {
            const valor = analysis.technicalData[metrica];
            console.log(`🔍 [MÉTRICA] ${metrica}:`, valor, typeof valor, Number.isFinite(valor));
        });
    } else {
        console.warn('⚠️ [ANÁLISE] technicalData não existe');
    }
    
    if (analysis.metrics) {
        console.log('🔍 [ANÁLISE] metrics centralizadas:', Object.keys(analysis.metrics));
    }
    
    return analysis;
}

// 3. VERIFICAR FUNÇÃO getMetric
function verificarGetMetric() {
    console.log('🔍 [GETMETRIC] Verificando função getMetric...');
    
    // Simular contexto da UI para testar getMetric
    const analysis = window.currentModalAnalysis;
    if (!analysis) {
        console.warn('⚠️ [GETMETRIC] Sem análise para testar');
        return;
    }
    
    // Função getMetric copiada do código original
    const getMetric = (metricPath, fallbackPath = null) => {
        const getNestedValue = (obj, path) => {
            return path.split('.').reduce((current, key) => current?.[key], obj);
        };
        
        // Prioridade: metrics centralizadas > technicalData legado > fallback
        const centralizedValue = analysis.metrics && getNestedValue(analysis.metrics, metricPath);
        if (Number.isFinite(centralizedValue)) {
            console.log(`✅ [GETMETRIC] ${metricPath} = ${centralizedValue} (centralizada)`);
            return centralizedValue;
        }
        
        // Fallback para technicalData legado
        const legacyValue = fallbackPath ? getNestedValue(analysis.technicalData, fallbackPath) : getNestedValue(analysis.technicalData, metricPath);
        if (Number.isFinite(legacyValue)) {
            console.log(`✅ [GETMETRIC] ${metricPath} = ${legacyValue} (legacy)`);
            return legacyValue;
        }
        
        console.warn(`⚠️ [GETMETRIC] ${metricPath} não encontrado ou inválido`);
        return null;
    };
    
    // Testar métricas principais
    const metricasTest = [
        ['lufs_integrated', 'lufsIntegrated'],
        ['truePeakDbtp', 'truePeakDbtp'],
        ['peak_db', 'peak'],
        ['rms_level', 'rmsLevel'],
        ['dynamic_range', 'dynamicRange'],
        ['stereo_correlation', 'stereoCorrelation']
    ];
    
    metricasTest.forEach(([path, fallback]) => {
        getMetric(path, fallback);
    });
}

// 4. VERIFICAR AUDIOANALYZER
function verificarAudioAnalyzer() {
    console.log('🔍 [ANALYZER] Verificando window.audioAnalyzer...');
    
    if (!window.audioAnalyzer) {
        console.error('❌ [ANALYZER] window.audioAnalyzer não existe');
        return false;
    }
    
    console.log('✅ [ANALYZER] window.audioAnalyzer existe');
    console.log('🔍 [ANALYZER] Métodos:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.audioAnalyzer)));
    
    return true;
}

// 5. VERIFICAR V2
function verificarV2() {
    console.log('🔍 [V2] Verificando AudioAnalyzerV2...');
    
    if (typeof window.AudioAnalyzerV2 !== 'function') {
        console.warn('⚠️ [V2] AudioAnalyzerV2 não carregado');
        return false;
    }
    
    console.log('✅ [V2] AudioAnalyzerV2 disponível');
    
    try {
        const v2 = new window.AudioAnalyzerV2();
        console.log('✅ [V2] Instância criada com sucesso');
        console.log('🔍 [V2] Build version:', v2.__buildVersion);
        return true;
    } catch (error) {
        console.error('❌ [V2] Erro ao criar instância:', error);
        return false;
    }
}

// 6. VERIFICAR CACHE
function verificarCache() {
    console.log('🔍 [CACHE] Verificando cache de análises...');
    
    const cache = window.__AUDIO_ANALYSIS_CACHE__;
    if (!cache) {
        console.warn('⚠️ [CACHE] Cache não existe');
        return;
    }
    
    console.log('✅ [CACHE] Cache existe, tamanho:', cache.size);
    
    for (const [key, value] of cache.entries()) {
        console.log(`🔍 [CACHE] ${key}:`, {
            hasAnalysis: !!value.analysis,
            timestamp: new Date(value._ts).toLocaleString(),
            hasMetrics: !!value.analysis?.technicalData,
            metricsCount: Object.keys(value.analysis?.technicalData || {}).length
        });
    }
}

// 7. TESTAR ANÁLISE SINTÉTICA
async function testarAnaliseSintetica() {
    console.log('🔍 [SINTÉTICO] Testando análise com arquivo sintético...');
    
    if (!window.audioAnalyzer) {
        console.error('❌ [SINTÉTICO] AudioAnalyzer não disponível');
        return;
    }
    
    try {
        // Criar um arquivo de teste pequeno (tom de 1kHz)
        const sampleRate = 48000;
        const duration = 1; // 1 segundo
        const frequency = 1000; // 1kHz
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // Gerar tom senoidal
        for (let i = 0; i < channelData.length; i++) {
            channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
        }
        
        // Criar objeto File simulado
        const testFile = {
            name: 'test-tone-1khz.wav',
            size: channelData.length * 4,
            type: 'audio/wav'
        };
        
        console.log('🔍 [SINTÉTICO] Analisando tom de 1kHz...');
        
        // Análise direta usando performFullAnalysis
        const result = window.audioAnalyzer.performFullAnalysis(buffer, { runId: 'test-synthetic' });
        
        console.log('✅ [SINTÉTICO] Análise completa:', result);
        console.log('🔍 [SINTÉTICO] TechnicalData:', result.technicalData);
        
        return result;
        
    } catch (error) {
        console.error('❌ [SINTÉTICO] Erro na análise sintética:', error);
        return null;
    }
}

// 8. VERIFICAR PIPELINE BACKEND
async function verificarPipelineBackend() {
    console.log('🔍 [PIPELINE] Verificando pipeline backend...');
    
    try {
        // Verificar se existe endpoint de análise
        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ test: true })
        });
        
        if (response.ok) {
            console.log('✅ [PIPELINE] Endpoint /api/audio/analyze responde');
        } else {
            console.warn('⚠️ [PIPELINE] Endpoint retornou:', response.status);
        }
        
    } catch (error) {
        console.warn('⚠️ [PIPELINE] Erro ao testar endpoint:', error.message);
    }
}

// EXECUTAR AUDITORIA COMPLETA
async function executarAuditoria() {
    console.log('🔍 ====== AUDITORIA COMPLETA DAS MÉTRICAS ======');
    
    const resultados = {
        backend: await verificarBackend(),
        analiseAtual: verificarAnaliseAtual(),
        audioAnalyzer: verificarAudioAnalyzer(),
        v2: verificarV2(),
        getMetric: verificarGetMetric(),
        cache: verificarCache(),
        analiseSintetica: await testarAnaliseSintetica(),
        pipelineBackend: await verificarPipelineBackend()
    };
    
    console.log('🔍 ====== RESUMO DA AUDITORIA ======');
    console.log('Backend ativo:', resultados.backend);
    console.log('Análise atual válida:', !!resultados.analiseAtual);
    console.log('AudioAnalyzer carregado:', resultados.audioAnalyzer);
    console.log('V2 disponível:', resultados.v2);
    console.log('Análise sintética funcionou:', !!resultados.analiseSintetica);
    
    if (resultados.analiseAtual) {
        const td = resultados.analiseAtual.technicalData || {};
        console.log('Métricas encontradas em technicalData:', {
            lufsIntegrated: Number.isFinite(td.lufsIntegrated),
            truePeakDbtp: Number.isFinite(td.truePeakDbtp),
            peak: Number.isFinite(td.peak),
            rms: Number.isFinite(td.rms),
            dynamicRange: Number.isFinite(td.dynamicRange)
        });
    }
    
    // DIAGNÓSTICO FINAL
    console.log('🔍 ====== DIAGNÓSTICO ======');
    
    if (!resultados.analiseAtual) {
        console.error('❌ PROBLEMA: Nenhuma análise foi executada. Tente fazer upload de um arquivo.');
    } else if (!resultados.analiseAtual.technicalData) {
        console.error('❌ PROBLEMA: technicalData não existe na análise.');
    } else {
        const td = resultados.analiseAtual.technicalData;
        const metricas = ['lufsIntegrated', 'truePeakDbtp', 'peak', 'rms'];
        const problemas = metricas.filter(m => !Number.isFinite(td[m]));
        
        if (problemas.length > 0) {
            console.error('❌ PROBLEMA: Métricas não calculadas:', problemas);
            console.log('💡 POSSÍVEL CAUSA: Problema no cálculo das métricas V2 ou pipeline');
        } else {
            console.log('✅ DIAGNÓSTICO: Métricas calculadas corretamente!');
            console.log('💡 Se ainda não aparecem na UI, problema pode estar na função getMetric ou atualização da interface');
        }
    }
    
    return resultados;
}

// Auto-executar se estiver no console
if (typeof window !== 'undefined') {
    window.executarAuditoria = executarAuditoria;
    console.log('🔍 Auditoria carregada. Execute: executarAuditoria()');
}

// Executar automaticamente
executarAuditoria().catch(console.error);
