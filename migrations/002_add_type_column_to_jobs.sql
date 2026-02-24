-- ============================================================================
-- MIGRAÇÃO 002: Adicionar coluna type à tabela jobs
-- Data: 2026-02-24
-- Propósito: Diferenciar jobs de análise (analyze) de jobs de masterização
--            automática (automaster) no pipeline compartilhado.
--
-- Valores esperados:
--   'analyze'    -> Jobs do analisador de áudio existente
--   'automaster' -> Jobs do AutoMaster V1 (masterização automática)
--
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem efeito colateral.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'type'
    ) THEN
        -- Adicionar coluna com default 'analyze' para manter compatibilidade total
        -- com todos os jobs existentes
        ALTER TABLE jobs ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'analyze';
        
        -- Índice para filtrar jobs por tipo (útil para workers dedicados)
        CREATE INDEX idx_jobs_type ON jobs(type);
        
        RAISE NOTICE '✅ Coluna type adicionada à tabela jobs';
    ELSE
        RAISE NOTICE '⏭️ Coluna type já existe, pulando';
    END IF;
END $$;

-- Garantir que jobs existentes sem type sejam marcados como 'analyze'
UPDATE jobs SET type = 'analyze' WHERE type IS NULL;

-- Documentação da coluna
COMMENT ON COLUMN jobs.type IS
  'Tipo do job: analyze (analisador de áudio) | automaster (masterização automática)';

-- Verificação final da estrutura
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('id', 'mode', 'type', 'status', 'reference_for')
ORDER BY ordinal_position;
