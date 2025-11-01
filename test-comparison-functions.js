#!/usr/bin/env node

/**
 * 🧪 TESTE UNITÁRIO: Funções de Comparação
 * Testa compareMetrics() e generateComparisonSuggestions()
 */

// Simular métricas de exemplo
const mockUserMetrics = {
  score: 8.2,
  loudness: {
    integrated: -14.5,
    shortTerm: -12.3,
    momentary: -10.1,
    lra: 6.2,
    unit: "LUFS"
  },
  truePeak: {
    maxDbtp: -1.2,
    maxLinear: 0.776,
    samplePeakLeft: -2.1,
    samplePeakRight: -1.8
  },
  stereo: {
    correlation: 0.45,
    width: 0.78,
    balance: 0.02,
    monoCompatibility: true
  },
  dynamics: {
    range: 8.5,
    crest: 12.3,
    peakRms: -8.2,
    avgRms: -18.7
  },
  spectralBands: {
    sub: { energy_db: -32.1, percentage: 12.5 },
    bass: { energy_db: -28.4, percentage: 18.2 },
    lowMid: { energy_db: -25.6, percentage: 22.1 },
    mid: { energy_db: -22.8, percentage: 25.3 },
    highMid: { energy_db: -26.2, percentage: 15.8 },
    presence: { energy_db: -30.1, percentage: 4.8 },
    air: { energy_db: -35.6, percentage: 1.3 }
  }
};

const mockRefMetrics = {
  score: 9.1,
  loudness: {
    integrated: -16.2,
    shortTerm: -14.1,
    momentary: -11.8,
    lra: 7.1,
    unit: "LUFS"
  },
  truePeak: {
    maxDbtp: -2.1,
    maxLinear: 0.631,
    samplePeakLeft: -2.8,
    samplePeakRight: -2.5
  },
  stereo: {
    correlation: 0.52,
    width: 0.85,
    balance: -0.01,
    monoCompatibility: true
  },
  dynamics: {
    range: 11.2,
    crest: 14.1,
    peakRms: -6.8,
    avgRms: -19.4
  },
  spectralBands: {
    sub: { energy_db: -34.2, percentage: 10.8 },
    bass: { energy_db: -26.1, percentage: 20.5 },
    lowMid: { energy_db: -23.9, percentage: 24.6 },
    mid: { energy_db: -21.2, percentage: 26.8 },
    highMid: { energy_db: -24.8, percentage: 13.2 },
    presence: { energy_db: -28.9, percentage: 3.6 },
    air: { energy_db: -33.4, percentage: 0.5 }
  }
};

// Simular função compareMetrics para teste
function compareMetrics(userMetrics, refMetrics) {
  console.log("🔍 [Compare] Calculando diferenças entre métricas...");

  const diff = {};

  const categories = ["loudness", "truePeak", "stereo", "dynamics", "spectralBands"];
  for (const key of categories) {
    if (!userMetrics[key] || !refMetrics[key]) continue;

    diff[key] = {};

    if (key === "spectralBands") {
      // Estrutura especial para bandas espectrais
      for (const band in userMetrics[key]) {
        if (userMetrics[key][band] && refMetrics[key][band]) {
          diff[key][band] = {};
          if (typeof userMetrics[key][band].energy_db === "number" && typeof refMetrics[key][band].energy_db === "number") {
            diff[key][band].energy_db = parseFloat((userMetrics[key][band].energy_db - refMetrics[key][band].energy_db).toFixed(2));
          }
          if (typeof userMetrics[key][band].percentage === "number" && typeof refMetrics[key][band].percentage === "number") {
            diff[key][band].percentage = parseFloat((userMetrics[key][band].percentage - refMetrics[key][band].percentage).toFixed(2));
          }
        }
      }
    } else {
      // Estrutura normal para outras métricas
      for (const metric in userMetrics[key]) {
        const userVal = userMetrics[key][metric];
        const refVal = refMetrics[key][metric];

        if (typeof userVal === "number" && typeof refVal === "number") {
          diff[key][metric] = parseFloat((userVal - refVal).toFixed(2));
        }
      }
    }
  }

  // Gerar sugestões
  const suggestions = generateComparisonSuggestions(diff);

  return {
    ok: true,
    mode: "comparison",
    analyzedAt: new Date().toISOString(),
    metricsUser: userMetrics,
    metricsReference: refMetrics,
    comparison: diff,
    suggestions,
  };
}

function generateComparisonSuggestions(diff) {
  const suggestions = [];

  if (diff.loudness && diff.loudness.integrated) {
    if (diff.loudness.integrated < -1) suggestions.push("Aumente o volume geral (LUFS abaixo da referência)");
    if (diff.loudness.integrated > 1) suggestions.push("Reduza o volume geral (LUFS acima da referência)");
  }

  if (diff.truePeak && diff.truePeak.maxDbtp > 1)
    suggestions.push("True Peak está mais alto que a referência — risco de clip digital.");

  if (diff.dynamics && diff.dynamics.range < -2)
    suggestions.push("Dinâmica mais comprimida que a faixa de referência.");

  if (diff.spectralBands && diff.spectralBands.bass && diff.spectralBands.bass.energy_db)
    suggestions.push("Verifique o balanceamento de graves e médios com EQ ou sidechain.");

  if (diff.stereo && diff.stereo.width < -0.1)
    suggestions.push("A faixa tem imagem estéreo mais estreita que a referência.");

  return suggestions;
}

// Executar teste
async function runTest() {
  console.log("🧪 TESTE UNITÁRIO: Funções de Comparação");
  console.log("==========================================");
  
  try {
    const result = compareMetrics(mockUserMetrics, mockRefMetrics);
    
    console.log("✅ RESULTADO DA COMPARAÇÃO:");
    console.log("=====================================");
    console.log(JSON.stringify(result, null, 2));
    
    console.log("\n🎯 SUGESTÕES GERADAS:");
    console.log("=====================================");
    result.suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
    
    console.log("\n📊 PRINCIPAIS DIFERENÇAS:");
    console.log("=====================================");
    if (result.comparison.loudness) {
      console.log(`• LUFS: ${result.comparison.loudness.integrated > 0 ? '+' : ''}${result.comparison.loudness.integrated} LUFS`);
    }
    if (result.comparison.truePeak) {
      console.log(`• True Peak: ${result.comparison.truePeak.maxDbtp > 0 ? '+' : ''}${result.comparison.truePeak.maxDbtp} dBTP`);
    }
    if (result.comparison.dynamics) {
      console.log(`• Dynamic Range: ${result.comparison.dynamics.range > 0 ? '+' : ''}${result.comparison.dynamics.range} dB`);
    }
    if (result.comparison.stereo) {
      console.log(`• Stereo Width: ${result.comparison.stereo.width > 0 ? '+' : ''}${result.comparison.stereo.width}`);
    }
    
  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
  }
}

runTest();