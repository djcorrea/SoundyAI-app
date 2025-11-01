# 🧪 ROTEIRO DE TESTES - Modo Reference: UserTrack vs ReferenceTrack

## 🎯 Objetivo
Validar que o sistema compara corretamente a música do usuário (2ª upload) contra a faixa de referência (1ª upload), exibindo valores reais na tabela em vez de targets de gênero.

---

## 📋 PRÉ-REQUISITOS

### 1. Executar Migração SQL no Railway
```bash
# Conectar ao PostgreSQL do Railway
railway connect postgres

# Executar migração
\i migrations/001_add_reference_for_column.sql

# Verificar coluna criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'reference_for';

# Resultado esperado:
#  column_name   | data_type | is_nullable 
# ---------------+-----------+-------------
#  reference_for | uuid      | YES
```

### 2. Confirmar Deploy no Railway
- ✅ Build completo sem erros
- ✅ Worker iniciado: "Worker pronto para processar jobs"
- ✅ API respondendo: GET /api/health

---

## 🧪 TESTE 1: Modo Genre (Regressão)

**Objetivo**: Garantir que modo genre ainda funciona (comportamento original preservado)

### Passos
1. Abrir aplicação: `https://soundyai.up.railway.app`
2. Selecionar modo: **"Por Gênero"**
3. Escolher gênero: **Trance**
4. Upload: `test-audio-genre.wav`
5. Aguardar análise completar

### ✅ Resultado Esperado

**Tabela de Referência**:
```
Título: "Trance"
┌─────────────────┬───────────┬──────────────┬────────────┐
│ Métrica         │ Valor     │ Alvo         │ Status     │
├─────────────────┼───────────┼──────────────┼────────────┤
│ Loudness (LUFS) │ -15.2     │ -14.0 ±1.0   │ ✅ Ideal   │
│ True Peak (dBTP)│ -0.5      │ -1.0 ±0.5    │ ✅ Ideal   │
│ DR (LU)         │ 7.8       │ 8.0 ±1.5     │ ✅ Ideal   │
└─────────────────┴───────────┴──────────────┴────────────┘
```

**Sugestões**:
- ✅ Mencionam "ideal para Trance"
- ✅ Não mencionam "referência" ou deltas numéricos

**Logs do Console**:
```javascript
🎵 [RENDER-REF] MODO GÊNERO
```

---

## 🧪 TESTE 2: Modo Reference - Primeira Música

**Objetivo**: Validar análise da primeira música (UserTrack)

### Passos
1. Abrir aplicação em nova aba
2. Selecionar modo: **"Por Referência"**
3. Upload: `track1-user.wav` (sua música)
4. Aguardar análise completar
5. **NÃO FECHAR O MODAL** quando abrir prompt para segunda música

### ✅ Resultado Esperado

**Modal de Resultado**:
```
Título: "Análise Completa - track1-user.wav"
Score: 78 (exemplo)

┌─────────────────┬───────────┐
│ Métrica         │ Valor     │
├─────────────────┼───────────┤
│ Loudness (LUFS) │ -14.2     │
│ True Peak (dBTP)│ 0.8       │
│ DR (LU)         │ 5.3       │
│ Bass (60-150Hz) │ 25.2%     │
└─────────────────┴───────────┘
```

**Modal Secundário Aparece**:
```
🎵 "Agora faça upload da faixa de REFERÊNCIA"
[Selecionar arquivo de referência]
```

**Logs do Console**:
```javascript
✅ [REFERENCE] Primeira música analisada
🎯 [REFERENCE] window.__REFERENCE_JOB_ID__ = "uuid-1111"
🎯 Abrindo modal secundário para música de referência
```

**Backend Logs (Railway)**:
```
🎯 [ANALYZE] Primeira música em modo reference - aguardará segunda
📝 [API] Gravado no PostgreSQL: { referenceFor: null }
```

---

## 🧪 TESTE 3: Modo Reference - Segunda Música (CRÍTICO)

**Objetivo**: Validar comparação UserTrack vs ReferenceTrack

### Passos
1. No modal secundário (ainda aberto do Teste 2)
2. Upload: `track2-reference.wav` (faixa de referência profissional)
3. Aguardar análise completar
4. **VALIDAR TABELA DETALHADAMENTE**

### ✅ Resultado Esperado

**Título da Tabela**:
```
🎵 track1-user.wav
```
❌ **NÃO DEVE APARECER**: "Trance", "Funk", ou nome de gênero

**Tabela de Comparação**:
```
┌─────────────────┬───────────┬──────────────┬────────────┐
│ Métrica         │ Valor     │ Alvo         │ Status     │
│                 │ (User)    │ (Reference)  │            │
├─────────────────┼───────────┼──────────────┼────────────┤
│ Loudness (LUFS) │ -14.2     │ -12.5 ±0.5   │ ⚠️ Ajuste  │
│ True Peak (dBTP)│ 0.8       │ -0.8 ±0.3    │ ❌ Corrigir│
│ DR (LU)         │ 5.3       │ 9.0 ±1.0     │ ❌ Corrigir│
│ Stereo Corr.    │ 0.93      │ 0.85 ±0.08   │ ⚠️ Ajuste  │
│ Centro Esp.(Hz) │ 2800      │ 2300 ±300    │ ⚠️ Ajuste  │
│ Bass (60-150Hz) │ 25.2%     │ 22.0%        │ ⚠️ Ajuste  │
│ Mid (500-2kHz)  │ 18.5%     │ 20.0%        │ ✅ Ideal   │
└─────────────────┴───────────┴──────────────┴────────────┘
```

**Sugestões**:
```
⚠️ Volume 1.7 LUFS mais baixo que a referência. Aumente o volume geral.

❌ True Peak 1.6 dB mais alto que a referência. Risco de clipping digital.

❌ Dinâmica 3.7 LU mais comprimida que a referência. Reduza compressão.

ℹ️ Bass (60-150Hz): +3.2% vs referência. Ajuste EQ nesta faixa.
```

**❌ NÃO DEVE APARECER**:
- "Ajuste para o padrão Trance"
- "Volume ideal para Funk"
- Qualquer menção a gênero musical

### Logs do Console (Frontend):
```javascript
🎯 [RENDER-REF] MODO REFERÊNCIA DETECTADO
✅ [RENDER-REF] Usando NOVA estrutura (userTrack/referenceTrack)
📊 [RENDER-REF] Referência: { 
  fileName: "track1-user.wav", 
  lufs: -12.5, 
  dr: 9.0 
}
📊 [RENDER-REF] Usuário: { 
  fileName: "track2-reference.wav", 
  lufs: -14.2, 
  dr: 5.3 
}
📊 [RENDER-REF] Fonte de métricas: userMetrics (nova estrutura)
📊 [BAND-bass] User: 25.2% | Ref: 22.0%
```

### Logs do Backend (Railway):
```
🔗 [ANALYZE] Segunda música detectada - será comparada com job: uuid-1111
🔍 [REFERENCE-LOAD] Carregando métricas do job de referência: uuid-1111
✅ [REFERENCE-LOAD] Métricas de referência carregadas com sucesso
📊 [REFERENCE-LOAD] Score ref: 85 | LUFS ref: -12.5
🎯 [WORKER-ANALYSIS] Tipo de análise: COMPARAÇÃO (2ª música)
🎯 [JSON-OUTPUT] Gerando comparação por REFERÊNCIA (faixa real)
✅ [REFERENCE-COMPARISON] Comparação gerada: 6 sugestões
```

---

## 🧪 TESTE 4: Payload JSON (DevTools)

**Objetivo**: Validar estrutura do payload retornado pelo backend

### Passos
1. Durante Teste 3, abrir DevTools (F12)
2. Aba **Network**
3. Filtrar por: `status?jobId=`
4. Encontrar última requisição com status 200
5. Aba **Response** → Ver JSON

### ✅ Resultado Esperado

```json
{
  "success": true,
  "job": {
    "id": "uuid-2222",
    "status": "completed",
    "results": {
      "mode": "reference",
      "score": 78,
      
      "userTrack": {
        "jobId": "uuid-2222",
        "fileName": "track2-reference.wav",
        "metrics": {
          "lufsIntegrated": -14.2,
          "truePeakDbtp": 0.8,
          "dynamicRange": 5.3,
          "spectral_balance": {
            "bass": { "percentage": 25.2, "energy_db": -19.1 }
          }
        }
      },
      
      "referenceTrack": {
        "jobId": "uuid-1111",
        "fileName": "track1-user.wav",
        "metrics": {
          "lufsIntegrated": -12.5,
          "truePeakDbtp": -0.8,
          "dynamicRange": 9.0,
          "spectral_balance": {
            "bass": { "percentage": 22.0, "energy_db": -21.0 }
          }
        }
      },
      
      "referenceComparison": {
        "diff": {
          "lufsIntegrated": { 
            "user": -14.2, 
            "reference": -12.5, 
            "diff": -1.7, 
            "unit": "LUFS" 
          }
        }
      },
      
      "suggestions": [
        {
          "type": "loudness",
          "severity": "warning",
          "message": "Volume 1.7 LUFS mais baixo que a referência...",
          "diff": -1.7
        }
      ]
    }
  }
}
```

**❌ NÃO DEVE CONTER**:
```json
{
  "referenceComparison": {
    "mode": "genre",  // ← ERRADO!
    "references": [
      { "genre": "Trance", "lufs_target": -14.0 }  // ← ERRADO!
    ]
  }
}
```

---

## 🧪 TESTE 5: Erro - Reference Job Inválido

**Objetivo**: Validar tratamento de erro quando jobId de referência não existe

### Passos
1. Abrir DevTools → Console
2. Executar:
```javascript
window.__REFERENCE_JOB_ID__ = '00000000-0000-0000-0000-000000000000';
```
3. Fazer upload de segunda música

### ✅ Resultado Esperado

**Backend Logs**:
```
⚠️ [REFERENCE-LOAD] Job de referência não encontrado: 00000000-...
⚠️ [REFERENCE-LOAD] Análise prosseguirá sem comparação
🎵 [JSON-OUTPUT] Gerando comparação por GÊNERO (alvos padrão)
```

**Frontend**:
- ✅ Análise completa normalmente
- ✅ Usa targets de gênero (fallback)
- ❌ NÃO exibe erro fatal ao usuário

---

## 📊 CHECKLIST FINAL

### Backend
- [ ] Migração SQL executada sem erros
- [ ] Coluna `reference_for` existe e é UUID NULL
- [ ] Logs mostram "COMPARAÇÃO (2ª música)"
- [ ] Logs mostram "Gerando comparação por REFERÊNCIA"
- [ ] Payload contém `userTrack` e `referenceTrack`
- [ ] Sugestões mencionam deltas numéricos (ex: "1.7 LUFS")

### Frontend
- [ ] Título da tabela: Nome do arquivo (não gênero)
- [ ] Coluna "Valor": Métricas da 2ª música
- [ ] Coluna "Alvo": Métricas da 1ª música
- [ ] Bandas espectrais: User % vs Reference %
- [ ] Sugestões: "vs referência" (não "para Trance")
- [ ] Logs console: "Usando NOVA estrutura"
- [ ] Logs console: "userMetrics (nova estrutura)"

### Regressão
- [ ] Modo genre ainda funciona normalmente
- [ ] Targets de gênero aparecem apenas em mode='genre'
- [ ] Primeira música em reference não quebra

---

## 🐛 TROUBLESHOOTING

### ❌ Título ainda mostra "Trance"
**Causa**: Frontend não detectou modo reference  
**Solução**: Verificar logs console → Buscar "MODO REFERÊNCIA DETECTADO"  
**Debug**:
```javascript
console.log(analysis.referenceComparison?.mode);  // Deve ser "reference"
console.log(analysis.referenceComparison?.userTrack);  // Deve existir
```

### ❌ Coluna "Alvo" mostra valores de gênero
**Causa**: Backend não retornou nova estrutura  
**Solução**: Verificar payload JSON no Network tab  
**Debug**: Buscar por `"userTrack"` no response - se não existir, backend não atualizou

### ❌ Sugestões mencionam "Trance"
**Causa**: Backend usou `generateGenreReference` em vez de `generateReferenceComparison`  
**Solução**: Verificar logs Railway → Buscar "Gerando comparação por GÊNERO"  
**Fix**: Garantir que `options.mode === 'reference'` e `preloadedReferenceMetrics` existe

### ❌ Bandas não aparecem
**Causa**: `spectral_balance` não calculado ou mapeamento incorreto  
**Solução**: Verificar logs console → Buscar "DEBUG_BANDS"  
**Debug**:
```javascript
console.log(analysis.referenceComparison?.referenceTrack?.metrics?.spectral_balance);
```

---

## 📸 EVIDÊNCIAS REQUERIDAS

Para validação completa, capturar:

1. **Screenshot da Tabela** (Teste 3)
   - Título com nome do arquivo
   - Valores user vs reference visíveis
   - Status coloridos (verde/amarelo/vermelho)

2. **Screenshot das Sugestões**
   - Texto mencionando deltas numéricos
   - "vs referência" presente

3. **Screenshot do DevTools - Network**
   - Payload JSON completo
   - Estrutura `userTrack`/`referenceTrack` visível

4. **Screenshot dos Logs do Railway**
   - "COMPARAÇÃO (2ª música)"
   - "Gerando comparação por REFERÊNCIA"
   - "Métricas carregadas com sucesso"

5. **Screenshot do Console do Browser**
   - "MODO REFERÊNCIA DETECTADO"
   - "Usando NOVA estrutura"
   - "userMetrics (nova estrutura)"

---

## ✅ APROVAÇÃO

**Critério de sucesso**: Todos os checkboxes marcados + evidências capturadas

**Aprovador**: QA Lead / Product Owner

**Data de validação**: ___________

**Assinatura**: ___________
