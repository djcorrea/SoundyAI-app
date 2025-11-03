# 🔴 DIAGNÓSTICO CRÍTICO: Erro Resetando `currentAnalysisMode` para 'genre'

**Data**: 3 de novembro de 2025  
**Arquivo**: `public/audio-analyzer-integration.js`  
**Problema Identificado**: Sistema entrando no bloco `catch` e resetando modo reference para genre

---

## 🎯 DESCOBERTA CRÍTICA

### **Evidência nos Logs do Usuário**

```javascript
[SAFE_INTERCEPT-MONITOR] ✅ DOM renderizado corretamente (modo não-reference)
```

Este log confirma que o sistema está **caindo em modo single-track (não-reference)** ao invés de A/B comparison.

### **Causa Raiz Identificada**

**Linha 3137-3150** (`handleModalFileSelection` catch block):

```javascript
} catch (error) {
    console.error('❌ Erro na análise do modal:', error);
    
    // Verificar se é um erro de fallback para modo gênero
    if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
        window.logReferenceEvent('error_fallback_to_genre', { 
            error: error.message,
            originalMode: currentAnalysisMode 
        });
        
        showModalError('Erro na análise por referência. Redirecionando para análise por gênero...');
        
        setTimeout(() => {
            currentAnalysisMode = 'genre';  // ❌ RESET PARA GENRE!
            configureModalForMode('genre');
        }, 2000);
    }
}
```

---

## 🔍 FLUXO DO BUG

### **Timeline do Problema**

```
1. [✅ OK] Usuário faz upload da primeira faixa
   └─> window.__REFERENCE_JOB_ID__ = jobId1 ✅
   └─> currentAnalysisMode = 'reference' ✅

2. [✅ OK] Usuário faz upload da segunda faixa
   └─> isSecondTrack = true ✅
   └─> Sistema entra no bloco "Segunda música" (linha 2846)
   └─> [SEGUNDA-TRACK-DETECTADA] logs aparecem ✅

3. [❌ ERRO] Durante processamento da segunda faixa
   └─> ALGUM ERRO É LANÇADO (ainda não identificado)
   └─> Sistema entra no bloco catch (linha 3137)

4. [❌ RESET] Bloco catch reseta modo
   └─> currentAnalysisMode = 'genre' ❌
   └─> configureModalForMode('genre') chamado ❌

5. [❌ FALHA] Sistema chama displayModalResults()
   └─> const mode = analysis?.mode || currentAnalysisMode
   └─> mode = 'genre' (pois currentAnalysisMode foi resetado) ❌
   └─> Condicional if (mode === 'reference' && isSecondTrack) = FALSE
   └─> A/B comparison block não executa ❌
   └─> Sistema renderiza em modo single-track ❌
```

---

## 🐛 OBSERVAÇÃO CRÍTICA DO USUÁRIO

O usuário notou **logs suspeitos aparecendo ANTES da análise iniciar**:

```javascript
🎯 [AUDITORIA_REF] Targets usados: 
{lufs: -11.153, truePeak: -0.2, dr: 10.282, lra: 0, stereo: 0.239, …}
```

**Análise**: Este log aparece na **linha 9637**, dentro de `renderReferenceComparisons()`. Valores fixos como `-11.153` LUFS sugerem:

1. **Hipótese A**: Sistema usando valores de target GENRE (hardcoded) ao invés de dados reais da primeira faixa
2. **Hipótese B**: `window.referenceAnalysisData` está contaminado ou undefined, causando fallback para targets padrão
3. **Hipótese C**: Erro ocorrendo ANTES de `renderReferenceComparisons()` executar, causando uso de dados cached/stale

---

## 🔧 CORREÇÃO APLICADA

### **Patch: Logs de Diagnóstico no Catch Block**

**Linha 3137-3156** (MODIFICADO):

```javascript
} catch (error) {
    console.error('🔴🔴🔴 [ERRO-CRÍTICO-CAPTURADO] ════════════════════════════════════');
    console.error('🔴 [ERRO-CRÍTICO] Erro capturado no handleModalFileSelection!');
    console.error('🔴 [ERRO-CRÍTICO] Este erro está RESETANDO currentAnalysisMode para "genre"!');
    console.error('🔴 [ERRO-CRÍTICO] Error message:', error.message);
    console.error('🔴 [ERRO-CRÍTICO] Error stack:', error.stack);
    console.error('🔴 [ERRO-CRÍTICO] currentAnalysisMode ANTES:', currentAnalysisMode);
    console.error('🔴 [ERRO-CRÍTICO] window.__REFERENCE_JOB_ID__:', window.__REFERENCE_JOB_ID__);
    console.error('🔴 [ERRO-CRÍTICO] isSecondTrack:', window.__REFERENCE_JOB_ID__ !== null);
    console.error('🔴 [ERRO-CRÍTICO] FEATURE_FLAGS?.FALLBACK_TO_GENRE:', window.FEATURE_FLAGS?.FALLBACK_TO_GENRE);
    console.error('🔴🔴🔴 [ERRO-CRÍTICO-CAPTURADO] ════════════════════════════════════');
    console.error('❌ Erro na análise do modal:', error);
    
    if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
        console.error('🔴 [ERRO-CRÍTICO] ❌❌❌ ENTRANDO NO FALLBACK PARA GENRE!');
        console.error('🔴 [ERRO-CRÍTICO] currentAnalysisMode será RESETADO de "reference" para "genre"');
        console.error('🔴 [ERRO-CRÍTICO] Isto causará falha na condicional do modo A/B!');
        
        // ... resto do código
    }
}
```

### **Patch: Logs de Entrada no Bloco Segunda Track**

**Linha 2846-2858** (MODIFICADO):

```javascript
} else if ((jobMode === 'reference' || currentAnalysisMode === 'reference') && isSecondTrack) {
    console.log('🟢🟢🟢 [SEGUNDA-TRACK-DETECTADA] ════════════════════════════════════');
    console.log('🟢 [SEGUNDA-TRACK] ✅ Sistema ENTROU no bloco de segunda track!');
    console.log('🟢 [SEGUNDA-TRACK] jobMode:', jobMode);
    console.log('🟢 [SEGUNDA-TRACK] currentAnalysisMode:', currentAnalysisMode);
    console.log('🟢 [SEGUNDA-TRACK] isSecondTrack:', isSecondTrack);
    console.log('🟢 [SEGUNDA-TRACK] window.__REFERENCE_JOB_ID__:', window.__REFERENCE_JOB_ID__);
    console.log('🟢 [SEGUNDA-TRACK] analysisResult.jobId:', analysisResult?.jobId);
    console.log('🟢 [SEGUNDA-TRACK] Aguardando processamento... (se não aparecer erro abaixo, fluxo está correto)');
    console.log('🟢🟢🟢 [SEGUNDA-TRACK-DETECTADA] ════════════════════════════════════');
    
    // ... resto do código
}
```

---

## 🎯 O QUE ESPERAR NO PRÓXIMO TESTE

### **Cenário 1: Erro Capturado (Esperado)**

Se o erro ainda estiver ocorrendo, você verá:

```javascript
🟢🟢🟢 [SEGUNDA-TRACK-DETECTADA] ════════════════════════════════════
🟢 [SEGUNDA-TRACK] ✅ Sistema ENTROU no bloco de segunda track!
🟢 [SEGUNDA-TRACK] currentAnalysisMode: reference
🟢 [SEGUNDA-TRACK] isSecondTrack: true
🟢🟢🟢 [SEGUNDA-TRACK-DETECTADA] ════════════════════════════════════

... (logs de processamento) ...

🔴🔴🔴 [ERRO-CRÍTICO-CAPTURADO] ════════════════════════════════════
🔴 [ERRO-CRÍTICO] Erro capturado no handleModalFileSelection!
🔴 [ERRO-CRÍTICO] Error message: XXXXX  ← CHAVE PARA DIAGNÓSTICO
🔴 [ERRO-CRÍTICO] Error stack: XXXXX
🔴 [ERRO-CRÍTICO] currentAnalysisMode ANTES: reference
🔴 [ERRO-CRÍTICO] FEATURE_FLAGS?.FALLBACK_TO_GENRE: true/false
🔴🔴🔴 [ERRO-CRÍTICO-CAPTURADO] ════════════════════════════════════

🔴 [ERRO-CRÍTICO] ❌❌❌ ENTRANDO NO FALLBACK PARA GENRE!
🔴 [ERRO-CRÍTICO] currentAnalysisMode será RESETADO de "reference" para "genre"
```

**→ ISSO CONFIRMARÁ QUAL ERRO ESTÁ OCORRENDO E CAUSANDO O RESET**

### **Cenário 2: Sem Erro (Improvável)**

Se NÃO houver erro, você verá:

```javascript
🟢🟢🟢 [SEGUNDA-TRACK-DETECTADA] ════════════════════════════════════
... (processamento completo sem erros) ...
🔴🔴🔴 [DIAGNÓSTICO-AB] ════════════════════════════════════
🔴 [DIAGNÓSTICO-AB] mode (final): reference
🔴 [DIAGNÓSTICO-AB] isSecondTrack: true
🔴 [DIAGNÓSTICO-AB] Condicional será: true
```

**→ ISSO INDICARIA QUE O PROBLEMA FOI CORRIGIDO**

---

## 🔍 POSSÍVEIS CAUSAS DO ERRO (Hipóteses)

### **Hipótese 1: Normalização Falhando**
```javascript
// Linha ~2836
const normalizedResult = normalizeBackendAnalysisData(analysisResult);
```
Se `normalizeBackendAnalysisData()` lançar exceção (ex: dados malformados), sistema cairá no catch.

### **Hipótese 2: displayModalResults() Falhando**
```javascript
// Linha ~2907
await displayModalResults(normalizedResult);
```
Se `displayModalResults()` lançar exceção (ex: DOM manipulation error, data undefined), sistema cairá no catch.

### **Hipótese 3: Referência Perdida**
```javascript
// Linha ~2869
if (state.previousAnalysis) {
    state.userAnalysis = state.previousAnalysis;  // 1ª faixa
    state.referenceAnalysis = analysisResult;      // 2ª faixa
}
```
Se `state.previousAnalysis` for `undefined` ou `null`, estrutura A/B não é construída corretamente.

### **Hipótese 4: window.__FIRST_ANALYSIS_FROZEN__ Undefined**
Se recovery mechanism (linhas 4868-4898) não conseguir recuperar primeira análise, `window.__FIRST_ANALYSIS_FROZEN__` fica undefined, causando erro em `displayModalResults()`.

---

## ✅ PRÓXIMOS PASSOS

1. **Recarregar página** (F5 ou Ctrl+R)
2. **Abrir DevTools Console** (F12)
3. **Fazer upload da primeira faixa** (reference mode)
4. **Fazer upload da segunda faixa** (diferente)
5. **Procurar por logs**:
   - ✅ `[SEGUNDA-TRACK-DETECTADA]` (confirma entrada no bloco)
   - 🔴 `[ERRO-CRÍTICO-CAPTURADO]` (confirma erro ocorrendo)
   - Capturar **error.message** e **error.stack** completos

6. **Enviar logs para análise**
   - Se aparecer `[ERRO-CRÍTICO]`, copiar toda a stack trace
   - Isso revelará EXATAMENTE qual função/linha está falhando
   - Com essa informação, podemos aplicar fix cirúrgico

---

## 📊 VALIDAÇÃO FINAL

### **Checklist de Diagnóstico**
- [x] Logs de entrada no bloco segunda track adicionados
- [x] Logs de captura de erro no catch adicionados
- [x] Logs mostram `currentAnalysisMode` ANTES do reset
- [x] Logs mostram `FEATURE_FLAGS?.FALLBACK_TO_GENRE` status
- [x] Logs mostram error.message e error.stack completos
- [ ] **PENDING**: Usuário testar e reportar logs completos

### **Informações Críticas a Coletar**
1. ✅ `error.message` (qual erro específico?)
2. ✅ `error.stack` (onde erro ocorreu?)
3. ✅ `currentAnalysisMode` (era 'reference' antes do reset?)
4. ✅ `window.FEATURE_FLAGS?.FALLBACK_TO_GENRE` (fallback está ativo?)
5. ✅ Sequência de logs entre `[SEGUNDA-TRACK-DETECTADA]` e `[ERRO-CRÍTICO]`

---

**🏁 Diagnóstico preparado. Aguardando logs do usuário para identificar erro específico.**
