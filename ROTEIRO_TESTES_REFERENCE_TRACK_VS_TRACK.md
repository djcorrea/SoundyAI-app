# 🧪 ROTEIRO DE TESTES: Modo Reference Track vs Track

**Objetivo**: Validar que modo reference agora compara Track1 vs Track2 (não gênero)  
**Status**: ⏳ Aguardando execução  
**Deploy**: Automático no Railway

---

## ✅ PRÉ-REQUISITOS

- [ ] Deploy Railway concluído
- [ ] Duas faixas de teste prontas (Track1.wav e Track2.wav)
- [ ] Console do navegador aberto (F12) para verificar logs
- [ ] Ambiente: https://soundyai-app-production.up.railway.app

---

## 🎯 TESTE 1: Modo Gênero (Regressão - Garantir que não quebrou)

### Passos:
1. Abrir aplicação
2. Clicar em "Analisar Áudio"
3. Selecionar modo: **"Por Gênero"**
4. Escolher gênero: **"Trap"**
5. Fazer upload de `TestTrack.wav`
6. Aguardar análise completar

### Validação:
```javascript
// Console deve mostrar:
🎵 [RENDER-REF] MODO GÊNERO

// Tabela deve ter título:
"Comparação com Padrão Trap" (ou gênero selecionado)

// Coluna "Valor Alvo" deve mostrar:
Targets fixos do JSON de gênero (ex: -8.3 LUFS para Trap)
```

### Checklist:
- [ ] Log mostra "[RENDER-REF] MODO GÊNERO"
- [ ] Tabela exibe padrões do gênero selecionado
- [ ] Sugestões mencionam o gênero escolhido
- [ ] Score calculado corretamente

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 🎯 TESTE 2: Modo Referência - Upload da 1ª Faixa

### Passos:
1. Abrir aplicação
2. Clicar em "Analisar Áudio"
3. Selecionar modo: **"Por Referência"**
4. Fazer upload de `Track1.wav`
5. Aguardar análise completar

### Validação:
```javascript
// Console deve mostrar:
✅ [COMPARE-MODE] Primeira faixa salva: { 
    jobId: "uuid-xxxx", 
    score: XX, 
    lufs: -XX.X 
}
🎯 Abrindo modal secundário para música de referência

// Modal secundário deve abrir solicitando 2ª faixa
```

### Checklist:
- [ ] Análise da Track1 completou com sucesso
- [ ] Log confirma "Primeira faixa salva"
- [ ] `window.referenceAnalysisData` está populado (verificar no console: `console.log(window.referenceAnalysisData)`)
- [ ] Modal secundário abriu automaticamente
- [ ] Score da Track1 foi exibido

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 🎯 TESTE 3: Modo Referência - Upload da 2ª Faixa (CRÍTICO)

### Passos:
1. No modal secundário (ainda aberto), fazer upload de `Track2.wav`
2. Aguardar análise completar
3. **Verificar logs no console**
4. **Verificar tabela de comparação**

### Validação - Logs Esperados:
```javascript
🎯 [COMPARE-MODE] Comparando segunda faixa com primeira faixa (não com gênero)
📊 [COMPARE-MODE] Primeira faixa: { score: XX, lufs: -XX.X, ... }
📊 [COMPARE-MODE] Segunda faixa: { score: XX, lufs: -XX.X, ... }
✅ [COMPARE-MODE] Estrutura referenceComparisonMetrics criada: {...}
🎯 [TRACK-COMPARE] Renderizando tabela comparativa entre faixas
✅ [TRACK-COMPARE] Tabela comparativa renderizada com sucesso

// E então:
✅ [SCORES] Usando referenceComparisonMetrics para calcular scores (comparação entre faixas)
✅ [RENDER-REF] Sobrescrevendo com referenceComparisonMetrics
📊 [RENDER-REF] Target (2ª faixa): { lufs: -XX.X, peak: -X.X, dr: X.X }
📊 [RENDER-REF] User (1ª faixa): { lufs: -XX.X, peak: -X.X, dr: X.X }
✅ [SUGGESTIONS] Usando referenceComparisonMetrics para sugestões
📊 [SUGGESTIONS] Target metrics (2ª faixa): { lufs: -XX.X, peak: -X.X, dr: X.X }
```

### Validação - Tabela de Comparação:
```
┌──────────────────────┬────────────────┬──────────────────┬─────────────┬────────────┐
│ Métrica              │ Faixa 2 (Atual)│ Faixa 1 (Ref)    │ Diferença   │ Status     │
├──────────────────────┼────────────────┼──────────────────┼─────────────┼────────────┤
│ Loudness (LUFS)      │ [Valor Track2] │ [Valor Track1]   │ [%]         │ ✅/⚠️/❌   │
│ True Peak (dBTP)     │ [Valor Track2] │ [Valor Track1]   │ [%]         │ ✅/⚠️/❌   │
│ Dynamic Range (LU)   │ [Valor Track2] │ [Valor Track1]   │ [%]         │ ✅/⚠️/❌   │
│ ...                  │ ...            │ ...              │ ...         │ ...        │
└──────────────────────┴────────────────┴──────────────────┴─────────────┴────────────┘

HEADER CARD:
🎵 COMPARAÇÃO ENTRE FAIXAS
┌─────────────────────────────────────────┐
│ FAIXA DE REFERÊNCIA (1ª)                │
│ Track1.wav                              │
│ Score: XX                               │
├─────────────────────────────────────────┤
│ FAIXA ATUAL (2ª)                        │
│ Track2.wav                              │
│ Score: YY (diferença)                   │
└─────────────────────────────────────────┘
```

### Checklist - Logs:
- [ ] Log: "Comparando segunda faixa com primeira faixa (não com gênero)"
- [ ] Log: "Estrutura referenceComparisonMetrics criada"
- [ ] Log: "Usando referenceComparisonMetrics para calcular scores"
- [ ] Log: "Sobrescrevendo com referenceComparisonMetrics"
- [ ] Log: "Target (2ª faixa)" mostra métricas da Track2
- [ ] Log: "User (1ª faixa)" mostra métricas da Track1

### Checklist - Tabela:
- [ ] Título: "🎵 COMPARAÇÃO ENTRE FAIXAS"
- [ ] Header card mostra ambos os nomes: Track1.wav e Track2.wav
- [ ] Coluna "Faixa 1 (Ref)" mostra valores da Track1 (1ª música)
- [ ] Coluna "Faixa 2 (Atual)" mostra valores da Track2 (2ª música)
- [ ] Coluna "Diferença" mostra percentual calculado
- [ ] Coluna "Status" mostra ✅/⚠️/❌ conforme tolerância
- [ ] **NÃO** mostra targets de gênero (ex: "-8.3 LUFS" do Trap)

### Checklist - Métricas:
- [ ] Loudness (LUFS) comparado
- [ ] True Peak (dBTP) comparado
- [ ] Dynamic Range (LU) comparado
- [ ] LRA (LU) comparado
- [ ] Stereo Correlation comparado
- [ ] Spectral Centroid (Hz) comparado
- [ ] Bandas espectrais comparadas (Sub, Bass, Low-Mid, Mid, High-Mid, Presence, Air)

### Checklist - Sugestões:
- [ ] Sugestões mencionam "referência" (não "gênero")
- [ ] Exemplo: "Sua faixa está X LUFS abaixo da referência"
- [ ] Exemplo: "O sub-bass está X% acima da referência"
- [ ] **NÃO** menciona gêneros (Trap, Funk, etc.)

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 🎯 TESTE 4: Verificar Estrutura `window.latestAnalysis`

### Passos:
1. Após Test 3 completar, abrir console
2. Executar: `console.log(window.latestAnalysis)`

### Validação:
```javascript
{
  mode: "comparison",
  reference: {
    // Dados completos da Track1 (1ª faixa)
    score: XX,
    technicalData: {
      lufsIntegrated: -XX.X,
      truePeakDbtp: -X.X,
      dynamicRange: X.X,
      // ... etc
    }
  },
  current: {
    // Dados completos da Track2 (2ª faixa)
    score: YY,
    technicalData: {
      lufsIntegrated: -YY.Y,
      truePeakDbtp: -Y.Y,
      dynamicRange: Y.Y,
      // ... etc
    }
  },
  scores: { ... }
}
```

### Checklist:
- [ ] `window.latestAnalysis.mode === "comparison"`
- [ ] `window.latestAnalysis.reference` contém Track1
- [ ] `window.latestAnalysis.current` contém Track2
- [ ] Ambos têm propriedade `technicalData` completa

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 🎯 TESTE 5: Limpeza de Estado (Verificar sem vazamento)

### Passos:
1. Após Test 4, no console, executar:
```javascript
console.log('referenceJobId:', window.lastReferenceJobId);
console.log('referenceAnalysisData:', window.referenceAnalysisData);
```

2. Fazer nova análise (modo gênero ou referência)

### Validação:
```javascript
// Após exibição da comparação:
window.lastReferenceJobId === null
window.referenceAnalysisData === null

// referenceComparisonMetrics (variável interna) deve estar null
// (não é acessível externamente, mas logs devem confirmar limpeza)
```

### Checklist:
- [ ] `window.lastReferenceJobId` foi limpo (null)
- [ ] `window.referenceAnalysisData` foi limpo (null)
- [ ] Log confirma: "🧹 [CLEANUP] referenceComparisonMetrics limpo"
- [ ] Nova análise não é afetada por estado anterior

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 🎯 TESTE 6: Sequência Completa (End-to-End)

### Passos:
1. Análise por **gênero** (TrackA.wav - Trap)
2. Nova análise por **referência** (Track1.wav + Track2.wav)
3. Nova análise por **gênero** (TrackB.wav - Eletrofunk)

### Validação:
- [ ] Análise 1 (gênero Trap): Usa targets de Trap
- [ ] Análise 2 (referência): Compara Track1 vs Track2
- [ ] Análise 3 (gênero Eletrofunk): Usa targets de Eletrofunk (não Track2)

### Checklist:
- [ ] Cada análise é independente
- [ ] Modo referência não "vaza" para modo gênero
- [ ] Modo gênero não afeta próxima referência
- [ ] Limpeza de estado funciona entre análises

**Resultado**: ⬜ PASS / ⬜ FAIL

---

## 📊 CRITÉRIOS DE SUCESSO

Para considerar a correção **validada**, todos os testes devem passar:

| Teste | Descrição | Status |
|-------|-----------|--------|
| T1 | Modo gênero (regressão) | ⬜ |
| T2 | Upload 1ª faixa | ⬜ |
| T3 | Upload 2ª faixa (crítico) | ⬜ |
| T4 | Estrutura window.latestAnalysis | ⬜ |
| T5 | Limpeza de estado | ⬜ |
| T6 | Sequência end-to-end | ⬜ |

**Status Geral**: ⬜ APROVADO / ⬜ REPROVADO

---

## 🐛 TROUBLESHOOTING

### ❌ "Tabela ainda mostra targets de gênero"

**Sintoma**: Coluna "Valor Alvo" mostra "-8.3 LUFS" (target de gênero)

**Debug**:
```javascript
// No console, após upload da 2ª faixa:
console.log('referenceComparisonMetrics:', referenceComparisonMetrics);
// Deve mostrar objeto com user/reference, não null
```

**Possível causa**:
- `referenceComparisonMetrics` não foi criado
- Condição `isSecondTrack` falhou

**Solução**:
- Verificar logs: "Estrutura referenceComparisonMetrics criada"
- Verificar se `window.__REFERENCE_JOB_ID__` foi setado na 1ª faixa

---

### ❌ "Log mostra 'MODO GÊNERO' em modo referência"

**Sintoma**: Log `🎵 [RENDER-REF] MODO GÊNERO` aparece

**Debug**:
```javascript
console.log('mode:', currentAnalysisMode);
console.log('isSecondTrack:', window.__REFERENCE_JOB_ID__ !== null);
console.log('referenceAnalysisData:', window.referenceAnalysisData);
```

**Possível causa**:
- Primeira faixa não foi salva corretamente
- Modal secundário não foi aberto

**Solução**:
- Verificar log: "Primeira faixa salva"
- Verificar se modal secundário apareceu

---

### ❌ "Sugestões mencionam gênero"

**Sintoma**: Sugestões dizem "aproximar do padrão Trap"

**Debug**:
```javascript
console.log('__activeRefData:', __activeRefData);
// Deve ter sido sobrescrito com targetMetrics da Track2
```

**Possível causa**:
- `updateReferenceSuggestions()` não detectou `referenceComparisonMetrics`

**Solução**:
- Verificar log: "Usando referenceComparisonMetrics para sugestões"

---

## 📸 EVIDÊNCIAS REQUERIDAS

Após testes, capturar:

1. **Screenshot da tabela de comparação** (Test 3)
   - Deve mostrar Track1 vs Track2
   - Header com ambos os nomes de arquivo

2. **Screenshot dos logs do console** (Test 3)
   - Logs completos desde "Comparando segunda faixa..."
   - Até "Usando referenceComparisonMetrics para sugestões"

3. **Screenshot do window.latestAnalysis** (Test 4)
   - Console: `console.log(window.latestAnalysis)`
   - Deve mostrar mode: "comparison"

4. **Vídeo do fluxo completo** (opcional)
   - Upload Track1 → Modal abre → Upload Track2 → Tabela aparece

---

## ✅ APROVAÇÃO FINAL

**Testado por**: _________________  
**Data**: ___ / ___ / 2025  
**Ambiente**: Production / Staging  

**Resultado**:
- [ ] ✅ APROVADO - Todos os testes passaram
- [ ] ⚠️ APROVADO COM RESSALVAS - Descrever:
- [ ] ❌ REPROVADO - Retornar para desenvolvimento

**Observações**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Assinatura**: _________________

---

**Última atualização**: 01/11/2025
