// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4 - CORRIGIDO
// Integração completa com tratamento de erros padronizado e fail-fast

import decodeAudioFile from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4
import { analyzeProblemsAndSuggestionsV2 } from "../../lib/audio/features/problems-suggestions-v2.js"; // Fase 5.4.1
import { loadGenreTargets } from "../../lib/audio/utils/genre-targets-loader.js";
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
 * 🎯 FUNÇÃO DE ORDENAÇÃO PROFISSIONAL DE SUGESTÕES
 * Ordena sugestões seguindo prioridade técnica profissional:
 * 1. True Peak (mais crítico)
 * 2. LUFS
 * 3. Dynamic Range
 * 4. Headroom
 * 5. Bandas espectrais (sub → brilho)
 * 6. Stereo Width
 * 7. Outros
 */
function orderSuggestionsForUser(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return suggestions;
  }
  
  const weights = {
    // Métricas críticas
    'true_peak': 1,
    'truePeak': 1,
    'truePeakDbtp': 1,
    
    // Loudness
    'lufs': 2,
    'lufsIntegrated': 2,
    
    // Dinâmica
    'dynamic_range': 3,
    'dynamicRange': 3,
    'dr': 3,
    
    // Headroom
    'headroom': 4,
    
    // Bandas espectrais (ordem profissional: graves → agudos)
    'sub': 5,
    'low_bass': 6,
    'bass': 6,
    'upper_bass': 7,
    'lowMid': 8,
    'low_mid': 8,
    'mid': 9,
    'highMid': 10,
    'high_mid': 10,
    'presence': 11,
    'presenca': 11,
    'brilho': 12,
    'air': 12,
    
    // Stereo
    'stereo_width': 13,
    'stereo': 13,
    'stereoCorrelation': 13,
    
    // LRA
    'lra': 14,
    
    // EQ genérico
    'eq': 15,
    'band': 15,
    
    // Outros
    'other': 99
  };
  
  return suggestions.sort((a, b) => {
    // Determinar peso de cada sugestão
    const getWeight = (sug) => {
      // Tentar diferentes campos onde o tipo pode estar
      const type = sug.type || sug.metric || sug.category || 'other';
      
      // Normalizar para minúsculas e remover espaços
      const normalizedType = String(type).toLowerCase().replace(/\s+/g, '_');
      
      // Buscar peso, fallback para 99 (outros)
      return weights[normalizedType] || weights[type] || 99;
    };
    
    const wA = getWeight(a);
    const wB = getWeight(b);
    
    // Ordenar por peso (menor peso = maior prioridade)
    if (wA !== wB) {
      return wA - wB;
    }
    
    // Se pesos iguais, ordenar por severidade (se existir)
    const severityOrder = { 'critical': 0, 'crítica': 0, 'high': 1, 'alta': 1, 'medium': 2, 'média': 2, 'low': 3, 'baixa': 3 };
    const sevA = severityOrder[a.severity] || severityOrder[a.priority] || 99;
    const sevB = severityOrder[b.severity] || severityOrder[b.priority] || 99;
    
    return sevA - sevB;
  });
}

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
  let detectedGenre = null; // 🛡️ Escopo global da função para evitar ReferenceError
  let customTargets = null; // 🔧 Declaração antecipada para evitar ReferenceError
  
  console.log('\n\n===== [DEBUG-PIPELINE-GENRE] Início do pipeline (WORK) =====');
  console.log('mode:', options?.mode);
  console.log('genre (options.genre):', options?.genre);
  console.log('finalGenre:', options?.finalGenre);
  console.log('selectedGenre:', options?.selectedGenre);
  console.log('genreTargets keys:', options?.genreTargets ? Object.keys(options.genreTargets) : null);
  console.log('jobId:', jobId);
  console.log('=====================================================\n\n');
  
  console.log(`🚀 [${jobId.substring(0,8)}] Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 [${jobId.substring(0,8)}] Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 [${jobId.substring(0,8)}] Opções:`, options);
  
  // 🔥 LOG OBRIGATÓRIO: ENTRADA DO PIPELINE
  console.log('[GENRE-TRACE][PIPELINE-INPUT]', {
    jobId: jobId.substring(0, 8),
    incomingGenre: options.genre,
    incomingTargets: options.genreTargets ? Object.keys(options.genreTargets) : null,
    mode: options.mode
  });
  
  // PASSO 2: GARANTIR QUE O MODO NÃO VAZA PARA REFERÊNCIA
  console.log('[MODE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[MODE-FLOW] MODO DETECTADO:', options.mode || 'genre');
  console.log('[MODE-FLOW] GENRE DETECTADO:', options.genre || '(null)');
  console.log('[MODE-FLOW] referenceJobId:', options.referenceJobId || 'null');
  console.log('[MODE-FLOW] isReferenceBase:', options.isReferenceBase || false);
  console.log('[MODE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
      const mode = options.mode || 'genre';
      const isGenreMode = mode === 'genre';
      
      // 🔥 LOG CIRÚRGICO: ANTES de resolver genre (JSON Output)
      console.log('[GENRE-DEEP-TRACE][PIPELINE-JSON-PRE]', {
        ponto: 'pipeline-complete.js linha ~197 - ANTES resolução',
        'options.genre': options.genre,
        'options.data?.genre': options.data?.genre,
        'options.genre_detected': options.genre_detected,
        'isGenreMode': isGenreMode
      });
      
      // 🎯 CORREÇÃO: Resolver genre baseado no modo
      let resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;

      // 🚨 BLINDAGEM ABSOLUTA BUG #1: Modo genre exige gênero válido SEMPRE
      if (isGenreMode && (!resolvedGenre || resolvedGenre === 'default')) {
        console.error('[PIPELINE-ERROR] Modo genre recebeu options.genre inválido:', {
          optionsGenre: options.genre,
          dataGenre: options.data?.genre,
          mode: options.mode,
          isGenreMode
        });
        throw new Error('[GENRE-ERROR] Pipeline recebeu modo genre SEM gênero válido - NUNCA usar default');
      }

      detectedGenre = isGenreMode
        ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
        : (options.genre || 'default');

      // 🚨 LOG DE AUDITORIA
      console.log('[AUDIT-PIPELINE] Genre resolvido:', {
        isGenreMode,
        resolvedGenre,
        detectedGenre,
        optionsGenre: options.genre
      });
      
      // 🔥 LOG CIRÚRGICO: DEPOIS de resolver genre (JSON Output)
      console.log('[GENRE-DEEP-TRACE][PIPELINE-JSON-POST]', {
        ponto: 'pipeline-complete.js linha ~197 - DEPOIS resolução',
        'resolvedGenre': resolvedGenre,
        'detectedGenre': detectedGenre,
        'isNull': detectedGenre === null,
        'isDefault': detectedGenre === 'default'
      });
      
      console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 195):', {
        'options.genre': options.genre,
        'detectedGenre': detectedGenre,
        'isDefault': detectedGenre === 'default',
        'mode': mode,
        'isGenreMode': isGenreMode
      });
      
      // 🔥 CARREGAR TARGETS DO FILESYSTEM (ANTES de usar)
      if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
        // 🎯 PRIORIZAR TARGETS OFICIAIS DO FILESYSTEM (formato interno completo)
        console.log('[TARGET-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[TARGET-DEBUG] ANTES DE CARREGAR TARGETS:');
        console.log('[TARGET-DEBUG] detectedGenre:', detectedGenre);
        console.log('[TARGET-DEBUG] options.genreTargets (ignorado):', options.genreTargets ? 'presente mas será ignorado' : 'null');
        console.log('[TARGET-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 🔥 CORREÇÃO CIRÚRGICA: SEMPRE carregar do filesystem
        // options.genreTargets vem do frontend com APENAS bands (incompleto)
        // loadGenreTargets retorna formato interno completo: { lufs, truePeak, dr, stereo, bands... }
        customTargets = await loadGenreTargets(detectedGenre);
        
        // 🔧 LOGS DE DEPURAÇÃO (após carregamento)
        console.log('[TARGET-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[TARGET-DEBUG] DEPOIS DE CARREGAR TARGETS:');
        console.log('[TARGET-DEBUG] customTargets:', customTargets ? 'presente' : 'NULL');
        if (customTargets) {
          console.log('[TARGET-DEBUG] customTargets keys:', Object.keys(customTargets));
          console.log('[TARGET-DEBUG] customTargets.lufs:', customTargets.lufs);
          console.log('[TARGET-DEBUG] customTargets.dr:', customTargets.dr);
          console.log('[GENRE-TARGETS-PATCH-V2] customTargets carregado do filesystem');
          console.log('[GENRE-TARGETS-PATCH-V2] keys:', Object.keys(customTargets));
          console.log('[GENRE-TARGETS-PATCH-V2] lufs:', customTargets.lufs);
          console.log('[GENRE-TARGETS-PATCH-V2] truePeak:', customTargets.truePeak);
        }
        console.log('[TARGET-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // ❌ VALIDAÇÃO OBRIGATÓRIA: customTargets DEVE existir
        if (!customTargets) {
          const errorMsg = `❌ ERRO CRÍTICO: customTargets não carregado para gênero "${detectedGenre}". Arquivo JSON não encontrado ou inválido.`;
          console.error(`[SUGGESTIONS_V1] ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        console.log(`[SUGGESTIONS_V1] ✅ Usando targets de ${detectedGenre} do filesystem (formato interno completo)`);
      } else if (mode === 'reference') {
        console.log(`[SUGGESTIONS_V1] 🔒 Modo referência - ignorando targets de gênero`);
      }
      
      console.log('[GENRE-TARGETS-PATCH-V2] ----------');
      console.log('[GENRE-TARGETS-PATCH-V2] customTargets presente?', !!customTargets);
      if (customTargets) {
        console.log('[GENRE-TARGETS-PATCH-V2] keys:', Object.keys(customTargets));
        console.log('[GENRE-TARGETS-PATCH-V2] lufs:', customTargets.lufs);
        console.log('[GENRE-TARGETS-PATCH-V2] truePeak:', customTargets.truePeak);
        console.log('[GENRE-TARGETS-PATCH-V2] dr:', customTargets.dr);
      }
      console.log('[GENRE-TARGETS-PATCH-V2] usando:', customTargets ? 'customTargets (completo)' : 'options.genreTargets (fallback)');
      console.log('[GENRE-TARGETS-PATCH-V2] ----------');
      
      finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
        jobId, 
        fileName,
        mode: mode,
        genre: detectedGenre,
        genreTargets: customTargets || options.genreTargets,
        referenceJobId: options.referenceJobId
      });
      
      console.log('[GENRE-FLOW][PIPELINE] ✅ Genre adicionado ao finalJSON:', {
        genre: finalJSON.genre,
        mode: finalJSON.mode
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

    // ========= FASE 5.4.1: SUGESTÕES BASE (V1) - FAIL-FAST MODE =========
    // 🎯 CARREGAR TARGETS DO FILESYSTEM (APENAS MODO GÊNERO)
    const mode = options.mode || 'genre';
    const isGenreMode = mode === 'genre';
    
    // 🔥 LOG CIRÚRGICO: ANTES de resolver genre (Suggestions V1)
    console.log('[GENRE-DEEP-TRACE][PIPELINE-V1-PRE]', {
      ponto: 'pipeline-complete.js linha ~260 - ANTES resolução V1',
      'options.genre': options.genre,
      'options.data?.genre': options.data?.genre,
      'isGenreMode': isGenreMode
    });
    
    // 🎯 CORREÇÃO: Resolver genre baseado no modo
    const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
    detectedGenre = isGenreMode
      ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
      : (options.genre || 'default');
    
    // 🔥 LOG CIRÚRGICO: DEPOIS de resolver genre (Suggestions V1)
    console.log('[GENRE-DEEP-TRACE][PIPELINE-V1-POST]', {
      ponto: 'pipeline-complete.js linha ~260 - DEPOIS resolução V1',
      'resolvedGenre': resolvedGenre,
      'detectedGenre': detectedGenre,
      'isNull': detectedGenre === null,
      'isDefault': detectedGenre === 'default'
    });
    
    console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 246):', {
      'options.genre': options.genre,
      'detectedGenre': detectedGenre,
      'isDefault': detectedGenre === 'default',
      'mode': mode,
      'isGenreMode': isGenreMode
    });
    
    console.log('[GENRE-FLOW][PIPELINE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-FLOW][PIPELINE] 📊 Contexto recebido:');
    console.log('[GENRE-FLOW][PIPELINE] mode:', mode);
    console.log('[GENRE-FLOW][PIPELINE] detectedGenre:', detectedGenre);
    console.log('[GENRE-FLOW][PIPELINE] options.genre:', options.genre);
    console.log('[GENRE-FLOW][PIPELINE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('[SUGGESTIONS_V1] 📊 Contexto:', {
      mode,
      detectedGenre,
      hasCoreMetrics: !!coreMetrics,
      coreMetricsKeys: Object.keys(coreMetrics || {})
    });
    
    // 🛡️ BLINDAGEM PRIMÁRIA CORRIGIDA: Preservar genre correto, sem fallback 'default'
    // 🔥 PATCH 2: RESOLVER CORRETAMENTE O GÊNERO PARA O ANALYZER
    const genreFromData =
      options.genre ||
      options.data?.genre ||
      options.data?.targets?.genre ||
      options.data?.genre_detected ||
      null;
    
    const genreForAnalyzer = genreFromData || detectedGenre || finalJSON?.genre || null;
    const finalGenreForAnalyzer = genreForAnalyzer || detectedGenre || options.genre || 'default';
    
    // 🧠 FASE 5.4.1 – Análise de problemas e sugestões V2 (fail-fast)
    console.log('[DEBUG-SUGGESTIONS] =================================================');
    console.log('[DEBUG-SUGGESTIONS] Entrando na FASE 5.4.1 – analyzeProblemsAndSuggestionsV2');
    console.log('[DEBUG-SUGGESTIONS] finalGenreForAnalyzer:', finalGenreForAnalyzer);
    console.log('[DEBUG-SUGGESTIONS] has customTargets?', !!customTargets);
    console.log('[DEBUG-SUGGESTIONS] customTargets keys:', customTargets ? Object.keys(customTargets) : 'null');
    console.log('[DEBUG-SUGGESTIONS] coreMetrics keys:', coreMetrics ? Object.keys(coreMetrics) : 'null');
    console.log('[DEBUG-SUGGESTIONS] coreMetrics.lufs?.integrated:', coreMetrics?.lufs?.integrated);
    console.log('[DEBUG-SUGGESTIONS] coreMetrics.dynamics?.dynamicRange:', coreMetrics?.dynamics?.dynamicRange);
    console.log('[DEBUG-SUGGESTIONS] =================================================');
    
    try {
      const problemsAndSuggestions = analyzeProblemsAndSuggestionsV2(
        coreMetrics,
        finalGenreForAnalyzer,
        customTargets
      );
      
      console.log('[DEBUG-SUGGESTIONS] ✅ analyzeProblemsAndSuggestionsV2 retornou com sucesso');
      console.log('[DEBUG-SUGGESTIONS] problems length:', problemsAndSuggestions?.problems?.length || 0);
      console.log('[DEBUG-SUGGESTIONS] suggestions length:', problemsAndSuggestions?.suggestions?.length || 0);
      console.log('[DEBUG-SUGGESTIONS] aiSuggestions length:', problemsAndSuggestions?.aiSuggestions?.length || 0);
      
      // Garantir que o resultado seja atribuído corretamente no finalJSON
      if (problemsAndSuggestions) {
        finalJSON.problemsAnalysis = {
          problems: problemsAndSuggestions.problems || [],
          suggestions: problemsAndSuggestions.suggestions || [],
          qualityAssessment: problemsAndSuggestions.qualityAssessment || {},
          priorityRecommendations: problemsAndSuggestions.priorityRecommendations || []
        };
        
        finalJSON.diagnostics = {
          problems: problemsAndSuggestions.diagnostics?.problems || [],
          suggestions: problemsAndSuggestions.diagnostics?.suggestions || [],
          prioritized: problemsAndSuggestions.diagnostics?.prioritized || []
        };
        
        finalJSON.suggestions = problemsAndSuggestions.suggestions || [];
        finalJSON.aiSuggestions = problemsAndSuggestions.aiSuggestions || [];
        
        finalJSON.summary = problemsAndSuggestions.summary || {
          overallRating: 'Análise não disponível',
          score: 0,
          genre: finalGenreForAnalyzer
        };
        
        finalJSON.suggestionMetadata = problemsAndSuggestions.metadata || {
          totalSuggestions: finalJSON.suggestions.length,
          criticalCount: 0,
          warningCount: 0,
          okCount: 0,
          analysisDate: new Date().toISOString(),
          genre: finalGenreForAnalyzer,
          version: '2.0.0'
        };
        
        // 🛡️ BLINDAGEM IMEDIATA V1: Forçar genre correto em summary/metadata
        if (detectedGenre) {
          if (finalJSON.summary && typeof finalJSON.summary === 'object') {
            finalJSON.summary.genre = detectedGenre;
          }
          if (finalJSON.suggestionMetadata && typeof finalJSON.suggestionMetadata === 'object') {
            finalJSON.suggestionMetadata.genre = detectedGenre;
          }
          console.log('[GENRE-BLINDAGEM-V1] Genre forçado em V1:', detectedGenre);
        }
      } else {
        console.warn('[DEBUG-SUGGESTIONS] ⚠️ analyzeProblemsAndSuggestionsV2 retornou null/undefined. Mantendo estruturas atuais.');
      }
      
    } catch (suggestionsError) {
      console.error('[SUGGESTIONS_V2] ❌ ERRO CRÍTICO ao gerar sugestões base');
      console.error('[SUGGESTIONS_V2] Mensagem:', suggestionsError.message);
      console.error('[SUGGESTIONS_V2] Stack:', suggestionsError.stack);
      console.error('[SUGGESTIONS_V2] Contexto:', {
        finalGenreForAnalyzer,
        hasCustomTargets: !!customTargets,
        customTargetsKeys: customTargets ? Object.keys(customTargets) : 'null',
        coreMetricsKeys: coreMetrics ? Object.keys(coreMetrics) : 'null',
      });
      
      // ❌ NÃO zerar mais summary/metadata/suggestions aqui.
      // Queremos que o erro suba para o worker e o job falhe,
      // para podermos ver a causa raiz nos logs.
      
      throw suggestionsError;
    }
    
    // 🔥 PATCH 3: GARANTIR QUE finalJSON TENHA genre NO TOPO ANTES DE RETORNAR
    if (!finalJSON.genre) {
      const genreFromData =
        options.genre ||
        options.data?.genre ||
        detectedGenre ||
        finalJSON.summary?.genre ||
        finalJSON.suggestionMetadata?.genre ||
        null;
      
      finalJSON.genre = genreFromData || finalGenreForAnalyzer || null;
      console.log('[AUDIT-FIX] finalJSON.genre antes de enviar para o worker:', finalJSON.genre);
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
      const referenceJobId = options.referenceJobId;
      const isReferenceBase = options.isReferenceBase === true; // 🔧 FIX: Flag do frontend
      
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📊 Parâmetros:`, {
        genre,
        mode,
        hasReferenceJobId: !!referenceJobId,
        referenceJobId: referenceJobId,
        isReferenceBase: isReferenceBase // 🔧 FIX: Log da flag
      });
      
      console.log(`[AI-AUDIT][FLOW-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][FLOW-CHECK] 🔍 VALIDAÇÃO DE FLUXO DE EXECUÇÃO`);
      console.log(`[AI-AUDIT][FLOW-CHECK] mode === 'genre'?`, mode === 'genre');
      console.log(`[AI-AUDIT][FLOW-CHECK] isReferenceBase === true?`, isReferenceBase === true);
      console.log(`[AI-AUDIT][FLOW-CHECK] isReferenceBase === false?`, isReferenceBase === false);
      console.log(`[AI-AUDIT][FLOW-CHECK] isReferenceBase === undefined?`, isReferenceBase === undefined);
      console.log(`[AI-AUDIT][FLOW-CHECK] mode === 'reference'?`, mode === 'reference');
      console.log(`[AI-AUDIT][FLOW-CHECK] hasReferenceJobId?`, !!referenceJobId);
      console.log(`[AI-AUDIT][FLOW-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      
      // ========= NOVO SISTEMA DE SUGESTÕES V2 =========
      // ⚠️ IMPORTANTE: V1 já gerou suggestions base na fase 5.4.1
      // V2 aqui serve para complementar V1 no modo gênero
      
      console.log('[V2-SYSTEM] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[V2-SYSTEM] 🎯 Executando Motor V2 para complementar V1');
      console.log('[V2-SYSTEM] mode:', mode, 'isReferenceBase:', isReferenceBase);
      console.log('[V2-SYSTEM] V1 já gerou:', finalJSON.suggestions?.length || 0, 'sugestões');
      
      // 🎯 CARREGAR TARGETS DO FILESYSTEM (APENAS MODO GÊNERO)
      // 🔥 LOG CIRÚRGICO: ANTES de resolver genre (Suggestions V2)
      console.log('[GENRE-DEEP-TRACE][PIPELINE-V2-PRE]', {
        ponto: 'pipeline-complete.js linha ~400 - ANTES resolução V2',
        'options.genre': options.genre,
        'options.data?.genre': options.data?.genre,
        'mode': mode
      });
      
      // 🎯 CORREÇÃO: Resolver genre baseado no modo (reutilizar lógica)
      const resolvedGenreV2 = options.genre || options.data?.genre || options.genre_detected || null;
      const detectedGenreV2 = (mode === 'genre')
        ? (resolvedGenreV2 ? String(resolvedGenreV2).trim() || null : null)
        : (options.genre || 'default');
      
      // 🔥 LOG CIRÚRGICO: DEPOIS de resolver genre (Suggestions V2)
      console.log('[GENRE-DEEP-TRACE][PIPELINE-V2-POST]', {
        ponto: 'pipeline-complete.js linha ~400 - DEPOIS resolução V2',
        'resolvedGenreV2': resolvedGenreV2,
        'detectedGenreV2': detectedGenreV2,
        'isNull': detectedGenreV2 === null,
        'isDefault': detectedGenreV2 === 'default'
      });
      
      let customTargetsV2 = null;
      
      console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 376):', {
        'options.genre': options.genre,
        'detectedGenreV2': detectedGenreV2,
        'isDefault': detectedGenreV2 === 'default',
        'mode': mode
      });
      
      if (mode !== 'reference' && detectedGenreV2 && detectedGenreV2 !== 'default') {
        // 🎯 PRIORIZAR TARGETS OFICIAIS DO FILESYSTEM (formato interno completo)
        // 🔥 CORREÇÃO CIRÚRGICA: SEMPRE carregar do filesystem
        // options.genreTargets vem do frontend com APENAS bands (incompleto)
        // loadGenreTargets retorna formato interno completo: { lufs, truePeak, dr, stereo, bands... }
        customTargetsV2 = await loadGenreTargets(detectedGenreV2);
        
        if (customTargetsV2) {
          console.log(`[V2-SYSTEM] 📂 Usando targets de ${detectedGenreV2} do filesystem (formato interno completo)`);
        } else {
          console.log(`[V2-SYSTEM] 📋 Usando targets hardcoded para ${detectedGenreV2}`);
        }
      } else if (mode === 'reference') {
        console.log(`[V2-SYSTEM] 🔒 Modo referência - ignorando targets de gênero`);
      }
      
      // 🔧 REINTEGRAÇÃO DO MOTOR V2
      console.log('[V2-SYSTEM] 🔍 Validando coreMetrics antes de gerar V2...');
      if (!coreMetrics || typeof coreMetrics !== 'object') {
        throw new Error('coreMetrics inválido para Motor V2');
      }
      
      // 🛡️ BLINDAGEM PRIMÁRIA V2: Garantir que genre NUNCA seja null
      const genreForAnalyzerV2 =
        options.genre ||
        options.data?.genre ||
        detectedGenreV2 ||
        finalJSON?.genre ||
        'default';
      
      console.log('[GENRE-BLINDAGEM-V2] genreForAnalyzerV2:', genreForAnalyzerV2);
      
      const v2 = analyzeProblemsAndSuggestionsV2(coreMetrics, genreForAnalyzerV2, customTargetsV2);
      
      const v2Suggestions = v2.suggestions || [];
      const v2Problems = v2.problems || [];
      const v2Summary = v2.summary || {};
      const v2Metadata = v2.metadata || {};
      
      // PASSO 5: LOGS PARA VALIDAÇÃO DO MOTOR V2
      console.log('[SUGGESTIONS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[SUGGESTIONS] V2 count:', v2Suggestions.length);
      console.log('[SUGGESTIONS] V2 sample:', v2Suggestions[0]);
      console.log('[V2-SYSTEM] 📊 Dados do V2:', {
        suggestions: v2Suggestions.length,
        problems: v2Problems.length,
        hasMetadata: !!Object.keys(v2Metadata).length,
        hasSummary: !!Object.keys(v2Summary).length
      });
      console.log('[SUGGESTIONS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🛡️ GUARDIÃO: Primeira música da referência NÃO gera sugestões absolutas
      if (mode === 'genre' && isReferenceBase === true) {
        console.log('[V2-SYSTEM] Primeira música da referência - mantemos json neutro, mas NÃO apagamos sugestões futuras');
        // Não gera V2 e não gera AI aqui. Apenas deixa como está.
      } else if (mode === 'genre' && isReferenceBase !== true) {
        // ✅ MODO GÊNERO: Aplicar Motor V2 ao JSON final
        console.log('[SUGGESTIONS_V2] ✔ Aplicando Motor V2 ao JSON final');
        const v1Count = finalJSON.suggestions?.length || 0;
        
        // 🚨 CORREÇÃO: Não duplicar sugestões se V1 e V2 retornaram o mesmo
        // V1 e V2 chamam a mesma função com os mesmos parâmetros, então só usar V2
        finalJSON.suggestions = v2Suggestions;
        finalJSON.problemsAnalysis.suggestions = v2Suggestions;
        finalJSON.diagnostics.suggestions = v2Suggestions;
        
        // 🔥 LOG CIRÚRGICO: ANTES de forçar genre em summary/metadata
        console.log('[GENRE-DEEP-TRACE][SUMMARY-METADATA-PRE]', {
          ponto: 'pipeline-complete.js linha ~535 - ANTES forçar summary/metadata',
          'detectedGenre (usado para forçar)': detectedGenreV2,
          'v2Summary.genre': v2Summary?.genre,
          'v2Metadata.genre': v2Metadata?.genre,
          'finalJSON.genre': finalJSON.genre
        });
        
        // ✅ CORREÇÃO CRÍTICA: Garantir que genre seja propagado para summary e metadata
        finalJSON.summary = {
          ...v2Summary,
          genre: detectedGenreV2  // ← FORÇAR GÊNERO CORRETO
        };
        finalJSON.suggestionMetadata = {
          ...v2Metadata,
          genre: detectedGenreV2  // ← FORÇAR GÊNERO CORRETO
        };
        
        // 🔥 LOG CIRÚRGICO: DEPOIS de forçar genre em summary/metadata
        console.log('[GENRE-DEEP-TRACE][SUMMARY-METADATA-POST]', {
          ponto: 'pipeline-complete.js linha ~535 - DEPOIS forçar summary/metadata',
          'finalJSON.summary.genre': finalJSON.summary?.genre,
          'finalJSON.suggestionMetadata.genre': finalJSON.suggestionMetadata?.genre,
          'finalJSON.genre': finalJSON.genre
        });
        
        console.log('[GENRE-FLOW][PIPELINE] ✅ Summary e Metadata atualizados com genre:', detectedGenreV2);
        
        // 🛡️ BLINDAGEM FINAL: Garantir que genre correto sobreviva ao merge
        // 🔥 CORREÇÃO CRÍTICA ROOT CAUSE: Priorizar SEMPRE options.genre (vem do usuário)
        // NUNCA ler finalJSON.genre ou detectedGenreV2 se options.genre existir
        const safeGenre = (
          options.genre ||
          options.data?.genre ||
          null
        );
        
        finalJSON.genre = safeGenre;
        
        if (finalJSON.summary) {
          finalJSON.summary.genre = safeGenre;
        }
        
        if (finalJSON.metadata) {
          finalJSON.metadata.genre = safeGenre;
        }
        
        if (finalJSON.suggestionMetadata) {
          finalJSON.suggestionMetadata.genre = safeGenre;
        }
        
        console.log('[GENRE-BLINDAGEM-FINAL] Genre blindado:', safeGenre);
        
        // PASSO 5: LOGS PARA VALIDAÇÃO FINAL
        console.log('[SUGGESTIONS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[SUGGESTIONS] V1 original count:', v1Count);
        console.log('[SUGGESTIONS] V2 adicionado count:', v2Suggestions.length);
        console.log('[SUGGESTIONS] Final count:', finalJSON.suggestions.length);
        console.log('[SUGGESTIONS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`[V2-SYSTEM] ✅ V2 integrado: ${v2Suggestions.length} sugestões adicionadas`);
        console.log(`[V2-SYSTEM] 📊 Total suggestions: ${finalJSON.suggestions.length}`);
      } else {
        // Modo reference - ignora V1 e V2 (usa apenas comparação)
        console.log('[V2-SYSTEM] Modo reference - ignorando V1 e V2');
      }
      
      // 🤖 ENRIQUECIMENTO IA OBRIGATÓRIO - MODO GENRE
      // ✅ REGRA: SEMPRE enriquecer sugestões, NUNCA pular esta etapa
      console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA (modo genre)...');
      console.log('[AI-AUDIT][ULTRA_DIAG] Sugestões base count:', finalJSON.suggestions?.length || 0);
      
      // ❌ VALIDAÇÃO: Garantir que há sugestões para enriquecer
      if (!finalJSON.suggestions || finalJSON.suggestions.length === 0) {
        console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Nenhuma sugestão base para enriquecer - criando fallback');
        finalJSON.suggestions = [{
          metric: 'info',
          severity: 'info',
          message: 'Mixagem dentro dos padrões',
          action: 'Nenhum ajuste crítico necessário',
          priority: 0
        }];
      }
      
      try {
        const aiContext = {
          genre: finalGenreForAnalyzer,
          mode: mode || 'genre',
          userMetrics: coreMetrics,
          referenceMetrics: null,
          referenceComparison: null,
          fileName: fileName || metadata?.fileName || 'unknown',
          referenceFileName: null,
          deltas: null,
          customTargets: customTargets // ✅ Passar targets para IA validar
        };
        
        finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, aiContext);
        
        // ❌ VALIDAÇÃO CRÍTICA: IA DEVE retornar sugestões
        if (!finalJSON.aiSuggestions || finalJSON.aiSuggestions.length === 0) {
          throw new Error('enrichSuggestionsWithAI retornou array vazio ou null');
        }
        
        console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ IA retornou ${finalJSON.aiSuggestions.length} sugestões enriquecidas`);
      } catch (aiError) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ ERRO CRÍTICO ao executar enrichSuggestionsWithAI:', aiError.message);
        console.error('[AI-AUDIT][ULTRA_DIAG] Stack:', aiError.stack);
        
        // ✅ FALLBACK OBRIGATÓRIO: Manter sugestões base com flag de erro
        finalJSON.aiSuggestions = finalJSON.suggestions.map(sug => ({
          ...sug,
          aiEnhanced: false,
          enrichmentStatus: 'error',
          enrichmentError: aiError.message,
          problema: sug.message || 'Problema não especificado',
          causaProvavel: 'Enriquecimento IA falhou',
          solucao: sug.action || 'Consulte sugestão base'
        }));
        
        console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Usando fallback: sugestões base sem enriquecimento');
      }
      
      console.log('[V2-SYSTEM] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[V2-SYSTEM] 📊 Resultado final:', {
        suggestions: finalJSON.suggestions?.length || 0,
        aiSuggestions: finalJSON.aiSuggestions?.length || 0,
        problems: finalJSON.problems?.length || 0
      });
      
      // ✅ MODO REFERENCE: Comparar com análise de referência
      // 🔒 SEGURANÇA: Só criar referenceComparison quando for REALMENTE modo reference E tiver referenceJobId
      if (mode === "reference" && referenceJobId) {
        console.log("[REFERENCE-MODE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("[REFERENCE-MODE] 🎯 MODO REFERENCE ATIVADO");
        console.log("[REFERENCE-MODE] ReferenceJobId:", options.referenceJobId);
        console.log("[REFERENCE-MODE] ✅ Condições: mode='reference' + referenceJobId presente");
        console.log("[REFERENCE-MODE] ⚠️ V1 e V2 serão IGNORADOS - apenas comparação A/B");
        console.log("[REFERENCE-MODE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // 🔍 AUDITORIA PONTO 1: Confirmação de contexto inicial
        console.log('[AI-AUDIT][REF] 🔍 referenceJobId detectado:', options.referenceJobId);
        console.log('[AI-AUDIT][REF] 🔍 mode inicial:', mode);
        
        try {
          const refJob = await pool.query("SELECT COALESCE(result, results) AS result FROM jobs WHERE id = $1", [options.referenceJobId]);
          
          if (refJob.rows.length > 0) {
            const refData = typeof refJob.rows[0].result === "string"
              ? JSON.parse(refJob.rows[0].result)
              : refJob.rows[0].result;
            
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
            
            // 🔍 AUDITORIA PONTO 2: Persistência do objeto de comparação
            console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[AI-AUDIT][REF] 📦 OBJETO referenceComparison CRIADO E SALVO');
            console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[AI-AUDIT][REF] Contexto de comparação salvo:', !!referenceComparison);
            console.log('[AI-AUDIT][REF] Campos em finalJSON:', {
              hasReferenceComparison: !!finalJSON.referenceComparison,
              hasReferenceJobId: !!finalJSON.referenceJobId,
              hasReferenceFileName: !!finalJSON.referenceFileName,
              referenceComparisonKeys: Object.keys(referenceComparison || {}),
              sampleDelta: referenceComparison?.lufs?.delta
            });
            console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
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
              
              // 🔍 AUDITORIA PONTO 3: Verificação antes do enrich
              console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('[AI-AUDIT][REF] 🤖 PRÉ-ENRICH: Verificando contexto');
              console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('[AI-AUDIT][REF] Mode antes do enrich:', mode);
              console.log('[AI-AUDIT][REF] referenceComparison existe?', !!referenceComparison);
              console.log('[AI-AUDIT][REF] referenceComparison em finalJSON?', !!finalJSON.referenceComparison);
              console.log('[AI-AUDIT][REF] Será enviado para enrichSuggestionsWithAI:', {
                hasReferenceComparison: !!referenceComparison,
                referenceComparisonKeys: Object.keys(referenceComparison || {}),
                mode: mode || 'reference'
              });
              console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              
              console.log('[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando para IA com contexto de comparação...');
              
              // 🤖 ENRIQUECIMENTO IA ULTRA V2 - MODO REFERENCE COM COMPARAÇÃO
              try {
                const aiContext = {
                  genre: finalGenreForAnalyzer,
                  mode: 'reference',
                  userMetrics: coreMetrics,
                  referenceMetrics: refData,
                  referenceComparison: referenceComparison,
                  fileName: fileName || metadata?.fileName || 'unknown',
                  referenceFileName: refData?.fileName || refData?.metadata?.fileName,
                  deltas: referenceComparison
                };
                
                finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, aiContext);
                
                console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ IA retornou ${finalJSON.aiSuggestions.length} sugestões enriquecidas`);
              } catch (aiError) {
                console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
                console.error('[AI-AUDIT][ULTRA_DIAG] Stack:', aiError.stack);
                finalJSON.aiSuggestions = finalJSON.suggestions.map(sug => ({
                  ...sug,
                  aiEnhanced: false,
                  enrichmentStatus: 'error',
                  enrichmentError: aiError.message
                }));
              }
            } catch (aiError) {
              console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Erro ao processar referência:', aiError.message);
              finalJSON.aiSuggestions = finalJSON.suggestions.map(sug => ({
                ...sug,
                aiEnhanced: false,
                enrichmentStatus: 'outer_error',
                enrichmentError: aiError.message
              }));
            }
          } else {
            console.warn("[REFERENCE-MODE] ⚠️ Job de referência não encontrado - gerando sugestões genéricas");
            finalJSON.suggestions = generateAdvancedSuggestionsFromScoring(coreMetrics, coreMetrics.scoring, genre, mode);
            
            // � LOG DE DIAGNÓSTICO: Sugestões base geradas (fallback)
            console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas (fallback): ${finalJSON.suggestions.length} itens`);
            
            // �🔮 ENRIQUECIMENTO IA ULTRA V2 (fallback mode)
            try {
              console.log('[AI-AUDIT][FALLBACK] Suggestions base prontas, IA sera processada de forma assincrona');
              finalJSON.aiSuggestions = [];
            } catch (aiError) {
              console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI:', aiError.message);
              finalJSON.aiSuggestions = [];
            }
          }
        } catch (refError) {
          console.error("[REFERENCE-MODE] ❌ Erro ao buscar referência:", refError.message);
          console.warn("[REFERENCE-MODE] Gerando sugestões avançadas como fallback");
          console.log('[REFERENCE-MODE-ERROR-FALLBACK] 🚀 Usando sistema avançado de sugestões com scoring.penalties');
          finalJSON.suggestions = generateAdvancedSuggestionsFromScoring(coreMetrics, coreMetrics.scoring, genre, mode);
          
          // 🔍 LOG DE DIAGNÓSTICO: Sugestões avançadas geradas (error fallback)
          console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões avançadas detectadas (error fallback): ${finalJSON.suggestions.length} itens`);
          
          // 🤖 ENRIQUECIMENTO IA ULTRA V2 (error fallback)
          try {
            console.log('[AI-AUDIT][ERROR-FALLBACK] 🚀 Enviando para IA (error fallback)...');
            
            const aiContext = {
              genre: finalGenreForAnalyzer,
              mode: 'reference',
              userMetrics: coreMetrics,
              referenceMetrics: null,
              referenceComparison: null,
              fileName: fileName || metadata?.fileName || 'unknown',
              referenceFileName: null,
              deltas: null
            };
            
            finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, aiContext);
            
            console.log(`[AI-AUDIT][ERROR-FALLBACK] ✅ IA retornou ${finalJSON.aiSuggestions.length} sugestões`);
          } catch (aiError) {
            console.error('[AI-AUDIT][ERROR-FALLBACK] ❌ Erro no enriquecimento IA:', aiError.message);
            finalJSON.aiSuggestions = finalJSON.suggestions.map(sug => ({
              ...sug,
              aiEnhanced: false,
              enrichmentStatus: 'error',
              enrichmentError: aiError.message
            }));
          }
        }
      }
      
      // 🔒 GARANTIA ADICIONAL: Remover referenceComparison se não for modo reference
      if (mode !== "reference" && finalJSON.referenceComparison) {
        console.log("[SECURITY] ⚠️ referenceComparison detectado em modo não-reference - removendo!");
        console.log("[SECURITY] mode atual:", mode);
        console.log("[SECURITY] isReferenceBase:", isReferenceBase);
        delete finalJSON.referenceComparison;
        delete finalJSON.referenceJobId;
        delete finalJSON.referenceFileName;
        console.log("[SECURITY] ✅ referenceComparison removido - modo gênero limpo");
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
      
      // 🔥 LOG ADICIONAL: Confirmar se algum array está vazio quando não deveria
      if (mode === 'genre' && !isReferenceBase) {
        if (!finalJSON.suggestions || finalJSON.suggestions.length === 0) {
          console.error(`[AI-AUDIT][CRITICAL] ❌❌❌ SUGGESTIONS VAZIO EM MODO GENRE!`);
          console.error(`[AI-AUDIT][CRITICAL] Isso indica que generateAdvancedSuggestionsFromScoring falhou`);
        }
        if (!finalJSON.aiSuggestions || finalJSON.aiSuggestions.length === 0) {
          console.error(`[AI-AUDIT][CRITICAL] ❌❌❌ AI_SUGGESTIONS VAZIO EM MODO GENRE!`);
          console.error(`[AI-AUDIT][CRITICAL] Isso indica que enrichSuggestionsWithAI falhou ou não foi chamado`);
        }
      }
      
      if (mode === 'reference' && referenceJobId) {
        if (!finalJSON.suggestions || finalJSON.suggestions.length === 0) {
          console.error(`[AI-AUDIT][CRITICAL] ❌❌❌ SUGGESTIONS VAZIO EM MODO REFERENCE!`);
          console.error(`[AI-AUDIT][CRITICAL] Isso indica que generateComparisonSuggestions falhou`);
        }
        if (!finalJSON.aiSuggestions || finalJSON.aiSuggestions.length === 0) {
          console.error(`[AI-AUDIT][CRITICAL] ❌❌❌ AI_SUGGESTIONS VAZIO EM MODO REFERENCE!`);
          console.error(`[AI-AUDIT][CRITICAL] Isso indica que enrichSuggestionsWithAI falhou ou não foi chamado`);
        }
      }
      
      console.log(`[AI-AUDIT][ASSIGN.inputType] suggestions:`, typeof finalJSON.suggestions, Array.isArray(finalJSON.suggestions));
      console.log(`[AI-AUDIT][ASSIGN.sample]`, finalJSON.suggestions?.slice(0, 2));
      
    } catch (error) {
      // 🔧 FIX: Remover catch que zerava aiSuggestions silenciosamente
      // Qualquer erro REAL deve ser propagado, mas garantir arrays vazios
      console.error(`[SUGGESTIONS_ERROR] ❌ ERRO CRÍTICO ao gerar sugestões:`, error.message);
      console.error(`[SUGGESTIONS_ERROR] ❌ Stack:`, error.stack);
      
      // Garantir arrays vazios em caso de erro REAL
      if (!Array.isArray(finalJSON.suggestions)) {
        finalJSON.suggestions = [];
      }
      if (!Array.isArray(finalJSON.aiSuggestions)) {
        // 🤖 Tentar enriquecer mesmo com erro (se há suggestions base)
        if (finalJSON.suggestions.length > 0) {
          try {
            console.log('[AI-AUDIT][CATCH] 🚀 Tentando enriquecer após erro...');
            const aiContext = {
              genre: finalGenreForAnalyzer || 'default',
              mode: mode || 'genre',
              userMetrics: coreMetrics,
              referenceMetrics: null,
              referenceComparison: null,
              fileName: fileName || metadata?.fileName || 'unknown',
              referenceFileName: null,
              deltas: null
            };
            finalJSON.aiSuggestions = await enrichSuggestionsWithAI(finalJSON.suggestions, aiContext);
            console.log(`[AI-AUDIT][CATCH] ✅ IA retornou ${finalJSON.aiSuggestions.length} sugestões`);
          } catch (aiError) {
            console.error('[AI-AUDIT][CATCH] ❌ Falha final ao enriquecer:', aiError.message);
            finalJSON.aiSuggestions = [];
          }
        } else {
          finalJSON.aiSuggestions = [];
        }
      }
      if (!finalJSON.problemsAnalysis || typeof finalJSON.problemsAnalysis !== 'object') {
        finalJSON.problemsAnalysis = { problems: [], suggestions: [] };
      }
      
      // 🚨 IMPORTANTE: Não silenciar erro - logar para debug
      console.error('[SUGGESTIONS_ERROR] ❌ Continuando com arrays vazios mas erro será investigado');
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

    // 🎯 ORDENAR SUGESTÕES POR PRIORIDADE PROFISSIONAL
    finalJSON.suggestions = orderSuggestionsForUser(finalJSON.suggestions || []);
    finalJSON.aiSuggestions = orderSuggestionsForUser(finalJSON.aiSuggestions || []);
    
    // ✅ FALLBACK OBRIGATÓRIO: Sempre exibir pelo menos uma sugestão
    if (!Array.isArray(finalJSON.suggestions) || finalJSON.suggestions.length === 0) {
      console.warn('[FALLBACK] ⚠️ Nenhuma sugestão gerada - criando mensagem padrão');
      finalJSON.suggestions = [{
        type: 'info',
        metric: 'info',
        severity: 'info',
        message: 'Mixagem dentro dos padrões do gênero',
        action: 'Nenhum ajuste crítico necessário. Continue com seu trabalho!',
        priority: 0,
        category: 'Geral',
        aiEnhanced: false
      }];
    }
    
    if (!Array.isArray(finalJSON.aiSuggestions) || finalJSON.aiSuggestions.length === 0) {
      console.warn('[FALLBACK] ⚠️ Nenhuma sugestão AI - usando sugestões base');
      finalJSON.aiSuggestions = finalJSON.suggestions.map(sug => ({
        ...sug,
        problema: sug.message || 'Análise concluída',
        causaProvavel: 'Métricas estão dentro dos padrões estabelecidos',
        solucao: sug.action || 'Continue seu trabalho normalmente',
        pluginRecomendado: 'Nenhum ajuste necessário',
        aiEnhanced: false,
        enrichmentStatus: 'fallback'
      }));
    }
    
    console.log('[ORDERING] ✅ Sugestões ordenadas por prioridade profissional');
    console.log('[ORDERING] suggestions:', finalJSON.suggestions.length, 'itens');
    console.log('[ORDERING] aiSuggestions:', finalJSON.aiSuggestions.length, 'itens');
    
    // Validação final - garantir que não temos NaN/Infinity
    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final validation failed: ${validationError.message}`, 'final_validation_error');
    }

    // 🔒 GARANTIA FINAL: Validar estrutura obrigatória antes de retornar
    if (!Array.isArray(finalJSON.suggestions)) {
      console.error("[SUGGESTIONS_ERROR] suggestions ausente no retorno final - forçando array vazio");
      finalJSON.suggestions = [];
    }
    if (!Array.isArray(finalJSON.aiSuggestions)) {
      console.error("[SUGGESTIONS_ERROR] aiSuggestions ausente no retorno final - forçando array vazio");
      finalJSON.aiSuggestions = [];
    }
    if (!finalJSON.problemsAnalysis || typeof finalJSON.problemsAnalysis !== 'object') {
      console.error("[SUGGESTIONS_ERROR] problemsAnalysis ausente no retorno final - forçando objeto padrão");
      finalJSON.problemsAnalysis = { 
        problems: [], 
        suggestions: finalJSON.suggestions || [],
        qualityAssessment: {},
        priorityRecommendations: []
      };
    }
    if (!finalJSON.diagnostics || typeof finalJSON.diagnostics !== 'object') {
      finalJSON.diagnostics = {
        problems: [],
        suggestions: finalJSON.suggestions || [],
        prioritized: []
      };
    }
    
    // 🔥 LOG CIRÚRGICO: ANTES de validar summary/metadata (final)
    console.log('[GENRE-DEEP-TRACE][FINAL-VALIDATION-PRE]', {
      ponto: 'pipeline-complete.js linha ~860 - ANTES validação final',
      'finalJSON.summary existe?': !!finalJSON.summary,
      'finalJSON.summary.genre': finalJSON.summary?.genre,
      'finalJSON.suggestionMetadata existe?': !!finalJSON.suggestionMetadata,
      'finalJSON.suggestionMetadata.genre': finalJSON.suggestionMetadata?.genre
    });
    
    if (!finalJSON.summary || typeof finalJSON.summary !== 'object') {
      console.log('[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-SUMMARY]', {
        alerta: 'summary era inválido - RESETANDO (genre perdido)'
      });
      finalJSON.summary = {};
    }
    if (!finalJSON.suggestionMetadata || typeof finalJSON.suggestionMetadata !== 'object') {
      console.log('[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-METADATA]', {
        alerta: 'suggestionMetadata era inválido - RESETANDO (genre perdido)'
      });
      finalJSON.suggestionMetadata = {};
    }
    
    // ✅ GARANTIA EXTRA: Sincronizar suggestions entre campos
    if (finalJSON.suggestions.length > 0) {
      if (!finalJSON.problemsAnalysis.suggestions || finalJSON.problemsAnalysis.suggestions.length === 0) {
        finalJSON.problemsAnalysis.suggestions = finalJSON.suggestions;
      }
      if (!finalJSON.diagnostics.suggestions || finalJSON.diagnostics.suggestions.length === 0) {
        finalJSON.diagnostics.suggestions = finalJSON.suggestions;
      }
    }

    console.log(`🏁 [${jobId.substring(0,8)}] Pipeline completo finalizado em ${totalTime}ms`);
    console.log(`✅ [${jobId.substring(0,8)}] JSON final pronto para salvar no banco`);
    console.log(`[✅ FINAL_STRUCTURE] Estrutura validada:`, {
      suggestions: finalJSON.suggestions.length,
      aiSuggestions: finalJSON.aiSuggestions.length,
      hasProblemAnalysis: !!finalJSON.problemsAnalysis,
      hasDiagnostics: !!finalJSON.diagnostics,
      hasSummary: !!finalJSON.summary,
      hasSuggestionMetadata: !!finalJSON.suggestionMetadata
    });
    
    // 📊 LOG DE AUDITORIA FINAL: Status completo das sugestões
    console.log('[AI-AUDIT][SUGGESTIONS_STATUS] 🎯 PIPELINE COMPLETO:', {
      problems: finalJSON.problemsAnalysis?.problems?.length || finalJSON.problems?.length || 0,
      baseSuggestions: finalJSON.suggestions?.length || 0,
      aiSuggestions: finalJSON.aiSuggestions?.length || 0,
      mode: finalJSON.mode || 'unknown',
      hasScore: finalJSON.score !== undefined,
      hasTechnicalData: !!(finalJSON.lufs || finalJSON.truePeak)
    });
    
    // ✅ VALIDAÇÃO FINAL: Verificar se genre foi propagado corretamente
    console.log('[GENRE-FLOW][PIPELINE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[GENRE-FLOW][PIPELINE] 🎯 VALIDAÇÃO FINAL DO GÊNERO:');
    console.log('[GENRE-FLOW][PIPELINE] finalJSON.genre:', finalJSON.genre);
    console.log('[GENRE-FLOW][PIPELINE] finalJSON.summary.genre:', finalJSON.summary?.genre);
    console.log('[GENRE-FLOW][PIPELINE] finalJSON.suggestionMetadata.genre:', finalJSON.suggestionMetadata?.genre);
    console.log('[GENRE-FLOW][PIPELINE] finalJSON.mode:', finalJSON.mode);
    console.log('[GENRE-FLOW][PIPELINE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🔥 LOG OBRIGATÓRIO: SAÍDA DO PIPELINE
    console.log('[GENRE-TRACE][PIPELINE-OUTPUT]', {
      jobId: jobId.substring(0, 8),
      resultGenre: finalJSON.genre,
      summaryGenre: finalJSON.summary?.genre,
      metadataGenre: finalJSON.metadata?.genre,
      suggestionMetadataGenre: finalJSON.suggestionMetadata?.genre
    });
    
    logAudio('pipeline', 'done', {
      ms: totalTime,
      meta: {
        phases: Object.keys(timings),
        score: finalJSON.score,
        size: JSON.stringify(finalJSON).length
      }
    });

    // 🎯 PATCH CRÍTICO: Garantir data.genreTargets no JSON final (modo genre)
    if (mode === "genre") {
        finalJSON.data = finalJSON.data || {};
        finalJSON.data.genreTargets = customTargets || options.genreTargets || null;
        
        console.log('[GENRE-TARGETS-FINAL] ✅ data.genreTargets adicionado ao JSON final:', {
            hasGenreTargets: !!finalJSON.data.genreTargets,
            keys: finalJSON.data.genreTargets ? Object.keys(finalJSON.data.genreTargets) : null
        });
    }

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
/**
 * 🎯 GERADOR AVANÇADO DE SUGESTÕES BASEADO EM PENALTIES DO SCORING
 * ═════════════════════════════════════════════════════════════════
 * 
 * Sistema COMPLETO de análise e geração de sugestões estruturadas que:
 * 
 * 1. Lê scoring.penalties diretamente (fonte oficial de problemas)
 * 2. Gera sugestões em ordem de prioridade (True Peak > LUFS > DR > Stereo > Bandas)
 * 3. Constrói objetos com estrutura de 6 blocos para enriquecimento ULTRA-V2:
 *    - problema (descrição técnica direta)
 *    - causaProvavel (explicação da origem)
 *    - solucao (instrução prática)
 *    - pluginRecomendado (ferramentas)
 *    - dicaExtra (insights profissionais)
 *    - parametros (valores específicos)
 * 
 * @param {Object} technicalData - Métricas técnicas completas
 * @param {Object} scoring - Objeto de scoring com penalties array
 * @param {String} genre - Gênero para contexto
 * @param {String} mode - 'genre' ou 'reference'
 * @returns {Array} Sugestões estruturadas prontas para ULTRA-V2
 */
function generateAdvancedSuggestionsFromScoring(technicalData, scoring, genre = 'unknown', mode = 'genre') {
  console.log(`[ADVANCED-SUGGEST] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[ADVANCED-SUGGEST] 🎯 Iniciando geração avançada`);
  console.log(`[ADVANCED-SUGGEST] Genre: ${genre}, Mode: ${mode}`);
  console.log(`[ADVANCED-SUGGEST] Penalties disponíveis: ${scoring?.penalties?.length || 0}`);
  
  const suggestions = [];
  const penalties = scoring?.penalties || [];
  
  // 🎯 MAPEAMENTO DE PRIORIDADES (conforme especificação)
  const priorityMap = {
    'truePeakDbtp': 1,     // Máxima prioridade (clipping)
    'lufsIntegrated': 2,   // Loudness
    'dynamicRange': 3,     // Dinâmica
    'stereoCorrelation': 4, // Estéreo
    'lra': 5               // LRA
    // Bandas espectrais: prioridade 6+
  };
  
  // 🎯 ESTRUTURA DE CONHECIMENTO TÉCNICO POR MÉTRICA
  const technicalKnowledge = {
    truePeakDbtp: {
      categoria: 'MASTERING',
      tipoProblema: 'True Peak',
      faixaFreq: 'Espectro completo (20Hz-20kHz)',
      causas: [
        'Limitador com ceiling muito alto ou desabilitado',
        'Overshooting em conversão inter-sample',
        'Excesso de saturação/distorção antes do limiter',
        'Compressão excessiva gerando picos de reconstrução'
      ],
      plugins: ['FabFilter Pro-L 2', 'iZotope Ozone Maximizer', 'Waves L2 Ultramaximizer', 'Sonnox Oxford Limiter'],
      dicas: [
        'Use oversampling 4x-32x no limiter para prevenir overshooting',
        'True Peak target ideal: -1.0 dBTP (streaming) ou -0.3 dBTP (CD)',
        'Sempre medir com True Peak meters (ITU-R BS.1770)',
        'Margem de segurança: deixe -0.5 dBTP de headroom adicional'
      ]
    },
    lufsIntegrated: {
      categoria: 'LOUDNESS',
      tipoProblema: 'LUFS Integrado',
      faixaFreq: 'Espectro completo (percepção de loudness)',
      causas: [
        'Mixagem com volume RMS baixo e limiter inativo',
        'Excesso de limitação gerando loudness artificial',
        'Falta de compressão paralela no bus master',
        'Desequilíbrio espectral (excesso de graves ou agudos)'
      ],
      plugins: ['FabFilter Pro-L 2', 'Waves L3', 'iZotope Ozone Maximizer', 'Youlean Loudness Meter'],
      dicas: [
        'LUFS ideal: -14 para streaming (Spotify/Apple), -10.5 para EDM/Funk',
        'Não confundir loudness com volume peak - são métricas diferentes',
        'Use limitador transparente + compressão paralela para corpo',
        'Monitore LUFS em tempo real durante mixagem'
      ]
    },
    dynamicRange: {
      categoria: 'DYNAMICS',
      tipoProblema: 'Dynamic Range',
      faixaFreq: 'Espectro completo (dinâmica RMS vs Peak)',
      causas: [
        'Compressão excessiva no master bus',
        'Limitação agressiva com baixo threshold',
        'Falta de automação de ganho (tudo no mesmo nível)',
        'Clipper pesado antes do limiter'
      ],
      plugins: ['SSL Bus Compressor', 'Glue Compressor', 'API 2500', 'Klanghelm MJUC'],
      dicas: [
        'DR ideal: EDM (4-6 dB), Pop (6-8 dB), Rock (8-12 dB)',
        'DR < 4 dB indica overprocessing severo',
        'Prefira compressão paralela a compressão serial pesada',
        'Preserve transientes com saturação sutil em vez de limiter bruto'
      ]
    },
    stereoCorrelation: {
      categoria: 'STEREO',
      tipoProblema: 'Correlação Estéreo',
      faixaFreq: 'Imagem estéreo (L/R phase relationship)',
      causas: [
        'Problemas de fase entre canais L/R',
        'Uso excessivo de stereo wideners',
        'Reverbs/delays sem high-pass filter',
        'Graves não mono (sub-bass fora de fase)'
      ],
      plugins: ['Ozone Imager', 'Waves S1 Stereo Imager', 'iZotope Insight', 'Voxengo SPAN'],
      dicas: [
        'Correlação ideal: 0.70-0.90 (boa largura + compatibilidade mono)',
        'Correlação < 0.30 indica problemas sérios de phase',
        'Sempre manter sub-bass (< 120Hz) 100% mono',
        'Testar mix em mono para validar phase issues'
      ]
    },
    lra: {
      categoria: 'DYNAMICS',
      tipoProblema: 'Loudness Range (LRA)',
      faixaFreq: 'Variação de loudness ao longo do tempo',
      causas: [
        'Compressão excessiva destruindo variação dinâmica',
        'Automação de ganho muito agressiva',
        'Falta de contraste entre seções (verso/refrão)',
        'Limitação constante sem breathing room'
      ],
      plugins: ['Waves Vocal Rider', 'SSL Bus Compressor', 'UAD Precision Limiter', 'Youlean Loudness Meter'],
      dicas: [
        'LRA ideal: EDM (3-6 LU), Pop/Rock (6-10 LU), Acústico (10-15 LU)',
        'LRA < 2 LU indica mix "sausage" (sem dinâmica)',
        'Use automação de ganho antes de processar para moldar dinâmica',
        'Preserve contraste entre seções - compressor não deve aplainar tudo'
      ]
    }
  };
  
  // 🎯 BANDA ESPECTRAL: Conhecimento técnico
  const bandKnowledge = {
    sub: {
      nome: 'Sub (20-60Hz)',
      categoria: 'LOW END',
      causas: ['Falta de boost em 40-50Hz', 'High-pass muito agressivo', 'Room modes cancelando sub'],
      plugins: ['FabFilter Pro-Q 3', 'Waves Renaissance Bass', 'MaxxBass', 'Submarine'],
      dicas: ['Sub deve ser mono e limpo', 'Cortar < 30Hz (rumble inútil)', 'Usar side-chain com kick']
    },
    bass: {
      nome: 'Bass (60-150Hz)',
      categoria: 'LOW END',
      causas: ['Falta de corpo no kick/808', 'Excesso de sub mascarando bass', 'Compressão excessiva'],
      plugins: ['FabFilter Pro-Q 3', 'SSL E-Channel', 'Pultec EQP-1A', 'Waves SSL G-Master Buss'],
      dicas: ['Faixa crítica do kick e 808', 'Bell em 100Hz para punch', 'Atenção a lama em 200Hz']
    },
    low_bass: {
      nome: 'Low Bass (60-150Hz)',
      categoria: 'LOW END',
      causas: ['Mesmas causas do bass', 'Problema comum em funk/EDM'],
      plugins: ['FabFilter Pro-Q 3', 'Waves SSL G-Master Buss'],
      dicas: ['Região do punch do kick', 'Evitar mud em 200-250Hz']
    },
    upper_bass: {
      nome: 'Upper Bass (150-300Hz)',
      categoria: 'LOW MID',
      causas: ['Acúmulo de energia (lama)', 'Falta de cut em 200-250Hz', 'Graves de guitarra/baixo desalinhados'],
      plugins: ['FabFilter Pro-Q 3', 'Waves F6 Dynamic EQ', 'TDR Nova'],
      dicas: ['Faixa do "mud" - frequentemente precisa cut', 'Dynamic EQ ajuda a controlar lama', 'Atenção em vocais masculinos']
    },
    lowMid: {
      nome: 'Low-Mid (300-500Hz)',
      categoria: 'MID',
      causas: ['Lama acumulada', 'Falta de clareza em vocais/instrumentos', 'Resonâncias de sala'],
      plugins: ['FabFilter Pro-Q 3', 'Waves F6 Dynamic EQ'],
      dicas: ['Frequentemente precisa cut para abrir espaço', 'Vocais masculinos têm fundamentais aqui']
    },
    low_mid: {
      nome: 'Low-Mid (300-500Hz)',
      categoria: 'MID',
      causas: ['Mesmas causas do lowMid'],
      plugins: ['FabFilter Pro-Q 3', 'Waves F6 Dynamic EQ'],
      dicas: ['Crítico para clareza', 'Cortar lama libera mix']
    },
    mid: {
      nome: 'Mid (500Hz-2kHz)',
      categoria: 'MID',
      causas: ['Falta de presença', 'Excesso = som boxy/nasal', 'Vocais sem corpo'],
      plugins: ['FabFilter Pro-Q 3', 'Waves API 550', 'SSL E-Channel'],
      dicas: ['Região da presença vocal', 'Boost em 1kHz para clareza', 'Cut em 500-800Hz se nasal']
    },
    highMid: {
      nome: 'High-Mid (2-5kHz)',
      categoria: 'HIGH MID',
      causas: ['Falta de definição', 'Excesso = fadiga auditiva', 'Vocais sem inteligibilidade'],
      plugins: ['FabFilter Pro-Q 3', 'Waves Renaissance EQ', 'UAD Neve 1073'],
      dicas: ['Região crítica da inteligibilidade', 'Boost em 3kHz para presença', 'Cuidado: excesso cansa']
    },
    high_mid: {
      nome: 'High-Mid (2-5kHz)',
      categoria: 'HIGH MID',
      causas: ['Mesmas causas do highMid'],
      plugins: ['FabFilter Pro-Q 3', 'Waves Renaissance EQ'],
      dicas: ['Presença e definição', 'Não exagerar - causa fadiga']
    },
    presence: {
      nome: 'Presence (5-10kHz)',
      categoria: 'HIGH END',
      causas: ['Falta de brilho', 'Excesso = sibilância', 'Hi-hats/cymbals sem ar'],
      plugins: ['FabFilter Pro-Q 3', 'Waves De-Esser', 'Soothe2'],
      dicas: ['Região do brilho e ar', 'Controlar sibilância em 6-8kHz', 'Shelf em 10kHz para ar']
    },
    presenca: {
      nome: 'Presença (5-10kHz)',
      categoria: 'HIGH END',
      causas: ['Mesmas causas do presence'],
      plugins: ['FabFilter Pro-Q 3', 'Waves De-Esser'],
      dicas: ['Brilho e ar', 'Atenção à sibilância']
    },
    air: {
      nome: 'Air (10-20kHz)',
      categoria: 'HIGH END',
      causas: ['Falta de abertura', 'High-cut muito cedo', 'Falta de reverb/ambiência'],
      plugins: ['FabFilter Pro-Q 3', 'Waves Aphex Aural Exciter', 'iZotope Ozone Exciter'],
      dicas: ['Shelf boost em 12kHz para "ar"', 'Não exagerar - pode soar artificial', 'Usar saturação sutil']
    },
    brilho: {
      nome: 'Brilho (8-16kHz)',
      categoria: 'HIGH END',
      causas: ['Falta de harmônicos altos', 'Excesso de high-cut', 'Falta de exciter/saturação'],
      plugins: ['FabFilter Pro-Q 3', 'Waves Aphex Aural Exciter'],
      dicas: ['Shelf boost em 10-12kHz', 'Saturação adiciona harmônicos']
    }
  };
  
  // 🎯 FASE 1: PROCESSAR PENALTIES E GERAR SUGESTÕES BASE
  for (const penalty of penalties) {
    const { key, n, status, severity } = penalty;
    
    // Pular métricas OK (sem problemas)
    if (status === 'OK') continue;
    
    // Determinar prioridade baseada no tipo de métrica
    let priority = 'média';
    if (severity === 'alta' || n > 3) priority = 'crítica';
    else if (severity === 'media' || n > 1.5) priority = 'alta';
    else priority = 'média';
    
    // Buscar conhecimento técnico
    const knowledge = technicalKnowledge[key];
    const isBand = !knowledge && (bandKnowledge[key] || key.includes('_db'));
    
    if (knowledge) {
      // 🔧 MÉTRICA PRINCIPAL (LUFS, True Peak, DR, etc)
      const metricData = getMetricValue(technicalData, key);
      if (!metricData) continue;
      
      const { value, target, unit } = metricData;
      const delta = Math.abs(value - target);
      
      // Construir problema técnico
      const problema = `${knowledge.tipoProblema} está em ${value.toFixed(2)}${unit} quando deveria estar próximo de ${target.toFixed(2)}${unit} (desvio de ${delta.toFixed(2)}${unit}, ${n.toFixed(1)}x a tolerância)`;
      
      // Escolher causa provável baseada em severity
      const causaProvavel = knowledge.causas[severity === 'alta' ? 0 : (severity === 'media' ? 1 : 2)] || knowledge.causas[0];
      
      // Construir solução
      const direction = value > target ? 'reduzir' : 'aumentar';
      const solucao = `${direction === 'reduzir' ? 'Reduzir' : 'Aumentar'} ${knowledge.tipoProblema.toLowerCase()} em ${delta.toFixed(2)}${unit} via ${knowledge.plugins[0].split(' ')[0].toLowerCase()}`;
      
      // Plugin recomendado (escolher baseado em criticidade)
      const pluginRecomendado = severity === 'alta' ? knowledge.plugins[0] : knowledge.plugins[1] || knowledge.plugins[0];
      
      // Dica extra
      const dicaExtra = knowledge.dicas[Math.min(Math.floor(n), knowledge.dicas.length - 1)];
      
      // Parâmetros técnicos
      let parametros = '';
      if (key === 'truePeakDbtp') {
        parametros = `Ceiling: ${target.toFixed(1)} dBTP, Lookahead: 10ms, Oversampling: 4x mínimo`;
      } else if (key === 'lufsIntegrated') {
        parametros = `Target LUFS: ${target.toFixed(1)} dB, Threshold ajustar até atingir target, Gain: auto-adjust`;
      } else if (key === 'dynamicRange') {
        parametros = `Ratio: 2:1-4:1, Threshold: -3dB a -6dB, Attack: 10-30ms, Release: 100-300ms`;
      } else if (key === 'stereoCorrelation') {
        parametros = `Width: reduzir 10-20%, Mono graves < 120Hz, High-pass reverbs em 200Hz`;
      }
      
      suggestions.push({
        type: key,
        category: knowledge.categoria.toLowerCase(),
        priority,
        severity,
        problema,
        causaProvavel,
        solucao,
        pluginRecomendado,
        dicaExtra,
        parametros,
        // Campos técnicos para referência
        band: 'full_spectrum',
        frequencyRange: knowledge.faixaFreq,
        delta: `${direction === 'reduzir' ? '-' : '+'}${delta.toFixed(2)}`,
        targetValue: target.toFixed(2),
        currentValue: value.toFixed(2),
        deviationRatio: n.toFixed(2)
      });
      
    } else if (isBand) {
      // 🔧 BANDA ESPECTRAL
      const bandKey = key.replace('_db', '');
      const bandInfo = bandKnowledge[bandKey];
      if (!bandInfo) continue;
      
      const bandData = getBandValue(technicalData, bandKey);
      if (!bandData) continue;
      
      const { value, targetMin, targetMax } = bandData;
      const isBelow = value < targetMin;
      const delta = isBelow ? (targetMin - value) : (value - targetMax);
      
      const problema = `${bandInfo.nome} está em ${value.toFixed(1)} dB quando deveria estar entre ${targetMin} e ${targetMax} dB (${isBelow ? 'abaixo' : 'acima'} em ${delta.toFixed(1)} dB)`;
      
      const causaProvavel = bandInfo.causas[isBelow ? 0 : 1] || bandInfo.causas[0];
      
      const solucao = `${isBelow ? 'Aumentar' : 'Reduzir'} ${bandInfo.nome} em ${isBelow ? '+' : '-'}${delta.toFixed(1)} dB via EQ paramétrico`;
      
      const pluginRecomendado = bandInfo.plugins[0];
      
      const dicaExtra = bandInfo.dicas[0];
      
      const parametros = `Q: 0.7-1.5, Frequency: centro da banda, Gain: ${isBelow ? '+' : '-'}${delta.toFixed(1)} dB`;
      
      suggestions.push({
        type: 'eq',
        category: bandInfo.categoria.toLowerCase().replace(' ', '_'),
        priority,
        severity,
        problema,
        causaProvavel,
        solucao,
        pluginRecomendado,
        dicaExtra,
        parametros,
        band: bandKey,
        frequencyRange: bandInfo.nome,
        delta: `${isBelow ? '+' : '-'}${delta.toFixed(1)}`,
        targetRange: `${targetMin} a ${targetMax} dB`,
        currentValue: value.toFixed(1),
        deviationRatio: n.toFixed(2)
      });
    }
  }
  
  // 🎯 FASE 2: ORDENAR POR PRIORIDADE (True Peak > LUFS > DR > Stereo > Bandas)
  const priorityOrder = { 'crítica': 0, 'alta': 1, 'média': 2, 'baixa': 3 };
  const typeOrder = { 'truePeakDbtp': 0, 'lufsIntegrated': 1, 'dynamicRange': 2, 'stereoCorrelation': 3, 'lra': 4, 'eq': 5 };
  
  suggestions.sort((a, b) => {
    // Primeiro por prioridade
    const priorityDiff = (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Depois por tipo (True Peak primeiro)
    const typeA = a.type === 'eq' ? 5 : (typeOrder[a.type] || 99);
    const typeB = b.type === 'eq' ? 5 : (typeOrder[b.type] || 99);
    return typeA - typeB;
  });
  
  console.log(`[ADVANCED-SUGGEST] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[ADVANCED-SUGGEST] ✅ ${suggestions.length} sugestões avançadas geradas`);
  suggestions.forEach((sug, i) => {
    console.log(`[ADVANCED-SUGGEST] ${i + 1}. [${sug.priority}] ${sug.problema.substring(0, 70)}...`);
  });
  console.log(`[ADVANCED-SUGGEST] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  return suggestions;
}

/**
 * 🔍 Extrair valor de métrica de technicalData
 */
function getMetricValue(technicalData, key) {
  const map = {
    truePeakDbtp: { path: 'truePeak.maxDbtp', target: -1.0, unit: ' dBTP' },
    lufsIntegrated: { path: 'lufs.integrated', target: -10.5, unit: ' LUFS' },
    dynamicRange: { path: 'dynamics.range', target: 9.0, unit: ' dB' },
    stereoCorrelation: { path: 'stereoCorrelation', target: 0.85, unit: '' },
    lra: { path: 'lufs.lra', target: 2.5, unit: ' LU' }
  };
  
  const config = map[key];
  if (!config) return null;
  
  const value = getNestedValue(technicalData, config.path);
  if (!Number.isFinite(value)) return null;
  
  return { value, target: config.target, unit: config.unit };
}

/**
 * 🔍 Extrair valor de banda espectral
 */
function getBandValue(technicalData, bandKey) {
  const bands = technicalData.spectralBands;
  if (!bands || !bands[bandKey]) return null;
  
  const bandData = bands[bandKey];
  const value = bandData.energy_db;
  if (!Number.isFinite(value)) return null;
  
  // Ranges de referência (mesmos do scoring)
  const ranges = {
    sub: { min: -38, max: -28 },
    bass: { min: -31, max: -25 },
    low_bass: { min: -32, max: -24 },
    upper_bass: { min: -33, max: -26 },
    lowMid: { min: -28, max: -22 },
    low_mid: { min: -34, max: -28 },
    mid: { min: -23, max: -17 },
    highMid: { min: -20, max: -14 },
    high_mid: { min: -42, max: -33 },
    presence: { min: -23, max: -17 },
    presenca: { min: -44, max: -33 },
    air: { min: -30, max: -24 },
    brilho: { min: -48, max: -32 }
  };
  
  const range = ranges[bandKey];
  if (!range) return null;
  
  return { value, targetMin: range.min, targetMax: range.max };
}

/**
 * 🔍 Acessar propriedade aninhada via string path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * 🔧 FUNÇÃO LEGADA: Mantida para compatibilidade (agora usa o sistema avançado internamente)
 */
function generateSuggestionsFromMetrics(technicalData, genre = 'unknown', mode = 'genre') {
  console.log(`[LEGACY-SUGGEST] ⚠️ Função legada chamada - redirecionando para sistema avançado`);
  
  // Se houver scoring disponível, usar sistema avançado
  if (technicalData.scoring && technicalData.scoring.penalties) {
    return generateAdvancedSuggestionsFromScoring(technicalData, technicalData.scoring, genre, mode);
  }
  
  // Fallback: Sistema simples (apenas True Peak e LUFS)
  console.log(`[LEGACY-SUGGEST] ⚠️ Scoring não disponível - usando fallback simples`);
  
  const suggestions = [];
  
  // True Peak
  if (technicalData.truePeak && typeof technicalData.truePeak.maxDbtp === 'number') {
    const tp = technicalData.truePeak.maxDbtp;
    if (tp > -1.0) {
      suggestions.push({
        type: 'clipping',
        category: 'mastering',
        priority: tp > 1.5 ? 'crítica' : 'atenção',
        severity: tp > 1.5 ? 'alta' : 'leve',
        problema: `True Peak em ${tp.toFixed(2)} dBTP acima do limite seguro`,
        solucao: `Aplicar limitador com ceiling em -1.0 dBTP`,
        pluginRecomendado: 'FabFilter Pro-L 2',
        band: 'full_spectrum'
      });
    }
  }
  
  // LUFS
  if (technicalData.lufs && typeof technicalData.lufs.integrated === 'number') {
    const lufs = technicalData.lufs.integrated;
    const target = -10.5;
    const delta = Math.abs(lufs - target);
    
    if (delta > 1.0) {
      suggestions.push({
        type: 'loudness',
        category: 'loudness',
        priority: delta > 3 ? 'crítica' : 'alta',
        severity: delta > 3 ? 'alta' : 'media',
        problema: `LUFS Integrado em ${lufs.toFixed(1)} LUFS está ${delta.toFixed(1)} dB distante do ideal (${target} LUFS)`,
        solucao: `Ajustar loudness em ${(target - lufs).toFixed(1)} dB`,
        pluginRecomendado: 'FabFilter Pro-L 2',
        band: 'full_spectrum'
      });
    }
  }
  
  return suggestions;
}
