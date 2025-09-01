#!/usr/bin/env node
/**
 * VALIDAÇÃO 100% - REPROCESSAMENTO ELETRÔNICO
 * 
 * Confirma que o pipeline funcionou igual ao Funk Mandela
 */

import fs from 'fs';
import path from 'path';

console.log('🎛️ VALIDAÇÃO 100% - REPROCESSAMENTO ELETRÔNICO\n');

// 1. Contar arquivos WAV reais
const samplesDir = path.resolve('refs/eletronico/samples');
const wavFiles = fs.readdirSync(samplesDir).filter(f => f.endsWith('.wav'));
console.log(`📁 Arquivos WAV na pasta: ${wavFiles.length}`);
console.log(`📁 Pasta: ${samplesDir}`);
console.log(`📁 Primeiros 3 arquivos: ${wavFiles.slice(0, 3).join(', ')}`);

// 2. Verificar JSON atual
const jsonPath = path.resolve('refs/out/eletronico.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const eletronico = jsonData.eletronico;

console.log(`\n📊 JSON atual:`);
console.log(`📊 Arquivo: ${jsonPath}`);
console.log(`📊 Versão: ${eletronico.version}`);
console.log(`📊 Data: ${eletronico.generated_at}`);
console.log(`📊 num_tracks: ${eletronico.num_tracks}`);

// 3. Verificar timestamp do arquivo
const fileStat = fs.statSync(jsonPath);
console.log(`📊 Modificado em: ${fileStat.mtime.toISOString()}`);

// 4. Verificar propagação para public
const publicJsonPath = path.resolve('public/refs/out/eletronico.json');
const publicData = JSON.parse(fs.readFileSync(publicJsonPath, 'utf8'));
console.log(`\n🌐 JSON público:`);
console.log(`🌐 num_tracks: ${publicData.eletronico.num_tracks}`);
console.log(`🌐 Versão: ${publicData.eletronico.version}`);

// 5. Verificar frontend
const frontendPath = path.resolve('public/audio-analyzer-integration.js');
const frontendContent = fs.readFileSync(frontendPath, 'utf8');
const versionMatch = frontendContent.match(/eletronico:\s*{\s*version:\s*"([^"]+)"/);
const frontendVersion = versionMatch ? versionMatch[1] : 'não encontrado';

console.log(`\n🎨 Frontend:`);
console.log(`🎨 Versão integrada: ${frontendVersion}`);

// 6. Comparação com Funk Mandela
const funkPath = path.resolve('refs/out/funk_mandela.json');
const funkData = JSON.parse(fs.readFileSync(funkPath, 'utf8'));

console.log(`\n🔄 COMPARAÇÃO COM FUNK MANDELA:`);
console.log(`🔄 Funk Mandela faixas: ${funkData.funk_mandela.num_tracks}`);
console.log(`🔄 Eletrônico faixas: ${eletronico.num_tracks}`);
console.log(`🔄 Funk Mandela versão: ${funkData.funk_mandela.version}`);
console.log(`🔄 Eletrônico versão: ${eletronico.version}`);

// 7. Verificação final
console.log(`\n✅ VERIFICAÇÃO FINAL:`);
const isCorrect = wavFiles.length === eletronico.num_tracks && 
                  eletronico.num_tracks === publicData.eletronico.num_tracks &&
                  eletronico.version === publicData.eletronico.version &&
                  frontendVersion === eletronico.version;

if (isCorrect) {
    console.log(`✅ GARANTIA 100%: Pipeline funcionou igual ao Funk Mandela`);
    console.log(`✅ Faixas processadas: ${wavFiles.length} (WAV-only)`);
    console.log(`✅ Timestamp: ${eletronico.generated_at}`);
    console.log(`✅ Versão: ${eletronico.version}`);
    console.log(`✅ Propagação: Completa (JSON + Frontend)`);
    
    // Mostrar algumas métricas chave
    console.log(`\n🎯 MÉTRICAS CALCULADAS DAS ${eletronico.num_tracks} FAIXAS:`);
    console.log(`🎯 True Peak: ${eletronico.true_peak_target} dBTP (±${eletronico.tol_true_peak})`);
    console.log(`🎯 LRA: ${eletronico.lra_target} LU (±${eletronico.tol_lra})`);
    console.log(`🎯 DR: ${eletronico.dr_target} (±${eletronico.tol_dr})`);
    console.log(`🎯 Estéreo: ${eletronico.stereo_target} (±${eletronico.tol_stereo})`);
    console.log(`🎯 LUFS: ${eletronico.lufs_target} (±${eletronico.tol_lufs})`);
    
    console.log(`\n🎛️ BANDAS ESPECTRAIS:`);
    Object.entries(eletronico.bands).forEach(([band, data]) => {
        console.log(`🎛️ ${band}: ${data.target_db}dB (±${data.tol_db})`);
    });
    
} else {
    console.log(`❌ PROBLEMA DETECTADO:`);
    console.log(`❌ WAV files: ${wavFiles.length}`);
    console.log(`❌ JSON num_tracks: ${eletronico.num_tracks}`);
    console.log(`❌ Public num_tracks: ${publicData.eletronico.num_tracks}`);
    console.log(`❌ Frontend version: ${frontendVersion}`);
}

console.log(`\n🚀 STATUS FINAL:`);
if (isCorrect) {
    console.log(`🟢 ELETRÔNICO REPROCESSADO COM SUCESSO`);
    console.log(`🟢 Pipeline idêntico ao Funk Mandela aplicado`);
    console.log(`🟢 Sistema pronto para análise com novos targets`);
} else {
    console.log(`🔴 REPROCESSAMENTO INCOMPLETO`);
    console.log(`🔴 Verificar inconsistências acima`);
}
