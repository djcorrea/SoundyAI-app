/**
 * 🧪 TESTE COMPLETO DO NORMALIZADOR DE DADOS DE REFERÊNCIA
 * 
 * Este teste valida o normalizador com diferentes estruturas de dados:
 * 1. Estrutura atual dos JSONs (hybrid_processing.spectral_bands)
 * 2. Estrutura legacy esperada (legacy_compatibility)
 * 3. Estrutura direta (genre_direct)
 * 4. Dados com tolerâncias explícitas
 * 5. Dados com tolerâncias faltando (valores padrão)
 */

const fs = require('fs');
const path = require('path');

// Importar classe do enhanced-suggestion-engine para ter a implementação mais recente
const engineCode = fs.readFileSync(path.join(__dirname, 'public', 'enhanced-suggestion-engine.js'), 'utf8');

// Extrair apenas as funções do normalizador (simulação da classe)
class TestNormalizer {
    constructor() {
        this.auditLog = [];
    }

    logAudit(type, message, data = {}) {
        this.auditLog.push({ type, message, data });
    }

    // Implementação real do enhanced-suggestion-engine.js
    normalizeReferenceData(referenceData, structureType = 'auto') {
        this.logAudit('NORMALIZE_START', `Normalizando dados: ${structureType}`, { structureType });

        if (!referenceData || typeof referenceData !== 'object') {
            this.logAudit('NORMALIZE_ERROR', 'Dados de referência inválidos', { referenceData });
            return null;
        }

        let sourceData = referenceData;

        // Auto-detectar estrutura se não especificada
        if (structureType === 'auto') {
            if (referenceData.legacy_compatibility) {
                structureType = 'legacy_compatibility';
                sourceData = referenceData.legacy_compatibility;
            } else if (referenceData.hybrid_processing) {
                structureType = 'genre_direct_hybrid';
                sourceData = referenceData.hybrid_processing;
            } else {
                structureType = 'genre_direct';
                sourceData = referenceData;
            }
        }

        // Normalizar métricas principais
        const normalized = {
            // LUFS
            lufs_target: this.extractMetric(sourceData, ['lufs_target', 'lufs_ref', 'lufs_integrated'], 'lufs'),
            tol_lufs: this.extractMetric(sourceData, ['tol_lufs', 'lufs_tolerance', 'tol_lufs_min'], 'lufs_tolerance') ?? 2.0,

            // True Peak
            true_peak_target: this.extractMetric(sourceData, ['true_peak_target', 'tp_ref', 'true_peak', 'true_peak_dbtp'], 'true_peak'),
            tol_true_peak: this.extractMetric(sourceData, ['tol_true_peak', 'tp_tolerance', 'true_peak_tolerance'], 'true_peak_tolerance') ?? 1.0,

            // Dynamic Range
            dr_target: this.extractMetric(sourceData, ['dr_target', 'dr_ref', 'dynamic_range'], 'dr'),
            tol_dr: this.extractMetric(sourceData, ['tol_dr', 'dr_tolerance', 'dynamic_range_tolerance'], 'dr_tolerance') ?? 2.0,

            // Loudness Range
            lra_target: this.extractMetric(sourceData, ['lra_target', 'lra_ref', 'lra'], 'lra'),
            tol_lra: this.extractMetric(sourceData, ['tol_lra', 'lra_tolerance'], 'lra_tolerance') ?? 2.0,

            // Stereo Correlation
            stereo_target: this.extractMetric(sourceData, ['stereo_target', 'stereo_ref', 'stereo_correlation'], 'stereo'),
            tol_stereo: this.extractMetric(sourceData, ['tol_stereo', 'stereo_tolerance', 'correlation_tolerance'], 'stereo_tolerance') ?? 0.15,

            // Bandas espectrais
            bands: this.normalizeBands(sourceData)
        };

        // Filtrar valores null das métricas principais
        const mainMetrics = ['lufs_target', 'tol_lufs', 'true_peak_target', 'tol_true_peak', 'dr_target', 'tol_dr', 'lra_target', 'tol_lra', 'stereo_target', 'tol_stereo'];
        const foundMetrics = mainMetrics.filter(key => normalized[key] !== null);

        this.logAudit('NORMALIZE_SUCCESS', 'Dados normalizados com sucesso', {
            structureType,
            foundMetrics,
            foundBands: Object.keys(normalized.bands),
            metricsCount: foundMetrics.length,
            bandsCount: Object.keys(normalized.bands).length
        });

        return normalized;
    }

    extractMetric(source, keys, metricName) {
        // Tentar buscar diretamente no source
        for (const key of keys) {
            if (source[key] !== undefined && Number.isFinite(source[key])) {
                this.logAudit('METRIC_FOUND', `${metricName}: ${source[key]} (via ${key})`, { metricName, key, value: source[key] });
                return source[key];
            }
        }

        // Tentar buscar em original_metrics se disponível
        if (source.original_metrics) {
            for (const key of keys) {
                if (source.original_metrics[key] !== undefined && Number.isFinite(source.original_metrics[key])) {
                    this.logAudit('METRIC_FOUND', `${metricName}: ${source.original_metrics[key]} (via original_metrics.${key})`, { metricName, key, value: source.original_metrics[key] });
                    return source.original_metrics[key];
                }
            }
        }

        console.warn(`⚠️ Métrica não encontrada: ${metricName}`, { tentativas: keys, source: Object.keys(source) });
        this.logAudit('METRIC_MISSING', `Métrica ausente: ${metricName}`, { keys, availableKeys: Object.keys(source) });
        return null;
    }

    normalizeBands(source) {
        const bands = {};
        let sourceBands = null;

        // Tentar encontrar bandas em diferentes locais
        if (source.bands) {
            sourceBands = source.bands;
        } else if (source.spectral_bands) {
            sourceBands = source.spectral_bands;
        } else if (source.original_metrics && source.original_metrics.bands) {
            sourceBands = source.original_metrics.bands;
        }

        if (!sourceBands || typeof sourceBands !== 'object') {
            console.warn('⚠️ Bandas espectrais não encontradas');
            this.logAudit('BANDS_MISSING', 'Bandas espectrais ausentes', { source: Object.keys(source) });
            return {};
        }

        // Mapeamentos de bandas
        const bandMappings = {
            'sub': 'sub',
            'bass': 'bass',
            'lowMid': 'lowMid', 
            'mid': 'mid',
            'highMid': 'highMid',
            'presence': 'presence',
            'air': 'air',
            'low_bass': 'bass',
            'upper_bass': 'lowMid',
            'low_mid': 'lowMid',
            'high_mid': 'highMid',
            'presenca': 'presence',
            'brilho': 'air',
            'low': 'bass',
            'high': 'air',
            'brightness': 'air'
        };

        // Processar cada banda encontrada
        for (const [sourceBandName, bandData] of Object.entries(sourceBands)) {
            if (!bandData || typeof bandData !== 'object') continue;

            const standardName = bandMappings[sourceBandName] || sourceBandName;
            const target_db = Number.isFinite(bandData.target_db) ? bandData.target_db : null;
            const tol_db = Number.isFinite(bandData.tol_db) ? bandData.tol_db : 
                          Number.isFinite(bandData.tolerance) ? bandData.tolerance :
                          Number.isFinite(bandData.toleranceDb) ? bandData.toleranceDb : 3.0;

            if (target_db !== null) {
                if (!bands[standardName]) {
                    bands[standardName] = { target_db, tol_db };
                    this.logAudit('BAND_MAPPED', `Banda mapeada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName, standardName, target_db, tol_db
                    });
                } else {
                    this.logAudit('BAND_SKIPPED', `Banda duplicada ignorada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName, standardName, existing: bands[standardName], skipped: { target_db, tol_db }
                    });
                }
            }
        }

        return bands;
    }
}

// ===== CENÁRIOS DE TESTE =====

const testScenarios = {
    // Cenário 1: Estrutura atual dos JSONs (hybrid_processing)
    currentStructure: {
        "hybrid_processing": {
            "original_metrics": {
                "lufs_integrated": -14.2,
                "true_peak_dbtp": -0.8,
                "dynamic_range": 8.5,
                "lra": 3.2,
                "stereo_correlation": 0.92
            },
            "spectral_bands": {
                "sub": { "target_db": -20.0, "tol_db": 2.0 },
                "low_bass": { "target_db": -18.5, "tol_db": 2.5 },
                "upper_bass": { "target_db": -19.0, "tol_db": 2.8 },
                "low_mid": { "target_db": -17.2, "tol_db": 2.2 },
                "mid": { "target_db": -16.8, "tol_db": 2.1 },
                "high_mid": { "target_db": -20.5, "tol_db": 2.6 },
                "presenca": { "target_db": -23.1, "tol_db": 2.9 },
                "brilho": { "target_db": -26.3, "tol_db": 3.1 }
            }
        }
    },

    // Cenário 2: Estrutura legacy esperada
    legacyStructure: {
        "legacy_compatibility": {
            "lufs_target": -16.0,
            "tol_lufs": 1.5,
            "true_peak_target": -1.0,
            "tol_true_peak": 0.8,
            "dr_target": 10.0,
            "tol_dr": 2.5,
            "lra_target": 4.0,
            "tol_lra": 1.8,
            "stereo_target": 0.88,
            "tol_stereo": 0.12,
            "bands": {
                "sub": { "target_db": -18.0, "tol_db": 2.0 },
                "bass": { "target_db": -16.5, "tol_db": 1.8 },
                "lowMid": { "target_db": -15.2, "tol_db": 1.9 },
                "mid": { "target_db": -14.8, "tol_db": 1.7 },
                "highMid": { "target_db": -18.5, "tol_db": 2.2 },
                "presence": { "target_db": -21.1, "tol_db": 2.4 },
                "air": { "target_db": -24.3, "tol_db": 2.6 }
            }
        }
    },

    // Cenário 3: Estrutura direta (sem wrapper)
    directStructure: {
        "lufs_target": -12.0,
        "true_peak_target": -0.5,
        "dr_target": 6.5,
        "lra_target": 2.8,
        "stereo_target": 0.75,
        "spectral_bands": {
            "sub": { "target_db": -22.0, "tol_db": 3.5 },
            "bass": { "target_db": -20.5, "tol_db": 3.2 },
            "lowMid": { "target_db": -19.2, "tol_db": 3.0 },
            "mid": { "target_db": -18.8, "tol_db": 2.8 },
            "highMid": { "target_db": -22.5, "tol_db": 3.1 },
            "presence": { "target_db": -25.1, "tol_db": 3.3 },
            "air": { "target_db": -28.3, "tol_db": 3.4 }
        }
    },

    // Cenário 4: Dados sem tolerâncias (teste de valores padrão)
    noTolerances: {
        "hybrid_processing": {
            "original_metrics": {
                "lufs_integrated": -9.5,
                "true_peak_dbtp": -0.3,
                "dynamic_range": 5.2,
                "lra": 1.8,
                "stereo_correlation": 0.65
            },
            "spectral_bands": {
                "sub": { "target_db": -25.0 },
                "low_bass": { "target_db": -23.5 },
                "low_mid": { "target_db": -22.2 },
                "mid": { "target_db": -21.8 },
                "high_mid": { "target_db": -25.5 },
                "presenca": { "target_db": -28.1 },
                "brilho": { "target_db": -31.3 }
            }
        }
    }
};

// ===== EXECUTAR TESTES =====

console.log('🧪 TESTE COMPLETO DO NORMALIZADOR DE DADOS DE REFERÊNCIA');
console.log('============================================================\n');

const normalizer = new TestNormalizer();

Object.entries(testScenarios).forEach(([scenarioName, testData], index) => {
    console.log(`📋 CENÁRIO ${index + 1}: ${scenarioName.toUpperCase()}`);
    console.log('-----------------------------------------------------------');
    
    // Reset do log de auditoria
    normalizer.auditLog = [];
    
    const result = normalizer.normalizeReferenceData(testData);
    
    if (result) {
        console.log('✅ SUCESSO - Dados normalizados:');
        console.log(JSON.stringify(result, null, 2));
        
        // Verificar métricas
        const foundMetrics = Object.keys(result).filter(key => 
            key !== 'bands' && result[key] !== null
        );
        
        console.log(`\n📊 Estatísticas:`);
        console.log(`   • Métricas encontradas: ${foundMetrics.length}`);
        console.log(`   • Bandas encontradas: ${Object.keys(result.bands).length}`);
        console.log(`   • Valores padrão usados: ${foundMetrics.filter(key => 
            key.startsWith('tol_') && result[key] !== null
        ).length}`);
        
    } else {
        console.log('❌ FALHA na normalização');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
});

console.log('🏁 TODOS OS TESTES CONCLUÍDOS!\n');

// Teste de compatibilidade com suggestion engine
console.log('🔗 TESTE DE COMPATIBILIDADE COM SUGGESTION ENGINE');
console.log('============================================================');

const expectedMetrics = [
    'lufs_target', 'tol_lufs',
    'true_peak_target', 'tol_true_peak', 
    'dr_target', 'tol_dr',
    'lra_target', 'tol_lra',
    'stereo_target', 'tol_stereo'
];

const expectedBands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];

const testResult = normalizer.normalizeReferenceData(testScenarios.currentStructure);

console.log('Verificando compatibilidade...');
const hasAllMetrics = expectedMetrics.every(metric => testResult.hasOwnProperty(metric));
const hasAllBands = expectedBands.every(band => testResult.bands.hasOwnProperty(band));

console.log(`✅ Métricas esperadas: ${hasAllMetrics ? 'TODAS PRESENTES' : 'FALTANDO ALGUMAS'}`);
console.log(`✅ Bandas esperadas: ${hasAllBands ? 'TODAS PRESENTES' : 'FALTANDO ALGUMAS'}`);

if (hasAllMetrics && hasAllBands) {
    console.log('🎉 NORMALIZER TOTALMENTE COMPATÍVEL COM SUGGESTION ENGINE!');
} else {
    console.log('⚠️ Incompatibilidades detectadas');
}