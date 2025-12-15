// work/lib/stripe/config.js
// Configuração centralizada do Stripe

import Stripe from 'stripe';

// ✅ Inicializar SDK do Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Versão estável
});

console.log('✅ [STRIPE CONFIG] SDK inicializado');

// ✅ Mapeamento de planos → Price IDs
export const STRIPE_PLANS = {
  plus: {
    priceId: process.env.STRIPE_PRICE_ID_PLUS,
    durationDays: 30,
    displayName: 'SoundyAI Plus',
    features: [
      '80 mensagens mensais',
      '25 análises completas',
      'Modo reduced ilimitado',
    ],
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_ID_PRO,
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
