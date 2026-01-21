-- ═══════════════════════════════════════════════════════════════════
-- SCRIPT SQL: Criar Tabelas para Ambiente de TESTE
-- ═══════════════════════════════════════════════════════════════════
-- 
-- OBJETIVO: Criar tabelas que o código tenta criar automaticamente,
-- mas que falham em ambientes onde o usuário não tem permissão CREATE.
--
-- EXECUTAR NO RAILWAY (ambiente TESTE):
-- 1. Acessar Railway Dashboard
-- 2. PostgreSQL Service → Data tab
-- 3. Colar este script
-- 4. Executar
--
-- ═══════════════════════════════════════════════════════════════════

-- Tabela para controle de uso anônimo
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
  
  -- Índice único por visitor_id + tipo
  CONSTRAINT unique_visitor_type UNIQUE (visitor_id, usage_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_visitor ON anonymous_usage(visitor_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_blocked ON anonymous_usage(blocked);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip ON anonymous_usage(ip_address);

-- Tabela de bloqueio definitivo
CREATE TABLE IF NOT EXISTS anonymous_blocklist (
  id SERIAL PRIMARY KEY,
  
  -- Identificadores
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

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_blocklist_visitor ON anonymous_blocklist(visitor_id);
CREATE INDEX IF NOT EXISTS idx_blocklist_fingerprint ON anonymous_blocklist(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip ON anonymous_blocklist(first_ip);
CREATE INDEX IF NOT EXISTS idx_blocklist_blocked ON anonymous_blocklist(blocked);
CREATE INDEX IF NOT EXISTS idx_blocklist_multi ON anonymous_blocklist(visitor_id, fingerprint_hash, first_ip);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════

-- Verificar se as tabelas foram criadas
SELECT 
  'anonymous_usage' as tabela,
  COUNT(*) as registros
FROM anonymous_usage
UNION ALL
SELECT 
  'anonymous_blocklist' as tabela,
  COUNT(*) as registros
FROM anonymous_blocklist;

-- ═══════════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO
-- ═══════════════════════════════════════════════════════════════════
-- tabela                 | registros
-- -----------------------+-----------
-- anonymous_usage        | 0
-- anonymous_blocklist    | 0
--
-- Se aparecer isso, as tabelas foram criadas com sucesso!
-- ═══════════════════════════════════════════════════════════════════
