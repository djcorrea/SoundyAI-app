/**
 * 🕵️ INVESTIGAÇÃO DOS CÁLCULOS DE REFERÊNCIA
 * Verificar se os valores de LUFS estão corretos
 */

console.log('🔍 AUDITORIA DOS CÁLCULOS DE REFERÊNCIA');
console.log('='.repeat(50));

// Comparar valores antigos vs novos
const oldFunkMandela = {
  lufs_target: -9.5,  // do ROLLBACK_FUNK_MANDELA_PREV.json
  num_tracks: 41
};

const newFunkMandela = {
  lufs_target: -4.9,  // do funk_mandela.json atual
  num_tracks: 17
};

const backupFunkMandela = {
  lufs_target: -8.0,  // do funk_mandela_backup_spectral.json
  num_tracks: 17
};

console.log('📊 COMPARAÇÃO DE VALORES LUFS:');
console.log(`Antigo (41 tracks): ${oldFunkMandela.lufs_target} LUFS`);
console.log(`Backup (17 tracks): ${backupFunkMandela.lufs_target} LUFS`);
console.log(`Atual  (17 tracks): ${newFunkMandela.lufs_target} LUFS`);
console.log('');

// Calcular diferenças
const diffOldNew = newFunkMandela.lufs_target - oldFunkMandela.lufs_target;
const diffBackupNew = newFunkMandela.lufs_target - backupFunkMandela.lufs_target;

console.log('📈 ANÁLISE DAS DIFERENÇAS:');
console.log(`Diferença Antigo → Atual: ${diffOldNew > 0 ? '+' : ''}${diffOldNew.toFixed(1)} dB`);
console.log(`Diferença Backup → Atual: ${diffBackupNew > 0 ? '+' : ''}${diffBackupNew.toFixed(1)} dB`);
console.log('');

// Verificar se -4.9 LUFS faz sentido
console.log('🚨 ANÁLISE DE VALIDADE:');
console.log('LUFS -4.9 é EXTREMAMENTE ALTO para música:');
console.log('- Spotify: ~-14 LUFS (padrão streaming)');
console.log('- YouTube: ~-13 LUFS');
console.log('- Broadcasting: ~-23 LUFS (EBU R128)');
console.log('- Música comercial: -8 a -12 LUFS (típico)');
console.log('- Funk brasileiro: -6 a -10 LUFS (esperado)');
console.log('');
console.log(`❌ -4.9 LUFS está ${Math.abs(-4.9 - (-10)).toFixed(1)}dB ACIMA do esperado!`);
console.log('');

// Verificar outros gêneros para comparação
const eletronico = { lufs_target: -12.8 };
const eletrofunk = { lufs_target: -9.2 };

console.log('🎵 COMPARAÇÃO COM OUTROS GÊNEROS:');
console.log(`Eletrônico: ${eletronico.lufs_target} LUFS (razoável)`);
console.log(`Eletrofunk: ${eletrofunk.lufs_target} LUFS (razoável)`);
console.log(`Funk Mandela: ${newFunkMandela.lufs_target} LUFS (SUSPEITO!)`);
console.log('');

// Hipóteses do problema
console.log('🤔 POSSÍVEIS CAUSAS DO ERRO:');
console.log('1. Erro na normalização: pode estar usando RMS em vez de LUFS');
console.log('2. Erro de unidade: pode estar somando em linear em vez de dB');
console.log('3. Erro de sinal: pode estar invertendo valores');
console.log('4. Dataset corrupto: músicas muito distorcidas/clippadas');
console.log('5. Bug no script de recálculo: média aritmética incorreta');
console.log('');

// Sugestões de verificação
console.log('✅ PRÓXIMOS PASSOS PARA VERIFICAR:');
console.log('1. Auditar script metrics-recalc.js linha por linha');
console.log('2. Verificar se as 17 músicas do dataset são válidas');
console.log('3. Recalcular manualmente uma amostra pequena');
console.log('4. Comparar com valores do backup (-8.0 LUFS)');
console.log('5. Verificar se há inversão de sinal nos cálculos');
console.log('');

console.log('🎯 RECOMENDAÇÃO:');
console.log('USAR VALORES DO BACKUP (-8.0 LUFS) ATÉ REVALIDAR O CÁLCULO');
console.log('O valor -4.9 LUFS está matematicamente incorreto para música');
