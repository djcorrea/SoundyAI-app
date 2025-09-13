// 🧪 TESTE DA INTEGRAÇÃO RAILWAY
// Execute este código no console do navegador para testar

console.log('🧪 INICIANDO TESTE DE INTEGRAÇÃO RAILWAY');

// Simular um arquivo pequeno para teste
const testBlob = new Blob(['test audio data'], { type: 'audio/mp3' });
const testFile = new File([testBlob], 'test.mp3', { type: 'audio/mp3' });

console.log('📁 Arquivo de teste criado:', testFile);

// Testar a função se ela existir
if (typeof analyzeAudioFileRailway === 'function') {
    console.log('🔧 Testando analyzeAudioFileRailway...');
    
    analyzeAudioFileRailway(testFile, { runId: 'test_' + Date.now() })
        .then(result => {
            console.log('✅ TESTE PASSOU!', result);
        })
        .catch(error => {
            console.log('❌ TESTE FALHOU:', error.message);
            
            // Verificar se é erro esperado (arquivo fake)
            if (error.message.includes('Key not found') || error.message.includes('Timeout')) {
                console.log('💡 Erro esperado - arquivo de teste não existe no bucket');
            }
        });
} else {
    console.log('❌ Função analyzeAudioFileRailway não encontrada');
    console.log('💡 Certifique-se de que o audio-analyzer-integration.js foi carregado');
}

// Verificar se window.audioAnalyzer foi substituído
if (window.audioAnalyzer && window.audioAnalyzer.analyzeAudioFile) {
    console.log('🔄 window.audioAnalyzer.analyzeAudioFile detectado');
    console.log('🔍 Função atual:', window.audioAnalyzer.analyzeAudioFile.toString().substring(0, 100) + '...');
    
    if (window.audioAnalyzer.analyzeAudioFile.toString().includes('Railway')) {
        console.log('✅ Substituição por Railway detectada!');
    } else {
        console.log('⚠️ Ainda usando análise local');
    }
} else {
    console.log('❌ window.audioAnalyzer não encontrado');
}