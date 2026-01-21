// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🧪 Teste direto da API para verificar True Peak no JSON
 */

log('🧪 Testando True Peak via fetch API...\n');

// Criar um arquivo de áudio de teste pequeno (WAV)
function createTestWAV() {
    const sampleRate = 48000;
    const duration = 0.1; // 100ms
    const frequency = 1000; // 1kHz
    const amplitude = 0.5; // -6 dBFS
    
    const length = Math.floor(sampleRate * duration);
    const audioData = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        audioData[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }
    
    // Converter para PCM 16-bit
    const pcmData = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32767));
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
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);
    
    // Audio data
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(44 + i * 2, pcmData[i], true);
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

async function testTruePeakAPI() {
    try {
        const wavBlob = createTestWAV();
        log(`📁 Arquivo WAV criado: ${wavBlob.size} bytes`);
        
        const formData = new FormData();
        formData.append('audioFile', wavBlob, 'test-truepeak.wav');
        
        log('📤 Enviando para API...');
        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        log('📋 Resposta da API recebida!');
        
        // Verificar True Peak nos dados técnicos
        log('\n🔍 Verificando True Peak:');
        log(`   technicalData existe: ${!!result.technicalData}`);
        log(`   technicalData.truePeakDbtp: ${result.technicalData?.truePeakDbtp}`);
        log(`   technicalData.truePeakLinear: ${result.technicalData?.truePeakLinear}`);
        
        // Verificar no objeto truePeak
        log(`   truePeak existe: ${!!result.truePeak}`);
        if (result.truePeak) {
            log(`   truePeak.maxDbtp: ${result.truePeak.maxDbtp}`);
            log(`   truePeak.maxLinear: ${result.truePeak.maxLinear}`);
        }
        
        log('\n🎯 RESULTADO:');
        if (result.technicalData?.truePeakDbtp && Number.isFinite(result.technicalData.truePeakDbtp)) {
            log(`✅ SUCESSO: True Peak = ${result.technicalData.truePeakDbtp} dBTP`);
            log('✅ Valor deve aparecer no modal do frontend!');
        } else {
            log('❌ PROBLEMA: True Peak não encontrado ou inválido!');
            log('❌ O modal pode não estar exibindo valor por isso!');
        }
        
    } catch (error) {
        error('❌ ERRO na API:', error.message);
        error('💡 Verifique se o servidor está rodando em http://localhost:3000');
    }
}

// Executar teste
testTruePeakAPI();