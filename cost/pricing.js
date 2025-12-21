/**
 * 📊 PRICING SOURCE OF TRUTH - SoundyAI
 * 
 * Preços oficiais da OpenAI e outros serviços (atualizado em 21/12/2025)
 * 
 * IMPORTANTE: Este é o único local onde preços devem ser definidos.
 * Qualquer dashboard, relatório ou cálculo DEVE importar deste arquivo.
 * 
 * Fontes oficiais:
 * - OpenAI Pricing: https://openai.com/api/pricing/
 * - Railway: https://railway.app/pricing
 * - Postgres: Managed by Railway
 * - Redis: Upstash/Railway pricing
 * 
 * @version 1.0.0
 * @date 2025-12-21
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 OPENAI API PRICING (USD por 1M tokens)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const OPENAI_PRICING = {
  // Chat Completions
  'gpt-4o': {
    input_per_1m: 2.50,    // $2.50 por 1M tokens de entrada
    output_per_1m: 10.00,  // $10.00 por 1M tokens de saída
    context_window: 128000,
    use_cases: ['imagens', 'análise complexa', 'código', 'raciocínio avançado']
  },
  
  'gpt-4o-mini': {
    input_per_1m: 0.150,   // $0.15 por 1M tokens de entrada
    output_per_1m: 0.600,  // $0.60 por 1M tokens de saída
    context_window: 128000,
    use_cases: ['sugestões enriquecidas', 'análise de áudio', 'tarefas padrão']
  },
  
  'gpt-3.5-turbo': {
    input_per_1m: 0.50,    // $0.50 por 1M tokens de entrada
    output_per_1m: 1.50,   // $1.50 por 1M tokens de saída
    context_window: 16385,
    use_cases: ['chat básico', 'respostas simples', 'fallback']
  },
  
  // Audio (Whisper)
  'whisper-1': {
    per_minute: 0.006,     // $0.006 por minuto de áudio
    use_cases: ['transcrição de áudio', 'voice messages']
  },
  
  // Imagens (se usado no futuro)
  'dall-e-3': {
    standard_1024: 0.040,  // $0.04 por imagem
    standard_1792: 0.080,  // $0.08 por imagem HD
    use_cases: ['geração de imagens (não implementado)']
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚂 RAILWAY PRICING (USD por mês)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const RAILWAY_PRICING = {
  // Plano Base (Hobby até Developer)
  base: {
    free_credits: 5.00,      // $5 grátis/mês
    vcpu_per_hour: 0.000231, // $0.000231 por vCPU-hora
    ram_gb_per_hour: 0.000231, // $0.000231 por GB-RAM-hora
    
    // Estimativa para 1 dyno web + 1 worker (512MB RAM, 0.5 vCPU cada)
    typical_web_monthly: 8.40,   // ~$8.40/mês (app web 24/7)
    typical_worker_monthly: 8.40, // ~$8.40/mês (worker 24/7)
    
    // Total típico: $16.80/mês para web + worker
  },
  
  // Add-ons
  postgres: {
    free_tier: 0,            // Postgres incluído no plano
    typical_monthly: 0,      // Sem custo adicional (pequeno volume)
    notes: 'Incluído no Railway - sem custo extra para DBs pequenos (<1GB)'
  },
  
  redis: {
    free_tier: 0,
    typical_monthly: 0,      // Redis também incluído (BullMQ usa pouco)
    notes: 'Incluído no Railway - Redis para filas consome pouco'
  },
  
  network: {
    egress_per_gb: 0.10,     // $0.10 por GB de saída
    typical_monthly: 2.00,   // ~$2/mês estimado (análise de áudio sobe pra bucket)
  },
  
  total_estimated_monthly: 20.00, // Total conservador: $20/mês
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🪣 STORAGE (Backblaze B2 / S3-compatible)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const STORAGE_PRICING = {
  b2: {
    storage_per_gb_month: 0.005, // $0.005 por GB/mês
    download_per_gb: 0.01,       // $0.01 por GB de download
    free_tier_gb: 10,            // 10GB grátis
    
    // Estimativa para 100 usuários (média 5 análises/mês, 10MB/análise)
    typical_100_users: 2.50,     // ~$2.50/mês (5GB armazenado + download)
    typical_1000_users: 25.00,   // ~$25/mês (50GB)
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💳 PAYMENT PROCESSING (Stripe)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PAYMENT_PROCESSING = {
  stripe: {
    percentage: 0.029,       // 2.9% do valor
    fixed_fee: 0.30,         // + $0.30 por transação
    // Exemplo: $25 → $25 * 0.029 + $0.30 = $1.03 de taxa
  },
  
  // Mercado Pago (se usado no Brasil)
  mercadopago: {
    percentage: 0.0499,      // ~4.99% (varia por país)
    fixed_fee: 0.00,         // Sem taxa fixa
    notes: 'Taxa mais alta que Stripe - considerar desabilitar'
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💱 CONVERSÃO BRL/USD (atualizar conforme necessário)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const FX_RATES = {
  brl_per_usd: 6.10,  // 1 USD = 6.10 BRL (estimativa conservadora - ajustar manualmente)
  updated_at: '2025-12-21'
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 HELPER FUNCTIONS - Cálculos de custo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calcular custo de uma requisição OpenAI
 * @param {string} model - Nome do modelo (ex: 'gpt-4o')
 * @param {number} prompt_tokens - Tokens de entrada
 * @param {number} completion_tokens - Tokens de saída
 * @returns {number} Custo em USD
 */
export function calculateOpenAICost(model, prompt_tokens, completion_tokens) {
  const pricing = OPENAI_PRICING[model];
  if (!pricing) {
    console.warn(`⚠️ Modelo desconhecido: ${model} - usando gpt-3.5-turbo como fallback`);
    return calculateOpenAICost('gpt-3.5-turbo', prompt_tokens, completion_tokens);
  }
  
  // Whisper usa preço por minuto, não por tokens
  if (model === 'whisper-1') {
    console.warn('⚠️ Whisper usa pricing por minuto, não tokens');
    return 0;
  }
  
  const input_cost = (prompt_tokens / 1_000_000) * pricing.input_per_1m;
  const output_cost = (completion_tokens / 1_000_000) * pricing.output_per_1m;
  
  return input_cost + output_cost;
}

/**
 * Calcular custo de transcrição Whisper
 * @param {number} duration_seconds - Duração do áudio em segundos
 * @returns {number} Custo em USD
 */
export function calculateWhisperCost(duration_seconds) {
  const minutes = duration_seconds / 60;
  return minutes * OPENAI_PRICING['whisper-1'].per_minute;
}

/**
 * Calcular taxa Stripe sobre um valor
 * @param {number} amount_usd - Valor da transação em USD
 * @returns {number} Taxa em USD
 */
export function calculateStripeFee(amount_usd) {
  return (amount_usd * PAYMENT_PROCESSING.stripe.percentage) + PAYMENT_PROCESSING.stripe.fixed_fee;
}

/**
 * Converter USD para BRL
 * @param {number} usd - Valor em USD
 * @returns {number} Valor em BRL
 */
export function usdToBrl(usd) {
  return usd * FX_RATES.brl_per_usd;
}

/**
 * Converter BRL para USD
 * @param {number} brl - Valor em BRL
 * @returns {number} Valor em USD
 */
export function brlToUsd(brl) {
  return brl / FX_RATES.brl_per_usd;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📝 EXPORT ALL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  OPENAI_PRICING,
  RAILWAY_PRICING,
  STORAGE_PRICING,
  PAYMENT_PROCESSING,
  FX_RATES,
  calculateOpenAICost,
  calculateWhisperCost,
  calculateStripeFee,
  usdToBrl,
  brlToUsd
};
