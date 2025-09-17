import fs from 'fs';
const content = fs.readFileSync('public/audio-analyzer-integration.js', 'utf8');
const lines = content.split('\n');

console.log('Procurando funções duplicadas...');

const functions = new Map();
const duplicates = [];

lines.forEach((line, index) => {
  const match = line.match(/^(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
  if (match) {
    const funcName = match[2];
    if (functions.has(funcName)) {
      duplicates.push({ name: funcName, firstLine: functions.get(funcName), duplicateLine: index + 1 });
    } else {
      functions.set(funcName, index + 1);
    }
  }
});

console.log('Funções duplicadas encontradas:');
duplicates.forEach(dup => {
  console.log(`${dup.name}: primeira em linha ${dup.firstLine}, duplicata em linha ${dup.duplicateLine}`);
});