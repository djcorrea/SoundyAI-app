// api/jobs/[id].js
import express from "express";
import pool from "../../db.js";

const router = express.Router();

// rota GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, file_key, mode, status, error, results, result, data,
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

    // 🔥 PARSE do campo data (se vier como JSON string)
    let parsedData = null;
    if (job.data) {
      try {
        parsedData = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
      } catch (e) {
        console.error('[API-JOBS] ⚠️ Erro ao fazer parse de job.data:', e);
        parsedData = job.data;
      }
    }

    // 🚀 RESULTADO FINAL: Mesclar dados do job com análise completa
    const response = {
      id: job.id,
      jobId: job.id, // Alias para compatibilidade
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus,
      error: job.error || null,
      data: parsedData,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      // ✅ CRÍTICO: Incluir análise completa se disponível
      ...(fullResult || {})
    };

    // 🔒 GARANTIA: Sobrescrever campos obrigatórios do banco se presentes
    if (fullResult) {
      response.suggestions = fullResult.suggestions ?? [];
      response.aiSuggestions = fullResult.aiSuggestions ?? [];
      response.problemsAnalysis = fullResult.problemsAnalysis ?? {};
      response.diagnostics = fullResult.diagnostics ?? {};
      response.summary = fullResult.summary ?? {};
      response.suggestionMetadata = fullResult.suggestionMetadata ?? {};
    }

    // 🔥 PROTEÇÃO CRÍTICA: Restaurar campo 'data' do banco (não deixar fullResult sobrescrever)
    if (parsedData) {
      response.data = parsedData;
      console.log('[API-JOBS][DATA] ✅ Campo data incluído no response:', {
        hasData: !!parsedData,
        hasGenre: !!parsedData?.genre,
        hasGenreTargets: !!parsedData?.genreTargets,
        genre: parsedData?.genre
      });
    } else {
      console.log('[API-JOBS][DATA] ⚠️ Campo data está null/undefined no PostgreSQL');
    }

    // --- ETAPA 1: AUDITORIA DO MERGE ---
    console.log('[AI-MERGE][AUDIT] Verificando merge Redis/Postgres para aiSuggestions...');
    console.log('[AI-MERGE][AUDIT] Status atual:', {
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

          if (dbFullResult) {
            // ✅ Sobrescrever campos obrigatórios com valores do Postgres (sempre preferir banco)
            response.suggestions = dbFullResult.suggestions ?? [];
            response.aiSuggestions = dbFullResult.aiSuggestions ?? [];
            response.problemsAnalysis = dbFullResult.problemsAnalysis ?? {};
            
            console.log(`[AI-MERGE][FIX] ✅ Campos sincronizados do Postgres:`, {
              suggestions: response.suggestions.length,
              aiSuggestions: response.aiSuggestions.length,
              hasProblemAnalysis: !!response.problemsAnalysis
            });
            
            // Log da primeira sugestão para validação
            if (response.aiSuggestions.length > 0 && response.aiSuggestions[0]) {
              console.log('[AI-MERGE][FIX] Sample aiSuggestion:', {
                problema: response.aiSuggestions[0].problema?.substring(0, 50),
                aiEnhanced: response.aiSuggestions[0].aiEnhanced
              });
            }

            // Atualiza status para completed se IA foi encontrada
            if (dbJob.status === 'completed' || dbJob.status === 'done') {
              response.status = 'completed';
              console.log('[AI-MERGE][FIX] 🟢 Status atualizado para completed (IA detectada).');
            }
          } else {
            console.warn('[AI-MERGE][AUDIT] ⚠️ Resultado do Postgres vazio ou inválido.');
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
