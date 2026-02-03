# 🔍 AUDITORIA: REMOÇÃO DE COLUNAS "ALVO" E "DIFERENÇA" DA TABELA DE MÉTRICAS
**Data:** 3 de fevereiro de 2026  
**Objetivo:** Remover colunas "Alvo" e "Diferença" do front-end mantendo toda lógica de backend intacta

---

## 📍 LOCALIZAÇÃO DA TABELA DE MÉTRICAS

### ✅ ARQUIVO PRINCIPAL
**Caminho:** `public/audio-analyzer-integration.js`  
**Função:** `renderGenreComparisonTable()`  
**Linhas:** 9368 - 10100+

### 🎯 ESTRUTURA ATUAL DA TABELA

#### HTML Gerado (Linhas ~9950-9965):
```html
<table class="classic-genre-table">
    <thead>
        <tr>
            <th>Métrica</th>
            <th>Valor</th>
            <th>Alvo</th>              ← ❌ REMOVER
            <th>Diferença</th>          ← ❌ REMOVER
            <th>Severidade</th>
            <th>Ação Sugerida</th>
        </tr>
    </thead>
    <tbody>
        <!-- Linhas de métricas -->
    </tbody>
</table>
```

#### Exemplo de Linha de Métrica (LUFS - Linhas ~9616-9623):
```html
<tr class="genre-row ${result.severityClass}">
    <td class="metric-name">🔊 Loudness (LUFS Integrado)</td>
    <td class="metric-value">${lufsValue.toFixed(2)} LUFS</td>
    <td class="metric-target">${genreData.lufs_target.toFixed(1)} LUFS</td>     ← ❌ REMOVER
    <td class="metric-diff">${(result.diff >= 0 ? '+' : '') + result.diff.toFixed(2)}</td>  ← ❌ REMOVER
    <td class="metric-severity ${result.severityClass}">${result.severity}</td>
    <td class="metric-action ${result.severityClass}">${result.action}</td>
</tr>
```

### 📊 MÉTRICAS RENDERIZADAS

#### 1️⃣ Métricas Principais (5 métricas):
- **LUFS Integrado** (Linhas 9599-9625)
- **True Peak** (Linhas 9633-9675)
- **Dynamic Range (DR)** (Linhas 9677-9699)
- **Loudness Range (LRA)** (Linhas 9701-9723)
- **Stereo Correlation** (Linhas 9725-9747)

#### 2️⃣ Bandas Espectrais (8 bandas):
- Sub (20-60 Hz)
- Bass (60-120 Hz)
- Upper Bass (120-250 Hz)
- Low Mid (250-500 Hz)
- Mid (500-2k Hz)
- High Mid (2k-4k Hz)
- Presença (10k-20k Hz)
- Brilho (4k-10k Hz)

**Renderização:** Linhas 9763-9902

---

## 🎨 ESTILOS CSS DA TABELA

### Arquivo: `public/audio-analyzer-integration.js`
**Estilos Inline:** Linhas ~10000-10100 (dentro da função `renderGenreComparisonTable`)

#### Classes CSS Relevantes:
```css
.classic-genre-table                  /* Tabela principal */
.classic-genre-table th               /* Cabeçalhos */
.classic-genre-table td               /* Células */
.genre-row                            /* Linhas de métricas */
.metric-name                          /* Coluna 1: Nome da métrica */
.metric-value                         /* Coluna 2: Valor atual */
.metric-target                        /* Coluna 3: Alvo ❌ REMOVER */
.metric-diff                          /* Coluna 4: Diferença ❌ REMOVER */
.metric-severity                      /* Coluna 5: Severidade */
.metric-action                        /* Coluna 6: Ação sugerida */
```

#### Larguras das Colunas (Linhas ~10026-10031):
```css
.classic-genre-table th:nth-child(2) { width: 14%; }  /* Valor */
.classic-genre-table th:nth-child(3) { width: 14%; }  /* Alvo ❌ */
.classic-genre-table th:nth-child(4) { width: 14%; }  /* Diferença ❌ */
.classic-genre-table th:nth-child(5) { width: 14%; }  /* Severidade */
.classic-genre-table th:nth-child(6) { width: 24%; }  /* Ação */
```

---

## ⚙️ LÓGICA DE BACKEND (NÃO ALTERAR)

### ✅ Funções que Calculam Targets/Diferenças:
1. **`calcSeverity()`** (Linha 9540) - Calcula severidade baseada em target e tolerância
2. **`applyStreamingOverride()`** - Aplica targets específicos para streaming
3. **Variáveis de target:**
   - `genreData.lufs_target`
   - `genreData.true_peak_target`
   - `genreData.dr_target`
   - `genreData.lra_target`
   - `genreData.stereo_target`
   - `targetBands` (para bandas espectrais)

### ⚠️ GARANTIAS:
- ✅ Todos os cálculos de `diff`, `target` continuam executando
- ✅ Função `calcSeverity()` permanece intacta
- ✅ Sistema de classificação (OK, ATENÇÃO, ALTA, CRÍTICA) não muda
- ✅ Ações sugeridas continuam sendo geradas normalmente
- ❌ Apenas **não renderizamos** as colunas no HTML

---

## 🔧 MUDANÇAS A SEREM REALIZADAS

### 1️⃣ Remover Cabeçalhos das Colunas (Linha ~9952):
```html
<!-- ANTES -->
<th>Alvo</th>
<th>Diferença</th>

<!-- DEPOIS -->
<!-- Removidos -->
```

### 2️⃣ Remover Células das Colunas em Cada Métrica:
**Ocorrências:**
- LUFS (Linhas 9619-9620)
- True Peak (Linhas 9668-9669)
- DR (Linhas 9693-9694)
- LRA (Linhas 9718-9719)
- Stereo (Linhas 9743-9744)
- Bandas Espectrais (Linhas ~9880-9881)

```html
<!-- ANTES -->
<td class="metric-target">...</td>
<td class="metric-diff">...</td>

<!-- DEPOIS -->
<!-- Removidos -->
```

### 3️⃣ Ajustar CSS:
**Remover estilos para colunas 3 e 4:**
```css
/* REMOVER */
.classic-genre-table th:nth-child(3) { width: 14%; }
.classic-genre-table th:nth-child(4) { width: 14%; }
```

**Redistribuir larguras (nova estrutura de 4 colunas):**
```css
.classic-genre-table th:first-child { width: 25%; }  /* Nome */
.classic-genre-table th:nth-child(2) { width: 18%; } /* Valor */
.classic-genre-table th:nth-child(3) { width: 18%; } /* Severidade */
.classic-genre-table th:nth-child(4) { width: 39%; } /* Ação */
```

### 4️⃣ Responsividade Mobile:
**Garantir que nova estrutura de 4 colunas funcione em telas pequenas**

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Tabela renderiza apenas 4 colunas: Métrica, Valor, Severidade, Ação
- [ ] Nenhum erro no console
- [ ] Cálculos de backend continuam funcionando (verificar em Network/logs)
- [ ] Severidade continua correta (OK, ATENÇÃO, ALTA, CRÍTICA)
- [ ] Ações sugeridas continuam aparecendo corretamente
- [ ] Layout responsivo funciona em mobile (< 768px)
- [ ] Estilos de cores de severidade mantidos
- [ ] Bandas espectrais renderizadas corretamente

---

## 📌 NOTAS IMPORTANTES

1. **NÃO MEXER EM:**
   - Função `calcSeverity()` (linha 9540)
   - Variáveis `result.diff` e `result.target`
   - Qualquer lógica de cálculo matemático
   - Funções de backend (`applyStreamingOverride`, `shouldRenderRealValue`)

2. **SEGURANÇA:**
   - Sistema de placeholders seguros (`renderSecurePlaceholder`) permanece ativo
   - Guards de `shouldRenderRealValue()` não são afetados

3. **ARQUIVOS RELACIONADOS:**
   - `public/audio-analyzer-integration.js` - ÚNICO arquivo a modificar
   - CSS está inline na mesma função
   - Não há arquivos HTML separados para essa tabela

---

## 🎯 RESULTADO ESPERADO

### Tabela DEPOIS das Mudanças:

| Métrica | Valor | Severidade | Ação Sugerida |
|---------|-------|------------|---------------|
| 🔊 Loudness (LUFS) | -10.5 LUFS | OK | ✅ Dentro do padrão |
| 🎚️ True Peak | -0.8 dBTP | ATENÇÃO | ⚠️ Reduzir 0.2 dB |
| 📊 Dynamic Range | 8.2 DR | OK | ✅ Dentro do padrão |

**Visualmente:** Tabela mais limpa, foca no que importa para o usuário (valor, status, ação).

---

**Status:** ✅ Auditoria completa - Pronto para implementação
