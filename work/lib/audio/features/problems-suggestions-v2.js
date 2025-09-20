// 🎯 PROBLEMS & SUGGESTIONS ANALYZER V2 - Sistema Educativo com Criticidade por Cores
// Implementação completa para análise inteligente de problemas e geração de sugestões educativas

import { logAudio } from '../error-handling.js';

/**
 * 🎨 Sistema de Criticidade com Cores
 */
const SEVERITY_SYSTEM = {
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
 */
const GENRE_THRESHOLDS = {
  // 🚗 Funk Automotivo - Mais agressivo
  'funk_automotivo': {
    lufs: { target: -6.2, tolerance: 2.0, critical: 3.0 },
    truePeak: { target: -1.0, tolerance: 0.5, critical: 1.0 },
    dr: { target: 6.8, tolerance: 2.0, critical: 3.0 },
    stereo: { target: 0.85, tolerance: 0.2, critical: 0.3 },
    sub: { target: -17.3, tolerance: 3.0, critical: 5.0 },
    bass: { target: -17.7, tolerance: 3.0, critical: 5.0 }
  },
  
  // 🎭 Funk Mandela - Mais dinâmico
  'funk_mandela': {
    lufs: { target: -8.0, tolerance: 2.5, critical: 4.0 },
    truePeak: { target: -0.8, tolerance: 0.7, critical: 1.2 },
    dr: { target: 7.3, tolerance: 2.5, critical: 4.0 },
    stereo: { target: 0.85, tolerance: 0.25, critical: 0.35 },
    sub: { target: -17.3, tolerance: 3.0, critical: 5.0 },
    bass: { target: -17.7, tolerance: 3.0, critical: 5.0 }
  },
  
  // 🎶 Trance - Muito dinâmico
  'trance': {
    lufs: { target: -11.5, tolerance: 2.5, critical: 4.0 },
    truePeak: { target: -1.0, tolerance: 1.0, critical: 2.0 },
    dr: { target: 8.8, tolerance: 3.0, critical: 5.0 },
    stereo: { target: 0.72, tolerance: 0.25, critical: 0.35 },
    sub: { target: -16.0, tolerance: 2.5, critical: 4.0 },
    bass: { target: -17.8, tolerance: 2.5, critical: 4.0 }
  },
  
  // 🎹 Eletrônico - Equilibrado
  'eletronico': {
    lufs: { target: -12.8, tolerance: 2.0, critical: 3.5 },
    truePeak: { target: -1.0, tolerance: 0.8, critical: 1.5 },
    dr: { target: 7.2, tolerance: 2.8, critical: 4.5 },
    stereo: { target: 0.75, tolerance: 0.25, critical: 0.35 },
    sub: { target: -18.0, tolerance: 3.0, critical: 5.0 },
    bass: { target: -19.0, tolerance: 3.0, critical: 5.0 }
  },
  
  // 🎤 Trap - Bass pesado
  'trap': {
    lufs: { target: -10.8, tolerance: 2.2, critical: 3.8 },
    truePeak: { target: -1.0, tolerance: 0.8, critical: 1.5 },
    dr: { target: 7.8, tolerance: 2.5, critical: 4.0 },
    stereo: { target: 0.78, tolerance: 0.22, critical: 0.32 },
    sub: { target: -15.5, tolerance: 2.8, critical: 4.5 },
    bass: { target: -16.8, tolerance: 2.8, critical: 4.5 }
  },
  
  // 📻 Default/Genérico
  'default': {
    lufs: { target: -14.0, tolerance: 3.0, critical: 5.0 },
    truePeak: { target: -1.0, tolerance: 1.0, critical: 2.0 },
    dr: { target: 8.0, tolerance: 3.0, critical: 5.0 },
    stereo: { target: 0.75, tolerance: 0.25, critical: 0.35 },
    sub: { target: -18.0, tolerance: 3.5, critical: 6.0 },
    bass: { target: -18.5, tolerance: 3.5, critical: 6.0 }
  }
};

/**
 * 🎓 Classe Principal - Problems & Suggestions Analyzer V2
 */
export class ProblemsAndSuggestionsAnalyzerV2 {
  constructor(genre = 'default') {
    this.genre = genre;
    this.thresholds = GENRE_THRESHOLDS[genre] || GENRE_THRESHOLDS['default'];
    this.severity = SEVERITY_SYSTEM;
    
    logAudio('problems_v2', 'init', { 
      genre: this.genre, 
      thresholds: Object.keys(this.thresholds).length 
    });
  }
  
  /**
   * 🔍 Análise Completa com Sugestões Educativas
   */
  analyzeWithEducationalSuggestions(audioMetrics) {
    try {
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
      
      const result = {
        genre: this.genre,
        suggestions: suggestions.map(s => this.formatSuggestionForJSON(s)),
        problems: problems.map(p => this.formatProblemForJSON(p)),
        summary,
        metadata: {
          totalSuggestions: suggestions.length,
          criticalCount: suggestions.filter(s => s.severity.level === 'critical').length,
          warningCount: suggestions.filter(s => s.severity.level === 'warning').length,
          okCount: suggestions.filter(s => s.severity.level === 'ok').length,
          analysisDate: new Date().toISOString(),
          genre: this.genre,
          version: '2.0.0'
        }
      };
      
      logAudio('problems_v2', 'analysis_complete', {
        totalSuggestions: suggestions.length,
        critical: result.metadata.criticalCount,
        warning: result.metadata.warningCount,
        ok: result.metadata.okCount
      });
      
      return result;
      
    } catch (error) {
      logAudio('problems_v2', 'analysis_error', { error: error.message });
      return this.getEmptyResult();
    }
  }
  
  /**
   * 🔊 Análise LUFS com Sugestões Educativas
   */
  analyzeLUFS(metrics, suggestions, problems) {
    const lufs = metrics.lufs?.integrated;
    if (!Number.isFinite(lufs)) return;
    
    const threshold = this.thresholds.lufs;
    const diff = Math.abs(lufs - threshold.target);
    const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (lufs > threshold.target) {
        message = `LUFS muito alto: ${lufs.toFixed(1)} dB (limite: ${threshold.target} dB)`;
        explanation = `Seu áudio está ${(lufs - threshold.target).toFixed(1)} dB acima do ideal para ${this.genre}. Isso pode causar distorção e fadiga auditiva.`;
        action = `Reduza o gain geral em ${Math.ceil(lufs - threshold.target)} dB usando um limiter ou reduzindo o volume master.`;
      } else {
        message = `LUFS muito baixo: ${lufs.toFixed(1)} dB (mínimo: ${threshold.target} dB)`;
        explanation = `Seu áudio está ${(threshold.target - lufs).toFixed(1)} dB abaixo do ideal. Ficará muito baixo comparado a outras músicas.`;
        action = `Aumente o loudness usando um limiter suave ou maximizer, elevando gradualmente até ${threshold.target} dB LUFS.`;
      }
    } else if (severity.level === 'warning') {
      if (lufs > threshold.target) {
        message = `LUFS levemente alto: ${lufs.toFixed(1)} dB`;
        explanation = `Está um pouco acima do ideal para ${this.genre}, mas ainda aceitável.`;
        action = `Considere reduzir 1-2 dB no limiter para ficar mais próximo de ${threshold.target} dB LUFS.`;
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
      targetValue: `${threshold.target} LUFS`,
      delta: `${(lufs - threshold.target).toFixed(1)} dB`,
      priority: severity.priority
    });
  }
  
  /**
   * 🎯 Análise True Peak com Sugestões Educativas
   */
  analyzeTruePeak(metrics, suggestions, problems) {
    const truePeak = metrics.truePeak?.peak;
    if (!Number.isFinite(truePeak)) return;
    
    const threshold = this.thresholds.truePeak;
    const diff = truePeak - threshold.target; // True peak sempre comparado "acima"
    const severity = this.calculateSeverityForTruePeak(diff, threshold.tolerance, threshold.critical);
    
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
      targetValue: `< ${threshold.target} dBTP`,
      delta: diff > 0 ? `+${diff.toFixed(1)} dB acima` : `${Math.abs(diff).toFixed(1)} dB seguro`,
      priority: severity.priority
    });
  }
  
  /**
   * 📈 Análise Dynamic Range com Sugestões Educativas
   */
  analyzeDynamicRange(metrics, suggestions, problems) {
    const dr = metrics.dynamics?.dynamicRange;
    if (!Number.isFinite(dr)) return;
    
    const threshold = this.thresholds.dr;
    const diff = Math.abs(dr - threshold.target);
    const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (dr < threshold.target - threshold.critical) {
        message = `🔴 Sobre-compressão crítica: ${dr.toFixed(1)} dB DR`;
        explanation = `Dynamic Range muito baixo indica compressão excessiva. O som fica "achatado" e sem vida.`;
        action = `Refaça o mastering com menos compressão. Aumente attack time dos compressors e reduza ratio para 3:1 ou menos.`;
      } else {
        message = `🔴 Falta de controle dinâmico: ${dr.toFixed(1)} dB DR`;
        explanation = `Dynamic Range muito alto pode indicar falta de processamento ou inconsistência de volume.`;
        action = `Aplique compressão suave (ratio 2:1, attack médio) para controlar melhor a dinâmica.`;
      }
    } else if (severity.level === 'warning') {
      if (dr < threshold.target) {
        message = `🟠 Levemente comprimido: ${dr.toFixed(1)} dB DR`;
        explanation = `Um pouco comprimido demais, mas ainda musical para ${this.genre}.`;
        action = `Considere reduzir ratio dos compressors para 2:1 ou aumentar threshold.`;
      } else {
        message = `🟠 Dinâmica ampla: ${dr.toFixed(1)} dB DR`;
        explanation = `Dinâmica mais ampla que o usual para ${this.genre}, mas pode funcionar.`;
        action = `Monitore o volume das partes mais baixas para garantir que não se percam.`;
      }
    } else {
      message = `🟢 Dynamic Range ideal: ${dr.toFixed(1)} dB DR`;
      explanation = `Perfeito equilíbrio entre controle dinâmico e musicalidade para ${this.genre}.`;
      action = `Excelente! Sua compressão está no ponto ideal.`;
    }
    
    suggestions.push({
      metric: 'dynamicRange',
      severity,
      message,
      explanation,
      action,
      currentValue: `${dr.toFixed(1)} dB DR`,
      targetValue: `${threshold.target} dB DR`,
      delta: `${(dr - threshold.target).toFixed(1)} dB`,
      priority: severity.priority
    });
  }
  
  /**
   * 🎧 Análise Stereo com Sugestões Educativas
   */
  analyzeStereoMetrics(metrics, suggestions, problems) {
    const correlation = metrics.stereo?.correlation;
    if (!Number.isFinite(correlation)) return;
    
    const threshold = this.thresholds.stereo;
    const diff = Math.abs(correlation - threshold.target);
    const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (correlation < threshold.target - threshold.critical) {
        message = `🔴 Estéreo muito estreito: ${correlation.toFixed(2)}`;
        explanation = `Sua música está quase mono. Falta largura estéreo e espacialidade.`;
        action = `Adicione reverb estéreo, duplicação de elementos ou use stereo widening. Experimente panning mais agressivo.`;
      } else {
        message = `🔴 Estéreo excessivamente largo: ${correlation.toFixed(2)}`;
        explanation = `Muito largo pode causar cancelamento de fase em reprodução mono (celulares, etc).`;
        action = `Verifique compatibilidade mono. Reduza stereo widening e centralize elementos importantes (baixo, vocal).`;
      }
    } else if (severity.level === 'warning') {
      if (correlation < threshold.target) {
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
      targetValue: threshold.target.toFixed(2),
      delta: `${(correlation - threshold.target).toFixed(2)}`,
      priority: severity.priority
    });
  }
  
  /**
   * 🌈 Análise Bandas Espectrais com Sugestões Educativas
   */
  analyzeSpectralBands(metrics, suggestions, problems) {
    const bands = metrics.centralizedBands || metrics.spectralBands;
    if (!bands || typeof bands !== 'object') return;
    
    // Sub Bass (20-60Hz)
    if (Number.isFinite(bands.sub)) {
      this.analyzeBand('sub', bands.sub, 'Sub Bass (20-60Hz)', suggestions);
    }
    
    // Bass (60-150Hz)  
    if (Number.isFinite(bands.bass)) {
      this.analyzeBand('bass', bands.bass, 'Bass (60-150Hz)', suggestions);
    }
  }
  
  /**
   * 🎵 Análise Individual de Banda Espectral
   */
  analyzeBand(bandKey, value, bandName, suggestions) {
    const threshold = this.thresholds[bandKey];
    if (!threshold) return;
    
    const diff = Math.abs(value - threshold.target);
    const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical);
    
    let message, explanation, action;
    
    if (severity.level === 'critical') {
      if (value > threshold.target + threshold.critical) {
        message = `🔴 ${bandName} muito alto: ${value.toFixed(1)} dB`;
        explanation = `Excesso nesta faixa pode causar "booming" e mascarar outras frequências.`;
        action = `Corte ${(value - threshold.target).toFixed(1)} dB em ${bandName} com EQ. Use filtro Q médio.`;
      } else {
        message = `🔴 ${bandName} muito baixo: ${value.toFixed(1)} dB`;
        explanation = `Falta de energia nesta faixa deixa o som sem fundação e corpo.`;
        action = `Aumente ${Math.abs(value - threshold.target).toFixed(1)} dB em ${bandName} com EQ suave.`;
      }
    } else if (severity.level === 'warning') {
      if (value > threshold.target) {
        message = `🟠 ${bandName} levemente alto: ${value.toFixed(1)} dB`;
        explanation = `Um pouco acima do ideal, mas ainda controlável.`;
        action = `Considere corte sutil de 1-2 dB em ${bandName}.`;
      } else {
        message = `🟠 ${bandName} levemente baixo: ${value.toFixed(1)} dB`;
        explanation = `Um pouco abaixo do ideal, mas pode funcionar.`;
        action = `Considere realce sutil de 1-2 dB em ${bandName}.`;
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
      delta: `${(value - threshold.target).toFixed(1)} dB`,
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
   * 📊 Gerar Resumo Final
   */
  generateSummary(suggestions, problems) {
    const critical = suggestions.filter(s => s.severity.level === 'critical').length;
    const warning = suggestions.filter(s => s.severity.level === 'warning').length;
    const ok = suggestions.filter(s => s.severity.level === 'ok').length;
    
    let overallRating;
    let readyForRelease;
    
    if (critical > 0) {
      overallRating = 'Precisa correção urgente';
      readyForRelease = false;
    } else if (warning > 2) {
      overallRating = 'Precisa melhorias';
      readyForRelease = false;
    } else if (warning > 0) {
      overallRating = 'Bom com ajustes';
      readyForRelease = true;
    } else {
      overallRating = 'Excelente qualidade';
      readyForRelease = true;
    }
    
    return {
      overallRating,
      readyForRelease,
      criticalIssues: critical,
      warningIssues: warning,
      okMetrics: ok,
      totalAnalyzed: suggestions.length,
      score: Math.max(0, 10 - (critical * 3) - (warning * 1))
    };
  }
  
  /**
   * 📝 Formatar Sugestão para JSON Final
   */
  formatSuggestionForJSON(suggestion) {
    return {
      metric: suggestion.metric,
      severity: suggestion.severity.level,
      color: suggestion.severity.colorHex,
      colorCode: suggestion.severity.color,
      icon: suggestion.severity.icon,
      message: suggestion.message,
      explanation: suggestion.explanation,
      action: suggestion.action,
      currentValue: suggestion.currentValue,
      targetValue: suggestion.targetValue,
      delta: suggestion.delta,
      priority: suggestion.priority,
      bandName: suggestion.bandName || null
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
 */
export function analyzeProblemsAndSuggestionsV2(audioMetrics, genre = 'default') {
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre);
  return analyzer.analyzeWithEducationalSuggestions(audioMetrics);
}

/**
 * 📋 Função de Compatibilidade com Sistema Antigo
 */
export function analyzeProblemsAndSuggestions(audioMetrics, genre = 'default') {
  return analyzeProblemsAndSuggestionsV2(audioMetrics, genre);
}

console.log('🎯 Problems & Suggestions Analyzer V2 carregado - Sistema educativo com criticidade por cores');