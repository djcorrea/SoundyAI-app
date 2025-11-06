# 🧪 GUIA DE TESTES - SISTEMA DE SESSÕES ISOLADAS

**Data**: 2024  
**Objetivo**: Validar funcionamento completo do sistema de sessões isoladas  
**Arquivo**: `public/audio-analyzer-integration.js`

---

## 🎯 PRÉ-REQUISITOS

1. **Abrir DevTools do navegador** (F12)
2. **Ativar console** para ver logs
3. **Ter 4 arquivos de áudio diferentes** para testes:
   - `musica_A.mp3`
   - `musica_B.mp3`
   - `musica_C.mp3`
   - `musica_D.mp3`

---

## ✅ TESTE 1: COMPARAÇÃO NORMAL (FLUXO HAPPY PATH)

### **Objetivo**
Verificar que sistema de sessões funciona corretamente em fluxo normal.

### **Passos**

1. **Recarregar página** (F5)

2. **Upload primeira música** (musica_A.mp3)
   
   **✅ LOGS ESPERADOS:**
   ```
   ✅ [SESSION-CREATED] Nova sessão criada: <uuid>
   [SESSION-SAVE] Salvando primeira música: { fileName: "musica_A.mp3", jobId: "..." }
   ```
   
   **✅ VALIDAÇÃO NO CONSOLE:**
   ```javascript
   window.__CURRENT_SESSION_ID__ // Deve retornar UUID
   ```

3. **Upload segunda música** (musica_B.mp3)
   
   **✅ LOGS ESPERADOS:**
   ```
   [SESSION-SAVE] Salvando segunda música: { fileName: "musica_B.mp3", jobId: "..." }
   ✅ [SESSION-READY] Sessão pronta para uso: <uuid>
   ```
   
   **✅ VALIDAÇÃO NO CONSOLE:**
   ```javascript
   listAnalysisSessions() // Deve mostrar 1 sessão ready
   ```

4. **Abrir modal de resultados**
   
   **✅ LOGS ESPERADOS:**
   ```
   🎯 [SESSION-FLOW] Dados da sessão anexados ao normalizedResult
   🎯 [SESSION-PRIORITY] Usando dados da sessão isolada como fonte de verdade
   ✅ [SESSION-PRIORITY] Dados da sessão normalizados
   ✅ [SESSION-MODE] Renderização usando dados da sessão isolada
   ✅ [SESSION-VALIDATED] Sessão validada - dados isolados confirmados
   ```
   
   **✅ VALIDAÇÃO NA TABELA CONSOLE:**
   ```
   sessionId: <uuid>
   refJobId: <job1>
   currJobId: <job2>
   refName: "musica_A.mp3"
   currName: "musica_B.mp3"
   sameJob: false  ← CRÍTICO
   sameName: false ← CRÍTICO
   ```

5. **Verificar comparação exibida**
   
   **✅ VALIDAÇÕES VISUAIS:**
   - [ ] Primeira música = musica_A.mp3
   - [ ] Segunda música = musica_B.mp3
   - [ ] Score de compatibilidade exibido
   - [ ] Tabela de comparação presente
   - [ ] Sugestões de IA presentes (se houver)

### **Resultado Esperado**
✅ **PASSOU** se todos os logs aparecerem e comparação estiver correta  
❌ **FALHOU** se aparecer logs de `[LEGACY-MODE]` ou contaminação

---

## 🔄 TESTE 2: EMERGENCY RECOVERY

### **Objetivo**
Verificar que sistema recupera primeira música se sessionId for perdido.

### **Passos**

1. **Recarregar página** (F5)

2. **Upload primeira música** (musica_A.mp3)
   
   **✅ LOG ESPERADO:**
   ```
   ✅ [SESSION-CREATED] Nova sessão criada: <uuid>
   ```

3. **SIMULAR PERDA DE SESSÃO** (executar no console):
   ```javascript
   delete window.__CURRENT_SESSION_ID__
   ```

4. **Upload segunda música** (musica_B.mp3)
   
   **✅ LOGS ESPERADOS:**
   ```
   ⚠️ [SESSION-RECOVERY] SessionId não encontrado - criando emergency session
   ✅ [SESSION-RECOVERY] Primeira música recuperada do FirstAnalysisStore
   ✅ [SESSION-RECOVERY] Sessão de emergência criada e populada
   ```

5. **Abrir modal de resultados**
   
   **✅ VALIDAÇÃO:**
   - [ ] Comparação funciona normalmente
   - [ ] Primeira música = musica_A.mp3
   - [ ] Segunda música = musica_B.mp3
   - [ ] Sem erros no console

### **Resultado Esperado**
✅ **PASSOU** se recovery funcionar e comparação for exibida corretamente  
❌ **FALHOU** se aparecer erro ou comparação incorreta

---

## 🔢 TESTE 3: MÚLTIPLAS COMPARAÇÕES CONSECUTIVAS

### **Objetivo**
Verificar que múltiplas comparações não vazam dados entre si.

### **Passos**

1. **Recarregar página** (F5)

2. **COMPARAÇÃO 1:**
   - Upload musica_A.mp3
   - Upload musica_B.mp3
   - Abrir modal → Verificar comparação correta
   - **Fechar modal**
   
   **✅ VALIDAÇÃO NO CONSOLE:**
   ```javascript
   const session1 = window.__CURRENT_SESSION_ID__;
   console.log('Session 1:', session1);
   ```

3. **COMPARAÇÃO 2:**
   - Upload musica_C.mp3
   - Upload musica_D.mp3
   - Abrir modal → Verificar comparação correta
   - **Fechar modal**
   
   **✅ VALIDAÇÃO NO CONSOLE:**
   ```javascript
   const session2 = window.__CURRENT_SESSION_ID__;
   console.log('Session 2:', session2);
   console.log('Sessions diferentes?', session1 !== session2);
   ```

4. **Listar todas as sessões:**
   ```javascript
   listAnalysisSessions()
   ```
   
   **✅ VALIDAÇÃO:**
   - [ ] Mostra 2 sessões diferentes
   - [ ] Sessão 1: musica_A vs musica_B
   - [ ] Sessão 2: musica_C vs musica_D
   - [ ] Nenhuma contaminação entre sessões

### **Resultado Esperado**
✅ **PASSOU** se cada comparação usar sessionId diferente e dados isolados  
❌ **FALHOU** se dados de uma comparação aparecerem em outra

---

## 🚨 TESTE 4: DETECÇÃO DE CONTAMINAÇÃO

### **Objetivo**
Verificar que sistema detecta e bloqueia sessões contaminadas.

### **Passos**

1. **Recarregar página** (F5)

2. **Upload primeira música** (musica_A.mp3)
   
   **✅ CAPTURAR SESSIONID:**
   ```javascript
   const sessionId = window.__CURRENT_SESSION_ID__;
   ```

3. **SIMULAR CONTAMINAÇÃO** (executar no console):
   ```javascript
   // Forçar jobIds iguais (simulando bug)
   const session = window.AnalysisSessions[sessionId];
   const sameJobId = session.reference.jobId;
   
   // Criar objeto "current" com MESMO jobId (contaminação simulada)
   session.current = JSON.parse(JSON.stringify(session.reference));
   session.ready = true;
   
   console.log('🔴 CONTAMINAÇÃO SIMULADA:', {
     refJobId: session.reference.jobId,
     currJobId: session.current.jobId,
     sameJobId: session.reference.jobId === session.current.jobId
   });
   ```

4. **Tentar abrir modal:**
   - Executar: `displayModalResults(window.latestAnalysis)`
   
   **✅ LOGS ESPERADOS:**
   ```
   🚨 [SESSION-ERROR] CONTAMINAÇÃO NA SESSÃO!
      - sessionId: <uuid>
      - Ambos têm jobId: <jobId>
   🚨 [SESSION-ERROR] SESSÃO CONTAMINADA!
   ```
   
   **✅ VALIDAÇÃO:**
   - [ ] alert() aparece: "ERRO: Sessão contaminada detectada"
   - [ ] Renderização é bloqueada
   - [ ] console.trace() mostra stack trace

### **Resultado Esperado**
✅ **PASSOU** se sistema detectar contaminação e bloquear renderização  
❌ **FALHOU** se renderização continuar mesmo com jobIds iguais

---

## 🔍 TESTE 5: AUDITORIA AUTOMÁTICA

### **Objetivo**
Verificar que sistema mostra auditoria em cada acesso aos dados.

### **Passos**

1. **Recarregar página** (F5)

2. **Upload primeira música** (musica_A.mp3)

3. **Upload segunda música** (musica_B.mp3)

4. **Abrir modal de resultados**

5. **Procurar no console por:**
   ```
   🎯 [RENDER-REF] VALIDAÇÃO DE FONTE DE DADOS
   ```

6. **Verificar console.table:**
   
   **✅ COLUNAS ESPERADAS:**
   ```
   | sessionId      | refJobId | currJobId | refName        | currName       | sameJob | sameName |
   |----------------|----------|-----------|----------------|----------------|---------|----------|
   | abc123-uuid... | job1     | job2      | musica_A.mp3   | musica_B.mp3   | false   | false    |
   ```

7. **Verificar logs detalhados:**
   ```
   ✅ [SESSION-PRIORITY] Dados da sessão normalizados:
      - refNormalized.jobId: job1
      - currNormalized.jobId: job2
      - refNormalized.fileName: musica_A.mp3
      - currNormalized.fileName: musica_B.mp3
   ```

### **Resultado Esperado**
✅ **PASSOU** se console.table aparecer com dados corretos em cada renderização  
❌ **FALHOU** se auditoria não aparecer ou mostrar dados incorretos

---

## 📊 TESTE 6: MODO LEGADO (BACKWARD COMPATIBILITY)

### **Objetivo**
Verificar que sistema cai para modo legado se sessão não disponível.

### **Passos**

1. **Recarregar página** (F5)

2. **Upload primeira música** (musica_A.mp3)

3. **DESTRUIR SISTEMA DE SESSÕES** (executar no console):
   ```javascript
   delete window.AnalysisSessions;
   delete window.__CURRENT_SESSION_ID__;
   ```

4. **Upload segunda música** (musica_B.mp3)

5. **Abrir modal de resultados**
   
   **✅ LOGS ESPERADOS:**
   ```
   ⚠️ [SESSION-FLOW] Sessão não disponível - usando modo legado
   ⚠️ [LEGACY-MODE] Sessão não disponível, usando modo legado
   ⚠️ [LEGACY-MODE] Renderização usando sistema legado
   ```

6. **Verificar comparação:**
   
   **✅ VALIDAÇÃO:**
   - [ ] Comparação ainda funciona
   - [ ] Primeira música = musica_A.mp3
   - [ ] Segunda música = musica_B.mp3
   - [ ] Usa `FirstAnalysisStore` como fallback

### **Resultado Esperado**
✅ **PASSOU** se modo legado funcionar corretamente como fallback  
❌ **FALHOU** se sistema quebrar sem sessões

---

## 🧹 TESTE 7: LIMPEZA DE SESSÕES

### **Objetivo**
Verificar funções utilitárias de gerenciamento de sessões.

### **Passos**

1. **Criar 3 sessões:**
   - Comparação 1: musica_A vs musica_B
   - Comparação 2: musica_C vs musica_D
   - Comparação 3: musica_A vs musica_C

2. **Listar sessões:**
   ```javascript
   const sessions = listAnalysisSessions();
   console.log('Total de sessões:', sessions.length); // Deve ser 3
   ```

3. **Limpar sessão específica:**
   ```javascript
   const firstSessionId = sessions[0];
   const removed = clearAnalysisSession(firstSessionId);
   console.log('Sessão removida?', removed); // Deve ser true
   ```

4. **Verificar lista atualizada:**
   ```javascript
   const updatedSessions = listAnalysisSessions();
   console.log('Total agora:', updatedSessions.length); // Deve ser 2
   ```

### **Resultado Esperado**
✅ **PASSOU** se funções de gerenciamento funcionarem corretamente  
❌ **FALHOU** se limpeza não funcionar ou dados permanecerem

---

## 📝 CHECKLIST FINAL

Após todos os testes, verificar:

### **Funcionalidades Core**
- [ ] Sessão criada no primeiro upload
- [ ] Sessão salva no segundo upload
- [ ] getSessionPair retorna clones independentes
- [ ] Auditoria automática funcionando
- [ ] Detecção de contaminação funcionando

### **Integridade de Dados**
- [ ] jobIds sempre diferentes entre ref e curr
- [ ] fileNames sempre diferentes entre ref e curr
- [ ] Deep clones em todas operações
- [ ] Nenhuma mutação de objetos originais

### **Recovery e Fallback**
- [ ] Emergency recovery funciona
- [ ] Modo legado funciona como fallback
- [ ] Sistema nunca quebra completamente

### **Logs e Debug**
- [ ] Logs claros em cada operação
- [ ] console.table mostra dados corretos
- [ ] console.trace em erros críticos
- [ ] Flags `[SESSION-MODE]` vs `[LEGACY-MODE]` corretas

---

## 🎯 CRITÉRIOS DE SUCESSO

### **✅ SISTEMA APROVADO SE:**
1. Todos os 7 testes passarem
2. Nenhum log de contaminação em fluxo normal
3. Múltiplas comparações funcionarem sem vazamento
4. Emergency recovery funcionar
5. Modo legado funcionar como fallback

### **❌ SISTEMA REPROVADO SE:**
1. Qualquer teste falhar
2. Contaminação não for detectada
3. jobIds iguais aparecerem em sessão válida
4. Sistema quebrar sem sessão disponível

---

## 🔧 COMANDOS ÚTEIS NO CONSOLE

```javascript
// Verificar sessionId atual
window.__CURRENT_SESSION_ID__

// Listar todas as sessões
listAnalysisSessions()

// Ver detalhes de uma sessão
window.AnalysisSessions[window.__CURRENT_SESSION_ID__]

// Verificar se sessão está pronta
window.AnalysisSessions[window.__CURRENT_SESSION_ID__]?.ready

// Limpar sessão atual
clearAnalysisSession(window.__CURRENT_SESSION_ID__)

// Limpar todas as sessões (debug)
window.AnalysisSessions = {}

// Simular perda de sessionId
delete window.__CURRENT_SESSION_ID__

// Verificar sistema legado
FirstAnalysisStore.has()
FirstAnalysisStore.get()
```

---

## 📞 TROUBLESHOOTING

### **Problema: Logs de sessão não aparecem**
**Solução**: Verificar se DevTools está aberto antes do upload

### **Problema: sessionId sempre undefined**
**Solução**: Verificar se sistema de sessões foi carregado (procurar "VIRTUAL-ID-SYSTEM" nos primeiros logs)

### **Problema: Sempre cai para modo legado**
**Solução**: Verificar se `window.AnalysisSessions` existe (executar `window.AnalysisSessions` no console)

### **Problema: Contaminação não detectada**
**Solução**: Verificar se teste 4 foi executado corretamente e getSessionPair foi chamado

---

## 🎉 CONCLUSÃO

Após executar todos os testes e validar o checklist final, o sistema de sessões isoladas estará **completamente validado** e pronto para uso em produção.

**Próximos passos após validação:**
1. Documentar casos de edge encontrados
2. Adicionar testes automatizados (opcional)
3. Monitorar logs em produção
4. Planejar deprecação gradual do sistema legado
