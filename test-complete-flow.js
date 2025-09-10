/**
 * 🧪 TESTE COMPLETO: Upload → Worker → Pipeline → UI
 * Testa todo o fluxo de comunicação do sistema
 */

// Simular um arquivo pequeno
function createTestAudioFile() {
    // Criar um WAV mínimo de 1 segundo (sine wave 440Hz)
    const sampleRate = 48000;
    const duration = 1; // 1 segundo
    const samples = sampleRate * duration;
    
    // Buffer WAV simplificado (header + dados)
    const arrayBuffer = new ArrayBuffer(44 + samples * 4 * 2); // stereo float32
    const view = new DataView(arrayBuffer);
    
    // Header WAV
    let offset = 0;
    const writeString = (str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset++, str.charCodeAt(i));
        }
    };
    
    writeString('RIFF');
    view.setUint32(offset, arrayBuffer.byteLength - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 18, true); offset += 4; // fmt chunk size
    view.setUint16(offset, 3, true); offset += 2; // format: Float32
    view.setUint16(offset, 2, true); offset += 2; // channels: stereo
    view.setUint32(offset, sampleRate, true); offset += 4; // sample rate
    view.setUint32(offset, sampleRate * 8, true); offset += 4; // byte rate
    view.setUint16(offset, 8, true); offset += 2; // block align
    view.setUint16(offset, 32, true); offset += 2; // bits per sample
    view.setUint16(offset, 0, true); offset += 2; // extra params
    writeString('data');
    view.setUint32(offset, samples * 4 * 2, true); offset += 4;
    
    // Dados de áudio (sine wave 440Hz)
    for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5; // 440Hz sine at -6dB
        
        view.setFloat32(offset, sample, true); offset += 4; // left
        view.setFloat32(offset, sample, true); offset += 4; // right
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function testCompleteFlow() {
    console.log('🚀 INICIANDO TESTE COMPLETO DO FLUXO...\n');
    
    try {
        // 1. Criar arquivo de teste
        console.log('📁 1. Criando arquivo de teste...');
        const testFile = createTestAudioFile();
        console.log(`✅ Arquivo criado: ${(testFile.size / 1024).toFixed(1)}KB WAV\n`);
        
        // 2. Upload do arquivo
        console.log('☁️ 2. Fazendo upload...');
        const formData = new FormData();
        formData.append('file', testFile, 'teste-completo.wav');
        
        const uploadResponse = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload realizado:', uploadResult);
        
        if (!uploadResult.job?.file_key) {
            throw new Error('Upload não retornou file_key válido');
        }
        
        // 3. Criar job de análise
        console.log('\n🔧 3. Criando job de análise...');
        const jobResponse = await fetch('/api/audio/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_key: uploadResult.job.file_key,
                mode: 'reference',
                file_name: 'teste-completo.wav'
            })
        });
        
        if (!jobResponse.ok) {
            throw new Error(`Job creation failed: ${jobResponse.status}`);
        }
        
        const jobResult = await jobResponse.json();
        console.log('✅ Job criado:', jobResult);
        
        const jobId = jobResult.job?.id;
        if (!jobId) {
            throw new Error('Job creation não retornou ID válido');
        }
        
        // 4. Polling do status
        console.log('\n⏳ 4. Aguardando processamento...');
        let attempts = 0;
        const maxAttempts = 60; // 5 minutos
        
        while (attempts < maxAttempts) {
            attempts++;
            
            const statusResponse = await fetch(`/api/jobs/${jobId}`);
            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
            }
            
            const statusData = await statusResponse.json();
            console.log(`🔄 Tentativa ${attempts}: Status = ${statusData.status}`);
            
            if (statusData.status === 'completed' || statusData.status === 'done') {
                console.log('\n✅ 5. PROCESSAMENTO CONCLUÍDO!');
                console.log('📊 Resultado completo:', statusData.result);
                
                // Verificar se temos dados reais de análise
                const result = statusData.result;
                const hasRealData = (
                    result?.technicalData?.lufsIntegrated !== undefined ||
                    result?.technicalData?.truePeakDbtp !== undefined ||
                    result?.score !== undefined
                );
                
                console.log('\n🔍 ANÁLISE DOS DADOS:');
                console.log(`📈 Score: ${result?.score || 'N/A'}`);
                console.log(`📊 LUFS: ${result?.technicalData?.lufsIntegrated || 'N/A'}`);
                console.log(`🏔️ True Peak: ${result?.technicalData?.truePeakDbtp || 'N/A'}dBTP`);
                console.log(`🎛️ Correlação: ${result?.technicalData?.stereoCorrelation || 'N/A'}`);
                console.log(`⏱️ Processamento: ${result?.processingTime || 'N/A'}ms`);
                console.log(`🔧 Método: ${result?.method || result?.scoringMethod || 'N/A'}`);
                console.log(`💾 Metadata: ${result?.metadata || 'N/A'}`);
                console.log(`🔄 Used Fallback: ${result?.usedFallback || 'N/A'}`);
                
                if (hasRealData) {
                    console.log('\n🎉 SUCESSO: Pipeline está processando áudio real!');
                    console.log('✅ Os resultados estão sendo calculados pelo back-end');
                    console.log('✅ Os dados estão chegando no front-end');
                } else {
                    console.log('\n⚠️ ATENÇÃO: Apenas metadata sendo retornada');
                    console.log('❌ Pipeline pode estar usando fallback');
                }
                
                return result;
            }
            
            if (statusData.status === 'failed' || statusData.status === 'error') {
                console.log('\n❌ PROCESSAMENTO FALHOU:');
                console.log('Error:', statusData.error);
                throw new Error(`Processing failed: ${statusData.error}`);
            }
            
            // Aguardar 5 segundos
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        throw new Error('Timeout: Processamento demorou mais que o esperado');
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error);
        console.error('Stack:', error.stack);
    }
}

// Executar teste quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Aguardar um pouco para garantir que tudo carregou
        setTimeout(testCompleteFlow, 2000);
    });
} else {
    setTimeout(testCompleteFlow, 2000);
}

// Também expor globalmente para teste manual
window.testCompleteFlow = testCompleteFlow;
