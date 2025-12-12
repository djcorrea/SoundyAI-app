# 🔒 AUDITORIA COMPLETA - MODO REDUCED (SEGURANÇA DOM)
**Data:** 12 de dezembro de 2025  
**Tipo:** Auditoria de Segurança + Correções Obrigatórias  
**Status:** 🔴 CRÍTICO - Vazamentos Identificados

---

## 📋 RESUMO EXECUTIVO

### ❌ PROBLEMA CRÍTICO IDENTIFICADO

O modo Reduced implementado anteriormente possui **FALHAS GRAVES DE SEGURANÇA**:

1. **Allowlists INVERTIDAS** - Métricas liberadas estão bloqueadas e vice-versa
2. **Vazamento via DOM** - Valores reais existem no HTML mesmo quando bloqueados
3. **Tabela incorreta** - Targets errados sendo renderizados
4. **Blur insuficiente** - CSS apenas esconde, não protege

### ✅ SOLUÇÃO PROPOSTA

Implementar **RENDERIZAÇÃO CONDICIONAL REAL** onde:
- Valores bloqueados NUNCA entram no DOM
- Placeholders seguros substituem dados reais
- Allowlists corrigidas conforme regras atuais
- Tabela renderiza apenas métricas permitidas

---

## 🎯 REGRAS CORRETAS (REQUISITO ATUALIZADO)

### ✅ MÉTRICAS LIBERADAS (visíveis no plano free):
1. **Dinâmica (DR)** → `dr`, `dynamicRange`
2. **Imagem Estéreo** → `stereoCorrelation`, `correlation`
3. **Low Mid (250-500 Hz)** → `band_low_mid`, `band_lowMid`
4. **High Mid (2-4 kHz)** → `band_high_mid`, `band_highMid`  
5. **Presença (10-20 kHz)** → `band_presence`, `band_air`

### 🔒 MÉTRICAS BLOQUEADAS (placeholder no plano free):
1. **Loudness (LUFS)** → `lufsIntegrated`, `lufs`
2. **True Peak (dBTP)** → `truePeakDbtp`, `truePeak`
3. **LRA** → `lra`, `loudnessRange`
4. **Sub (20-60 Hz)** → `band_sub`
5. **Bass (60-120 Hz)** → `band_bass`
6. **Mid (500-2k Hz)** → `band_mid`
7. **Todas as métricas avançadas** (exceto DR já liberado)

---

## 🔍 AUDITORIA DETALHADA

### 1️⃣ ALLOWLISTS INVERTIDAS (ERRO CRÍTICO)

#### ❌ Estado Atual (ERRADO):
```javascript
// secure-render-utils.js - Linhas 20-45
const REDUCED_MODE_ALLOWLISTS = {
    primary: ['lufsIntegrated', 'truePeak', 'dr', 'scoreFinal'],  // ❌ LUFS e TP devem ser BLOQUEADOS
    frequency: [],  // ❌ Deveria permitir Low Mid, High Mid, Presença
    advanced: [],
    table: ['lra', 'dr', 'stereoCorrelation']  // ❌ LRA deve ser BLOQUEADO
};
```

#### ✅ Correção Necessária:
```javascript
const REDUCED_MODE_ALLOWLISTS = {
    // Métricas principais: apenas DR e Score
    primary: ['dr', 'dynamicRange', 'scoreFinal'],
    
    // Frequências: Low Mid, High Mid, Presença, Ar
    frequency: [
        'band_low_mid', 'band_lowMid', 'lowMid',
        'band_high_mid', 'band_highMid', 'highMid',
        'band_presence', 'presence',
        'band_air', 'air'
    ],
    
    // Avançadas: TUDO bloqueado
    advanced: [],
    
    // Tabela: DR e Estéreo apenas
    table: ['dr', 'dynamicRange', 'stereoCorrelation', 'correlation']
};
```

---

### 2️⃣ VAZAMENTO NO DOM (CRÍTICO)

#### 🔍 Problema Identificado:

**Arquivo:** `audio-analyzer-integration.js` - Função `renderGenreComparisonTable()`

```javascript
// Linhas 6000-6020 (exemplo)
rows.push(`
    <tr class="genre-row ${result.severityClass}">
        <td class="metric-name">🔊 Loudness (LUFS)</td>
        <td class="metric-value">${lufsValue.toFixed(2)} LUFS</td>  // ❌ VALOR REAL NO DOM
        <td class="metric-target">${genreData.lufs_target.toFixed(1)} LUFS</td>  // ❌ TARGET REAL
        <td class="metric-diff">${result.diff.toFixed(2)}</td>  // ❌ DIFERENÇA REAL
        <td class="metric-severity">${result.severity}</td>
        <td class="metric-action">${result.action}</td>
    </tr>
`);
```

**Vulnerabilidade:**
- Inspecionar Elemento revela `-14.2 LUFS`
- Copiar/colar funciona
- JavaScript pode ler `textContent`

#### ✅ Correção Necessária:

```javascript
// VERIFICAR SE MÉTRICA É PERMITIDA ANTES DE RENDERIZAR
const isMetricAllowed = (metricKey) => {
    if (analysis.analysisMode !== 'reduced') return true;
    
    // Verificar contra allowlist correta
    const allowedInTable = [
        'dr', 'dynamicRange',
        'stereoCorrelation', 'correlation'
    ];
    
    return allowedInTable.includes(metricKey);
};

// RENDERIZAÇÃO CONDICIONAL
if (genreData.lufs_target !== null) {
    const lufsValue = lufsIntegrated;
    
    if (!isMetricAllowed('lufsIntegrated')) {
        // ✅ PLACEHOLDER SEGURO
        rows.push(`
            <tr class="genre-row blocked-metric">
                <td class="metric-name">🔊 Loudness (LUFS)</td>
                <td class="metric-value"><span class="blocked-value">•••• 🔒</span></td>
                <td class="metric-target"><span class="blocked-value">•••• 🔒</span></td>
                <td class="metric-diff"><span class="blocked-value">—</span></td>
                <td class="metric-severity"><span class="upgrade-hint">🔒</span></td>
                <td class="metric-action">
                    <a href="/planos.html" class="upgrade-link">Desbloqueie no plano Pro</a>
                </td>
            </tr>
        `);
    } else {
        // ✅ VALOR REAL (somente se permitido)
        const result = calcSeverity(lufsValue, genreData.lufs_target, genreData.tol_lufs);
        rows.push(`
            <tr class="genre-row ${result.severityClass}">
                <td class="metric-name">🔊 Loudness (LUFS)</td>
                <td class="metric-value">${lufsValue.toFixed(2)} LUFS</td>
                <td class="metric-target">${genreData.lufs_target.toFixed(1)} LUFS</td>
                <td class="metric-diff">${result.diff.toFixed(2)}</td>
                <td class="metric-severity">${result.severity}</td>
                <td class="metric-action">${result.action}</td>
            </tr>
        `);
    }
}
```

---

### 3️⃣ FUNÇÃO `kpi()` E `row()` - VAZAMENTO PARCIAL

#### 🔍 Problema:

**Arquivo:** `audio-analyzer-integration.js` - Linhas ~12610-12700

```javascript
const kpi = (value, label, cls='', metricKey='', section='primary') => {
    if (window.SecureRenderUtils && metricKey) {
        return window.SecureRenderUtils.renderSecureKPI(...);
    }
    
    // ❌ FALLBACK INSEGURO: Renderiza valor real mesmo se bloqueado
    return `<div class="kpi ${cls}">${value}</div>`;
};
```

**Problema:** Se `SecureRenderUtils` não carregar ou falhar, valores reais vazam no fallback.

#### ✅ Correção Necessária:

```javascript
const kpi = (value, label, cls='', metricKey='', section='primary') => {
    // ✅ Sempre verificar modo reduced primeiro
    const isReduced = analysis.analysisMode === 'reduced';
    
    if (window.SecureRenderUtils && metricKey) {
        return window.SecureRenderUtils.renderSecureKPI(
            value, label, metricKey, section, analysis, { className: cls }
        );
    }
    
    // ✅ FALLBACK SEGURO: Verificar allowlist manualmente
    if (isReduced && metricKey) {
        const allowed = checkMetricAllowed(metricKey, section);
        if (!allowed) {
            return `
                <div class="kpi ${cls} blocked-kpi">
                    <div class="kpi-value blocked-value">•••• 🔒</div>
                    <div class="kpi-label">${label}</div>
                </div>`;
        }
    }
    
    // Apenas se permitido ou modo full
    return `
        <div class="kpi ${cls}">
            <div class="kpi-value">${value}</div>
            <div class="kpi-label">${label}</div>
        </div>`;
};
```

---

### 4️⃣ SUGESTÕES IA - VAZAMENTO DE TEXTO

#### 🔍 Problema:

**Arquivo:** `ai-suggestion-ui-controller.js` - Função `renderAIEnrichedCard()`

```javascript
// Linhas ~1250-1280
<div class="ai-block ai-block-problema">
    <div class="ai-block-title">⚠️ Problema</div>
    <div class="ai-block-content">${problema}</div>  // ❌ TEXTO REAL NO DOM
</div>
```

**Vulnerabilidade:**
- Mesmo com `.metric-blur`, texto está no DOM
- Inspecionar revela conteúdo completo

#### ✅ Correção Necessária:

```javascript
// VERIFICAR SE SUGESTÃO É PERMITIDA
const renderAIEnrichedCard = (suggestion, index) => {
    const isReduced = analysis.analysisMode === 'reduced';
    
    if (isReduced) {
        // ✅ CARD PLACEHOLDER
        return `
            <div class="ai-suggestion-card blocked-suggestion">
                <div class="ai-suggestion-header">
                    <span class="ai-suggestion-category">${categoria}</span>
                    <span class="blocked-badge">🔒 Bloqueado</span>
                </div>
                <div class="ai-suggestion-content blocked-content">
                    <div class="upgrade-message">
                        <div class="upgrade-icon">🔒</div>
                        <h4>Sugestões Detalhadas Bloqueadas</h4>
                        <p>Desbloqueie análises inteligentes com IA no plano Pro</p>
                        <a href="/planos.html" class="upgrade-btn">Ver Planos</a>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ✅ CARD COMPLETO (somente modo full)
    return `
        <div class="ai-suggestion-card ai-enriched">
            <div class="ai-block ai-block-problema">
                <div class="ai-block-title">⚠️ Problema</div>
                <div class="ai-block-content">${problema}</div>
            </div>
            <!-- resto do card -->
        </div>
    `;
};
```

---

### 5️⃣ TABELA - BANDAS DE FREQUÊNCIA

#### 🔍 Problema:

**Arquivo:** `audio-analyzer-integration.js` - Função `renderGenreComparisonTable()`

**Linhas ~6180-6250** (aproximado):

```javascript
// Renderizar bandas espectrais
Object.keys(userBands).forEach(bandKey => {
    const bandData = userBands[bandKey];
    const targetBand = targetBands[bandKey];
    
    if (!targetBand) return;
    
    // ❌ SEMPRE RENDERIZA, mesmo se bloqueada
    rows.push(`
        <tr>
            <td>${bandLabel}</td>
            <td>${bandData.rms_db.toFixed(2)} dB</td>  // ❌ VALOR REAL
            <td>${targetBand.target_db.toFixed(1)} dB</td>  // ❌ TARGET REAL
            ...
        </tr>
    `);
});
```

#### ✅ Correção Necessária:

```javascript
// ALLOWLIST PARA BANDAS
const allowedBands = [
    'lowMid', 'band_low_mid',  // Low Mid 250-500 Hz
    'highMid', 'band_high_mid',  // High Mid 2-4 kHz
    'presence', 'band_presence',  // Presença 10-20 kHz
    'air', 'band_air'  // Ar 10-20 kHz (alias)
];

// RENDERIZAÇÃO CONDICIONAL POR BANDA
Object.keys(userBands).forEach(bandKey => {
    const bandData = userBands[bandKey];
    const targetBand = targetBands[bandKey];
    
    if (!targetBand) return;
    
    // ✅ VERIFICAR SE BANDA É PERMITIDA
    const normalizedKey = normalizeGenreBandName(bandKey);
    const isAllowed = !isReduced || allowedBands.some(ab => 
        normalizedKey.toLowerCase().includes(ab.toLowerCase())
    );
    
    if (!isAllowed) {
        // ✅ PLACEHOLDER SEGURO
        rows.push(`
            <tr class="blocked-band">
                <td>${bandLabel}</td>
                <td><span class="blocked-value">•••• 🔒</span></td>
                <td><span class="blocked-value">•••• 🔒</span></td>
                <td><span class="blocked-value">—</span></td>
                <td><span class="upgrade-hint">🔒</span></td>
                <td><a href="/planos.html">Desbloqueie</a></td>
            </tr>
        `);
    } else {
        // ✅ VALOR REAL
        const result = calcSeverity(
            bandData.rms_db, 
            targetBand.target_db, 
            targetBand.tol_db,
            { targetRange: targetBand.range }
        );
        
        rows.push(`
            <tr class="${result.severityClass}">
                <td>${bandLabel}</td>
                <td>${bandData.rms_db.toFixed(2)} dB</td>
                <td>${targetBand.target_db.toFixed(1)} dB</td>
                <td>${result.diff.toFixed(2)}</td>
                <td>${result.severity}</td>
                <td>${result.action}</td>
            </tr>
        `);
    }
});
```

---

## 📊 RESUMO DE CORREÇÕES NECESSÁRIAS

| Arquivo | Função/Linha | Problema | Correção |
|---------|-------------|----------|----------|
| `secure-render-utils.js` | Linhas 20-45 | Allowlists invertidas | Corrigir conforme regras atuais |
| `audio-analyzer-integration.js` | `buildMetricDomMap()` L~9674 | Allowlists desatualizadas | Sincronizar com SecureRenderUtils |
| `audio-analyzer-integration.js` | `renderGenreComparisonTable()` L~5864-6300 | Renderização sem verificação | Adicionar verificação condicional |
| `audio-analyzer-integration.js` | `kpi()` L~12610 | Fallback inseguro | Verificação manual no fallback |
| `audio-analyzer-integration.js` | `row()` L~12667 | Fallback inseguro | Verificação manual no fallback |
| `audio-analyzer-integration.js` | `blurComparisonTableValues()` L~9865 | Allowlist incorreta | Corrigir conforme requisitos |
| `ai-suggestion-ui-controller.js` | `renderAIEnrichedCard()` L~1220 | Texto real no DOM | Card placeholder quando bloqueado |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Corrigir Allowlists
- [ ] Atualizar `REDUCED_MODE_ALLOWLISTS` em `secure-render-utils.js`
- [ ] Atualizar `allowedPrimaryMetrics` em `buildMetricDomMap()`
- [ ] Atualizar `allowedFrequencyMetrics` em `buildMetricDomMap()`
- [ ] Atualizar `allowedTableMetrics` em `blurComparisonTableValues()`

### Fase 2: Tabela de Comparação
- [ ] Adicionar função `isMetricAllowedInTable(metricKey)`
- [ ] Modificar `renderGenreComparisonTable()` para verificação condicional
- [ ] Implementar placeholder para LUFS (linha do LUFS)
- [ ] Implementar placeholder para True Peak (linha do TP)
- [ ] Implementar placeholder para LRA (linha do LRA)
- [ ] Implementar verificação para bandas espectrais

### Fase 3: Funções de Renderização
- [ ] Adicionar verificação de fallback seguro em `kpi()`
- [ ] Adicionar verificação de fallback seguro em `row()`
- [ ] Criar função auxiliar `checkMetricAllowed(metricKey, section)`

### Fase 4: Sugestões IA
- [ ] Modificar `renderAIEnrichedCard()` para renderizar placeholder quando bloqueado
- [ ] Modificar `renderBaseSuggestionCard()` para renderizar placeholder quando bloqueado
- [ ] Atualizar `blurAISuggestionTexts()` para complementar proteção

### Fase 5: Validação
- [ ] Testar com análise em modo reduced
- [ ] Inspecionar DOM: nenhum valor real deve aparecer
- [ ] Testar copiar/colar: apenas placeholders devem ser copiados
- [ ] Verificar console: sem erros JavaScript
- [ ] Testar com modo full: tudo deve funcionar normalmente

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. **PRIMEIRO:** Corrigir allowlists (menor risco, impacto imediato)
2. **SEGUNDO:** Adicionar função auxiliar `checkMetricAllowed()`
3. **TERCEIRO:** Corrigir fallbacks em `kpi()` e `row()`
4. **QUARTO:** Modificar `renderGenreComparisonTable()` (crítico)
5. **QUINTO:** Modificar renderização de sugestões IA
6. **ÚLTIMO:** Testes completos e validação

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Não Quebrar Modo Full
- Todas as verificações devem incluir `if (analysis.analysisMode === 'reduced')`
- Modo full SEMPRE renderiza valores reais

### 2. Compatibilidade com Código Existente
- Manter estrutura HTML similar para não quebrar CSS
- Usar mesmas classes `.genre-row`, `.metric-value`, etc
- Adicionar classes extras `.blocked-metric`, `.blocked-value`

### 3. Performance
- Verificações devem ser rápidas (apenas `includes()` em arrays pequenos)
- Evitar loops desnecessários
- Cachear resultado de `analysis.analysisMode === 'reduced'`

### 4. UX Elegante
- Placeholders devem ser visualmente agradáveis
- Links de upgrade claros e não invasivos
- Mensagens curtas e diretas

---

## 📝 EXEMPLO DE IMPLEMENTAÇÃO COMPLETA

### Função Auxiliar Central:

```javascript
/**
 * Verifica se métrica é permitida no modo reduced
 * @param {string} metricKey - Chave da métrica
 * @param {string} section - Seção (primary, frequency, table)
 * @param {Object} analysis - Objeto de análise
 * @returns {boolean}
 */
function isMetricAllowedInReducedMode(metricKey, section, analysis) {
    // Modo full: sempre permitido
    if (analysis.analysisMode !== 'reduced') {
        return true;
    }
    
    // Allowlists corretas
    const ALLOWLISTS = {
        primary: ['dr', 'dynamicRange', 'scoreFinal'],
        frequency: [
            'lowMid', 'band_low_mid', 'band_lowMid',
            'highMid', 'band_high_mid', 'band_highMid',
            'presence', 'band_presence',
            'air', 'band_air'
        ],
        table: ['dr', 'dynamicRange', 'stereoCorrelation', 'correlation'],
        advanced: []
    };
    
    const allowlist = ALLOWLISTS[section] || [];
    
    // Normalizar chave para comparação
    const normalizedKey = metricKey.toLowerCase();
    
    return allowlist.some(allowed => 
        normalizedKey === allowed.toLowerCase() ||
        normalizedKey.includes(allowed.toLowerCase())
    );
}
```

---

## 🎯 RESULTADO ESPERADO

### ✅ Após Implementação:

1. **Inspecionar Elemento (DevTools):**
   ```html
   <!-- LUFS bloqueado -->
   <td class="metric-value">
       <span class="blocked-value">•••• 🔒</span>
   </td>
   
   <!-- DR permitido -->
   <td class="metric-value">8.5 dB</td>
   ```

2. **Copiar/Colar:**
   - LUFS: `•••• 🔒`
   - DR: `8.5 dB`

3. **Console JavaScript:**
   ```javascript
   document.querySelector('.blocked-value').textContent
   // Retorna: "•••• 🔒"
   ```

4. **UX Visual:**
   - Cards bloqueados com estilo diferenciado
   - Links de upgrade elegantes
   - Sem alertas invasivos

---

## 📊 CONCLUSÃO

### Situação Atual: 🔴 CRÍTICA
- Allowlists invertidas
- Vazamento de dados via DOM
- Tabela renderizando targets errados

### Após Correções: ✅ SEGURO
- Valores bloqueados NUNCA no DOM
- Placeholders seguros e elegantes
- Allowlists corretas
- Zero vazamento de dados

**PRIORIDADE MÁXIMA: Implementar correções antes de deploy em produção**
