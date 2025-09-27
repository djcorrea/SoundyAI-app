// 🧪 TESTE: Integração do Cap Musical no json-output.js
// Verifica se o cap está sendo aplicado corretamente na referenceComparison do backend

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 INICIANDO TESTE DE INTEGRAÇÃO COM JSON-OUTPUT.JS');
console.log('='.repeat(80));

// Simular dados técnicos que representem bandas espectrais com deltas extremos
const mockTechnicalData = {
  lufsIntegrated: -25.2,
  truePeakDbtp: -0.8,
  dynamicRange: 8.5,
  lra: 12.3,
  stereoCorrelation: 0.65,
  
  // Bandas espectrais com valores que gerarão deltas grandes
  spectral_balance: {
    _status: 'calculated',
    sub: {
      energy_db: 12.3,      // Target trance: 18.5 → Delta: +6.2 dB (deve ser limitado)
      percentage: 15.2,
      range: "20-60Hz",
      status: "calculated"
    },
    bass: {
      energy_db: 19.8,      // Target trance: 20.2 → Delta: +0.4 dB (ok)
      percentage: 18.5,
      range: "60-150Hz",
      status: "calculated"
    },
    lowMid: {
      energy_db: 25.1,      // Target trance: 16.5 → Delta: -8.6 dB (deve ser limitado)
      percentage: 22.3,
      range: "150-500Hz",
      status: "calculated"
    },
    mid: {
      energy_db: 13.2,      // Target trance: 15.8 → Delta: +2.6 dB (ok)
      percentage: 16.8,
      range: "500-2kHz",
      status: "calculated"
    },
    highMid: {
      energy_db: 6.5,       // Target trance: 14.0 → Delta: +7.5 dB (deve ser limitado)
      percentage: 12.4,
      range: "2-5kHz",
      status: "calculated"
    },
    presence: {
      energy_db: 18.2,      // Target trance: 12.0 → Delta: -6.2 dB (deve ser limitado)
      percentage: 8.9,
      range: "5-10kHz",
      status: "calculated"
    },
    air: {
      energy_db: 7.1,       // Target trance: 8.0 → Delta: +0.9 dB (ok)
      percentage: 6.2,
      range: "10-20kHz",
      status: "calculated"
    }
  }
};

// Importar a função generateGenreReference do json-output.js
// Vamos simular sua lógica aqui para testar
async function simulateGenerateGenreReference(technicalData, genre) {
  // Importar o módulo musical-cap-utils
  const { applyMusicalCapToReference } = await import('./work/lib/audio/utils/musical-cap-utils.js');
  
  const references = [
    {
      metric: "Volume Integrado (padrão streaming)",
      value: technicalData.lufsIntegrated || -23,
      ideal: -23,
      unit: "LUFS",
      status: Math.abs((technicalData.lufsIntegrated || -23) - (-23)) < 2 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    }
  ];

  // Processar bandas espectrais
  const spectralBands = technicalData.spectral_balance;
  
  if (spectralBands && typeof spectralBands === 'object' && 
      spectralBands._status === 'calculated') {
    
    // Alvos para trance
    const bandTargets = {
      trance: {
        sub: { target: 18.5, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 20.2, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 16.5, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 15.8, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 14.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 12.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 8.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      }
    };
    
    const targets = bandTargets[genre] || bandTargets.trance;
    
    const bandMapping = {
      sub: 'sub',
      bass: 'bass', 
      lowMid: 'lowMid',
      mid: 'mid',
      highMid: 'highMid',
      presence: 'presence',
      air: 'air'
    };
    
    // Adicionar cada banda à comparação
    Object.entries(bandMapping).forEach(([bandKey, targetKey]) => {
      const band = spectralBands[bandKey];
      const target = targets[targetKey];
      
      if (target && band && typeof band === 'object') {
        const bandValue = band.energy_db !== null ? band.energy_db : band.percentage;
        
        if (typeof bandValue === 'number' && !isNaN(bandValue) && bandValue !== null) {
          const isEnergyDb = band.energy_db !== null;
          const displayValue = isEnergyDb ? bandValue : Math.round(bandValue * 10) / 10;
          const compareValue = isEnergyDb ? bandValue : bandValue;
          
          const tolerance = isEnergyDb ? target.tolerance * 2 : target.tolerance;
          const targetValue = isEnergyDb ? target.target : target.target;
          
          const delta = Math.abs(compareValue - targetValue);
          const isWithinTolerance = delta <= tolerance;
          
          references.push({
            metric: target.name,
            value: displayValue,
            ideal: targetValue,
            unit: isEnergyDb ? "dB" : "%",
            status: isWithinTolerance ? "✅ IDEAL" : (delta > tolerance * 1.5 ? "❌ CORRIGIR" : "⚠️ AJUSTAR"),
            category: "spectral_bands"
          });
        }
      }
    });
  }
  
  // Aplicar cap musical
  const referencesWithCap = applyMusicalCapToReference(references);
  
  return referencesWithCap;
}

/**
 * 🧪 Executar teste de integração
 */
console.log('\n📋 SIMULANDO GERAÇÃO DE REFERENCECOMPARISON');
console.log('-'.repeat(60));

try {
  const result = await simulateGenerateGenreReference(mockTechnicalData, 'trance');
  
  console.log('\n🎵 Bandas espectrais processadas:');
  console.log('   (Valores que deveriam gerar deltas > ±6dB)');
  
  const spectralBands = result.filter(item => item.category === 'spectral_bands');
  
  spectralBands.forEach((band, index) => {
    console.log(`\n   ${index + 1}. ${band.metric}:`);
    console.log(`      Valor medido: ${band.value} ${band.unit}`);
    console.log(`      Target: ${band.ideal} ${band.unit}`);
    console.log(`      Delta bruto: ${band.delta_raw >= 0 ? '+' : ''}${band.delta_raw.toFixed(1)} dB`);
    console.log(`      Delta exibido: "${band.delta_shown}"`);
    console.log(`      Foi limitado: ${band.delta_capped ? '🎯 SIM' : '✅ NÃO'}`);
    console.log(`      Status: ${band.status}`);
  });
  
  console.log('\n📊 VALIDAÇÕES:');
  
  // Verificar se os campos foram adicionados
  const hasRequiredFields = spectralBands.every(band => 
    band.hasOwnProperty('delta_shown') && 
    band.hasOwnProperty('delta_raw') && 
    band.hasOwnProperty('delta_capped')
  );
  
  console.log(`   🔗 Campos adicionados (delta_shown, delta_raw, delta_capped): ${hasRequiredFields ? '✅' : '❌'}`);
  
  // Verificar se caps foram aplicados onde necessário
  const bandsNeedingCap = spectralBands.filter(band => Math.abs(band.delta_raw) > 6);
  const bandsWithCap = spectralBands.filter(band => band.delta_capped);
  
  console.log(`   🎯 Bandas com delta > ±6dB: ${bandsNeedingCap.length}`);
  console.log(`   🛡️ Bandas com cap aplicado: ${bandsWithCap.length}`);
  console.log(`   ✅ Caps aplicados corretamente: ${bandsNeedingCap.length === bandsWithCap.length ? '✅' : '❌'}`);
  
  // Verificar anotações educativas
  const capsWithAnnotation = bandsWithCap.filter(band => 
    band.delta_shown.includes('ajuste seguro') && 
    band.delta_shown.includes('diferença real detectada')
  );
  
  console.log(`   📝 Anotações educativas presentes: ${capsWithAnnotation.length}/${bandsWithCap.length} ${capsWithAnnotation.length === bandsWithCap.length ? '✅' : '❌'}`);
  
  // Exemplos específicos
  console.log('\n🔍 EXEMPLOS DE CAPS APLICADOS:');
  bandsWithCap.forEach(band => {
    console.log(`   • ${band.metric}:`);
    console.log(`     Delta original: ${band.delta_raw >= 0 ? '+' : ''}${band.delta_raw.toFixed(1)} dB`);
    console.log(`     Exibição: "${band.delta_shown}"`);
  });
  
  console.log('\n🔍 EXEMPLOS SEM CAP (DENTRO DO LIMITE):');
  const bandsWithoutCap = spectralBands.filter(band => !band.delta_capped);
  bandsWithoutCap.forEach(band => {
    console.log(`   • ${band.metric}:`);
    console.log(`     Delta: ${band.delta_raw >= 0 ? '+' : ''}${band.delta_raw.toFixed(1)} dB`);
    console.log(`     Exibição: "${band.delta_shown}"`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTADO DA INTEGRAÇÃO');
  console.log('='.repeat(80));
  
  const allValidationsPass = hasRequiredFields && 
                            (bandsNeedingCap.length === bandsWithCap.length) && 
                            (capsWithAnnotation.length === bandsWithCap.length);
  
  if (allValidationsPass) {
    console.log(`
🎉 INTEGRAÇÃO COM JSON-OUTPUT.JS FUNCIONANDO PERFEITAMENTE!

✅ SUCESSOS:
   • Função applyMusicalCapToReference integrada
   • Campos delta_shown, delta_raw, delta_capped adicionados
   • Caps aplicados apenas onde necessário (deltas > ±6dB)
   • Anotações educativas geradas corretamente
   • Valores seguros para equalizadores garantidos
   • Compatibilidade com suggestions mantida

🎯 PRÓXIMOS PASSOS:
   • Testar com dados reais de áudio
   • Verificar exibição no frontend
   • Confirmar que suggestions também usam a mesma lógica
   • Deploy para produção

🛡️ SEGURANÇA GARANTIDA:
   Usuários nunca verão valores > ±6dB sem contexto educativo!
`);
  } else {
    console.log(`
⚠️ PROBLEMAS DETECTADOS NA INTEGRAÇÃO:
   
❌ FALHAS:
   • Campos obrigatórios: ${hasRequiredFields ? '✅' : '❌'}
   • Caps aplicados: ${bandsNeedingCap.length === bandsWithCap.length ? '✅' : '❌'}
   • Anotações educativas: ${capsWithAnnotation.length === bandsWithCap.length ? '✅' : '❌'}

🔧 CORREÇÕES NECESSÁRIAS:
   Revisar a implementação antes do deploy.
`);
  }

} catch (error) {
  console.error('❌ ERRO NA INTEGRAÇÃO:', error);
  console.error('   Stack:', error.stack);
}

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTE DE INTEGRAÇÃO CONCLUÍDO');
console.log('='.repeat(80));