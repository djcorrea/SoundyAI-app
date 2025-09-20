/**
 * 🧪 TESTE DO NORMALIZADOR DE DADOS DE REFERÊNCIA
 * Verifica se o normalizador funciona corretamente com os JSONs atuais
 */

// Simular o motor de sugestões para teste
class TestEngine {
    constructor() {
        this.auditLog = [];
    }

    logAudit(type, message, data = {}) {
        this.auditLog.push({
            timestamp: Date.now(),
            type,
            message,
            data
        });
    }

    // Copiar todas as funções de normalização do enhanced-suggestion-engine.js
    normalizeReferenceData(rawRef) {
        if (!rawRef || typeof rawRef !== 'object') {
            console.warn('🚨 Dados de referência inválidos ou ausentes');
            this.logAudit('NORMALIZE_ERROR', 'Dados de referência inválidos', { rawRef });
            return null;
        }

        // Detectar estrutura dos dados
        let sourceData = null;
        let structureType = 'unknown';

        // Tentar legacy_compatibility primeiro
        if (rawRef.legacy_compatibility && typeof rawRef.legacy_compatibility === 'object') {
            sourceData = rawRef.legacy_compatibility;
            structureType = 'legacy_compatibility';
        }
        // Tentar hybrid_processing (estrutura atual dos JSONs)
        else if (rawRef.hybrid_processing && typeof rawRef.hybrid_processing === 'object') {
            sourceData = rawRef.hybrid_processing;
            structureType = 'hybrid_processing';
        }
        // Tentar estrutura direta (genreName: {...})
        else {
            const firstKey = Object.keys(rawRef)[0];
            if (firstKey && rawRef[firstKey] && typeof rawRef[firstKey] === 'object') {
                sourceData = rawRef[firstKey];
                structureType = 'genre_direct';
                
                // Se tem hybrid_processing dentro, usar isso
                if (sourceData.hybrid_processing) {
                    sourceData = sourceData.hybrid_processing;
                    structureType = 'genre_direct_hybrid';
                }
            }
        }

        if (!sourceData) {
            console.warn('🚨 Estrutura de dados de referência não reconhecida');
            this.logAudit('NORMALIZE_ERROR', 'Estrutura não reconhecida', { rawRef, keys: Object.keys(rawRef) });
            return null;
        }

        this.logAudit('NORMALIZE_START', `Normalizando dados: ${structureType}`, { structureType });

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

        // Log das métricas encontradas
        const foundMetrics = Object.keys(normalized).filter(key => 
            key !== 'bands' && normalized[key] !== null && normalized[key] !== undefined
        );
        const foundBands = normalized.bands ? Object.keys(normalized.bands) : [];

        this.logAudit('NORMALIZE_SUCCESS', 'Dados normalizados com sucesso', {
            structureType,
            foundMetrics,
            foundBands,
            metricsCount: foundMetrics.length,
            bandsCount: foundBands.length
        });

        return normalized;
    }

    extractMetric(source, keys, metricName) {
        for (const key of keys) {
            if (source[key] !== undefined && source[key] !== null && Number.isFinite(source[key])) {
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

        // Mapeamentos de bandas (de nomes antigos/alternativos para padronizados)
        const bandMappings = {
            // Mapeamento direto (nome padrão)
            'sub': 'sub',
            'bass': 'bass',
            'lowMid': 'lowMid', 
            'mid': 'mid',
            'highMid': 'highMid',
            'presence': 'presence',
            'air': 'air',

            // Mapeamentos de aliases
            'low_bass': 'bass',
            'upper_bass': 'lowMid',
            'low_mid': 'lowMid',
            'high_mid': 'highMid',
            'presenca': 'presence',
            'brilho': 'air',

            // Mapeamentos adicionais encontrados nos JSONs
            'low': 'bass',
            'high': 'air',
            'brightness': 'air'
        };

        // Processar cada banda encontrada
        for (const [sourceBandName, bandData] of Object.entries(sourceBands)) {
            if (!bandData || typeof bandData !== 'object') continue;

            // Encontrar nome padronizado
            const standardName = bandMappings[sourceBandName] || sourceBandName;

            // Extrair target_db e tol_db
            const target_db = Number.isFinite(bandData.target_db) ? bandData.target_db : null;
            const tol_db = Number.isFinite(bandData.tol_db) ? bandData.tol_db : 
                          Number.isFinite(bandData.tolerance) ? bandData.tolerance :
                          Number.isFinite(bandData.toleranceDb) ? bandData.toleranceDb : 3.0; // Default

            if (target_db !== null) {
                bands[standardName] = {
                    target_db,
                    tol_db
                };

                this.logAudit('BAND_MAPPED', `Banda mapeada: ${sourceBandName} → ${standardName}`, {
                    sourceName: sourceBandName,
                    standardName,
                    target_db,
                    tol_db
                });
            } else {
                console.warn(`⚠️ Banda sem target_db válido: ${sourceBandName}`);
                this.logAudit('BAND_INVALID', `Banda inválida: ${sourceBandName}`, { bandData });
            }
        }

        return bands;
    }
}

// Dados de teste baseados na estrutura atual dos JSONs
const testDataCurrentStructure = {
    "funk_mandela": {
        "version": "v2_hybrid_safe",
        "generated_at": "2025-08-31T14:58:44.913Z",
        "num_tracks": 10,
        "processing_mode": "fallback_safe",
        "hybrid_processing": {
            "original_metrics": {
                "lufs_integrated": -7.8,
                "true_peak_dbtp": -1,
                "dynamic_range": 7.8,
                "rms_db": -11.3,
                "stereo_correlation": 0.85,
                "lra": 2.5
            },
            "spectral_bands": {
                "sub": {
                    "target_db": -17.3,
                    "energy_pct": 29.5,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "low_bass": {
                    "target_db": -17.7,
                    "energy_pct": 26.8,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "upper_bass": {
                    "target_db": -21.5,
                    "energy_pct": 9,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "low_mid": {
                    "target_db": -18.7,
                    "energy_pct": 12.4,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "mid": {
                    "target_db": -17.9,
                    "energy_pct": 15.4,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "high_mid": {
                    "target_db": -22.9,
                    "energy_pct": 5.3,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "brilho": {
                    "target_db": -28.4,
                    "energy_pct": 2.1,
                    "tol_db": 2.5,
                    "severity": "soft"
                },
                "presenca": {
                    "target_db": -25.8,
                    "energy_pct": 3.5,
                    "tol_db": 2.5,
                    "severity": "soft"
                }
            }
        }
    }
};

// Testar normalização
console.log('🧪 TESTE DO NORMALIZADOR DE DADOS DE REFERÊNCIA');
console.log('='.repeat(60));

const engine = new TestEngine();

console.log('\n📄 Testando estrutura atual dos JSONs...');
const result = engine.normalizeReferenceData(testDataCurrentStructure);

console.log('\n📊 RESULTADO:');
console.log(JSON.stringify(result, null, 2));

console.log('\n📝 LOG DE AUDITORIA:');
engine.auditLog.forEach(log => {
    console.log(`[${log.type}] ${log.message}`, log.data);
});

console.log('\n🎯 VERIFICAÇÕES:');
console.log('✅ Métricas principais encontradas:', Object.keys(result || {}).filter(k => k !== 'bands'));
console.log('✅ Bandas encontradas:', result?.bands ? Object.keys(result.bands) : []);
console.log('✅ Total de campos válidos:', result ? Object.keys(result).filter(k => result[k] !== null).length : 0);

// Verificar se todas as bandas esperadas estão presentes
const expectedBands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
const foundBands = result?.bands ? Object.keys(result.bands) : [];
const missingBands = expectedBands.filter(band => !foundBands.includes(band));

if (missingBands.length > 0) {
    console.log('⚠️ Bandas não encontradas:', missingBands);
} else {
    console.log('✅ Todas as bandas esperadas foram encontradas!');
}

console.log('\n🏁 TESTE CONCLUÍDO');