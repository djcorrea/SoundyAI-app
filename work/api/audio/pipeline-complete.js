// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4 - CORRIGIDO
// Integração completa com tratamento de erros padronizado e fail-fast

import decodeAudioFile from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Sistema de tratamento de erros padronizado
import { makeErr, logAudio, assertFinite } from '../../lib/audio/error-handling.js';

// ✅ Banco de dados para buscar análise de referência
import pool from '../../db.js';

// 🔮 Sistema de enriquecimento IA (ULTRA V2)
import { enrichSuggestionsWithAI } from '../../lib/ai/suggestion-enricher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Pipeline Completo (Fases 5.1-5.4) carregado - Node.js Backend CORRIGIDO');

/**
 * 🗂️ Criar arquivo temporário WAV para FFmpeg True Peak
 */
function createTempWavFile(audioBuffer, audioData, fileName, jobId) {
  try {
    const tempDir = path.join(__dirname, '../../../temp');
    
    // Criar diretório temp se não existir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFileName = `${jobId}_${Date.now()}_${path.parse(fileName).name}.wav`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    console.log(`[TEMP_WAV] Criando arquivo temporário: ${tempFileName}`);
    
    // Escrever o audioBuffer original no arquivo temporário
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    console.log(`[TEMP_WAV] ✅ Arquivo temporário criado: ${tempFilePath}`);
    
    return tempFilePath;
    
  } catch (error) {
    console.error(`[TEMP_WAV] ❌ Erro ao criar arquivo temporário: ${error.message}`);
    throw new Error(`Failed to create temp WAV file: ${error.message}`);
  }
}

/**
 * 🗑️ Limpar arquivo temporário
 */
function cleanupTempFile(tempFilePath) {
  try {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[TEMP_WAV] 🗑️ Arquivo temporário removido: ${path.basename(tempFilePath)}`);
    }
  } catch (error) {
    console.warn(`[TEMP_WAV] ⚠️ Erro ao remover arquivo temporário: ${error.message}`);
  }
}

export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  const jobId = options.jobId || 'unknown';
  let tempFilePath = null;
  
  console.log(`🚀 [${jobId.substring(0,8)}] Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 [${jobId.substring(0,8)}] Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 [${jobId.substring(0,8)}] Opções:`, options);

  let audioData, segmentedData, coreMetrics, finalJSON;
  const timings = {};

  try {
    // ========= FASE 5.1: DECODIFICAÇÃO =========
    try {
      logAudio('decode', 'start', { fileName, jobId });
      const phase1StartTime = Date.now();
      
      audioData = await decodeAudioFile(audioBuffer, fileName, { jobId });
      
      timings.phase1_decode = Date.now() - phase1StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.1 concluída em ${timings.phase1_decode}ms`);
      console.log(`📊 [${jobId.substring(0,8)}] Audio: ${audioData.sampleRate}Hz, ${audioData.numberOfChannels}ch, ${audioData.duration.toFixed(2)}s`);
      
      // Criar arquivo temporário para FFmpeg True Peak
      tempFilePath = createTempWavFile(audioBuffer, audioData, fileName, jobId);
      
    } catch (error) {
      // Fase 5.1 já estrutura seus próprios erros
      throw error;
    }

    // ========= FASE 5.2: SEGMENTAÇÃO =========
    try {
      logAudio('segmentation', 'start', { fileName, jobId });
      const phase2StartTime = Date.now();
      
      segmentedData = segmentAudioTemporal(audioData, { jobId, fileName });
      
      timings.phase2_segmentation = Date.now() - phase2StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.2 concluída em ${timings.phase2_segmentation}ms`);
      console.log(`📊 [${jobId.substring(0,8)}] Frames: FFT=${segmentedData.framesFFT.count}, RMS=${segmentedData.framesRMS.count}`);
      
    } catch (error) {
      if (error.stage === 'segmentation') {
        throw error; // Já estruturado
      }
      throw makeErr('segmentation', `Segmentation failed: ${error.message}`, 'segmentation_error');
    }

    // ========= FASE 5.3: CORE METRICS =========
    try {
      logAudio('core_metrics', 'start', { fileName, jobId });
      const phase3StartTime = Date.now();
      
      coreMetrics = await calculateCoreMetrics(segmentedData, { 
        jobId, 
        fileName,
        tempFilePath // Passar arquivo temporário para FFmpeg True Peak
      });
      
      timings.phase3_core_metrics = Date.now() - phase3StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.3 concluída em ${timings.phase3_core_metrics}ms`);
      
      // Logs condicionais para evitar erros se métricas não existirem
      const lufsStr = coreMetrics.lufs?.integrated ? coreMetrics.lufs.integrated.toFixed(1) : 'N/A';
      const peakStr = coreMetrics.truePeak?.maxDbtp ? coreMetrics.truePeak.maxDbtp.toFixed(1) : 'N/A';
      const corrStr = coreMetrics.stereo?.correlation ? coreMetrics.stereo.correlation.toFixed(3) : 'N/A';
      
      console.log(`📊 [${jobId.substring(0,8)}] LUFS: ${lufsStr}, Peak: ${peakStr}dBTP, Corr: ${corrStr}`);
      
    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error; // Já estruturado
      }
      throw makeErr('core_metrics', `Core metrics failed: ${error.message}`, 'core_metrics_error');
    }

    // ========= FASE 5.4: JSON OUTPUT =========
    try {
      logAudio('output_scoring', 'start', { fileName, jobId });
      const phase4StartTime = Date.now();
      
      // Construir metadata completo e seguro
      const metadata = {
        fileName: fileName || 'unknown',
        fileSize: audioBuffer ? audioBuffer.length : 0,
        fileSizeBytes: audioBuffer ? audioBuffer.length * 4 : 0, // Float32 = 4 bytes por sample
        fileSizeMB: audioBuffer ? (audioBuffer.length * 4) / (1024 * 1024) : 0,
        duration: audioData ? audioData.duration : 0,
        sampleRate: audioData ? audioData.sampleRate : 48000,
        channels: audioData ? audioData.numberOfChannels : 2,
        format: 'audio/wav',
        bitDepth: 32, // Float32
        codec: 'pcm',
        processingTime: Date.now() - startTime,
        phaseBreakdown: {
          phase1_decode: timings.phase1_decode || 0,
          phase2_segmentation: timings.phase2_segmentation || 0,
          phase3_core_metrics: timings.phase3_core_metrics || 0,
          phase4_json_output: 0 // Será preenchido depois
        },
        jobId: jobId || 'unknown'
      };
      
      // 🎯 USAR MÉTRICAS PRELOADED SE DISPONÍVEIS (evita async mid-pipeline)
      const reference = options.preloadedReferenceMetrics || options.reference || options.genre || null;
      
      // Validar coreMetrics antes de passar para generateJSONOutput
      if (!coreMetrics || typeof coreMetrics !== 'object') {
        throw makeErr('output_scoring', 'Core metrics is invalid or empty', 'invalid_core_metrics');
      }
      
      // 🎯 PASSAR MODE E REFERENCE JOB ID PARA JSON OUTPUT
      finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
        jobId, 
        fileName,
        mode: options.mode,
        referenceJobId: options.referenceJobId
      });
      
      timings.phase4_json_output = Date.now() - phase4StartTime;
      
      // Atualizar o breakdown de tempo no metadata final
      if (finalJSON && finalJSON.metadata && finalJSON.metadata.phaseBreakdown) {
        finalJSON.metadata.phaseBreakdown.phase4_json_output = timings.phase4_json_output;
      }
      
      logAudio('json_output', 'done', { 
        ms: timings.phase4_json_output,
        score: finalJSON.score,
        classification: finalJSON.classification 
      });
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.4 (JSON Output) concluída em ${timings.phase4_json_output}ms`);
      
      // Log seguro do score
      const scoreStr = finalJSON.score !== undefined ? finalJSON.score : 'N/A';
      const classStr = finalJSON.classification || 'N/A';
      console.log(`🎯 [${jobId.substring(0,8)}] Score: ${scoreStr}% (${classStr})`);
      
    } catch (error) {
      if (error.stage === 'output_scoring') {
        throw error; // Já estruturado  
      }
      throw makeErr('output_scoring', `JSON output failed: ${error.message}`, 'output_scoring_error');
    }

    // ========= FASE 5.5: GERAÇÃO DE SUGESTÕES =========
    try {
      console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] 🎯 INICIANDO FASE DE GERAÇÃO DE SUGESTÕES`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] Arquivo: ${fileName}`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] JobId: ${jobId}`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Gerar sugestões baseadas nas métricas técnicas
      const genre = options.genre || finalJSON.metadata?.genre || 'unknown';
      const mode = options.mode || 'genre';
      
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📊 Parâmetros:`, {
        genre,
        mode,
        hasReferenceJobId: !!options.referenceJobId,
        referenceJobId: options.referenceJobId
      });
      
      // ✅ MODO REFERENCE: Comparar com análise de referência
      if (mode === "reference" && options.referenceJobId) {
        console.log("[REFERENCE-MODE] Modo referência detectado - buscando análise de referência...");
        console.log("[REFERENCE-MODE] ReferenceJobId:", options.referenceJobId);
        
        try {
          const refJob = await pool.query("SELECT results FROM jobs WHERE id = $1", [options.referenceJobId]);
          
          if (refJob.rows.length > 0) {
            const refData = typeof refJob.rows[0].results === "string"
              ? JSON.parse(refJob.rows[0].results)
              : refJob.rows[0].results;
            
            console.log("[REFERENCE-MODE] Análise de referência encontrada:", {
              jobId: options.referenceJobId,
              hasMetrics: !!(refData.lufs && refData.truePeak),
              fileName: refData.fileName || refData.metadata?.fileName
            });
            
            // 🔍 AUDITORIA: Validar métricas antes de calcular deltas
            console.log("[REFERENCE-MODE] Validando métricas de referência:", {
              hasLufs: !!refData.lufs,
              lufsValue: refData.lufs?.integrated,
              hasTruePeak: !!refData.truePeak,
              truePeakValue: refData.truePeak?.maxDbtp,
              hasDynamics: !!refData.dynamics,
              dynamicsValue: refData.dynamics?.range
            });
            
            // Gerar deltas A/B
            const referenceComparison = generateReferenceDeltas(coreMetrics, {
              lufs: refData.lufs,
              truePeak: refData.truePeak,
              dynamics: refData.dynamics,
              spectralBands: refData.spectralBands
            });
            
            // 🛡️ VALIDAÇÃO: Garantir que referenceComparison não contém NaN/Infinity
            const hasInvalidDeltas = Object.entries(referenceComparison).some(([key, value]) => {
              if (key === 'spectralBands') return false; // Verificar depois
              return value?.delta != null && (!isFinite(value.delta));
            });
            
            if (hasInvalidDeltas) {
              console.error("[REFERENCE-MODE] ❌ CRÍTICO: Deltas inválidos detectados!");
              console.error("[REFERENCE-MODE] referenceComparison:", JSON.stringify(referenceComparison, null, 2));
              throw new Error("Invalid deltas detected in referenceComparison");
            }
            
            // Adicionar ao resultado final
            finalJSON.referenceComparison = referenceComparison;
            finalJSON.referenceJobId = options.referenceJobId;
            finalJSON.referenceFileName = refData.fileName || refData.metadata?.fileName;
            
            // Gerar sugestões comparativas
            finalJSON.suggestions = generateComparisonSuggestions(referenceComparison);
            
            console.log("[REFERENCE-MODE] ✅ Comparação A/B gerada:", {
              deltasCalculados: Object.keys(referenceComparison).length,
              suggestoesComparativas: finalJSON.suggestions.length,
              hasIsComparisonFlag: finalJSON.suggestions.some(s => s.isComparison)
            });
            
            // � LOG DE DIAGNÓSTICO: Sugestões base geradas
            console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas: ${finalJSON.suggestions.length} itens`);
            console.log(`[AI-AUDIT][ULTRA_DIAG] 📋 Sample de sugestão base:`, {
              type: finalJSON.suggestions[0]?.type,
              category: finalJSON.suggestions[0]?.category,
              message: finalJSON.suggestions[0]?.message?.substring(0, 50) + '...',
              isComparison: finalJSON.suggestions[0]?.isComparison,
              priority: finalJSON.suggestions[0]?.priority
            });
            
            // �🔮 ENRIQUECIMENTO IA ULTRA V2
            try {
              console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA...');
              console.log('[AI-AUDIT][ULTRA_DIAG] 📦 Contexto enviado:', {
                genre,
                mode,
                hasUserMetrics: !!coreMetrics,
                hasReferenceMetrics: true,
                hasReferenceComparison: true,
                referenceFileName: refData.fileName || refData.metadata?.fileName
              });
              
              finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, {
                genre,
                mode: mode || 'reference',
                userMetrics: coreMetrics,
                referenceMetrics: {
                  lufs: refData.lufs,
                  truePeak: refData.truePeak,
                  dynamics: refData.dynamics,
                  spectralBands: refData.spectralBands
                },
                referenceComparison,
                referenceFileName: refData.fileName || refData.metadata?.fileName
              });
              
              console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ ${finalJSON.aiSuggestions?.length || 0} sugestões enriquecidas retornadas`);
              
              if (finalJSON.aiSuggestions && finalJSON.aiSuggestions.length > 0) {
                console.log(`[AI-AUDIT][ULTRA_DIAG] 📋 Sample de sugestão enriquecida:`, {
                  aiEnhanced: finalJSON.aiSuggestions[0]?.aiEnhanced,
                  categoria: finalJSON.aiSuggestions[0]?.categoria,
                  nivel: finalJSON.aiSuggestions[0]?.nivel,
                  hasProblema: !!finalJSON.aiSuggestions[0]?.problema,
                  hasCausaProvavel: !!finalJSON.aiSuggestions[0]?.causaProvavel,
                  hasSolucao: !!finalJSON.aiSuggestions[0]?.solucao,
                  hasPluginRecomendado: !!finalJSON.aiSuggestions[0]?.pluginRecomendado
                });
              }
            } catch (aiError) {
              console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
              finalJSON.aiSuggestions = [];
            }
          } else {
            console.warn("[REFERENCE-MODE] ⚠️ Job de referência não encontrado - gerando sugestões genéricas");
            finalJSON.suggestions = generateSuggestionsFromMetrics(coreMetrics, genre, mode);
            
            // � LOG DE DIAGNÓSTICO: Sugestões base geradas (fallback)
            console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas (fallback): ${finalJSON.suggestions.length} itens`);
            
            // �🔮 ENRIQUECIMENTO IA ULTRA V2 (fallback mode)
            try {
              console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA (modo fallback)...');
              finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, {
                genre,
                mode: 'genre',
                userMetrics: coreMetrics
              });
              console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ ${finalJSON.aiSuggestions?.length || 0} sugestões enriquecidas`);
            } catch (aiError) {
              console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
              finalJSON.aiSuggestions = [];
            }
          }
        } catch (refError) {
          console.error("[REFERENCE-MODE] ❌ Erro ao buscar referência:", refError.message);
          console.warn("[REFERENCE-MODE] Gerando sugestões genéricas como fallback");
          finalJSON.suggestions = generateSuggestionsFromMetrics(coreMetrics, genre, mode);
          
          // 🔍 LOG DE DIAGNÓSTICO: Sugestões base geradas (error fallback)
          console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas (error fallback): ${finalJSON.suggestions.length} itens`);
          
          // 🔮 ENRIQUECIMENTO IA ULTRA V2 (error fallback)
          try {
            console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA (error fallback)...');
            finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, {
              genre,
              mode: 'genre',
              userMetrics: coreMetrics
            });
            console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ ${finalJSON.aiSuggestions?.length || 0} sugestões enriquecidas`);
          } catch (aiError) {
            console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
            finalJSON.aiSuggestions = [];
          }
        }
      } else {
        // Modo genre normal
        finalJSON.suggestions = generateSuggestionsFromMetrics(coreMetrics, genre, mode);
        
        // � LOG DE DIAGNÓSTICO: Sugestões base geradas (modo genre)
        console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas (modo genre): ${finalJSON.suggestions.length} itens`);
        
        // �🔮 ENRIQUECIMENTO IA ULTRA V2 (modo genre)
        try {
          console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA (modo genre)...');
          finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, {
            genre,
            mode: 'genre',
            userMetrics: coreMetrics
          });
          console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ ${finalJSON.aiSuggestions?.length || 0} sugestões enriquecidas`);
        } catch (aiError) {
          console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
          finalJSON.aiSuggestions = [];
        }
      }
      
      // 🔍 LOG DE DIAGNÓSTICO: Estrutura final do JSON
      console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] 🔁 ESTRUTURA FINAL DO JSON`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📦 Campos principais:`, Object.keys(finalJSON));
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📊 Métricas:`, {
        hasLufs: !!finalJSON.lufs,
        hasTruePeak: !!finalJSON.truePeak,
        hasDynamics: !!finalJSON.dynamics,
        hasSpectralBands: !!finalJSON.spectralBands
      });
      console.log(`[AI-AUDIT][ULTRA_DIAG] 💡 Sugestões:`, {
        hasSuggestions: Array.isArray(finalJSON.suggestions),
        suggestionsCount: finalJSON.suggestions?.length || 0,
        hasAISuggestions: Array.isArray(finalJSON.aiSuggestions),
        aiSuggestionsCount: finalJSON.aiSuggestions?.length || 0
      });
      console.log(`[AI-AUDIT][ULTRA_DIAG] 🔄 Comparação:`, {
        hasReferenceComparison: !!finalJSON.referenceComparison,
        hasReferenceJobId: !!finalJSON.referenceJobId,
        hasReferenceFileName: !!finalJSON.referenceFileName
      });
      console.log(`[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      console.log(`[AI-AUDIT][ASSIGN.inputType] suggestions:`, typeof finalJSON.suggestions, Array.isArray(finalJSON.suggestions));
      console.log(`[AI-AUDIT][ASSIGN.sample]`, finalJSON.suggestions?.slice(0, 2));
      
    } catch (error) {
      console.error(`[AI-AUDIT][GENERATION] ❌ Erro ao gerar sugestões: ${error.message}`);
      // Garantir que sempre há um array, mesmo que vazio
      finalJSON.suggestions = [];
    }

    // ========= FINALIZAÇÃO =========
    const totalTime = Date.now() - startTime;
    timings.total = totalTime;

    // Adicionar timing breakdown ao resultado final
    finalJSON.metadata = finalJSON.metadata || {};
    finalJSON.metadata.processingTime = totalTime;
    finalJSON.metadata.phaseBreakdown = timings;
    finalJSON.metadata.stage = 'completed';
    finalJSON.metadata.pipelineVersion = '5.1-5.4-corrected';

    // Validação final - garantir que não temos NaN/Infinity
    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final validation failed: ${validationError.message}`, 'final_validation_error');
    }

    console.log(`🏁 [${jobId.substring(0,8)}] Pipeline completo finalizado em ${totalTime}ms`);
    console.log(`✅ [${jobId.substring(0,8)}] JSON final pronto para salvar no banco`);
    
    logAudio('pipeline', 'done', {
      ms: totalTime,
      meta: {
        phases: Object.keys(timings),
        score: finalJSON.score,
        size: JSON.stringify(finalJSON).length
      }
    });

    // Limpar arquivo temporário
    cleanupTempFile(tempFilePath);

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Log estruturado do erro
    logAudio('pipeline', 'error', {
      code: error.code || 'unknown',
      message: error.message,
      stage: error.stage || 'unknown',
      stackSnippet: error.stackSnippet
    });
    
    console.error(`💥 [${jobId.substring(0,8)}] Pipeline falhou após ${totalTime}ms:`, error.message);
    console.error(`📍 [${jobId.substring(0,8)}] Stage: ${error.stage || 'unknown'}, Code: ${error.code || 'unknown'}`);
    
    // Limpar arquivo temporário em caso de erro
    cleanupTempFile(tempFilePath);
    
    // ========= ESTRUTURAR ERRO FINAL =========
    // NÃO retornar JSON de erro - propagar para camada de jobs
    // A camada de jobs decidirá como marcar o status
    
    // Se já é um erro estruturado, re-propagar
    if (error.stage) {
      throw error;
    }
    
    // Erro inesperado - estruturar
    throw makeErr('pipeline', `Pipeline failed: ${error.message}`, 'pipeline_error');
  }
}

/**
 * 🚀 Wrapper para compatibilidade com BullMQ
 * Alias para processAudioComplete mantendo compatibilidade
 */
export async function processAudio(file, options = {}) {
  return processAudioComplete(file.buffer || file, file.fileName || file.name || 'unknown', options);
}

/**
 * ⚖️ FUNÇÃO DE COMPARAÇÃO ENTRE MÉTRICAS
 * Compara duas análises de áudio e gera sugestões automáticas
 */
export async function compareMetrics(userMetrics, refMetrics) {
  console.log("🔍 [Compare] Calculando diferenças entre métricas...");

  const diff = {};

  const categories = ["loudness", "truePeak", "stereo", "dynamics", "spectralBands"];
  for (const key of categories) {
    if (!userMetrics[key] || !refMetrics[key]) continue;

    diff[key] = {};

    if (key === "spectralBands") {
      // Estrutura especial para bandas espectrais
      for (const band in userMetrics[key]) {
        if (userMetrics[key][band] && refMetrics[key][band]) {
          diff[key][band] = {};
          if (typeof userMetrics[key][band].energy_db === "number" && typeof refMetrics[key][band].energy_db === "number") {
            diff[key][band].energy_db = parseFloat((userMetrics[key][band].energy_db - refMetrics[key][band].energy_db).toFixed(2));
          }
          if (typeof userMetrics[key][band].percentage === "number" && typeof refMetrics[key][band].percentage === "number") {
            diff[key][band].percentage = parseFloat((userMetrics[key][band].percentage - refMetrics[key][band].percentage).toFixed(2));
          }
        }
      }
    } else {
      // Estrutura normal para outras métricas
      for (const metric in userMetrics[key]) {
        const userVal = userMetrics[key][metric];
        const refVal = refMetrics[key][metric];

        if (typeof userVal === "number" && typeof refVal === "number") {
          diff[key][metric] = parseFloat((userVal - refVal).toFixed(2));
        }
      }
    }
  }

  // 🎯 Gera sugestões automáticas
  const suggestions = generateComparisonSuggestions(diff);

  return {
    ok: true,
    mode: "comparison",
    analyzedAt: new Date().toISOString(),
    metricsUser: userMetrics,
    metricsReference: refMetrics,
    comparison: diff,
    suggestions,
  };
}


/**
 * ✅ NOVA FUNÇÃO: Calcula diferenças (deltas) entre user e reference
 * Compara as métricas de duas faixas de áudio (modo A/B)
 * 
 * @param {Object} userMetrics - Métricas da faixa do usuário
 * @param {Object} referenceMetrics - Métricas da faixa de referência
 * @returns {Object} - Objeto com deltas calculados para todas as métricas
 */
function generateReferenceDeltas(userMetrics, referenceMetrics) {
  // 🛡️ FUNÇÃO AUXILIAR: Cálculo seguro de delta (previne NaN, Infinity, null, undefined)
  const safeDelta = (a, b) => {
    if (typeof a === 'number' && isFinite(a) && typeof b === 'number' && isFinite(b)) {
      return a - b;
    }
    return 0; // Fallback seguro para valores inválidos
  };

  const deltas = {
    lufs: {
      user: userMetrics.lufs?.integrated ?? null,
      reference: referenceMetrics.lufs?.integrated ?? null,
      delta: safeDelta(userMetrics.lufs?.integrated, referenceMetrics.lufs?.integrated)
    },
    truePeak: {
      user: userMetrics.truePeak?.maxDbtp ?? null,
      reference: referenceMetrics.truePeak?.maxDbtp ?? null,
      delta: safeDelta(userMetrics.truePeak?.maxDbtp, referenceMetrics.truePeak?.maxDbtp)
    },
    dynamics: {
      user: userMetrics.dynamics?.range ?? null,
      reference: referenceMetrics.dynamics?.range ?? null,
      delta: safeDelta(userMetrics.dynamics?.range, referenceMetrics.dynamics?.range)
    },
    spectralBands: {}
  };

  const bands = ["sub", "bass", "lowMid", "mid", "highMid", "presence", "air"];
  for (const band of bands) {
    const u = userMetrics.spectralBands?.[band]?.energy_db;
    const r = referenceMetrics.spectralBands?.[band]?.energy_db;
    if (typeof u === "number" && isFinite(u) && typeof r === "number" && isFinite(r)) {
      deltas.spectralBands[band] = {
        user: u,
        reference: r,
        delta: +safeDelta(u, r).toFixed(2)
      };
    }
  }

  // 🔍 LOG DE DIAGNÓSTICO: Auditoria de deltas calculados
  console.log("[DELTA-AUDIT] Deltas calculados:", {
    lufs: deltas.lufs,
    truePeak: deltas.truePeak,
    dynamics: deltas.dynamics,
    spectralBandsCount: Object.keys(deltas.spectralBands).length,
    spectralBands: deltas.spectralBands
  });

  return deltas;
}

/**
 * ✅ NOVA FUNÇÃO: Gera sugestões baseadas nas diferenças entre user e reference
 * Cria sugestões comparativas A/B ao invés de sugestões absolutas
 * 
 * @param {Object} deltas - Objeto com deltas calculados por generateReferenceDeltas()
 * @returns {Array} - Array de sugestões comparativas com flag isComparison: true
 */
function generateComparisonSuggestions(deltas) {
  const suggestions = [];
  
  // 🛡️ FUNÇÃO AUXILIAR: Formatar número de forma segura
  const safeFormat = (value, decimals = 1) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0.0';
    return value.toFixed(decimals);
  };

  // Loudness
  if (deltas.lufs?.delta != null && isFinite(deltas.lufs.delta) && Math.abs(deltas.lufs.delta) > 1.5) {
    const direction = deltas.lufs.delta > 0 ? "mais alta" : "mais baixa";
    suggestions.push({
      type: "loudness_comparison",
      category: "Loudness",
      message: `Sua faixa está ${direction} que a referência em ${safeFormat(Math.abs(deltas.lufs.delta))} dB.`,
      action: deltas.lufs.delta > 0
        ? "Reduza o volume no limitador até se aproximar da referência."
        : "Aumente o ganho de saída ou saturação para igualar a referência.",
      referenceValue: deltas.lufs.reference,
      userValue: deltas.lufs.user,
      delta: safeFormat(deltas.lufs.delta, 2),
      priority: "alta",
      band: "full_spectrum",
      isComparison: true
    });
  }

  // True Peak
  if (deltas.truePeak?.delta != null && isFinite(deltas.truePeak.delta) && Math.abs(deltas.truePeak.delta) > 0.5) {
    suggestions.push({
      type: "truepeak_comparison",
      category: "Mastering",
      message: `True Peak está ${deltas.truePeak.delta > 0 ? "mais alto" : "mais baixo"} que a referência em ${safeFormat(Math.abs(deltas.truePeak.delta), 2)} dBTP.`,
      action: "Ajuste o ceiling do limitador para se aproximar da referência.",
      referenceValue: deltas.truePeak.reference,
      userValue: deltas.truePeak.user,
      delta: safeFormat(deltas.truePeak.delta, 2),
      priority: "média",
      band: "full_spectrum",
      isComparison: true
    });
  }

  // Dynamic Range
  if (deltas.dynamics?.delta != null && isFinite(deltas.dynamics.delta) && Math.abs(deltas.dynamics.delta) > 1.0) {
    suggestions.push({
      type: "dynamics_comparison",
      category: "Compressão / DR",
      message: `Dynamic Range está ${deltas.dynamics.delta > 0 ? "maior" : "menor"} que a referência em ${safeFormat(Math.abs(deltas.dynamics.delta))} dB.`,
      action: deltas.dynamics.delta > 0
        ? "Aumente a compressão no master bus."
        : "Reduza a compressão para abrir mais o mix.",
      referenceValue: deltas.dynamics.reference,
      userValue: deltas.dynamics.user,
      delta: safeFormat(deltas.dynamics.delta, 2),
      priority: "média",
      band: "full_spectrum",
      isComparison: true
    });
  }

  // Bandas Espectrais
  const bandNames = {
    sub: "Sub (20-60Hz)",
    bass: "Bass (60-150Hz)",
    lowMid: "Low-Mid (150-500Hz)",
    mid: "Mid (500Hz-2kHz)",
    highMid: "High-Mid (2-5kHz)",
    presence: "Presence (5-10kHz)",
    air: "Air (10-20kHz)"
  };

  for (const [band, name] of Object.entries(bandNames)) {
    const data = deltas.spectralBands[band];
    if (data && typeof data.delta === 'number' && isFinite(data.delta) && Math.abs(data.delta) > 1.5) {
      suggestions.push({
        type: "eq_comparison",
        category: "Equalização",
        message: `${name} está ${data.delta > 0 ? "mais forte" : "mais fraco"} que a referência em ${safeFormat(Math.abs(data.delta))} dB.`,
        action: data.delta > 0
          ? `Reduza ${name} em ${safeFormat(Math.abs(data.delta))} dB via EQ.`
          : `Aumente ${name} em ${safeFormat(Math.abs(data.delta))} dB via EQ.`,
        referenceValue: data.reference,
        userValue: data.user,
        delta: safeFormat(data.delta, 2),
        priority: Math.abs(data.delta) > 3 ? "alta" : "média",
        band: band,
        isComparison: true
      });
    }
  }

  console.log(`[COMPARISON-SUGGESTIONS] Geradas ${suggestions.length} sugestões comparativas.`);
  
  // 🛡️ FALLBACK: Garantir que sempre retornamos ao menos 1 suggestion
  if (!suggestions || suggestions.length === 0) {
    console.warn('[COMPARISON-SUGGESTIONS] ⚠️ Nenhuma sugestão gerada - retornando fallback');
    suggestions.push({
      type: 'comparison_incomplete',
      category: 'Diagnóstico',
      message: 'Análise incompleta',
      action: 'Alguns parâmetros da faixa de referência não puderam ser comparados. Verifique se ambas as faixas possuem métricas completas.',
      priority: 'baixa',
      band: 'full_spectrum',
      isComparison: true,
      isFallback: true
    });
  }
  
  return suggestions;
}

/**
 * 🎯 GERADOR DE SUGESTÕES BASEADAS EM MÉTRICAS
 * Gera sugestões básicas analisando as métricas técnicas do áudio
 * 
 * @param {Object} technicalData - Dados técnicos do áudio (coreMetrics)
 * @param {String} genre - Gênero musical ou categoria
 * @param {String} mode - Modo de análise ('genre' ou 'reference')
 * @returns {Array} - Array de sugestões estruturadas
 */
function generateSuggestionsFromMetrics(technicalData, genre = 'unknown', mode = 'genre') {
  console.log(`[AI-AUDIT][GENERATION] Generating suggestions for genre: ${genre}, mode: ${mode}`);
  
  const suggestions = [];
  
  // Regra 1: LUFS Integrado
  if (technicalData.lufs && typeof technicalData.lufs.integrated === 'number') {
    const lufs = technicalData.lufs.integrated;
    const ideal = mode === 'genre' ? -10.5 : -14.0; // -10.5 para EDM, -14.0 para streaming
    const delta = Math.abs(lufs - ideal);
    
    if (delta > 1.0) {
      suggestions.push({
        type: 'loudness',
        category: 'loudness',
        message: `LUFS Integrado está em ${lufs.toFixed(1)} dB quando deveria estar próximo de ${ideal.toFixed(1)} dB (diferença de ${delta.toFixed(1)} dB)`,
        action: delta > 3 ? `Ajustar loudness em ${(ideal - lufs).toFixed(1)} dB via limitador` : `Refinar loudness final`,
        priority: delta > 3 ? 'crítica' : 'alta',
        band: 'full_spectrum',
        delta: (ideal - lufs).toFixed(1)
      });
    }
  }
  
  // Regra 2: True Peak
  if (technicalData.truePeak && typeof technicalData.truePeak.maxDbtp === 'number') {
    const tp = technicalData.truePeak.maxDbtp;
    if (tp > -1.0) {
      suggestions.push({
        type: 'clipping',
        category: 'mastering',
        message: `True Peak em ${tp.toFixed(2)} dBTP está acima do limite seguro de -1.0 dBTP (risco de clipping em conversão)`,
        action: `Aplicar limitador com ceiling em -1.0 dBTP ou reduzir gain em ${(tp + 1.0).toFixed(2)} dB`,
        priority: 'crítica',
        band: 'full_spectrum',
        delta: (tp + 1.0).toFixed(2)
      });
    }
  }
  
  // Regra 3: Dynamic Range
  if (technicalData.dynamics && typeof technicalData.dynamics.range === 'number') {
    const dr = technicalData.dynamics.range;
    const minDR = mode === 'genre' ? 6.0 : 8.0;
    
    if (dr < minDR) {
      suggestions.push({
        type: 'dynamics',
        category: 'mastering',
        message: `Dynamic Range está em ${dr.toFixed(1)} dB quando deveria estar acima de ${minDR.toFixed(1)} dB (mix muito comprimido)`,
        action: `Reduzir compressão/limitação para recuperar ${(minDR - dr).toFixed(1)} dB de dinâmica`,
        priority: 'alta',
        band: 'full_spectrum',
        delta: (minDR - dr).toFixed(1)
      });
    }
  }
  
  // Regra 4-10: Bandas espectrais
  if (technicalData.spectralBands) {
    const bands = technicalData.spectralBands;
    const idealRanges = {
      sub: { min: -38, max: -28, name: 'Sub (20-60Hz)' },
      bass: { min: -31, max: -25, name: 'Bass (60-150Hz)' },
      lowMid: { min: -28, max: -22, name: 'Low-Mid (150-500Hz)' },
      mid: { min: -23, max: -17, name: 'Mid (500Hz-2kHz)' },
      highMid: { min: -20, max: -14, name: 'High-Mid (2-5kHz)' },
      presence: { min: -23, max: -17, name: 'Presence (5-10kHz)' },
      air: { min: -30, max: -24, name: 'Air (10-20kHz)' }
    };
    
    for (const [band, ideal] of Object.entries(idealRanges)) {
      const bandData = bands[band];
      if (bandData && typeof bandData.energy_db === 'number') {
        const value = bandData.energy_db;
        
        if (value < ideal.min) {
          const delta = ideal.min - value;
          suggestions.push({
            type: 'eq',
            category: 'eq',
            message: `${ideal.name} está em ${value.toFixed(1)} dB quando deveria estar entre ${ideal.min} e ${ideal.max} dB (${delta.toFixed(1)} dB abaixo do mínimo)`,
            action: `Aumentar ${ideal.name} em +${delta.toFixed(1)} dB via EQ`,
            priority: delta > 3 ? 'alta' : 'média',
            band: band,
            delta: `+${delta.toFixed(1)}`
          });
        } else if (value > ideal.max) {
          const delta = value - ideal.max;
          suggestions.push({
            type: 'eq',
            category: 'eq',
            message: `${ideal.name} está em ${value.toFixed(1)} dB quando deveria estar entre ${ideal.min} e ${ideal.max} dB (${delta.toFixed(1)} dB acima do máximo)`,
            action: `Reduzir ${ideal.name} em -${delta.toFixed(1)} dB via EQ`,
            priority: delta > 3 ? 'alta' : 'média',
            band: band,
            delta: `-${delta.toFixed(1)}`
          });
        }
      }
    }
  }
  
  console.log(`[AI-AUDIT][GENERATION] Generated ${suggestions.length} suggestions`);
  suggestions.forEach((sug, i) => {
    console.log(`[AI-AUDIT][GENERATION] Suggestion ${i + 1}: ${sug.message}`);
  });
  
  return suggestions;
}