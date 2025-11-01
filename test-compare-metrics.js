#!/usr/bin/env node

/**
 * 🔬 TESTE DIRETO: Função compareMetrics
 * Testa diretamente a função de comparação
 */

console.log("🧪 TESTE DIRETO: compareMetrics");
console.log("================================");

async function testCompareMetrics() {
  try {
    // Import da função
    const { compareMetrics } = await import("./WORK/api/audio/pipeline-complete.js");
    console.log('✅ compareMetrics importada com sucesso');

    // Dados de teste simulados (estrutura similar ao pipeline real)
    const userMetrics = {
      metrics: {
        loudness: { lufs: -14.5, lra: 8.2 },
        truePeak: { maxTruePeak: -1.2 },
        stereo: { correlation: 0.85, width: 0.7 },
        dynamics: { dr: 7.3, crestFactor: 12.1, lra: 8.2 },
        spectralBands: {
          subBass: 8.5, bass: 15.2, lowMids: 18.3, mids: 22.1,
          highMids: 16.8, presence: 12.4, brilliance: 6.7
        }
      },
      score: 85
    };

    const refMetrics = {
      metrics: {
        loudness: { lufs: -16.1, lra: 6.8 },
        truePeak: { maxTruePeak: -0.8 },
        stereo: { correlation: 0.92, width: 0.8 },
        dynamics: { dr: 9.1, crestFactor: 14.5, lra: 6.8 },
        spectralBands: {
          subBass: 10.2, bass: 17.8, lowMids: 20.1, mids: 19.4,
          highMids: 15.3, presence: 11.2, brilliance: 6.0
        }
      },
      score: 92
    };

    console.log('\n🎧 Executando comparação...');
    const result = await compareMetrics(userMetrics, refMetrics);
    
    console.log('\n✅ RESULTADO DA COMPARAÇÃO:');
    console.log('============================');
    console.log(JSON.stringify(result, null, 2));

    // Validar estrutura do resultado
    if (result.comparison && result.suggestions) {
      console.log('\n✅ Estrutura válida: comparison e suggestions presentes');
    } else {
      console.log('\n❌ Estrutura inválida: campos obrigatórios ausentes');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testCompareMetrics().catch(console.error);