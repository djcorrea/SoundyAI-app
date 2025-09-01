// 🔍 DEBUG: Análise detalhada do teste Genre Switching

console.log('[DEBUG] 🧪 Analisando falha no teste Genre Switching...');

// Dados do teste
const mockData = {
    bandEnergies: {
        sub: { rms_db: -20 },
        low: { rms_db: -10 },
        mid: { rms_db: -8 },
        high: { rms_db: -15 }
    }
};

// Referência Electronic
const electronicRef = {
    bands: {
        sub: { target_db: -18, tol_db: 4 },  // -20 vs -18 = 2dB diff, score: 100 - (2/4)*50 = 75%
        low: { target_db: -8, tol_db: 3 },   // -10 vs -8 = 2dB diff, score: 100 - (2/3)*50 = 66.67%
        mid: { target_db: -10, tol_db: 3 },  // -8 vs -10 = 2dB diff, score: 100 - (2/3)*50 = 66.67%
        high: { target_db: -16, tol_db: 4 }  // -15 vs -16 = 1dB diff, score: 100 - (1/4)*50 = 87.5%
    }
};

// Referência Rock
const rockRef = {
    bands: {
        sub: { target_db: -25, tol_db: 3 },  // -20 vs -25 = 5dB diff, tol=3, diff > tol: 50 - ((5-3)/3)*50 = 16.67%
        low: { target_db: -12, tol_db: 3 },  // -10 vs -12 = 2dB diff, score: 100 - (2/3)*50 = 66.67%
        mid: { target_db: -8, tol_db: 2 },   // -8 vs -8 = 0dB diff, score: 100%
        high: { target_db: -14, tol_db: 3 }  // -15 vs -14 = 1dB diff, score: 100 - (1/3)*50 = 83.33%
    }
};

function calculateBandScore(value, reference) {
    const target = reference.target_db;
    const tolerance = reference.tol_db;
    const difference = Math.abs(value - target);
    
    console.log(`[DEBUG] Banda: value=${value}, target=${target}, tolerance=${tolerance}, diff=${difference}`);
    
    if (difference === 0) {
        console.log(`[DEBUG] → Score: 100% (perfeito)`);
        return 100;
    } else if (difference <= tolerance) {
        const score = 100 - (difference / tolerance) * 50;
        console.log(`[DEBUG] → Score: ${score.toFixed(2)}% (linear 100→50)`);
        return score;
    } else if (difference < 2 * tolerance) {
        const score = 50 - ((difference - tolerance) / tolerance) * 50;
        console.log(`[DEBUG] → Score: ${score.toFixed(2)}% (linear 50→0)`);
        return score;
    } else {
        console.log(`[DEBUG] → Score: 0% (muito fora)`);
        return 0;
    }
}

console.log('\n[DEBUG] 🎵 ELECTRONIC SCORES:');
const electronicScores = [];
for (const [bandName, bandData] of Object.entries(mockData.bandEnergies)) {
    const bandRef = electronicRef.bands[bandName];
    const score = calculateBandScore(bandData.rms_db, bandRef);
    electronicScores.push(score);
    console.log(`[DEBUG] ${bandName}: ${score.toFixed(2)}%`);
}
const electronicAvg = electronicScores.reduce((sum, score) => sum + score, 0) / electronicScores.length;
console.log(`[DEBUG] 📊 Electronic Average: ${electronicAvg.toFixed(2)}%`);

console.log('\n[DEBUG] 🎸 ROCK SCORES:');
const rockScores = [];
for (const [bandName, bandData] of Object.entries(mockData.bandEnergies)) {
    const bandRef = rockRef.bands[bandName];
    const score = calculateBandScore(bandData.rms_db, bandRef);
    rockScores.push(score);
    console.log(`[DEBUG] ${bandName}: ${score.toFixed(2)}%`);
}
const rockAvg = rockScores.reduce((sum, score) => sum + score, 0) / rockScores.length;
console.log(`[DEBUG] 📊 Rock Average: ${rockAvg.toFixed(2)}%`);

const difference = Math.abs(electronicAvg - rockAvg);
console.log(`\n[DEBUG] 📈 DIFERENÇA: ${difference.toFixed(2)}%`);
console.log(`[DEBUG] ✅ Teste passa? ${difference > 10 ? 'SIM' : 'NÃO'}`);

if (difference <= 10) {
    console.log('\n[DEBUG] 🔧 PROBLEMA IDENTIFICADO:');
    console.log('[DEBUG] A diferença entre gêneros é muito pequena!');
    console.log('[DEBUG] Possíveis soluções:');
    console.log('[DEBUG] 1. Usar targets mais divergentes entre gêneros');
    console.log('[DEBUG] 2. Reduzir threshold do teste (ex: > 5 ao invés de > 10)');
    console.log('[DEBUG] 3. Usar dados de teste que favoreçam mais um gênero');
}
