# 🔍 AUDITORIA RMS - DIAGNÓSTICO COM LOGS

**Data:** 24 de outubro de 2025  
**Branch:** perf/remove-bpm  
**Objetivo:** Identificar exatamente onde RMS está falhando na propagação

---

## 📋 RESUMO DA INVESTIGAÇÃO

### ✅ CÓDIGO AUDITADO

Realizei auditoria completa de **PONTA A PONTA** no fluxo de RMS:

1. **Cálculo Inicial** (`temporal-segmentation.js`)
   - Função: `segmentChannelForRMS()` (linha 150)
   - Status: ✅ **FUNÇÃO EXISTE E ESTÁ ATIVA**
   - Retorna: `{ frames, rmsValues }`
   - Validação: Calcula RMS por bloco de 300ms com hop de 100ms

2. **Processamento Core** (`core-metrics.js`)
   - Função: `processRMSMetrics()` (linha 1221)
   - Status: ✅ **FUNÇÃO EXISTE E ESTÁ ATIVA**
   - Entrada: `segmentedAudio.framesRMS`
   - Retorna: `{ left, right, average, peak, count }`
   - Conversão: Converte valores RMS para dB

3. **Propagação JSON** (`json-output.js`)
   - Bloco: `if (coreMetrics.rms)` (linha 397)
   - Status: ✅ **CÓDIGO EXISTE E ESTÁ ATIVO**
   - Atribuição: `technicalData.avgLoudness = technicalData.rmsLevels.average`

4. **Chamada no Pipeline** (`pipeline-complete.js`)
   - Função: `calculateCoreMetrics()` chamada na linha 120
   - Status: ✅ **PIPELINE CHAMA CORE METRICS**

---

## 🚨 PROBLEMA IDENTIFICADO: POSSÍVEL CAUSA RAIZ

### Hipótese 1: Valores RMS Muito Pequenos (1e-8)

**Local:** `temporal-segmentation.js` linhas 173-184

```javascript
// Validar RMS finito e não-zero
if (isFinite(rmsValue) && rmsValue > 0) {
  rmsValues.push(rmsValue);
} else {
  // ⚠️ PROBLEMA POTENCIAL: Para silêncio, usa 1e-8
  rmsValues.push(1e-8);
}
```

**Impacto:**
- Blocos de silêncio recebem `1e-8`
- Convertido para dB: `20 * log10(1e-8) = -160 dB`
- Isso pode ser filtrado depois como "inválido"

### Hipótese 2: Filtro de Valores Válidos em `processRMSMetrics`

**Local:** `core-metrics.js` linhas 1242-1243

```javascript
// Filtrar apenas valores válidos (não-zero, não-NaN, não-Infinity)
const validLeftFrames = leftFrames.filter(val => val > 0 && isFinite(val));
const validRightFrames = rightFrames.filter(val => val > 0 && isFinite(val));
```

**Impacto:**
- Se `rmsValues` contém `1e-8`, isso **passa** no filtro (`1e-8 > 0` é true)
- PORÉM, se todos os valores forem `1e-8`, o RMS médio será extremamente baixo
- Convertido para dB: `-160 dB` (perto do floor de `-120 dB`)

### Hipótese 3: `safeSanitize` Tratando -120dB como Null

**Local:** `json-output.js` - função `safeSanitize` (não vimos o código ainda)

**Possibilidade:**
- Se `safeSanitize()` trata valores <= -120dB como `null`
- Então `technicalData.avgLoudness = null`
- Frontend recebe `null` e exibe `—`

---

## 🔬 LOGS ADICIONADOS PARA DIAGNÓSTICO

Foram inseridos **5 pontos de log críticos**:

### Log 1: Cálculo RMS (temporal-segmentation.js linha 171)
```javascript
console.log(`[DEBUG RMS CALC] Canal ${channelName}, Bloco 0: rmsValue=${rmsValue}, isFinite=${isFinite(rmsValue)}, block.length=${block.length}`);
```

### Log 2: Valores Finais RMS (temporal-segmentation.js linha 189)
```javascript
console.log(`[DEBUG RMS FINAL] Canal ${channelName}: frames=${frames.length}, rmsValues=${rmsValues.length}, primeiro RMS=${rmsValues[0]?.toFixed(6)}, último RMS=${rmsValues[rmsValues.length-1]?.toFixed(6)}`);
```

### Log 3: processRMSMetrics Return (core-metrics.js linha 1284)
```javascript
console.log(`[DEBUG RMS RETURN] average=${averageRMSDb.toFixed(2)} dB, peak=${peakRMSDb.toFixed(2)} dB, validFrames L/R=${validLeftFrames.length}/${validRightFrames.length}`);
```

### Log 4: Chamada processRMSMetrics (core-metrics.js linha 269)
```javascript
console.log(`[DEBUG CORE] Chamando processRMSMetrics com segmentedAudio.framesRMS:`, {
  hasFramesRMS: !!segmentedAudio.framesRMS,
  hasLeft: !!segmentedAudio.framesRMS?.left,
  hasRight: !!segmentedAudio.framesRMS?.right,
  leftLength: segmentedAudio.framesRMS?.left?.length,
  rightLength: segmentedAudio.framesRMS?.right?.length,
  count: segmentedAudio.framesRMS?.count
});
const result = this.processRMSMetrics(segmentedAudio.framesRMS);
console.log(`[DEBUG CORE] processRMSMetrics retornou:`, result);
```

### Log 5: Propagação JSON (json-output.js linha 399 e 413)
```javascript
console.log(`[DEBUG JSON RMS] coreMetrics.rms.average=${coreMetrics.rms.average}, left=${coreMetrics.rms.left}, right=${coreMetrics.rms.right}, peak=${coreMetrics.rms.peak}`);
// ...
console.log(`[DEBUG JSON FINAL] technicalData.avgLoudness=${technicalData.avgLoudness}, technicalData.rms=${technicalData.rms}`);
```

---

## 🧪 PRÓXIMOS PASSOS PARA TESTE

### 1. Executar Análise de Áudio com Logs

Execute o worker e processe um áudio qualquer:

```bash
cd work
node worker.js
```

### 2. Buscar nos Logs

Procure pelos seguintes padrões:

```bash
# Cálculo inicial
grep "DEBUG RMS CALC" logs.txt

# Valores finais da segmentação
grep "DEBUG RMS FINAL" logs.txt

# Chamada e retorno do processRMSMetrics
grep "DEBUG CORE" logs.txt
grep "DEBUG RMS RETURN" logs.txt

# Propagação para JSON
grep "DEBUG JSON" logs.txt
```

### 3. Interpretar Resultados

**Caso 1: RMS Muito Baixo (< -100 dB)**
```
[DEBUG RMS CALC] Canal left, Bloco 0: rmsValue=0.000001, isFinite=true, block.length=14400
[DEBUG RMS FINAL] Canal left: primeiro RMS=0.000001, último RMS=0.000001
[DEBUG RMS RETURN] average=-120.00 dB, peak=-120.00 dB
[DEBUG JSON FINAL] technicalData.avgLoudness=null  ← PROBLEMA AQUI
```

**Solução:** `safeSanitize` está tratando `-120dB` como inválido.

**Caso 2: framesRMS.left/right Vazios**
```
[DEBUG CORE] Chamando processRMSMetrics: leftLength=0, rightLength=0
[DEBUG CORE] processRMSMetrics retornou: { left: null, right: null, average: null }
```

**Solução:** `segmentChannelForRMS` não está sendo executado ou está retornando vazio.

**Caso 3: coreMetrics.rms Não Existe**
```
[DEBUG JSON ERROR] coreMetrics.rms é undefined (undefined)
```

**Solução:** `this.processRMSMetrics` não está sendo chamado em `core-metrics.js`.

---

## 📝 AÇÕES SUGERIDAS APÓS TESTES

### Se RMS está sendo calculado mas tratado como null:

**Arquivo:** `work/api/audio/json-output.js`

**Problema:** `safeSanitize` pode estar rejeitando valores muito baixos

**Solução:**
```javascript
// Verificar implementação de safeSanitize
function safeSanitize(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  if (!Number.isFinite(value)) return defaultValue;
  // ⚠️ REMOVER ESTE IF SE EXISTIR:
  // if (value < -100) return defaultValue; // Não rejeitar RMS baixo!
  return value;
}
```

### Se framesRMS está vazio:

**Arquivo:** `work/api/audio/temporal-segmentation.js`

**Problema:** `segmentChannelForRMS` não está populando `rmsValues`

**Solução:**
```javascript
// Verificar se block está sendo extraído corretamente
const block = extractFrame(audioData, startSample, RMS_BLOCK_SAMPLES);
console.log(`[DEBUG] Bloco ${blockIndex}: length=${block.length}, primeiros valores=${block.slice(0,5)}`);
```

### Se processRMSMetrics não está sendo chamado:

**Arquivo:** `work/api/audio/core-metrics.js`

**Problema:** Linha 269 pode estar comentada ou dentro de um bloco não executado

**Solução:** Verificar se há condicionais bloqueando a execução:
```javascript
// ANTES (possível problema):
if (SOME_CONDITION) {
  rms: this.processRMSMetrics(segmentedAudio.framesRMS),
}

// DEPOIS (correção):
rms: this.processRMSMetrics(segmentedAudio.framesRMS), // Sempre executar
```

---

## 🎯 RESUMO: O QUE SABEMOS ATÉ AGORA

✅ **Código existe e está ativo** em todas as 4 fases  
✅ **Pipeline chama core-metrics** que chama processRMSMetrics  
✅ **JSON output tem bloco de RMS** e atribui avgLoudness  
✅ **Logs foram adicionados** para capturar valores em tempo real  

⚠️ **Suspeitas principais:**
1. `safeSanitize` rejeitando valores < -100dB
2. `rmsValues` contendo apenas `1e-8` (silêncio)
3. Filtro `val > 0` removendo todos os valores válidos
4. Conversão dB gerando `-Infinity` ou `NaN`

---

## 📊 CHECKLIST DE VERIFICAÇÃO

Ao rodar o teste, confirmar:

- [ ] `[DEBUG RMS CALC]` aparece nos logs
- [ ] Valores de `rmsValue` são maiores que `1e-8`
- [ ] `[DEBUG RMS FINAL]` mostra arrays populados (não vazios)
- [ ] `[DEBUG CORE]` mostra `leftLength` e `rightLength` > 0
- [ ] `[DEBUG RMS RETURN]` mostra `average` entre -60 e -20 dB
- [ ] `[DEBUG JSON RMS]` mostra `coreMetrics.rms.average` com valor numérico
- [ ] `[DEBUG JSON FINAL]` mostra `technicalData.avgLoudness` **NÃO NULL**

---

**PRÓXIMO PASSO:** Executar análise de áudio e coletar logs completos para identificar o ponto exato da falha.
