/**
 * 🛡️ ANONYMOUS LIMITER - Sistema de Bloqueio PERMANENTE para Usuários Anônimos
 * 
 * ⚠️ REGRA DE NEGÓCIO CRÍTICA:
 * - Usuário anônimo = 1 análise NA VIDA
 * - Após 1 análise, bloqueio PERMANENTE
 * - Sem reset, sem TTL, sem expiração
 * - Backend é a ÚNICA autoridade
 * 
 * IDENTIFICAÇÃO:
 * - visitorId (FingerprintJS) como identificador principal
 * - IP como identificador secundário/combinado
 * 
 * PERSISTÊNCIA:
 * - PostgreSQL (tabela anonymous_usage) - PERMANENTE
 * - NÃO usa Redis para limites (Redis causava reset diário via TTL)
 * 
 * @version 2.0.0 - BLOQUEIO PERMANENTE
 * @date 2025-01-03
 */

import pool from '../../db.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE LIMITES PERMANENTES
// ═══════════════════════════════════════════════════════════════════

const PERMANENT_LIMITS = {
  anonymous: {
    maxAnalyses: 1,    // 1 análise NA VIDA para anônimos
    maxMessages: 5,    // 5 mensagens (pode manter com TTL se quiser)
  },
  demo: {
    maxAnalyses: 1,    // 1 análise NA VIDA para demo
    maxMessages: 1,    // 1 mensagem
  }
};

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DA TABELA (AUTO-CREATE)
// ═══════════════════════════════════════════════════════════════════

let tableInitialized = false;

/**
 * Criar tabela anonymous_usage se não existir
 * 🛡️ PROTEÇÃO: Só executa em ambiente DEV
 * Esta tabela NUNCA tem TTL - dados são PERMANENTES
 */
async function ensureTable() {
  if (tableInitialized) return;
  
  // 🛡️ PROTEÇÃO: Não criar tabelas em produção/teste
  const env = process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT;
  if (env === 'production' || env === 'test') {
    console.log('⏭️ [ANON_LIMITER] Pulando criação de tabela (ambiente:', env + ')');
    tableInitialized = true; // Marcar como inicializado para não tentar novamente
    return;
  }
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS anonymous_usage (
        id SERIAL PRIMARY KEY,
        visitor_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        usage_type VARCHAR(50) NOT NULL DEFAULT 'analysis',
        analysis_count INTEGER NOT NULL DEFAULT 0,
        message_count INTEGER NOT NULL DEFAULT 0,
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        block_reason VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_analysis_at TIMESTAMP WITH TIME ZONE,
        
        -- Índice único por visitor_id + tipo (permite separar anonymous de demo)
        CONSTRAINT unique_visitor_type UNIQUE (visitor_id, usage_type)
      );
      
      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_anonymous_usage_visitor ON anonymous_usage(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_anonymous_usage_blocked ON anonymous_usage(blocked);
      CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip ON anonymous_usage(ip_address);
    `);
    
    tableInitialized = true;
    console.log('✅ [ANON_LIMITER] Tabela anonymous_usage verificada/criada');
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao criar tabela:', err.message);
    // 🛡️ PROTEÇÃO: Não crashar se falhar (pode ser permissão)
    tableInitialized = true; // Marcar para não tentar novamente
    console.warn('⚠️ [ANON_LIMITER] Continuando sem criação de tabela (pode já existir)');
  }
}

// 🛡️ PROTEÇÃO: NÃO executar automaticamente - tabelas devem existir previamente
// Em DEV, chamar manualmente ensureTable() se necessário

// ═══════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrair IP do request (considera proxies)
 */
function getClientIP(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers?.['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
}

/**
 * Criar resposta padronizada de bloqueio
 */
function createBlockedResponse(maxAllowed, analysisCount, isDemo, reason) {
  return {
    allowed: false,
    remaining: 0,
    limit: maxAllowed,
    used: analysisCount,
    blocked: true,
    message: isDemo 
      ? 'Você já usou sua análise gratuita. Libere o acesso completo!'
      : 'Você já usou sua análise gratuita. Crie uma conta para continuar!',
    errorCode: isDemo ? 'DEMO_PERMANENTLY_BLOCKED' : 'ANON_PERMANENTLY_BLOCKED',
    blockReason: reason
  };
}

// ═══════════════════════════════════════════════════════════════════
// 🔒 GUARD PRINCIPAL - BLOQUEIO PERMANENTE
// ═══════════════════════════════════════════════════════════════════

/**
 * 🚨 GUARD PRINCIPAL: Verifica se usuário anônimo pode analisar
 * 
 * REGRA ABSOLUTA:
 * - analysis_count >= 1 → BLOQUEADO PARA SEMPRE
 * - blocked = true → BLOQUEADO PARA SEMPRE
 * 
 * IDENTIFICAÇÃO MÚLTIPLA (anti-burla):
 * 1. Por visitor_id (fingerprint)
 * 2. Por IP address (fallback)
 * 
 * @param {string} visitorId - Fingerprint do usuário
 * @param {Object} req - Request Express (para IP)
 * @param {Object} options - { isDemo: boolean }
 * @returns {Promise<Object>} { allowed, reason, analysisCount, blocked }
 */
export async function canAnonymousAnalyze(visitorId, req, options = {}) {
  const ip = getClientIP(req);
  const isDemo = options.isDemo === true;
  const usageType = isDemo ? 'demo' : 'anonymous';
  const maxAllowed = isDemo ? PERMANENT_LIMITS.demo.maxAnalyses : PERMANENT_LIMITS.anonymous.maxAnalyses;
  
  console.log(`\n🔒 [ANON_LIMITER] ════════════════════════════════════════`);
  console.log(`🔒 [ANON_LIMITER] Verificando bloqueio PERMANENTE`);
  console.log(`🔒 [ANON_LIMITER] visitorId: ${visitorId?.substring(0, 16)}...`);
  console.log(`🔒 [ANON_LIMITER] IP: ${ip}`);
  console.log(`🔒 [ANON_LIMITER] Tipo: ${usageType}`);
  console.log(`🔒 [ANON_LIMITER] Limite máximo: ${maxAllowed}`);
  console.log(`🔒 [ANON_LIMITER] ════════════════════════════════════════\n`);
  
  // Garantir tabela existe
  await ensureTable();
  
  // Validar visitorId
  if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
    console.error('❌ [ANON_LIMITER] visitorId inválido - BLOQUEANDO');
    return {
      allowed: false,
      remaining: 0,
      limit: maxAllowed,
      used: 0,
      blocked: true,
      message: 'Identificação de visitante inválida. Faça login para continuar.',
      errorCode: 'INVALID_VISITOR_ID'
    };
  }
  
  try {
    // 🔴 VERIFICAÇÃO 1: Por visitor_id (fingerprint)
    const resultByVisitor = await pool.query(`
      SELECT analysis_count, blocked, block_reason, created_at, ip_address
      FROM anonymous_usage 
      WHERE visitor_id = $1 AND usage_type = $2
    `, [visitorId, usageType]);
    
    if (resultByVisitor.rows.length > 0) {
      const record = resultByVisitor.rows[0];
      const analysisCount = record.analysis_count || 0;
      const isBlocked = record.blocked === true;
      
      console.log(`📊 [ANON_LIMITER] Registro por visitorId encontrado:`);
      console.log(`   - Análises feitas: ${analysisCount}`);
      console.log(`   - Bloqueado: ${isBlocked}`);
      
      if (isBlocked || analysisCount >= maxAllowed) {
        console.log(`🚫 [ANON_LIMITER] BLOQUEADO por visitorId`);
        return createBlockedResponse(maxAllowed, analysisCount, isDemo, 'visitor_blocked');
      }
    }
    
    // 🔴 VERIFICAÇÃO 2: Por IP (anti-burla - pega quem limpa cache)
    if (ip && ip !== 'unknown') {
      const resultByIP = await pool.query(`
        SELECT analysis_count, blocked, block_reason, visitor_id
        FROM anonymous_usage 
        WHERE ip_address = $1 AND usage_type = $2 AND blocked = true
      `, [ip, usageType]);
      
      if (resultByIP.rows.length > 0) {
        const ipRecord = resultByIP.rows[0];
        console.log(`🚫 [ANON_LIMITER] IP ${ip} já foi bloqueado anteriormente`);
        console.log(`   - Visitor original: ${ipRecord.visitor_id?.substring(0, 16)}...`);
        console.log(`   - Análises: ${ipRecord.analysis_count}`);
        return createBlockedResponse(maxAllowed, ipRecord.analysis_count, isDemo, 'ip_blocked');
      }
      
      // Verificar total de análises por IP (mesmo com visitor diferente)
      const ipAnalysisCount = await pool.query(`
        SELECT SUM(analysis_count) as total
        FROM anonymous_usage 
        WHERE ip_address = $1 AND usage_type = $2
      `, [ip, usageType]);
      
      const totalByIP = parseInt(ipAnalysisCount.rows[0]?.total || '0', 10);
      if (totalByIP >= maxAllowed) {
        console.log(`🚫 [ANON_LIMITER] IP ${ip} já atingiu limite (${totalByIP} análises)`);
        return createBlockedResponse(maxAllowed, totalByIP, isDemo, 'ip_limit_reached');
      }
    }
    
    // Se não existe registro por visitorId, permitir primeira análise
    if (resultByVisitor.rows.length === 0) {
      console.log(`✅ [ANON_LIMITER] Novo visitante - permitindo primeira análise`);
      return {
        allowed: true,
        remaining: maxAllowed,
        limit: maxAllowed,
        used: 0,
        blocked: false,
        message: null,
        errorCode: null
      };
    }
    
    const record = resultByVisitor.rows[0];
    const analysisCount = record.analysis_count || 0;
    const isBlocked = record.blocked === true;
    
    console.log(`📊 [ANON_LIMITER] Registro encontrado:`);
    console.log(`   - Análises feitas: ${analysisCount}`);
    console.log(`   - Bloqueado: ${isBlocked}`);
    console.log(`   - Criado em: ${record.created_at}`);
    
    // 🚨 VERIFICAÇÃO 1: Já está marcado como bloqueado
    if (isBlocked) {
      console.log(`🚫 [ANON_LIMITER] BLOQUEADO PERMANENTEMENTE (flag blocked=true)`);
      return {
        allowed: false,
        remaining: 0,
        limit: maxAllowed,
        used: analysisCount,
        blocked: true,
        message: isDemo 
          ? 'Você já usou sua análise gratuita. Libere o acesso completo!'
          : 'Você já usou sua análise gratuita. Crie uma conta para continuar!',
        errorCode: isDemo ? 'DEMO_PERMANENTLY_BLOCKED' : 'ANON_PERMANENTLY_BLOCKED'
      };
    }
    
    // 🚨 VERIFICAÇÃO 2: Já atingiu o limite (mesmo sem flag blocked)
    if (analysisCount >= maxAllowed) {
      console.log(`🚫 [ANON_LIMITER] BLOQUEADO PERMANENTEMENTE (análises: ${analysisCount} >= ${maxAllowed})`);
      
      // Atualizar flag blocked para otimizar futuras consultas
      await pool.query(`
        UPDATE anonymous_usage 
        SET blocked = TRUE, 
            block_reason = 'LIMIT_REACHED_PERMANENTLY',
            updated_at = NOW()
        WHERE visitor_id = $1 AND usage_type = $2
      `, [visitorId, usageType]);
      
      return {
        allowed: false,
        remaining: 0,
        limit: maxAllowed,
        used: analysisCount,
        blocked: true,
        message: isDemo 
          ? 'Você já usou sua análise gratuita. Libere o acesso completo!'
          : 'Você já usou sua análise gratuita. Crie uma conta para continuar!',
        errorCode: isDemo ? 'DEMO_PERMANENTLY_BLOCKED' : 'ANON_PERMANENTLY_BLOCKED'
      };
    }
    
    // ✅ Ainda tem análises disponíveis
    const remaining = maxAllowed - analysisCount;
    console.log(`✅ [ANON_LIMITER] Permitido - ${remaining} análise(s) restante(s)`);
    
    return {
      allowed: true,
      remaining: remaining,
      limit: maxAllowed,
      used: analysisCount,
      blocked: false,
      message: null,
      errorCode: null
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao verificar limite:', err.message);
    // Em caso de erro de DB, BLOQUEAR por segurança
    return {
      allowed: false,
      remaining: 0,
      limit: maxAllowed,
      used: 0,
      blocked: true,
      message: 'Erro ao verificar limites. Faça login para continuar.',
      errorCode: 'DB_ERROR'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 📝 REGISTRO DE USO (APÓS ANÁLISE BEM-SUCEDIDA)
// ═══════════════════════════════════════════════════════════════════

/**
 * Registrar análise feita por usuário anônimo
 * 
 * IMPORTANTE: Chamar APENAS após análise realmente completar
 * 
 * @param {string} visitorId - Fingerprint do usuário
 * @param {Object} req - Request Express (para IP)
 * @param {Object} options - { isDemo: boolean }
 */
export async function registerAnonymousAnalysis(visitorId, req, options = {}) {
  const ip = getClientIP(req);
  const isDemo = options.isDemo === true;
  const usageType = isDemo ? 'demo' : 'anonymous';
  const maxAllowed = isDemo ? PERMANENT_LIMITS.demo.maxAnalyses : PERMANENT_LIMITS.anonymous.maxAnalyses;
  
  console.log(`\n📝 [ANON_LIMITER] Registrando análise...`);
  console.log(`   visitorId: ${visitorId?.substring(0, 16)}...`);
  console.log(`   Tipo: ${usageType}`);
  
  await ensureTable();
  
  try {
    // UPSERT: Inserir ou atualizar registro
    const result = await pool.query(`
      INSERT INTO anonymous_usage (visitor_id, ip_address, usage_type, analysis_count, last_analysis_at, updated_at)
      VALUES ($1, $2, $3, 1, NOW(), NOW())
      ON CONFLICT (visitor_id, usage_type) 
      DO UPDATE SET 
        analysis_count = anonymous_usage.analysis_count + 1,
        ip_address = COALESCE($2, anonymous_usage.ip_address),
        last_analysis_at = NOW(),
        updated_at = NOW()
      RETURNING analysis_count, blocked
    `, [visitorId, ip, usageType]);
    
    const newCount = result.rows[0]?.analysis_count || 1;
    const isNowBlocked = newCount >= maxAllowed;
    
    console.log(`✅ [ANON_LIMITER] Análise registrada: ${newCount}/${maxAllowed}`);
    
    // Se atingiu o limite, marcar como bloqueado PERMANENTEMENTE
    if (isNowBlocked && !result.rows[0]?.blocked) {
      await pool.query(`
        UPDATE anonymous_usage 
        SET blocked = TRUE, 
            block_reason = 'LIMIT_REACHED_PERMANENTLY',
            updated_at = NOW()
        WHERE visitor_id = $1 AND usage_type = $2
      `, [visitorId, usageType]);
      
      console.log(`🚫 [ANON_LIMITER] Usuário BLOQUEADO PERMANENTEMENTE após ${newCount} análise(s)`);
    }
    
    return {
      success: true,
      used: newCount,
      remaining: Math.max(0, maxAllowed - newCount),
      blocked: isNowBlocked
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao registrar análise:', err.message);
    return { 
      success: false, 
      error: err.message,
      used: 0,
      remaining: 0
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🔍 CONSULTAS AUXILIARES
// ═══════════════════════════════════════════════════════════════════

/**
 * Verificar status de bloqueio de um visitante
 */
export async function getAnonymousStatus(visitorId, usageType = 'anonymous') {
  await ensureTable();
  
  try {
    const result = await pool.query(`
      SELECT analysis_count, message_count, blocked, block_reason, created_at, updated_at, last_analysis_at
      FROM anonymous_usage 
      WHERE visitor_id = $1 AND usage_type = $2
    `, [visitorId, usageType]);
    
    if (result.rows.length === 0) {
      return {
        exists: false,
        analysisCount: 0,
        messageCount: 0,
        blocked: false,
        blockReason: null
      };
    }
    
    const record = result.rows[0];
    return {
      exists: true,
      analysisCount: record.analysis_count,
      messageCount: record.message_count,
      blocked: record.blocked,
      blockReason: record.block_reason,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      lastAnalysisAt: record.last_analysis_at
    };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao obter status:', err.message);
    return { exists: false, error: err.message };
  }
}

/**
 * Forçar bloqueio manual de um visitante (admin)
 */
export async function forceBlockVisitor(visitorId, usageType = 'anonymous', reason = 'MANUAL_BLOCK') {
  await ensureTable();
  
  try {
    await pool.query(`
      INSERT INTO anonymous_usage (visitor_id, usage_type, blocked, block_reason, updated_at)
      VALUES ($1, $2, TRUE, $3, NOW())
      ON CONFLICT (visitor_id, usage_type) 
      DO UPDATE SET 
        blocked = TRUE, 
        block_reason = $3,
        updated_at = NOW()
    `, [visitorId, usageType, reason]);
    
    console.log(`🚫 [ANON_LIMITER] Visitante bloqueado manualmente: ${visitorId?.substring(0, 16)}...`);
    return { success: true };
    
  } catch (err) {
    console.error('❌ [ANON_LIMITER] Erro ao bloquear visitante:', err.message);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 💬 CHAT (MANTIDO PARA COMPATIBILIDADE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Verificar se pode enviar mensagem (chat tem regras mais flexíveis)
 * Nota: Chat pode manter lógica com TTL se desejado
 */
export async function canAnonymousChat(visitorId, req) {
  // Para chat, podemos manter regras mais flexíveis
  // Implementar conforme necessidade
  return {
    allowed: true,
    remaining: PERMANENT_LIMITS.anonymous.maxMessages,
    limit: PERMANENT_LIMITS.anonymous.maxMessages
  };
}

/**
 * Registrar mensagem de chat
 */
export async function registerAnonymousChat(visitorId, req, options = {}) {
  // Implementar conforme necessidade
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAÇÕES PARA COMPATIBILIDADE
// ═══════════════════════════════════════════════════════════════════

export { PERMANENT_LIMITS as ANONYMOUS_LIMITS };
export const LIMITS = PERMANENT_LIMITS;
