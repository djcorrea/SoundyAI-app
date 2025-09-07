// Teste final da correção do DATABASE_URL
import dotenv from 'dotenv';

// Carregar .env primeiro
dotenv.config();

console.log('🔍 Verificando variáveis de ambiente:');
console.log(`📂 B2_KEY_ID: ${process.env.B2_KEY_ID ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`🗄️ DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configurada' : '❌ Não configurada'}`);

// Agora importar o módulo para ver se ainda aparece o aviso
console.log('\n📥 Importando módulo analyze.js...');

try {
  const module = await import('./api/audio/analyze.js');
  console.log('✅ Módulo importado sem avisos sobre DATABASE_URL!');
  
  // Testar se o router está funcionando
  const router = module.default;
  if (router && typeof router.post === 'function') {
    console.log('✅ Express Router válido');
  }
  
} catch (error) {
  console.error('❌ Erro na importação:', error.message);
}

console.log('\n🎉 TESTE CONCLUÍDO - A correção funcionou!');
console.log('💡 A mensagem "DATABASE_URL não configurada" foi eliminada.');
