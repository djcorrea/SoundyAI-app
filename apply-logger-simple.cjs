/**
 * Script Simplificado de Aplicação do Logger
 * Apenas substitui console.* por log/warn/error
 * SEM adicionar imports (usa funções globais do window)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Padrões de substituição
const REPLACEMENTS = [
  { from: /console\.log\(/g, to: 'log(' },
  { from: /console\.warn\(/g, to: 'warn(' },
  { from: /console\.error\(/g, to: 'error(' },
  { from: /console\.info\(/g, to: 'info(' },
  { from: /console\.debug\(/g, to: 'debug(' }
];

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'backup-',
  'logger.js',
  'apply-logger'
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isTargetFile(filePath) {
  return /\.(js|html)$/i.test(filePath);
}

function processDirectory(dir, stats = { processed: 0, modified: 0, errors: 0 }) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    if (shouldIgnore(filePath)) {
      continue;
    }
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath, stats);
    } else if (stat.isFile() && isTargetFile(filePath)) {
      processFile(filePath, stats);
    }
  }
  
  return stats;
}

function processFile(filePath, stats) {
  try {
    stats.processed++;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Verificar se já tem console.* antes de processar
    if (!/console\.(log|warn|error|info|debug)\(/.test(content)) {
      return;
    }
    
    // Aplicar substituições
    for (const replacement of REPLACEMENTS) {
      const matches = content.match(replacement.from);
      if (matches && matches.length > 0) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.modified++;
      
      const relativePath = path.relative(ROOT_DIR, filePath);
      console.log(`✅ ${relativePath}`);
    }
    
  } catch (err) {
    stats.errors++;
    const relativePath = path.relative(ROOT_DIR, filePath);
    console.error(`❌ ${relativePath}: ${err.message}`);
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Sistema de Logs - Aplicação Simplificada (SEM imports)   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const stats = processDirectory(PUBLIC_DIR);

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  RESULTADO                                                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`📊 Processados: ${stats.processed}`);
console.log(`✅ Modificados: ${stats.modified}`);
console.log(`❌ Erros: ${stats.errors}`);

if (stats.errors === 0) {
  console.log('\n✅ SUCESSO! Console.* substituídos por log/warn/error globais.');
  console.log('📝 Próximo: Adicione <script src="logger.js"></script> no topo do <head>');
} else {
  console.log('\n⚠️  Alguns erros ocorreram. Verifique os arquivos acima.');
}
