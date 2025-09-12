/**
 * 🔬 EXTRAÇÃO CIRÚRGICA: JSON Backend vs Frontend
 * 
 * Vou interceptar EXATAMENTE o que o backend envia vs o que o frontend recebe
 */

console.log("🔬 [EXTRAÇÃO] Iniciando captura cirúrgica de dados...");

// ========== SIMULAÇÃO DO BACKEND ==========
// Baseado no index.js, linha 150-280
function simulateBackendResponse() {
    const lufsIntegrated = -12.5;
    const truePeak = -1.8;
    const dynamicRange = 8.2;
    const rmsLevel = -18.3;
    const crestFactor = 7.1;
    
    return {
        status: "success",
        mode: "pipeline_complete_mathematical",
        overallScore: 7.8,
        qualityOverall: 7.8,
        classification: "Profissional",
        scoringMethod: "equal_weight_v3_mathematical",
        
        // 🎯 CHAVES EXATAS DO BACKEND (snake_case)
        technicalData: {
            // Básicas
            durationSec: 180.45,
            sampleRate: 44100,
            channels: 2,
            bitrate: 1411,
            
            // LUFS (ITU-R BS.1770-4) - SNAKE_CASE
            lufs_integrated: lufsIntegrated,
            lufs_short_term: -11.2,
            lufs_momentary: -10.8,
            
            // True Peak - SNAKE_CASE
            true_peak: truePeak,
            truePeakDbtp: truePeak, // Duplicado!
            
            // Dinâmica - SNAKE_CASE
            dynamic_range: dynamicRange,
            crest_factor: crestFactor,
            rms_level: rmsLevel,
            peak_db: rmsLevel + crestFactor,
            
            // Balance espectral - SNAKE_CASE
            spectral_balance: {
                sub: 0.12,
                bass: 0.28,
                mids: 0.35,
                treble: 0.25
            },
            
            // Tonal balance (estrutura complexa)
            tonalBalance: {
                sub: { rms_db: -28.5, peak_db: -23.1, energy_ratio: 0.12 },
                low: { rms_db: -22.8, peak_db: -17.4, energy_ratio: 0.28 },
                mid: { rms_db: -18.2, peak_db: -13.6, energy_ratio: 0.35 },
                high: { rms_db: -25.1, peak_db: -19.8, energy_ratio: 0.25 }
            },
            
            // Frequências dominantes
            dominantFrequencies: [
                { frequency: 440, amplitude: -18.2, occurrences: 150 },
                { frequency: 880, amplitude: -22.1, occurrences: 89 },
                { frequency: 220, amplitude: -25.3, occurrences: 67 }
            ],
            
            // Estéreo - SNAKE_CASE
            stereo_width: 0.78,
            stereo_correlation: 0.85,
            balance_lr: 0.52,
            
            // Headroom
            headroomDb: 1.8,
            
            // Métricas espectrais - SNAKE_CASE
            spectral_centroid: 1850.5,
            spectral_rolloff: 7200.8,
            spectral_flux: 0.245,
            spectral_flatness: 0.185,
            zero_crossing_rate: 0.078,
            mfcc_coefficients: [-2.1, 1.8, -0.9, 2.3, -1.1, 0.7, -0.4, 1.2, -0.8, 0.5, -0.3, 0.9, -0.6]
        },
        
        // Problemas e sugestões
        problems: [
            { type: "loudness", severity: "medium", description: "LUFS ligeiramente alto para streaming" }
        ],
        suggestions: [
            "Considere reduzir o volume para -14 LUFS",
            "Excelente dinâmica preservada"
        ],
        
        // Metadados
        metadata: {
            processedAt: "2025-09-11T22:45:00.000Z",
            filename: "test-audio.wav",
            genre: "electronic",
            sampleRate: 44100,
            channels: 2,
            duration: 180.45,
            pipelineVersion: "5.1-5.4-mathematical-complete"
        }
    };
}

// ========== FRONTEND NORMALIZATION ==========
// Baseado em audio-analyzer-integration.js, linha 5590+
function simulateFrontendNormalization(backendData) {
    console.log('🔧 [NORMALIZE] Iniciando normalização dos dados do backend:', backendData);
    
    // Se já está no formato correto, retornar como está
    if (backendData.technicalData && backendData.technicalData.peak !== undefined) {
        console.log('📊 [NORMALIZE] Dados já estão normalizados');
        return backendData;
    }
    
    // Criar estrutura normalizada
    const normalized = {
        ...backendData,
        technicalData: backendData.technicalData || {},
        problems: backendData.problems || [],
        suggestions: backendData.suggestions || [],
        duration: backendData.duration || 0,
        sampleRate: backendData.sampleRate || 48000,
        channels: backendData.channels || 2
    };
    
    const tech = normalized.technicalData;
    const source = backendData.technicalData || backendData.metrics || backendData;
    
    // 🚨 MAPEAMENTO CRÍTICO: snake_case → camelCase
    
    // Peak e RMS
    if (source.peak_db !== undefined) {
        tech.peak = source.peak_db;
        tech.peakDb = source.peak_db;
    } else if (source.peak !== undefined) tech.peak = source.peak;
    else if (source.peakLevel !== undefined) tech.peak = source.peakLevel;
    
    if (source.rms_level !== undefined) {
        tech.rms = source.rms_level;
        tech.rmsLevel = source.rms_level;
    } else if (source.rms !== undefined) tech.rms = source.rms;
    
    // Dynamic Range
    if (source.dynamic_range !== undefined) {
        tech.dynamicRange = source.dynamic_range;
        tech.dr = source.dynamic_range;
    } else if (source.dynamicRange !== undefined) tech.dynamicRange = source.dynamicRange;
    
    // True Peak
    if (source.true_peak !== undefined) {
        tech.truePeakDbtp = source.true_peak;
        tech.truePeak = source.true_peak;
    } else if (source.truePeakDbtp !== undefined) tech.truePeakDbtp = source.truePeakDbtp;
    
    // LUFS
    if (source.lufs_integrated !== undefined) {
        tech.lufsIntegrated = source.lufs_integrated;
        tech.lufs = source.lufs_integrated;
    } else if (source.lufsIntegrated !== undefined) tech.lufsIntegrated = source.lufsIntegrated;
    
    if (source.lufs_short_term !== undefined) {
        tech.lufsShortTerm = source.lufs_short_term;
    } else if (source.lufsShortTerm !== undefined) tech.lufsShortTerm = source.lufsShortTerm;
    
    // Stereo
    if (source.stereo_correlation !== undefined) {
        tech.stereoCorrelation = source.stereo_correlation;
    } else if (source.stereoCorrelation !== undefined) tech.stereoCorrelation = source.stereoCorrelation;
    
    console.log('✅ [NORMALIZE] Mapeamento concluído:', {
        peak: tech.peak,
        rms: tech.rms,
        dynamicRange: tech.dynamicRange,
        lufsIntegrated: tech.lufsIntegrated,
        truePeakDbtp: tech.truePeakDbtp,
        stereoCorrelation: tech.stereoCorrelation
    });
    
    return normalized;
}

// ========== FRONTEND DISPLAY ==========
// Baseado em displayModalResults, linha 3319+
function simulateFrontendDisplay(analysis) {
    console.log('🎨 [DISPLAY] Iniciando renderização do modal...');
    
    const tech = analysis.technicalData || {};
    
    // Helper para obter métrica
    const getMetric = (key, fallback = null) => {
        const value = tech[key];
        if (Number.isFinite(value)) return value;
        if (fallback && Number.isFinite(tech[fallback])) return tech[fallback];
        console.warn(`❌ [DISPLAY] Métrica ${key} não encontrada (fallback: ${fallback})`);
        return null;
    };
    
    // Métricas Principais
    const mainMetrics = {
        peak: getMetric('peak', 'peakDb'),
        rms: getMetric('rms', 'rmsLevel'),
        lufsIntegrated: getMetric('lufsIntegrated', 'lufs'),
        truePeakDbtp: getMetric('truePeakDbtp', 'truePeak'),
        dynamicRange: getMetric('dynamicRange', 'dr'),
        stereoCorrelation: getMetric('stereoCorrelation')
    };
    
    console.log('📊 [DISPLAY] Métricas principais extraídas:', mainMetrics);
    
    // Verificar quais estão null
    const nullMetrics = Object.entries(mainMetrics)
        .filter(([key, value]) => value === null)
        .map(([key]) => key);
    
    if (nullMetrics.length > 0) {
        console.error('❌ [DISPLAY] Métricas NULL encontradas:', nullMetrics);
    }
    
    // Score e classificação
    const score = analysis.score || analysis.qualityOverall || analysis.overallScore;
    const classification = analysis.classification;
    
    console.log('🏆 [DISPLAY] Score e classificação:', { score, classification });
    
    return {
        mainMetrics,
        nullMetrics,
        score,
        classification,
        hasSpectralBalance: !!tech.spectral_balance,
        hasTonalBalance: !!tech.tonalBalance
    };
}

// ========== STATUS UNIFIED ==========
// Baseado em status-suggestion-unified-v1.js
function simulateStatusUnified(analysis) {
    console.log('🔄 [STATUS_UNIFIED] Iniciando cálculo...');
    
    const tech = analysis.technicalData || {};
    
    // Valores que podem causar null
    const lufsIntegrated = tech.lufsIntegrated || tech.lufs;
    const truePeakDbtp = tech.truePeakDbtp || tech.truePeak;
    const dynamicRange = tech.dynamicRange || tech.dr;
    
    console.log('🔍 [STATUS_UNIFIED] Valores para cálculo:', {
        lufsIntegrated,
        truePeakDbtp, 
        dynamicRange
    });
    
    // Verificar null values
    if (!Number.isFinite(lufsIntegrated)) {
        console.error('❌ [STATUS_UNIFIED] lufsIntegrated é null/undefined');
        return { error: 'lufsIntegrated_null' };
    }
    
    if (!Number.isFinite(truePeakDbtp)) {
        console.error('❌ [STATUS_UNIFIED] truePeakDbtp é null/undefined');
        return { error: 'truePeakDbtp_null' };
    }
    
    if (!Number.isFinite(dynamicRange)) {
        console.error('❌ [STATUS_UNIFIED] dynamicRange é null/undefined');
        return { error: 'dynamicRange_null' };
    }
    
    console.log('✅ [STATUS_UNIFIED] Todos os valores são válidos');
    return { success: true };
}

// ========== EXECUTAR SIMULAÇÃO COMPLETA ==========
function runCompleteSimulation() {
    console.log('\n🔬 ========== SIMULAÇÃO COMPLETA ==========\n');
    
    // 1. Backend Response
    console.log('1️⃣ BACKEND RESPONSE:');
    const backendData = simulateBackendResponse();
    console.log(JSON.stringify(backendData, null, 2));
    
    console.log('\n2️⃣ FRONTEND NORMALIZATION:');
    const normalizedData = simulateFrontendNormalization(backendData);
    
    console.log('\n3️⃣ FRONTEND DISPLAY:');
    const displayResult = simulateFrontendDisplay(normalizedData);
    
    console.log('\n4️⃣ STATUS UNIFIED:');
    const statusResult = simulateStatusUnified(normalizedData);
    
    console.log('\n📋 ========== RELATÓRIO FINAL ==========');
    console.log('Backend → Frontend mapping:');
    console.table({
        'lufs_integrated → lufsIntegrated': normalizedData.technicalData.lufsIntegrated,
        'true_peak → truePeakDbtp': normalizedData.technicalData.truePeakDbtp,
        'dynamic_range → dynamicRange': normalizedData.technicalData.dynamicRange,
        'peak_db → peak': normalizedData.technicalData.peak,
        'rms_level → rms': normalizedData.technicalData.rms,
        'stereo_correlation → stereoCorrelation': normalizedData.technicalData.stereoCorrelation
    });
    
    console.log('\nProblemas identificados:');
    console.log('- Métricas NULL:', displayResult.nullMetrics);
    console.log('- Status Unified:', statusResult);
    
    console.log('\n🎯 CAUSA RAIZ:', displayResult.nullMetrics.length > 0 ? 
        'Normalização não está mapeando todas as chaves necessárias' : 
        'Mapeamento OK - problema pode estar no backend'
    );
}

runCompleteSimulation();
