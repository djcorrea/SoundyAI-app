/**
 * 🕐 JOB DE EXPIRAÇÃO DE PLANOS - SoundyAI
 * 
 * ✅ Verifica e expira planos PRO/Plus que passaram da data
 * ✅ Pode ser executado via cron/scheduler externo
 * ✅ Complementa a verificação lazy de normalizeUserDoc()
 * 
 * COMO USAR:
 * 1. Localmente: node lib/jobs/expire-plans.js
 * 2. Via cron (Railway, Render, etc): Agendar para rodar 1x/dia
 * 3. Via endpoint protegido: POST /api/admin/expire-plans
 * 
 * @version 1.0.0
 * @created 2026-01-04
 */

import { getFirestore } from '../../firebase/admin.js';

const USERS_COLLECTION = 'usuarios';

/**
 * Executa a verificação de expiração em lote
 * @returns {Promise<Object>} Resumo da execução
 */
export async function runExpirePlansJob() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🕐 [EXPIRE-JOB] Iniciando verificação de expiração de planos');
  console.log('📅 [EXPIRE-JOB] Data atual:', new Date().toISOString());

  const db = getFirestore();
  const now = new Date();
  const stats = {
    total: 0,
    expired: 0,
    proExpired: 0,
    plusExpired: 0,
    subscriptionExpired: 0,
    errors: []
  };

  try {
    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Buscar usuários PRO com proExpiresAt expirado
    // ═══════════════════════════════════════════════════════════════
    console.log('🔍 [EXPIRE-JOB] Buscando planos PRO expirados...');
    
    const proExpiredQuery = db.collection(USERS_COLLECTION)
      .where('plan', '==', 'pro')
      .where('proExpiresAt', '<=', now.toISOString());
    
    const proSnapshot = await proExpiredQuery.get();
    
    for (const doc of proSnapshot.docs) {
      try {
        const userData = doc.data();
        const uid = doc.id;
        
        // Verificar se não é assinatura ativa (Stripe)
        if (userData.subscription?.status === 'active') {
          console.log(`⏭️ [EXPIRE-JOB] ${uid} tem assinatura ativa - ignorando`);
          continue;
        }

        console.log(`🔻 [EXPIRE-JOB] Expirando PRO: ${uid} (expirou em ${userData.proExpiresAt})`);
        
        await doc.ref.update({
          plan: 'free',
          proExpiresAt: null,
          expiredAt: now.toISOString(),
          expiredPlan: 'pro',
          updatedAt: now.toISOString()
        });

        stats.proExpired++;
        stats.expired++;
      } catch (err) {
        console.error(`❌ [EXPIRE-JOB] Erro ao expirar ${doc.id}:`, err.message);
        stats.errors.push({ uid: doc.id, error: err.message });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Buscar usuários PLUS com plusExpiresAt expirado
    // ═══════════════════════════════════════════════════════════════
    console.log('🔍 [EXPIRE-JOB] Buscando planos PLUS expirados...');
    
    const plusExpiredQuery = db.collection(USERS_COLLECTION)
      .where('plan', '==', 'plus')
      .where('plusExpiresAt', '<=', now.toISOString());
    
    const plusSnapshot = await plusExpiredQuery.get();
    
    for (const doc of plusSnapshot.docs) {
      try {
        const userData = doc.data();
        const uid = doc.id;

        // Verificar se não é assinatura ativa (Stripe)
        if (userData.subscription?.status === 'active') {
          console.log(`⏭️ [EXPIRE-JOB] ${uid} tem assinatura ativa - ignorando`);
          continue;
        }

        console.log(`🔻 [EXPIRE-JOB] Expirando PLUS: ${uid} (expirou em ${userData.plusExpiresAt})`);
        
        await doc.ref.update({
          plan: 'free',
          plusExpiresAt: null,
          expiredAt: now.toISOString(),
          expiredPlan: 'plus',
          updatedAt: now.toISOString()
        });

        stats.plusExpired++;
        stats.expired++;
      } catch (err) {
        console.error(`❌ [EXPIRE-JOB] Erro ao expirar ${doc.id}:`, err.message);
        stats.errors.push({ uid: doc.id, error: err.message });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Verificar assinaturas Stripe canceladas que passaram do período
    // ═══════════════════════════════════════════════════════════════
    console.log('🔍 [EXPIRE-JOB] Verificando assinaturas Stripe canceladas...');
    
    const canceledQuery = db.collection(USERS_COLLECTION)
      .where('subscription.status', '==', 'canceled');
    
    const canceledSnapshot = await canceledQuery.get();
    
    for (const doc of canceledSnapshot.docs) {
      try {
        const userData = doc.data();
        const uid = doc.id;
        const periodEnd = new Date(userData.subscription?.currentPeriodEnd);

        if (now > periodEnd) {
          console.log(`🔻 [EXPIRE-JOB] Assinatura Stripe expirada: ${uid}`);
          
          await doc.ref.update({
            plan: 'free',
            subscription: {
              ...userData.subscription,
              status: 'expired',
              expiredAt: now.toISOString()
            },
            proExpiresAt: null,
            plusExpiresAt: null,
            expiredAt: now.toISOString(),
            expiredPlan: userData.plan,
            updatedAt: now.toISOString()
          });

          stats.subscriptionExpired++;
          stats.expired++;
        }
      } catch (err) {
        console.error(`❌ [EXPIRE-JOB] Erro ao processar assinatura ${doc.id}:`, err.message);
        stats.errors.push({ uid: doc.id, error: err.message });
      }
    }

    stats.total = proSnapshot.size + plusSnapshot.size + canceledSnapshot.size;

    // ═══════════════════════════════════════════════════════════════
    // RESULTADO FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ [EXPIRE-JOB] Verificação concluída!');
    console.log(`📊 [EXPIRE-JOB] Resumo:`);
    console.log(`   - Total verificados: ${stats.total}`);
    console.log(`   - Total expirados: ${stats.expired}`);
    console.log(`   - PRO expirados: ${stats.proExpired}`);
    console.log(`   - PLUS expirados: ${stats.plusExpired}`);
    console.log(`   - Assinaturas expiradas: ${stats.subscriptionExpired}`);
    console.log(`   - Erros: ${stats.errors.length}`);
    console.log('═══════════════════════════════════════════════════════════');

    return stats;

  } catch (error) {
    console.error('💥 [EXPIRE-JOB] Erro crítico:', error);
    stats.errors.push({ uid: 'global', error: error.message });
    return stats;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUÇÃO DIRETA (node lib/jobs/expire-plans.js)
// ═══════════════════════════════════════════════════════════════════
const isDirectRun = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isDirectRun) {
  console.log('🚀 [EXPIRE-JOB] Executando diretamente...');
  runExpirePlansJob()
    .then(stats => {
      console.log('\n📋 Resultado:', JSON.stringify(stats, null, 2));
      process.exit(stats.errors.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('💥 Erro fatal:', err);
      process.exit(1);
    });
}

export default { runExpirePlansJob };
