/**
 * Script para adicionar logger.js em TODAS as páginas HTML
 * Adiciona após o <title> tag, antes de qualquer outro script
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const LOGGER_TAG = '<script src="logger.js"></script>';
const LOGGER_COMMENT = '<!-- ✅ CRITICAL: Logger DEVE ser o primeiro script carregado -->';
const FULL_INJECTION = `\n    ${LOGGER_COMMENT}\n    ${LOGGER_TAG}\n    \n`;

function processHtmlFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar se já tem logger.js
    if (content.includes('logger.js')) {
      return { modified: false, reason: 'Já tem logger.js' };
    }
    
    // Procurar por </title> e adicionar logo após
    const titleCloseTag = '</title>';
    const titleIndex = content.indexOf(titleCloseTag);
    
    if (titleIndex === -1) {
      return { modified: false, reason: 'Não tem tag </title>' };
    }
    
    // Inserir logger após </title>
    const insertPosition = titleIndex + titleCloseTag.length;
    const before = content.substring(0, insertPosition);
    const after = content.substring(insertPosition);
    
    content = before + FULL_INJECTION + after;
    
    fs.writeFileSync(filePath, content, 'utf8');
    return { modified: true, reason: 'Logger adicionado' };
    
  } catch (err) {
    return { modified: false, reason: `Erro: ${err.message}` };
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Adicionando logger.js em TODAS as páginas HTML           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const files = fs.readdirSync(PUBLIC_DIR);
let stats = { processed: 0, modified: 0, skipped: 0, errors: 0 };

for (const file of files) {
  if (!file.endsWith('.html')) continue;
  
  const filePath = path.join(PUBLIC_DIR, file);
  stats.processed++;
  
  const result = processHtmlFile(filePath);
  
  if (result.modified) {
    stats.modified++;
    console.log(`✅ ${file.padEnd(50)} - ${result.reason}`);
  } else {
    stats.skipped++;
    console.log(`⏭️  ${file.padEnd(50)} - ${result.reason}`);
  }
}

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  RESULTADO                                                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`📊 Processados: ${stats.processed}`);
console.log(`✅ Modificados: ${stats.modified}`);
console.log(`⏭️  Ignorados: ${stats.skipped}`);
console.log(`❌ Erros: ${stats.errors}`);

console.log('\n✅ SUCESSO! Logger.js adicionado em todas as páginas necessárias.');
