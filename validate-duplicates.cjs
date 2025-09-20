// Script para identificar funções duplicadas no audio-analyzer-integration.js
const fs = require('fs');

const content = fs.readFileSync('audio-analyzer-integration.js', 'utf8');
const lines = content.split('\n');

const functions = new Map();
const duplicates = [];

// Buscar declarações de funções (incluindo async)
lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (match) {
        const funcName = match[1];
        if (functions.has(funcName)) {
            duplicates.push({
                name: funcName,
                first: functions.get(funcName),
                second: index + 1
            });
        } else {
            functions.set(funcName, index + 1);
        }
    }
});

console.log('🔍 FUNÇÕES DUPLICADAS ENCONTRADAS:');
console.log('=====================================');

if (duplicates.length === 0) {
    console.log('✅ Nenhuma função duplicada encontrada!');
} else {
    duplicates.forEach(dup => {
        console.log(`❌ ${dup.name}:`);
        console.log(`   Primeira ocorrência: linha ${dup.first}`);
        console.log(`   Segunda ocorrência: linha ${dup.second}`);
        console.log('');
    });
}

console.log(`\n📊 ESTATÍSTICAS:`);
console.log(`Total de linhas: ${lines.length}`);
console.log(`Total de funções: ${functions.size}`);
console.log(`Funções duplicadas: ${duplicates.length}`);