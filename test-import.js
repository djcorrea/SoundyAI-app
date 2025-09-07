// Teste manual simples da rota refatorada
import('./api/audio/analyze.js')
  .then(module => {
    const router = module.default;
    console.log('✅ Módulo importado com sucesso!');
    console.log('📋 Tipo do export:', typeof router);
    console.log('🔧 Métodos disponíveis:', Object.getOwnPropertyNames(router));
    
    // Verificar se é um router válido do Express
    if (router && typeof router.post === 'function') {
      console.log('✅ Router Express válido - método POST disponível');
    } else {
      console.log('❌ Router inválido');
    }
  })
  .catch(error => {
    console.error('❌ Erro na importação:', error.message);
    console.error('Stack:', error.stack);
  });
