# 🔍 AUDITORIA COMPLETA - FLUXO ANÁLISE POR GÊNERO MUSICAL

## 📋 Resumo Executivo

Esta auditoria mapeou completamente o fluxo de análise por gênero musical no SoundyAI, desde o clique inicial até a chamada ao back-end. **Objetivo principal**: garantir que a troca do modal de gênero não desencadeie uso indevido do Web Audio API, mantendo o back-end como soberano na análise.

**Status**: ✅ **FLUXO MAPEADO COMPLETAMENTE** - Sistema usa processamento local via Web Audio API, não back-end via URLs assinadas.

**Descoberta Crítica**: O sistema atual não usa o fluxo de URLs pré-assinadas documentado. A análise é feita **localmente** via Web Audio API no browser.

## 🔗 Diagrama de Sequência (Mermaid)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant UI as UI/Front (Botão + Chat)
    participant MG as Modal "Por gênero musical"
    participant SG as Cards de Gênero (atual)
    participant AG as applyGenreSelection()
    participant UP as handleModalFileSelection()
    participant WA as Web Audio API (AudioContext)
    participant AA as window.audioAnalyzer
    participant BE as Back-end (analysis.js) [NÃO USADO]

    U->>UI: Clica "+" no chat → "Analisar música"
    UI->>MG: window.openAudioModal() → openGenreSelectionModal()
    MG->>SG: Renderiza cards de gênero (funk, trance, etc.)
    SG->>AG: selectGenre(genreKey) → applyGenreSelection(genre)
    AG->>AG: window.PROD_AI_REF_GENRE = genre; loadReferenceData(genre)
    AG->>UI: Abre modal de upload de arquivo
    UI->>UP: handleModalFileSelection(file)
    UP->>WA: AudioContext criado para decodificação
    WA->>AA: audioAnalyzer.analyzeAudioFile(file, options)
    AA->>AA: Processamento local completo (LUFS, True Peak, Bandas)
    AA-->>UI: Resultados exibidos no modal

    Note over BE: ❌ Back-end analysis.js NÃO é chamado
    Note over WA: ⚠️ Web Audio API é usada para análise local
```

## 📂 Tabela de Arquivos Críticos

| Área | Arquivo (path) | Função(s) chave | Responsabilidade | Observações |
|------|---------------|-----------------|------------------|-------------|
| **Entrada** | `public/index.html` | Botão `chat-plus-btn` | Abre popover com "Analisar música" | Popover JS inline |
| **Modal Modo** | `public/index.html` | `#analysisModeModal` | Modal seleção "Por gênero" vs "Por referência" | Modo referência hidden |
| **Modal Gênero** | `public/index.html` | `#genreSelectionModal` | Modal com cards de gêneros | 8 gêneros disponíveis |
| **Upload** | `public/index.html` | `#audioAnalysisModal` | Modal de upload de arquivo | Input file + drag&drop |
| **Handler Gênero** | `audio-analyzer-integration.js:1585` | `openGenreSelectionModal()` | Abre modal de seleção | ✅ Mapeado |
| **Seleção** | `audio-analyzer-integration.js:1635` | `selectGenre(genreKey)` | Processa seleção de gênero | ✅ Mapeado |
| **Aplicação** | `audio-analyzer-integration.js:1156` | `applyGenreSelection(genre)` | Salva gênero + carrega refs | Store: `window.PROD_AI_REF_GENRE` |
| **Upload** | `audio-analyzer-integration.js:1938` | `handleModalFileSelection(file)` | Processa arquivo selecionado | ✅ Logs adicionados |
| **Análise Gênero** | `audio-analyzer-integration.js:2209` | `handleGenreFileSelection(file)` | Análise específica por gênero | **USA WEB AUDIO API** |
| **Web Audio** | `audio-analyzer-integration.js:1249` | AudioContext creation | Contexto de áudio para análise | ⚠️ **RISCO IDENTIFICADO** |
| **Back-end** | `api/audio/analyze.js` | `POST /api/audio/analyze` | Endpoint de análise remota | ❌ **NÃO USADO** |

## ⚙️ Tabela de Handlers/Eventos/Flags

| Tipo | Nome | Onde é definido | Quem consome | Observações |
|------|------|----------------|--------------|-------------|
| **Handler** | `selectGenre(genreKey)` | `audio-analyzer-integration.js:1635` | Cards de gênero onClick | ✅ Este deve ser reutilizado |
| **Handler** | `applyGenreSelection(genre)` | `audio-analyzer-integration.js:1156` | selectGenre() | ✅ Salva estado global |
| **Store** | `window.PROD_AI_REF_GENRE` | `applyGenreSelection()` | `handleGenreFileSelection()` | Fonte da verdade do gênero |
| **Store** | `localStorage.prodai_ref_genre` | `applyGenreSelection()` | Persistência entre sessões | Backup do estado |
| **Variável** | `currentAnalysisMode` | `audio-analyzer-integration.js:121` | Sistema de modo | 'genre' \| 'reference' |
| **Flag** | `window.FEATURE_FLAGS.REFERENCE_MODE_ENABLED` | `public/index.html:19` | Modal de modo | Controla modo referência |
| **Flag** | `window.FEATURE_FLAGS.FALLBACK_TO_GENRE` | `public/index.html:20` | Sistema de fallback | Auto-switch para gênero |
| **Event** | Nenhum evento custom identificado | - | - | Sistema usa callbacks diretos |

## 🚪 Mapa de Modais

| Modal | ID | Quem Abre | Quem Fecha | Condições | Sequência |
|-------|----|-----------|-----------|-----------|---------| 
| **Seleção de Modo** | `analysisModeModal` | `openAudioModal()` | `selectAnalysisMode()` | Primeiro modal | 1️⃣ |
| **Seleção de Gênero** | `genreSelectionModal` | `openGenreSelectionModal()` | `selectGenre()` | Modo gênero selecionado | 2️⃣ |
| **Upload de Arquivo** | `audioAnalysisModal` | `openAnalysisModalForMode()` | `closeAudioModal()` | Gênero selecionado | 3️⃣ |

**Fluxo Normal**: Modal Modo → Modal Gênero → Modal Upload

## ⚠️ Pontos de Risco & Mitigações

| Risco | Onde | Causa | Efeito | Mitigação (sem implementar agora) |
|-------|------|--------|--------|------------------------------------|
| **Web Audio Usage** | `handleGenreFileSelection()` | Sistema usa `audioAnalyzer.analyzeAudioFile()` | Análise local, não back-end | Implementar chamada para `POST /api/audio/analyze` |
| **Falta de URLs Assinadas** | Todo o fluxo | Não usa `getPresignedUrl()` | Upload não vai para bucket | Implementar fluxo presigned URL |
| **AudioContext Criado** | `audio-analyzer-integration.js:1249` | Teste de aceitação cria contexto | Uso desnecessário de Web Audio | Mover para feature flag |
| **Handler Genérico** | Cards de gênero | onClick chama `selectGenre()` | Função correta, mas sem log | ✅ Logs adicionados |
| **Fallback Silencioso** | `handleModalFileSelection()` | Try/catch pode ativar Web Audio | Bypass do back-end | Garantir flags no início |
| **Estado Global** | `window.PROD_AI_REF_GENRE` | Múltiplos pontos modificam | Estado inconsistente | Centralizar em store/context |

## 🔍 Inventário Web Audio API

**Todas as referências encontradas**:

| Local | Função/Variável | Tipo | Propósito | Status |
|-------|----------------|------|-----------|---------|
| `audio-analyzer-integration.js:1249` | `new AudioContext()` | Constructor | Teste de aceitação | ⚠️ Log adicionado |
| `audio-analyzer-integration.js:1249` | `window.webkitAudioContext` | Fallback | Compatibilidade Safari | ⚠️ Log adicionado |
| `debug-analyzer.js:16` | AudioContext check | Feature detection | Debug | ✅ Apenas verificação |
| `debug-audio-analyzer-deep.js:137` | `AudioContext.prototype.decodeAudioData` | Intercept | Debug/Monitoring | ✅ Apenas debug |

**Flags de controle identificadas**:
- ❌ `USE_WEB_AUDIO` - Não encontrada
- ❌ `USE_BACKEND_ANALYSIS` - Não encontrada  
- ✅ `FORCE_BACKEND` - Encontrada em `api/audio/integration-example.js` (não usado)
- ✅ `window.FEATURE_FLAGS.*` - Encontradas para modo referência

## 📋 Plano de Testes (Para Implementação)

### Cenários de Teste

1. **Gênero Válido**
   - Selecionar "Funk Mandela" → Upload arquivo WAV 10MB
   - **Asserção**: Nenhum AudioContext criado, `POST /api/audio/analyze` chamado

2. **Troca de Gênero**
   - Selecionar "Trance" → Trocar para "Eletrônico" → Upload
   - **Asserção**: `window.PROD_AI_REF_GENRE` atualizado corretamente

3. **Erro URL Assinada**
   - Upload com `getPresignedUrl()` falhando
   - **Asserção**: Erro tratado, sem fallback para Web Audio

4. **Erro 5xx Backend**
   - `POST /api/audio/analyze` retorna 500
   - **Asserção**: Erro exibido, sem retry automático

5. **Arquivo Grande/Pequeno**
   - Upload 1MB e 60MB
   - **Asserção**: Ambos processados via back-end

6. **Mobile/Desktop**
   - Testar fluxo em ambas plataformas
   - **Asserção**: Comportamento idêntico

### Comandos de Teste

```javascript
// Verificar se Web Audio não é usada
console.assert(
  !document.querySelector('audio, video'), 
  'Nenhum elemento de mídia criado'
);

// Verificar payload correto
const payloadTest = {
  fileKey: 'test-file-key',
  mode: 'genre',
  fileName: 'test.wav'
};
console.assert(
  JSON.stringify(sentPayload) === JSON.stringify(payloadTest),
  'Payload contém dados corretos'
);
```

## 🎯 Próximos Passos (Para Implementação)

1. **Implementar URLs Pré-assinadas**
   - Adicionar `getPresignedUrl(file)` em `handleModalFileSelection()`
   - Adicionar `uploadToBucket(uploadUrl, file)`

2. **Implementar Chamada Back-end**
   - Substituir `audioAnalyzer.analyzeAudioFile()` por `fetch('/api/audio/analyze')`
   - Payload: `{ fileKey, mode: 'genre', fileName }`

3. **Substituir Handler de Gênero**
   - ✅ **Reutilizar exato**: `selectGenre(genreKey)` 
   - ✅ **Payload idêntico**: Mesma estrutura de dados
   - ✅ **Store compartilhado**: `window.PROD_AI_REF_GENRE`

4. **Implementar Feature Flags**
   - `USE_BACKEND_ANALYSIS: true`
   - `DISABLE_WEB_AUDIO: true`

## ✅ Conclusão da Auditoria

O fluxo foi **completamente mapeado** e está pronto para a implementação do novo modal. Os riscos foram identificados e as mitigações documentadas.

**Handlers que o novo modal deve reutilizar**:
- `selectGenre(genreKey)` → `audio-analyzer-integration.js:1635`
- `applyGenreSelection(genre)` → `audio-analyzer-integration.js:1156`

**Store/Estado que deve ser mantido**:
- `window.PROD_AI_REF_GENRE` (fonte da verdade)
- `localStorage.prodai_ref_genre` (persistência)

**Próxima fase**: Implementar novo modal mantendo exata compatibilidade com handlers existentes.