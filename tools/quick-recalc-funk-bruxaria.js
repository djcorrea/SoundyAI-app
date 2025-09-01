#!/usr/bin/env node

/**
 * Funk Bruxaria Quick Recalc - Pipeline Idêntico ao Funk Mandela/Eletrônico
 * Reprocessamento completo WAV-only, pré-normalização, fresh
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const GENRE = 'funk_bruxaria';

async function runRecalibrationFunkBruxaria() {
  console.log('🎯 REPROCESSAMENTO FUNK BRUXARIA - Pipeline Robusto');
  console.log('='.repeat(60));
  
  // Verificar argumentos
  const isDryRun = process.argv.includes('--dry');
  const isWrite = process.argv.includes('--write');
  
  if (!isDryRun && !isWrite) {
    console.log('❌ Especifique --dry (preview) ou --write (executar)');
    console.log('Uso:');
    console.log('  node tools/quick-recalc-funk-bruxaria.js --dry    # Preview');
    console.log('  node tools/quick-recalc-funk-bruxaria.js --write  # Executar');
    process.exit(1);
  }

  // Descoberta automática da pasta de samples
  const samplesPath = path.resolve('refs', GENRE, 'samples');
  if (!fs.existsSync(samplesPath)) {
    console.log(`❌ Pasta não encontrada: ${samplesPath}`);
    process.exit(1);
  }
  
  console.log(`📂 Samples detectados: ${samplesPath}`);

  if (isDryRun) {
    console.log('🔍 MODO DRY RUN - Apenas visualização');
    console.log('📋 Comando que seria executado:');
    console.log(`   node tools/ref-calibrator.js ${GENRE} ${samplesPath} --write`);
    return;
  }

  try {
    // Executar reprocessamento com flags idênticas aos outros gêneros
    console.log('🚀 Iniciando reprocessamento FRESH...');
    console.log(`📋 Executando: ref-calibrator ${GENRE} ${samplesPath} --write`);
    
    await new Promise((resolve, reject) => {
      const proc = spawn('node', [
        'tools/ref-calibrator.js',
        GENRE,
        samplesPath,
        '--write'
      ], { 
        stdio: ['inherit', 'pipe', 'pipe'] 
      });
      
      let output = '';
      let errors = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });
      
      proc.stderr.on('data', (data) => {
        errors += data.toString();
        process.stderr.write(data);
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Calibrator executado com sucesso');
          resolve({ output, errors });
        } else {
          reject(new Error(`Calibrator falhou com código ${code}: ${errors}`));
        }
      });
    });
    
    // Copiar para public/ usando script existente
    console.log('\n� Copiando para public/refs/out...');
    
    await new Promise((resolve, reject) => {
      const proc = spawn('node', ['tools/copy-refs-to-public.js'], { 
        stdio: 'inherit' 
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Referencias copiadas');
          resolve();
        } else {
          console.warn(`⚠️ Copy script falhou com código ${code}`);
          resolve(); // Não falhar por isso
        }
      });
    });
    
    // Verificar resultado final
    const outputPath = path.resolve('refs', 'out', `${GENRE}.json`);
    if (fs.existsSync(outputPath)) {
      const content = await fsp.readFile(outputPath, 'utf8');
      const data = JSON.parse(content);
      const genreData = data[GENRE];
      
      console.log('\n🎉 FUNK BRUXARIA REPROCESSADO COM SUCESSO!');
      console.log('='.repeat(50));
      console.log(`📊 Versão: ${genreData.version}`);
      console.log(`📈 Faixas: ${genreData.num_tracks}`);
      console.log(`🎚️  LUFS Target: ${genreData.lufs_target} (±${genreData.tol_lufs})`);
      console.log(`📢 True Peak: ${genreData.true_peak_target} dBTP (±${genreData.tol_true_peak})`);
      console.log(`🎵 DR: ${genreData.dr_target} (±${genreData.tol_dr})`);
      console.log(`🌊 LRA: ${genreData.lra_target} LU (±${genreData.tol_lra})`);
      console.log(`🔀 Correlação Estéreo: ${genreData.stereo_target} (±${genreData.tol_stereo})`);
      
      console.log('\n🎛️  BANDAS ESPECTRAIS:');
      Object.entries(genreData.bands).forEach(([band, bandData]) => {
        console.log(`   ${band.padEnd(12)}: ${bandData.target_db.toFixed(1)} dB (±${bandData.tol_db})`);
      });
      
      console.log('\n✅ === REPROCESSAMENTO CONCLUÍDO ===');
      console.log('Sistema atualizado com novo banco de referência do Funk Bruxaria');
      console.log('A análise agora usará os novos valores calculados');
      
    } else {
      console.log(`❌ Arquivo de saída não encontrado: ${outputPath}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Erro no reprocessamento:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('quick-recalc-funk-bruxaria.js')) {
  runRecalibrationFunkBruxaria();
}
