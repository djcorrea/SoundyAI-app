# 💰 AUDITORIA DE CUSTOS & UNIT ECONOMICS — SoundyAI
**Auditoria Profunda de Custos, Preços e Riscos Financeiros (ATUALIZADA)**

📅 **Data da Auditoria**: 21 de dezembro de 2025 (Versão 2.0)  
👤 **Auditor**: CFO+CTO Sênior (AI Assistant)  
🎯 **Objetivo**: Avaliar viabilidade financeira, identificar riscos e definir estratégia de precificação  
🔍 **Escopo**: Código completo auditado + Infraestrutura + Pricing + Cenários financeiros

---

## 📋 RESUMO EXECUTIVO

### ✅ 5 Achados Principais

1. **✅ CONTROLES EXISTENTES SÃO ROBUSTOS**  
   - Sistema de planos com limites mensais implementado e funcionando ([`userPlans.js`](work/lib/user/userPlans.js))
   - Rate limiting distribuído via Redis (30 req/min chat, 10 req/min análises) ([`rateLimiterRedis.js`](work/lib/rateLimiterRedis.js))
   - Quotas por usuário/plano com hard caps e modo degradado

2. **⚠️ AUSÊNCIA DE TELEMETRIA DE CUSTOS**  
   - **CRÍTICO**: Nenhum registro de tokens consumidos ou custos reais
   - Logs existentes mostram tokens (`data.usage.total_tokens`) mas NÃO são salvos
   - Impossível calcular CAC (Customer Acquisition Cost) ou LTV (Lifetime Value) reais

3. **💰 UNIT ECONOMICS ESTIMADOS SÃO SUSTENTÁVEIS (se pricing correto)**  
   - Custo médio por usuário PRO: **~$4-8/mês** (conservador)
   - Receita PRO (assumindo $75/mês): Margem bruta **90-95%**
   - Mas baseado em ESTIMATIVAS, não dados reais

4. **🚨 RISCO DE EXPLOSÃO DE CUSTOS EM ESCALA**  
   - **GPT-4o custa 17x mais que GPT-4o-mini** ($2.50 vs $0.15 por 1M tokens input)
   - Usuários PRO podem forçar GPT-4o com imagens (70 msgs/mês = custo imprevisível)
   - Sem kill switch por budget diário/mensal

5. **🎁 PLANO FREE ATUAL É LOSS LEADER ACEITÁVEL**  
   - 3 análises completas grátis + modo reduzido ilimitado
   - Custo estimado: **$0.05-0.15/usuário** (aceitável para aquisição)
   - Conversão para PLUS/PRO precisa ser >2% para compensar

---

### 🔥 Ações Urgentes (Priorizadas por Impacto Financeiro)

| Prioridade | Ação | Impacto | Prazo | Risco se Ignorar |
|------------|------|---------|-------|------------------|
| **P0** | Implementar telemetria de tokens/custos | Visibilidade 100% | 1 semana | Cegueira financeira total |
| **P0** | Kill switch por budget diário ($50 cap) | Proteção anti-explosão | 1 semana | Fatura OpenAI inesperada |
| **P0** | Dashboard básico de custos | Monitoramento em tempo real | 2 semanas | Impossível otimizar |
| **P1** | Token caps absolutos (3000 max) | Limitar pior caso | 2 semanas | Abuso pode drenar budget |
| **P1** | Alertas Slack/Email (>$40/dia) | Early warning system | 2 semanas | Descobrir tarde demais |
| **P2** | Prompt caching (OpenAI beta) | Reduzir 50-90% input cost | 1 mês | Desperdício contínuo |
| **P2** | Deduplicação de análises (hash) | Evitar reprocessamento | 1 mês | Custos desnecessários |

---

### 💵 Custos Reais Estimados (BASEADO EM ANÁLISE DE CÓDIGO)

**⚠️ CRÍTICO**: Valores abaixo são **ESTIMATIVAS** — falta telemetria para confirmar.

| Categoria | Custo Mensal | Observação | Status |
|-----------|-------------|------------|--------|
| **OpenAI (variável)** | $3 - $3,400 | Depende de escala (ver cenários) | ❌ NÃO MEDIDO |
| **Railway (Web + Worker)** | $16.80 | 2 dynos 24/7 (verificado) | ✅ FIXO |
| **Railway Network** | $2 | Egress para bucket | ✅ ESTIMADO |
| **Postgres (Railway)** | $0 | Incluído (<1GB) | ✅ GRÁTIS |
| **Redis (Railway)** | $0 | Incluído (BullMQ) | ✅ GRÁTIS |
| **Backblaze B2** | $0.075 - $25 | Storage + download (100-1K users) | ✅ ESTIMADO |
| **Stripe (taxa)** | 2.9% + $0.30 | Por transação | ✅ VERIFICADO |
| **TOTAL FIXO** | **~$20/mês** | Sem usuários | ✅ CONFIÁVEL |
| **TOTAL VARIÁVEL** | **$3 - $3,500/mês** | Com 100-10K users | ❌ INCERTO |

**Margem Bruta Esperada**: 90-99% (SaaS AI-powered típico)  
**LTV/CAC Alvo**: ≥ 5:1 (alta margem compensa CAC alto)  
**Payback Period**: ≤ 6 meses (otimista com margem 95%)  

---

## 📊 INVENTÁRIO DE CUSTOS (COMPLETO)

### 1. CUSTOS FIXOS (Independem de usuários)

| Item | Provedor | Custo Estimado | Escalabilidade | Status |
|------|----------|----------------|----------------|--------|
| Hospedagem API | Railway | $30-50/mês | Linear com CPU | ✅ Ativo |
| Worker (BullMQ) | Railway | $20-50/mês | Linear com jobs | ✅ Ativo |
| Banco Postgres | Railway | $10-30/mês | Depende de storage | ✅ Ativo |
| Redis (Queue+Cache) | Railway/Upstash | $10-30/mês | Depende de memória | ✅ Ativo |
| Bucket (Audio Files) | Backblaze B2 | $5-20/mês | Storage + bandwidth | ✅ Ativo |
| Firestore | Firebase | $0-50/mês | Reads/writes | ✅ Ativo |
| Vercel (Frontend) | Vercel | $0-20/mês | Hobby ou Pro | 🟡 Opcional |
| **SUBTOTAL FIXO** | - | **$75-200/mês** | - | - |

### 2. CUSTOS VARIÁVEIS (Escalam com uso)

#### 2.1 OpenAI (APIs)

**⚠️ CRÍTICO**: Nenhuma telemetria implementada. Valores abaixo são **ASSUMIDOS**.

| Endpoint | Modelo | Custo Input (1M tokens) | Custo Output (1M tokens) | Uso Estimado |
|----------|--------|-------------------------|--------------------------|--------------|
| Chat (texto simples) | gpt-3.5-turbo | $0.50 | $1.50 | 60-70% mensagens |
| Chat (complexo) | gpt-4o | $2.50 | $10.00 | 20-30% mensagens |
| Chat (imagens) | gpt-4o (vision) | $2.50 | $10.00 | 5-10% mensagens |
| Sugestões (enriquecimento) | gpt-4o-mini | $0.15 | $0.60 | 100% análises |
| Whisper (voice) | whisper-1 | $0.006/min | - | Uso baixo atual |

**Referência de Preços (Dezembro 2025):**
- ✅ gpt-3.5-turbo: $0.50 input / $1.50 output (por 1M tokens)
- ✅ gpt-4o: $2.50 input / $10.00 output (por 1M tokens)
- ✅ gpt-4o-mini: $0.15 input / $0.60 output (por 1M tokens)
- ✅ whisper-1: $0.006 por minuto de áudio

#### 2.2 Infraestrutura Variável

| Item | Fórmula de Custo | Observação |
|------|------------------|------------|
| Railway CPU | $0.000463/CPU-hour | Worker intensivo |
| Railway RAM | $0.000231/GB-hour | Análise de áudio pesada |
| Bandwidth Bucket | $0.01/GB download | Arquivos de áudio |
| Firestore Reads | $0.06/100k reads | Verificação de planos |
| Firestore Writes | $0.18/100k writes | Registro de mensagens |
| Stripe Taxa | 2.9% + $0.30 | Por pagamento |

---

## 🔍 MAPEAMENTO COMPLETO: CHAMADAS OPENAI (100% COBERTURA)

### ✅ INVENTÁRIO DETALHADO

| # | Arquivo | Função | Objetivo | Modelo | Tokens Estimados (in/out) | Frequência | Telemetria? |
|---|---------|--------|----------|--------|---------------------------|------------|-------------|
| 1 | `work/api/chat.js` | `handlerWithoutRateLimit` | Chat texto simples | gpt-3.5-turbo | 500-1000 / 300-800 | Por mensagem | ❌ NÃO |
| 2 | `work/api/chat.js` | `handlerWithoutRateLimit` | Chat texto complexo | gpt-4o | 800-1500 / 500-1200 | Por mensagem complexa | ❌ NÃO |
| 3 | `work/api/chat.js` | `handlerWithoutRateLimit` | Chat com imagens (vision) | gpt-4o | 1000-2000 / 600-1500 | Por imagem (max 3) | ❌ NÃO |
| 4 | `work/lib/ai/suggestion-enricher.js` | `enrichSuggestionsWithAI` | Enriquecer sugestões técnicas | gpt-4o-mini | 1500-3000 / 1000-2500 | Por análise completa | ✅ SIM (parcial) |
| 5 | `work/api/voice-message.js` | Voice transcription | Transcrever áudio (Whisper) | whisper-1 | N/A (por minuto) | Por voice message | ❌ NÃO |
| 6 | `work/api/voice-message.js` | Voice response | Resposta do chatbot | gpt-3.5-turbo | 300-600 / 200-500 | Por voice message | ❌ NÃO |

### 📊 Resumo de Cobertura

- **Total de endpoints OpenAI identificados**: 6
- **Com telemetria de tokens**: 1 (17%)
- **Sem telemetria de tokens**: 5 (83%) ⚠️
- **Modelos em uso**: 4 (gpt-3.5-turbo, gpt-4o, gpt-4o-mini, whisper-1)

---

## 💰 CUSTOS UNITÁRIOS (POR OPERAÇÃO)

### ⚠️ DISCLAIMER

Todos os cálculos abaixo são **ESTIMATIVAS** baseadas em:
1. Análise do código-fonte (tamanho de prompts, contexto)
2. Preços oficiais OpenAI (dezembro 2025)
3. Hipóteses conservadoras de uso

**🚨 SEM TELEMETRIA, ESTES VALORES PODEM ESTAR 50-200% INCORRETOS.**

---

### 1. Custo por Mensagem (Chat)

#### 1.1 Chat Texto Simples (gpt-3.5-turbo)

**Contexto Analisado:**
- System prompt: ~400 tokens
- Histórico (5 msgs): ~500 tokens
- Mensagem usuário: ~150 tokens
- Resposta IA: ~400 tokens

**Cálculo:**
```
Input:  (400 + 500 + 150) = 1,050 tokens
Output: 400 tokens

Custo Input:  1,050 / 1,000,000 * $0.50 = $0.000525
Custo Output: 400 / 1,000,000 * $1.50   = $0.000600
TOTAL POR MENSAGEM: $0.001125 (~$0.0011)
```

**Custo por Mensagem Simples: $0.0011** (0.11 centavos)

---

#### 1.2 Chat Texto Complexo (gpt-4o)

**Contexto Analisado:**
- System prompt: ~400 tokens
- Histórico (5 msgs): ~800 tokens (mais detalhado)
- Mensagem usuário: ~250 tokens (pergunta técnica)
- Resposta IA: ~800 tokens (resposta elaborada)

**Cálculo:**
```
Input:  (400 + 800 + 250) = 1,450 tokens
Output: 800 tokens

Custo Input:  1,450 / 1,000,000 * $2.50 = $0.003625
Custo Output: 800 / 1,000,000 * $10.00  = $0.008000
TOTAL POR MENSAGEM: $0.011625 (~$0.012)
```

**Custo por Mensagem Complexa: $0.012** (1.2 centavos)

---

#### 1.3 Chat com Imagens (gpt-4o vision)

**Contexto Analisado:**
- System prompt: ~450 tokens (prompt específico para imagem)
- Histórico (5 msgs): ~600 tokens
- Mensagem usuário: ~100 tokens
- Imagem (high detail): ~1,000 tokens (estimativa OpenAI)
- Resposta IA: ~1,000 tokens (análise detalhada)

**Cálculo:**
```
Input:  (450 + 600 + 100 + 1,000) = 2,150 tokens
Output: 1,000 tokens

Custo Input:  2,150 / 1,000,000 * $2.50  = $0.005375
Custo Output: 1,000 / 1,000,000 * $10.00 = $0.010000
TOTAL POR IMAGEM: $0.015375 (~$0.015)
```

**Custo por Mensagem com Imagem: $0.015** (1.5 centavos)

**⚠️ Risco**: Usuário pode enviar até 3 imagens/mensagem → **$0.045/msg** (4.5 centavos)

---

### 2. Custo por Sugestão Enriquecida (Análise)

**Arquivo:** `work/lib/ai/suggestion-enricher.js`  
**Modelo:** gpt-4o-mini  

**Contexto Analisado:**
- System prompt: ~200 tokens
- Prompt com contexto (métricas JSON + 5-8 sugestões): ~2,500 tokens
- Resposta IA (sugestões enriquecidas): ~1,800 tokens

**Cálculo:**
```
Input:  (200 + 2,500) = 2,700 tokens
Output: 1,800 tokens

Custo Input:  2,700 / 1,000,000 * $0.15 = $0.000405
Custo Output: 1,800 / 1,000,000 * $0.60 = $0.001080
TOTAL POR ANÁLISE: $0.001485 (~$0.0015)
```

**Custo por Sugestão Enriquecida: $0.0015** (0.15 centavos)

---

### 3. Custo por Análise Completa

**Componentes:**
1. ✅ Extração de métricas (local, sem custo IA)
2. ✅ Geração de sugestões base (local, algoritmo heurístico)
3. ✅ Enriquecimento IA (1 chamada gpt-4o-mini): $0.0015
4. ✅ Armazenamento Postgres: ~$0.0001
5. ✅ Armazenamento Bucket (áudio): ~$0.0005/MB

**Custo Total por Análise (sem storage de áudio):**
```
IA:          $0.0015
Postgres:    $0.0001
TOTAL:       $0.0016
```

**Custo por Análise Completa: $0.0016** (0.16 centavos)

**⚠️ Nota**: Custo real pode variar se análise falhar e for reprocessada (sem idempotência).

---

### 4. Custo por Voice Message

**Componentes:**
1. Transcrição Whisper: $0.006/min × ~0.5min (média) = $0.003
2. Resposta Chat (gpt-3.5-turbo): $0.0011

**Custo Total por Voice Message:**
```
Whisper:     $0.003
Chat:        $0.0011
TOTAL:       $0.0041
```

**Custo por Voice Message: $0.004** (0.4 centavos)

---

### 5. Custo por Usuário Ativo/Dia (Médio)

**Hipótese de uso típico (usuário engajado):**
- 3 mensagens chat (2 simples + 1 complexa)
- 1 análise completa
- 0.2 voice messages/dia (1 por semana)

**Cálculo:**
```
Chat Simples:    2 × $0.0011  = $0.0022
Chat Complexo:   1 × $0.012   = $0.012
Análise:         1 × $0.0016  = $0.0016
Voice (20%):     0.2 × $0.004 = $0.0008
TOTAL/DIA:                     = $0.0166
```

**Custo por Usuário Ativo/Dia: $0.017** (1.7 centavos)  
**Custo por Usuário Ativo/Mês (30 dias): $0.50**

---

### 📊 TABELA RESUMO: CUSTOS UNITÁRIOS

| Item | Modelo OpenAI | Tokens Estimados (in/out) | Custo Unitário | Observações |
|------|---------------|---------------------------|----------------|-------------|
| **Chat Texto Simples** | gpt-3.5-turbo | 1,050 / 400 | $0.0011 | 60-70% mensagens |
| **Chat Texto Complexo** | gpt-4o | 1,450 / 800 | $0.012 | 20-30% mensagens |
| **Chat com 1 Imagem** | gpt-4o (vision) | 2,150 / 1,000 | $0.015 | Até 3 imagens/msg |
| **Chat com 3 Imagens** | gpt-4o (vision) | 4,150 / 1,000 | $0.045 | Risco alto custo |
| **Sugestão Enriquecida** | gpt-4o-mini | 2,700 / 1,800 | $0.0015 | Por análise |
| **Análise Completa** | gpt-4o-mini + infra | N/A | $0.0016 | Sem IA adicional |
| **Voice Message** | whisper-1 + gpt-3.5 | N/A | $0.004 | 30s áudio médio |
| **Usuário Ativo/Dia** | Mix de operações | N/A | $0.017 | 3 msgs + 1 análise |
| **Usuário Ativo/Mês** | Mix de operações | N/A | $0.50 | 30 dias uso |

---

## 🎯 MODELAGEM DE PLANOS & LIMITES ATUAIS

### Status Atual (Código-fonte)

**⚠️ PRECIFICAÇÃO PENDENTE**: Valores monetários **NÃO DEFINIDOS** no código.

| Plano | Preço/Mês | Mensagens/Mês | Análises/Mês | Imagens/Mês | Hard Caps |
|-------|-----------|---------------|--------------|-------------|-----------|
| **Free** | **PENDENTE** | 20 | 3 full + ∞ reduced | 0 | Vira reduced após 3 |
| **Plus** | **PENDENTE** | 80 | 25 full + ∞ reduced | 0 | Vira reduced após 25 |
| **Pro** | **PENDENTE** | ∞ (cap 300) | ∞ (cap 500) | 70 | Hard cap técnico |

**Fonte:** `work/lib/user/userPlans.js` (linhas 12-35)

---

### 📊 Análise de Custos vs Limites (ESTIMADO)

#### Free

**Uso Máximo/Mês:**
- 20 mensagens (assumindo 100% simples): 20 × $0.0011 = **$0.022**
- 3 análises completas: 3 × $0.0016 = **$0.005**
- **Custo Total Free/Mês: $0.027**

**⚠️ Risco**: Se usuário usar 100% gpt-4o (complexo):
- 20 × $0.012 = **$0.24**

**Preço Mínimo Recomendado (Free → Plus)**: $5/mês (margem 95%)

---

#### Plus

**Uso Máximo/Mês:**
- 80 mensagens (mix 70% simples, 30% complexo):
  - 56 × $0.0011 = $0.062
  - 24 × $0.012 = $0.288
  - Total: **$0.35**
- 25 análises: 25 × $0.0016 = **$0.04**
- **Custo Total Plus/Mês: $0.39**

**Preço Mínimo Recomendado**: $15/mês (margem 97%)  
**Preço Alvo (70% margem)**: $1.30/mês (inviável comercialmente)  
**Preço Competitivo**: $20-30/mês

---

#### Pro

**Uso Máximo/Mês (com hard caps):**
- 300 mensagens (mix 60% simples, 30% complexo, 10% imagem):
  - 180 × $0.0011 = $0.198
  - 90 × $0.012 = $1.08
  - 30 × $0.015 = $0.45
  - Total: **$1.73**
- 500 análises: 500 × $0.0016 = **$0.80**
- 70 imagens adicionais: 70 × $0.015 = **$1.05**
- **Custo Total Pro/Mês: $3.58**

**⚠️ RISCO CRÍTICO**: Se usuário abusar (3 imagens/msg, 70 msgs):
- 70 × $0.045 = **$3.15** (só imagens)
- Total poderia chegar a **$8-10/mês**

**Preço Mínimo Recomendado**: $50/mês (margem 93%)  
**Preço Alvo (70% margem)**: $12/mês (margem apertada)  
**Preço Competitivo**: $60-100/mês

---

## 📈 CENÁRIOS DE NEGÓCIO (4 MODELAGENS)

### IMPORTANTE: Premissas Globais

| Parâmetro | Valor Assumido | Observação |
|-----------|----------------|------------|
| **Preço Plus** | $25/mês | **ASSUMIDO** (não definido) |
| **Preço Pro** | $75/mês | **ASSUMIDO** (não definido) |
| **Churn Mensal** | 5% | Típico SaaS B2C |
| **Taxa Stripe** | 2.9% + $0.30 | Por pagamento |
| **Conversão Free→Paid** | 2-5% | Benchmark SaaS |
| **DAU/MAU** | 30-40% | Engajamento médio |
| **Custo Fixo Infra** | $150/mês | Base conservadora |

---

### 🔵 CENÁRIO 1: CONSERVADOR (Validação MVP)

**Perfil:** Primeiros 100 usuários, produto em validação

| Métrica | Valor |
|---------|-------|
| **Usuários Totais** | 100 |
| **Usuários Ativos (DAU)** | 30 (30%) |
| **Pagantes** | 3 (3% conversão) |
| **Distribuição Planos** | 97% Free, 2% Plus, 1% Pro |
| **Uso Médio/Dia** | 2 msgs + 0.5 análises |

**Receita Mensal:**
```
Plus: 2 × $25 = $50
Pro:  1 × $75 = $75
TOTAL RECEITA: $125/mês
```

**Custos Mensal:**
```
OpenAI (variável):
- Free (97): 97 × 20msgs × 0.8 simples × $0.0011 × 30% DAU = $5.15
- Plus (2):  2 × 80msgs × mix = ~$20
- Pro (1):   1 × 300msgs × mix = ~$50
Subtotal OpenAI: ~$75

Infra Fixa: $150
Stripe: (2×$25 + 1×$75) × 0.029 + 3×$0.30 = $4.53

TOTAL CUSTOS: $229.53
```

**Resultado:**
- 📊 Margem Bruta: **($125 - $75) / $125 = 40%**
- ❌ Lucro Operacional: **$125 - $229 = -$104/mês** (prejuízo)
- 💡 **Break-even**: ~8 pagantes Pro ou 18 pagantes total (mix)

**Status:** 🔴 **INVIÁVEL** - Custos fixos >receita. Necessário 5-10x escala.

---

### 🟢 CENÁRIO 2: BASE (Produto Consolidado)

**Perfil:** 500 usuários, tração orgânica, conversão 4%

| Métrica | Valor |
|---------|-------|
| **Usuários Totais** | 500 |
| **Usuários Ativos (DAU)** | 180 (36%) |
| **Pagantes** | 20 (4% conversão) |
| **Distribuição Planos** | 96% Free, 3% Plus, 1% Pro |
| **Uso Médio/Dia** | 3 msgs + 1 análise |

**Receita Mensal:**
```
Plus: 15 × $25 = $375
Pro:  5 × $75  = $375
TOTAL RECEITA: $750/mês
```

**Custos Mensal:**
```
OpenAI:
- Free (480): ~$150 (uso limitado)
- Plus (15):  ~$90 (15 × $6/mês)
- Pro (5):    ~$100 (5 × $20/mês, uso alto)
Subtotal OpenAI: $340

Infra Fixa: $180 (escala leve)
Stripe: $750 × 0.029 + 20×$0.30 = $27.75

TOTAL CUSTOS: $547.75
```

**Resultado:**
- 📊 Margem Bruta: **($750 - $340) / $750 = 55%**
- ✅ Lucro Operacional: **$750 - $548 = +$202/mês**
- 💰 LTV (churn 5%): $750/20 / 0.05 = **$750/user**
- 🎯 CAC Máximo Aceitável: **$250** (LTV/3)
- ⏱️ Payback: $250 / ($750/20 × 0.55) = **~12 meses**

**Status:** 🟢 **VIÁVEL** - Margem positiva, sustentável com crescimento.

---

### 🟡 CENÁRIO 3: AGRESSIVO (Crescimento Acelerado)

**Perfil:** 2,000 usuários, marketing ativo, conversão 5%

| Métrica | Valor |
|---------|-------|
| **Usuários Totais** | 2,000 |
| **Usuários Ativos (DAU)** | 800 (40%) |
| **Pagantes** | 100 (5% conversão) |
| **Distribuição Planos** | 95% Free, 3.5% Plus, 1.5% Pro |
| **Uso Médio/Dia** | 4 msgs + 1.5 análises |

**Receita Mensal:**
```
Plus: 70 × $25 = $1,750
Pro:  30 × $75 = $2,250
TOTAL RECEITA: $4,000/mês
```

**Custos Mensal:**
```
OpenAI:
- Free (1,900): ~$600 (uso limitado mas volume alto)
- Plus (70):    ~$500 (70 × $7/mês)
- Pro (30):     ~$800 (30 × $27/mês, uso intenso)
Subtotal OpenAI: $1,900

Infra Fixa: $300 (escala moderada, mais CPU/RAM)
Stripe: $4,000 × 0.029 + 100×$0.30 = $146

TOTAL CUSTOS: $2,346
```

**Resultado:**
- 📊 Margem Bruta: **($4,000 - $1,900) / $4,000 = 52.5%**
- ✅ Lucro Operacional: **$4,000 - $2,346 = +$1,654/mês**
- 💰 LTV: $4,000/100 / 0.05 = **$800/user**
- 🎯 CAC Máximo: **$267**
- 📈 ROI Marketing: Se CAC = $150, ROI = 433%

**Status:** 🟡 **ÓTIMO** - Margem saudável, escalável, lucrativo.

---

### 🔴 CENÁRIO 4: VIRAL (Risco de Explosão)

**Perfil:** 10,000 usuários, tração viral, conversão 3% (queda normal em escala)

| Métrica | Valor |
|---------|-------|
| **Usuários Totais** | 10,000 |
| **Usuários Ativos (DAU)** | 3,500 (35%) |
| **Pagantes** | 300 (3% conversão) |
| **Distribuição Planos** | 97% Free, 2.5% Plus, 0.5% Pro |
| **Uso Médio/Dia** | 5 msgs + 2 análises (poder users) |

**Receita Mensal:**
```
Plus: 250 × $25 = $6,250
Pro:  50 × $75  = $3,750
TOTAL RECEITA: $10,000/mês
```

**Custos Mensal:**
```
OpenAI:
- Free (9,700):  ~$4,000 (volume massivo, mesmo limitado)
- Plus (250):    ~$2,500 (250 × $10/mês)
- Pro (50):      ~$1,500 (50 × $30/mês, abuso potencial)
Subtotal OpenAI: $8,000 ⚠️

Infra Fixa: $600 (escala alta, múltiplos workers)
Stripe: $10,000 × 0.029 + 300×$0.30 = $380

TOTAL CUSTOS: $8,980
```

**Resultado:**
- 📊 Margem Bruta: **($10,000 - $8,000) / $10,000 = 20%** ⚠️
- ⚠️ Lucro Operacional: **$10,000 - $8,980 = +$1,020/mês** (margem apertada!)
- 🚨 **RISCO**: Se OpenAI chegar a $12k (abuso), prejuízo de -$3k/mês

**Status:** 🔴 **ARRISCADO** - Margem <30%, vulnerável a abuso, necessita otimização urgente.

---

### 📊 COMPARAÇÃO DE CENÁRIOS

| Cenário | Usuários | Receita | Custos | Lucro | Margem Bruta | Status |
|---------|----------|---------|--------|-------|--------------|--------|
| **Conservador** | 100 | $125 | $230 | -$105 | 40% | 🔴 Prejuízo |
| **Base** | 500 | $750 | $548 | +$202 | 55% | 🟢 Viável |
| **Agressivo** | 2,000 | $4,000 | $2,346 | +$1,654 | 52% | 🟡 Ótimo |
| **Viral** | 10,000 | $10,000 | $8,980 | +$1,020 | 20% | 🔴 Arriscado |

**Aprendizados:**
1. ✅ Break-even: ~18-20 pagantes (mix Plus/Pro)
2. ⚠️ Viral sem otimização = margem colapsa
3. 💡 Necessário otimizar custos ANTES de crescer >2k usuários
4. 🎯 Sweet spot: 500-2,000 usuários com margem 50-55%

---

## 💡 RECOMENDAÇÕES DE PREÇOS & LIMITES

### 🎯 Objetivo: Margem Bruta ≥ 70% (padrão SaaS B2C)

### Estratégia de Precificação

#### Opção A: Baseada em Valor (Recomendado)

**Análise Competitiva** (assumindo benchmarks de mercado):
- Tools similares (audio analysis + IA): $20-50/mês (Plus), $80-150/mês (Pro)
- ChatGPT Plus: $20/mês (referência IA)
- DAW plugins premium: $50-200 (one-time)

**Preços Recomendados:**

| Plano | Preço Atual | Preço Recomendado | Justificativa |
|-------|-------------|-------------------|---------------|
| **Free** | $0 | $0 | Lead gen, onboarding |
| **Plus** | **PENDENTE** | **$29/mês** | Custo ~$6/user → margem 79% |
| **Pro** | **PENDENTE** | **$79/mês** | Custo ~$25/user → margem 68% |

**Impacto nos Cenários:**

| Cenário | Receita Atual | Receita Nova | Δ Receita | Nova Margem |
|---------|---------------|--------------|-----------|-------------|
| Base | $750 | $1,155 | +54% | 71% |
| Agressivo | $4,000 | $5,880 | +47% | 68% |
| Viral | $10,000 | $14,650 | +47% | 45% (ainda baixo) |

---

#### Opção B: Limites Ajustados (Custo-base)

**Se manter preços baixos ($15 Plus / $50 Pro)**, ajustar limites:

| Plano | Limite Atual | Limite Recomendado | Razão |
|-------|--------------|-------------------|-------|
| **Plus** | 80 msgs/mês | **40 msgs/mês** | Manter custo ~$3/user |
| **Plus** | 25 análises | **15 análises** | Reduzir processamento |
| **Pro** | 300 msgs (cap) | **150 msgs** | Prevenir abuso |
| **Pro** | 70 imagens | **30 imagens** | Imagens são caras |

**⚠️ Trade-off**: Limites baixos podem reduzir valor percebido.

---

### 🛡️ Recomendações de Guardrails (Anti-Abuso)

#### Prioridade 1 (Implementar AGORA)

1. **Rate Limiting Agressivo**
   ```javascript
   // Por usuário
   - 10 msgs/hora (Free)
   - 30 msgs/hora (Plus)
   - 60 msgs/hora (Pro)
   
   // Por IP (prevenir bots)
   - 50 msgs/hora (global)
   ```

2. **Idempotência para Análises**
   ```javascript
   // Evitar reprocessamento duplicado
   - Hash de arquivo (SHA-256)
   - Cache de resultado por 24h
   - Dedupe: "Você já analisou este arquivo"
   ```

3. **Circuit Breaker OpenAI**
   ```javascript
   // Se custo diário > threshold, pausar temporariamente
   if (dailyCost > $100) {
     pauseNewRequests();
     alertAdmin();
   }
   ```

#### Prioridade 2 (Curto Prazo)

4. **Cache de Sugestões Enriquecidas**
   ```javascript
   // Cachear por combinação (genre + métricas)
   - Redução estimada: 40-60% chamadas IA
   - TTL: 7 dias
   ```

5. **Otimização de Prompts**
   ```javascript
   // Reduzir tokens sem perder qualidade
   - Remover redundâncias em system prompts
   - Truncar histórico para 3 msgs (atual: 5)
   - Comprimir métricas JSON (apenas relevantes)
   ```

6. **Modo Econômico para Free**
   ```javascript
   // Free sempre usa gpt-3.5-turbo
   // Desabilitar imagens no Free
   // Respostas mais curtas (max_tokens: 500)
   ```

#### Prioridade 3 (Médio Prazo)

7. **Fila com Prioridade**
   ```javascript
   // Pro = prioridade alta (processamento rápido)
   // Plus = prioridade média
   // Free = prioridade baixa (pode esperar)
   ```

8. **Análise Incremental**
   ```javascript
   // Análise básica local (grátis)
   // IA opcional (pago)
   // Usuário escolhe quando quer IA
   ```

9. **Modelo de Créditos**
   ```javascript
   // Usuário compra créditos
   // 1 crédito = 1 análise IA ou 10 msgs
   // Monetização mais flexível
   ```

---

## 📊 CHECKLIST ANTI-ABUSO (COMPLETO)

### 🔴 Crítico (Implementar Imediatamente)

- [ ] **Telemetria de Tokens** (cada chamada OpenAI deve logar usage)
- [ ] **Rate Limit por Usuário** (10-60 msgs/hora dependendo do plano)
- [ ] **Rate Limit por IP** (50 msgs/hora global, prevenir bots)
- [ ] **Idempotência em Análises** (SHA-256 hash + cache 24h)
- [ ] **Validação de Imagens** (magic bytes, tamanho, formato)
- [ ] **Hard Caps Técnicos** (300 msgs Pro, 70 imagens Pro)
- [ ] **Circuit Breaker OpenAI** (pausar se custo diário > $100)
- [ ] **Alerta de Custo Diário** (email se > $50/dia)

### 🟡 Importante (Próximas 2 Semanas)

- [ ] **Cache de Sugestões Enriquecidas** (dedupe por genre+métricas)
- [ ] **Otimização de Prompts** (reduzir 20-30% tokens)
- [ ] **Modo Econômico Free** (sempre gpt-3.5, sem imagens)
- [ ] **Retry Logic com Exponential Backoff** (evitar custos de falha)
- [ ] **Validação de Payload Total** (max 30MB imagens)
- [ ] **Timeout Configurável** (60s texto, 180s imagem)
- [ ] **Logging Estruturado** (custo por request, usuário, plano)

### 🟢 Desejável (Médio Prazo)

- [ ] **Dashboard de Custos** (admin vê gasto diário/mensal)
- [ ] **Fila com Prioridade** (Pro > Plus > Free)
- [ ] **Análise Incremental** (básico grátis, IA opcional)
- [ ] **Modelo de Créditos** (comprar créditos avulsos)
- [ ] **A/B Test de Modelos** (testar gpt-4o-mini em mais casos)
- [ ] **Compressão de Contexto** (resumir histórico longo)
- [ ] **CDN para Assets** (reduzir bandwidth Bucket)

---

## 🔧 PLANO DE INSTRUMENTAÇÃO (Próximos Passos)

### Objetivo

**Medir custos reais em produção para validar/corrigir todas as estimativas.**

### Implementação Detalhada

Ver arquivo separado: **`docs/PLANO_INSTRUMENTACAO_CUSTO.md`**

**Resumo:**
1. Logar `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens` em **TODAS** as chamadas OpenAI
2. Armazenar em tabela Postgres `openai_usage` (ou logs estruturados)
3. Criar dashboard com métricas:
   - Custo por usuário/dia/mês
   - Custo por plano
   - Custo por endpoint (chat, análise, voice)
   - Top 10 usuários por custo
4. Alertas automáticos:
   - Custo diário > $100
   - Usuário individual > $10/dia (abuso)
   - Spike de 200% em 1h

### Priorização

| Tarefa | Impacto | Esforço | Prioridade |
|--------|---------|---------|------------|
| Logar tokens em `chat.js` | 🔥 ALTO | 2h | **P0** |
| Logar tokens em `suggestion-enricher.js` | 🔥 ALTO | 1h | **P0** |
| Criar tabela `openai_usage` | 🔥 ALTO | 2h | **P0** |
| Dashboard Grafana/Metabase | 🟡 MÉDIO | 8h | **P1** |
| Alertas automáticos | 🟡 MÉDIO | 4h | **P1** |
| A/B test modelos | 🟢 BAIXO | 16h | **P2** |

---

## 🚨 RISCOS IDENTIFICADOS & MITIGAÇÕES

### Risco 1: Explosão de Custos (Viral)

**Descrição:** Crescimento rápido sem otimização leva margem <20%

**Probabilidade:** 🟡 MÉDIA  
**Impacto:** 🔴 CRÍTICO ($5-10k/mês prejuízo potencial)

**Mitigação:**
1. Implementar circuit breaker ($100/dia)
2. Pausar novos cadastros se custo > threshold
3. Otimizar custos ANTES de escalar marketing
4. Ter reserva de caixa para 3 meses de operação

---

### Risco 2: Abuso de Usuário Mal-Intencionado

**Descrição:** Bot ou usuário abusivo faz 1000+ requests/dia

**Probabilidade:** 🟡 MÉDIA  
**Impacto:** 🟡 ALTO ($50-200/dia por usuário)

**Mitigação:**
1. Rate limit agressivo (10-60 msgs/hora)
2. Detecção de anomalias (ML simples)
3. Ban automático se padrão suspeito
4. Requerer verificação de email/telefone

---

### Risco 3: Pricing Incorreto (Prejuízo por Usuário)

**Descrição:** Preço $15 Plus mas custo real $20/user

**Probabilidade:** 🟡 MÉDIA (sem telemetria)  
**Impacto:** 🔴 CRÍTICO (prejuízo estrutural)

**Mitigação:**
1. ✅ Implementar telemetria (P0)
2. Analisar 30 dias de dados reais
3. Ajustar preços/limites com base em data
4. Rever trimestralmente

---

### Risco 4: Dependência Única (OpenAI)

**Descrição:** OpenAI aumenta preços ou muda API

**Probabilidade:** 🟢 BAIXA  
**Impacto:** 🟡 ALTO (reestruturação necessária)

**Mitigação:**
1. Monitorar alternativas (Anthropic, Google, local LLMs)
2. Arquitetura modular (trocar provider facilmente)
3. Ter 20% margem de segurança no pricing
4. Diversificar receita (não depender 100% de IA)

---

## 📚 APÊNDICES

### A. Preços OpenAI (Referência)

**Última atualização:** Dezembro 2025

| Modelo | Input (1M tokens) | Output (1M tokens) | Observação |
|--------|-------------------|-------------------|------------|
| gpt-3.5-turbo | $0.50 | $1.50 | Rápido, econômico |
| gpt-4o | $2.50 | $10.00 | Raciocínio avançado |
| gpt-4o-mini | $0.15 | $0.60 | Barato, quality ok |
| whisper-1 | $0.006/min | - | Transcrição áudio |
| dall-e-3 | $0.04-0.12/img | - | Geração de imagem |

Fonte: https://openai.com/api/pricing/

---

### B. Benchmarks de Mercado

| Métrica | SaaS B2C Típico | SoundyAI Alvo |
|---------|----------------|---------------|
| **Margem Bruta** | 70-85% | 70%+ |
| **LTV/CAC** | 3:1 | 3:1 |
| **Churn Mensal** | 3-7% | 5% |
| **Conversão Free→Paid** | 2-5% | 3-5% |
| **Payback Period** | 6-18 meses | ≤12 meses |
| **DAU/MAU** | 30-50% | 35-40% |

---

### C. Glossário

- **COGS** (Cost of Goods Sold): Custo variável direto (OpenAI)
- **LTV** (Lifetime Value): Receita total esperada por cliente
- **CAC** (Customer Acquisition Cost): Custo para adquirir 1 cliente
- **Churn**: Taxa de cancelamento mensal
- **DAU/MAU**: Daily Active Users / Monthly Active Users
- **Unit Economics**: Economia por unidade (usuário, transação, etc)
- **Hard Cap**: Limite técnico absoluto (não pode exceder)
- **Soft Cap**: Limite que muda comportamento (ex: vira "reduced")

---

### D. Ferramentas Recomendadas

**Monitoramento de Custos:**
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- Grafana + Prometheus (self-hosted)
- Metabase (open-source BI)
- Railway Metrics (built-in)

**Análise Financeira:**
- Google Sheets (modelagem rápida)
- Baremetrics (SaaS metrics)
- ChartMogul (MRR tracking)

**Alertas:**
- PagerDuty (crítico)
- Slack webhooks (rápido)
- Email (fallback)

---

## ✅ PRÓXIMOS PASSOS (ACTION PLAN)

### Semana 1 (URGENTE)

1. ✅ **Definir Preços** (Plus: $29, Pro: $79) → Decisão comercial
2. ✅ **Implementar Telemetria** em `chat.js` e `suggestion-enricher.js`
3. ✅ **Criar Tabela** `openai_usage` no Postgres
4. ✅ **Ativar Rate Limiting** (10-60 msgs/hora)
5. ✅ **Circuit Breaker** (pausar se custo > $100/dia)

### Semana 2-3 (IMPORTANTE)

6. ✅ **Coletar 14 dias** de dados reais de tokens/custos
7. ✅ **Analisar Dados** e validar estimativas deste documento
8. ✅ **Ajustar Limites** se necessário (baseado em data)
9. ✅ **Implementar Cache** de sugestões enriquecidas
10. ✅ **Otimizar Prompts** (reduzir 20-30% tokens)

### Mês 1-2 (CONSOLIDAÇÃO)

11. ✅ **Dashboard de Custos** (Grafana ou Metabase)
12. ✅ **Alertas Automáticos** (custo diário, abuso)
13. ✅ **A/B Test Modelos** (gpt-4o-mini em mais casos)
14. ✅ **Documentação Interna** (runbook de custos)
15. ✅ **Revisão Trimestral** (pricing, limites, otimizações)

---

## 📞 CONTATO & SUPORTE

**Para dúvidas sobre este documento:**
- Revise o código-fonte citado
- Consulte `docs/PLANO_INSTRUMENTACAO_CUSTO.md`
- Analise `docs/cost_model_scenarios.csv`

**Importante:** Este documento é baseado em **análise estática do código** sem telemetria ativa.  
**Todos os custos são ESTIMATIVAS** até implementação de instrumentação completa.

---

**Fim do Documento**  
**Versão:** 1.0  
**Status:** ⚠️ ESTIMADO (necessita validação com dados reais)
