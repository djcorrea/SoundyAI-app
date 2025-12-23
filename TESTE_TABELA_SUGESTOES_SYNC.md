# 🧪 GUIA DE TESTE - SINCRONIZAÇÃO TABELA ↔ SUGESTÕES

**Data:** 23/12/2025  
**Patch:** SYNC_23DEC2025  
**Objetivo:** Validar que sugestões só aparecem para métricas com status != OK

---

## 🚀 PREPARAÇÃO

### 1. Verificar arquivos instalados

```bash
# Backend
ls work/api/audio/suggestions-table-sync.js

# Frontend
ls public/suggestions-frontend-failsafe.js

# Pipeline modificado
grep -n "TABLE-SYNC" work/api/audio/pipeline-complete.js

# Index.html com script
grep "suggestions-frontend-failsafe" public/index.html
```

### 2. Reiniciar servidor

```bash
# Parar processo atual
Ctrl+C

# Limpar cache de módulos Node
rm -rf node_modules/.cache

# Reiniciar
npm start
# OU
python -m http.server 3000
```

### 3. Limpar cache do navegador

```javascript
// No console do navegador:
localStorage.clear();
sessionStorage.clear();
location.reload(true);  // Force reload
```

---

## 📋 CENÁRIOS DE TESTE

### ✅ CENÁRIO 1: Métrica OK (Verde) - Sem Sugestão

**Objetivo:** Verificar que NÃO aparece sugestão quando métrica está ideal

#### Preparação:
- Arquivo com **LUFS = -14.0 LUFS** (dentro do range -16 a -10)
- True Peak = -1.5 dBTP (seguro)

#### Passos:
1. Upload do arquivo
2. Aguardar análise completa
3. **VERIFICAR TABELA:**
   ```
   ✅ Ideal (verde) para LUFS Integrado
   ```

#### Logs esperados:

**Backend (`work/worker.js` logs):**
```
[TABLE-SYNC] lufs: val=-14.0 target=-14 status=ok
[TABLE-SYNC] ✅ Sugestões filtradas: { before: 5, after: 4, removed: 1 }
[TABLE-SYNC] okSuggestionsCount: 0
[TABLE-SYNC] ✅✅✅ SINCRONIZAÇÃO PERFEITA!
```

**Frontend (console do navegador):**
```
[FAILSAFE] ❌ Removida (backend): lufs (tableStatus=ok)
[FAILSAFE] ✅ Filtro aplicado: { input: 5, output: 4, removed: 1 }
```

#### ✅ Resultado esperado:
- [ ] Tabela mostra "✅ Ideal" (verde) para LUFS
- [ ] **NENHUM card de sugestão** sobre LUFS aparece
- [ ] Console backend: `okSuggestionsCount: 0`
- [ ] Console frontend: `removed: 1` (LUFS filtrado)

---

### ❌ CENÁRIO 2: Métrica CRÍTICA (Vermelho) - Com Sugestão

**Objetivo:** Verificar que sugestão APARECE quando métrica está crítica

#### Preparação:
- Arquivo com **True Peak = +0.5 dBTP** (clipping)
- LUFS normal

#### Passos:
1. Upload do arquivo
2. Aguardar análise completa
3. **VERIFICAR TABELA:**
   ```
   ❌ Corrigir (vermelho) para True Peak
   ```

#### Logs esperados:

**Backend:**
```
[TABLE-SYNC] truepeak: val=0.5 target=-1 status=warn
[TABLE-SYNC] ✅ Sugestões filtradas: { before: 5, after: 5, removed: 0 }
[TABLE-SYNC] okSuggestionsCount: 0
[TABLE-SYNC] missingCount: 0
```

**Frontend:**
```
[FAILSAFE] Processando: true_peak → key: truepeak → tableStatus: warn
[FAILSAFE] ✅ Mantida: truepeak (status crítico)
```

#### ✅ Resultado esperado:
- [ ] Tabela mostra "❌ Corrigir" (vermelho) para True Peak
- [ ] **Card de sugestão aparece** com:
  - Título: "True Peak / Clipping"
  - Badge: "Crítico" (vermelho)
  - Texto: "True Peak em 0.5 dBTP acima do limite..."
  - `tableStatus: 'warn'` visível no objeto (DevTools)
- [ ] Console: Nenhum filtro aplicado

---

### ⚠️ CENÁRIO 3: Banda Espectral Fora (Amarelo) - Sem Sugestão Original

**Objetivo:** Verificar que FALLBACK é gerado automaticamente

#### Preparação:
- Arquivo com **Bass = -35 dB** (fora do range -30 a -26)
- Nenhuma sugestão original sobre Bass

#### Passos:
1. Upload do arquivo
2. Aguardar análise completa
3. **VERIFICAR TABELA:**
   ```
   ⚠️ Ajustar (amarelo) para Graves (Sub/Bass)
   ```

#### Logs esperados:

**Backend:**
```
[TABLE-SYNC] bass: val=-35 target={min:-30,max:-26} status=yellow
[TABLE-SYNC] missingKeys: ['bass']
[TABLE-SYNC] ✅ Gerados 1 fallbacks
[TABLE-SYNC] missingCount: 0
```

**Frontend:**
```
[FAILSAFE] Processando: bass → key: bass → tableStatus: yellow
[FAILSAFE] ✅ Mantida: bass (status amarelo)
```

#### ✅ Resultado esperado:
- [ ] Tabela mostra "⚠️ Ajustar" (amarelo) para Bass
- [ ] **Card de sugestão FALLBACK aparece** com:
  - Texto: "Graves (Sub/Bass) está em -35dB. Range ideal: -30dB a -26dB. Sugestão: aumentar aproximadamente 9dB."
  - Badge: "Ajuste" (amarelo)
  - `_isFallback: true` no objeto
  - `aiEnhanced: false`
- [ ] Console: `missingCount: 0` (completude garantida)

---

### 🎯 CENÁRIO 4: Mix Complexo (Várias métricas)

**Objetivo:** Testar sincronização em cenário real

#### Preparação:
- Arquivo com:
  - ✅ LUFS = -14.2 (OK)
  - ❌ True Peak = 0.5 (CRÍTICO)
  - ⚠️ DR = 6.2 (ATENÇÃO, target=10)
  - ✅ LRA = 5.8 (OK, target=6±2)
  - ⚠️ Bass = -32 (ATENÇÃO)
  - ✅ Mid = -20 (OK)
  - ❌ High = -12 (CRÍTICO, muito alto)

#### Logs esperados:

**Backend:**
```
[TABLE-SYNC] statusByKey construído: 7 métricas
[TABLE-SYNC] Detalhes: {
  lufs: 'ok',
  truepeak: 'warn',
  dynamicrange: 'yellow',
  lra: 'ok',
  bass: 'yellow',
  mid: 'ok',
  high: 'warn'
}
[TABLE-SYNC] ✅ Sugestões filtradas: { before: 10, after: 4, removed: 6 }
[TABLE-SYNC] nonOkCount: 4
[TABLE-SYNC] suggestionsCount: 4
[TABLE-SYNC] okSuggestionsCount: 0
[TABLE-SYNC] missingCount: 0
[TABLE-SYNC] ✅✅✅ SINCRONIZAÇÃO PERFEITA!
```

#### ✅ Resultado esperado:
- [ ] **4 cards** renderizados: True Peak, DR, Bass, High
- [ ] **0 cards** para: LUFS, LRA, Mid
- [ ] Cada card tem badge correto:
  - True Peak: "Crítico" (vermelho)
  - DR: "Ajuste" (amarelo)
  - Bass: "Ajuste" (amarelo)
  - High: "Crítico" (vermelho)
- [ ] Console: Sincronização perfeita

---

## 🔍 FERRAMENTAS DE DEBUG

### Console Backend (Node.js)

```bash
# Filtrar logs de sincronização
npm start 2>&1 | grep "TABLE-SYNC"

# Ver somente relatório final
npm start 2>&1 | grep -A 10 "RELATÓRIO FINAL"

# Ver status de cada métrica
npm start 2>&1 | grep "TABLE-SYNC.*status="
```

### Console Frontend (Browser DevTools)

```javascript
// Ver statusByKey extraído da tabela
SuggestionsFailsafe.extractStatusFromTable();

// Aplicar failsafe manualmente
SuggestionsFailsafe.applyFailsafeToAllSuggestions();

// Ver sugestões atuais
console.table(window.currentAnalysis?.aiSuggestions);

// Ver somente sugestões com tableStatus
window.currentAnalysis?.aiSuggestions.filter(s => s.tableStatus);
```

### Inspecionar análise completa

```javascript
// Ver objeto completo
console.log(JSON.stringify(window.currentAnalysis, null, 2));

// Ver somente métricas e status
const analysis = window.currentAnalysis;
const metrics = {
  lufs: analysis.lufs?.integrated,
  truePeak: analysis.truePeak?.maxDbtp,
  dr: analysis.dynamics?.dynamicRange,
  lra: analysis.lufs?.lra
};
console.table(metrics);
```

---

## ❌ ERROS COMUNS E SOLUÇÕES

### Problema 1: okSuggestionsCount > 0

**Sintoma:**
```
[TABLE-SYNC] okSuggestionsCount: 2
[TABLE-SYNC] ⚠️ ATENÇÃO: Ainda existem 2 sugestões para métricas OK!
```

**Causa:** Chave não foi normalizada corretamente

**Solução:**
1. Verificar logs de processamento:
   ```
   [TABLE-SYNC] Processando: LUFS Integrado → key: ??? → tableStatus: ???
   ```
2. Se key estiver errada, adicionar mapeamento em `normalizeMetricKey`
3. Reiniciar servidor

---

### Problema 2: missingCount > 0

**Sintoma:**
```
[TABLE-SYNC] missingCount: 1
[TABLE-SYNC] ⚠️ ATENÇÃO: Faltam sugestões para 1 métricas não-OK!
```

**Causa:** Fallback não foi gerado (dados ausentes)

**Solução:**
1. Verificar log de fallback:
   ```
   [TABLE-SYNC] ⚠️ Dados de tabela ausentes para bass - pulando fallback
   ```
2. Inspecionar `tableData` no código:
   ```javascript
   console.log('tableData:', tableData);
   ```
3. Verificar se métrica está em `metricsMap` ou `spectralBands`

---

### Problema 3: Failsafe não ativa no frontend

**Sintoma:** Cards aparecem para métricas OK

**Solução:**
1. Verificar se script foi carregado:
   ```javascript
   console.log(window.SuggestionsFailsafe);  // Deve existir
   ```
2. Verificar se MutationObserver está ativo:
   ```
   [FAILSAFE] 👁️ MutationObserver ativo
   ```
3. Forçar aplicação manual:
   ```javascript
   SuggestionsFailsafe.applyFailsafeToAllSuggestions();
   ```

---

## ✅ CHECKLIST DE APROVAÇÃO

Marque TODOS os itens antes de considerar patch aprovado:

### Backend
- [ ] `okSuggestionsCount: 0` em todos os testes
- [ ] `missingCount: 0` em todos os testes
- [ ] Log de sincronização perfeita aparece
- [ ] Fallbacks são gerados quando necessário

### Frontend
- [ ] Script carregado sem erros
- [ ] MutationObserver ativo
- [ ] Hooks funcionando (`renderSuggestions` interceptado)
- [ ] Filtro aplicado corretamente

### UI
- [ ] Nenhum card para métricas OK (verde)
- [ ] Cards aparecem para métricas amarelas/vermelhas
- [ ] Badges de severidade corretos
- [ ] Textos de range preservados

### Console
- [ ] Sem erros no backend
- [ ] Sem erros no frontend
- [ ] Logs de sincronização presentes
- [ ] Logs de failsafe presentes

---

## 🎯 APROVAÇÃO FINAL

**Critério de sucesso:**
```
✅ 100% dos cenários passam
✅ okSuggestionsCount sempre = 0
✅ missingCount sempre = 0
✅ Nenhum card indevido aparece na UI
```

**Se todos os critérios forem atendidos:**
```
╔═══════════════════════════════════════════════════════════╗
║  ✅✅✅ PATCH APROVADO E EM PRODUÇÃO                     ║
╚═══════════════════════════════════════════════════════════╝
```

---

**FIM DO GUIA DE TESTE**
