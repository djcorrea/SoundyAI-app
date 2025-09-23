import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";
import fetch from "node-fetch";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json({ limit: '10mb' }));

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai-app-production.up.railway.app", // domínio principal (sem barra no final)
      "http://localhost:3000", // útil para testes locais
    ],
  })
);

// ---------- Conexão com Postgres ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres
});

// ---------- Configuração Backblaze ----------
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Middleware para upload ----------
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/mpeg",   // mp3
    "audio/wav",    // wav
    "audio/x-wav",  // outra variação wav
    "audio/wave",   // outra variação wav
    "audio/x-m4a",  // m4a
    "audio/mp4",    // m4a/mp4
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Tipo de arquivo não permitido. Envie apenas mp3, wav ou m4a."),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
  fileFilter,
});

// ---------- Rota para sugestões com IA ----------
app.post("/api/suggestions", async (req, res) => {
  try {
    const { suggestions, metrics, genre } = req.body;

    // Validação dos dados de entrada
    if (!suggestions || !Array.isArray(suggestions)) {
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória",
        fallbackSuggestions: suggestions || []
      });
    }

    // Se não tiver API key, retornar sugestões normais
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log("⚠️ OpenAI API Key não configurada - usando fallback");
      return res.json({
        success: true,
        enhancedSuggestions: suggestions,
        source: 'fallback',
        message: 'Sugestões básicas (IA indisponível)'
      });
    }

    // Construir prompt para IA
    const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

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
            content: 'Você é um engenheiro de áudio especializado em mixagem e masterização, com conhecimento profundo em psychoacoustics e produção musical. Suas respostas devem ser educativas, práticas e técnicas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '1000')
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

    // Processar resposta da IA e enriquecer sugestões
    const enhancedSuggestions = processAIResponse(suggestions, aiSuggestion);

    console.log(`✅ Sugestões enriquecidas com IA: ${enhancedSuggestions.length} items`);

    res.json({
      success: true,
      enhancedSuggestions,
      source: 'ai',
      message: 'Sugestões enriquecidas com IA',
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: enhancedSuggestions.length,
        genre: genre || 'não especificado',
        processingTime: Date.now()
      }
    });

  } catch (error) {
    console.error("❌ Erro no endpoint de sugestões:", error.message);
    
    // Sempre retornar fallback em caso de erro
    const { suggestions } = req.body;
    res.json({
      success: true,
      enhancedSuggestions: suggestions || [],
      source: 'fallback',
      message: 'Usando sugestões básicas devido a erro na IA',
      error: error.message
    });
  }
});

// Função para construir o prompt da IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const suggestionsList = suggestions.map((s, i) => 
    `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'}`
  ).join('\n');

  const metricsInfo = metrics ? `
Métricas atuais:
- LUFS: ${metrics.lufsIntegrated || 'N/A'}
- True Peak: ${metrics.truePeakDbtp || 'N/A'}  
- Dynamic Range: ${metrics.dynamicRange || 'N/A'}
- Stereo Width: ${metrics.stereoCorrelation || 'N/A'}
` : '';

  return `
Analise as seguintes sugestões de mixagem/masterização para o gênero ${genre || 'geral'}:

${suggestionsList}

${metricsInfo}

Para cada sugestão, forneça um JSON estruturado com:
{
  "suggestions": [
    {
      "id": 1,
      "problem": "🚨 Descrição clara do problema",
      "cause": "🎯 Causa provável técnica",
      "solution": "🛠️ Solução prática passo-a-passo",
      "tip": "💡 Dica extra ou conceito educativo",
      "priority": "alta|média|baixa",
      "difficulty": "básico|intermediário|avançado"
    }
  ]
}

Foque em:
1. Explicações educativas que ensinem o conceito
2. Instruções práticas claras
3. Contexto técnico relevante  
4. Dicas para evitar o problema no futuro

Responda APENAS com o JSON, sem texto adicional.
`;
}

// Função para processar resposta da IA
function processAIResponse(originalSuggestions, aiResponse) {
  try {
    // Tentar parsear JSON da resposta
    let aiData;
    try {
      aiData = JSON.parse(aiResponse);
    } catch (jsonError) {
      // Se não for JSON válido, tentar extrair JSON de markdown
      const jsonMatch = aiResponse.match(/```(?:json)?\s*({[\s\S]*})\s*```/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Resposta não está em formato JSON válido');
      }
    }

    if (!aiData.suggestions || !Array.isArray(aiData.suggestions)) {
      throw new Error('Formato de resposta inválido');
    }

    // Combinar sugestões originais com melhorias da IA
    const enhanced = originalSuggestions.map((original, index) => {
      const aiSuggestion = aiData.suggestions[index];
      
      if (aiSuggestion) {
        return {
          ...original,
          aiEnhanced: true,
          blocks: {
            problem: aiSuggestion.problem || `⚠️ ${original.message || 'Problema detectado'}`,
            cause: aiSuggestion.cause || '🎯 Análise em andamento',
            solution: aiSuggestion.solution || `🛠️ ${original.action || 'Solução recomendada'}`,
            tip: aiSuggestion.tip || '💡 Monitore o resultado em diferentes sistemas'
          },
          metadata: {
            priority: aiSuggestion.priority || 'média',
            difficulty: aiSuggestion.difficulty || 'intermediário',
            enhanced: true
          }
        };
      }

      // Fallback para sugestão original sem IA
      return {
        ...original,
        aiEnhanced: false,
        blocks: {
          problem: `⚠️ ${original.message || 'Problema detectado'}`,
          cause: '🎯 Requer análise técnica',
          solution: `🛠️ ${original.action || 'Solução recomendada'}`,
          tip: '💡 Verifique o resultado em sistemas de monitoração'
        },
        metadata: {
          priority: 'média',
          difficulty: 'intermediário',
          enhanced: false
        }
      };
    });

    return enhanced;

  } catch (error) {
    console.error("❌ Erro ao processar resposta da IA:", error.message);
    
    // Fallback: retornar sugestões originais com estrutura básica
    return originalSuggestions.map(original => ({
      ...original,
      aiEnhanced: false,
      blocks: {
        problem: `⚠️ ${original.message || 'Problema detectado'}`,
        cause: '🎯 Análise automática',
        solution: `🛠️ ${original.action || 'Ajuste recomendado'}`,
        tip: '💡 Teste em diferentes sistemas de áudio'
      },
      metadata: {
        priority: 'média',
        difficulty: 'intermediário',
        enhanced: false
      }
    }));
  }
}

// ---------- Rotas existentes ----------
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// ---------- Rota para gerar URL pré-assinada ----------
app.get("/api/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;

    // Validação dos parâmetros obrigatórios
    if (!ext || !contentType) {
      return res.status(400).json({ 
        error: "Parâmetros 'ext' e 'contentType' são obrigatórios" 
      });
    }

    // Validação da extensão
    const allowedExtensions = ['mp3', 'wav', 'flac', 'm4a'];
    if (!allowedExtensions.includes(ext.toLowerCase())) {
      return res.status(400).json({ 
        error: `Extensão '${ext}' não permitida. Use: ${allowedExtensions.join(', ')}` 
      });
    }

    // Gerar fileKey único
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileKey = `uploads/audio_${timestamp}_${randomId}.${ext}`;

    // Parâmetros para URL pré-assinada
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Expires: 600, // 10 minutos
    };

    // Gerar URL pré-assinada
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

    console.log(`✅ URL pré-assinada gerada: ${fileKey}`);

    res.json({
      uploadUrl,
      fileKey
    });

  } catch (err) {
    console.error("❌ Erro ao gerar URL pré-assinada:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/test", async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      ["uploads/teste.mp3", "queued"]
    );
    console.log("✅ Job inserido:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao inserir job:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Nenhum arquivo enviado ou tipo inválido." });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const data = await s3.upload(params).promise();
    console.log("✅ Upload concluído:", key);

    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      [key, "queued"]
    );

    res.json({
      message: "Arquivo enviado e job criado!",
      fileUrl: `https://s3.us-east-005.backblazeb2.com/${BUCKET_NAME}/${key}`,
      job: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Erro no upload:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
