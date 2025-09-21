const fs = require('fs');

// Ler o arquivo
const content = fs.readFileSync('public/audio-analyzer-integration.js', 'utf8');
const lines = content.split('\n');

console.log('Total de linhas antes:', lines.length);
console.log('Removendo linhas 1629-1641 (função closeModeSelectionModal duplicada)');

// Remover as linhas da função duplicada (índices 1628-1640)
const newLines = [
    ...lines.slice(0, 1628),  // Antes da linha 1629
    ...lines.slice(1641)      // Depois da linha 1641
];

console.log('Total de linhas depois:', newLines.length);
console.log('Linhas removidas:', lines.length - newLines.length);

// Salvar o arquivo corrigido
fs.writeFileSync('public/audio-analyzer-integration.js', newLines.join('\n'), 'utf8');

console.log('✅ Arquivo corrigido! Função duplicada removida.');