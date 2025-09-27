// 🔍 TESTE DIAGNÓSTICO - Verificar se JSON está com caps aplicados
// Simula um processamento real para ver o que está sendo enviado ao frontend

import { generateJSONOutput } from './work/api/audio/json-output.js';

console.log('🔍 DIAGNÓSTICO: Verificando se JSON tem caps aplicados...\n');

// Mock realístico baseado na imagem (Funk Mandela)
const mockCoreMetrics = {
  lufs: {
    integrated: -6.2,
    shortTerm: -5.8,
    momentary: -5.2,
    range: 13.27,
    _status: 'calculated'
  },
  
  truePeak: {
    dbtp: -0.8,
    _status: 'calculated'
  },
  
  dynamicRange: {
    value: 7.3,
    _status: 'calculated'
  },
  
  stereo: {
    correlation: 0.86,
    _status: 'calculated'
  },
  
  // Bandas com valores similares à imagem
  spectral_balance: {
    _status: 'calculated',
    sub: { energy_db: -14.30, percentage: 8.5, range: "20-60Hz" },
    bass: { energy_db: -21.70, percentage: 6.2, range: "60-150Hz" },
    lowMid: { energy_db: -26.20, percentage: 4.1, range: "150-500Hz" },
    mid: { energy_db: -31.20, percentage: 2.8, range: "500-2000Hz" },
    highMid: { energy_db: -35.40, percentage: 1.9, range: "2-5kHz" },
    presence: { energy_db: -39.00, percentage: 1.2, range: "5-10kHz" },
    air: { energy_db: -45.70, percentage: 0.5, range: "10-20kHz" }
  }
};

try {
  const jsonResult = generateJSONOutput(mockCoreMetrics, null, {}, {
    genre: 'funk_mandela',
    fileName: 'teste-interface.wav',
    jobId: 'test-interface-001'
  });

  console.log('✅ JSON gerado com sucesso!');
  
  if (jsonResult.referenceComparison) {
    console.log('\n🎯 ANÁLISE DO REFERENCE COMPARISON:');
    console.log('─'.repeat(60));
    
    const spectralItems = jsonResult.referenceComparison.filter(item => 
      item.category === 'spectral_bands'
    );
    
    if (spectralItems.length > 0) {
      console.log(`Encontrados ${spectralItems.length} itens espectrais:\n`);
      
      spectralItems.forEach((item, i) => {
        console.log(`${i + 1}. ${item.metric}:`);
        console.log(`   📊 Valor atual: ${item.value} dB`);
        console.log(`   🎯 Valor ideal: ${item.ideal} dB`);
        
        if (item.delta_real !== undefined) {
          console.log(`   📈 Delta bruto: ${item.delta_real.toFixed(1)} dB`);
        }
        
        if (item.delta_shown !== undefined) {
          console.log(`   ✅ Delta exibido: ${item.delta_shown.toFixed(1)} dB`);
        }
        
        if (item.note) {
          console.log(`   📝 Nota: ${item.note}`);
        }
        
        console.log(`   🚩 Foi capado: ${item.delta_capped ? 'SIM' : 'NÃO'}`);
        console.log('');
      });
      
      // Verificar se algum delta_shown excede ±6 dB
      const exceedsLimit = spectralItems.some(item => 
        Math.abs(item.delta_shown || 0) > 6
      );
      
      console.log('🔍 DIAGNÓSTICO:');
      console.log(`   Algum delta_shown excede ±6 dB: ${exceedsLimit ? '❌ SIM' : '✅ NÃO'}`);
      
      if (exceedsLimit) {
        console.log('   ⚠️ PROBLEMA: JSON ainda tem valores > ±6 dB');
        console.log('   📋 Valores problemáticos:');
        spectralItems.forEach(item => {
          if (Math.abs(item.delta_shown || 0) > 6) {
            console.log(`      - ${item.metric}: ${item.delta_shown.toFixed(1)} dB`);
          }
        });
      } else {
        console.log('   ✅ SUCESSO: Todos os delta_shown estão dentro de ±6 dB');
      }
      
    } else {
      console.log('❌ Nenhum item espectral encontrado na referência');
    }
  } else {
    console.log('❌ Nenhum referenceComparison encontrado no JSON');
  }
  
  console.log('\n🎯 CONCLUSÃO:');
  console.log('─'.repeat(60));
  console.log('Se o frontend está mostrando valores > ±6 dB, pode ser que:');
  console.log('1. O frontend está usando delta_real em vez de delta_shown');
  console.log('2. O frontend não está recebendo os dados atualizados');
  console.log('3. O cache do browser precisa ser limpo');
  console.log('4. O frontend precisa ser atualizado para usar os novos campos');

} catch (error) {
  console.error('❌ Erro no diagnóstico:', error.message);
  console.error('Stack:', error.stack);
}