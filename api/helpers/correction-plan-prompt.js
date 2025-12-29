/**
 * 🎯 CORRECTION PLAN PROMPT - Sistema de Plano de Correção Guiado
 * 
 * Gera prompts otimizados para GPT-4o mini que produzem planos de correção
 * ESPECÍFICOS, ITERATIVOS e DEPENDENTES do SoundyAI.
 * 
 * PRINCÍPIOS:
 * 1. Nunca genérico - sempre referencia dados DESTA análise
 * 2. Nunca definitivo - sempre depende de reanálise
 * 3. Contextualizado - considera nível, DAW e gênero
 * 4. Hierarquizado - impacto CRÍTICO > ALTO > FINO
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ MAPEAMENTOS DE CONTEXTO POR DAW
// ═══════════════════════════════════════════════════════════════════════════════

const DAW_CONTEXT = {
  'fl studio': {
    limiter: 'Fruity Limiter',
    eq: 'Parametric EQ 2',
    compressor: 'Fruity Compressor',
    meter: 'Wave Candy ou dBMeter',
    truePeakPlugin: 'Fruity Limiter (ativar LIMIT → True Peak)',
    armadilhas: [
      'Fruity Limiter com ceiling em 0 dB ao invés de -1 dBTP',
      'Maximus com preset "Clean Master" que corta dinâmica demais',
      'Soft Clipper no master sem compensação de ganho',
      'Ignorar o medidor de True Peak (usar Wave Candy em modo Oscilloscope)',
      'Exportar em 16-bit sem dithering ativo'
    ],
    dicasNivel: {
      iniciante: 'No FL Studio, sempre use o Fruity Limiter como ÚLTIMO plugin do master. Vá em LIMIT (não COMP) e ative "CEIL" para True Peak.',
      intermediário: 'Configure o Fruity Limiter: ATT = 5ms, REL = 300ms, CEIL = -1.0 dB. Monitore com Wave Candy em modo Peak Meter.',
      avançado: 'Para True Peak preciso, considere plugins externos (FabFilter Pro-L 2, Limitless). O Fruity Limiter não tem oversampling nativo.'
    }
  },
  'ableton': {
    limiter: 'Limiter (nativo)',
    eq: 'EQ Eight',
    compressor: 'Compressor / Glue Compressor',
    meter: 'Utility + Level Meter (Max for Live)',
    truePeakPlugin: 'Limiter (ativar Lookahead)',
    armadilhas: [
      'Limiter nativo sem Lookahead ativado (não detecta True Peak)',
      'Usar Utility para ganho no master sem checar clipping',
      'EQ Eight em modo Stereo quando deveria ser Mid/Side',
      'Saturator com drive alto no master sem low-cut',
      'Exportar sem normalização mas com headroom insuficiente'
    ],
    dicasNivel: {
      iniciante: 'No Ableton, o Limiter nativo deve ter "Lookahead" ATIVADO para detectar picos corretamente. Coloque como último da chain.',
      intermediário: 'Use Glue Compressor antes do Limiter: Attack 30ms, Release Auto, Ratio 2:1. Isso cola a mix antes de limitar.',
      avançado: 'Para True Peak certificado, use plugins ISP como Pro-L 2 ou Oxford Limiter. O Limiter nativo não tem oversampling.'
    }
  },
  'logic': {
    limiter: 'Adaptive Limiter / Limiter',
    eq: 'Channel EQ',
    compressor: 'Compressor',
    meter: 'Level Meter (MultiMeter)',
    truePeakPlugin: 'Adaptive Limiter (ativar True Peak Detection)',
    armadilhas: [
      'Adaptive Limiter com Out Ceiling em 0 dB',
      'Channel EQ com ganho positivo no master sem compensar',
      'Usar Loudness Meter mas ignorar True Peak',
      'Compressor com Auto Release que bombeia em certos gêneros',
      'Bounce com normalização automática ligada'
    ],
    dicasNivel: {
      iniciante: 'No Logic, use o Adaptive Limiter e defina "Out Ceiling" para -1.0 dB. Ative "True Peak Detection" nas opções.',
      intermediário: 'Insira o MultiMeter antes do Limiter para monitorar LUFS em tempo real. Mire no target do seu gênero.',
      avançado: 'O Adaptive Limiter do Logic é bem transparente, mas para EDM pesado considere Ozone Maximizer ou Pro-L 2.'
    }
  },
  'pro tools': {
    limiter: 'Maxim / BF-76',
    eq: 'EQ III / Channel Strip',
    compressor: 'BF-76 / Dynamics III',
    meter: 'Phase Scope / Level Meter',
    truePeakPlugin: 'Maxim (definir ceiling negativo)',
    armadilhas: [
      'Maxim com ceiling em 0 dB (causa clipping em conversores)',
      'Usar apenas medidores sample-peak ao invés de True Peak',
      'Master Fader com plugins que não são post-fader',
      'Não compensar latência de plugins com lookahead',
      'Exportar offline com dither desligado'
    ],
    dicasNivel: {
      iniciante: 'No Pro Tools, coloque o Maxim no Master Fader e defina Ceiling para -1.0 dB. Sempre.',
      intermediário: 'Use o medidor de fase (Phase Scope) para verificar problemas de correlação estéreo antes de limitar.',
      avançado: 'Para masterização séria, considere hardware ou plugins como Pro-L 2, Ozone, ou Weiss DS1.'
    }
  },
  'studio one': {
    limiter: 'Limiter',
    eq: 'Pro EQ3',
    compressor: 'Compressor',
    meter: 'Level Meter / Spectrum Meter',
    truePeakPlugin: 'Limiter (modo True Peak)',
    armadilhas: [
      'Limiter com K-Weighted desativado',
      'Fat Channel com saturação no master sem headroom',
      'Pro EQ com ganho alto nas bandas sem cut compensatório',
      'Mix Engine FX aplicando efeitos globais indesejados',
      'Exportar sem selecionar True Peak Limiting'
    ],
    dicasNivel: {
      iniciante: 'No Studio One, vá em Limiter e ative "True Peak" no menu. Ceiling em -1.0 dB.',
      intermediário: 'Use o Spectrum Meter integrado para identificar acúmulos de frequência antes de EQizar.',
      avançado: 'O Project Page do Studio One tem Limiter e medição LUFS integrados - use para o master final.'
    }
  },
  'cubase': {
    limiter: 'Maximizer / Brickwall Limiter',
    eq: 'StudioEQ / Frequency',
    compressor: 'Compressor',
    meter: 'SuperVision',
    truePeakPlugin: 'Brickwall Limiter (ativar True Peak)',
    armadilhas: [
      'Maximizer com Output muito alto',
      'Frequency EQ com mudanças drásticas em múltiplas bandas',
      'Não usar SuperVision para monitorar True Peak',
      'Control Room mal configurado afetando medição',
      'Exportar sem Real-Time Processing ativo'
    ],
    dicasNivel: {
      iniciante: 'No Cubase, use o Brickwall Limiter e defina Output para -1.0 dB. Ative True Peak no menu.',
      intermediário: 'SuperVision é seu melhor amigo: configure módulos de LUFS, True Peak e Spectrum lado a lado.',
      avançado: 'Para precisão máxima, use plugins externos de medição (Youlean, LEVELS) junto com SuperVision.'
    }
  },
  'default': {
    limiter: 'Limiter da sua DAW',
    eq: 'EQ paramétrico',
    compressor: 'Compressor',
    meter: 'Medidor de LUFS/True Peak',
    truePeakPlugin: 'Limiter com True Peak ativado',
    armadilhas: [
      'Ceiling do limiter em 0 dB',
      'Não monitorar True Peak, apenas sample peak',
      'EQ com ganho excessivo sem cortar outras frequências',
      'Compressão no master sem headroom adequado',
      'Exportar sem verificar formato e dithering'
    ],
    dicasNivel: {
      iniciante: 'Sempre coloque um limiter como último plugin do master. Ceiling em -1.0 dB no mínimo.',
      intermediário: 'Monitore LUFS integrado e True Peak durante todo o processo de mixagem.',
      avançado: 'Considere plugins especializados para masterização com True Peak intersample detection.'
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 MAPEAMENTOS DE CONTEXTO POR GÊNERO
// ═══════════════════════════════════════════════════════════════════════════════

const GENRE_CONTEXT = {
  'eletronica': {
    targetLufs: -8,
    targetTp: -0.5,
    targetDr: 6,
    caracteristicas: 'Sub grave potente (30-60Hz), kick dominante, sidechain pumping, loudness competitivo',
    viciosComuns: [
      'Sub excessivo que mascara o kick',
      'Sidechain muito agressivo que corta dinâmica',
      'Master muito limitado para "competir" com referências',
      'Highs estridentes por excesso de excitação harmônica',
      'Stereo width exagerado no sub (deve ser mono abaixo de 120Hz)'
    ],
    focoCorrecao: 'Balancear sub vs kick, controlar transientes, manter punch sem esmagar'
  },
  'hip hop': {
    targetLufs: -10,
    targetTp: -1.0,
    targetDr: 7,
    caracteristicas: 'Kick e 808 dominantes, vocal presente, groove no low-end',
    viciosComuns: [
      '808 com fundamental muito baixa (abaixo de 30Hz) que some em fones',
      'Vocal abafado por excesso de low-mids',
      'Hi-hats estridentes e desbalanceados',
      'Kick competindo com 808 ao invés de complementar',
      'Master muito denso sem espaço para respirar'
    ],
    focoCorrecao: 'Separar 808 do kick em frequência, clareza vocal, controle de sibilância'
  },
  'rock': {
    targetLufs: -11,
    targetTp: -1.0,
    targetDr: 9,
    caracteristicas: 'Guitarra e bateria equilibradas, dinâmica preservada, punch natural',
    viciosComuns: [
      'Guitarras com frequências acumuladas (200-400Hz)',
      'Bateria sem punch por over-compression',
      'Baixo perdido no meio das guitarras',
      'Master brickwall que mata o feeling',
      'Reverbs excessivos que embaçam a mix'
    ],
    focoCorrecao: 'Carving de frequências entre instrumentos, preservar transientes da bateria'
  },
  'pop': {
    targetLufs: -9,
    targetTp: -1.0,
    targetDr: 7,
    caracteristicas: 'Vocal extremamente presente, baixo groove, produção polida',
    viciosComuns: [
      'Vocal competindo com synths na mesma faixa',
      'Low-end indefinido (kick vs baixo)',
      'Excesso de brilho artificial no master',
      'Dinâmica morta por multiband compression excessiva',
      'Reverb no vocal que afasta ao invés de dar espaço'
    ],
    focoCorrecao: 'Clareza e presença vocal, definição rítmica, brilho natural'
  },
  'funk': {
    targetLufs: -10,
    targetTp: -1.0,
    targetDr: 8,
    caracteristicas: 'Groove no baixo e bateria, dinâmica expressiva, elementos percussivos',
    viciosComuns: [
      'Baixo sem definição nas notas',
      'Snare sem snap característico',
      'Guitarras de base muito proeminentes',
      'Over-compression matando o groove',
      'Hi-hats e elementos percussivos enterrados'
    ],
    focoCorrecao: 'Groove e punch no low-end, clareza nas linhas de baixo, dinâmica viva'
  },
  'trap': {
    targetLufs: -8,
    targetTp: -0.5,
    targetDr: 5,
    caracteristicas: '808 sub dominante, hi-hats rápidos, kicks distorcidos, loudness extremo',
    viciosComuns: [
      '808 que clipa ao invés de saturar de forma controlada',
      'Hi-hats estridentes por excesso de brilho',
      'Kick e 808 brigando (não layerados corretamente)',
      'Vocal enterrado pelo instrumental',
      'Master completamente esmagado sem transientes'
    ],
    focoCorrecao: 'Relação kick-808, controle de distorção harmônica, clareza nos hi-hats'
  },
  'edm': {
    targetLufs: -7,
    targetTp: -0.3,
    targetDr: 5,
    caracteristicas: 'Loudness máximo, drops impactantes, builds energéticos, sidechain pesado',
    viciosComuns: [
      'Master tão limitado que perde o punch do drop',
      'Sidechain excessivo que cria "buraco" demais',
      'Leads com frequências acumuladas (1-3kHz)',
      'Sub e kick mal layerados',
      'Clipping intencional que vira distorção feia'
    ],
    focoCorrecao: 'Manter impacto mesmo com loudness alto, controlar peaks, preservar energia'
  },
  'default': {
    targetLufs: -14,
    targetTp: -1.0,
    targetDr: 8,
    caracteristicas: 'Balanceamento geral, clareza, dinâmica saudável',
    viciosComuns: [
      'Frequências acumuladas no low-mid (200-500Hz)',
      'Falta de definição no grave',
      'Excesso de compressão no master',
      'Imagem estéreo confusa',
      'Headroom insuficiente antes do limiter'
    ],
    focoCorrecao: 'Balanceamento tonal, clareza, dinâmica natural'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 MAPEAMENTOS DE CONTEXTO POR NÍVEL TÉCNICO
// ═══════════════════════════════════════════════════════════════════════════════

const LEVEL_CONTEXT = {
  iniciante: {
    linguagem: 'Simples, passo a passo, sem jargões não explicados',
    errosComuns: [
      'Não saber onde encontrar os plugins nativos',
      'Confundir ganho com volume do fader',
      'Aplicar EQ sem saber o que cada frequência faz',
      'Compressor com threshold muito baixo esmagando tudo',
      'Não entender a diferença entre dB, dBFS e dBTP'
    ],
    foco: 'Localização exata de cada controle, valores específicos, validação visual'
  },
  intermediário: {
    linguagem: 'Técnica mas acessível, explicar o porquê',
    errosComuns: [
      'Over-processing tentando "melhorar" demais',
      'Não usar referências durante a mix',
      'Tratar sintomas ao invés de causas',
      'Confiar demais nos olhos (medidores) ao invés dos ouvidos',
      'Aplicar plugins "porque todo mundo usa" sem entender'
    ],
    foco: 'Contexto técnico, alternativas, armadilhas a evitar'
  },
  avançado: {
    linguagem: 'Direta, técnica, sem explicações básicas',
    errosComuns: [
      'Overengineering - muitos plugins fazendo pouco',
      'Ignorar o contexto de reprodução (streaming, vinyl, etc)',
      'Mudanças sutis demais que não fazem diferença prática',
      'Não documentar/salvar presets para consistência',
      'Confiar em medidores baratos ou não calibrados'
    ],
    foco: 'Eficiência, precisão, trade-offs técnicos'
  },
  profissional: {
    linguagem: 'Mínima, apenas dados críticos',
    errosComuns: [
      'Assumir que o cliente sabe o que está pedindo',
      'Não comunicar limitações do material fonte',
      'Processar demais tentando "salvar" uma mix ruim',
      'Ignorar especificações de entrega (LUFS targets por plataforma)'
    ],
    foco: 'Dados precisos, sem tutorial, apenas correções'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 SYSTEM PROMPT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const CORRECTION_PLAN_SYSTEM_PROMPT = `
Você é um engenheiro de mastering sênior do SoundyAI gerando um PLANO DE CORREÇÃO GUIADO.

═══════════════════════════════════════════════════════════════════════════════
🚨 REGRAS ABSOLUTAS - NUNCA VIOLE
═══════════════════════════════════════════════════════════════════════════════

1. **ESPECÍFICO PARA ESTA MÚSICA**
   - Referencie SEMPRE os valores EXATOS dos problemas detectados
   - NUNCA gere conteúdo genérico ou tutoriais amplos
   - Cada instrução deve mencionar o problema DESTA análise

2. **DEPENDENTE DE REANÁLISE**
   - NUNCA forneça valores finais absolutos de ajuste fino
   - Ajustes avançados SEMPRE dependem da próxima reanálise
   - Cada etapa DEVE terminar com instrução de reanálise no SoundyAI
   - Use frases como "após reanálise, ajuste fino conforme novo resultado"

3. **ITERATIVO, NÃO DEFINITIVO**
   - O plano é um GUIA de correção, não uma solução final
   - Progressão entre etapas é CONDICIONAL aos resultados da reanálise
   - NUNCA prometa resultado final ou "mix perfeita"

4. **CONTEXTUALIZADO AO USUÁRIO**
   - Adapte linguagem ao nível técnico
   - Mencione plugins ESPECÍFICOS da DAW informada
   - Considere armadilhas típicas do gênero musical
   - Inclua erros comuns do nível técnico para evitar

5. **HIERARQUIA DE IMPACTO**
   - Classifique cada etapa como: CRÍTICO / ALTO / FINO
   - CRÍTICO: Problemas que impedem distribuição/aprovação
   - ALTO: Problemas audíveis que afetam qualidade percebida
   - FINO: Otimizações que elevam para nível profissional

═══════════════════════════════════════════════════════════════════════════════
📋 FORMATO DE SAÍDA (JSON ESTRITO)
═══════════════════════════════════════════════════════════════════════════════

{
  "intro": "Uma frase personalizada sobre esta música específica e o caminho de correção",
  
  "steps": [
    {
      "number": 1,
      "title": "Título descritivo da correção",
      "impact": "CRÍTICO | ALTO | FINO",
      "problemRef": {
        "type": "ID do problema (ex: true_peak_high)",
        "currentValue": "valor detectado",
        "targetValue": "valor alvo"
      },
      "why": "Por que isso afeta ESTA música especificamente",
      "how": [
        "Passo 1 com localização exata na DAW",
        "Passo 2 com parâmetro INICIAL (não final)",
        "Passo 3 com verificação visual/auditiva"
      ],
      "dawSpecific": "Dica específica para a DAW do usuário",
      "avoidMistake": "Erro comum do nível técnico a evitar",
      "verify": "Como verificar se a etapa teve efeito",
      "nextStepCondition": "Condição baseada na reanálise para prosseguir"
    }
  ],
  
  "reanalysisReminder": "Mensagem reforçando que cada etapa requer reanálise antes de continuar",
  
  "finalNote": "Incentivo + lembrete de que ajuste fino depende de iterações no SoundyAI"
}

═══════════════════════════════════════════════════════════════════════════════
⚠️ RESTRIÇÕES DE CONTEÚDO
═══════════════════════════════════════════════════════════════════════════════

- Máximo 8 etapas (priorizar por impacto)
- Máximo 4 passos em "how" por etapa
- Linguagem direta, sem explicações teóricas longas
- NUNCA ensine conceitos básicos de áudio
- NUNCA inclua informação que não seja acionável
- NUNCA dê parâmetros "finais" - sempre "iniciais" ou "de partida"

═══════════════════════════════════════════════════════════════════════════════
`.trim();

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES DE CONSTRUÇÃO DE PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza o nome da DAW para lookup
 * @param {string} daw - Nome da DAW informado pelo usuário
 * @returns {string} Key normalizada para DAW_CONTEXT
 */
function normalizeDAW(daw) {
  if (!daw || typeof daw !== 'string') return 'default';
  
  const normalized = daw.toLowerCase().trim();
  
  // Mapeamento de variações comuns
  const dawMap = {
    'fl': 'fl studio',
    'fl studio': 'fl studio',
    'fruity loops': 'fl studio',
    'ableton': 'ableton',
    'ableton live': 'ableton',
    'live': 'ableton',
    'logic': 'logic',
    'logic pro': 'logic',
    'logic pro x': 'logic',
    'pro tools': 'pro tools',
    'protools': 'pro tools',
    'studio one': 'studio one',
    's1': 'studio one',
    'cubase': 'cubase',
    'nuendo': 'cubase',
    'reaper': 'default',
    'bitwig': 'default',
    'reason': 'default',
    'garageband': 'logic'
  };
  
  return dawMap[normalized] || 'default';
}

/**
 * Normaliza o nome do gênero para lookup
 * @param {string} genre - Nome do gênero
 * @returns {string} Key normalizada para GENRE_CONTEXT
 */
function normalizeGenre(genre) {
  if (!genre || typeof genre !== 'string') return 'default';
  
  const normalized = genre.toLowerCase().trim();
  
  const genreMap = {
    'eletronica': 'eletronica',
    'eletrônica': 'eletronica',
    'electronic': 'eletronica',
    'house': 'eletronica',
    'techno': 'eletronica',
    'trance': 'eletronica',
    'hip hop': 'hip hop',
    'hip-hop': 'hip hop',
    'hiphop': 'hip hop',
    'rap': 'hip hop',
    'rock': 'rock',
    'metal': 'rock',
    'alternative': 'rock',
    'indie': 'rock',
    'pop': 'pop',
    'funk': 'funk',
    'funk brasileiro': 'funk',
    'funk br': 'funk',
    'trap': 'trap',
    'drill': 'trap',
    'edm': 'edm',
    'dubstep': 'edm',
    'bass music': 'edm',
    'drum and bass': 'edm',
    'dnb': 'edm',
    'd&b': 'edm'
  };
  
  // Tentar match parcial
  for (const [key, value] of Object.entries(genreMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return 'default';
}

/**
 * Normaliza o nível técnico
 * @param {string} level - Nível técnico
 * @returns {string} Key normalizada para LEVEL_CONTEXT
 */
function normalizeLevel(level) {
  if (!level || typeof level !== 'string') return 'iniciante';
  
  const normalized = level.toLowerCase().trim();
  
  const levelMap = {
    'iniciante': 'iniciante',
    'beginner': 'iniciante',
    'básico': 'iniciante',
    'basico': 'iniciante',
    'intermediário': 'intermediário',
    'intermediario': 'intermediário',
    'intermediate': 'intermediário',
    'médio': 'intermediário',
    'medio': 'intermediário',
    'avançado': 'avançado',
    'avancado': 'avançado',
    'advanced': 'avançado',
    'profissional': 'profissional',
    'professional': 'profissional',
    'pro': 'profissional',
    'expert': 'profissional'
  };
  
  return levelMap[normalized] || 'iniciante';
}

/**
 * Determina a hierarquia de impacto baseado no problema
 * @param {Object} problem - Problema detectado
 * @returns {string} CRÍTICO | ALTO | FINO
 */
function determineImpact(problem) {
  const { id, severity, type } = problem;
  const problemId = id || type || '';
  
  // CRÍTICO: Problemas que impedem distribuição
  const criticalProblems = [
    'true_peak_high', 'true_peak', 'clipping',
    'dc_offset', 'phase_inversion', 'mono_incompatible'
  ];
  
  // ALTO: Problemas audíveis significativos
  const highProblems = [
    'lufs_low', 'lufs_high', 'lufs',
    'dynamic_range_low', 'dynamic_range_high',
    'stereo_phase', 'correlation_low',
    'freq_excess', 'freq_lack',
    'turbidez', 'muddy', 'harshness'
  ];
  
  if (criticalProblems.some(p => problemId.includes(p))) {
    return 'CRÍTICO';
  }
  
  if (severity === 'alta' || highProblems.some(p => problemId.includes(p))) {
    return 'ALTO';
  }
  
  if (severity === 'média' || severity === 'media') {
    return 'ALTO';
  }
  
  return 'FINO';
}

/**
 * Constrói o prompt de usuário com todos os contextos
 * @param {Object} params - Parâmetros da requisição
 * @returns {string} Prompt formatado
 */
export function buildCorrectionPlanPrompt(params) {
  const {
    problems = [],
    userProfile = {},
    genreTargets = {},
    analysisMetrics = {},
    plan = 'free'
  } = params;
  
  // Normalizar inputs
  const dawKey = normalizeDAW(userProfile.daw);
  const genreKey = normalizeGenre(userProfile.genre || userProfile.estilo);
  const levelKey = normalizeLevel(userProfile.level || userProfile.nivelTecnico);
  
  // Obter contextos
  const dawContext = DAW_CONTEXT[dawKey] || DAW_CONTEXT.default;
  const genreContext = GENRE_CONTEXT[genreKey] || GENRE_CONTEXT.default;
  const levelContext = LEVEL_CONTEXT[levelKey] || LEVEL_CONTEXT.iniciante;
  
  // Ordenar problemas por impacto
  const sortedProblems = problems
    .map(p => ({ ...p, impact: determineImpact(p) }))
    .sort((a, b) => {
      const order = { 'CRÍTICO': 0, 'ALTO': 1, 'FINO': 2 };
      return order[a.impact] - order[b.impact];
    });
  
  // Filtrar por plano
  let filteredProblems;
  if (plan === 'free') {
    // Free: apenas CRÍTICOS, máx 3
    filteredProblems = sortedProblems.filter(p => p.impact === 'CRÍTICO').slice(0, 3);
    if (filteredProblems.length === 0) {
      filteredProblems = sortedProblems.slice(0, 2); // Fallback: top 2
    }
  } else if (plan === 'plus') {
    // Plus: CRÍTICOS + ALTOS, máx 6
    filteredProblems = sortedProblems.filter(p => p.impact !== 'FINO').slice(0, 6);
  } else {
    // Pro: todos, máx 8
    filteredProblems = sortedProblems.slice(0, 8);
  }
  
  // Formatar problemas para o prompt
  const problemsText = filteredProblems.map((p, i) => {
    const value = p.value ?? p.currentValue ?? 'detectado';
    const target = p.target ?? p.targetValue ?? genreTargets[p.id] ?? 'dentro do alvo';
    return `${i + 1}. [${p.impact}] ${p.id || p.type} — Atual: ${value}, Alvo: ${target}`;
  }).join('\n');
  
  // Construir prompt
  return `
═══════════════════════════════════════════════════════════════════════════════
📊 DADOS DESTA ANÁLISE ESPECÍFICA
═══════════════════════════════════════════════════════════════════════════════

MÉTRICAS DETECTADAS:
- LUFS Integrado: ${analysisMetrics.lufsIntegrated ?? 'N/A'}
- True Peak: ${analysisMetrics.truePeakDbtp ?? 'N/A'} dBTP
- Dynamic Range: ${analysisMetrics.dynamicRange ?? 'N/A'} dB
- LRA: ${analysisMetrics.lra ?? 'N/A'} LU
- Crest Factor: ${analysisMetrics.crestFactor ?? 'N/A'}
- Stereo Correlation: ${analysisMetrics.stereoCorrelation ?? 'N/A'}

TARGETS DO GÊNERO (${userProfile.genre || userProfile.estilo || 'não informado'}):
- LUFS Target: ${genreTargets.lufs ?? genreContext.targetLufs ?? '-14'}
- True Peak Target: ${genreTargets.true_peak ?? genreContext.targetTp ?? '-1.0'}
- DR Target: ${genreTargets.dr ?? genreContext.targetDr ?? '8'}

PROBLEMAS DETECTADOS (ordenados por impacto):
${problemsText}

═══════════════════════════════════════════════════════════════════════════════
👤 PERFIL DO USUÁRIO
═══════════════════════════════════════════════════════════════════════════════

- DAW: ${userProfile.daw || 'Não informado'}
- Nível Técnico: ${userProfile.level || userProfile.nivelTecnico || 'Iniciante'}
- Gênero Musical: ${userProfile.genre || userProfile.estilo || 'Não informado'}
- Dificuldade Principal: ${userProfile.dificuldade || 'Não informado'}
- Plano SoundyAI: ${plan.toUpperCase()}

═══════════════════════════════════════════════════════════════════════════════
🎛️ CONTEXTO DA DAW: ${userProfile.daw || 'Genérico'}
═══════════════════════════════════════════════════════════════════════════════

PLUGINS RECOMENDADOS:
- Limiter: ${dawContext.limiter}
- EQ: ${dawContext.eq}
- Compressor: ${dawContext.compressor}
- Medidor: ${dawContext.meter}
- True Peak: ${dawContext.truePeakPlugin}

ARMADILHAS TÍPICAS DESTA DAW:
${dawContext.armadilhas.map(a => `• ${a}`).join('\n')}

DICA PARA ${levelKey.toUpperCase()}:
${dawContext.dicasNivel[levelKey]}

═══════════════════════════════════════════════════════════════════════════════
🎵 CONTEXTO DO GÊNERO: ${userProfile.genre || userProfile.estilo || 'Genérico'}
═══════════════════════════════════════════════════════════════════════════════

CARACTERÍSTICAS DO GÊNERO:
${genreContext.caracteristicas}

VÍCIOS COMUNS NESTE GÊNERO:
${genreContext.viciosComuns.map(v => `• ${v}`).join('\n')}

FOCO DE CORREÇÃO:
${genreContext.focoCorrecao}

═══════════════════════════════════════════════════════════════════════════════
👤 CONTEXTO DO NÍVEL: ${levelKey.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════

LINGUAGEM APROPRIADA:
${levelContext.linguagem}

ERROS COMUNS DESTE NÍVEL:
${levelContext.errosComuns.map(e => `• ${e}`).join('\n')}

FOCO DAS INSTRUÇÕES:
${levelContext.foco}

═══════════════════════════════════════════════════════════════════════════════
📝 INSTRUÇÃO FINAL
═══════════════════════════════════════════════════════════════════════════════

Gere o plano de correção no formato JSON especificado.
- Máximo ${plan === 'free' ? '3' : plan === 'plus' ? '6' : '8'} etapas
- Cada etapa DEVE referenciar problemas DESTA análise
- Valores de ajuste são INICIAIS, não finais
- OBRIGATÓRIO: cada etapa termina com condição de reanálise
- Linguagem adaptada para nível ${levelKey}
- Plugins específicos para ${userProfile.daw || 'DAW genérica'}

RESPONDA APENAS COM O JSON, SEM MARKDOWN OU EXPLICAÇÕES.
`.trim();
}

/**
 * Valida a resposta do GPT e normaliza o formato
 * @param {string|Object} response - Resposta da IA
 * @returns {Object} JSON normalizado ou erro
 */
export function validateAndParseResponse(response) {
  try {
    let parsed;
    
    if (typeof response === 'string') {
      // Remover possíveis blocos de código markdown
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } else {
      parsed = response;
    }
    
    // Validar estrutura mínima
    if (!parsed.intro || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Estrutura JSON inválida: faltam campos obrigatórios');
    }
    
    // Validar cada step
    for (const step of parsed.steps) {
      if (!step.number || !step.title || !step.impact || !step.how) {
        throw new Error(`Step ${step.number || '?'} inválido: faltam campos obrigatórios`);
      }
      
      // Garantir que impact está normalizado
      if (!['CRÍTICO', 'ALTO', 'FINO'].includes(step.impact)) {
        step.impact = 'ALTO'; // fallback
      }
      
      // Garantir que nextStepCondition existe
      if (!step.nextStepCondition) {
        step.nextStepCondition = 'Reanalisar no SoundyAI e verificar se a métrica melhorou antes de prosseguir.';
      }
    }
    
    // Garantir campos finais
    if (!parsed.reanalysisReminder) {
      parsed.reanalysisReminder = '⚠️ IMPORTANTE: Execute cada etapa individualmente e reanalize no SoundyAI antes de prosseguir para a próxima. Os ajustes finos dependem dos resultados de cada iteração.';
    }
    
    if (!parsed.finalNote) {
      parsed.finalNote = '🎯 Este plano é um guia iterativo. O resultado final depende de múltiplas reanálises no SoundyAI para ajustes precisos.';
    }
    
    return { success: true, data: parsed };
    
  } catch (error) {
    console.error('[CORRECTION-PLAN] Erro ao parsear resposta:', error.message);
    return { 
      success: false, 
      error: error.message,
      fallback: generateFallbackPlan()
    };
  }
}

/**
 * Gera um plano de fallback em caso de erro do GPT
 * @returns {Object} Plano básico
 */
function generateFallbackPlan() {
  return {
    intro: 'Vamos corrigir os problemas detectados na sua música de forma sistemática.',
    steps: [
      {
        number: 1,
        title: 'Verificar e Corrigir True Peak',
        impact: 'CRÍTICO',
        problemRef: {
          type: 'true_peak',
          currentValue: 'Verificar na análise',
          targetValue: '-1.0 dBTP'
        },
        why: 'True Peak acima de -1.0 dBTP causa distorção em conversores e plataformas de streaming.',
        how: [
          'Abrir o limiter no master',
          'Configurar Ceiling para -1.0 dBTP',
          'Ativar True Peak / Intersample Detection se disponível',
          'Verificar medidor de True Peak durante playback'
        ],
        dawSpecific: 'Use o limiter nativo da sua DAW com True Peak ativado.',
        avoidMistake: 'Não confunda sample peak com True Peak - são medidas diferentes.',
        verify: 'O medidor de True Peak não deve ultrapassar -1.0 dBTP em nenhum momento.',
        nextStepCondition: 'Reanalisar no SoundyAI e confirmar que True Peak está abaixo de -1.0 dBTP antes de prosseguir.'
      }
    ],
    reanalysisReminder: '⚠️ Reanalisar no SoundyAI após cada etapa é obrigatório para ajustes precisos.',
    finalNote: '🎯 Este é um plano básico. Para correções mais detalhadas, reanalize sua música no SoundyAI.'
  };
}

// Exportar constantes para uso externo
export { DAW_CONTEXT, GENRE_CONTEXT, LEVEL_CONTEXT };
