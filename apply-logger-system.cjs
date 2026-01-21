/**
 * Script de Aplicação do Sistema Centralizado de Logs
 * 
 * Este script substitui todos os usos de console.log/warn/error
 * pelas funções centralizadas do logger.js
 * 
 * ATENÇÃO: Execute este script APENAS UMA VEZ
 */

const fs = require('fs');
const path = require('path');

// ===========================
// CONFIGURAÇÕES
// ===========================
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const BACKUP_DIR = path.join(ROOT_DIR, 'backup-pre-logger');

// Padrões de substituição
const REPLACEMENTS = [
  { from: /console\.log\(/g, to: 'log(' },
  { from: /console\.warn\(/g, to: 'warn(' },
  { from: /console\.error\(/g, to: 'error(' },
  { from: /console\.info\(/g, to: 'info(' },
  { from: /console\.debug\(/g, to: 'debug(' }
];

// Arquivos a serem ignorados
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'backup-',
  'logger.js', // Não processar o próprio logger
  'apply-logger-system.js' // Não processar este script
];

// ===========================
// FUNÇÕES AUXILIARES
// ===========================

/**
 * Verifica se um caminho deve ser ignorado
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

/**
 * Verifica se é arquivo JavaScript ou HTML
 */
function isTargetFile(filePath) {
  return /\.(js|html)$/i.test(filePath);
}

/**
 * Processa recursivamente um diretório
 */
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

/**
 * Processa um arquivo individual
 */
function processFile(filePath, stats) {
  try {
    stats.processed++;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Verificar se já tem console.* antes de processar
    if (!/console\.(log|warn|error|info|debug)\(/.test(content)) {
      return; // Nada a fazer neste arquivo
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
      // Adicionar import do logger se for arquivo .js
      if (filePath.endsWith('.js') && !content.includes('logger.js')) {
        // Verificar se já importa ou declara as funções log/warn/error
        if (!content.includes('function log(') && 
            !content.includes('import { log') &&
            !content.includes('from \'./logger.js\'')) {
          
          // Adicionar comentário e importação no topo
          const importStatement = `// Sistema Centralizado de Logs - Importado automaticamente\nimport { log, warn, error, info, debug } from './logger.js';\n\n`;
          content = importStatement + content;
        }
      }
      
      // Adicionar script tag do logger se for arquivo .html
      if (filePath.endsWith('.html') && !content.includes('logger.js')) {
        // Procurar tag </head> para inserir antes
        if (content.includes('</head>')) {
          const loggerScript = '    <!-- Sistema Centralizado de Logs -->\n    <script src="logger.js"></script>\n    <script>\n        // Importar funções do logger para escopo global\n        const { log, warn, error, info, debug } = window.logger;\n    </script>\n';
          content = content.replace('</head>', loggerScript + '</head>');
        }
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      stats.modified++;
      
      const relativePath = path.relative(ROOT_DIR, filePath);
      console.log(`✅ Modificado: ${relativePath}`);
    }
    
  } catch (err) {
    stats.errors++;
    const relativePath = path.relative(ROOT_DIR, filePath);
    console.error(`❌ Erro ao processar ${relativePath}:`, err.message);
  }
}

/**
 * Cria backup do diretório public
 */
function createBackup() {
  console.log('\n📦 Criando backup...');
  
  if (fs.existsSync(BACKUP_DIR)) {
    console.log('⚠️  Backup já existe, pulando...');
    return;
  }
  
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    copyDir(PUBLIC_DIR, BACKUP_DIR);
    console.log('✅ Backup criado com sucesso\n');
  } catch (err) {
    console.error('❌ Erro ao criar backup:', err.message);
    process.exit(1);
  }
}

/**
 * Copia diretório recursivamente
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ===========================
// EXECUÇÃO PRINCIPAL
// ===========================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Sistema Centralizado de Logs - Script de Aplicação       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  ATENÇÃO: Este script vai modificar todos os arquivos .js e .html');
console.log('⚠️  Um backup será criado automaticamente\n');

// Criar backup
createBackup();

// Processar diretório public
console.log('🔄 Processando arquivos...\n');
const stats = processDirectory(PUBLIC_DIR);

// Exibir resultados
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  RESULTADO DA APLICAÇÃO                                    ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`📊 Arquivos processados: ${stats.processed}`);
console.log(`✅ Arquivos modificados: ${stats.modified}`);
console.log(`❌ Erros encontrados: ${stats.errors}`);

if (stats.errors === 0) {
  console.log('\n✅ SUCESSO! Sistema de logs centralizado aplicado com sucesso.');
  console.log('📝 Próximos passos:');
  console.log('   1. Testar o site localmente');
  console.log('   2. Verificar se nenhum console.* direto restou');
  console.log('   3. Alterar DEBUG = true no logger.js para testar logs');
  console.log('   4. Fazer commit das mudanças');
} else {
  console.log('\n⚠️  ATENÇÃO! Alguns erros foram encontrados.');
  console.log('   Verifique os arquivos listados acima.');
}

console.log('\n💡 Para reverter, copie os arquivos de:', BACKUP_DIR);
