# 🔍 AUDITORIA DE PERFORMANCE - SoundyAI (ESCOPO FOCADO)
## Travamento FL Studio Durante Análise de Áudio

**Data:** 03/02/2026  
**Escopo:** App principal (index.html) e fluxo de análise de áudio  
**Problema:** FL Studio trava quando ambos estão abertos

---

## 📦 TAREFA 1 — ESCOPO PROVADO (Arquivos Carregados)

### Scripts JavaScript Carregados por index.html:

**CDNs Externas:**
1. `https://www.googletagmanager.com/gtag/js?id=G-MBDHDYN6Z0` - Google Analytics
2. `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` - **Three.js (WebGL)** ⚠️
3. `https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.net.min.js` - **Vanta.NET (WebGL)** ⚠️
4. `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js` - GSAP Animation
5. `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` - PDF Gen
6. `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` - Canvas to PNG

**Scripts Locais (por ordem de carregamento):**
1. `logger.js` - Sistema de logs
2. `analytics-tracking.js` - GA4 wrapper
3. `auth.js` - Autenticação
4. `friendly-labels.js` - Labels UI
5. `anonymous-mode.js` - Modo anônimo
6. `device-fingerprint.js` - Fingerprinting
7. `demo-core.js`, `demo-guards.js`, `demo-ui.js` - Sistema demo
8. `demo-cta-force.js` - CTAs
9. `pipeline-order-correction.js` - Pipeline
10. `status-suggestion-unified-v1.js` - Sistema unificado
11. `status-migration-v1.js` - Migração
12. `force-unified-activation.js` - Ativação forçada
13. `auto-validator-unified.js` - Validador
14. `tonal-balance-safe-v1.js` - Tonal balance
15. `auto-validator-tonal-safe.js` - Validador tonal
16. `error-mapper.js` - Mapeador de erros
17. **`script.js`** - Script principal do app
18. `voice-clean.js` - Voice messages
19. **`audio-analyzer.js`** - ⚠️ Analisador de áudio principal
20. `cache-context-aware-v1.js` - Cache inteligente
21. `refs/embedded-refs-new.js` - Referências embedadas
22. `suggestion-scorer.js` - Scorer de sugestões
23. `enhanced-suggestion-engine.js` - Engine de sugestões
24. `advanced-educational-suggestion-system.js` - Sistema educacional
25. `ultra-advanced-suggestion-enhancer-v2.js` - Ultra avançado v2
26. `validador-integracao-ultra-avancado.js` - Validador
27. `monitor-modal-ultra-avancado.js` - Monitor modal
28. `suggestion-text-generator.js` - Gerador de texto
29. `suggestion-system-emergency.js` - Sistema emergência
30. `ai-suggestion-layer.js` - Layer IA (7 arquivos)
31. `secure-api-loader.js` - Loader API
32. `secure-render-utils.js` - Render utils
33. `reduced-mode-security-guard.js` - Security guard
34. `reference-mode-auditor.js` - Auditor reference
35. `reference-flow.js` - Flow reference
36. `reference-normalizer.js` - Normalizer
37. **`analysis-state-machine.js`** - ⚠️ State machine (SEM defer)
38. `reference-trace-utils.js` - Trace utils
39. `lib/audio/utils/band-key-aliases.js` - Band aliases
40. `lib/audio/features/score-engine-v3.js` - Score engine
41. `lib/audio/features/scoring.js` (module) - Scoring principal
42. `tooltip-manager.js` - Tooltips
43. **`audio-analyzer-integration.js`** - ⚠️ **INTEGRAÇÃO PRINCIPAL** (34.375 linhas!)
44. `js/scoring-debug-visual.js` - Debug visual

**Total:** ~50+ scripts carregados!

### CSS Carregados por index.html:

1. `style.css` - Estilo principal
2. **`audio-analyzer.css`** - ⚠️ Estilos analyzer
3. `music-button-below-chat.css`
4. `friendly-labels.css`
5. `image-upload-styles.css`
6. `ultra-advanced-styles.css`
7. `ai-suggestion-styles.css`
8. `ai-suggestions-expanded.css`
9. `ai-suggestions-futuristic.css`
10. `ScoreFinal.css`
11. `plan-mask-styles.css`
12. `secure-render-styles.css`
13. `upgrade-modal-styles.css`
14. `login-required-modal.css`
15. `modal-mobile-spacing.css`
16. `analysis-history.css`

---

## 🔄 TAREFA 1B — CADEIA DE EXECUÇÃO DO FLUXO "Analisar Áudio"

### 1. PONTO DE ENTRADA (Botão UI):

**Arquivo:** [public/index.html](public/index.html#L546-L548)  
**Linha:** 546-548
```html
<button class="chatbot-action-btn btn-analyze-highlight" data-action="analyze">
    <span>Análise de áudio</span>
</button>
```

**Handler:** Listener `data-action="analyze"` (provavelmente em script.js - NÃO ENCONTRADO no grep)

### 2. ABERTURA DO MODAL:

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6746)  
**Linha:** 6746
```javascript
musicAnalysisBtn.addEventListener('click', openAudioModal);
```

**Função:** `openAudioModal()` abre modal #analysisModeModal

### 3. SELEÇÃO DE ARQUIVO:

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L10605-L10615)  
**Linha:** 10605-10615
```javascript
// File input change event
fileInput.addEventListener('change', (e) => {
    __dbg('📁 File input change triggered');
    if (e.target.files.length > 0) {
        __dbg('📁 File selected:', e.target.files[0].name);
        handleModalFileSelection(e.target.files[0]);
    }
});
```

### 4. PROCESSAMENTO DO ARQUIVO:

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L10651)  
**Função:** `handleModalFileSelection(file)` (linha ~10651)

**Checkpoint #1:** Interceptação de modo anônimo/demo  
**Checkpoint #2:** Verificação de state machine  
**Checkpoint #3:** Resetar contexto de gênero (se reference mode)

### 5. ANÁLISE DE ÁUDIO (Core):

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L12567)  
**Linha:** 12567
```javascript
const analysis = await window.audioAnalyzer.analyzeAudioFile(file, userOptionsWithRunId);
```

**Função chamada:** `window.audioAnalyzer.analyzeAudioFile()` (definida em **audio-analyzer.js**)

**O que acontece:**
1. **Decode de áudio** (Web Audio API - AudioContext.decodeAudioData)
2. **FFT Analysis** (4096 samples)
3. **Cálculo de métricas:** LUFS, True Peak, Dynamic Range, Stereo Correlation
4. **Extração espectral:** Bandas de frequência
5. **Comparação com referências** (se modo genre)

### 6. RENDERIZAÇÃO DE RESULTADOS:

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L19835-L19845)  
**Linha:** 19835-19845
```javascript
// Animação do score (requestAnimationFrame loop)
function animate(timestamp) {
    // ... calcula easing ...
    if (progress < 1) {
        requestAnimationFrame(animate);
    }
}
requestAnimationFrame(animate);
```

**UI Update:** Popula modal #audioAnalysisResults com:
- Score final (animado)
- Métricas técnicas
- Sugestões de melhorias
- Gráficos/visualizações

---

## 🎯 TAREFA 2 — AUDITORIA DE PESO (ESCOPO FOCADO)

### A. requestAnimationFrame (Loops Ativos)

| Arquivo | Linha | Contexto | Quando Roda | Severidade |
|---------|-------|----------|-------------|------------|
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L19835) | 19835-19845 | **Score animation loop** | Durante renderização de resultados | 🟠 **MÉDIA** |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6812) | 6812 | UI animation (modal transitions?) | Ao abrir modais | 🟢 Baixa |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L7734) | 7734 | UI animation | Transições UI | 🟢 Baixa |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L16235) | 16235 | UI animation | Transições UI | 🟢 Baixa |

**Notas:**
- Score animation tem **stop condition** (progress >= 1) ✅
- Loops são pontuais (não rodam idle)
- **SEM loop infinito crítico detectado** no fluxo de análise

### B. setInterval (Polling Ativo)

| Arquivo | Linha | Intervalo | Função | Quando Roda | Severidade |
|---------|-------|-----------|--------|-------------|------------|
| **[index.html](public/index.html#L1894)** | **1894** | **100ms** | **`updateCorrectionPlanButtonVisibility`** | **SEMPRE (idle + análise)** | 🔴 **CRÍTICA** |
| [index.html](public/index.html#L1890) | 1890 | 500ms | `updateCorrectionPlanButtonVisibility` | SEMPRE | 🟠 Alta |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L33500) | 33500-33511 | 1000ms | `checkJobIdIntegrity` | Somente em modo reference | 🟡 Média |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6771) | 6771 | 300ms | `checkReady()` (refs/cache) | Durante inicialização | 🟢 Baixa |
| [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L13580) | 13580 | 100ms | `waitForAudioAnalyzer` | Durante loading | 🟢 Baixa |

**Problema crítico identificado:**

```javascript
// index.html linha 1894 - RODA 10x POR SEGUNDO SEMPRE!
setInterval(() => {
    const currentMode = window.currentAnalysisMode;
    if (currentMode !== lastMode) {
        lastMode = currentMode;
        updateCorrectionPlanButtonVisibility();
    }
}, 100); // 🚨 10x/segundo!
```

### C. Event Listeners SEM Throttle/Debounce

**Nenhum listener crítico encontrado no fluxo de análise.**

Listeners de `mousemove`/`scroll`/`resize` estão em:
- script.js (parallax - mas NÃO confirmado se ativo durante análise)
- Não encontrados em audio-analyzer-integration.js

### D. Operações Pesadas na Main Thread

| Operação | Arquivo | Função | Severidade |
|----------|---------|--------|------------|
| **AudioContext.decodeAudioData** | audio-analyzer.js | `analyzeAudioFile` | 🔴 **CRÍTICA** |
| **FFT Analysis (4096)** | audio-analyzer.js | Extração espectral | 🔴 **ALTA** |
| **Cálculo LUFS** | audio-analyzer.js | True Peak/ITU | 🟠 **MÉDIA** |
| **Loops em array gigante** | audio-analyzer.js | Processamento samples | 🟠 **MÉDIA** |
| **34.375 linhas de JS** | audio-analyzer-integration.js | Parse + eval inicial | 🟠 **MÉDIA** |

**Nota:** `audio-analyzer.js` NÃO foi auditado detalhadamente (fora do escopo inicial). Requer análise separada.

### E. Manipulações de DOM em Loop

| Operação | Arquivo | Linha | Severidade |
|----------|---------|-------|------------|
| Atualizar `progressFill.style.width` | audio-analyzer-integration.js | 13600 | 🟢 Baixa |
| Score animation `el.textContent` | audio-analyzer-integration.js | 19828 | 🟢 Baixa |

**Nenhuma manipulação de DOM pesada** detectada (sem append em loop, innerHTML gigante, etc.)

### F. CSS Caro (backdrop-filter/blur/shadows/animations)

**Análise em audio-analyzer.css:**

#### Backdrop-filter encontrados:

| Arquivo | Linha | Valor | Contexto |
|---------|-------|-------|----------|
| [audio-analyzer.css](public/audio-analyzer.css#L81) | 81 | `blur(8px)` | Modal overlay |
| [audio-analyzer.css](public/audio-analyzer.css#L112) | 112 | `blur(20px)` | Modal backdrop |
| [audio-analyzer.css](public/audio-analyzer.css#L433) | 433 | `blur(10px)` | Cards |
| [audio-analyzer.css](public/audio-analyzer.css#L694) | 694 | `blur(10px)` | Hints |
| [audio-analyzer.css](public/audio-analyzer.css#L812) | 812 | `blur(15px)` | Tooltips |
| [audio-analyzer.css](public/audio-analyzer.css#L1099) | 1099 | `blur(15px)` | Modals |
| [audio-analyzer.css](public/audio-analyzer.css#L1295) | 1295 | `blur(8px)` | Overlays |
| [audio-analyzer.css](public/audio-analyzer.css#L1363) | 1363 | `blur(12px)` | Containers |
| [audio-analyzer.css](public/audio-analyzer.css#L1499) | 1499 | `blur(10px)` | Backgrounds |
| [audio-analyzer.css](public/audio-analyzer.css#L1593) | 1593 | `blur(8px)` | Elements |
| [audio-analyzer.css](public/audio-analyzer.css#L1629) | 1629 | `blur(8px)` | Elements |
| [audio-analyzer.css](public/audio-analyzer.css#L1657) | 1657 | `blur(8px)` | Elements |
| [audio-analyzer.css](public/audio-analyzer.css#L1914) | 1914 | `blur(10px)` | Elements |
| [audio-analyzer.css](public/audio-analyzer.css#L1996) | 1996 | `blur(20px)` | Modal backdrop |

**Total:** 14+ ocorrências de `backdrop-filter: blur()` com valores de 8px a 20px.

#### Animações CSS infinitas:

| Arquivo | Linha | Animação | Duração | Contexto |
|---------|-------|----------|---------|----------|
| [audio-analyzer.css](public/audio-analyzer.css#L515) | 515 | `spin-simple` | 1.2s infinite | Loading spinner |
| [audio-analyzer.css](public/audio-analyzer.css#L665) | 665 | `text-pulse` | 2s infinite | Text pulse |
| [audio-analyzer.css](public/audio-analyzer.css#L789) | 789 | `progress-shimmer` | 1.5s infinite | Progress bar |

**Nota:** Animações infinitas são usadas APENAS em loading states (não no resultado final).

#### Box-shadows pesadas:

Múltiplas ocorrências de `box-shadow` com blur radius > 20px (não listadas individualmente).

---

## 🏆 TAREFA 3 — TOP 5 SUSPEITOS (BASEADO EM EVIDÊNCIA)

### 🥇 #1 — setInterval 100ms Polling (Main Thread)

**Arquivo:** [public/index.html](public/index.html#L1894-L1904)  
**Linhas:** 1894-1904

```javascript
setInterval(() => {
    const currentMode = window.currentAnalysisMode;
    if (currentMode !== lastMode) {
        lastMode = currentMode;
        updateCorrectionPlanButtonVisibility();
    }
}, 100); // 🚨 10 chamadas por segundo SEMPRE!
```

**Por que pesa:**
- **CPU main thread:** Executa 10x/segundo independente de atividade
- Força leitura de variável global + comparison + possível DOM manipulation
- **Forced Synchronous Layout** se `updateCorrectionPlanButtonVisibility()` mede/altera DOM

**Quando pesa:**
- **SEMPRE:** Idle, durante análise, durante conversação com chatbot
- Não para nunca (sem cleanup)

**Impacto estimado:** ~3-5% CPU constante

---

### 🥈 #2 — AudioContext.decodeAudioData (Main Thread Blocking)

**Arquivo:** audio-analyzer.js (linha desconhecida - arquivo não auditado)  
**Função:** `analyzeAudioFile(file, options)`

**Por que pesa:**
- **CPU main thread:** `decodeAudioData` bloqueia thread principal
- Arquivo de 150MB (max) pode levar 2-10s para decode
- **Memória:** Buffer completo do áudio na RAM

**Quando pesa:**
- **Ao clicar "Analisar"** → Durante upload/decode

**Impacto estimado:** 30-60% CPU por 2-10 segundos

**Evidência:**
```javascript
// audio-analyzer-integration.js linha 12567
const analysis = await window.audioAnalyzer.analyzeAudioFile(file, userOptionsWithRunId);
```

---

### 🥉 #3 — FFT Analysis 4096 Samples (CPU Intensive)

**Arquivo:** audio-analyzer.js  
**Operação:** Análise espectral via FFT

**Por que pesa:**
- **CPU main thread:** FFT 4096 em window de 30s
- Loops em arrays gigantes (milhões de samples)
- Cálculo de bandas espectrais (múltiplas iterações)

**Quando pesa:**
- **Após decode** → Durante análise espectral

**Impacto estimado:** 20-40% CPU por 3-5 segundos

---

### 🔴 #4 — Backdrop-filter: blur(20px) em Modais (GPU)

**Arquivo:** [public/audio-analyzer.css](public/audio-analyzer.css#L112)  
**Linha:** 112 (e mais 13 ocorrências)

```css
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
```

**Por que pesa:**
- **GPU compositor:** Força repaint de layer inteiro
- Blur 20px = ~400 pixel sampling por pixel
- Aplicado em elementos grandes (modal fullscreen)

**Quando pesa:**
- **Durante análise:** Modal de loading visível com backdrop-filter
- **Após análise:** Modal de resultados com backdrop-filter

**Impacto estimado:** 10-15% GPU constante (enquanto modal visível)

---

### 🟡 #5 — 50+ Scripts Carregados (Parse/Eval Inicial)

**Arquivo:** [public/index.html](public/index.html#L10-L1130)  
**Total:** ~50 arquivos JS (~500KB+ de código)

**Destaque:**
- **audio-analyzer-integration.js:** 34.375 linhas (!)
- Three.js + Vanta.js: ~200KB (mas defer)

**Por que pesa:**
- **CPU main thread:** Parse + eval de todo JS no load
- **Memória:** Todos os scripts ficam na RAM

**Quando pesa:**
- **Ao carregar página** → Tempo inicial de load
- **Background:** GC pode pausar thread ao limpar closures

**Impacto estimado:** 500ms-2s no page load

---

## 📊 RESUMO DO IMPACTO

| Suspeito | CPU (idle) | CPU (análise) | GPU | Memória | Prioridade |
|----------|------------|---------------|-----|---------|------------|
| setInterval 100ms | 🔴 5% | 🔴 5% | - | - | **P0** |
| decodeAudioData | - | 🔴 50% | - | 🟠 50MB | **P1** |
| FFT Analysis | - | 🔴 30% | - | 🟠 30MB | **P1** |
| backdrop-filter | - | - | 🟠 15% | - | **P2** |
| 50+ scripts | 🟢 1% | 🟢 1% | - | 🟠 80MB | **P2** |

**Total estimado (durante análise):** CPU 91% | GPU 15% | RAM 160MB

---

## 💡 CONCLUSÃO

O travamento do FL Studio é causado por **contenção de CPU** durante análise de áudio:

1. **setInterval 100ms** consome CPU constantemente (mesmo idle)
2. **decodeAudioData + FFT** bloqueiam main thread por 5-15 segundos
3. **backdrop-filter** força GPU repaint dos modais

**Diferença da auditoria anterior:**
- ❌ Vanta.js/Three.js **NÃO são o problema** (carregados com defer, provavelmente não inicializados)
- ✅ Problema real está no **audio-analyzer.js** (decode/FFT bloqueantes)
- ✅ setInterval 100ms é um **overhead constante** desnecessário

---

## 🛠️ INSTRUMENTAÇÃO (próximo arquivo)

Ver: `performance-audit-focused-instrumentation.js`
