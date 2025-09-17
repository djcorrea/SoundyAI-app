// 🧪 Script de Teste das Correções do Sistema de Scoring
// Abrir no Console do DevTools para executar

console.log('🧪 Iniciando testes das correções do sistema de scoring...');

// Teste 1: Função calculateMetricScore
console.log('\n📐 Teste 1: calculateMetricScore');

function testMetricScore() {
    const tests = [
        { actual: -14.0, target: -14.0, tolerance: 2.0, expected: 100, desc: 'Valor exato no alvo' },
        { actual: -15.0, target: -14.0, tolerance: 2.0, expected: 50, desc: 'Metade da tolerância' },
        { actual: -16.0, target: -14.0, tolerance: 2.0, expected: 0, desc: 'No limite da tolerância' },
        { actual: -17.0, target: -14.0, tolerance: 2.0, expected: 0, desc: 'Fora da tolerância' },
        { actual: -14.5, target: -14.0, tolerance: 2.0, expected: 75, desc: 'Valor contínuo (25% do erro)' }
    ];
    
    tests.forEach((test, i) => {
        const result = calculateMetricScore(test.actual, test.target, test.tolerance);
        const pass = Math.abs(result - test.expected) < 0.01;
        console.log(`  ${pass ? '✅' : '❌'} ${test.desc}: ${result} (esperado: ${test.expected})`);
    });
}

testMetricScore();

// Teste 2: Frequência Score com bandas mistas
console.log('\n🎵 Teste 2: calculateFrequencyScore');

function testFrequencyScore() {
    // Referência simulada
    const refData = {
        bands: {
            sub: { target_db: -25.0, tol_db: 3.0 },
            low_bass: { target_db: -22.0, tol_db: 3.0 },
            low_mid: { target_db: -18.0, tol_db: 2.5 },
            mid: { target_db: -15.0, tol_db: 2.0 },
            high_mid: { target_db: -18.0, tol_db: 2.5 },
            presenca: { target_db: -20.0, tol_db: 3.0 },
            brilho: { target_db: -25.0, tol_db: 4.0 }
        }
    };
    
    // Análise com algumas bandas perfeitas, outras fora
    const analysis = {
        metrics: {
            bands: {
                sub: { energy_db: -25.0 },       // Perfeito = 100
                bass: { energy_db: -23.5 },      // Delta 1.5, tol 3 = 50
                lowMid: { energy_db: -20.5 },    // Delta 2.5, tol 2.5 = 0 (no limite)
                mid: { energy_db: -15.0 },       // Perfeito = 100
                highMid: { energy_db: -16.0 },   // Delta 2, tol 2.5 = 20
                presence: { energy_db: -17.0 },  // Delta 3, tol 3 = 0 (no limite)
                air: { energy_db: -27.0 }        // Delta 2, tol 4 = 50
            }
        }
    };
    
    const freqScore = calculateFrequencyScore(analysis, refData);
    
    console.log('  Bandas individuais:');
    const bandScores = [];
    Object.entries({
        'sub': 'sub', 'bass': 'low_bass', 'lowMid': 'low_mid',
        'mid': 'mid', 'highMid': 'high_mid', 'presence': 'presenca', 'air': 'brilho'
    }).forEach(([calc, ref]) => {
        const value = analysis.metrics.bands[calc].energy_db;
        const target = refData.bands[ref].target_db;
        const tolerance = refData.bands[ref].tol_db;
        const score = calculateMetricScore(value, target, tolerance);
        bandScores.push(score);
        console.log(`    ${calc}: ${value}dB vs ${target}dB (±${tolerance}dB) = ${score}%`);
    });
    
    const expectedAvg = Math.round(bandScores.reduce((a, b) => a + b, 0) / bandScores.length);
    console.log(`  📊 Score calculado: ${freqScore}% (esperado: ${expectedAvg}%)`);
    console.log(`  ✅ Teste frequência: ${freqScore === expectedAvg ? 'PASSOU' : 'FALHOU'}`);
    
    // Verificação crítica: não deve ser 100 se algumas bandas estão ruins
    const hasLowScores = bandScores.some(s => s < 50);
    const shouldNotBe100 = hasLowScores && freqScore !== 100;
    console.log(`  🔍 Verificação crítica (não deve ser 100 se bandas ruins): ${shouldNotBe100 ? 'PASSOU' : 'FALHOU'}`);
}

testFrequencyScore();

// Teste 3: Score Final
console.log('\n🏆 Teste 3: Score Final Contínuo');

function testFinalScore() {
    // Dados que resultarão em scores não-redondos
    const mockRef = {
        lufs_target: -14.0, tol_lufs: 2.0,
        true_peak_target: -1.0, tol_true_peak: 0.5,
        dr_target: 8.0, tol_dr: 2.0,
        stereo_target: 0.85, tol_stereo: 0.15,
        bands: {
            sub: { target_db: -25.0, tol_db: 3.0 },
            low_bass: { target_db: -22.0, tol_db: 3.0 },
            low_mid: { target_db: -18.0, tol_db: 2.5 },
            mid: { target_db: -15.0, tol_db: 2.0 },
            high_mid: { target_db: -18.0, tol_db: 2.5 },
            presenca: { target_db: -20.0, tol_db: 3.0 },
            brilho: { target_db: -25.0, tol_db: 4.0 }
        }
    };
    
    const mockAnalysis = {
        metrics: {
            lufs_integrated: -14.5,     // Score = 75
            true_peak_dbtp: -1.2,       // Score = 60
            dynamic_range: 7.0,         // Score = 50
            stereo_correlation: 0.80,   // Score ≈ 66.67
            bands: {
                sub: { energy_db: -25.0 },
                bass: { energy_db: -22.0 },
                lowMid: { energy_db: -18.0 },
                mid: { energy_db: -15.0 },
                highMid: { energy_db: -18.0 },
                presence: { energy_db: -20.0 },
                air: { energy_db: -25.0 }
            }
        },
        technicalData: {},
        issues: []
    };
    
    const scores = calculateAnalysisScores(mockAnalysis, mockRef, 'default');
    
    console.log('  Sub-scores calculados:');
    console.log(`    Loudness: ${scores.loudness}%`);
    console.log(`    Frequência: ${scores.frequencia}%`);
    console.log(`    Estéreo: ${scores.estereo}%`);
    console.log(`    Dinâmica: ${scores.dinamica}%`);
    console.log(`    Técnico: ${scores.tecnico}%`);
    console.log(`    FINAL: ${scores.final}%`);
    
    // Verificações
    const isNotRounded = scores.final !== 0 && scores.final !== 50 && scores.final !== 100;
    console.log(`  🔍 Score final não é valor redondo (0, 50, 100): ${isNotRounded ? 'PASSOU' : 'FALHOU'}`);
    
    const isReasonable = scores.final >= 30 && scores.final <= 90;
    console.log(`  🔍 Score final está em faixa razoável (30-90): ${isReasonable ? 'PASSOU' : 'FALHOU'}`);
    
    const hasAllScores = scores.loudness !== null && scores.frequencia !== null && 
                        scores.estereo !== null && scores.dinamica !== null && scores.tecnico !== null;
    console.log(`  🔍 Todos os sub-scores foram calculados: ${hasAllScores ? 'PASSOU' : 'FALHOU'}`);
}

testFinalScore();

console.log('\n🎯 Testes concluídos! Verifique os resultados acima.');
console.log('Para teste interativo, visite: /test-scoring-corrections.html');