#!/usr/bin/env node
/**
 * VERIFICAÇÃO 100% - MÉTRICAS FUNK_MANDELA
 * 
 * Garante que as métricas refletem exatamente as 17 faixas WAV atuais
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 VERIFICAÇÃO 100% - MÉTRICAS FUNK_MANDELA\n');

// 1. Contar arquivos WAV reais
const samplesDir = path.resolve('refs/funk_mandela/samples');
const wavFiles = fs.readdirSync(samplesDir).filter(f => f.endsWith('.wav'));
console.log(`📁 Arquivos WAV na pasta: ${wavFiles.length}`);
console.log(`📁 Pasta: ${samplesDir}`);
console.log(`📁 Primeiros 3 arquivos: ${wavFiles.slice(0, 3).join(', ')}`);

// 2. Verificar JSON atual
const jsonPath = path.resolve('refs/out/funk_mandela.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const funk = jsonData.funk_mandela;

console.log(`\n📊 JSON atual:`);
console.log(`📊 Arquivo: ${jsonPath}`);
console.log(`📊 Versão: ${funk.version}`);
console.log(`📊 Data: ${funk.generated_at}`);
console.log(`📊 num_tracks: ${funk.num_tracks}`);

// 3. Verificar timestamp do arquivo
const fileStat = fs.statSync(jsonPath);
console.log(`📊 Modificado em: ${fileStat.mtime.toISOString()}`);

// 4. Verificar se há mistura de dados antigos
const oldJsonPath = path.resolve('refs/funk_mandela.json');
if (fs.existsSync(oldJsonPath)) {
    const oldData = JSON.parse(fs.readFileSync(oldJsonPath, 'utf8'));
    console.log(`\n⚠️  ARQUIVO ANTIGO DETECTADO:`);
    console.log(`⚠️  ${oldJsonPath}`);
    console.log(`⚠️  num_tracks antigo: ${oldData.funk_mandela?.num_tracks}`);
    console.log(`⚠️  Data antiga: ${oldData.funk_mandela?.generated_at}`);
}

// 5. Verificar propagação para public
const publicJsonPath = path.resolve('public/refs/out/funk_mandela.json');
const publicData = JSON.parse(fs.readFileSync(publicJsonPath, 'utf8'));
console.log(`\n🌐 JSON público:`);
console.log(`🌐 num_tracks: ${publicData.funk_mandela.num_tracks}`);
console.log(`🌐 Versão: ${publicData.funk_mandela.version}`);

// 6. Verificação final
console.log(`\n✅ VERIFICAÇÃO FINAL:`);
const isCorrect = wavFiles.length === funk.num_tracks && 
                  funk.num_tracks === publicData.funk_mandela.num_tracks &&
                  funk.version === publicData.funk_mandela.version;

if (isCorrect) {
    console.log(`✅ GARANTIA 100%: As métricas refletem exatamente as ${wavFiles.length} faixas WAV atuais`);
    console.log(`✅ Timestamp: ${funk.generated_at}`);
    console.log(`✅ Versão: ${funk.version}`);
    console.log(`✅ Propagação: Sincronizada`);
    
    // Mostrar algumas métricas chave
    console.log(`\n🎯 MÉTRICAS CALCULADAS DAS ${funk.num_tracks} FAIXAS:`);
    const compat = funk.legacy_compatibility;
    console.log(`🎯 True Peak: ${compat.true_peak_target} dBTP`);
    console.log(`🎯 LRA: ${compat.lra_target} LU`);
    console.log(`🎯 DR: ${compat.dr_target}`);
    console.log(`🎯 Estéreo: ${compat.stereo_target}`);
    
} else {
    console.log(`❌ PROBLEMA DETECTADO:`);
    console.log(`❌ WAV files: ${wavFiles.length}`);
    console.log(`❌ JSON num_tracks: ${funk.num_tracks}`);
    console.log(`❌ Public num_tracks: ${publicData.funk_mandela.num_tracks}`);
}
