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

/**
 * 🛠️ FUNÇÃO UTILITÁRIA: Extrai suggestions de múltiplos caminhos
 * Diferencia: MISSING (campo inexistente) vs EMPTY (array vazio válido)
 * 
 * @param {Object} fullResult - Resultado completo do job
 * @returns {Object} { suggestionsArray, exists, missing, length }
 */
function extractSuggestions(fullResult) {
  if (!fullResult) {
    return { suggestionsArray: [], exists: false, missing: true, length: 0 };
  }

  // Verificar múltiplos caminhos possíveis
  const rootSuggestions = fullResult.suggestions;
  const problemsSuggestions = fullResult.problemsAnalysis?.suggestions;
  
  // Determinar se campo existe (mesmo que vazio)
  const hasRootField = fullResult.hasOwnProperty('suggestions');
  const hasProblemsField = fullResult.problemsAnalysis?.hasOwnProperty('suggestions');
  
  // Campo existe se está em qualquer caminho
  const exists = hasRootField || hasProblemsField;
  
  // Campo está missing se não existe em nenhum caminho
  const missing = !exists;
  
  // Preferir root, depois problems
  let suggestionsArray = [];
  if (Array.isArray(rootSuggestions)) {
    suggestionsArray = rootSuggestions;
  } else if (Array.isArray(problemsSuggestions)) {
    suggestionsArray = problemsSuggestions;
  }
  
  return {
    suggestionsArray,
    exists,
    missing,
    length: suggestionsArray.length
  };
}

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

    // 🛡️ FIX: Se job ainda está em processing, retornar APENAS status
    // Previne frontend receber JSON incompleto antes do worker terminar
    if (normalizedStatus === "processing" || normalizedStatus === "queued") {
      console.log(`[API-FIX] 🔒 Job ${job.id} em status '${normalizedStatus}' - retornando apenas status`);
      console.log(`[API-FIX] ℹ️ JSON completo será retornado quando status = 'completed'`);
      
      return res.json({
        id: job.id,
        status: normalizedStatus,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
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

    // �️ FIX: Validação adicional - Se status é completed mas sem dados essenciais, 
    // retornar como processing para evitar mostrar interface vazia
    if (normalizedStatus === "completed") {
      const hasTechnicalData = fullResult?.technicalData && typeof fullResult.technicalData === 'object';
      
      // 🔍 DETECÇÃO DE MODO E ESTÁGIO REFERENCE
      const isReferenceMode = job.mode === 'reference';
      const referenceJobId = fullResult?.referenceJobId || job.reference_job_id;
      
      // ✅ CORREÇÃO: isSecondJob só é true se referenceJobId existe E é diferente do job.id
      const isSecondJob = isReferenceMode && referenceJobId && referenceJobId !== job.id;
      const isFirstJob = isReferenceMode && !isSecondJob;
      
      // Verificar se comparação está pronta (segundo job processado)
      const hasComparison = !!fullResult?.referenceComparison;
      
      // Extrair suggestions com função utilitária
      const suggestionsInfo = extractSuggestions(fullResult);
      
      // 📊 LOG DEBUG CONTROLADO: Apenas quando DB está completed
      console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[API-FIX][DEBUG] Job: ${job.id}`);
      console.log(`[API-FIX][DEBUG] mode: ${job.mode}`);
      console.log(`[API-FIX][DEBUG] isReferenceMode: ${isReferenceMode}`);
      console.log(`[API-FIX][DEBUG] isFirstJob: ${isFirstJob}`);
      console.log(`[API-FIX][DEBUG] isSecondJob: ${isSecondJob}`);
      console.log(`[API-FIX][DEBUG] hasComparison: ${hasComparison}`);
      console.log(`[API-FIX][DEBUG] suggestionsExists: ${suggestionsInfo.exists}`);
      console.log(`[API-FIX][DEBUG] suggestionsMissing: ${suggestionsInfo.missing}`);
      console.log(`[API-FIX][DEBUG] suggestionsLen: ${suggestionsInfo.length}`);
      console.log(`[API-FIX][DEBUG] hasTechnicalData: ${hasTechnicalData}`);
      
      // ✅ VALIDAÇÃO 1: technicalData sempre obrigatório
      if (!hasTechnicalData) {
        console.warn(`[API-FIX] ⚠️ Job ${job.id} falta technicalData - aguardando`);
        console.log(`[API-FIX][DEBUG] computedStatus: processing (falta technicalData)`);
        console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        return res.json({
          id: job.id,
          status: "processing",
          mode: job.mode,
          createdAt: job.created_at,
          updatedAt: job.updated_at
        });
      }
      
      // ✅ FLUXO REFERENCE: Lógica específica para análise de referência
      if (isReferenceMode) {
        // CASO 1: PRIMEIRO JOB (base/primeira música)
        // - Deve permitir upload da segunda música
        // - suggestions=[] é válido (faixa sem problemas)
        if (isFirstJob) {
          console.log(`[API-FIX] ✅ PRIMEIRO JOB (base) - suggestions=[] é válido`);
          console.log(`[API-FIX][DEBUG] computedStatus: completed + requiresSecondTrack`);
          console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Retornar estado que permite frontend abrir modal 2
          const firstJobResponse = {
            id: job.id,
            fileKey: job.file_key,
            mode: job.mode,
            status: "completed", // Mantém completed para compatibilidade
            requiresSecondTrack: true, // Sinaliza que precisa segunda faixa
            error: job.error || null,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            completedAt: job.completed_at,
            ...(fullResult || {}),
            suggestions: suggestionsInfo.suggestionsArray,
            aiSuggestions: fullResult?.aiSuggestions || [],
            referenceJobId: null // Primeiro job não tem referência
          };
          
          return res.json(firstJobResponse);
        }
        
        // CASO 2: SEGUNDO JOB (comparação)
        // - Comparação pronta = hasComparison true
        // - suggestions=[] ainda é válido (comparação sem problemas)
        if (isSecondJob) {
          // Se comparação está pronta, retornar completed independente de suggestions
          if (hasComparison) {
            console.log(`[API-FIX] ✅ SEGUNDO JOB - comparação pronta, suggestions=[] é válido`);
            console.log(`[API-FIX][DEBUG] computedStatus: completed`);
            console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            const secondJobResponse = {
              id: job.id,
              fileKey: job.file_key,
              mode: job.mode,
              status: "completed",
              requiresSecondTrack: false,
              error: job.error || null,
              createdAt: job.created_at,
              updatedAt: job.updated_at,
              completedAt: job.completed_at,
              ...(fullResult || {}),
              suggestions: suggestionsInfo.suggestionsArray,
              aiSuggestions: fullResult?.aiSuggestions || [],
              referenceComparison: fullResult?.referenceComparison,
              referenceJobId: fullResult?.referenceJobId,
              referenceFileName: fullResult?.referenceFileName
            };
            
            return res.json(secondJobResponse);
          } else {
            // Comparação ainda não está pronta, aguardar
            console.warn(`[API-FIX] ⚠️ SEGUNDO JOB - aguardando comparação`);
            console.log(`[API-FIX][DEBUG] computedStatus: processing (comparação não pronta)`);
            console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            return res.json({
              id: job.id,
              status: "processing",
              mode: job.mode,
              createdAt: job.created_at,
              updatedAt: job.updated_at
            });
          }
        }
      }
      
      // ✅ FLUXO NORMAL (genre/não-reference)
      // - Apenas diferenciar missing vs empty
      // - empty=[] é válido se campo existe
      if (!isReferenceMode) {
        // Se suggestions está realmente MISSING (não existe), aguardar
        if (suggestionsInfo.missing) {
          console.warn(`[API-FIX] ⚠️ Job ${job.id} (genre) - campo suggestions ausente`);
          console.log(`[API-FIX][DEBUG] computedStatus: processing (suggestions missing)`);
          console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          return res.json({
            id: job.id,
            status: "processing",
            mode: job.mode,
            createdAt: job.created_at,
            updatedAt: job.updated_at
          });
        }
        
        // Se campo existe (mesmo vazio), aceitar como completo
        console.log(`[API-FIX] ✅ Job ${job.id} (genre) - suggestions existe (len=${suggestionsInfo.length})`);
        console.log(`[API-FIX][DEBUG] computedStatus: completed`);
      }
      
      console.log(`[API-FIX][DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }

    // �🚀 RESULTADO FINAL: Mesclar dados do job com análise completa
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
      // ✅ GARANTIA EXPLÍCITA: aiSuggestions SEMPRE no objeto final
      aiSuggestions: fullResult?.aiSuggestions || [],
      suggestions: fullResult?.suggestions || [],
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
    
    // FIX: Logs específicos de validação
    console.log(`[API-FIX][VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[API-FIX][VALIDATION] Status no DB: ${job.status}`);
    console.log(`[API-FIX][VALIDATION] Status normalizado: ${normalizedStatus}`);
    console.log(`[API-FIX][VALIDATION] Tem fullResult? ${!!fullResult}`);
    if (fullResult) {
      console.log(`[API-FIX][VALIDATION] suggestions: ${fullResult.suggestions?.length || 0} itens`);
      console.log(`[API-FIX][VALIDATION] aiSuggestions: ${fullResult.aiSuggestions?.length || 0} itens`);
      console.log(`[API-FIX][VALIDATION] technicalData: ${!!fullResult.technicalData}`);
      console.log(`[API-FIX][VALIDATION] score: ${fullResult.score || 'null'}`);
    }
    console.log(`[API-FIX][VALIDATION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 🔍 LOG CRÍTICO: Verificar campos presentes no response ANTES do envio
    console.log(`[AI-AUDIT][API-RESPONSE] 🔍 Campos no objeto response:`, Object.keys(response));
    console.log(`[AI-AUDIT][API-RESPONSE] ✅ aiSuggestions incluído no response:`, {
      presente: 'aiSuggestions' in response,
      isArray: Array.isArray(response.aiSuggestions),
      length: response.aiSuggestions?.length || 0
    });
    console.log(`[AI-AUDIT][API-RESPONSE] ✅ suggestions incluído no response:`, {
      presente: 'suggestions' in response,
      isArray: Array.isArray(response.suggestions),
      length: response.suggestions?.length || 0
    });
    
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

    // 🔮 LOG FINAL ANTES DO ENVIO
    console.log(`[API-AUDIT][FINAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[API-AUDIT][FINAL] 📤 ENVIANDO RESPONSE PARA FRONTEND`);
    console.log(`[API-AUDIT][FINAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[API-AUDIT][FINAL] ✅ aiSuggestions length:`, response.aiSuggestions?.length || 0);
    console.log(`[API-AUDIT][FINAL] ✅ suggestions length:`, response.suggestions?.length || 0);
    console.log(`[API-AUDIT][FINAL] ✅ referenceComparison presente:`, !!response.referenceComparison);
    
    if (response.aiSuggestions && response.aiSuggestions.length > 0) {
      console.log(`[API-AUDIT][FINAL] 🌟🌟🌟 aiSuggestions INCLUÍDAS NA RESPOSTA! 🌟🌟🌟`);
      console.log(`[API-AUDIT][FINAL] Sample da primeira aiSuggestion:`, {
        aiEnhanced: response.aiSuggestions[0]?.aiEnhanced,
        categoria: response.aiSuggestions[0]?.categoria,
        nivel: response.aiSuggestions[0]?.nivel,
        hasProblema: !!response.aiSuggestions[0]?.problema,
        hasSolucao: !!response.aiSuggestions[0]?.solucao
      });
    } else {
      console.warn(`[API-AUDIT][FINAL] ⚠️⚠️⚠️ aiSuggestions VAZIO OU AUSENTE! ⚠️⚠️⚠️`);
      console.warn(`[API-AUDIT][FINAL] ⚠️ Frontend receberá array vazio e não exibirá IA`);
    }
    console.log(`[API-AUDIT][FINAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return res.json(response);
  } catch (err) {
    console.error("❌ Erro ao buscar job:", err);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
