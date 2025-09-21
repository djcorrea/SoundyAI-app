const fs = require('fs');

// Ler o arquivo
const content = fs.readFileSync('public/audio-analyzer-integration.js', 'utf8');
const lines = content.split('\n');

console.log('Total de linhas antes:', lines.length);
console.log('Removendo linha 140 (} solto) e linha 139 (comentário órfão)');

// Remover as linhas 139 e 140 (índices 138 e 139)
const newLines = [
    ...lines.slice(0, 138),     // Antes da linha 139
    ...lines.slice(141)         // Depois da linha 140
];

console.log('Total de linhas depois:', newLines.length);
console.log('Linhas removidas:', lines.length - newLines.length);

// Salvar o arquivo corrigido
fs.writeFileSync('public/audio-analyzer-integration.js', newLines.join('\n'), 'utf8');

console.log('✅ Arquivo corrigido! Linha órfã removida.');