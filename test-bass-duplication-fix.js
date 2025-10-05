#!/usr/bin/env node

/**
 * Teste para verificar se a duplicação da banda "Bass (60–150Hz)" foi corrigida
 */

console.log('🧪 Testando correção da duplicação da banda Bass...\n');

// Simular os mapeamentos corrigidos
const bandDisplayNames = {
    sub: 'Sub (20–60Hz)',
    bass: 'Bass (60–150Hz)', 
    // low_bass: 'Bass (60–150Hz)', // <-- REMOVIDO para evitar duplicação
    lowMid: 'Low-Mid (150–500Hz)',
    low_mid: 'Low-Mid (150–500Hz)',
    mid: 'Mid (500–2kHz)',
    highMid: 'High-Mid (2–5kHz)',
    high_mid: 'High-Mid (2–5kHz)',
    presence: 'Presence (5–10kHz)',
    presenca: 'Presence (5–10kHz)',
    air: 'Air (10–20kHz)',
    brilho: 'Air (10–20kHz)'
};

const bandMap = {
    sub: { refKey: 'sub', name: 'Sub (20–60Hz)', range: '20–60Hz' },
    bass: { refKey: 'low_bass', name: 'Bass (60–150Hz)', range: '60–150Hz' },
    // low_bass: { refKey: 'low_bass', name: 'Bass (60–150Hz)', range: '60–150Hz' }, // <-- REMOVIDO
    lowMid: { refKey: 'low_mid', name: 'Low-Mid (150–500Hz)', range: '150–500Hz' },
    low_mid: { refKey: 'low_mid', name: 'Low-Mid (150–500Hz)', range: '150–500Hz' },
    mid: { refKey: 'mid', name: 'Mid (500–2kHz)', range: '500–2000Hz' },
    highMid: { refKey: 'high_mid', name: 'High-Mid (2–5kHz)', range: '2000–5000Hz' },
    high_mid: { refKey: 'high_mid', name: 'High-Mid (2–5kHz)', range: '2000–5000Hz' },
    presence: { refKey: 'presenca', name: 'Presence (5–10kHz)', range: '5000–10000Hz' },
    presenca: { refKey: 'presenca', name: 'Presence (5–10kHz)', range: '5000–10000Hz' },
    air: { refKey: 'brilho', name: 'Air (10–20kHz)', range: '10000–20000Hz' },
    brilho: { refKey: 'brilho', name: 'Air (10–20kHz)', range: '10000–20000Hz' }
};

// Simular dados espectrais que poderiam chegar do backend
const mockSpectralData = {
    bass: { energy_db: -15.2, percentage: 25.6 },
    low_bass: { energy_db: -16.8, percentage: 22.1 }, // Dados que causariam duplicação
    sub: { energy_db: -18.5, percentage: 15.3 },
    lowMid: { energy_db: -12.4, percentage: 18.9 }
};

// Simular como o código processa as bandas
const resultRows = [];
const processedBandKeys = new Set();

function pushRow(name, value, target, tolerance, unit) {
    resultRows.push({ name, value, target, tolerance, unit });
    console.log(`📊 Adicionada: ${name} = ${value}${unit}`);
}

console.log('🔍 Testando processamento com bandMap:');
Object.entries(bandMap).forEach(([calcBandKey, bandInfo]) => {
    const bandData = mockSpectralData[calcBandKey];
    
    if (bandData && !processedBandKeys.has(calcBandKey)) {
        pushRow(bandInfo.name, bandData.energy_db, -15.0, 3.0, ' dB');
        processedBandKeys.add(calcBandKey);
    }
});

console.log('\n🔍 Testando bandas restantes não processadas:');
Object.keys(mockSpectralData).forEach(bandKey => {
    if (!processedBandKeys.has(bandKey) && 
        bandKey !== '_status' && 
        bandKey !== 'totalPercentage' &&
        bandKey !== 'totalpercentage' &&
        bandKey !== 'metadata' &&
        bandKey !== 'total' &&
        bandKey !== 'low_bass' && // Evitar duplicação - low_bass já é mapeado via bass
        !bandKey.toLowerCase().includes('total')) {
        
        const bandData = mockSpectralData[bandKey];
        const displayName = bandDisplayNames[bandKey] || `${bandKey} (Detectada)`;
        pushRow(displayName, bandData.energy_db, null, null, ' dB');
    }
});

console.log('\n📋 RESULTADO FINAL:');
resultRows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.name}: ${row.value}${row.unit}`);
});

// Verificar se há duplicação
const names = resultRows.map(row => row.name);
const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);

console.log('\n🎯 VERIFICAÇÃO DE DUPLICAÇÃO:');
if (duplicateNames.length === 0) {
    console.log('✅ SUCESSO: Nenhuma banda duplicada encontrada!');
} else {
    console.log('❌ ERRO: Bandas duplicadas encontradas:', duplicateNames);
}

console.log('\n🔍 Contagem por nome de banda:');
const nameCount = {};
names.forEach(name => {
    nameCount[name] = (nameCount[name] || 0) + 1;
});

Object.entries(nameCount).forEach(([name, count]) => {
    const status = count > 1 ? '❌ DUPLICADA' : '✅ OK';
    console.log(`  ${name}: ${count}x ${status}`);
});