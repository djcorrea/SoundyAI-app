# 🔍 GUIA DE TESTE: Auditoria Dinâmica Enhanced Engine

## 📋 PRÉ-REQUISITOS

1. Servidor rodando: `python -m http.server 3000`
2. Console do navegador aberto (F12 → Console)
3. Arquivo de áudio pronto para upload
4. Gênero selecionado: **Trance** ou **Tech House**

---

## 🚀 PASSO A PASSO

### 1. Iniciar Servidor

```powershell
# No terminal
cd "C:\Users\DJ Correa\Desktop\Programação\SoundyAI"
python -m http.server 3000
```

### 2. Abrir Aplicação

1. Navegador → `http://localhost:3000`
2. F12 → Aba **Console**
3. Limpar console (ícone 🚫 ou Ctrl+L)

### 3. Preparar Filtros de Console

**No console, digite:**
```javascript
// Ativar apenas logs relevantes
console.defaultLog = console.log.bind(console);
console.log = function(){
    if (arguments[0] && typeof arguments[0] === 'string') {
        if (arguments[0].includes('[ENGINE-DEBUG]') || 
            arguments[0].includes('[ENGINE-ERROR]') ||
            arguments[0].includes('[ENGINE-WARNING]') ||
            arguments[0].includes('[ENGINE-SUCCESS]')) {
            console.defaultLog.apply(console, arguments);
        }
    } else {
        console.defaultLog.apply(console, arguments);
    }
};
```

### 4. Executar Análise

1. **Upload de áudio**
2. **Selecionar gênero**: Trance
3. **Aguardar análise completa**
4. **Observar console**

---

## 📊 LOGS ESPERADOS

### ✅ LOG 1: normalizeBands() - Recebimento do JSON

```
🔍 [ENGINE-DEBUG] ===== INÍCIO normalizeBands() =====
[ENGINE-DEBUG] source recebido: {
  "original_metrics": {...},
  "spectral_bands": {
    "sub": {...},
    "low_bass": {...},
    "upper_bass": {...},
    ...
  }
}

[ENGINE-DEBUG] ===== PROCESSANDO BANDA: low_bass =====
[ENGINE-DEBUG] Banda recebida do JSON: "low_bass"
[ENGINE-DEBUG] bandData recebido: {
  "target_range": { "min": -29, "max": -25 },
  "target_db": -28,
  "tol_db": 0
}
[ENGINE-DEBUG] Banda usada pelo Engine: "bass"
⚠️ [ENGINE-WARNING] Nome divergente: JSON="low_bass" Engine="bass"
[ENGINE-DEBUG] target_range.min recebido: -29
[ENGINE-DEBUG] target_range.max recebido: -25
[ENGINE-DEBUG] target_db recebido: -28
[ENGINE-DEBUG] tol_db recebido: 0
```

**✅ VALIDAR**:
- `target_range.min` = `-29` (valor do trance.json)
- `target_range.max` = `-25` (valor do trance.json)
- Nome convertido: `"low_bass"` → `"bass"`

---

### ✅ LOG 2: extractMetrics() - Injeção de target_range

```
[ENGINE-DEBUG] ===== extractMetrics: BANDA low_bass =====
[ENGINE-DEBUG] Banda original: "low_bass"
[ENGINE-DEBUG] Banda normalizada: "bass"
⚠️ [ENGINE-WARNING] extractMetrics: Nome divergente: JSON="low_bass" Engine="bass"
[ENGINE-DEBUG] refBandData encontrado: {
  "target_range": { "min": -29, "max": -25 },
  "target_db": -28,
  "tol_db": 0
}
[ENGINE-DEBUG] 🎯 PATCH 2: Injetando target_range
[ENGINE-DEBUG] target_range.min injetado: -29
[ENGINE-DEBUG] target_range.max injetado: -25
[ENGINE-DEBUG] ✅ target_range injetado com sucesso em data
```

**✅ VALIDAR**:
- `target_range.min injetado` = `-29`
- `target_range.max injetado` = `-25`
- Sem erros de injeção

---

### ✅ LOG 3: generateReferenceSuggestions() - Uso de target_range

```
🔍 [ENGINE-DEBUG] ===== INÍCIO generateReferenceSuggestions (BANDAS) =====
[ENGINE-DEBUG] referenceData.bands: {
  "sub": {...},
  "bass": {...},    ← ATENÇÃO: banda já convertida
  "lowMid": {...},
  ...
}

[ENGINE-DEBUG] ===== PROCESSANDO SUGESTÃO PARA BANDA: bass =====
[ENGINE-DEBUG] refData: {
  "target_range": { "min": -29, "max": -25 },
  "target_db": -28,
  "tol_db": 0
}
[ENGINE-DEBUG] Verificando tipo de target...
[ENGINE-DEBUG] ✅ USANDO target_range (PRIORIDADE 1)
[ENGINE-DEBUG] Valor usado pelo Engine como targetRange.min: -29
[ENGINE-DEBUG] Valor usado pelo Engine como targetRange.max: -25
[ENGINE-DEBUG] Origem: referenceData.bands[bass].target_range
🎯 [RANGE-LOGIC] Banda bass: range [-29, -25], tolerância: 1.0 dB
```

**✅ VALIDAR**:
- Banda = `"bass"` (já convertida)
- `targetRange.min` usado = `-29`
- `targetRange.max` usado = `-25`

---

### ✅ LOG 4: Geração de mensagem final

```
[ENGINE-DEBUG] 🎯 GERANDO MENSAGEM FINAL:
[ENGINE-DEBUG] targetRange.min usado na mensagem: -29
[ENGINE-DEBUG] targetRange.max usado na mensagem: -25
[ENGINE-DEBUG] rangeText gerado: "-29 a -25 dB"
[ENGINE-DEBUG] suggestion.diagnosis: "Atual: -27.5 dB | Intervalo ideal: -29 a -25 dB"
[ENGINE-DEBUG] suggestion.why: "Banda bass está fora do intervalo ideal (-29 a -25 dB) para o gênero"
```

**✅ VALIDAR**:
- `rangeText` = `"-29 a -25 dB"` (valores do JSON)
- Mensagem contém valores corretos

---

### ✅ LOG 5: Validação crítica (suggestion.technical)

```
[ENGINE-DEBUG] ✅ suggestion.technical gerado:
[ENGINE-DEBUG]   - targetMin: -29
[ENGINE-DEBUG]   - targetMax: -25
[ENGINE-DEBUG]   - idealRange: "-29 a -25 dB"

🔍 VALIDAÇÃO CRÍTICA: Comparar com JSON original
✅ [ENGINE-SUCCESS] Valores corretos: JSON e Engine coincidem
```

**✅ OU ❌ ESPERADO**:
```
❌ [ENGINE-ERROR] Divergência detectada!
[ENGINE-ERROR] JSON.min = -29 | Engine.min = -20
[ENGINE-ERROR] JSON.max = -25 | Engine.max = -15
```

---

## 🎯 CHECKLIST DE VALIDAÇÃO

### ✅ Conformidade Total (esperado)

- [ ] Todos os logs `[ENGINE-DEBUG]` aparecem
- [ ] `target_range.min` recebido = valor do `trance.json`
- [ ] `target_range.max` recebido = valor do `trance.json`
- [ ] `targetRange.min` usado na sugestão = valor do JSON
- [ ] `targetRange.max` usado na sugestão = valor do JSON
- [ ] `rangeText` na mensagem = `"<min> a <max> dB"` do JSON
- [ ] Log final: `✅ [ENGINE-SUCCESS] Valores corretos: JSON e Engine coincidem`
- [ ] **ZERO logs de erro `[ENGINE-ERROR]`**

### ⚠️ Divergências (indicam problema)

- [ ] `[ENGINE-WARNING]` indica conversão de nomes (`"low_bass"` → `"bass"`)
  - **Impacto**: Visual apenas (cards ≠ tabela)
  - **Valores**: Devem estar corretos

- [ ] `[ENGINE-ERROR] Divergência detectada!`
  - **Problema CRÍTICO**: Engine usando valores diferentes do JSON
  - **Ação**: Reportar imediatamente

### ❌ Erros Críticos (não devem aparecer)

- [ ] `[ENGINE-ERROR] ❌ NEM target_range NEM target_db encontrados!`
- [ ] `[ENGINE-WARNING] refBandData.target_range NÃO encontrado!`
- [ ] `JSON.min ≠ Engine.min`
- [ ] `JSON.max ≠ Engine.max`

---

## 📸 CAPTURA DE EVIDÊNCIAS

### 1. Salvar Console

1. Botão direito no console
2. **"Save as..."**
3. Salvar como: `auditoria-console-output-YYYY-MM-DD.log`

### 2. Copiar Logs Relevantes

**No console, executar:**
```javascript
// Copiar todos os logs ENGINE-DEBUG
copy($$('*').filter(el => el.textContent.includes('[ENGINE-DEBUG]')).map(el => el.textContent).join('\n'))
```

---

## 🔬 ANÁLISE PÓS-TESTE

### Extrair informações críticas:

```javascript
// No console
const auditResults = {
    bandasProcessadas: [],
    divergenciasNome: [],
    divergenciasValor: [],
    sucessos: []
};

// Processar logs e popular auditResults
// (código de análise será gerado após teste)
```

---

## 📊 RELATÓRIO FINAL ESPERADO

```
╔════════════════════════════════════════════════════════════╗
║  AUDITORIA DINÂMICA: Enhanced Suggestion Engine           ║
║  Data: 2025-12-07                                          ║
║  Gênero testado: Trance                                    ║
╚════════════════════════════════════════════════════════════╝

✅ CONFORMIDADE TOTAL

┌────────────────────────────────────────────────────────────┐
│ Banda: low_bass (JSON) → bass (Engine)                    │
├────────────────────────────────────────────────────────────┤
│ JSON.target_range.min:    -29 dB                          │
│ Engine.targetRange.min:   -29 dB  ✅ CORRETO              │
│ JSON.target_range.max:    -25 dB                          │
│ Engine.targetRange.max:   -25 dB  ✅ CORRETO              │
│ Mensagem exibida:         "-29 a -25 dB"  ✅ CORRETO      │
└────────────────────────────────────────────────────────────┘

⚠️ DIVERGÊNCIAS NÃO-CRÍTICAS

• Nome de banda convertido: "low_bass" → "bass"
  - Impacto: Apenas visual (cards ≠ tabela)
  - Valores: Corretos

❌ ERROS CRÍTICOS

• Nenhum erro detectado  ✅

╔════════════════════════════════════════════════════════════╗
║  CONCLUSÃO: Enhanced Engine está 100% conforme            ║
║  Usa APENAS valores de analysis.data.genreTargets         ║
║  ZERO hardcoded values                                     ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🚀 PRÓXIMOS PASSOS

Após teste:
1. Salvar console output
2. Analisar logs
3. Gerar relatório automatizado
4. Se divergências encontradas → aplicar correções
5. Se conformidade total → documentar sucesso

---

**Executado por**: GitHub Copilot  
**Timestamp**: 2025-12-07
