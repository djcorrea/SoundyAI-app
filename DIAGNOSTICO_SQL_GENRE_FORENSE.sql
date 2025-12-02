-- 🔬 SQL DE DIAGNÓSTICO FORENSE - GENRE LOSS
-- Execute estas queries no Postgres para confirmar a perda de genre

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 1: Comparar data.genre vs results.genre (PRINCIPAL)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  mode,
  status,
  created_at,
  data->>'genre' AS data_genre,
  result->>'genre' AS result_genre,
  results->>'genre' AS results_genre,
  results->'summary'->>'genre' AS summary_genre,
  CASE 
    WHEN data->>'genre' IS NOT NULL AND results->>'genre' IS NULL 
    THEN '🚨 GENRE PERDIDO'
    WHEN data->>'genre' IS NOT NULL AND results->>'genre' = 'default'
    THEN '⚠️ GENRE VIROU DEFAULT'
    WHEN data->>'genre' = results->>'genre'
    THEN '✅ OK'
    ELSE '❓ OUTRO PROBLEMA'
  END AS diagnosis
FROM jobs
WHERE mode = 'genre'
ORDER BY created_at DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 2: Identificar workers que processaram cada job
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  status,
  created_at,
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  result->>'genre' AS result_genre,
  result->>'mode' AS result_mode,
  results->>'mode' AS results_mode,
  CASE
    WHEN result IS NOT NULL AND results IS NULL 
    THEN '🔴 Worker Legado (index.js ou worker-root.js)'
    WHEN results IS NOT NULL AND result IS NULL
    THEN '🟢 Worker Principal (work/worker.js) - results only'
    WHEN results IS NOT NULL AND result IS NOT NULL
    THEN '🟡 Worker Principal (work/worker.js) - ambas colunas'
    ELSE '❓ Desconhecido'
  END AS processed_by,
  CASE
    WHEN result IS NOT NULL AND results IS NULL AND result->>'mode' = 'fallback_basic'
    THEN '⚠️ FALLBACK DO INDEX.JS (sem genre)'
    ELSE '✅'
  END AS worker_type
FROM jobs
WHERE mode = 'genre'
ORDER BY created_at DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 3: Encontrar estruturas ocultas com genre
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  created_at,
  jsonb_object_keys(results) AS result_keys
FROM jobs
WHERE mode = 'genre'
  AND results IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 4: Análise PROFUNDA de um job específico (substituir ID)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Substitua 'SEU-JOB-ID-AQUI' pelo ID do job problemático
SELECT
  id,
  mode,
  status,
  created_at,
  '━━━━━ DATA COLUMN ━━━━━' as separator1,
  data->>'genre' AS data_genre,
  data,
  '━━━━━ RESULT COLUMN ━━━━━' as separator2,
  result->>'genre' AS result_genre,
  result->>'mode' AS result_mode,
  result->'summary'->>'genre' AS result_summary_genre,
  result->'metadata'->>'genre' AS result_metadata_genre,
  result,
  '━━━━━ RESULTS COLUMN ━━━━━' as separator3,
  results->>'genre' AS results_genre,
  results->>'mode' AS results_mode,
  results->'summary'->>'genre' AS results_summary_genre,
  results->'metadata'->>'genre' AS results_metadata_genre,
  results
FROM jobs
WHERE id = 'SEU-JOB-ID-AQUI';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 5: Estatísticas de perda de genre
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  mode,
  status,
  COUNT(*) AS total_jobs,
  COUNT(CASE WHEN data->>'genre' IS NOT NULL THEN 1 END) AS jobs_com_data_genre,
  COUNT(CASE WHEN results->>'genre' IS NOT NULL THEN 1 END) AS jobs_com_results_genre,
  COUNT(CASE 
    WHEN data->>'genre' IS NOT NULL 
    AND results->>'genre' IS NULL 
    THEN 1 
  END) AS jobs_genre_perdido,
  ROUND(
    100.0 * COUNT(CASE 
      WHEN data->>'genre' IS NOT NULL 
      AND results->>'genre' IS NULL 
      THEN 1 
    END) / NULLIF(COUNT(CASE WHEN data->>'genre' IS NOT NULL THEN 1 END), 0),
    2
  ) AS percentual_perda
FROM jobs
WHERE mode = 'genre'
GROUP BY mode, status
ORDER BY status;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 6: Jobs processados por workers legados (para limpar)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  file_key,
  mode,
  status,
  created_at,
  result->>'mode' AS result_mode,
  CASE
    WHEN result->>'mode' = 'fallback_basic' THEN '🔴 index.js (fallback)'
    WHEN result IS NOT NULL AND results IS NULL THEN '🔴 worker-root.js'
    ELSE '✅ work/worker.js'
  END AS worker_identificado
FROM jobs
WHERE mode = 'genre'
  AND (
    result->>'mode' = 'fallback_basic' 
    OR (result IS NOT NULL AND results IS NULL)
  )
ORDER BY created_at DESC
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 7: Verificar estruturas aninhadas com genre: null
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  created_at,
  results->>'genre' AS root_genre,
  results->'summary'->>'genre' AS summary_genre,
  results->'metadata'->>'genre' AS metadata_genre,
  results->'suggestionMetadata'->>'genre' AS suggestion_metadata_genre,
  results->'data'->>'genre' AS data_genre,
  results->'problemsAnalysis'->>'genre' AS problems_analysis_genre,
  results->'diagnostics'->>'genre' AS diagnostics_genre,
  CASE
    WHEN results->'problemsAnalysis'->>'genre' IS NOT NULL 
    THEN '⚠️ problemsAnalysis tem genre'
    WHEN results->'diagnostics'->>'genre' IS NOT NULL
    THEN '⚠️ diagnostics tem genre'
    ELSE '✅ Apenas estruturas esperadas'
  END AS estruturas_extras
FROM jobs
WHERE mode = 'genre'
  AND results IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- QUERY 8: Timeline de processamento (debugging race condition)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  id,
  status,
  created_at,
  updated_at,
  completed_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) AS processing_seconds,
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  CASE
    WHEN results IS NULL AND result IS NOT NULL 
    THEN '🔴 Apenas result (worker legado)'
    WHEN results IS NOT NULL 
    THEN '✅ results preenchido'
    ELSE '❓ Nenhum resultado'
  END AS resultado_estado
FROM jobs
WHERE mode = 'genre'
ORDER BY created_at DESC
LIMIT 30;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 📋 INSTRUÇÕES DE USO:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 1. Execute QUERY 1 primeiro para visão geral da perda de genre
-- 2. Execute QUERY 2 para identificar qual worker processou cada job
-- 3. Execute QUERY 5 para estatísticas agregadas
-- 4. Execute QUERY 6 para encontrar jobs processados por workers legados
-- 5. Execute QUERY 4 para análise PROFUNDA de um job específico problemático
-- 6. Execute QUERY 7 para detectar estruturas ocultas com genre
-- 7. Execute QUERY 8 para debug de race conditions (múltiplos workers)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🎯 INTERPRETAÇÃO DOS RESULTADOS:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Se QUERY 1 mostrar "🚨 GENRE PERDIDO":
--   → Execute QUERY 2 para ver qual worker processou
--   → Se "🔴 Worker Legado": Workers paralelos sobrescreveram
--   → Se "🟢 Worker Principal": Problema no spread ou pipeline
--
-- Se QUERY 2 mostrar "🔴 Worker Legado":
--   → AÇÃO: Desativar index.js e worker-root.js (JÁ FEITO)
--   → AÇÃO: Reprocessar jobs afetados
--
-- Se QUERY 5 mostrar percentual_perda > 0%:
--   → URGENTE: Aplicar patches definitivos
--   → CRÍTICO: Verificar logs [GENRE-PARANOID] no worker
--
-- Se QUERY 7 mostrar estruturas extras com genre:
--   → PROBLEMA: Spread destructivo copiando estruturas não tratadas
--   → SOLUÇÃO: Remover spread e copiar campos explicitamente (JÁ FEITO)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
