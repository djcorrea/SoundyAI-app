# 🧪 TESTE MANUAL: VALIDAÇÃO DE SUGESTÕES

## 📋 PRÉ-REQUISITOS

- [x] Servidor backend rodando (Railway ou local)
- [x] Frontend servido (http://localhost:3000)
- [x] Redis configurado
- [x] Postgres configurado
- [ ] Console do navegador aberto (F12)
- [ ] Filtro de logs: `SUG-AUDIT`

---

## 🎯 TESTE 1: Modo Genre - Backend Gera Suggestions

### **Objetivo**
Verificar se suggestions geradas no backend chegam ao frontend intactas.

### **Passos**

1. **Upload de áudio com problemas óbvios**:
   - Arquivo: MP3/WAV com LUFS alto (ex: -8 dB)
   - Gênero: EDM
   - Modo: Genre

2. **Aguardar análise completa**

3. **Verificar logs no console** (filtro: `SUG-AUDIT`):

**✅ LOGS ESPERADOS**:
```javascript
// 1. Backend gerou suggestions
[AI-AUDIT][GENERATION] Generated 5 suggestions
[AI-AUDIT][GENERATION] Suggestion 1: LUFS Integrado está em -8.2 dB...

// 2. Worker salvou no Postgres
[AI-AUDIT][SAVE.before] ✅ finalJSON.suggestions contém 5 itens
[AI-AUDIT][SAVE.after] suggestionsLengthInDB: 5

// 3. API retornou para frontend
[AI-AUDIT][API.out] ✅ Suggestions sendo enviadas para frontend: 5
[AI-AUDIT][API.out] Sample: { type: 'loudness', message: '...' }

// 4. Frontend preservou
[SUG-AUDIT][CRITICAL] data.suggestions FROM BACKEND: { length: 5, isArray: true }
[SUG-AUDIT] normalizeBackendAnalysisData > ✅ 5 sugestões vindas do backend (preservadas)

// 5. Controller renderizou
[SUG-AUDIT] checkForAISuggestions > Seleção de fonte: { length: 5, source: 'suggestions (base)' }
[SUG-AUDIT] displayBaseSuggestions > render -> 5 sugestões base
[AI-SUGGESTIONS-RENDER] Cards renderizados: 5
```

### **Validação Visual**

- [ ] Modal exibe **5 cards** de sugestões
- [ ] Cada card mostra:
  - [ ] Categoria (LOUDNESS, MASTERING, EQ, etc.)
  - [ ] Problema
  - [ ] Ação
- [ ] Status: "5 sugestões disponíveis"

### **Critério de Sucesso**
✅ Logs mostram `length: 5` em TODAS as etapas  
✅ Modal renderiza 5 cards completos

---

## 🎯 TESTE 2: Modo Genre - Backend NÃO Gera (Fallback Frontend)

### **Objetivo**
Verificar se frontend gera 9-12 sugestões básicas quando backend retorna array vazio.

### **Passos**

1. **Upload de áudio com métricas perfeitas**:
   - Arquivo: MP3/WAV masterizado (LUFS -10.5, TP -1.0, DR 8.0)
   - Gênero: EDM
   - Modo: Genre

2. **Aguardar análise completa**

3. **Verificar logs no console**:

**✅ LOGS ESPERADOS**:
```javascript
// 1. Backend não gerou (métricas OK)
[AI-AUDIT][GENERATION] Generated 0 suggestions

// 2. Worker salvou array vazio
[AI-AUDIT][SAVE.before] ⚠️ finalJSON.suggestions está vazio ou undefined!
[AI-AUDIT][SAVE.after] suggestionsLengthInDB: 0

// 3. API retornou array vazio
[AI-AUDIT][API.out] contains suggestions? true len: 0

// 4. Frontend gerou fallback
[SUG-AUDIT][CRITICAL] data.suggestions FROM BACKEND: { length: 0 }
[SUG-AUDIT] normalizeBackendAnalysisData > Gerando sugestões básicas no frontend...
[SUG-AUDIT] 🔍 generateBasicSuggestions INÍCIO
[SUG-AUDIT] ✅ generateBasicSuggestions FIM: 12 sugestões geradas
[SUG-AUDIT] Sugestão 1/12: { type: 'loudness', message: '...' }
[SUG-AUDIT] Sugestão 2/12: { type: 'clipping', message: '...' }
// ... sugestões 3-12 ...

// 5. Controller renderizou fallback
[SUG-AUDIT] checkForAISuggestions > Seleção de fonte: { length: 12 }
[SUG-AUDIT] displayBaseSuggestions > render -> 12 sugestões base
```

### **Validação Visual**

- [ ] Modal exibe **9-12 cards** de sugestões
- [ ] Cards incluem todas as categorias:
  - [ ] LUFS Integrado
  - [ ] True Peak
  - [ ] Dynamic Range
  - [ ] LRA
  - [ ] Sub (20-60Hz)
  - [ ] Bass (60-150Hz)
  - [ ] Low-Mid (150-500Hz)
  - [ ] Mid (500Hz-2kHz)
  - [ ] High-Mid (2-5kHz)
  - [ ] Presence (5-10kHz)
  - [ ] Air (10-20kHz)
- [ ] Status: "12 sugestões disponíveis"

### **Critério de Sucesso**
✅ Logs mostram `Generated 0 suggestions` no backend  
✅ Logs mostram `12 sugestões geradas` no frontend  
✅ Modal renderiza 9-12 cards completos

---

## 🎯 TESTE 3: Modo Reference (A/B) - 2 Faixas

### **Objetivo**
Verificar se modo reference preserva suggestions de ambas as faixas e exibe deltas.

### **Passos**

1. **Upload faixa 1** (Referência):
   - Arquivo: MP3/WAV masterizado
   - Gênero: EDM
   - **Aguardar conclusão**

2. **Upload faixa 2** (User):
   - Arquivo: MP3/WAV a ser comparado
   - **Sistema detecta modo reference**

3. **Aguardar análise comparativa**

4. **Verificar logs no console**:

**✅ LOGS ESPERADOS**:
```javascript
// 1. Primeira faixa analisada
[AI-AUDIT][GENERATION] Generated 5 suggestions (faixa 1)
[AI-AUDIT][SAVE.before] ✅ finalJSON.suggestions contém 5 itens

// 2. Segunda faixa analisada
[AI-AUDIT][GENERATION] Generated 5 suggestions (faixa 2)
[AI-AUDIT][SAVE.before] ✅ finalJSON.suggestions contém 5 itens

// 3. Modo reference detectado
[SUG-AUDIT][REFERENCE] Dados recebidos: {
    userSuggestionsLength: 5,
    refSuggestionsLength: 5
}

// 4. analysisForSuggestions preparado
[SUG-AUDIT] reference deltas ready: true
[AUDIT-FIX] analysisForSuggestions preparado: {
    suggestionsLength: 5,
    mode: 'reference',
    hasReferenceComparison: true
}

// 5. Controller renderizou
[SUG-AUDIT] checkForAISuggestions > Seleção de fonte: { length: 5, mode: 'reference' }
[SUG-AUDIT] displayBaseSuggestions > render -> 5 sugestões base
```

### **Validação Visual**

- [ ] Modal exibe **5-10 cards** de sugestões
- [ ] Cada card mostra **deltas** quando aplicável:
  - [ ] "User: -12.5 dB | Ref: -10.2 dB | Δ: -2.3 dB"
- [ ] Status: "X sugestões disponíveis"
- [ ] Comparação A/B visível

### **Critério de Sucesso**
✅ Logs mostram `userSuggestionsLength: 5` e `refSuggestionsLength: 5`  
✅ Logs mostram `reference deltas ready: true`  
✅ Modal renderiza cards com deltas  
✅ Não há self-compare (jobIds diferentes)

---

## 🎯 TESTE 4: Enriquecimento com IA (ULTRA_V2)

### **Objetivo**
Verificar se IA enriquece suggestions sem perder a base.

### **Pré-requisito**
- [ ] API Key da IA configurada

### **Passos**

1. **Upload de áudio**:
   - Arquivo: MP3/WAV qualquer
   - Gênero: EDM
   - Modo: Genre

2. **Aguardar análise + enriquecimento**

3. **Verificar logs no console**:

**✅ LOGS ESPERADOS**:
```javascript
// 1. Base gerada
[SUG-AUDIT] normalizeBackendAnalysisData > ✅ 12 sugestões básicas geradas no frontend

// 2. Preservação pré-enriquecimento
[SUG-AUDIT] Preservando base antes de enriquecer: { originalSuggestionsLength: 12 }

// 3. Enriquecimento
[SUG-AUDIT] processWithAI > enrich in -> 12 sugestões base
🤖 Conectando à IA...
[SUG-AUDIT] processWithAI > enrich out -> 12 sugestões enriquecidas

// 4. Preservação pós-enriquecimento
[AI-GENERATION] ✅ Sugestões enriquecidas atribuídas: {
    aiSuggestionsLength: 12,
    originalSuggestionsLength: 12
}

// 5. Controller selecionou IA
[SUG-AUDIT] checkForAISuggestions > Seleção de fonte: {
    length: 12,
    source: 'aiSuggestions' (IA)
}

// 6. Renderização IA
[SUG-AUDIT] displayAISuggestions > render -> 12 sugestões AI
```

### **Validação Visual**

- [ ] Modal mostra "Conectando à IA..." (temporário)
- [ ] Modal exibe **12 cards enriquecidos**
- [ ] Cada card tem **blocos IA**:
  - [ ] 🚨 Problema
  - [ ] 🔍 Causa Provável
  - [ ] 🛠️ Solução Prática
  - [ ] 💡 Dica Extra
  - [ ] 🎛️ Plugin/Ferramenta
- [ ] Status: "IA processou 12 sugestões"

### **Critério de Sucesso**
✅ Logs mostram `originalSuggestionsLength: 12` (base preservada)  
✅ Logs mostram `aiSuggestionsLength: 12` (IA não perdeu)  
✅ Modal renderiza 12 cards enriquecidos  
✅ Todos os blocos IA visíveis

---

## 🚨 PROBLEMAS COMUNS E DIAGNÓSTICO

### **Problema 1: Modal mostra 0 sugestões**

**Logs a verificar**:
```javascript
[AI-AUDIT][API.out] ❌ CRÍTICO: Nenhuma suggestion no JSON retornado!
```

**Causa**: Backend não está gerando suggestions  
**Solução**: Verificar `generateSuggestionsFromMetrics()` no backend

---

### **Problema 2: Modal mostra apenas 2 sugestões**

**Logs a verificar**:
```javascript
[SUG-AUDIT] ✅ generateBasicSuggestions FIM: 12 sugestões geradas
[SUG-AUDIT] displayBaseSuggestions > render -> 2 sugestões base
```

**Causa**: Algo entre geração e renderização está cortando  
**Solução**: Verificar `checkForAISuggestions()` e `renderCompactPreview()`

---

### **Problema 3: Modo reference mostra self-compare**

**Logs a verificar**:
```javascript
[RENDER] ERRO CRÍTICO: Tentando comparar mesma música!
userJobId: abc-123
refJobId: abc-123
```

**Causa**: JobIds iguais (contaminação)  
**Solução**: Verificar `getCorrectJobId()` e `SoundyAI_Store`

---

### **Problema 4: IA não enriquece**

**Logs a verificar**:
```javascript
[AI-INTEGRATION] ⚠️ Nenhuma sugestão detectada
```

**Causa**: Base não chegou ao enriquecimento  
**Solução**: Verificar fluxo `processWithAI()` recebe array vazio

---

## ✅ CHECKLIST FINAL

Após todos os testes, validar:

- [ ] **Backend**: Gera 5-10 suggestions baseadas em métricas
- [ ] **Postgres**: Salva JSON com `suggestions[]`
- [ ] **API**: Retorna JSON com `suggestions[]`
- [ ] **Frontend**: Preserva suggestions do backend
- [ ] **Frontend**: Gera fallback se backend vazio
- [ ] **Modo reference**: Preserva suggestions de ambas faixas
- [ ] **Modal**: Renderiza 9-12 cards completos
- [ ] **IA**: Enriquece sem perder base
- [ ] **Logs**: Todos os `[SUG-AUDIT]` aparecem corretamente

---

**Documentação relacionada**:
- `AUDITORIA_SUGESTOES_9_12_RESTAURADAS.md` - Expansão de regras
- `AUDITORIA_SUGESTOES_FALTANTES_DIAGNOSTICO.md` - Diagnóstico do fluxo
- `AI-SUGGESTIONS-AUDIT.md` - Auditoria completa (Sessão 6)
