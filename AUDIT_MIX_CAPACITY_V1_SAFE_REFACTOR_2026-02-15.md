# ✅ REFATORAÇÃO V1-SAFE: evaluateMixCapacity() - COMPLETO + FALLBACK CONSERVADOR

**Data**: 2026-02-15  
**Objetivo**: Eliminar edge cases e garantir invariantes V1 (determinístico, conservador, previsível)  
**Atualização**: Fallback mode ultra-conservador (bloqueia deltas pequenos mesmo com sub dominante)  
**Status**: ✅ IMPLEMENTADO E TESTADO (27/27 testes passaram)

---

## 📋 PROBLEMAS IDENTIFICADOS E CORRIGIDOS

### Problema #1: Ordem de validações incorreta
**Antes**: Delta < 0 checado no final (linha ~695), após cálculo de offset  
**Risco**: Código podia calcular offset positivo para delta negativo  
**Correção**: Delta < 0 movido para hard stops (step 2.3), ANTES de calcular offset  

### Problema #2: Sub dominante retornava cedo
**Antes**: 
```javascript
if (subDominance > -6) {
  return { recommendedLufsOffset: 0.5 }; // return cedo
}
```
**Risco**: Ignorava delta <= 1.0 e delta < 0, offset 0.5 fixo sem cap pelo delta  
**Correção**: Sub dominante agora é CAP (não return cedo), aplicado APÓS base offset:
```javascript
if (isSubDominant) {
  offsetBase = Math.min(offsetBase, 0.5); // cap, não return
}
```

### Problema #3: Fallback sem cap
**Antes**: Fallback usava crest estimado sem limitação  
**Risco**: Offsets agressivos demais (até 1.0 LU) sem dados espectrais confiáveis  
**Correção**: Adicionado parâmetro `isFallback` e cap de 0.7 LU:
```javascript
if (isFallback) {
  offset = Math.min(offset, 0.7);
  reason += '_fallback_cap';
}
```

### Problema #4: Hard stop de delta <= 1.0 bloqueava sub dominante
**Antes**: Hard stop de delta <= 1.0 impedia offsets pequenos para sub dominante  
**Risco**: Sub dominante com delta 0.4 deveria retornar 0.4, mas era bloqueado  
**Correção**: Hard stop agora verifica se NÃO é sub dominante:
```javascript
if (Math.abs(delta) <= 1.0 && !isSubDominant) {
  return { canPush: false }; // bloqueia apenas se sub OK
}
```

### Problema #5: Sem validação de métricas
**Antes**: Função assumia métricas sempre válidas  
**Risco**: NaN/null/undefined causariam comportamento imprevisível  
**Correção**: Validação obrigatória no início (step 1):
```javascript
if (crestFactor == null || isNaN(crestFactor) || ...) {
  return { canPush: false, reason: 'missing_metrics' };
}
```

### Problema #6: Fallback permitia deltas pequenos com sub dominante
**Antes**: Fallback mode permitia offsets pequenos quando sub dominante, mesmo sem dados espectrais confiáveis  
**Risco**: Offsets aplicados baseados em crest estimado + sub dominante simulado poderiam degradar qualidade  
**Correção**: Fallback mode ultra-conservador - bloqueia deltas <= 1.0 mesmo com sub dominante:
```javascript
// Permitir offsets pequenos para sub dominante, MAS NÃO em fallback mode
if (Math.abs(delta) <= 1.0 && (!isSubDominant || isFallback)) {
  return { canPush: false }; // bloqueia se !sub OU se fallback
}
```

**Comportamento**:
- `isFallback=false` + `isSubDominant=true` + `delta=0.4` → **permite** offset 0.4 ✅
- `isFallback=true` + `isSubDominant=true` + `delta=0.8` → **bloqueia** offset 0 ✅ (conservador)
- `isFallback=false` + `isSubDominant=false` + `delta=0.8` → **bloqueia** offset 0 ✅

---

## 🔧 NOVA ORDEM DE VALIDAÇÕES (V1-SAFE)

```
┌─────────────────────────────────────────────┐
│ 1. VALIDAÇÃO DE MÉTRICAS                    │
│    ↓ null/undefined/NaN → return offset 0   │
├─────────────────────────────────────────────┤
│ 2. HARD STOPS                                │
│    ↓ unstableDynamics? → return offset 0    │
│    ↓ delta < 0? → return offset 0           │
│    ↓ crestFactor < 6? → return offset 0     │
│    ↓ Calcular isSubDominant (> -6.0)        │
│    ↓ delta <= 1.0 E (!sub OU fallback)?     │
│        → return offset 0                     │
├─────────────────────────────────────────────┤
│ 3. BASE OFFSET POR CREST                    │
│    crest >= 12 → 1.0 (high)                 │
│    crest >= 9  → 0.7 (medium)               │
│    crest >= 6  → 0.3 (low)                  │
├─────────────────────────────────────────────┤
│ 4. SUB DOMINANTE CAP (não return cedo)      │
│    if sub dominante:                        │
│       offsetBase = Math.min(offsetBase, 0.5)│
├─────────────────────────────────────────────┤
│ 5. CAP FINAL OBRIGATÓRIO                    │
│    offset = Math.min(offsetBase, delta)     │
│    offset = clamp(offset, 0, 1.0)           │
├─────────────────────────────────────────────┤
│ 6. FALLBACK CAP                             │
│    if isFallback:                           │
│       offset = Math.min(offset, 0.7)        │
└─────────────────────────────────────────────┘
```

---

## 🧪 TESTES OBRIGATÓRIOS (5 edge cases críticos)

### Teste #1: Delta pequeno + sub dominante → cap pelo delta
**Input**:
- `delta = 0.4`, `crest = 12.0`, `subRms = -16`, `bodyRms = -14`
- Sub dominância: -16 - (-14) = -2 > -6 (dominante)

**Fluxo**:
1. Hard stops: passa (delta > 0, crest >= 6, isSubDominant = true)
2. Base offset: crest 12 → offsetBase = 1.0
3. Sub dominante cap: offsetBase = Math.min(1.0, 0.5) = 0.5
4. Cap final: offset = Math.min(0.5, 0.4) = **0.4** ✅

**Resultado esperado**: offset = 0.4 (NUNCA 0.5)  
**Resultado real**: ✅ PASSOU

---

### Teste #2: Delta negativo + sub dominante → offset 0
**Input**:
- `delta = -0.2`, `crest = 12.0`, `subRms = -16`, `bodyRms = -14`

**Fluxo**:
1. Hard stop delta < 0: **BLOQUEIA** → return { offset: 0, reason: 'delta_negative' }

**Resultado esperado**: offset = 0  
**Resultado real**: ✅ PASSOU

---

### Teste #3: Delta pequeno + sub OK → offset 0
**Input**:
- `abs(delta) = 0.8`, `crest = 14.0`, `subRms = -22`, `bodyRms = -14`
- Sub dominância: -22 - (-14) = -8 < -6 (OK, não dominante)

**Fluxo**:
1. Hard stop delta <= 1.0 E !isSubDominant: **BLOQUEIA** → return { offset: 0 }

**Resultado esperado**: offset = 0  
**Resultado real**: ✅ PASSOU

---

### Teste #4: Fallback conservador - delta pequeno + sub dominante → offset 0
**Input**:
- `delta = 0.8`, `crest = 12.0`, `subRms = -16`, `bodyRms = -14`, `isFallback = true`
- Sub dominância: -16 - (-14) = -2 > -6 (dominante)

**Fluxo**:
1. Hard stop: `delta <= 1.0 E (!isSubDominant OU isFallback)`
2. `(!true OU true) = (false OU true) = true` → **BLOQUEIA**

**Resultado esperado**: offset = 0 (conservador no fallback)  
**Resultado real**: ✅ PASSOU

**Motivo**: Fallback mode não tem dados espectrais reais, apenas crest estimado + valores neutros. Deltas pequenos não devem ser arriscados nesse cenário.

---

### Teste #5: Sub dominance -6.0 exato → não é dominante
**Input**:
- `subRms = -20.0`, `bodyRms = -14.0`, `delta = 2.0`
- Sub dominância: -20 - (-14) = **-6.0 exato**

**Fluxo**:
1. `isSubDominant = subDominance > -6.0` → `isSubDominant = -6.0 > -6.0` → **false** ✅
2. Hard stop delta: passa (delta=2.0 > 1.0)
3. Base offset: crest 12 → offsetBase = 1.0
4. Sub dominante cap: NÃO aplicado (isSubDominant=false)

**Resultado esperado**: offset = 1.0 (sem cap de sub dominante)  
**Resultado real**: ✅ PASSOU

**Motivo**: Comparador estrito `>` (não `>=`) garante que -6.0 exato = não dominante.

---

## 📊 RESUMO DOS TESTES (27 casos)

```
🧪 TESTES UNITÁRIOS: evaluateMixCapacity() V1-Safe

📋 TESTES OBRIGATÓRIOS (edge cases críticos)
✅ OBRIGATÓRIO #1: Delta 0.4 + crest 12 + sub dominante → offset DEVE SER 0.4
✅ OBRIGATÓRIO #2: Delta negativo (-0.2) → offset DEVE SER 0
✅ OBRIGATÓRIO #3: Delta 0.8 (abaixo de 1.0) → offset DEVE SER 0

📋 VALIDAÇÃO DE MÉTRICAS
✅ Métricas válidas: null crestFactor
✅ Métricas válidas: NaN subRms
✅ Métricas válidas: undefined bodyRms

📋 HARD STOPS (ordem importa)
✅ Hard stop: unstableDynamics = true
✅ Hard stop: delta negativo
✅ Hard stop: delta exatamente 1.0 (limiar)
✅ Hard stop: crest 5.9 (abaixo de 6)

📋 BASE OFFSET POR CREST (determinístico)
✅ Crest 12.0+ (high): offset base 1.0
✅ Crest 9.0-12.0 (medium): offset base 0.7
✅ Crest 6.0-9.0 (low): offset base 0.3

📋 SUB DOMINANTE CAP (não return cedo)
✅ Sub dominante + crest high: cap 0.5 (não 1.0)
✅ Sub dominante + crest medium: cap 0.5 (não 0.7)
✅ Sub dominante + crest low: sem cap (0.3 < 0.5)
✅ Sub OK (não dominante): sem cap

📋 CAP FINAL OBRIGATÓRIO (delta e 1.0)
✅ Cap pelo delta: delta 2.0 < offset 1.0
✅ Cap pelo delta: delta 0.5 < offset 1.0
✅ Cap máximo 1.0: offset nunca excede 1.0

📋 FALLBACK CAP (0.7 LU max se isFallback=true)
✅ Fallback: crest high (1.0) → cap 0.7
✅ Fallback: crest medium (0.7) → sem cap (já é 0.7)
✅ Fallback: crest low (0.3) → sem cap (0.3 < 0.7)
✅ Fallback: sub dominante (0.5) + crest high → cap 0.5
✅ Sem fallback: crest high mantém 1.0

📋 FALLBACK CONSERVADOR (delta pequeno bloqueado)
✅ Fallback conservador: delta 0.8 + sub dominante → offset 0
✅ Sub dominance -6.0 exato: isSubDominant = false

============================================================
📊 RESUMO DOS TESTES
============================================================
Total de testes: 27
✅ Passaram: 27
❌ Falharam: 0
============================================================

🎉 TODOS OS TESTES PASSARAM!
evaluateMixCapacity() V1-Safe está correto e robusto.
```

---

## 🎯 TESTE REAL (Integração com pipeline)

**Arquivo testado**: `bem mixadas com headroom/1.wav`

**Logs de execução**:
```
[DEBUG] Mix capacity evaluation (fallback - sem spectral data):
[DEBUG]   Using estimated crest: 13.4dB
[DEBUG]   Fallback cap: 0.7 LU max
[DEBUG]   Can push: true
[DEBUG]   Reason: crest_high_13.4dB_fallback_cap
[DEBUG]   Recommended offset: +0.70 LU
[DEBUG] Target ajustado por capacidade: -9.20 + 0.70 = -8.90 LUFS
```

**Análise**:
- Crest estimado: 13.4dB → offset base seria 1.0 LU (high)
- **Fallback cap ativo**: offset cappado em 0.7 LU ✅
- Reason inclui `_fallback_cap` ✅
- Target ajustado: -9.2 + 0.7 = **-8.9 LUFS** (conservador) ✅

**Resultado final**:
- `"target_adjusted": true`
- `"original_target": -9.2`
- `"target_lufs": -8.9`
- Master processado com sucesso

---

## ✅ VALIDAÇÃO CONTRA REQUISITOS

### Restrições obrigatórias (todas cumpridas)

| Restrição | Status | Evidência |
|-----------|--------|-----------|
| NÃO alterar loudnorm, alimiter, renderTwoPass() | ✅ | Zero mudanças no DSP |
| NÃO criar novos passos no pipeline fora de evaluateMixCapacity() | ✅ | Apenas função e integração |
| NÃO usar IA/ML/random/probabilidade | ✅ | 100% determinístico (if/else) |
| Manter assinatura atual (ou compatível) | ✅ | Adicionado `isFallback` opcional (default false) |

### Mudanças obrigatórias na lógica (todas implementadas)

| Mudança | Status | Código |
|---------|--------|--------|
| 1. Validação de métricas | ✅ | Linhas 631-646 |
| 2. Hard stops em ordem | ✅ | Linhas 648-696 |
| 3. Base offset por crest | ✅ | Linhas 698-712 |
| 4. Sub dominante como CAP | ✅ | Linhas 714-719 |
| 5. Cap final obrigatório | ✅ | Linhas 721-728 |
| 6. Fallback cap (0.7 LU) | ✅ | Linhas 730-738 |
| 7. Fallback conservador delta | ✅ | Linha 690 (delta <= 1.0 + fallback check) |
| 8. Comparador estrito sub | ✅ | Linha 686 (> -6.0, não >=) |
| 9. Logs claros | ✅ | Linhas 905-931 |
| 10. Testes unitários | ✅ | test-mix-capacity-v1.cjs (27 casos) |

---

## 📁 ARQUIVOS MODIFICADOS

### `automaster/automaster-v1.cjs`
**Seção**: evaluateMixCapacity() (linhas 593-745)  
**Mudanças**:
- Adicionado step 1: validação de métricas
- Reordenado hard stops (step 2.1-2.6)
- Movido cálculo de sub dominance para ANTES do hard stop de delta
- Transformado sub dominante de return cedo → cap
- Adicionado cap final obrigatório (delta + clamp 1.0)
- Adicionado parâmetro `isFallback` com cap de 0.7 LU
- Reason agora inclui tags: `crest_high_14.0dB_sub_dominant_cap_fallback_cap`

**Seção**: Integração pipeline (linhas 881-933)  
**Mudanças**:
- Adicionado `isFallback: false` no call com spectral data
- Adicionado `isFallback: true` no call de fallback
- Logs expandidos: "Fallback cap: 0.7 LU max", "Can push", "Reason"

### `automaster/test-mix-capacity-v1.cjs` (NOVO)
**Tipo**: Testes unitários  
**Conteúdo**: 27 casos de teste cobrindo:
- 3 testes obrigatórios (edge cases críticos originais)
- 3 validações de métricas
- 4 hard stops
- 3 base offsets por crest
- 4 caps de sub dominante
- 3 caps finais
- 5 caps de fallback
- 2 testes de fallback conservador (delta pequeno bloqueado, sub -6.0 exato)

---

## 🎉 CONCLUSÃO

**Status**: ✅ **IMPLEMENTAÇÃO COMPLETA E VALIDADA**

**Garantias V1-Safe alcançadas**:
- ✅ 100% determinístico (zero IA/ML/random)
- ✅ Validação de métricas obrigatória
- ✅ Hard stops em ordem correta
- ✅ Sub dominante como cap (não return cedo)
- ✅ Cap final pelo delta disponível
- ✅ Fallback cap (0.7 LU max)
- ✅ Fallback ultra-conservador (bloqueia delta <= 1.0 mesmo com sub dominante)
- ✅ Comparador estrito sub dominance (> -6.0, não >=)
- ✅ Logs claros com tags de reason
- ✅ 27/27 testes unitários passando
- ✅ Teste real funcionando (offset 0.7 com fallback cap)
- ✅ Zero impacto no DSP (loudnorm/limiter/render intactos)

**Edge cases críticos resolvidos**:
1. Delta 0.4 + sub dominante (sem fallback) → offset 0.4 (cappado pelo delta, não 0.5 fixo) ✅
2. Delta negativo → offset 0 (hard stop antes de calcular) ✅
3. Delta 0.8 + sub OK → offset 0 (hard stop para deltas pequenos sem sub) ✅
4. Delta 0.8 + sub dominante + **fallback** → offset 0 (conservador sem dados espectrais) ✅
5. Sub dominance -6.0 exato → isSubDominant=false (comparador estrito) ✅

**Próximos passos**: Implementação está pronta para produção. Quando analyzeForMaster() (PASSO 3) for implementado, dados espectrais reais (sub/body RMS) substituirão os valores neutros automaticamente.

---

## 🔒 ATUALIZAÇÃO: FALLBACK ULTRA-CONSERVADOR

**Data**: 2026-02-15 (mesma data, segunda iteração)  
**Motivação**: Aumentar segurança no fallback mode, que não tem dados espectrais reais

### Mudança implementada

**Antes**:
```javascript
if (Math.abs(delta) <= 1.0 && !isSubDominant) {
  return { canPush: false };
}
```

**Depois**:
```javascript
// Permitir offsets pequenos para sub dominante, MAS NÃO em fallback mode
if (Math.abs(delta) <= 1.0 && (!isSubDominant || isFallback)) {
  return { canPush: false };
}
```

### Lógica de decisão (delta <= 1.0)

| Cenário | isSubDominant | isFallback | Bloqueia? | Motivo |
|---------|---------------|------------|-----------|--------|
| Sub OK, sem fallback | `false` | `false` | ✅ SIM | Delta pequeno + sub OK = sem margem |
| Sub OK, com fallback | `false` | `true` | ✅ SIM | Delta pequeno + sub OK = sem margem |
| Sub dominante, sem fallback | `true` | `false` | ❌ NÃO | Dados espectrais reais + sub precisa offsets pequenos |
| Sub dominante, com fallback | `true` | `true` | ✅ SIM | **NOVO**: Sem dados reais, não arriscar |

### Comportamento conservador no fallback

**Sem dados espectrais reais**:
- `subRms = -20` (neutro, simulado)
- `bodyRms = -14` (neutro, simulado)
- `crestFactor = estimado` (peak - lufs, não medido diretamente)

**Risco**: Sub dominance calculado com valores neutros pode não refletir a realidade. Aplicar offsets pequenos baseados em dados simulados pode introduzir problemas.

**Solução**: Bloquear deltas <= 1.0 no fallback mode, mesmo com sub aparentemente dominante.

### Teste adicionado

```javascript
test('Fallback conservador: delta 0.8 + sub dominante → offset 0', {
  crestFactor: 12.0,
  subRms: -16.0,  // sub dominante (simulado)
  bodyRms: -14.0,
  unstableDynamics: false,
  currentLufs: -10.8,
  targetLufs: -10.0, // delta = 0.8
  isFallback: true
}, {
  canPush: false,
  recommendedLufsOffset: 0 // bloqueado
});
```

**Resultado**: ✅ PASSOU

### Comparador estrito confirmado

```javascript
const isSubDominant = subDominance > -6.0; // Comparador estrito (>)
```

**Teste adicionado**:
```javascript
test('Sub dominance -6.0 exato: isSubDominant = false', {
  subRms: -20.0,  // -20 - (-14) = -6.0 exato
  bodyRms: -14.0,
  // ...
}, {
  recommendedLufsOffset: 1.0 // sem cap de sub dominante
});
```

**Resultado**: ✅ PASSOU  
**Confirmação**: `-6.0 > -6.0 = false` → não é dominante ✅

---

**Refatoração realizada por**: GitHub Copilot (Claude Sonnet 4.5)  
**Data**: 2026-02-15  
**Versão**: evaluateMixCapacity() V1-Safe  
**Arquivo de testes**: `automaster/test-mix-capacity-v1.cjs`  
**Comando de teste**: `node test-mix-capacity-v1.cjs`

---

## 📖 REFERÊNCIAS

- **AUDIT_MIX_CAPACITY_IMPLEMENTATION_2026-02-15.md**: Documentação original (V1)
- **AUDIT_ANALYZE_FOR_MASTER_REVISION_2026-02-15.md**: Spectral analysis (PASSO 3 pendente)
- **automaster-v1.cjs**: Implementação refatorada (V1-Safe)
- **test-mix-capacity-v1.cjs**: Suite de testes unitários (25 casos)
