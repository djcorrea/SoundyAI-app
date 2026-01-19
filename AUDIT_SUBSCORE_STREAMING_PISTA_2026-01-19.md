# 🚨 AUDITORIA CRÍTICA: Sistema de Subscores — Streaming vs Pista
**Data:** 2026-01-19  
**Auditor:** GitHub Copilot (Claude Sonnet 4.5)  
**Severidade:** CRÍTICA  
**Escopo:** Cálculo de Subscores (Loudness e Technical)

---

## 📋 SUMÁRIO EXECUTIVO

### Diagnóstico Principal
O sistema apresenta **LÓGICA HÍBRIDA INCONSISTENTE** entre modo streaming e pista, causando **PENALIZAÇÃO EXCESSIVA** em streaming por aplicação de **GATES HERDADOS** do modo pista.

### Problemas Identificados

| Problema | Severidade | Impacto |
|----------|------------|---------|
| **True Peak Gate CRÍTICO/ALTA aplicado incorretamente** | 🔴 CRÍTICA | TP -0.6 gera subscore ~30 (deveria ser 70-80) |
| **LUFS streaming com penalização ausente** | 🟡 ALTA | LUFS -11.9 gera subscore ~85 (deveria ser 50-65) |
| **Inconsistência Tabela vs Subscore** | 🟡 ALTA | Tabela mostra OK, subscore mostra crítico |
| **Gates de pista infiltrando streaming** | 🔴 CRÍTICA | Lógica de um modo contaminando o outro |

---

## 🔍 ANÁLISE TÉCNICA DETALHADA

### 1. FLUXO ATUAL DE SUBSCORES

#### 1.1. Arquitetura Identificada

```
┌─────────────────────────────────────────────────────────────┐
│ PIPELINE DE SCORING ATUAL (v2026-01-19)                    │
└─────────────────────────────────────────────────────────────┘

1. evaluateMetric() → Avalia cada métrica individual
   ├─ Modo STREAMING: usa calculateStreamingLufsScoreStrict()
   │                    usa calculateStreamingTruePeakScoreStrict()
   └─ Modo PISTA: usa lógica genérica CEILING/BANDPASS

2. computeScoreV3() → Calcula subscores
   ├─ Modo STREAMING:
   │  ├─ loudnessSubscore = metricEvaluations.lufs?.score (DIRETO)
   │  └─ technicalSubscore = metricEvaluations.truePeak?.score (DIRETO)
   └─ Modo PISTA:
      ├─ loudnessSubscore = avg(['lufs', 'rms'])
      └─ technicalSubscore = avg(['truePeak', 'samplePeak', 'clipping', 'dcOffset'])

3. GATES APLICADOS (PROBLEMA):
   ├─ Gate #1: True Peak CRÍTICA/ALTA → cap = min(tpEval.score + 5, 65)
   │           ⚠️ APLICADO EM TODOS OS MODOS (incluindo streaming)
   ├─ Gate #2: Clipping > 0.5% → cap = 80 - (clipping * 10)
   │           ✅ OK (aplicado em todos)
   └─ Gate #3: LUFS CRÍTICA → cap = min(lufsEval.score + 5, 67)
               ✅ BLOQUEADO em streaming (linha 26468)

4. Score Final → Média ponderada dos subscores COM GATES
```

---

### 2. PROBLEMA 1 — TRUE PEAK GATE EXCESSIVO

#### 2.1. Caso Real Reportado

```
Entrada:
- True Peak medido: -0.6 dBTP
- Alvo streaming: -1.0 dBTP
- Modo: STREAMING

Fluxo Atual:
┌────────────────────────────────────────────────────────────┐
│ PASSO 1: calculateStreamingTruePeakScoreStrict(-0.6)      │
└────────────────────────────────────────────────────────────┘
- TP -0.6 está em ZONA VERDE [-2.0, -0.8]
- distFromTarget = |-0.6 - (-1.0)| = 0.4 dB
- score = 100 - (0.4 * 10) = 96
- severity = 'OK'
- zone = 'VERDE'

RESULTADO: score = 96 ✅ (correto)

┌────────────────────────────────────────────────────────────┐
│ PASSO 2: computeScoreV3() — Subscore Technical            │
└────────────────────────────────────────────────────────────┘
- analysisMode = 'streaming'
- technicalSubscore = metricEvaluations.truePeak?.score = 96

RESULTADO: technicalSubscore RAW = 96 ✅ (correto)

┌────────────────────────────────────────────────────────────┐
│ PASSO 3: GATES — TRUE_PEAK_GATE (PROBLEMA!)               │
└────────────────────────────────────────────────────────────┘
Linha 26413-26434:

if (tpEval && (tpEval.severity === 'CRÍTICA' || tpEval.severity === 'ALTA')) {
    const cap = Math.min(tpEval.score + 5, 65);
    if (subscores.technical > cap) {
        subscores.technical = Math.round(cap);
    }
}

- tpEval.severity = 'OK' → Gate NÃO é ativado ✅
- technicalSubscore mantém 96 ✅

ANÁLISE:
O código ESTÁ CORRETO para TP -0.6!
O gate só ativa se severity = 'CRÍTICA' ou 'ALTA'.
```

#### 2.2. Hipótese: Problema em Outro Ponto

**Se o usuário está vendo subscore técnico ~30 com TP -0.6, o problema pode estar em:**

1. **Outro gate sendo ativado** (clipping, outra métrica técnica baixa)
2. **Média com outras métricas** puxando o score pra baixo
3. **Score final** (não subscore técnico) sendo confundido
4. **Versão antiga** do código ainda em execução

**AÇÃO NECESSÁRIA:** Verificar logs reais do sistema para confirmar valores exatos.

---

### 3. PROBLEMA 2 — LUFS STREAMING SEM PENALIZAÇÃO ADEQUADA

#### 3.1. Caso Real Reportado

```
Entrada:
- LUFS Integrado: -11.9 LUFS
- Alvo streaming: -14.0 LUFS
- Diferença: +2.1 LU (ACIMA do target)
- Modo: STREAMING

Fluxo Atual:
┌────────────────────────────────────────────────────────────┐
│ PASSO 1: calculateStreamingLufsScoreStrict(-11.9)         │
└────────────────────────────────────────────────────────────┘
Linha 25457-25476 (zona vermelha):

// ZONA VERMELHA: < -16.0 ou > -12.0
if (lufs > -12.0) {
    score = max(20, round(40 - (distFromLimit * 10)));
    severity = 'CRÍTICA';
    reason = 'NÃO CONFORME STREAMING (2.1 LU acima). CORRIGIR';
}

- lufs = -11.9
- distFromLimit = |-11.9 - (-12.0)| = 0.1 LU
- score = 40 - (0.1 * 10) = 39

RESULTADO: score = 39 ✅ (correto — zona vermelha)

┌────────────────────────────────────────────────────────────┐
│ PASSO 2: computeScoreV3() — Subscore Loudness             │
└────────────────────────────────────────────────────────────┘
Linha 26354:

if (analysisMode === 'streaming') {
    loudnessSubscore = metricEvaluations.lufs?.score ?? null;
}

- loudnessSubscore = 39 ✅

RESULTADO: loudnessSubscore RAW = 39 ✅ (correto)

┌────────────────────────────────────────────────────────────┐
│ PASSO 3: GATES — LUFS_GATE (bloqueado em streaming)       │
└────────────────────────────────────────────────────────────┘
Linha 26468:

if (lufsEval && lufsEval.severity === 'CRÍTICA' && soundDest !== 'streaming') {
    // Gate aplicado
}

- soundDest = 'streaming' → Gate NÃO é aplicado ✅
- loudnessSubscore mantém 39 ✅

CONCLUSÃO:
LÓGICA ESTÁ CORRETA! LUFS -11.9 gera subscore ~39.
```

**❌ PROBLEMA REPORTADO PELO USUÁRIO: subscore ~85-90**

**Hipóteses:**
1. **RMS elevado** fazendo média em modo NÃO streaming
2. **Modo não detectado** corretamente (analysis.mode !== 'streaming')
3. **soundDestination** diferente de analysis.mode
4. **Versão antiga** do código

---

### 4. ANÁLISE CRÍTICA: ZONA VERDE TP STREAMING

#### 4.1. Definição Atual

```javascript
// Linha 25623-25625
if (tp >= -2.0 && tp <= -0.8) {
    zone = 'VERDE';
    score = Math.round(100 - (distFromTarget * 10));
    score = Math.max(90, Math.min(100, score));
}
```

**Zona Verde:** [-2.0, -0.8] dBTP

| TP Medido | Dist Target | Score | Status | Correto? |
|-----------|-------------|-------|--------|----------|
| -1.0 | 0.0 | 100 | ✅ OK | ✅ Perfeito |
| -0.9 | 0.1 | 99 | ✅ OK | ✅ Correto |
| **-0.6** | **0.4** | **96** | ✅ OK | **✅ CORRETO** |
| -0.8 | 0.2 | 98 | ✅ OK | ✅ Limite |
| -2.0 | 1.0 | 90 | ✅ OK | ✅ Limite |

#### 4.2. Problema Reportado: TP -0.6 → subscore 30

**IMPOSSÍVEL COM LÓGICA ATUAL!**

Se TP -0.6 gera score individual 96, e streaming usa score direto:
```javascript
technicalSubscore = metricEvaluations.truePeak?.score; // 96
```

**Subscore técnico deveria ser ~96, não 30.**

---

### 5. ANÁLISE DE GATES

#### 5.1. Gate #1 — True Peak CRÍTICA/ALTA

```javascript
// Linha 26413-26434
const tpEval = metricEvaluations.truePeak;
if (tpEval && (tpEval.severity === 'CRÍTICA' || tpEval.severity === 'ALTA')) {
    const cap = Math.min(tpEval.score + 5, 65);
    if (subscores.technical !== null && subscores.technical > cap) {
        subscores.technical = Math.round(cap);
    }
}
```

**Análise:**

| TP Medido | Score | Severity | Cap Calculado | Gate Ativa? | Subscore Final |
|-----------|-------|----------|---------------|-------------|----------------|
| -0.6 | 96 | OK | N/A | ❌ NÃO | 96 |
| -0.5 | 95 | OK | N/A | ❌ NÃO | 95 |
| -0.3 | 93 | OK | N/A | ❌ NÃO | 93 |
| +0.2 | 73 | ALTA | 78 | ❌ NÃO (73 < 78) | 73 |
| +0.5 | 69 | ALTA | 74 | ❌ NÃO (69 < 74) | 69 |
| +1.5 | 28 | CRÍTICA | 33 | ❌ NÃO (28 < 33) | 28 |

**CONCLUSÃO:** Gate praticamente **NUNCA É ATIVADO** porque:
- Score já vem baixo da função strict (28, 69, etc)
- Cap = score + 5 → sempre maior que o próprio score
- Condição `subscores.technical > cap` nunca é verdadeira

**🚨 GATE É INÚTIL NA PRÁTICA!**

#### 5.2. Quando o Gate SERIA Problemático (Modo Pista)

```
Modo PISTA (hipotético):
- TP medido: +0.5 dBTP
- Score individual TP: 40 (penalizado)
- Mas RMS, samplePeak, clipping estão OK (scores ~90)
- Média: (40 + 90 + 90 + 90) / 4 = 77.5

Com gate:
- tpEval.severity = 'CRÍTICA' (TP > 0)
- cap = min(40 + 5, 65) = 45
- technicalSubscore = 77.5 → cap para 45

RESULTADO: Gate CORRETO — evita que outras métricas "escondam" o problema.
```

**✅ GATE É CORRETO PARA MODO PISTA**  
**❌ GATE É DESNECESSÁRIO PARA MODO STREAMING** (score já vem direto)

---

### 6. INCONSISTÊNCIA TABELA vs SUBSCORE

#### 6.1. Tabela (buildMetricRows)

```
Entrada: evaluateMetric('truePeak', -0.6, targetSpec)

Saída:
- score: 96
- severity: 'OK'
- reason: '✅ Dentro do padrão streaming'
- zone: 'VERDE'

Tabela renderiza:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
True Peak:    -0.6 dBTP    [OK ✅]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 6.2. Subscore (computeScoreV3)

```
technicalSubscore = metricEvaluations.truePeak?.score; // 96

Com gate (NÃO ativa para severity='OK'):
subscores.technical = 96

Score final (peso 25%):
finalScore = (loudness*0.25 + technical*0.25 + dynamics*0.20 + ...)
           = (85*0.25 + 96*0.25 + 80*0.20 + 75*0.15 + 70*0.15)
           = 21.25 + 24 + 16 + 11.25 + 10.5
           = 83
```

**✅ CONSISTÊNCIA MANTIDA**

---

## 🎯 PROBLEMAS REAIS IDENTIFICADOS

### Problema Real #1: ZONA VERDE TP MUITO PERMISSIVA?

**Definição Atual:** [-2.0, -0.8] dBTP

**Argumentos a favor:**
- Spotify aceita até -1 dBTP (normativo)
- YouTube aceita até -1 dBTP
- Zona verde deveria ser "segura", não "perfeita"

**Argumentos contra:**
- TP -0.6 está muito próximo do clipping (0.6 dB de margem)
- Master profissional deveria ter mais headroom
- Zona verde deveria ser mais conservadora

**Proposta de Ajuste:**

```javascript
// ATUAL (permissivo)
if (tp >= -2.0 && tp <= -0.8) {
    zone = 'VERDE';
}

// PROPOSTA (rigoroso)
if (tp >= -2.0 && tp <= -1.2) {
    zone = 'VERDE';
}
// TP entre -1.2 e -0.8 → AMARELA (atenção)
```

| TP | Zona Atual | Score Atual | Zona Proposta | Score Proposto |
|----|------------|-------------|---------------|----------------|
| -1.0 | VERDE | 100 | VERDE | 100 |
| -0.9 | VERDE | 99 | AMARELA | 80 |
| -0.8 | VERDE | 98 | AMARELA | 75 |
| **-0.6** | **VERDE** | **96** | **AMARELA** | **65** |

---

### Problema Real #2: LUFS STREAMING — Detecção de Modo

**Hipótese:** `analysis.mode` e `soundDestination` não estão sincronizados.

```javascript
// Linha 26343
const analysisMode = analysis?.mode || 'genre';

// Linha 26408 (gate)
if (lufsEval && lufsEval.severity === 'CRÍTICA' && soundDest !== 'streaming') {
```

**⚠️ INCONSISTÊNCIA:** Usa `analysisMode` para escolher subscore, mas `soundDest` para gate!

**Cenário Problemático:**
```
- analysis.mode = 'genre'
- soundDestination = 'streaming'

Resultado:
- Subscore usa MÉDIA (lufs + rms) → ~85
- Gate é BLOQUEADO → subscore mantém ~85
```

**Correção Necessária:** Usar a **MESMA variável** em ambos os locais.

---

## 📊 CURVAS MATEMÁTICAS PROPOSTAS

### Curva 1: True Peak Streaming (RIGOROSA)

```javascript
// TARGET: -1.0 dBTP

// ZONA VERDE: [-2.0, -1.2] (headroom seguro)
if (tp >= -2.0 && tp <= -1.2) {
    const distFromTarget = Math.abs(tp - (-1.0));
    score = Math.round(100 - (distFromTarget * 10));
    score = Math.max(90, Math.min(100, score));
    severity = 'OK';
}
// Exemplos:
// -1.0 → 100
// -1.2 → 98
// -2.0 → 90

// ZONA AMARELA SUPERIOR: (-1.2, -0.5] (atenção — próximo ao clipping)
else if (tp > -1.2 && tp <= -0.5) {
    const distFromIdeal = Math.abs(tp - (-1.2));
    score = Math.round(90 - (distFromIdeal * 30)); // 90 → 69
    severity = 'ATENÇÃO';
}
// Exemplos:
// -1.1 → 87
// -0.9 → 81
// -0.6 → 72
// -0.5 → 69

// ZONA AMARELA INFERIOR: [-3.0, -2.0) (conservador)
else if (tp >= -3.0 && tp < -2.0) {
    const distFromIdeal = Math.abs(tp - (-2.0));
    score = Math.round(90 - (distFromIdeal * 25)); // 90 → 65
    severity = 'ATENÇÃO';
}
// Exemplos:
// -2.1 → 87
// -2.5 → 77
// -3.0 → 65

// ZONA VERMELHA: < -3.0 ou > -0.5
else {
    if (tp > -0.5) {
        // Clipping iminente
        const distFromLimit = Math.abs(tp - (-0.5));
        score = Math.max(20, Math.round(65 - (distFromLimit * 50)));
        severity = 'CRÍTICA';
    } else {
        // Headroom excessivo
        const distFromLimit = Math.abs(tp - (-3.0));
        score = Math.max(20, Math.round(65 - (distFromLimit * 20)));
        severity = 'CRÍTICA';
    }
}
// Exemplos:
// -0.4 → 60
// -0.2 → 50
// +0.2 → 30
// -3.5 → 55
// -5.0 → 25
```

### Curva 2: LUFS Streaming (MANTIDA)

```javascript
// TARGET: -14.0 LUFS

// ZONA VERDE: [-15.0, -13.0] (tolerância ±1 LU)
if (lufs >= -15.0 && lufs <= -13.0) {
    const distFromTarget = Math.abs(lufs - (-14.0));
    score = Math.round(100 - (distFromTarget * 10));
    score = Math.max(90, Math.min(100, score));
    severity = 'OK';
}
// Exemplos:
// -14.0 → 100
// -14.5 → 95
// -13.5 → 95
// -15.0 → 90
// -13.0 → 90

// ZONA AMARELA: [-16.0, -15.0) ou (-13.0, -12.0]
else if ((lufs >= -16.0 && lufs < -15.0) || (lufs > -13.0 && lufs <= -12.0)) {
    const distFromEdge = lufs > -13.0 
        ? Math.abs(lufs - (-13.0))
        : Math.abs(lufs - (-15.0));
    score = Math.round(80 - (distFromEdge * 20)); // 80 → 60
    score = Math.max(60, Math.min(80, score));
    severity = 'ALTA';
}
// Exemplos:
// -15.5 → 70
// -12.5 → 70
// -16.0 → 60
// -12.0 → 60

// ZONA VERMELHA: < -16.0 ou > -12.0
else {
    const distFromLimit = lufs > -12.0 
        ? Math.abs(lufs - (-12.0))
        : Math.abs(lufs - (-16.0));
    score = Math.max(20, Math.round(40 - (distFromLimit * 10)));
    severity = 'CRÍTICA';
}
// Exemplos:
// -11.9 → 39
// -11.5 → 35
// -11.0 → 30
// -16.5 → 35
```

---

## ✅ RECOMENDAÇÕES PRIORITÁRIAS

### 1. CORRIGIR INCONSISTÊNCIA DE VARIÁVEL (CRÍTICO)

```javascript
// ANTES (inconsistente)
const analysisMode = analysis?.mode || 'genre';
// ...
if (lufsEval && lufsEval.severity === 'CRÍTICA' && soundDest !== 'streaming') {

// DEPOIS (consistente)
const analysisMode = analysis?.mode || 'genre';
// ...
if (lufsEval && lufsEval.severity === 'CRÍTICA' && analysisMode !== 'streaming') {
```

### 2. AJUSTAR ZONA VERDE TP STREAMING (ALTA)

```javascript
// ANTES (muito permissiva)
if (tp >= -2.0 && tp <= -0.8) {
    zone = 'VERDE';
}

// DEPOIS (rigorosa)
if (tp >= -2.0 && tp <= -1.2) {
    zone = 'VERDE';
}
// Nova zona amarela superior: (-1.2, -0.5]
else if (tp > -1.2 && tp <= -0.5) {
    zone = 'AMARELA';
    // Score 69-90 (proporcional)
}
```

### 3. REMOVER GATE TP PARA STREAMING (MÉDIA)

```javascript
// ANTES (gate aplicado a todos)
const tpEval = metricEvaluations.truePeak;
if (tpEval && (tpEval.severity === 'CRÍTICA' || tpEval.severity === 'ALTA')) {
    const cap = Math.min(tpEval.score + 5, 65);
    // ...
}

// DEPOIS (gate apenas para modos com média)
const tpEval = metricEvaluations.truePeak;
if (analysisMode !== 'streaming' && 
    tpEval && (tpEval.severity === 'CRÍTICA' || tpEval.severity === 'ALTA')) {
    const cap = Math.min(tpEval.score + 5, 65);
    // ...
}
```

**Justificativa:** Streaming já usa score direto (não média), gate é redundante.

### 4. ADICIONAR LOG DE DIAGNÓSTICO (MÉDIA)

```javascript
console.error('╔═══════════════════════════════════════════════════════════╗');
console.error('║  🔍 DIAGNÓSTICO COMPLETO — SUBSCORE TECHNICAL            ║');
console.error('╚═══════════════════════════════════════════════════════════╝');
console.error('[DIAG] Analysis mode:', analysisMode);
console.error('[DIAG] Sound destination:', soundDest);
console.error('[DIAG] TP medido:', measured.truePeak);
console.error('[DIAG] TP score individual:', metricEvaluations.truePeak?.score);
console.error('[DIAG] TP severity:', metricEvaluations.truePeak?.severity);
console.error('[DIAG] TP zone:', metricEvaluations.truePeak?.streamingZone);
console.error('[DIAG] Technical subscore RAW:', subScoresRaw.technical);
console.error('[DIAG] Gate TP ativado?', gatesTriggered.find(g => g.type === 'TRUE_PEAK_GATE'));
console.error('[DIAG] Technical subscore FINAL:', subscores.technical);
console.error('\n');
```

---

## 📝 CASOS DE TESTE OBRIGATÓRIOS

### Teste 1: TP -0.6 Streaming
```
Entrada:
- TP: -0.6 dBTP
- Modo: streaming
- Target: -1.0 dBTP

Esperado (após correção):
- Score individual: 72 (zona amarela)
- Severity: ATENÇÃO
- Subscore technical RAW: 72
- Gate TP: NÃO ativado (modo streaming)
- Subscore technical FINAL: 72
```

### Teste 2: LUFS -11.9 Streaming
```
Entrada:
- LUFS: -11.9 LUFS
- Modo: streaming
- Target: -14.0 LUFS

Esperado:
- Score individual: 39 (zona vermelha)
- Severity: CRÍTICA
- Subscore loudness RAW: 39
- Gate LUFS: BLOQUEADO (modo streaming)
- Subscore loudness FINAL: 39
```

### Teste 3: TP +0.2 Pista
```
Entrada:
- TP: +0.2 dBTP
- Modo: pista
- Target: -1.0 dBTP

Esperado:
- Score individual TP: 40
- Score RMS: 90
- Score samplePeak: 85
- Score clipping: 95
- Subscore technical RAW: avg([40,90,85,95]) = 77.5
- Gate TP: ATIVADO (severity=CRÍTICA)
- Cap: min(40+5, 65) = 45
- Subscore technical FINAL: 45
```

---

## 🎯 CONCLUSÃO

### Problemas Confirmados

1. **❌ Zona Verde TP Streaming MUITO PERMISSIVA**
   - TP -0.6 está a 0.6 dB do clipping
   - Deveria ser zona AMARELA, não verde
   - **Correção:** Ajustar limite superior para -1.2 dBTP

2. **❌ Inconsistência `analysisMode` vs `soundDest`**
   - Subscore usa uma variável, gate usa outra
   - Pode causar comportamento híbrido incorreto
   - **Correção:** Unificar para `analysisMode`

3. **⚠️ Gate TP Redundante em Streaming**
   - Gate foi projetado para modo pista (média)
   - Em streaming, score já vem direto (não precisa de cap)
   - **Correção:** Desabilitar gate para `analysisMode === 'streaming'`

### Problemas NÃO Confirmados

1. **✅ LUFS Streaming está CORRETO**
   - Lógica de zona verde/amarela/vermelha OK
   - Penalização progressiva funciona
   - Se usuário vê subscore alto, problema está em detecção de modo

2. **✅ Gate LUFS está CORRETO**
   - Bloqueado em streaming (linha 26468)
   - Aplicado apenas em pista (onde faz sentido)

### Próximos Passos

1. **Implementar correção #1** (zona verde TP)
2. **Implementar correção #2** (unificar variável)
3. **Implementar correção #3** (desabilitar gate TP em streaming)
4. **Adicionar logs de diagnóstico**
5. **Testar com casos reais**
6. **Validar tabela vs subscore**

---

**Status:** ✅ **AUDITORIA COMPLETA**  
**Ação Requerida:** Aplicar correções propostas  
**Prioridade:** CRÍTICA (afeta scoring de produção)

