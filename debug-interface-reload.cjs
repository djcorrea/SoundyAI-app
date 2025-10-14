#!/usr/bin/env node

/**
 * Debug Interface Reload - Força a interface a recarregar dados corretos
 * Este script verifica se os JSONs estão corretos e gera comandos para teste na interface
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 DEBUG INTERFACE RELOAD - Verificando arquivos JSON...\n');

// Verificar se todos os arquivos JSON têm valores corretos
const generos = ['funk_mandela', 'funk_bruxaria', 'trance', 'trap', 'eletrofunk', 'funk_automotivo', 'tech_house', 'techno', 'house', 'brazilian_phonk', 'phonk'];
const jsonDir = path.join(__dirname, 'public', 'refs', 'out');

console.log('📁 Diretório JSON:', jsonDir);
console.log('📋 Verificando arquivos...\n');

let todosCorretos = true;

for (const genero of generos) {
    const jsonFile = path.join(jsonDir, `${genero}.json`);
    
    if (!fs.existsSync(jsonFile)) {
        console.error(`❌ Arquivo não existe: ${jsonFile}`);
        todosCorretos = false;
        continue;
    }
    
    try {
        const content = fs.readFileSync(jsonFile, 'utf8');
        const data = JSON.parse(content);
        const genreData = data[genero];
        
        if (!genreData) {
            console.error(`❌ ${genero}: Estrutura de gênero ausente`);
            todosCorretos = false;
            continue;
        }
        
        const bands = genreData.legacy_compatibility?.bands;
        if (!bands) {
            console.error(`❌ ${genero}: Bandas não encontradas`);
            todosCorretos = false;
            continue;
        }
        
        // Verificar se os valores estão na faixa realística (entre -40 e -10 dB)
        let valoresOk = true;
        Object.entries(bands).forEach(([banda, info]) => {
            if (info.target_db > -10 || info.target_db < -40) {
                console.warn(`⚠️ ${genero}.${banda}: ${info.target_db} dB (fora da faixa -40 a -10)`);
                valoresOk = false;
            }
        });
        
        if (valoresOk) {
            console.log(`✅ ${genero}: Valores corretos (${genreData.lufs_target} LUFS)`);
            console.log(`   📊 Bandas: sub(${bands.sub.target_db}), presença(${bands.presenca.target_db})`);
        } else {
            console.error(`❌ ${genero}: Valores incorretos`);
            todosCorretos = false;
        }
        
    } catch (error) {
        console.error(`❌ ${genero}: Erro ao ler JSON:`, error.message);
        todosCorretos = false;
    }
}

console.log('\n' + '='.repeat(60));

if (todosCorretos) {
    console.log('✅ TODOS OS ARQUIVOS JSON ESTÃO CORRETOS!');
    console.log('\n🔧 COMANDOS PARA TESTAR NA INTERFACE:');
    console.log('\n1. Abra o console do navegador (F12)');
    console.log('2. Execute este código para limpar cache e recarregar:');
    console.log('\n```javascript');
    console.log('// Limpar todos os caches');
    console.log('window.REFS_BYPASS_CACHE = true;');
    console.log('delete window.__refDataCache;');
    console.log('window.__refDataCache = {};');
    console.log('localStorage.clear();');
    console.log('sessionStorage.clear();');
    console.log('');
    console.log('// Ativar debug para ver carregamento');
    console.log('window.__DEBUG_ANALYZER__ = true;');
    console.log('');
    console.log('// Force reload da página');
    console.log('window.location.reload(true);');
    console.log('```');
    console.log('\n3. Ou use este comando direto para testar funk_mandela:');
    console.log('\n```javascript');
    console.log('// Teste direto');
    console.log('fetch("/refs/out/funk_mandela.json?v=" + Date.now())');
    console.log('  .then(r => r.json())');
    console.log('  .then(data => {');
    console.log('    const bands = data.funk_mandela.legacy_compatibility.bands;');
    console.log('    console.log("Sub:", bands.sub.target_db, "dB");');
    console.log('    console.log("Presença:", bands.presenca.target_db, "dB");');
    console.log('    console.log("LUFS:", data.funk_mandela.legacy_compatibility.lufs_target);');
    console.log('  });');
    console.log('```');
    
} else {
    console.error('❌ ALGUNS ARQUIVOS JSON ESTÃO INCORRETOS!');
    console.log('\n🔧 Execute o script de correção primeiro:');
    console.log('node corrigir-valores-bandas.cjs');
}

console.log('\n' + '='.repeat(60));
