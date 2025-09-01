// 🔍 VALIDAÇÃO: Teste corrigido do Genre Switching

console.log('[VALIDATION] 🧪 Testando correção do Genre Switching...');

// Novos dados (favorece Electronic)
const mockData = {
    bandEnergies: {
        sub: { rms_db: -12 },  // Graves muito presentes
        low: { rms_db: -8 },   // Bass forte
        mid: { rms_db: -15 },  // Mid moderado
        high: { rms_db: -20 }  // Agudos suaves
    }
};

// Electronic ref (matches perfeitamente)
const electronicRef = {
    bands: {
        sub: { target_db: -12, tol_db: 3 },  // Exato
        low: { target_db: -8, tol_db: 3 },   // Exato
        mid: { target_db: -14, tol_db: 3 },  // 1dB diff
        high: { target_db: -18, tol_db: 3 }  // 2dB diff
    }
};

// Rock ref (muito fora)
const rockRef = {
    bands: {
        sub: { target_db: -25, tol_db: 3 },  // 13dB diff (muito fora)
        low: { target_db: -18, tol_db: 3 },  // 10dB diff (muito fora)
        mid: { target_db: -10, tol_db: 3 },  // 5dB diff (fora)
        high: { target_db: -12, tol_db: 3 }  // 8dB diff (muito fora)
    }
};

function calculateBandScore(value, reference) {
    const target = reference.target_db;
    const tolerance = reference.tol_db;
    const difference = Math.abs(value - target);
    
    if (difference === 0) {
        return 100;
    } else if (difference <= tolerance) {
        return 100 - (difference / tolerance) * 50;
    } else if (difference < 2 * tolerance) {
        return 50 - ((difference - tolerance) / tolerance) * 50;
    } else {
        return 0;
    }
}

console.log('\n[VALIDATION] 🎵 ELECTRONIC SCORES (optimized for this data):');
const electronicScores = [];
for (const [bandName, bandData] of Object.entries(mockData.bandEnergies)) {
    const bandRef = electronicRef.bands[bandName];
    const score = calculateBandScore(bandData.rms_db, bandRef);
    electronicScores.push(score);
    console.log(`[VALIDATION] ${bandName}: ${bandData.rms_db}dB vs ${bandRef.target_db}dB (±${bandRef.tol_db}) → ${score.toFixed(1)}%`);
}
const electronicAvg = electronicScores.reduce((sum, score) => sum + score, 0) / electronicScores.length;
console.log(`[VALIDATION] 📊 Electronic Average: ${electronicAvg.toFixed(1)}%`);

console.log('\n[VALIDATION] 🎸 ROCK SCORES (not optimized for this data):');
const rockScores = [];
for (const [bandName, bandData] of Object.entries(mockData.bandEnergies)) {
    const bandRef = rockRef.bands[bandName];
    const score = calculateBandScore(bandData.rms_db, bandRef);
    rockScores.push(score);
    const diff = Math.abs(bandData.rms_db - bandRef.target_db);
    console.log(`[VALIDATION] ${bandName}: ${bandData.rms_db}dB vs ${bandRef.target_db}dB (±${bandRef.tol_db}) → ${score.toFixed(1)}% [diff: ${diff}dB]`);
}
const rockAvg = rockScores.reduce((sum, score) => sum + score, 0) / rockScores.length;
console.log(`[VALIDATION] 📊 Rock Average: ${rockAvg.toFixed(1)}%`);

const difference = Math.abs(electronicAvg - rockAvg);
console.log(`\n[VALIDATION] 📈 DIFERENÇA: ${difference.toFixed(1)}%`);
console.log(`[VALIDATION] ✅ Teste passa (>15%)? ${difference > 15 ? 'SIM' : 'NÃO'}`);

if (difference > 15) {
    console.log('\n[VALIDATION] 🎉 CORREÇÃO VÁLIDA!');
    console.log('[VALIDATION] O teste agora distingue claramente entre gêneros');
} else {
    console.log('\n[VALIDATION] ⚠️ AINDA PRECISA AJUSTE');
    console.log('[VALIDATION] Considerar aumentar divergência ou reduzir threshold');
}
