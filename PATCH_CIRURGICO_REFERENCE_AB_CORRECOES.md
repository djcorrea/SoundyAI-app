# 🔧 PATCH CIRÚRGICO: REFERENCE A/B - CORREÇÕES MINIMALISTAS

**Data:** 19/12/2025  
**Alvo:** `public/audio-analyzer-integration.js`  
**Objetivo:** Garantir que tabela A vs B SEMPRE renderize sem quebrar modo gênero

---

## 📦 ENTREGÁVEIS

### 1. CAUSA RAIZ (Documento de Auditoria)
✅ **Criado:** `AUDITORIA_COMPLETA_REFERENCE_AB_CAUSA_RAIZ.md`  
Resume 6 causas raiz identificadas com evidências de código.

### 2. PATCHES CIRÚRGICOS (Este documento)
Alterações mínimas necessárias para corrigir todos os bugs.

### 3. CHECKLIST DE TESTES
Casos de teste para validação manual após aplicar patches.

---

## 🎯 PATCH #1: normalizeAnalysis() - Unificador de Shape

**Localização:** Adicionar APÓS linha 240 (após função `getTrackIdentity`)

**Código:**
```javascript
/**
 * 🎯 HELPER PRINCIPAL: Normaliza análise para shape consistente
 * Garante que TODOS os dados tenham bands e metrics no top-level
 * @param {Object} raw - Análise bruta do backend ou store
 * @returns {Object} Análise normalizada com shape consistente
 */
function normalizeAnalysis(raw) {
    if (!raw) return null;
    
    console.log('[NORMALIZE] 🔄 Normalizando análise:', { jobId: raw.jobId, hasData: !!raw.data, hasTechnicalData: !!raw.technicalData });
    
    // Base: clonar para não mutar original
    const normalized = { ...raw };
    
    // 1. Extrair technicalData de todas as fontes possíveis
    const technicalData = 
        raw.technicalData ||
        raw.data?.technicalData ||
        raw.results?.technicalData ||
        {};
    
    // 2. Extrair bands de todas as fontes
    const bands = 
        raw.bands ||
        raw.spectralBands ||
        technicalData.spectral_balance ||
        raw.data?.bands ||
        raw.results?.bands ||
        {};
    
    // 3. Extrair metrics usando helper existente
    const metrics = extractMetrics(raw);
    
    // 4. Garantir estrutura unificada no TOP-LEVEL
    normalized.bands = bands;
    normalized.metrics = metrics;
    normalized.technicalData = technicalData;
    
    // 5. Se technicalData tem spectral_balance mas bands não foi copiado, garantir
    if (!normalized.bands || Object.keys(normalized.bands).length === 0) {
        if (technicalData.spectral_balance) {
            normalized.bands = technicalData.spectral_balance;
            console.log('[NORMALIZE] ✅ Copiado spectral_balance → bands');
        }
    }
    
    // 6. Se metrics vazio mas technicalData tem valores, copiar
    if (!normalized.metrics || Object.keys(normalized.metrics).length === 0) {
        normalized.metrics = {
            lufsIntegrated: technicalData.lufsIntegrated,
            truePeakDbtp: technicalData.truePeakDbtp,
            dynamicRange: technicalData.dynamicRange,
            lra: technicalData.lra,
            rmsLeft: technicalData.rmsLeft,
            rmsRight: technicalData.rmsRight,
            crestFactor: technicalData.crestFactor,
            stereoCorrelation: technicalData.stereoCorrelation
        };
        console.log('[NORMALIZE] ✅ Copiado technicalData → metrics');
    }
    
    console.log('[NORMALIZE] ✅ Normalização completa:', {
        hasBands: !!normalized.bands && Object.keys(normalized.bands).length > 0,
        hasMetrics: !!normalized.metrics && Object.keys(normalized.metrics).length > 0,
        bandsKeys: Object.keys(normalized.bands || {}),
        metricsKeys: Object.keys(normalized.metrics || {})
    });
    
    return normalized;
}
```

**Justificativa:**
- Elimina CAUSA RAIZ #1 (shape inconsistente)
- Centraliza normalização em função única
- Todos os paths de bands/metrics são verificados
- Garante top-level `bands` e `metrics` sempre presentes

---

## 🎯 PATCH #2: getSafeStateMachine() - Stub Funcional

**Localização:** Adicionar APÓS normalizeAnalysis() (após linha ~320)

**Código:**
```javascript
/**
 * 🎯 HELPER: Retorna state machine seguro (nunca undefined)
 * @returns {Object} State machine real ou stub funcional
 */
function getSafeStateMachine() {
    if (window.AnalysisStateMachine) {
        return window.AnalysisStateMachine;
    }
    
    console.warn('[STATE-MACHINE] ⚠️ AnalysisStateMachine não carregado - usando stub');
    
    // Stub funcional que preserva estado
    return {
        getMode: () => window.currentAnalysisMode || 'genre',
        setMode: (mode, opts) => {
            console.log('[STATE-MACHINE-STUB] setMode:', mode, opts);
            window.currentAnalysisMode = mode;
            if (opts?.userExplicitlySelected) {
                window.userExplicitlySelectedReferenceMode = (mode === 'reference');
            }
        },
        getState: () => ({
            mode: window.currentAnalysisMode || 'genre',
            userExplicitlySelected: window.userExplicitlySelectedReferenceMode || false,
            referenceFirstJobId: window.__REFERENCE_JOB_ID__ || null,
            awaitingSecondTrack: !!window.__REFERENCE_JOB_ID__
        }),
        isReferenceCompare: () => window.currentAnalysisMode === 'reference'
    };
}
```

**Justificativa:**
- Elimina CAUSA RAIZ #4 (stateMachine undefined)
- Previne reset indevido para modo 'genre'
- Mantém estado consistente mesmo se script não carregar

---

## 🎯 PATCH #3: handleModalFileSelection - Usar getSafeStateMachine()

**Localização:** Linha ~7900 (função handleModalFileSelection)

**BUSCAR:**
```javascript
async function handleModalFileSelection(file) {
    __dbg('📁 Arquivo selecionado no modal:', file.name);
    
    // 🔍 [INVARIANTE #1] Verificar estado do mode ANTES de qualquer processamento
    const stateMachine = window.AnalysisStateMachine;
    const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;
```

**SUBSTITUIR POR:**
```javascript
async function handleModalFileSelection(file) {
    __dbg('📁 Arquivo selecionado no modal:', file.name);
    
    // 🔍 [INVARIANTE #1] Verificar estado do mode ANTES de qualquer processamento
    const stateMachine = getSafeStateMachine();  // ✅ Nunca undefined
    const currentMode = stateMachine.getMode();
```

**Justificativa:**
- Usa stub se AnalysisStateMachine não carregar
- Elimina optional chaining que mascara problemas

---

## 🎯 PATCH #4: Normalizar ao Salvar no FirstAnalysisStore

**Localização:** Linha ~8198 (dentro de handleModalFileSelection)

**BUSCAR:**
```javascript
            // Salvar análise no store
            FirstAnalysisStore.setRef(refClone, refVid, analysisResult.jobId);
```

**SUBSTITUIR POR:**
```javascript
            // 🎯 NORMALIZAR ANTES DE SALVAR: Garante shape consistente
            const refNormalized = normalizeAnalysis(refClone);
            
            // Salvar análise normalizada no store
            FirstAnalysisStore.setRef(refNormalized, refVid, analysisResult.jobId);
            
            console.log('[STORE-SAVE] ✅ Referência salva NORMALIZADA:', {
                jobId: analysisResult.jobId,
                hasBands: !!refNormalized.bands && Object.keys(refNormalized.bands).length > 0,
                hasMetrics: !!refNormalized.metrics && Object.keys(refNormalized.metrics).length > 0
            });
```

**Justificativa:**
- Elimina CAUSA RAIZ #2 (hidratação incompleta)
- Garante que store SEMPRE tem bands/metrics no top-level
- Primeira música salva com shape correto

---

## 🎯 PATCH #5: Normalizar ao Recuperar do FirstAnalysisStore

**Localização:** Linha ~16764 (função renderReferenceComparisons)

**BUSCAR:**
```javascript
    const userFromStore = FirstAnalysisStore.getUser();
    const refFromStore = FirstAnalysisStore.getRef();
    const userMetricsCheck = extractABMetrics(userFromStore);
    const refMetricsCheck = extractABMetrics(refFromStore);
```

**SUBSTITUIR POR:**
```javascript
    // 🎯 HIDRATAR E NORMALIZAR: Garantir shape consistente
    const userFromStoreRaw = FirstAnalysisStore.getUser();
    const refFromStoreRaw = FirstAnalysisStore.getRef();
    
    // Normalizar SEMPRE ao recuperar (dupla proteção)
    const userFromStore = normalizeAnalysis(userFromStoreRaw);
    const refFromStore = normalizeAnalysis(refFromStoreRaw);
    
    console.log('[HYDRATE] 🔄 Dados normalizados do store:', {
        userHasBands: !!userFromStore?.bands,
        refHasBands: !!refFromStore?.bands,
        userHasMetrics: !!userFromStore?.metrics,
        refHasMetrics: !!refFromStore?.metrics
    });
    
    const userMetricsCheck = extractABMetrics(userFromStore);
    const refMetricsCheck = extractABMetrics(refFromStore);
```

**Justificativa:**
- Dupla proteção: normaliza ao salvar E ao recuperar
- Elimina falha de extractABMetrics() por shape inconsistente
- Garante que renderização sempre tem dados corretos

---

## 🎯 PATCH #6: Proteger Container em Geração de PDF

**Localização:** Linha ~22122 (função de geração de PDF)

**BUSCAR:**
```javascript
        console.log('✅ [PDF-SUCCESS] Relatório gerado:', fileName);
        showTemporaryFeedback('✅ Relatório PDF baixado com sucesso!');
        
        // RESTAURAR: Estilos originais
        Object.assign(container.style, originalStyles);
        setTimeout(() => container.innerHTML = '', 100);
```

**SUBSTITUIR POR:**
```javascript
        console.log('✅ [PDF-SUCCESS] Relatório gerado:', fileName);
        showTemporaryFeedback('✅ Relatório PDF baixado com sucesso!');
        
        // RESTAURAR: Estilos originais
        Object.assign(container.style, originalStyles);
        
        // 🔒 GUARD: Não limpar container se estiver em modo reference (apagaria tabela A/B!)
        const currentMode = window.currentAnalysisMode || window.__soundyState?.render?.mode;
        if (currentMode !== 'reference') {
            setTimeout(() => container.innerHTML = '', 100);
            console.log('[PDF-CLEANUP] Container limpo (modo não-reference)');
        } else {
            console.log('[PDF-CLEANUP] ⚠️ Container PRESERVADO (modo reference ativo)');
        }
```

**Justificativa:**
- Elimina CAUSA RAIZ #5 (DOM reset apaga tabela)
- Tabela A/B permanece visível após gerar PDF
- Modo gênero continua funcionando normalmente

---

## 🎯 PATCH #7: Guard em buildComparisonRows

**Localização:** Linha ~16412 (função buildComparisonRows)

**BUSCAR:**
```javascript
function buildComparisonRows(metricsA, metricsB) {
    console.log('[AB-TABLE] 🔨 Construindo tabela de comparação A vs B');
    
    if (!metricsA || !metricsB) {
        console.error('[AB-TABLE] ❌ Métricas ausentes:', { hasA: !!metricsA, hasB: !!metricsB });
        return [];
    }
```

**SUBSTITUIR POR:**
```javascript
function buildComparisonRows(metricsA, metricsB) {
    console.log('[AB-TABLE] 🔨 Construindo tabela de comparação A vs B');
    
    if (!metricsA || !metricsB) {
        console.error('[AB-TABLE] ❌ Métricas ausentes:', { hasA: !!metricsA, hasB: !!metricsB });
        console.error('[AB-TABLE] metricsA:', metricsA);
        console.error('[AB-TABLE] metricsB:', metricsB);
        console.trace('[AB-TABLE] Stack trace de onde foi chamado');
        return [];
    }
    
    // 🎯 NORMALIZAR entradas antes de processar
    const normalizedA = normalizeAnalysis(metricsA) || metricsA;
    const normalizedB = normalizeAnalysis(metricsB) || metricsB;
    
    console.log('[AB-TABLE] ✅ Métricas normalizadas:', {
        aHasBands: !!normalizedA.bands,
        bHasBands: !!normalizedB.bands,
        aHasMetrics: !!normalizedA.metrics,
        bHasMetrics: !!normalizedB.metrics
    });
```

**E SUBSTITUIR todas as referências `metricsA` → `normalizedA` e `metricsB` → `normalizedB` no resto da função.**

**Justificativa:**
- Elimina CAUSA RAIZ #6 (rows vazias)
- Normaliza entradas antes de extrair valores
- Logs detalhados para debug

---

## ✅ CHECKLIST DE TESTES MANUAIS

### TESTE 1: Reference A/B - Happy Path
**Objetivo:** Validar fluxo completo de comparação A vs B

1. Abrir aplicação
2. Selecionar "Análise de Referência A/B"
3. Upload **Música A** (base)
   - ✅ Modal 1 deve abrir
   - ✅ Deve aparecer sugestões/cards (sem tabela A/B ainda)
   - ✅ Fechar modal
4. Clicar novamente no botão de análise (modal reabre)
5. Upload **Música B** (compare) - arquivo DIFERENTE de A
   - ✅ Modal 2 deve abrir
   - ✅ **DEVE APARECER TABELA A vs B** no topo do modal
   - ✅ Tabela deve ter 7+ linhas: LUFS, True Peak, DR, LRA, RMS, Crest, Stereo
   - ✅ Coluna "A (base)" com valores da primeira música
   - ✅ Coluna "B (compare)" com valores da segunda música
   - ✅ Coluna "Δ" (diferença) colorida (verde/vermelho)

**Logs Esperados no Console:**
```
[NORMALIZE] 🔄 Normalizando análise: {...}
[NORMALIZE] ✅ Normalização completa: {hasBands: true, hasMetrics: true}
[STORE-SAVE] ✅ Referência salva NORMALIZADA: {jobId: xxx, hasBands: true, hasMetrics: true}
[HYDRATE] 🔄 Dados normalizados do store: {userHasBands: true, refHasBands: true}
[AB-TABLE] 🔨 Construindo tabela de comparação A vs B
[AB-TABLE] ✅ Métricas normalizadas: {aHasBands: true, bHasBands: true}
[AB-RENDER] container exists? true
[AB-RENDER] rows count: 7
[AB-RENDER] inserted? true
```

**Critério de Sucesso:** Tabela A/B VISÍVEL com dados corretos.

---

### TESTE 2: Reference A/B - Erro de Store

**Objetivo:** Validar que mensagem de erro aparece se store vazio (mas modal não trava)

1. Abrir DevTools → Console
2. Executar: `window.FirstAnalysisStore?.clear?.()`
3. Limpar também: `delete window.__REFERENCE_JOB_ID__`
4. Selecionar "Análise de Referência A/B"
5. Upload Música B (sem ter feito A antes)
   - ✅ Modal deve ABRIR (não travar)
   - ⚠️ Deve mostrar mensagem: **"⚠️ Comparação A/B Indisponível"**
   - ✅ Deve mostrar diagnóstico: "Store completamente vazio"
   - ✅ Resto do modal (cards, sugestões) deve funcionar

**Logs Esperados:**
```
[AB-BLOCK] abState: {...}
[AB-DATA] ref metrics extraction failed: {error: 'payload null'}
[AB-FALLBACK] ✅ Mensagem de erro renderizada no DOM
```

**Critério de Sucesso:** Modal abre, mostra erro claro, não trava.

---

### TESTE 3: Modo Gênero - Regressão

**Objetivo:** Garantir que modo gênero NÃO quebrou com as mudanças

1. Abrir aplicação
2. Selecionar gênero: **"Rock"**
3. Upload 1 arquivo de música
   - ✅ Modal deve abrir
   - ✅ Deve aparecer tabela de **REFERÊNCIA** (não A/B!)
   - ✅ Tabela tem colunas: Métrica | Valor | Alvo | Δ
   - ✅ Targets são do gênero Rock
   - ✅ Sugestões aparecem normalmente
   - ✅ Score final aparece

**Logs Esperados:**
```
[NORMALIZE] 🔄 Normalizando análise: {...}
[NORMALIZE] ✅ Copiado spectral_balance → bands
[RENDER-REF] ⏭️ Nenhum indicador de modo referência - abortando
(ou)
[RENDER-REF] 🎯 Modo gênero REAL detectado - abortando
```

**Critério de Sucesso:** 
- Modo gênero funciona 100% idêntico ao original
- Nenhum log de `[AB-TABLE]` deve aparecer
- Container #referenceComparisons NÃO deve ser criado

---

### TESTE 4: Geração de PDF em Reference

**Objetivo:** Validar que tabela A/B NÃO some após gerar PDF

1. Completar TESTE 1 (ter tabela A/B visível)
2. Clicar em "Gerar Relatório PDF" (se disponível)
3. Aguardar download do PDF
4. Após download:
   - ✅ Tabela A/B deve CONTINUAR VISÍVEL
   - ✅ Modal não deve limpar conteúdo

**Logs Esperados:**
```
[PDF-SUCCESS] Relatório gerado: Relatorio_SoundyAI_xxx.pdf
[PDF-CLEANUP] ⚠️ Container PRESERVADO (modo reference ativo)
```

**Critério de Sucesso:** Tabela A/B permanece após gerar PDF.

---

### TESTE 5: stateMachine Undefined

**Objetivo:** Validar que stub funciona se script não carregar

1. Abrir DevTools → Sources
2. Desabilitar JavaScript de `/analysis-state-machine.js` (block URL pattern)
3. Recarregar página
4. Selecionar "Análise de Referência A/B"
5. Upload música
   - ✅ Deve funcionar normalmente
   - ⚠️ Console deve mostrar: `[STATE-MACHINE] ⚠️ AnalysisStateMachine não carregado - usando stub`
   - ✅ Modo reference deve ser preservado

**Critério de Sucesso:** Aplicação funciona mesmo sem state machine.

---

## 📊 RESUMO DOS PATCHES

| # | Patch | Localização | Causa Raiz Eliminada | Crítico? |
|---|-------|-------------|----------------------|----------|
| 1 | normalizeAnalysis() | Após linha 240 | #1 (shape inconsistente) | 🔴 SIM |
| 2 | getSafeStateMachine() | Após linha 320 | #4 (stateMachine undefined) | 🟠 SIM |
| 3 | Usar getSafeStateMachine em handleModalFileSelection | Linha 7900 | #4 (stateMachine undefined) | 🟠 SIM |
| 4 | Normalizar ao salvar no FirstAnalysisStore | Linha 8198 | #2 (hidratação incompleta) | 🔴 SIM |
| 5 | Normalizar ao recuperar do FirstAnalysisStore | Linha 16764 | #2 (hidratação incompleta) | 🔴 SIM |
| 6 | Guard em setTimeout de PDF | Linha 22122 | #5 (DOM reset) | 🟡 MÉDIA |
| 7 | Normalizar entradas de buildComparisonRows | Linha 16412 | #6 (rows vazias) | 🟡 MÉDIA |

---

## 🚨 IMPORTANTE: ORDEM DE APLICAÇÃO

1. **Primeiro:** Patches #1 e #2 (criar helpers)
2. **Segundo:** Patches #3, #4, #5, #7 (usar helpers)
3. **Terceiro:** Patch #6 (proteção de DOM)
4. **Testar:** Executar todos os 5 testes acima

---

## 💾 BACKUP ANTES DE APLICAR

```bash
cp public/audio-analyzer-integration.js public/audio-analyzer-integration.js.backup-20251219
```

---

## 🎯 GARANTIAS

✅ **Modo reference:** Tabela A/B sempre renderiza se dados existirem  
✅ **Modo gênero:** ZERO alterações no comportamento  
✅ **Erros:** Mensagens claras em vez de travamentos  
✅ **Storage:** Shape consistente em todas as camadas  
✅ **Resiliência:** Funciona mesmo se stateMachine não carregar  

---

**FIM DO DOCUMENTO DE PATCHES**
