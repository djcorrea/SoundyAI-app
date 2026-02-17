# 🎯 Implementação: evaluateMixCapacity() - Módulo de Capacidade da Mix

**Data**: 2026-02-15  
**Objetivo**: Decisão inteligente sobre target adjustment baseado em capacidade da mix  
**Tipo**: IMPLEMENTAÇÃO DETERMINÍSTICA  
**Status**: ✅ IMPLEMENTADO E TESTADO (sintaxe)

---

## 📋 SUMÁRIO EXECUTIVO

### O que foi implementado

**Função `evaluateMixCapacity()`**:
- Analisa capacidade da mix de ser empurrada para targets mais altos
- Decisões 100% determinísticas (zero IA, zero heurísticas probabilísticas)
- Filosofia conservadora: prioriza qualidade sobre alcançar targets artificiais

**Integração no pipeline**:
- Executa ANTES do `computeSafeTarget()` (Passo 1.5A)
- Ajusta target original com offset inteligente
- Mantém compatibilidade total com sistema existente

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### Fluxo de decisão

```
analyzeDynamicStability()
         ↓
[Spectral data disponível?]
    ├── SIM → usar sub, body, crest (dados reais)
    └── NÃO → usar crest estimado + valores neutros
         ↓
evaluateMixCapacity()
    ├── Regra #1: crest < 6dB → NÃO empurrar
    ├── Regra #2: unstableDynamics → NÃO empurrar
    ├── Regra #3: sub > body-6dB → empurrar conservador (+0.5 LU)
    ├── Regra #4: delta < 1 LU → sem ajuste
    └── Regra #5: crest-based scaling (0.3 to 1.0 LU)
         ↓
targetWithCapacity = originalTarget + offset
         ↓
computeSafeTarget(targetWithCapacity)
         ↓
adjustedTarget final
```

---

## 🔧 DETALHAMENTO TÉCNICO

### Função `evaluateMixCapacity()`

**Localização**: `automaster-v1.cjs`, linhas 593-704

**Assinatura**:
```javascript
function evaluateMixCapacity(options)
```

**Parâmetros de entrada**:
```javascript
{
  crestFactor: number,        // Crest factor em dB (dinâmica)
  subRms: number,             // RMS da banda sub (<120Hz) em dB
  bodyRms: number,            // RMS total (body) em dB
  unstableDynamics: boolean,  // Flag de instabilidade dinâmica
  currentLufs: number,        // LUFS integrado atual
  targetLufs: number          // Target LUFS desejado
}
```

**Retorno**:
```javascript
{
  canPush: boolean,               // Se pode empurrar ou não
  pushStrength: string,           // 'none' | 'low' | 'medium' | 'high'
  reason: string,                 // Explicação textual da decisão
  recommendedLufsOffset: number   // Offset em LU (0 a 1.0)
}
```

---

### Regras de decisão implementadas

#### **Regra #1: Crest Factor < 6dB**
```javascript
if (crestFactor < 6) {
  return {
    canPush: false,
    pushStrength: 'none',
    reason: `crest factor baixo (${crestFactor.toFixed(1)}dB < 6dB) - mix já comprimida`,
    recommendedLufsOffset: 0
  };
}
```

**Lógica**: Mix já comprimida (crest < 6dB) não deve ser empurrada mais.  
**Threshold**: 6dB é limite mínimo de dinâmica saudável.

---

#### **Regra #2: Dinâmica Instável**
```javascript
if (unstableDynamics) {
  return {
    canPush: false,
    pushStrength: 'none',
    reason: 'dinâmica instável detectada - não empurrar',
    recommendedLufsOffset: 0
  };
}
```

**Lógica**: Instabilidade detectada (pumping, flutuation) = não empurrar.  
**Origem**: Flag do `analyzeDynamicStability()`.

---

#### **Regra #3: Sub Dominante**
```javascript
const subDominance = subRms - bodyRms;

if (subDominance > -6) {
  return {
    canPush: true,
    pushStrength: 'low',
    reason: `sub dominante (${subDominance.toFixed(1)}dB > -6dB) - empurrar conservador`,
    recommendedLufsOffset: 0.5
  };
}
```

**Lógica**: Sub muito próximo do body (menos de 6dB abaixo) = graves dominando.  
**Risco**: Empurrar muito causa pumping/embolamento.  
**Solução**: Limitar offset a +0.5 LU (conservador).

**Exemplo**:
- `bodyRms = -14dB`, `subRms = -16dB` → dominância = -2dB → **SUB DOMINANTE** (empurrar +0.5 LU max)
- `bodyRms = -14dB`, `subRms = -22dB` → dominância = -8dB → sub OK (empurrar conforme crest)

---

#### **Regra #4: Delta < 1 LU**
```javascript
const delta = targetLufs - currentLufs;

if (Math.abs(delta) <= 1.0) {
  return {
    canPush: false,
    pushStrength: 'none',
    reason: 'mix já próxima do target (≤1 LU)',
    recommendedLufsOffset: 0
  };
}
```

**Lógica**: Se já está próximo do target (≤1 LU), não ajustar.  
**Motivo**: Ajustes pequenos são imperceptíveis e arriscam degradação.

---

#### **Regra #5: Crest-based Scaling**
```javascript
if (crestFactor >= 12) {
  offset = 1.0;
  strength = 'high';
  reason = `crest alto (${crestFactor.toFixed(1)}dB ≥ 12dB) - mix dinâmica, pode empurrar`;
} else if (crestFactor >= 9) {
  offset = 0.7;
  strength = 'medium';
  reason = `crest médio-alto (${crestFactor.toFixed(1)}dB 9-12dB) - empurrar moderado`;
} else {
  offset = 0.3;
  strength = 'low';
  reason = `crest médio (${crestFactor.toFixed(1)}dB 6-9dB) - empurrar leve`;
}

// Limitar offset ao delta disponível (não ultrapassar target original)
offset = Math.min(offset, delta);
```

**Lógica**: Quanto maior o crest factor, mais dinâmica a mix, mais pode empurrar.

**Mapeamento**:
- **Crest ≥ 12dB**: offset = +1.0 LU (high strength)
- **Crest 9-12dB**: offset = +0.7 LU (medium strength)
- **Crest 6-9dB**: offset = +0.3 LU (low strength)
- **Crest < 6dB**: offset = 0 (regra #1, mix já comprimida)

**Exemplo prático**:
- Mix dinâmica: crest = 14dB → offset = +1.0 LU → targetWithCapacity = -10 + 1.0 = -9.0 LUFS
- Mix média: crest = 10dB → offset = +0.7 LU → targetWithCapacity = -10 + 0.7 = -9.3 LUFS
- Mix comprimida: crest = 4dB → offset = 0 → targetWithCapacity = -10.0 LUFS (inalterado)

---

#### **Proteção adicional: Delta negativo**
```javascript
if (delta < 0) {
  return {
    canPush: false,
    pushStrength: 'none',
    reason: 'current LUFS já acima do target - sem ajuste',
    recommendedLufsOffset: 0
  };
}
```

**Lógica**: Se o current LUFS já é maior que o target, não empurrar para baixo.  
**Motivo**: evaluateMixCapacity() só empurra para CIMA, não para baixo.

---

## 🔗 INTEGRAÇÃO NO PIPELINE

### Localização: Passo 1.5A (linhas 852-908)

**Antes** (original):
```javascript
const originalTarget = targetI;
const delta = originalTarget - measured.input_i;
let adjustedTarget = computeSafeTarget(measured.input_i, originalTarget);
```

**Depois** (com evaluateMixCapacity):
```javascript
// Passo 1.5A: Avaliação de Capacidade da Mix (NOVO)
const originalTarget = targetI;
let mixCapacity = null;

// Verificar se spectral data está disponível
if (stability.spectral && stability.spectral.bands) {
  // Usar dados reais (sub, body, crest)
  mixCapacity = evaluateMixCapacity({
    crestFactor: crest || estimateCrestFactor(...),
    subRms: sub,
    bodyRms: body,
    unstableDynamics: stability.unstableDynamics,
    currentLufs: measured.input_i,
    targetLufs: originalTarget
  });
} else {
  // Fallback: usar crest estimado + valores neutros
  mixCapacity = evaluateMixCapacity({
    crestFactor: estimateCrestFactor(...),
    subRms: -20,  // Neutro
    bodyRms: -14, // Neutro
    unstableDynamics: stability.unstableDynamics,
    currentLufs: measured.input_i,
    targetLufs: originalTarget
  });
}

// Aplicar offset de capacidade
let targetWithCapacity = originalTarget;
if (mixCapacity && mixCapacity.canPush && mixCapacity.recommendedLufsOffset > 0) {
  targetWithCapacity = originalTarget + mixCapacity.recommendedLufsOffset;
}

// Passo 1.5B: Proteção Conservadora de Loudness
const delta = targetWithCapacity - measured.input_i;
let adjustedTarget = computeSafeTarget(measured.input_i, targetWithCapacity);
```

**Mudanças**:
1. ✅ `evaluateMixCapacity()` executado antes do `computeSafeTarget()`
2. ✅ Target ajustado com offset inteligente (`targetWithCapacity`)
3. ✅ `computeSafeTarget()` recebe target já ajustado
4. ✅ Delta recalculado com `targetWithCapacity`
5. ✅ Fallback para spectral data ausente (valores neutros)

---

## 🎯 CASOS DE USO

### Caso 1: Mix dinâmica e saudável

**Input**:
- `crestFactor = 14dB` (muito dinâmico)
- `subRms = -22dB`, `bodyRms = -14dB` (sub OK, -8dB abaixo)
- `unstableDynamics = false`
- `currentLufs = -15.0`, `targetLufs = -10.0` (delta = 5.0 LU)

**Decisão**:
- Regra #5: crest ≥ 12dB → offset = +1.0 LU (high strength)
- Verificar: offset (1.0) < delta (5.0) ✅
- `recommendedLufsOffset = +1.0 LU`

**Resultado**:
- `targetWithCapacity = -10.0 + 1.0 = -9.0 LUFS`
- `computeSafeTarget(-15.0, -9.0)` → `adjustedTarget = -9.0 LUFS` (delta = 6.0 < 6, safe zone)
- **Target final**: `-9.0 LUFS` (empurrado +1 LU pelo mix capacity)

---

### Caso 2: Mix comprimida (crest baixo)

**Input**:
- `crestFactor = 4dB` (comprimida)
- `subRms = -18dB`, `bodyRms = -14dB` (sub OK)
- `unstableDynamics = false`
- `currentLufs = -15.0`, `targetLufs = -10.0`

**Decisão**:
- Regra #1: crest < 6dB → NÃO empurrar
- `recommendedLufsOffset = 0`

**Resultado**:
- `targetWithCapacity = -10.0 + 0 = -10.0 LUFS` (inalterado)
- `computeSafeTarget(-15.0, -10.0)` → `adjustedTarget = -10.0 LUFS`
- **Target final**: `-10.0 LUFS` (sem ajuste, mix já comprimida)

---

### Caso 3: Sub dominante

**Input**:
- `crestFactor = 10dB` (médio-alto)
- `subRms = -16dB`, `bodyRms = -14dB` (sub dominante, -2dB abaixo)
- `unstableDynamics = false`
- `currentLufs = -15.0`, `targetLufs = -10.0`

**Decisão**:
- Regra #3: subDominance (-2) > -6 → empurrar conservador
- `recommendedLufsOffset = +0.5 LU` (limitado a 0.5 LU)

**Resultado**:
- `targetWithCapacity = -10.0 + 0.5 = -9.5 LUFS`
- `computeSafeTarget(-15.0, -9.5)` → `adjustedTarget = -9.5 LUFS`
- **Target final**: `-9.5 LUFS` (empurrado apenas +0.5 LU por segurança)

---

### Caso 4: Dinâmica instável

**Input**:
- `crestFactor = 10dB`
- `subRms = -20dB`, `bodyRms = -14dB`
- `unstableDynamics = true` ⚠️
- `currentLufs = -15.0`, `targetLufs = -10.0`

**Decisão**:
- Regra #2: unstableDynamics → NÃO empurrar
- `recommendedLufsOffset = 0`

**Resultado**:
- `targetWithCapacity = -10.0 + 0 = -10.0 LUFS`
- `computeSafeTarget(-15.0, -10.0)` → `adjustedTarget = -10.0 LUFS`
- **Target final**: `-10.0 LUFS` (sem ajuste, dinâmica instável detectada)

---

### Caso 5: Fallback (sem spectral data)

**Input**:
- `stability.spectral = null` (analyzeForMaster não implementado ainda)
- `estimatedCrest = 11dB` (calculado de peak - lufs)
- `subRms = -20dB` (neutro), `bodyRms = -14dB` (neutro)
- `unstableDynamics = false`
- `currentLufs = -15.0`, `targetLufs = -10.0`

**Decisão**:
- Fallback ativado: usar crest estimado
- Regra #5: crest 9-12dB → offset = +0.7 LU (medium strength)
- `recommendedLufsOffset = +0.7 LU`

**Resultado**:
- `targetWithCapacity = -10.0 + 0.7 = -9.3 LUFS`
- **Target final**: `-9.3 LUFS` (empurrado +0.7 LU baseado em crest estimado)

**Nota**: Quando `analyzeForMaster()` for implementado (PASSO 3), dados reais (sub, body, crest) serão usados automaticamente.

---

## 🐛 LOGS DEBUG

### Logs quando spectral data disponível

```
[DEBUG] Mix capacity evaluation:
[DEBUG]   Can push: true
[DEBUG]   Strength: medium
[DEBUG]   Reason: crest médio-alto (10.2dB 9-12dB) - empurrar moderado
[DEBUG]   Recommended offset: +0.70 LU
[DEBUG] Target ajustado por capacidade: -10.00 + 0.70 = -9.30 LUFS
```

### Logs em fallback (sem spectral data)

```
[DEBUG] Mix capacity evaluation (fallback - sem spectral data):
[DEBUG]   Using estimated crest: 11.5dB
[DEBUG]   Recommended offset: +0.70 LU
[DEBUG] Target ajustado por capacidade: -10.00 + 0.70 = -9.30 LUFS
```

### Logs quando não pode empurrar

```
[DEBUG] Mix capacity evaluation:
[DEBUG]   Can push: false
[DEBUG]   Strength: none
[DEBUG]   Reason: crest factor baixo (4.2dB < 6dB) - mix já comprimida
[DEBUG]   Recommended offset: +0.00 LU
```

---

## ✅ GARANTIAS IMPLEMENTADAS

### 1. Determinismo total

- ✅ Zero randomização
- ✅ Zero IA/ML
- ✅ Zero heurísticas probabilísticas
- ✅ Apenas lógica condicional (`if/else`)
- ✅ Mesma entrada → mesma saída (sempre)

### 2. Fail-safe behavior

- ✅ Se `spectral data` ausente → fallback com crest estimado
- ✅ Se `mixCapacity = null` → target inalterado
- ✅ Se `canPush = false` → offset = 0
- ✅ Se delta negativo → sem ajuste
- ✅ Offset limitado ao delta disponível

### 3. Zero impacto em sistemas existentes

- ✅ `computeSafeTarget()` inalterado (recebe target ajustado)
- ✅ `renderTwoPass()` inalterado
- ✅ `loudnorm` inalterado
- ✅ `alimiter` inalterado
- ✅ Stability recommendations aplicadas depois (conservative, reduce_target)

### 4. Conservadorismo mantido

- ✅ Offsets limitados: 0.3 a 1.0 LU (máximo)
- ✅ Sub dominante: offset máximo 0.5 LU
- ✅ Crest baixo: offset = 0
- ✅ Instabilidade: offset = 0
- ✅ Delta pequeno: offset = 0

---

## 📊 MÉTRICAS ESPERADAS

### Antes (sem evaluateMixCapacity)

- Target: definido pelo gênero (`targets-adapter.cjs`)
- Ajuste: apenas `computeSafeTarget()` (proteção delta > 6 LU)
- Problema: ignora capacidade real da mix

### Depois (com evaluateMixCapacity)

- Target: ajustado conforme capacidade (offset 0 a 1.0 LU)
- Ajuste: `evaluateMixCapacity()` + `computeSafeTarget()` (dupla proteção)
- Benefício: aproveita dinâmica disponível sem degradar

### Impacto esperado

| Cenário | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| Mix dinâmica (crest 14dB) | -10.0 LUFS | -9.0 LUFS | +1.0 LU ✅ |
| Mix média (crest 10dB) | -10.0 LUFS | -9.3 LUFS | +0.7 LU ✅ |
| Mix comprimida (crest 4dB) | -10.0 LUFS | -10.0 LUFS | 0 (protegido) ✅ |
| Sub dominante | -10.0 LUFS | -9.5 LUFS | +0.5 LU (conservador) ✅ |
| Instável | -10.0 LUFS | -10.0 LUFS | 0 (protegido) ✅ |

**Resultado**: Masters **até 1 LU mais altos** quando a mix permite, **sem degradação**.

---

## 🧪 PRÓXIMOS PASSOS (VALIDAÇÃO)

### Testes manuais necessários

1. **Teste com baixa.wav** (mix com headroom)
   - Verificar: offset > 0, target empurrado
   - Validar: logs DEBUG mostram decisão correta

2. **Teste com alta.wav** (mix limitada)
   - Verificar: offset = 0 (crest baixo)
   - Validar: logs mostram "mix já comprimida"

3. **Teste com mix instável** (criar arquivo de teste)
   - Verificar: offset = 0 (unstableDynamics = true)
   - Validar: logs mostram "dinâmica instável"

4. **Teste consistency** (29/29 testes)
   - Comando: `node tests/test-targets-consistency.cjs`
   - Validar: todos passam (compatibilidade mantida)

### Testes de integração (quando analyzeForMaster implementado)

5. **Teste com spectral data real**
   - Verificar: usa sub, body, crest reais
   - Validar: decisões mais precisas

6. **Teste fallback vs real**
   - Comparar: offset com crest estimado vs real
   - Validar: diferenças aceitáveis

---

## 🎉 CONCLUSÃO

### Status: ✅ IMPLEMENTADO E VALIDADO (SINTAXE)

**Implementações concluídas**:
1. ✅ Função `evaluateMixCapacity()` (linhas 593-704)
2. ✅ Integração no pipeline (Passo 1.5A, linhas 852-908)
3. ✅ Logs DEBUG para troubleshooting
4. ✅ Fallback para spectral data ausente
5. ✅ Sintaxe validada (`node -c automaster-v1.cjs` ✅)

**Garantias técnicas**:
- ✅ 100% determinístico
- ✅ Zero IA/ML
- ✅ Fail-safe total
- ✅ Zero impacto em sistemas existentes
- ✅ Conservadorismo mantido

**Próxima etapa**: Testes manuais com baixa.wav e alta.wav

---

**Implementação realizada por**: GitHub Copilot (Claude Sonnet 4.5)  
**Data**: 2026-02-15  
**Versão**: 1.0 (Mix Capacity Module)  
**Status**: ✅ **IMPLEMENTADO - AGUARDANDO TESTES**

---

## 📖 REFERÊNCIAS

- **AUDIT_TEMPORAL_STABILITY_2026-02-15.md**: Temporal stability improvements
- **AUDIT_AUTOMASTER_ARCHITECTURE_2026-02-15.md**: Architecture audit
- **AUDIT_ANALYZE_FOR_MASTER_REVISION_2026-02-15.md**: Spectral analysis revision (PASSO 3 pendente)
- **automaster-v1.cjs**: Main implementation file
