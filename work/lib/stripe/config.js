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

console.log('✅ [STRIPE CONFIG] SDK inicializado');
console.log(`💳 [STRIPE CONFIG] Price ID Plus: ${PRICE_ID_PLUS.substring(0, 20)}...`);
console.log(`💳 [STRIPE CONFIG] Price ID Pro: ${PRICE_ID_PRO.substring(0, 20)}...`);

// ✅ Mapeamento de planos → Price IDs
export const STRIPE_PLANS = {
  plus: {
    priceId: PRICE_ID_PLUS,
    durationDays: 30,
    displayName: 'SoundyAI Plus',
    features: [
      '80 mensagens mensais',
      '25 análises completas',
      'Modo reduced ilimitado',
    ],
  },
  pro: {
    priceId: PRICE_ID_PRO,
    durationDays: 30,
    displayName: 'SoundyAI Pro',
    features: [
      '300 mensagens mensais',
      '500 análises completas',
      '70 mensagens com imagens',
      'Suporte prioritário',
    ],
  },
};

// ✅ Exportar Price IDs para validação em outros módulos
export const STRIPE_PRICE_IDS = {
  plus: PRICE_ID_PLUS,
  pro: PRICE_ID_PRO,
};

/**
 * Obter plano a partir do Price ID
 * @param {string} priceId - Price ID do Stripe
 * @returns {string|null} Nome do plano (plus/pro) ou null
 */
export function getPlanFromPriceId(priceId) {
  if (priceId === PRICE_ID_PLUS) return 'plus';
  if (priceId === PRICE_ID_PRO) return 'pro';
  return null;
}

/**
 * Obter configuração de um plano
 * @param {string} plan - "plus" ou "pro"
 * @returns {Object} Configuração do plano
 * @throws {Error} Se plano inválido ou Price ID não configurado
 */
export function getPlanConfig(plan) {
  const config = STRIPE_PLANS[plan];
  
  if (!config) {
    throw new Error(`Plano inválido: ${plan}`);
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
  return plan === 'plus' || plan === 'pro';
}

export default stripe;
