// 🏷️ ANALYSIS LABELS - Mapa de Labels Amigáveis para Iniciantes
// IMPORTANTE: NÃO altera keys do backend. Apenas apresentação no front-end.
// Versão: Ultra-Futurista Mobile-First
// Data: 11 de outubro de 2025

/**
 * Sistema de labels amigáveis que mapeia keys técnicas do backend 
 * para nomes compreensíveis para iniciantes em produção musical.
 * 
 * REGRAS DE OURO:
 * 1. NÃO alterar keys vindas da API
 * 2. Labels em português brasileiro claro
 * 3. Tooltips educativos (não técnicos demais)
 * 4. Hints práticos sobre como melhorar
 * 5. Faixas ideais por gênero quando relevante
 */

export const ANALYSIS_LABELS = {
  // ========================================
  // MÉTRICAS PRINCIPAIS DE LOUDNESS
  // ========================================
  
  true_peak: {
    label: "Pico Máximo",
    shortLabel: "Pico",
    unit: "dBTP",
    category: "loudness",
    hint: "O maior pico do seu áudio. Se estiver acima de -1.0 dBTP, pode causar distorção digital no streaming.",
    help: "💡 Como corrigir: Reduza o volume geral ou use um limiter com ceiling -1.0 dBTP",
    ideal: {
      general: "< -1.0 dBTP",
      streaming: "< -1.0 dBTP",
      mastering: "< -0.3 dBTP"
    },
    icon: "🔺",
    priority: "critical"
  },

  integrated_lufs: {
    label: "Volume Médio",
    shortLabel: "Volume",
    unit: "LUFS", 
    category: "loudness",
    hint: "O volume médio percebido da sua música. Cada plataforma tem sua meta ideal (Spotify: -14 LUFS, YouTube: -13 LUFS).",
    help: "💡 Como ajustar: Use um medidor de LUFS e ajuste o ganho final para atingir a meta do seu gênero",
    ideal: {
      trance: "-14 LUFS",
      funk_mandela: "-12 LUFS", 
      funk_bruxaria: "-11 LUFS",
      funk_automotivo: "-10 LUFS",
      eletronico: "-14 LUFS"
    },
    icon: "🔊",
    priority: "high"
  },

  momentary_lufs_max: {
    label: "Pico de Volume",
    shortLabel: "Pico Vol",
    unit: "LUFS",
    category: "loudness", 
    hint: "O momento mais alto da sua música. Importante para evitar drops de volume automáticos.",
    help: "💡 Dica: Mantenha próximo do volume médio para consistência",
    icon: "📊",
    priority: "medium"
  },

  // ========================================
  // DINÂMICA E RANGE
  // ========================================

  dynamic_range_db: {
    label: "Dinâmica",
    shortLabel: "Dinâmica", 
    unit: "dB",
    category: "dynamics",
    hint: "A diferença entre as partes mais altas e baixas. Mais dinâmica = música mais expressiva, menos = mais consistente.",
    help: "💡 Como melhorar: Use compressão mais suave ou deixe mais respiro entre seções",
    ideal: {
      trance: "12-16 dB",
      funk_mandela: "8-12 dB",
      funk_bruxaria: "6-10 dB", 
      funk_automotivo: "6-10 dB",
      eletronico: "10-14 dB"
    },
    icon: "⚡",
    priority: "medium"
  },

  loudness_range_lra: {
    label: "Variação de Volume",
    shortLabel: "Variação",
    unit: "LU",
    category: "dynamics",
    hint: "O quanto o volume varia ao longo da música. Muito baixo pode soar monótono, muito alto pode soar inconsistente.",
    help: "💡 Equilibrar: Automatize o volume ou use compressão multibanda",
    ideal: {
      general: "3-8 LU",
      trance: "4-8 LU", 
      funk: "2-6 LU"
    },
    icon: "📈",
    priority: "low"
  },

  crest_factor: {
    label: "Fator de Impacto",
    shortLabel: "Impacto",
    unit: "dB", 
    category: "dynamics",
    hint: "A diferença entre o pico e o volume médio. Alto = mais punch, baixo = mais comprimido.",
    help: "💡 Para mais punch: Reduza compressão nos transientes. Para mais consistência: aumente compressão",
    ideal: {
      general: "12-20 dB",
      punchy: "> 18 dB",
      compressed: "8-12 dB"
    },
    icon: "💥",
    priority: "low"
  },

  // ========================================
  // ANÁLISE ESPECTRAL (FREQUÊNCIAS)
  // ========================================

  sub_db: {
    label: "Sub (20–60 Hz)",
    shortLabel: "Sub",
    unit: "dB",
    category: "spectral", 
    hint: "A fundação do seu som. Responsável pelo peso e presença física da música.",
    help: "💡 Como ajustar: EQ no kick/sub-bass ou use um plugin de sub harmônicos",
    ranges: "20-60 Hz",
    icon: "🔉",
    priority: "medium"
  },

  bass_db: {
    label: "Bass (60–150 Hz)", 
    shortLabel: "Bass",
    unit: "dB",
    category: "spectral",
    hint: "Os graves que dão corpo e balanço. Muito = lama, pouco = som fino.",
    help: "💡 Como ajustar: EQ linear ou compressor no grupo de graves",
    ranges: "60-150 Hz", 
    icon: "🎸",
    priority: "high"
  },

  lowmid_db: {
    label: "Low-Mid (150–500 Hz)",
    shortLabel: "Low-Mid", 
    unit: "dB",
    category: "spectral",
    hint: "Região que pode causar 'lama' se excessiva. Onde ficam as fundamentais de muitos instrumentos.",
    help: "💡 Dica: Corte sutil em 200-300 Hz pode limpar o som sem perder corpo",
    ranges: "150-500 Hz",
    icon: "🎵", 
    priority: "medium"
  },

  mid_db: {
    label: "Mid (500 Hz–2 kHz)",
    shortLabel: "Mid",
    unit: "dB", 
    category: "spectral",
    hint: "Região de clareza e presença. Onde nossos ouvidos são mais sensíveis.",
    help: "💡 Como melhorar: Realce sutil em 1-2 kHz para mais clareza vocal/melódica",
    ranges: "500 Hz-2 kHz",
    icon: "🎤",
    priority: "high"
  },

  highmid_db: {
    label: "High-Mid (2–5 kHz)", 
    shortLabel: "High-Mid",
    unit: "dB",
    category: "spectral",
    hint: "Região de ataque e definição. Pode soar agressiva se excessiva.",
    help: "💡 Cuidado: Excesso aqui causa fadiga auditiva. Use com moderação",
    ranges: "2-5 kHz",
    icon: "⚔️",
    priority: "medium"
  },

  presence_db: {
    label: "Presence (5–10 kHz)",
    shortLabel: "Presence", 
    unit: "dB",
    category: "spectral",
    hint: "Definição de vocais e instrumentos percussivos. Importante para inteligibilidade.",
    help: "💡 Como usar: Realce sutil para mais clareza, corte se soar metálico",
    ranges: "5-10 kHz",
    icon: "🎯",
    priority: "medium"
  },

  air_db: {
    label: "Air (10–20 kHz)",
    shortLabel: "Air",
    unit: "dB",
    category: "spectral", 
    hint: "O 'ar' e brilho da música. Dá sensação de espaço e modernidade.",
    help: "💡 Como adicionar: EQ shelving suave em 12-15 kHz ou exciter harmônico",
    ranges: "10-20 kHz",
    icon: "✨",
    priority: "low"
  },

  // ========================================
  // CAMPO ESTÉREO
  // ========================================

  stereo_correlation: {
    label: "Correlação Estéreo",
    shortLabel: "Correlação",
    unit: "",
    category: "stereo",
    hint: "O quanto os canais L/R são similares. 1.0 = mono, 0.0 = estéreo total, negativo = problemas de fase.",
    help: "💡 Ideal: 0.3-0.8 para boa separação sem perder compatibilidade mono",
    ideal: {
      general: "0.3-0.8",
      wide: "0.2-0.5", 
      mono_compatible: "0.6-0.9"
    },
    icon: "🎭",
    priority: "medium"
  },

  stereo_width: {
    label: "Largura Estéreo",
    shortLabel: "Largura",
    unit: "",
    category: "stereo",
    hint: "O quanto sua música se espalha entre os canais. Afeta a sensação de espaço.",
    help: "💡 Como ajustar: Use plugins de imagem estéreo ou reverb/delay estéreo",
    ideal: {
      intimate: "Estreita",
      balanced: "Média", 
      wide: "Ampla"
    },
    icon: "📏",
    priority: "low"
  },

  // ========================================
  // CARACTERÍSTICAS ESPECTRAIS AVANÇADAS
  // ========================================

  spectral_centroid_hz: {
    label: "Brilho Médio",
    shortLabel: "Brilho",
    unit: "Hz",
    category: "spectral_advanced",
    hint: "O 'centro de massa' do espectro. Maior = som mais brilhante, menor = som mais escuro.",
    help: "💡 Como ajustar: EQ nas altas frequências ou escolha timbres mais brilhantes/escuros",
    icon: "🌟",
    priority: "low"
  },

  spectral_bandwidth_hz: {
    label: "Largura Espectral", 
    shortLabel: "Largura",
    unit: "Hz",
    category: "spectral_advanced",
    hint: "O quanto a energia se espalha em diferentes frequências. Maior = mais rico harmonicamente.",
    help: "💡 Como melhorar: Use instrumentos com mais harmônicos ou saturation/distortion suave",
    icon: "🌈",
    priority: "low"
  },

  spectral_kurtosis: {
    label: "Kurtose Espectral",
    shortLabel: "Kurtose", 
    unit: "",
    category: "spectral_advanced",
    hint: "Se o espectro é 'pontiagudo' ou 'distribuído'. Afeta o caráter geral do som.",
    help: "💡 Interpretação: Alto = som focado, baixo = som distribuído",
    icon: "📐",
    priority: "low"
  },

  spectral_skewness: {
    label: "Assimetria Espectral",
    shortLabel: "Assimetria",
    unit: "", 
    category: "spectral_advanced", 
    hint: "Se a energia tende mais para graves (negativo) ou agudos (positivo).",
    help: "💡 Uso: Indica o balanço tonal geral da sua mixagem",
    icon: "⚖️",
    priority: "low"
  },

  // ========================================
  // TEMPO E RITMO
  // ========================================

  bpm: {
    label: "BPM",
    shortLabel: "BPM",
    unit: "BPM",
    category: "rhythm", 
    hint: "Batidas por minuto - a velocidade da sua música.",
    help: "💡 Dica: Certifique-se que o BPM detectado está correto para mixagens e remixes",
    ideal: {
      trance: "128-138 BPM",
      funk: "120-130 BPM",
      house: "120-128 BPM"
    },
    icon: "🥁",
    priority: "info"
  }
};

// ========================================
// CATEGORIAS DE ORGANIZAÇÃO
// ========================================

export const LABEL_CATEGORIES = {
  loudness: {
    label: "📢 Loudness & Volume",
    description: "Métricas relacionadas ao volume percebido", 
    priority: 1,
    color: "--ai-primary"
  },
  dynamics: {
    label: "⚡ Dinâmica & Range", 
    description: "Variações de volume e impacto",
    priority: 2,
    color: "--ai-warning"
  },
  spectral: {
    label: "🎵 Faixas de Frequência",
    description: "Distribuição por bandas espectrais",
    priority: 3, 
    color: "--ai-accent"
  },
  stereo: {
    label: "🎭 Campo Estéreo",
    description: "Distribuição espacial do som",
    priority: 4,
    color: "--ai-secondary"
  },
  spectral_advanced: {
    label: "🔬 Análise Avançada",
    description: "Características espectrais detalhadas", 
    priority: 5,
    color: "--ai-text-muted"
  },
  rhythm: {
    label: "🎼 Tempo & Ritmo",
    description: "Métricas rítmicas e temporais",
    priority: 6,
    color: "--ai-success"
  }
};

// ========================================
// UTILIDADES DE FORMATAÇÃO
// ========================================

/**
 * Obtém label formatado para exibição
 * @param {string} key - Chave do backend
 * @param {number|string} value - Valor da métrica
 * @param {string} genre - Gênero musical (opcional)
 * @param {boolean} showHint - Se deve incluir tooltip (padrão: true)
 * @returns {object} Objeto com informações formatadas
 */
export function getFormattedLabel(key, value, genre = null, showHint = true) {
  const config = ANALYSIS_LABELS[key];
  
  if (!config) {
    // Fallback para keys não mapeadas
    return {
      display: key,
      value: String(value),
      tooltip: '',
      category: 'unknown',
      priority: 'low',
      icon: '📊'
    };
  }

  // Formatar valor com unidade
  let formattedValue = value;
  if (typeof value === 'number') {
    formattedValue = value.toFixed(1);
  }
  
  if (config.unit) {
    formattedValue = `${formattedValue} ${config.unit}`;
  }

  // Buscar ideal por gênero se disponível
  let idealRange = config.ideal?.general || 'Varia por contexto';
  if (genre && config.ideal?.[genre]) {
    idealRange = config.ideal[genre];
  }

  return {
    display: config.label,
    shortDisplay: config.shortLabel || config.label,
    value: formattedValue,
    rawValue: value,
    tooltip: showHint ? config.hint : '',
    help: config.help || '',
    category: config.category,
    priority: config.priority,
    icon: config.icon,
    ideal: idealRange,
    ranges: config.ranges || '',
    unit: config.unit || ''
  };
}

/**
 * Calcula status visual baseado no valor e gênero
 * @param {string} key - Chave da métrica
 * @param {number} value - Valor atual
 * @param {string} genre - Gênero musical
 * @returns {object} Status com cor e texto
 */
export function calculateMetricStatus(key, value, genre = 'general') {
  const config = ANALYSIS_LABELS[key];
  if (!config) return { status: 'unknown', color: '--ai-text-muted', text: 'N/A' };

  // Lógica específica por métrica (exemplos)
  switch(key) {
    case 'true_peak':
      if (value > -1.0) return { status: 'critical', color: '--ai-error', text: 'Corrigir' };
      if (value > -3.0) return { status: 'good', color: '--ai-success', text: 'Ideal' };
      return { status: 'ok', color: '--ai-warning', text: 'OK' };
      
    case 'integrated_lufs':
      const targets = { trance: -14, funk_mandela: -12, funk_bruxaria: -11, eletronico: -14 };
      const target = targets[genre] || -14;
      const diff = Math.abs(value - target);
      
      if (diff <= 1) return { status: 'ideal', color: '--ai-success', text: 'Ideal' };
      if (diff <= 3) return { status: 'ok', color: '--ai-warning', text: 'Ajustar' };
      return { status: 'problem', color: '--ai-error', text: 'Corrigir' };
      
    case 'dynamic_range_db':
      if (value >= 12) return { status: 'good', color: '--ai-success', text: 'Boa' };
      if (value >= 8) return { status: 'ok', color: '--ai-warning', text: 'OK' };
      return { status: 'low', color: '--ai-error', text: 'Baixa' };
      
    default:
      // Status genérico baseado em prioridade
      if (config.priority === 'critical') {
        return { status: 'check', color: '--ai-warning', text: 'Verificar' };
      }
      return { status: 'info', color: '--ai-text-muted', text: 'Info' };
  }
}

/**
 * Agrupa métricas por categoria para organização visual
 * @param {object} analysisData - Dados da análise do backend
 * @returns {object} Dados agrupados por categoria
 */
export function groupMetricsByCategory(analysisData) {
  const grouped = {};
  
  // Inicializar categorias
  Object.keys(LABEL_CATEGORIES).forEach(categoryKey => {
    grouped[categoryKey] = {
      ...LABEL_CATEGORIES[categoryKey],
      metrics: []
    };
  });

  // Agrupar métricas existentes nos dados
  Object.keys(analysisData).forEach(key => {
    const config = ANALYSIS_LABELS[key];
    if (config) {
      const category = config.category || 'unknown';
      if (!grouped[category]) {
        grouped[category] = { metrics: [] };
      }
      
      grouped[category].metrics.push({
        key,
        ...getFormattedLabel(key, analysisData[key]),
        ...config
      });
    }
  });

  // Ordenar categorias por prioridade
  const sortedCategories = Object.keys(grouped)
    .filter(categoryKey => grouped[categoryKey].metrics.length > 0)
    .sort((a, b) => {
      const priorityA = LABEL_CATEGORIES[a]?.priority || 999;
      const priorityB = LABEL_CATEGORIES[b]?.priority || 999;
      return priorityA - priorityB;
    });

  return sortedCategories.reduce((result, categoryKey) => {
    result[categoryKey] = grouped[categoryKey];
    return result;
  }, {});
}

/**
 * Tooltips específicos para mobile (versão reduzida)
 * @param {string} key - Chave da métrica
 * @returns {string} Tooltip condensado para mobile
 */
export function getMobileTooltip(key) {
  const config = ANALYSIS_LABELS[key];
  if (!config) return '';
  
  // Versão condensada do hint para mobile
  const mobileHints = {
    true_peak: "Pico máximo. Mantenha < -1.0 dBTP",
    integrated_lufs: "Volume médio. Varia por gênero",
    dynamic_range_db: "Dinâmica. Mais = expressivo",
    stereo_correlation: "Correlação L/R. 0.3-0.8 ideal",
    bass_db: "Graves 60-150Hz. Equilíbre sem 'lama'",
    // ... adicionar mais conforme necessário
  };
  
  return mobileHints[key] || config.hint?.substring(0, 50) + '...' || '';
}

// ========================================
// EXPORTAÇÕES PADRÃO
// ========================================

export default {
  ANALYSIS_LABELS,
  LABEL_CATEGORIES,
  getFormattedLabel,
  calculateMetricStatus,
  groupMetricsByCategory,
  getMobileTooltip
};