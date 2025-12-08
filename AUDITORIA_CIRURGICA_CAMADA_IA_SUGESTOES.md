# 🔬 AUDITORIA CIRÚRGICA: CAMADA DE SUGESTÕES DA IA

**Data**: 2025-12-07  
**Escopo**: `work/lib/ai/suggestion-enricher.js` - **EXCLUSIVAMENTE camada de IA e fallback**  
**Objetivo**: Identificar por que IA usa valores universais e fallback usa valores incorretos

---

## 📋 SUMÁRIO EXECUTIVO

### 🎯 PROBLEMA IDENTIFICADO: **NUMERIC LOCK IMPLEMENTADO MAS MAL VALIDADO**

**Status**: ✅ Sistema tem proteção NUMERIC LOCK mas validação está **PERMITINDO TEXTOS GENÉRICOS**

**Root Cause**: 
1. ✅ **NUMERIC LOCK existe** (linhas 606-621) - IA **NÃO PODE** retornar campos numéricos separados
2. ✅ **Validação existe** (linhas 1000-1068) - `validateAICoherence()` checa se IA menciona valores
3. ❌ **Validação é PERMISSIVA** - Se IA não menciona valores, sistema aceita e marca como "incoherent_fallback" mas **AINDA USA O TEXTO DA IA**
4. ❌ **Fallback interno usa dados base** mas **MANTÉM textos vazios da IA** quando ela falha

---

## 🔍 ANÁLISE DETALHADA DA CAMADA DE IA

### 1️⃣ PROMPT PARA IA (`buildEnrichmentPrompt`)

**Localização**: Linhas 461-706

#### ✅ O QUE ESTÁ CORRETO:

```javascript
// Linha 486-543: PROMPT INCLUI TARGETS DO GÊNERO
if (context.customTargets) {
  prompt += `\n### 🎯 TARGETS DO GÊNERO (${genre.toUpperCase()})\n`;
  
  if (targets.bands) {
    prompt += `\n#### 🎶 Bandas Espectrais:\n`;
    Object.entries(targets.bands).forEach(([band, data]) => {
      if (data.target_range && data.target_range.min !== undefined && data.target_range.max !== undefined) {
        prompt += `  - **${label}**: Range permitido ${data.target_range.min.toFixed(1)} a ${data.target_range.max.toFixed(1)} dB\n`;
        prompt += `    → Use o RANGE como referência, não o ponto central.\n`;
      }
    });
  }
}
```

**✅ CORRETO**: IA recebe `targetMin`, `targetMax` e `target_range` do gênero real.

---

```javascript
// Linha 606-621: NUMERIC LOCK - PROIBIÇÕES ABSOLUTAS
**❌ NUNCA RETORNE ESTES CAMPOS NO JSON:**
- \`currentValue\` (já fornecido na base)
- \`targetRange\` (já fornecido na base)
- \`targetMin\` (já fornecido na base)
- \`targetMax\` (já fornecido na base)
- \`delta\` (já fornecido na base)
```

**✅ CORRETO**: IA é **explicitamente proibida** de retornar campos numéricos como propriedades JSON separadas.

---

```javascript
// Linha 623-658: REGRAS DE COERÊNCIA NUMÉRICA OBRIGATÓRIA
**REGRAS ABSOLUTAS QUE VOCÊ DEVE SEGUIR**:

1. **OBRIGATÓRIO**: SEMPRE cite o \`currentValue\` EXATO no campo \`problema\`
2. **OBRIGATÓRIO**: SEMPRE cite o \`delta\` EXATO no campo \`problema\` ou \`causaProvavel\`
3. **OBRIGATÓRIO**: SEMPRE cite o \`targetRange\` COMPLETO quando fornecido
4. **NUNCA arredonde, NUNCA invente, NUNCA suavize valores numéricos**

**FORMATO OBRIGATÓRIO NO CAMPO "problema"**:
"[Banda] está em [currentValue] dB, enquanto o range adequado é [targetRange], ficando [delta] dB [acima/abaixo] do limite [máximo/mínimo]."
```

**✅ CORRETO**: Prompt **EXIGE** que IA mencione valores nos textos.

---

#### ❌ O QUE ESTÁ **FALTANDO** NO PROMPT:

**PROBLEMA 1: Prompt não envia `currentValue` e `delta` para cada sugestão**

```javascript
// Linha 666: Sugestões são enviadas como JSON completo
prompt += '```json\n' + JSON.stringify(suggestions, null, 2) + '\n```\n';
```

**✅ Sugestões base INCLUEM currentValue e delta**:
```javascript
{
  "type": "eq",
  "band": "low_bass",
  "currentValue": "-20.5 dB",      // ✅ Presente
  "targetMin": "-31 dB",             // ✅ Presente
  "targetMax": "-25 dB",             // ✅ Presente
  "delta": "+2.5 dB",                // ✅ Presente
  "message": "Low Bass acima do limite",
  "action": "Reduza Low Bass em 2.5 dB"
}
```

**✅ DIAGNÓSTICO**: IA **RECEBE** todos os valores. Se ela não os usa, é falha da IA, não do prompt.

---

**PROBLEMA 2: Prompt permite "análise contextual" quando dados ausentes**

```javascript
// Linha 687-688
- Se dados técnicos estiverem ausentes, use experiência profissional para preencher com coerência
- Nunca invente métricas, mas preencha lacunas com análise contextual
```

**❌ CONFLITO**: Prompt diz "NUNCA invente métricas" mas também diz "preencha lacunas com análise contextual".

**🔧 CORREÇÃO NECESSÁRIA**: Remover permissão para "análise contextual" - IA deve **SEMPRE usar valores fornecidos**.

---

### 2️⃣ VALIDAÇÃO DA RESPOSTA IA (`validateAICoherence`)

**Localização**: Linhas 1000-1068

#### ✅ O QUE ESTÁ CORRETO:

```javascript
// Linha 1006-1019: NUMERIC LOCK VALIDATION
const forbiddenNumericFields = [
  'currentValue', 'targetRange', 'targetMin', 'targetMax', 
  'delta', 'deviationRatio', 'referenceValue', 'userValue'
];

forbiddenNumericFields.forEach(field => {
  if (aiEnrich[field] !== undefined) {
    issues.push(`🚨 NUMERIC LOCK VIOLATION: IA retornou campo proibido "${field}"`);
  }
});

// Se houver violação, retornar imediatamente como incoerente
if (issues.length > 0 && issues.some(i => i.includes('NUMERIC LOCK VIOLATION'))) {
  return { isCoherent: false, issues: issues };
}
```

**✅ CORRETO**: Sistema **REJEITA** se IA retornar campos numéricos como propriedades.

---

#### ❌ O QUE ESTÁ **INCORRETO** NA VALIDAÇÃO:

**PROBLEMA 1: Validação checa apenas "includes" - aceita aproximações**

```javascript
// Linha 1023-1029: Validação de currentValue
if (baseSug.currentValue && aiEnrich.problema) {
  const currentValueStr = String(baseSug.currentValue).replace(/[^\d.-]/g, '');
  const problemContainsValue = aiEnrich.problema.includes(currentValueStr) || 
                                aiEnrich.problema.includes(baseSug.currentValue);
  if (!problemContainsValue) {
    issues.push(`problema não menciona currentValue (${baseSug.currentValue})`);
  }
}
```

**❌ PROBLEMA**: 
- Se `currentValue = "-20.5 dB"` e IA escreve "Low Bass está em **-20 dB**", validação **PASSA** (arredondamento)
- Se IA escreve "Low Bass está **muito alto**", validação **FALHA** mas sistema **AINDA USA O TEXTO**

---

**PROBLEMA 2: Validação de delta é permissiva demais**

```javascript
// Linha 1032-1040: Validação de delta
if (baseSug.delta && typeof baseSug.delta === 'string') {
  const deltaNum = baseSug.delta.replace(/[^\d.-]/g, '');
  const deltaInProblem = aiEnrich.problema?.includes(deltaNum);
  const deltaInCause = aiEnrich.causaProvavel?.includes(deltaNum);
  if (!deltaInProblem && !deltaInCause && deltaNum && parseFloat(deltaNum) !== 0) {
    issues.push(`texto não menciona delta (${baseSug.delta})`);  // ✅ ISSUE REGISTRADO
  }
}
```

**✅ Sistema registra issue "texto não menciona delta"**  
**❌ MAS NÃO FORÇA FALLBACK COMPLETO** - texto genérico é **ACEITO**

---

**PROBLEMA 3: Quando validação falha, fallback é PARCIAL**

```javascript
// Linha 844-857: Quando IA é incoerente
if (!validation.isCoherent) {
  console.warn(`[AI-AUDIT][VALIDATION] ⚠️ Incoerência detectada:`, validation.issues);
  
  return {
    ...baseSug,
    aiEnhanced: true,                    // ❌ AINDA MARCA COMO ENHANCED
    enrichmentStatus: 'incoherent_fallback',
    categoria: aiEnrichment.categoria || mapCategoryFromType(baseSug.type),
    nivel: aiEnrichment.nivel || mapPriorityToNivel(baseSug.priority),
    problema: baseSug.message,          // ✅ USA BASE (correto)
    causaProvavel: aiEnrichment.causaProvavel || 'Análise não fornecida', // ❌ USA IA
    solucao: baseSug.action,            // ✅ USA BASE (correto)
    pluginRecomendado: aiEnrichment.pluginRecomendado || 'Não especificado', // ❌ USA IA
    dicaExtra: aiEnrichment.dicaExtra || null,      // ❌ USA IA
    parametros: aiEnrichment.parametros || null,    // ❌ USA IA
    validationIssues: validation.issues
  };
}
```

**❌ PROBLEMA CRÍTICO**:
- `problema` e `solucao` usam dados base ✅
- `causaProvavel`, `pluginRecomendado`, `dicaExtra`, `parametros` ainda usam **IA INCOERENTE** ❌
- Frontend recebe `aiEnhanced: true` mas texto pode ser genérico

---

### 3️⃣ FALLBACK QUANDO IA FALHA COMPLETAMENTE

**Localização**: Linhas 440-458 (dentro do catch)

```javascript
// Linha 440-458: Fallback quando IA falha
return suggestions.map(sug => ({
  ...sug,
  aiEnhanced: false,                    // ✅ Marca como FALSE
  enrichmentStatus: error.name === 'AbortError' ? 'timeout' : 'error',
  enrichmentError: error.message,
  categoria: mapCategoryFromType(sug.type, sug.category),
  nivel: mapPriorityToNivel(sug.priority),
  problema: sug.message || 'Problema não identificado',       // ✅ USA BASE
  causaProvavel: 'Enriquecimento IA não disponível',          // ✅ FALLBACK GENÉRICO
  solucao: sug.action || 'Consulte métricas técnicas',        // ✅ USA BASE
  pluginRecomendado: 'Plugin não especificado',               // ✅ FALLBACK GENÉRICO
  dicaExtra: null,
  parametros: null
}));
```

**✅ CORRETO**: Quando IA falha **TOTALMENTE**, sistema usa dados base.

**❌ PROBLEMA**: Quando IA falha **PARCIALMENTE** (retorna resposta mas sem valores), sistema aceita texto genérico.

---

### 4️⃣ MERGE FINAL (`mergeSuggestionsWithAI`)

**Localização**: Linhas 800-927

```javascript
// Linha 857-910: Merge quando IA é coerente
return {
  // 🔒 NUMERIC LOCK - Campos numéricos SEMPRE preservados do base
  currentValue: baseSug.currentValue,       // ✅ SEMPRE DO BASE
  targetRange: baseSug.targetRange,         // ✅ SEMPRE DO BASE
  targetMin: baseSug.targetMin,             // ✅ SEMPRE DO BASE
  targetMax: baseSug.targetMax,             // ✅ SEMPRE DO BASE
  delta: baseSug.delta,                     // ✅ SEMPRE DO BASE
  deviationRatio: baseSug.deviationRatio,   // ✅ SEMPRE DO BASE
  
  // 🔮 Enriquecimento IA (novo formato)
  aiEnhanced: true,
  enrichmentStatus: 'success',
  categoria: aiEnrichment.categoria || mapCategoryFromType(...),
  nivel: aiEnrichment.nivel || mapPriorityToNivel(...),
  problema: aiEnrichment.problema || baseSug.message,         // ✅ FALLBACK PARA BASE
  causaProvavel: aiEnrichment.causaProvavel || 'Análise não fornecida',
  solucao: aiEnrichment.solucao || baseSug.action,            // ✅ FALLBACK PARA BASE
  pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
  dicaExtra: aiEnrichment.dicaExtra || null,
  parametros: aiEnrichment.parametros || null
};
```

**✅ CORRETO**: 
- Valores numéricos **SEMPRE** vêm do base
- Textos IA tem fallback para base quando ausentes

**❌ PROBLEMA**: 
- Se IA retorna texto genérico ("Low Bass está fora do range"), sistema **ACEITA**
- Validação detecta mas não força uso de `baseSug.message`

---

## 🎯 ROOT CAUSE SUMMARY

### 🔴 PROBLEMA 1: VALIDAÇÃO PERMISSIVA

**Atual**:
```javascript
if (!problemContainsValue) {
  issues.push(`problema não menciona currentValue`);  // ⚠️ Apenas registra
}
```

**Comportamento**:
- Sistema registra issue
- Marca como `incoherent_fallback`
- **MAS AINDA USA** texto genérico da IA

**Impacto**: Usuário vê sugestões como "Low Bass está fora do range" sem valores específicos.

---

### 🔴 PROBLEMA 2: FALLBACK PARCIAL ACEITA IA INCOERENTE

**Atual (linha 844-857)**:
```javascript
if (!validation.isCoherent) {
  return {
    problema: baseSug.message,           // ✅ USA BASE
    causaProvavel: aiEnrichment.causaProvavel,  // ❌ USA IA INCOERENTE
    solucao: baseSug.action,             // ✅ USA BASE
    pluginRecomendado: aiEnrichment.pluginRecomendado  // ❌ USA IA INCOERENTE
  };
}
```

**Impacto**: Metade da sugestão é coerente (problema/solucao), metade é genérica (causa/plugin).

---

### 🔴 PROBLEMA 3: PROMPT PERMITE "ANÁLISE CONTEXTUAL"

**Atual (linha 687-688)**:
```
- Se dados técnicos estiverem ausentes, use experiência profissional
- Nunca invente métricas, mas preencha lacunas com análise contextual
```

**Conflito**: Prompt proíbe invenção mas permite contexto → IA gera textos genéricos.

---

## 🔧 CORREÇÕES NECESSÁRIAS

### ✅ CORREÇÃO 1: VALIDAÇÃO MAIS RIGOROSA

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `validateAICoherence()` (linha 1000)

**Problema**: Validação registra issues mas não força rejeição total.

**Solução**: Se IA não menciona `currentValue` OU `delta`, **REJEITAR COMPLETAMENTE** o texto.

```javascript
// ANTES (linha 1023-1029)
if (!problemContainsValue) {
  issues.push(`problema não menciona currentValue`);  // ⚠️ Apenas registra
}

// DEPOIS (PROPOSTA)
if (!problemContainsValue) {
  issues.push(`❌ CRÍTICO: problema não menciona currentValue (${baseSug.currentValue})`);
  // 🚨 Marcar como REJEIÇÃO TOTAL - não usar texto da IA
  return {
    isCoherent: false,
    issues: issues,
    useBaseFallback: true  // ← NOVO FLAG
  };
}
```

---

### ✅ CORREÇÃO 2: FALLBACK TOTAL QUANDO IA É INCOERENTE

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `mergeSuggestionsWithAI()` (linha 844)

**Problema**: Quando IA é incoerente, sistema ainda usa `causaProvavel` e `pluginRecomendado` dela.

**Solução**: Se validação falha, **IGNORAR COMPLETAMENTE** IA e usar fallback 100% base.

```javascript
// ANTES (linha 844-857)
if (!validation.isCoherent) {
  return {
    problema: baseSug.message,                      // ✅ BASE
    causaProvavel: aiEnrichment.causaProvavel,      // ❌ IA INCOERENTE
    solucao: baseSug.action,                        // ✅ BASE
    pluginRecomendado: aiEnrichment.pluginRecomendado  // ❌ IA INCOERENTE
  };
}

// DEPOIS (PROPOSTA)
if (!validation.isCoherent || validation.useBaseFallback) {
  console.warn(`[AI-VALIDATION] ❌ IA incoerente - usando FALLBACK COMPLETO baseado em dados técnicos`);
  
  return {
    ...baseSug,
    aiEnhanced: false,  // ❌ NÃO MARCAR COMO ENHANCED
    enrichmentStatus: 'validation_failed',
    categoria: mapCategoryFromType(baseSug.type, baseSug.category),
    nivel: mapPriorityToNivel(baseSug.priority),
    problema: baseSug.message,         // ✅ BASE
    causaProvavel: buildTechnicalCause(baseSug),  // ✅ FALLBACK TÉCNICO
    solucao: baseSug.action,           // ✅ BASE
    pluginRecomendado: buildRecommendedPlugin(baseSug),  // ✅ FALLBACK BASEADO EM TIPO
    dicaExtra: null,
    parametros: buildTechnicalParams(baseSug),  // ✅ FALLBACK BASEADO EM DELTA
    validationIssues: validation.issues
  };
}
```

---

### ✅ CORREÇÃO 3: REMOVER PERMISSÃO PARA "ANÁLISE CONTEXTUAL"

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Função**: `buildEnrichmentPrompt()` (linha 687)

**Problema**: Prompt permite IA "preencher lacunas" → gera textos genéricos.

**Solução**: Remover linha permissiva e adicionar restrição absoluta.

```javascript
// ANTES (linha 687-690)
- Se dados técnicos estiverem ausentes, use experiência profissional para preencher com coerência
- Nunca invente métricas, mas preencha lacunas com análise contextual
- Retorne APENAS o JSON (sem markdown extras)

// DEPOIS (PROPOSTA)
- **NUNCA preencha lacunas** - se currentValue ou delta estiverem ausentes, **não gere a sugestão**
- **NUNCA use experiência profissional** - use SOMENTE os valores fornecidos no JSON base
- Se você não conseguir mencionar currentValue e delta EXATOS, **omita essa sugestão do array**
- Retorne APENAS o JSON (sem markdown extras)
```

---

### ✅ CORREÇÃO 4: CRIAR FALLBACKS TÉCNICOS INTELIGENTES

**Arquivo**: `work/lib/ai/suggestion-enricher.js`  
**Localização**: NOVA FUNÇÃO (adicionar antes de `mergeSuggestionsWithAI`)

**Problema**: Quando IA falha, fallback atual é genérico ("Análise não fornecida").

**Solução**: Criar funções que constroem textos técnicos baseados em dados base.

```javascript
/**
 * 🛠️ Constrói causa técnica baseada em dados base
 * Usado quando IA falha na validação
 */
function buildTechnicalCause(baseSug) {
  const delta = parseFloat(String(baseSug.delta || '0').replace(/[^\d.-]/g, ''));
  
  if (baseSug.type === 'eq' || baseSug.band) {
    if (delta > 0) {
      return `Excesso de energia na banda ${baseSug.band || 'detectada'}, com +${Math.abs(delta).toFixed(1)} dB acima do limite máximo recomendado para o gênero. Isso pode causar mascaramento e fadiga auditiva.`;
    } else if (delta < 0) {
      return `Deficiência de energia na banda ${baseSug.band || 'detectada'}, com ${Math.abs(delta).toFixed(1)} dB abaixo do limite mínimo recomendado. Isso pode resultar em mixagem sem corpo e presença.`;
    }
  }
  
  if (baseSug.type === 'loudness') {
    if (delta > 0) {
      return `Loudness excessivo, indicando compressão ou limiting agressivo. Perda de dinâmica natural e risco de distorção.`;
    } else if (delta < 0) {
      return `Loudness insuficiente para o padrão do gênero. Mixagem soará baixa e sem impacto comparada a outras faixas.`;
    }
  }
  
  if (baseSug.type === 'clipping') {
    return `True Peak acima do limite seguro. Clipping intersample pode ocorrer durante conversão D/A, causando distorção audível.`;
  }
  
  if (baseSug.type === 'dynamics') {
    if (delta > 0) {
      return `Range dinâmico excessivo, indicando falta de compressão. Mixagem pode soar inconsistente e sem punch.`;
    } else {
      return `Range dinâmico muito comprimido. Over-compression remove respiração natural e energia da música.`;
    }
  }
  
  return `Análise técnica automática baseada em desvio de ${Math.abs(delta).toFixed(1)} dB do target recomendado.`;
}

/**
 * 🎛️ Recomenda plugin baseado em tipo de problema
 */
function buildRecommendedPlugin(baseSug) {
  const pluginMap = {
    'loudness': 'FabFilter Pro-L2, Waves L3 Maximizer, iZotope Ozone Maximizer',
    'clipping': 'FabFilter Pro-L2 (True Peak Limiter), Waves WLM Plus',
    'dynamics': 'FabFilter Pro-C2, Waves CLA-76, SSL G-Master Buss Compressor',
    'eq': 'FabFilter Pro-Q3, Waves API 550, SSL E-Channel',
    'stereo': 'iZotope Ozone Imager, Waves S1 Stereo Imager'
  };
  
  return pluginMap[baseSug.type] || 'Plugin específico depende do contexto da mixagem';
}

/**
 * 📐 Constrói parâmetros técnicos baseados em delta
 */
function buildTechnicalParams(baseSug) {
  const delta = parseFloat(String(baseSug.delta || '0').replace(/[^\d.-]/g, ''));
  
  if (Math.abs(delta) < 0.1) {
    return null; // Ajuste muito pequeno
  }
  
  if (baseSug.type === 'loudness') {
    return `Ajuste de Gain: ${delta > 0 ? 'reduzir' : 'aumentar'} aproximadamente ${Math.abs(delta).toFixed(1)} dB no limiter master`;
  }
  
  if (baseSug.type === 'eq' || baseSug.band) {
    const freq = {
      'sub': '20-60Hz',
      'low_bass': '60-120Hz',
      'bass': '120-250Hz',
      'low_mid': '250-500Hz',
      'mid': '500Hz-2kHz',
      'high_mid': '2-4kHz',
      'presence': '4-6kHz',
      'brilliance': '6-20kHz'
    }[baseSug.band] || 'banda detectada';
    
    return `EQ ${delta > 0 ? 'corte' : 'boost'}: ${Math.abs(delta).toFixed(1)} dB em ${freq}, Q: 0.7-1.5`;
  }
  
  if (baseSug.type === 'dynamics') {
    return delta < 0 
      ? `Reduzir compressão: Ratio 2:1-3:1, Threshold +${Math.abs(delta).toFixed(1)} dB mais alto`
      : `Aumentar compressão: Ratio 4:1-6:1, Threshold ${delta.toFixed(1)} dB mais baixo`;
  }
  
  return `Ajuste técnico: compensar ${Math.abs(delta).toFixed(1)} dB de desvio`;
}
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### CENÁRIO: IA retorna texto genérico sem valores

#### ❌ ANTES (Sistema Atual):

**IA retorna**:
```json
{
  "problema": "Low Bass está fora do range ideal",
  "solucao": "Ajuste a banda Low Bass"
}
```

**Validação**:
```
⚠️ Incoerência detectada: texto não menciona currentValue, texto não menciona delta
```

**Resultado final enviado ao frontend**:
```json
{
  "aiEnhanced": true,  // ❌ Marca como enhanced
  "currentValue": "-20.5 dB",  // ✅ Do base
  "targetMin": "-31 dB",
  "targetMax": "-25 dB",
  "delta": "+4.5 dB",
  "problema": "Low Bass acima do limite (valores espectrais)",  // ✅ Do base
  "causaProvavel": "Low Bass está fora do range ideal",  // ❌ IA GENÉRICA
  "solucao": "Reduza Low Bass em 4.5 dB",  // ✅ Do base
  "pluginRecomendado": "Ajuste a banda Low Bass"  // ❌ IA GENÉRICA
}
```

**Problema**: Usuário vê texto misturado - metade coerente, metade genérico.

---

#### ✅ DEPOIS (Com Correções):

**IA retorna**:
```json
{
  "problema": "Low Bass está fora do range ideal",  // ❌ SEM VALORES
  "solucao": "Ajuste a banda Low Bass"
}
```

**Validação**:
```
❌ CRÍTICO: problema não menciona currentValue (-20.5 dB)
❌ CRÍTICO: texto não menciona delta (+4.5 dB)
🚨 REJEIÇÃO TOTAL - useBaseFallback: true
```

**Resultado final enviado ao frontend**:
```json
{
  "aiEnhanced": false,  // ✅ Marca como NÃO enhanced
  "enrichmentStatus": "validation_failed",
  "currentValue": "-20.5 dB",
  "targetMin": "-31 dB",
  "targetMax": "-25 dB",
  "delta": "+4.5 dB",
  "problema": "Low Bass acima do limite (valores espectrais)",  // ✅ BASE
  "causaProvavel": "Excesso de energia na banda low_bass, com +4.5 dB acima do limite máximo recomendado para o gênero. Isso pode causar mascaramento e fadiga auditiva.",  // ✅ FALLBACK TÉCNICO
  "solucao": "Reduza Low Bass em 4.5 dB",  // ✅ BASE
  "pluginRecomendado": "FabFilter Pro-Q3, Waves API 550, SSL E-Channel",  // ✅ FALLBACK TÉCNICO
  "parametros": "EQ corte: 4.5 dB em 60-120Hz, Q: 0.7-1.5"  // ✅ FALLBACK TÉCNICO
}
```

**Resultado**: Usuário vê sugestão 100% coerente com valores reais da análise.

---

## 🎯 CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: Validação Rigorosa

- [ ] Modificar `validateAICoherence()` para adicionar flag `useBaseFallback: true`
- [ ] Modificar validação de `currentValue` para retornar imediatamente se ausente
- [ ] Modificar validação de `delta` para retornar imediatamente se ausente
- [ ] Adicionar validação de `targetRange` mencionado no texto

### FASE 2: Fallback Técnico Completo

- [ ] Criar função `buildTechnicalCause(baseSug)`
- [ ] Criar função `buildRecommendedPlugin(baseSug)`
- [ ] Criar função `buildTechnicalParams(baseSug)`
- [ ] Modificar `mergeSuggestionsWithAI()` para usar fallback completo quando `validation.useBaseFallback === true`
- [ ] Modificar `aiEnhanced` para `false` quando validação falha

### FASE 3: Prompt Mais Restritivo

- [ ] Remover linha "use experiência profissional"
- [ ] Remover linha "preencha lacunas com análise contextual"
- [ ] Adicionar instrução "NUNCA preencha lacunas"
- [ ] Adicionar instrução "Se não conseguir mencionar valores, omita essa sugestão"

### FASE 4: Logs de Diagnóstico

- [ ] Adicionar log quando IA é rejeitada por validação
- [ ] Adicionar log mostrando qual fallback técnico foi usado
- [ ] Adicionar contador de quantas sugestões foram rejeitadas vs aceitas

---

## 🚨 PRIORIDADES

### 🔴 CRÍTICO (Implementar IMEDIATAMENTE):

1. ✅ **CORREÇÃO 2**: Fallback Total Quando IA é Incoerente
   - **Impacto**: Elimina textos genéricos misturados
   - **Complexidade**: Baixa (apenas modificar merge)

2. ✅ **CORREÇÃO 4**: Criar Fallbacks Técnicos Inteligentes
   - **Impacto**: Garante sugestões sempre úteis mesmo sem IA
   - **Complexidade**: Média (3 funções novas)

### 🟡 IMPORTANTE (Implementar LOGO APÓS):

3. ✅ **CORREÇÃO 1**: Validação Mais Rigorosa
   - **Impacto**: Força IA a ser precisa ou ser rejeitada
   - **Complexidade**: Baixa (modificar validação existente)

4. ✅ **CORREÇÃO 3**: Remover Permissão para "Análise Contextual"
   - **Impacto**: Evita que IA gere textos genéricos
   - **Complexidade**: Muito Baixa (editar prompt)

---

## 📋 CONCLUSÃO

**Sistema ATUAL**:
- ✅ NUMERIC LOCK implementado corretamente (valores sempre do base)
- ✅ Validação existe e detecta incoerências
- ❌ Validação é **PERMISSIVA** - aceita textos genéricos
- ❌ Fallback é **PARCIAL** - usa IA incoerente em alguns campos
- ❌ Prompt **PERMITE** "análise contextual" → IA gera texto genérico

**Sistema CORRIGIDO**:
- ✅ NUMERIC LOCK mantido
- ✅ Validação **RIGOROSA** - rejeita completamente se valores ausentes
- ✅ Fallback é **COMPLETO** - ignora IA totalmente se incoerente
- ✅ Fallback **TÉCNICO** - gera textos baseados em dados reais
- ✅ Prompt **PROÍBE** "análise contextual" → IA deve ser precisa ou ser rejeitada

**Resultado esperado**:
- Usuário **SEMPRE** vê valores reais da análise
- Sugestões são coerentes com tabela de targets
- IA é aceita **SOMENTE** se mencionar valores exatos
- Fallback gera textos técnicos úteis, não genéricos

---

## 🔧 PRÓXIMA AÇÃO

Implementar **CORREÇÃO 2 + CORREÇÃO 4** primeiro (fallback completo + fallback técnico), pois tem maior impacto imediato e menor risco de quebrar funcionalidade existente.
