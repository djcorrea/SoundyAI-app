// scripts/cleanup-users.js
// 🔥 SCRIPT DE LIMPEZA DE USUÁRIOS DE TESTE - PRÉ-LANÇAMENTO
// ⚠️  ATENÇÃO: Este script APAGA PERMANENTEMENTE usuários do Firebase
// ✅ Mantém APENAS usuários com plano "dj" (válidos ou com expiração futura)

import { getAdmin, getAuth, getFirestore } from '../firebase/admin.js';

// ========================================
// 🚨 CONFIGURAÇÃO DE SEGURANÇA
// ========================================

/**
 * ⚠️⚠️⚠️ DRY_RUN = false (PADRÃO) ⚠️⚠️⚠️
 * 
 * NUNCA mude para false sem antes:
 * 1. Rodar em modo DRY_RUN
 * 2. Revisar TODOS os usuários que serão apagados
 * 3. Confirmar que NENHUM usuário DJ será removido
 * 4. Fazer backup do Firestore (Console Firebase > Firestore > Export)
 * 
 * Para ativar modo destrutivo:
 * - Mude manualmente para: const DRY_RUN = false;
 * - Rode: node scripts/cleanup-users.js
 */
const DRY_RUN = false;

// ========================================
// 🎯 CONFIGURAÇÕES
// ========================================

const USERS_COLLECTION = 'usuarios';
const BATCH_SIZE = 1000; // Limite do listUsers()

// ========================================
// 📊 ESTATÍSTICAS GLOBAIS
// ========================================

const stats = {
  total: 0,
  kept: [],
  deleted: [],
  errors: [],
};

// ========================================
// 🔍 FUNÇÕES AUXILIARES
// ========================================

/**
 * Verificar se um usuário deve ser mantido (plano DJ válido)
 * @param {Object} firestoreDoc - Documento do Firestore
 * @param {string} uid - UID do usuário
 * @returns {Object} { shouldKeep: boolean, reason: string }
 */
function shouldKeepUser(firestoreDoc, uid) {
  // Caso 1: Sem documento no Firestore → Considerar usuário de teste
  if (!firestoreDoc || !firestoreDoc.exists) {
    return {
      shouldKeep: false,
      reason: 'NO_FIRESTORE_DOC',
    };
  }

  const data = firestoreDoc.data();
  const plan = data.plan?.toLowerCase();

  // Caso 2: Plano não é DJ → APAGAR
  if (plan !== 'dj') {
    return {
      shouldKeep: false,
      reason: `PLAN_${(plan || 'null').toUpperCase()}`,
    };
  }

  // Caso 3: Plano DJ com expiração
  if (data.djExpiresAt) {
    const expiresAt = new Date(data.djExpiresAt).getTime();
    const now = Date.now();

    // Se já expirou, apagar
    if (now > expiresAt) {
      return {
        shouldKeep: false,
        reason: 'DJ_EXPIRED',
        details: `Expirou em ${new Date(expiresAt).toISOString()}`,
      };
    }

    // Ainda não expirou, manter
    return {
      shouldKeep: true,
      reason: 'DJ_VALID',
      details: `Expira em ${new Date(expiresAt).toISOString()}`,
    };
  }

  // Caso 4: Plano DJ sem data de expiração → MANTER (pode ser vitalício)
  return {
    shouldKeep: true,
    reason: 'DJ_NO_EXPIRATION',
    details: 'DJ sem expiração (vitalício)',
  };
}

/**
 * Excluir usuário do Firestore e Auth
 * @param {string} uid - UID do usuário
 * @param {Object} auth - Instância do Firebase Auth
 * @param {Object} db - Instância do Firestore
 * @returns {Promise<Object>} Resultado da exclusão
 */
async function deleteUser(uid, auth, db) {
  const result = {
    firestoreDeleted: false,
    authDeleted: false,
    error: null,
  };

  try {
    // Etapa 1: Excluir documento do Firestore
    try {
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      await userRef.delete();
      result.firestoreDeleted = true;
      console.log(`  ✅ Firestore doc excluído: ${uid}`);
    } catch (err) {
      console.error(`  ❌ Erro ao excluir Firestore doc: ${err.message}`);
      result.error = err.message;
      // Continuar para tentar excluir do Auth mesmo assim
    }

    // Etapa 2: Excluir usuário do Auth
    try {
      await auth.deleteUser(uid);
      result.authDeleted = true;
      console.log(`  ✅ Auth user excluído: ${uid}`);
    } catch (err) {
      console.error(`  ❌ Erro ao excluir Auth user: ${err.message}`);
      result.error = result.error ? `${result.error}; ${err.message}` : err.message;
    }
  } catch (err) {
    console.error(`  ❌ Erro geral ao excluir ${uid}: ${err.message}`);
    result.error = err.message;
  }

  return result;
}

/**
 * Processar um lote de usuários
 * @param {Array} users - Lista de usuários do Auth
 * @param {Object} auth - Instância do Firebase Auth
 * @param {Object} db - Instância do Firestore
 */
async function processBatch(users, auth, db) {
  for (const user of users) {
    const uid = user.uid;
    const email = user.email || 'NO_EMAIL';

    stats.total++;

    try {
      // Buscar documento no Firestore
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      const userDoc = await userRef.get();

      // Decidir se deve manter ou apagar
      const decision = shouldKeepUser(userDoc, uid);

      if (decision.shouldKeep) {
        // MANTER
        console.log(`[MANTER] ${email} (${uid}) - ${decision.reason}${decision.details ? ` - ${decision.details}` : ''}`);
        stats.kept.push({
          uid,
          email,
          reason: decision.reason,
          details: decision.details,
        });
      } else {
        // APAGAR
        console.log(`[APAGAR] ${email} (${uid}) - ${decision.reason}${decision.details ? ` - ${decision.details}` : ''}`);

        if (!DRY_RUN) {
          // Modo destrutivo: executar exclusão
          const deleteResult = await deleteUser(uid, auth, db);

          stats.deleted.push({
            uid,
            email,
            reason: decision.reason,
            firestoreDeleted: deleteResult.firestoreDeleted,
            authDeleted: deleteResult.authDeleted,
            error: deleteResult.error,
          });
        } else {
          // Modo DRY_RUN: apenas marcar para exclusão
          stats.deleted.push({
            uid,
            email,
            reason: decision.reason,
          });
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao processar ${email} (${uid}): ${err.message}`);
      stats.errors.push({
        uid,
        email,
        error: err.message,
      });
    }
  }
}

// ========================================
// 🚀 FUNÇÃO PRINCIPAL
// ========================================

async function main() {
  console.log('========================================');
  console.log('🔥 LIMPEZA DE USUÁRIOS - PRÉ-LANÇAMENTO');
  console.log('========================================');
  console.log(`⚙️  Modo: ${DRY_RUN ? '🔒 DRY RUN (seguro)' : '⚠️  DESTRUTIVO'}`);
  console.log(`📦 Collection: ${USERS_COLLECTION}`);
  console.log(`📅 Data: ${new Date().toISOString()}`);
  console.log('========================================\n');

  if (!DRY_RUN) {
    console.log('⚠️⚠️⚠️  MODO DESTRUTIVO ATIVADO ⚠️⚠️⚠️');
    console.log('⚠️  Usuários serão PERMANENTEMENTE EXCLUÍDOS');
    console.log('⚠️  Aguardando 5 segundos para cancelar (Ctrl+C)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Inicializar Firebase Admin
    const admin = getAdmin();
    const auth = getAuth();
    const db = getFirestore();

    console.log('✅ Firebase Admin inicializado\n');

    // Listar todos os usuários do Auth (com paginação)
    let pageToken;
    let batchNumber = 1;

    do {
      console.log(`📦 Processando lote ${batchNumber}...`);

      const listUsersResult = await auth.listUsers(BATCH_SIZE, pageToken);
      const users = listUsersResult.users;

      if (users.length === 0) {
        console.log('ℹ️  Nenhum usuário encontrado neste lote\n');
        break;
      }

      console.log(`   ${users.length} usuários neste lote\n`);

      await processBatch(users, auth, db);

      pageToken = listUsersResult.pageToken;
      batchNumber++;

      console.log(''); // Linha em branco entre lotes
    } while (pageToken);

    // ========================================
    // 📊 RELATÓRIO FINAL
    // ========================================

    console.log('\n========================================');
    console.log('📊 RELATÓRIO FINAL');
    console.log('========================================');
    console.log(`Total de usuários: ${stats.total}`);
    console.log(`Mantidos (DJ): ${stats.kept.length}`);
    console.log(`Marcados para exclusão: ${stats.deleted.length}`);
    console.log(`Erros: ${stats.errors.length}`);
    console.log('========================================\n');

    // Detalhamento dos usuários mantidos
    if (stats.kept.length > 0) {
      console.log('✅ USUÁRIOS MANTIDOS (PLANO DJ):');
      stats.kept.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.uid})`);
        console.log(`   Motivo: ${user.reason}`);
        if (user.details) {
          console.log(`   Detalhes: ${user.details}`);
        }
      });
      console.log('');
    }

    // Detalhamento dos usuários excluídos
    if (stats.deleted.length > 0) {
      console.log(`${DRY_RUN ? '🔒' : '⚠️ '} USUÁRIOS ${DRY_RUN ? 'MARCADOS PARA EXCLUSÃO' : 'EXCLUÍDOS'}:`);
      stats.deleted.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.uid})`);
        console.log(`   Motivo: ${user.reason}`);
        if (!DRY_RUN) {
          console.log(`   Firestore: ${user.firestoreDeleted ? '✅' : '❌'}`);
          console.log(`   Auth: ${user.authDeleted ? '✅' : '❌'}`);
          if (user.error) {
            console.log(`   Erro: ${user.error}`);
          }
        }
      });
      console.log('');
    }

    // Detalhamento dos erros
    if (stats.errors.length > 0) {
      console.log('❌ ERROS ENCONTRADOS:');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.email} (${error.uid})`);
        console.log(`   Erro: ${error.error}`);
      });
      console.log('');
    }

    // Mensagem final
    console.log('========================================');
    if (DRY_RUN) {
      console.log('✅ DRY RUN CONCLUÍDO COM SUCESSO');
      console.log('ℹ️  Nenhum usuário foi excluído');
      console.log('ℹ️  Para executar a exclusão real:');
      console.log('   1. Revise o relatório acima');
      console.log('   2. Faça backup do Firestore');
      console.log('   3. Mude DRY_RUN = false no script');
      console.log('   4. Execute novamente: node scripts/cleanup-users.js');
    } else {
      console.log('✅ LIMPEZA CONCLUÍDA');
      console.log(`✅ ${stats.deleted.length} usuários excluídos`);
      console.log(`✅ ${stats.kept.length} usuários DJ mantidos`);
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ ERRO FATAL:');
    console.error(err);
    process.exit(1);
  }
}

// ========================================
// 🎬 EXECUTAR
// ========================================

main().catch(err => {
  console.error('❌ Erro não tratado:', err);
  process.exit(1);
});
