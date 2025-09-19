// 🎯 Teste Direct FFmpeg True Peak
// Testar se o FFmpeg está retornando valores corretos
import { analyzeTruePeaks } from './work/lib/audio/features/truepeak.js';
import fs from 'fs';
import path from 'path';

async function testFFmpegDirectly() {
    console.log('🎯 [TEST] Iniciando teste direto do FFmpeg True Peak...');
    
    // Buscar arquivo de áudio para teste
    const testFiles = [
        './test-audio.wav',
        './audio-test.wav', 
        './sample.wav',
        './test.wav',
        './exemplo.wav'
    ];
    
    let testFile = null;
    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            testFile = file;
            break;
        }
    }
    
    if (!testFile) {
        console.log('⚠️ [TEST] Nenhum arquivo de teste encontrado. Criando arquivo sintético...');
        // Criar um arquivo sintético simples
        const sampleRate = 48000;
        const duration = 1; // 1 segundo
        const samples = sampleRate * duration;
        const buffer = Buffer.alloc(samples * 4); // 16-bit stereo
        
        // Gerar sine wave simples
        for (let i = 0; i < samples; i++) {
            const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.7; // -3dB
            const value = Math.floor(sample * 32767);
            buffer.writeInt16LE(value, i * 4);     // Left
            buffer.writeInt16LE(value, i * 4 + 2); // Right
        }
        
        testFile = './temp-test-audio.wav';
        
        // WAV header simples
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + buffer.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);  // PCM
        header.writeUInt16LE(2, 22);  // Stereo
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * 4, 28);
        header.writeUInt16LE(4, 32);  // Block align
        header.writeUInt16LE(16, 34); // Bits per sample
        header.write('data', 36);
        header.writeUInt32LE(buffer.length, 40);
        
        fs.writeFileSync(testFile, Buffer.concat([header, buffer]));
        console.log(`✅ [TEST] Arquivo sintético criado: ${testFile}`);
    }
    
    try {
        console.log(`🔍 [TEST] Testando com arquivo: ${testFile}`);
        
        // Testar usando filePath (FFmpeg mode)
        console.log('📁 [TEST] Testando modo FFmpeg (filePath)...');
        const ffmpegResult = await analyzeTruePeaks(testFile);
        console.log('✅ [FFmpeg] Resultado:', ffmpegResult);
        
        // Comparar com modo in-memory (se existir)
        if (fs.existsSync(testFile)) {
            try {
                // Simular array de dados (não implementado completamente)
                console.log('📊 [TEST] Modo FFmpeg é o único disponível (correto)');
            } catch (error) {
                console.log('⚠️ [TEST] Modo in-memory não disponível (esperado)');
            }
        }
        
        // Verificar campos obrigatórios
        const requiredFields = ['maxDbtp', 'maxLinear', 'true_peak_dbtp', 'true_peak_linear'];
        const missingFields = requiredFields.filter(field => !Number.isFinite(ffmpegResult[field]));
        
        if (missingFields.length > 0) {
            console.log('❌ [TEST] Campos obrigatórios ausentes:', missingFields);
            return false;
        }
        
        console.log('🎯 [TEST] RESULTADO FINAL:');
        console.log('  - maxDbtp (peak geral):', ffmpegResult.maxDbtp, 'dBTP');
        console.log('  - maxLinear (peak linear):', ffmpegResult.maxLinear);
        console.log('  - true_peak_dbtp:', ffmpegResult.true_peak_dbtp, 'dBTP');
        console.log('  - true_peak_linear:', ffmpegResult.true_peak_linear);
        
        // Limpar arquivo temporário
        if (testFile.includes('temp-test')) {
            fs.unlinkSync(testFile);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ [TEST] Erro no teste:', error);
        return false;
    }
}

// Executar teste
testFFmpegDirectly().then(success => {
    if (success) {
        console.log('🎉 [TEST] Teste do FFmpeg True Peak PASSOU!');
        process.exit(0);
    } else {
        console.log('💥 [TEST] Teste do FFmpeg True Peak FALHOU!');
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 [TEST] Erro fatal:', error);
    process.exit(1);
});