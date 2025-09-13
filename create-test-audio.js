// Criar arquivo de áudio de teste simples
import fs from 'fs';

// Gerar 1 segundo de silêncio em formato WAV simples
function createSimpleWAV() {
    const sampleRate = 44100;
    const duration = 1; // segundos
    const numSamples = sampleRate * duration;
    
    // Header WAV (44 bytes)
    const header = Buffer.alloc(44);
    
    // Chunk ID "RIFF"
    header.write('RIFF', 0, 'ascii');
    
    // Chunk size (será definido no final)
    const chunkSize = 36 + numSamples * 2;
    header.writeUInt32LE(chunkSize, 4);
    
    // Format "WAVE"
    header.write('WAVE', 8, 'ascii');
    
    // Subchunk1 ID "fmt "
    header.write('fmt ', 12, 'ascii');
    
    // Subchunk1 size (16 para PCM)
    header.writeUInt32LE(16, 16);
    
    // Audio format (1 = PCM)
    header.writeUInt16LE(1, 20);
    
    // Num channels (1 = mono)
    header.writeUInt16LE(1, 22);
    
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    
    // Byte rate
    header.writeUInt32LE(sampleRate * 2, 28);
    
    // Block align
    header.writeUInt16LE(2, 32);
    
    // Bits per sample
    header.writeUInt16LE(16, 34);
    
    // Subchunk2 ID "data"
    header.write('data', 36, 'ascii');
    
    // Subchunk2 size
    header.writeUInt32LE(numSamples * 2, 40);
    
    // Dados de áudio (silêncio = zeros)
    const audioData = Buffer.alloc(numSamples * 2, 0);
    
    // Combinar header + dados
    const wavFile = Buffer.concat([header, audioData]);
    
    return wavFile;
}

// Criar arquivo
const wavData = createSimpleWAV();
fs.writeFileSync('test-audio.wav', wavData);

console.log('✅ Arquivo test-audio.wav criado com sucesso!');
console.log('📊 Tamanho:', wavData.length, 'bytes');
console.log('🎵 Duração: 1 segundo de silêncio mono 44.1kHz');