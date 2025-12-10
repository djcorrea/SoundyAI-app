// 🎯 PROBLEMS & SUGGESTIONS ANALYZER V2 - Sistema Educativo com Criticidade por Cores
// Implementação completa para análise inteligente de problemas e geração de sugestões educativas

// eslint-disable-next-line import/no-unresolved
import { logAudio } from '../error-handling.js';
import { v4 as uuidv4 } from 'uuid';

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
   * ✅ CORREÇÃO CRÍTICA: Lógica diferente para bandas vs outras métricas
   * 
   * BANDAS (têm target_range):
   *   - Use target_range.min e target_range.max diretamente
   * 
   * OUTRAS MÉTRICAS (LUFS, TP, DR, Stereo - NÃO têm target_range):
   *   - Use target ± tolerance
   * 
   * @param {Object} threshold - Objeto com { target, tolerance, target_range? }
   * @returns {Object} { min, max }
   */
  getRangeBounds(threshold) {
    // ✅ CORREÇÃO: BANDAS usam target_range (quando disponível)
    if (threshold.target_range && 
        typeof threshold.target_range.min === 'number' && 
        typeof threshold.target_range.max === 'number') {
      console.log('[RANGE_BOUNDS] ✅ Usando target_range (banda):', threshold.target_range);
      return {
        min: threshold.target_range.min,
        max: threshold.target_range.max
      };
    }
    
    // ✅ CORREÇÃO: OUTRAS MÉTRICAS usam target ± tolerance
    // Validar que target e tolerance existem
    if (typeof threshold.target !== 'number' || typeof threshold.tolerance !== 'number') {
      console.error('[RANGE_BOUNDS] ❌ ERRO: target ou tolerance inválidos:', {
        target: threshold.target,
        tolerance: threshold.tolerance,
        targetType: typeof threshold.target,
        toleranceType: typeof threshold.tolerance
      });
      // Retornar range impossível para evitar sugestões com NaN
      return { min: Infinity, max: -Infinity };
    }
    
    console.log('[RANGE_BOUNDS] ✅ Calculando range (métrica geral):', {
      target: threshold.target,
      tolerance: threshold.tolerance,
      min: threshold.target - threshold.tolerance,
      max: threshold.target + threshold.tolerance
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
    const genreTargets = consolidatedData?.genreTargets;
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
      
      const t = genreTargets.bands?.[bandKey];
      
      // ✅ CORREÇÃO: JSON usa "target_db" nas bandas, NÃO "target"
      if (!t || typeof t.target_db !== 'number') {
        console.warn(`[TARGET-HELPER] ⚠️ Target inválido para banda ${bandKey}:`, {
          exists: !!t,
          hasTargetDb: t ? 'target_db' in t : false,
          hasTarget: t ? 'target' in t : false,
          actualKeys: t ? Object.keys(t) : []
        });
        return null;
      }
      
      // ✅ CORREÇÃO: Retornar target_range se disponível (bandas sempre têm)
      return {
        target: t.target_db,  // ✅ Usar target_db, não target
        tolerance: t.tol_db ?? 3.0,  // ✅ Usar tol_db se disponível
        critical: t.critical ?? (t.tol_db ?? 3.0) * 1.5,
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
          loudness: consolidatedData.metrics?.loudness?.value,
          truePeak: consolidatedData.metrics?.truePeak?.value,
          dr: consolidatedData.metrics?.dr?.value
        });
        console.log('[AUDIT-PROBLEMS] 🎯 Usando genreTargets consolidados:', {
          lufs: consolidatedData.genreTargets?.lufs?.target,
          truePeak: consolidatedData.genreTargets?.truePeak?.target,
          dr: consolidatedData.genreTargets?.dr?.target
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
      console.log('[AUDIT-PROBLEMS-RESULT] summary.genre:', summary?.genre);
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
        s.severity?.level === 'critical'
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
    const metric = consolidatedData.metrics?.loudness;
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
    
    let message, explanation, action, status = 'ok';
    
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (lufs > bounds.max) {
        // 🎯 FASE 3: Calcular ajuste realista
        const excessDb = lufs - bounds.max;
        const { value: rec, mode } = computeRecommendedGain(-excessDb, { maxStepDb: 6.0 }); // LUFS permite até 6dB
        const absRec = Math.abs(rec);
        
        status = 'high';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} LUFS muito alto: ${lufs.toFixed(1)} dB (máximo: ${bounds.max.toFixed(1)} dB, diff: +${excessDb.toFixed(1)} dB)`;
        
        explanation = `Você está ${excessDb.toFixed(1)} dB acima do máximo permitido para ${this.genre} (range ideal: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB LUFS). ` +
          `Isso pode causar distorção digital, fadiga auditiva e rejeição em plataformas de streaming que aplicam normalização agressiva.`;
        
        if (mode === 'staged') {
          action = `Reduza o loudness em etapas: primeiro aplique ~${absRec.toFixed(1)} dB de redução no limiter master, reexporte e meça novamente. ` +
            `Se ainda estiver acima do range, repita o processo. Total a reduzir: ${excessDb.toFixed(1)} dB. ` +
            `Use compressão de bus e ajuste do ceiling do limiter, não apenas gain bruto.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: reduza cerca de ${absRec.toFixed(1)} dB no limiter master para refinamento. Está muito próximo do ideal.`;
        } else {
          action = `Reduza aproximadamente ${absRec.toFixed(1)} dB no limiter master. Ajuste o ceiling e/ou reduza o input gain do limiter. ` +
            `Preserve a dinâmica natural da música.`;
        }
      } else if (lufs < bounds.min) {
        // 🎯 FASE 3: Calcular ajuste realista
        const deficitDb = bounds.min - lufs;
        const { value: rec, mode } = computeRecommendedGain(deficitDb, { maxStepDb: 6.0 });
        const absRec = Math.abs(rec);
        
        status = 'low';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} LUFS muito baixo: ${lufs.toFixed(1)} dB (mínimo: ${bounds.min.toFixed(1)} dB, diff: -${deficitDb.toFixed(1)} dB)`;
        
        explanation = `Você está ${deficitDb.toFixed(1)} dB abaixo do mínimo recomendado para ${this.genre} (range ideal: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB LUFS). ` +
          `Sua música ficará muito baixa comparada a outras no mesmo contexto, prejudicando o impacto sonoro.`;
        
        if (mode === 'staged') {
          action = `Aumente o loudness em etapas: primeiro eleve ~${absRec.toFixed(1)} dB usando limiter suave (ratio baixo, attack/release moderados), reexporte e meça. ` +
            `Se ainda estiver abaixo, repita. Total a aumentar: ${deficitDb.toFixed(1)} dB. ` +
            `Considere também compressão de bus antes do limiter para controlar picos sem destruir dinâmica.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: aumente cerca de ${absRec.toFixed(1)} dB no limiter master para refinamento. Está muito próximo do ideal.`;
        } else {
          action = `Aumente aproximadamente ${absRec.toFixed(1)} dB usando limiter master com configuração suave. ` +
            `Eleve gradualmente o input gain ou reduza o threshold. Monitore o true peak para evitar clipping.`;
        }
      }
    } else {
      message = `🟢 LUFS ideal: ${lufs.toFixed(1)} dB`;
      explanation = `Perfeito para ${this.genre}! Seu loudness está dentro do range ideal (${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB LUFS) para streaming e rádio. ` +
        `Esse nível garante competitividade sonora sem sacrificar qualidade ou dinâmica.`;
      action = `Mantenha esse nível de LUFS. Está excelente! Nenhum ajuste necessário.`;
    }
    
    suggestions.push({
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
    });
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
    const metric = consolidatedData.metrics?.truePeak;
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
    
    let message, explanation, action, status = 'ok';
    
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (truePeak > bounds.max) {
        // 🎯 FASE 3: Calcular ajuste realista
        const excessDb = truePeak - bounds.max;
        const { value: rec, mode } = computeRecommendedGain(-excessDb, { maxStepDb: 3.0 }); // True Peak permite até 3dB
        const absRec = Math.abs(rec);
        
        status = 'high';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} True Peak ${severity.level === 'critical' ? 'crítico' : 'alto'}: ${truePeak.toFixed(1)} dBTP (máximo seguro: ${bounds.max.toFixed(1)} dBTP, diff: +${excessDb.toFixed(1)} dB)`;
        
        explanation = `${severity.level === 'critical' ? 'ATENÇÃO! ' : ''}Valores acima de ${bounds.max.toFixed(1)} dBTP causam clipping digital e distorção audível. ` +
          `Você está ${excessDb.toFixed(1)} dB acima do limite seguro. ${severity.level === 'critical' ? 'Isso quebra padrões técnicos.' : 'Alguns sistemas podem apresentar distorção leve.'}`;
        
        if (mode === 'staged') {
          action = `${severity.level === 'critical' ? 'URGENTE: ' : ''}Reduza em etapas: primeiro aplique ~${absRec.toFixed(1)} dB de redução no limiter, reavalie. ` +
            `Se ainda estiver acima, repita. Total a reduzir: ${excessDb.toFixed(1)} dB. Use oversampling 4x para evitar clipping.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: reduza cerca de ${absRec.toFixed(1)} dB no limiter para refinamento máximo. Está muito próximo do ideal.`;
        } else {
          action = `${severity.level === 'critical' ? 'URGENTE: ' : ''}Reduza aproximadamente ${absRec.toFixed(1)} dB no limiter. ` +
            `Use oversampling 4x se disponível para evitar clipping digital e preservar transparência.`;
        }
      }
    } else {
      message = `🟢 True Peak seguro: ${truePeak.toFixed(1)} dBTP`;
      explanation = `Excelente! Dentro do range seguro (até ${bounds.max.toFixed(1)} dBTP). Sem risco de clipping digital. Ideal para streaming e distribuição.`;
      action = `Perfeito! Mantenha esse nível de true peak. Nenhum ajuste necessário.`;
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
    const metric = consolidatedData.metrics?.dr;
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
    
    let message, explanation, action, status = 'ok';
    
    if (severity.level === 'corrigir' || severity.level === 'ajuste_leve') {
      if (dr < bounds.min) {
        // 🎯 FASE 3: Calcular ajuste realista
        const deficitDb = bounds.min - dr;
        const { value: rec, mode } = computeRecommendedGain(deficitDb, { maxStepDb: 4.0 }); // DR permite até 4 LU
        const absRec = Math.abs(rec);
        
        status = 'low';
        message = `${severity.level === 'corrigir' ? '🔴' : '⚠️'} ${severity.level === 'corrigir' ? 'Sobre-compressão' : 'Levemente comprimido'} para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        
        explanation = `Dynamic Range ${severity.level === 'corrigir' ? 'muito baixo' : 'um pouco abaixo do ideal'} para ${this.genre} (range recomendado: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LU). ` +
          `Seu DR está ${deficitDb.toFixed(1)} LU abaixo do mínimo${severity.level === 'corrigir' ? '. O áudio ficou muito "esmagado"' : ', mas ainda aceitável'}.`;
        
        if (mode === 'staged') {
          action = `Aumente a dinâmica em etapas: primeiro reduza ratio dos compressors para ganhar ~${absRec.toFixed(1)} LU, reavalie. ` +
            `Se ainda estiver abaixo, ajuste attack/release para preservar mais transientes. Total a aumentar: ${deficitDb.toFixed(1)} LU. ` +
            `Considere refazer o mastering com menos compressão agressiva.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: reduza levemente o ratio dos compressors para ganhar ~${absRec.toFixed(1)} LU de dinâmica. Está próximo do ideal.`;
        } else {
          action = `${severity.level === 'corrigir' ? 'Refaça o mastering com menos compressão. ' : ''}Reduza ratio dos compressors e/ou aumente threshold para ganhar aproximadamente ${absRec.toFixed(1)} LU de dinâmica. ` +
            `Para ${this.genre}, procure manter pelo menos ${bounds.min.toFixed(1)} LU.`;
        }
      } else if (dr > bounds.max) {
        // 🎯 FASE 3: Calcular ajuste realista
        const excessDb = dr - bounds.max;
        const { value: rec, mode } = computeRecommendedGain(-excessDb, { maxStepDb: 4.0 });
        const absRec = Math.abs(rec);
        
        status = 'high';
        message = `${severity.level === 'corrigir' ? '🔴' : '⚠️'} Range dinâmico ${severity.level === 'corrigir' ? 'excessivo' : 'levemente amplo'} para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        
        explanation = `Dynamic Range ${severity.level === 'corrigir' ? 'muito alto' : 'um pouco acima do ideal'} para ${this.genre} (range recomendado: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LU). ` +
          `Você está ${excessDb.toFixed(1)} LU acima do máximo. ${severity.level === 'corrigir' ? 'Pode prejudicar a competitividade sonora.' : 'Ainda funcional dependendo do estilo.'}`;
        
        if (mode === 'staged') {
          action = `Aplique compressão suave em etapas: primeiro comprima ~${absRec.toFixed(1)} LU usando ratio baixo (2:1 ou 3:1), reavalie. ` +
            `Se ainda estiver acima, aumente sutilmente o ratio. Total a comprimir: ${excessDb.toFixed(1)} LU. ` +
            `Use parallel compression para manter naturalidade.`;
        } else if (mode === 'micro') {
          action = `${severity.level === 'ajuste_leve' ? 'Monitore as partes mais baixas. ' : ''}Ajuste fino: comprima levemente (~${absRec.toFixed(1)} LU) com ratio muito baixo (2:1).`;
        } else {
          action = `Aplique compressão suave (ratio 2:1 a 3:1) para controlar a dinâmica em aproximadamente ${absRec.toFixed(1)} LU. ` +
            `Use attack/release moderados e parallel compression para manter naturalidade dentro do range ${bounds.min.toFixed(1)}-${bounds.max.toFixed(1)} LU.`;
        }
      }
    } else {
      message = `🟢 Dynamic Range ideal para ${this.genre}: ${dr.toFixed(1)} dB DR`;
      explanation = `Perfeito para ${this.genre}! Dinâmica balanceada dentro do range ideal (${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LU). Compressão profissional e natural.`;
      action = `Excelente! Sua compressão está perfeita para ${this.genre}. Mantenha esse equilíbrio.`;
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
    const metricStereo = consolidatedData.metrics?.stereo;
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
    
    let message, explanation, action, status = 'ok';
    
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (correlation < bounds.min) {
        // 🎯 FASE 3: Calcular ajuste realista (escala 0-1, não dB)
        const deficitDb = bounds.min - correlation;
        const { value: rec, mode } = computeRecommendedGain(deficitDb, { maxStepDb: 0.15, minStepDb: 0.05 }); // Stereo: 0.05-0.15 max
        const absRec = Math.abs(rec);
        
        status = 'low';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} Estéreo ${severity.level === 'critical' ? 'muito estreito' : 'estreito'}: ${correlation.toFixed(2)} (mínimo: ${bounds.min.toFixed(2)})`;
        
        explanation = `Sua música está ${severity.level === 'critical' ? 'muito estreita (quase mono)' : 'um pouco estreita'}. Correlação ${deficitDb.toFixed(2)} abaixo do mínimo recomendado ` +
          `(range: ${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}). ${severity.level === 'critical' ? 'Falta largura estéreo e espacialidade.' : 'Ainda funcional, mas pode ser melhorado.'}`;
        
        if (mode === 'staged') {
          action = `Aumente a largura estéreo em etapas: primeiro aplique widening suave (~${absRec.toFixed(2)} de aumento), teste em mono. ` +
            `Se ainda estiver estreito e sem problemas de fase, repita. Total a aumentar: ~${deficitDb.toFixed(2)}. ` +
            `Use reverb estéreo, duplicação de elementos ou panning mais agressivo.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: adicione reverb estéreo sutil ou panning para ganhar ~${absRec.toFixed(2)} de largura. Está próximo do ideal.`;
        } else {
          action = `Adicione largura estéreo aumentando aproximadamente ${absRec.toFixed(2)} na correlação. ` +
            `Use reverb estéreo, duplicação de elementos ou panning mais agressivo. Experimente M/S processing para abrir o mix.`;
        }
      } else if (correlation > bounds.max) {
        // 🎯 FASE 3: Calcular redução realista
        const excessDb = correlation - bounds.max;
        const { value: rec, mode } = computeRecommendedGain(-excessDb, { maxStepDb: 0.15, minStepDb: 0.05 });
        const absRec = Math.abs(rec);
        
        status = 'high';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} Estéreo ${severity.level === 'critical' ? 'excessivamente largo' : 'amplo'}: ${correlation.toFixed(2)} (máximo seguro: ${bounds.max.toFixed(2)})`;
        
        explanation = `${severity.level === 'critical' ? 'Muito largo' : 'Mais largo que o usual'} (${excessDb.toFixed(2)} acima do máximo de ${bounds.max.toFixed(2)}). ` +
          `Range recomendado: ${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}. ${severity.level === 'critical' ? 'Pode causar cancelamento de fase em reprodução mono (celulares, etc).' : 'Teste em mono para garantir sem cancelamentos.'}`;
        
        if (mode === 'staged') {
          action = `Reduza largura estéreo em etapas: primeiro centralize elementos importantes (~${absRec.toFixed(2)} de redução), teste em mono. ` +
            `Se ainda houver problemas, repita. Total a reduzir: ~${excessDb.toFixed(2)}. ` +
            `Centralize baixo, vocal principal e elementos fundamentais. Verifique compatibilidade mono.`;
        } else if (mode === 'micro') {
          action = `${severity.level === 'warning' ? 'Teste em mono para garantir sem cancelamentos. ' : ''}Ajuste fino: centralize levemente (~${absRec.toFixed(2)}) elementos mais abertos.`;
        } else {
          action = `Reduza stereo widening em aproximadamente ${absRec.toFixed(2)}. ` +
            `Centralize elementos importantes (baixo, vocal, kick, snare). Use M/S processing para controlar abertura lateral sem perder profundidade. ` +
            `${severity.level === 'critical' ? 'Teste obrigatoriamente em mono!' : ''}`;
        }
      }
    } else {
      message = `🟢 Estéreo ideal: ${correlation.toFixed(2)}`;
      explanation = `Perfeita largura estéreo para ${this.genre}. Dentro do range ideal (${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}). Boa espacialidade sem exageros, compatível com reprodução mono.`;
      action = `Excelente! Sua imagem estéreo está no ponto ideal. Nenhum ajuste necessário.`;
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
    console.log('[BANDS] ✅ Usando EXCLUSIVAMENTE consolidatedData.metrics.bands:', {
      bandsCount: Object.keys(bands).length,
      source: 'consolidatedData'
    });
    
    // 🎯 Sub Bass (20-60Hz)
    const subValue = consolidatedData.metrics.bands.sub?.value;
    if (Number.isFinite(subValue)) {
      this.analyzeBand('sub', subValue, 'Sub Bass (20-60Hz)', suggestions, consolidatedData);
    }
    
    // 🎯 Bass (60-150Hz)  
    const bassValue = consolidatedData.metrics.bands.bass?.value;
    if (Number.isFinite(bassValue)) {
      this.analyzeBand('bass', bassValue, 'Bass (60-150Hz)', suggestions, consolidatedData);
    }

    // 🎯 Low Mid (150-500Hz)
    const lowMidValue = consolidatedData.metrics.bands.low_mid?.value;
    if (Number.isFinite(lowMidValue)) {
      this.analyzeBand('low_mid', lowMidValue, 'Low Mid (150-500Hz)', suggestions, consolidatedData);
    }

    // 🎯 Mid (500-2000Hz)
    const midValue = consolidatedData.metrics.bands.mid?.value;
    if (Number.isFinite(midValue)) {
      this.analyzeBand('mid', midValue, 'Mid (500-2000Hz)', suggestions, consolidatedData);
    }

    // 🎯 High Mid (2000-5000Hz)
    const highMidValue = consolidatedData.metrics.bands.high_mid?.value;
    if (Number.isFinite(highMidValue)) {
      this.analyzeBand('high_mid', highMidValue, 'High Mid (2-5kHz)', suggestions, consolidatedData);
    }

    // 🎯 Presença (3000-6000Hz)
    const presenceValue = consolidatedData.metrics.bands.presence?.value;
    if (Number.isFinite(presenceValue)) {
      this.analyzeBand('presence', presenceValue, 'Presença (3-6kHz)', suggestions, consolidatedData);
    }

    // 🎯 Brilho/Air (6000-20000Hz)
    const brillianceValue = consolidatedData.metrics.bands.brilliance?.value;
    if (Number.isFinite(brillianceValue)) {
      this.analyzeBand('brilliance', brillianceValue, 'Brilho (6-20kHz)', suggestions, consolidatedData);
    }

    logAudio('problems_v2', 'spectral_analysis', { 
      bandsDetected: Object.keys(bands).length,
      suggestionsGenerated: suggestions.filter(s => s.metric?.startsWith('band_')).length 
    });
  }
  
  /**
   * 🎵 Análise Individual de Banda Espectral
   * ✅ REGRA ABSOLUTA: Usa EXCLUSIVAMENTE consolidatedData (metrics + genreTargets)
   * ❌ NUNCA usa audioMetrics, this.thresholds, customTargets, value passado por parâmetro, ou fallbacks
   */
  analyzeBand(bandKey, value, bandName, suggestions, consolidatedData) {
    // ✅ VALIDAÇÃO RIGOROSA: consolidatedData obrigatório
    if (!consolidatedData) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData ausente - IMPOSSÍVEL gerar sugestão`);
      return;
    }

    // ✅ REGRA ABSOLUTA: Ler valor APENAS de consolidatedData.metrics.bands
    const measured = consolidatedData.metrics?.bands?.[bandKey]?.value;
    if (!Number.isFinite(measured)) {
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ consolidatedData.metrics.bands.${bandKey}.value ausente ou inválido`);
      console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Valor encontrado:`, consolidatedData.metrics?.bands?.[bandKey]);
      return;
    }

    // ✅ REGRA ABSOLUTA: Obter target APENAS de consolidatedData.genreTargets.bands
    const targetInfo = this.getMetricTarget('bands', bandKey, consolidatedData);
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
      target_range_min: target_range?.min?.toFixed(2),
      target_range_max: target_range?.max?.toFixed(2),
      tolerance_db: tolerance.toFixed(2),
      source: 'consolidatedData'
    });
      target_db: target.toFixed(2),
      tolerance_db: tolerance.toFixed(2),
      unit: 'dB'
    });
    
    // 🎯 Calcular range de tolerância (min/max)
    const threshold = { target, tolerance, critical };
    const bounds = this.getRangeBounds(threshold);
    
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
    
    let message, explanation, action, status = 'ok';
    
    if (severity.level === 'critical' || severity.level === 'warning') {
      if (measured > bounds.max) {
        // 🎯 FASE 3: Calcular ajuste realista usando computeRecommendedGain()
        const excessDb = measured - bounds.max;
        const { value: rec, mode } = computeRecommendedGain(-excessDb, { maxStepDb: 5.0 }); // Bandas: 0.5-5 dB
        const absRec = Math.abs(rec);
        
        status = 'high';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} ${bandName} ${severity.level === 'critical' ? 'muito alto' : 'levemente alto'}: ${measured.toFixed(1)} dB (máximo: ${bounds.max.toFixed(1)} dB)`;
        
        explanation = `${severity.level === 'critical' ? 'Excesso' : 'Um pouco acima do máximo'} de ${excessDb.toFixed(1)} dB ${severity.level === 'critical' ? 'acima do máximo permitido' : 'acima de ' + bounds.max.toFixed(1) + ' dB'} ` +
          `(range: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB) para ${this.genre}. ${severity.level === 'critical' ? 'Pode causar "booming" e mascarar outras frequências.' : 'Ainda controlável.'}`;
        
        if (mode === 'staged') {
          action = `Ajuste em etapas: primeiro reduza ~${absRec.toFixed(1)} dB com EQ (Q médio), reavalie. ` +
            `Se ainda estiver acima, repita. Total a reduzir: ${excessDb.toFixed(1)} dB. ` +
            `Use bell filter ou shelf dependendo da região de frequência.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: reduza cerca de ${absRec.toFixed(1)} dB em ${bandName} com EQ sutil (Q baixo). Está próximo do ideal.`;
        } else {
          action = `Corte aproximadamente ${absRec.toFixed(1)} dB em ${bandName} com EQ. ` +
            `Use filtro bell (Q ~1.0-2.0) ou shelf dependendo da região. ${severity.level === 'critical' ? 'Priorize correção desta banda.' : ''}`;
        }
      } else if (measured < bounds.min) {
        // 🎯 FASE 3: Calcular ajuste realista
        const deficitDb = bounds.min - measured;
        const { value: rec, mode } = computeRecommendedGain(deficitDb, { maxStepDb: 5.0 });
        const absRec = Math.abs(rec);
        
        status = 'low';
        message = `${severity.level === 'critical' ? '🔴' : '🟠'} ${bandName} ${severity.level === 'critical' ? 'muito baixo' : 'levemente baixo'}: ${measured.toFixed(1)} dB (mínimo: ${bounds.min.toFixed(1)} dB)`;
        
        explanation = `${severity.level === 'critical' ? 'Falta' : 'Um pouco abaixo do mínimo'} ${deficitDb.toFixed(1)} dB ${severity.level === 'critical' ? 'para atingir o mínimo recomendado' : 'abaixo de ' + bounds.min.toFixed(1) + ' dB'} ` +
          `(range: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB) para ${this.genre}. ${severity.level === 'critical' ? 'Deixa o som sem fundação e corpo.' : 'Pode funcionar dependendo do estilo.'}`;
        
        if (mode === 'staged') {
          action = `Ajuste em etapas: primeiro aumente ~${absRec.toFixed(1)} dB com EQ (Q médio), reavalie. ` +
            `Se ainda estiver abaixo, repita. Total a aumentar: ${deficitDb.toFixed(1)} dB. ` +
            `Use bell filter ou shelf para elevar esta faixa de frequência.`;
        } else if (mode === 'micro') {
          action = `Ajuste fino opcional: aumente cerca de ${absRec.toFixed(1)} dB em ${bandName} com EQ sutil (Q baixo). Está próximo do ideal.`;
        } else {
          action = `Aumente aproximadamente ${absRec.toFixed(1)} dB em ${bandName} com EQ suave. ` +
            `Use filtro bell (Q ~1.0-2.0) ou shelf. ${severity.level === 'critical' ? 'Esta banda precisa de corpo e presença.' : 'Considere realce sutil.'}`;
        }
      }
    } else {
      message = `🟢 ${bandName} ideal: ${measured.toFixed(1)} dB`;
      explanation = `Perfeito para ${this.genre}! Esta faixa está equilibrada dentro do range ${bounds.min.toFixed(1)}-${bounds.max.toFixed(1)} dB. Balanço espectral profissional.`;
      action = `Excelente! Mantenha esse nível em ${bandName}. Nenhum ajuste necessário.`;
    }
    
    suggestions.push({
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
    });
  }
  
  /**
   * ⚖️ Calcular Severidade Baseada em Tolerância
   */
  calculateSeverity(diff, tolerance, critical) {
    if (diff <= tolerance) {
      return this.severity.OK;
    } else if (diff <= critical) {
      return this.severity.WARNING;
    } else {
      return this.severity.CRITICAL;
    }
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
      severity: suggestion.severity?.level || 'unknown',
      color: suggestion.severity?.colorHex || '#808080',
      colorCode: suggestion.severity?.color || 'gray',
      icon: suggestion.severity?.icon || '❓',
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
  process.stderr.write("  - finalJSON.data disponível?: " + !!finalJSON?.data + "\n");
  
  // 🔥 VALIDAÇÃO CRÍTICA: Exigir targets válidos
  const hasCustomTargets = customTargets && typeof customTargets === 'object' && Object.keys(customTargets).length > 0;
  const hasGenreTargets = finalJSON?.data?.genreTargets && typeof finalJSON.data.genreTargets === 'object';
  
  if (!hasCustomTargets && !hasGenreTargets) {
    process.stderr.write("[ENGINE] 🚨 ERRO CRÍTICO: Nenhum target disponível!\n");
    process.stderr.write("[ENGINE] ❌ customTargets: ausente ou vazio\n");
    process.stderr.write("[ENGINE] ❌ finalJSON.data.genreTargets: ausente\n");
    process.stderr.write("[ENGINE] ⚠️ Sistema NÃO PODE gerar sugestões sem targets\n");
    process.stderr.write("════════════════════════════════════════════════════════════════\n\n");
    throw new Error(`[SUGGESTION_ENGINE] Targets obrigatórios ausentes para gênero: ${genre}. Use loadGenreTargetsFromWorker(genre).`);
  }
  
  // Usar finalJSON.data.genreTargets se disponível, senão customTargets
  const effectiveTargets = hasGenreTargets ? finalJSON.data.genreTargets : customTargets;
  
  process.stderr.write("[ENGINE] 🎯 Targets usados: " + (hasGenreTargets ? 'finalJSON.data.genreTargets' : 'customTargets') + "\n");
  process.stderr.write("[ENGINE] 📊 Targets disponíveis: " + JSON.stringify(Object.keys(effectiveTargets)) + "\n");
  process.stderr.write("════════════════════════════════════════════════════════════════\n\n");
  
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre, effectiveTargets);
  
  // 🔥 CRÍTICO: Se finalJSON disponível, extrair metrics e targets consolidados
  if (finalJSON?.data) {
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