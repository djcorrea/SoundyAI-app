// api/jobs/[id].js
import express from "express";
import pool from "../../db.js";

const router = express.Router();

// 🔧 Validação UUID (inline, sem dependência externa)
function isValidUuid(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
}

// rota GET /api/jobs/:id
router.get("/:id", async (req, res) => {
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
        fullResult = resultData;
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
      // Status completed: retorno COMPLETO com results
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
