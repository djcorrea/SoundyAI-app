/**
 * TESTE DE PERFORMANCE DIRETO
 * Executa análise de áudio e mostra logs de timing
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔍 ===== TESTE DE PERFORMANCE - ANÁLISE DIRETA =====\n');

async function testPerformance() {
  try {
    // 1. Carregar pipeline completo
    console.log('📦 1. Carregando pipeline completo...');
    const { processAudioComplete } = await import('./work/api/audio/pipeline-complete.js');
    console.log('✅ Pipeline carregado\n');

    // 2. Buscar arquivo de teste
    const testFile = process.argv[2];
    if (!testFile) {
      console.error('❌ ERRO: Nenhum arquivo especificado');
      console.log('\n📖 USO: node test-performance-direto.js caminho/para/arquivo.wav\n');
      process.exit(1);
    }

    if (!fs.existsSync(testFile)) {
      console.error(`❌ ERRO: Arquivo não encontrado: ${testFile}`);
      process.exit(1);
    }

    const stats = fs.statSync(testFile);
    console.log(`📄 2. Arquivo de teste:`);
    console.log(`   Caminho: ${testFile}`);
    console.log(`   Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

    // 3. Ler arquivo como buffer
    console.log('📥 3. Lendo arquivo...');
    const audioBuffer = fs.readFileSync(testFile);
    const fileName = testFile.split(/[/\\]/).pop();
    console.log(`✅ Buffer carregado: ${audioBuffer.length} bytes\n`);

    // 4. Executar análise completa
    console.log('🚀 4. Iniciando análise completa...\n');
    console.log('=' .repeat(80));
    
    const startTotal = Date.now();
    
    const result = await processAudioComplete(audioBuffer, fileName, {
      mode: 'default',
      genre: 'electronic',
      jobId: 'test-performance-' + Date.now()
    });
    
    const endTotal = Date.now();
    const totalSeconds = ((endTotal - startTotal) / 1000).toFixed(2);
    
    console.log('=' .repeat(80));
    console.log(`\n✅ 5. Análise concluída em ${totalSeconds}s (${((endTotal - startTotal) / 1000 / 60).toFixed(2)} min)\n`);

    // 5. Resumo de métricas principais
    console.log('📊 6. Resumo de Métricas:');
    console.log(`   LUFS: ${result.lufs?.integrated?.toFixed(2)} LUFS`);
    console.log(`   True Peak: ${result.truePeak?.maxDbtp?.toFixed(2)} dBTP`);
    console.log(`   Dynamic Range: ${result.dynamics?.dynamicRange?.toFixed(2)} dB`);
    console.log(`   BPM: ${result.bpm || 'N/A'}`);
    console.log(`   Stereo Width: ${result.stereo?.width?.toFixed(2)}`);

    // 6. Verificar se otimizações estão ativas
    console.log('\n🔍 7. Status das Otimizações:');
    console.log(`   ✅ Workers Paralelos: ${result.metadata?.useWorkers !== false ? 'ATIVO' : 'INATIVO'}`);
    console.log(`   ✅ FFT Otimizado: ${result.fft?.algorithm === 'fft-js' ? 'ATIVO' : 'DESCONHECIDO'}`);
    console.log(`   ✅ True Peak FFmpeg: ${result.truePeak?.method === 'ffmpeg' ? 'ATIVO' : 'JAVASCRIPT'}`);

    console.log('\n✅ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE TESTE:', error.message);
    console.error('📜 Stack:', error.stack);
    process.exit(1);
  }
}

testPerformance();
