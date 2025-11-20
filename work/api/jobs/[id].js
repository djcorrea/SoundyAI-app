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
        // 🔧 PATCH 1: Parse forçado com validação completa
        if (typeof resultData === 'string') {
          fullResult = JSON.parse(resultData);
        } else if (typeof resultData === 'object' && resultData !== null) {
          fullResult = resultData;
        } else {
          console.error("[REDIS-RETURN] ❌ result não é string nem objeto:", typeof resultData);
          fullResult = null;
        }
        
        // Validação crítica
        if (!fullResult || typeof fullResult !== 'object') {
          console.error("[REDIS-RETURN] ❌ Parse falhou, fullResult inválido");
          fullResult = null;
        } else {
          console.log("[REDIS-RETURN] ✅ Parse bem-sucedido:", Object.keys(fullResult).length, "campos");
          console.log(`[REDIS-RETURN] Analysis contains: ${Object.keys(fullResult).join(', ')}`);
          console.log(`[REDIS-RETURN] Data source: ${job.results ? 'results (new)' : 'result (legacy)'}`);
        }
      } catch (parseError) {
        console.error("[REDIS-RETURN] ❌ Erro ao fazer parse do results JSON:", parseError);
        fullResult = null;
      }
    }

    // 🚀 RESULTADO FINAL: Mesclar dados do job com análise completa
    // 🔧 PATCH 2: Merge explícito de TODOS os campos (mais robusto que spread)
    const response = {
      // Campos do banco (sempre presentes)
      id: job.id,
      jobId: job.id, // Alias para compatibilidade
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus,
      error: job.error || null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      
      // 🔥 CRÍTICO: Campos da análise (explícitos com fallback)
      technicalData: fullResult?.technicalData || null,
      aiSuggestions: fullResult?.aiSuggestions || [],
      suggestions: fullResult?.suggestions || [],
      spectralBands: fullResult?.spectralBands || null,
      genreBands: fullResult?.genreBands || null,
      diagnostics: fullResult?.diagnostics || null,
      enhancedMetrics: fullResult?.enhancedMetrics || null,
      score: fullResult?.score || 0,
      performance: fullResult?.performance || null,
      
      // Campos de modo reference
      referenceComparison: fullResult?.referenceComparison || null,
      referenceJobId: fullResult?.referenceJobId || null,
      referenceFileName: fullResult?.referenceFileName || null,
      
      // Metadados do worker
      _worker: fullResult?._worker || null
    };
    
    // Log de auditoria do merge
    console.log("[API-MERGE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[API-MERGE] 🔍 MERGE COMPLETO - Campos incluídos:");
    console.log("[API-MERGE] technicalData:", !!response.technicalData);
    console.log("[API-MERGE] aiSuggestions:", response.aiSuggestions?.length || 0);
    console.log("[API-MERGE] suggestions:", response.suggestions?.length || 0);
    console.log("[API-MERGE] spectralBands:", !!response.spectralBands);
    console.log("[API-MERGE] score:", response.score);
    console.log("[API-MERGE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 🔧 PATCH 3: Validação APENAS se fullResult for completamente null
    // (Removido: validação prematura de technicalData que derubava status)
    if (normalizedStatus === "completed" && !fullResult) {
      console.warn(`[API-FIX] Job ${job.id} marcado 'completed' mas result está null`);
      console.warn(`[API-FIX] Retornando status 'processing' para aguardar worker`);
      
      return res.json({
        id: job.id,
        status: "processing",
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    }
    
    // --- ETAPA 1: AUDITORIA DO MERGE ---
    console.log('[AI-MERGE][AUDIT] Verificando merge Redis/Postgres para aiSuggestions...');
    console.log('[AI-MERGE][AUDIT] Status atual:', {
      technicalData: !!response.technicalData,
      aiSuggestions: response.aiSuggestions?.length || 0,
      suggestions: response.suggestions?.length || 0,
      status: response.status,
      mode: response.mode
    });

    // --- ETAPA 2: RECUPERAÇÃO DO POSTGRES SE NECESSÁRIO ---
    if (!response.aiSuggestions || response.aiSuggestions.length === 0) {
      console.log('[AI-MERGE][AUDIT] ⚠️ aiSuggestions ausente no Redis, tentando recuperar do Postgres...');

      try {
        const { rows: pgRows } = await pool.query(
          `SELECT results, result, status
           FROM jobs
           WHERE id = $1
           LIMIT 1`,
          [job.id]
        );

        if (pgRows.length > 0) {
          const dbJob = pgRows[0];
          let dbFullResult = null;

          // Parse do resultado do Postgres
          const dbResultData = dbJob.results || dbJob.result;
          if (dbResultData) {
            try {
              dbFullResult = typeof dbResultData === 'string' ? JSON.parse(dbResultData) : dbResultData;
            } catch (e) {
              console.error('[AI-MERGE][AUDIT] ❌ Erro ao fazer parse do resultado do Postgres:', e);
            }
          }

          // 🔧 PATCH 4: Restaurar TODOS os campos do Postgres (não só aiSuggestions)
          if (dbFullResult && typeof dbFullResult === 'object') {
            console.log('[AI-MERGE][FIX] 🔄 Restaurando TODOS os campos do Postgres...');
            
            // Restaurar cada campo individualmente (mais seguro que spread)
            if (Array.isArray(dbFullResult.aiSuggestions) && dbFullResult.aiSuggestions.length > 0) {
              response.aiSuggestions = dbFullResult.aiSuggestions;
              console.log(`[AI-MERGE][FIX] ✅ Restaurado ${dbFullResult.aiSuggestions.length} aiSuggestions`);
              
              if (dbFullResult.aiSuggestions[0]) {
                console.log('[AI-MERGE][FIX] Sample:', {
                  problema: dbFullResult.aiSuggestions[0].problema?.substring(0, 50),
                  aiEnhanced: dbFullResult.aiSuggestions[0].aiEnhanced
                });
              }
            }
            
            if (Array.isArray(dbFullResult.suggestions) && dbFullResult.suggestions.length > 0) {
              response.suggestions = dbFullResult.suggestions;
              console.log(`[AI-MERGE][FIX] ✅ Restaurado ${dbFullResult.suggestions.length} suggestions`);
            }
            
            // 🔥 CRÍTICO: Restaurar technicalData (antes não era restaurado!)
            if (dbFullResult.technicalData && typeof dbFullResult.technicalData === 'object') {
              response.technicalData = dbFullResult.technicalData;
              console.log('[AI-MERGE][FIX] ✅ Restaurado technicalData');
            }
            
            // Restaurar outros campos importantes
            if (dbFullResult.spectralBands) {
              response.spectralBands = dbFullResult.spectralBands;
              console.log('[AI-MERGE][FIX] ✅ Restaurado spectralBands');
            }
            if (dbFullResult.genreBands) response.genreBands = dbFullResult.genreBands;
            if (dbFullResult.diagnostics) response.diagnostics = dbFullResult.diagnostics;
            if (dbFullResult.enhancedMetrics) response.enhancedMetrics = dbFullResult.enhancedMetrics;
            if (dbFullResult.score !== undefined) response.score = dbFullResult.score;
            if (dbFullResult.performance) response.performance = dbFullResult.performance;
            
            // Atualizar status se necessário
            if (dbJob.status === 'completed' || dbJob.status === 'done') {
              response.status = 'completed';
              console.log('[AI-MERGE][FIX] 🟢 Status atualizado para completed');
            }
          } else {
            console.warn('[AI-MERGE][AUDIT] ⚠️ dbFullResult inválido ou vazio');
          }
        } else {
          console.warn('[AI-MERGE][AUDIT] ❌ Nenhum registro correspondente encontrado no Postgres.');
        }
      } catch (err) {
        console.error('[AI-MERGE][FIX] ❌ Erro ao recuperar aiSuggestions do Postgres:', err);
      }
    } else {
      console.log('[AI-MERGE][AUDIT] ✅ aiSuggestions já presente no response inicial.');
    }

    // --- ETAPA 3: LOG FINAL DO RESULTADO ---
    console.log('[AI-MERGE][RESULT]', {
      aiSuggestions: response.aiSuggestions?.length || 0,
      suggestions: response.suggestions?.length || 0,
      status: response.status,
      mode: response.mode,
      hasAIEnhanced: response.aiSuggestions?.some(s => s.aiEnhanced) || false
    });

    console.log(`[REDIS-RETURN] 📊 Returning job ${job.id} with status '${normalizedStatus}'`);
    if (fullResult || response.aiSuggestions) {
      console.log(`[REDIS-RETURN] ✅ Full analysis included: LUFS=${response.technicalData?.lufsIntegrated}, Peak=${response.technicalData?.truePeakDbtp}, Score=${response.score}`);
      console.log(`[API-AUDIT][FINAL] ✅ aiSuggestions length: ${response.aiSuggestions?.length || 0}`);
    }

    // --- ETAPA 4: RETORNAR OBJETO COMPLETO ---
    
    // ✅ Correção de status para "completed" quando aiSuggestions já existem
    if (
      response?.aiSuggestions &&
      Array.isArray(response.aiSuggestions) &&
      response.aiSuggestions.length > 0 &&
      (response.status === 'processing' || !response.status)
    ) {
      console.log('[API-JOBS][STATUS-FIX] ✅ Detected aiSuggestions. Updating status -> "completed"');
      response.status = 'completed';
    }
    
    return res.json(response);
  } catch (err) {
    console.error("❌ Erro ao buscar job:", err);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
