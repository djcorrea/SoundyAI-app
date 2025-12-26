// 🎯 PROBLEMS & SUGGESTIONS ANALYZER V2 - Sistema Educativo com Criticidade por Cores
// Implementação completa para análise inteligente de problemas e geração de sugestões educativas

// eslint-disable-next-line import/no-unresolved
import { logAudio } from '../error-handling.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeGenreTargets, validateNormalizedTargets } from '../utils/normalize-genre-targets.js';
import { 
  buildMetricSuggestion, 
  buildBandSuggestion,
  METRIC_LABELS,
  BAND_LABELS,
  FREQUENCY_RANGES
} from '../utils/suggestion-text-builder.js';
import { classifyMetric, classifyMetricWithRange, getStatusText, getCssClass } from '../utils/metric-classifier.js';

/**
 * 🎨 Sistema de Criticidade com Cores - AUDITORIA ESPECÍFICA PARA DINÂMICA (LU RANGE)
 */
const SEVERITY_SYSTEM = {
  IDEAL: {
    level: 'ideal',
    priority: 1,
    color: '#00ff88',        // 🟢 Verde
    colorHex: 'green',
    icon: '🟢',
    label: 'IDEAL',
    description: 'Dinâmica perfeita para o gênero'
  },
  AJUSTE_LEVE: {
    level: 'ajuste_leve', 
    priority: 2,
    color: '#ffcc00',        // 🟡 Amarelo
    colorHex: 'yellow',
    icon: '🟡',
    label: 'AJUSTE LEVE',
    description: 'Pequenos ajustes recomendados'
  },
  CORRIGIR: {
    level: 'corrigir',
    priority: 3,
    color: '#ff4444',        // 🔴 Vermelho
    colorHex: 'red',
    icon: '🔴',
    label: 'CORRIGIR',
    description: 'Requer correção para o gênero'
  },
  // Manter compatibilidade com sistema antigo
  CRITICAL: {
    level: 'critical',
    priority: 4,
    color: '#ff4444',        // 🔴 Vermelho
    colorHex: 'red',
    icon: '🔴',
    label: 'CRÍTICO',
    description: 'Requer correção imediata'
  },
  WARNING: {
    level: 'warning', 
    priority: 3,
    color: '#ff8800',        // 🟠 Laranja
    colorHex: 'orange',
    icon: '🟠',
    label: 'ATENÇÃO',
    description: 'Precisa de ajuste'
  },
  OK: {
    level: 'ok',
    priority: 1,
    color: '#00ff88',        // 🟢 Verde
    colorHex: 'green', 
    icon: '🟢',
    label: 'OK',
    description: 'Dentro do ideal'
  },
  INFO: {
    level: 'info',
    priority: 2,
    color: '#44aaff',        // 🔵 Azul
    colorHex: 'blue',
    icon: '🔵',
    label: 'INFO',
    description: 'Informativo'
  }
};

/**
 * 🎵 GENRE_THRESHOLDS DEPRECATED
 * ⚠️ ESTE OBJETO FOI REMOVIDO DO SISTEMA
 * 
 * Agora o sistema usa EXCLUSIVAMENTE:
 * - Targets do filesystem: work/refs/out/<genre>.json
 * - Carregados via: loadGenreTargetsFromWorker()
 * - Passados via: consolidatedData.genreTargets
 * 
 * Se você precisa de fallback, o sistema deve FALHAR EXPLICITAMENTE
 * com mensagem clara em vez de usar valores hardcoded incorretos.
 */
export const GENRE_THRESHOLDS = null; // REMOVIDO - Não usar!

/**
 * 🧮 HELPER: Arredonda valor para passo especificado
 */
function roundTo(value, step = 0.1) {
  return Math.round(value / step) * step;
}

/**
 * 🎯 HELPER: Calcula ajuste recomendado realista para mixagem
 * 
 * @param {number} rawDelta - Diferença até a borda do range (com sinal)
 * @param {object} options - Opções de cálculo
 * @returns {object} - { value: número ajustado, mode: 'micro'|'direct'|'staged' }
 */
function computeRecommendedGain(rawDelta, options = {}) {
  const abs = Math.abs(rawDelta);
  
  const minStep = options.minStepDb ?? 0.5;   // passo mínimo realista
  const maxStep = options.maxStepDb ?? 5.0;   // passo máximo para movimentos diretos
  const precision = options.precision ?? 0.1; // casas decimais
  
  // Diferença muito pequena → ajuste opcional (refinamento fino)
  if (abs < minStep) {
    return {
      value: roundTo(rawDelta, precision),
      mode: 'micro', // "opcional – refinamento fino"
      description: 'ajuste opcional para refinamento fino'
    };
  }
  
  // Ajuste direto, realista (faixa normal de trabalho)
  if (abs <= maxStep) {
    return {
      value: roundTo(rawDelta, precision),
      mode: 'direct',
      description: 'ajuste direto recomendado'
    };
  }
  
  // Diferença MUITO grande → abordagem em etapas
  const clamped = rawDelta > 0 ? maxStep : -maxStep;
  return {
    value: roundTo(clamped, precision),
    mode: 'staged', // "faça em etapas, reavalie"
    description: 'ajuste em múltiplas etapas',
    totalDelta: abs // preservar delta total para informação
  };
}

/**
 * 🎓 Classe Principal - Problems & Suggestions Analyzer V2
 */
export class ProblemsAndSuggestionsAnalyzerV2 {
  /**
   * 🎯 FUNÇÃO AUXILIAR: Obter limites min/max de um threshold
   * 
   * ✅ PATCH RANGE-MIGRATION: Priorizar min/max explícitos
   * 
   * PRIORIDADE 1 - min/max diretos (NOVO FORMATO):
   *   - Use threshold.min e threshold.max quando disponíveis
   * 
   * PRIORIDADE 2 - target_range (BANDAS):
   *   - Use target_range.min e target_range.max
   * 
   * FALLBACK LEGADO - target ± tolerance:
   *   - Calcular artificialmente (SERÁ DEPRECADO)
   * 
   * @param {Object} threshold - Objeto com { min?, max?, target_range?, target, tolerance }
   * @returns {Object} { min, max }
   */
  getRangeBounds(threshold) {
    // ✅ PRIORIDADE 1: Usar min/max diretos (NOVO FORMATO)
    if (typeof threshold.min === 'number' && typeof threshold.max === 'number') {
      console.log('[RANGE_BOUNDS][RANGE-MIGRATION] ✅ Usando min/max diretos:', {
        min: threshold.min,
        max: threshold.max,
        source: 'min_max_explicitos'
      });
      return {
        min: threshold.min,
        max: threshold.max
      };
    }
    
    // ✅ PRIORIDADE 2: Usar target_range (BANDAS)
    // Suporta tanto min/max quanto min_db/max_db
    if (threshold.target_range) {
      const minValue = threshold.target_range.min ?? threshold.target_range.min_db;
      const maxValue = threshold.target_range.max ?? threshold.target_range.max_db;
      
      if (typeof minValue === 'number' && typeof maxValue === 'number') {
        console.log('[RANGE_BOUNDS][RANGE-MIGRATION] ✅ Usando target_range (banda):', {
          min: minValue,
          max: maxValue,
          source: 'target_range',
          originalKeys: Object.keys(threshold.target_range)
        });
        return {
          min: minValue,
          max: maxValue
        };
      } else {
        console.warn('[RANGE_BOUNDS][RANGE-MIGRATION] ⚠️ target_range presente mas min/max inválidos:', {
          target_range: threshold.target_range,
          minValue,
          maxValue
        });
      }
    }
    
    // ⚠️ FALLBACK LEGADO: Calcular com target ± tolerance
    // Este método será DEPRECADO após migração completa
    if (typeof threshold.target !== 'number') {
      console.error('[RANGE_BOUNDS] ❌ ERRO: target inválido e sem min/max:', {
        target: threshold.target,
        tolerance: threshold.tolerance,
        hasMin: 'min' in threshold,
        hasMax: 'max' in threshold,
        hasTargetRange: !!threshold.target_range
      });
      // Retornar range centrado no zero para evitar Infinity
      return { min: -100, max: 100 };
    }

    // ✅ Se tolerance = 0 ou undefined, usar target como min/max
    const effectiveTolerance = (typeof threshold.tolerance === 'number' && threshold.tolerance > 0) 
      ? threshold.tolerance 
      : 0;

    if (effectiveTolerance === 0) {
      console.warn('[RANGE_BOUNDS][RANGE-MIGRATION] ⚠️ tolerance = 0, usando target exato:', threshold.target);
      return { min: threshold.target, max: threshold.target };
    }
    
    console.warn('[RANGE_BOUNDS][RANGE-MIGRATION] ⚠️ FALLBACK LEGADO: Calculando range com target ± tolerance');
    console.warn('[RANGE_BOUNDS][RANGE-MIGRATION] ⚠️ Este método será DEPRECADO - atualize genreTargets para incluir min/max');
    console.log('[RANGE_BOUNDS][RANGE-MIGRATION] Cálculo:', {
      target: threshold.target,
      tolerance: threshold.tolerance,
      min: threshold.target - threshold.tolerance,
      max: threshold.target + threshold.tolerance,
      source: 'calculado_legacy'
    });
    
    return {
      min: threshold.target - threshold.tolerance,
      max: threshold.target + threshold.tolerance
    };
  }

  /**
   * 🏗️ CONSTRUTOR: Inicializa analyzer apenas com gênero
   * ✅ REGRA ABSOLUTA: NÃO aceita customTargets - usa APENAS consolidatedData.genreTargets em runtime
   * @param {string} genre - Gênero musical (apenas para logging/metadata)
   */
  constructor(genre = 'default') {
    console.log('[ANALYZER-CONSTRUCTOR] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[ANALYZER-CONSTRUCTOR] ✅ NOVA POLÍTICA: Sem customTargets no construtor');
    console.log('[ANALYZER-CONSTRUCTOR] genre:', genre);
    console.log('[ANALYZER-CONSTRUCTOR] Targets virão de consolidatedData em runtime');
    console.log('[ANALYZER-CONSTRUCTOR] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🛡️ Validar genre
    if (!genre || typeof genre !== 'string' || !genre.trim()) {
      console.error('[ANALYZER-ERROR] Genre inválido recebido:', genre);
      throw new Error('[ANALYZER-CONSTRUCTOR] Genre inválido - sistema requer gênero válido');
    }
    
    this.genre = genre.trim();
    this._originalGenre = genre.trim();
    this.severity = SEVERITY_SYSTEM;
    
    logAudio('problems_v2', 'init', { 
      genre: this.genre,
      policy: 'consolidatedData-only'
    });
  }

  /**
   * 🎯 HELPER CENTRALIZADO: Obter target e tolerance de forma segura
   * ✅ REGRA ABSOLUTA: Usa APENAS consolidatedData.genreTargets
   * ❌ NUNCA usa customTargets, this.thresholds, ou fallbacks
   * 
   * ✅ CORREÇÃO CRÍTICA: Lê estruturas diferentes para bandas vs outras métricas
   * 
   * @param {string} metricKey - 'lufs', 'truePeak', 'dr', 'stereo', ou 'bands'
   * @param {string|null} bandKey - Nome da banda (se metricKey === 'bands')
   * @param {Object} consolidatedData - Dados consolidados do finalJSON.data
   * @returns {Object|null} { target, tolerance, critical, target_range? } ou null se não encontrado
   */
  getMetricTarget(metricKey, bandKey, consolidatedData) {
    // ✅ REGRA ABSOLUTA: Usar APENAS consolidatedData.genreTargets
    const genreTargets = consolidatedData && consolidatedData.genreTargets;
    if (!genreTargets) {
      console.error(`[TARGET-HELPER] ❌ consolidatedData.genreTargets ausente para ${metricKey}`);
      console.error('[TARGET-HELPER] ❌ IMPOSSÍVEL GERAR SUGESTÃO - pulando');
      return null;
    }

    if (metricKey === 'bands') {
      if (!bandKey) {
        console.warn(`[TARGET-HELPER] ⚠️ bandKey ausente para metricKey='bands'`);
        return null;
      }
      
      // 🔥 PATCH CRÍTICO: Alias mapping para resolver mismatch PT↔EN
      // JSON do gênero usa: brilho, presenca (português)
      // Código/FFT usa: air, presence (inglês)
      const TARGET_KEY_ALIASES = {
        'air': 'brilho',           // EN → PT
        'presence': 'presenca',    // EN → PT
        'brilho': 'air',           // PT → EN (fallback reverso)
        'presenca': 'presence'     // PT → EN (fallback reverso)
      };
      
      // Tentar chave original primeiro, depois alias
      let t = genreTargets.bands && genreTargets.bands[bandKey];
      let resolvedKey = bandKey;
      
      if (!t && TARGET_KEY_ALIASES[bandKey]) {
        const aliasKey = TARGET_KEY_ALIASES[bandKey];
        t = genreTargets.bands && genreTargets.bands[aliasKey];
        if (t) {
          resolvedKey = aliasKey;
          console.log(`[TARGET-HELPER] 🔄 Alias aplicado: ${bandKey} → ${aliasKey}`);
        }
      }
      
      // ✅ CORREÇÃO: JSON usa "target_db" nas bandas, NÃO "target"
      if (!t) {
        console.error(`[TARGET-HELPER] ❌ Banda ${bandKey} ausente em genreTargets.bands (tentou alias: ${TARGET_KEY_ALIASES[bandKey] || 'nenhum'})`);
        console.error(`[TARGET-HELPER] Bandas disponíveis:`, Object.keys(genreTargets.bands || {}));
        return null;
      }

      // ✅ Validar target_db
      if (typeof t.target_db !== 'number') {
        console.error(`[TARGET-HELPER] ❌ target_db inválido para banda ${bandKey}:`, {
          target_db: t.target_db,
          type: typeof t.target_db,
          actualKeys: Object.keys(t)
        });
        return null;
      }
      
      // ✅ CORREÇÃO: Retornar target_range se disponível (bandas sempre têm)
      // 🔥 CRÍTICO: Usar ?? ao invés de || para preservar tol_db = 0
      const tolerance = t.tol_db ?? 3.0;
      const critical = t.critical ?? tolerance * 1.5;

      console.log(`[TARGET-HELPER] ✅ Banda ${bandKey}:`, {
        target_db: t.target_db,
        tol_db: tolerance,
        target_range: t.target_range,
        critical: critical
      });

      return {
        target: t.target_db,  // ✅ Usar target_db, não target
        tolerance: tolerance,
        critical: critical,
        target_range: t.target_range  // ✅ Incluir target_range para bandas
      };
    }

    // Para LUFS, TruePeak, DR, Stereo: estrutura é { target, tolerance }
    const t = genreTargets[metricKey];
    if (!t || typeof t.target !== 'number') {
      console.warn(`[TARGET-HELPER] ⚠️ Target inválido para ${metricKey}:`, {
        exists: !!t,
        hasTarget: t ? 'target' in t : false,
        actualKeys: t ? Object.keys(t) : []
      });
      return null;
    }
    
    // ✅ Para métricas gerais, NÃO incluir target_range (elas não têm)
    // 🔥 CRÍTICO: Usar ?? ao invés de || para preservar tolerance = 0
    return {
      target: t.target,
      tolerance: t.tolerance ?? 1.0,
      critical: t.critical ?? (t.tolerance ?? 1.0) * 1.5
    };
  }
  
  /**
   * 🔍 Análise Completa com Sugestões Educativas
   * 🔥 REFATORADO: Agora aceita consolidatedData opcional (finalJSON.data)
   */
  analyzeWithEducationalSuggestions(audioMetrics, consolidatedData = null) {
    try {
      console.log('[AUDIT-PROBLEMS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[AUDIT-PROBLEMS] DENTRO DO ANALYZER:');
      console.log('[AUDIT-PROBLEMS] this._originalGenre:', this._originalGenre);
      console.log('[AUDIT-PROBLEMS] this.genre:', this.genre);
      console.log('[AUDIT-PROBLEMS] consolidatedData disponível:', !!consolidatedData);
      
      if (consolidatedData) {
        console.log('[AUDIT-PROBLEMS] 📊 Usando metrics consolidados:', {
          loudness: consolidatedData.metrics && consolidatedData.metrics.loudness && consolidatedData.metrics.loudness.value,
          truePeak: consolidatedData.metrics && consolidatedData.metrics.truePeak && consolidatedData.metrics.truePeak.value,
          dr: consolidatedData.metrics && consolidatedData.metrics.dr && consolidatedData.metrics.dr.value
        });
        console.log('[AUDIT-PROBLEMS] 🎯 Usando genreTargets consolidados:', {
          lufs: consolidatedData.genreTargets && consolidatedData.genreTargets.lufs && consolidatedData.genreTargets.lufs.target,
          truePeak: consolidatedData.genreTargets && consolidatedData.genreTargets.truePeak && consolidatedData.genreTargets.truePeak.target,
          dr: consolidatedData.genreTargets && consolidatedData.genreTargets.dr && consolidatedData.genreTargets.dr.target
        });
      }
      console.log('[AUDIT-PROBLEMS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      logAudio('problems_v2', 'analysis_start', { genre: this.genre });
      
      const suggestions = [];
      const problems = [];
      
      // ✅ REGRA ABSOLUTA: Passar APENAS consolidatedData (sem audioMetrics)
      // 🔊 ANÁLISE LUFS
      this.analyzeLUFS(suggestions, problems, consolidatedData);
      
      // 🎯 ANÁLISE TRUE PEAK
      this.analyzeTruePeak(suggestions, problems, consolidatedData);
      
      // 📈 ANÁLISE DYNAMIC RANGE
      this.analyzeDynamicRange(suggestions, problems, consolidatedData);
      
      // 🎧 ANÁLISE STEREO
      this.analyzeStereoMetrics(suggestions, problems, consolidatedData);
      
      // 🌈 ANÁLISE BANDAS ESPECTRAIS
      this.analyzeSpectralBands(suggestions, problems, consolidatedData);
      
      // 📊 RESUMO FINAL
      const summary = this.generateSummary(suggestions, problems);
      
      // 🔥 PATCH CRÍTICO: Preservar genre original mesmo se this.genre foi convertido para 'default'
      const originalGenre = this._originalGenre || this.genre;  // Tentar recuperar genre original
      
      console.log('[AUDIT-PROBLEMS-RESULT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[AUDIT-PROBLEMS-RESULT] ANTES DE RETORNAR RESULT:');
      console.log('[AUDIT-PROBLEMS-RESULT] originalGenre:', originalGenre);
      console.log('[AUDIT-PROBLEMS-RESULT] summary.genre:', summary && summary.genre);
      console.log('[AUDIT-PROBLEMS-RESULT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const result = {
        genre: originalGenre,  // 🔥 Usar genre original, não this.genre
        suggestions: suggestions.map(s => this.formatSuggestionForJSON(s)),
        problems: problems.map(p => this.formatProblemForJSON(p)),
        summary,
        metadata: {
          totalSuggestions: suggestions.length,
          criticalCount: suggestions.filter(s => s.severity.level === 'critical').length,
          warningCount: suggestions.filter(s => s.severity.level === 'warning').length,
          okCount: suggestions.filter(s => s.severity.level === 'ok').length,
          analysisDate: new Date().toISOString(),
          genre: originalGenre,  // 🔥 Usar genre original aqui também
          version: '2.0.0',
          usingConsolidatedData: !!consolidatedData  // 🔥 Indica se usou dados consolidados
        }
      };
      
      // 🎯 PRIORIDADE TRUE PEAK: Se True Peak crítico, marcar para renderização prioritária
      const hasCriticalTruePeak = suggestions.some(s => 
        (s.metric === 'truePeak' || s.metric === 'true_peak') && 
        s.severity && s.severity.level === 'critical'
      );
      
      if (hasCriticalTruePeak) {
        result.priority = 'tp_first';
        result.priorityMessage = '🔴 CORREÇÃO PRIORITÁRIA: Reduza o True Peak antes de realizar outros ajustes. Clipping digital impede análise precisa.';
        console.log('[PROBLEMS_V2][PRIORITY] ⚠️ True Peak crítico detectado - marcado como prioridade');
      }
      
      logAudio('problems_v2', 'analysis_complete', {
        totalSuggestions: suggestions.length,
        critical: result.metadata.criticalCount,
        warning: result.metadata.warningCount,
        ok: result.metadata.okCount,
        hasCriticalTruePeak,
        usingConsolidatedData: !!consolidatedData
      });
      
      console.error("\n\n");
      console.error("╔════════════════════════════════════════════════════════════════╗");
      console.error("║  ✅✅✅ SUGESTÕES GERADAS COM SUCESSO ✅✅✅                  ║");
      console.error("╚════════════════════════════════════════════════════════════════╝");
      console.error("[SUGGESTIONS RAW] ⏰ Timestamp:", new Date().toISOString());
      console.error("[SUGGESTIONS RAW] 📊 Sugestões geradas:");
      console.error("  - Total de sugestões:", suggestions.length);
      console.error("  - Críticas:", result.metadata.criticalCount);
      console.error("  - Avisos:", result.metadata.warningCount);
      console.error("  - OK:", result.metadata.okCount);
      console.error("[SUGGESTIONS RAW] 🔍 Primeiras 3 sugestões:", JSON.stringify(suggestions.slice(0, 3), null, 2));
      console.error("[SUGGESTIONS RAW] ✅ Usando dados consolidados?:", !!consolidatedData);
      console.error("════════════════════════════════════════════════════════════════\n\n");
      
      return result;
      
    } catch (error) {
      logAudio('problems_v2', 'analysis_error', {
        error: error.message,
        stack: error.stack,
        genre: this.genre,
      });
      
      // ❌ NÃO retornar getEmptyResult() aqui.
      // Queremos que o erro estoure para a pipeline,
      // para conseguir ver a causa raiz completa nos logs.
      throw error;
    }
  }
  
  /**
   * 🔊 Análise LUFS com Sugestões Educativas
   * ✅ REGRA ABSOLUTA: Usa APENAS consolidatedData.metrics e consolidatedData.genreTargets
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, ou fallbacks
   */
  analyzeLUFS(suggestions, problems, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error('[LUFS] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão');
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics
    const metric = consolidatedData.metrics && consolidatedData.metrics.loudness;
    if (!metric || typeof metric.value !== 'number') {
      console.error('[LUFS] ❌ consolidatedData.metrics.loudness ausente ou inválido');
      console.error('[LUFS] ❌ Valor encontrado:', metric);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets
    const targetInfo = this.getMetricTarget('lufs', null, consolidatedData);
    if (!targetInfo) {
      console.error('[LUFS] ❌ consolidatedData.genreTargets.lufs ausente - pulando sugestão');
      return;
    }

    const lufs = metric.value;
    const lufsTarget = targetInfo.target;
    const tolerance = targetInfo.tolerance;
    const critical = targetInfo.critical;

    console.log('[SUGGESTION_DEBUG][LUFS] ✅ Usando targets do genreTargets:', {
      value: lufs.toFixed(2),
      target: lufsTarget.toFixed(2),
      tolerance: tolerance.toFixed(2),
      source: 'genreTargets'
    });

    if (!Number.isFinite(lufs)) return;
    
    // PATCH: Usar getRangeBounds para suportar target_range
    const lufsThreshold = { target: lufsTarget, tolerance, critical };
    const bounds = this.getRangeBounds(lufsThreshold);
    
    let diff;
    if (lufs < bounds.min) {
      diff = lufs - bounds.min; // Negativo (precisa subir)
    } else if (lufs > bounds.max) {
      diff = lufs - bounds.max; // Positivo (precisa descer)
    } else {
      diff = 0; // Dentro do range
    }
    
    // 🔥 LOG MANDATÓRIO: Mostrar cálculo do delta ANTES de gerar sugestão
    console.log('[SUGGESTION_DEBUG][LUFS] 📊 Cálculo do Delta:', {
      metric: 'LUFS',
      value: lufs.toFixed(2),
      target: lufsTarget.toFixed(2),
      bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: diff.toFixed(2),
      formula: diff === 0 ? 'dentro do range' : (lufs > bounds.max ? `${lufs.toFixed(2)} - ${bounds.max.toFixed(2)} = ${diff.toFixed(2)}` : `${lufs.toFixed(2)} - ${bounds.min.toFixed(2)} = ${diff.toFixed(2)}`)
    });
    
    const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);
    
    // ✅ USAR NOVO BUILDER DE SUGESTÕES
    const textSuggestion = buildMetricSuggestion({
      key: 'lufs',
      label: METRIC_LABELS.lufs,
      unit: 'LUFS',
      value: lufs,
      target: lufsTarget,
      tolerance: tolerance,
      min: bounds.min,  // ✅ PASSAR min REAL
      max: bounds.max,  // ✅ PASSAR max REAL
      decimals: 1
    });
    
    let message = textSuggestion.message;
    let explanation = textSuggestion.explanation;
    let action = textSuggestion.action;
    let status = 'ok';
    
    // Determinar status baseado na posição no range
    if (lufs < bounds.min) {
      status = 'low';
    } else if (lufs > bounds.max) {
      status = 'high';
    }
    
    console.log('[GENRE-FLOW][S2_BUILDER]', {
      metric: 'LUFS',
      genre: this.genre,
      currentValue: lufs,
      targetValue: lufsTarget,
      delta: diff,
      deltaNum: diff,
      rawMetricValue: lufs,
      rawTargetObject: targetInfo
    });
    
    const suggestion = {
      metric: 'lufs',
      severity,
      message,
      explanation,
      action,
      currentValue: `${lufs.toFixed(1)} LUFS`,
      targetValue: bounds.min !== bounds.max ? `${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LUFS` : `${bounds.max.toFixed(1)} LUFS`,
      delta: diff === 0 ? '0.0 dB (dentro do range)' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} dB`,
      deltaNum: diff, // 🎯 FASE 3: Adicionar valor numérico para validação IA
      status, // 🎯 FASE 3: Status explícito para validação
      priority: severity.priority
    };
    
    console.log('[GENRE-FLOW][S2_BUILDER]', {
      metric: 'LUFS',
      genre: this.genre,
      currentValue: lufs,
      targetValue: lufsTarget,
      delta: diff,
      deltaNum: diff,
      rawMetricValue: lufs,
      rawTargetObject: targetInfo
    });
    
    // ────────────────────────────────────────
    // STEP 2 — LOGAR OS VALORES DENTRO DO BUILDER DE SUGESTÕES
    // ────────────────────────────────────────
    console.log("[TRACE_S2_BUILDER]", {
      metric: "LUFS",
      current: lufs,
      target: lufsTarget,
      rawTargetObject: consolidatedData?.genreTargets?.lufs,
      diff: diff,
      suggestionPreview: suggestion
    });
    
    // 🎯 GATE: Bloquear sugestão se métrica está OK (dentro do range)
    if (diff === 0) {
      console.log('[SUGGESTION_GATE] ✅ Sugestão OMITIDA (métrica OK):', {
        metric: 'LUFS',
        value: lufs.toFixed(2),
        bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
        delta: diff,
        severity: severity.level,
        reason: 'diff === 0 (dentro do range)'
      });
      return;
    }
    
    suggestions.push(suggestion);
  }
  
  /**
   * 🎯 Análise True Peak com Sugestões Educativas
   * ✅ REGRA ABSOLUTA: Usa APENAS consolidatedData.metrics e consolidatedData.genreTargets
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, ou fallbacks
   */
  analyzeTruePeak(suggestions, problems, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error('[TRUE_PEAK] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão');
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics
    const metric = consolidatedData.metrics && consolidatedData.metrics.truePeak;
    if (!metric || typeof metric.value !== 'number') {
      console.error('[TRUE_PEAK] ❌ consolidatedData.metrics.truePeak ausente ou inválido');
      console.error('[TRUE_PEAK] ❌ Valor encontrado:', metric);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets
    const targetInfo = this.getMetricTarget('truePeak', null, consolidatedData);
    if (!targetInfo) {
      console.error('[TRUE_PEAK] ❌ consolidatedData.genreTargets.truePeak ausente - pulando sugestão');
      return;
    }

    const truePeak = metric.value;
    const tpTarget = targetInfo.target;
    const tolerance = targetInfo.tolerance;
    const critical = targetInfo.critical;

    console.log('[SUGGESTION_DEBUG][TRUE_PEAK] ✅ Usando targets do genreTargets:', {
      value: truePeak.toFixed(2),
      target: tpTarget.toFixed(2),
      tolerance: tolerance.toFixed(2),
      source: 'genreTargets'
    });

    if (!Number.isFinite(truePeak)) return;
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const tpThreshold = { target: tpTarget, tolerance, critical };
    const bounds = this.getRangeBounds(tpThreshold);
    
    let diff;
    if (truePeak < bounds.min) {
      diff = truePeak - bounds.min; // Negativo (muito baixo, improvável)
    } else if (truePeak > bounds.max) {
      diff = truePeak - bounds.max; // Positivo (acima do limite - CRÍTICO)
    } else {
      diff = 0; // Dentro do range seguro
    }
    
    // 🔥 LOG MANDATÓRIO: Mostrar cálculo do delta ANTES de gerar sugestão
    console.log('[SUGGESTION_DEBUG][TRUE_PEAK] 📊 Cálculo do Delta:', {
      metric: 'True Peak',
      value: truePeak.toFixed(2),
      target: tpTarget.toFixed(2),
      bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: diff.toFixed(2),
      formula: diff === 0 ? 'dentro do range' : (truePeak > bounds.max ? `${truePeak.toFixed(2)} - ${bounds.max.toFixed(2)} = ${diff.toFixed(2)}` : `${truePeak.toFixed(2)} - ${bounds.min.toFixed(2)} = ${diff.toFixed(2)}`)
    });
    
    const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);
    
    // ✅ USAR NOVO BUILDER DE SUGESTÕES
    const textSuggestion = buildMetricSuggestion({
      key: 'truePeak',
      label: METRIC_LABELS.truePeak,
      unit: 'dBTP',
      value: truePeak,
      target: tpTarget,
      tolerance: tolerance,
      min: bounds.min,  // ✅ PASSAR min REAL
      max: bounds.max,  // ✅ PASSAR max REAL
      decimals: 1
    });
    
    let message = textSuggestion.message;
    let explanation = textSuggestion.explanation;
    let action = textSuggestion.action;
    let status = 'ok';
    
    // Determinar status baseado na posição no range
    if (truePeak > bounds.max) {
      status = 'high';
    }
    
    // 🎯 GATE: Bloquear sugestão se métrica está OK (dentro do range)
    if (diff === 0) {
      console.log('[SUGGESTION_GATE] ✅ Sugestão OMITIDA (métrica OK):', {
        metric: 'True Peak',
        value: truePeak.toFixed(2),
        bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
        delta: diff,
        severity: severity.level,
        reason: 'diff === 0 (dentro do range)'
      });
      return;
    }
    
    suggestions.push({
      metric: 'truePeak',
      severity,
      message,
      explanation,
      action,
      currentValue: `${truePeak.toFixed(1)} dBTP`,
      targetValue: `< ${bounds.max.toFixed(1)} dBTP`,
      delta: diff === 0 ? '0.0 dB (dentro do range)' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} dB`,
      deltaNum: diff, // 🎯 FASE 3: Adicionar valor numérico para validação IA
      status, // 🎯 FASE 3: Status explícito para validação
      priority: severity.priority
    });
  }
  
  /**
   * 📈 Análise Dynamic Range com Sugestões Educativas
   * ✅ REGRA ABSOLUTA: Usa APENAS consolidatedData.metrics e consolidatedData.genreTargets
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, ou fallbacks
   */
  analyzeDynamicRange(suggestions, problems, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error('[DR] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão');
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics
    const metric = consolidatedData.metrics && consolidatedData.metrics.dr;
    if (!metric || typeof metric.value !== 'number') {
      console.error('[DR] ❌ consolidatedData.metrics.dr ausente ou inválido');
      console.error('[DR] ❌ Valor encontrado:', metric);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets
    const targetInfo = this.getMetricTarget('dr', null, consolidatedData);
    if (!targetInfo) {
      console.error('[DR] ❌ consolidatedData.genreTargets.dr ausente - pulando sugestão');
      return;
    }

    const dr = metric.value;
    const drTarget = targetInfo.target;
    const tolerance = targetInfo.tolerance;
    const critical = targetInfo.critical;

    console.log('[SUGGESTION_DEBUG][DR] ✅ Usando targets do genreTargets:', {
      value: dr.toFixed(2),
      target: drTarget.toFixed(2),
      tolerance: tolerance.toFixed(2),
      source: 'genreTargets'
    });

    if (!Number.isFinite(dr)) return;
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const threshold = { target: drTarget, tolerance, critical };
    const bounds = this.getRangeBounds(threshold);
    
    let diff;
    if (dr < bounds.min) {
      diff = dr - bounds.min; // Negativo (precisa aumentar)
    } else if (dr > bounds.max) {
      diff = dr - bounds.max; // Positivo (precisa reduzir)
    } else {
      diff = 0; // Dentro do range
    }
    
    // 🔥 LOG MANDATÓRIO: Mostrar cálculo do delta ANTES de gerar sugestão
    console.log('[SUGGESTION_DEBUG][DR] 📊 Cálculo do Delta:', {
      metric: 'Dynamic Range',
      value: dr.toFixed(2),
      target: drTarget.toFixed(2),
      bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: diff.toFixed(2),
      formula: diff === 0 ? 'dentro do range' : (dr < bounds.min ? `${dr.toFixed(2)} - ${bounds.min.toFixed(2)} = ${diff.toFixed(2)}` : `${dr.toFixed(2)} - ${bounds.max.toFixed(2)} = ${diff.toFixed(2)}`)
    });
    
    const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);
    
    // 🎯 Usar text builder para mensagens consistentes
    const textSuggestion = buildMetricSuggestion({
      key: 'dr',
      label: METRIC_LABELS.dr,
      unit: 'dB DR',
      value: dr,
      target: drTarget,
      tolerance: tolerance,
      min: bounds.min,  // ✅ PASSAR min REAL
      max: bounds.max,  // ✅ PASSAR max REAL
      decimals: 1,
      genre: this.genre
    });
    
    let message = textSuggestion.message;
    let explanation = textSuggestion.explanation;
    let action = textSuggestion.action;
    
    let status = 'ok';
    if (severity.level === 'corrigir' || severity.level === 'ajuste_leve') {
      if (dr < bounds.min) {
        status = 'low';
      } else if (dr > bounds.max) {
        status = 'high';
      }
    }
    
    // 🎯 GATE: Bloquear sugestão se métrica está OK (dentro do range)
    if (diff === 0) {
      console.log('[SUGGESTION_GATE] ✅ Sugestão OMITIDA (métrica OK):', {
        metric: 'Dynamic Range',
        value: dr.toFixed(2),
        bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
        delta: diff,
        severity: severity.level,
        reason: 'diff === 0 (dentro do range)'
      });
      return;
    }
    
    // 🔥 VALIDAÇÃO CRÍTICA: DR nunca deve ter targetValue negativo
    if (bounds.min < 0 || bounds.max < 0) {
      console.error('[DR] ❌❌❌ BUG CRÍTICO: Range negativo detectado!');
      console.error('[DR] ❌ bounds.min:', bounds.min, 'bounds.max:', bounds.max);
      console.error('[DR] ❌ drTarget:', drTarget, 'tolerance:', tolerance);
      console.error('[DR] ❌ Isso indica que o target errado foi usado (provavelmente LUFS ao invés de DR)');
      console.error('[DR] ❌ genreTargets.dr:', consolidatedData.genreTargets?.dr);
      // Bloquear sugestão inválida
      return;
    }
    
    suggestions.push({
      metric: 'dynamicRange',
      severity,
      message,
      explanation,
      action,
      currentValue: `${dr.toFixed(1)} dB DR`,
      targetValue: `${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB DR`,
      delta: diff === 0 ? '0.0 dB (dentro do range)' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} dB`,
      deltaNum: diff, // 🎯 FASE 3: Adicionar valor numérico para validação IA
      status, // 🎯 FASE 3: Status explícito para validação
      priority: severity.priority,
      genre: this.genre // 🎯 ADICIONAR CONTEXTO DE GÊNERO
    });
  }
  
  /**
   * 🎧 Análise Stereo com Sugestões Educativas
   * ✅ REGRA ABSOLUTA: Usa APENAS consolidatedData.metrics e consolidatedData.genreTargets
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, ou fallbacks
   */
  analyzeStereoMetrics(suggestions, problems, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error('[STEREO] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão');
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics
    const metricStereo = consolidatedData.metrics && consolidatedData.metrics.stereo;
    if (!metricStereo || typeof metricStereo.value !== 'number') {
      console.error('[STEREO] ❌ consolidatedData.metrics.stereo ausente ou inválido');
      console.error('[STEREO] ❌ Valor encontrado:', metricStereo);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets
    const targetInfo = this.getMetricTarget('stereo', null, consolidatedData);
    if (!targetInfo) {
      console.error('[STEREO] ❌ consolidatedData.genreTargets.stereo ausente - pulando sugestão');
      return;
    }

    const correlation = metricStereo.value;
    const stereoTarget = targetInfo.target;
    const tolerance = targetInfo.tolerance;
    const critical = targetInfo.critical;

    console.log('[SUGGESTION_DEBUG][STEREO] ✅ Usando targets do genreTargets:', {
      value: correlation,
      target: stereoTarget,
      tolerance,
      source: 'genreTargets'
    });
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const threshold = { target: stereoTarget, tolerance, critical };
    const bounds = this.getRangeBounds(threshold);
    let rawDiff;
    if (correlation < bounds.min) {
      rawDiff = correlation - bounds.min; // Negativo (muito estreito)
    } else if (correlation > bounds.max) {
      rawDiff = correlation - bounds.max; // Positivo (muito largo)
    } else {
      rawDiff = 0; // Dentro do range ideal
    }
    
    // 🔥 LOG MANDATÓRIO: Mostrar cálculo do delta ANTES de gerar sugestão
    console.log('[SUGGESTION_DEBUG][STEREO] 📊 Cálculo do Delta:', {
      metric: 'Stereo Correlation',
      value: correlation.toFixed(2),
      target: stereoTarget.toFixed(2),
      bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: rawDiff.toFixed(2),
      formula: rawDiff === 0 ? 'dentro do range' : (correlation < bounds.min ? `${correlation.toFixed(2)} - ${bounds.min.toFixed(2)} = ${rawDiff.toFixed(2)}` : `${correlation.toFixed(2)} - ${bounds.max.toFixed(2)} = ${rawDiff.toFixed(2)}`)
    });
    
    const diff = Math.abs(rawDiff);
    const severity = this.calculateSeverity(diff, tolerance, critical);
    
    // 🎯 Usar text builder para mensagens consistentes
    const textSuggestion = buildMetricSuggestion({
      key: 'stereo',
      label: METRIC_LABELS.stereo,
      unit: '',
      value: correlation,
      target: stereoTarget,
      tolerance: tolerance,
      min: bounds.min,  // ✅ PASSAR min REAL
      max: bounds.max,  // ✅ PASSAR max REAL
      decimals: 2,
      genre: this.genre
    });
    
    let message = textSuggestion.message;
    let explanation = textSuggestion.explanation;
    let action = textSuggestion.action;
    
    let status = 'ok';
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (correlation < bounds.min) {
        status = 'low';
      } else if (correlation > bounds.max) {
        status = 'high';
      }
    }
    
    // 🎯 GATE: Bloquear sugestão se métrica está OK (dentro do range)
    if (rawDiff === 0) {
      console.log('[SUGGESTION_GATE] ✅ Sugestão OMITIDA (métrica OK):', {
        metric: 'Stereo Correlation',
        value: correlation.toFixed(2),
        bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
        delta: rawDiff,
        severity: severity.level,
        reason: 'rawDiff === 0 (dentro do range)'
      });
      return;
    }
    
    suggestions.push({
      metric: 'stereoCorrelation',
      severity,
      message,
      explanation,
      action,
      currentValue: correlation.toFixed(2),
      targetValue: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: rawDiff === 0 ? '0.00 (dentro do range)' : `${rawDiff > 0 ? '+' : ''}${rawDiff.toFixed(2)}`,
      deltaNum: rawDiff, // 🎯 FASE 3: Adicionar valor numérico para validação IA
      status, // 🎯 FASE 3: Status explícito para validação
      priority: severity.priority
    });
  }
  
  /**
   * 🌈 Análise Bandas Espectrais com Sugestões Educativas
   * ✅ REGRA ABSOLUTA: Usa EXCLUSIVAMENTE consolidatedData.metrics.bands
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, ou fallbacks
   */
  analyzeSpectralBands(suggestions, problems, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error('[BANDS] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão');
      return;
    }

    // ✅ REGRA ABSOLUTA: Exigir consolidatedData.metrics.bands
    if (!consolidatedData.metrics?.bands) {
      console.error('[BANDS] ❌ consolidatedData.metrics.bands ausente - pulando análise');
      return;
    }

    const bands = consolidatedData.metrics.bands;
    const targetBands = consolidatedData.genreTargets?.bands || {};
    
    // 🎯 MAPEAMENTO DE ALIASES: JSON usa português, código pode usar inglês
    // 🔥 CORRIGIDO: upper_bass e low_bass são bandas DISTINTAS no JSON do gênero
    const BAND_ALIAS_MAP = {
      'brilho': 'air',           // JSON portugês → código inglês
      'air': 'air',              // já inglês
      'brilliance': 'air',       // alias antigo
      'presenca': 'presence',    // JSON português → código inglês
      'presence': 'presence',    // já inglês
      'low_mid': 'low_mid',      // snake_case
      'lowMid': 'low_mid',       // camelCase
      'high_mid': 'high_mid',    // snake_case
      'highMid': 'high_mid',     // camelCase
      'upper_bass': 'upper_bass', // ✅ CORRIGIDO: preservar key original (tem target próprio)
      'low_bass': 'low_bass',     // ✅ CORRIGIDO: preservar key original (tem target próprio)
      'bass': 'bass'              // bass genérico (se existir)
    };
    
    // 🎯 LABELS LEGÍVEIS PARA CADA BANDA
    // 🔧 CORRIGIDO: Brilho = 4k-10kHz, Presença = 10k-20kHz (alinhado com tabela de referência)
    const BAND_LABELS = {
      'sub': 'Sub Bass (20-60Hz)',
      'bass': 'Bass (60-150Hz)',
      'low_bass': 'Graves (60-120Hz)',
      'upper_bass': 'Graves Altos (120-200Hz)',
      'low_mid': 'Low Mid (150-500Hz)',
      'mid': 'Mid (500-2kHz)',
      'high_mid': 'High Mid (2-4kHz)',
      // 🔧 CORRIGIDO: Ranges corretos para air/presence e aliases PT
      'air': 'Brilho (4k-10kHz)',
      'brilho': 'Brilho (4k-10kHz)',
      'presence': 'Presença (10k-20kHz)',
      'presenca': 'Presença (10k-20kHz)'
    };
    
    // 🔥 LOG CRÍTICO: Inventário completo de TODAS as bandas antes de análise
    const DEBUG = process.env.DEBUG_SUGGESTIONS === '1';
    if (DEBUG) {
      console.log('[BANDS][INVENTORY] 📊 ═══════════════════════════════════════════');
      console.log('[BANDS][INVENTORY] INVENTÁRIO COMPLETO DE BANDAS:');
      console.log('[BANDS][INVENTORY] Bandas medidas:', Object.keys(bands));
      console.log('[BANDS][INVENTORY] Bandas no target:', Object.keys(targetBands));
      Object.keys(bands).forEach(key => {
        const band = bands[key];
        const normalizedKey = BAND_ALIAS_MAP[key] || key;
        const target = targetBands[key] || targetBands[normalizedKey];
        console.log(`[BANDS][INVENTORY] 📍 ${key} (→ ${normalizedKey}):`, {
          hasValue: Number.isFinite(band?.value),
          value: band?.value?.toFixed(2),
          hasTarget: !!target,
          target_db: target?.target_db?.toFixed(2),
          target_range: target?.target_range ? `${target.target_range.min?.toFixed(2)} a ${target.target_range.max?.toFixed(2)}` : 'MISSING',
          will_analyze: Number.isFinite(band?.value) && !!target
        });
      });
      console.log('[BANDS][INVENTORY] ═══════════════════════════════════════════');
    }
    
    console.log('[BANDS] ✅ Usando EXCLUSIVAMENTE consolidatedData.metrics.bands:', {
      bandsCount: Object.keys(bands).length,
      source: 'consolidatedData'
    });
    
    // 🔥 LOOP DINÂMICO: Iterar sobre TODAS as bandas medidas
    // Isso garante que NENHUMA banda seja esquecida (brilho, presenca, etc)
    const processedKeys = new Set();
    
    for (const rawKey of Object.keys(bands)) {
      const bandValue = bands[rawKey]?.value;
      
      if (!Number.isFinite(bandValue)) {
        if (DEBUG) console.log(`[BANDS] ⏭️ Pulando ${rawKey}: valor não finito`);
        continue;
      }
      
      // 🎯 NORMALIZAR KEY: aplicar alias map
      const normalizedKey = BAND_ALIAS_MAP[rawKey] || rawKey;
      
      // 🚫 EVITAR DUPLICATAS: Se já processamos essa banda normalizada, pular
      if (processedKeys.has(normalizedKey)) {
        if (DEBUG) console.log(`[BANDS] ⏭️ Pulando ${rawKey}: já processado como ${normalizedKey}`);
        continue;
      }
      
      // 🔍 BUSCAR TARGET: tentar com rawKey primeiro, depois normalizedKey
      let targetInfo = targetBands[rawKey] || targetBands[normalizedKey];
      
      if (!targetInfo) {
        // 🔄 TENTATIVA EXTRA: Buscar aliases reversos no target
        for (const [alias, canonical] of Object.entries(BAND_ALIAS_MAP)) {
          if (canonical === normalizedKey && targetBands[alias]) {
            targetInfo = targetBands[alias];
            if (DEBUG) console.log(`[BANDS] ✅ Target encontrado via alias: ${alias} → ${normalizedKey}`);
            break;
          }
        }
      }
      
      if (!targetInfo) {
        if (DEBUG) console.log(`[BANDS] ⚠️ Pulando ${rawKey}: sem target disponível`);
        continue;
      }
      
      // ✅ PROCESSAR BANDA
      const label = BAND_LABELS[normalizedKey] || `${normalizedKey} (sem label)`;
      this.analyzeBand(normalizedKey, bandValue, label, suggestions, consolidatedData, rawKey);
      processedKeys.add(normalizedKey);
      
      if (DEBUG) {
        console.log(`[BANDS] ✅ Processado: ${rawKey} → ${normalizedKey} (${label})`);
      }
    }
    
    // 🔥 LOG FINAL: Resumo de sugestões geradas por bandas
    const bandSuggestions = suggestions.filter(s => s.metric && s.metric.startsWith('band_'));
    // DEBUG já declarado no topo da função (linha 1056)
    
    // 🔥 AUDITORIA CRÍTICA: Verificar se air/presence foram processados
    const hasAir = processedKeys.has('air') || processedKeys.has('brilho');
    const hasPresence = processedKeys.has('presence') || processedKeys.has('presenca');
    const airSuggestion = bandSuggestions.find(s => s.metric === 'band_air');
    const presenceSuggestion = bandSuggestions.find(s => s.metric === 'band_presence');
    
    // 🚨 LOG SEMPRE VISÍVEL para bandas críticas (independente de DEBUG)
    console.log('[BANDS][AUDIT] 🔍 ════════════════════════════════════════════');
    console.log('[BANDS][AUDIT] AUDITORIA BANDAS CRÍTICAS (air/presence):');
    console.log('[BANDS][AUDIT] Banda "air" (brilho):', {
      processado: hasAir,
      sugestaoGerada: !!airSuggestion,
      metric: airSuggestion?.metric || 'NÃO GERADA',
      severity: airSuggestion?.severity?.level || 'N/A'
    });
    console.log('[BANDS][AUDIT] Banda "presence" (presenca):', {
      processado: hasPresence,
      sugestaoGerada: !!presenceSuggestion,
      metric: presenceSuggestion?.metric || 'NÃO GERADA',
      severity: presenceSuggestion?.severity?.level || 'N/A'
    });
    console.log('[BANDS][AUDIT] ════════════════════════════════════════════');
    
    if (DEBUG) {
      console.log('[BANDS][SUMMARY] 📊 ════════════════════════════════════════════');
      console.log('[BANDS][SUMMARY] RESUMO DE SUGESTÕES GERADAS:');
      console.log('[BANDS][SUMMARY] Total:', bandSuggestions.length);
      console.log('[BANDS][SUMMARY] Keys processadas:', Array.from(processedKeys).join(', '));
      bandSuggestions.forEach(s => {
        console.log(`[BANDS][SUMMARY] ✅ ${s.metric}:`, {
          severity: s.severity?.level,
          delta: s.deltaNum?.toFixed(2),
          status: s.status
        });
      });
      console.log('[BANDS][SUMMARY] ════════════════════════════════════════════');
    } else {
      console.log('[BANDS][SUMMARY] 📊 Bandas processadas:', processedKeys.size, '| Sugestões geradas:', bandSuggestions.length);
    }

    logAudio('problems_v2', 'spectral_analysis', { 
      bandsDetected: Object.keys(bands).length,
      bandsProcessed: processedKeys.size,
      suggestionsGenerated: bandSuggestions.length
    });
  }
  
  /**
   * 🎵 Análise Individual de Banda Espectral
   * ✅ REGRA ABSOLUTA: Usa EXCLUSIVAMENTE consolidatedData (metrics + genreTargets)
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, value passado por parâmetro, ou fallbacks
   * @param {string} bandKey - Key normalizada da banda (air, presence, low_mid, etc)
   * @param {number} value - Valor medido (dBFS)
   * @param {string} bandName - Label legível
   * @param {Array} suggestions - Array de sugestões
   * @param {Object} consolidatedData - Dados consolidados
   * @param {string} rawKey - Key original do JSON (brilho, presenca, etc) - usado para buscar target
   */
  analyzeBand(bandKey, value, bandName, suggestions, consolidatedData, rawKey = null) {
    const DEBUG = process.env.DEBUG_SUGGESTIONS === '1';
    
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão`);
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics.bands
    // Tentar com rawKey primeiro (ex: 'brilho'), depois normalizedKey (ex: 'air')
    const searchKey = rawKey || bandKey;
    let bandData = consolidatedData.metrics?.bands?.[searchKey] || consolidatedData.metrics?.bands?.[bandKey];
    
    if (DEBUG) {
      console.log(`[BAND-${bandKey.toUpperCase()}] 🔍 AUDITORIA CRÍTICA DE DADOS:`);
      console.log(`[BAND-${bandKey.toUpperCase()}] - searchKey: ${searchKey} (rawKey: ${rawKey}, bandKey: ${bandKey})`);
      console.log(`[BAND-${bandKey.toUpperCase()}] - bandData completo:`, JSON.stringify(bandData, null, 2));
      console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.value:`, bandData?.value);
      console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.unit:`, bandData?.unit);
      console.log(`[BAND-${bandKey.toUpperCase()}] - typeof bandData.value:`, typeof bandData?.value);
      console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.value < 0:`, bandData?.value < 0);
    }
    
    const measured = bandData?.value ?? value;  // Fallback para value passado por parâmetro
    
    if (DEBUG) {
      console.log(`[BAND-${bandKey.toUpperCase()}] 🎯 VALOR MEDIDO FINAL: ${measured} ${bandData?.unit || 'NO_UNIT'}`);
    }
    
    if (!Number.isFinite(measured)) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData.metrics.bands.${searchKey}.value ausente ou inválido`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Valor encontrado:`, bandData);
      return;
    }
    
    // 🔥 VALIDAÇÃO CRÍTICA: Valor deve ser negativo (dBFS)
    if (measured >= 0) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌❌❌ BUG CRÍTICO DETECTADO! ❌❌❌`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Valor positivo ${measured} detectado quando deveria ser dBFS NEGATIVO!`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Isso indica que .value está com PERCENTAGE ao invés de energy_db!`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData.metrics.bands[${searchKey}]:`, JSON.stringify(bandData, null, 2));
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ ABORTING SUGESTÃO - DADOS CORROMPIDOS`);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets.bands
    // Tentar com rawKey primeiro (ex: 'brilho'), depois normalizedKey (ex: 'air')
    let targetInfo = null;
    if (rawKey) {
      targetInfo = this.getMetricTarget('bands', rawKey, consolidatedData);
      if (DEBUG && targetInfo) {
        console.log(`[BAND-${bandKey.toUpperCase()}] ✅ Target encontrado com rawKey: ${rawKey}`);
      }
    }
    if (!targetInfo) {
      targetInfo = this.getMetricTarget('bands', bandKey, consolidatedData);
      if (DEBUG && targetInfo) {
        console.log(`[BAND-${bandKey.toUpperCase()}] ✅ Target encontrado com bandKey: ${bandKey}`);
      }
    }
    if (!targetInfo) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData.genreTargets.bands.${bandKey} ausente - pulando sugestão`);
      return;
    }

    const target = targetInfo.target;
    const tolerance = targetInfo.tolerance;
    const critical = targetInfo.critical;
    const target_range = targetInfo.target_range;  // ✅ Bandas SEMPRE têm target_range

    // ✅ LOG: Confirmar origem dos dados
    console.log(`[BAND-${bandKey.toUpperCase()}] ✅ Usando consolidatedData:`, {
      measured_db: measured.toFixed(2),
      target_db: target.toFixed(2),
      target_range_min: target_range && target_range.min && target_range.min.toFixed(2),
      target_range_max: target_range && target_range.max && target_range.max.toFixed(2),
      tolerance_db: tolerance.toFixed(2),
      source: 'consolidatedData'
    });
    
    // 🎯 BANDAS: SEMPRE usar target_range.min/max, NUNCA calcular com tolerância
    // 🔥 CRÍTICO: Bandas não usam target ± tolerance, apenas target_range explícito
    const threshold = { 
      target, 
      tolerance, 
      critical,
      target_range: target_range  // ✅ Passar target_range para getRangeBounds priorizar
    };
    const bounds = this.getRangeBounds(threshold);
    
    // 🛡️ VALIDAÇÃO: Se target_range existia mas não foi usado, abortar
    if (target_range && (bounds.min === target - tolerance || bounds.max === target + tolerance)) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ BUG: target_range ignorado, usando target±tol!`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ target_range:`, target_range);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ bounds calculados:`, bounds);
      // Forçar uso do target_range
      bounds.min = target_range.min ?? target_range.min_db;
      bounds.max = target_range.max ?? target_range.max_db;
      console.log(`[BAND-${bandKey.toUpperCase()}] ✅ CORRIGIDO: bounds forçados para target_range:`, bounds);
    }
    
    // 🎯 Calcular delta: diferença até borda mais próxima do range
    let rawDelta;
    if (measured < bounds.min) {
      rawDelta = measured - bounds.min; // Negativo (precisa aumentar)
    } else if (measured > bounds.max) {
      rawDelta = measured - bounds.max; // Positivo (precisa reduzir)
    } else {
      rawDelta = 0; // Dentro do range
    }
    
    // 🔥 LOG MANDATÓRIO: Mostrar cálculo do delta ANTES de gerar sugestão
    console.log(`[SUGGESTION_DEBUG][BANDS][${bandKey.toUpperCase()}] 📊 Cálculo do Delta:`, {
      metric: bandName,
      measured: measured.toFixed(2),
      target: target.toFixed(2),
      bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
      delta: rawDelta.toFixed(2),
      formula: rawDelta === 0 ? 'dentro do range' : (measured < bounds.min ? `${measured.toFixed(2)} - ${bounds.min.toFixed(2)} = ${rawDelta.toFixed(2)}` : `${measured.toFixed(2)} - ${bounds.max.toFixed(2)} = ${rawDelta.toFixed(2)}`)
    });
    
    const diff = Math.abs(rawDelta);
    const severity = this.calculateSeverity(diff, tolerance, critical);
    
    // 🎯 Usar buildBandSuggestion para mensagens consistentes
    const freqRange = FREQUENCY_RANGES[bandKey] || '';
    const textSuggestion = buildBandSuggestion({
      bandKey,
      bandLabel: BAND_LABELS[bandKey] || bandName,
      freqRange,
      value: measured,
      target: target,
      tolerance: tolerance,
      min: bounds.min,  // ✅ PASSAR min REAL do target_range
      max: bounds.max,  // ✅ PASSAR max REAL do target_range
      unit: 'dB', // Forçar dB explicitamente
      genre: this.genre
    });
    
    let message = textSuggestion.message;
    let explanation = textSuggestion.explanation;
    let action = textSuggestion.action;
    
    let status = 'ok';
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (measured > bounds.max) {
        status = 'high';
      } else if (measured < bounds.min) {
        status = 'low';
      }
    }
    
    console.log('[GENRE-FLOW][S2_BUILDER]', {
      metric: `BAND_${bandKey.toUpperCase()}`,
      genre: this.genre,
      currentValue: measured,
      targetValue: target,
      delta: rawDelta,
      deltaNum: rawDelta,
      rawMetricValue: measured,
      rawTargetObject: targetInfo
    });
    
    const suggestion = {
      metric: `band_${bandKey}`,
      severity,
      message,
      explanation,
      action,
      currentValue: `${measured.toFixed(1)} dB`,
      targetValue: bounds.min !== bounds.max ? `${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB` : `${bounds.max.toFixed(1)} dB`,
      delta: rawDelta === 0 ? '0.0 dB (dentro do range)' : `${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(1)} dB`,
      deltaNum: rawDelta, // 🎯 FASE 3: Adicionar valor numérico para validação IA
      status, // 🎯 FASE 3: Status explícito para validação
      priority: severity.priority,
      bandName
    };
    
    console.log("[TRACE_S2_BUILDER]", {
      metric: `BAND_${bandKey.toUpperCase()}`,
      current: measured,
      target: target,
      rawTargetObject: consolidatedData?.genreTargets?.bands?.[bandKey],
      diff: rawDelta,
      suggestionPreview: suggestion
    });
    
    // 🔍 DEBUG: Log completo ANTES do gate
    console.log(`[DEBUG_GATE][BAND_${bandKey.toUpperCase()}] 🔬 Análise completa:`, {
      measured: measured.toFixed(2),
      target: target.toFixed(2),
      bounds: { min: bounds.min.toFixed(2), max: bounds.max.toFixed(2) },
      rawDelta: rawDelta.toFixed(4),
      rawDeltaIsZero: rawDelta === 0,
      rawDeltaIsStrictlyZero: rawDelta === 0,
      rawDeltaAbsolute: Math.abs(rawDelta).toFixed(4),
      severityLevel: severity.level,
      severityLabel: severity.label,
      willPass: rawDelta !== 0,
      formula: measured < bounds.min ? `${measured.toFixed(2)} < ${bounds.min.toFixed(2)} → delta = ${rawDelta.toFixed(2)}` :
               measured > bounds.max ? `${measured.toFixed(2)} > ${bounds.max.toFixed(2)} → delta = ${rawDelta.toFixed(2)}` :
               `${bounds.min.toFixed(2)} ≤ ${measured.toFixed(2)} ≤ ${bounds.max.toFixed(2)} → delta = 0`
    });
    
    // 🎯 GATE: Bloquear sugestão se banda está OK (dentro do range)
    if (rawDelta === 0) {
      console.log('[SUGGESTION_GATE] ✅ Sugestão OMITIDA (banda OK):', {
        metric: `BAND_${bandKey.toUpperCase()}`,
        bandName: bandName,
        value: measured.toFixed(2),
        bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
        delta: rawDelta,
        severity: severity.level,
        reason: 'rawDelta === 0 (dentro do range)'
      });
      return;
    }
    
    console.log(`[DEBUG_GATE][BAND_${bandKey.toUpperCase()}] ✅ PASSOU pelo gate - gerando sugestão`, {
      bandKey,
      rawDelta: rawDelta.toFixed(2),
      severity: severity.level
    });
    
    suggestions.push(suggestion);
  }
  
  /**
   * ⚖️ Calcular Severidade Baseada em Tolerância
   * 🎯 REFATORADO: Usa classificador unificado metric-classifier.js
   * REGRA: OK se diff ≤ tol, ATTENTION se diff ≤ 2×tol, CRITICAL se > 2×tol
   */
  calculateSeverity(diff, tolerance, critical) {
    console.log('[AUDIT_FIX][CALC_SEVERITY] Usando classificador unificado:', {
      diff: typeof diff === 'number' ? diff.toFixed(3) : diff,
      tolerance: typeof tolerance === 'number' ? tolerance.toFixed(3) : tolerance,
      critical_ignored: 'DEPRECATED - usando 2×tolerance sempre'
    });
    
    // 🎯 Usar classificador unificado (ignora parâmetro 'critical' obsoleto)
    const classification = classifyMetric(diff, tolerance, { metricName: 'generic' });
    
    // 🔄 Mapear para estrutura antiga (backward compatibility)
    const severityMap = {
      'ok': this.severity.OK,
      'attention': this.severity.WARNING,  // ⚠️ Mapeado para WARNING (compatibilidade)
      'critical': this.severity.CRITICAL
    };
    
    const result = severityMap[classification.level] || this.severity.CRITICAL;
    
    console.log('[AUDIT_FIX][CALC_SEVERITY] Resultado:', {
      level: result.level,
      label: result.label,
      priority: result.priority
    });
    
    return result;
  }
  
  /**
   * 📈 Calcular Severidade Específica para Dynamic Range (Sistema de 3 Níveis)
   */
  calculateDynamicRangeSeverity(drValue, threshold) {
    const diff = Math.abs(drValue - threshold.target);
    
    // 🎯 SISTEMA ESPECÍFICO PARA DINÂMICA POR GÊNERO
    if (diff <= threshold.tolerance * 0.3) {
      return this.severity.IDEAL; // Dentro de 30% da tolerância = ideal
    } else if (diff <= threshold.tolerance) {
      return this.severity.AJUSTE_LEVE; // Dentro da tolerância = ajuste leve
    } else {
      return this.severity.CORRIGIR; // Fora da tolerância = corrigir
    }
  }
  
  /**
   * 🎯 Calcular Severidade Específica para True Peak
   */
  calculateSeverityForTruePeak(diff, tolerance, critical) {
    if (diff <= 0) {
      return this.severity.OK; // Negativo = seguro
    } else if (diff <= tolerance) {
      return this.severity.WARNING;
    } else {
      return this.severity.CRITICAL;
    }
  }
  
  /**
   * 📊 Gerar Resumo Final - AUDITORIA DYNAMIC RANGE POR GÊNERO
   */
  generateSummary(suggestions, problems) {
    const corrigir = suggestions.filter(s => s.severity.level === 'corrigir').length;
    const ajusteLeve = suggestions.filter(s => s.severity.level === 'ajuste_leve').length;
    const ideal = suggestions.filter(s => s.severity.level === 'ideal').length;
    
    // Compatibilidade com sistema antigo
    const critical = suggestions.filter(s => s.severity.level === 'critical').length;
    const warning = suggestions.filter(s => s.severity.level === 'warning').length;
    const ok = suggestions.filter(s => s.severity.level === 'ok').length;
    
    let overallRating;
    let readyForRelease;
    
    // 🎯 LÓGICA ESPECÍFICA PARA DYNAMIC RANGE POR GÊNERO
    const totalCorrigir = corrigir + critical;
    const totalAjuste = ajusteLeve + warning;
    const totalIdeal = ideal + ok;
    
    if (totalCorrigir > 0) {
      overallRating = `Dinâmica precisa correção para ${this.genre}`;
      readyForRelease = false;
    } else if (totalAjuste > 2) {
      overallRating = `Dinâmica precisa ajustes para ${this.genre}`;
      readyForRelease = false;
    } else if (totalAjuste > 0) {
      overallRating = `Dinâmica boa para ${this.genre} com pequenos ajustes`;
      readyForRelease = true;
    } else {
      overallRating = `Dinâmica excelente para ${this.genre}`;
      readyForRelease = true;
    }
    
    return {
      overallRating,
      readyForRelease,
      genre: this._originalGenre || this.genre,  // 🔥 Usar original, não interno
      // Novos campos específicos para dinâmica
      corrigirIssues: totalCorrigir,
      ajusteLeveIssues: totalAjuste,
      idealMetrics: totalIdeal,
      // Campos legados para compatibilidade
      criticalIssues: critical,
      warningIssues: warning,
      okMetrics: ok,
      totalAnalyzed: suggestions.length,
      score: Math.max(0, 10 - (totalCorrigir * 4) - (totalAjuste * 1))
    };
  }
  
  /**
   * 📝 Formatar Sugestão para JSON Final
   * Garante estrutura completa e consistente para frontend e AI enrichment
   */
  formatSuggestionForJSON(suggestion) {
    return {
      // 🆔 Identificação única
      id: suggestion.id || uuidv4(),
      
      // 🎯 Tipo de métrica (compatibilidade com frontend)
      type: suggestion.metric,
      metric: suggestion.metric,
      
      // 🚦 Severidade
      severity: suggestion.severity && suggestion.severity.level || 'unknown',
      color: suggestion.severity && suggestion.severity.colorHex || '#808080',
      colorCode: suggestion.severity && suggestion.severity.color || 'gray',
      icon: suggestion.severity && suggestion.severity.icon || '❓',
      priority: suggestion.priority || 99,
      
      // 📊 Mensagens e Ação
      title: suggestion.message || 'Sem título',
      message: suggestion.message,
      problem: suggestion.explanation || 'Sem descrição do problema',
      explanation: suggestion.explanation,
      cause: suggestion.cause || null,  // Pode ser enriquecido por AI
      solution: suggestion.action || 'Sem ação específica',
      action: suggestion.action,
      extra: suggestion.extra || null,   // Dicas adicionais para AI
      
      // 🔧 Plugin/Ferramenta sugerida
      plugin: suggestion.plugin || null,
      
      // 📏 Valores numéricos
      currentValue: suggestion.currentValue,
      targetValue: suggestion.targetValue,
      delta: suggestion.delta,
      
      // 🎛️ Campos específicos de bandas
      bandName: suggestion.bandName || null,
      actionableGain: suggestion.actionableGain || null,
      isProgressiveAdjustment: suggestion.isProgressiveAdjustment || false,
      maxSingleAdjustment: suggestion.maxSingleAdjustment || null,
      
      // 🤖 Marcadores para AI enrichment
      aiEnhanced: false,
      enrichmentStatus: 'pending'
    };
  }
  
  /**
   * 🚨 Formatar Problema para JSON Final
   */
  formatProblemForJSON(problem) {
    return {
      id: problem.id,
      category: problem.category,
      severity: problem.severity.level,
      color: problem.severity.colorHex,
      message: problem.message,
      impact: problem.impact
    };
  }
  
  /**
   * 🔇 Resultado Vazio para Casos de Erro
   */
  getEmptyResult() {
    return {
      genre: this.genre,
      suggestions: [],
      problems: [],
      summary: {
        overallRating: 'Análise não disponível',
        readyForRelease: false,
        criticalIssues: 0,
        warningIssues: 0,
        okMetrics: 0,
        totalAnalyzed: 0,
        score: 0
      },
      metadata: {
        totalSuggestions: 0,
        criticalCount: 0,
        warningCount: 0,
        okCount: 0,
        analysisDate: new Date().toISOString(),
        genre: this.genre,
        version: '2.0.0'
      }
    };
  }
}

/**
 * � Função Principal para Exportação
 * 
 * @param {Object} audioMetrics - Métricas de áudio calculadas
 * @param {string} genre - Nome do gênero
 * @param {Object|null} customTargets - Targets carregados do filesystem (opcional)
 * @returns {Object} - Análise completa com sugestões
 */
/**
 * 🎯 REFATORADO: Agora EXIGE customTargets e/ou finalJSON.data.genreTargets
 * Garante que TODAS as sugestões usem valores IDÊNTICOS aos da tabela de comparação
 * 
 * @param {Object} audioMetrics - Métricas de áudio processadas
 * @param {string} genre - Gênero musical detectado
 * @param {Object} customTargets - OBRIGATÓRIO: Targets carregados do filesystem
 * @param {Object} finalJSON - Objeto completo com data.metrics e data.genreTargets
 * @returns {Object} - Análise completa com sugestões
 * @throws {Error} - Se customTargets ausente e finalJSON.data.genreTargets ausente
 */
export function analyzeProblemsAndSuggestionsV2(audioMetrics, genre = 'default', customTargets = null, finalJSON = null) {
  process.stderr.write("\n\n");
  process.stderr.write("╔════════════════════════════════════════════════════════════════╗\n");
  process.stderr.write("║  🔥🔥� DENTRO DO SUGGESTION ENGINE 🔥🔥🔥                    ║\n");
  process.stderr.write("╚════════════════════════════════════════════════════════════════╝\n");
  process.stderr.write("[ENGINE] ⏰ Timestamp: " + new Date().toISOString() + "\n");
  process.stderr.write("[ENGINE] 📥 Parâmetros recebidos:\n");
  process.stderr.write("  - genre: " + genre + "\n");
  process.stderr.write("  - customTargets disponível?: " + !!customTargets + "\n");
  process.stderr.write("  - finalJSON disponível?: " + !!finalJSON + "\n");
  process.stderr.write("  - finalJSON.data disponível?: " + !!(finalJSON && finalJSON.data) + "\n");
  
  // 🔥 VALIDAÇÃO CRÍTICA: Exigir targets válidos
  const hasCustomTargets = customTargets && typeof customTargets === 'object' && Object.keys(customTargets).length > 0;
  const hasGenreTargets = finalJSON && finalJSON.data && finalJSON.data.genreTargets && typeof finalJSON.data.genreTargets === 'object';
  
  if (!hasCustomTargets && !hasGenreTargets) {
    process.stderr.write("[ENGINE] 🚨 ERRO CRÍTICO: Nenhum target disponível!\n");
    process.stderr.write("[ENGINE] ❌ customTargets: ausente ou vazio\n");
    process.stderr.write("[ENGINE] ❌ finalJSON.data.genreTargets: ausente\n");
    process.stderr.write("[ENGINE] ⚠️ Sistema NÃO PODE gerar sugestões sem targets\n");
    process.stderr.write("════════════════════════════════════════════════════════════════\n\n");
    throw new Error(`[SUGGESTION_ENGINE] Targets obrigatórios ausentes para gênero: ${genre}. Use loadGenreTargetsFromWorker(genre).`);
  }
  
  // 🔧 NORMALIZAÇÃO: Converter formato JSON real → formato analyzer
  let effectiveTargets = hasGenreTargets ? finalJSON.data.genreTargets : customTargets;
  
  process.stderr.write("[ENGINE] 🔍 Formato original dos targets:\n");
  process.stderr.write("  - Tem lufs_target?: " + ('lufs_target' in effectiveTargets) + "\n");
  process.stderr.write("  - Tem lufs.target?: " + (effectiveTargets.lufs && 'target' in effectiveTargets.lufs) + "\n");
  
  // ✅ NORMALIZAR: Se targets estiverem no formato JSON real (lufs_target), converter
  effectiveTargets = normalizeGenreTargets(effectiveTargets);
  
  if (!effectiveTargets || !validateNormalizedTargets(effectiveTargets)) {
    process.stderr.write("[ENGINE] 🚨 ERRO: Falha na normalização dos targets!\n");
    throw new Error(`[SUGGESTION_ENGINE] Targets inválidos após normalização para gênero: ${genre}`);
  }
  
  process.stderr.write("[ENGINE] 🎯 Targets usados: " + (hasGenreTargets ? 'finalJSON.data.genreTargets' : 'customTargets') + "\n");
  process.stderr.write("[ENGINE] 📊 Targets disponíveis: " + JSON.stringify(Object.keys(effectiveTargets)) + "\n");
  process.stderr.write("════════════════════════════════════════════════════════════════\n\n");
  
  // ✅ NOVA POLÍTICA: Construtor recebe APENAS genre
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre);
  
  // 🔥 CRÍTICO: Se finalJSON disponível, extrair metrics e targets consolidados
  if (finalJSON && finalJSON.data) {
    console.error('[SUGGESTION_REFACTOR] ✅ Usando finalJSON.data.metrics e finalJSON.data.genreTargets');
    return analyzer.analyzeWithEducationalSuggestions(audioMetrics, finalJSON.data);
  } else {
    console.error('[SUGGESTION_REFACTOR] ⚠️ Usando customTargets sem consolidatedData');
    // Criar consolidatedData mínimo para compatibilidade
    const minimalConsolidatedData = {
      genreTargets: effectiveTargets,
      metrics: null // Será preenchido pelo analyzer via audioMetrics
    };
    return analyzer.analyzeWithEducationalSuggestions(audioMetrics, minimalConsolidatedData);
  }
}

/**
 * 📋 Função de Compatibilidade com Sistema Antigo
 */
export function analyzeProblemsAndSuggestions(audioMetrics, genre = 'default') {
  return analyzeProblemsAndSuggestionsV2(audioMetrics, genre);
}

console.log('🎯 Problems & Suggestions Analyzer V2 carregado - Sistema educativo com criticidade por cores');