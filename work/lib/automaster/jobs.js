// work/lib/automaster/jobs.js
// Gerenciamento de jobs AutoMaster no Firestore.
//
// Responsabilidades:
//  • User lock: impede execuções paralelas por usuário
//  • Credit eligibility: verifica disponibilidade SEM consumir
//  • Credit consumption: consome APÓS sucesso do DSP (idempotente por jobId)
//  • Lock release: libera lock em caso de falha sem consumir crédito
//
// Coleção Firestore: automasterJobs/{jobId}
// Campos relevantes em usuarios/{uid}: automasterActiveJobId, automasterActiveJobStartedAt

import { getFirestore } from '../../../firebase/admin.js';

const USERS       = 'usuarios';
const JOBS        = 'automasterJobs';
const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutos — lock considerado stale após este tempo

// ──────────────────────────────────────────────────────────────────────────────
// createJobWithTransaction
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Cria um job AutoMaster de forma atômica via Firestore transaction.
 *
 * Verifica simultaneamente em uma única transaction:
 *  1. User lock — bloqueia se já existe job ativo para este usuário
 *  2. Credit eligibility — verifica plano / trial / saldo (NÃO consome ainda)
 *
 * Em caso de sucesso:
 *  • Cria documento em automasterJobs/{jobId} com status 'pending'
 *  • Seta automasterActiveJobId no documento do usuário
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

  return await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists) {
      throw Object.assign(
        new Error('Usuário não encontrado no banco de dados.'),
        { code: 'USER_NOT_FOUND' },
      );
    }

    const user = userSnap.data();
    const plan = user.plan || 'free';

    // ── 1. User lock ─────────────────────────────────────────────────────────
    const activeJobId = user.automasterActiveJobId         || null;
    const activeJobAt = user.automasterActiveJobStartedAt  || 0;

    if (activeJobId && (now - activeJobAt) < LOCK_TTL_MS) {
      throw Object.assign(
        new Error('Já existe uma masterização em andamento. Aguarde a conclusão antes de iniciar outra.'),
        { code: 'PROCESS_ALREADY_RUNNING', activeJobId },
      );
    }

    // ── 2. Credit eligibility ─────────────────────────────────────────────────
    const freeUsed = user.automasterFreeUsed ?? false;
    const credits  = typeof user.automasterCredits === 'number' ? user.automasterCredits : 0;

    let eligibilityType;
    if (plan === 'studio') {
      eligibilityType = 'plan_unlimited';
    } else if (!freeUsed) {
      eligibilityType = 'free_trial';
    } else if (credits > 0) {
      eligibilityType = 'credit';
    } else {
      throw Object.assign(
        new Error('Você não possui créditos AutoMaster disponíveis. Adquira um pacote para continuar.'),
        { code: 'NO_CREDITS' },
      );
    }

    // ── 3. Criar job doc ──────────────────────────────────────────────────────
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

    // ── 4. Setar user lock ────────────────────────────────────────────────────
    tx.update(userRef, {
      automasterActiveJobId:        jobId,
      automasterActiveJobStartedAt: now,
    });

    console.log(`✅ [AUTOMASTER-JOBS] Job criado: uid=${uid} jobId=${jobId} eligibility=${eligibilityType}`);
    return { eligibilityType };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// consumeJobCredit
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Consome 1 crédito AutoMaster após o DSP ter concluído com sucesso.
 * Idempotente: se creditConsumed===true no job, nenhuma ação é executada.
 * Chamado pelo endpoint de status quando detecta status 'completed'.
 *
 * @param {string} uid    - UID autenticado (req.user.uid)
 * @param {string} jobId
 * @returns {Promise<{ consumed: boolean, reason?: string }>}
 */
export async function consumeJobCredit(uid, jobId) {
  const db      = getFirestore();
  const userRef = db.collection(USERS).doc(uid);
  const jobRef  = db.collection(JOBS).doc(jobId);

  return await db.runTransaction(async (tx) => {
    const [jobSnap, userSnap] = await Promise.all([tx.get(jobRef), tx.get(userRef)]);

    // Job não existe no Firestore → criado antes deste sistema. Noop.
    if (!jobSnap.exists) {
      console.log(`ℹ️ [AUTOMASTER-JOBS] consumeJobCredit: job ${jobId} não existe no Firestore (job legado — crédito já pago na criação)`);
      return { consumed: false, reason: 'legacy_job' };
    }

    const job = jobSnap.data();

    // Segurança: garantir que o uid bate
    if (job.uid !== uid) {
      console.warn(`⚠️ [AUTOMASTER-JOBS] consumeJobCredit: uid mismatch para job ${jobId} (esperado ${job.uid}, recebido ${uid})`);
      return { consumed: false, reason: 'uid_mismatch' };
    }

    // Idempotência: already consumed?
    if (job.creditConsumed) {
      console.log(`ℹ️ [AUTOMASTER-JOBS] consumeJobCredit: já consumido para job ${jobId}`);
      return { consumed: false, reason: 'already_consumed' };
    }

    const now  = Date.now();
    const user = userSnap.exists ? userSnap.data() : null;

    // Marcar job como done + creditConsumed
    tx.update(jobRef, { creditConsumed: true, status: 'done', updatedAt: now });

    if (!user) return { consumed: true };

    const userUpdates = { updatedAt: now };

    // Limpar user lock apenas se ainda aponta para este job
    if (user.automasterActiveJobId === jobId) {
      userUpdates.automasterActiveJobId        = null;
      userUpdates.automasterActiveJobStartedAt = null;
    }

    // Aplicar dedução conforme o tipo reservado na criação do job
    const eligibilityType = job.eligibilityType;
    if (eligibilityType === 'free_trial') {
      userUpdates.automasterFreeUsed = true;
    } else if (eligibilityType === 'credit') {
      const currentCredits = typeof user.automasterCredits === 'number' ? user.automasterCredits : 0;
      userUpdates.automasterCredits = Math.max(0, currentCredits - 1);
    }
    // 'plan_unlimited' (studio) → apenas limpar lock, sem dedução

    tx.update(userRef, userUpdates);

    console.log(`✅ [AUTOMASTER-JOBS] Crédito consumido: uid=${uid} jobId=${jobId} type=${eligibilityType}`);
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
    console.error(`⚠️ [AUTOMASTER-JOBS] releaseUserLock error (não fatal): ${err.message}`);
  }
}
