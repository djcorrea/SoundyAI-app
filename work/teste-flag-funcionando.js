// Teste rápido para verificar se a flag está funcionando
import "dotenv/config";

console.log('🔧 TESTE DA FLAG DISABLE_SUGGESTIONS\n');

// Simular o comportamento do core-metrics.js
const DISABLE_SUGGESTIONS = process.env.DISABLE_SUGGESTIONS === 'true';

console.log('📊 Estado atual:');
console.log(`   🏷️  process.env.DISABLE_SUGGESTIONS = "${process.env.DISABLE_SUGGESTIONS}"`);
console.log(`   ⚙️  DISABLE_SUGGESTIONS = ${DISABLE_SUGGESTIONS}`);
console.log('');

// Simular a lógica do core-metrics.js
if (!DISABLE_SUGGESTIONS) {
    console.log('✅ [SUGGESTIONS] Ativas (V2 rodando normalmente).');
    console.log('   📋 problemsAnalysis será executado');
    console.log('   📤 JSON terá sugestões completas');
} else {
    console.log('🛑 [SUGGESTIONS] Desativadas via flag de ambiente.');
    console.log('   📋 problemsAnalysis = null');
    console.log('   📤 JSON terá arrays vazios para sugestões');
}

console.log('\n🎯 Para mudar:');
console.log('   • LIGAR: remover DISABLE_SUGGESTIONS do .env ou definir como "false"');
console.log('   • DESLIGAR: manter DISABLE_SUGGESTIONS=true no .env');
console.log('   • ⚠️  IMPORTANTE: Reiniciar worker após mudanças no .env');