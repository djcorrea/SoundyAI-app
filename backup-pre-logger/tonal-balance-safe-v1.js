/**
 * 🛡️ TONAL BALANCE SAFE V1
 * Sistema seguro para validação e exibição do bloco "Sub / Low / Mid / High"
 * 
 * 🎯 OBJETIVO: Garantir que as bandas espectrais mostrem valores reais e distintos,
 * ocultando automaticamente o bloco quando dados forem insuficientes/duvidosos.
 * 
 * 🚦 FEATURE FLAG: TONAL_BALANCE_SAFE_V1
 */

// 🚦 ATIVAÇÃO AUTOMÁTICA da feature flag
window.TONAL_BALANCE_SAFE_V1 = true;

/**
 * 🔍 Configuração do sistema de validação
 */
const TONAL_BALANCE_CONFIG = {
    // Tolerância para detectar valores "quase iguais" (em dB)
    UNIQUENESS_TOLERANCE: 0.5,
    
    // Mínimo de bandas válidas para exibir o bloco
    MINIMUM_VALID_BANDS: 2,
    
    // Threshold para bandas válidas (% de bandas que devem ter valores válidos)
    VALID_BANDS_THRESHOLD: 0.6, // 60% das bandas devem ser válidas
    
    // Valor mínimo sensato para RMS (dB) - valores muito baixos são suspeitos
    MIN_SENSIBLE_RMS_DB: -80,
    
    // Valor máximo sensato para RMS (dB) - valores muito altos são suspeitos  
    MAX_SENSIBLE_RMS_DB: 20,
    
    // Debug logs
    DEBUG: false
};

/**
 * 🧪 Validar dados de bandas espectrais
 * @param {Object} tonalBalance - Objeto tonalBalance do resultado da análise
 * @returns {Object} Resultado da validação com detalhes
 */
function validateSpectralBandsData(tonalBalance) {
    const startTime = performance.now();
    const result = {
        isValid: false,
        shouldDisplay: false,
        validBands: [],
        invalidBands: [],
        issues: [],
        stats: {
            totalBands: 0,
            validCount: 0,
            invalidCount: 0,
            uniqueValues: 0,
            validationTime: 0
        }
    };

    // 🔍 Validação básica de entrada
    if (!tonalBalance || typeof tonalBalance !== 'object') {
        result.issues.push('tonalBalance_missing_or_invalid');
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🔍 [TONAL-SAFE] Dados ausentes ou inválidos:', tonalBalance);
        }
        result.stats.validationTime = performance.now() - startTime;
        return result;
    }

    // 🎯 Mapear e validar bandas conhecidas
    const expectedBands = ['sub', 'low', 'mid', 'high'];
    const validValues = [];
    
    expectedBands.forEach(bandKey => {
        const band = tonalBalance[bandKey];
        result.stats.totalBands++;
        
        // Verificar se a banda existe e tem estrutura válida
        if (!band || typeof band !== 'object' || !Number.isFinite(band.rms_db)) {
            result.invalidBands.push({
                key: bandKey,
                reason: 'missing_or_invalid_structure',
                data: band
            });
            result.stats.invalidCount++;
            return;
        }
        
        const rmsDb = band.rms_db;
        
        // Verificar se o valor está em uma faixa sensata
        if (rmsDb < TONAL_BALANCE_CONFIG.MIN_SENSIBLE_RMS_DB || 
            rmsDb > TONAL_BALANCE_CONFIG.MAX_SENSIBLE_RMS_DB ||
            rmsDb === -Infinity || rmsDb === Infinity) {
            result.invalidBands.push({
                key: bandKey,
                reason: 'value_out_of_range',
                value: rmsDb,
                data: band
            });
            result.stats.invalidCount++;
            return;
        }
        
        // Banda é válida
        result.validBands.push({
            key: bandKey,
            value: rmsDb,
            data: band
        });
        validValues.push(rmsDb);
        result.stats.validCount++;
    });

    // 🔢 Verificar unicidade dos valores (detectar repetição suspeita)
    const uniqueValues = new Set();
    validValues.forEach(value => {
        // Agrupar valores muito próximos como "iguais"
        const roundedValue = Math.round(value / TONAL_BALANCE_CONFIG.UNIQUENESS_TOLERANCE) * TONAL_BALANCE_CONFIG.UNIQUENESS_TOLERANCE;
        uniqueValues.add(roundedValue);
    });
    
    result.stats.uniqueValues = uniqueValues.size;
    
    // 🚩 Detectar problemas de repetição
    if (validValues.length >= 2 && uniqueValues.size === 1) {
        result.issues.push('all_values_identical');
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🚨 [TONAL-SAFE] Todos os valores são idênticos:', validValues[0]);
        }
    } else if (validValues.length >= 3 && uniqueValues.size <= 1) {
        result.issues.push('insufficient_value_diversity');
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🚨 [TONAL-SAFE] Diversidade insuficiente de valores:', Array.from(uniqueValues));
        }
    }

    // 🎯 Determinar se deve exibir o bloco
    const hasEnoughValidBands = result.stats.validCount >= TONAL_BALANCE_CONFIG.MINIMUM_VALID_BANDS;
    const hasValidThreshold = (result.stats.validCount / result.stats.totalBands) >= TONAL_BALANCE_CONFIG.VALID_BANDS_THRESHOLD;
    const hasValueDiversity = result.stats.uniqueValues > 1 || result.stats.validCount === 1; // 1 banda é OK
    
    result.isValid = hasEnoughValidBands && hasValidThreshold && hasValueDiversity;
    result.shouldDisplay = result.isValid && result.issues.length === 0;
    
    result.stats.validationTime = performance.now() - startTime;
    
    if (TONAL_BALANCE_CONFIG.DEBUG) {
        console.log('🧪 [TONAL-SAFE] Resultado validação:', {
            shouldDisplay: result.shouldDisplay,
            validCount: result.stats.validCount,
            uniqueValues: result.stats.uniqueValues,
            issues: result.issues,
            validationTime: `${result.stats.validationTime.toFixed(2)}ms`
        });
    }
    
    return result;
}

/**
 * 🎨 Versão segura da função tonalSummary
 * @param {Object} tonalBalance - Dados das bandas espectrais
 * @returns {string} HTML seguro ou "—" se dados insuficientes
 */
function tonalSummarySafe(tonalBalance) {
    // 🚦 Verificar se feature flag está ativa
    if (!window.TONAL_BALANCE_SAFE_V1) {
        // Fallback para versão original se flag desativada
        if (window.tonalSummaryOriginal) {
            return window.tonalSummaryOriginal(tonalBalance);
        }
        // Fallback simples se função original não disponível
        return tonalBalance ? 'Dados disponíveis' : '—';
    }
    
    // 🔍 Validar dados usando sistema seguro
    const validation = validateSpectralBandsData(tonalBalance);
    
    if (!validation.shouldDisplay) {
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🚫 [TONAL-SAFE] Bloco ocultado. Motivos:', validation.issues);
        }
        return '—';
    }
    
    // 🎯 Renderizar apenas bandas válidas
    const parts = [];
    validation.validBands.forEach(band => {
        const label = {
            'sub': 'Sub',
            'low': 'Low', 
            'mid': 'Mid',
            'high': 'High'
        }[band.key] || band.key;
        
        parts.push(`${label} ${band.value.toFixed(1)}dB`);
    });
    
    return parts.length > 0 ? parts.join(' • ') : '—';
}

/**
 * 🔄 Sistema de migração automática
 * Substitui a função tonalSummary original de forma segura
 */
function applyTonalBalanceSafeMigration() {
    // Verificar se a migração já foi aplicada
    if (window.tonalBalanceSafeMigrationApplied) {
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🔄 [TONAL-SAFE] Migração já aplicada, pulando');
        }
        return;
    }
    
    try {
        // 🔍 Procurar e substituir funções tonalSummary existentes
        const possibleLocations = [
            'tonalSummary', // Global
            'window.tonalSummary' // Window object
        ];
        
        let migratedCount = 0;
        
        possibleLocations.forEach(location => {
            try {
                const parts = location.split('.');
                let obj = window;
                
                // Navegar até o objeto pai
                for (let i = 0; i < parts.length - 1; i++) {
                    if (obj[parts[i]]) {
                        obj = obj[parts[i]];
                    } else {
                        return; // Caminho não existe
                    }
                }
                
                const funcName = parts[parts.length - 1];
                
                if (typeof obj[funcName] === 'function') {
                    // Salvar função original antes de substituir
                    if (!window.tonalSummaryOriginal) {
                        window.tonalSummaryOriginal = obj[funcName];
                    }
                    
                    // Substituir pela versão segura
                    obj[funcName] = tonalSummarySafe;
                    migratedCount++;
                    
                    if (TONAL_BALANCE_CONFIG.DEBUG) {
                        console.log(`✅ [TONAL-SAFE] Migrada função: ${location}`);
                    }
                }
            } catch (error) {
                if (TONAL_BALANCE_CONFIG.DEBUG) {
                    console.warn(`⚠️ [TONAL-SAFE] Erro migrando ${location}:`, error);
                }
            }
        });
        
        // Marcar migração como aplicada
        window.tonalBalanceSafeMigrationApplied = true;
        
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log(`🎯 [TONAL-SAFE] Migração completa. ${migratedCount} função(ões) migrada(s)`);
        }
        
    } catch (error) {
        console.error('🚨 [TONAL-SAFE] Erro na migração automática:', error);
    }
}

/**
 * 🧪 Função de teste para validar o sistema
 */
function testTonalBalanceSafe() {
    console.group('🧪 TESTE TONAL BALANCE SAFE V1');
    
    // Casos de teste
    const testCases = [
        {
            name: 'Dados válidos e distintos',
            data: {
                sub: { rms_db: -15.2 },
                low: { rms_db: -8.7 },
                mid: { rms_db: -6.8 },
                high: { rms_db: -11.2 }
            },
            esperado: 'exibir'
        },
        {
            name: 'Todos valores iguais (suspeito)',
            data: {
                sub: { rms_db: -14.0 },
                low: { rms_db: -14.0 },
                mid: { rms_db: -14.0 },
                high: { rms_db: -14.0 }
            },
            esperado: 'ocultar'
        },
        {
            name: 'Dados parciais válidos',
            data: {
                sub: { rms_db: -15.2 },
                low: { rms_db: -8.7 },
                mid: null,
                high: { rms_db: -11.2 }
            },
            esperado: 'exibir'
        },
        {
            name: 'Dados insuficientes',
            data: {
                sub: { rms_db: -15.2 },
                low: null,
                mid: null,
                high: null
            },
            esperado: 'ocultar'
        },
        {
            name: 'Dados completamente ausentes',
            data: null,
            esperado: 'ocultar'
        }
    ];
    
    let passedTests = 0;
    
    testCases.forEach((testCase, index) => {
        console.log(`\n🔍 Teste ${index + 1}: ${testCase.name}`);
        
        const validation = validateSpectralBandsData(testCase.data);
        const result = tonalSummarySafe(testCase.data);
        
        const shouldDisplay = testCase.esperado === 'exibir';
        const actuallyDisplays = result !== '—';
        
        const passed = shouldDisplay === actuallyDisplays;
        
        if (passed) {
            passedTests++;
            console.log(`✅ PASSOU: ${result}`);
        } else {
            console.log(`❌ FALHOU: Esperado ${testCase.esperado}, obteve: ${result}`);
        }
        
        console.log(`   Stats: ${validation.stats.validCount}/${validation.stats.totalBands} válidas, ${validation.stats.uniqueValues} únicas`);
    });
    
    console.log(`\n🎯 RESULTADO: ${passedTests}/${testCases.length} testes passaram`);
    console.groupEnd();
    
    return passedTests === testCases.length;
}

/**
 * 🚀 Inicialização automática
 */
function initializeTonalBalanceSafe() {
    if (!window.TONAL_BALANCE_SAFE_V1) {
        if (TONAL_BALANCE_CONFIG.DEBUG) {
            console.log('🚫 [TONAL-SAFE] Feature flag desativada, sistema não inicializado');
        }
        return;
    }
    
    console.log('🛡️ [TONAL-SAFE] Inicializando sistema seguro para bandas espectrais...');
    
    // Aplicar migração automática
    applyTonalBalanceSafeMigration();
    
    // Expor funções para uso externo
    window.validateSpectralBandsData = validateSpectralBandsData;
    window.tonalSummarySafe = tonalSummarySafe;
    window.testTonalBalanceSafe = testTonalBalanceSafe;
    
    console.log('✅ [TONAL-SAFE] Sistema inicializado com sucesso!');
    console.log('💡 Execute no console: testTonalBalanceSafe()');
}

// 🎯 Auto-inicialização quando o script carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTonalBalanceSafe);
} else {
    // DOM já carregado
    initializeTonalBalanceSafe();
}

// 🔄 Também tentar inicializar após um delay para garantir que outras dependências carregaram
setTimeout(initializeTonalBalanceSafe, 1000);
