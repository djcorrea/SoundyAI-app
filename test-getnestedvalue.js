// Teste da função getNestedValue para verificar problema

const testData = {
    technicalData: {
        truePeakDbtp: -3.1,
        lufsIntegrated: -14.2
    },
    metrics: {
        truePeakDbtp: -3.1,
        lufs_integrated: -14.2
    }
};

const getNestedValue = (obj, path) => {
    console.log('🔍 getNestedValue chamada:', { obj: Object.keys(obj || {}), path });
    const result = path.split('.').reduce((current, key) => {
        console.log(`  - Acessando "${key}" em:`, current);
        return current?.[key];
    }, obj);
    console.log('  ✅ Resultado:', result);
    return result;
};

console.log('=== TESTE getNestedValue ===');
console.log('1. truePeakDbtp em technicalData:', getNestedValue(testData.technicalData, 'truePeakDbtp'));
console.log('2. truePeakDbtp em metrics:', getNestedValue(testData.metrics, 'truePeakDbtp'));
console.log('3. Path com ponto:', getNestedValue(testData, 'technicalData.truePeakDbtp'));

// Teste se Number.isFinite funciona
console.log('=== TESTE Number.isFinite ===');
console.log('Number.isFinite(-3.1):', Number.isFinite(-3.1));
console.log('Number.isFinite(null):', Number.isFinite(null));
console.log('Number.isFinite(undefined):', Number.isFinite(undefined));
console.log('Number.isFinite("--"):', Number.isFinite("--"));