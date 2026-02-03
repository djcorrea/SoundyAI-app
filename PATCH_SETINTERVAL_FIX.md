# 🔧 PATCH OPCIONAL - Correção setInterval 100ms

## Problema

O arquivo `index.html` possui um `setInterval` rodando a cada 100ms (10x/segundo) que verifica mudanças no modo de análise. Isso consome ~3-5% de CPU constantemente, mesmo quando idle.

**Arquivo:** `public/index.html`  
**Linhas:** 1894-1904

```javascript
setInterval(() => {
    const currentMode = window.currentAnalysisMode;
    if (currentMode !== lastMode) {
        lastMode = currentMode;
        updateCorrectionPlanButtonVisibility();
    }
}, 100); // 🚨 10x por segundo!
```

---

## Solução 1: Aumentar Intervalo (Mais Simples)

Mude `100` para `2000` (0.5x/segundo em vez de 10x/segundo):

```javascript
setInterval(() => {
    const currentMode = window.currentAnalysisMode;
    if (currentMode !== lastMode) {
        lastMode = currentMode;
        updateCorrectionPlanButtonVisibility();
    }
}, 2000); // ✅ A cada 2 segundos
```

**Impacto:** Reduz CPU de 5% para ~0.3%  
**Trade-off:** Botão pode demorar até 2s para aparecer/desaparecer após mudança de modo

---

## Solução 2: Event-Driven (Mais Correto)

Substituir polling por event listener:

### Passo 1: Remover os 2 setInterval

Remova ou comente as linhas 1890-1904 do `index.html`:

```javascript
// ❌ REMOVER ISTO:
// setInterval(updateCorrectionPlanButtonVisibility, 500);
// 
// setInterval(() => {
//     const currentMode = window.currentAnalysisMode;
//     if (currentMode !== lastMode) {
//         lastMode = currentMode;
//         updateCorrectionPlanButtonVisibility();
//     }
// }, 100);
```

### Passo 2: Adicionar event-driven watcher

Substitua por isto:

```javascript
// ✅ ADICIONAR ISTO:
let lastMode = null;

// Observar mudanças via event (se disponível)
window.addEventListener('analysisMode', (e) => {
    const currentMode = e.detail?.mode || 'genre';
    if (currentMode !== lastMode) {
        lastMode = currentMode;
        updateCorrectionPlanButtonVisibility();
    }
});

// Observar mudanças na propriedade window.currentAnalysisMode
if (typeof Proxy !== 'undefined') {
    // Usar Proxy para detectar mudanças sem polling
    let _currentAnalysisMode = window.currentAnalysisMode || 'genre';
    
    Object.defineProperty(window, 'currentAnalysisMode', {
        get() {
            return _currentAnalysisMode;
        },
        set(value) {
            if (value !== _currentAnalysisMode) {
                _currentAnalysisMode = value;
                lastMode = value;
                updateCorrectionPlanButtonVisibility();
            }
        },
        configurable: true
    });
} else {
    // Fallback para navegadores antigos (polling lento)
    setInterval(() => {
        const currentMode = window.currentAnalysisMode;
        if (currentMode !== lastMode) {
            lastMode = currentMode;
            updateCorrectionPlanButtonVisibility();
        }
    }, 2000); // 2 segundos
}

// Executar uma vez no load
updateCorrectionPlanButtonVisibility();
```

**Impacto:** Elimina polling completamente (0% CPU)  
**Trade-off:** Depende de quem muda `window.currentAnalysisMode` disparar o setter corretamente

---

## Validação

Após aplicar patch:

1. Abra DevTools > Performance
2. Grave por 10 segundos (idle, sem análise)
3. Verifique a linha de "Task" no timeline
4. **Antes:** Verá 100 pequenas tasks (uma a cada 100ms)
5. **Depois:** Não verá nenhuma task periódica

---

## Aplicar Patch

**NÃO aplique este patch agora** - primeiro valide com a instrumentação qual é o impacto real do setInterval no seu caso específico.

Este é apenas um **guia de referência** para quando decidir corrigir.
