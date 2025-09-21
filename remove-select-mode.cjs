const fs = require('fs');

// Ler o arquivo
const content = fs.readFileSync('public/audio-analyzer-integration.js', 'utf8');
const lines = content.split('\n');

console.log('Total de linhas antes:', lines.length);
console.log('Removendo primeira função selectAnalysisMode (linhas 140-156)');

// Encontrar onde termina a primeira função
let endLine = 156; // Estimativa
for (let i = 140; i < 160; i++) {
    if (lines[i] && lines[i].trim() === '}') {
        endLine = i + 1;
        break;
    }
}

console.log(`Removendo linhas 140-${endLine}`);

// Remover as linhas da primeira função (índices 139 até endLine-1)
const newLines = [
    ...lines.slice(0, 139),     // Antes da linha 140
    ...lines.slice(endLine)     // Depois da função
];

console.log('Total de linhas depois:', newLines.length);
console.log('Linhas removidas:', lines.length - newLines.length);

// Salvar o arquivo corrigido
fs.writeFileSync('public/audio-analyzer-integration.js', newLines.join('\n'), 'utf8');

console.log('✅ Arquivo corrigido! Primeira função selectAnalysisMode removida.');