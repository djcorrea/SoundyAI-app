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
 * Verifica se o fingerprintId pode gerar uma free master (1 por 24h).
 * Consulta Firestore: usage_control/{fingerprintId}.
 * @param {string} fingerprintId
 * @returns {Promise<boolean>} true = permitido
 */
export async function isFingerprintAllowed(fingerprintId) {
  if (!fingerprintId || fingerprintId.length < 8) {
    console.warn('[USAGE-CONTROL] fingerprintId inválido:', fingerprintId);
    return false; // inválido → bloquear por segurança
  }
  try {
    const db   = getFirestore();
    const snap = await db.collection(USAGE_COLL).doc(fingerprintId).get();
    if (!snap.exists) return true; // nunca usou → permitido
    const data = snap.data();
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
 *  2. Fingerprint: máximo 1 free master por 24h por device (Firestore)
 *
 * @param {{ userId: string, fingerprintId: string, ip: string }} params
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function checkFreeUsage({ userId, fingerprintId, ip }) {
  // 1. IP check (rápido, sem I/O)
  if (!isIPAllowed(ip)) {
    console.log('[USAGE-CONTROL] IP bloqueado:', ip, 'uid:', userId);
    return { allowed: false, reason: 'IP_LIMIT_REACHED' };
  }

  // 2. Fingerprint check (Firestore)
  const fpAllowed = await isFingerprintAllowed(fingerprintId);
  if (!fpAllowed) {
    console.log('[USAGE-CONTROL] Fingerprint bloqueado:', fingerprintId?.substring(0, 8), 'uid:', userId);
    return { allowed: false, reason: 'FINGERPRINT_LIMIT_REACHED' };
  }

  return { allowed: true };
}

// ───────────────────────────────────────────────────────────────────────────
// registerFreeUsage
// ───────────────────────────────────────────────────────────────────────────
/**
 * Registra o uso do free trial para userId + fingerprintId + IP.
 * Deve ser chamado APÓS o job ser enfileirado com sucesso.
 * Operação fire-and-forget — não lança exceções para o caller.
 *
 * @param {{ userId: string, fingerprintId: string, ip: string }} params
 */
export async function registerFreeUsage({ userId, fingerprintId, ip }) {
  const now = Date.now();

  // 1. Atualizar in-memory IP map
  if (ip && ip !== '0.0.0.0' && ip !== '::1') {
    _ipUsageMap.set(ip, now);
  }

  // 2. Salvar no Firestore: usage_control/{fingerprintId}
  if (fingerprintId && fingerprintId.length >= 8) {
    try {
      const db = getFirestore();
      await db.collection(USAGE_COLL).doc(fingerprintId).set({
        userId,
        fingerprintId,
        ip,
        freeUsedToday: true,
        lastUsedAt:    now,
      }, { merge: true });
      console.log('[USAGE-CONTROL] Uso registrado — fp:', fingerprintId?.substring(0, 8), '| uid:', userId, '| ip:', ip);
    } catch (err) {
      // Non-fatal: registro é melhor esforço
      console.warn('[USAGE-CONTROL] registerFreeUsage Firestore error (non-fatal):', err.message);
    }
  }
}
