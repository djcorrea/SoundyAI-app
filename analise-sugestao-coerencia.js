// 🎯 ANÁLISE DA SUGESTÃO: "Reduzir sub em -21.3dB (20-60 Hz)"
// Verificando se está coerente com os dados reais

console.log('🔍 ANÁLISE DE COERÊNCIA DA SUGESTÃO');
console.log('='.repeat(50));

// 1. ANÁLISE TÉCNICA DA SUGESTÃO
console.log('📊 SUGESTÃO ANALISADA:');
console.log('   Tipo: Ajuste de Banda (Sub-bass)');
console.log('   Ação: Reduzir em -21.3dB');
console.log('   Faixa: 20-60 Hz');
console.log('   Categoria: AJUSTE DE BANDA');

// 2. VERIFICAÇÃO DE COERÊNCIA
console.log('\n🎯 ANÁLISE DE COERÊNCIA:');

// Problema 1: Magnitude excessiva
console.log('❌ PROBLEMA 1: Magnitude Excessiva');
console.log('   • -21.3dB é uma redução EXTREMA');
console.log('   • Normalmente: -3dB a -6dB já é significativo');
console.log('   • -21dB seria quase eliminação total');
console.log('   • Isso indica erro no cálculo do z-score ou conversão');

// Problema 2: Precisão artificial
console.log('\n❌ PROBLEMA 2: Precisão Artificial');
console.log('   • -21.3dB (com decimal) parece calculado matematicamente');
console.log('   • Sugestões reais são em números redondos (-3dB, -6dB)');
console.log('   • Indica que não há arredondamento apropriado');

// Problema 3: Falta de contexto musical
console.log('\n❌ PROBLEMA 3: Falta de Contexto');
console.log('   • Não menciona o gênero (Funk Mandela precisa sub-bass)');
console.log('   • Não explica POR QUE reduzir tanto');
console.log('   • Não oferece alternativas ou graduação');

// 3. COMO DEVERIA SER
console.log('\n✅ COMO DEVERIA SER:');
console.log('   Sugestão melhorada:');
console.log('   "Sub-bass ligeiramente alto para Funk Mandela"');
console.log('   "Reduzir 20-60Hz em 2-3dB para melhor definição"');
console.log('   "Manter presença do sub mas com mais controle"');

// 4. POSSÍVEIS CAUSAS DO ERRO
console.log('\n🔍 POSSÍVEIS CAUSAS:');
console.log('   1. Z-score mal calibrado (muito sensível)');
console.log('   2. Conversão z-score → dB incorreta');
console.log('   3. Falta de limitação nos valores sugeridos');
console.log('   4. Referências de gênero inadequadas');
console.log('   5. Falta de validação musical das sugestões');

// 5. TESTE RÁPIDO DE VALIDAÇÃO
console.log('\n🧪 TESTE DE VALIDAÇÃO:');

function validarSugestao(sugestao) {
    const problemas = [];
    
    // Extrair magnitude se for ajuste de banda
    const match = sugestao.match(/-?(\d+\.?\d*)dB/);
    if (match) {
        const magnitude = parseFloat(match[1]);
        
        if (magnitude > 12) {
            problemas.push(`Magnitude excessiva: ${magnitude}dB (máximo recomendado: 12dB)`);
        }
        
        if (magnitude > 6 && !sugestao.includes('drástic')) {
            problemas.push(`Magnitude alta sem aviso: ${magnitude}dB`);
        }
        
        if (magnitude % 0.5 !== 0 && magnitude > 3) {
            problemas.push(`Precisão desnecessária: ${magnitude}dB (deveria ser arredondado)`);
        }
    }
    
    if (!sugestao.includes('Hz') && sugestao.includes('banda')) {
        problemas.push('Falta especificação de frequência');
    }
    
    return problemas;
}

// Testar a sugestão real
const sugestaoReal = "Reduzir sub em -21.3dB (20-60 Hz)";
const problemas = validarSugestao(sugestaoReal);

console.log(`\n📋 RESULTADO DA VALIDAÇÃO:`);
if (problemas.length > 0) {
    console.log('❌ SUGESTÃO PROBLEMÁTICA:');
    problemas.forEach((p, i) => console.log(`   ${i+1}. ${p}`));
} else {
    console.log('✅ Sugestão validada');
}

// 6. SUGESTÃO DE CORREÇÃO URGENTE
console.log('\n🚨 CORREÇÃO URGENTE NECESSÁRIA:');
console.log('   1. Limitar magnitudes: máximo ±12dB');
console.log('   2. Arredondar para 0.5dB ou 1dB');
console.log('   3. Adicionar contexto do gênero');
console.log('   4. Validar coerência musical');
console.log('   5. Graduar severidade (leve/moderado/forte)');

export { validarSugestao };