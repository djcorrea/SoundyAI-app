/**
 * 🧪 TESTE DIRETO DO BACKEND - UPLOAD E ANÁLISE
 * 
 * Script para testar upload direto e verificar se métricas são calculadas
 */

// Função para testar upload direto para o backend
async function testarUploadBackend() {
    console.log('🧪 INICIANDO TESTE DIRETO DO BACKEND');
    
    try {
        // 1. Verificar se backend responde
        const healthResponse = await fetch('http://localhost:3000/health');
        if (!healthResponse.ok) {
            throw new Error('Backend não responde na porta 3000');
        }
        
        const healthText = await healthResponse.text();
        console.log('✅ Backend status:', healthText);
        
        // 2. Criar arquivo de teste simples (sine wave)
        console.log('🎵 Criando arquivo de teste...');
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = 48000;
        const duration = 2; // 2 segundos
        const frequency = 440; // A4
        
        const audioBuffer = audioContext.createBuffer(2, sampleRate * duration, sampleRate);
        
        // Gerar sine wave
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
            }
        }
        
        console.log('✅ Arquivo de teste criado:', {
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels,
            duration: audioBuffer.duration
        });
        
        // 3. Converter para WAV (usando biblioteca externa se disponível)
        // Por simplicidade, vamos usar um arquivo existente ou simular
        console.log('⚠️ Para teste real, seria necessário arquivo WAV');
        console.log('💡 Use o upload normal na interface para testar');
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro no teste de backend:', error);
        return false;
    }
}

// Função para monitorar jobs específicos
async function monitorarJob(jobId) {
    console.log(`👁️ Monitorando job ${jobId}...`);
    
    let tentativas = 0;
    const maxTentativas = 60; // 5 minutos
    
    while (tentativas < maxTentativas) {
        try {
            const response = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
            if (!response.ok) {
                console.warn(`⚠️ Erro ao consultar job ${jobId}:`, response.status);
                break;
            }
            
            const jobData = await response.json();
            console.log(`📊 Job ${jobId} status:`, jobData.status);
            
            if (jobData.status === 'completed') {
                console.log('🎉 Job completado! Analisando resultados...');
                
                // Análise detalhada dos resultados
                const result = jobData.result;
                console.group('🔍 ANÁLISE DOS RESULTADOS');
                
                console.log('📊 Estrutura:', Object.keys(result));
                
                if (result.technicalData) {
                    console.log('📊 technicalData:', Object.keys(result.technicalData));
                    console.log('🎯 LUFS:', result.technicalData.lufs_integrated);
                    console.log('🎯 Peak:', result.technicalData.peak);
                    console.log('🎯 True Peak:', result.technicalData.true_peak);
                    console.log('🎯 RMS:', result.technicalData.rms_level);
                }
                
                if (result.phase3) {
                    console.log('📊 Phase 3 (métricas):', Object.keys(result.phase3));
                }
                
                console.groupEnd();
                return result;
            }
            
            if (jobData.status === 'failed') {
                console.error('❌ Job falhou:', jobData.error);
                return null;
            }
            
            if (jobData.status === 'processing') {
                const progress = jobData.progress || 0;
                console.log(`⏳ Processando... ${progress}%`);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao monitorar job:', error.message);
        }
        
        tentativas++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5 segundos
    }
    
    console.warn(`⏰ Timeout no monitoramento do job ${jobId}`);
    return null;
}

// Disponibilizar no window
if (typeof window !== 'undefined') {
    window.testeBackend = {
        testarUpload: testarUploadBackend,
        monitorarJob: monitorarJob
    };
    
    console.log('🧪 Teste de backend disponível em: window.testeBackend');
}
