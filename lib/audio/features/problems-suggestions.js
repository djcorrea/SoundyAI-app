// 🔍 PROBLEMS & SUGGESTIONS ANALYZER - Sistema de Detecção de Problemas e Sugestões Automáticas
// Implementação para análise inteligente de problemas de áudio e geração de sugestões

import { logAudio } from '../error-handling.js';

/**
 * 🎯 Configurações para detecção de problemas
 */
const PROBLEMS_CONFIG = {
  // Thresholds para detecção de problemas
  LUFS_THRESHOLDS: {
    TOO_QUIET: -30,      // Muito baixo
    QUIET: -23,          // Baixo (padrão streaming)
    OPTIMAL_MIN: -16,    // Ideal mínimo
    OPTIMAL_MAX: -12,    // Ideal máximo  
    LOUD: -8,            // Alto
    TOO_LOUD: -6         // Muito alto
  },
  
  TRUE_PEAK_THRESHOLDS: {
    SAFE: -3,            // Seguro para streaming
    WARNING: -1,         // Aviso de possível clipping
    CRITICAL: 0          // Clipping detectado
  },
  
  DYNAMIC_RANGE_THRESHOLDS: {
    OVER_COMPRESSED: 3,  // Muito comprimido
    COMPRESSED: 6,       // Comprimido
    OPTIMAL_MIN: 8,      // Ideal mínimo
    OPTIMAL_MAX: 20,     // Ideal máximo
    UNDER_COMPRESSED: 25 // Pouco comprimido
  },
  
  STEREO_THRESHOLDS: {
    MONO_LIKE: 0.1,      // Parece mono
    NARROW: 0.3,         // Estreito
    OPTIMAL_MIN: 0.5,    // Ideal mínimo
    OPTIMAL_MAX: 0.9,    // Ideal máximo
    TOO_WIDE: 0.95       // Muito largo
  },
  
  DC_OFFSET_THRESHOLDS: {
    ACCEPTABLE: 0.01,    // 1% aceitável
    NOTICEABLE: 0.05,    // 5% perceptível
    PROBLEMATIC: 0.1     // 10% problemático
  },
  
  SPECTRAL_THRESHOLDS: {
    UNIFORMITY_POOR: 0.4, // Uniformidade ruim
    BRIGHTNESS_LOW: 0.2,  // Pouco brilho
    BRIGHTNESS_HIGH: 0.8  // Muito brilho
  }
};

/**
 * 📊 Severidade dos problemas
 */
const SEVERITY_LEVELS = {
  INFO: { level: 'info', priority: 1, color: 'blue' },
  WARNING: { level: 'warning', priority: 2, color: 'yellow' },
  ERROR: { level: 'error', priority: 3, color: 'red' },
  CRITICAL: { level: 'critical', priority: 4, color: 'darkred' }
};

/**
 * 🔍 Analisador de Problemas e Sugestões
 */
export class ProblemsAndSuggestionsAnalyzer {
  constructor() {
    this.config = PROBLEMS_CONFIG;
    this.severityLevels = SEVERITY_LEVELS;
  }
  
  /**
   * 🎯 Análise completa de problemas e geração de sugestões
   */
  analyzeProblemsAndSuggestions(audioMetrics) {
    try {
      if (!audioMetrics) {
        logAudio('problems', 'no_metrics', {});
        return this.getNullResult();
      }
      
      const problems = [];
      const suggestions = [];
      
      // Análise de problemas por categoria
      this.analyzeLoudnessProblems(audioMetrics, problems, suggestions);
      this.analyzeDynamicsProblems(audioMetrics, problems, suggestions);
      this.analyzeStereoProblems(audioMetrics, problems, suggestions);
      this.analyzeSpectralProblems(audioMetrics, problems, suggestions);
      this.analyzeTechnicalProblems(audioMetrics, problems, suggestions);
      
      // Análise de problemas de formato/qualidade
      this.analyzeQualityProblems(audioMetrics, problems, suggestions);
      
      // Gerar sugestões automáticas baseadas em problemas
      const automaticSuggestions = this.generateAutomaticSuggestions(problems);
      suggestions.push(...automaticSuggestions);
      
      // Classificar problemas por severidade
      const problemsBySeverity = this.classifyProblemsBySeverity(problems);
      
      // Gerar resumo de qualidade geral
      const qualitySummary = this.generateQualitySummary(problems, audioMetrics);
      
      const result = {
        // Problemas detectados
        problems: problems.map(p => ({
          id: p.id,
          category: p.category,
          title: p.title,
          description: p.description,
          severity: p.severity.level,
          priority: p.severity.priority,
          affectedMetric: p.affectedMetric,
          currentValue: p.currentValue,
          expectedValue: p.expectedValue,
          impact: p.impact
        })),
        
        // Sugestões geradas
        suggestions: suggestions.map(s => ({
          id: s.id,
          category: s.category,
          title: s.title,
          description: s.description,
          action: s.action,
          priority: s.priority,
          difficulty: s.difficulty,
          relatedProblems: s.relatedProblems || []
        })),
        
        // Classificação por severidade
        severity: {
          critical: problemsBySeverity.critical.length,
          error: problemsBySeverity.error.length,
          warning: problemsBySeverity.warning.length,
          info: problemsBySeverity.info.length,
          total: problems.length
        },
        
        // Resumo de qualidade
        quality: {
          overallScore: qualitySummary.overallScore,
          rating: qualitySummary.rating,
          readyForRelease: qualitySummary.readyForRelease,
          needsWork: qualitySummary.needsWork,
          majorIssues: qualitySummary.majorIssues,
          minorIssues: qualitySummary.minorIssues
        },
        
        // Recomendações prioritárias
        priorityRecommendations: this.generatePriorityRecommendations(problems, suggestions),
        
        // Metadados
        metadata: {
          totalProblems: problems.length,
          totalSuggestions: suggestions.length,
          analysisDate: new Date().toISOString(),
          analysisVersion: '1.0.0'
        }
      };
      
      logAudio('problems', 'analysis_completed', {
        totalProblems: problems.length,
        totalSuggestions: suggestions.length,
        overallScore: qualitySummary.overallScore,
        readyForRelease: qualitySummary.readyForRelease
      });
      
      return result;
      
    } catch (error) {
      logAudio('problems', 'analysis_error', { error: error.message });
      return this.getNullResult();
    }
  }
  
  /**
   * 🔊 Analisar problemas de loudness
   */
  analyzeLoudnessProblems(metrics, problems, suggestions) {
    const lufs = metrics.lufs?.integrated;
    const truePeak = metrics.truePeak?.peak;
    
    if (lufs !== null && lufs !== undefined) {
      if (lufs < this.config.LUFS_THRESHOLDS.TOO_QUIET) {
        problems.push({
          id: 'lufs_too_quiet',
          category: 'loudness',
          title: 'Áudio muito baixo',
          description: `LUFS de ${lufs.toFixed(1)} dB é muito baixo para distribuição`,
          severity: SEVERITY_LEVELS.WARNING,
          affectedMetric: 'lufs',
          currentValue: `${lufs.toFixed(1)} LUFS`,
          expectedValue: '-16 a -12 LUFS',
          impact: 'Usuários precisarão aumentar muito o volume'
        });
        
        suggestions.push({
          id: 'increase_loudness',
          category: 'loudness',
          title: 'Aumentar loudness',
          description: 'Use um limiter ou maximize para aumentar o loudness geral',
          action: 'Apply gentle limiting and gain adjustment',
          priority: 'high',
          difficulty: 'medium',
          relatedProblems: ['lufs_too_quiet']
        });
      }
      
      if (lufs > this.config.LUFS_THRESHOLDS.TOO_LOUD) {
        problems.push({
          id: 'lufs_too_loud',
          category: 'loudness',
          title: 'Áudio muito alto',
          description: `LUFS de ${lufs.toFixed(1)} dB pode causar distorção`,
          severity: SEVERITY_LEVELS.ERROR,
          affectedMetric: 'lufs',
          currentValue: `${lufs.toFixed(1)} LUFS`,
          expectedValue: '-16 a -12 LUFS',
          impact: 'Possível distorção e fadiga auditiva'
        });
      }
    }
    
    if (truePeak !== null && truePeak !== undefined) {
      if (truePeak > this.config.TRUE_PEAK_THRESHOLDS.CRITICAL) {
        problems.push({
          id: 'true_peak_clipping',
          category: 'loudness',
          title: 'Clipping detectado',
          description: `True Peak de ${truePeak.toFixed(2)} dB indica clipping digital`,
          severity: SEVERITY_LEVELS.CRITICAL,
          affectedMetric: 'truePeak',
          currentValue: `${truePeak.toFixed(2)} dB`,
          expectedValue: '< -1 dB',
          impact: 'Distorção audível e degradação da qualidade'
        });
        
        suggestions.push({
          id: 'fix_clipping',
          category: 'loudness',
          title: 'Corrigir clipping',
          description: 'Reduzir gain e aplicar limiting adequado',
          action: 'Reduce overall gain by 3-6dB and apply proper limiting',
          priority: 'critical',
          difficulty: 'easy',
          relatedProblems: ['true_peak_clipping']
        });
      }
    }
  }
  
  /**
   * 📈 Analisar problemas de dinâmica
   */
  analyzeDynamicsProblems(metrics, problems, suggestions) {
    const dynamicRange = metrics.dynamics?.dynamicRange;
    const crestFactor = metrics.dynamics?.crestFactor;
    
    if (dynamicRange !== null && dynamicRange !== undefined) {
      if (dynamicRange < this.config.DYNAMIC_RANGE_THRESHOLDS.OVER_COMPRESSED) {
        problems.push({
          id: 'over_compression',
          category: 'dynamics',
          title: 'Sobre-compressão detectada',
          description: `Range dinâmico de ${dynamicRange.toFixed(1)} dB indica compressão excessiva`,
          severity: SEVERITY_LEVELS.ERROR,
          affectedMetric: 'dynamicRange',
          currentValue: `${dynamicRange.toFixed(1)} dB`,
          expectedValue: '8-20 dB',
          impact: 'Som "achatado" e perda de musicalidade'
        });
        
        suggestions.push({
          id: 'reduce_compression',
          category: 'dynamics',
          title: 'Reduzir compressão',
          description: 'Diminuir ratio dos compressors e ajustar attack/release',
          action: 'Reduce compression ratio and increase attack time',
          priority: 'high',
          difficulty: 'medium',
          relatedProblems: ['over_compression']
        });
      }
      
      if (dynamicRange > this.config.DYNAMIC_RANGE_THRESHOLDS.UNDER_COMPRESSED) {
        problems.push({
          id: 'under_compression',
          category: 'dynamics',
          title: 'Falta de controle dinâmico',
          description: `Range dinâmico de ${dynamicRange.toFixed(1)} dB pode indicar falta de processamento`,
          severity: SEVERITY_LEVELS.INFO,
          affectedMetric: 'dynamicRange',
          currentValue: `${dynamicRange.toFixed(1)} dB`,
          expectedValue: '8-20 dB',
          impact: 'Possível inconsistência de volume'
        });
      }
    }
  }
  
  /**
   * 🎧 Analisar problemas de stereo
   */
  analyzeStereoProblems(metrics, problems, suggestions) {
    const correlation = metrics.stereo?.correlation;
    const width = metrics.stereo?.width;
    
    if (correlation !== null && correlation !== undefined) {
      if (correlation < this.config.STEREO_THRESHOLDS.MONO_LIKE) {
        problems.push({
          id: 'narrow_stereo',
          category: 'stereo',
          title: 'Imagem stereo muito estreita',
          description: `Correlação de ${correlation.toFixed(2)} indica imagem stereo limitada`,
          severity: SEVERITY_LEVELS.WARNING,
          affectedMetric: 'stereoCorrelation',
          currentValue: correlation.toFixed(2),
          expectedValue: '0.3-0.9',
          impact: 'Som monofônico ou pouco espacial'
        });
        
        suggestions.push({
          id: 'widen_stereo',
          category: 'stereo',
          title: 'Expandir imagem stereo',
          description: 'Usar reverb, delay ou stereo widening plugins',
          action: 'Add stereo reverb or use stereo widening techniques',
          priority: 'medium',
          difficulty: 'easy',
          relatedProblems: ['narrow_stereo']
        });
      }
      
      if (correlation > this.config.STEREO_THRESHOLDS.TOO_WIDE) {
        problems.push({
          id: 'too_wide_stereo',
          category: 'stereo',
          title: 'Imagem stereo excessivamente larga',
          description: `Correlação de ${correlation.toFixed(2)} pode causar problemas em mono`,
          severity: SEVERITY_LEVELS.WARNING,
          affectedMetric: 'stereoCorrelation',
          currentValue: correlation.toFixed(2),
          expectedValue: '0.3-0.9',
          impact: 'Possível cancelamento em reprodução mono'
        });
      }
    }
  }
  
  /**
   * 🌈 Analisar problemas espectrais
   */
  analyzeSpectralProblems(metrics, problems, suggestions) {
    const brightness = metrics.spectral?.brightness;
    const uniformity = metrics.uniformity?.uniformity?.coefficient;
    
    if (brightness !== null && brightness !== undefined) {
      if (brightness < this.config.SPECTRAL_THRESHOLDS.BRIGHTNESS_LOW) {
        problems.push({
          id: 'low_brightness',
          category: 'spectral',
          title: 'Falta de brilho',
          description: `Brightness de ${brightness.toFixed(2)} indica falta de frequências agudas`,
          severity: SEVERITY_LEVELS.INFO,
          affectedMetric: 'brightness',
          currentValue: brightness.toFixed(2),
          expectedValue: '0.3-0.7',
          impact: 'Som abafado ou sem vida'
        });
        
        suggestions.push({
          id: 'add_brightness',
          category: 'spectral',
          title: 'Adicionar brilho',
          description: 'Realçar frequências agudas com EQ ou exciter',
          action: 'Boost high frequencies (8-20kHz) with gentle EQ',
          priority: 'low',
          difficulty: 'easy',
          relatedProblems: ['low_brightness']
        });
      }
    }
    
    if (uniformity !== null && uniformity !== undefined) {
      if (uniformity > this.config.SPECTRAL_THRESHOLDS.UNIFORMITY_POOR) {
        problems.push({
          id: 'poor_spectral_balance',
          category: 'spectral',
          title: 'Balanço espectral irregular',
          description: `Coeficiente de uniformidade ${uniformity.toFixed(2)} indica desequilíbrio`,
          severity: SEVERITY_LEVELS.WARNING,
          affectedMetric: 'spectralUniformity',
          currentValue: uniformity.toFixed(2),
          expectedValue: '< 0.25',
          impact: 'Som desequilibrado ou com frequências dominantes'
        });
        
        suggestions.push({
          id: 'balance_spectrum',
          category: 'spectral',
          title: 'Balancear espectro',
          description: 'Usar EQ multiband para equilibrar frequências',
          action: 'Apply multiband EQ to balance frequency response',
          priority: 'medium',
          difficulty: 'medium',
          relatedProblems: ['poor_spectral_balance']
        });
      }
    }
  }
  
  /**
   * ⚙️ Analisar problemas técnicos
   */
  analyzeTechnicalProblems(metrics, problems, suggestions) {
    const dcOffset = metrics.dcOffset?.maxAbsDC;
    
    if (dcOffset !== null && dcOffset !== undefined) {
      if (dcOffset > this.config.DC_OFFSET_THRESHOLDS.PROBLEMATIC) {
        problems.push({
          id: 'significant_dc_offset',
          category: 'technical',
          title: 'DC Offset significativo',
          description: `DC Offset de ${dcOffset.toFixed(3)} pode causar problemas`,
          severity: SEVERITY_LEVELS.ERROR,
          affectedMetric: 'dcOffset',
          currentValue: dcOffset.toFixed(3),
          expectedValue: '< 0.01',
          impact: 'Possível distorção e problemas de processamento'
        });
        
        suggestions.push({
          id: 'remove_dc_offset',
          category: 'technical',
          title: 'Remover DC Offset',
          description: 'Aplicar filtro high-pass em ~20Hz',
          action: 'Apply high-pass filter at 20Hz to remove DC component',
          priority: 'high',
          difficulty: 'easy',
          relatedProblems: ['significant_dc_offset']
        });
      }
    }
  }
  
  /**
   * 🏆 Analisar problemas de qualidade geral
   */
  analyzeQualityProblems(metrics, problems, suggestions) {
    // Análise baseada em múltiplas métricas
    const issues = [];
    
    // Se tem muitos problemas de loudness + dynamics, pode ser mastering ruim
    const loudnessProblems = problems.filter(p => p.category === 'loudness').length;
    const dynamicsProblems = problems.filter(p => p.category === 'dynamics').length;
    
    if (loudnessProblems >= 2 && dynamicsProblems >= 1) {
      problems.push({
        id: 'poor_mastering',
        category: 'quality',
        title: 'Mastering inadequado',
        description: 'Múltiplos problemas de loudness e dinâmica detectados',
        severity: SEVERITY_LEVELS.ERROR,
        affectedMetric: 'overall',
        currentValue: 'Multiple issues',
        expectedValue: 'Professional mastering',
        impact: 'Qualidade geral comprometida'
      });
      
      suggestions.push({
        id: 'professional_mastering',
        category: 'quality',
        title: 'Mastering profissional',
        description: 'Considerar remastering com engineer experiente',
        action: 'Professional mastering or complete remaster',
        priority: 'high',
        difficulty: 'hard',
        relatedProblems: ['poor_mastering']
      });
    }
  }
  
  /**
   * 🤖 Gerar sugestões automáticas baseadas em padrões
   */
  generateAutomaticSuggestions(problems) {
    const automaticSuggestions = [];
    
    // Se há clipping + over-compression, sugerir remaster completo
    const hasClipping = problems.some(p => p.id === 'true_peak_clipping');
    const hasOverCompression = problems.some(p => p.id === 'over_compression');
    
    if (hasClipping && hasOverCompression) {
      automaticSuggestions.push({
        id: 'complete_remaster',
        category: 'workflow',
        title: 'Remaster completo recomendado',
        description: 'Problemas múltiplos detectados sugerem necessidade de remaster',
        action: 'Start mastering process from scratch with proper gain staging',
        priority: 'critical',
        difficulty: 'hard',
        relatedProblems: ['true_peak_clipping', 'over_compression']
      });
    }
    
    // Se há problemas stereo + spectral, sugerir revisão do mix
    const hasStereoProblems = problems.some(p => p.category === 'stereo');
    const hasSpectralProblems = problems.some(p => p.category === 'spectral');
    
    if (hasStereoProblems && hasSpectralProblems) {
      automaticSuggestions.push({
        id: 'mix_revision',
        category: 'workflow',
        title: 'Revisão do mix recomendada',
        description: 'Problemas de stereo e espectrais sugerem revisão do mix',
        action: 'Review mix balance, panning, and frequency distribution',
        priority: 'medium',
        difficulty: 'medium',
        relatedProblems: problems.filter(p => p.category === 'stereo' || p.category === 'spectral').map(p => p.id)
      });
    }
    
    return automaticSuggestions;
  }
  
  /**
   * 📊 Classificar problemas por severidade
   */
  classifyProblemsBySeverity(problems) {
    return {
      critical: problems.filter(p => p.severity.level === 'critical'),
      error: problems.filter(p => p.severity.level === 'error'),
      warning: problems.filter(p => p.severity.level === 'warning'),
      info: problems.filter(p => p.severity.level === 'info')
    };
  }
  
  /**
   * 📈 Gerar resumo de qualidade geral
   */
  generateQualitySummary(problems, metrics) {
    const severityWeights = { critical: -4, error: -2, warning: -1, info: -0.5 };
    
    let score = 10; // Score base
    
    problems.forEach(problem => {
      score += severityWeights[problem.severity.level] || 0;
    });
    
    score = Math.max(0, Math.min(10, score));
    
    let rating;
    if (score >= 9) rating = 'excellent';
    else if (score >= 7) rating = 'good';
    else if (score >= 5) rating = 'fair';
    else if (score >= 3) rating = 'poor';
    else rating = 'unacceptable';
    
    const criticalIssues = problems.filter(p => p.severity.level === 'critical').length;
    const majorIssues = problems.filter(p => p.severity.level === 'error').length;
    const minorIssues = problems.filter(p => p.severity.level === 'warning' || p.severity.level === 'info').length;
    
    return {
      overallScore: Math.round(score * 10) / 10,
      rating,
      readyForRelease: criticalIssues === 0 && majorIssues === 0 && score >= 7,
      needsWork: criticalIssues > 0 || majorIssues > 0 || score < 5,
      majorIssues: criticalIssues + majorIssues,
      minorIssues
    };
  }
  
  /**
   * ⭐ Gerar recomendações prioritárias
   */
  generatePriorityRecommendations(problems, suggestions) {
    const criticalSuggestions = suggestions.filter(s => s.priority === 'critical');
    const highSuggestions = suggestions.filter(s => s.priority === 'high');
    
    const recommendations = [];
    
    if (criticalSuggestions.length > 0) {
      recommendations.push({
        priority: 'immediate',
        title: 'Ação imediata necessária',
        suggestions: criticalSuggestions.slice(0, 3)
      });
    }
    
    if (highSuggestions.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Melhorias importantes',
        suggestions: highSuggestions.slice(0, 3)
      });
    }
    
    return recommendations;
  }
  
  /**
   * 🔇 Resultado nulo para casos de erro
   */
  getNullResult() {
    return {
      problems: [],
      suggestions: [],
      severity: {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0,
        total: 0
      },
      quality: {
        overallScore: 0,
        rating: 'unknown',
        readyForRelease: false,
        needsWork: true,
        majorIssues: 0,
        minorIssues: 0
      },
      priorityRecommendations: [],
      metadata: {
        totalProblems: 0,
        totalSuggestions: 0,
        analysisDate: new Date().toISOString(),
        analysisVersion: '1.0.0'
      }
    };
  }
}

/**
 * 🎨 Serializador para JSON final
 */
export function serializeProblemsAndSuggestions(analysis) {
  if (!analysis || !analysis.problems) {
    return null;
  }
  
  return {
    problems: analysis.problems,
    suggestions: analysis.suggestions,
    severity: analysis.severity,
    quality: {
      overallScore: Number(analysis.quality.overallScore),
      rating: analysis.quality.rating,
      readyForRelease: Boolean(analysis.quality.readyForRelease),
      needsWork: Boolean(analysis.quality.needsWork),
      majorIssues: Number(analysis.quality.majorIssues),
      minorIssues: Number(analysis.quality.minorIssues)
    },
    priorityRecommendations: analysis.priorityRecommendations
  };
}

/**
 * 🔧 Função auxiliar para análise rápida
 */
export function analyzeProblemsAndSuggestions(audioMetrics) {
  const analyzer = new ProblemsAndSuggestionsAnalyzer();
  return analyzer.analyzeProblemsAndSuggestions(audioMetrics);
}

console.log('🔍 Problems & Suggestions Analyzer carregado - Sistema de detecção automática');