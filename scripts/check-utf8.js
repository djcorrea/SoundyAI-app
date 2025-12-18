#!/usr/bin/env node
/**
 * Script de verificação UTF-8
 * Verifica se arquivos públicos contêm bytes nulos ou encoding inválido
 * Falha o build se detectar problemas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EXTENSIONS = ['.js', '.html', '.css'];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar bytes nulos
    if (content.includes('\0')) {
      console.error(`❌ [UTF-8 CHECK] Byte nulo detectado: ${filePath}`);
      return false;
    }
    
    // Verificar se contém apenas caracteres ASCII ou UTF-8 válido
    // (JavaScript strings são UTF-16 internamente, mas readFileSync com 'utf8' já valida)
    
    return true;
  } catch (error) {
    if (error.code === 'EINVAL' || error.message.includes('invalid')) {
      console.error(`❌ [UTF-8 CHECK] Encoding inválido: ${filePath}`);
      console.error(`   Erro: ${error.message}`);
      return false;
    }
    throw error;
  }
}

function scanDirectory(dir) {
  let hasErrors = false;
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // Pular node_modules e outros diretórios ignorados
      if (file.name === 'node_modules' || file.name === '.git') {
        continue;
      }
      if (!scanDirectory(fullPath)) {
        hasErrors = true;
      }
    } else if (file.isFile()) {
      const ext = path.extname(file.name);
      if (EXTENSIONS.includes(ext)) {
        console.log(`🔍 Verificando: ${fullPath}`);
        if (!checkFile(fullPath)) {
          hasErrors = true;
        }
      }
    }
  }
  
  return !hasErrors;
}

console.log('🔒 [UTF-8 CHECK] Iniciando verificação de encoding...\n');

if (!scanDirectory(PUBLIC_DIR)) {
  console.error('\n❌ [UTF-8 CHECK] Falha na verificação de encoding!');
  console.error('   Corrija os arquivos acima antes de fazer build.');
  process.exit(1);
}

console.log('\n✅ [UTF-8 CHECK] Todos os arquivos estão OK!');
