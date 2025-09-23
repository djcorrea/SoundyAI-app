// api/routes/enrich.js
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * 🤖 Rota de enriquecimento de sugestões com IA
 * POST /api/enrich-suggestions
 */
router.post('/enrich-suggestions', async (req, res) => {
    try {
        const { suggestions } = req.body;
        
        console.log(`🚀 [ENRICH-API] Recebidas ${suggestions?.length || 0} sugestões para enriquecimento`);
        
        // Validação de entrada
        if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            console.warn('⚠️ [ENRICH-API] Lista de sugestões inválida ou vazia');
            return res.status(400).json({ 
                ok: false,
                error: "Lista de sugestões é obrigatória e não pode estar vazia",
                received: suggestions
            });
        }
        
        // Verificar API Key
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
            console.error('❌ [ENRICH-API] OpenAI API Key não configurada');
            return res.status(500).json({
                ok: false,
                error: 'API Key da IA não está configurada no servidor'
            });
        }
        
        console.log(`🤖 [ENRICH-API] Processando ${suggestions.length} sugestões com IA...`);
        
        // Construir prompt do sistema
        const systemPrompt = `Você é um engenheiro de mixagem que pega problemas técnicos de áudio e transforma em sugestões claras, educativas e acionáveis. Sempre explique brevemente a causa, traga ações práticas (passo-a-passo) e, quando possível, exemplos em DAWs populares. Seja educado, não tao rígido, o objetivo é o usuario enteder os problemas identificados no audio e como aplciar a correção na daw que ele usa.

Retorne SEMPRE um JSON válido com este formato EXATO:
{
  "suggestions": [
    {
      ...dadosOriginais,
      "ai": {
        "title": "📊 Título curto e claro",
        "explanation": "Breve explicação da causa do problema",
        "actions": ["Passo 1 detalhado", "Passo 2 específico", "Passo 3 prático"],
        "dawExamples": {
          "FL": "Exemplo específico no FL Studio",
          "Ableton": "Exemplo específico no Ableton Live", 
          "Logic": "Exemplo específico no Logic Pro"
        },
        "severity": "Baixa|Média|Alta",
        "priority": 1
      }
    }
  ]
}`;
        
        // Construir prompt do usuário
        const userPrompt = `Analise estas sugestões técnicas de áudio e enriqueça cada uma:

${JSON.stringify(suggestions, null, 2)}

IMPORTANTE: 
- Preserve TODOS os campos originais de cada sugestão
- Adicione apenas o campo "ai" com o enriquecimento
- Mantenha o JSON válido
- Seja prático e educativo`;
        
        // Chamar OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('❌ [ENRICH-API] Erro na API OpenAI:', openaiResponse.status, errorText);
            return res.status(500).json({
                ok: false,
                error: `Erro na IA: ${openaiResponse.status}`
            });
        }
        
        const openaiData = await openaiResponse.json();
        const aiContent = openaiData.choices?.[0]?.message?.content;
        
        if (!aiContent) {
            console.error('❌ [ENRICH-API] IA não retornou conteúdo válido');
            return res.status(500).json({
                ok: false,
                error: 'IA não retornou resposta válida'
            });
        }
        
        console.log('🧠 [ENRICH-API] Resposta bruta da IA:', aiContent.substring(0, 200) + '...');
        
        // Parse do JSON retornado pela IA
        let enrichedData;
        try {
            // Limpar possíveis caracteres inválidos
            const cleanContent = aiContent.trim();
            enrichedData = JSON.parse(cleanContent);
        } catch (parseError) {
            console.error('❌ [ENRICH-API] Erro ao parsear JSON da IA:', parseError.message);
            console.error('Conteúdo recebido:', aiContent);
            return res.status(500).json({
                ok: false,
                error: 'IA retornou JSON inválido'
            });
        }
        
        // Validar estrutura da resposta
        if (!enrichedData?.suggestions || !Array.isArray(enrichedData.suggestions)) {
            console.error('❌ [ENRICH-API] Estrutura de resposta inválida');
            return res.status(500).json({
                ok: false,
                error: 'IA retornou estrutura inválida'
            });
        }
        
        console.log(`✅ [ENRICH-API] Processamento concluído: ${enrichedData.suggestions.length} sugestões enriquecidas`);
        
        // Resposta padronizada
        return res.json({
            ok: true,
            count: enrichedData.suggestions.length,
            suggestions: enrichedData.suggestions
        });
        
    } catch (error) {
        console.error('❌ [ENRICH-API] Erro interno:', error);
        return res.status(500).json({
            ok: false,
            error: 'Erro interno do servidor'
        });
    }
});

export default router;