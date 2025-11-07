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
    
    // 🛡️ VALIDAÇÃO CRÍTICA: Verificar estrutura da resposta
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Resposta da API inválida - estrutura incorreta');
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Data recebido:', JSON.stringify(data, null, 2));
      throw new Error('Invalid OpenAI API response structure');
    }

    const content = data.choices[0].message.content;
    
    // 🛡️ VALIDAÇÃO CRÍTICA: Conteúdo não pode estar vazio
    if (!content || content.trim().length === 0) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ CRÍTICO: Conteúdo vazio recebido da OpenAI!');
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Resposta completa:', JSON.stringify(data, null, 2));
      throw new Error('Empty AI response content - OpenAI retornou string vazia');
    }
    
    console.log('[AI-AUDIT][ULTRA_DIAG] 📝 Conteúdo da resposta:', {
      caracteres: content.length,
      primeiros200: content.substring(0, 200).replace(/\n/g, ' '),
      ultimos100: content.substring(content.length - 100).replace(/\n/g, ' ')
    });
    
    // 🔍 LOG CRÍTICO: Mostrar conteúdo COMPLETO para diagnóstico
    console.log('[AI-AUDIT][ULTRA_DIAG] 🧩 Conteúdo COMPLETO (pré-parse):');
    console.log(content.substring(0, 1000)); // Primeiros 1000 caracteres
    if (content.length > 1000) {
      console.log('[AI-AUDIT][ULTRA_DIAG] ... (truncado, total:', content.length, 'caracteres)');
    }

    // 📦 Parse da resposta JSON com validação robusta
    let enrichedData;
    try {
      console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 Fazendo parse da resposta JSON...');
      
      // 🛡️ PARSE ROBUSTO: Usar regex para extrair JSON mesmo que haja texto extra
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ CRÍTICO: Nenhum JSON válido encontrado no conteúdo!');
        console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Conteúdo recebido:', content.substring(0, 500));
        throw new Error('No valid JSON found in AI response (regex match failed)');
      }
      
      const jsonString = jsonMatch[0];
      console.log('[AI-AUDIT][ULTRA_DIAG] 🔍 JSON extraído via regex:', {
        caracteres: jsonString.length,
        inicio: jsonString.substring(0, 100).replace(/\n/g, ' ')
      });
      
      enrichedData = JSON.parse(jsonString);
      
      console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Parse JSON bem-sucedido!');
      console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Estrutura parseada:', {
        hasEnrichedSuggestions: !!enrichedData.enrichedSuggestions,
        isArray: Array.isArray(enrichedData.enrichedSuggestions),
        count: enrichedData.enrichedSuggestions?.length || 0,
        keys: Object.keys(enrichedData)
      });
      
      // 🔍 LOG CRÍTICO: Mostrar SAMPLE das sugestões parseadas
      if (enrichedData.enrichedSuggestions?.length > 0) {
        console.log('[AI-AUDIT][ULTRA_DIAG] 📋 Sample da primeira sugestão parseada:', {
          index: enrichedData.enrichedSuggestions[0].index,
          categoria: enrichedData.enrichedSuggestions[0].categoria,
          nivel: enrichedData.enrichedSuggestions[0].nivel,
          hasProblema: !!enrichedData.enrichedSuggestions[0].problema,
          hasSolucao: !!enrichedData.enrichedSuggestions[0].solucao,
          hasPlugin: !!enrichedData.enrichedSuggestions[0].pluginRecomendado
        });
      }
      
    } catch (parseError) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ ERRO CRÍTICO NO PARSE JSON ❌❌❌');
      console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('[AI-AUDIT][ULTRA_DIAG] 💥 Erro:', parseError.message);
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Conteúdo completo (primeiros 1000 chars):');
      console.error(content.substring(0, 1000));
      console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw new Error(`Failed to parse AI response JSON: ${parseError.message}`);
    }
    
    // 🛡️ VALIDAÇÃO: Garantir que há sugestões enriquecidas
    if (!enrichedData?.enrichedSuggestions || !Array.isArray(enrichedData.enrichedSuggestions)) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ CRÍTICO: enrichedSuggestions não é array válido!');
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Tipo:', typeof enrichedData?.enrichedSuggestions);
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Valor:', enrichedData?.enrichedSuggestions);
      throw new Error('enrichedSuggestions is not a valid array in AI response');
    }
    
    if (enrichedData.enrichedSuggestions.length === 0) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ CRÍTICO: OpenAI retornou array VAZIO de sugestões!');
      console.error('[AI-AUDIT][ULTRA_DIAG] ⚠️ Isso indica que o prompt pode estar mal formatado ou a IA falhou');
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Data completo:', JSON.stringify(enrichedData, null, 2));
      throw new Error('OpenAI returned empty enrichedSuggestions array');
    }
    
    console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Validação OK: enrichedSuggestions é array com', enrichedData.enrichedSuggestions.length, 'itens');

    // 🔄 Mesclar sugestões base com enriquecimento IA
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 Mesclando sugestões base com enriquecimento IA...');
    const enrichedSuggestions = mergeSuggestionsWithAI(suggestions, enrichedData);

    // 🛡️ VALIDAÇÃO FINAL CRÍTICA
    if (!Array.isArray(enrichedSuggestions)) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ ERRO FATAL: mergeSuggestionsWithAI não retornou array!');
      throw new Error('Merge function returned invalid data type');
    }
    
    if (enrichedSuggestions.length === 0) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ ERRO FATAL: Merge resultou em array vazio!');
      console.error('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base:', suggestions.length);
      console.error('[AI-AUDIT][ULTRA_DIAG] 📊 Dados IA:', enrichedData.enrichedSuggestions?.length);
      throw new Error('Merge resulted in empty array - check merge logic');
    }
    
    const aiEnhancedCount = enrichedSuggestions.filter(s => s.aiEnhanced === true).length;
    
    if (aiEnhancedCount === 0) {
      console.error('[AI-AUDIT][ULTRA_DIAG] ❌❌❌ ERRO FATAL: Nenhuma sugestão foi marcada como aiEnhanced!');
      console.error('[AI-AUDIT][ULTRA_DIAG] ⚠️ Frontend irá ignorar todas as sugestões!');
      throw new Error('No suggestions marked as aiEnhanced - frontend will ignore them');
    }

    console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AI-AUDIT][ULTRA_DIAG] ✅✅✅ ENRIQUECIMENTO CONCLUÍDO COM SUCESSO ✅✅✅');
    console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Total de sugestões enriquecidas:', enrichedSuggestions.length);
    console.log('[AI-AUDIT][ULTRA_DIAG] 🤖 Marcadas como aiEnhanced:', aiEnhancedCount, '/', enrichedSuggestions.length);
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Tokens consumidos:', data.usage?.total_tokens);
    console.log('[AI-AUDIT][ULTRA_DIAG] 📋 Sample da primeira sugestão final:', {
      type: enrichedSuggestions[0].type,
      aiEnhanced: enrichedSuggestions[0].aiEnhanced,
      categoria: enrichedSuggestions[0].categoria,
      nivel: enrichedSuggestions[0].nivel,
      hasProblema: !!enrichedSuggestions[0].problema,
      hasSolucao: !!enrichedSuggestions[0].solucao,
      hasPlugin: !!enrichedSuggestions[0].pluginRecomendado
    });
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
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 🔄 INICIANDO MERGE DE SUGESTÕES');
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base recebidas:', baseSuggestions.length);
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Dados IA recebidos:', enrichedData.enrichedSuggestions?.length || 0);
  
  if (!enrichedData || !enrichedData.enrichedSuggestions) {
    console.error('[AI-AUDIT][ULTRA_DIAG] ❌ CRÍTICO: Dados enriquecidos inválidos!');
    throw new Error('Invalid enrichedData structure in merge');
  }

  const aiSuggestions = enrichedData.enrichedSuggestions;
  let successCount = 0;
  let failCount = 0;

  const merged = baseSuggestions.map((baseSug, index) => {
    // 🔍 Buscar enriquecimento por index primeiro, senão por posição
    const aiEnrichment = aiSuggestions.find(ai => ai.index === index) || aiSuggestions[index];

    if (!aiEnrichment) {
      console.warn(`[AI-AUDIT][ULTRA_DIAG] ⚠️ Sem enriquecimento para sugestão ${index} - usando fallback`);
      failCount++;
      return {
        ...baseSug,
        aiEnhanced: false,
        enrichmentStatus: 'not_found',
        categoria: mapCategoryFromType(baseSug.type, baseSug.category),
        nivel: mapPriorityToNivel(baseSug.priority),
        problema: baseSug.message,
        causaProvavel: 'IA não forneceu análise para este item',
        solucao: baseSug.action,
        pluginRecomendado: 'Não especificado'
      };
    }

    successCount++;
    
    // 🔍 LOG: Detalhes do enriquecimento encontrado
    if (index === 0) {
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📋 Exemplo de enriquecimento (index ${index}):`, {
        temCategoria: !!aiEnrichment.categoria,
        temNivel: !!aiEnrichment.nivel,
        temProblema: !!aiEnrichment.problema,
        temCausa: !!aiEnrichment.causaProvavel,
        temSolucao: !!aiEnrichment.solucao,
        temPlugin: !!aiEnrichment.pluginRecomendado
      });
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
      
      // 🔮 Enriquecimento IA (novo formato) - SEMPRE MARCAR COMO ENHANCED
      aiEnhanced: true,
      enrichmentStatus: 'success',
      
      // Campos do novo formato com fallbacks seguros
      categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type, baseSug.category),
      nivel: aiEnrichment.nivel || mapPriorityToNivel(baseSug.priority),
      problema: aiEnrichment.problema || baseSug.message,
      causaProvavel: aiEnrichment.causaProvavel || 'Análise detalhada não fornecida',
      solucao: aiEnrichment.solucao || baseSug.action,
      pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
      dicaExtra: aiEnrichment.dicaExtra || null,
      parametros: aiEnrichment.parametros || null,
      
      // 📊 Metadata
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: 'ULTRA_V2'
    };
  });
  
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] ✅ MERGE CONCLUÍDO');
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Total de sugestões mescladas:', merged.length);
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Estatísticas detalhadas:', {
    totalMerged: merged.length,
    successfullyEnriched: successCount,
    failedToEnrich: failCount,
    aiEnhancedTrue: merged.filter(s => s.aiEnhanced === true).length,
    aiEnhancedFalse: merged.filter(s => s.aiEnhanced === false).length,
    withProblema: merged.filter(s => s.problema && s.problema !== '').length,
    withCausaProvavel: merged.filter(s => s.causaProvavel && !s.causaProvavel.includes('não fornecida')).length,
    withSolucao: merged.filter(s => s.solucao && s.solucao !== '').length,
    withPlugin: merged.filter(s => s.pluginRecomendado && s.pluginRecomendado !== 'Plugin não especificado').length,
    withDicaExtra: merged.filter(s => s.dicaExtra).length,
    withParametros: merged.filter(s => s.parametros).length
  });
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 🛡️ VALIDAÇÃO FINAL
  if (merged.length !== baseSuggestions.length) {
    console.error('[AI-AUDIT][ULTRA_DIAG] ❌ ERRO: Merge alterou número de sugestões!');
    throw new Error(`Merge count mismatch: expected ${baseSuggestions.length}, got ${merged.length}`);
  }
  
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
