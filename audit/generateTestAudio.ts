#!/usr/bin/env node
/**
 * 🎵 AUDITORIA: GERADOR DE ÁUDIO SINTÉTICO PARA TESTES
 * 
 * Gera WAVs de teste com características conhecidas para validar métricas
 * Ground truth relativo para verificação de correção dos algoritmos
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_AUDIO_DIR = path.join(PROJECT_ROOT, 'audit', 'out', 'artifacts', 'test-audio');

interface AudioTestCase {
  filename: string;
  description: string;
  sampleRate: number;
  channels: number;
  duration: number; // seconds
  expectedTraits: {
    lufsRange: [number, number];
    truePeakRange: [number, number];
    drRange: [number, number];
    correlationRange: [number, number];
    dominantBand: string;
    spectralCharacteristic: string;
  };
  generator: (sampleRate: number, duration: number) => {
    left: Float32Array;
    right: Float32Array;
  };
}

class TestAudioGenerator {
  private runId: string;
  private testCases: AudioTestCase[] = [];

  constructor() {
    this.runId = `audio_gen_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`🎵 [${this.runId}] Iniciando geração de áudio sintético...`);
    this.setupTestCases();
  }

  private setupTestCases(): void {
    this.testCases = [
      {
        filename: 'test_sub_bass_dominant.wav',
        description: 'Sine 60Hz + harmonics - Sub Bass dominante',
        sampleRate: 48000,
        channels: 2,
        duration: 10,
        expectedTraits: {
          lufsRange: [-18, -12],
          truePeakRange: [-3, -1],
          drRange: [8, 15],
          correlationRange: [0.8, 1.0],
          dominantBand: 'sub',
          spectralCharacteristic: 'baixa_frequencia'
        },
        generator: this.generateSubBass.bind(this)
      },
      {
        filename: 'test_mid_range_vocal.wav',
        description: 'Sine 1kHz + 2kHz - Mid range típico de vocal',
        sampleRate: 48000,
        channels: 2,
        duration: 10,
        expectedTraits: {
          lufsRange: [-16, -10],
          truePeakRange: [-2, 0],
          drRange: [6, 12],
          correlationRange: [0.7, 1.0],
          dominantBand: 'mid',
          spectralCharacteristic: 'vocal_range'
        },
        generator: this.generateMidRange.bind(this)
      },
      {
        filename: 'test_high_freq_bright.wav',
        description: 'Sine 8kHz + 12kHz - Agudos brilhantes',
        sampleRate: 48000,
        channels: 2,
        duration: 10,
        expectedTraits: {
          lufsRange: [-20, -14],
          truePeakRange: [-4, -2],
          drRange: [10, 18],
          correlationRange: [0.8, 1.0],
          dominantBand: 'brilho',
          spectralCharacteristic: 'alta_frequencia'
        },
        generator: this.generateHighFreq.bind(this)
      },
      {
        filename: 'test_pink_noise.wav',
        description: 'Pink noise - Distribuição espectral natural',
        sampleRate: 48000,
        channels: 2,
        duration: 15,
        expectedTraits: {
          lufsRange: [-25, -15],
          truePeakRange: [-8, -3],
          drRange: [15, 25],
          correlationRange: [0.0, 0.3],
          dominantBand: 'balanced',
          spectralCharacteristic: 'pink_noise'
        },
        generator: this.generatePinkNoise.bind(this)
      },
      {
        filename: 'test_stereo_wide.wav',
        description: 'L/R em oposição - Baixa correlação estéreo',
        sampleRate: 48000,
        channels: 2,
        duration: 12,
        expectedTraits: {
          lufsRange: [-18, -12],
          truePeakRange: [-3, -1],
          drRange: [8, 15],
          correlationRange: [-0.5, 0.2],
          dominantBand: 'mid',
          spectralCharacteristic: 'stereo_wide'
        },
        generator: this.generateStereoWide.bind(this)
      },
      {
        filename: 'test_loud_compressed.wav',
        description: 'LUFS -8 target - Altamente comprimido',
        sampleRate: 48000,
        channels: 2,
        duration: 8,
        expectedTraits: {
          lufsRange: [-10, -6],
          truePeakRange: [-1.5, 0],
          drRange: [3, 8],
          correlationRange: [0.6, 1.0],
          dominantBand: 'mid',
          spectralCharacteristic: 'compressed_loud'
        },
        generator: this.generateLoudCompressed.bind(this)
      },
      {
        filename: 'test_dynamic_classical.wav',
        description: 'LUFS -20 target - Alta dinâmica tipo clássica',
        sampleRate: 48000,
        channels: 2,
        duration: 20,
        expectedTraits: {
          lufsRange: [-24, -16],
          truePeakRange: [-6, -3],
          drRange: [18, 30],
          correlationRange: [0.3, 0.8],
          dominantBand: 'balanced',
          spectralCharacteristic: 'dynamic_classical'
        },
        generator: this.generateDynamicClassical.bind(this)
      },
      {
        filename: 'test_clipping_distorted.wav',
        description: 'Clipping intencional - True Peak > 0 dBTP',
        sampleRate: 48000,
        channels: 2,
        duration: 5,
        expectedTraits: {
          lufsRange: [-12, -6],
          truePeakRange: [0, 3],
          drRange: [2, 6],
          correlationRange: [0.7, 1.0],
          dominantBand: 'mid',
          spectralCharacteristic: 'clipped_distorted'
        },
        generator: this.generateClippingDistorted.bind(this)
      }
    ];
  }

  async generateAll(): Promise<void> {
    // Criar diretório de saída
    await fs.promises.mkdir(TEST_AUDIO_DIR, { recursive: true });

    console.log(`📁 Gerando ${this.testCases.length} arquivos de teste em ${TEST_AUDIO_DIR}`);

    const manifestEntries: any[] = [];

    for (const testCase of this.testCases) {
      try {
        console.log(`🎵 Gerando: ${testCase.filename}`);
        const startTime = Date.now();

        // Gerar áudio
        const audioData = testCase.generator(testCase.sampleRate, testCase.duration);
        
        // Salvar como WAV
        const wavPath = path.join(TEST_AUDIO_DIR, testCase.filename);
        await this.saveAsWav(wavPath, audioData, testCase.sampleRate);

        const generationTime = Date.now() - startTime;
        console.log(`✅ ${testCase.filename} gerado em ${generationTime}ms`);

        // Adicionar ao manifesto
        manifestEntries.push({
          filename: testCase.filename,
          description: testCase.description,
          sampleRate: testCase.sampleRate,
          channels: testCase.channels,
          duration: testCase.duration,
          expectedTraits: testCase.expectedTraits,
          generated: new Date().toISOString(),
          generationTimeMs: generationTime,
          fileSizeBytes: (await fs.promises.stat(wavPath)).size
        });

      } catch (error) {
        console.error(`❌ Erro ao gerar ${testCase.filename}: ${error.message}`);
      }
    }

    // Salvar manifesto
    const manifestPath = path.join(TEST_AUDIO_DIR, 'TEST_AUDIO_MANIFEST.json');
    await fs.promises.writeFile(manifestPath, JSON.stringify({
      runId: this.runId,
      generated: new Date().toISOString(),
      totalFiles: manifestEntries.length,
      testCases: manifestEntries
    }, null, 2));

    // Gerar relatório resumido
    await this.generateReport(manifestEntries);
    
    console.log(`📄 Manifesto salvo: ${manifestPath}`);
    console.log(`✅ Geração concluída! ${manifestEntries.length} arquivos criados.`);
  }

  private generateSubBass(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Fundamental em 60Hz + harmônicos
      const fundamental = 0.6 * Math.sin(2 * Math.PI * 60 * t);
      const harmonic2 = 0.3 * Math.sin(2 * Math.PI * 120 * t);
      const harmonic3 = 0.1 * Math.sin(2 * Math.PI * 180 * t);
      
      const signal = fundamental + harmonic2 + harmonic3;
      left[i] = signal * 0.7; // -3dB aprox
      right[i] = signal * 0.7;
    }

    return { left, right };
  }

  private generateMidRange(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Frequências típicas de vocal
      const freq1 = 0.5 * Math.sin(2 * Math.PI * 1000 * t);
      const freq2 = 0.3 * Math.sin(2 * Math.PI * 2000 * t);
      const freq3 = 0.2 * Math.sin(2 * Math.PI * 3000 * t);
      
      const signal = freq1 + freq2 + freq3;
      left[i] = signal * 0.5;
      right[i] = signal * 0.5;
    }

    return { left, right };
  }

  private generateHighFreq(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Agudos brilhantes
      const freq1 = 0.4 * Math.sin(2 * Math.PI * 8000 * t);
      const freq2 = 0.3 * Math.sin(2 * Math.PI * 12000 * t);
      const freq3 = 0.2 * Math.sin(2 * Math.PI * 15000 * t);
      
      const signal = freq1 + freq2 + freq3;
      left[i] = signal * 0.3; // Mais suave nos agudos
      right[i] = signal * 0.3;
    }

    return { left, right };
  }

  private generatePinkNoise(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    // Pink noise aproximado usando filtro simples
    let prev1L = 0, prev2L = 0, prev3L = 0;
    let prev1R = 0, prev2R = 0, prev3R = 0;

    for (let i = 0; i < samples; i++) {
      // White noise
      const whiteL = (Math.random() * 2 - 1);
      const whiteR = (Math.random() * 2 - 1);
      
      // Simple pink filter approximation
      const pinkL = (whiteL + prev1L + prev2L + prev3L) * 0.25;
      const pinkR = (whiteR + prev1R + prev2R + prev3R) * 0.25;
      
      prev3L = prev2L; prev2L = prev1L; prev1L = whiteL;
      prev3R = prev2R; prev2R = prev1R; prev1R = whiteR;
      
      left[i] = pinkL * 0.15;
      right[i] = pinkR * 0.15;
    }

    return { left, right };
  }

  private generateStereoWide(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Sinais em oposição de fase
      const baseSignal = Math.sin(2 * Math.PI * 1000 * t);
      
      left[i] = baseSignal * 0.6;
      right[i] = -baseSignal * 0.6; // Inverter fase = correlação negativa
    }

    return { left, right };
  }

  private generateLoudCompressed(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Múltiplas frequências com amplitude alta
      const mix = 
        0.3 * Math.sin(2 * Math.PI * 100 * t) +
        0.3 * Math.sin(2 * Math.PI * 1000 * t) +
        0.25 * Math.sin(2 * Math.PI * 3000 * t) +
        0.15 * Math.sin(2 * Math.PI * 8000 * t);
      
      // Compressão hard (limitação de amplitude)
      const compressed = Math.tanh(mix * 2) * 0.9; // ~LUFS -8
      
      left[i] = compressed;
      right[i] = compressed;
    }

    return { left, right };
  }

  private generateDynamicClassical(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Envelope dinâmico (crescendo/diminuendo)
      const envelope = 0.1 + 0.4 * Math.sin(2 * Math.PI * t / duration);
      
      // Mistura espectral equilibrada
      const mix = 
        0.2 * Math.sin(2 * Math.PI * 220 * t) +  // A3
        0.15 * Math.sin(2 * Math.PI * 440 * t) + // A4
        0.1 * Math.sin(2 * Math.PI * 880 * t) +  // A5
        0.05 * Math.sin(2 * Math.PI * 1760 * t); // A6
      
      const signal = mix * envelope;
      
      // Slight stereo decorrelation
      left[i] = signal;
      right[i] = signal * 0.95;
    }

    return { left, right };
  }

  private generateClippingDistorted(sampleRate: number, duration: number): { left: Float32Array; right: Float32Array } {
    const samples = Math.floor(sampleRate * duration);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Sinal alto que será clippado
      const signal = 1.2 * Math.sin(2 * Math.PI * 1000 * t);
      
      // Hard clipping
      const clipped = Math.max(-1, Math.min(1, signal));
      
      left[i] = clipped;
      right[i] = clipped;
    }

    return { left, right };
  }

  private async saveAsWav(
    filePath: string, 
    audioData: { left: Float32Array; right: Float32Array }, 
    sampleRate: number
  ): Promise<void> {
    const numChannels = 2;
    const bitsPerSample = 24;
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = audioData.left.length;
    const dataLength = numSamples * numChannels * bytesPerSample;
    const fileLength = 44 + dataLength;

    const buffer = Buffer.alloc(fileLength);
    let offset = 0;

    // WAV Header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileLength - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    buffer.writeUInt16LE(1, offset); offset += 2;  // audio format (PCM)
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2; // block align
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataLength, offset); offset += 4;

    // Write interleaved samples (24-bit)
    for (let i = 0; i < numSamples; i++) {
      // Left channel
      const leftSample = Math.round(audioData.left[i] * 8388607); // 2^23 - 1
      buffer.writeIntLE(leftSample, offset, 3); offset += 3;
      
      // Right channel
      const rightSample = Math.round(audioData.right[i] * 8388607);
      buffer.writeIntLE(rightSample, offset, 3); offset += 3;
    }

    await fs.promises.writeFile(filePath, buffer);
  }

  private async generateReport(manifestEntries: any[]): Promise<void> {
    const report = `# 🎵 ÁUDIO SINTÉTICO PARA TESTES - RELATÓRIO

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Arquivos Gerados:** ${manifestEntries.length}  
**Diretório:** \`${TEST_AUDIO_DIR}\`  

## 📊 CASOS DE TESTE CRIADOS

${manifestEntries.map(entry => `
### ${entry.filename}
**Descrição:** ${entry.description}  
**Duração:** ${entry.duration}s  
**Tamanho:** ${(entry.fileSizeBytes / 1024).toFixed(1)} KB  
**Tempo de Geração:** ${entry.generationTimeMs}ms  

**Ground Truth Esperado:**
- **LUFS:** ${entry.expectedTraits.lufsRange[0]} a ${entry.expectedTraits.lufsRange[1]} dB
- **True Peak:** ${entry.expectedTraits.truePeakRange[0]} a ${entry.expectedTraits.truePeakRange[1]} dBTP  
- **Dynamic Range:** ${entry.expectedTraits.drRange[0]} a ${entry.expectedTraits.drRange[1]} dB
- **Correlação Estéreo:** ${entry.expectedTraits.correlationRange[0]} a ${entry.expectedTraits.correlationRange[1]}
- **Banda Dominante:** ${entry.expectedTraits.dominantBand}
- **Característica:** ${entry.expectedTraits.spectralCharacteristic}
`).join('\n')}

## 🎯 PRÓXIMOS PASSOS

1. **Validação Automática:** Execute \`validateRuntimeMetrics.ts\` para verificar se as métricas extraídas estão dentro dos ranges esperados
2. **Regressão:** Use estes arquivos como baseline para detectar mudanças não intencionais nos algoritmos
3. **Performance:** Meça tempo de processamento em cada arquivo para detectar degradação

## 🔍 INSTRUÇÕES DE USO

### Validação Manual
\`\`\`bash
# Analisar um arquivo específico
node debug-analyzer.js audit/out/artifacts/test-audio/test_sub_bass_dominant.wav

# Verificar se banda dominante está correta
# Esperado: banda 'sub' com maior energia %
\`\`\`

### Validação Automática
\`\`\`bash
npm run audit:validate-metrics
# ou
node audit/validateRuntimeMetrics.ts
\`\`\`
`;

    const reportPath = path.join(PROJECT_ROOT, 'audit', 'out', 'TEST_AUDIO_REPORT.md');
    await fs.promises.writeFile(reportPath, report);
    console.log(`📄 Relatório salvo: ${reportPath}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const generator = new TestAudioGenerator();
  generator.generateAll().catch(console.error);
}

export { TestAudioGenerator };
