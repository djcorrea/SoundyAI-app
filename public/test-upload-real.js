/**
 * 🧪 Teste de upload real para verificar se o pipeline está funcionando
 */

async function testRealUpload() {
    try {
        log('🧪 Criando arquivo de teste...');
        
        // Criar um arquivo WAV simples
        const sampleRate = 48000;
        const duration = 0.2; // 200ms
        const frequency = 1000; // 1kHz
        const amplitude = 0.3; // -10 dBFS aproximadamente
        
        const length = Math.floor(sampleRate * duration);
        const samples = new Float32Array(length);
        
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
        }
        
        // Converter para PCM 16-bit estéreo
        const pcmData = new Int16Array(length * 2); // Estéreo
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-32768, Math.min(32767, samples[i] * 32767));
            pcmData[i * 2] = sample;     // Left
            pcmData[i * 2 + 1] = sample; // Right
        }
        
        // Criar header WAV
        const headerSize = 44;
        const dataSize = pcmData.length * 2;
        const fileSize = headerSize + dataSize - 8;
        
        const buffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(buffer);
        
        // RIFF header
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, fileSize, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"
        
        // fmt chunk
        view.setUint32(12, 0x666D7420, false); // "fmt "
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 2, true); // stereo
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true); // byte rate (stereo 16-bit)
        view.setUint16(32, 4, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        
        // data chunk
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, dataSize, true);
        
        // Audio data
        for (let i = 0; i < pcmData.length; i++) {
            view.setInt16(44 + i * 2, pcmData[i], true);
        }
        
        const audioBlob = new Blob([buffer], { type: 'audio/wav' });
        log(`📁 Arquivo WAV criado: ${audioBlob.size} bytes, ${duration}s, estéreo`);
        
        // Fazer upload
        const formData = new FormData();
        formData.append('audioFile', audioBlob, 'test-pipeline.wav');
        
        log('📤 Fazendo upload...');
        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            body: formData
        });
        
        log(`📋 Status: ${response.status} ${response.statusText}`);
        
        const result = await response.json();
        
        log('\n📊 RESULTADO:');
        log(`   Status: ${result.status}`);
        log(`   OK: ${result.ok}`);
        log(`   Score: ${result.score}`);
        
        if (result.error) {
            log(`\n❌ ERRO:`, result.error);
        }
        
        if (result.technicalData) {
            log('\n✅ technicalData encontrado:');
            log(`   truePeakDbtp: ${result.technicalData.truePeakDbtp}`);
            log(`   lufsIntegrated: ${result.technicalData.lufsIntegrated}`);
            log(`   dynamicRange: ${result.technicalData.dynamicRange}`);
        } else {
            log('\n❌ technicalData não encontrado');
        }
        
        if (result.warnings?.length > 0) {
            log('\n⚠️ Warnings:', result.warnings);
        }
        
        // Log completo para debug
        log('\n🔍 JSON completo:');
        log(JSON.stringify(result, null, 2));
        
        return result;
        
    } catch (error) {
        error('❌ Erro no teste:', error);
        return null;
    }
}

// Executar teste
testRealUpload().then(result => {
    if (result && result.ok && result.technicalData?.truePeakDbtp) {
        log(`\n🎉 SUCESSO! True Peak = ${result.technicalData.truePeakDbtp} dBTP`);
    } else {
        log('\n💥 FALHA no pipeline');
    }
});