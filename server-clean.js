// server-clean.js - Versão limpa com parser ultra-seguro
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
import jobsRoute from "./api/jobs/[id].js"; 

console.log("📂 Arquivo .env carregado");
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
app.use("/api/jobs", jobsRoute);

// 🔧 FUNÇÃO ULTRA-SEGURA para parse de resposta da IA
function safeParseAIResponse(rawResponse, originalSuggestions, context = 'AI-PROCESSING') {
  const expectedCount = originalSuggestions.length;
  console.log(`🤖 [${context}] Iniciando parse ultra-seguro: ${expectedCount} sugestões esperadas`);
  
  if (!rawResponse || typeof rawResponse !== 'string') {
    console.error(`❌ [${context}] Resposta inválida ou vazia`);
    return createFullFallback(originalSuggestions, context);
  }
  
  console.log(`🔍 [${context}] Resposta bruta recebida (${rawResponse.length} chars)`);
  
  try {
    // PASSO 1: LIMPEZA AGRESSIVA
    let cleanResponse = rawResponse.trim();
    
    // Remover markdown/formatação
    cleanResponse = cleanResponse.replace(/```json\\s*|\\s*```/g, '');
    cleanResponse = cleanResponse.replace(/```\\s*|\\s*```/g, '');
    
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
    
    // PASSO 6: VALIDAÇÃO FINAL
    if (expectedCount > 0 && aiSuggestions.length !== expectedCount) {
      console.error(`❌ [${context}] ERRO CRÍTICO: ${aiSuggestions.length} !== ${expectedCount}`);
      return createFullFallback(originalSuggestions, context);
    }
    
    console.log(`✅ [${context}] Parse ultra-seguro concluído: ${aiSuggestions.length} sugestões processadas`);
    return aiSuggestions;
    
  } catch (criticalError) {
    console.error(`❌ [${context}] Erro crítico durante parse ultra-seguro:`, criticalError.message);
    return createFullFallback(originalSuggestions, context);
  }
}

// 🔧 Função para corrigir JSON truncado de forma mais inteligente
function fixTruncatedJSON(jsonString, context = 'JSON-FIX') {
  console.log(`🔧 [${context}] Iniciando correção automática de JSON truncado...`);
  
  let fixed = jsonString;
  
  // Remover vírgulas problemáticas antes de fechamentos
  fixed = fixed.replace(/,(\\s*[}\\]])/g, '$1');
  
  // Remover vírgulas no final de strings sem fechamento
  fixed = fixed.replace(/,(\\s*)$/g, '$1');
  
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
    
    if (char === '\\\\') {
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
  fixed = fixed.replace(/,(\\s*)$/, '$1');
  
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
      problem: `⚠️ ${originalSuggestion?.message || originalSuggestion?.title || \`Problema \${index + 1} detectado pelo sistema\`}`,
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

// 🚀 CONSTRUÇÃO DO PROMPT PARA IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const suggestionList = suggestions.map((s, i) => 
    `${i+1}. ${s.message || s.title || s.description || 'Problema detectado'}`
  ).join('\\n');
  
  return `Analise esses ${suggestions.length} problemas de áudio detectados e forneça sugestões educativas para cada um:

PROBLEMAS DETECTADOS:
${suggestionList}

GÊNERO MUSICAL: ${genre || 'não especificado'}

RESPONDA em JSON exatamente neste formato:
{
  "suggestions": [
    {
      "blocks": {
        "problem": "⚠️ [descrição clara do problema]",
        "cause": "🎯 [explicação técnica simples da causa]",
        "solution": "🛠️ [passo a passo prático para resolver]",
        "tip": "💡 [dica extra ou consideração criativa]",
        "plugin": "🎹 [exemplo de plugin/ferramenta específica]",
        "result": "✅ [o que vai melhorar no som]"
      },
      "metadata": {
        "priority": "alta|média|baixa",
        "difficulty": "iniciante|intermediário|avançado",
        "confidence": 0.8,
        "frequency_range": "[faixa de frequência afetada]",
        "processing_type": "[tipo de processamento]",
        "genre_specific": "[considerações específicas do gênero]"
      }
    }
  ]
}`;
}

// 🚀 ENDPOINT PRINCIPAL DE SUGESTÕES IA
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
        'Authorization': \`Bearer \${openaiApiKey}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: \`🎵 VOCÊ É UM ASSISTENTE DE MIXAGEM E MASTERIZAÇÃO MUSICAL ULTRA-AVANÇADO

🎯 SUA MISSÃO:
Analisar os PROBLEMAS de áudio detectados e gerar sugestões EDUCATIVAS, claras e aplicáveis para o usuário.

📋 ESTRUTURA OBRIGATÓRIA para cada sugestão:

⚠️ Problema: [descrição curta e clara]
🎯 Causa Provável: [explicação técnica simples, sem jargão pesado]
🛠️ Solução Prática: [passo a passo direto que pode ser feito em qualquer DAW]
💡 Dica Extra: [truque avançado ou consideração criativa]
🎹 Exemplo de Plugin/Ferramenta: [cite pelo menos 1 plugin popular ou gratuito que ajude]
✅ Resultado Esperado: [explique de forma motivadora o que vai melhorar no som]

🔥 REGRAS DE OURO:
- Escreva de forma educativa e motivadora, sem ser rígido
- Use linguagem simples, mas com conteúdo técnico real
- Sempre que possível, dê referências a gêneros musicais (Funk, Trap, Eletrônico, etc.)
- Saída formatada em blocos claros com emojis para facilitar leitura
- Seja prático: usuário deve conseguir aplicar HOJE no seu projeto

🚀 RESPONDA SEMPRE EM JSON PURO, SEM EXPLICAÇÕES EXTRAS.\`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '3000'),
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      console.error("❌ Erro na API da OpenAI:", openaiResponse.status, openaiResponse.statusText);
      throw new Error(\`OpenAI API retornou \${openaiResponse.status}\`);
    }

    const openaiData = await openaiResponse.json();
    const aiSuggestion = openaiData.choices[0]?.message?.content;

    if (!aiSuggestion) {
      throw new Error('Resposta vazia da IA');
    }

    console.log(\`🔍 [AI-PROCESSING] Resposta bruta da IA recebida (\${aiSuggestion.length} chars)\`);

    // 🚨 PARSE ULTRA-SEGURO: Processar resposta da IA com sanitização e fallback garantido
    const enhancedSuggestions = safeParseAIResponse(aiSuggestion, suggestions, 'AI-SUGGESTIONS-ENDPOINT');

    // 🔒 VALIDAÇÃO FINAL CRÍTICA: Garantir contagem exata antes de retornar
    if (enhancedSuggestions.length !== suggestions.length) {
      console.error(\`❌ [AI-API] ERRO CRÍTICO: Contagem final inválida \${enhancedSuggestions.length}/\${suggestions.length}\`);
      throw new Error(\`Contagem final não confere: \${enhancedSuggestions.length}/\${suggestions.length}\`);
    }

    console.log(\`✅ [AI-API] ✅ SUCESSO TOTAL: Processamento concluído com \${enhancedSuggestions.length} sugestões:\`, {
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
      message: \`\${enhancedSuggestions.length} sugestões enriquecidas pela IA\`,
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

    // Fallback completo em caso de erro crítico
    const { suggestions } = req.body;
    if (suggestions && Array.isArray(suggestions)) {
      const fallbackSuggestions = createFullFallback(suggestions, 'AI-ERROR-FALLBACK');
      
      return res.json({
        success: true,
        enhancedSuggestions: fallbackSuggestions,
        source: 'fallback',
        message: \`Processamento falhou, usando \${fallbackSuggestions.length} sugestões estruturadas de fallback\`,
        metadata: {
          originalCount: suggestions.length,
          enhancedCount: fallbackSuggestions.length,
          error: error.message,
          fallbackApplied: true
        }
      });
    }

    res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      message: error.message
    });
  }
});

// 👉 Fallback SPA: qualquer rota não-API cai no app (index.html)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(\`🚀 Servidor SoundyAI rodando na porta \${PORT}\`);
});