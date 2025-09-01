/**
 * Eletrônico Quick Recalc - Reprocessar banco de referência seguindo pipeline do Funk Mandela
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

// Usar o ref-calibrator existente (mesmo usado no Mandela)
async function runRecalibrationEletronico() {
  console.log('🎛️ Reprocessando Eletrônico - Quick Recalc');
  console.log('📋 Pipeline: identical to Funk Mandela');
  
  try {
    // 1. Rodar calibrator para recalcular tolerâncias baseado nas faixas atuais
    console.log('📊 Executando calibrator...');
    
    const { spawn } = await import('node:child_process');
    
    await new Promise((resolve, reject) => {
      const samplesPath = path.resolve('refs/eletronico/samples');
      const proc = spawn('node', ['tools/ref-calibrator.js', 'eletronico', samplesPath, '--write'], { 
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
    
    // 2. Copiar referencias para public
    console.log('\n🔄 Copiando referencias para public...');
    
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
    
    // 3. Verificar resultado
    const jsonPath = path.resolve('refs/out/eletronico.json');
    if (fs.existsSync(jsonPath)) {
      const content = await fsp.readFile(jsonPath, 'utf8');
      const data = JSON.parse(content);
      
      console.log('\n📊 === BANCO REPROCESSADO ===');
      console.log(`Versão: ${data.eletronico?.version || 'N/A'}`);
      console.log(`Faixas: ${data.eletronico?.num_tracks || 'N/A'}`);
      console.log(`Data: ${data.eletronico?.generated_at || 'N/A'}`);
      
      if (data.eletronico?.legacy_compatibility || data.eletronico) {
        const compat = data.eletronico.legacy_compatibility || data.eletronico;
        console.log('\n🎯 === NOVOS TARGETS ===');
        console.log(`LUFS: ${compat.lufs_target} ± ${compat.tol_lufs}`);
        console.log(`True Peak: ${compat.true_peak_target} ± ${compat.tol_true_peak}`);
        console.log(`DR: ${compat.dr_target} ± ${compat.tol_dr}`);
        console.log(`LRA: ${compat.lra_target} ± ${compat.tol_lra}`);
        console.log(`Estéreo: ${compat.stereo_target} ± ${compat.tol_stereo}`);
        
        if (compat.bands) {
          console.log('\n🎛️ === BANDAS ATUALIZADAS ===');
          Object.entries(compat.bands).forEach(([band, data]) => {
            console.log(`${band}: ${data.target_db}dB ± ${data.tol_db}dB`);
          });
        }
      }
      
      console.log('\n✅ === REPROCESSAMENTO CONCLUÍDO ===');
      console.log('Sistema atualizado com novo banco de referência do Eletrônico');
      console.log('A análise agora usará os novos valores calculados');
      
    } else {
      throw new Error('Arquivo de referência não foi gerado');
    }
    
  } catch (error) {
    console.error('❌ Erro no reprocessamento:', error.message);
    process.exit(1);
  }
}

// Executar
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('quick-recalc-eletronico.js')) {
  runRecalibrationEletronico();
}
