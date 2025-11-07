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
  
  let prompt = `# ENRIQUECIMENTO DE SUGESTÕES DE MIXAGEM/MASTERIZAÇÃO

## CONTEXTO DA ANÁLISE
- **Modo**: ${mode}
- **Gênero**: ${genre}
`;

  if (mode === 'reference' && context.referenceComparison) {
    prompt += `- **Tipo**: Comparação A/B com faixa de referência\n`;
    prompt += `- **Referência**: ${context.referenceFileName || 'Não especificada'}\n\n`;
    
    prompt += `## DELTAS DETECTADOS (User vs Reference)\n`;
    const rc = context.referenceComparison;
    if (rc.lufs) {
      prompt += `- **LUFS**: User ${rc.lufs.user} dB vs Ref ${rc.lufs.reference} dB (delta: ${rc.lufs.delta} dB)\n`;
    }
    if (rc.truePeak) {
      prompt += `- **True Peak**: User ${rc.truePeak.user} dBTP vs Ref ${rc.truePeak.reference} dBTP (delta: ${rc.truePeak.delta} dBTP)\n`;
    }
    if (rc.dynamics) {
      prompt += `- **Dynamic Range**: User ${rc.dynamics.user} dB vs Ref ${rc.dynamics.reference} dB (delta: ${rc.dynamics.delta} dB)\n`;
    }
  }

  prompt += `\n## SUGESTÕES TÉCNICAS BASE\n`;
  prompt += JSON.stringify(suggestions, null, 2);

  prompt += `\n\n## TAREFA
Para CADA sugestão acima, gere um objeto JSON enriquecido com:

1. **problema**: Descrição técnica clara do problema detectado
2. **causa**: Causa provável técnica (ex: "compressão multibanda excessiva", "ceiling do limitador muito baixo")
3. **solucao**: Solução técnica específica e prática
4. **plugin**: Nome de plugin(s) recomendado(s) para resolver (ex: "FabFilter Pro-L2", "Waves SSL G-Master")
5. **dicaExtra**: Dica avançada de mixagem/masterização relacionada ao problema
6. **parametros**: Sugestão de parâmetros específicos (ex: "Threshold: -3dB, Ratio: 4:1")

## FORMATO DE SAÍDA
Retorne um objeto JSON com a estrutura:
{
  "enrichedSuggestions": [
    {
      "index": 0,
      "problema": "...",
      "causa": "...",
      "solucao": "...",
      "plugin": "...",
      "dicaExtra": "...",
      "parametros": "..."
    },
    ...
  ]
}

⚠️ IMPORTANTE:
- Mantenha a mesma ordem das sugestões originais
- Use linguagem técnica mas clara
- Seja específico em plugins e parâmetros
- Adapte as recomendações ao gênero musical quando relevante
`;

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
      // 📦 Dados base
      ...baseSug,
      
      // 🔮 Enriquecimento IA
      aiEnhanced: true,
      enrichmentStatus: 'success',
      problema: aiEnrichment.problema || baseSug.message,
      causa: aiEnrichment.causa || 'Causa não especificada',
      solucao: aiEnrichment.solucao || baseSug.action,
      plugin: aiEnrichment.plugin || 'Plugin não especificado',
      dicaExtra: aiEnrichment.dicaExtra || null,
      parametros: aiEnrichment.parametros || null,
      
      // 📊 Metadata
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: 'ULTRA_V2'
    };
  });
}
