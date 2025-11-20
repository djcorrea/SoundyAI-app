// api/jobs/[id].js
import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

// ðŸ”‘ ConexÃ£o com Postgres (Railway usa DATABASE_URL)
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
      return res.status(404).json({ error: "Job nÃ£o encontrado" });
    }

    const job = rows[0];

    // ðŸ”‘ Normalizar status para o frontend entender
    let normalizedStatus = job.status;
    if (normalizedStatus === "done") normalizedStatus = "completed";
    if (normalizedStatus === "failed") normalizedStatus = "error";

    // ðŸ›¡ï¸ FIX: Se job ainda estÃ¡ em processing, retornar APENAS status
    // Previne frontend receber JSON incompleto antes do worker terminar
    if (normalizedStatus === "processing" || normalizedStatus === "queued") {
      console.log(`[API-FIX] ðŸ”’ Job ${job.id} em status '${normalizedStatus}' - retornando apenas status`);
      console.log(`[API-FIX] â„¹ï¸ JSON completo serÃ¡ retornado quando status = 'completed'`);
      
      return res.json({
        id: job.id,
        status: normalizedStatus,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    }

    // ðŸŽ¯ CORREÃ‡ÃƒO CRÃTICA: Retornar JSON completo da anÃ¡lise
    // ðŸ”„ COMPATIBILIDADE: Tentar tanto 'results' (novo) quanto 'result' (antigo)
    let fullResult = null;
    
    const resultData = job.results || job.result;
    if (resultData) {
      try {
        // âœ… PROBLEMA 1 CORRIGIDO: Parse robusto
        if (typeof resultData === 'object' && resultData !== null) {
          // JÃ¡ Ã© objeto - usar diretamente
          fullResult = resultData;
          console.log("[REDIS-RETURN] ðŸ” Job result jÃ¡ Ã© objeto (JSONB nativo)");
        } else if (typeof resultData === 'string') {
          // Ã‰ string - parsear
          fullResult = JSON.parse(resultData);
          console.log("[REDIS-RETURN] ðŸ” Job result parseado de string");
        } else {
          console.warn("[REDIS-RETURN] âš ï¸ resultData em formato desconhecido:", typeof resultData);
        }
        
        if (fullResult) {
          console.log("[REDIS-RETURN] âœ… Job result merged with full analysis JSON");
          console.log(`[REDIS-RETURN] Analysis contains: ${Object.keys(fullResult).join(', ')}`);
          console.log(`[REDIS-RETURN] Data source: ${job.results ? 'results (new)' : 'result (legacy)'}`);
        }
      } catch (parseError) {
        console.error("[REDIS-RETURN] âŒ Erro ao fazer parse do results JSON:", parseError.message);
        console.error("[REDIS-RETURN] âš ï¸ Mantendo resultData original sem parse");
        // NÃƒO zerar fullResult - tentar usar o dado original
        fullResult = resultData;
      }
    }

    // ï¿½ï¸ FIX: ValidaÃ§Ã£o adicional - Se status Ã© completed mas sem dados essenciais, 
    // retornar como processing para evitar mostrar interface vazia
    if (normalizedStatus === "completed") {
      const hasTechnicalData = fullResult?.technicalData && typeof fullResult.technicalData === 'object';
      
      // Detectar se Ã© primeiro ou segundo job
      const referenceJobId = fullResult?.referenceJobId || job.reference_job_id;
      const isSecondJob = job.mode === 'reference' && referenceJobId;
      
      // Validar technicalData sempre (obrigatÃ³rio para ambos os jobs)
      if (!hasTechnicalData) {
        console.warn(`[API-FIX] Job ${job.id} marcado como 'completed' mas falta technicalData`);
        console.warn(`[API-FIX] Retornando status 'processing' para frontend aguardar dados completos`);
        
        return res.json({
          id: job.id,
          status: "processing",
          createdAt: job.created_at,
          updatedAt: job.updated_at
        });
      }
      
      // Validar suggestions/aiSuggestions SOMENTE no segundo job
      if (isSecondJob) {
        const hasSuggestions = fullResult?.suggestions && 
                              Array.isArray(fullResult.suggestions) && 
                              fullResult.suggestions.length > 0;
        
        if (!hasSuggestions) {
          console.warn(`[API-FIX] Job ${job.id} (SEGUNDO JOB) marcado como 'completed' mas falta suggestions`);
          console.warn(`[API-FIX] Mode: ${job.mode}, referenceJobId: ${referenceJobId}`);
          console.warn(`[API-FIX] Retornando status 'processing' para frontend aguardar comparacao completa`);
          
          return res.json({
            id: job.id,
            status: "processing",
            createdAt: job.created_at,
            updatedAt: job.updated_at
          });
        }
      } else {
        // Primeiro job: suggestions vazias sao normais
        console.log(`[API-FIX] Job ${job.id} (PRIMEIRO JOB) - suggestions vazias sao validas`);
        console.log(`[API-FIX] Mode: ${job.mode}, referenceJobId: ${referenceJobId || 'null'}`);
      }
    }

    // ðŸ”¥ðŸš€ RESULTADO FINAL: Merge EXPLÃCITO (nÃ£o usar spread operator)
    // âœ… PROBLEMA 3 CORRIGIDO: Merge explÃ­cito campo a campo
    // âœ… PROBLEMA 4 CORRIGIDO: Sempre retornar status real do banco
    const response = {
      id: job.id,
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus,
      error: job.error || null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      
      // âœ… MERGE EXPLÃCITO: Todos os campos individuais
      technicalData: fullResult?.technicalData ?? null,
      aiSuggestions: Array.isArray(fullResult?.aiSuggestions) ? fullResult.aiSuggestions : [],
      suggestions: Array.isArray(fullResult?.suggestions) ? fullResult.suggestions : [],
      spectralBands: fullResult?.spectralBands ?? null,
      genreBands: fullResult?.genreBands ?? null,
      diagnostics: fullResult?.diagnostics ?? null,
      score: fullResult?.score ?? null,
      classification: fullResult?.classification ?? null,
      performance: fullResult?.performance ?? null,
      metadata: fullResult?.metadata ?? null,
      
      // Campos de loudness
      loudness: fullResult?.loudness ?? null,
      truePeak: fullResult?.truePeak ?? null,
      stereo: fullResult?.stereo ?? null,
      dynamics: fullResult?.dynamics ?? null,
      spectral: fullResult?.spectral ?? null,
      
      // Campos de referÃªncia (modo A/B)
      referenceComparison: fullResult?.referenceComparison ?? null,
      referenceJobId: fullResult?.referenceJobId ?? null,
      referenceFileName: fullResult?.referenceFileName ?? null,
      
      // Campos auxiliares
      _worker: fullResult?._worker ?? null,
      scores: fullResult?.scores ?? null,
      scoring: fullResult?.scoring ?? null,
      metrics: fullResult?.metrics ?? null
    };

    // âœ… LOGS DE AUDITORIA DE RETORNO
    console.log(`[AI-AUDIT][ULTRA_DIAG] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ“¤ RETORNANDO JOB PARA FRONTEND`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ†” Job ID: ${job.id}`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ“Š Status: ${normalizedStatus}`);
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸŽµ Mode: ${job.mode}`);
    
    // FIX: Logs especÃ­ficos de validaÃ§Ã£o
    console.log(`[API-FIX][VALIDATION] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    console.log(`[API-FIX][VALIDATION] Status no DB: ${job.status}`);
    console.log(`[API-FIX][VALIDATION] Status normalizado: ${normalizedStatus}`);
    console.log(`[API-FIX][VALIDATION] Tem fullResult? ${!!fullResult}`);
    if (fullResult) {
      console.log(`[API-FIX][VALIDATION] suggestions: ${fullResult.suggestions?.length || 0} itens`);
      console.log(`[API-FIX][VALIDATION] aiSuggestions: ${fullResult.aiSuggestions?.length || 0} itens`);
      console.log(`[API-FIX][VALIDATION] technicalData: ${!!fullResult.technicalData}`);
      console.log(`[API-FIX][VALIDATION] score: ${fullResult.score || 'null'}`);
    }
    console.log(`[API-FIX][VALIDATION] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    
    // ðŸ” LOG CRÃTICO: Verificar campos presentes no response ANTES do envio
    console.log(`[AI-AUDIT][API-RESPONSE] ðŸ” Campos no objeto response:`, Object.keys(response));
    console.log(`[AI-AUDIT][API-RESPONSE] âœ… aiSuggestions incluÃ­do no response:`, {
      presente: 'aiSuggestions' in response,
      isArray: Array.isArray(response.aiSuggestions),
      length: response.aiSuggestions?.length || 0
    });
    console.log(`[AI-AUDIT][API-RESPONSE] âœ… suggestions incluÃ­do no response:`, {
      presente: 'suggestions' in response,
      isArray: Array.isArray(response.suggestions),
      length: response.suggestions?.length || 0
    });
    
    // ðŸ” VERIFICAÃ‡ÃƒO: SugestÃµes base
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ’¡ SugestÃµes base:`, {
      presente: Array.isArray(fullResult?.suggestions),
      quantidade: fullResult?.suggestions?.length || 0,
      sample: fullResult?.suggestions?.[0] ? {
        type: fullResult.suggestions[0].type,
        category: fullResult.suggestions[0].category,
        priority: fullResult.suggestions[0].priority
      } : null
    });
    
    // ðŸ” VERIFICAÃ‡ÃƒO: SugestÃµes enriquecidas com IA
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ¤– aiSuggestions (IA enriquecida):`, {
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
    
    // ðŸ” VERIFICAÃ‡ÃƒO: ComparaÃ§Ã£o A/B (modo reference)
    console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ”„ ComparaÃ§Ã£o A/B:`, {
      presente: !!fullResult?.referenceComparison,
      referenceJobId: fullResult?.referenceJobId || null,
      referenceFileName: fullResult?.referenceFileName || null
    });
    
    console.log(`[AI-AUDIT][ULTRA_DIAG] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);

    if (fullResult?.suggestions) {
      console.log(`[AI-AUDIT][API.out] âœ… Suggestions sendo enviadas para frontend:`, fullResult.suggestions.length);
      console.log(`[AI-AUDIT][API.out] Sample:`, fullResult.suggestions[0]);
      
      // Log adicional para modo reference
      if (fullResult?.referenceComparison) {
        console.log(`[AI-AUDIT][API.out] âœ… Modo reference - comparaÃ§Ã£o A/B incluÃ­da`);
        console.log(`[AI-AUDIT][API.out] Reference file:`, fullResult.referenceFileName);
      }
    } else {
      console.error(`[AI-AUDIT][ULTRA_DIAG] âŒ CRÃTICO: Nenhuma suggestion no JSON retornado!`);
      console.error(`[AI-AUDIT][ULTRA_DIAG] âŒ Isso indica que o pipeline falhou em gerar sugestÃµes base`);
    }
    
    // ðŸ”® LOG DE AUDITORIA: aiSuggestions (ULTRA V2)
    if (fullResult?.aiSuggestions && fullResult.aiSuggestions.length > 0) {
      console.log(`[AI-AUDIT][ULTRA_DIAG] ðŸ”„ aiSuggestions presentes no merge Redis/Postgres: true`);
      console.log(`[AI-AUDIT][API.out] âœ… aiSuggestions (IA enriquecida) sendo enviadas:`, fullResult.aiSuggestions.length);
    } else {
      console.warn(`[AI-AUDIT][ULTRA_DIAG] ðŸ”„ aiSuggestions presentes no merge Redis/Postgres: false`);
      console.warn(`[AI-AUDIT][API.out] âš ï¸ aiSuggestions ausente - IA pode nÃ£o ter sido executada ou falhou`);
      console.warn(`[AI-AUDIT][API.out] âš ï¸ Verifique logs do pipeline para detalhes do erro`);
    }

    console.log(`[REDIS-RETURN] ðŸ“Š Returning job ${job.id} with status '${normalizedStatus}'`);
    if (fullResult) {
      console.log(`[REDIS-RETURN] âœ… Full analysis included: LUFS=${fullResult.technicalData?.lufsIntegrated}, Peak=${fullResult.technicalData?.truePeakDbtp}, Score=${fullResult.score}`);
    }

    // ðŸ”® LOG FINAL ANTES DO ENVIO
    console.log(`[API-AUDIT][FINAL] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    console.log(`[API-AUDIT][FINAL] ðŸ“¤ ENVIANDO RESPONSE PARA FRONTEND`);
    console.log(`[API-AUDIT][FINAL] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);
    console.log(`[API-AUDIT][FINAL] âœ… aiSuggestions length:`, response.aiSuggestions?.length || 0);
    console.log(`[API-AUDIT][FINAL] âœ… suggestions length:`, response.suggestions?.length || 0);
    console.log(`[API-AUDIT][FINAL] âœ… referenceComparison presente:`, !!response.referenceComparison);
    
    if (response.aiSuggestions && response.aiSuggestions.length > 0) {
      console.log(`[API-AUDIT][FINAL] ðŸŒŸðŸŒŸðŸŒŸ aiSuggestions INCLUÃDAS NA RESPOSTA! ðŸŒŸðŸŒŸðŸŒŸ`);
      console.log(`[API-AUDIT][FINAL] Sample da primeira aiSuggestion:`, {
        aiEnhanced: response.aiSuggestions[0]?.aiEnhanced,
        categoria: response.aiSuggestions[0]?.categoria,
        nivel: response.aiSuggestions[0]?.nivel,
        hasProblema: !!response.aiSuggestions[0]?.problema,
        hasSolucao: !!response.aiSuggestions[0]?.solucao
      });
    } else {
      console.warn(`[API-AUDIT][FINAL] âš ï¸âš ï¸âš ï¸ aiSuggestions VAZIO OU AUSENTE! âš ï¸âš ï¸âš ï¸`);
      console.warn(`[API-AUDIT][FINAL] âš ï¸ Frontend receberÃ¡ array vazio e nÃ£o exibirÃ¡ IA`);
    }
    console.log(`[API-AUDIT][FINAL] â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`);

    return res.json(response);
  } catch (err) {
    console.error("âŒ Erro ao buscar job:", err);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
