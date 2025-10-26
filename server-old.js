// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

// 🔑 IMPORTANTE: Carregar .env ANTES de importar outros módulos
dotenv.config();

// Rotas principais
import analyzeRoute from "./api/audio/analyze.js";
import jobsRoute from "./api/jobs/[id].js"; // 👈 rota de jobs conectada ao Postgres

console.log("📂 Arquivo .env carregado");
console.log("B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("B2_APP_KEY:", process.env.B2_APP_KEY);
console.log("B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("B2_ENDPOINT:", process.env.B2_ENDPOINT);
console.log("🗄️ DATABASE_URL:", process.env.DATABASE_URL ? "✅ Configurada" : "❌ Não configurada");

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 👉 ROTA RAIZ PRIMEIRO: abre a landing
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// 👉 Aliases para o app (index)
app.get(["/index", "/index.html", "/app", "/home"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 👉 Servir arquivos estáticos SEM index automático
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  })
);

// Rotas da API
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatWithImagesRoute from "./api/chat-with-images.js";
import chatRoute from "./api/chat.js";
import createPreferenceRoute from "./api/create-preference.js";
import deleteAccountRoute from "./api/delete-account.js";
import mercadopagoRoute from "./api/mercadopago.js";
import uploadAudioRoute from "./api/upload-audio.js";
import uploadImageRoute from "./api/upload-image.js";
import voiceMessageRoute from "./api/voice-message.js";
import webhookRoute from "./api/webhook.js";
import presignRoute from "./api/presign.js";

app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);
app.use("/api/chat", chatRoute);
app.use("/api/create-preference", createPreferenceRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/voice", voiceMessageRoute);
app.use("/api/webhook", webhookRoute);
app.use("/api", presignRoute);

// Rotas de análise
app.use("/api/audio", analyzeRoute);
app.use("/api/jobs", jobsRoute); // ✅ rota de jobs conectada ao banco

// ---------- ROTA REVOLUCIONÁRIA DE SUGESTÕES IA ----------
app.post("/api/suggestions", async (req, res) => {
  try {
    const { suggestions, metrics, genre } = req.body;

    console.log(`🚀 [AI-API] Recebidas ${suggestions?.length || 0} sugestões para processamento`);

    // Validação dos dados de entrada
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      console.error("❌ [AI-API] Lista de sugestões inválida");
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória e não pode estar vazia",
        received: suggestions
      });
    }

    // Se não tiver API key, retornar erro (não fallback)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.error("⚠️ [AI-API] OpenAI API Key não configurada");
      return res.status(503).json({
        success: false,
        error: 'API Key da IA não configurada',
        source: 'error',
        message: 'Configure OPENAI_API_KEY nas variáveis de ambiente'
      });
    }

    console.log(`📋 [AI-API] Construindo prompt para ${suggestions.length} sugestões do gênero: ${genre || 'geral'}`);

    // Construir prompt para TODAS as sugestões
    const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

    console.log(`🤖 [AI-API] Enviando prompt para OpenAI...`);

    // Chamar OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `🎵 VOCÊ É UM ASSISTENTE DE MIXAGEM E MASTERIZAÇÃO MUSICAL ULTRA-AVANÇADO

🎯 SUA MISSÃO:
Analisar os PROBLEMAS de áudio detectados e gerar sugestões EDUCATIVAS, claras e aplicáveis para o usuário.

📋 ESTRUTURA OBRIGATÓRIA para cada sugestão:

⚠️ Problema: [descrição curta e clara]
🎯 Causa Provável: [explicação técnica simples, sem jargão pesado]
🛠️ Solução Prática: [passo a passo direto que pode ser feito em qualquer DAW]
💡 Dica Extra: [truque avançado ou consideração criativa]
🎹 Exemplo de Plugin/Ferramenta: [cite pelo menos 1 plugin popular ou gratuito que ajude]
✅ Resultado Esperado: [explique de forma motivadora o que vai melhorar no som]

� REGRAS DE OURO:
- Escreva de forma educativa e motivadora, sem ser rígido
- Use linguagem simples, mas com conteúdo técnico real
- Sempre que possível, dê referências a gêneros musicais (Funk, Trap, Eletrônico, etc.)
- Saída formatada em blocos claros com emojis para facilitar leitura
- Seja prático: usuário deve conseguir aplicar HOJE no seu projeto

🚀 RESPONDA SEMPRE EM JSON PURO, SEM EXPLICAÇÕES EXTRAS.`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '3000'), // ⬆️ AUMENTADO para evitar truncamento
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      console.error("❌ Erro na API da OpenAI:", openaiResponse.status, openaiResponse.statusText);
      throw new Error(`OpenAI API retornou ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiSuggestion = openaiData.choices[0]?.message?.content;

    if (!aiSuggestion) {
      throw new Error('Resposta vazia da IA');
    }

    console.log(`🔍 [AI-PROCESSING] Resposta bruta da IA recebida (${aiSuggestion.length} chars)`);

    // 🚨 PARSE ULTRA-SEGURO: Processar resposta da IA com sanitização e fallback garantido
    const enhancedSuggestions = safeParseAIResponse(aiSuggestion, suggestions, 'AI-SUGGESTIONS-ENDPOINT');

    // 🔒 VALIDAÇÃO FINAL CRÍTICA: Garantir contagem exata antes de retornar
    if (enhancedSuggestions.length !== suggestions.length) {
      console.error(`❌ [AI-API] ERRO CRÍTICO: Contagem final inválida ${enhancedSuggestions.length}/${suggestions.length}`);
      throw new Error(`Contagem final não confere: ${enhancedSuggestions.length}/${suggestions.length}`);
    }

    console.log(`✅ [AI-API] ✅ SUCESSO TOTAL: Processamento concluído com ${enhancedSuggestions.length} sugestões:`, {
      suggestionsOriginais: suggestions.length,
      suggestionsEnriquecidas: enhancedSuggestions.length,
      sucessoCompleto: enhancedSuggestions.length === suggestions.length ? '✅ SIM' : '❌ PARCIAL',
      aiEnriquecidas: enhancedSuggestions.filter(s => s.aiEnhanced === true).length,
      fallbackUsadas: enhancedSuggestions.filter(s => s.aiEnhanced === false).length,
      validacaoFinal: 'CONTAGEM GARANTIDA ✅'
    });

    res.json({
      success: true,
      enhancedSuggestions,
      source: 'ai',
      message: `${enhancedSuggestions.length} sugestões enriquecidas pela IA`,
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: enhancedSuggestions.length,
        genre: genre || 'não especificado',
        processingTime: Date.now(),
        aiSuccess: enhancedSuggestions.length,
        aiErrors: Math.max(0, suggestions.length - enhancedSuggestions.length)
      }
    });

  } catch (error) {
    console.error("❌ [AI-API] Erro crítico no processamento:", error.message);
    
    // Retornar erro ao invés de fallback
    res.status(500).json({
      success: false,
      error: error.message,
      source: 'error',
      message: 'Erro no processamento da IA. Tente novamente.',
      metadata: {
        originalCount: suggestions?.length || 0,
        enhancedCount: 0,
        aiSuccess: 0,
        aiErrors: suggestions?.length || 0
      }
    });
  }
});

// Função para construir o prompt da IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const suggestionsList = suggestions.map((s, i) => 
    `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'} (Prioridade: ${s.priority || 5}, Confiança: ${s.confidence || 0.5})`
  ).join('\n');

  const metricsInfo = metrics ? `
🔊 ANÁLISE ESPECTRAL DETALHADA:
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB (Loudness global)
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP (Picos digitais)  
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU (Dinâmica)
- Correlação Estéreo: ${metrics.stereoCorrelation || 'N/A'} (Espacialização)
- LRA (Range): ${metrics.lra || 'N/A'} LU (Variação dinâmica)
` : '';

  const genreContext = getGenreContext(genre);

  return `
🎵 VOCÊ É O MAIS AVANÇADO ENGENHEIRO DE ÁUDIO E MASTERING DO MUNDO

Analise estas detecções automáticas para ${genre || 'música geral'} e transforme cada uma numa sugestão REVOLUCIONÁRIA:

${suggestionsList}

${metricsInfo}

${genreContext}

� INSTRUÇÕES CRÍTICAS:
- Retorne exatamente ${suggestions.length} sugestões enriquecidas
- NUNCA omita, corte ou deixe sugestões em branco
- Cada sugestão deve ser uma versão enriquecida da correspondente da lista acima
- JSON deve ser válido e completo até o último caractere
- Se houver limitações de tokens, priorize completar o array ao invés de detalhes extras

�📋 RETORNE JSON PURO com este formato EXATO (${suggestions.length} objetos no array):
{
  "suggestions": [
    {
      "blocks": {
        "problem": "⚠️ [descrição curta e clara do problema]",
        "cause": "🎯 [explicação técnica simples, sem jargão pesado]", 
        "solution": "🛠️ [passo a passo direto que pode ser feito em qualquer DAW]",
        "tip": "💡 [truque avançado ou consideração criativa]",
        "plugin": "🎹 [cite pelo menos 1 plugin popular ou gratuito que ajude]",
        "result": "✅ [explique de forma motivadora o que vai melhorar no som]"
      },
      "metadata": {
        "priority": "alta|média|baixa",
        "difficulty": "iniciante|intermediário|avançado",
        "confidence": 0.95,
        "frequency_range": "20-60Hz",
        "processing_type": "EQ|Compressor|Limiter|Spatial",
        "genre_specific": "Se aplicável ao gênero analisado"
      },
      "aiEnhanced": true
    }
  ]
}`;
}

// Função para obter contexto do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA:
- Foco em sub bass (40-80Hz) com presença forte
- Mid bass (80-200Hz) deve ter punch sem masking
- Vocal range (1-4kHz) cristalino para inteligibilidade
- High-end (8-15kHz) controlado mas presente
- Dinâmica: moderada (DR 4-6) para energia constante
- True Peak: máximo -1dBTP para sistemas potentes
- LUFS target: -8 a -12 LUFS para som competitivo`,
    
    trance: `
🎵 CONTEXTO TRANCE:
- Sub bass limpo (30-60Hz) sem distorção
- Kick punch (60-120Hz) definido e controlado  
- Lead synths (2-8kHz) brilhantes e espaciais
- Reverb/delay equilibrados para profundidade
- Dinâmica: baixa (DR 3-5) para energia sustentada
- True Peak: -0.5dBTP para maximizar loudness
- LUFS target: -6 a -9 LUFS para dancefloor impact`,
    
    bruxaria: `
🎵 CONTEXTO BRUXARIA/EXPERIMENTAL:
- Frequências graves (20-100Hz) podem ser não-convencionais
- Mid range (200Hz-2kHz) com espaço para atmosferas
- High-end (5-20kHz) pode ter texturas únicas
- Dinâmica: variável (DR 6-12) para expressividade
- True Peak: flexível (-3 a -1dBTP) conforme estética
- LUFS target: -12 a -16 LUFS para preservar dinâmica`
  };
  
  return contexts[genre] || `
🎵 CONTEXTO GERAL:
- Analise características específicas do gênero
- Balance entre clareza e energia
- Respeite a dinâmica natural do estilo
- Foque na inteligibilidade e impacto emocional`;
}

// 🛡️ FUNÇÃO ULTRA BLINDADA PARA PARSE SEGURO DE RESPOSTA IA
function safeParseAIResponse(raw, fallback, context = 'AI-PROCESSING') {
  console.log(`🛡️ [${context}] Iniciando parse ultra blindado...`);
  console.log(`📋 [${context}] Resposta recebida: ${raw?.length || 0} chars`);
  
  // VALIDAÇÃO DE ENTRADA
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    console.warn(`⚠️ [${context}] Resposta vazia ou inválida, usando fallback`);
    return fallback || [];
  }
  
  if (!fallback || !Array.isArray(fallback)) {
    console.warn(`⚠️ [${context}] Fallback inválido, criando array vazio`);
    fallback = [];
  }
  
  try {
    // PASSO 1: SANITIZAÇÃO BÁSICA
    console.log(`🧹 [${context}] Aplicando sanitização básica...`);
    let sanitized = raw.trim();
    
    // Remover markdown/formatação comum
    sanitized = sanitized.replace(/```json\s*|\s*```/g, '');
    sanitized = sanitized.replace(/```\s*|\s*```/g, '');
    
    // Encontrar início e fim do JSON válido
    let jsonStart = sanitized.indexOf('[');
    let jsonEnd = sanitized.lastIndexOf(']');
    
    // Se não encontrou array, procurar objeto
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      jsonStart = sanitized.indexOf('{');
      jsonEnd = sanitized.lastIndexOf('}');
    }
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.warn(`⚠️ [${context}] Nenhuma estrutura JSON encontrada`);
      throw new Error('Nenhuma estrutura JSON detectada');
    }
    
    // Extrair apenas a parte JSON válida
    sanitized = sanitized.substring(jsonStart, jsonEnd + 1);
    
    // LIMPEZA AVANÇADA
    // Remover vírgulas soltas no final
    sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');
    sanitized = sanitized.replace(/,(\s*)$/g, '$1');
    
    // Substituir quebras de linha problemáticas
    sanitized = sanitized.replace(/\n\s*\n/g, '\n');
    
    console.log(`✨ [${context}] JSON sanitizado (${sanitized.length} chars)`);
    
    // PASSO 2: TENTATIVA DE PARSE DIRETO
    try {
      const parsed = JSON.parse(sanitized);
      console.log(`✅ [${context}] Parse bem-sucedido: estrutura válida`);
      
      // Extrair array de sugestões
      let suggestions = [];
      if (Array.isArray(parsed)) {
        suggestions = parsed;
      } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
      } else if (parsed.enhanced_suggestions && Array.isArray(parsed.enhanced_suggestions)) {
        suggestions = parsed.enhanced_suggestions;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        suggestions = parsed.results;
      }
      
      if (suggestions.length > 0) {
        console.log(`🎯 [${context}] Parse bem-sucedido: ${suggestions.length} sugestões extraídas`);
        return suggestions;
      } else {
        console.warn(`⚠️ [${context}] Parse bem-sucedido mas sem sugestões válidas`);
        throw new Error('Estrutura parseada mas sem sugestões');
      }
      
    } catch (parseError) {
      console.warn(`⚠️ [${context}] Parse direto falhou: ${parseError.message}`);
      
      // PASSO 3: CORREÇÃO COM REGEX
      console.log(`🔧 [${context}] Tentando extrair array com regex...`);
      
      try {
        // Tentar extrair array usando regex
        const arrayMatch = sanitized.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          let arrayContent = arrayMatch[0];
          
          // Aplicar correções automáticas no array
          arrayContent = arrayContent.replace(/,(\s*\])/g, '$1'); // Remove vírgula antes de ]
          arrayContent = arrayContent.replace(/,(\s*\})/g, '$1'); // Remove vírgula antes de }
          
          const correctedParsed = JSON.parse(arrayContent);
          console.log(`✅ [${context}] Parse corrigido bem-sucedido: ${correctedParsed.length} sugestões`);
          return correctedParsed;
        }
        
        // Tentar extrair objeto suggestions
        const suggestionsMatch = sanitized.match(/"suggestions"\s*:\s*(\[[\s\S]*?\])/);
        if (suggestionsMatch) {
          let suggestionsArray = suggestionsMatch[1];
          suggestionsArray = suggestionsArray.replace(/,(\s*\])/g, '$1');
          suggestionsArray = suggestionsArray.replace(/,(\s*\})/g, '$1');
          
          const correctedSuggestions = JSON.parse(suggestionsArray);
          console.log(`✅ [${context}] Parse corrigido (suggestions): ${correctedSuggestions.length} sugestões`);
          return correctedSuggestions;
        }
        
        throw new Error('Nenhum padrão válido encontrado com regex');
        
      } catch (regexError) {
        console.error(`❌ [${context}] Correção com regex falhou: ${regexError.message}`);
        throw regexError;
      }
    }
    
  } catch (criticalError) {
    // PASSO 4: FALLBACK FINAL
    console.error(`❌ [${context}] Parse falhou completamente: ${criticalError.message}`);
    console.log(`🛡️ [${context}] Fallback usado, preservando ${fallback.length} sugestões`);
    
    return fallback;
  }
}
  
  if (!rawResponse || typeof rawResponse !== 'string') {
    console.error(`❌ [${context}] Resposta inválida ou vazia`);
    return createFullFallback(originalSuggestions, context);
  }
  
  console.log(`🔍 [${context}] Resposta bruta recebida (${rawResponse.length} chars)`);
  
  try {
    // PASSO 1: LIMPEZA AGRESSIVA
    let cleanResponse = rawResponse.trim();
    
    // Remover markdown/formatação
    cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
    cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '');
    
    // Encontrar início e fim do JSON
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      console.warn(`⚠️ [${context}] Não encontrou objeto JSON válido na resposta`);
      return createFullFallback(originalSuggestions, context);
    }
    
    cleanResponse = cleanResponse.substring(jsonStart, jsonEnd);
    console.log(`🧹 [${context}] JSON limpo extraído (${cleanResponse.length} chars)`);
    
    // PASSO 2: TENTATIVA DE PARSE DIRETO
    let parsed;
    try {
      parsed = JSON.parse(cleanResponse);
      console.log(`✅ [${context}] Parse direto bem-sucedido`);
    } catch (parseError) {
      console.warn(`⚠️ [${context}] Parse direto falhou: ${parseError.message}`);
      console.log(`🔧 [${context}] Aplicando correções automáticas...`);
      
      // PASSO 3: CORREÇÕES AUTOMÁTICAS
      let fixedResponse = fixTruncatedJSON(cleanResponse, context);
      
      try {
        parsed = JSON.parse(fixedResponse);
        console.log(`✅ [${context}] Parse corrigido bem-sucedido`);
      } catch (secondError) {
        console.error(`❌ [${context}] Parse falhou mesmo após correções: ${secondError.message}`);
        return createFullFallback(originalSuggestions, context);
      }
    }
    
    // PASSO 4: VALIDAÇÃO DE ESTRUTURA
    if (!parsed || typeof parsed !== 'object') {
      console.error(`❌ [${context}] Resposta parseada não é um objeto válido`);
      return createFullFallback(originalSuggestions, context);
    }
    
    // Tentar extrair sugestões de diferentes estruturas possíveis
    let aiSuggestions = parsed.suggestions || parsed.enhanced_suggestions || parsed.results || [];
    
    if (!Array.isArray(aiSuggestions)) {
      console.error(`❌ [${context}] Sugestões não estão em formato de array`);
      return createFullFallback(originalSuggestions, context);
    }
    
    const receivedCount = aiSuggestions.length;
    console.log(`📊 [${context}] Parse completo: ${receivedCount}/${expectedCount} sugestões`);
    
    // PASSO 5: COMPLETAMENTO AUTOMÁTICO SE NECESSÁRIO
    if (expectedCount > 0 && receivedCount < expectedCount) {
      console.warn(`⚠️ [${context}] RESPOSTA INCOMPLETA: Completando ${expectedCount - receivedCount} sugestões`);
      
      for (let i = receivedCount; i < expectedCount; i++) {
        const originalSuggestion = originalSuggestions[i];
        const fallbackSuggestion = createFallbackSuggestion(originalSuggestion, i, context);
        aiSuggestions.push(fallbackSuggestion);
        console.log(`🔧 [${context}] Sugestão ${i + 1} completada com fallback estruturado`);
      }
    }
    
    console.log(`✅ [${context}] Parse ultra-seguro concluído: ${aiSuggestions.length} sugestões processadas`);
    return aiSuggestions;
    
  } catch (criticalError) {
    console.error(`❌ [${context}] Erro crítico durante parse ultra-seguro:`, criticalError.message);
    return createFullFallback(originalSuggestions, context);
  }


// 🔧 Função para corrigir JSON truncado de forma mais inteligente
function fixTruncatedJSON(jsonString, context = 'JSON-FIX') {
  console.log(`🔧 [${context}] Iniciando correção automática de JSON truncado...`);
  
  let fixed = jsonString;
  
  // Remover vírgulas problemáticas antes de fechamentos
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Remover vírgulas no final de strings sem fechamento
  fixed = fixed.replace(/,(\s*)$/g, '$1');
  
  // Contar níveis de abertura para saber o que precisa fechar
  let braceLevel = 0;
  let bracketLevel = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceLevel++;
      if (char === '}') braceLevel--;
      if (char === '[') bracketLevel++;
      if (char === ']') bracketLevel--;
    }
  }
  
  // Fechar objetos abertos
  while (braceLevel > 0) {
    fixed += '}';
    braceLevel--;
    console.log(`🔧 [${context}] Fechando objeto aberto`);
  }
  
  // Fechar arrays abertos
  while (bracketLevel > 0) {
    fixed += ']';
    bracketLevel--;
    console.log(`🔧 [${context}] Fechando array aberto`);
  }
  
  // Se terminou com vírgula, remover
  fixed = fixed.replace(/,(\s*)$/, '$1');
  
  console.log(`🔧 [${context}] Correção automática aplicada`);
  return fixed;
}

// 🛡️ Criar fallback completo quando parse falha totalmente
function createFullFallback(originalSuggestions, context = 'FALLBACK') {
  if (!originalSuggestions || !Array.isArray(originalSuggestions)) {
    console.error(`❌ [${context}] Sem sugestões originais para fallback`);
    return [];
  }
  
  const fallbackSuggestions = originalSuggestions.map((suggestion, index) => 
    createFallbackSuggestion(suggestion, index, context)
  );
  
  console.log(`🛡️ [${context}] Fallback completo criado: ${fallbackSuggestions.length} sugestões estruturadas`);
  return fallbackSuggestions;
}

// 🔧 Criar sugestão de fallback estruturada
function createFallbackSuggestion(originalSuggestion, index, context = 'FALLBACK') {
  return {
    blocks: {
      problem: `⚠️ ${originalSuggestion?.message || originalSuggestion?.title || `Problema ${index + 1} detectado pelo sistema`}`,
      cause: '🎯 Análise automática identificou desvio dos padrões técnicos profissionais de referência',
      solution: `🛠️ ${originalSuggestion?.action || originalSuggestion?.description || 'Aplicar correção recomendada pelo sistema de análise'}`,
      tip: '💡 Teste o resultado em diferentes sistemas de reprodução para validar a melhoria aplicada',
      plugin: '🎹 Utilize EQ/Compressor nativo da sua DAW ou plugins gratuitos como ReaEQ, ReaComp',
      result: '✅ Melhor qualidade sonora geral e maior compatibilidade com padrões profissionais da indústria'
    },
    metadata: {
      priority: originalSuggestion?.priority || 'média',
      difficulty: 'intermediário',
      confidence: originalSuggestion?.confidence || 0.7,
      frequency_range: originalSuggestion?.frequency_range || 'espectro completo',
      processing_type: 'Correção geral',
      genre_specific: 'Aplicável universalmente a todos os gêneros musicais'
    },
    aiEnhanced: false // Marcado como não-enriquecido pela IA
  };
}

// 🗑️ FUNÇÃO REMOVIDA: processAIResponseSafe substituída por safeParseAIResponse
// Esta função foi substituída pela versão ultra-robusta safeParseAIResponse acima
  console.log('🤖 [AI-PROCESSING] Processando resposta da IA com parsing ultra-seguro...');
  
  const expectedCount = originalSuggestions.length;
  console.log(`🎯 [AI-PROCESSING] Esperado: ${expectedCount} sugestões`);

  try {
    // 1. LIMPEZA AGRESSIVA DO JSON
    let cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
    
    // 2. TENTATIVA DE PARSE DIRETO
    let parsed;
    try {
      parsed = JSON.parse(cleanResponse);
      console.log('✅ [AI-PROCESSING] JSON válido parseado na primeira tentativa');
    } catch (parseError) {
      console.warn('⚠️ [AI-PROCESSING] Parse direto falhou, tentando correção automática...');
      
      // 3. CORREÇÃO AUTOMÁTICA DE JSON TRUNCADO
      cleanResponse = fixTruncatedJSON(cleanResponse);
      
      try {
        parsed = JSON.parse(cleanResponse);
        console.log('✅ [AI-PROCESSING] JSON corrigido parseado com sucesso');
      } catch (secondError) {
        console.error('❌ [AI-PROCESSING] Falha definitiva no parse JSON:', secondError.message);
        throw new Error(`JSON inválido mesmo após correção: ${secondError.message}`);
      }
    }
    
    // 4. VALIDAÇÃO DE ESTRUTURA
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Resposta não contém array "suggestions" válido');
    }
    
    let aiSuggestions = parsed.suggestions;
    const receivedCount = aiSuggestions.length;
    
    console.log(`� [AI-PROCESSING] Recebido: ${receivedCount}/${expectedCount} sugestões da IA`);
    
    // 5. COMPLETAR SUGESTÕES FALTANTES (CRÍTICO)
    if (receivedCount < expectedCount) {
      console.warn(`⚠️ [AI-PROCESSING] RESPOSTA INCOMPLETA: Completando ${expectedCount - receivedCount} sugestões faltantes`);
      
      for (let i = receivedCount; i < expectedCount; i++) {
        const originalSuggestion = originalSuggestions[i];
        
        const fallbackSuggestion = {
          blocks: {
            problem: `⚠️ ${originalSuggestion.message || originalSuggestion.title || `Problema ${i + 1}`}`,
            cause: '🎯 Análise automática identificou desvio dos padrões técnicos de referência',
            solution: `🛠️ ${originalSuggestion.action || originalSuggestion.description || 'Ajuste recomendado pelo sistema'}`,
            tip: '💡 Monitore resultado em diferentes sistemas de reprodução para validar melhoria',
            plugin: '🎹 Use EQ/Compressor nativo da sua DAW ou plugins gratuitos',
            result: '✅ Melhoria na qualidade sonora geral e maior compatibilidade profissional'
          },
          metadata: {
            priority: originalSuggestion.priority || 'média',
            difficulty: 'intermediário',
            confidence: originalSuggestion.confidence || 0.7,
            frequency_range: 'espectro amplo',
            processing_type: 'Ajuste geral',
            genre_specific: 'Aplicável universalmente'
          },
          aiEnhanced: false // Marca como não-enriquecida pela IA
        };
        
        aiSuggestions.push(fallbackSuggestion);
        console.log(`🔧 [AI-PROCESSING] Sugestão ${i + 1} completada com fallback estruturado`);
      }
    }
    
    // 6. GARANTIR CONTAGEM EXATA
    if (aiSuggestions.length !== expectedCount) {
      console.error(`❌ [AI-PROCESSING] ERRO CRÍTICO: ${aiSuggestions.length} !== ${expectedCount}`);
      throw new Error(`Contagem final inválida: ${aiSuggestions.length}/${expectedCount}`);
    }
    
    console.log(`✅ [AI-PROCESSING] Sucesso total: ${aiSuggestions.length} sugestões válidas processadas`);
    return aiSuggestions;
    
  } catch (error) {
    console.error('❌ [AI-PROCESSING] Erro crítico, usando fallback completo:', error.message);
    
    // 7. FALLBACK TOTAL: Estruturar TODAS as sugestões originais
    const fallbackSuggestions = originalSuggestions.map((suggestion, index) => ({
      blocks: {
        problem: `⚠️ ${suggestion.message || suggestion.title || `Problema ${index + 1} detectado`}`,
        cause: '🎯 Sistema identificou desvio dos padrões técnicos de referência profissional',
        solution: `🛠️ ${suggestion.action || suggestion.description || 'Aplicar correção recomendada pelo sistema'}`,
        tip: '💡 Teste resultado em diferentes sistemas de reprodução para validar melhoria',
        plugin: '🎹 Utilize EQ/Compressor nativo da DAW ou plugins gratuitos como ReaEQ',
        result: '✅ Melhor qualidade sonora e maior compatibilidade com padrões profissionais'
      },
      metadata: {
        priority: suggestion.priority || 'média',
        difficulty: 'intermediário',
        confidence: suggestion.confidence || 0.7,
        frequency_range: suggestion.frequency_range || 'espectro completo',
        processing_type: 'Correção geral',
        genre_specific: 'Aplicável a todos os gêneros musicais'
      },
      aiEnhanced: false
    }));
    
    console.log(`🛡️ [AI-PROCESSING] Fallback aplicado: ${fallbackSuggestions.length} sugestões estruturadas`);
    return fallbackSuggestions;
  }


// Função INTEGRADA já na função utilitária safeParseAIResponse acima

// 👉 Fallback SPA: qualquer rota não-API cai no app (index.html)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);
});

export default app;
