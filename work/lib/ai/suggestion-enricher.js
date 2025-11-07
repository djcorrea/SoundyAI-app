// 🔮 MÓDULO DE ENRIQUECIMENTO DE SUGESTÕES COM IA (ULTRA V2)
// Sistema avançado que transforma sugestões técnicas em insights detalhados

/**
 * 🤖 Enriquece sugestões técnicas com análise IA detalhada
 * 
 * @param {Array} suggestions - Sugestões base geradas pelo pipeline
 * @param {Object} context - Contexto adicional (genre, mode, métricas)
 * @returns {Array} - Sugestões enriquecidas com IA
 */
export async function enrichSuggestionsWithAI(suggestions, context = {}) {
  console.log('[AI-AUDIT][ULTRA_V2] 🚀 Iniciando enriquecimento de sugestões...');
  console.log('[AI-AUDIT][ULTRA_V2] Sugestões base recebidas:', suggestions.length);
  console.log('[AI-AUDIT][ULTRA_V2] Contexto:', {
    genre: context.genre,
    mode: context.mode,
    hasUserMetrics: !!context.userMetrics,
    hasReferenceMetrics: !!context.referenceMetrics,
    hasReferenceComparison: !!context.referenceComparison
  });

  // 🛡️ VALIDAÇÃO: Se não há API key, retornar sugestões base sem enriquecimento
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[AI-AUDIT][ULTRA_V2] ⚠️ OPENAI_API_KEY não configurada - retornando sugestões base');
    return suggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: 'api_key_missing'
    }));
  }

  // 🛡️ VALIDAÇÃO: Se não há sugestões, retornar array vazio
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    console.warn('[AI-AUDIT][ULTRA_V2] ⚠️ Nenhuma sugestão para enriquecer');
    return [];
  }

  try {
    // 📊 Preparar prompt para IA
    const prompt = buildEnrichmentPrompt(suggestions, context);
    
    console.log('[AI-AUDIT][ULTRA_V2] 📝 Prompt preparado (caracteres):', prompt.length);
    
    // 🤖 Chamar OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um engenheiro de áudio especialista em mixagem e masterização. Sua função é enriquecer sugestões técnicas com insights detalhados, identificando problemas, causas, soluções práticas e plugins recomendados.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-AUDIT][ULTRA_V2] ❌ OpenAI API erro:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[AI-AUDIT][ULTRA_V2] ❌ Resposta da API inválida:', data);
      throw new Error('Invalid OpenAI API response');
    }

    const content = data.choices[0].message.content;
    console.log('[AI-AUDIT][ULTRA_V2] ✅ Resposta recebida da IA (caracteres):', content.length);

    // 📦 Parse da resposta JSON
    let enrichedData;
    try {
      enrichedData = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI-AUDIT][ULTRA_V2] ❌ Erro ao fazer parse da resposta:', parseError.message);
      console.error('[AI-AUDIT][ULTRA_V2] Conteúdo:', content.substring(0, 500));
      throw new Error('Failed to parse AI response');
    }

    // 🔄 Mesclar sugestões base com enriquecimento IA
    const enrichedSuggestions = mergeSuggestionsWithAI(suggestions, enrichedData);

    console.log('[AI-AUDIT][ULTRA_V2] ✅ Enriquecimento concluído:', enrichedSuggestions.length, 'sugestões');
    console.log('[AI-AUDIT][ULTRA_V2] Tokens usados:', data.usage);

    return enrichedSuggestions;

  } catch (error) {
    console.error('[AI-AUDIT][ULTRA_V2] ❌ Erro no enriquecimento IA:', error.message);
    console.error('[AI-AUDIT][ULTRA_V2] Stack:', error.stack);
    
    // 🛡️ FALLBACK: Retornar sugestões base com flag de erro
    return suggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: 'error',
      enrichmentError: error.message
    }));
  }
}

/**
 * 📝 Constrói o prompt para enriquecimento IA
 */
function buildEnrichmentPrompt(suggestions, context) {
  const mode = context.mode || 'genre';
  const genre = context.genre || 'unknown';
  
  let prompt = `Você é um engenheiro de mixagem e masterização especialista em áudio profissional.  
Seu objetivo é **enriquecer e reescrever sugestões técnicas de análise de áudio** de forma detalhada, educativa e criativa, usando uma linguagem voltada a produtores musicais.

## 🎯 CONTEXTO DA ANÁLISE
- **Gênero Musical**: ${genre}
- **Modo de Análise**: ${mode}
`;

  if (mode === 'reference' && context.referenceComparison) {
    prompt += `- **Tipo**: Comparação A/B com faixa de referência\n`;
    prompt += `- **Faixa de Referência**: ${context.referenceFileName || 'Não especificada'}\n\n`;
    
    prompt += `### 📊 DELTAS DETECTADOS (User vs Reference)\n`;
    const rc = context.referenceComparison;
    if (rc.lufs) {
      prompt += `- **LUFS Integrado**: Sua faixa ${rc.lufs.user} dB vs Referência ${rc.lufs.reference} dB (diferença: ${rc.lufs.delta} dB)\n`;
    }
    if (rc.truePeak) {
      prompt += `- **True Peak**: Sua faixa ${rc.truePeak.user} dBTP vs Referência ${rc.truePeak.reference} dBTP (diferença: ${rc.truePeak.delta} dBTP)\n`;
    }
    if (rc.dynamics) {
      prompt += `- **Dynamic Range**: Sua faixa ${rc.dynamics.user} dB vs Referência ${rc.dynamics.reference} dB (diferença: ${rc.dynamics.delta} dB)\n`;
    }
  }

  // Adicionar métricas técnicas se disponíveis
  if (context.userMetrics) {
    prompt += `\n### 🔧 MÉTRICAS TÉCNICAS DETECTADAS\n`;
    const um = context.userMetrics;
    if (um.lufs) {
      prompt += `- **LUFS Integrado**: ${um.lufs.integrated} dB\n`;
    }
    if (um.truePeak) {
      prompt += `- **True Peak**: ${um.truePeak.maxDbtp} dBTP\n`;
    }
    if (um.dynamics) {
      prompt += `- **Dynamic Range**: ${um.dynamics.range} dB\n`;
    }
  }

  prompt += `\n## 📋 SUGESTÕES TÉCNICAS BASE\n`;
  prompt += '```json\n' + JSON.stringify(suggestions, null, 2) + '\n```\n';

  prompt += `\n## 🎯 SUA MISSÃO
A partir das sugestões base acima, você deve criar **versões enriquecidas e educativas**, transformando cada item técnico em um guia prático para o produtor musical.

### ⚙️ ESTRUTURA OBRIGATÓRIA DE SAÍDA
Retorne **um array JSON** com objetos neste formato EXATO:

\`\`\`json
{
  "enrichedSuggestions": [
    {
      "index": 0,
      "categoria": "LOUDNESS" | "MASTERING" | "DYNAMICS" | "STEREO" | "VOCAL" | "EQ" | "LOW END" | "MID" | "HIGH END",
      "nivel": "leve" | "média" | "crítica",
      "problema": "Descrição técnica direta do erro detectado",
      "causaProvavel": "Explicação detalhada da origem do problema",
      "solucao": "Instrução prática e objetiva de como resolver",
      "pluginRecomendado": "Exemplo real de plugin ou ferramenta útil",
      "dicaExtra": "Insight extra ou truque profissional sobre o tema",
      "parametros": "Sugestão de parâmetros específicos (opcional)"
    }
  ]
}
\`\`\`

### 🧩 REGRAS TÉCNICAS E DE ESTILO

1. **Termos Técnicos**: Use vocabulário profissional real (LUFS, dBTP, LRA, dinâmica, compressão paralela, sidechain, saturação, limiter, stereo field, phase issues etc).

2. **Tom Educativo**: Mantenha estilo "engenheiro mentor" — profissional mas acessível.

3. **Especificidade**: Cada sugestão deve ser rica em contexto técnico e específica (nada genérico).

4. **Plugins Reais**: Cite ferramentas populares (FabFilter, Waves, Slate Digital, UAD, iZotope, SSL, Klanghelm, PSP, T-Racks etc).

5. **Classificação de Criticidade**:
   - **Crítica**: LUFS < -18 dB, True Peak > -0.8 dBTP, LRA < 2 LU, phase issues severos
   - **Média**: Desvios moderados de padrões, EQ desequilibrado, compressão excessiva
   - **Leve**: Ajustes finos, otimizações, melhorias estéticas

6. **Categorias Corretas**: Atribua a categoria mais apropriada:
   - LOUDNESS: problemas de LUFS, volume geral
   - MASTERING: True Peak, limiter, finalização
   - DYNAMICS: compressão, LRA, punch
   - STEREO: imagem estéreo, phase, width
   - EQ: equalização, balanço espectral
   - LOW END / MID / HIGH END: problemas de frequência específicos

7. **Contexto do Gênero**: Adapte as recomendações ao estilo musical (${genre}):
   - Funk/Phonk: priorize low-end potente, kick e 808 limpos
   - EDM/House: foco em loudness, sidechain, stereo width
   - Hip-Hop/Trap: vocais claros, 808 controlado, hi-hats espaciais

8. **Parâmetros Práticos**: Quando relevante, sugira valores específicos:
   - "Threshold: -3dB, Ratio: 4:1, Attack: 10ms, Release: 100ms"
   - "Ceiling: -1.0 dBTP, Gain: +3dB"
   - "Q: 0.7, Frequency: 200Hz, Gain: -3dB"

### ⚠️ IMPORTANTE
- Mantenha a ordem das sugestões originais (use o campo \`index\`)
- Se dados técnicos estiverem ausentes, use experiência profissional para preencher com coerência
- Nunca invente métricas, mas preencha lacunas com análise contextual
- Retorne APENAS o JSON (sem markdown extras)

### 🎓 EXEMPLOS DE QUALIDADE

**Exemplo RUIM** (genérico):
\`\`\`json
{
  "problema": "LUFS baixo",
  "solucao": "Aumente o volume"
}
\`\`\`

**Exemplo BOM** (detalhado):
\`\`\`json
{
  "categoria": "LOUDNESS",
  "nivel": "crítica",
  "problema": "LUFS Integrado em -21.5 dB, muito abaixo do padrão ideal para streaming (-14 LUFS).",
  "causaProvavel": "Mixagem com baixo volume RMS e limiter inativo no bus master.",
  "solucao": "Aumente o loudness aplicando limiter no master e ajuste o gain até -14 LUFS.",
  "pluginRecomendado": "FabFilter Pro-L2, Waves L3, iZotope Ozone Maximizer",
  "dicaExtra": "Evite saturar o limiter — prefira punch limpo e preserve a dinâmica natural da batida.",
  "parametros": "Ceiling: -1.0 dBTP, Gain: ajustar até -14 LUFS, Lookahead: 10ms"
}
\`\`\`

Agora, processe as sugestões base e retorne o JSON enriquecido seguindo EXATAMENTE o formato especificado.`;

  return prompt;
}

/**
 * 🔄 Mescla sugestões base com dados enriquecidos pela IA
 */
function mergeSuggestionsWithAI(baseSuggestions, enrichedData) {
  if (!enrichedData || !enrichedData.enrichedSuggestions) {
    console.warn('[AI-AUDIT][ULTRA_V2] ⚠️ Dados enriquecidos inválidos - retornando sugestões base');
    return baseSuggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: 'invalid_data'
    }));
  }

  const aiSuggestions = enrichedData.enrichedSuggestions;

  return baseSuggestions.map((baseSug, index) => {
    const aiEnrichment = aiSuggestions.find(ai => ai.index === index) || aiSuggestions[index];

    if (!aiEnrichment) {
      console.warn(`[AI-AUDIT][ULTRA_V2] ⚠️ Sem enriquecimento para sugestão ${index}`);
      return {
        ...baseSug,
        aiEnhanced: false,
        enrichmentStatus: 'not_found'
      };
    }

    return {
      // 📦 Dados base (preservados)
      type: baseSug.type,
      message: baseSug.message,
      action: baseSug.action,
      priority: baseSug.priority,
      band: baseSug.band,
      isComparison: baseSug.isComparison,
      referenceValue: baseSug.referenceValue,
      userValue: baseSug.userValue,
      delta: baseSug.delta,
      
      // 🔮 Enriquecimento IA (novo formato)
      aiEnhanced: true,
      enrichmentStatus: 'success',
      
      // Campos do novo formato
      categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type, baseSug.category),
      nivel: aiEnrichment.nivel || mapPriorityToNivel(baseSug.priority),
      problema: aiEnrichment.problema || baseSug.message,
      causaProvavel: aiEnrichment.causaProvavel || 'Causa não especificada pela IA',
      solucao: aiEnrichment.solucao || baseSug.action,
      pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
      dicaExtra: aiEnrichment.dicaExtra || null,
      parametros: aiEnrichment.parametros || null,
      
      // 📊 Metadata
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: 'ULTRA_V2'
    };
  });
}

/**
 * 🗺️ Mapeia tipo/categoria base para categoria do novo formato
 */
function mapCategoryFromType(type, category) {
  const typeMap = {
    'loudness': 'LOUDNESS',
    'loudness_comparison': 'LOUDNESS',
    'clipping': 'MASTERING',
    'clipping_comparison': 'MASTERING',
    'truepeak_comparison': 'MASTERING',
    'dynamics': 'DYNAMICS',
    'dynamics_comparison': 'DYNAMICS',
    'eq': 'EQ',
    'eq_comparison': 'EQ',
    'stereo': 'STEREO',
    'vocal': 'VOCAL'
  };

  const categoryMap = {
    'Loudness': 'LOUDNESS',
    'Mastering': 'MASTERING',
    'Compressão / DR': 'DYNAMICS',
    'Equalização': 'EQ',
    'mastering': 'MASTERING',
    'loudness': 'LOUDNESS',
    'eq': 'EQ'
  };

  // Tentar mapear por tipo primeiro
  if (type && typeMap[type]) {
    return typeMap[type];
  }

  // Senão, tentar por categoria
  if (category && categoryMap[category]) {
    return categoryMap[category];
  }

  // Fallback
  return 'MASTERING';
}

/**
 * 🎯 Mapeia prioridade base para nível do novo formato
 */
function mapPriorityToNivel(priority) {
  const priorityMap = {
    'crítica': 'crítica',
    'alta': 'média',
    'média': 'média',
    'baixa': 'leve',
    'low': 'leve'
  };

  return priorityMap[priority] || 'média';
}
