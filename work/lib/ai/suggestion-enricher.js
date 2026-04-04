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
  const mode = context.mode || 'genre';
  const hasReferenceComparison = !!context.referenceComparison;
  
  // 🔧 CORREÇÃO: Remover whitelist — IA deve rodar em AMBOS os modos (genre + reference)
  console.log('[ENRICHER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[ENRICHER] 🤖 ENRIQUECIMENTO IA ATIVADO');
  console.log('[ENRICHER] mode=%s referenceComparison=%s', mode, hasReferenceComparison);
  console.log('[ENRICHER] ✅ IA habilitada para modo genre E reference');
  console.log('[ENRICHER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 🤖 INICIANDO ENRIQUECIMENTO COM IA');
  console.log('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base recebidas:', suggestions.length);
  
  // 🔍 AUDITORIA PONTO 4: Modo no enrich
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][REF] 🎯 ENRICHER RECEBEU:');
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][REF] Modo recebido:', context.mode);
  console.log('[AI-AUDIT][REF] referenceComparison presente:', !!context.referenceComparison);
  console.log('[AI-AUDIT][REF] Se false, O CONTEXTO FOI PERDIDO AQUI! ⚠️');
  console.log('[AI-AUDIT][REF] Contexto completo:', {
    genre: context.genre,
    mode: context.mode,
    hasUserMetrics: !!context.userMetrics,
    hasReferenceMetrics: !!context.referenceMetrics,
    hasReferenceComparison: !!context.referenceComparison,
    referenceComparisonKeys: Object.keys(context.referenceComparison || {}),
    referenceFileName: context.referenceFileName
  });
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
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
    // 🔧 CORREÇÃO FASE 2: Timeout dinâmico baseado no número de sugestões
    const numSuggestions = suggestions.length;
    const dynamicTimeout = Math.max(60000, Math.min(numSuggestions * 6000, 120000)); // Mínimo 60s, máximo 120s
    const dynamicMaxTokens = Math.min(1500 + (numSuggestions * 300), 6000); // Escala por sugestão, máximo 6000
    
    console.log('[AI-AUDIT][ULTRA_DIAG] 🌐 Enviando requisição para OpenAI API...');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Modelo: gpt-4o-mini');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Temperature: 0.7');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Max tokens: ' + dynamicMaxTokens + ' (dinâmico)');
    console.log('[AI-AUDIT][ULTRA_DIAG] 🔧 Timeout: ' + (dynamicTimeout/1000) + ' segundos (dinâmico)');
    console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões a processar: ' + numSuggestions);
    
    // ⏱️ Configurar timeout dinâmico
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), dynamicTimeout);
    
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
        max_tokens: dynamicMaxTokens
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
      
      // 🛡️ CORREÇÃO FASE 2: PARSE ROBUSTO com múltiplas estratégias
      let jsonString = null;
      
      // ESTRATÉGIA 1: Tentar match de JSON completo
      const fullMatch = content.match(/\{[\s\S]*\}/);
      if (fullMatch) {
        jsonString = fullMatch[0];
        console.log('[AI-AUDIT][ULTRA_DIAG] ✅ JSON extraído via regex (estratégia 1)');
      }
      
      // ESTRATÉGIA 2: Se não encontrou, tentar extrair entre ```json e ```
      if (!jsonString) {
        const codeBlockMatch = content.match(/```(?:json)?([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1].trim();
          console.log('[AI-AUDIT][ULTRA_DIAG] ✅ JSON extraído de code block (estratégia 2)');
        }
      }
      
      // ESTRATÉGIA 3: Se ainda não encontrou, tentar content direto
      if (!jsonString) {
        console.warn('[AI-AUDIT][ULTRA_DIAG] ⚠️ Tentando parse direto do content');
        jsonString = content.trim();
      }
      
      if (!jsonString) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ CRÍTICO: Nenhum JSON válido encontrado no conteúdo!');
        console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Conteúdo recebido:', content.substring(0, 500));
        throw new Error('No valid JSON found in AI response (all strategies failed)');
      }
      
      console.log('[AI-AUDIT][ULTRA_DIAG] 🔍 JSON extraído:', {
        caracteres: jsonString.length,
        inicio: jsonString.substring(0, 100).replace(/\n/g, ' ')
      });
      
      // 🛡️ PARSE com tratamento de erros
      try {
        enrichedData = JSON.parse(jsonString);
      } catch (parseErr) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Parse falhou, tentando limpar JSON...');
        
        // ESTRATÉGIA 4: Tentar limpar caracteres problemáticos
        const cleanedJson = jsonString
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .trim();
        
        try {
          enrichedData = JSON.parse(cleanedJson);
          console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Parse bem-sucedido após limpeza!');
        } catch (cleanErr) {
          console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Parse falhou mesmo após limpeza');
          console.error('[AI-AUDIT][ULTRA_DIAG] JSON problemático:', jsonString.substring(0, 300));
          throw parseErr; // Lançar erro original
        }
      }
      
      console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Parse JSON bem-sucedido!');
      
      // 🛡️ CORREÇÃO FASE 2: VALIDAÇÃO DE SCHEMA COMPLETA
      console.log('[AI-AUDIT][ULTRA_DIAG] 🔍 Validando schema do JSON parseado...');
      
      // Validação 1: Estrutura raiz
      if (!enrichedData || typeof enrichedData !== 'object') {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Schema inválido: não é objeto');
        throw new Error('Parsed data is not an object');
      }
      
      // Validação 2: Campo enrichedSuggestions existe
      if (!enrichedData.enrichedSuggestions) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Schema inválido: campo "enrichedSuggestions" ausente');
        console.error('[AI-AUDIT][ULTRA_DIAG] Campos encontrados:', Object.keys(enrichedData));
        throw new Error('Missing "enrichedSuggestions" field in AI response');
      }
      
      // Validação 3: enrichedSuggestions é array
      if (!Array.isArray(enrichedData.enrichedSuggestions)) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Schema inválido: "enrichedSuggestions" não é array');
        console.error('[AI-AUDIT][ULTRA_DIAG] Tipo:', typeof enrichedData.enrichedSuggestions);
        throw new Error('Field "enrichedSuggestions" is not an array');
      }
      
      // Validação 4: Array não está vazio
      if (enrichedData.enrichedSuggestions.length === 0) {
        console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Schema inválido: array "enrichedSuggestions" está vazio');
        throw new Error('Array "enrichedSuggestions" is empty');
      }
      
      // Validação 5: Cada sugestão tem campos obrigatórios
      const requiredFields = ['categoria', 'nivel', 'problema', 'solucao'];
      enrichedData.enrichedSuggestions.forEach((sug, idx) => {
        const missingFields = requiredFields.filter(field => !sug[field]);
        if (missingFields.length > 0) {
          console.warn(`[AI-AUDIT][ULTRA_DIAG] ⚠️ Sugestão ${idx} com campos faltando:`, missingFields);
        }
      });
      
      console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Validação de schema COMPLETA!');
      console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Estrutura parseada:', {
        hasEnrichedSuggestions: true,
        isArray: true,
        count: enrichedData.enrichedSuggestions.length,
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
    
    // 🔄 CORREÇÃO FASE 2: Retry automático para AbortError
    if (error.name === 'AbortError') {
      console.error('[AI-AUDIT][ULTRA_DIAG] ⏱️ Tipo: Timeout (AbortError)');
      console.error('[AI-AUDIT][ULTRA_DIAG] 🔄 Iniciando retry automático...');
      
      // Tentar 3 vezes com timeout crescente
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const retryTimeout = 60000 + (attempt * 30000); // 60s, 90s, 120s
          console.log(`[AI-AUDIT][ULTRA_DIAG] 🔄 Tentativa ${attempt}/3 com timeout de ${retryTimeout/1000}s...`);
          
          const retryController = new AbortController();
          const retryTimer = setTimeout(() => retryController.abort(), retryTimeout);
          
          const retryPrompt = buildEnrichmentPrompt(suggestions, context);
          const retryMaxTokens = Math.min(1500 + (suggestions.length * 300), 6000);
          
          const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  content: retryPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: retryMaxTokens
            }),
            signal: retryController.signal
          }).finally(() => clearTimeout(retryTimer));
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryContent = retryData.choices[0].message.content;
            const jsonMatch = retryContent.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const enrichedData = JSON.parse(jsonMatch[0]);
              
              if (enrichedData.enrichedSuggestions && enrichedData.enrichedSuggestions.length > 0) {
                console.log(`[AI-AUDIT][ULTRA_DIAG] ✅ Retry ${attempt} SUCESSO!`);
                const merged = mergeSuggestionsWithAI(suggestions, enrichedData);
                return merged;
              }
            }
          }
        } catch (retryError) {
          console.warn(`[AI-AUDIT][ULTRA_DIAG] ⚠️ Retry ${attempt} falhou:`, retryError.message);
          if (attempt === 3) {
            console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Todas as 3 tentativas falharam');
          }
        }
      }
      
      console.error('[AI-AUDIT][ULTRA_DIAG] 💡 Solução: Timeout excedido mesmo após retries');
    } else if (error.message.includes('OpenAI API error')) {
      console.error('[AI-AUDIT][ULTRA_DIAG] 🌐 Tipo: Erro da API OpenAI');
    } else if (error.message.includes('Failed to parse')) {
      console.error('[AI-AUDIT][ULTRA_DIAG] 📦 Tipo: Erro de parse JSON');
    }
    
    console.error('[AI-AUDIT][ULTRA_DIAG] 📍 Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    console.error('[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🛡️ FALLBACK MELHORADO: Retornar sugestões base com fallback consistente
    return suggestions.map(sug => ({
      ...sug,
      aiEnhanced: false,
      enrichmentStatus: error.name === 'AbortError' ? 'timeout' : 'error',
      enrichmentError: error.message,
      categoria: mapCategoryFromType(sug.type, sug.category),
      nivel: mapPriorityToNivel(sug.priority),
      problema: sug.message || 'Problema não identificado',
      causaProvavel: 'Enriquecimento IA não disponível (timeout ou erro)',
      solucao: sug.action || 'Consulte métricas técnicas',
      pluginRecomendado: 'Plugin não especificado',
      dicaExtra: null,
      parametros: null
    }));
  }
}

/**
 * 📝 Constrói o prompt para enriquecimento IA
 */
function buildEnrichmentPrompt(suggestions, context) {
  const mode = context.mode || 'genre';
  const genre = context.genre || 'unknown';
  
  // 🔍 AUDITORIA PONTO 5: Modo dentro do buildPrompt
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][REF] 📝 buildEnrichmentPrompt EXECUTANDO:');
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI-AUDIT][REF] Mode detectado:', mode);
  console.log('[AI-AUDIT][REF] referenceComparison presente no context:', !!context.referenceComparison);
  console.log('[AI-AUDIT][REF] Entrará no bloco "if (mode === reference)"?', mode === 'reference' && !!context.referenceComparison);
  console.log('[AI-AUDIT][REF] Se NÃO entrar, modo será tratado como GENRE! ⚠️');
  console.log('[AI-AUDIT][REF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let prompt = `Você é um engenheiro de mixagem e masterização especialista em áudio profissional.  
Seu objetivo é **enriquecer e reescrever sugestões técnicas de análise de áudio** de forma detalhada, educativa e criativa, usando uma linguagem voltada a produtores musicais.

## 🎯 CONTEXTO DA ANÁLISE
- **Gênero Musical**: ${genre}
- **Modo de Análise**: ${mode}
`;

  // 🎯 CORREÇÃO FASE 2: Incluir targets do gênero no prompt (ESTRUTURA CORRIGIDA)
  if (context.customTargets) {
    prompt += `\n### 🎯 TARGETS DO GÊNERO (${genre.toUpperCase()})\n`;
    const targets = context.customTargets;
    
    console.log('[ENRICHER-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[ENRICHER-AUDIT] customTargets recebido:', {
      hasLufs: !!targets.lufs,
      hasTruePeak: !!targets.truePeak,
      hasDr: !!targets.dr,
      hasBands: !!targets.bands,
      keys: Object.keys(targets)
    });
    console.log('[ENRICHER-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // ✅ SSOT v2: Usar APENAS min/max oficiais - NUNCA calcular target±tolerance
    
    // LUFS
    if (targets.lufs) {
      if (typeof targets.lufs.min === 'number' && typeof targets.lufs.max === 'number') {
        prompt += `- **LUFS**: Range oficial ${targets.lufs.min.toFixed(1)} a ${targets.lufs.max.toFixed(1)} dB`;
        if (targets.lufs.target !== undefined) {
          prompt += ` (ideal: ${targets.lufs.target.toFixed(1)} dB)\n`;
        } else {
          prompt += `\n`;
        }
      }
      // 🔴 LEGACY REMOVIDO: Não enviar range calculado para IA
    }
    
    // TRUE PEAK — semântica de teto (ceiling), não range
    if (targets.truePeak) {
      const tpCeiling = typeof targets.truePeak.max === 'number' ? targets.truePeak.max : -1.0;
      prompt += `- **True Peak**: Teto obrigatório ≤ ${tpCeiling.toFixed(1)} dBTP (qualquer valor acima é inaceitável para masterização)\n`;
      if (targets.truePeak.target !== undefined) {
        prompt += `  → Valor médio do gênero: ${targets.truePeak.target.toFixed(1)} dBTP\n`;
      }
    }
    
    // DYNAMIC RANGE
    if (targets.dr) {
      if (typeof targets.dr.min === 'number' && typeof targets.dr.max === 'number') {
        prompt += `- **Dynamic Range**: Range oficial ${targets.dr.min.toFixed(1)} a ${targets.dr.max.toFixed(1)} dB`;
        if (targets.dr.target !== undefined) {
          prompt += ` (ideal: ${targets.dr.target.toFixed(1)} dB)\n`;
        } else {
          prompt += `\n`;
        }
      }
      // 🔴 LEGACY REMOVIDO: Não enviar range calculado para IA
    }
    
    if (targets.bands) {
      prompt += `\n#### 🎶 Bandas Espectrais:\n`;
      const bandLabels = {
        sub: 'Sub (20-60Hz)',
        bass: 'Low Bass (60-120Hz)',
        lowMid: 'Low Mid (250-500Hz)',
        mid: 'Mid (500Hz-2kHz)',
        highMid: 'High Mid (2-4kHz)',
        presenca: 'Presence (4-6kHz)',
        brilho: 'Brilliance (6-20kHz)'
      };
      
      Object.entries(targets.bands).forEach(([band, data]) => {
        const label = bandLabels[band] || band;
        
        // ✅ PATCH RANGE-MIGRATION: Priorizar min/max diretos, depois target_range, depois calcular
        
        // PRIORIDADE 1: min/max diretos (NOVO FORMATO)
        if (typeof data.min === 'number' && typeof data.max === 'number') {
          prompt += `  - **${label}**: Range oficial ${data.min.toFixed(1)} a ${data.max.toFixed(1)} dB\n`;
          if (data.target_db !== undefined || data.target !== undefined) {
            const target = data.target_db || data.target;
            prompt += `    → Target ideal: ${target.toFixed(1)} dB\n`;
          }
          prompt += `    → Use o RANGE OFICIAL como referência principal.\n`;
        } 
        // PRIORIDADE 2: target_range (BANDAS)
        else if (data.target_range && data.target_range.min !== undefined && data.target_range.max !== undefined) {
          prompt += `  - **${label}**: Range oficial ${data.target_range.min.toFixed(1)} a ${data.target_range.max.toFixed(1)} dB\n`;
          if (data.target_db !== undefined) {
            prompt += `    → Target ideal: ${data.target_db.toFixed(1)} dB\n`;
          }
          prompt += `    → Use o RANGE OFICIAL como referência principal.\n`;
        }
        // 🔴 LEGACY REMOVIDO: Não enviar ranges calculados (target±tolerance) para IA
      });
    }
    
    prompt += `\n**IMPORTANTE**: Use esses targets como referência OBRIGATÓRIA ao avaliar deltas e severidade dos problemas.\n`;
    prompt += `**NUNCA INVENTE valores ou use defaults genéricos - USE APENAS OS VALORES ACIMA.**\n`;
  }

  if (mode === 'reference' && context.referenceComparison) {
    console.log('[AI-AUDIT][REF] ✅ ENTRANDO NO BLOCO DE MODO REFERENCE!');
    console.log('[AI-AUDIT][REF] Adicionando instruções comparativas A/B ao prompt...');
    
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
    
    // ✅ BLOCO DE INSTRUÇÃO CRÍTICA PARA MODO COMPARAÇÃO A/B
    prompt += `\n### 🎧 MODO COMPARAÇÃO A/B - INSTRUÇÕES CRÍTICAS\n\n`;
    prompt += `Você está analisando uma **comparação técnica A/B** entre:\n`;
    prompt += `- **Faixa A (User)**: Faixa do produtor que precisa ser otimizada\n`;
    prompt += `- **Faixa B (Reference)**: Faixa profissional usada como padrão de qualidade\n\n`;

    prompt += `**SUA MISSÃO PRINCIPAL:**\n`;
    prompt += `1. Identificar as **diferenças técnicas** entre as duas faixas usando os deltas acima\n`;
    prompt += `2. Gerar sugestões **específicas** que aproximem a mixagem do usuário da referência\n`;
    prompt += `3. Para CADA delta significativo (>0.5 unidades), explicar:\n`;
    prompt += `   - O que a diferença significa tecnicamente\n`;
    prompt += `   - Por que isso aconteceu (causa provável)\n`;
    prompt += `   - Como corrigir para igualar a referência (solução)\n`;
    prompt += `   - Quais ferramentas usar (plugins recomendados)\n`;
    prompt += `   - Parâmetros específicos para aplicar\n\n`;

    prompt += `**INTERPRETAÇÃO DOS DELTAS:**\n`;

    if (rc.lufs) {
      const delta = parseFloat(rc.lufs.delta);
      if (delta < -0.5) {
        prompt += `- 🔊 **LUFS**: Sua faixa está ${Math.abs(delta).toFixed(1)} dB **mais baixa** que a referência → **Precisa aumentar loudness** (aplicar limiter no master)\n`;
      } else if (delta > 0.5) {
        prompt += `- 🔊 **LUFS**: Sua faixa está ${delta.toFixed(1)} dB **mais alta** que a referência → **Precisa reduzir loudness** (baixar gain do limiter)\n`;
      }
    }

    if (rc.dynamics) {
      const delta = parseFloat(rc.dynamics.delta);
      if (delta > 0.5) {
        prompt += `- 🎭 **Dynamic Range**: Sua faixa tem ${delta.toFixed(1)} dB **mais dinâmica** que a referência → **Precisa comprimir mais** para igualar punch e consistência\n`;
      } else if (delta < -0.5) {
        prompt += `- 🎭 **Dynamic Range**: Sua faixa tem ${Math.abs(delta).toFixed(1)} dB **menos dinâmica** → **Compressão excessiva**, reduza ratio ou threshold\n`;
      }
    }

    if (rc.truePeak) {
      const delta = parseFloat(rc.truePeak.delta);
      if (delta < -0.5) {
        prompt += `- 🎚️ **True Peak**: Sua faixa tem ${Math.abs(delta).toFixed(1)} dBTP de **margem adicional** → Pode aumentar limiter ceiling para igualar referência\n`;
      }
    }

    prompt += `\n**CONTEXTO COMPARATIVO OBRIGATÓRIO:**\n`;
    prompt += `- Toda sugestão deve referenciar explicitamente a faixa de referência\n`;
    prompt += `- Use frases como "comparado à referência", "para igualar a referência", "aproximar do padrão da referência"\n`;
    prompt += `- Priorize sugestões pelos maiores deltas (maior diferença = maior prioridade)\n`;
    prompt += `- O objetivo é **aproximar da referência**, não perfeição absoluta\n\n`;
    
    console.log("[AI-AUDIT][COMPARISON-PROMPT] 🔍 Prompt do modo reference preparado com instruções A/B detalhadas");
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

### 🚨 REGRAS CRÍTICAS DE VALORES NUMÉRICOS (PRIORIDADE MÁXIMA)

**VOCÊ ESTÁ PROIBIDO DE INVENTAR, MODIFICAR OU USAR VALORES PADRÃO.**

**QUANDO OS TARGETS DO GÊNERO SÃO FORNECIDOS ACIMA**:
1. ✅ **USE APENAS** os valores de \`target_range\` e \`target_db\` listados acima
2. ✅ **CITE** os valores EXATOS em seus textos (problema, causaProvavel, solucao)
3. ✅ **NUNCA** use valores genéricos como "0 dB", "-14 dB padrão", "range universal"
4. ✅ **NUNCA** invente ranges se não foram fornecidos - use apenas os listados acima

**QUANDO UMA SUGESTÃO BASE CONTÉM**:
- \`currentValue\`: **OBRIGATÓRIO** citar este valor exato no campo \`problema\`
- \`delta\`: **OBRIGATÓRIO** citar este delta exato no campo \`problema\` ou \`causaProvavel\`
- \`targetRange\`: **OBRIGATÓRIO** citar este range exato no campo \`problema\`

**EXEMPLO CORRETO (usando valores fornecidos acima)**:
Se target_range para low_bass é \`-31 a -25 dB\` e currentValue é \`-20 dB\`:
✅ "Low Bass está em -20 dB, enquanto o range adequado é -31 a -25 dB, ficando +5 dB acima do limite máximo."

**EXEMPLO PROIBIDO (inventando valores)**:
❌ "Low Bass está muito alto, deveria estar em torno de -28 dB" (de onde veio -28 dB?)
❌ "Range ideal é entre -30 e -24 dB" (os targets acima dizem -31 a -25!)
❌ "True Peak deveria estar em 0 dB" (os targets acima dizem -1 dBTP!)

**SE VOCÊ USAR QUALQUER VALOR QUE NÃO ESTEJA LISTADO ACIMA, SUA RESPOSTA SERÁ REJEITADA.**

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

### 🔒 NUMERIC LOCK - PROIBIÇÕES ABSOLUTAS

**VOCÊ É UM MOTOR DE ANÁLISE TEXTUAL. VOCÊ NÃO TEM AUTORIZAÇÃO PARA CALCULAR OU RETORNAR VALORES NUMÉRICOS.**

**❌ NUNCA RETORNE ESTES CAMPOS NO JSON:**
- \`currentValue\` (já fornecido na base)
- \`targetRange\` (já fornecido na base)
- \`targetMin\` (já fornecido na base)
- \`targetMax\` (já fornecido na base)
- \`delta\` (já fornecido na base)
- \`deviationRatio\` (já fornecido na base)
- \`referenceValue\` (já fornecido na base)
- \`userValue\` (já fornecido na base)

**✅ VOCÊ PODE MENCIONAR esses valores NOS TEXTOS (problema, causaProvavel, solucao), mas NUNCA como campos separados.**

**Exemplo CORRETO:**
- ✅ \`"problema": "LUFS em -12.5 dB está +2.5 dB acima do target máximo de -15 dB"\`

**Exemplo PROIBIDO:**
- ❌ \`"currentValue": "-12.5 dB"\` ← NUNCA FAÇA ISSO
- ❌ \`"targetRange": "-18 a -15 dB"\` ← NUNCA FAÇA ISSO
- ❌ \`"delta": "+2.5 dB"\` ← NUNCA FAÇA ISSO

**Se você retornar qualquer campo numérico, sua resposta será REJEITADA e descartada.**

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

### ⚖️ COERÊNCIA NUMÉRICA OBRIGATÓRIA

**🚨 VOCÊ É O MOTOR TÉCNICO DE DIAGNÓSTICOS - NÃO ESTÁ AUTORIZADO A MODIFICAR VALORES**

**REGRAS ABSOLUTAS QUE VOCÊ DEVE SEGUIR**:

1. **OBRIGATÓRIO**: SEMPRE cite o \`currentValue\` EXATO no campo \`problema\`
2. **OBRIGATÓRIO**: SEMPRE cite o \`delta\` EXATO no campo \`problema\` ou \`causaProvavel\`
3. **OBRIGATÓRIO**: SEMPRE cite o \`targetRange\` COMPLETO quando fornecido (ex: "-30 a -22 dB")
4. **NUNCA arredonde, NUNCA invente, NUNCA suavize valores numéricos**
5. **NUNCA use palavras genéricas como "ok", "parece bom", "talvez" quando há um delta ≠ 0**

**ANÁLISE NUMÉRICA (LEI IMUTÁVEL)**:

- Se \`delta\` é POSITIVO (+X dB): "está **X dB acima** do limite máximo"
- Se \`delta\` é NEGATIVO (-X dB): "está **X dB abaixo** do limite mínimo"
- Se \`delta\` é ZERO (≤ 0.05 dB): "está dentro do range permitido"

**FORMATO OBRIGATÓRIO NO CAMPO "problema"**:
"[Banda] está em [currentValue] dB, enquanto o range adequado é [targetRange], ficando [delta] dB [acima/abaixo] do limite [máximo/mínimo]."

**Exemplo CORRETO**:
"Sub (20-60Hz) está em -20.0 dB, enquanto o range adequado para o gênero é -30 a -22 dB, ficando 2.0 dB acima do limite máximo (-22 dB)."

**Exemplos PROIBIDOS** (você DEVE rejeitar automaticamente):
❌ "Sub está ok" (quando delta ≠ 0)
❌ "Sub está fora do range" (quando delta = 0)
❌ "Sub está em -20 dB quando deveria estar em -26 dB" (ignorou targetRange)
❌ "Reduza um pouco" (quando delta = +2.0 dB - DEVE dizer "Reduza aproximadamente 2.0 dB")

**VALIDAÇÃO ANTI-ERRO**:
- Você DEVE usar obrigatoriamente: \${currentValue}, \${delta}, \${targetRange}
- Se detectar violação, REESCREVA imediatamente
- A quantidade sugerida no campo \`solucao\` deve SEMPRE ser coerente com o \`delta\`
  - Exemplo: delta = +0.4 dB → solução = "Reduza cerca de 0.5 dB"
  - Exemplo: delta = -3.2 dB → solução = "Aumente cerca de 3 dB"
- NUNCA invente valores — use EXATAMENTE os valores fornecidos nos dados base
- Se a sugestão base já tem um bom \`action\`, você pode EXPANDIR mas NÃO CONTRADIZER

### 🎓 EXEMPLOS DE QUALIDADE

**Exemplo RUIM** (genérico):
\`\`\`json
{
  "problema": "LUFS baixo",
  "solucao": "Aumente o volume"
}
\`\`\`

**Exemplo BOM** (detalhado e coerente):
\`\`\`json
{
  "categoria": "LOUDNESS",
  "nivel": "crítica",
  "problema": "LUFS Integrado em -21.5 dB, 7.5 dB abaixo do máximo permitido (-14 dB).",
  "causaProvavel": "Mixagem com baixo volume RMS e limiter inativo no bus master. Delta de -7.5 dB indica áudio muito baixo.",
  "solucao": "Aumente o loudness em aproximadamente 8 dB aplicando limiter no master até alcançar -14 LUFS.",
  "pluginRecomendado": "FabFilter Pro-L2, Waves L3, iZotope Ozone Maximizer",
  "dicaExtra": "Evite saturar o limiter — prefira punch limpo e preserve a dinâmica natural da batida.",
  "parametros": "Ceiling: -1.0 dBTP, Gain: ajustar até -14 LUFS, Lookahead: 10ms"
}
\`\`\`

Agora, processe as sugestões base e retorne o JSON enriquecido seguindo EXATAMENTE o formato especificado e as regras de coerência numérica.`;

  return prompt;
}

/**
 * 🔍 Extrai todos os números de um texto (int ou float)
 * Exemplos: "Reduza 2.5 dB" → [2.5], "Entre -8.5 e -6.5" → [-8.5, -6.5]
 */
function extractNumbers(text) {
  if (!text || typeof text !== 'string') return [];
  // Pattern: captura números negativos/positivos, inteiros ou decimais
  const matches = text.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(n => parseFloat(n)) : [];
}

/**
 * 🎯 Encontra o número mais próximo de um target
 * Exemplo: numbers=[2.0, 3.5, 8.0], target=2.3 → retorna 2.0
 */
function findClosest(numbers, target) {
  if (!numbers || numbers.length === 0) return null;
  return numbers.reduce((prev, curr) => 
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
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
    
    console.log('[GENRE-FLOW][S3_AI_ENRICH_BEFORE]', {
      metric: baseSug.metric || baseSug.type,
      currentValue: baseSug.currentValue,
      targetValue: baseSug.targetValue,
      delta: baseSug.delta,
      deltaNum: baseSug.deltaNum
    });
    
    console.log('[GENRE-FLOW][S3_AI_ENRICH_AI]', {
      metric: baseSug.metric || baseSug.type,
      aiCategoria: aiEnrichment?.categoria,
      aiNivel: aiEnrichment?.nivel,
      aiProblema: aiEnrichment?.problema,
      aiSolucao: aiEnrichment?.solucao,
      aiRaw: aiEnrichment
    });
    
    // 🛡️ VALIDAÇÃO PÓS-IA: Verificar coerência numérica
    const validation = validateAICoherence(baseSug, aiEnrichment);
    if (!validation.isCoherent) {
      console.warn(`[AI-AUDIT][VALIDATION] ⚠️ Incoerência detectada na sugestão ${index}:`, validation.issues);
      // Forçar uso de dados base se IA for incoerente
      return {
        ...baseSug,
        aiEnhanced: true,
        enrichmentStatus: 'incoherent_fallback',
        categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type, baseSug.category),
        nivel: aiEnrichment.nivel || mapPriorityToNivel(baseSug.priority),
        problema: baseSug.message,  // ← Usar base, não IA
        causaProvavel: aiEnrichment.causaProvavel || 'Análise detalhada não fornecida',
        solucao: baseSug.action,    // ← Usar base, não IA
        pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
        dicaExtra: aiEnrichment.dicaExtra || null,
        parametros: aiEnrichment.parametros || null,
        validationIssues: validation.issues
      };
    }
    
    // 🔍 LOG: Detalhes do enriquecimento encontrado
    if (index === 0) {
      console.log(`[AI-AUDIT][ULTRA_DIAG] 📋 Exemplo de enriquecimento (index ${index}):`, {
        temCategoria: !!aiEnrichment.categoria,
        temNivel: !!aiEnrichment.nivel,
        temProblema: !!aiEnrichment.problema,
        temCausa: !!aiEnrichment.causaProvavel,
        temSolucao: !!aiEnrichment.solucao,
        temPlugin: !!aiEnrichment.pluginRecomendado,
        validationPassed: true
      });
    }

    const merged = {
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
      
      // 🔒 NUMERIC LOCK - Campos numéricos SEMPRE preservados do base
      currentValue: baseSug.currentValue,
      targetRange: baseSug.targetRange,
      targetValue: baseSug.targetValue,  // ✅ Preservar targetValue
      targetMin: baseSug.targetMin,
      targetMax: baseSug.targetMax,
      deviationRatio: baseSug.deviationRatio,
      
      // 🔮 Enriquecimento IA (novo formato) - SEMPRE MARCAR COMO ENHANCED
      aiEnhanced: true,
      enrichmentStatus: 'success',
      
      // 🔒 NUMERIC LOCK v2: "problema" SEMPRE usa base (contém números corretos)
      // IA só pode enriquecer causaProvavel e solucao
      categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type, baseSug.category),
      nivel: aiEnrichment.nivel || mapPriorityToNivel(baseSug.priority),
      problema: baseSug.message,  // ✅ SEMPRE do base - contém os números corretos
      problemaSemNumeros: aiEnrichment.problema || null,  // Texto IA sem números (opcional)
      causaProvavel: aiEnrichment.causaProvavel || 'Análise detalhada não fornecida',
      // 🔒 REGRA DE OURO: action do engine usa target±tolerance — NÃO depender de IA para range
      // baseSug.action = "Faixa ideal para este estilo: X a Y dB" (calculado, nunca hardcoded)
      solucao: baseSug.action || aiEnrichment.solucao,
      pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
      dicaExtra: aiEnrichment.dicaExtra || null,
      parametros: aiEnrichment.parametros || null,
      
      // 📊 Metadata
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: 'ULTRA_V2'
    };
    
    console.log('[GENRE-FLOW][S3_AI_ENRICH_AFTER]', {
      metric: merged.metric || merged.type,
      currentValue: merged.currentValue,
      targetValue: merged.targetValue,
      delta: merged.delta,
      deltaNum: merged.deltaNum
    });
    
    return merged;
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

/**
 * 🛡️ Valida coerência entre dados base e enriquecimento IA
 */
function validateAICoherence(baseSug, aiEnrich) {
  const issues = [];
  
  // 🔒 VALIDAÇÃO CRÍTICA: NUMERIC LOCK - IA NUNCA PODE RETORNAR CAMPOS NUMÉRICOS
  const forbiddenNumericFields = [
    'currentValue', 'targetRange', 'targetMin', 'targetMax', 
    'delta', 'deviationRatio', 'referenceValue', 'userValue'
  ];
  
  forbiddenNumericFields.forEach(field => {
    if (aiEnrich[field] !== undefined) {
      issues.push(`🚨 NUMERIC LOCK VIOLATION: IA retornou campo proibido "${field}" com valor "${aiEnrich[field]}"`);
    }
  });
  
  // Se houver violação de NUMERIC LOCK, retornar imediatamente como incoerente
  if (issues.length > 0 && issues.some(i => i.includes('NUMERIC LOCK VIOLATION'))) {
    return {
      isCoherent: false,
      issues: issues
    };
  }
  
  // Validação 1: Problema deve mencionar currentValue se disponível
  if (baseSug.currentValue && aiEnrich.problema) {
    const currentValueStr = String(baseSug.currentValue).replace(/[^\d.-]/g, '');
    const problemContainsValue = aiEnrich.problema.includes(currentValueStr) || 
                                  aiEnrich.problema.includes(baseSug.currentValue);
    if (!problemContainsValue) {
      issues.push(`problema não menciona currentValue (${baseSug.currentValue})`);
    }
  }
  
  // Validação 2: Problema ou causa deve mencionar delta se disponível
  if (baseSug.delta && typeof baseSug.delta === 'string') {
    const deltaNum = baseSug.delta.replace(/[^\d.-]/g, '');
    const deltaInProblem = aiEnrich.problema?.includes(deltaNum);
    const deltaInCause = aiEnrich.causaProvavel?.includes(deltaNum);
    if (!deltaInProblem && !deltaInCause && deltaNum && parseFloat(deltaNum) !== 0) {
      issues.push(`texto não menciona delta (${baseSug.delta})`);
    }
  }
  
  // Validação 3: Se delta é zero, solução não deve sugerir mudanças
  if (baseSug.delta && typeof baseSug.delta === 'string') {
    const deltaNum = parseFloat(baseSug.delta.replace(/[^\d.-]/g, ''));
    if (Math.abs(deltaNum) < 0.1 && aiEnrich.solucao) {
      const suggestsMudanca = aiEnrich.solucao.toLowerCase().match(/(aument|reduz|modif|ajust|mude|altere|corte|eleve)/);
      if (suggestsMudanca) {
        issues.push(`delta é ~zero mas solução sugere mudança`);
      }
    }
  }
  
  // Validação 4: Severidade IA vs base
  const severityMap = { 'crítica': 4, 'média': 2, 'leve': 1 };
  const basePriority = baseSug.priority || 2;
  const aiNivel = aiEnrich.nivel ? severityMap[aiEnrich.nivel] || 2 : 2;
  
  // Converter string priority para número se necessário
  let basePriorityNum = basePriority;
  if (typeof basePriority === 'string') {
    basePriorityNum = severityMap[basePriority.toLowerCase()] || 2;
  }
  
  if (Math.abs(basePriorityNum - aiNivel) > 2) {
    issues.push(`severidade IA (${aiEnrich.nivel}) muito diferente da base (priority: ${baseSug.priority})`);
  }
  
  return {
    isCoherent: issues.length === 0,
    issues
  };
}
