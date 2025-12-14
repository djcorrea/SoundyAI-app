/**
 * 🛡️ RATE LIMITERS - PROTEÇÃO CONTRA ABUSO E BOTS
 * 
 * Implementação MANUAL de rate limiting em memória usando Map nativo.
 * SEM dependências externas, SEM bibliotecas, apenas JavaScript puro.
 * 
 * OBJETIVO:
 * - Proteger contra bots, loops maliciosos e abuso
 * - Não impactar usuários legítimos
 * - Não alterar regras de planos (FREE, PLUS, PRO)
 * - Zero dependências externas
 * 
 * LIMITES DEFINIDOS:
 * - Chat (texto + imagens): 30 req/min por IP
 * - Análise de áudio: 10 req/min por IP
 * - Webhook de pagamento: 10 req/min por IP (estrutural)
 * 
 * IMPLEMENTAÇÃO:
 * - Map em memória para armazenar IPs e timestamps
 * - Janela deslizante (remove timestamps antigos)
 * - Cleanup periódico automático para prevenir memory leak
 * 
 * @version 2.0.0 (Manual - sem dependências)
 * @date 2025-12-14
 */

// ✅ Store de rate limiting em memória (Map nativo)
const rateStore = new Map();

// ✅ Métricas globais
let totalRequests = 0;
let blockedRequests = 0;
let lastCleanup = Date.now();

/**
 * Função de cleanup periódico para prevenir memory leak
 * Remove entradas antigas do Map automaticamente
 */
function cleanupRateStore() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutos (maior que qualquer janela)
  
  let removed = 0;
  for (const [ip, timestamps] of rateStore.entries()) {
    // Filtrar timestamps válidos (não expirados)
    const valid = timestamps.filter(ts => now - ts < maxAge);
    
    if (valid.length === 0) {
      // Remover entrada se não houver timestamps válidos
      rateStore.delete(ip);
      removed++;
    } else if (valid.length !== timestamps.length) {
      // Atualizar entrada com timestamps válidos
      rateStore.set(ip, valid);
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 [RATE_LIMIT] Cleanup: ${removed} IPs inativos removidos`);
  }
  
  lastCleanup = now;
}

/**
 * Factory para criar rate limiters manuais
 * 
 * @param {Object} config - Configuração do rate limiter
 * @param {number} config.windowMs - Janela de tempo em milissegundos
 * @param {number} config.max - Máximo de requisições na janela
 * @param {string} config.type - Tipo do limiter (para logs)
 * @returns {Function} Middleware express
 */
function createRateLimiter({ windowMs, max, type }) {
  return function rateLimiterMiddleware(req, res, next) {
    // ✅ Extrair IP da requisição
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               'unknown';
    
    const now = Date.now();
    totalRequests++;
    
    // ✅ Cleanup periódico (a cada 1000 requisições)
    if (totalRequests % 1000 === 0) {
      cleanupRateStore();
    }
    
    // ✅ Obter histórico de requisições do IP
    const timestamps = rateStore.get(ip) || [];
    
    // ✅ Filtrar apenas requisições dentro da janela de tempo (janela deslizante)
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    // ✅ Verificar se excedeu o limite
    if (recentTimestamps.length >= max) {
      blockedRequests++;
      
      // ✅ Log de bloqueio
      console.warn(`⚠️ [RATE_LIMIT] ${type} bloqueado por IP: ${ip} (${recentTimestamps.length}/${max} requisições em ${windowMs}ms)`);
      
      // ✅ Retornar HTTP 429 com mensagem neutra
      return res.status(429).json({
        error: 'RATE_LIMIT',
        message: 'Muitas requisições em um curto período. Aguarde alguns instantes e tente novamente.'
      });
    }
    
    // ✅ Adicionar timestamp atual e atualizar store
    recentTimestamps.push(now);
    rateStore.set(ip, recentTimestamps);
    
    // ✅ Continuar para próximo middleware
    next();
  };
}

/**
 * Rate limiter para endpoints de chat (texto + imagens)
 * 
 * Limite: 30 requisições por minuto por IP
 * Janela: 60 segundos deslizante
 */
export const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  type: 'Chat'
});

/**
 * Rate limiter para análise de áudio
 * 
 * Limite: 10 requisições por minuto por IP
 * Janela: 60 segundos deslizante
 * Proteção contra flood de uploads
 */
export const analysisLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  type: 'Análise'
});

/**
 * Rate limiter para webhook de pagamento (preparação futura)
 * 
 * Limite: 10 requisições por minuto por IP
 * Janela: 60 segundos deslizante
 * NOTA: Estrutural apenas - gateway não integrado ainda
 */
export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  type: 'Webhook'
});

/**
 * Obter estatísticas de rate limiting (útil para monitoramento)
 * 
 * @returns {Object} Estatísticas
 */
export function getRateLimitStats() {
  return {
    totalRequests,
    blockedRequests,
    activeIPs: rateStore.size,
    blockRate: totalRequests > 0 ? (blockedRequests / totalRequests * 100).toFixed(2) + '%' : '0%',
    lastCleanup: new Date(lastCleanup).toISOString()
  };
}

/**
 * NOTAS TÉCNICAS:
 * 
 * 1. ✅ Implementação manual usando Map nativo (zero dependências)
 * 2. ✅ Janela deslizante (sliding window) - mais preciso que fixed window
 * 3. ✅ Cleanup automático para prevenir memory leak
 * 4. ✅ Rate limiting é por IP, NÃO por plano ou UID
 * 5. ✅ Não substitui verificações de plano (canUseChat, canUseAnalysis)
 * 6. ✅ Limites implícitos por UID já existem → NÃO MEXER
 * 7. ✅ Hard caps (PRO: 500 análises, 300 mensagens, 70 imagens) mantidos
 * 8. ✅ Sistema de contadores mensais (analysesMonth, messagesMonth, imagesMonth) intacto
 * 
 * REGRAS:
 * - ✅ Protege contra bots e loops maliciosos
 * - ✅ Não impacta usuários legítimos
 * - ✅ Mensagens neutras (HTTP 429)
 * - ✅ Logs claros para monitoramento
 * - ✅ Zero dependências externas
 * - ❌ NÃO altera lógica de planos
 * - ❌ NÃO altera hard caps
 * - ❌ NÃO altera contadores
 * 
 * MEMORY MANAGEMENT:
 * - Cleanup automático a cada 1000 requisições
 * - Remove timestamps antigos (>5 minutos)
 * - Remove IPs inativos automaticamente
 * - Previne memory leak em produção
 */
