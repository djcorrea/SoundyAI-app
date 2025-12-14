/**
 * 🛡️ RATE LIMITERS - PROTEÇÃO CONTRA ABUSO E BOTS
 * 
 * Implementação de rate limiting server-side para endpoints críticos do SoundyAI.
 * 
 * OBJETIVO:
 * - Proteger contra bots, loops maliciosos e abuso
 * - Não impactar usuários legítimos
 * - Não alterar regras de planos (FREE, PLUS, PRO)
 * 
 * LIMITES DEFINIDOS:
 * - Chat (texto + imagens): 30 req/min por IP
 * - Análise de áudio: 10 req/min por IP
 * - Webhook de pagamento: 10 req/min por IP (estrutural)
 * 
 * MENSAGEM DE ERRO:
 * - HTTP 429 com mensagem neutra (sem mencionar plano, limite, etc)
 * 
 * @version 1.0.0
 * @date 2025-12-14
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para endpoints de chat (texto + imagens)
 * 
 * Limite: 30 requisições por minuto por IP
 * Mensagem: Neutra, sem mencionar detalhes técnicos
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requisições por janela
  standardHeaders: true, // Retorna info no header `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*` (legacy)
  message: {
    error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
  },
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.warn(`⚠️ [RATE_LIMIT] Chat bloqueado por IP: ${ip}`);
    res.status(429).json({
      error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
    });
  },
  // Identificar requisição por IP
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Não contar requisições que falharam antes do rate limit (ex: 401, 400)
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter para análise de áudio
 * 
 * Limite: 10 requisições por minuto por IP
 * Proteção contra flood de uploads
 */
export const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
  },
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.warn(`⚠️ [RATE_LIMIT] Análise bloqueada por excesso de requisições: ${ip}`);
    res.status(429).json({
      error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter para webhook de pagamento (preparação futura)
 * 
 * Limite: 10 requisições por minuto por IP
 * NOTA: Estrutural apenas - gateway não integrado ainda
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
  },
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.warn(`⚠️ [RATE_LIMIT] Webhook bloqueado por excesso de requisições: ${ip}`);
    res.status(429).json({
      error: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

/**
 * NOTAS TÉCNICAS:
 * 
 * 1. Rate limiting é por IP, NÃO por plano ou UID
 * 2. Não substitui verificações de plano (canUseChat, canUseAnalysis)
 * 3. Limites implícitos por UID já existem → NÃO MEXER
 * 4. Hard caps (PRO: 500 análises, 300 mensagens, 70 imagens) mantidos
 * 5. Sistema de contadores mensais (analysesMonth, messagesMonth, imagesMonth) intacto
 * 
 * REGRAS:
 * - ✅ Protege contra bots e loops maliciosos
 * - ✅ Não impacta usuários legítimos
 * - ✅ Mensagens neutras (HTTP 429)
 * - ✅ Logs claros para monitoramento
 * - ❌ NÃO altera lógica de planos
 * - ❌ NÃO altera hard caps
 * - ❌ NÃO altera contadores
 */
