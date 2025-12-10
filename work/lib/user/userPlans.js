// work/lib/user/userPlans.js
// 🔧 Sistema de planos, limites, upgrades e reset diário

import admin from "firebase-admin";
const db = admin.firestore();
const USERS = "users";

// Limites de cada plano
const PLAN_LIMITS = {
  free: { maxMessagesPerDay: 20, maxAnalysesPerDay: 3 },
  plus: { maxMessagesPerDay: 80, maxAnalysesPerDay: 30 },
  pro: { maxMessagesPerDay: Infinity, maxAnalysesPerDay: Infinity },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// 1️⃣ Busca ou cria perfil do usuário
export async function getOrCreateUser(uid, extra = {}) {
  const ref = db.collection(USERS).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = new Date().toISOString();
    const profile = {
      uid,
      plan: "free",
      plusExpiresAt: null,
      proExpiresAt: null,
      messagesToday: 0,
      analysesToday: 0,
      lastResetAt: todayISO(),
      createdAt: now,
      updatedAt: now,
      ...extra,
    };

    await ref.set(profile);
    return profile;
  }

  return normalizeUser(ref, snap.data());
}

// 2️⃣ Normaliza expiração + reset diário
async function normalizeUser(ref, data) {
  let changed = false;
  const today = todayISO();
  const now = new Date().toISOString();

  // Expiração PLUS
  if (data.plusExpiresAt && Date.now() > new Date(data.plusExpiresAt).getTime() && data.plan === "plus") {
    data.plan = "free";
    changed = true;
  }

  // Expiração PRO
  if (data.proExpiresAt && Date.now() > new Date(data.proExpiresAt).getTime() && data.plan === "pro") {
    data.plan = "free";
    changed = true;
  }

  // Reset diário
  if (data.lastResetAt !== today) {
    data.messagesToday = 0;
    data.analysesToday = 0;
    data.lastResetAt = today;
    changed = true;
  }

  if (changed) {
    data.updatedAt = now;
    await ref.update({
      plan: data.plan,
      plusExpiresAt: data.plusExpiresAt || null,
      proExpiresAt: data.proExpiresAt || null,
      messagesToday: data.messagesToday,
      analysesToday: data.analysesToday,
      lastResetAt: data.lastResetAt,
      updatedAt: now,
    });
  }

  return data;
}

// 3️⃣ Upgrade via pagamento Mercado Pago
export async function applyPlan(uid, { plan, durationDays }) {
  const ref = db.collection(USERS).doc(uid);
  await getOrCreateUser(uid);

  const now = Date.now();
  const expires = new Date(now + durationDays * 86400000).toISOString();

  const update = {
    plan,
    updatedAt: new Date().toISOString(),
  };

  if (plan === "plus") update.plusExpiresAt = expires;
  if (plan === "pro") update.proExpiresAt = expires;

  await ref.update(update);
  return (await ref.get()).data();
}

// 4️⃣ Limites de chat
export async function canUseChat(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];

  if (limits.maxMessagesPerDay === Infinity) {
    return { allowed: true, user, remaining: Infinity };
  }

  const remaining = limits.maxMessagesPerDay - user.messagesToday;
  return { allowed: remaining > 0, user, remaining };
}

export async function registerChat(uid) {
  const ref = db.collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);

  await ref.update({
    messagesToday: (user.messagesToday || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
}

// 5️⃣ Limites de análise
export async function canUseAnalysis(uid) {
  const user = await getOrCreateUser(uid);
  const limits = PLAN_LIMITS[user.plan];

  if (limits.maxAnalysesPerDay === Infinity) {
    return { allowed: true, user, remaining: Infinity };
  }

  const remaining = limits.maxAnalysesPerDay - user.analysesToday;
  return { allowed: remaining > 0, user, remaining };
}

export async function registerAnalysis(uid) {
  const ref = db.collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);

  await ref.update({
    analysesToday: (user.analysesToday || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
}
