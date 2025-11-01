#  AUDITORIA: IMPLEMENTAÇÃO FLUXO MODO REFERENCE NO FRONTEND

**Data**: 01/11/2025 10:35
**Arquivo**: audio-analyzer-integration.js
**Objetivo**: Ajustar comportamento do frontend para o modo reference

---

##  ALTERAÇÕES IMPLEMENTADAS

### 1. Modificação da função pollJobStatus (linha ~447)

**Antes:**
`javascript
if (jobData.status === 'completed' || jobData.status === 'done') {
    __dbg(' Job concluído com sucesso');
    resolve(jobData.result || jobData);
    return;
}
`

**Depois:**
`javascript
if (jobData.status === 'completed' || jobData.status === 'done') {
    __dbg(' Job concluído com sucesso');
    
    //  NOVO: Verificar modo e decidir fluxo
    const jobResult = jobData.result || jobData;
    jobResult.jobId = jobId; // Incluir jobId no resultado
    jobResult.mode = jobData.mode; // Incluir mode no resultado
    
    resolve(jobResult);
    return;
}
`

**Impacto**: Agora o resultado do polling inclui jobId e mode, permitindo decisões condicionais no fluxo.

---

### 2. Lógica condicional no handleModalFileSelection (linha ~2365)

**Antes:**
`javascript
const analysisResult = await pollJobStatus(jobId);

if (currentAnalysisMode === "reference") {
    await handleReferenceAnalysisWithResult(analysisResult, fileKey, file.name);
} else {
    await handleGenreAnalysisWithResult(analysisResult, file.name);
}
`

**Depois:**
`javascript
const analysisResult = await pollJobStatus(jobId);

//  NOVO FLUXO: Verificar modo do job para decidir ação
const jobMode = analysisResult.mode || currentAnalysisMode;

__dbg(' Modo do job:', jobMode);

if (jobMode === 'reference') {
    // Modo reference: primeira música analisada, abrir modal para música de referência
    __dbg(' Abrindo modal secundário para música de referência');
    openReferenceUploadModal(analysisResult.jobId, analysisResult);
} else if (jobMode === 'comparison') {
    // Modo comparison: segunda música analisada, mostrar resultado final
    __dbg(' Exibindo resultado comparativo');
    await handleGenreAnalysisWithResult(analysisResult, file.name);
} else {
    // Modo genre: análise por gênero tradicional
    __dbg(' Exibindo resultado por gênero');
    await handleGenreAnalysisWithResult(analysisResult, file.name);
}
`

**Impacto**: Implementa o fluxo correto:
- mode='reference'  Abre modal secundário para upload da referência
- mode='comparison'  Exibe resultado final com duas colunas
- mode='genre'  Exibe resultado tradicional

---

### 3. Nova função openReferenceUploadModal (linha ~1878)

**Código completo:**
`javascript
function openReferenceUploadModal(referenceJobId, firstAnalysisResult) {
    __dbg(' Abrindo modal secundário para música de referência', { referenceJobId });
    
    window.logReferenceEvent('reference_upload_modal_opened', { referenceJobId });
    
    // Armazenar jobId da primeira música em variável global
    window.__REFERENCE_JOB_ID__ = referenceJobId;
    window.__FIRST_ANALYSIS_RESULT__ = firstAnalysisResult;
    
    // Fechar modal atual (se estiver aberto)
    closeAudioModal();
    
    // Resetar estado do modal
    resetModalState();
    
    // Mudar modo para comparison
    currentAnalysisMode = 'comparison';
    
    // Abrir modal novamente
    const modal = document.getElementById('audioAnalysisModal');
    if (!modal) {
        console.error(' Modal de análise de áudio não encontrado');
        return;
    }
    
    // Atualizar título e instruções do modal
    const modalTitle = document.getElementById('audioModalTitle');
    const modalSubtitle = document.getElementById('audioModalSubtitle');
    
    if (modalTitle) {
        modalTitle.innerHTML = ' Upload da Música de Referência';
    }
    
    if (modalSubtitle) {
        modalSubtitle.innerHTML = '<span id=\"audioModeIndicator\">Etapa 2/2: Envie a música de referência para comparação</span>';
        modalSubtitle.style.display = 'block';
    }
    
    // Atualizar mensagem na área de upload
    const uploadArea = document.getElementById('audioUploadArea');
    if (uploadArea) {
        const uploadContent = uploadArea.querySelector('.upload-content h4');
        if (uploadContent) {
            uploadContent.textContent = 'Enviar música de referência';
        }
        
        const uploadDescription = uploadArea.querySelector('.upload-content p');
        if (uploadDescription) {
            uploadDescription.textContent = 'Arraste a música de referência aqui ou clique para selecionar';
        }
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    __dbg(' Modal secundário de referência aberto');
}
`

**Impacto**: Reaproveita o modal principal #audioAnalysisModal, alterando:
- Título: " Upload da Música de Referência"
- Subtítulo: "Etapa 2/2: Envie a música de referência para comparação"
- Armazena eferenceJobId em window.__REFERENCE_JOB_ID__
- Muda currentAnalysisMode para 'comparison'

---

### 4. Modificação da função createAnalysisJob (linha ~314)

**Antes:**
`javascript
const response = await fetch('/api/audio/analyze', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
        fileKey: fileKey,
        mode: mode,
        fileName: fileName
    })
});
`

**Depois:**
`javascript
//  NOVO: Preparar payload com referenceJobId se disponível
const payload = {
    fileKey: fileKey,
    mode: mode,
    fileName: fileName
};

// Se estiver no modo comparison e temos o referenceJobId, incluir
if (mode === 'comparison' && window.__REFERENCE_JOB_ID__) {
    payload.referenceJobId = window.__REFERENCE_JOB_ID__;
    __dbg(' Incluindo referenceJobId no payload:', window.__REFERENCE_JOB_ID__);
}

const response = await fetch('/api/audio/analyze', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify(payload)
});
`

**Impacto**: Envia eferenceJobId no payload quando modo = 'comparison', permitindo o backend vincular as análises.

---

##  FLUXO COMPLETO IMPLEMENTADO

### Modo Genre (tradicional):
1. Usuário faz upload da música
2. createAnalysisJob(fileKey, 'genre', fileName)  worker processa
3. pollJobStatus(jobId) retorna { mode: 'genre', result: {...} }
4. Frontend chama displayModalResults(result)  modal com uma coluna

### Modo Reference (novo):
1. Usuário faz upload da primeira música
2. createAnalysisJob(fileKey, 'reference', fileName)  worker processa
3. pollJobStatus(jobId) retorna { mode: 'reference', jobId: 'xxx', result: {...} }
4. Frontend detecta mode='reference' e chama openReferenceUploadModal(jobId, result)
5. Modal principal reabre com título "Upload da Música de Referência"
6. Usuário faz upload da segunda música
7. createAnalysisJob(fileKey, 'comparison', fileName, referenceJobId)  worker processa comparison
8. pollJobStatus(jobId) retorna { mode: 'comparison', result: {...} }
9. Frontend detecta mode='comparison' e chama displayModalResults(result)  modal com duas colunas

---

##  COMPATIBILIDADE COM BACKEND

O backend já está preparado para:
- Aceitar eferenceJobId no payload do POST /api/audio/analyze
- Retornar mode no objeto do job
- Worker processar modo 'comparison' com duas músicas

**Não foi necessário modificar o backend.**

---

##  CHECKLIST DE TESTES

- [ ] Modo genre: Upload  Análise  Modal resultado (1 coluna)
- [ ] Modo reference: Upload 1  Modal secundário aberto
- [ ] Modo reference: Upload 2  Modal resultado (2 colunas)
- [ ] Verificar eferenceJobId sendo enviado no payload
- [ ] Verificar logs no console: __dbg(' ...')
- [ ] Testar cancelamento do fluxo (fechar modal no meio)
- [ ] Testar erro de upload (conexão falha)

---

##  VARIÁVEIS GLOBAIS CRIADAS

- window.__REFERENCE_JOB_ID__: Armazena jobId da primeira música
- window.__FIRST_ANALYSIS_RESULT__: Armazena resultado da primeira análise (opcional)

---

##  OBSERVAÇÕES IMPORTANTES

1. **Não altere o modal de resultado existente**: A função displayModalResults já lida com comparações se houver nalysis.comparison nos dados.

2. **Feature flags**: O modo reference pode ser controlado por window.FEATURE_FLAGS.REFERENCE_MODE_ENABLED.

3. **Logs**: Todos os logs importantes usam __dbg(' ...') para facilitar debug.

4. **Limpeza**: Considere limpar window.__REFERENCE_JOB_ID__ após exibir resultado final.

---

**Status**:  IMPLEMENTAÇÃO COMPLETA
**Próximo passo**: Testes manuais com uploads reais
