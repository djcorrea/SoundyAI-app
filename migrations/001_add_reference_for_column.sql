-- 🎯 MIGRAÇÃO: Adicionar suporte para modo reference (comparação track-to-track)
-- Data: 2025-11-01
-- Propósito: Adicionar coluna reference_for para vincular segundo track ao primeiro
h
-- Adicionar coluna reference_for (UUID do job de referência)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'reference_for'
    ) THEN
        ALTER TABLE jobs ADD COLUMN reference_for UUID NULL;
        CREATE INDEX idx_jobs_reference_for ON jobs(reference_for);
        
        RAISE NOTICE '✅ Coluna reference_for adicionada com índice';
    ELSE
        RAISE NOTICE '⏭️ Coluna reference_for já existe';
    END IF;
END $$;

-- Adicionar comentário para documentação
COMMENT ON COLUMN jobs.reference_for IS 'UUID do job de referência (primeira música) quando mode=reference';

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name IN ('id', 'mode', 'reference_for', 'reference_file_key')
ORDER BY ordinal_position;
