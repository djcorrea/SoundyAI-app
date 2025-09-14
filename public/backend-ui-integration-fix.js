// 🎯 CORREÇÃO DE INTEGRAÇÃO BACKEND-UI - MÉTRICAS REAIS SEM PLACEHOLDERS
// Remove todos os valores fictícios e garante que apenas dados reais do backend sejam exibidos

(function() {
    'use strict';
    
    console.log('🎯 Carregando correção de integração Backend-UI...');
    
    // ========= MAPEAMENTO CORRETO DAS MÉTRICAS =========
    const CORRECTED_METRIC_MAPPINGS = {
        // LUFS e Loudness (estrutura corrigida)
        'lufs_integrated': ['lufs.integrated', 'technicalData.lufsIntegrated'],
        'lufs_short_term': ['lufs.shortTerm', 'technicalData.lufsShortTerm'],
        'lufs_momentary': ['lufs.momentary', 'technicalData.lufsMomentary'],
        'lra': ['lufs.lra', 'dynamics.lra', 'technicalData.lra'],
        
        // True Peak (estrutura corrigida)
        'truePeakDbtp': ['truePeak.maxDbtp', 'technicalData.truePeakDbtp'],
        'truePeakLeft': ['truePeak.maxLeft', 'technicalData.truePeakLeft'],
        'truePeakRight': ['truePeak.maxRight', 'technicalData.truePeakRight'],
        
        // Dinâmica (estrutura corrigida)
        'dynamic_range': ['dynamics.dynamicRange', 'technicalData.dynamicRange'],
        'crest_factor': ['dynamics.crestFactor', 'technicalData.crestFactor'],
        'dynamicRange': ['dynamics.dynamicRange', 'technicalData.dynamicRange'],
        'crestFactor': ['dynamics.crestFactor', 'technicalData.crestFactor'],
        
        // Estéreo (estrutura corrigida)
        'stereo_correlation': ['stereo.correlation', 'technicalData.stereoCorrelation'],
        'stereo_width': ['stereo.width', 'technicalData.stereoWidth'],
        'stereoCorrelation': ['stereo.correlation', 'technicalData.stereoCorrelation'],
        'stereoWidth': ['stereo.width', 'technicalData.stereoWidth'],
        
        // Spectral (estrutura corrigida)
        'spectral_centroid': ['spectralCentroid.centroidHz', 'technicalData.spectralCentroid'],
        'spectralCentroid': ['spectralCentroid.centroidHz', 'technicalData.spectralCentroid'],
        
        // Bandas espectrais (estrutura corrigida)
        'spectral_bands': ['spectralBands.bands', 'technicalData.tonalBalance'],
        'tonalBalance': ['spectralBands.bands', 'technicalData.tonalBalance']
    };
    
    // ========= FUNÇÃO PARA BUSCAR VALOR ANINHADO =========
    function getNestedValue(obj, path) {
        if (!obj || !path) return null;
        
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }
    
    // ========= FUNÇÃO PARA OBTER MÉTRICA REAL DO BACKEND =========
    function getRealMetricValue(analysisData, metricKey) {
        if (!analysisData || !metricKey) return null;
        
        const mappings = CORRECTED_METRIC_MAPPINGS[metricKey];
        if (!mappings) {
            // Fallback: tentar buscar diretamente
            const directValue = getNestedValue(analysisData, metricKey);
            return directValue !== null && Number.isFinite(directValue) ? directValue : null;
        }
        
        // Tentar cada mapeamento na ordem de prioridade
        for (const path of mappings) {
            const value = getNestedValue(analysisData, path);
            if (value !== null && Number.isFinite(value)) {
                return value;
            }
        }
        
        return null;
    }
    
    // ========= FORMATAÇÃO SEGURA SEM PLACEHOLDERS =========
    function formatMetricValue(value, metricType, options = {}) {
        if (value === null || value === undefined || !Number.isFinite(value)) {
            return options.showUnavailable ? 'Não disponível' : null;
        }
        
        const decimals = options.decimals || 1;
        
        switch (metricType) {
            case 'lufs':
                return `${value.toFixed(decimals)} LUFS`;
            case 'dbtp':
                return `${value.toFixed(decimals)} dBTP`;
            case 'db':
                return `${value.toFixed(decimals)} dB`;
            case 'hz':
                return `${Math.round(value)} Hz`;
            case 'percentage':
                return `${(value * 100).toFixed(decimals)}%`;
            case 'correlation':
                return value.toFixed(2);
            case 'width':
                return value.toFixed(2);
            default:
                return value.toFixed(decimals);
        }
    }
    
    // ========= SUBSTITUIR FUNÇÃO PLACEHOLDER ORIGINAL =========
    if (typeof window !== 'undefined') {
        // Salvar função original se existir
        window.__originalSafeDisplayNumber = window.safeDisplayNumber;
        
        // Substituir por versão que não usa placeholders
        window.safeDisplayNumber = function(val, key, decimals = 2) {
            if (!Number.isFinite(val)) {
                console.warn(`🎯 MÉTRICA INVÁLIDA: ${key} = ${val} (será omitida da UI)`);
                return null; // Não exibir nada em vez de "—"
            }
            return val.toFixed(decimals);
        };
        
        // Nova função para obter métricas corrigidas
        window.getCorrectedMetric = function(analysisData, metricKey, formatType, options = {}) {
            const value = getRealMetricValue(analysisData, metricKey);
            if (value === null) {
                console.warn(`🎯 MÉTRICA AUSENTE: ${metricKey} não encontrada no backend`);
                return options.showUnavailable ? 'Não disponível' : null;
            }
            
            return formatMetricValue(value, formatType, options);
        };
        
        // ========= INTERCEPTAR E CORRIGIR RENDERIZAÇÃO DE MÉTRICAS =========
        let originalRenderTechnicalData = null;
        
        // Procurar pela função de renderização se estiver disponível
        const checkAndPatchRender = () => {
            if (window.renderTechnicalData && !window.__renderPatched) {
                originalRenderTechnicalData = window.renderTechnicalData;
                
                window.renderTechnicalData = function(analysis, ...args) {
                    console.log('🎯 Renderização interceptada - usando métricas corrigidas');
                    
                    // Criar objeto de análise corrigido
                    const correctedAnalysis = { ...analysis };
                    
                    // Garantir que apenas valores reais sejam usados
                    if (correctedAnalysis.technicalData) {
                        const td = correctedAnalysis.technicalData;
                        
                        // Remover valores placeholder/fictícios conhecidos
                        const placeholderValues = [-60, 0, null, undefined];
                        
                        Object.keys(td).forEach(key => {
                            if (placeholderValues.includes(td[key]) || !Number.isFinite(td[key])) {
                                console.warn(`🎯 Removendo valor placeholder: ${key} = ${td[key]}`);
                                delete td[key];
                            }
                        });
                    }
                    
                    // Chamar função original com dados corrigidos
                    return originalRenderTechnicalData.call(this, correctedAnalysis, ...args);
                };
                
                window.__renderPatched = true;
                console.log('✅ Função de renderização corrigida');
            }
        };
        
        // Verificar imediatamente e depois periodicamente
        checkAndPatchRender();
        const patchInterval = setInterval(() => {
            checkAndPatchRender();
            if (window.__renderPatched) {
                clearInterval(patchInterval);
            }
        }, 1000);
        
        // Limpar interval após 10 segundos
        setTimeout(() => clearInterval(patchInterval), 10000);
        
        // ========= HELPER PARA VALIDAR EXIBIÇÃO DE MÉTRICAS =========
        window.validateMetricsDisplay = function(analysisData) {
            const results = {
                totalMetrics: 0,
                validMetrics: 0,
                missingMetrics: 0,
                placeholderMetrics: 0,
                details: []
            };
            
            Object.keys(CORRECTED_METRIC_MAPPINGS).forEach(metricKey => {
                results.totalMetrics++;
                
                const value = getRealMetricValue(analysisData, metricKey);
                
                if (value === null) {
                    results.missingMetrics++;
                    results.details.push({
                        metric: metricKey,
                        status: 'missing',
                        value: null,
                        message: 'Não encontrada no backend'
                    });
                } else if ([-60, 0].includes(value)) {
                    results.placeholderMetrics++;
                    results.details.push({
                        metric: metricKey,
                        status: 'placeholder',
                        value: value,
                        message: 'Valor placeholder detectado'
                    });
                } else {
                    results.validMetrics++;
                    results.details.push({
                        metric: metricKey,
                        status: 'valid',
                        value: value,
                        message: 'Valor real do backend'
                    });
                }
            });
            
            console.log('🎯 VALIDAÇÃO DE MÉTRICAS:', results);
            return results;
        };
        
        console.log('✅ Correção de integração Backend-UI carregada');
        console.log('💡 Use validateMetricsDisplay(analysisData) para validar métricas');
        console.log('💡 Use getCorrectedMetric(data, key, type) para obter valores reais');
    }
})();