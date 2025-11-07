// api/jobs/[id].js
import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

// 🔑 Conexão com Postgres (Railway usa DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});

// rota GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, file_key, mode, status, error, results, result,
              created_at, updated_at, completed_at
         FROM jobs
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Job não encontrado" });
    }

    const job = rows[0];

    // 🔑 Normalizar status para o frontend entender
    let normalizedStatus = job.status;
    if (normalizedStatus === "done") normalizedStatus = "completed";
    if (normalizedStatus === "failed") normalizedStatus = "error";

    // 🎯 CORREÇÃO CRÍTICA: Retornar JSON completo da análise
    // 🔄 COMPATIBILIDADE: Tentar tanto 'results' (novo) quanto 'result' (antigo)
    let fullResult = null;
    
    const resultData = job.results || job.result;
    if (resultData) {
      try {
        // Parse do JSON salvo pelo worker
        fullResult = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
        console.log("[REDIS-RETURN] 🔍 Job result merged with full analysis JSON");
        console.log(`[REDIS-RETURN] Analysis contains: ${Object.keys(fullResult).join(', ')}`);
        console.log(`[REDIS-RETURN] Data source: ${job.results ? 'results (new)' : 'result (legacy)'}`);
      } catch (parseError) {
        console.error("[REDIS-RETURN] ❌ Erro ao fazer parse do results JSON:", parseError);
        fullResult = resultData;
      }
    }

    // 🚀 RESULTADO FINAL: Mesclar dados do job com análise completa
    const response = {
      id: job.id,
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus,
      error: job.error || null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      // ✅ CRÍTICO: Incluir análise completa se disponível
      ...(fullResult || {}),
      // ✅ MODO REFERENCE: Adicionar campos de comparação A/B
      referenceComparison: fullResult?.referenceComparison || null,
      referenceJobId: fullResult?.referenceJobId || null,
      referenceFileName: fullResult?.referenceFileName || null
    };

    // ✅ LOGS DE AUDITORIA DE RETORNO
    console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] 📤 RETORNANDO JOB PARA FRONTEND`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] 🆔 Job ID: ${job.id}`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] 📊 Status: ${normalizedStatus}`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] 🎵 Mode: ${job.mode}`);
    
    // 🔍 VERIFICAÇÃO: Sugestões base
    console.log(`[AI-AUDIT][ULTRA_DIAG] 💡 Sugestões base:`, {
      presente: Array.isArray(fullResult?.suggestions),
      quantidade: fullResult?.suggestions?.length || 0,
      sample: fullResult?.suggestions?.[0] ? {
        type: fullResult.suggestions[0].type,
        category: fullResult.suggestions[0].category,
        priority: fullResult.suggestions[0].priority
      } : null
    });
    
    // 🔍 VERIFICAÇÃO: Sugestões enriquecidas com IA
    console.log(`[AI-AUDIT][ULTRA_DIAG] 🤖 aiSuggestions (IA enriquecida):`, {
      presente: Array.isArray(fullResult?.aiSuggestions),
      quantidade: fullResult?.aiSuggestions?.length || 0,
      sample: fullResult?.aiSuggestions?.[0] ? {
        aiEnhanced: fullResult.aiSuggestions[0].aiEnhanced,
        enrichmentStatus: fullResult.aiSuggestions[0].enrichmentStatus,
        categoria: fullResult.aiSuggestions[0].categoria,
        nivel: fullResult.aiSuggestions[0].nivel,
        hasProblema: !!fullResult.aiSuggestions[0].problema,
        hasCausaProvavel: !!fullResult.aiSuggestions[0].causaProvavel,
        hasSolucao: !!fullResult.aiSuggestions[0].solucao,
        hasPluginRecomendado: !!fullResult.aiSuggestions[0].pluginRecomendado
      } : null
    });
    
    // 🔍 VERIFICAÇÃO: Comparação A/B (modo reference)
    console.log(`[AI-AUDIT][ULTRA_DIAG] 🔄 Comparação A/B:`, {
      presente: !!fullResult?.referenceComparison,
      referenceJobId: fullResult?.referenceJobId || null,
      referenceFileName: fullResult?.referenceFileName || null
    });
    
    console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (fullResult?.suggestions) {
      console.log(`[AI-AUDIT][API.out] ✅ Suggestions sendo enviadas para frontend:`, fullResult.suggestions.length);
      console.log(`[AI-AUDIT][API.out] Sample:`, fullResult.suggestions[0]);
      
      // Log adicional para modo reference
      if (fullResult?.referenceComparison) {
        console.log(`[AI-AUDIT][API.out] ✅ Modo reference - comparação A/B incluída`);
        console.log(`[AI-AUDIT][API.out] Reference file:`, fullResult.referenceFileName);
      }
    } else {
      console.error(`[AI-AUDIT][ULTRA_DIAG] ❌ CRÍTICO: Nenhuma suggestion no JSON retornado!`);
      console.error(`[AI-AUDIT][ULTRA_DIAG] ❌ Isso indica que o pipeline falhou em gerar sugestões base`);
    }
    
    // 🔮 LOG DE AUDITORIA: aiSuggestions (ULTRA V2)
    if (fullResult?.aiSuggestions && fullResult.aiSuggestions.length > 0) {
      console.log(`[AI-AUDIT][ULTRA_DIAG] 🔄 aiSuggestions presentes no merge Redis/Postgres: true`);
      console.log(`[AI-AUDIT][API.out] ✅ aiSuggestions (IA enriquecida) sendo enviadas:`, fullResult.aiSuggestions.length);
    } else {
      console.warn(`[AI-AUDIT][ULTRA_DIAG] 🔄 aiSuggestions presentes no merge Redis/Postgres: false`);
      console.warn(`[AI-AUDIT][API.out] ⚠️ aiSuggestions ausente - IA pode não ter sido executada ou falhou`);
      console.warn(`[AI-AUDIT][API.out] ⚠️ Verifique logs do pipeline para detalhes do erro`);
    }

    console.log(`[REDIS-RETURN] 📊 Returning job ${job.id} with status '${normalizedStatus}'`);
    if (fullResult) {
      console.log(`[REDIS-RETURN] ✅ Full analysis included: LUFS=${fullResult.technicalData?.lufsIntegrated}, Peak=${fullResult.technicalData?.truePeakDbtp}, Score=${fullResult.score}`);
    }

    return res.json(response);
  } catch (err) {
    console.error("❌ Erro ao buscar job:", err);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
