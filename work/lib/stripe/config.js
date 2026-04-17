// work/lib/stripe/config.js
// Configuração centralizada do Stripe

import Stripe from 'stripe';

// ✅ Inicializar SDK do Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Versão estável
});

// ✅ PRICE IDs OFICIAIS DO STRIPE (PRODUÇÃO)
// IMPORTANTE: Estes são os Price IDs REAIS do Stripe Dashboard
// Se existirem env vars, usar; caso contrário, usar hardcoded como fallback
const PRICE_ID_PLUS = process.env.STRIPE_PRICE_ID_PLUS || 'price_1SlHm6COXidjqeFinckOK8J9';
const PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO || 'price_1SlIKMCOXidjqeFiTiPExXEb';
// ✅ ATUALIZADO 2026-01-06: Price ID REAL do plano STUDIO (R$99,90/mês)
const PRICE_ID_STUDIO = process.env.STRIPE_PRICE_ID_STUDIO || 'price_1SmjUuCOXidjqeFiNZNuXFHB';

// ✅ PAYMENT LINKS DIRETOS DO STRIPE (PLANO PRO - R$69,99)
// CENTRALIZADO: Alterar apenas aqui ou via env var STRIPE_PAYMENT_LINK_PRO
export const STRIPE_PAYMENT_LINKS = {
  pro: process.env.STRIPE_PAYMENT_LINK_PRO || 'https://buy.stripe.com/7sY00i9wF7j25pqaEZgw000',
};

console.log('✅ [STRIPE CONFIG] SDK inicializado');
console.log(`💳 [STRIPE CONFIG] Price ID Plus: ${PRICE_ID_PLUS.substring(0, 20)}...`);
console.log(`💳 [STRIPE CONFIG] Price ID Pro: ${PRICE_ID_PRO.substring(0, 20)}...`);
console.log(`💳 [STRIPE CONFIG] Price ID Studio: ${PRICE_ID_STUDIO.substring(0, 20)}...`);

// ✅ Mapeamento de planos → Price IDs
export const STRIPE_PLANS = {
  plus: {
    priceId: PRICE_ID_PLUS,
    durationDays: 30,
    displayName: 'SoundyAI Plus',
    features: [
      '80 mensagens mensais',
      '20 análises completas',      // ✅ ATUALIZADO 2026-01-06: 25 → 20
      'Modo reduced ilimitado',
    ],
  },
  pro: {
    priceId: PRICE_ID_PRO,
    durationDays: 30,
    displayName: 'SoundyAI Pro',
    features: [
      'Chat ilimitado',
      '60 análises completas',      // ✅ ATUALIZADO 2026-01-06: ilimitado → 60
      '70 mensagens com imagens',
      'Suporte prioritário',
    ],
  },
  // ✅ NOVO 2026-01-06: Plano STUDIO
  studio: {
    priceId: PRICE_ID_STUDIO,
    durationDays: 30,
    displayName: 'SoundyAI Studio',
    features: [
      'Análises ilimitadas (uso justo)',   // Hard cap: 400/mês
      'Chat ilimitado (uso justo)',         // Hard cap: 400/mês
      'Prioridade de processamento',
      'Badge STUDIO exclusivo',
      'Tudo do PRO incluso',
    ],
  },
};

// ✅ Exportar Price IDs para validação em outros módulos
export const STRIPE_PRICE_IDS = {
  plus: PRICE_ID_PLUS,
  pro: PRICE_ID_PRO,
  studio: PRICE_ID_STUDIO,          // ✅ NOVO
};

/**
 * Obter plano a partir do Price ID
 * @param {string} priceId - Price ID do Stripe
 * @returns {string|null} Nome do plano (plus/pro/studio) ou null
 */
export function getPlanFromPriceId(priceId) {
  if (priceId === PRICE_ID_PLUS) return 'plus';
  if (priceId === PRICE_ID_PRO) return 'pro';
  if (priceId === PRICE_ID_STUDIO) return 'studio';   // ✅ NOVO
  return null;
}

/**
 * Obter configuração de um plano
 * @param {string} plan - "plus", "pro" ou "studio"
 * @returns {Object} Configuração do plano
 * @throws {Error} Se plano inválido ou Price ID não configurado
 */
export function getPlanConfig(plan) {
  const config = STRIPE_PLANS[plan];
  
  if (!config) {
    throw new Error(`Plano inválido: ${plan}`);
  }
  
  // ⚠️ Validação especial para STUDIO: alertar se priceId não foi configurado
  if (plan === 'studio' && config.priceId === 'INSERIR_PRICE_ID_STUDIO_AQUI') {
    console.warn('⚠️ [STRIPE CONFIG] Price ID do STUDIO ainda não configurado!');
    console.warn('   Configure a env var STRIPE_PRICE_ID_STUDIO ou atualize o valor hardcoded.');
  }
  
  if (!config.priceId) {
    throw new Error(`Price ID não configurado para plano: ${plan}`);
  }
  
  return config;
}

/**
 * Validar se plano é válido
 * @param {string} plan - Plano a validar
 * @returns {boolean}
 */
export function isValidPlan(plan) {
  return plan === 'plus' || plan === 'pro' || plan === 'studio';   // ✅ ATUALIZADO
}

export default stripe;
