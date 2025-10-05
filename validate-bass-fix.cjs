#!/usr/bin/env node

/**
 * Script de validação para verificar se a duplicação da banda Bass foi completamente resolvida
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validando correção da duplicação da banda Bass no projeto...\n');

// Arquivos principais a verificar
const filesToCheck = [
    'public/audio-analyzer-integration.js',
    'teste-tabela-referencia-bandas.html'
];

let foundIssues = false;

filesToCheck.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️ Arquivo não encontrado: ${filePath}`);
        return;
    }
    
    console.log(`📁 Verificando: ${filePath}`);
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    
    let bassCount = 0;
    let lowBassCount = 0;
    let issuesInFile = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Buscar por definições de banda bass e low_bass com o mesmo nome
        if (line.includes('bass:') && line.includes('Bass (60') && line.includes('150')) {
            bassCount++;
            console.log(`  Linha ${lineNum}: bass → Bass (60–150Hz)`);
        }
        
        if (line.includes('low_bass:') && line.includes('Bass (60') && line.includes('150')) {
            lowBassCount++;
            console.log(`  ⚠️ Linha ${lineNum}: low_bass → Bass (60–150Hz) [POSSÍVEL DUPLICAÇÃO]`);
            issuesInFile.push(`Linha ${lineNum}: low_bass mapeado para Bass (60–150Hz)`);
        }
    });
    
    console.log(`  📊 Resultados:`);
    console.log(`    - 'bass' para Bass (60–150Hz): ${bassCount}x`);
    console.log(`    - 'low_bass' para Bass (60–150Hz): ${lowBassCount}x`);
    
    if (lowBassCount > 0) {
        console.log(`  ❌ PROBLEMA: ${lowBassCount} ocorrência(s) de low_bass mapeado para mesmo nome`);
        foundIssues = true;
        issuesInFile.forEach(issue => console.log(`    - ${issue}`));
    } else {
        console.log(`  ✅ OK: Nenhuma duplicação encontrada`);
    }
    
    console.log();
});

// Verificar se há outros arquivos que podem ter o problema
console.log('🔍 Verificando outros arquivos no projeto...');

function searchInDirectory(dir, pattern) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    let results = [];
    
    files.forEach(file => {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory() && !['node_modules', '.git', 'work'].includes(file.name)) {
            results = results.concat(searchInDirectory(fullPath, pattern));
        } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.html'))) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                
                // Buscar por padrões problemáticos
                const bassWithRange = (content.match(/bass.*Bass.*60.*150/gi) || []).length;
                const lowBassWithRange = (content.match(/low_bass.*Bass.*60.*150/gi) || []).length;
                
                if (bassWithRange > 0 || lowBassWithRange > 0) {
                    results.push({
                        file: path.relative(__dirname, fullPath),
                        bassCount: bassWithRange,
                        lowBassCount: lowBassWithRange
                    });
                }
            } catch (error) {
                // Ignorar arquivos que não podem ser lidos
            }
        }
    });
    
    return results;
}

const searchResults = searchInDirectory(__dirname, /bass.*Bass.*60.*150/gi);

if (searchResults.length > 0) {
    console.log('📊 Arquivos com referências à banda Bass (60-150Hz):');
    searchResults.forEach(result => {
        console.log(`  📁 ${result.file}`);
        console.log(`    - bass: ${result.bassCount}x`);
        console.log(`    - low_bass: ${result.lowBassCount}x`);
        
        if (result.lowBassCount > 0) {
            console.log(`    ⚠️ Potencial duplicação`);
            foundIssues = true;
        }
    });
} else {
    console.log('✅ Nenhum arquivo adicional encontrado com potenciais duplicações');
}

console.log('\n🎯 RESULTADO FINAL:');
if (foundIssues) {
    console.log('❌ ATENÇÃO: Possíveis duplicações ainda encontradas');
    console.log('   Recomendação: Revisar manualmente os arquivos mencionados');
} else {
    console.log('✅ SUCESSO: Nenhuma duplicação encontrada no projeto');
    console.log('   A correção foi aplicada com sucesso!');
}

console.log('\n💡 Dica: Execute o projeto e verifique se a tabela de resultados');
console.log('   não mostra mais a banda "Bass (60–150Hz)" duplicada.');