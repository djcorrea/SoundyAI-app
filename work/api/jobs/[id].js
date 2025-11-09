// api/jobs/[id].js
import express from "express";
import pool from "../../db.js";

const router = express.Router();

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
    
    // 🛡️ ETAPA 1: Delay seguro para evitar retorno prematuro
    // Evita enviar aiSuggestions: [] antes do enriquecimento terminar
    if (normalizedStatus === "processing") {
      const elapsed = Date.now() - new Date(job.created_at).getTime();
      const resultData = job.results || job.result;
      let hasAISuggestions = false;
      
      try {
        const parsed = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
        hasAISuggestions = Array.isArray(parsed?.aiSuggestions) && parsed.aiSuggestions.length > 0;
      } catch (e) {
        // Ignorar erro de parse
      }
      
      if (!hasAISuggestions && elapsed < 5000) {
        console.log('[AI-BACKEND] ⏳ Aguardando IA enriquecer antes do retorno...');
        console.log('[AI-BACKEND] Elapsed:', elapsed, 'ms / 5000 ms');
        return res.status(202).json({ 
          status: 'processing', 
          message: 'AI enrichment pending',
          id: job.id
        });
      }
    }

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
      ...(fullResult || {})
    };

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
