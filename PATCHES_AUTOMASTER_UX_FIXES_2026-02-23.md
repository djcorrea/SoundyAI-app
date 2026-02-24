# 🔧 PATCHES PRONTOS - AUTOMASTER V1 UX FIX

**Data**: 23 de fevereiro de 2026  
**Arquivo**: `public/master.html`  
**Objetivo**: Corrigir divergência de nomenclatura entre frontend e backend

---

## 🚨 ATENÇÃO

**ANTES DE APLICAR**:
1. ✅ Fazer backup de `public/master.html`
2. ✅ Commitar estado atual do código
3. ✅ Ler relatório completo: `AUDIT_AUTOMASTER_UX_FUNCTIONAL_2026-02-23.md`
4. ✅ Testar após cada patch

**ORDEM DE APLICAÇÃO**:
1. PATCH 1 (HTML - Modal 2)
2. PATCH 2 (JavaScript - Funções)
3. PATCH 3 (JavaScript - getModeName)
4. PATCH 4 (JavaScript - Validação)
5. PATCH 5 (JavaScript - Pré-seleção)
6. PATCH 6 (JavaScript - Limpeza)

---

## 📦 PATCH 1: CORRIGIR MODAL 2 (HTML)

**Problema**: Modal usa `conservative/balanced/aggressive` em vez de `LOW/MEDIUM/HIGH`  
**Arquivo**: `public/master.html`  
**Buscar**: Linhas 1130-1158

### SUBSTITUIR:
```html
      <div class="mode-recommendation" id="modeRecommendationSection" style="display: none;">
        <div class="mode-recommendation-title">Sugestão automática de modo:</div>
        
        <div class="mode-options">
          <div class="mode-option" id="modeConservative" data-mode="conservative" onclick="selectMode('conservative')">
            <div class="mode-header">
              <div class="mode-emoji">🛡️</div>
              <div class="mode-name">Conservador</div>
            </div>
            <div class="mode-description">Preserva dinâmica natural</div>
          </div>

          <div class="mode-option" id="modeBalanced" data-mode="balanced" onclick="selectMode('balanced')">
            <div class="mode-header">
              <div class="mode-emoji">⚖️</div>
              <div class="mode-name">Padrão</div>
            </div>
            <div class="mode-description">Equilíbrio geral</div>
          </div>

          <div class="mode-option" id="modeAggressive" data-mode="aggressive" onclick="selectMode('aggressive')">
            <div class="mode-header">
              <div class="mode-emoji">⚡</div>
              <div class="mode-name">Forte</div>
            </div>
            <div class="mode-description">Mais volume, mais risco</div>
          </div>
        </div>
```

### POR:
```html
      <div class="mode-recommendation" id="modeRecommendationSection" style="display: none;">
        <div class="mode-recommendation-title">Sugestão automática de modo:</div>
        
        <div class="mode-options">
          <div class="mode-option" id="modeLow" data-mode="LOW" onclick="selectModeDecision('LOW')">
            <div class="mode-header">
              <div class="mode-emoji">🛡️</div>
              <div class="mode-name">Suave</div>
            </div>
            <div class="mode-description">Preserva dinâmica natural</div>
          </div>

          <div class="mode-option" id="modeMedium" data-mode="MEDIUM" onclick="selectModeDecision('MEDIUM')">
            <div class="mode-header">
              <div class="mode-emoji">⚖️</div>
              <div class="mode-name">Balanceado</div>
            </div>
            <div class="mode-description">Equilíbrio geral</div>
          </div>

          <div class="mode-option" id="modeHigh" data-mode="HIGH" onclick="selectModeDecision('HIGH')">
            <div class="mode-header">
              <div class="mode-emoji">⚡</div>
              <div class="mode-name">Impacto</div>
            </div>
            <div class="mode-description">Mais volume, controlado</div>
          </div>
        </div>
```

**Mudanças**:
- ✅ IDs: `modeConservative` → `modeLow`, `modeBalanced` → `modeMedium`, `modeAggressive` → `modeHigh`
- ✅ data-mode: `conservative` → `LOW`, `balanced` → `MEDIUM`, `aggressive` → `HIGH`
- ✅ onclick: `selectMode()` → `selectModeDecision()`
- ✅ Nomes: "Conservador" → "Suave", "Padrão" → "Balanceado", "Forte" → "Impacto"

---

## 📦 PATCH 2: SEPARAR FUNÇÕES (JAVASCRIPT)

**Problema**: Mesma função `selectMode()` usada em dois contextos diferentes  
**Arquivo**: `public/master.html`  
**Buscar**: Linha ~1509

### SUBSTITUIR:
```javascript
    // ========================================
    // 🎵 ETAPA 1 - SELEÇÃO DE GÊNERO
    // ========================================
    // 🎯 ETAPA 1 - SELEÇÃO DE MODO
    // ========================================
    function selectMode(mode) {
      console.log('🎯 [AUTOMASTER] Modo selecionado:', mode);

      document.querySelectorAll('.genre-card').forEach(card => {
        card.classList.remove('selected');
      });

      event.currentTarget.classList.add('selected');
      automasterState.mode = mode;
      document.getElementById('modeNextBtn').disabled = false;
    }
```

### POR:
```javascript
    // ========================================
    // 🎯 ETAPA 1 - SELEÇÃO DE MODO INICIAL
    // ========================================
    function selectMode(mode) {
      console.log('🎯 [AUTOMASTER] Modo selecionado (inicial):', mode);

      // Validar modo ANTES de armazenar
      const validModes = ['LOW', 'MEDIUM', 'HIGH'];
      const modeUpper = mode.toUpperCase();
      
      if (!validModes.includes(modeUpper)) {
        console.error('❌ [AUTOMASTER] Modo inválido:', mode);
        alert('Modo inválido. Selecione Suave, Balanceado ou Impacto.');
        return;
      }

      document.querySelectorAll('.genre-card').forEach(card => {
        card.classList.remove('selected');
      });

      event.currentTarget.classList.add('selected');
      automasterState.mode = modeUpper;  // Sempre uppercase
      document.getElementById('modeNextBtn').disabled = false;
      
      console.log('✅ [AUTOMASTER] Modo armazenado:', automasterState.mode);
    }
```

**E ADICIONAR NOVA FUNÇÃO** (após linha ~1737):
```javascript
    // ========================================
    // 🎯 ETAPA 4 - SELEÇÃO DE MODO (DECISÃO)
    // ========================================
    function selectModeDecision(mode) {
      console.log('🎚️ [AUTOMASTER] Modo selecionado (decisão):', mode);

      // Validar modo ANTES de armazenar
      const validModes = ['LOW', 'MEDIUM', 'HIGH'];
      const modeUpper = mode.toUpperCase();
      
      if (!validModes.includes(modeUpper)) {
        console.error('❌ [AUTOMASTER] Modo inválido na decisão:', mode);
        alert('Modo inválido. Selecione um modo válido.');
        return;
      }

      document.querySelectorAll('.mode-option').forEach(option => {
        option.classList.remove('selected');
      });

      const targetEl = document.getElementById(
        modeUpper === 'LOW' ? 'modeLow' :
        modeUpper === 'MEDIUM' ? 'modeMedium' : 'modeHigh'
      );
      
      if (targetEl) {
        targetEl.classList.add('selected');
      }

      automasterState.mode = modeUpper;  // Sempre uppercase
      
      console.log('✅ [AUTOMASTER] Modo atualizado:', automasterState.mode);
    }
```

**E REMOVER FUNÇÃO DUPLICADA** (linha ~1721-1737):
```javascript
    // ❌ REMOVER ESTA FUNÇÃO (duplicada e incorreta)
    function selectMode(mode) {
      console.log('🎚️ [AUTOMASTER] Modo selecionado:', mode);

      document.querySelectorAll('.mode-option').forEach(option => {
        option.classList.remove('selected');
      });

      const targetEl = document.getElementById(
        mode === 'conservative' ? 'modeConservative' :
        mode === 'balanced' ? 'modeBalanced' : 'modeAggressive'
      );
      if (targetEl) {
        targetEl.classList.add('selected');
      }

      automasterState.mode = mode;
    }
```

---

## 📦 PATCH 3: ATUALIZAR getModeName() (JAVASCRIPT)

**Problema**: Função não mapeia `LOW/MEDIUM/HIGH`  
**Arquivo**: `public/master.html`  
**Buscar**: Linha ~1491

### SUBSTITUIR:
```javascript
    function getModeName(modeCode) {
      const modes = {
        'conservative': 'Conservador',
        'balanced': 'Padrão',
        'aggressive': 'Forte'
      };
      return modes[modeCode] || modeCode;
    }
```

### POR:
```javascript
    function getModeName(modeCode) {
      const modes = {
        // Backend modes (uppercase) - OFICIAL
        'LOW': 'Suave',
        'MEDIUM': 'Balanceado',
        'HIGH': 'Impacto',
        
        // Lowercase fallback (caso o código não normalize)
        'low': 'Suave',
        'medium': 'Balanceado',
        'high': 'Impacto',
        
        // Legacy modes (manter por segurança durante transição)
        'conservative': 'Suave (legacy)',
        'balanced': 'Balanceado (legacy)',
        'aggressive': 'Impacto (legacy)'
      };
      
      return modes[modeCode] || modeCode;
    }
```

---

## 📦 PATCH 4: ADICIONAR GUARDIÃO (JAVASCRIPT)

**Problema**: Nenhuma validação antes de enviar ao backend  
**Arquivo**: `public/master.html`  
**Buscar**: Linha ~1766

### SUBSTITUIR:
```javascript
    async function startProcessing() {
      console.log('⏳ [AUTOMASTER] Iniciando processamento real...');
      showModal('processingModal');

      // Mostra loading, esconde erro
      document.getElementById('processingLoading').style.display = 'flex';
      document.getElementById('processingError').style.display = 'none';

      try {
        const formData = new FormData();
        formData.append('file', automasterState.file);
        formData.append('mode', automasterState.mode);
```

### POR:
```javascript
    async function startProcessing() {
      console.log('⏳ [AUTOMASTER] Iniciando processamento real...');
      
      // ============================================================
      // 🛡️ GUARDIÃO: VALIDAR ESTADO ANTES DE ENVIAR AO BACKEND
      // ============================================================
      
      // Validação 1: Modo definido
      if (!automasterState.mode) {
        alert('Erro interno: Modo não definido. Selecione novamente.');
        console.error('❌ [AUTOMASTER] automasterState.mode está vazio');
        backToDecision();
        return;
      }
      
      // Validação 2: Modo válido
      const validModes = ['LOW', 'MEDIUM', 'HIGH'];
      const modeNormalized = automasterState.mode.toUpperCase();
      
      if (!validModes.includes(modeNormalized)) {
        alert(`Erro interno: Modo inválido "${automasterState.mode}". Selecione novamente.`);
        console.error('❌ [AUTOMASTER] Modo inválido detectado:', automasterState.mode);
        console.error('❌ [AUTOMASTER] Modos válidos:', validModes);
        backToDecision();
        return;
      }
      
      // Validação 3: Arquivo presente
      if (!automasterState.file) {
        alert('Erro interno: Arquivo ausente. Faça upload novamente.');
        console.error('❌ [AUTOMASTER] automasterState.file está vazio');
        backToUpload();
        return;
      }
      
      // ✅ ESTADO VALIDADO - PROSSEGUIR
      console.log('✅ [AUTOMASTER] Estado validado:', {
        mode: modeNormalized,
        file: automasterState.file.name,
        size: `${(automasterState.file.size / 1024 / 1024).toFixed(2)} MB`
      });
      
      showModal('processingModal');
      document.getElementById('processingLoading').style.display = 'flex';
      document.getElementById('processingError').style.display = 'none';

      try {
        const formData = new FormData();
        formData.append('file', automasterState.file);
        formData.append('mode', modeNormalized);  // ← SEMPRE UPPERCASE
        
        console.log('📤 [AUTOMASTER] Enviando ao backend:', {
          endpoint: '/api/automaster',
          mode: modeNormalized,
          fileName: automasterState.file.name
        });
```

**E ATUALIZAR CATCH** (linha ~1807):
```javascript
      } catch (err) {
        console.error('❌ [AUTOMASTER] Erro no processamento:', err);
        
        // Melhorar mensagem de erro para o usuário
        let userMessage = err.message || 'Erro desconhecido no processamento.';
        
        if (userMessage.includes('Mode invalido')) {
          userMessage = 'Erro interno: Modo inválido detectado. Nossa equipe foi notificada. Tente novamente ou entre em contato.';
        }

        document.getElementById('processingLoading').style.display = 'none';
        document.getElementById('processingErrorMsg').textContent = userMessage;
        document.getElementById('processingError').style.display = 'block';
      }
```

---

## 📦 PATCH 5: CORRIGIR PRÉ-SELEÇÃO (JAVASCRIPT)

**Problema**: Pré-seleção usa nomenclatura incorreta  
**Arquivo**: `public/master.html`  
**Buscar**: Linha ~1702

### SUBSTITUIR:
```javascript
        // Pré-seleciona modo recomendado pelo backend
        const recMode = recommendedMode || 'balanced';
        automasterState.mode = recMode;

        document.querySelectorAll('.mode-option').forEach(opt => {
          opt.classList.remove('selected', 'recommended');
        });

        const recElement = document.getElementById(
          recMode === 'conservative' ? 'modeConservative' :
          recMode === 'balanced' ? 'modeBalanced' : 'modeAggressive'
        );
        if (recElement) {
          recElement.classList.add('selected', 'recommended');
        }
```

### POR:
```javascript
        // ============================================================
        // 🎯 PRÉ-SELEÇÃO INTELIGENTE DO MODO
        // ============================================================

        // Backend pode retornar modo recomendado (já validado)
        // Se não retornar, usar padrão MEDIUM
        const recMode = (recommendedMode || 'MEDIUM').toUpperCase();

        // Validar modo recomendado
        const validModes = ['LOW', 'MEDIUM', 'HIGH'];
        const modeToUse = validModes.includes(recMode) ? recMode : 'MEDIUM';

        console.log('🎯 [AUTOMASTER] Modo recomendado:', {
          backend: recommendedMode,
          normalized: modeToUse
        });

        // Armazenar modo validado
        automasterState.mode = modeToUse;

        // Remover seleção anterior
        document.querySelectorAll('.mode-option').forEach(opt => {
          opt.classList.remove('selected', 'recommended');
        });

        // Pré-selecionar elemento correspondente
        const recElement = document.getElementById(
          modeToUse === 'LOW' ? 'modeLow' :
          modeToUse === 'MEDIUM' ? 'modeMedium' : 'modeHigh'
        );

        if (recElement) {
          recElement.classList.add('selected', 'recommended');
          console.log('✅ [AUTOMASTER] Modo pré-selecionado:', modeToUse);
        } else {
          console.error('❌ [AUTOMASTER] Elemento do modo não encontrado:', modeToUse);
        }
```

---

## 📦 PATCH 6: LIMPEZA (JAVASCRIPT - OPCIONAL)

**Problema**: Código usa `automasterState.genre` mas AutoMaster não trabalha com gêneros  
**Arquivo**: `public/master.html`

### REMOVER OU COMENTAR:

**Linha ~1482**:
```javascript
// ❌ REMOVER (não usado no AutoMaster V1)
function getGenreName(genreCode) {
  const genres = {
    'edm': 'EDM',
    'house': 'House',
    'techno': 'Techno',
    'trance': 'Trance',
    'dubstep': 'Dubstep',
    'dnb': 'Drum & Bass'
  };
  return genres[genreCode] || genreCode;
}
```

**Linha ~1616**:
```javascript
        const formData = new FormData();
        formData.append('file', automasterState.file);
        // ❌ REMOVER esta linha:
        // formData.append('genre', automasterState.genre);
```

**Linha ~1755**:
```javascript
      // ❌ REMOVER ou comentar:
      // document.getElementById('summaryGenre').textContent = getGenreName(automasterState.genre);
      
      document.getElementById('summaryFile').textContent = automasterState.fileName;
      document.getElementById('summaryMode').textContent = getModeName(automasterState.mode);
```

**OU** adicionar ao HTML (se quiser manter):
```html
<!-- Adicionar elemento no Modal de Confirmação -->
<div class="summary-item">
  <div class="summary-label">Gênero:</div>
  <div class="summary-value" id="summaryGenre">—</div>
</div>
```

---

## ✅ CHECKLIST DE APLICAÇÃO

Execute após cada patch:

```bash
# 1. Aplicar patch
# (Copiar e colar código no arquivo)

# 2. Salvar arquivo
# (Ctrl+S)

# 3. Recarregar página no navegador
# (F5 ou Ctrl+Shift+R para hard reload)

# 4. Abrir DevTools Console
# (F12)

# 5. Testar fluxo:
# - Selecionar modo no Modal 1
# - Verificar console mostra modo uppercase
# - Fazer upload de arquivo
# - Verificar Modal 2 pré-seleciona modo correto
# - Verificar IDs dos elementos estão corretos
# - Enviar para processamento
# - Verificar backend aceita modo sem erro
```

---

## 🧪 SCRIPT DE TESTE RÁPIDO

Cole no console do navegador para validar estado:

```javascript
// Verificar estado atual
console.log('=== AUTOMASTER STATE ===');
console.log('Mode:', automasterState.mode);
console.log('File:', automasterState.file?.name);
console.log('Valid modes:', ['LOW', 'MEDIUM', 'HIGH']);
console.log('Mode is valid?', ['LOW', 'MEDIUM', 'HIGH'].includes(automasterState.mode?.toUpperCase()));

// Testar função getModeName
console.log('=== GETMODENAME TEST ===');
console.log('LOW →', getModeName('LOW'));
console.log('MEDIUM →', getModeName('MEDIUM'));
console.log('HIGH →', getModeName('HIGH'));
console.log('low →', getModeName('low'));
console.log('conservative →', getModeName('conservative'));

// Verificar elementos DOM
console.log('=== DOM ELEMENTS ===');
console.log('modeLow exists?', !!document.getElementById('modeLow'));
console.log('modeMedium exists?', !!document.getElementById('modeMedium'));
console.log('modeHigh exists?', !!document.getElementById('modeHigh'));
console.log('modeConservative exists? (should be false)', !!document.getElementById('modeConservative'));

// Verificar função selectModeDecision existe
console.log('=== FUNCTIONS ===');
console.log('selectMode exists?', typeof selectMode === 'function');
console.log('selectModeDecision exists?', typeof selectModeDecision === 'function');
```

---

## 🚨 TROUBLESHOOTING

### Erro: "selectModeDecision is not defined"
**Causa**: PATCH 2 não foi aplicado corretamente  
**Solução**: Verificar se função `selectModeDecision()` foi adicionada após linha 1737

### Erro: "Cannot read property 'classList' of null"
**Causa**: IDs do PATCH 1 não correspondem aos IDs do PATCH 5  
**Solução**: Verificar IDs: `modeLow`, `modeMedium`, `modeHigh` (não `modeConservative`)

### Backend ainda rejeita modo
**Causa**: Modo não está sendo normalizado para uppercase  
**Solução**: Verificar PATCH 4 foi aplicado (linha `modeNormalized = mode.toUpperCase()`)

### Modal 2 não pré-seleciona modo
**Causa**: PATCH 5 não foi aplicado corretamente  
**Solução**: Verificar função `openDecisionModal()` linha ~1702

---

## 📊 RESUMO

| Patch | Status | Tempo | Impacto |
|-------|--------|-------|---------|
| PATCH 1 | ⏳ Pendente | 5 min | 🔴 CRÍTICO |
| PATCH 2 | ⏳ Pendente | 10 min | 🔴 CRÍTICO |
| PATCH 3 | ⏳ Pendente | 3 min | 🟡 IMPORTANTE |
| PATCH 4 | ⏳ Pendente | 10 min | 🟡 IMPORTANTE |
| PATCH 5 | ⏳ Pendente | 5 min | 🔴 CRÍTICO |
| PATCH 6 | ⏳ Pendente | 5 min | 🟢 LIMPEZA |

**Tempo total estimado**: 40 minutos (sem PATCH 6) ou 45 minutos (com PATCH 6)

---

**Criado por**: GitHub Copilot (Claude Sonnet 4.5)  
**Para**: SoundyAI Development Team  
**Data**: 23 de fevereiro de 2026
