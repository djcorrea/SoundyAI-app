// api/jobs/[id].js
import express from "express";
import pool from "../../db.js";

const router = express.Router();

// 🔧 Validação UUID (inline, sem dependência externa)
function isValidUuid(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
}

// ═══════════════════════════════════════════════════════════════
// 🎯 FUNÇÕES AUXILIARES: Detecção robusta de modo e estágio
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta modo efetivo (reference vs genre) com fallback seguro
 * @param {Object} fullResult - Resultado completo do Redis/Postgres
 * @param {Object} job - Job do Postgres
 * @returns {string} 'reference' ou 'genre'
 */
function getEffectiveMode(fullResult, job) {
  // Prioridade:
  // 1. fullResult.mode (Redis cache mais recente)
  // 2. fullResult.analysisMode (campo alternativo)
  // 3. job.mode (Postgres)
  // 4. Detectar por presença de campos reference
  // 5. Fallback: 'genre'
  
  if (fullResult?.mode === 'reference') return 'reference';
  if (fullResult?.analysisMode === 'reference') return 'reference';
  if (job?.mode === 'reference') return 'reference';
  
  // Detectar por campos inequívocos de reference
  if (fullResult?.referenceStage) return 'reference';
  if (fullResult?.requiresSecondTrack === true) return 'reference';
  if (fullResult?.referenceJobId && fullResult?.isReferenceBase === false) return 'reference';
  if (job?.referenceStage) return 'reference';
  
  // Default: genre
  return fullResult?.mode || fullResult?.analysisMode || job?.mode || 'genre';
}

/**
 * Detecta estágio da análise reference (base vs comparison)
 * @param {Object} fullResult - Resultado completo
 * @param {Object} job - Job do Postgres
 * @returns {string|undefined} 'base', 'comparison', ou undefined se não for reference
 */
function getReferenceStage(fullResult, job) {
  // Fonte 1: campo explícito
  if (fullResult?.referenceStage) return fullResult.referenceStage;
  if (job?.referenceStage) return job.referenceStage;
  
  // Fonte 2: heurística por requiresSecondTrack
  if (fullResult?.requiresSecondTrack === true) return 'base';
  if (fullResult?.requiresSecondTrack === false && fullResult?.referenceJobId) return 'comparison';
  
  // Fonte 3: detectar por presença de referenceComparison
  if (fullResult?.referenceComparison) return 'comparison';
  
  // Fonte 4: isReferenceBase (campo legado)
  if (fullResult?.isReferenceBase === true) return 'base';
  if (fullResult?.isReferenceBase === false) return 'comparison';
  
  return undefined;
}

/**
 * Verifica se job tem métricas suficientes para considerar reference-base completo
 * @param {Object} fullResult - Resultado completo
 * @returns {boolean}
 */
function hasRequiredMetrics(fullResult) {
  if (!fullResult) return false;
  
  // Opção 1: technicalData completo
  const hasTechnicalData = !!fullResult.technicalData;
  
  // Opção 2: metrics direto
  const hasMetrics = !!fullResult.metrics;
  
  // Opção 3: baseMetrics
  const hasBaseMetrics = !!fullResult.baseMetrics;
  
  // Opção 4: score calculado
  const hasScore = typeof fullResult.score === 'number';
  
  // Precisa de pelo menos technicalData OU metrics, mais score
  return (hasTechnicalData || hasMetrics || hasBaseMetrics) && hasScore;
}

// rota GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  // ═══════════════════════════════════════════════════════════════
  // 🔍 HEADERS DE AUDITORIA: Rastreabilidade em produção
  // ═══════════════════════════════════════════════════════════════
  res.setHeader("X-JOBS-HANDLER", "work/api/jobs/[id].js");
  res.setHeader("X-STATUS-HANDLER", "work/api/jobs/[id].js#PROBE_A");
  res.setHeader("X-STATUS-TS", String(Date.now()));
  res.setHeader("X-BUILD", process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "local-dev");
  res.setHeader("X-BUILD-SIGNATURE", "REF-BASE-FIX-2025-12-18");
  
  // 🚫 ANTI-CACHE: Forçar polling sempre buscar dados frescos
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  
  console.error("[PROBE_STATUS_HANDLER] HIT work/api/jobs/[id].js", { 
    url: req.originalUrl,
    jobId: req.params.id,
    timestamp: new Date().toISOString()
  });
  // ═══════════════════════════════════════════════════════════════
  
  const { id } = req.params;

  console.log("[GET-JOB] ID recebido:", id);

  // 🔒 BLINDAGEM 1: ID ausente ou inválido
  if (!id || typeof id !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Job ID ausente ou inválido (undefined/null)",
      jobId: id ?? null,
    });
  }

  // 🔒 BLINDAGEM 2: Formato UUID inválido
  if (!isValidUuid(id)) {
    return res.status(400).json({
      ok: false,
      error: "Job ID não é um UUID válido",
      jobId: id,
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, file_key, mode, status, error, results,
              created_at, updated_at, completed_at
         FROM jobs
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Job não encontrado",
        jobId: id,
      });
    }

    const job = rows[0];

    // 🔑 Normalizar status para o frontend entender
    let normalizedStatus = job.status;
    if (normalizedStatus === "done") normalizedStatus = "completed";
    if (normalizedStatus === "failed") normalizedStatus = "error";
    
    console.log(`[API-JOBS] Status do banco: ${job.status} → Normalizado: ${normalizedStatus}`);

    // 🎯 REGRA 1: Usar SEMPRE job.results (coluna PostgreSQL correta)
    let fullResult = null;
    
    console.log('[AUDIT-CORRECTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-CORRECTION] 📊 Coluna PostgreSQL: results (NÃO result)');
    console.log('[AUDIT-CORRECTION] job.results existe?', !!job.results);
    console.log('[AUDIT-CORRECTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (job.results) {
      try {
        fullResult = typeof job.results === 'string' ? JSON.parse(job.results) : job.results;
        console.log("[API-JOBS] ✅ Job results parsed successfully");
        console.log(`[API-JOBS] Analysis contains: ${Object.keys(fullResult).join(', ')}`);
        
        // REGRA 9: Log de auditoria mostrando paths corretos
        console.log('[AUDIT-CORRECTION] jobResult.results.data.metrics:', !!fullResult.data?.metrics);
        console.log('[AUDIT-CORRECTION] jobResult.results.data.genreTargets:', !!fullResult.data?.genreTargets);        
        
        // 🔥 AUDITORIA CRÍTICA: Verificar technicalData APÓS parse
        console.log('\n\n🔥🔥🔥 [AUDIT-TECHNICAL-DATA] API POST-PARSE 🔥🔥🔥');
        console.log('[AUDIT-TECHNICAL-DATA] fullResult.technicalData:', {
          exists: !!fullResult.technicalData,
          type: typeof fullResult.technicalData,
          isEmpty: fullResult.technicalData && Object.keys(fullResult.technicalData).length === 0,
          keys: fullResult.technicalData ? Object.keys(fullResult.technicalData) : [],
          hasSampleFields: {
            lufsIntegrated: fullResult.technicalData?.lufsIntegrated,
            truePeakDbtp: fullResult.technicalData?.truePeakDbtp,
            dynamicRange: fullResult.technicalData?.dynamicRange,
            spectral_balance: !!fullResult.technicalData?.spectral_balance
          }
        });
        console.log('[AUDIT-TECHNICAL-DATA] fullResult outros campos:', {
          hasScore: fullResult.score !== undefined,
          scoreValue: fullResult.score,
          hasClassification: !!fullResult.classification,
          hasData: !!fullResult.data,
          hasDataGenreTargets: !!fullResult.data?.genreTargets
        });
        console.log('🔥🔥🔥 [AUDIT-TECHNICAL-DATA] END 🔥🔥🔥\n\n');
      } catch (parseError) {
        console.error("[API-JOBS] ❌ Erro ao fazer parse do results JSON:", parseError);
        console.error("[API-JOBS] ⚠️ fullResult será null - job pode ficar em processing");
        fullResult = null;
      }
    }

    // 📊 LOG DE AUDITORIA: Verificar aiSuggestions
    if (fullResult) {
      console.log('[API-JOBS][AUDIT] Verificando aiSuggestions...', {
        hasAiSuggestions: Array.isArray(fullResult.aiSuggestions),
        aiSuggestionsLength: fullResult.aiSuggestions?.length || 0,
        hasSuggestions: Array.isArray(fullResult.suggestions),
        suggestionsLength: fullResult.suggestions?.length || 0,
        status: normalizedStatus
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔐 PROTEÇÃO CRÍTICA: MODE & STAGE DETECTION + EARLY RETURN PARA REFERENCE
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🎯 Detectar modo e stage com funções robustas
    const effectiveMode = getEffectiveMode(fullResult, job);
    const effectiveStage = getReferenceStage(fullResult, job);
    const isReference = effectiveMode === 'reference';
    
    console.error('[MODE-DETECT] 🔍 Detecção:', {
      effectiveMode,
      effectiveStage,
      isReference,
      sources: {
        'fullResult.mode': fullResult?.mode,
        'fullResult.analysisMode': fullResult?.analysisMode,
        'fullResult.referenceStage': fullResult?.referenceStage,
        'job.mode': job?.mode,
        'job.referenceStage': job?.referenceStage,
        'fullResult.requiresSecondTrack': fullResult?.requiresSecondTrack
      }
    });
    
    // 🔒 DIAGNÓSTICO COMPLETO (1x por request, sem spam)
    console.error('[REF-GUARD-V7] DIAGNOSTICO_COMPLETO', { 
      jobId: job.id,
      'job.mode': job?.mode,
      'job.status': job?.status,
      'job.referenceStage': job?.referenceStage,
      'fullResult.mode': fullResult?.mode,
      'fullResult.status': fullResult?.status,
      'fullResult.referenceStage': fullResult?.referenceStage,
      'fullResult.referenceJobId': fullResult?.referenceJobId,
      'fullResult.isReferenceBase': fullResult?.isReferenceBase,
      effectiveMode,
      effectiveStage,
      hasSuggestions: Array.isArray(fullResult?.suggestions) && fullResult.suggestions.length > 0,
      hasAiSuggestions: Array.isArray(fullResult?.aiSuggestions) && fullResult.aiSuggestions.length > 0,
      hasTechnicalData: !!fullResult?.technicalData
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🟢 EARLY RETURN INCONDICIONAL PARA REFERENCE MODE
    // ═══════════════════════════════════════════════════════════════════════
    if (effectiveMode === 'reference') {
      const traceId = fullResult?.traceId || `trace_${Date.now()}`;
      console.error('[REFERENCE] ✅ Mode detectado - processando...', {
        traceId,
        jobId: job.id,
        stage: effectiveStage,
        dbStatus: job?.status,
        resultStatus: fullResult?.status
      });
      
      // Determinar status final
      let finalStatus = fullResult?.status || job?.status || 'processing';
      let warnings = [];
      
      // ═════════════════════════════════════════════════════════════════
      // CASO 1: REFERENCE BASE (primeira música)
      // ═════════════════════════════════════════════════════════════════
      if (effectiveStage === 'base') {
        console.error('[REFERENCE][BASE] 📊 Primeira música detectada');
        
        // Se tiver métricas suficientes, considerar completed
        const metricsOk = hasRequiredMetrics(fullResult);
        
        if (metricsOk && finalStatus === 'processing') {
          console.warn('[REFERENCE][BASE] 🚨 Forçando completed - métricas presentes');
          finalStatus = 'completed';
        }
        
        if (finalStatus === 'completed' && !metricsOk) {
          console.warn('[REFERENCE][BASE] ⚠️ Completed mas métricas incompletas');
          warnings.push('metrics_incomplete');
        }
        
        // NUNCA downgrade por falta de suggestions
        const hasSuggestions = Array.isArray(fullResult?.suggestions) && fullResult.suggestions.length > 0;
        if (!hasSuggestions) {
          console.log('[REFERENCE][BASE] ℹ️ Suggestions ausentes (OK para base)');
          warnings.push('suggestions_optional');
        }
        
        const baseResponse = {
          ...fullResult,
          id: job.id,
          jobId: job.id,
          mode: 'reference',
          referenceStage: 'base',
          status: finalStatus,
          requiresSecondTrack: true,
          referenceJobId: job.id,
          nextAction: finalStatus === 'completed' ? 'upload_second_track' : undefined,
          baseMetrics: fullResult?.metrics || fullResult?.technicalData || fullResult?.baseMetrics,
          suggestions: Array.isArray(fullResult?.suggestions) ? fullResult.suggestions : [],
          aiSuggestions: Array.isArray(fullResult?.aiSuggestions) ? fullResult.aiSuggestions : [],
          warnings: warnings.length > 0 ? warnings : undefined,
          debug: {
            effectiveMode,
            effectiveStage,
            file: 'work/api/jobs/[id].js',
            metricsOk,
            finalStatus
          }
        };
        
        res.setHeader('X-REF-STAGE', 'base');
        res.setHeader('X-FINAL-STATUS', finalStatus);
        console.error('[REFERENCE][BASE] 📤 Retornando:', {
          status: finalStatus,
          nextAction: baseResponse.nextAction,
          warnings: warnings.length
        });
        
        return res.json(baseResponse);
      }
      
      // ═════════════════════════════════════════════════════════════════
      // CASO 2: REFERENCE COMPARISON (segunda música)
      // ═════════════════════════════════════════════════════════════════
      if (effectiveStage === 'comparison') {
        console.error('[REFERENCE][COMPARISON] 📊 Segunda música detectada');
        
        const hasComparison = !!fullResult?.referenceComparison;
        const hasSuggestions = Array.isArray(fullResult?.suggestions) && fullResult.suggestions.length > 0;
        
        // Se tiver comparison, considerar completed mesmo sem suggestions
        if (hasComparison && finalStatus === 'processing') {
          console.warn('[REFERENCE][COMPARISON] 🚨 Forçando completed - comparison presente');
          finalStatus = 'completed';
        }
        
        if (!hasSuggestions) {
          console.warn('[REFERENCE][COMPARISON] ⚠️ Suggestions ausentes');
          warnings.push('missing_suggestions');
        }
        
        const comparisonResponse = {
          ...fullResult,
          id: job.id,
          jobId: job.id,
          mode: 'reference',
          referenceStage: 'comparison',
          status: finalStatus,
          requiresSecondTrack: false,
          nextAction: finalStatus === 'completed' ? 'show_comparison' : undefined,
          suggestions: Array.isArray(fullResult?.suggestions) ? fullResult.suggestions : [],
          aiSuggestions: Array.isArray(fullResult?.aiSuggestions) ? fullResult.aiSuggestions : [],
          warnings: warnings.length > 0 ? warnings : undefined,
          debug: {
            effectiveMode,
            effectiveStage,
            file: 'work/api/jobs/[id].js',
            hasComparison,
            finalStatus
          }
        };
        
        res.setHeader('X-REF-STAGE', 'comparison');
        res.setHeader('X-FINAL-STATUS', finalStatus);
        console.error('[REFERENCE][COMPARISON] 📤 Retornando:', {
          status: finalStatus,
          nextAction: comparisonResponse.nextAction,
          warnings: warnings.length
        });
        
        return res.json(comparisonResponse);
      }
      
      // ═════════════════════════════════════════════════════════════════
      // FALLBACK: Stage desconhecido
      // ═════════════════════════════════════════════════════════════════
      console.error('[REFERENCE] ⚠️ Stage desconhecido:', effectiveStage);
      
      const fallbackResponse = {
        ...fullResult,
        ...job,
        id: job.id,
        jobId: job.id,
        mode: 'reference',
        referenceStage: effectiveStage || 'unknown',
        status: finalStatus,
        warnings: ['unknown_stage'],
        debug: {
          effectiveMode,
          effectiveStage,
          file: 'work/api/jobs/[id].js',
          finalStatus
        }
      };
      
      res.setHeader('X-REF-STAGE', effectiveStage || 'unknown');
      return res.json(fallbackResponse);
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════════
    // 🔵 GENRE MODE: validação de suggestions (EXCLUSIVA DE GENRE)
    // ══════════════════════════════════════════════════════════════════
    // ⚠️ Este bloco SÓ roda para effectiveMode === 'genre'
    // Reference NUNCA chega aqui (early return acima)
    
    // 🛡️ GUARDA EXTRA: Se reference escapou, abortar agora
    if (effectiveMode === 'reference') {
      console.error('[REF-GUARD-V7] 🚨 ALERTA: Reference escapou do early return! Isso é um BUG.');
      return res.json({
        ...fullResult,
        ...job,
        id: job.id,
        jobId: job.id,
        mode: 'reference',
        status: fullResult?.status || job?.status || 'processing'
      });
    }
    
    // 🔒 VALIDAÇÃO GENRE: SOMENTE se NÃO for reference
    if (effectiveMode === 'genre' && !isReference && normalizedStatus === 'completed') {
      console.log('[API-JOBS][GENRE] 🔵 Genre Mode detectado com status COMPLETED');
      
      // 🎯 VALIDAÇÃO EXCLUSIVA PARA GENRE: Verificar se dados essenciais existem
      const hasSuggestions = Array.isArray(fullResult?.suggestions) && fullResult.suggestions.length > 0;
      const hasAiSuggestions = Array.isArray(fullResult?.aiSuggestions) && fullResult.aiSuggestions.length > 0;
      const hasTechnicalData = !!fullResult?.technicalData;
      
      console.log('[API-JOBS][GENRE][VALIDATION] hasSuggestions:', hasSuggestions);
      console.log('[API-JOBS][GENRE][VALIDATION] hasAiSuggestions:', hasAiSuggestions);
      console.log('[API-JOBS][GENRE][VALIDATION] hasTechnicalData:', hasTechnicalData);
      
      // 🔧 FALLBACK PARA GENRE: Se completed mas falta suggestions, pode indicar processamento incompleto
      // Esta lógica SÓ roda para genre puro - reference é bloqueado pelo !isReference acima
      if (!hasSuggestions || !hasAiSuggestions || !hasTechnicalData) {
        console.warn('[API-FIX][GENRE] ⚠️ Job marcado como "completed" mas falta dados essenciais');
        console.warn('[API-FIX][GENRE] Dados ausentes:', {
          suggestions: !hasSuggestions,
          aiSuggestions: !hasAiSuggestions,
          technicalData: !hasTechnicalData
        });
        console.warn('[API-FIX][GENRE] Retornando status "processing" para frontend aguardar comparacao completa');
        
        // Override status para processing SOMENTE para genre
        normalizedStatus = 'processing';
      } else {
        console.log('[API-JOBS][GENRE] ✅ Todos os dados essenciais presentes - status COMPLETED mantido');
      }
    } else {
      console.log('[API-JOBS][VALIDATION] ⚠️ Mode não é genre - pulando validação de suggestions');
    }
    
    // 🚀 FORMATO DE RETORNO BASEADO NO STATUS
    let response;

    if (normalizedStatus === "queued") {
      // Status queued: retorno mínimo
      response = {
        ok: true,
        job: {
          id: job.id,
          status: "queued",
          file_key: job.file_key,
          mode: job.mode,
          created_at: job.created_at
        }
      };
      console.log('[API-JOBS] 📦 Retornando job QUEUED (mínimo)');
      
    } else if (normalizedStatus === "processing") {
      // Status processing: retorno mínimo + progresso se disponível
      response = {
        ok: true,
        job: {
          id: job.id,
          status: "processing",
          file_key: job.file_key,
          mode: job.mode,
          created_at: job.created_at,
          updated_at: job.updated_at
        }
      };
      console.log('[API-JOBS] ⚙️ Retornando job PROCESSING');
      
    } else if (normalizedStatus === "completed") {
      // Status completed: retorno COMPLETO com results (APENAS GENRE)
      response = {
        ok: true,
        job: {
          id: job.id,
          status: "completed",
          file_key: job.file_key,
          mode: job.mode,
          created_at: job.created_at,
          updated_at: job.updated_at,
          completed_at: job.completed_at,
          results: fullResult,
          error: null
        }
      };
      console.log('[API-JOBS] ✅ Retornando job COMPLETED com results');
      
      // ═══════════════════════════════════════════════════════════════
      // ✅ AUDITORIA CRÍTICA: Verificar analysis.data (genreTargets + metrics)
      // ═══════════════════════════════════════════════════════════════
      if (fullResult?.data) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ [DATA OK] Postgres → Frontend');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📊 analysis.data.genreTargets:', !!fullResult.data.genreTargets);
        console.log('📊 analysis.data.metrics:', !!fullResult.data.metrics);
        
        if (fullResult.data.genreTargets) {
          console.log('📊 GenreTargets Keys:', Object.keys(fullResult.data.genreTargets));
          console.log('📊 GenreTargets Sample:', {
            lufs: fullResult.data.genreTargets.lufs,
            truePeak: fullResult.data.genreTargets.truePeak,
            dr: fullResult.data.genreTargets.dr,
            stereo: fullResult.data.genreTargets.stereo
          });
        }
        
        if (fullResult.data.metrics) {
          console.log('📊 Metrics Keys:', Object.keys(fullResult.data.metrics));
          console.log('📊 Metrics Sample:', {
            loudness: fullResult.data.metrics.loudness,
            truePeak: fullResult.data.metrics.truePeak,
            dr: fullResult.data.metrics.dr,
            stereo: fullResult.data.metrics.stereo
          });
        }
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
      } else {
        console.error('');
        console.error('❌❌❌ [DATA MISSING] analysis.data NÃO ENCONTRADO');
        console.error('');
      }
      // ═══════════════════════════════════════════════════════════════
      
      if (fullResult) {
        console.log('[API-JOBS] 📊 Metrics:', {
          lufs: fullResult.technicalData?.lufsIntegrated,
          peak: fullResult.technicalData?.truePeakDbtp,
          score: fullResult.score,
          aiSuggestions: fullResult.aiSuggestions?.length || 0
        });
      }
      
      console.log('[GENRE-FLOW][S5_FRONTEND_OUTPUT]', {
        jobId: job?.id,
        hasSuggestions: !!job?.results?.suggestions,
        hasAiSuggestions: !!job?.results?.aiSuggestions,
        firstBaseSuggestion: job?.results?.suggestions?.[0] || null,
        firstAiSuggestion: job?.results?.aiSuggestions?.[0] || null
      });
      
      // ────────────────────────────────────────
      // STEP 4 — LOGAR NO BACKEND/API ANTES DE ENVIAR PARA O FRONTEND
      // ────────────────────────────────────────
      console.log("[TRACE_S4_FRONTEND_OUTPUT]", {
        suggestionsFromDb: job.results?.suggestions,
        firstSuggestion: job?.results?.suggestions?.[0],
        finalTarget: job?.results?.suggestions?.[0]?.targetValue,
        finalCurrent: job?.results?.suggestions?.[0]?.currentValue,
        finalDelta: job?.results?.suggestions?.[0]?.delta,
        finalDeltaNum: job?.results?.suggestions?.[0]?.deltaNum
      });
      
    } else if (normalizedStatus === "error") {
      // Status error: retorno com erro
      response = {
        ok: false,
        job: {
          id: job.id,
          status: "error",
          file_key: job.file_key,
          mode: job.mode,
          created_at: job.created_at,
          updated_at: job.updated_at,
          error: job.error || "Erro desconhecido"
        }
      };
      console.log('[API-JOBS] ❌ Retornando job ERROR');
    }

    console.log('[API-JOBS] 📤 Response final:', {
      ok: response.ok,
      status: response.job.status,
      hasResults: !!response.job.results
    });
    
    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ Erro ao buscar job:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar job",
      detail: err.message,
    });
  }
});

export default router;
