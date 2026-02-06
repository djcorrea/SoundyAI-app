# 🔍 AUDITORIA: LIMPEZA DE VALORES NUMÉRICOS NA COLUNA "AÇÃO SUGERIDA"
**Data:** 3 de fevereiro de 2026  
**Objetivo:** Remover números e unidades da coluna "Ação Sugerida" mantendo backend intacto

---

## 📍 LOCALIZAÇÃO DAS AÇÕES GERADAS

### ✅ ARQUIVO: `public/audio-analyzer-integration.js`

#### 1️⃣ Função `buildRealisticAction()` (Linha 9317-9353)
**Contexto:** Usada APENAS para bandas espectrais

**Exemplos de output atual:**
```javascript
"🔴 Reduzir 2.5 dB"
"⚠️ Aumentar 1.0 dB"
"🔴 Reduzir suavemente (≈ −2 a −5 dB)"
"⚠️ Aumentar levemente (≈ +0.8 dB)"
```

**Locais onde é chamada:**
- Linha 9565: Bandas espectrais (diff >= 2)
- Linha 9569: Bandas espectrais (diff < 2)

#### 2️⃣ Função `calcSeverity()` - Lógica de Fallback (Linha 9586-9592)
**Contexto:** Usada para métricas principais (LUFS, DR, LRA, Stereo)

**Exemplos de output atual:**
```javascript
"⚠️ Reduzir 3.5"      // Linha 9586
"⚠️ Aumentar 2.1"
"🟡 Reduzir 5.0"      // Linha 9589
"🔴 Reduzir 8.2"      // Linha 9592
```

#### 3️⃣ True Peak CLIPPING (Linha 9649)
**Contexto:** Caso especial de clipping digital

**Exemplo de output atual:**
```javascript
"🔴 CLIPPING! Reduzir 3.80 dB"
```

#### 4️⃣ Ações OK (Linha 9547, 9584)
**Contexto:** Quando está dentro do padrão

**Output atual:**
```javascript
"✅ Dentro do padrão"  // OK - manter como está
```

---

## 🎯 PADRÕES IDENTIFICADOS

### Estrutura dos Textos de Ação:

| Padrão | Regex | Exemplos |
|--------|-------|----------|
| **Número + unidade** | `\d+\.?\d*\s*(dB\|LU\|DR)` | "2.5 dB", "0.8 dB", "3.80 dB" |
| **Apenas número** | `\d+\.?\d*(?!\s*dB)` | "3.5", "2.1", "8.2" |
| **Range com números** | `≈\s*[+−-]\d+\.?\d*\s*a\s*[+−-]\d+\.?\d*\s*dB` | "≈ −2 a −5 dB", "≈ +2 a +5 dB" |
| **Parênteses com número** | `\([^)]*\d+\.?\d*[^)]*\)` | "(≈ +0.8 dB)", "(≈ −2.5 dB)" |

---

## 🔧 SOLUÇÃO PROPOSTA

### Criar Função `sanitizeActionText()`

**Localização:** Antes de `renderGenreComparisonTable()` (~linha 9360)

**Lógica:**
1. Preservar emojis (🔴, 🟡, ⚠️, ✅)
2. Preservar palavras-chave (Reduzir, Aumentar, CLIPPING, Dentro do padrão)
3. Remover:
   - Números decimais (ex: 3.5, 0.80)
   - Unidades (dB, LU, DR)
   - Parênteses com valores (ex: "(≈ +0.8 dB)")
   - Ranges numéricos (ex: "−2 a −5 dB")
   - Advérbios com números (ex: "levemente (≈ +0.8 dB)" → "levemente")

### Exemplos de Transformação:

| ANTES | DEPOIS |
|-------|--------|
| `⚠️ Reduzir 3.5` | `⚠️ Reduzir` |
| `⚠️ Aumentar 2.1` | `⚠️ Aumentar` |
| `🔴 Reduzir 8.2` | `🔴 Reduzir` |
| `🔴 CLIPPING! Reduzir 3.80 dB` | `🔴 Clipping digital – Reduzir` |
| `🔴 Reduzir 2.5 dB` | `🔴 Reduzir` |
| `⚠️ Aumentar levemente (≈ +0.8 dB)` | `⚠️ Aumentar levemente` |
| `🔴 Reduzir suavemente (≈ −2 a −5 dB)` | `🔴 Reduzir suavemente` |
| `✅ Dentro do padrão` | `✅ Dentro do padrão` |

---

## 📝 IMPLEMENTAÇÃO

### 1️⃣ Adicionar Função Helper

```javascript
/**
 * 🧹 SANITIZAÇÃO DE TEXTO DE AÇÃO (Front-end apenas)
 * 
 * Remove valores numéricos e unidades da string de ação,
 * mantendo apenas emoji + verbo + advérbios.
 * 
 * Backend continua calculando valores normalmente.
 * 
 * @param {string} actionText - Texto original da ação
 * @returns {string} - Texto limpo sem números/unidades
 */
function sanitizeActionText(actionText) {
    if (!actionText || typeof actionText !== 'string') {
        return actionText;
    }
    
    let cleaned = actionText;
    
    // 🎯 CASO ESPECIAL: CLIPPING
    if (cleaned.includes('CLIPPING!')) {
        // "🔴 CLIPPING! Reduzir 3.80 dB" → "🔴 Clipping digital – Reduzir"
        cleaned = cleaned.replace(/CLIPPING!\s+/i, 'Clipping digital – ');
    }
    
    // 🧹 REMOVER: Ranges numéricos (ex: "≈ −2 a −5 dB")
    cleaned = cleaned.replace(/≈\s*[+−-]?\d+\.?\d*\s*a\s*[+−-]?\d+\.?\d*\s*dB/g, '');
    
    // 🧹 REMOVER: Parênteses com conteúdo numérico (ex: "(≈ +0.8 dB)")
    cleaned = cleaned.replace(/\([^)]*\d+\.?\d*[^)]*\)/g, '');
    
    // 🧹 REMOVER: Números + unidades (ex: "3.5 dB", "2.1 LU")
    cleaned = cleaned.replace(/\d+\.?\d*\s*(dB|LU|DR)/gi, '');
    
    // 🧹 REMOVER: Números soltos (ex: "3.5", "2.1")
    // Importante: fazer DEPOIS de remover números com unidade
    cleaned = cleaned.replace(/\s+\d+\.?\d*(?!\s*(dB|LU|DR))/g, '');
    
    // 🧹 LIMPAR: Espaços duplicados e espaços antes de pontuação
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
    
    return cleaned;
}
```

### 2️⃣ Aplicar Sanitização na Renderização

**Modificar apenas a parte de exibição:**

**ANTES:**
```javascript
<td class="metric-action ${result.severityClass}">
    ${canRender ? result.action : renderSecurePlaceholder('action')}
</td>
```

**DEPOIS:**
```javascript
<td class="metric-action ${result.severityClass}">
    ${canRender ? sanitizeActionText(result.action) : renderSecurePlaceholder('action')}
</td>
```

**Locais a alterar (7 ocorrências):**
1. LUFS (Linha ~9620)
2. True Peak (Linha ~9668)
3. DR (Linha ~9693)
4. LRA (Linha ~9718)
5. Stereo (Linha ~9743)
6. Bandas Espectrais (Linha ~9882)

---

## ✅ GARANTIAS DE SEGURANÇA

### 🔒 Backend NÃO Alterado
- ✅ Função `buildRealisticAction()` continua gerando valores completos
- ✅ Função `calcSeverity()` continua calculando `diff` e `action` com números
- ✅ Variável `result.action` internamente contém o valor completo (ex: "Reduzir 3.5 dB")
- ✅ Sistema de score e sugestões avançadas recebem valores completos

### 📺 Apenas Renderização Alterada
- ✅ `sanitizeActionText()` é aplicada SOMENTE na última milha (HTML)
- ✅ Logs de debug continuam mostrando valores completos
- ✅ Outras partes do sistema que usam `result.action` não são afetadas

---

## 🧪 CASOS DE TESTE

| Input Original | Output Esperado |
|----------------|-----------------|
| `⚠️ Reduzir 3.5` | `⚠️ Reduzir` |
| `⚠️ Aumentar 4.0 dB` | `⚠️ Aumentar` |
| `🔴 Reduzir 1.5 dB` | `🔴 Reduzir` |
| `🔴 CLIPPING! Reduzir 3.80 dB` | `🔴 Clipping digital – Reduzir` |
| `✅ Dentro do padrão` | `✅ Dentro do padrão` |
| `⚠️ Aumentar levemente (≈ +0.8 dB)` | `⚠️ Aumentar levemente` |
| `🔴 Reduzir suavemente (≈ −2 a −5 dB)` | `🔴 Reduzir suavemente` |
| `🟡 Reduzir 5.0` | `🟡 Reduzir` |
| `Sem dados` | `Sem dados` |
| `N/A` | `N/A` |

---

## 📊 RESULTADO VISUAL

### ANTES:
```
┌─────────────┬──────────┬────────────┬───────────────────────────┐
│   Métrica   │  Valor   │ Severidade │      Ação Sugerida        │
├─────────────┼──────────┼────────────┼───────────────────────────┤
│ 🔊 Loudness │ -10.5 dB │  ATENÇÃO   │ ⚠️ Reduzir 3.5           │
│ 🎚️ True Peak│ -0.8 dBTP│  ATENÇÃO   │ ⚠️ Reduzir 0.2           │
│ 📊 DR       │  8.2 DR  │     OK     │ ✅ Dentro do padrão       │
│ 🔉 Sub      │ -28.5 dB │  ATENÇÃO   │ ⚠️ Aumentar levemente ... │
└─────────────┴──────────┴────────────┴───────────────────────────┘
```

### DEPOIS:
```
┌─────────────┬──────────┬────────────┬──────────────────────────┐
│   Métrica   │  Valor   │ Severidade │     Ação Sugerida        │
├─────────────┼──────────┼────────────┼──────────────────────────┤
│ 🔊 Loudness │ -10.5 dB │  ATENÇÃO   │ ⚠️ Reduzir              │
│ 🎚️ True Peak│ -0.8 dBTP│  ATENÇÃO   │ ⚠️ Reduzir              │
│ 📊 DR       │  8.2 DR  │     OK     │ ✅ Dentro do padrão      │
│ 🔉 Sub      │ -28.5 dB │  ATENÇÃO   │ ⚠️ Aumentar levemente   │
└─────────────┴──────────┴────────────┴──────────────────────────┘
```

**Mais limpo, direto e profissional!**

---

## 📌 ARQUIVOS AFETADOS

### Modificado:
- ✅ `public/audio-analyzer-integration.js` (1 função nova + 6 chamadas)

### NÃO modificados:
- ✅ Nenhum arquivo de backend
- ✅ Nenhuma lógica de cálculo

---

**Status:** ✅ Auditoria completa - Pronto para implementação
