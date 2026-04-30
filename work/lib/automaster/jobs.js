// work/lib/automaster/jobs.js
// Gerenciamento de jobs AutoMaster no Firestore.
//
// Responsabilidades:
//  • User lock: impede execuções paralelas por usuário
//  • Credit eligibility: verifica disponibilidade com limite MENSAL por plano
//  • Credit consumption: consome APÓS sucesso do DSP (idempotente por jobId)
//  • Lock release: libera lock em caso de falha sem consumir crédito
//
// Planos:
//   free  → 1 master/mês
//   plus  → 20 masters/mês
//   pro   → 200/mês (tratado como "ilimitado" no frontend)
//   dj    → 200/mês (beta, mesmo que pro)
//
// Coleção Firestore: automasterJobs/{jobId}
// Coleção de logs: automaster_logs/{jobId}
// Campos em usuarios/{uid}: creditsUsed, creditsLimit, resetDate, lifetimeUsage

import { getFirestore } from '../../../firebase/admin.js';
import { FieldValue } from 'firebase-admin/firestore';

const USERS       = 'usuarios';
const JOBS        = 'automasterJobs';
const LOGS        = 'automaster_logs';
const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutos — lock considerado stale após este tempo

// ─── Configuração de limites por plano ───────────────────────────────────────
const PLAN_MONTHLY_LIMITS = {
  free:  1,
  plus:  20,
  pro:   200,  // hardcap interno — tratado como ilimitado para o usuário
  dj:    200,  // DJ Beta: mesmo limite que pro
};

// Planos com hardcap (tratados como "ilimitados" na mensagem ao usuário)
const HARDCAP_PLANS = new Set(['pro', 'dj']);

/**
 * Remove campos legados do documento do usuário que não são mais lidos
 * pelo sistema. Executado fire-and-forget ao criar job — sem impacto
 * no fluxo principal.
 *
 * Campos removidos:
 *  • automasterCredits  — substituído por creditsUsed/creditsLimit (new system)
 *  • automasterFreeUsed — substituído por creditsUsed >= creditsLimit (new system)
 *  • analysesToday      — contador diário; nunca lido pelo backend
 *  • messagesToday      — contador diário; nunca lido pelo backend
 *
 * Campos MANTIDOS (ativos em outros sistemas):
 *  • studioExpiresAt     — sistema de expiração de planos (hotmart.js, expire-plans.js)
 *  • analysesMonth       — rate limiting de análises (userPlans.js, analyze.js)
 *  • messagesMonth       — rate limiting de chat (chat.js, userPlans.js)
 *  • imagesMonth         — rate limiting de imagens (userPlans.js)
 *  • freeAnalysesRemaining — trial de análise gratuita (userPlans.js)
 *
 * @param {FirebaseFirestore.DocumentReference} userRef
 */
async function cleanupUserLegacyFields(userRef) {
  try {
    await userRef.update({
      automasterCredits:  FieldValue.delete(),
      automasterFreeUsed: FieldValue.delete(),
      analysesToday:      FieldValue.delete(),
      messagesToday:      FieldValue.delete(),
    });
    console.log(`✅ [AUTOMASTER-JOBS] Campos legados removidos para: ${userRef.id}`);
  } catch (err) {
    // Não bloqueia o fluxo principal — limpeza é melhor esforço
    console.warn('[AUTOMASTER-JOBS] cleanupUserLegacyFields falhou (ignorado):', err.message);
  }
}

/**
 * Retorna o timestamp do primeiro dia do próximo mês (midnight UTC).
 */
function getNextMonthTimestamp() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// ──────────────────────────────────────────────────────────────────────────────
// createJobWithTransaction
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Cria um job AutoMaster de forma atômica via Firestore transaction.
 *
 * Verifica simultaneamente em uma única transaction:
 *  1. User lock — bloqueia se já existe job ativo para este usuário
 *  2. Monthly reset — zera creditsUsed se resetDate foi ultrapassada
 *  3. Eligibility por plano — free=1/mês, plus=20/mês, pro=200/mês
 *
 * Em caso de sucesso:
 *  • Cria documento em automasterJobs/{jobId} com status 'pending'
 *  • Seta automasterActiveJobId no documento do usuário
 *  • Aplica reset mensal se necessário (creditsUsed=0, resetDate=próximo mês)
 *
 * @param {string} uid
 * @param {string} jobId
 * @param {{ fileKey?: string, mode: string }} opts
 * @returns {Promise<{ eligibilityType: string }>}
 * @throws {{ code: 'NO_CREDITS' | 'PROCESS_ALREADY_RUNNING' | 'USER_NOT_FOUND' }}
 */
export async function createJobWithTransaction(uid, jobId, { fileKey, mode }) {
  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);
  const jobRef  = db.collection(JOBS).doc(jobId);
  const now     = Date.now();

  const result = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists) {
      throw Object.assign(
        new Error('Usuário não encontrado no banco de dados.'),
        { code: 'USER_NOT_FOUND' },
      );
    }

    const user         = userSnap.data();
    const plan         = user.plan || 'free';
    const monthlyLimit = PLAN_MONTHLY_LIMITS[plan] ?? PLAN_MONTHLY_LIMITS.free;
    const isHardcap    = HARDCAP_PLANS.has(plan);

    // ── 1. User lock ─────────────────────────────────────────────────────────
    const activeJobId = user.automasterActiveJobId         || null;
    const activeJobAt = user.automasterActiveJobStartedAt  || 0;

    if (activeJobId && (now - activeJobAt) < LOCK_TTL_MS) {
      throw Object.assign(
        new Error('Já existe uma masterização em andamento. Aguarde a conclusão antes de iniciar outra.'),
        { code: 'PROCESS_ALREADY_RUNNING', activeJobId },
      );
    }

    // ── 2. Monthly reset ──────────────────────────────────────────────────────
    const resetDate   = typeof user.resetDate   === 'number' ? user.resetDate   : 0;
    let   creditsUsed = typeof user.creditsUsed === 'number' ? user.creditsUsed : 0;

    // Acumular todas as atualizações do usuário em um único objeto
    const userUpdates = {
      automasterActiveJobId:        jobId,
      automasterActiveJobStartedAt: now,
    };

    if (now > resetDate) {
      creditsUsed              = 0;
      userUpdates.creditsUsed  = 0;
      userUpdates.creditsLimit = monthlyLimit;
      userUpdates.resetDate    = getNextMonthTimestamp();
      console.log(`🔄 [AUTOMASTER-JOBS] Reset mensal aplicado: uid=${uid} plan=${plan}`);
    }

    // ── 3. Eligibility check ──────────────────────────────────────────────────
    // Usa creditsLimit do Firestore (não monthlyLimit do config) para considerar
    // créditos avulsos comprados via Mercado Pago.
    // Fallback para monthlyLimit caso creditsLimit não exista no documento.
    const creditsLimit = typeof user.creditsLimit === 'number' ? user.creditsLimit : monthlyLimit;
    // Após reset, creditsLimit foi sobrescrito para monthlyLimit — usar o valor atualizado
    const effectiveLimit = userUpdates.creditsLimit ?? creditsLimit;

    if (creditsUsed >= effectiveLimit) {
      let message;
      if (plan === 'free') {
        message = 'Você já utilizou sua masterização gratuita deste mês. Faça upgrade para continuar masterizando.';
      } else if (isHardcap) {
        message = 'Limite mensal interno atingido. O limite será renovado no início do próximo mês.';
      } else {
        message = `Você atingiu o limite de ${monthlyLimit} masterizações do seu plano este mês.`;
      }
      throw Object.assign(new Error(message), { code: 'NO_CREDITS' });
    }

    const eligibilityType = isHardcap ? 'plan_unlimited' : 'plan_monthly';

    // ── 4. Criar job doc ──────────────────────────────────────────────────────
    tx.set(jobRef, {
      uid,
      fileKey:         fileKey || null,
      mode,
      status:          'pending',
      creditConsumed:  false,
      eligibilityType,
      createdAt:       now,
      updatedAt:       now,
    });

    // ── 5. Atualizar usuário (lock + reset em uma única escrita) ──────────────
    tx.update(userRef, userUpdates);

    console.log(`✅ [AUTOMASTER-JOBS] Job criado: uid=${uid} jobId=${jobId} plan=${plan} used=${creditsUsed}/${effectiveLimit} eligibility=${eligibilityType}`);
    return { eligibilityType };
  });

  // Limpeza de campos legados — fire-and-forget, não bloqueia o fluxo
  cleanupUserLegacyFields(userRef);

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// consumeJobCredit
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Consome 1 crédito AutoMaster após o DSP ter concluído com sucesso.
 * Idempotente: se creditConsumed===true no job, nenhuma ação é executada.
 * Chamado pelo endpoint de status quando detecta status 'completed'.
 *
 * Atualiza no usuário:
 *  • creditsUsed +1 (novo sistema mensal)
 *  • lifetimeUsage +1
 *  • usage.mastersMonth, usage.mastersToday, usage.lastMasterAt

 *
 * Cria documento em automaster_logs/{jobId}.
 *
 * @param {string} uid    - UID autenticado (req.user.uid)
 * @param {string} jobId
 * @returns {Promise<{ consumed: boolean, reason?: string }>}
 */
export async function consumeJobCredit(uid, jobId) {
  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);
  const jobRef  = db.collection(JOBS).doc(jobId);
  const logRef  = db.collection(LOGS).doc(jobId);

  return await db.runTransaction(async (tx) => {
    const [jobSnap, userSnap] = await Promise.all([tx.get(jobRef), tx.get(userRef)]);

    // Job não existe no Firestore → criado antes deste sistema. Noop.
    if (!jobSnap.exists) {
      console.log(`ℹ️ [AUTOMASTER-JOBS] consumeJobCredit: job ${jobId} não existe (legado)`);
      return { consumed: false, reason: 'legacy_job' };
    }

    const job = jobSnap.data();

    // Segurança: garantir que o uid bate
    if (job.uid !== uid) {
      console.warn(`⚠️ [AUTOMASTER-JOBS] consumeJobCredit: uid mismatch para job ${jobId}`);
      return { consumed: false, reason: 'uid_mismatch' };
    }

    // Idempotência: já consumido?
    if (job.creditConsumed) {
      console.log(`ℹ️ [AUTOMASTER-JOBS] consumeJobCredit: já consumido para job ${jobId}`);
      return { consumed: false, reason: 'already_consumed' };
    }

    const now  = Date.now();
    const user = userSnap.exists ? userSnap.data() : null;

    // Marcar job como done + creditConsumed
    tx.update(jobRef, { creditConsumed: true, status: 'done', updatedAt: now });

    // Salvar log do master
    tx.set(logRef, {
      userId:    uid,
      jobId,
      duration:  now - (job.createdAt || now),
      success:   true,
      plan:      user?.plan || 'free',
      mode:      job.mode   || null,
      createdAt: now,
    });

    if (!user) return { consumed: true };

    const plan         = user.plan || 'free';
    const monthlyLimit = PLAN_MONTHLY_LIMITS[plan] ?? PLAN_MONTHLY_LIMITS.free;
    const currentUsed  = typeof user.creditsUsed === 'number' ? user.creditsUsed : 0;
    const newUsed      = currentUsed + 1;

    const userUpdates = { updatedAt: now };

    // Limpar user lock apenas se ainda aponta para este job
    if (user.automasterActiveJobId === jobId) {
      userUpdates.automasterActiveJobId        = null;
      userUpdates.automasterActiveJobStartedAt = null;
    }

    // ── Contadores mensais (novo sistema) ─────────────────────────────────────
    // ⚠️ CRÍTICO: NÃO escrever creditsLimit aqui.
    // creditsLimit é gerenciado por: (1) reset mensal em createJobWithTransaction
    //   e (2) webhook Stripe (plano pago ou crédito avulso).
    // Sobrescrever aqui destruiria créditos avulsos comprados pelo usuário.
    userUpdates.creditsUsed   = newUsed;
    userUpdates.lifetimeUsage = (typeof user.lifetimeUsage === 'number' ? user.lifetimeUsage : 0) + 1;

    // ── Uso granular ──────────────────────────────────────────────────────────
    const todayStr    = new Date(now).toISOString().slice(0, 10);
    const lastAt      = user.usage?.lastMasterAt ?? null;
    const lastDateStr = lastAt ? new Date(lastAt).toISOString().slice(0, 10) : null;
    const sameDay     = todayStr === lastDateStr;

    userUpdates['usage.mastersMonth'] = (user.usage?.mastersMonth ?? 0) + 1;
    userUpdates['usage.mastersToday'] = sameDay ? (user.usage?.mastersToday ?? 0) + 1 : 1;
    userUpdates['usage.lastMasterAt'] = now;

    tx.update(userRef, userUpdates);

    console.log(`✅ [AUTOMASTER-JOBS] Crédito consumido: uid=${uid} jobId=${jobId} plan=${plan} used=${newUsed}/${monthlyLimit}`);
    return { consumed: true };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// releaseUserLock
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Libera o user lock e marca o job como 'failed' no Firestore.
 * Chamado pelo endpoint de status quando o DSP falha.
 * Operação best-effort: erros são logados mas não relançados.
 * NÃO consome crédito — o usuário não é cobrado por falhas do DSP.
 *
 * @param {string} uid
 * @param {string} jobId
 */
export async function releaseUserLock(uid, jobId) {
  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);
  const jobRef  = db.collection(JOBS).doc(jobId);

  try {
    await db.runTransaction(async (tx) => {
      const [jobSnap, userSnap] = await Promise.all([tx.get(jobRef), tx.get(userRef)]);
      const now = Date.now();

      // Marcar job como failed (idempotente: só se ainda pending/processing)
      if (jobSnap.exists && ['pending', 'processing'].includes(jobSnap.data().status)) {
        tx.update(jobRef, { status: 'failed', updatedAt: now });
      }

      // Limpar lock do usuário se ainda aponta para este job
      if (userSnap.exists && userSnap.data().automasterActiveJobId === jobId) {
        tx.update(userRef, {
          automasterActiveJobId:        null,
          automasterActiveJobStartedAt: null,
        });
      }
    });
    console.log(`✅ [AUTOMASTER-JOBS] Lock liberado (sem cobrança): uid=${uid} jobId=${jobId}`);
  } catch (err) {
    // Não bloquear o fluxo principal — cleanup best-effort
    console.error(`⚠️ [AUTOMASTER-JOBS] releaseUserLock error (não fatal):`, err);
  }
}
