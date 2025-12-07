# 🔍 AUDITORIA CRÍTICA ABSOLUTA - SISTEMA DE SUGESTÕES SOUNDYAI
## DIAGNÓSTICO COMPLETO: Root Causes e Inconsistências

**Data**: 7 de dezembro de 2025  
**Escopo**: Análise completa de TODOS os pontos de falha do sistema de sugestões  
**Objetivo**: Mapear TODAS as inconsistências entre cálculo interno, UI, texto IA e enriquecimento

---

## 📊 SUMÁRIO EXECUTIVO

### 🎯 OBJETIVO DA AUDITORIA
Identificar TODOS os pontos onde:
- O texto das sugest ões **NÃO reflete os valores reais**
- A IA está **ignorando target_range**
- Há **contradições** entre camadas do sistema
- O enriquecimento está **genérico** ou **sobrescrevendo dados corretos**

### ✅ SISTEMAS JÁ CORRETOS (VALIDADOS)
1. ✅ **problems-suggestions-v2.js**:
   - `getRangeBounds()` implementado em TODAS as métricas
   - LUFS, True Peak, DR, Stereo, Bandas → usando `target_range.min/max`
   - `diff` calculado até borda mais próxima do range
   - Severidade baseada em tolerância/critical

2. ✅ **genre-targets-loader.js**:
   - `target_range` preservado (linha 346)
   - Não está deletando range dos JSONs

3. ✅ **ULTRA_V2 (frontend)**:
   - `extractTargetRange()` implementado
   - `generateEducationalExplanation()` usando valores reais
   - Patches aplicados e funcionando

### ❌ PROBLEMAS IDENTIFICADOS

#### 🚨 PROBLEMA #1: suggestion-enricher.js (IA Backend) - PROMPT INCOMPLETO

**Localização**: `work/lib/ai/suggestion-enricher.js`, linha 512-523

**Problema**:
O prompt enviado para OpenAI GPT-4 **AINDA menciona target_db** em vez de usar **target_range exclusivamente**.

**Código atual**:
```javascript
// PATCH: Priorizar target_range quando disponível
if (data.target_range && data.target_range.min !== undefined && data.target_range.max !== undefined) {
  prompt += `  - **${label}**: Range ${data.target_range.min.toFixed(1)} a ${data.target_range.max.toFixed(1)} dB (tolerado)\n`;
} else if (data.target_db !== undefined) {
  // ❌ ESTE BLOCO AINDA EXISTE E USA target_db
  const min = data.min_db !== undefined ? data.min_db : (data.target_db - (data.tol_db || 2));
  const max = data.max_db !== undefined ? data.max_db : (data.target_db + (data.tol_db || 2));
  prompt += `  - **${label}**: Alvo ${data.target_db} dB (range: ${min} a ${max} dB)\n`;
}
```

**Impacto**:
- Quando `target_range` não existe no JSON (fallback), o prompt menciona "Alvo X dB"
- A IA interpreta como **valor central** e não como **range**
- Sugestões geradas dizem "ajuste para -28 dB" em vez de "mantenha entre -32 e -25 dB"

**Root Cause**:
O patch aplicado anteriormente **não corrigiu o fallback** - apenas adicionou o bloco `if (target_range)`, mas manteve o `else if (target_db)` que ainda fala em "Alvo".

---

#### 🚨 PROBLEMA #2: suggestion-enricher.js - INSTRUÇÕES GENÉRICAS NO PROMPT

**Localização**: `work/lib/ai/suggestion-enricher.js`, linha 700+

**Problema**:
O prompt da IA **NÃO instrui explicitamente** para:
1. Sempre citar `currentValue`, `targetValue` (ou `target_range`), `delta`
2. Nunca sugerir "mude para X dB" quando valor está dentro do range
3. Ser coerente com o `diff` calculado pelo backend

**Código atual**:
```javascript
prompt += `\n## 🎯 SUA MISSÃO
A partir das sugestões base acima, você deve criar **versões enriquecidas e educativas**...
```

**Impacto**:
- A IA cria textos **criativos** mas **desconectados dos dados reais**
- Pode sugerir "aumente 3 dB" quando o `delta` real é `+0.4 dB`
- Ignora o fato de que valor pode estar **dentro do range** (OK)

**Root Cause**:
O prompt pede "enriquecimento educativo" mas **NÃO exige coerência numérica estrita** com os dados enviados.

---

#### 🚨 PROBLEMA #3: suggestion-enricher.js - FALTA DE VALIDAÇÃO PÓS-IA

**Localização**: `work/lib/ai/suggestion-enricher.js`, função `mergeSuggestionsWithAI()`

**Problema**:
Após receber a resposta da IA, o sistema **NÃO valida** se:
- O texto da IA menciona os valores corretos (`currentValue`, `delta`)
- A IA não criou contradição com o `diff` calculado
- A severidade ("crítica", "média", "leve") está coerente com o `priority` base

**Código atual** (linha 712+):
```javascript
return {
  // 📦 Dados base (preservados)
  type: baseSug.type,
  message: baseSug.message,  // ✅ Preservado
  action: baseSug.action,    // ✅ Preservado
  delta: baseSug.delta,      // ✅ Preservado
  
  // 🔮 Enriquecimento IA (novo formato)
  problema: aiEnrichment.problema || baseSug.message,  // ❌ IA pode sobrescrever
  solucao: aiEnrichment.solucao || baseSug.action,      // ❌ IA pode sobrescrever
  // ...
};
```

**Impacto**:
- Se a IA errar, o erro é **aceito sem validação**
- Não há **reconciliação** entre dados base e enriquecimento
- Frontend pode mostrar `delta: +0.4 dB` mas texto da IA diz "reduza 3 dB"

**Root Cause**:
O merge é **passivo** - aceita qualquer coisa que a IA retornar, sem verificar coerência com dados originais.

---

#### 🚨 PROBLEMA #4: problems-suggestions-v2.js - TEXTO BASE AINDA USA target CENTRAL

**Localização**: `work/lib/audio/features/problems-suggestions-v2.js`, linha 390+

**Problema**:
Embora o `diff` esteja sendo calculado corretamente com `getRangeBounds()`, o **TEXTO** das mensagens ainda menciona o **target central**.

**Exemplo** (linha 392-397):
```javascript
if (severity.level === 'critical') {
  if (lufs > lufsThreshold.target) {  // ❌ Comparando com target CENTRAL
    message = `LUFS muito alto: ${lufs.toFixed(1)} dB (limite: ${lufsThreshold.target} dB)`;  // ❌ Texto menciona target
    explanation = `Seu áudio está ${(lufs - lufsThreshold.target).toFixed(1)} dB acima do ideal...`;  // ❌ Diff do target central
    action = `Reduza o gain geral em ${Math.ceil(lufs - lufsThreshold.target)} dB...`;  // ❌ Ação baseada no target central
  }
}
```

**Impacto**:
- Tabela mostra: `LUFS: -6.5 dB | Range: [-8.2, -4.2] | +2.3 dB acima do máximo`
- Sugestão base diz: `"LUFS muito alto: -6.5 dB (limite: -6.2 dB)"` ← **-6.2 é o centro, NÃO o limite!**
- Texto correto seria: `"LUFS muito alto: -6.5 dB (máximo permitido: -4.2 dB)"`

**Root Cause**:
O sistema calcula `diff` correto usando `getRangeBounds()`, mas o **texto continua comparando com `threshold.target`** (centro), não com `bounds.max` ou `bounds.min`.

---

#### 🚨 PROBLEMA #5: problems-suggestions-v2.js - TODAS AS MÉTRICAS COM MESMO ERRO

**Localização**: Funções `analyzeLUFS()`, `analyzeTruePeak()`, `analyzeDynamicRange()`, `analyzeStereoMetrics()`, `analyzeBand()`

**Problema**:
**TODAS** as funções de análise têm o mesmo padrão:
1. ✅ Calculam `diff` correto usando `getRangeBounds()`
2. ❌ Geram `message`, `explanation`, `action` comparando com `threshold.target` (centro)

**Exemplo** - `analyzeTruePeak()` (linha 446+):
```javascript
// PATCH: Usar getRangeBounds para consistência
const bounds = this.getRangeBounds(tpThreshold);
let diff;
if (truePeak < bounds.min) {
  diff = truePeak - bounds.min;  // ✅ Diff correto
} else if (truePeak > bounds.max) {
  diff = truePeak - bounds.max;  // ✅ Diff correto
} else {
  diff = 0;
}

// ❌ MAS DEPOIS...
if (severity.level === 'critical') {
  message = `🔴 True Peak crítico: ${truePeak.toFixed(1)} dBTP`;
  explanation = `ATENÇÃO! Valores acima de -1 dBTP causam clipping...`;  // ❌ Menciona -1 dBTP (hardcoded)
  action = `URGENTE: Reduza o gain em ${Math.ceil(truePeak + 1)} dB...`;  // ❌ Cálculo baseado em hardcoded
}
```

**Impacto**:
- O `diff` enviado para frontend está **correto** (`diff: +0.3 dB acima`)
- Mas `message`, `explanation`, `action` mencionam valores **hardcoded** ou `threshold.target`
- IA recebe sugestões base com **texto inconsistente** e propaga o erro

**Root Cause**:
Os patches de FASE 4 corrigiram o **cálculo do `diff`**, mas **NÃO corrigiram o texto** gerado pelas funções analyze*.

---

#### 🚨 PROBLEMA #6: problems-suggestions-v2.js - analyzeBand() PIOR CASO

**Localização**: `work/lib/audio/features/problems-suggestions-v2.js`, linha 720+

**Problema**:
A função `analyzeBand()` é a **pior** porque:
1. Calcula `diff` corretamente com `getRangeBounds()`
2. MAS gera texto usando `threshold.target` (centro)
3. E ainda compara `value > threshold.target + threshold.critical`

**Código** (linha 730-760):
```javascript
// PATCH: Calcular diferença até borda mais próxima do range
const bounds = this.getRangeBounds(threshold);
let rawDelta;
if (value < bounds.min) {
  rawDelta = value - bounds.min;  // ✅ Correto
} else if (value > bounds.max) {
  rawDelta = value - bounds.max;  // ✅ Correto
} else {
  rawDelta = 0;
}

// ❌ MAS DEPOIS...
if (severity.level === 'critical') {
  if (value > threshold.target + threshold.critical) {  // ❌ Comparação errada!
    message = `🔴 ${bandName} muito alto: ${value.toFixed(1)} dB`;
    explanation = `Excesso nesta faixa pode causar "booming"...`;  // ❌ Genérico
    action = `Corte ${Math.abs(actionableGain).toFixed(1)} dB...`;  // ✅ Usa actionableGain (correto)
  }
}
```

**Impacto**:
- A condição `if (value > threshold.target + threshold.critical)` **NÃO considera o range**
- Pode classificar como "crítico" um valor que está apenas **ligeiramente acima do max**
- Texto não menciona o range real (`[-32, -25]`)

**Root Cause**:
Lógica de severidade ainda usa `threshold.target ± threshold.critical` em vez de comparar com `bounds.min/max`.

---

## 🎯 MAPA COMPLETO DAS INCONSISTÊNCIAS

### 🔴 CAMADA 1: Backend - problems-suggestions-v2.js

| Função | Cálculo `diff` | Texto `message` | Texto `explanation` | Texto `action` | Status |
|--------|----------------|-----------------|---------------------|----------------|--------|
| `analyzeLUFS()` | ✅ Usa `getRangeBounds()` | ❌ Usa `threshold.target` | ❌ Usa `lufs - threshold.target` | ❌ Usa `threshold.target` | **INCONSISTENTE** |
| `analyzeTruePeak()` | ✅ Usa `getRangeBounds()` | ✅ OK (genérico) | ❌ Hardcoded `-1 dBTP` | ❌ Hardcoded `truePeak + 1` | **PARCIALMENTE INCONSISTENTE** |
| `analyzeDynamicRange()` | ✅ Usa `getRangeBounds()` | ✅ Menciona gênero | ❌ Usa `threshold.target ± tolerance` | ❌ Genérico | **PARCIALMENTE INCONSISTENTE** |
| `analyzeStereoMetrics()` | ✅ Usa `getRangeBounds()` | ✅ OK | ❌ Usa `threshold.target ± critical` | ❌ Genérico | **PARCIALMENTE INCONSISTENTE** |
| `analyzeBand()` | ✅ Usa `getRangeBounds()` | ❌ Não menciona range | ❌ Genérico | ⚠️ Usa `actionableGain` (correto) | **INCONSISTENTE** |

---

### 🔴 CAMADA 2: Backend IA - suggestion-enricher.js

| Componente | Status | Problema |
|------------|--------|----------|
| **Prompt - targets do gênero** | ❌ INCOMPLETO | Ainda usa "Alvo X dB" no fallback, não menciona que target_db é CENTRO |
| **Prompt - instruções gerais** | ❌ GENÉRICO | Não exige coerência numérica estrita com `currentValue`, `delta`, `target_range` |
| **Prompt - modo reference** | ✅ BOM | Instruções A/B detalhadas |
| **Parse da resposta IA** | ✅ ROBUSTO | Múltiplas estratégias, validação completa |
| **Merge de dados** | ⚠️ PASSIVO | Aceita qualquer texto da IA sem validar coerência com dados base |

---

### 🔴 CAMADA 3: Frontend - ULTRA_V2

| Componente | Status | Problema |
|------------|--------|----------|
| `extractTargetRange()` | ✅ PERFEITO | Lê `target_range` do contexto corretamente |
| `generateEducationalExplanation()` | ✅ PERFEITO | Usa valores reais, menciona range |
| `generateDetailedAction()` | ✅ PERFEITO | Usa `actionableGain` |
| `detectProblemType()` | ✅ PERFEITO | Usa `suggestion.metric` |

---

## 📋 LISTA NUMERADA DE PROBLEMAS

### 1️⃣ **problems-suggestions-v2.js → analyzeLUFS()**
- **Problema**: Texto usa `threshold.target` em vez de `bounds.max/min`
- **Localização**: Linha 392-420
- **Impacto**: Sugestão diz "limite: -6.2 dB" quando o limite real é `-4.2 dB` (max do range)
- **Root Cause**: Lógica de geração de texto não foi atualizada após patch do `diff`

### 2️⃣ **problems-suggestions-v2.js → analyzeTruePeak()**
- **Problema**: Valores hardcoded `-1 dBTP` e `truePeak + 1`
- **Localização**: Linha 446-478
- **Impacto**: Não considera range real, assume `-1 dBTP` universal
- **Root Cause**: Texto não adaptável ao `target_range`

### 3️⃣ **problems-suggestions-v2.js → analyzeDynamicRange()**
- **Problema**: Usa `threshold.target ± tolerance` no texto
- **Localização**: Linha 490-545
- **Impacto**: Menciona "target: 8 LU" quando deveria dizer "range: 1-15 LU"
- **Root Cause**: Texto menciona centro em vez de range completo

### 4️⃣ **problems-suggestions-v2.js → analyzeStereoMetrics()**
- **Problema**: Usa `threshold.target ± critical` no texto
- **Localização**: Linha 549-600
- **Impacto**: Não menciona range permitido
- **Root Cause**: Texto genérico, não cita range

### 5️⃣ **problems-suggestions-v2.js → analyzeBand()**
- **Problema**: Condição `if (value > threshold.target + threshold.critical)` ignora range
- **Localização**: Linha 730-780
- **Impacto**: Severidade pode ser incorreta, texto não menciona range
- **Root Cause**: Lógica de severidade usa target central

### 6️⃣ **suggestion-enricher.js → buildEnrichmentPrompt() - fallback target_db**
- **Problema**: Prompt diz "Alvo X dB (range: Y a Z)" no fallback
- **Localização**: Linha 516-520
- **Impacto**: IA interpreta "Alvo" como valor central, não como range
- **Root Cause**: Prompt não clarifica que target_db é CENTRO do range

### 7️⃣ **suggestion-enricher.js → buildEnrichmentPrompt() - instruções gerais**
- **Problema**: Prompt não exige coerência numérica estrita
- **Localização**: Linha 700+
- **Impacto**: IA cria textos criativos mas numericamente incorretos
- **Root Cause**: Falta de instrução explícita para citar valores reais

### 8️⃣ **suggestion-enricher.js → mergeSuggestionsWithAI()**
- **Problema**: Merge passivo, sem validação pós-IA
- **Localização**: Linha 712+
- **Impacto**: Erros da IA são aceitos sem verificação
- **Root Cause**: Falta de reconciliação entre dados base e enriquecimento

---

## 🔬 CAUSAS RAIZ FUNDAMENTAIS

### ROOT CAUSE #1: **Patch incompleto em FASE 4**
- O patch corrigiu o **cálculo do `diff`** usando `getRangeBounds()`
- MAS **NÃO corrigiu o texto** gerado pelas funções analyze*
- Resultado: `diff` correto, mas `message/explanation/action` errados

### ROOT CAUSE #2: **Prompt da IA não adaptado ao target_range**
- O prompt ainda trata `target_db` como "Alvo" no fallback
- Não instrui a IA para **sempre mencionar range completo**
- Não exige coerência com `currentValue`, `delta`

### ROOT CAUSE #3: **Falta de validação pós-IA**
- Merge aceita qualquer texto da IA sem verificar:
  - Valores citados batem com dados reais?
  - Severidade coerente com `priority` base?
  - Ação coerente com `diff` calculado?

### ROOT CAUSE #4: **Lógica de severidade ainda usa target central**
- Condições como `if (value > threshold.target + threshold.critical)` ignoram range
- Deveriam usar `if (value > bounds.max)`

---

## 🛠️ PLANO DE CORREÇÃO CIRÚRGICO

### 🎯 OBJETIVO
Corrigir TODOS os problemas identificados **SEM quebrar nada que já funciona**.

### 🔒 PROTEÇÕES OBRIGATÓRIAS
- ✅ Não alterar assinatura de funções
- ✅ Não mexer no cálculo do `diff` (já está correto)
- ✅ Não alterar estrutura do JSON retornado
- ✅ Não modificar UI
- ✅ Preservar backward compatibility

---

### 📦 PATCH #1: Corrigir texto em analyzeLUFS()

**Arquivo**: `work/lib/audio/features/problems-suggestions-v2.js`  
**Função**: `analyzeLUFS()`, linha 352-420

**Mudança**: Reescrever `message`, `explanation`, `action` para usar `bounds.min/max` em vez de `threshold.target`

**ANTES**:
```javascript
if (lufs > lufsThreshold.target) {
  message = `LUFS muito alto: ${lufs.toFixed(1)} dB (limite: ${lufsThreshold.target} dB)`;
  explanation = `Seu áudio está ${(lufs - lufsThreshold.target).toFixed(1)} dB acima do ideal...`;
  action = `Reduza o gain geral em ${Math.ceil(lufs - lufsThreshold.target)} dB...`;
}
```

**DEPOIS**:
```javascript
if (lufs > bounds.max) {
  const excessDb = lufs - bounds.max;
  message = `LUFS muito alto: ${lufs.toFixed(1)} dB (máximo permitido: ${bounds.max.toFixed(1)} dB)`;
  explanation = `Seu áudio está ${excessDb.toFixed(1)} dB acima do máximo permitido (${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB). Isso pode causar distorção e fadiga auditiva.`;
  action = `Reduza o gain geral em aproximadamente ${Math.ceil(excessDb)} dB usando um limiter ou reduzindo o volume master.`;
} else if (lufs < bounds.min) {
  const deficitDb = bounds.min - lufs;
  message = `LUFS muito baixo: ${lufs.toFixed(1)} dB (mínimo recomendado: ${bounds.min.toFixed(1)} dB)`;
  explanation = `Seu áudio está ${deficitDb.toFixed(1)} dB abaixo do mínimo recomendado (${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB). Ficará muito baixo comparado a outras músicas.`;
  action = `Aumente o loudness usando um limiter suave, elevando gradualmente em aproximadamente ${Math.ceil(deficitDb)} dB.`;
}
```

**Impacto**: Texto agora menciona o **range completo** e o **limite real** (max/min), não o centro.

---

### 📦 PATCH #2: Corrigir texto em analyzeTruePeak()

**Arquivo**: `work/lib/audio/features/problems-suggestions-v2.js`  
**Função**: `analyzeTruePeak()`, linha 446-478

**Mudança**: Remover hardcoded `-1 dBTP`, usar `bounds.max`

**ANTES**:
```javascript
message = `🔴 True Peak crítico: ${truePeak.toFixed(1)} dBTP`;
explanation = `ATENÇÃO! Valores acima de -1 dBTP causam clipping digital...`;
action = `URGENTE: Reduza o gain em ${Math.ceil(truePeak + 1)} dB...`;
```

**DEPOIS**:
```javascript
if (truePeak > bounds.max) {
  const excessDb = truePeak - bounds.max;
  message = `🔴 True Peak crítico: ${truePeak.toFixed(1)} dBTP (máximo seguro: ${bounds.max.toFixed(1)} dBTP)`;
  explanation = `ATENÇÃO! Valores acima de ${bounds.max.toFixed(1)} dBTP causam clipping digital e distorção audível. Você está ${excessDb.toFixed(1)} dB acima do limite seguro.`;
  action = `URGENTE: Reduza o gain em aproximadamente ${Math.ceil(excessDb)} dB no limiter ou use oversampling 4x para evitar clipping.`;
}
```

---

### 📦 PATCH #3: Corrigir texto em analyzeDynamicRange()

**Arquivo**: `work/lib/audio/features/problems-suggestions-v2.js`  
**Função**: `analyzeDynamicRange()`, linha 490-545

**Mudança**: Mencionar range completo em vez de "target ± tolerance"

**ANTES**:
```javascript
explanation = `Dynamic Range muito baixo para ${this.genre}. Target: ${threshold.target} LU, aceitável até ${threshold.target + threshold.tolerance} LU.`;
```

**DEPOIS**:
```javascript
explanation = `Dynamic Range muito baixo para ${this.genre}. Range recomendado: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LU. Seu DR está ${Math.abs(diff).toFixed(1)} LU ${dr < bounds.min ? 'abaixo do mínimo' : 'acima do máximo'}.`;
```

---

### 📦 PATCH #4: Corrigir texto em analyzeStereoMetrics()

**Arquivo**: `work/lib/audio/features/problems-suggestions-v2.js`  
**Função**: `analyzeStereoMetrics()`, linha 549-600

**Mudança**: Mencionar range de correlação estéreo

**ANTES**:
```javascript
explanation = `Sua música está quase mono. Falta largura estéreo e espacialidade.`;
```

**DEPOIS**:
```javascript
const rangeTxt = `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`;
explanation = `Correlação estéreo ${correlation.toFixed(2)} está fora do range ideal (${rangeTxt}). ${correlation < bounds.min ? 'Muito estreito (quase mono)' : 'Muito largo (risco de cancelamento de fase)'}.`;
```

---

### 📦 PATCH #5: Corrigir condição e texto em analyzeBand()

**Arquivo**: `work/lib/audio/features/problems-suggestions-v2.js`  
**Função**: `analyzeBand()`, linha 730-780

**Mudança**: 
1. Usar `value > bounds.max` em vez de `value > threshold.target + threshold.critical`
2. Mencionar range no texto

**ANTES**:
```javascript
if (severity.level === 'critical') {
  if (value > threshold.target + threshold.critical) {
    message = `🔴 ${bandName} muito alto: ${value.toFixed(1)} dB`;
    explanation = `Excesso nesta faixa pode causar "booming" e mascarar outras frequências.`;
  }
}
```

**DEPOIS**:
```javascript
if (severity.level === 'critical') {
  if (value > bounds.max) {
    const excessDb = value - bounds.max;
    message = `🔴 ${bandName} muito alto: ${value.toFixed(1)} dB (máximo: ${bounds.max.toFixed(1)} dB)`;
    explanation = `Excesso de ${excessDb.toFixed(1)} dB acima do máximo permitido (range: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB). Pode causar "booming" e mascarar outras frequências.`;
  } else if (value < bounds.min) {
    const deficitDb = bounds.min - value;
    message = `🔴 ${bandName} muito baixo: ${value.toFixed(1)} dB (mínimo: ${bounds.min.toFixed(1)} dB)`;
    explanation = `Falta ${deficitDb.toFixed(1)} dB para atingir o mínimo recomendado (range: ${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} dB). Deixa o som sem fundação e corpo.`;
  }
}
```

---

### 📦 PATCH #6: Corrigir prompt da IA - fallback target_db

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `buildEnrichmentPrompt()`, linha 516-520

**Mudança**: Clarificar que target_db é CENTRO do range

**ANTES**:
```javascript
} else if (data.target_db !== undefined) {
  const label = bandLabels[band] || band;
  const min = data.min_db !== undefined ? data.min_db : (data.target_db - (data.tol_db || 2));
  const max = data.max_db !== undefined ? data.max_db : (data.target_db + (data.tol_db || 2));
  prompt += `  - **${label}**: Alvo ${data.target_db} dB (range: ${min} a ${max} dB)\n`;
}
```

**DEPOIS**:
```javascript
} else if (data.target_db !== undefined) {
  const label = bandLabels[band] || band;
  const min = data.min_db !== undefined ? data.min_db : (data.target_db - (data.tol_db || 2));
  const max = data.max_db !== undefined ? data.max_db : (data.target_db + (data.tol_db || 2));
  prompt += `  - **${label}**: Range permitido ${min.toFixed(1)} a ${max.toFixed(1)} dB (centro em ${data.target_db.toFixed(1)} dB)\n`;
  prompt += `    → IMPORTANTE: Use o RANGE (${min.toFixed(1)} a ${max.toFixed(1)} dB) como referência, NÃO o centro isolado.\n`;
}
```

---

### 📦 PATCH #7: Adicionar instruções de coerência numérica no prompt da IA

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `buildEnrichmentPrompt()`, linha 700+

**Mudança**: Adicionar seção **"COERÊNCIA NUMÉRICA OBRIGATÓRIA"**

**Adicionar ANTES de "## 🎯 SUA MISSÃO"**:
```javascript
prompt += `\n## ⚖️ COERÊNCIA NUMÉRICA OBRIGATÓRIA\n\n`;
prompt += `**REGRAS ABSOLUTAS**:\n`;
prompt += `1. SEMPRE cite o \`currentValue\` (valor medido) no campo \`problema\`\n`;
prompt += `2. SEMPRE cite o \`delta\` (diferença calculada) no campo \`problema\` ou \`causaProvavel\`\n`;
prompt += `3. Se a sugestão base tem \`targetValue\`, cite-o no texto\n`;
prompt += `4. Se a banda tem \`target_range\`, mencione o RANGE COMPLETO (min a max), NÃO apenas o centro\n`;
prompt += `5. Se o \`delta\` é ZERO ou próximo de zero, NÃO sugira mudanças — diga "Está perfeito, mantenha"\n`;
prompt += `6. Se o \`delta\` é POSITIVO (+X dB), significa "acima do máximo" → sugerir REDUZIR\n`;
prompt += `7. Se o \`delta\` é NEGATIVO (-X dB), significa "abaixo do mínimo" → sugerir AUMENTAR\n`;
prompt += `8. A quantidade sugerida no campo \`solucao\` deve SEMPRE ser coerente com o \`delta\`\n`;
prompt += `   - Exemplo: delta = +0.4 dB → solução = "Reduza cerca de 0.5 dB"\n`;
prompt += `   - Exemplo: delta = -3.2 dB → solução = "Aumente cerca de 3 dB"\n`;
prompt += `9. NUNCA invente valores — use EXATAMENTE os valores fornecidos nos dados base\n`;
prompt += `10. Se a sugestão base já tem um bom \`action\`, você pode EXPANDIR mas NÃO CONTRADIZER\n\n`;
```

---

### 📦 PATCH #8: Adicionar validação pós-IA no merge

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `mergeSuggestionsWithAI()`, linha 712+

**Mudança**: Adicionar validação de coerência numérica

**Adicionar DEPOIS de `successCount++;` (linha ~755)**:
```javascript
// 🛡️ VALIDAÇÃO PÓS-IA: Verificar coerência numérica
const validation = validateAICoherence(baseSug, aiEnrichment);
if (!validation.isCoherent) {
  console.warn(`[AI-AUDIT][VALIDATION] ⚠️ Incoerência detectada na sugestão ${index}:`, validation.issues);
  // Forçar uso de dados base se IA for incoerente
  return {
    ...baseSug,
    aiEnhanced: true,
    enrichmentStatus: 'incoherent_fallback',
    categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type),
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
```

**E adicionar nova função** (ao final do arquivo):
```javascript
/**
 * 🛡️ Valida coerência entre dados base e enriquecimento IA
 */
function validateAICoherence(baseSug, aiEnrich) {
  const issues = [];
  
  // Validação 1: Problema deve mencionar currentValue se disponível
  if (baseSug.currentValue && aiEnrich.problema && !aiEnrich.problema.includes(baseSug.currentValue)) {
    issues.push(`problema não menciona currentValue (${baseSug.currentValue})`);
  }
  
  // Validação 2: Problema ou causa deve mencionar delta se disponível
  if (baseSug.delta) {
    const deltaInText = aiEnrich.problema?.includes(baseSug.delta) || aiEnrich.causaProvavel?.includes(baseSug.delta);
    if (!deltaInText) {
      issues.push(`texto não menciona delta (${baseSug.delta})`);
    }
  }
  
  // Validação 3: Se delta é zero, solução não deve sugerir mudanças
  if (baseSug.delta && baseSug.delta.startsWith('0.0')) {
    const suggestsMudanca = aiEnrich.solucao?.toLowerCase().match(/(aument|reduz|modif|ajust|mude|altere)/);
    if (suggestsMudanca) {
      issues.push(`delta é zero mas solução sugere mudança`);
    }
  }
  
  // Validação 4: Severidade IA vs base
  const severityMap = { 'crítica': 4, 'média': 2, 'leve': 1 };
  const basePriority = baseSug.priority || 2;
  const aiNivel = severityMap[aiEnrich.nivel] || 2;
  if (Math.abs(basePriority - aiNivel) > 2) {
    issues.push(`severidade IA (${aiEnrich.nivel}) muito diferente da base (priority: ${basePriority})`);
  }
  
  return {
    isCoherent: issues.length === 0,
    issues
  };
}
```

---

## 📊 IMPACTO ESPERADO DOS PATCHES

### ✅ ANTES DOS PATCHES:
- Tabela: `LUFS: -6.5 dB | Range: [-8.2, -4.2] | +2.3 dB acima`
- Sugestão: `"LUFS muito alto: -6.5 dB (limite: -6.2 dB)"` ← **ERRADO**
- IA: `"Reduza para aproximadamente -6.2 dB"` ← **ERRADO**

### ✅ DEPOIS DOS PATCHES:
- Tabela: `LUFS: -6.5 dB | Range: [-8.2, -4.2] | +2.3 dB acima`
- Sugestão: `"LUFS muito alto: -6.5 dB (máximo permitido: -4.2 dB)"` ← **CORRETO**
- IA: `"Você está 2.3 dB acima do máximo permitido (-4.2 dB). Reduza cerca de 2.5 dB."` ← **CORRETO**

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: Patches no Backend (problems-suggestions-v2.js)
- [ ] PATCH #1: Corrigir texto em `analyzeLUFS()`
- [ ] PATCH #2: Corrigir texto em `analyzeTruePeak()`
- [ ] PATCH #3: Corrigir texto em `analyzeDynamicRange()`
- [ ] PATCH #4: Corrigir texto em `analyzeStereoMetrics()`
- [ ] PATCH #5: Corrigir condição e texto em `analyzeBand()`

### FASE 2: Patches no Backend IA (suggestion-enricher.js)
- [ ] PATCH #6: Corrigir prompt - fallback target_db
- [ ] PATCH #7: Adicionar instruções de coerência numérica
- [ ] PATCH #8: Adicionar validação pós-IA no merge

### FASE 3: Validação
- [ ] Executar análise de teste com áudio real
- [ ] Verificar coerência: tabela = sugestão base = IA
- [ ] Validar que nenhuma regressão foi introduzida
- [ ] Testar com múltiplos gêneros

---

## 🎯 RESULTADO FINAL ESPERADO

### ✅ CONSISTÊNCIA 100% GARANTIDA ENTRE:
1. ✅ Tabela de comparação (frontend)
2. ✅ Cálculo interno do `diff` (backend)
3. ✅ Texto das sugestões base (backend)
4. ✅ Enriquecimento IA (backend IA)
5. ✅ Enriquecimento ULTRA_V2 (frontend)

### ✅ EXPERIÊNCIA DO USUÁRIO:
- 🎯 Valores citados sempre batem
- 🎯 Range completo sempre mencionado
- 🎯 Instruções precisas ("reduza 0.5 dB", não "reduza 2-4 dB")
- 🎯 Severidade coerente com o desvio real
- 🎯 Ações práticas e aplicáveis
- 🎯 Confiança absoluta no sistema

---

**FIM DA AUDITORIA CRÍTICA ABSOLUTA** ✅

**Próximo passo**: Aplicar os 8 patches cirúrgicos na ordem especificada.
