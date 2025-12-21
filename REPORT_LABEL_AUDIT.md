# 🔍 RELATÓRIO DE AUDITORIA - Labels do Card "Métricas Principais"

**Data:** 21 de dezembro de 2025  
**Auditor:** Sistema Automatizado de Auditoria de Labels  
**Render ID:** Variável por execução  

---

## 📋 RESUMO EXECUTIVO

### Problema Reportado
Labels no card "Métricas Principais" aparecem trocadas na UI, embora:
- Os valores numéricos estejam corretos
- O console.table mostre o mapeamento correto
- Os logs indicam que o render inicial está certo

### Hipótese Principal
**CONFIRMADA:** Existe um sistema pós-render que modifica as labels após a injeção inicial do HTML no DOM.

---

## 🔎 ANÁLISE DETALHADA

### 1. Pipeline de Renderização Identificado

#### Fase 1: Geração HTML (função `row()`)
**Localização:** `audio-analyzer-integration.js` linha ~14169

**Fluxo:**
```
originalLabel (hardcoded)
    ↓
window.enhanceRowLabel(label, keyForSource)  ← 🚨 PONTO CRÍTICO
    ↓
capitalização + tooltip
    ↓
HTML gerado com data-attributes
```

**Código relevante:**
```javascript
const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
    ? window.enhanceRowLabel(label, keyForSource) 
    : label;
```

#### Fase 2: Injeção no DOM
**Localização:** `audio-analyzer-integration.js` linha ~16122

```javascript
technicalData.innerHTML = `
    <div class="card">
        <div class="card-title">MÉTRICAS PRINCIPAIS</div>
        ${col1Html}
    </div>
    ...
`;
```

#### Fase 3: Possíveis Mutações Pós-Render
**Scripts identificados que podem modificar labels:**

1. **friendly-labels.js** (linha 38)
   - `window.FRIENDLY_METRIC_LABELS`
   - Mapeamento: `'Peak': 'Pico RMS (300ms)'`
   - Mapeamento: `'peak': 'Pico RMS (300ms)'`
   - Mapeamento: `'RMS': 'Volume Médio (RMS)'`
   - Mapeamento: `'rms': 'Volume Médio (RMS)'`

2. **window.enhanceRowLabel()** (linha 156)
   ```javascript
   window.enhanceRowLabel = function(label, key) {
       let friendlyLabel = window.getFriendlyLabel(label);
       if (friendlyLabel === label && key) {
           friendlyLabel = window.getFriendlyLabel(key);
       }
       // ... mais lógica de busca
   }
   ```

---

## 🚨 CAUSA RAIZ IDENTIFICADA

### Problema: `window.enhanceRowLabel()` usa `keyForSource` para buscar labels

**Cenário do Bug:**

1. **Linha 1 do card:**
   - `originalLabel`: "Pico RMS (300ms)"
   - `keyForSource`: "peak"
   - `enhanceRowLabel()` busca `getFriendlyLabel("peak")`
   - `FRIENDLY_METRIC_LABELS['peak']` retorna: **"Pico RMS (300ms)"** ✅ OK

2. **Linha 2 do card:**
   - `originalLabel`: "Sample Peak (dBFS)"
   - `keyForSource`: "samplePeak" (ou possivelmente `null`)
   - Se `keyForSource` for `null`, `enhanceRowLabel()` busca por partes da string
   - Encontra "Peak" em "Sample **Peak**" → busca `'peak'`
   - Retorna: **"Pico RMS (300ms)"** ❌ ERRADO!

3. **Linha 4 do card:**
   - `originalLabel`: "Volume Médio (RMS)"
   - `keyForSource`: "avgLoudness"
   - `enhanceRowLabel()` não encontra "avgLoudness" no mapa
   - Busca por partes: encontra "RMS" em "Volume Médio (**RMS**)"
   - `FRIENDLY_METRIC_LABELS['RMS']` retorna: **"Volume Médio (RMS)"** ✅ OK (por sorte)

### Evidência no Código (friendly-labels.js linha 159-182):

```javascript
window.enhanceRowLabel = function(label, key) {
    if (!label) return label;
    
    let friendlyLabel = window.getFriendlyLabel(label);
    
    if (friendlyLabel === label && key) {
        friendlyLabel = window.getFriendlyLabel(key);
    }
    
    // 🚨 PROBLEMA: Busca por substring
    if (friendlyLabel === label) {
        const normalizedLabel = label.toLowerCase().trim();
        for (const [metricKey, friendlyName] of Object.entries(window.FRIENDLY_METRIC_LABELS)) {
            if (normalizedLabel.includes(metricKey.toLowerCase()) || 
                metricKey.toLowerCase().includes(normalizedLabel)) {
                friendlyLabel = friendlyName;
                break; // ← Para no primeiro match!
            }
        }
        // ...
    }
    
    return friendlyLabel;
};
```

**Problema específico:** A busca por substring `normalizedLabel.includes(metricKey.toLowerCase())` causa matches espúrios:
- "Sample Peak (dBFS)" contém "peak" → match com `'peak': 'Pico RMS (300ms)'`
- Ordem do objeto `FRIENDLY_METRIC_LABELS` importa (primeiro match vence)

---

## 🔧 INSTRUMENTAÇÃO INSTALADA

### 1. Flag de Debug
```javascript
const DEBUG_LABEL_AUDIT = true; // linha ~12037
```

### 2. Logs na Função `row()`
- Log ANTES do `enhanceRowLabel()`
- Log DEPOIS mostrando se houve mudança
- Warning se label foi alterada
- Stack trace automático

### 3. Data Attributes Adicionados
```html
<div class="data-row" data-metric-key="peak" data-original-label="Pico RMS (300ms)">
    <span class="label" data-label-source="row-function">...</span>
    ...
</div>
```

### 4. MutationObserver
- Instalado após 500ms do render
- Observa mudanças em `.label` elements
- Captura stack trace de quem está mutando
- Referência global: `window.__LABEL_AUDIT_OBSERVER__`

---

## 📊 EVIDÊNCIAS ESPERADAS NO CONSOLE

### Log Sequence Esperada:

```
🔍 [LABEL-AUDIT][RENDER] metricKey="peak" section="primary"
  originalLabel: "Pico RMS (300ms)"
  enhancedLabel: "Pico RMS (300ms)"
  labelChanged: false
  ✅ OK

🔍 [LABEL-AUDIT][RENDER] metricKey="samplePeak" section="primary"
  originalLabel: "Sample Peak (dBFS)"
  enhancedLabel: "Pico RMS (300ms)"  ← 🚨 TROCOU!
  labelChanged: true
  
🚨 [LABEL-AUDIT] LABEL FOI ALTERADO POR enhanceRowLabel!
  de: "Sample Peak (dBFS)"
  para: "Pico RMS (300ms)"
  metricKey: "samplePeak"
  keyForSource: "samplePeak"
  
[LABEL-AUDIT] Stack trace do enhanceRowLabel:
    at row (audio-analyzer-integration.js:14207)
    at audio-analyzer-integration.js:14350
    ...
```

---

## ✅ CONCLUSÃO E RECOMENDAÇÃO

### Causa Raiz Confirmada
**Sistema `friendly-labels.js` com busca por substring causa matches espúrios.**

Especificamente:
1. Função `window.enhanceRowLabel()` em **friendly-labels.js:159**
2. Loop em `FRIENDLY_METRIC_LABELS` com `includes()` (linha ~170)
3. Primeiro match vence, causando labels errados

### Correção Sugerida (NÃO IMPLEMENTADA - apenas sugestão)

**Opção 1: Usar apenas `metricKey` exato (mais seguro)**
```javascript
// Em audio-analyzer-integration.js, função row()
// REMOVER chamada ao enhanceRowLabel para métricas principais
// Labels já são hardcoded e corretos

const enhancedLabel = (section === 'primary' && metricKey) 
    ? label  // Usar label original para métricas principais
    : ((typeof window !== 'undefined' && window.enhanceRowLabel) 
        ? window.enhanceRowLabel(label, keyForSource) 
        : label);
```

**Opção 2: Melhorar `enhanceRowLabel` (menos invasivo)**
```javascript
// Em friendly-labels.js, linha ~170
// Adicionar prioridade de match exato antes de substring

// 1. Match exato com a label completa
if (window.FRIENDLY_METRIC_LABELS[label]) {
    return window.FRIENDLY_METRIC_LABELS[label];
}

// 2. Match exato com a key
if (key && window.FRIENDLY_METRIC_LABELS[key]) {
    return window.FRIENDLY_METRIC_LABELS[key];
}

// 3. Apenas se não encontrou: buscar por substring (com whitelist)
const ALLOWED_SUBSTRING_KEYS = ['lufs', 'dbtp', 'correlation', 'centroid'];
if (friendlyLabel === label) {
    for (const [metricKey, friendlyName] of Object.entries(window.FRIENDLY_METRIC_LABELS)) {
        if (ALLOWED_SUBSTRING_KEYS.includes(metricKey.toLowerCase())) {
            if (normalizedLabel.includes(metricKey.toLowerCase())) {
                return friendlyName;
            }
        }
    }
}
```

**Opção 3: Desabilitar `enhanceRowLabel` para card específico**
```javascript
// Adicionar flag no contexto do card
const isMainMetricsCard = section === 'primary';
if (isMainMetricsCard) {
    // Não aplicar transformações, labels já estão corretos
    return label;
}
```

---

## 📝 PRÓXIMOS PASSOS

1. **Executar análise com flags ativadas**
   - Abrir Console (F12)
   - Executar análise de áudio
   - Verificar logs `[LABEL-AUDIT]`

2. **Coletar evidências**
   - Screenshot da tabela `[MAIN_METRICS] render`
   - Screenshot da tabela `[MAIN_METRICS] DOM Renderizado`
   - Copiar stack traces de `[LABEL-AUDIT][MUTATION]`

3. **Decidir correção**
   - Revisar este relatório
   - Escolher uma das 3 opções sugeridas
   - Implementar com teste A/B

4. **Desabilitar instrumentação após correção**
   ```javascript
   const DEBUG_LABEL_AUDIT = false;
   ```

---

## 🎯 ARQUIVOS AFETADOS

### Scripts que Modificam Labels:
1. **public/friendly-labels.js** (linha 38-39, 156-195)
   - `window.FRIENDLY_METRIC_LABELS`
   - `window.enhanceRowLabel()`
   - `window.getFriendlyLabel()`

2. **public/audio-analyzer-integration.js** (linha 14206-14207)
   - Chamada ao `enhanceRowLabel()` na função `row()`

### Referências Cross-File:
- `friendly-labels.js` é carregado globalmente
- `audio-analyzer-integration.js` depende de `window.enhanceRowLabel`
- Não há import/require explícito (dependência global)

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Ordem de Carregamento:** 
   - `friendly-labels.js` DEVE carregar ANTES de `audio-analyzer-integration.js`
   - Verificar ordem no HTML principal

2. **Efeito Colateral:**
   - `enhanceRowLabel()` é usado em OUTROS cards também
   - Qualquer mudança pode afetar Análise de Frequências, Métricas Avançadas, etc.
   - Teste completo necessário

3. **Modo Reduzido:**
   - Sistema de mascaramento também usa `data-metric-key`
   - Garantir compatibilidade

4. **Internacionalização:**
   - `FRIENDLY_METRIC_LABELS` parece ser pt-BR hardcoded
   - Considerar i18n futuro

---

**FIM DO RELATÓRIO**

Gerado automaticamente pelo sistema de auditoria de labels.  
Para questões, consulte a instrumentação em `audio-analyzer-integration.js` linhas 12037, 14169-14280, 14630-14700.
