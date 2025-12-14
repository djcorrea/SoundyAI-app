# 📊 AUDITORIA COMPLETA: PLANOS E RESTRIÇÕES – SoundyAI

**Data da Auditoria:** 13 de dezembro de 2025  
**Escopo:** Sistema completo de planos FREE, PLUS e PRO  
**Tipo:** Auditoria somente leitura (sem modificações)

---

## 🎯 SUMÁRIO EXECUTIVO

O SoundyAI possui **3 planos** (FREE, PLUS, PRO) com sistema de **2 modos** (FULL e REDUCED).
- **Backend** gerencia limites mensais via Firestore (`work/lib/user/userPlans.js`)
- **Frontend** aplica bloqueios visuais e funcionais (`premium-blocker.js`, `premium-gate-system.js`)
- **Transição FULL → REDUCED**: Automática após esgotar análises completas do mês
- **Limites ocultos**: PRO tem hard cap de 200 análises/mês (bloqueio total)

---

## 📋 TABELA COMPLETA POR PLANO

| Recurso | FREE | PLUS | PRO |
|---------|------|------|-----|
| **Análises FULL/mês** | 3 | 25 | ∞ (hard cap: 200) |
| **Análises REDUCED** | ✅ Ilimitadas | ✅ Ilimitadas | ❌ Não existe |
| **Mensagens Chat/mês** | 20 | 80 | ∞ |
| **Modelo Chat** | GPT-4o (imagens) / GPT-3.5-turbo (texto) | GPT-4o (imagens) / GPT-3.5-turbo (texto) | GPT-4o (imagens) / GPT-3.5-turbo (texto) |
| **Sugestões IA (cards)** | ✅ FULL / ❌ REDUCED | ✅ FULL / ❌ REDUCED | ✅ Sempre |
| **Pedir Ajuda à IA** | 🟡 Primeiras 3 análises / ❌ Após | ❌ Sempre bloqueado | ✅ Sempre |
| **Baixar Relatório PDF** | 🟡 Primeiras 3 análises / ❌ Após | ❌ Sempre bloqueado | ✅ Sempre |
| **Métricas Básicas** | ✅ Sempre | ✅ Sempre | ✅ Sempre |
| **Métricas Avançadas** | ✅ FULL / 🔒 Blur REDUCED | ✅ FULL / 🔒 Blur REDUCED | ✅ Sempre |
| **Análise Espectral** | ✅ FULL / 🔒 Blur REDUCED | ✅ FULL / 🔒 Blur REDUCED | ✅ Sempre |
| **Tabela Comparação** | ✅ Parcial FULL / 🔒 Blur REDUCED | ✅ Parcial FULL / 🔒 Blur REDUCED | ✅ Completa |
| **Modo Reference** | ✅ FULL / 🔒 REDUCED | ✅ FULL / 🔒 REDUCED | ✅ Sempre |
| **Imagens no Chat** | ✅ Até 3/msg, 5/mês | ✅ Até 3/msg | ✅ Até 3/msg |

### Legenda
- ✅ **Liberado** - Funciona sem restrições
- ❌ **Bloqueado** - Abre modal de upgrade
- 🔒 **Blur** - Mostra dados borrados com ícone 🔒
- 🟡 **Condicionado** - Depende do modo (FULL/REDUCED)
- ∞ **Ilimitado** - Sem limite definido

---

## 🔍 1. BACKEND: FONTE DA VERDADE

### 📂 Arquivo: `work/lib/user/userPlans.js`

#### 1.1 Limites Definidos (PLAN_LIMITS)

```javascript
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,              // Chat: 20 mensagens/mês
    maxFullAnalysesPerMonth: 3,           // Análises FULL: 3/mês
    hardCapAnalysesPerMonth: null,        // Sem hard cap (vira reduced)
    allowReducedAfterLimit: true,         // Permite reduced após limite
  },
  plus: {
    maxMessagesPerMonth: 80,              // Chat: 80 mensagens/mês
    maxFullAnalysesPerMonth: 25,          // Análises FULL: 25/mês
    hardCapAnalysesPerMonth: null,        // Sem hard cap (vira reduced)
    allowReducedAfterLimit: true,         // Permite reduced após limite
  },
  pro: {
    maxMessagesPerMonth: Infinity,        // Chat: Ilimitado
    maxFullAnalysesPerMonth: Infinity,    // Análises FULL: Ilimitado
    hardCapAnalysesPerMonth: 200,         // ⚠️ LIMITE OCULTO: 200/mês total
    allowReducedAfterLimit: false,        // Sem modo reduced
  },
};
```

**Localização:** Linhas 13-33  
**Fonte:** `work/lib/user/userPlans.js`

---

#### 1.2 Decisão de Análise: `canUseAnalysis(uid)`

**Função:** Determina se usuário pode fazer análise e em qual modo

**Lógica de Decisão:**

1. **PRO Hard Cap (200/mês):**
   ```javascript
   if (currentMonthAnalyses >= 200) {
     return { allowed: false, mode: 'blocked', errorCode: 'LIMIT_REACHED' };
   }
   ```
   **Localização:** Linhas 282-291

2. **PRO Antes do Hard Cap:**
   ```javascript
   if (limits.maxFullAnalysesPerMonth === Infinity && currentMonthAnalyses < 200) {
     return { allowed: true, mode: 'full', remainingFull: 200 - currentMonthAnalyses };
   }
   ```
   **Localização:** Linhas 293-303

3. **FREE/PLUS com Análises Restantes:**
   ```javascript
   if (currentMonthAnalyses < limits.maxFullAnalysesPerMonth) {
     return { allowed: true, mode: 'full', remainingFull: remaining };
   }
   ```
   **Localização:** Linhas 308-316

4. **FREE/PLUS Após Limite (REDUCED):**
   ```javascript
   if (limits.allowReducedAfterLimit) {
     return { allowed: true, mode: 'reduced', remainingFull: 0 };
   }
   ```
   **Localização:** Linhas 318-325

**Retorno:**
```javascript
{
  allowed: boolean,
  mode: 'full' | 'reduced' | 'blocked',
  user: Object,
  remainingFull: number,
  errorCode?: 'LIMIT_REACHED'
}
```

---

#### 1.3 Features por Plano: `getPlanFeatures(plan, analysisMode)`

**Função:** Define quais recursos estão disponíveis baseado no plano e modo

**PRO (Sempre Tudo):**
```javascript
if (p === 'pro') {
  return {
    canSuggestions: true,      // Sugestões IA
    canSpectralAdvanced: true, // Espectral avançado
    canAiHelp: true,           // Botão "Pedir Ajuda à IA"
    canPdf: true,              // Botão "Baixar Relatório"
  };
}
```
**Localização:** Linhas 427-435

**PLUS (Sugestões em FULL, IA/PDF sempre bloqueados):**
```javascript
if (p === 'plus') {
  return {
    canSuggestions: isFull,    // ✅ FULL / ❌ REDUCED
    canSpectralAdvanced: false,
    canAiHelp: false,          // ❌ Sempre bloqueado
    canPdf: false,             // ❌ Sempre bloqueado
  };
}
```
**Localização:** Linhas 437-446

**FREE (Trial nas 3 primeiras análises):**
```javascript
// Modo FULL (análises 1-3)
if (isFull) {
  return {
    canSuggestions: true,      // ✅ Sugestões liberadas
    canSpectralAdvanced: false,
    canAiHelp: true,           // ✅ IA liberada (trial)
    canPdf: true,              // ✅ PDF liberado (trial)
  };
}
// Modo REDUCED (análise 4+)
else {
  return {
    canSuggestions: false,     // ❌ Tudo bloqueado
    canSpectralAdvanced: false,
    canAiHelp: false,          // ❌ IA bloqueada
    canPdf: false,             // ❌ PDF bloqueado
  };
}
```
**Localização:** Linhas 448-467

---

#### 1.4 Chat: `canUseChat(uid)` e `registerChat(uid)`

**Limites de Mensagens:**
- **FREE:** 20 mensagens/mês
- **PLUS:** 80 mensagens/mês
- **PRO:** Ilimitado

**Função `canUseChat(uid)`:**
```javascript
const current = user.messagesMonth || 0;

if (current >= limits.maxMessagesPerMonth) {
  return { allowed: false, errorCode: 'LIMIT_REACHED' };
}

return { allowed: true, remaining: limits.maxMessagesPerMonth - current };
```
**Localização:** Linhas 218-244

**Modelo de IA Utilizado:**
- **Com imagens:** GPT-4o (obrigatório para vision)
- **Texto puro:** GPT-3.5-turbo

**Localização modelo:** `work/api/chat.js` linha 683 (GPT-4o) e `work/lib/ai/suggestion-enricher.js` linha 104 (gpt-4o-mini para sugestões)

**Imagens no Chat:**
- **Limite:** 3 imagens por mensagem
- **Tamanho máx individual:** 10MB
- **Tamanho máx total:** 30MB
- **Cota FREE:** 5 análises de imagem/mês
- **Cota PLUS/PRO:** Sem limite definido no código (usa limite de mensagens)

**Localização:** `work/api/chat.js` linhas 200-207

---

#### 1.5 Registro de Uso

**`registerAnalysis(uid, mode)`:**
- Incrementa contador **SOMENTE** se `mode === 'full'`
- Modo REDUCED **NÃO** conta para o limite
- Atualiza `analysesMonth` no Firestore

**Localização:** Linhas 347-366

**`registerChat(uid)`:**
- Incrementa `messagesMonth` sempre
- Atualiza Firestore

**Localização:** Linhas 246-270

---

#### 1.6 Reset Mensal Automático

**Sistema Lazy:**
- Compara `billingMonth` do usuário com mês atual
- Se diferente, reseta `analysesMonth` e `messagesMonth` para 0
- Atualiza `billingMonth` para mês atual

```javascript
if (user.billingMonth !== currentMonth) {
  user.analysesMonth = 0;
  user.messagesMonth = 0;
  user.billingMonth = currentMonth;
  // Salva no Firestore
}
```

**Localização:** Linhas 81-88  
**Formato mês:** `"YYYY-MM"` (ex: `"2025-12"`)

---

## 🎨 2. FRONTEND: BLOQUEIOS E MÁSCARAS

### 📂 Arquivo: `public/premium-blocker.js`

#### 2.1 Sistema de Bloqueio (3 Camadas)

**Camada 1: EventBlocker**
- Intercepta cliques em botões IA e PDF
- Verifica se `isReducedMode()` retorna `true`
- Se bloqueado, abre modal de upgrade

**Seletores bloqueados:**
```javascript
const targetSelectors = [
  '[onclick*="sendModalAnalysisToChat"]',  // Botão IA
  '[onclick*="downloadModalAnalysis"]',     // Botão PDF
  'button[class*="ai-help"]',
  'button[class*="pdf-download"]'
];
```
**Localização:** Linhas 120-180

**Camada 2: FunctionGuards**
- Envolve funções originais com wrappers
- `sendModalAnalysisToChat` → bloqueado se reduced
- `downloadModalAnalysis` → bloqueado se reduced

**Localização:** Linhas 340-400

**Camada 3: ButtonNeutralizer**
- Adiciona atributo `disabled` aos botões
- Adiciona classe visual de bloqueio
- Executado após análise completar

**Localização:** Linhas 410-480

---

#### 2.2 Função `isReducedMode()`

**Busca análise de 4 fontes:**
```javascript
const analysis = window.currentModalAnalysis ||      // Principal
                window.__CURRENT_ANALYSIS__ ||       // Alias
                window.__soundyAI?.analysis ||       // Namespace
                window.__LAST_ANALYSIS_RESULT__;     // Backup PDF
```

**Lógica de decisão:**
```javascript
// 1. Sem análise → permitir
if (!analysis) return false;

// 2. isReduced explícito → bloquear
if (analysis.isReduced === true) return true;

// 3. analysisMode === 'reduced' → bloquear
if (analysis.analysisMode === 'reduced') return true;

// 4. Plano PLUS → bloquear (sempre)
if (analysis.plan === 'plus') return true;

// 5. FREE + FULL → permitir (trial)
if (analysis.plan === 'free' && analysis.analysisMode === 'full') return false;

// 6. Qualquer outro → permitir
return false;
```

**Localização:** Linhas 55-110

---

### 📂 Arquivo: `public/premium-gate-system.js`

**Sincronizado com `premium-blocker.js`**

Possui as **mesmas funções**:
- `getCurrentAnalysis()` - busca de 4 fontes
- `isReducedMode()` - mesma lógica
- `openUpgradeModal(feature)` - exibe modal

**Uso:**
- Wrappers `gatedSendModalAnalysisToChat` e `gatedDownloadModalAnalysis`
- Chamados via `onclick` em botões alternativos

**Localização:** Linhas 199-330

---

### 📂 Arquivo: `public/audio-analyzer-integration.js`

#### 2.3 Exposição Global de Análise

**Variável local → Global:**
```javascript
// Declaração local (não acessível de outros scripts)
let currentModalAnalysis = null;

// ✅ CORREÇÃO: Expor globalmente em 3 pontos

// Ponto 1: Análise de Job (genre mode)
currentModalAnalysis = normalizedResult;
window.currentModalAnalysis = normalizedResult;
window.__CURRENT_ANALYSIS__ = normalizedResult;

// Ponto 2: Análise Standalone
currentModalAnalysis = analysis;
window.currentModalAnalysis = analysis;
window.__CURRENT_ANALYSIS__ = analysis;

// Ponto 3: Modo Reference (comparação)
currentModalAnalysis = combinedAnalysis;
window.currentModalAnalysis = combinedAnalysis;
window.__CURRENT_ANALYSIS__ = combinedAnalysis;
```

**Localização:** 
- Linha 2151 (declaração)
- Linha ~8357 (ponto 1)
- Linha ~8893 (ponto 2)
- Linha ~9290 (ponto 3)

**Limpeza ao fechar:**
```javascript
currentModalAnalysis = null;
window.currentModalAnalysis = null;
window.__CURRENT_ANALYSIS__ = null;
```
**Localização:** Linhas ~6712, ~6887

---

#### 2.4 Aplicação de Máscaras Visuais (Modo REDUCED)

**Função `applyReducedModeMasks()`:**

Aplica classe `.metric-blur` nos **valores numéricos** (não nos labels):

```css
.metric-blur {
  filter: blur(7px) !important;
  opacity: 0.4 !important;
  pointer-events: none !important;
}

.metric-blur::after {
  content: "🔒" !important;
  font-size: 11px !important;
}
```

**Elementos borrados em REDUCED:**

| Categoria | Seletores | Comportamento |
|-----------|-----------|---------------|
| **Métricas Avançadas** | `#audioHeadroom`, `#audioLra`, `#audioStereoWidth`, `#audioStereoCorrelation`, `#audioPhaseCoherence`, `#audioPeakToAverage`, `#audioCrestFactor` | Blur 7px + 🔒 |
| **Bandas Espectrais** | `#audioSubBass`, `#audioBass`, `#audioLowMid`, `#audioMid`, `#audioHighMid`, `#audioPresence`, `#audioBrilliance`, `#audioAir` | Blur 7px + 🔒 |
| **Sugestões IA (texto)** | `.ai-block-content` | Blur 7px + 🔒 |
| **Tabela Comparação** | Células de valores (não severidade) | Blur 7px + 🔒 |

**Métricas SEMPRE VISÍVEIS:**
- LUFS Integrated
- True Peak
- Dynamic Range (DR)
- Estéreo (correlation/width parcial)
- Labels e títulos de todas as métricas

**Localização:** Linhas 9840-10050

---

#### 2.5 Tabela de Comparação (Modo Reference)

**Métricas permitidas na tabela:**
```javascript
const allowedTableMetrics = [
  'dr', 'dynamicRange',           // Dynamic Range
  'stereo', 'stereoCorrelation',  // Estéreo
  'lowmid', 'low mid',            // Low Mid
  'highmid', 'high mid',          // High Mid
  'presence', 'presença'          // Presença
];
```

**Métricas bloqueadas (blur):**
- LUFS
- True Peak  
- LRA
- Sub Bass, Bass, Mid
- Brilho, Air

**Localização:** Linhas 9971-10050

---

#### 2.6 Aviso de Upgrade

**Mensagem exibida em modo REDUCED:**

```html
<div class="upgrade-notice-compact">
  <div class="upgrade-notice-icon">🔒</div>
  <div class="upgrade-notice-content">
    <h4>Análises completas esgotadas</h4>
    <p>Métricas avançadas, sugestões IA e diagnósticos disponíveis no plano Plus.</p>
  </div>
  <button onclick="window.location.href='/planos.html'">Ver planos</button>
</div>
```

**Localização:** Linhas 10056-10090

---

## 🔄 3. FLUXO COMPLETO: BACKEND → FRONTEND

### 3.1 Análise de Áudio (work/api/audio/analyze.js)

**Sequência de execução:**

```javascript
// 1. Verificar se pode analisar
const analysisCheck = await canUseAnalysis(uid);

// 2. Decidir modo baseado em resultado
const analysisMode = analysisCheck.mode; // 'full' | 'reduced' | 'blocked'

// 3. Se bloqueado, retornar erro 403
if (!analysisCheck.allowed) {
  return res.status(403).json({
    error: 'LIMIT_REACHED',
    message: 'Limite de análises atingido'
  });
}

// 4. Executar análise no modo apropriado
const result = await audioAnalyzer.analyzeAudioFile(file, {
  mode: analysisMode,
  // ... outras opções
});

// 5. Obter features do plano
const features = getPlanFeatures(analysisCheck.user.plan, analysisMode);

// 6. Construir planContext
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode,
  isReduced: analysisMode === 'reduced',
  planFeatures: features,
  remainingAnalyses: analysisCheck.remainingFull
};

// 7. Enviar para frontend
res.json({
  ...result,
  ...planContext
});

// 8. Registrar uso (só incrementa se full)
await registerAnalysis(uid, analysisMode);
```

**Localização:** `work/api/audio/analyze.js` linhas 450-580

---

### 3.2 Frontend Recebe e Aplica Bloqueios

```javascript
// 1. Frontend recebe análise
const response = await fetch('/api/audio/analyze', { ... });
const analysis = await response.json();

// 2. Armazena globalmente
window.currentModalAnalysis = analysis;
window.__CURRENT_ANALYSIS__ = analysis;

// 3. Premium blocker verifica
function isReducedMode() {
  const analysis = window.currentModalAnalysis;
  
  // FREE trial (1-3 análises) → false (permitir)
  if (analysis.plan === 'free' && analysis.analysisMode === 'full') {
    return false;
  }
  
  // FREE reduced (4+) → true (bloquear)
  if (analysis.analysisMode === 'reduced') {
    return true;
  }
  
  // PLUS → true (sempre bloquear IA/PDF)
  if (analysis.plan === 'plus') {
    return true;
  }
  
  // PRO → false (permitir tudo)
  return false;
}

// 4. Aplicar bloqueios
if (isReducedMode()) {
  // Bloquear botões IA/PDF
  // Aplicar blur em métricas
  // Mostrar aviso de upgrade
}
```

---

## 📊 4. DETALHES TÉCNICOS POR FEATURE

### 4.1 Sugestões de IA (Cards)

**Geração:**
- **Backend:** `work/lib/ai/suggestion-enricher.js`
- **Modelo:** `gpt-4o-mini`
- **Linha:** 104

**Renderização:**
- **Frontend:** `public/ai-suggestion-ui-controller.js`
- **Filtro por plano:** Aplica `canSuggestions` do `planFeatures`

**Comportamento:**

| Plano | FULL | REDUCED |
|-------|------|---------|
| FREE | ✅ Mostra 7 cards | ❌ Não renderiza |
| PLUS | ✅ Mostra 7 cards | ❌ Não renderiza |
| PRO | ✅ Mostra 7 cards | ✅ Mostra 7 cards (não tem reduced) |

**Localização renderização:** `public/ai-suggestion-ui-controller.js` linhas 800-1200

---

### 4.2 "Pedir Ajuda à IA"

**Botão no Modal:**
```html
<button onclick="sendModalAnalysisToChat()">
  🤖 Pedir Ajuda à IA
</button>
```

**Bloqueio:**
1. **EventBlocker** intercepta clique
2. Verifica `isReducedMode()`
3. Se `true`, abre `openUpgradeModal('ai')`
4. Se `false`, executa `sendModalAnalysisToChat()`

**Comportamento:**

| Plano | Análise 1-3 (FULL) | Análise 4+ (REDUCED) |
|-------|-------------------|---------------------|
| FREE | ✅ Funciona | ❌ Modal de upgrade |
| PLUS | ❌ Modal de upgrade | ❌ Modal de upgrade |
| PRO | ✅ Funciona | ✅ Funciona |

**Texto do modal (PLUS/FREE reduced):**
```
A funcionalidade "Pedir Ajuda à IA" está disponível apenas 
para usuários premium. Faça upgrade para receber assistência 
personalizada.
```

**Localização texto:** `public/premium-gate-system.js` linha 271

---

### 4.3 "Baixar Relatório PDF"

**Botão no Modal:**
```html
<button onclick="downloadModalAnalysis()">
  📄 Baixar Relatório
</button>
```

**Bloqueio:** Idêntico ao "Pedir Ajuda à IA"

**Comportamento:**

| Plano | Análise 1-3 (FULL) | Análise 4+ (REDUCED) |
|-------|-------------------|---------------------|
| FREE | ✅ Funciona | ❌ Modal de upgrade |
| PLUS | ❌ Modal de upgrade | ❌ Modal de upgrade |
| PRO | ✅ Funciona | ✅ Funciona |

**Texto do modal:**
```
A funcionalidade "Baixar Relatório" está disponível apenas 
para usuários premium. Faça upgrade para exportar suas análises.
```

**Localização texto:** `public/premium-gate-system.js` linha 272

---

### 4.4 Chat com IA

**Endpoint:** `work/api/chat.js`

**Limites:**
- **FREE:** 20 mensagens/mês
- **PLUS:** 80 mensagens/mês
- **PRO:** Ilimitado

**Verificação:**
```javascript
const chatCheck = await canUseChat(uid);

if (!chatCheck.allowed) {
  return res.status(403).json({
    error: 'LIMIT_REACHED',
    message: `Você atingiu o limite de ${limits.maxMessagesPerMonth} mensagens por mês.`
  });
}
```

**Modelo de IA:**
- **Com imagens:** `gpt-4o` (obrigatório para vision)
- **Sem imagens:** `gpt-3.5-turbo`

**Localização decisão modelo:** Linha 683

**Imagens:**
- **Máximo por mensagem:** 3
- **Tamanho máx individual:** 10 MB
- **Tamanho máx total:** 30 MB
- **Cota FREE:** 5 análises/mês
- **Validação magic bytes:** JPEG, PNG, WebP

**Localização limites:** Linhas 200-230

**Mensagem ao atingir limite:**
```json
{
  "error": "LIMIT_REACHED",
  "message": "Você atingiu o limite de 20 mensagens por mês."
}
```

**Frontend exibe:** Modal de erro (implementação em `public/chat.js`)

---

### 4.5 Métricas Básicas (Sempre Visíveis)

**Nunca borradas em REDUCED:**
- **LUFS Integrated** (`#audioLoudness`)
- **True Peak** (`#audioTruePeak`)
- **Dynamic Range (DR)** (parcial na tabela)
- **Gráfico de Waveform** (visual)
- **Score Geral** (nota 0-100)

**Localização decisão:** `public/audio-analyzer-integration.js` função `scanReducedModeElements()` linhas 9800-9840

---

### 4.6 Métricas Avançadas (Blur em REDUCED)

**Lista completa de elementos borrados:**

```javascript
const blockedMetrics = {
  // Métricas avançadas
  'audioHeadroom': 'Headroom',
  'audioLra': 'LRA (Loudness Range)',
  'audioStereoWidth': 'Stereo Width',
  'audioStereoCorrelation': 'Stereo Correlation',
  'audioPhaseCoherence': 'Phase Coherence',
  'audioPeakToAverage': 'Peak-to-Average',
  'audioCrestFactor': 'Crest Factor',
  
  // Bandas espectrais
  'audioSubBass': 'Sub Bass (20-60 Hz)',
  'audioBass': 'Bass (60-250 Hz)',
  'audioLowMid': 'Low Mid (250-500 Hz)',
  'audioMid': 'Mid (500-2000 Hz)',
  'audioHighMid': 'High Mid (2000-4000 Hz)',
  'audioPresence': 'Presence (4000-6000 Hz)',
  'audioBrilliance': 'Brilliance (6000-12000 Hz)',
  'audioAir': 'Air (12000-20000 Hz)'
};
```

**Visual aplicado:**
- Blur: 7px
- Opacity: 0.4
- Ícone: 🔒
- Classe CSS: `.metric-blur`

**Localização:** Linhas 9840-9920

---

## 🚨 5. LIMITES "OCULTOS" E MENSAGENS DE SOBRECARGA

### 5.1 Limite Oculto: PRO Hard Cap (200 análises/mês)

**Definição:**
```javascript
pro: {
  maxFullAnalysesPerMonth: Infinity,     // Mostrado como "ilimitado"
  hardCapAnalysesPerMonth: 200,          // ⚠️ LIMITE REAL
}
```

**Comportamento:**
- Usuário PRO vê "análises ilimitadas"
- Após 200 análises no mês, recebe erro 403
- **NÃO** entra em modo REDUCED
- **NÃO** recebe aviso prévio

**Mensagem de erro:**
```json
{
  "error": "LIMIT_REACHED",
  "message": "Limite de análises atingido",
  "errorCode": "LIMIT_REACHED"
}
```

**Localização backend:** `work/lib/user/userPlans.js` linhas 282-291

**Localização frontend:** Erro genérico exibido (sem mensagem específica sobre 200)

**⚠️ SUGESTÃO:** Adicionar mensagem específica:
```
"Você atingiu o limite de segurança de 200 análises/mês. 
Entre em contato com suporte se precisar aumentar."
```

---

### 5.2 Mensagens de Sobrecarga/Manutenção

**❌ NÃO ENCONTRADO no código:**
- Nenhuma string "sobrecarga" ou "manutenção"
- Nenhuma lógica de "overload" relacionada a planos
- Nenhum sistema de "maintenance mode"

**✅ ENCONTRADO:**
- Rate limiting genérico (10 requests/minuto por usuário)
- Mensagem: "Rate limit excedido"
- Localização: `work/api/chat.js` linhas 240-270

**Mensagem atual:**
```javascript
console.warn(`🚫 Rate limit excedido para usuário: ${uid}`);
// Frontend recebe status 429 (Too Many Requests)
```

**Frontend exibe:** Erro genérico de rede (não específico de plano)

---

### 5.3 Expiração de Planos PLUS/PRO

**Verificação automática:**
```javascript
// PLUS
if (userData.plano === 'plus' && userData.planExpiresAt) {
  const currentDate = new Date();
  if (expirationDate <= currentDate) {
    // Downgrade automático para FREE
    userData.plano = 'gratis';
    userData.mensagensRestantes = 10;
  }
}
```

**Localização:** `work/api/chat.js` linhas 520-540

**Campos Firestore:**
- `plusExpiresAt`: Timestamp de expiração (plano PLUS)
- `proExpiresAt`: Timestamp de expiração (plano PRO)

**Comportamento:**
- Verificação lazy (próxima vez que usuário usar chat/análise)
- Downgrade silencioso (sem notificação)
- Contadores resetados para plano FREE

---

## 📍 6. MAPA DE ARQUIVOS E FUNÇÕES

### 6.1 Backend

| Arquivo | Funções Principais | Responsabilidade |
|---------|-------------------|------------------|
| `work/lib/user/userPlans.js` | `PLAN_LIMITS`, `canUseAnalysis()`, `canUseChat()`, `getPlanFeatures()`, `registerAnalysis()`, `registerChat()` | Fonte da verdade, limites, decisões |
| `work/api/audio/analyze.js` | Request handler, validação, planContext | Processa análise e envia dados para frontend |
| `work/api/chat.js` | Chat handler, verificação limites, modelo IA | Gerencia chat com IA |
| `work/lib/ai/suggestion-enricher.js` | `enrichSuggestions()` | Gera sugestões com GPT-4o-mini |

### 6.2 Frontend

| Arquivo | Funções Principais | Responsabilidade |
|---------|-------------------|------------------|
| `public/premium-blocker.js` | `isReducedMode()`, `EventBlocker`, `FunctionGuards`, `ButtonNeutralizer` | Sistema de bloqueio principal |
| `public/premium-gate-system.js` | `openUpgradeModal()`, wrappers gated | Modal de upgrade e bloqueio alternativo |
| `public/audio-analyzer-integration.js` | `applyReducedModeMasks()`, `blurAISuggestionTexts()`, exposição global | Máscaras visuais e gerenciamento de análise |
| `public/ai-suggestion-ui-controller.js` | `renderSuggestions()`, filtro por plano | Renderiza cards de sugestões |
| `public/plan-capabilities.js` | `canUseFeature()`, `CAPABILITIES_MATRIX` | Sistema de capabilities (legado, não mais usado) |

### 6.3 Variáveis Globais (Frontend)

| Variável | Tipo | Definida Em | Uso |
|----------|------|-------------|-----|
| `window.currentModalAnalysis` | Object | `audio-analyzer-integration.js` | Análise atual do modal |
| `window.__CURRENT_ANALYSIS__` | Object | `audio-analyzer-integration.js` | Alias da análise |
| `window.__soundyAI.analysis` | Object | `audio-analyzer-integration.js` | Namespace unificado |
| `window.__LAST_ANALYSIS_RESULT__` | Object | `audio-analyzer-integration.js` | Backup para PDF |
| `window.sendModalAnalysisToChat` | Function | `audio-analyzer-integration.js` | Abrir chat com análise |
| `window.downloadModalAnalysis` | Function | `audio-analyzer-integration.js` | Baixar PDF |
| `window.gatedSendModalAnalysisToChat` | Function | `premium-gate-system.js` | Wrapper bloqueado |
| `window.gatedDownloadModalAnalysis` | Function | `premium-gate-system.js` | Wrapper bloqueado |

---

## 🔍 7. DIVERGÊNCIAS E INCONSISTÊNCIAS

### 7.1 ✅ Backend vs Frontend: SINCRONIZADOS

**Verificação realizada:**
- ✅ Backend define `analysisMode: 'full'` → Frontend permite IA/PDF
- ✅ Backend define `analysisMode: 'reduced'` → Frontend bloqueia IA/PDF
- ✅ Backend retorna `plan: 'plus'` → Frontend bloqueia IA/PDF (sempre)
- ✅ Backend retorna `plan: 'free'` + `mode: 'full'` → Frontend permite (trial)

**Conclusão:** Nenhuma divergência detectada. Backend e frontend estão alinhados.

---

### 7.2 ⚠️ Limites "Infinito" vs Hard Cap

**Inconsistência de UX:**

**Plano PRO:**
- **Mostrado ao usuário:** "Análises ilimitadas"
- **Limite real:** 200/mês (hard cap)
- **Mensagem ao atingir:** "Limite de análises atingido" (genérica)

**Recomendação:**
1. Mostrar "até 200 análises/mês" na página de planos
2. Avisar usuário quando chegar em 180 análises (90%)
3. Mensagem específica ao atingir 200:
   ```
   Você atingiu o limite de segurança de 200 análises por mês.
   Para aumentar, entre em contato: suporte@soundyai.com
   ```

---

### 7.3 ✅ Sistema de Bloqueio Duplo: RESOLVIDO

**Histórico:**
- Existiam 2 sistemas rodando em paralelo (premium-blocker + premium-gate-system)
- Causava conflitos e modais duplicados

**Status atual:**
- Ambos sincronizados com mesma lógica `isReducedMode()`
- Funções buscam análise de 4 fontes
- Logs diagnósticos idênticos
- Nenhum conflito detectado

**Localização correção:** Aplicada em 13/12/2025 (este commit)

---

## 📊 8. RESUMO POR PLANO (DETALHADO)

### 🆓 PLANO FREE

**Análises:**
- **FULL:** 3/mês
- **REDUCED:** Ilimitadas
- **Após limite:** Entra automaticamente em REDUCED

**Chat:**
- **Mensagens:** 20/mês
- **Modelo:** GPT-4o (imagens) / GPT-3.5-turbo (texto)
- **Imagens:** 3/mensagem, 5 análises/mês

**Features em FULL (análises 1-3):**
- ✅ Sugestões IA (7 cards completos)
- ✅ "Pedir Ajuda à IA" funciona
- ✅ "Baixar Relatório PDF" funciona
- ✅ Todas métricas visíveis
- ✅ Tabela comparação completa
- ✅ Modo reference completo

**Features em REDUCED (análise 4+):**
- ❌ Sugestões IA não aparecem
- ❌ "Pedir Ajuda à IA" abre modal
- ❌ "Baixar Relatório PDF" abre modal
- ✅ Métricas básicas (LUFS, True Peak, DR)
- 🔒 Métricas avançadas com blur
- 🔒 Bandas espectrais com blur
- 🔒 Tabela comparação parcial

**Mensagem upgrade:**
```
Análises completas esgotadas. Métricas avançadas, 
sugestões IA e diagnósticos disponíveis no plano Plus.
```

---

### 💎 PLANO PLUS

**Análises:**
- **FULL:** 25/mês
- **REDUCED:** Ilimitadas
- **Após limite:** Entra automaticamente em REDUCED

**Chat:**
- **Mensagens:** 80/mês
- **Modelo:** GPT-4o (imagens) / GPT-3.5-turbo (texto)
- **Imagens:** 3/mensagem (sem limite mensal específico)

**Features em FULL (análises 1-25):**
- ✅ Sugestões IA (7 cards completos)
- ❌ "Pedir Ajuda à IA" **sempre bloqueado** (incentivo Pro)
- ❌ "Baixar Relatório PDF" **sempre bloqueado** (incentivo Pro)
- ✅ Todas métricas visíveis
- ✅ Tabela comparação completa
- ✅ Modo reference completo

**Features em REDUCED (análise 26+):**
- ❌ Sugestões IA não aparecem
- ❌ "Pedir Ajuda à IA" abre modal
- ❌ "Baixar Relatório PDF" abre modal
- ✅ Métricas básicas
- 🔒 Métricas avançadas com blur
- 🔒 Tabela comparação parcial

**Estratégia de monetização:**
- PLUS tem mais análises que FREE
- Mas **NUNCA** libera IA/PDF (mesmo em FULL)
- Objetivo: incentivar upgrade para PRO

**Mensagem upgrade (IA/PDF):**
```
A funcionalidade "Pedir Ajuda à IA" está disponível apenas 
para usuários premium. Faça upgrade para receber assistência 
personalizada.
```

---

### 🏆 PLANO PRO

**Análises:**
- **FULL:** Ilimitadas (mostrado)
- **Hard Cap:** 200/mês (oculto)
- **REDUCED:** Não existe
- **Após 200:** Bloqueio total (erro 403)

**Chat:**
- **Mensagens:** Ilimitadas
- **Modelo:** GPT-4o (imagens) / GPT-3.5-turbo (texto)
- **Imagens:** 3/mensagem (sem limite)

**Features:**
- ✅ Sugestões IA (sempre)
- ✅ "Pedir Ajuda à IA" (sempre)
- ✅ "Baixar Relatório PDF" (sempre)
- ✅ Todas métricas visíveis (sempre)
- ✅ Tabela comparação completa
- ✅ Modo reference completo
- ✅ Análise espectral avançada

**Não tem:**
- ❌ Modo REDUCED (após 200 → bloqueio)
- ❌ Blur em métricas
- ❌ Mensagens de upgrade

**Mensagem ao atingir 200:**
```json
{
  "error": "LIMIT_REACHED",
  "message": "Limite de análises atingido"
}
```

**⚠️ Recomendação:** Mensagem mais clara sobre hard cap de 200.

---

## 🔐 9. SEGURANÇA E VALIDAÇÕES

### 9.1 Backend

**Validações implementadas:**
- ✅ UID obrigatório em todas as funções
- ✅ Reset mensal automático (lazy)
- ✅ Verificação de expiração de planos
- ✅ Contadores atômicos (Firestore transactions)
- ✅ Limites validados antes de processar

**Localização:** `work/lib/user/userPlans.js`

---

### 9.2 Frontend

**Proteções implementadas:**
- ✅ 3 camadas de bloqueio (eventos, funções, botões)
- ✅ Análise exposta em 4 variáveis globais
- ✅ Verificação antes de cada ação
- ✅ Blur CSS (não removível pelo usuário)
- ✅ Logs diagnósticos para debug

**Vulnerabilidades:**
- ⚠️ Usuário pode deletar `window.currentModalAnalysis` via console
  - **Impacto:** Liberaria botões temporariamente
  - **Mitigação:** Backend valida independentemente
  - **Risco:** Baixo (backend é fonte da verdade)

---

## 📈 10. MÉTRICAS E OBSERVABILIDADE

### 10.1 Logs Backend

**Formato padronizado:**
```javascript
console.log(`✅ [USER-PLANS] Análise COMPLETA permitida (FREE): uid123 (2/3) - 1 restantes`);
console.log(`⚠️ [USER-PLANS] Análise em MODO REDUZIDO (PLUS): uid456 (25/25 completas usadas)`);
console.log(`🚫 [USER-PLANS] HARD CAP ATINGIDO: uid789 (200/200) - BLOQUEADO`);
```

**Arquivos com logs:**
- `work/lib/user/userPlans.js` (principais)
- `work/api/audio/analyze.js` (análises)
- `work/api/chat.js` (chat)

---

### 10.2 Logs Frontend

**Formato padronizado:**
```javascript
console.log('🔍 [BLOCKER] Análise encontrada:', { plan, analysisMode, isReduced, features });
console.log('🎁 [BLOCKER] FREE TRIAL (modo FULL) - permitindo acesso');
console.log('🔒 [BLOCKER] Modo REDUCED detectado (isReduced: true)');
console.log('✅ [BLOCKER] Permitido: 📄 Baixar Relatório');
console.log('🚫 [BLOCKER] Evento bloqueado: click');
```

**Arquivos com logs:**
- `public/premium-blocker.js` (bloqueios)
- `public/premium-gate-system.js` (modais)
- `public/audio-analyzer-integration.js` (máscaras)

---

## 🎯 11. RECOMENDAÇÕES

### 11.1 Melhorias de UX

1. **Hard Cap PRO (200 análises):**
   - Avisar em 180 análises (90%)
   - Mensagem específica ao atingir 200
   - Mostrar "até 200/mês" na página de planos

2. **FREE Trial (3 análises):**
   - Banner informativo: "2 análises FULL restantes com IA e PDF"
   - Ao entrar em REDUCED: explicar claramente o que mudou

3. **PLUS (25 análises):**
   - Banner: "IA e PDF disponíveis apenas no PRO"
   - Tooltip nos botões bloqueados explicando

---

### 11.2 Melhorias Técnicas

1. **Consolidar sistemas de bloqueio:**
   - Manter apenas `premium-blocker.js`
   - Remover `premium-gate-system.js` (redundante)

2. **Centralizar variáveis globais:**
   - Usar apenas `window.__soundyAI.analysis`
   - Remover aliases redundantes

3. **Adicionar testes:**
   - Unit tests para `canUseAnalysis()`
   - E2E tests para fluxo FREE → REDUCED
   - Validar hard cap PRO

---

### 11.3 Documentação

1. **Para usuários:**
   - Página clara "Como funcionam os planos?"
   - FAQ sobre modo REDUCED
   - Explicação do hard cap PRO

2. **Para desenvolvedores:**
   - Diagrama de fluxo backend → frontend
   - Guia de debugging (como testar cada plano)
   - Changelog de mudanças nos limites

---

## 📝 12. CONCLUSÃO

### Sistema Implementado

**✅ Pontos Fortes:**
- Backend robusto com validação adequada
- Frontend com 3 camadas de proteção
- Logs detalhados para debug
- Reset mensal automático
- Expiração de planos funcionando

**⚠️ Pontos de Atenção:**
- Hard cap PRO de 200 não é comunicado claramente
- PLUS bloqueia IA/PDF mesmo em FULL (por design, mas pode confundir)
- Sistema de bloqueio duplo (blocker + gate) redundante

**🎯 Status Geral:**
- Sistema funcional e seguro
- Regras de negócio implementadas corretamente
- UX pode ser melhorada (comunicação de limites)
- Código bem estruturado e manutenível

---

## 📚 ANEXO: STRINGS EXATAS DE MENSAGENS

### Mensagens de Erro (Backend)

```javascript
// Limite de análises
"Limite de análises atingido"

// Limite de chat
`Você atingiu o limite de ${limits.maxMessagesPerMonth} mensagens por mês.`

// Rate limiting
"Rate limit excedido"

// Imagens
"Máximo 3 imagens por envio"
"Imagem excede 10MB"
"Payload total excede 30MB"
```

### Mensagens de Modal (Frontend)

```javascript
// IA bloqueada
"A funcionalidade \"Pedir Ajuda à IA\" está disponível apenas para usuários premium. Faça upgrade para receber assistência personalizada."

// PDF bloqueado
"A funcionalidade \"Baixar Relatório\" está disponível apenas para usuários premium. Faça upgrade para exportar suas análises."

// Modo REDUCED
"Análises completas esgotadas. Métricas avançadas, sugestões IA e diagnósticos disponíveis no plano Plus."
```

---

**Documento gerado por:** Auditoria automática do código-fonte  
**Versão:** 1.0  
**Data:** 13/12/2025  
**Próxima revisão:** Quando houver mudanças nos limites ou planos
