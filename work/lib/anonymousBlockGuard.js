/**
 * 🛡️ ANONYMOUS BLOCK GUARD - Sistema de Bloqueio DEFINITIVO
 * 
 * ⚠️ REGRA INEGOCIÁVEL:
 * - 1 análise NA VIDA para usuários não logados
 * - Bloqueio baseado em MÚLTIPLAS CAMADAS de identificação
 * - Backend é a ÚNICA autoridade
 * - ZERO tolerância para bypass
 * 
 * CAMADAS DE IDENTIFICAÇÃO:
 * 1. visitor_id (FingerprintJS)
 * 2. fingerprint_hash (Canvas + Audio + WebGL + Hardware)
 * 3. IP address (apoio)
 * 
 * REGRA DE BLOQUEIO:
 * - Se visitor_id JÁ EXISTE → BLOQUEIA
 * - Se fingerprint_hash JÁ EXISTE → BLOQUEIA  
 * - Se IP já associado a bloqueio → BLOQUEIA (reforço)
 * 
 * @version 1.0.0 - BLOQUEIO DEFINITIVO
 * @date 2026-01-03
 */

import pool from '../../db.js';

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DA TABELA BLOCKLIST
// ═══════════════════════════════════════════════════════════════════

let blocklistTableInitialized = false;

/**
 * Criar tabela anonymous_blocklist se não existir
 * 🛡️ PROTEÇÃO: Só executa em ambiente DEV
 * Esta tabela é PERMANENTE - nunca expira
 */
async function ensureBlocklistTable() {
  if (blocklistTableInitialized) return;
  
  // 🛡️ PROTEÇÃO: Não criar tabelas em produção/teste
  const env = process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT;
  if (env === 'production' || env === 'test') {
    console.log('⏭️ [BLOCK_GUARD] Pulando criação de tabela (ambiente:', env + ')');
    blocklistTableInitialized = true; // Marcar como inicializado
    return;
  }
  
  try {
    await pool.query(`
      -- Tabela principal de bloqueio
      CREATE TABLE IF NOT EXISTS anonymous_blocklist (
        id SERIAL PRIMARY KEY,
        
        -- Identificadores (qualquer um pode bloquear)
        visitor_id VARCHAR(255) NOT NULL,
        fingerprint_hash VARCHAR(128),
        first_ip VARCHAR(45),
        
        -- Status de bloqueio
        blocked BOOLEAN NOT NULL DEFAULT TRUE,
        block_reason VARCHAR(255) DEFAULT 'SINGLE_ANALYSIS_USED',
        
        -- Metadata
        usage_type VARCHAR(50) NOT NULL DEFAULT 'anonymous',
        analysis_count INTEGER NOT NULL DEFAULT 1,
        
        -- Timestamps (NUNCA expiram)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Hardware summary para debug
        hardware_summary JSONB,
        user_agent TEXT,
        
        -- Constraints
        CONSTRAINT unique_visitor_blocklist UNIQUE (visitor_id, usage_type)
      );
      
      -- Índices para busca rápida por QUALQUER identificador
      CREATE INDEX IF NOT EXISTS idx_blocklist_visitor ON anonymous_blocklist(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_blocklist_fingerprint ON anonymous_blocklist(fingerprint_hash);
      CREATE INDEX IF NOT EXISTS idx_blocklist_ip ON anonymous_blocklist(first_ip);
      CREATE INDEX IF NOT EXISTS idx_blocklist_blocked ON anonymous_blocklist(blocked);
      
      -- Índice composto para busca por múltiplos identificadores
      CREATE INDEX IF NOT EXISTS idx_blocklist_multi ON anonymous_blocklist(visitor_id, fingerprint_hash, first_ip);
    `);
    
    blocklistTableInitialized = true;
    console.log('✅ [BLOCK_GUARD] Tabela anonymous_blocklist verificada/criada');
  } catch (err) {
    console.error('❌ [BLOCK_GUARD] Erro ao criar tabela blocklist:', err.message);
    // 🛡️ PROTEÇÃO: Não crashar se falhar (pode ser permissão)
    blocklistTableInitialized = true; // Marcar para não tentar novamente
    console.warn('⚠️ [BLOCK_GUARD] Continuando sem criação de tabela (pode já existir)');
  }
}

// 🛡️ PROTEÇÃO: NÃO executar automaticamente - tabelas devem existir previamente
// Em DEV, chamar manualmente ensureBlocklistTable() se necessário

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
 * Validar fingerprint_hash
 */
function isValidFingerprintHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  // Deve ter pelo menos 32 caracteres (hash SHA-256 truncado ou completo)
  return hash.length >= 16 && /^[a-f0-9_h]+$/i.test(hash);
}

/**
 * Validar visitorId
 */
function isValidVisitorId(id) {
  if (!id || typeof id !== 'string') return false;
  return id.length >= 10;
}

// ═══════════════════════════════════════════════════════════════════
// 🚨 GUARD PRINCIPAL: enforceAnonymousSingleAnalysis
// ═══════════════════════════════════════════════════════════════════

/**
 * 🚨 GUARD DEFINITIVO: Verifica e bloqueia análise anônima
 * 
 * Este guard DEVE ser chamado ANTES de:
 * - Criar job
 * - Fazer upload
 * - Enfileirar no BullMQ
 * - Consumir qualquer recurso
 * 
 * LÓGICA DE BLOQUEIO (OR):
 * - visitor_id JÁ EXISTE na blocklist → BLOQUEIA
 * - fingerprint_hash JÁ EXISTE na blocklist → BLOQUEIA
 * - IP com histórico de bloqueio → BLOQUEIA (reforço)
 * 
 * @param {string} visitorId - ID do FingerprintJS
 * @param {string} fingerprintHash - Hash do device fingerprint forte
 * @param {Object} req - Request Express
 * @param {Object} options - { isDemo, hardwareSummary }
 * @returns {Promise<Object>} { allowed, blocked, reason, message }
 */
export async function enforceAnonymousSingleAnalysis(visitorId, fingerprintHash, req, options = {}) {
  const ip = getClientIP(req);
  const userAgent = req.headers?.['user-agent'] || 'unknown';
  const isDemo = options.isDemo === true;
  const usageType = isDemo ? 'demo' : 'anonymous';
  const hardwareSummary = options.hardwareSummary || null;
  
  console.log(`\n🛡️ [BLOCK_GUARD] ════════════════════════════════════════════════════`);
  console.log(`🛡️ [BLOCK_GUARD] VERIFICAÇÃO DE BLOQUEIO DEFINITIVO`);
  console.log(`🛡️ [BLOCK_GUARD] ════════════════════════════════════════════════════`);
  console.log(`   📋 Tipo: ${usageType}`);
  console.log(`   🔑 visitorId: ${visitorId?.substring(0, 20)}...`);
  console.log(`   🔐 fingerprint: ${fingerprintHash?.substring(0, 20)}...`);
  console.log(`   🌐 IP: ${ip}`);
  console.log(`   🖥️ User-Agent: ${userAgent.substring(0, 50)}...`);
  
  await ensureBlocklistTable();
  
  // ═══════════════════════════════════════════════════════════════
  // VALIDAÇÃO DE IDENTIFICADORES
  // ═══════════════════════════════════════════════════════════════
  
  if (!isValidVisitorId(visitorId)) {
    console.error('❌ [BLOCK_GUARD] visitorId INVÁLIDO - BLOQUEANDO');
    return {
      allowed: false,
      blocked: true,
      reason: 'INVALID_VISITOR_ID',
      message: 'Identificação inválida. Faça login para continuar.',
      errorCode: 'ANON_INVALID_ID'
    };
  }
  
  // Fingerprint é altamente recomendado, mas não obrigatório para primeira análise
  const hasFingerprint = isValidFingerprintHash(fingerprintHash);
  if (!hasFingerprint) {
    console.warn('⚠️ [BLOCK_GUARD] fingerprint_hash ausente ou inválido');
  }
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // VERIFICAÇÃO 1: Por visitor_id
    // ═══════════════════════════════════════════════════════════════
    
    const byVisitor = await pool.query(`
      SELECT id, blocked, analysis_count, fingerprint_hash, first_ip, created_at
      FROM anonymous_blocklist 
      WHERE visitor_id = $1 AND usage_type = $2
    `, [visitorId, usageType]);
    
    if (byVisitor.rows.length > 0) {
      const record = byVisitor.rows[0];
      console.log(`🚫 [BLOCK_GUARD] visitor_id ENCONTRADO na blocklist`);
      console.log(`   - Criado em: ${record.created_at}`);
      console.log(`   - Análises: ${record.analysis_count}`);
      console.log(`   - Bloqueado: ${record.blocked}`);
      
      // Atualizar última tentativa
      await pool.query(`
        UPDATE anonymous_blocklist 
        SET last_attempt_at = NOW(),
            analysis_count = analysis_count + 1
        WHERE id = $1
      `, [record.id]);
      
      return {
        allowed: false,
        blocked: true,
        reason: 'VISITOR_ALREADY_USED',
        message: isDemo 
          ? 'Você já usou sua análise gratuita. Libere o acesso completo!'
          : 'Você já usou sua análise gratuita. Crie uma conta para continuar!',
        errorCode: isDemo ? 'DEMO_BLOCKED' : 'ANON_BLOCKED',
        requiresLogin: true
      };
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VERIFICAÇÃO 2: Por fingerprint_hash (se disponível)
    // ═══════════════════════════════════════════════════════════════
    
    if (hasFingerprint) {
      const byFingerprint = await pool.query(`
        SELECT id, visitor_id, blocked, analysis_count, first_ip, created_at
        FROM anonymous_blocklist 
        WHERE fingerprint_hash = $1 AND usage_type = $2
      `, [fingerprintHash, usageType]);
      
      if (byFingerprint.rows.length > 0) {
        const record = byFingerprint.rows[0];
        console.log(`🚫 [BLOCK_GUARD] fingerprint_hash ENCONTRADO na blocklist`);
        console.log(`   - Visitor original: ${record.visitor_id?.substring(0, 16)}...`);
        console.log(`   - Criado em: ${record.created_at}`);
        console.log(`   - Mesmo dispositivo tentando com novo visitor_id`);
        
        // Registrar tentativa de bypass
        await pool.query(`
          UPDATE anonymous_blocklist 
          SET last_attempt_at = NOW(),
              analysis_count = analysis_count + 1,
              block_reason = 'FINGERPRINT_ALREADY_USED'
          WHERE id = $1
        `, [record.id]);
        
        return {
          allowed: false,
          blocked: true,
          reason: 'FINGERPRINT_ALREADY_USED',
          message: 'Este dispositivo já usou a análise gratuita. Faça login para continuar!',
          errorCode: 'DEVICE_BLOCKED',
          requiresLogin: true
        };
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VERIFICAÇÃO 3: Por IP (reforço - detecta mesmo dispositivo em rede)
    // ═══════════════════════════════════════════════════════════════
    
    if (ip && ip !== 'unknown') {
      // Verificar se IP já tem muitos bloqueios (possível abuso)
      const byIP = await pool.query(`
        SELECT COUNT(*) as blocked_count
        FROM anonymous_blocklist 
        WHERE first_ip = $1 AND usage_type = $2 AND blocked = true
      `, [ip, usageType]);
      
      const blockedByIP = parseInt(byIP.rows[0]?.blocked_count || '0', 10);
      
      // Se IP tem 3+ bloqueios, provavelmente é abuso
      if (blockedByIP >= 3) {
        console.log(`🚫 [BLOCK_GUARD] IP ${ip} tem ${blockedByIP} bloqueios - possível abuso`);
        
        return {
          allowed: false,
          blocked: true,
          reason: 'IP_ABUSE_DETECTED',
          message: 'Muitas tentativas detectadas. Faça login para continuar!',
          errorCode: 'IP_BLOCKED',
          requiresLogin: true
        };
      }
      
      // Verificar se IP já foi usado recentemente (dentro de 1h) - possível troca de aba anônima
      const recentByIP = await pool.query(`
        SELECT id, visitor_id, fingerprint_hash
        FROM anonymous_blocklist 
        WHERE first_ip = $1 
          AND usage_type = $2 
          AND created_at > NOW() - INTERVAL '1 hour'
          AND blocked = true
      `, [ip, usageType]);
      
      if (recentByIP.rows.length > 0) {
        console.log(`⚠️ [BLOCK_GUARD] IP ${ip} usado recentemente - possível aba anônima`);
        // Não bloqueia automaticamente, mas registra o aviso
        // Pode ser alguém na mesma rede legítimo
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ✅ PERMITIDO - Primeira análise
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`✅ [BLOCK_GUARD] Análise PERMITIDA - primeira vez`);
    
    return {
      allowed: true,
      blocked: false,
      reason: 'FIRST_ANALYSIS',
      message: null,
      errorCode: null,
      // Dados para registro após análise
      registrationData: {
        visitorId,
        fingerprintHash,
        ip,
        userAgent,
        hardwareSummary,
        usageType
      }
    };
    
  } catch (err) {
    console.error('❌ [BLOCK_GUARD] Erro na verificação:', err.message);
    
    // Em caso de erro de DB, BLOQUEAR por segurança
    return {
      allowed: false,
      blocked: true,
      reason: 'SYSTEM_ERROR',
      message: 'Erro ao verificar permissões. Faça login para continuar.',
      errorCode: 'GUARD_ERROR',
      requiresLogin: true
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 📝 REGISTRAR BLOQUEIO APÓS ANÁLISE
// ═══════════════════════════════════════════════════════════════════

/**
 * Registrar análise e bloquear permanentemente
 * 
 * IMPORTANTE: Chamar APENAS após análise bem-sucedida
 * 
 * @param {Object} data - Dados do enforceAnonymousSingleAnalysis.registrationData
 */
export async function registerAndBlockAnonymous(data) {
  const { visitorId, fingerprintHash, ip, userAgent, hardwareSummary, usageType } = data;
  
  console.log(`\n📝 [BLOCK_GUARD] Registrando bloqueio permanente...`);
  console.log(`   🔑 visitorId: ${visitorId?.substring(0, 16)}...`);
  console.log(`   🔐 fingerprint: ${fingerprintHash?.substring(0, 16)}...`);
  
  await ensureBlocklistTable();
  
  try {
    // Inserir ou atualizar registro de bloqueio
    await pool.query(`
      INSERT INTO anonymous_blocklist (
        visitor_id, 
        fingerprint_hash, 
        first_ip, 
        user_agent,
        hardware_summary,
        usage_type, 
        blocked, 
        block_reason,
        analysis_count,
        created_at,
        last_attempt_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'SINGLE_ANALYSIS_USED', 1, NOW(), NOW())
      ON CONFLICT (visitor_id, usage_type) 
      DO UPDATE SET 
        fingerprint_hash = COALESCE(EXCLUDED.fingerprint_hash, anonymous_blocklist.fingerprint_hash),
        first_ip = COALESCE(EXCLUDED.first_ip, anonymous_blocklist.first_ip),
        blocked = TRUE,
        block_reason = 'SINGLE_ANALYSIS_USED',
        analysis_count = anonymous_blocklist.analysis_count + 1,
        last_attempt_at = NOW()
    `, [visitorId, fingerprintHash, ip, userAgent, JSON.stringify(hardwareSummary), usageType]);
    
    console.log(`🚫 [BLOCK_GUARD] Usuário BLOQUEADO PERMANENTEMENTE`);
    
    return { success: true, blocked: true };
    
  } catch (err) {
    console.error('❌ [BLOCK_GUARD] Erro ao registrar bloqueio:', err.message);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🔍 FUNÇÕES AUXILIARES DE CONSULTA
// ═══════════════════════════════════════════════════════════════════

/**
 * Verificar se um identificador está bloqueado
 */
export async function isBlocked(identifier, type = 'visitor_id', usageType = 'anonymous') {
  await ensureBlocklistTable();
  
  const column = type === 'fingerprint' ? 'fingerprint_hash' : 
                 type === 'ip' ? 'first_ip' : 'visitor_id';
  
  const result = await pool.query(`
    SELECT blocked FROM anonymous_blocklist 
    WHERE ${column} = $1 AND usage_type = $2
  `, [identifier, usageType]);
  
  return result.rows.length > 0 && result.rows[0].blocked === true;
}

/**
 * Obter estatísticas de bloqueio
 */
export async function getBlocklistStats() {
  await ensureBlocklistTable();
  
  const result = await pool.query(`
    SELECT 
      usage_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE blocked = true) as blocked_count,
      MAX(created_at) as last_block
    FROM anonymous_blocklist
    GROUP BY usage_type
  `);
  
  return result.rows;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAÇÕES
// ═══════════════════════════════════════════════════════════════════

export default {
  enforceAnonymousSingleAnalysis,
  registerAndBlockAnonymous,
  isBlocked,
  getBlocklistStats
};
