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
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 🤖 INICIANDO ENRIQUECIMENTO COM IA');
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base recebidas:', suggestions.length);
  console.log('[AI-AUDIT][ULTRA_DIAG] 📦 Contexto recebido:', {
    genre: context.genre,
    mode: context.mode,
    hasUserMetrics: !!context.userMetrics,
    hasReferenceMetrics: !!context.referenceMetrics,
    hasReferenceComparison: !!context.referenceComparison,
    referenceFileName: context.referenceFileName
  });

  // 🛡️ VALIDAÇÃO: Se não há API key, retornar sugestões base sem enriquecimento
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ OPENAI_API_KEY não configurada - retornando sugestões base');
    console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Para ativar IA: configure OPENAI_API_KEY no arquivo .env');
    return suggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: 'api_key_missing'
    }));
  }

  // 🛡️ VALIDAÇÃO: Se não há sugestões, retornar array vazio
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Nenhuma sugestão para enriquecer - retornando array vazio');
    return [];
  }

  try {
    // 📊 Preparar prompt para IA
    const prompt = buildEnrichmentPrompt(suggestions, context);
    
    console.log('[AI-AUDIT][ULTRA_DIAG] 📝 Prompt preparado:', {
      caracteres: prompt.length,
      estimativaTokens: Math.ceil(prompt.length / 4)
    });
    
    // 🤖 Chamar OpenAI API
    console.log('[AI-AUDIT][ULTRA_DIAG] 🌐 Enviando requisição para OpenAI API...');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Modelo: gpt-4o-mini');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Temperature: 0.7');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Max tokens: 2000');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Timeout: 25 segundos');
    
    // ⏱️ Configurar timeout de 25 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    
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
        max_tokens: 2000
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌ OpenAI API erro:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Resposta recebida da OpenAI API');
    console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Tokens usados:', {
      prompt: data.usage?.prompt_tokens,
      completion: data.usage?.completion_tokens,
      total: data.usage?.total_tokens
    });
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Resposta da API inválida:', data);
      throw new Error('Invalid OpenAI API response');
    }

    const content = data.choices[0].message.content;
    console.log('[AI-AUDIT][ULTRA_DIAG] 📝 Conteúdo da resposta:', {
      caracteres: content.length,
      primeiros100: content.substring(0, 100) + '...'
    });

    // 📦 Parse da resposta JSON com regex fallback
    let enrichedData;
    try {
      console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 Fazendo parse da resposta JSON...');
      
      // 🛡️ PARSE ROBUSTO: Usar regex para extrair JSON mesmo que haja texto extra
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      
      enrichedData = JSON.parse(jsonString);
      
      console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Parse bem-sucedido:', {
        hasEnrichedSuggestions: !!enrichedData.enrichedSuggestions,
        count: enrichedData.enrichedSuggestions?.length || 0
      });
    } catch (parseError) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Erro ao fazer parse da resposta:', parseError.message);
      console.error('[AI-AUDIT][ULTRA_DIAG] Conteúdo (primeiros 500 chars):', content.substring(0, 500));
      throw new Error('Failed to parse AI response (provável texto fora do JSON)');
    }
    
    // 🛡️ VALIDAÇÃO: Garantir que há sugestões enriquecidas
    if (!enrichedData?.enrichedSuggestions?.length) {
      console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Nenhuma sugestão enriquecida recebida — retornando base com flag empty_response');
      return suggestions.map(sug => ({
        ...sug,
        aiEnhanced: false,
        enrichmentStatus: 'empty_response'
      }));
    }

    // 🔄 Mesclar sugestões base com enriquecimento IA
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 Mesclando sugestões base com enriquecimento IA...');
    const enrichedSuggestions = mergeSuggestionsWithAI(suggestions, enrichedData);

    console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AI-AUDIT][ULTRA_DIAG] ✅ ENRIQUECIMENTO CONCLUÍDO COM SUCESSO');
    console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Total de sugestões enriquecidas:', enrichedSuggestions.length);
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Tokens consumidos:', data.usage?.total_tokens);
    console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return enrichedSuggestions;

  } catch (error) {
    console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[AI-AUDIT][ULTRA_DIAG] ❌ ERRO NO ENRIQUECIMENTO IA');
    console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[AI-AUDIT][ULTRA_DIAG] 💥 Mensagem:', error.message);
    
    // 🛡️ Identificar tipo de erro específico
    if (error.name === 'AbortError') {
      console.error('[AI-AUDIT][ULTRA_DIAG] ⏱️ Tipo: Timeout (25s excedido)');
      console.error('[AI-AUDIT][ULTRA_DIAG] 💡 Solução: Reduzir número de sugestões ou aumentar timeout');
    } else if (error.message.includes('OpenAI API error')) {
      console.error('[AI-AUDIT][ULTRA_DIAG] 🌐 Tipo: Erro da API OpenAI');
    } else if (error.message.includes('Failed to parse')) {
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Tipo: Erro de parse JSON');
    }
    
    console.error('[AI-AUDIT][ULTRA_DIAG] 📍 Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
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
  console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 Iniciando merge de sugestões...');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base:', baseSuggestions.length);
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Dados enriquecidos:', enrichedData.enrichedSuggestions?.length || 0);
  
  if (!enrichedData || !enrichedData.enrichedSuggestions) {
    console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Dados enriquecidos inválidos - retornando sugestões base');
    return baseSuggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: 'invalid_data'
    }));
  }

  const aiSuggestions = enrichedData.enrichedSuggestions;

  const merged = baseSuggestions.map((baseSug, index) => {
    const aiEnrichment = aiSuggestions.find(ai => ai.index === index) || aiSuggestions[index];

    if (!aiEnrichment) {
      console.warn(`[AI-AUDIT][ULTRA_DIAG] ⚠️ Sem enriquecimento para sugestão ${index}`);
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
  
  console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Merge concluído:', merged.length, 'sugestões mescladas');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Estatísticas:', {
    aiEnhanced: merged.filter(s => s.aiEnhanced).length,
    notEnhanced: merged.filter(s => !s.aiEnhanced).length,
    withProblema: merged.filter(s => s.problema).length,
    withCausa: merged.filter(s => s.causaProvavel).length,
    withPlugin: merged.filter(s => s.pluginRecomendado && s.pluginRecomendado !== 'Plugin não especificado').length
  });
  
  return merged;
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
