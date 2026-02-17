/**
 * ============================================================================
 * TMP CLEANUP CHECK - VERIFICAÇÃO DE LIMPEZA
 * ============================================================================
 * 
 * Verifica se /tmp está limpo e lista itens residuais.
 * Pode ser usado após testes para confirmar cleanup.
 * 
 * Uso: node test/check-tmp.cjs [--clean]
 * 
 * --clean: Remove forçadamente todos os itens de /tmp
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const TMP_DIR = path.resolve(__dirname, '../tmp');
const shouldClean = process.argv.includes('--clean');

function checkTmp() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TMP CLEANUP CHECK');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`TMP DIR: ${TMP_DIR}\n`);

  if (!fs.existsSync(TMP_DIR)) {
    console.log('✓ Diretório /tmp não existe (clean)\n');
    return;
  }

  const items = fs.readdirSync(TMP_DIR);

  if (items.length === 0) {
    console.log('✓ /tmp está vazio (clean)\n');
    return;
  }

  console.log(`⚠ /tmp contém ${items.length} item(ns):\n`);

  items.forEach((item, i) => {
    const itemPath = path.join(TMP_DIR, item);
    const stats = fs.statSync(itemPath);
    const type = stats.isDirectory() ? 'DIR' : 'FILE';
    const size = stats.isFile() ? `${(stats.size / 1024).toFixed(2)} KB` : '';
    
    console.log(`  ${i + 1}. [${type}] ${item} ${size}`);
  });

  if (shouldClean) {
    console.log('\n→ Limpando /tmp forçadamente...\n');
    
    items.forEach(item => {
      const itemPath = path.join(TMP_DIR, item);
      try {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`  ✓ Removido: ${item}`);
      } catch (error) {
        console.log(`  ✗ Erro ao remover ${item}: ${error.message}`);
      }
    });

    console.log('\n✓ Limpeza concluída\n');
  } else {
    console.log('\n→ Use --clean para remover forçadamente\n');
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

checkTmp();
