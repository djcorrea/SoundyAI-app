// Teste isolado do pipeline completo
import "dotenv/config";

console.log('🔍 Testando carregamento do pipeline...');

try {
  // Testar carregamento
  const imported = await import("./work/api/audio/pipeline-complete.js");
  console.log('✅ Pipeline carregado!');
  console.log('📋 Exports disponíveis:', Object.keys(imported));
  
  const { processAudioComplete } = imported;
  
  if (typeof processAudioComplete === 'function') {
    console.log('✅ processAudioComplete é uma função');
    
    // Testar com buffer pequeno (1 segundo de silêncio)
    const testBuffer = Buffer.alloc(48000 * 2 * 2); // 1s, stereo, 16-bit
    console.log('🧪 Testando processamento...');
    
    try {
      const result = await processAudioComplete(testBuffer, 'test.wav');
      console.log('✅ Pipeline executou com sucesso!');
      console.log('📊 Score:', result.score);
      console.log('🏷️ Classificação:', result.classification);
    } catch (pipelineError) {
      console.error('❌ Erro no pipeline:', pipelineError.message);
      console.error('🔍 Stack:', pipelineError.stack);
    }
    
  } else {
    console.error('❌ processAudioComplete não é uma função:', typeof processAudioComplete);
  }
  
} catch (error) {
  console.error('❌ Erro ao carregar pipeline:', error.message);
  console.error('🔍 Stack:', error.stack);
}