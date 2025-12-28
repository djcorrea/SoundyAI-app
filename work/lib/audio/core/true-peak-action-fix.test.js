/**
 * 🧪 TESTE: Correção da coluna "Ação sugerida" para True Peak
 * 
 * Bug corrigido: quando TP > 0.0 dBTP, a ação deve mostrar redução até o TARGET,
 * não até 0.0 (hardCap), para consistência com a coluna "Diferença".
 */

import { compareWithTargets } from './compareWithTargets.js';

async function testTruePeakActionFix() {
  console.log('\n🧪 TESTE: True Peak - Ação Sugerida com Target Correto\n');
  
  const testCases = [
    { value: 1.6, target: -0.2, expectedDelta: 1.8 },
    { value: 3.1, target: -0.5, expectedDelta: 3.6 },
    { value: 6.0, target: -1.0, expectedDelta: 7.0 }
  ];
  
  testCases.forEach((testCase, index) => {
    const { value, target, expectedDelta } = testCase;
    
    // Simular metrics com True Peak acima de 0.0
    const mockMetrics = {
      truePeakDbtp: value,
      lufsIntegrated: -10,
      dr: 8,
      lra: 5,
      stereoWidth: 50
    };
    
    // Simular targets com target específico
    const mockTargets = {
      truePeak: {
        target: target,
        min: -3.0,
        max: 0.0,
        hardCap: 0.0,
        warnFrom: -0.5
      },
      lufs: { target: -14, min: -16, max: -12 },
      dr: { target: 8, min: 6, max: 12 },
      lra: { target: 6, min: 4, max: 10 },
      stereo: { target: 50, min: 30, max: 70 }
    };
    
    // Executar comparação
    const result = compareWithTargets(mockMetrics, mockTargets, 'reference');
    
    // Encontrar row de True Peak
    const tpRow = result.rows.find(r => r.key === 'truePeak');
    
    if (!tpRow) {
      console.log(`❌ Caso ${index + 1}: Row de True Peak não encontrada`);
      return;
    }
    
    // Validar
    const diffValue = tpRow.diff;
    const actionText = tpRow.action;
    
    // Extrair valor da ação (formato: "🔴 CLIPPING! Reduzir X.X dBTP")
    const actionRegex = actionText.match(/Reduzir ([\d.]+)/);
    const actionDelta = actionRegex ? parseFloat(actionRegex[1]) : null;
    
    console.log(`📊 Caso ${index + 1}:`);
    console.log(`   Value: ${value} dBTP | Target: ${target} dBTP`);
    console.log(`   Diferença (coluna): ${diffValue.toFixed(1)} dB`);
    console.log(`   Ação: ${actionText}`);
    console.log(`   Delta extraído: ${actionDelta} dB`);
    console.log(`   Esperado: ${expectedDelta.toFixed(1)} dB`);
    
    // Verificar consistência
    const isDiffMatch = Math.abs(diffValue - expectedDelta) < 0.01;
    const isActionMatch = Math.abs(actionDelta - expectedDelta) < 0.01;
    
    if (isDiffMatch && isActionMatch) {
      console.log(`   ✅ CORRETO: Diferença e Ação consistentes!\n`);
    } else {
      console.log(`   ❌ ERRO: Valores inconsistentes!`);
      if (!isDiffMatch) console.log(`      - Diferença: esperado ${expectedDelta}, obtido ${diffValue}`);
      if (!isActionMatch) console.log(`      - Ação: esperado ${expectedDelta}, obtido ${actionDelta}\n`);
    }
  });
  
  console.log('🏁 Teste completo\n');
}

// Executar teste
testTruePeakActionFix();

export { testTruePeakActionFix };
