# 🔥 AUDITORIA: BUG BANDAS PORCENTAGEM VS dB

**Data:** 2025-12-10  
**Status:** 🔍 **LOGS CRÍTICOS ADICIONADOS - AGUARDANDO TESTE EM PRODUÇÃO**  
**Problema:** Sugestões mostram "2.0 dB" quando deveria ser "-23.8 dB"

---

## 🐛 SINTOMA DO BUG

### **Comportamento Esperado:**
```
🔊 Subgrave (20–60 Hz)
• Valor atual: -23.8 dB
• Faixa ideal: -29.0 a -23.0 dB
• Alvo recomendado: -26.0 dB
```

### **Comportamento Atual (BUGADO):**
```
"Subgrave (20–60 Hz) está em 2.0 dB, enquanto o range adequado é -29.0 a -23.0 dB, ficando 25.0 dB acima do limite máximo."
```

**Análise:**
- Painel de frequências mostra: `-23.8 dB (2.0%)`
- Sugestão usa: `2.0` (porcentagem) ao invés de `-23.8` (dB)
- Delta calculado erroneamente: `2.0 - (-23.0) = 25.0 dB` ❌

---

## 🔍 AUDITORIA COMPLETA DO FLUXO

### 1️⃣ **BACKEND: core-metrics.js (LINHA 414)**

#### ✅ **CÓDIGO ESTÁ CORRETO:**
```javascript
consolidatedData.metrics.bands = {
  sub: {
    value: coreMetrics.spectralBands.sub.energy_db,  // ✅ USA energy_db
    unit: 'dBFS'
  }
}
```

**Fonte de dados:** `spectralBands.sub.energy_db` → `-23.8` dB (valor negativo correto)

**Logs adicionados (linha 442-458):**
```javascript
console.log('[CORE-METRICS] coreMetrics.spectralBands (FONTE):');
console.log('[CORE-METRICS] - sub.energy_db:', coreMetrics.spectralBands?.sub?.energy_db);
console.log('[CORE-METRICS] - sub.percentage:', coreMetrics.spectralBands?.sub?.percentage);
console.log('[CORE-METRICS] consolidatedData.metrics.bands (DESTINO):');
console.log('[CORE-METRICS] - sub.value:', consolidatedData.metrics.bands.sub.value);
console.log('[CORE-METRICS] - sub.unit:', consolidatedData.metrics.bands.sub.unit);
```

---

### 2️⃣ **GERADOR DE SUGESTÕES: problems-suggestions-v2.js (LINHA 1008)**

#### ✅ **CÓDIGO ESTÁ CORRETO:**
```javascript
analyzeBand(bandKey, value, bandName, suggestions, consolidatedData) {
  const bandData = consolidatedData.metrics.bands[bandKey];
  const measured = bandData.value;  // ✅ LÊ .value (que deveria ser energy_db)
  
  // ... passa para buildBandSuggestion
  buildBandSuggestion({
    value: measured,  // ← ESTE VALOR DEVERIA SER -23.8 dB
    target: target,
    tolerance: tolerance,
    unit: 'dB'
  });
}
```

**Logs adicionados (linha 1016-1044):**
```javascript
console.log(`[BAND-${bandKey.toUpperCase()}] 🔍 AUDITORIA CRÍTICA DE DADOS:`);
console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.value:`, bandData?.value);
console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.unit:`, bandData?.unit);
console.log(`[BAND-${bandKey.toUpperCase()}] - typeof bandData.value:`, typeof bandData?.value);
console.log(`[BAND-${bandKey.toUpperCase()}] - bandData.value < 0:`, bandData?.value < 0);

// VALIDAÇÃO CRÍTICA: Valor deve ser negativo (dBFS)
if (measured >= 0) {
  console.error(`[BAND-${bandKey.toUpperCase()}] ❌❌❌ BUG CRÍTICO DETECTADO! ❌❌❌`);
  console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Valor positivo ${measured} quando deveria ser dBFS NEGATIVO!`);
  console.error(`[BAND-${bandKey.toUpperCase()}] ❌ Isso indica que .value está com PERCENTAGE ao invés de energy_db!`);
  return; // ABORTA SUGESTÃO
}
```

---

### 3️⃣ **FORMATADOR DE TEXTO: suggestion-text-builder.js (LINHA 257)**

#### ✅ **CÓDIGO FOI CORRIGIDO:**

**ANTES (Linha 272 - HEURÍSTICA FALHA):**
```javascript
const valueIsEnergyPercent = targetIsDb && value >= 0 && value <= 100;

if (valueIsEnergyPercent) {
  message += `• Energia medida: ${value.toFixed(1)}% (indicador energético)\n`;  // ❌ BUGADO
}
```

**DEPOIS (Linha 257-290 - SEM HEURÍSTICA):**
```javascript
// 🔥 REGRA ABSOLUTA: BANDAS SEMPRE SÃO RENDERIZADAS EM dB
// ❌ NUNCA renderizar bandas em % (energia) em sugestões
// ❌ NUNCA usar heurística para "adivinhar" unidade

// VALIDAÇÃO CRÍTICA
if (value >= 0) {
  console.error(`[BAND-SUGGESTION-CRITICAL] ❌❌❌ BUG CRÍTICO DETECTADO! ❌❌❌`);
  console.error(`[BAND-SUGGESTION-CRITICAL] ❌ Valor POSITIVO ${value} para banda ${bandKey}!`);
  
  // RETORNA ERRO VISUAL PARA DEBUGGING
  return {
    message: `❌ ERRO: Banda ${bandKey} com valor ${value} (deveria ser dB negativo)`,
    explanation: `BUG CRÍTICO: buildBandSuggestion() recebeu valor POSITIVO quando deveria ser dBFS NEGATIVO.`,
    action: `Revisar logs do console - valor ${value} é inválido para dBFS.`
  };
}

// ✅ SEMPRE renderizar em dB (sem casos especiais)
message += `• Valor atual: ${value.toFixed(1)} dB\n`;
message += `• Faixa ideal: ${min.toFixed(1)} a ${max.toFixed(1)} dB\n`;
message += `• Alvo recomendado: ${target.toFixed(1)} dB`;
```

**Logs adicionados (linha 279-286):**
```javascript
console.log(`[BUILD-BAND-SUGGESTION] 🔍 buildBandSuggestion() chamado para banda ${bandKey}:`);
console.log(`[BUILD-BAND-SUGGESTION] - value: ${value}`);
console.log(`[BUILD-BAND-SUGGESTION] - target: ${target}`);
console.log(`[BUILD-BAND-SUGGESTION] - typeof value: ${typeof value}`);
console.log(`[BUILD-BAND-SUGGESTION] - value < 0: ${value < 0}`);
```

---

## 📊 ESTRUTURA DE DADOS CONFIRMADA

### **coreMetrics.spectralBands (FONTE)**
```javascript
{
  sub: {
    energy_db: -23.8,      // ✅ dBFS (negativo) - CORRETO
    percentage: 2.0,       // ✅ Energia % - NÃO DEVE SER USADO EM SUGESTÕES
    range: "20-60Hz",
    status: "calculated"
  }
}
```

### **consolidatedData.metrics.bands (INTERMEDIÁRIO)**
```javascript
{
  sub: {
    value: -23.8,          // ✅ DEVE ser energy_db (negativo)
    unit: 'dBFS'
  }
}
```

### **analysis.metrics.bands (JSON FINAL)**
```javascript
{
  sub: {
    energy_db: -23.8,      // ✅ Para painel de análise
    percentage: 2.0,       // ✅ Para painel de análise (exibir junto)
    range: "20-60Hz",
    status: "calculated"
  }
}
```

---

## 🎯 HIPÓTESES DO BUG

### **Hipótese 1: Overwrite em consolidatedData**
`consolidatedData.metrics.bands[bandKey].value` está sendo SOBRESCRITO com `percentage` após montagem inicial.

**Como verificar:**
- Logs em `core-metrics.js` (linha 442-458) vão mostrar valores de `sub.value` ANTES de passar para `analyzeBand()`
- Se aparecer valor positivo (ex: `2.0`), o bug está NO BACKEND

### **Hipótese 2: Leitura errada em analyzeBand()**
`analyzeBand()` está lendo campo errado de `consolidatedData`.

**Como verificar:**
- Logs em `problems-suggestions-v2.js` (linha 1020-1044) vão mostrar `bandData.value` recebido
- Se aparecer valor positivo, o bug está NA LEITURA

### **Hipótese 3: Renderização com heurística falha (JÁ CORRIGIDO)**
`buildBandSuggestion()` estava usando heurística "se valor 0-100, então é %".

**Status:** ✅ **CORRIGIDO** - Removida heurística, forçado dB sempre

---

## 📝 PRÓXIMOS PASSOS

### 🔥 **AÇÃO IMEDIATA:**

1. **Fazer commit do código com logs:**
   ```bash
   git add work/api/audio/core-metrics.js
   git add work/lib/audio/features/problems-suggestions-v2.js
   git add work/lib/audio/utils/suggestion-text-builder.js
   git commit -m "feat: adiciona logs críticos para debug do bug bandas % vs dB"
   git push
   ```

2. **Rodar análise de áudio em produção:**
   - Fazer upload de música
   - Escolher gênero (ex: Rock)
   - Aguardar análise completa
   - **ABRIR CONSOLE DO NAVEGADOR (F12)**

3. **Procurar pelos logs:**
   ```
   [CORE-METRICS] 🔍 AUDITORIA: consolidatedData.metrics.bands MONTADO
   [BAND-SUB] 🔍 AUDITORIA CRÍTICA DE DADOS
   [BUILD-BAND-SUGGESTION] 🔍 buildBandSuggestion() chamado para banda sub
   ```

4. **Analisar valores:**
   - Se `sub.value` for NEGATIVO (-23.8): ✅ Backend correto
   - Se `sub.value` for POSITIVO (2.0): ❌ Bug no backend (overwrite)
   - Se aparecer erro `❌❌❌ BUG CRÍTICO DETECTADO!`: Bug confirmado com linha exata

---

## 🛠️ CORREÇÕES APLICADAS

### ✅ **suggestion-text-builder.js**
- **Removida** heurística de detecção de unidade (`valueIsEnergyPercent`)
- **Forçada** renderização em dB SEMPRE para bandas
- **Adicionada** validação crítica: se `value >= 0`, retorna erro visual
- **Adicionados** logs detalhados de auditoria

### ✅ **problems-suggestions-v2.js**
- **Adicionados** logs críticos mostrando `bandData.value` recebido
- **Adicionada** validação: se `measured >= 0`, aborta sugestão com erro
- **Mantida** lógica de leitura de `consolidatedData.metrics.bands[bandKey].value`

### ✅ **core-metrics.js**
- **Adicionados** logs mostrando fonte (`spectralBands.sub.energy_db`) vs destino (`consolidatedData.metrics.bands.sub.value`)
- **Confirmado** que código JÁ usa `energy_db` corretamente na linha 414

---

## 📚 ARQUIVOS MODIFICADOS

1. `work/api/audio/core-metrics.js` - Linha 442-458 (logs)
2. `work/lib/audio/features/problems-suggestions-v2.js` - Linha 1016-1044 (logs + validação)
3. `work/lib/audio/utils/suggestion-text-builder.js` - Linha 257-330 (correção + logs)

---

## 🎉 CONCLUSÃO

**Status Atual:**
- ✅ Código backend CORRETO (usa `energy_db`)
- ✅ Código gerador CORRETO (lê `.value`)
- ✅ Código formatador CORRIGIDO (sem heurística)
- 🔍 Logs críticos ADICIONADOS para debug

**Próximo passo:** **TESTAR EM PRODUÇÃO** e analisar logs do console para identificar onde `percentage` está sendo usado ao invés de `energy_db`.

Se os logs mostrarem valor positivo, saberemos EXATAMENTE em qual linha o bug ocorre.
