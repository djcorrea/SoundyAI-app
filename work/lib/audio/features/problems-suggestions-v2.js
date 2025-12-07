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
 * 🎵 Thresholds por Gênero Musical
 * Exportado para permitir fallback quando JSONs falharem
 */
export const GENRE_THRESHOLDS = {
  // 🚗 Funk Automotivo - Mais agressivo (≤14 LU aceitável)
  'funk_automotivo': {
    lufs: { target: -6.2, tolerance: 2.0, critical: 3.0 },
    truePeak: { target: -1.0, tolerance: 0.5, critical: 1.0 },
    dr: { target: 8.0, tolerance: 6.0, critical: 8.0 }, // ✅ CORRIGIDO: até 14 LU aceitável
    stereo: { target: 0.85, tolerance: 0.2, critical: 0.3 },
    // 🎵 Bandas espectrais completas
    sub: { target: -17.3, tolerance: 3.0, critical: 5.0 },
    bass: { target: -17.7, tolerance: 3.0, critical: 5.0 },
    lowMid: { target: -20.5, tolerance: 3.5, critical: 5.5 },
    mid: { target: -19.2, tolerance: 3.0, critical: 4.5 },
    highMid: { target: -22.8, tolerance: 4.0, critical: 6.0 },
    presenca: { target: -24.1, tolerance: 4.5, critical: 6.5 },
    brilho: { target: -26.3, tolerance: 5.0, critical: 7.0 }
  },
  
  // 🎭 Funk Mandela - Mais dinâmico (8 LU target, ≤15 LU aceitável)
  'funk_mandela': {
    lufs: { target: -8.0, tolerance: 2.5, critical: 4.0 },
    truePeak: { target: -0.8, tolerance: 0.7, critical: 1.2 },
    dr: { target: 8.0, tolerance: 7.0, critical: 7.0 }, // ✅ CORRIGIDO: 8 LU target, +7 LU tolerance
    stereo: { target: 0.85, tolerance: 0.25, critical: 0.35 },
    // 🎵 Bandas espectrais completas
    sub: { target: -17.3, tolerance: 3.0, critical: 5.0 },
    bass: { target: -17.7, tolerance: 3.0, critical: 5.0 },
    lowMid: { target: -21.0, tolerance: 3.5, critical: 5.5 },
    mid: { target: -19.8, tolerance: 3.2, critical: 4.8 },
    highMid: { target: -23.5, tolerance: 4.0, critical: 6.0 },
    presenca: { target: -25.2, tolerance: 4.5, critical: 6.5 },
    brilho: { target: -27.1, tolerance: 5.0, critical: 7.0 }
  },
  
  // 🎶 Trance - Muito dinâmico (≤10 LU aceitável)
  'trance': {
    lufs: { target: -11.5, tolerance: 2.5, critical: 4.0 },
    truePeak: { target: -1.0, tolerance: 1.0, critical: 2.0 },
    dr: { target: 7.0, tolerance: 3.0, critical: 3.0 }, // ✅ CORRIGIDO: até 10 LU aceitável
    stereo: { target: 0.72, tolerance: 0.25, critical: 0.35 },
    // 🎵 Bandas espectrais completas
    sub: { target: -16.0, tolerance: 2.5, critical: 4.0 },
    bass: { target: -17.8, tolerance: 2.5, critical: 4.0 },
    lowMid: { target: -22.5, tolerance: 3.0, critical: 4.5 },
    mid: { target: -20.1, tolerance: 2.8, critical: 4.2 },
    highMid: { target: -21.5, tolerance: 3.5, critical: 5.0 },
    presenca: { target: -23.8, tolerance: 4.0, critical: 5.5 },
    brilho: { target: -24.2, tolerance: 4.5, critical: 6.0 }
  },
  
  // 🎹 Eletrônico - Equilibrado (6 LU target, ≤9 LU aceitável)
  'eletronico': {
    lufs: { target: -12.8, tolerance: 2.0, critical: 3.5 },
    truePeak: { target: -1.0, tolerance: 0.8, critical: 1.5 },
    dr: { target: 6.0, tolerance: 3.0, critical: 3.0 }, // ✅ CORRIGIDO: 6 LU target, +3 LU tolerance
    stereo: { target: 0.75, tolerance: 0.25, critical: 0.35 },
    // 🎵 Bandas espectrais completas
    sub: { target: -18.0, tolerance: 3.0, critical: 5.0 },
    bass: { target: -19.0, tolerance: 3.0, critical: 5.0 },
    lowMid: { target: -23.2, tolerance: 3.5, critical: 5.5 },
    mid: { target: -21.5, tolerance: 3.0, critical: 4.5 },
    highMid: { target: -24.8, tolerance: 4.0, critical: 6.0 },
    presenca: { target: -26.5, tolerance: 4.5, critical: 6.5 },
    brilho: { target: -25.8, tolerance: 4.8, critical: 6.8 }
  },
  
  // 🎤 Trap - Bass pesado
  'trap': {
    lufs: { target: -10.8, tolerance: 2.2, critical: 3.8 },
    truePeak: { target: -1.0, tolerance: 0.8, critical: 1.5 },
    dr: { target: 7.8, tolerance: 2.5, critical: 4.0 },
    stereo: { target: 0.78, tolerance: 0.22, critical: 0.32 },
    // 🎵 Bandas espectrais completas
    sub: { target: -15.5, tolerance: 2.8, critical: 4.5 },
    bass: { target: -16.8, tolerance: 2.8, critical: 4.5 },
    lowMid: { target: -22.1, tolerance: 3.5, critical: 5.2 },
    mid: { target: -20.9, tolerance: 3.2, critical: 4.8 },
    highMid: { target: -24.3, tolerance: 4.2, critical: 6.2 },
    presenca: { target: -25.8, tolerance: 4.8, critical: 6.8 },
    brilho: { target: -27.5, tolerance: 5.2, critical: 7.5 }
  },
  
  // 📻 Default/Genérico
  'default': {
    lufs: { target: -14.0, tolerance: 3.0, critical: 5.0 },
    truePeak: { target: -1.0, tolerance: 1.0, critical: 2.0 },
    dr: { target: 8.0, tolerance: 3.0, critical: 5.0 },
    stereo: { target: 0.75, tolerance: 0.25, critical: 0.35 },
    // 🎵 Bandas espectrais completas - valores genéricos balanceados
    sub: { target: -18.0, tolerance: 3.5, critical: 6.0 },
    bass: { target: -18.5, tolerance: 3.5, critical: 6.0 },
    lowMid: { target: -23.0, tolerance: 4.0, critical: 6.5 },
    mid: { target: -21.5, tolerance: 3.5, critical: 5.5 },
    highMid: { target: -25.0, tolerance: 4.5, critical: 6.5 },
    presenca: { target: -27.0, tolerance: 5.0, critical: 7.0 },
    brilho: { target: -28.0, tolerance: 5.0, critical: 7.0 }
  }
};

/**
 * 🎓 Classe Principal - Problems & Suggestions Analyzer V2
 */
export class ProblemsAndSuggestionsAnalyzerV2 {
  /**
   * 🎯 PATCH: Função auxiliar para obter limites min/max de um threshold
   * Prioriza target_range quando disponível, fallback para target±tolerance
   * @param {Object} threshold - Objeto com target/tolerance ou target_range
   * @returns {Object} { min, max }
   */
  getRangeBounds(threshold) {
    // PATCH: Se tiver target_range válido, usar diretamente
    if (threshold.target_range && 
        typeof threshold.target_range.min === 'number' && 
        typeof threshold.target_range.max === 'number') {
      return {
        min: threshold.target_range.min,
        max: threshold.target_range.max
      };
    }
    
    // PATCH: Fallback para target±tolerance (comportamento original)
    return {
      min: threshold.target - threshold.tolerance,
      max: threshold.target + threshold.tolerance
    };
  }

  constructor(genre = 'default', customTargets = null) {
    console.log('[ANALYZER-CONSTRUCTOR] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[ANALYZER-CONSTRUCTOR] ENTRADA DO CONSTRUTOR:');
    console.log('[ANALYZER-CONSTRUCTOR] genre:', genre);
    console.log('[ANALYZER-CONSTRUCTOR] customTargets:', customTargets ? 'presente' : 'NULL');
    if (customTargets) {
      console.log('[ANALYZER-CONSTRUCTOR] customTargets keys:', Object.keys(customTargets));
      console.log('[ANALYZER-CONSTRUCTOR] customTargets.lufs:', customTargets.lufs);
      console.log('[ANALYZER-CONSTRUCTOR] customTargets.dr:', customTargets.dr);
    }
    console.log('[ANALYZER-CONSTRUCTOR] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🛡️ BLINDAGEM SECUNDÁRIA: Validar e proteger genre
    if (!genre || typeof genre !== 'string' || !genre.trim()) {
      console.error('[ANALYZER-ERROR] Genre inválido recebido:', genre);
      genre = 'default';
    }
    
    this.genre = genre.trim();
    
    // 🔥 PATCH CRÍTICO BUG #2: Salvar o gênero original ANTES de qualquer transformação
    this._originalGenre = genre.trim();
    
    // 🎯 PRIORIDADE: customTargets (do filesystem) > GENRE_THRESHOLDS (hardcoded)
    if (customTargets && typeof customTargets === 'object' && Object.keys(customTargets).length > 0) {
      console.log(`[PROBLEMS_V2] ✅ Usando customTargets para ${genre}`);
      console.log('[PROBLEMS_V2] customTargets.lufs:', customTargets.lufs);
      console.log('[PROBLEMS_V2] customTargets.dr:', customTargets.dr);
      this.thresholds = customTargets;
      this.targetsSource = 'filesystem';
    } else {
      console.log(`[PROBLEMS_V2] 📋 Usando GENRE_THRESHOLDS hardcoded para ${genre}`);
      this.thresholds = GENRE_THRESHOLDS[genre] || GENRE_THRESHOLDS['default'];
      this.targetsSource = 'hardcoded';
    }
    
    this.severity = SEVERITY_SYSTEM;
    
    logAudio('problems_v2', 'init', { 
      genre: this.genre, 
      thresholds: Object.keys(this.thresholds).length,
      source: this.targetsSource
    });
  }
  
  /**
   * 🔍 Análise Completa com Sugestões Educativas
   */
  analyzeWithEducationalSuggestions(audioMetrics) {
    try {
      console.log('[AUDIT-PROBLEMS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[AUDIT-PROBLEMS] DENTRO DO ANALYZER:');
      console.log('[AUDIT-PROBLEMS] this._originalGenre:', this._originalGenre);
      console.log('[AUDIT-PROBLEMS] this.genre:', this.genre);
      console.log('[AUDIT-PROBLEMS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      logAudio('problems_v2', 'analysis_start', { genre: this.genre });
      
      const suggestions = [];
      const problems = [];
      
      // 🔊 ANÁLISE LUFS
      this.analyzeLUFS(audioMetrics, suggestions, problems);
      
      // 🎯 ANÁLISE TRUE PEAK  
      this.analyzeTruePeak(audioMetrics, suggestions, problems);
      
      // 📈 ANÁLISE DYNAMIC RANGE
      this.analyzeDynamicRange(audioMetrics, suggestions, problems);
      
      // 🎧 ANÁLISE STEREO
      this.analyzeStereoMetrics(audioMetrics, suggestions, problems);
      
      // 🌈 ANÁLISE BANDAS ESPECTRAIS
      this.analyzeSpectralBands(audioMetrics, suggestions, problems);
      
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
          version: '2.0.0'
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
        hasCriticalTruePeak
      });
      
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
   */
  analyzeLUFS(metrics, suggestions, problems) {
    const lufs = metrics.lufs?.lufs_integrated;
    if (!Number.isFinite(lufs)) return;
    
    // 🛡️ SAFEGUARD: Validar threshold antes de acessar .target
    const lufsThreshold = this.thresholds?.lufs;
    
    if (
      !lufsThreshold ||
      typeof lufsThreshold.target !== 'number' ||
      typeof lufsThreshold.tolerance !== 'number'
    ) {
      console.warn('[PROBLEMS_V2][SAFEGUARD] Missing or invalid lufs thresholds for genre:', this.genre, {
        thresholdsKeys: this.thresholds ? Object.keys(this.thresholds) : null,
        lufsThreshold: lufsThreshold
      });
      return; // não quebra, só pula a análise de LUFS
    }
    
    // PATCH: Usar getRangeBounds para suportar target_range
    const bounds = this.getRangeBounds(lufsThreshold);
    let diff;
    if (lufs < bounds.min) {
      diff = lufs - bounds.min; // Negativo (precisa subir)
    } else if (lufs > bounds.max) {
      diff = lufs - bounds.max; // Positivo (precisa descer)
    } else {
      diff = 0; // Dentro do range
    }
    
    const severity = this.calculateSeverity(Math.abs(diff), lufsThreshold.tolerance, lufsThreshold.critical || lufsThreshold.tolerance * 1.5);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (lufs > lufsThreshold.target) {
        message = `LUFS muito alto: ${lufs.toFixed(1)} dB (limite: ${lufsThreshold.target} dB)`;
        explanation = `Seu áudio está ${(lufs - lufsThreshold.target).toFixed(1)} dB acima do ideal para ${this.genre}. Isso pode causar distorção e fadiga auditiva.`;
        action = `Reduza o gain geral em ${Math.ceil(lufs - lufsThreshold.target)} dB usando um limiter ou reduzindo o volume master.`;
      } else {
        message = `LUFS muito baixo: ${lufs.toFixed(1)} dB (mínimo: ${lufsThreshold.target} dB)`;
        explanation = `Seu áudio está ${(lufsThreshold.target - lufs).toFixed(1)} dB abaixo do ideal. Ficará muito baixo comparado a outras músicas.`;
        action = `Aumente o loudness usando um limiter suave ou maximizer, elevando gradualmente até ${lufsThreshold.target} dB LUFS.`;
      }
    } else if (severity.level === 'warning') {
      if (lufs > lufsThreshold.target) {
        message = `LUFS levemente alto: ${lufs.toFixed(1)} dB`;
        explanation = `Está um pouco acima do ideal para ${this.genre}, mas ainda aceitável.`;
        action = `Considere reduzir 1-2 dB no limiter para ficar mais próximo de ${lufsThreshold.target} dB LUFS.`;
      } else {
        message = `LUFS levemente baixo: ${lufs.toFixed(1)} dB`;
        explanation = `Está um pouco abaixo do ideal, mas pode funcionar dependendo da plataforma.`;
        action = `Considere aumentar 1-2 dB no limiter para mais presença sonora.`;
      }
    } else {
      message = `LUFS ideal: ${lufs.toFixed(1)} dB`;
      explanation = `Perfeito para ${this.genre}! Seu loudness está na faixa ideal para streaming e rádio.`;
      action = `Mantenha esse nível de LUFS. Está excelente!`;
    }
    
    suggestions.push({
      metric: 'lufs',
      severity,
      message,
      explanation,
      action,
      currentValue: `${lufs.toFixed(1)} LUFS`,
      targetValue: `${lufsThreshold.target} LUFS`,
      delta: `${(lufs - lufsThreshold.target).toFixed(1)} dB`,
      priority: severity.priority
    });
  }
  
  /**
   * 🎯 Análise True Peak com Sugestões Educativas
   */
  analyzeTruePeak(metrics, suggestions, problems) {
    const truePeak = metrics.truePeak?.maxDbtp;
    if (!Number.isFinite(truePeak)) return;
    
    // 🛡️ SAFEGUARD: Validar threshold antes de acessar .target
    const tpThreshold = this.thresholds?.truePeak;
    
    if (
      !tpThreshold ||
      typeof tpThreshold.target !== 'number' ||
      typeof tpThreshold.tolerance !== 'number'
    ) {
      console.warn('[PROBLEMS_V2][SAFEGUARD] Missing or invalid truePeak thresholds for genre:', this.genre, {
        thresholdsKeys: this.thresholds ? Object.keys(this.thresholds) : null
      });
      return;
    }
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const bounds = this.getRangeBounds(tpThreshold);
    let diff;
    if (truePeak < bounds.min) {
      diff = truePeak - bounds.min; // Negativo (muito baixo, improvável)
    } else if (truePeak > bounds.max) {
      diff = truePeak - bounds.max; // Positivo (acima do limite - CRÍTICO)
    } else {
      diff = 0; // Dentro do range seguro
    }
    
    const severity = this.calculateSeverity(Math.abs(diff), tpThreshold.tolerance, tpThreshold.critical || tpThreshold.tolerance * 1.5);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      message = `🔴 True Peak crítico: ${truePeak.toFixed(1)} dBTP`;
      explanation = `ATENÇÃO! Valores acima de -1 dBTP causam clipping digital e distorção audível. Isso quebra padrões técnicos.`;
      action = `URGENTE: Reduza o gain em ${Math.ceil(truePeak + 1)} dB no limiter ou use oversampling 4x para evitar clipping.`;
    } else if (severity.level === 'warning') {
      message = `🟠 True Peak alto: ${truePeak.toFixed(1)} dBTP`;
      explanation = `Próximo do limite de clipping. Alguns sistemas podem apresentar distorção leve.`;
      action = `Reduza 1-2 dB no limiter para maior segurança. Use oversampling se disponível.`;
    } else {
      message = `🟢 True Peak seguro: ${truePeak.toFixed(1)} dBTP`;
      explanation = `Excelente! Sem risco de clipping digital. Ideal para streaming e distribuição.`;
      action = `Perfeito! Mantenha esse nível de true peak.`;
    }
    
    suggestions.push({
      metric: 'truePeak',
      severity,
      message,
      explanation,
      action,
      currentValue: `${truePeak.toFixed(1)} dBTP`,
      targetValue: `< ${tpThreshold.target} dBTP`,
      delta: diff > 0 ? `+${diff.toFixed(1)} dB acima` : `${Math.abs(diff).toFixed(1)} dB seguro`,
      priority: severity.priority
    });
  }
  
  /**
   * 📈 Análise Dynamic Range com Sugestões Educativas - SISTEMA 3 NÍVEIS POR GÊNERO
   */
  analyzeDynamicRange(metrics, suggestions, problems) {
    const dr = metrics.dynamics?.dynamicRange;
    if (!Number.isFinite(dr)) return;
    
    const threshold = this.thresholds.dr;
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const bounds = this.getRangeBounds(threshold);
    let diff;
    if (dr < bounds.min) {
      diff = dr - bounds.min; // Negativo (precisa aumentar)
    } else if (dr > bounds.max) {
      diff = dr - bounds.max; // Positivo (precisa reduzir)
    } else {
      diff = 0; // Dentro do range
    }
    
    const severity = this.calculateSeverity(Math.abs(diff), threshold.tolerance, threshold.critical || threshold.tolerance * 1.5);
    
    let message, explanation, action;
    
    if (severity.level === 'corrigir') {
      if (dr < threshold.target - threshold.tolerance) {
        message = `🔴 Sobre-compressão para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        explanation = `Dynamic Range muito baixo para ${this.genre}. Target: ${threshold.target} LU, aceitável até ${threshold.target + threshold.tolerance} LU.`;
        action = `Refaça o mastering com menos compressão. Para ${this.genre}, procure manter pelo menos ${threshold.target} LU de dinâmica.`;
      } else {
        message = `🔴 Range dinâmico excessivo para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        explanation = `Dynamic Range muito alto para ${this.genre}. Pode prejudicar a competitividade sonora.`;
        action = `Aplique compressão suave para controlar a dinâmica dentro de ${threshold.target}±${threshold.tolerance} LU.`;
      }
    } else if (severity.level === 'ajuste_leve') {
      if (dr < threshold.target) {
        message = `� Levemente comprimido para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        explanation = `Um pouco abaixo do ideal para ${this.genre}, mas ainda aceitável (target: ${threshold.target} LU).`;
        action = `Considere reduzir ratio dos compressors para aumentar a dinâmica em 1-2 LU.`;
      } else {
        message = `� Dinâmica levemente ampla para ${this.genre}: ${dr.toFixed(1)} dB DR`;
        explanation = `Um pouco acima do ideal para ${this.genre}, mas dentro do aceitável.`;
        action = `Monitore as partes mais baixas para garantir consistência no gênero ${this.genre}.`;
      }
    } else {
      message = `🟢 Dynamic Range ideal para ${this.genre}: ${dr.toFixed(1)} dB DR`;
      explanation = `Perfeito para ${this.genre}! Dinâmica balanceada dentro do range ideal (${threshold.target}±${Math.round(threshold.tolerance * 0.3)} LU).`;
      action = `Excelente! Sua compressão está perfeita para ${this.genre}.`;
    }
    
    suggestions.push({
      metric: 'dynamicRange',
      severity,
      message,
      explanation,
      action,
      currentValue: `${dr.toFixed(1)} dB DR`,
      targetValue: `${threshold.target} dB DR (±${threshold.tolerance} LU aceitável)`,
      delta: `${(dr - threshold.target).toFixed(1)} dB`,
      priority: severity.priority,
      genre: this.genre // 🎯 ADICIONAR CONTEXTO DE GÊNERO
    });
  }
  
  /**
   * 🎧 Análise Stereo com Sugestões Educativas
   */
  analyzeStereoMetrics(metrics, suggestions, problems) {
    const correlation = metrics.stereo?.correlation;
    if (!Number.isFinite(correlation)) return;
    
    // 🛡️ SAFEGUARD: Validar threshold antes de acessar .target
    const stereoThreshold = this.thresholds?.stereo;
    
    if (
      !stereoThreshold ||
      typeof stereoThreshold.target !== 'number' ||
      typeof stereoThreshold.tolerance !== 'number'
    ) {
      console.warn('[PROBLEMS_V2][SAFEGUARD] Missing or invalid stereo thresholds for genre:', this.genre);
      return;
    }
    
    // PATCH: Usar getRangeBounds para consistência com LUFS e bandas
    const bounds = this.getRangeBounds(stereoThreshold);
    let rawDiff;
    if (correlation < bounds.min) {
      rawDiff = correlation - bounds.min; // Negativo (muito estreito)
    } else if (correlation > bounds.max) {
      rawDiff = correlation - bounds.max; // Positivo (muito largo)
    } else {
      rawDiff = 0; // Dentro do range ideal
    }
    
    const diff = Math.abs(rawDiff);
    const severity = this.calculateSeverity(diff, stereoThreshold.tolerance, stereoThreshold.critical || stereoThreshold.tolerance * 1.5);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (correlation < stereoThreshold.target - stereoThreshold.critical) {
        message = `🔴 Estéreo muito estreito: ${correlation.toFixed(2)}`;
        explanation = `Sua música está quase mono. Falta largura estéreo e espacialidade.`;
        action = `Adicione reverb estéreo, duplicação de elementos ou use stereo widening. Experimente panning mais agressivo.`;
      } else {
        message = `🔴 Estéreo excessivamente largo: ${correlation.toFixed(2)}`;
        explanation = `Muito largo pode causar cancelamento de fase em reprodução mono (celulares, etc).`;
        action = `Verifique compatibilidade mono. Reduza stereo widening e centralize elementos importantes (baixo, vocal).`;
      }
    } else if (severity.level === 'warning') {
      if (correlation < stereoThreshold.target) {
        message = `🟠 Estéreo estreito: ${correlation.toFixed(2)}`;
        explanation = `Um pouco estreito para ${this.genre}, mas ainda funcional.`;
        action = `Experimente abrir mais com reverb sutil ou doubling de instrumentos.`;
      } else {
        message = `🟠 Estéreo amplo: ${correlation.toFixed(2)}`;
        explanation = `Mais largo que o usual, mas pode funcionar dependendo do estilo.`;
        action = `Teste em mono para garantir que não há cancelamentos indesejados.`;
      }
    } else {
      message = `🟢 Estéreo ideal: ${correlation.toFixed(2)}`;
      explanation = `Perfeita largura estéreo para ${this.genre}. Boa espacialidade sem exageros.`;
      action = `Excelente! Sua imagem estéreo está no ponto ideal.`;
    }
    
    suggestions.push({
      metric: 'stereoCorrelation',
      severity,
      message,
      explanation,
      action,
      currentValue: correlation.toFixed(2),
      targetValue: stereoThreshold.target.toFixed(2),
      delta: diff.toFixed(2),
      priority: severity.priority
    });
  }
  
  /**
   * 🌈 Análise Bandas Espectrais com Sugestões Educativas
   */
  analyzeSpectralBands(metrics, suggestions, problems) {
    // ✅ CORREÇÃO CRÍTICA: spectralBands retorna { bands: {...}, totalPercentage, valid }
    // Não é um objeto plano, mas sim um wrapper com .bands aninhado
    const spectralData = metrics.centralizedBands || metrics.spectralBands || metrics.spectral_balance;
    if (!spectralData || typeof spectralData !== 'object') return;
    
    // ✅ EXTRAIR O OBJETO BANDS CORRETO
    const bands = spectralData.bands || spectralData;
    if (!bands || typeof bands !== 'object') return;
    
    // 🎯 EXPANSÃO COMPLETA: Todas as bandas espectrais com múltiplas variações de nomes
    
    // Sub Bass (20-60Hz)
    let value = bands.sub_energy_db ?? bands.sub?.energy_db ?? bands.sub;
    if (Number.isFinite(value)) {
      this.analyzeBand('sub', value, 'Sub Bass (20-60Hz)', suggestions);
    }
    
    // Bass (60-150Hz)  
    value = bands.bass_energy_db ?? bands.bass?.energy_db ?? bands.bass;
    if (Number.isFinite(value)) {
      this.analyzeBand('bass', value, 'Bass (60-150Hz)', suggestions);
    }

    // 🆕 Low Mid (150-500Hz) - Fundamental e warmth
    value = bands.lowMid_energy_db ?? bands.lowMid?.energy_db ?? bands.lowMid ?? bands.low_mid;
    if (Number.isFinite(value)) {
      this.analyzeBand('lowMid', value, 'Low Mid (150-500Hz)', suggestions);
    }

    // 🆕 Mid (500-2000Hz) - Vocal clarity e presença
    value = bands.mid_energy_db ?? bands.mid?.energy_db ?? bands.mid;
    if (Number.isFinite(value)) {
      this.analyzeBand('mid', value, 'Mid (500-2000Hz)', suggestions);
    }

    // 🆕 High Mid (2000-5000Hz) - Definition e clarity  
    value = bands.highMid_energy_db ?? bands.highMid?.energy_db ?? bands.highMid ?? bands.high_mid;
    if (Number.isFinite(value)) {
      this.analyzeBand('highMid', value, 'High Mid (2-5kHz)', suggestions);
    }

    // 🆕 Presença (3000-6000Hz) - Vocal presence e intelligibility
    value = bands.presenca_energy_db ?? bands.presenca?.energy_db ?? bands.presenca ?? bands.presence;
    if (Number.isFinite(value)) {
      this.analyzeBand('presenca', value, 'Presença (3-6kHz)', suggestions);
    }

    // 🆕 Brilho/Air (6000-20000Hz) - Sparkle e airiness
    value = bands.brilho_energy_db ?? bands.brilho?.energy_db ?? bands.brilho ?? bands.air;
    if (Number.isFinite(value)) {
      this.analyzeBand('brilho', value, 'Brilho (6-20kHz)', suggestions);
    }

    logAudio('problems_v2', 'spectral_analysis', { 
      bandsDetected: Object.keys(bands).length,
      suggestionsGenerated: suggestions.filter(s => s.metric?.startsWith('band_')).length 
    });
  }
  
  /**
   * 🎵 Análise Individual de Banda Espectral
   */
  analyzeBand(bandKey, value, bandName, suggestions) {
    // 🛡️ SAFEGUARD: Validar threshold antes de acessar .target
    const threshold = this.thresholds?.[bandKey];
    
    if (
      !threshold ||
      typeof threshold.target !== 'number' ||
      typeof threshold.tolerance !== 'number'
    ) {
      // Não logar warning para cada banda (evitar spam), apenas pular
      return;
    }
    
    // PATCH: Calcular diferença até borda mais próxima do range
    const bounds = this.getRangeBounds(threshold);
    let rawDelta;
    if (value < bounds.min) {
      rawDelta = value - bounds.min; // Negativo (precisa aumentar)
    } else if (value > bounds.max) {
      rawDelta = value - bounds.max; // Positivo (precisa reduzir)
    } else {
      rawDelta = 0; // Dentro do range
    }
    
    const diff = Math.abs(rawDelta);
    const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical || threshold.tolerance * 1.5);
    
    let message, explanation, action;
    
    // 🎯 REGRA ABSOLUTAMENTE RÍGIDA: Máximo ±6 dB por ajuste
    const MAX_ADJUSTMENT_DB = 6.0;
    let actionableGain = rawDelta;
    let isProgressiveAdjustment = false;
    
    if (Math.abs(rawDelta) > MAX_ADJUSTMENT_DB) {
      // Delta maior que 6 dB: sugerir ajuste progressivo
      actionableGain = Math.sign(rawDelta) * Math.min(MAX_ADJUSTMENT_DB, Math.abs(rawDelta));
      isProgressiveAdjustment = true;
    }
    
    if (severity.level === 'critical') {
      if (value > threshold.target + threshold.critical) {
        message = `🔴 ${bandName} muito alto: ${value.toFixed(1)} dB`;
        explanation = `Excesso nesta faixa pode causar "booming" e mascarar outras frequências.`;
        
        if (isProgressiveAdjustment) {
          action = `Ajuste progressivo: reduza entre 2 a 4 dB inicialmente e reavalie. Delta total: ${Math.abs(rawDelta).toFixed(1)} dB.`;
        } else {
          action = `Corte ${Math.abs(actionableGain).toFixed(1)} dB em ${bandName} com EQ. Use filtro Q médio.`;
        }
      } else {
        message = `🔴 ${bandName} muito baixo: ${value.toFixed(1)} dB`;
        explanation = `Falta de energia nesta faixa deixa o som sem fundação e corpo.`;
        
        if (isProgressiveAdjustment) {
          action = `Ajuste progressivo: aumente entre 2 a 4 dB inicialmente e reavalie. Delta total: ${Math.abs(rawDelta).toFixed(1)} dB.`;
        } else {
          action = `Aumente ${Math.abs(actionableGain).toFixed(1)} dB em ${bandName} com EQ suave.`;
        }
      }
    } else if (severity.level === 'warning') {
      if (value > threshold.target) {
        message = `🟠 ${bandName} levemente alto: ${value.toFixed(1)} dB`;
        explanation = `Um pouco acima do ideal, mas ainda controlável.`;
        
        if (isProgressiveAdjustment) {
          action = `Ajuste progressivo: considere redução de 2-3 dB e reavalie.`;
        } else {
          action = `Considere corte sutil de 1-2 dB em ${bandName}.`;
        }
      } else {
        message = `🟠 ${bandName} levemente baixo: ${value.toFixed(1)} dB`;
        explanation = `Um pouco abaixo do ideal, mas pode funcionar.`;
        
        if (isProgressiveAdjustment) {
          action = `Ajuste progressivo: considere aumento de 2-3 dB e reavalie.`;
        } else {
          action = `Considere realce sutil de 1-2 dB em ${bandName}.`;
        }
      }
    } else {
      message = `🟢 ${bandName} ideal: ${value.toFixed(1)} dB`;
      explanation = `Perfeito para ${this.genre}! Esta faixa está equilibrada.`;
      action = `Excelente! Mantenha esse nível em ${bandName}.`;
    }
    
    suggestions.push({
      metric: `band_${bandKey}`,
      severity,
      message,
      explanation,
      action,
      currentValue: `${value.toFixed(1)} dB`,
      targetValue: `${threshold.target} dB`,
      delta: `${rawDelta.toFixed(1)} dB`,
      actionableGain: `${actionableGain > 0 ? '+' : ''}${actionableGain.toFixed(1)} dB`,
      isProgressiveAdjustment,
      maxSingleAdjustment: `±${MAX_ADJUSTMENT_DB} dB`,
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
 * 🎯 Função Principal para Exportação
 * 
 * @param {Object} audioMetrics - Métricas de áudio calculadas
 * @param {string} genre - Nome do gênero
 * @param {Object|null} customTargets - Targets carregados do filesystem (opcional)
 * @returns {Object} - Análise completa com sugestões
 */
export function analyzeProblemsAndSuggestionsV2(audioMetrics, genre = 'default', customTargets = null) {
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre, customTargets);
  return analyzer.analyzeWithEducationalSuggestions(audioMetrics);
}

/**
 * 📋 Função de Compatibilidade com Sistema Antigo
 */
export function analyzeProblemsAndSuggestions(audioMetrics, genre = 'default') {
  return analyzeProblemsAndSuggestionsV2(audioMetrics, genre);
}

console.log('🎯 Problems & Suggestions Analyzer V2 carregado - Sistema educativo com criticidade por cores');