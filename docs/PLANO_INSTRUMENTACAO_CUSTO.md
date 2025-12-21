# 📊 PLANO DE INSTRUMENTAÇÃO DE CUSTOS - SoundyAI

**Objetivo:** Implementar telemetria completa de tokens/custos para **visibilidade 100%** dos gastos OpenAI em produção.

**Data:** 21 de dezembro de 2025  
**Prioridade:** 🔴 **P0 - CRÍTICO**  
**Status:** ⚠️ **NÃO IMPLEMENTADO** (zero telemetria ativa)

---

## 🎯 PROBLEMA ATUAL

**ZERO visibilidade de custos reais.**

Sem telemetria:
- ❌ Não sabemos o custo real por usuário
- ❌ Não sabemos qual endpoint consome mais
- ❌ Não conseguimos detectar abuso
- ❌ Não conseguimos otimizar prompts com dados
- ❌ Não conseguimos validar pricing
- ❌ Risco de fatura surpresa da OpenAI

**Consequência:** Operar "no escuro", risco financeiro alto.

---

## 📋 SOLUÇÃO: 3 CAMADAS DE INSTRUMENTAÇÃO

### Camada 1: Logging de Tokens (OBRIGATÓRIO)
### Camada 2: Armazenamento Estruturado (OBRIGATÓRIO)
### Camada 3: Dashboard & Alertas (RECOMENDADO)

---

## 🔧 CAMADA 1: LOGGING DE TOKENS

### O Que Logar (Todos os Campos)

```javascript
{
  // Identificação
  timestamp: Date.now(),
  requestId: string,           // UUID único por request
  userId: string,              // UID Firebase
  userEmail: string,           // Email do usuário
  userPlan: string,            // 'free', 'plus', 'pro'
  
  // Contexto da Operação
  endpoint: string,            // 'chat', 'enrichment', 'voice'
  operationType: string,       // 'text_simple', 'text_complex', 'image', 'enrichment', 'voice'
  model: string,               // 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini', 'whisper-1'
  
  // Métricas de Tokens
  promptTokens: number,        // usage.prompt_tokens
  completionTokens: number,    // usage.completion_tokens
  totalTokens: number,         // usage.total_tokens
  
  // Métricas de Custo (calculado)
  costInput: number,           // tokens * preço input
  costOutput: number,          // tokens * preço output
  costTotal: number,           // costInput + costOutput
  
  // Contexto Adicional
  hasImages: boolean,          // Se mensagem tem imagem
  imageCount: number,          // Número de imagens
  messageLength: number,       // Tamanho da mensagem (caracteres)
  conversationLength: number,  // Tamanho do histórico
  
  // Performance
  latency: number,             // Tempo de resposta (ms)
  success: boolean,            // Se request foi bem-sucedido
  errorCode: string | null,    // Código de erro se falhou
  
  // Metadata
  origin: string,              // 'web', 'mobile', 'api'
  version: string              // Versão da API
}
```

---

## 💻 IMPLEMENTAÇÃO: CÓDIGO COMPLETO

### 1. Criar Módulo de Telemetria

**Arquivo:** `work/lib/telemetry/openai-usage.js`

```javascript
// work/lib/telemetry/openai-usage.js
// Sistema de telemetria de custos OpenAI

import pg from 'pg';
const { Pool } = pg;

// ✅ Preços OpenAI (atualizar conforme necessário)
const OPENAI_PRICES = {
  'gpt-3.5-turbo': {
    input: 0.0000005,   // $0.50 por 1M tokens
    output: 0.0000015   // $1.50 por 1M tokens
  },
  'gpt-4o': {
    input: 0.0000025,   // $2.50 por 1M tokens
    output: 0.00001     // $10.00 por 1M tokens
  },
  'gpt-4o-mini': {
    input: 0.00000015,  // $0.15 por 1M tokens
    output: 0.0000006   // $0.60 por 1M tokens
  },
  'whisper-1': {
    perMinute: 0.006    // $0.006 por minuto
  }
};

// ✅ Pool Postgres (reusar conexão existente ou criar nova)
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

/**
 * ✅ FUNÇÃO PRINCIPAL: Logar uso da OpenAI
 * @param {Object} data - Dados do uso
 */
export async function logOpenAIUsage(data) {
  const startTime = Date.now();
  
  try {
    // Validar dados obrigatórios
    if (!data.model || !data.totalTokens) {
      console.warn('[TELEMETRY] ⚠️ Dados incompletos, ignorando log:', data);
      return;
    }

    // Calcular custos
    const pricing = OPENAI_PRICES[data.model];
    let costInput = 0;
    let costOutput = 0;
    let costTotal = 0;

    if (pricing) {
      if (data.model === 'whisper-1') {
        // Whisper cobra por minuto de áudio
        const minutes = data.audioDuration || 0.5; // Default 30s
        costTotal = minutes * pricing.perMinute;
      } else {
        // Modelos de chat/completion
        costInput = (data.promptTokens || 0) * pricing.input;
        costOutput = (data.completionTokens || 0) * pricing.output;
        costTotal = costInput + costOutput;
      }
    } else {
      console.warn('[TELEMETRY] ⚠️ Modelo sem pricing:', data.model);
    }

    // Preparar dados para inserção
    const record = {
      timestamp: new Date(),
      request_id: data.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      user_id: data.userId || 'anonymous',
      user_email: data.userEmail || null,
      user_plan: data.userPlan || 'free',
      endpoint: data.endpoint || 'unknown',
      operation_type: data.operationType || 'text',
      model: data.model,
      prompt_tokens: data.promptTokens || 0,
      completion_tokens: data.completionTokens || 0,
      total_tokens: data.totalTokens,
      cost_input: costInput,
      cost_output: costOutput,
      cost_total: costTotal,
      has_images: data.hasImages || false,
      image_count: data.imageCount || 0,
      message_length: data.messageLength || 0,
      conversation_length: data.conversationLength || 0,
      latency_ms: data.latency || 0,
      success: data.success !== false, // Default true
      error_code: data.errorCode || null,
      origin: data.origin || 'web',
      version: data.version || '1.0'
    };

    // Inserir no banco
    const db = getPool();
    const query = `
      INSERT INTO openai_usage (
        timestamp, request_id, user_id, user_email, user_plan,
        endpoint, operation_type, model,
        prompt_tokens, completion_tokens, total_tokens,
        cost_input, cost_output, cost_total,
        has_images, image_count, message_length, conversation_length,
        latency_ms, success, error_code, origin, version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
    `;

    const values = [
      record.timestamp, record.request_id, record.user_id, record.user_email, record.user_plan,
      record.endpoint, record.operation_type, record.model,
      record.prompt_tokens, record.completion_tokens, record.total_tokens,
      record.cost_input, record.cost_output, record.cost_total,
      record.has_images, record.image_count, record.message_length, record.conversation_length,
      record.latency_ms, record.success, record.error_code, record.origin, record.version
    ];

    await db.query(query, values);

    const elapsed = Date.now() - startTime;
    console.log(`✅ [TELEMETRY] Uso registrado: ${record.model} | ${record.total_tokens} tokens | $${costTotal.toFixed(6)} | UID=${record.user_id} (${elapsed}ms)`);

    // ✅ ALERTA: Se custo alto, logar warning
    if (costTotal > 0.05) {
      console.warn(`🚨 [TELEMETRY] CUSTO ALTO DETECTADO: $${costTotal.toFixed(4)} | User=${record.user_id} | Model=${record.model}`);
    }

    return record;

  } catch (error) {
    console.error('[TELEMETRY] ❌ Erro ao logar uso:', error.message);
    // Não falhar a request por erro de telemetria
    return null;
  }
}

/**
 * ✅ Obter custos agregados por usuário
 * @param {string} userId - UID do usuário
 * @param {number} days - Número de dias (default: 30)
 */
export async function getUserCosts(userId, days = 30) {
  try {
    const db = getPool();
    const query = `
      SELECT
        user_id,
        user_plan,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_total) as total_cost,
        SUM(CASE WHEN has_images THEN 1 ELSE 0 END) as image_requests,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests
      FROM openai_usage
      WHERE user_id = $1
        AND timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY user_id, user_plan
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;

  } catch (error) {
    console.error('[TELEMETRY] ❌ Erro ao buscar custos:', error.message);
    return null;
  }
}

/**
 * ✅ Obter custos agregados diários (toda plataforma)
 * @param {number} days - Número de dias (default: 7)
 */
export async function getDailyCosts(days = 7) {
  try {
    const db = getPool();
    const query = `
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_total) as total_cost,
        COUNT(DISTINCT user_id) as unique_users
      FROM openai_usage
      WHERE timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    const result = await db.query(query);
    return result.rows;

  } catch (error) {
    console.error('[TELEMETRY] ❌ Erro ao buscar custos diários:', error.message);
    return [];
  }
}

/**
 * ✅ Detectar usuários com uso anômalo (potencial abuso)
 * @param {number} threshold - Custo threshold (default: $10/dia)
 */
export async function detectAnomalousUsers(threshold = 10) {
  try {
    const db = getPool();
    const query = `
      SELECT
        user_id,
        user_email,
        user_plan,
        DATE(timestamp) as date,
        COUNT(*) as requests_today,
        SUM(total_tokens) as tokens_today,
        SUM(cost_total) as cost_today
      FROM openai_usage
      WHERE timestamp > NOW() - INTERVAL '1 day'
      GROUP BY user_id, user_email, user_plan, DATE(timestamp)
      HAVING SUM(cost_total) > $1
      ORDER BY cost_today DESC
    `;

    const result = await db.query(query, [threshold]);
    
    if (result.rows.length > 0) {
      console.warn(`🚨 [TELEMETRY] ${result.rows.length} usuário(s) com uso anômalo detectado(s)!`);
      result.rows.forEach(row => {
        console.warn(`  - ${row.user_email || row.user_id}: $${row.cost_today.toFixed(2)} (${row.requests_today} requests)`);
      });
    }

    return result.rows;

  } catch (error) {
    console.error('[TELEMETRY] ❌ Erro ao detectar anomalias:', error.message);
    return [];
  }
}

export default {
  logOpenAIUsage,
  getUserCosts,
  getDailyCosts,
  detectAnomalousUsers
};
```

---

### 2. Criar Tabela no Postgres

**Executar Migration:**

```sql
-- Migration: Criar tabela openai_usage
-- Data: 2025-12-21
-- Objetivo: Telemetria de custos OpenAI

CREATE TABLE IF NOT EXISTS openai_usage (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id VARCHAR(100) NOT NULL UNIQUE,
  
  -- Usuário
  user_id VARCHAR(100) NOT NULL,
  user_email VARCHAR(255),
  user_plan VARCHAR(20) NOT NULL,
  
  -- Contexto
  endpoint VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  
  -- Tokens
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL,
  
  -- Custos (USD)
  cost_input DECIMAL(10, 8) NOT NULL DEFAULT 0,
  cost_output DECIMAL(10, 8) NOT NULL DEFAULT 0,
  cost_total DECIMAL(10, 8) NOT NULL,
  
  -- Contexto Adicional
  has_images BOOLEAN DEFAULT FALSE,
  image_count INTEGER DEFAULT 0,
  message_length INTEGER DEFAULT 0,
  conversation_length INTEGER DEFAULT 0,
  
  -- Performance
  latency_ms INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_code VARCHAR(100),
  
  -- Metadata
  origin VARCHAR(20) DEFAULT 'web',
  version VARCHAR(20) DEFAULT '1.0',
  
  -- Índices para queries rápidas
  CONSTRAINT openai_usage_request_id_key UNIQUE (request_id)
);

-- Índices para otimização
CREATE INDEX idx_openai_usage_user_id ON openai_usage(user_id);
CREATE INDEX idx_openai_usage_timestamp ON openai_usage(timestamp DESC);
CREATE INDEX idx_openai_usage_user_timestamp ON openai_usage(user_id, timestamp DESC);
CREATE INDEX idx_openai_usage_endpoint ON openai_usage(endpoint);
CREATE INDEX idx_openai_usage_model ON openai_usage(model);
CREATE INDEX idx_openai_usage_cost_total ON openai_usage(cost_total DESC);

-- Comentários
COMMENT ON TABLE openai_usage IS 'Telemetria de uso e custos da OpenAI API';
COMMENT ON COLUMN openai_usage.cost_total IS 'Custo total em USD (input + output)';
COMMENT ON COLUMN openai_usage.request_id IS 'UUID único por request para deduplicação';
```

---

### 3. Integrar no Código (Chat)

**Arquivo:** `work/api/chat.js`

**Localização:** Logo após receber resposta da OpenAI (linha ~950)

```javascript
// work/api/chat.js
// ✅ ADICIONAR IMPORT NO TOPO DO ARQUIVO
import { logOpenAIUsage } from '../lib/telemetry/openai-usage.js';

// ... código existente ...

// ✅ APÓS RECEBER RESPOSTA DA OPENAI (linha ~950)
// Chamar API da OpenAI
const requestStartTime = Date.now(); // ✅ ADICIONAR ANTES DO FETCH

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  signal: controller.signal,
  body: JSON.stringify({
    model: modelSelection.model,
    messages: messages,
    max_tokens: modelSelection.maxTokens,
    temperature: modelSelection.temperature,
  }),
});

clearTimeout(timeoutId);

if (!response.ok) {
  const errorText = await response.text();
  console.error(`❌ OpenAI API error: ${response.status}`, errorText);
  
  // ✅ LOGAR ERRO DE TELEMETRIA
  await logOpenAIUsage({
    requestId: requestId,
    userId: uid,
    userEmail: email,
    userPlan: userData.plan || 'free',
    endpoint: 'chat',
    operationType: hasImages ? 'image' : (modelSelection.model === 'gpt-4o' ? 'text_complex' : 'text_simple'),
    model: modelSelection.model,
    totalTokens: 0,
    success: false,
    errorCode: `OPENAI_ERROR_${response.status}`,
    latency: Date.now() - requestStartTime,
    hasImages: hasImages,
    imageCount: images?.length || 0,
    messageLength: message.length,
    conversationLength: conversationHistory.length
  });
  
  return sendResponse(502, { error: 'AI_ERROR', message: 'Erro ao processar solicitação' });
}

const data = await response.json();
const requestEndTime = Date.now();
const requestLatency = requestEndTime - requestStartTime;

// ✅ LOGAR TELEMETRIA DE SUCESSO
await logOpenAIUsage({
  requestId: requestId,
  userId: uid,
  userEmail: email,
  userPlan: userData.plan || 'free',
  endpoint: 'chat',
  operationType: hasImages ? 'image' : (modelSelection.model === 'gpt-4o' ? 'text_complex' : 'text_simple'),
  model: modelSelection.model,
  promptTokens: data.usage?.prompt_tokens || 0,
  completionTokens: data.usage?.completion_tokens || 0,
  totalTokens: data.usage?.total_tokens || 0,
  success: true,
  errorCode: null,
  latency: requestLatency,
  hasImages: hasImages,
  imageCount: images?.length || 0,
  messageLength: message.length,
  conversationLength: conversationHistory.length
});

console.log(`✅ [${requestId}] Tokens usados:`, {
  prompt: data.usage?.prompt_tokens,
  completion: data.usage?.completion_tokens,
  total: data.usage?.total_tokens,
  model: modelSelection.model
});

// ... resto do código ...
```

---

### 4. Integrar no Código (Enrichment)

**Arquivo:** `work/lib/ai/suggestion-enricher.js`

**Localização:** Logo após receber resposta da OpenAI (linha ~129)

```javascript
// work/lib/ai/suggestion-enricher.js
// ✅ ADICIONAR IMPORT NO TOPO DO ARQUIVO
import { logOpenAIUsage } from '../telemetry/openai-usage.js';

// ... código existente (linha ~86) ...

const requestStartTime = Date.now(); // ✅ ADICIONAR ANTES DO FETCH

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  // ... configuração existente ...
});

const data = await response.json();

// ✅ ADICIONAR APÓS PARSING (linha ~129)
console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Resposta recebida da OpenAI API');
console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Tokens usados:', {
  prompt: data.usage?.prompt_tokens,
  completion: data.usage?.completion_tokens,
  total: data.usage?.total_tokens
});

// ✅ LOGAR TELEMETRIA
await logOpenAIUsage({
  requestId: `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  userId: context.userId || 'system', // Pegar do contexto se disponível
  userEmail: context.userEmail || null,
  userPlan: context.userPlan || 'unknown',
  endpoint: 'enrichment',
  operationType: 'enrichment',
  model: 'gpt-4o-mini',
  promptTokens: data.usage?.prompt_tokens || 0,
  completionTokens: data.usage?.completion_tokens || 0,
  totalTokens: data.usage?.total_tokens || 0,
  success: true,
  errorCode: null,
  latency: Date.now() - requestStartTime,
  hasImages: false,
  imageCount: 0,
  messageLength: prompt.length,
  conversationLength: suggestions.length
});

// ... resto do código ...
```

---

### 5. Integrar no Código (Voice)

**Arquivo:** `work/api/voice-message.js`

**Localização:** Após transcrição Whisper e resposta GPT-3.5 (linhas ~150 e ~280)

```javascript
// work/api/voice-message.js
// ✅ ADICIONAR IMPORT NO TOPO DO ARQUIVO
import { logOpenAIUsage } from '../lib/telemetry/openai-usage.js';

// ... código existente ...

// ✅ APÓS TRANSCRIÇÃO WHISPER (linha ~150)
const transcriptionStartTime = Date.now();

const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  // ... configuração existente ...
});

const transcriptionData = await transcriptionResponse.json();
const audioDuration = audioBuffer.length / (16000 * 2); // Estimativa (16kHz, 16-bit)

// ✅ LOGAR TELEMETRIA WHISPER
await logOpenAIUsage({
  requestId: `voice_whisper_${Date.now()}`,
  userId: uid,
  userEmail: email,
  userPlan: userData.plan || 'free',
  endpoint: 'voice',
  operationType: 'transcription',
  model: 'whisper-1',
  audioDuration: audioDuration,
  totalTokens: 0, // Whisper não usa tokens
  success: true,
  latency: Date.now() - transcriptionStartTime
});

// ✅ APÓS RESPOSTA GPT-3.5 (linha ~280)
const chatStartTime = Date.now();

const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  // ... configuração existente ...
});

const chatData = await chatResponse.json();

// ✅ LOGAR TELEMETRIA CHAT
await logOpenAIUsage({
  requestId: `voice_chat_${Date.now()}`,
  userId: uid,
  userEmail: email,
  userPlan: userData.plan || 'free',
  endpoint: 'voice',
  operationType: 'voice_response',
  model: 'gpt-3.5-turbo',
  promptTokens: chatData.usage?.prompt_tokens || 0,
  completionTokens: chatData.usage?.completion_tokens || 0,
  totalTokens: chatData.usage?.total_tokens || 0,
  success: true,
  latency: Date.now() - chatStartTime
});

// ... resto do código ...
```

---

## 📊 CAMADA 3: DASHBOARD & ALERTAS

### Opção A: Dashboard Simples (Node.js + Express)

**Criar endpoint admin:**

```javascript
// work/api/admin/costs-dashboard.js
import { getDailyCosts, detectAnomalousUsers } from '../../lib/telemetry/openai-usage.js';

export default async function handler(req, res) {
  // ✅ AUTENTICAÇÃO ADMIN (implementar)
  // if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  
  try {
    const dailyCosts = await getDailyCosts(7);
    const anomalousUsers = await detectAnomalousUsers(5); // Threshold $5/dia
    
    const totalCostLast7Days = dailyCosts.reduce((sum, day) => sum + parseFloat(day.total_cost), 0);
    const avgCostPerDay = totalCostLast7Days / 7;
    
    return res.status(200).json({
      summary: {
        totalCostLast7Days: totalCostLast7Days.toFixed(2),
        avgCostPerDay: avgCostPerDay.toFixed(2),
        anomalousUsersCount: anomalousUsers.length
      },
      dailyCosts: dailyCosts,
      anomalousUsers: anomalousUsers
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar dashboard:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

**Frontend (HTML simples):**

```html
<!-- public/admin/costs.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard de Custos - SoundyAI</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 8px; }
    .metric { font-size: 24px; font-weight: bold; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; }
    .alert { background-color: #fee; color: #c00; padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>📊 Dashboard de Custos OpenAI</h1>
  
  <div class="card">
    <h2>Resumo (Últimos 7 dias)</h2>
    <p>Total: $<span id="totalCost" class="metric">0.00</span></p>
    <p>Média/Dia: $<span id="avgCost">0.00</span></p>
    <p>Usuários Anômalos: <span id="anomalousCount">0</span></p>
  </div>
  
  <div class="card">
    <h2>Custos Diários</h2>
    <table id="dailyTable">
      <thead>
        <tr>
          <th>Data</th>
          <th>Requests</th>
          <th>Tokens</th>
          <th>Custo</th>
          <th>Usuários</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
  
  <div class="card">
    <h2>⚠️ Usuários com Uso Anômalo</h2>
    <div id="anomalousUsers"></div>
  </div>
  
  <script>
    async function loadDashboard() {
      try {
        const response = await fetch('/api/admin/costs-dashboard');
        const data = await response.json();
        
        // Atualizar resumo
        document.getElementById('totalCost').textContent = data.summary.totalCostLast7Days;
        document.getElementById('avgCost').textContent = data.summary.avgCostPerDay;
        document.getElementById('anomalousCount').textContent = data.summary.anomalousUsersCount;
        
        // Atualizar tabela diária
        const tbody = document.querySelector('#dailyTable tbody');
        tbody.innerHTML = data.dailyCosts.map(day => `
          <tr>
            <td>${day.date}</td>
            <td>${day.total_requests}</td>
            <td>${day.total_tokens.toLocaleString()}</td>
            <td>$${parseFloat(day.total_cost).toFixed(2)}</td>
            <td>${day.unique_users}</td>
          </tr>
        `).join('');
        
        // Atualizar usuários anômalos
        const anomalousDiv = document.getElementById('anomalousUsers');
        if (data.anomalousUsers.length === 0) {
          anomalousDiv.innerHTML = '<p>✅ Nenhum usuário anômalo detectado.</p>';
        } else {
          anomalousDiv.innerHTML = data.anomalousUsers.map(user => `
            <div class="alert">
              <strong>${user.user_email || user.user_id}</strong> (${user.user_plan})<br>
              ${user.requests_today} requests | ${user.tokens_today.toLocaleString()} tokens | $${parseFloat(user.cost_today).toFixed(2)}
            </div>
          `).join('');
        }
        
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        alert('Erro ao carregar dados. Verifique console.');
      }
    }
    
    loadDashboard();
    setInterval(loadDashboard, 60000); // Atualizar a cada 1 minuto
  </script>
</body>
</html>
```

---

### Opção B: Alertas Automáticos (Cron Job)

**Arquivo:** `work/lib/telemetry/cost-alerts.js`

```javascript
// work/lib/telemetry/cost-alerts.js
// Sistema de alertas de custo

import { getDailyCosts, detectAnomalousUsers } from './openai-usage.js';

// ✅ Configuração de alertas
const ALERT_THRESHOLDS = {
  dailyCostWarning: 50,    // $50/dia = alerta
  dailyCostCritical: 100,  // $100/dia = crítico
  userAnomalyThreshold: 10 // $10/dia por usuário
};

/**
 * ✅ Verificar custos e enviar alertas se necessário
 */
export async function checkCostsAndAlert() {
  try {
    console.log('[COST-ALERT] 🔍 Verificando custos...');
    
    // Obter custos de hoje
    const dailyCosts = await getDailyCosts(1);
    const todayCost = dailyCosts[0] ? parseFloat(dailyCosts[0].total_cost) : 0;
    
    console.log(`[COST-ALERT] Custo hoje: $${todayCost.toFixed(2)}`);
    
    // Alertar se ultrapassou threshold
    if (todayCost >= ALERT_THRESHOLDS.dailyCostCritical) {
      await sendAlert('CRITICAL', `🚨 CUSTO CRÍTICO: $${todayCost.toFixed(2)} hoje! Limite: $${ALERT_THRESHOLDS.dailyCostCritical}`);
    } else if (todayCost >= ALERT_THRESHOLDS.dailyCostWarning) {
      await sendAlert('WARNING', `⚠️ Custo alto: $${todayCost.toFixed(2)} hoje. Monitorar.`);
    } else {
      console.log('[COST-ALERT] ✅ Custo dentro do normal.');
    }
    
    // Verificar usuários anômalos
    const anomalousUsers = await detectAnomalousUsers(ALERT_THRESHOLDS.userAnomalyThreshold);
    
    if (anomalousUsers.length > 0) {
      const message = `🚨 ${anomalousUsers.length} usuário(s) com uso anômalo:\n` +
        anomalousUsers.map(u => `  - ${u.user_email}: $${u.cost_today.toFixed(2)}`).join('\n');
      await sendAlert('WARNING', message);
    }
    
  } catch (error) {
    console.error('[COST-ALERT] ❌ Erro ao verificar custos:', error.message);
  }
}

/**
 * ✅ Enviar alerta (email, Slack, etc)
 * @param {string} level - 'WARNING' ou 'CRITICAL'
 * @param {string} message - Mensagem do alerta
 */
async function sendAlert(level, message) {
  console.log(`[COST-ALERT] ${level}: ${message}`);
  
  // TODO: Implementar envio de email/Slack
  // Opções:
  // 1. SendGrid/Mailgun (email)
  // 2. Slack Webhook
  // 3. Discord Webhook
  // 4. SMS (Twilio)
  
  // Exemplo: Slack Webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[SoundyAI - ${level}]\n${message}`,
          username: 'Cost Alert Bot',
          icon_emoji: level === 'CRITICAL' ? ':rotating_light:' : ':warning:'
        })
      });
      console.log('[COST-ALERT] ✅ Alerta enviado para Slack');
    } catch (error) {
      console.error('[COST-ALERT] ❌ Erro ao enviar Slack:', error.message);
    }
  }
}

// ✅ Exportar para uso em cron
export default { checkCostsAndAlert };
```

**Configurar Cron Job (Node-Cron):**

```javascript
// work/server.js (ou arquivo principal)
import cron from 'node-cron';
import { checkCostsAndAlert } from './lib/telemetry/cost-alerts.js';

// Executar a cada 1 hora
cron.schedule('0 * * * *', async () => {
  console.log('⏰ [CRON] Executando verificação de custos...');
  await checkCostsAndAlert();
});

console.log('✅ Cron job de alertas de custo ativado (a cada 1 hora)');
```

---

## 🎯 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Setup (1-2 dias)

- [ ] Criar arquivo `work/lib/telemetry/openai-usage.js`
- [ ] Executar migration no Postgres (criar tabela `openai_usage`)
- [ ] Testar inserção manual na tabela
- [ ] Validar índices (performance)

### Fase 2: Integração (2-3 dias)

- [ ] Integrar em `work/api/chat.js` (todas as chamadas)
- [ ] Integrar em `work/lib/ai/suggestion-enricher.js`
- [ ] Integrar em `work/api/voice-message.js`
- [ ] Testar end-to-end (verificar logs no Postgres)

### Fase 3: Dashboard (3-4 dias)

- [ ] Criar endpoint `work/api/admin/costs-dashboard.js`
- [ ] Criar HTML `public/admin/costs.html`
- [ ] Implementar autenticação admin
- [ ] Deploy e teste em produção

### Fase 4: Alertas (1-2 dias)

- [ ] Criar `work/lib/telemetry/cost-alerts.js`
- [ ] Configurar Slack webhook (ou email)
- [ ] Ativar cron job (node-cron)
- [ ] Testar alerta manualmente

### Fase 5: Análise (Contínuo)

- [ ] Coletar 7 dias de dados
- [ ] Analisar padrões de uso
- [ ] Validar estimativas do documento principal
- [ ] Ajustar preços/limites se necessário

---

## 🔍 QUERIES ÚTEIS (Análise Manual)

### 1. Top 10 usuários por custo (último mês)

```sql
SELECT
  user_id,
  user_email,
  user_plan,
  COUNT(*) as total_requests,
  SUM(total_tokens) as total_tokens,
  SUM(cost_total) as total_cost
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY user_id, user_email, user_plan
ORDER BY total_cost DESC
LIMIT 10;
```

### 2. Custo por modelo (últimos 7 dias)

```sql
SELECT
  model,
  COUNT(*) as requests,
  SUM(total_tokens) as total_tokens,
  SUM(cost_total) as total_cost,
  AVG(cost_total) as avg_cost_per_request
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY model
ORDER BY total_cost DESC;
```

### 3. Taxa de sucesso por endpoint

```sql
SELECT
  endpoint,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY endpoint;
```

### 4. Custo por plano (comparativo)

```sql
SELECT
  user_plan,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_requests,
  SUM(cost_total) as total_cost,
  AVG(cost_total) as avg_cost_per_request,
  SUM(cost_total) / COUNT(DISTINCT user_id) as cost_per_user
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY user_plan
ORDER BY cost_per_user DESC;
```

### 5. Horários de pico (uso por hora)

```sql
SELECT
  EXTRACT(HOUR FROM timestamp) as hour,
  COUNT(*) as requests,
  SUM(cost_total) as cost,
  AVG(latency_ms) as avg_latency
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Implementar Fase 1** (Setup) - **URGENTE**
2. Coletar 14 dias de dados reais
3. Analisar resultados vs estimativas
4. Ajustar pricing/limites
5. Otimizar prompts baseado em dados
6. Rever estratégia trimestralmente

---

## 📞 SUPORTE

**Dúvidas sobre implementação:**
- Revisar código-fonte deste documento
- Consultar documentação OpenAI: https://platform.openai.com/docs/guides/usage-tracking
- Verificar documentação Postgres: https://www.postgresql.org/docs/

**Ferramentas Auxiliares:**
- Node-Cron: https://github.com/node-cron/node-cron
- Slack Webhooks: https://api.slack.com/messaging/webhooks
- SendGrid (email): https://sendgrid.com/

---

**Fim do Plano de Instrumentação**  
**Status:** Aguardando implementação  
**Prioridade:** 🔴 P0 - CRÍTICO
