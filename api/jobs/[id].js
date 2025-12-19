// api/jobs/[id].js
import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

// � DEBUG: Ativa logs detalhados apenas se DEBUG_JOBS_API=1
const DEBUG = process.env.DEBUG_JOBS_API === "1";

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
  const dataSuggestions = fullResult.data?.suggestions;
  
  // Determinar se campo existe (mesmo que vazio)
  const hasRootField = fullResult.hasOwnProperty('suggestions');
  const hasProblemsField = fullResult.problemsAnalysis?.hasOwnProperty('suggestions');
  const hasDataField = fullResult.data?.hasOwnProperty('suggestions');
  
  // Campo existe se está em qualquer caminho
  const exists = hasRootField || hasProblemsField || hasDataField;
  
  // Campo está missing se não existe em nenhum caminho
  const missing = !exists;
  
  // Preferir root, depois problems, depois data
  let suggestionsArray = [];
  if (Array.isArray(rootSuggestions)) {
    suggestionsArray = rootSuggestions;
  } else if (Array.isArray(problemsSuggestions)) {
    suggestionsArray = problemsSuggestions;
  } else if (Array.isArray(dataSuggestions)) {
    suggestionsArray = dataSuggestions;
  }
  
  return {
    suggestionsArray,
    exists,
    missing,
    length: suggestionsArray.length
  };
}

/**
 * 🛠️ FUNÇÃO UTILITÁRIA: Extrai aiSuggestions de múltiplos caminhos
 * 
 * @param {Object} fullResult - Resultado completo do job
 * @returns {Array} Array de aiSuggestions (vazio se não encontrado)
 */
function extractAiSuggestions(fullResult) {
  if (!fullResult) return [];
  
  const rootAi = fullResult.aiSuggestions;
  const dataAi = fullResult.data?.aiSuggestions;
  
  if (Array.isArray(rootAi)) return rootAi;
  if (Array.isArray(dataAi)) return dataAi;
  
  return [];
}

/**
 * 🛠️ FUNÇÃO UTILITÁRIA: Extrai technicalData de múltiplos caminhos
 * 
 * @param {Object} fullResult - Resultado completo do job
 * @returns {Object|null} technicalData ou null
 */
function extractTechnicalData(fullResult) {
  if (!fullResult) return null;
  
  const root = fullResult.technicalData;
  const data = fullResult.data?.technicalData;
  const results = fullResult.results?.technicalData;
  
  if (root && typeof root === 'object') return root;
  if (data && typeof data === 'object') return data;
  if (results && typeof results === 'object') return results;
  
  return null;
}

/**
 * 🛠️ FUNÇÃO UTILITÁRIA: Extrai targets de múltiplos caminhos
 * 
 * @param {Object} fullResult - Resultado completo do job
 * @returns {Object|null} targets ou null
 */
function extractTargets(fullResult) {
  if (!fullResult) return null;
  
  const root = fullResult.targets;
  const data = fullResult.data?.targets;
  const genre = fullResult.data?.genreTargets;
  
  if (root && typeof root === 'object') return root;
  if (data && typeof data === 'object') return data;
  if (genre && typeof genre === 'object') return genre;
  
  return null;
}

/**
 * 🔍 FUNÇÃO UTILITÁRIA: Detecta estágio do modo reference
 * 
 * Prioriza fullResult.referenceStage, depois requiresSecondTrack, depois referenceJobId
 * 
 * @param {Object} fullResult - Resultado completo do job
 * @param {String} mode - Modo do job (genre, reference, etc)
 * @param {String} jobId - ID do job atual
 * @returns {Object} { isReference, isFirstJob, isSecondJob, stage }
 */
function detectReferenceStage(fullResult, mode, jobId) {
  const isReference = mode === 'reference';
  
  if (!isReference) {
    return { isReference: false, isFirstJob: false, isSecondJob: false, stage: null };
  }
  
  // Prioridade 1: referenceStage explícito
  const stage = fullResult?.referenceStage || fullResult?.data?.referenceStage;
  if (stage === 'base') {
    return { isReference: true, isFirstJob: true, isSecondJob: false, stage: 'base' };
  }
  if (stage === 'comparison') {
    return { isReference: true, isFirstJob: false, isSecondJob: true, stage: 'comparison' };
  }
  
  // Prioridade 2: requiresSecondTrack
  const requiresSecond = fullResult?.requiresSecondTrack ?? fullResult?.data?.requiresSecondTrack;
  if (requiresSecond === true) {
    return { isReference: true, isFirstJob: true, isSecondJob: false, stage: 'base' };
  }
  if (requiresSecond === false) {
    const hasComparison = !!(fullResult?.referenceComparison || fullResult?.data?.referenceComparison);
    if (hasComparison) {
      return { isReference: true, isFirstJob: false, isSecondJob: true, stage: 'comparison' };
    }
  }
  
  // Prioridade 3: referenceJobId como fallback
  const refJobId = fullResult?.referenceJobId || fullResult?.data?.referenceJobId;
  if (refJobId && refJobId !== jobId) {
    return { isReference: true, isFirstJob: false, isSecondJob: true, stage: 'comparison' };
  }
  
  // Default: assumir primeiro job se nada mais bateu
  return { isReference: true, isFirstJob: true, isSecondJob: false, stage: 'base' };
}

/**
 * 🔍 FUNÇÃO UTILITÁRIA: Verifica se job está completo no modo reference
 * 
 * @param {Object} technicalData - Dados técnicos extraídos
 * @param {Object} fullResult - Resultado completo do job
 * @param {Boolean} isSecondJob - Se é segundo job (comparação)
 * @returns {Boolean} true se completo, false se precisa aguardar
 */
function isReferenceComplete(technicalData, fullResult, isSecondJob) {
  // Sempre precisa de technicalData
  if (!technicalData) return false;
  
  // Primeiro job: só precisa de technicalData
  if (!isSecondJob) return true;
  
  // Segundo job: precisa de comparação
  const hasComparison = !!(
    fullResult?.referenceComparison || 
    fullResult?.data?.referenceComparison ||
    fullResult?.comparison
  );
  
  return hasComparison;
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

    // 🛡️ Se job ainda está em processing/queued, retornar status mínimo
    if (normalizedStatus === "processing" || normalizedStatus === "queued") {
      if (DEBUG) {
        console.log(`[API] Job ${job.id} em '${normalizedStatus}' - aguardando worker`);
      }
      
      return res.json({
        id: job.id,
        status: normalizedStatus,
        mode: job.mode,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    }

    // 🎯 Parse do resultado completo (results ou result)
    let fullResult = null;
    
    const resultData = job.results || job.result;
    if (resultData) {
      try {
        fullResult = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
        
        if (DEBUG) {
          console.log(`[API] Job ${job.id} parsed - fields: ${Object.keys(fullResult).join(', ')}`);
        }
      } catch (parseError) {
        console.error(`[API] ❌ Erro ao parsear results do job ${job.id}:`, parseError.message);
        fullResult = resultData;
      }
    }

    // ⚠️ VALIDAÇÃO: Se completed mas sem technicalData, retornar processing
    if (normalizedStatus === "completed") {
      const technicalData = extractTechnicalData(fullResult);
      const refStage = detectReferenceStage(fullResult, job.mode, job.id);
      
      if (DEBUG) {
        console.log(`[API][DEBUG] Job ${job.id} validation:`, {
          mode: job.mode,
          isReference: refStage.isReference,
          isFirstJob: refStage.isFirstJob,
          isSecondJob: refStage.isSecondJob,
          stage: refStage.stage,
          hasTechnicalData: !!technicalData
        });
      }
      
      // Validar technicalData sempre
      if (!technicalData) {
        console.warn(`[API] ⚠️ Job ${job.id} completed mas falta technicalData - aguardando`);
        
        return res.json({
          id: job.id,
          status: "processing",
          mode: job.mode,
          createdAt: job.created_at,
          updatedAt: job.updated_at
        });
      }
      
      // Modo reference: validações específicas
      if (refStage.isReference) {
        const isComplete = isReferenceComplete(technicalData, fullResult, refStage.isSecondJob);
        
        if (!isComplete) {
          if (refStage.isSecondJob) {
            console.warn(`[API] ⚠️ Job ${job.id} (SEGUNDO JOB) aguardando comparação`);
          }
          
          return res.json({
            id: job.id,
            status: "processing",
            mode: job.mode,
            createdAt: job.created_at,
            updatedAt: job.updated_at
          });
        }
        
        // ✅ Reference completo - preparar response específico
        if (refStage.isFirstJob) {
          if (DEBUG) {
            console.log(`[API] ✅ PRIMEIRO JOB (base) completo - requiresSecondTrack: true`);
          }
          
          const suggestions = extractSuggestions(fullResult);
          const aiSuggestions = extractAiSuggestions(fullResult);
          
          const firstJobResponse = {
            id: job.id,
            fileKey: job.file_key,
            mode: job.mode,
            status: "completed",
            requiresSecondTrack: true,
            referenceStage: "base",
            error: job.error || null,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            completedAt: job.completed_at,
            // Forçar targets vazio para evitar erro no front
            targets: {},
            technicalData: technicalData,
            suggestions: suggestions.suggestionsArray,
            aiSuggestions: aiSuggestions,
            referenceComparison: null,
            referenceJobId: null,
            referenceFileName: null
          };
          
          return res.json(firstJobResponse);
        }
        
        if (refStage.isSecondJob) {
          if (DEBUG) {
            console.log(`[API] ✅ SEGUNDO JOB (comparação) completo`);
          }
          
          const suggestions = extractSuggestions(fullResult);
          const aiSuggestions = extractAiSuggestions(fullResult);
          const targets = extractTargets(fullResult);
          
          const secondJobResponse = {
            id: job.id,
            fileKey: job.file_key,
            mode: job.mode,
            status: "completed",
            requiresSecondTrack: false,
            referenceStage: "comparison",
            error: job.error || null,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            completedAt: job.completed_at,
            targets: targets,
            technicalData: technicalData,
            suggestions: suggestions.suggestionsArray,
            aiSuggestions: aiSuggestions,
            referenceComparison: fullResult?.referenceComparison || fullResult?.data?.referenceComparison || null,
            referenceJobId: fullResult?.referenceJobId || fullResult?.data?.referenceJobId || null,
            referenceFileName: fullResult?.referenceFileName || fullResult?.data?.referenceFileName || null
          };
          
          return res.json(secondJobResponse);
        }
      }
    }

    // 🚀 RESULTADO FINAL: Response padrão (genre e outros modos)
    const suggestions = extractSuggestions(fullResult);
    const aiSuggestions = extractAiSuggestions(fullResult);
    const technicalData = extractTechnicalData(fullResult);
    const targets = extractTargets(fullResult);
    
    const response = {
      id: job.id,
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus,
      error: job.error || null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      // Campos obrigatórios com fallback
      targets: targets,
      technicalData: technicalData,
      suggestions: suggestions.suggestionsArray,
      aiSuggestions: aiSuggestions,
      // Campos de reference (null se não aplicável)
      referenceComparison: fullResult?.referenceComparison || fullResult?.data?.referenceComparison || null,
      referenceJobId: fullResult?.referenceJobId || fullResult?.data?.referenceJobId || null,
      referenceFileName: fullResult?.referenceFileName || fullResult?.data?.referenceFileName || null,
      referenceStage: fullResult?.referenceStage || fullResult?.data?.referenceStage || null,
      requiresSecondTrack: fullResult?.requiresSecondTrack ?? fullResult?.data?.requiresSecondTrack ?? false,
      // Incluir demais campos do fullResult
      ...(fullResult || {})
    };

    if (DEBUG) {
      console.log(`[API] ✅ Job ${job.id} response ready:`, {
        status: response.status,
        mode: response.mode,
        hasTechnicalData: !!response.technicalData,
        suggestionsLen: response.suggestions.length,
        aiSuggestionsLen: response.aiSuggestions.length,
        hasTargets: !!response.targets,
        hasComparison: !!response.referenceComparison
      });
    }

    return res.json(response);
  } catch (err) {
    console.error(`[API] ❌ Erro ao buscar job ${id}:`, err.message);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
