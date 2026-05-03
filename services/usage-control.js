// services/usage-control.js
// Anti-abuse: fingerprint + IP rate limiting para free AutoMaster.
//
// Responsabilidades:
//  • Verificar se um IP pode gerar uma free master (1 por 24h, in-memory)
//  • Verificar se um fingerprintId pode gerar uma free master (1 por 24h, Firestore)
//  • Verificar se o usuário tem plano pago (libera download)
//  • Registrar uso quando um free trial for consumido
//
// Coleção Firestore: usage_control/{fingerprintId}
// Estrutura: { userId, fingerprintId, ip, freeUsedToday, lastUsedAt }

import { getFirestore } from '../firebase/admin.js';

// ─── Constantes ────────────────────────────────────────────────────────────
const USERS_COLL    = 'usuarios';
const USAGE_COLL    = 'usage_control';
const TTL_24H       = 24 * 60 * 60 * 1000; // 24 horas em ms
const PAID_PLANS    = new Set(['plus', 'pro', 'dj', 'studio']);

// ─── Rate limit por IP (in-memory, reinicia nos deploys — intencional) ──────
// key: string (IP), value: number (timestamp do último uso free)
const _ipUsageMap = new Map();

// ─── Rate limit por uid (in-memory, reinicia nos deploys — intencional) ─────
// key: string (uid), value: number[] (timestamps de jobs submetidos na janela)
const _uidRateLimitMap  = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // janela de 1 hora
const RATE_LIMIT_MAX_JOBS  = 10;              // máximo de jobs por janela

// ───────────────────────────────────────────────────────────────────────────
// checkRateLimit
// ───────────────────────────────────────────────────────────────────────────
/**
 * Verifica se o uid pode submeter um novo job (máx. RATE_LIMIT_MAX_JOBS/hora).
 * Não realiza I/O — apenas consulta a Map in-memory.
 * Reinicia nos deploys — comportamento intencional (sem persistência).
 * @param {string} uid
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
export function checkRateLimit(uid) {
  if (!uid) return { allowed: true };
  const now     = Date.now();
  const cutoff  = now - RATE_LIMIT_WINDOW_MS;
  const history = (_uidRateLimitMap.get(uid) || []).filter(ts => ts > cutoff);
  if (history.length >= RATE_LIMIT_MAX_JOBS) {
    const oldest      = history[0];
    const retryAfterMs = (RATE_LIMIT_WINDOW_MS - (now - oldest)) + 1000;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
  return { allowed: true };
}

// ───────────────────────────────────────────────────────────────────────────
// registerJobForRateLimit
// ───────────────────────────────────────────────────────────────────────────
/**
 * Registra um job submetido com sucesso no rate limiter do uid.
 * Deve ser chamado APÓS o job ser enfileirado com sucesso.
 * @param {string} uid
 */
export function registerJobForRateLimit(uid) {
  if (!uid) return;
  const now     = Date.now();
  const cutoff  = now - RATE_LIMIT_WINDOW_MS;
  const history = (_uidRateLimitMap.get(uid) || []).filter(ts => ts > cutoff);
  history.push(now);
  _uidRateLimitMap.set(uid, history);
}

// ───────────────────────────────────────────────────────────────────────────
// getUserPlan
// ───────────────────────────────────────────────────────────────────────────
/**
 * Obtém o plano atual do usuário a partir do Firestore.
 * @param {string} uid
 * @returns {Promise<string>} 'free' | 'plus' | 'pro' | 'dj' | 'studio'
 */
export async function getUserPlan(uid) {
  try {
    const db   = getFirestore();
    const snap = await db.collection(USERS_COLL).doc(uid).get();
    if (!snap.exists) return 'free';
    return snap.data()?.plan || 'free';
  } catch (err) {
    console.warn('[USAGE-CONTROL] getUserPlan error (retornando free):', err.message);
    return 'free';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// hasPaidPlan
// ───────────────────────────────────────────────────────────────────────────
/**
 * Retorna true se o usuário tem um plano pago (não requer paywall de download).
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function hasPaidPlan(uid) {
  const plan = await getUserPlan(uid);
  return PAID_PLANS.has(plan);
}

// ───────────────────────────────────────────────────────────────────────────
// isIPAllowed
// ───────────────────────────────────────────────────────────────────────────
/**
 * Verifica se o IP está dentro do limite (1 free master por 24h).
 * Usa memória — reinicia no deploy (comportamento aceitável para rate limiting).
 * @param {string} ip
 * @returns {boolean} true = permitido
 */
export function isIPAllowed(ip) {
  if (!ip || ip === '0.0.0.0' || ip === '::1') return true; // localhost sempre permitido
  const lastUsed = _ipUsageMap.get(ip) || 0;
  return (Date.now() - lastUsed) >= TTL_24H;
}

// ───────────────────────────────────────────────────────────────────────────
// isFingerprintAllowed
// ───────────────────────────────────────────────────────────────────────────
/**
 * Verifica se o par userId+fingerprintId pode gerar uma free master (1 por 24h).
 *
 * IMPORTANTE: a chave é `{userId}_{fingerprintId}` — cada conta tem seu próprio
 * contador independente de dispositivo. Isso garante que um novo usuário no mesmo
 * dispositivo não herde o bloqueio de outra conta.
 *
 * Consulta Firestore: usage_control/{userId}_{fingerprintId}
 *
 * @param {string} userId
 * @param {string} fingerprintId
 * @returns {Promise<boolean>} true = permitido
 */
export async function isFingerprintAllowed(userId, fingerprintId) {
  // Fingerprint inválido (curto ou ausente): permitir — não bloquear usuário legítimo
  // por falha no carregamento do script de fingerprint no cliente.
  if (!fingerprintId || fingerprintId.length < 8) {
    console.warn('[USAGE-CONTROL] fingerprintId inválido ou ausente — permitindo (sem bloqueio por fp):', fingerprintId);
    return true;
  }
  try {
    const db    = getFirestore();
    const docId = `${userId}_${fingerprintId}`;
    const snap  = await db.collection(USAGE_COLL).doc(docId).get();

    console.log('[USAGE-CONTROL] isFingerprintAllowed — docId:', docId, '| exists:', snap.exists);

    if (!snap.exists) return true; // nunca usou → permitido
    const data = snap.data();

    console.log('[USAGE-CONTROL] freeUsedToday:', data.freeUsedToday, '| lastUsedAt:', data.lastUsedAt);

    if (!data.freeUsedToday) return true;
    const lastUsed = typeof data.lastUsedAt === 'number' ? data.lastUsedAt : 0;
    return (Date.now() - lastUsed) >= TTL_24H;
  } catch (err) {
    console.warn('[USAGE-CONTROL] isFingerprintAllowed error (permitindo por cautela):', err.message);
    return true; // erro de leitura → não bloquear usuário legítimo
  }
}

// ───────────────────────────────────────────────────────────────────────────
// checkFreeUsage
// ───────────────────────────────────────────────────────────────────────────
/**
 * Verifica todas as regras de anti-abuso antes de iniciar um free master.
 * Retorna { allowed: boolean, reason?: string }
 *
 * Regras (em ordem de verificação):
 *  1. IP: máximo 1 free master por 24h por IP (in-memory)
 *  2. Fingerprint+userId: máximo 1 free master por 24h por conta+device (Firestore)
 *
 * @param {{ userId: string, fingerprintId: string, ip: string }} params
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function checkFreeUsage({ userId, fingerprintId, ip }) {
  console.log('[USAGE-CONTROL] checkFreeUsage — uid:', userId, '| fp:', fingerprintId?.substring(0, 8), '| ip:', ip);

  // 1. IP check (rápido, sem I/O)
  if (!isIPAllowed(ip)) {
    console.log('[USAGE-CONTROL] IP bloqueado:', ip, 'uid:', userId);
    return { allowed: false, reason: 'IP_LIMIT_REACHED' };
  }

  // 2. Fingerprint+userId check (Firestore — escopado por conta)
  const fpAllowed = await isFingerprintAllowed(userId, fingerprintId);
  if (!fpAllowed) {
    console.log('[USAGE-CONTROL] Fingerprint bloqueado — uid:', userId, 'fp:', fingerprintId?.substring(0, 8));
    return { allowed: false, reason: 'FINGERPRINT_LIMIT_REACHED' };
  }

  console.log('[USAGE-CONTROL] Acesso permitido — uid:', userId);
  return { allowed: true };
}

// ───────────────────────────────────────────────────────────────────────────
// registerFreeUsage
// ───────────────────────────────────────────────────────────────────────────
/**
 * Registra o uso do free trial para userId + fingerprintId + IP.
 * Deve ser chamado APÓS o job ser concluído com sucesso.
 * Operação fire-and-forget — não lança exceções para o caller.
 *
 * Chave Firestore: usage_control/{userId}_{fingerprintId}
 *
 * @param {{ userId: string, fingerprintId: string, ip: string }} params
 */
export async function registerFreeUsage({ userId, fingerprintId, ip }) {
  const now = Date.now();

  // 1. Atualizar in-memory IP map
  if (ip && ip !== '0.0.0.0' && ip !== '::1') {
    _ipUsageMap.set(ip, now);
  }

  // 2. Salvar no Firestore: usage_control/{userId}_{fingerprintId}
  if (userId && fingerprintId && fingerprintId.length >= 8) {
    try {
      const db    = getFirestore();
      const docId = `${userId}_${fingerprintId}`;
      await db.collection(USAGE_COLL).doc(docId).set({
        userId,
        fingerprintId,
        ip,
        freeUsedToday: true,
        lastUsedAt:    now,
      }, { merge: true });
      console.log('[USAGE-CONTROL] Uso registrado — docId:', docId, '| uid:', userId, '| ip:', ip);
    } catch (err) {
      // Non-fatal: registro é melhor esforço
      console.warn('[USAGE-CONTROL] registerFreeUsage Firestore error (non-fatal):', err.message);
    }
  } else if (userId && (!fingerprintId || fingerprintId.length < 8)) {
    // Sem fingerprint válido: registrar apenas por userId para rastrear uso
    try {
      const db = getFirestore();
      await db.collection(USAGE_COLL).doc(`${userId}_nofp`).set({
        userId,
        fingerprintId: '',
        ip,
        freeUsedToday: true,
        lastUsedAt:    now,
      }, { merge: true });
      console.log('[USAGE-CONTROL] Uso registrado (sem fp) — uid:', userId, '| ip:', ip);
    } catch (err) {
      console.warn('[USAGE-CONTROL] registerFreeUsage (nofp) Firestore error (non-fatal):', err.message);
    }
  }
}
