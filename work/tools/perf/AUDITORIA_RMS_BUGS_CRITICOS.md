# 🚨 AUDITORIA RMS - BUGS CRÍTICOS IDENTIFICADOS

**Data:** 24 de outubro de 2025  
**Branch:** perf/remove-bpm  
**Status:** 🔴 **2 BUGS CRÍTICOS ENCONTRADOS**

---

## 🎯 RESUMO EXECUTIVO

Após auditoria cirúrgica da pipeline RMS, identifiquei **2 bugs críticos** que causam `technicalData.avgLoudness = null`:

### 🔴 BUG #1: FUNÇÃO `calculateArrayAverage` NÃO EXISTE
**Criticidade:** 🔥 **CRÍTICO** - Causa erro fatal  
**Arquivo:** `work/api/audio/core-metrics.js`  
**Linha:** 1271-1272  
**Impacto:** `TypeError: this.calculateArrayAverage is not a function`

### 🔴 BUG #2: VALOR ARTIFICIAL `1e-8` EM BLOCOS DE SILÊNCIO
**Criticidade:** ⚠️ **ALTO** - Distorce valores RMS  
**Arquivo:** `work/api/audio/temporal-segmentation.js`  
**Linha:** 186  
**Impacto:** RMS convertido para `-160 dB`, mascarando áudio real

---

## 🔍 ANÁLISE DETALHADA

### 🔴 BUG #1: FUNÇÃO AUSENTE `calculateArrayAverage`

#### Local do Erro
**Arquivo:** `work/api/audio/core-metrics.js`  
**Linhas:** 1271-1272

**Código Problemático:**
```javascript
// RMS médio por canal (já são valores RMS por frame)
const leftRMS = this.calculateArrayAverage(validLeftFrames);   // ❌ ERRO
const rightRMS = this.calculateArrayAverage(validRightFrames); // ❌ ERRO
```

**Erro Gerado:**
```
TypeError: this.calculateArrayAverage is not a function
  at CoreMetricsProcessor.processRMSMetrics (core-metrics.js:1271:30)
```

#### Causa Raiz
A função `calculateArrayAverage` foi **removida acidentalmente** durante a refatoração de BPM. Ela era usada em múltiplos lugares, incluindo no cálculo de RMS.

#### Evidência
Busca no código mostra que a função é **chamada mas nunca definida**:
```bash
grep -r "calculateArrayAverage" work/api/audio/core-metrics.js
# Resultado:
# linha 1271: const leftRMS = this.calculateArrayAverage(validLeftFrames);
# linha 1272: const rightRMS = this.calculateArrayAverage(validRightFrames);
# 
# Definição: NÃO ENCONTRADA
```

#### Impacto
- **100% dos áudios** falham ao processar RMS
- `processRMSMetrics()` lança exceção
- `catch` retorna `{ average: null, ... }`
- Frontend recebe `technicalData.avgLoudness = null`
- Modal exibe `— dBFS`

---

### 🔴 BUG #2: SILÊNCIO ARTIFICIAL `1e-8`

#### Local do Problema
**Arquivo:** `work/api/audio/temporal-segmentation.js`  
**Linhas:** 182-186

**Código Problemático:**
```javascript
// Validar RMS finito e não-zero
if (isFinite(rmsValue) && rmsValue > 0) {
  rmsValues.push(rmsValue);
} else {
  // Para blocos de silêncio, adicionar valor muito pequeno mas válido
  rmsValues.push(1e-8);  // ⚠️ PROBLEMA
}
```

#### Análise do Fluxo

**Cenário 1: Áudio com partes silenciosas**
1. Bloco tem silêncio real (sumSquares = 0)
2. `rmsValue = Math.sqrt(0 / 14400) = 0`
3. Condição `rmsValue > 0` → **false**
4. Cai no `else` → `rmsValues.push(1e-8)`

**Cenário 2: Áudio com valores extremamente baixos**
1. Bloco tem áudio muito comprimido (após normalização)
2. `rmsValue = 0.0000001` (menor que threshold)
3. Condição `rmsValue > 0` → **true** (passa)
4. MAS na conversão dB: `20 * log10(0.0000001) = -140 dB`

**Cenário 3: Todos os blocos viram `1e-8`**
1. Áudio normalizado agressivamente
2. Múltiplos blocos ficam próximos de zero
3. Array `rmsValues = [1e-8, 1e-8, 1e-8, ...]`
4. Média = `1e-8`
5. Conversão dB: `20 * log10(1e-8) = -160 dB`

#### Propagação do Erro

```
temporal-segmentation.js (linha 186)
  rmsValues.push(1e-8)
          ↓
core-metrics.js (linha 1251)
  validLeftFrames = [1e-8, 1e-8, ...].filter(val => val > 0)
  → 1e-8 > 0 é true, PASSA NO FILTRO
          ↓
core-metrics.js (linha 1271)
  leftRMS = calculateArrayAverage([1e-8, 1e-8, ...])  ← ERRO: função não existe
          ↓
Exceção lançada → catch block
          ↓
Return { average: null }
          ↓
Frontend recebe null → exibe "—"
```

---

## 🛠️ CORREÇÕES OBRIGATÓRIAS

### ✅ CORREÇÃO #1: IMPLEMENTAR `calculateArrayAverage`

**Arquivo:** `work/api/audio/core-metrics.js`  
**Inserir após linha:** 1218 (após `calculateStereoWidth`)

**Código a adicionar:**
```javascript
/**
 * 📊 Calcular média aritmética de um array
 * @param {number[]} arr - Array de números
 * @returns {number} - Média aritmética
 */
calculateArrayAverage(arr) {
  if (!arr || arr.length === 0) {
    return 0;
  }
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}
```

**Justificativa:**
- Função trivial mas crítica
- Deve retornar `0` para arrays vazios (segurança)
- Usa `reduce` para soma eficiente

---

### ✅ CORREÇÃO #2: REMOVER SILÊNCIO ARTIFICIAL `1e-8`

**Arquivo:** `work/api/audio/temporal-segmentation.js`  
**Linha:** 182-186

**ANTES:**
```javascript
// Validar RMS finito e não-zero
if (isFinite(rmsValue) && rmsValue > 0) {
  rmsValues.push(rmsValue);
} else {
  // Para blocos de silêncio, adicionar valor muito pequeno mas válido
  rmsValues.push(1e-8);  // ⚠️ PROBLEMA
}
```

**DEPOIS:**
```javascript
// ✅ CORREÇÃO: Aceitar valores RMS reais, incluindo zero (silêncio)
// NÃO inventar valores artificiais (1e-8)
if (isFinite(rmsValue)) {
  rmsValues.push(rmsValue);  // Aceita 0, 0.001, 0.05, etc
} else {
  // Apenas para NaN/Infinity (erro de cálculo), usar zero
  rmsValues.push(0);
}
```

**Justificativa:**
- Silêncio real deve ser `0`, não `1e-8`
- `1e-8` converte para `-160 dB` (irreal)
- Filtro posterior em `core-metrics.js` já remove zeros (`val > 0`)
- Se TODO o áudio for silêncio, filtro retorna array vazio → `average: null` (correto)

---

### ✅ CORREÇÃO #3: PROTEGER CONTRA ARRAYS VAZIOS (OPCIONAL)

**Arquivo:** `work/api/audio/core-metrics.js`  
**Linha:** 1253-1267 (bloco de verificação)

**ADICIONAR LOG DETALHADO:**
```javascript
if (validLeftFrames.length === 0 || validRightFrames.length === 0) {
  // ✅ LOG DETALHADO: Por que frames foram filtrados?
  console.warn(`[RMS] Todos os frames filtrados! leftTotal=${leftFrames.length}, rightTotal=${rightFrames.length}, validLeft=${validLeftFrames.length}, validRight=${validRightFrames.length}`);
  console.warn(`[RMS] Primeiros 5 valores L:`, leftFrames.slice(0, 5));
  console.warn(`[RMS] Primeiros 5 valores R:`, rightFrames.slice(0, 5));
  
  logAudio('core_metrics', 'rms_no_valid_frames', { 
    leftValid: validLeftFrames.length, 
    rightValid: validRightFrames.length,
    leftTotal: leftFrames.length,
    rightTotal: rightFrames.length 
  });
  return {
    left: null,
    right: null,
    average: null,
    peak: null,
    count: framesRMS.count
  };
}
```

**Justificativa:**
- Ajuda a debugar casos onde 100% dos frames são filtrados
- Mostra os valores reais (para ver se são `1e-8`, `0`, `NaN`, etc)

---

## 📝 PATCH COMPLETO (PRONTO PARA APLICAR)

### PATCH #1: Adicionar `calculateArrayAverage`

**Arquivo:** `work/api/audio/core-metrics.js`  
**Localização:** Após linha 1218 (após `calculateStereoWidth`)

```javascript
  calculateStereoWidth(leftChannel, rightChannel) {
    const length = Math.min(leftChannel.length, rightChannel.length);
    let sideMagnitude = 0;
    let midMagnitude = 0;
    
    for (let i = 0; i < length; i++) {
      const mid = (leftChannel[i] + rightChannel[i]) / 2;
      const side = (leftChannel[i] - rightChannel[i]) / 2;
      midMagnitude += mid ** 2;
      sideMagnitude += side ** 2;
    }
    
    return midMagnitude > 0 ? Math.sqrt(sideMagnitude / midMagnitude) : 0;
  }

  // ✅ PATCH #1: Adicionar função ausente calculateArrayAverage
  /**
   * 📊 Calcular média aritmética de um array
   * Função removida acidentalmente durante refatoração de BPM
   * @param {number[]} arr - Array de números
   * @returns {number} - Média aritmética
   */
  calculateArrayAverage(arr) {
    if (!arr || arr.length === 0) {
      return 0;
    }
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
  }

  /**
   * 📊 Processar métricas RMS dos frames para métricas agregadas
   */
  processRMSMetrics(framesRMS) {
    // ... código continua
```

---

### PATCH #2: Remover Silêncio Artificial

**Arquivo:** `work/api/audio/temporal-segmentation.js`  
**Linha:** 182-186

```javascript
    const rmsValue = Math.sqrt(sumSquares / block.length);
    
    // ✅ DEBUG RMS: Log valores calculados
    if (blockIndex === 0) {
      console.log(`[DEBUG RMS CALC] Canal ${channelName}, Bloco 0: rmsValue=${rmsValue}, isFinite=${isFinite(rmsValue)}, block.length=${block.length}`);
    }
    
    // ✅ PATCH #2: Aceitar valores RMS reais (incluindo zero)
    // REMOVIDO: lógica de 1e-8 para silêncio
    if (isFinite(rmsValue)) {
      rmsValues.push(rmsValue);  // Aceita 0, 0.001, 0.05, etc
    } else {
      // Apenas para NaN/Infinity (erro de cálculo), usar zero
      rmsValues.push(0);
    }
  }
  
  if (frames.length === 0) {
    throw makeErr('segmentation', `Nenhum frame RMS gerado para canal ${channelName}`, 'no_rms_frames');
  }
```

---

## 🧪 TESTE DE VALIDAÇÃO

Após aplicar os patches, o fluxo esperado é:

### ✅ Cenário 1: Áudio Normal (não-silencioso)
```
Bloco 0: rmsValue = 0.045
Bloco 1: rmsValue = 0.052
Bloco 2: rmsValue = 0.038
...
→ rmsValues = [0.045, 0.052, 0.038, ...]
→ validLeftFrames (após filtro val > 0) = [0.045, 0.052, 0.038, ...]
→ leftRMS = calculateArrayAverage([0.045, 0.052, 0.038, ...]) = 0.045
→ averageRMSDb = 20 * log10(0.045) = -26.9 dB
→ technicalData.avgLoudness = -26.9 dB
→ Frontend exibe: "Volume Médio (RMS): -26.90 dBFS" ✅
```

### ✅ Cenário 2: Áudio com Silêncio Parcial
```
Bloco 0: rmsValue = 0.045
Bloco 1: rmsValue = 0 (silêncio)
Bloco 2: rmsValue = 0.038
...
→ rmsValues = [0.045, 0, 0.038, ...]
→ validLeftFrames (após filtro val > 0) = [0.045, 0.038, ...]  ← zeros removidos
→ leftRMS = calculateArrayAverage([0.045, 0.038, ...]) = 0.0415
→ averageRMSDb = 20 * log10(0.0415) = -27.6 dB
→ technicalData.avgLoudness = -27.6 dB
→ Frontend exibe: "Volume Médio (RMS): -27.60 dBFS" ✅
```

### ✅ Cenário 3: Áudio 100% Silêncio
```
Todos blocos: rmsValue = 0
→ rmsValues = [0, 0, 0, ...]
→ validLeftFrames (após filtro val > 0) = []  ← todos removidos
→ validLeftFrames.length === 0 → return { average: null }
→ technicalData.avgLoudness = null
→ Frontend exibe: "Volume Médio (RMS): — dBFS" ✅ (correto para silêncio)
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

| Aspecto | ANTES (Bugado) | DEPOIS (Corrigido) |
|---------|----------------|-------------------|
| **Função calculateArrayAverage** | ❌ Não existe → TypeError | ✅ Implementada corretamente |
| **Silêncio (rmsValue = 0)** | ❌ Vira 1e-8 → -160 dB | ✅ Fica 0 → filtrado |
| **Áudio real (rmsValue = 0.05)** | ❌ Mascarado por 1e-8 | ✅ Exibido corretamente (-26 dB) |
| **Conversão dB** | ❌ 20*log10(1e-8) = -160 dB | ✅ 20*log10(0.05) = -26 dB |
| **Frontend avgLoudness** | ❌ null (erro) ou -160 dB | ✅ -26.9 dB (real) |
| **Modal exibe** | ❌ "— dBFS" (sempre) | ✅ "-26.90 dBFS" (correto) |

---

## 🎯 CONCLUSÃO

### 🔴 Bug Principal: `calculateArrayAverage` Ausente
- **Causa:** Remoção acidental durante refatoração de BPM
- **Impacto:** 100% dos áudios falham no cálculo de RMS
- **Correção:** Adicionar função (5 linhas de código)

### 🔴 Bug Secundário: Silêncio Artificial `1e-8`
- **Causa:** Lógica incorreta de tratamento de silêncio
- **Impacto:** Valores RMS distorcidos para `-160 dB`
- **Correção:** Aceitar `0` como silêncio real (remover `1e-8`)

### ✅ Resultado Esperado Após Correção
- `technicalData.avgLoudness` volta a exibir valores corretos
- Modal mostra RMS real (ex: `-26.90 dBFS`)
- Silêncio verdadeiro exibe `—` (comportamento correto)
- Áudio não-silencioso exibe valor numérico válido

---

**PRIORIDADE:** 🔥 **CRÍTICA** - Aplicar patches IMEDIATAMENTE para restaurar funcionalidade RMS.
