# 🧪 GUIA DE TESTE: CTA Primeira Análise - Modo DEMO

**Data:** 22 de janeiro de 2026  
**Versão:** 1.0.0  
**Tempo estimado:** 10-15 minutos

---

## 🎯 OBJETIVO DO TESTE

Validar que o CTA de conversão aparece **imediatamente após a primeira análise concluída** em modo demo, sem afetar outros fluxos do sistema.

---

## 📋 PRÉ-REQUISITOS

- ✅ Servidor local rodando (`node server.js`)
- ✅ Navegador moderno (Chrome, Firefox, Edge)
- ✅ Console do navegador aberto (F12)
- ✅ Arquivo de áudio para teste (qualquer formato comum)

---

## 🧪 TESTE 1: Primeira Análise em Modo DEMO

### Objetivo
Verificar que o CTA aparece após a primeira análise e não bloqueia visualização.

### Passos

1. **Acessar modo demo:**
   ```
   http://localhost:3000?mode=demo
   ```

2. **Verificar no console:**
   ```javascript
   // Deve aparecer:
   🔥 [DEMO-CORE] Modo demo ativo
   🔥 [DEMO-UI] Módulo UI carregado
   ✅ [VALIDAÇÃO] Todos os testes passaram
   ```

3. **Fazer upload de áudio:**
   - Clicar no botão de análise
   - Selecionar arquivo de áudio
   - Aguardar análise completar

4. **Aguardar resultado aparecer:**
   - Resultado da análise deve ser exibido normalmente
   - Gráficos e métricas carregam corretamente

5. **⏱️ Após ~2 segundos:**
   - ✅ **ESPERADO:** Banner CTA aparece no topo
   - ✅ **ESPERADO:** Banner CTA aparece no rodapé
   - ✅ **VERIFICAR:** Scroll da página funciona normalmente
   - ✅ **VERIFICAR:** Resultado continua visível

6. **Verificar design do CTA:**
   ```
   Texto esperado:
   "🎉 Você acabou de rodar sua análise teste!"
   "Entre aqui para desbloquear mais análises..."
   
   Botão: "GARANTIR MAIS ANÁLISES →"
   ```

7. **Clicar no botão:**
   - ✅ **ESPERADO:** Redireciona para `musicaprofissional.com.br`
   - ✅ **VERIFICAR:** Tracking registrado no console (se habilitado)

8. **Recarregar a página:**
   - ✅ **ESPERADO:** CTA NÃO aparece novamente (sessionStorage)
   - ✅ **VERIFICAR:** Sistema funciona normalmente

9. **Limpar sessão e repetir:**
   ```javascript
   // Console
   sessionStorage.removeItem('demo_first_cta_shown');
   location.reload();
   ```
   - ✅ **ESPERADO:** CTA aparece novamente após análise

### ✅ Critérios de Sucesso

- [ ] CTA aparece após primeira análise (2-3s de delay)
- [ ] Banner no topo e rodapé visíveis
- [ ] Scroll da página funciona
- [ ] Resultado da análise permanece visível
- [ ] Botão redireciona corretamente
- [ ] CTA não aparece novamente na mesma sessão
- [ ] CTA aparece novamente após limpar sessão

---

## 🧪 TESTE 2: Segunda Tentativa em Modo DEMO

### Objetivo
Verificar que o modal bloqueante continua funcionando normalmente.

### Passos

1. **Após primeira análise (com CTA banner):**
   - Não fechar ou recarregar a página

2. **Tentar fazer nova análise:**
   - Clicar novamente no botão de análise
   - Ou tentar fazer upload de novo arquivo

3. **Resultado esperado:**
   - ✅ **ESPERADO:** Modal bloqueante aparece IMEDIATAMENTE
   - ✅ **ESPERADO:** Mensagem: "Análise demonstrativa concluída"
   - ✅ **ESPERADO:** Impossível continuar sem upgrade
   - ✅ **VERIFICAR:** Comportamento original mantido

### ✅ Critérios de Sucesso

- [ ] Modal bloqueante aparece na segunda tentativa
- [ ] Modal bloqueia toda a interface
- [ ] Impossível fechar modal (bloqueante)
- [ ] Único CTA disponível: "Voltar para página do produto"
- [ ] Comportamento idêntico ao anterior

---

## 🧪 TESTE 3: Usuário Pago (PRO/STUDIO)

### Objetivo
Garantir que CTA NÃO afeta usuários pagos.

### Passos

1. **Login com conta PRO ou STUDIO:**
   ```
   http://localhost:3000
   ```

2. **Fazer primeira análise:**
   - Upload de áudio
   - Aguardar análise completar

3. **Aguardar ~5 segundos:**
   - ✅ **ESPERADO:** NENHUM CTA aparece
   - ✅ **ESPERADO:** Nenhum banner
   - ✅ **ESPERADO:** Sistema 100% normal

4. **Fazer segunda, terceira, quarta análise:**
   - ✅ **ESPERADO:** NENHUM CTA aparece
   - ✅ **ESPERADO:** Análises ilimitadas
   - ✅ **ESPERADO:** Zero interferência

5. **Verificar console:**
   ```javascript
   // Deve mostrar:
   window.SoundyDemo?.isActive; // false (ou undefined)
   ```

### ✅ Critérios de Sucesso

- [ ] NENHUM CTA aparece para usuários pagos
- [ ] Sistema funciona 100% normalmente
- [ ] Análises ilimitadas
- [ ] Zero logs de demo no console
- [ ] Demo mode não está ativo

---

## 🧪 TESTE 4: Modo Anônimo (Sem Login)

### Objetivo
Verificar que modo anônimo não é afetado.

### Passos

1. **Acessar sem modo demo:**
   ```
   http://localhost:3000
   ```
   (Sem `?mode=demo` na URL)

2. **Fazer análise anônima:**
   - Upload de áudio
   - Aguardar análise completar

3. **Verificar comportamento:**
   - ✅ **ESPERADO:** Sistema anônimo funciona normalmente
   - ✅ **ESPERADO:** Seus próprios limites aplicam
   - ✅ **ESPERADO:** NENHUM CTA de demo aparece

4. **Verificar console:**
   ```javascript
   window.SoundyDemo?.isActive; // false
   window.SoundyAnonymous?.isAnonymousMode; // true
   ```

### ✅ Critérios de Sucesso

- [ ] Modo anônimo não afetado
- [ ] NENHUM CTA de demo aparece
- [ ] Limites anônimos próprios funcionam
- [ ] Zero interferência

---

## 🧪 TESTE 5: Responsividade Mobile

### Objetivo
Verificar que CTA funciona em dispositivos móveis.

### Passos

1. **Abrir DevTools (F12):**
   - Ativar modo mobile (Ctrl+Shift+M)
   - Selecionar dispositivo: iPhone 12 Pro

2. **Acessar modo demo:**
   ```
   http://localhost:3000?mode=demo
   ```

3. **Fazer primeira análise:**
   - Upload de áudio
   - Aguardar resultado

4. **Verificar CTA:**
   - ✅ **VERIFICAR:** Banners adaptam ao mobile
   - ✅ **VERIFICAR:** Texto legível
   - ✅ **VERIFICAR:** Botão clicável (tamanho adequado)
   - ✅ **VERIFICAR:** Scroll funciona

5. **Testar em diferentes tamanhos:**
   - iPhone SE (375px)
   - iPad (768px)
   - Desktop (1920px)

### ✅ Critérios de Sucesso

- [ ] CTA totalmente responsivo
- [ ] Texto legível em todos os tamanhos
- [ ] Botão clicável facilmente
- [ ] Layout não quebra
- [ ] Scroll suave

---

## 🐛 COMANDOS DE DEBUG

### Forçar exibição do CTA
```javascript
// Limpar sessão
sessionStorage.removeItem('demo_first_cta_shown');

// Forçar exibição
window.SoundyDemo.showFirstAnalysisCTA();
```

### Verificar estado atual
```javascript
// Ver estado completo
window.DEMO_TEST.checkState();

// Ou manualmente:
console.log({
    demoAtivo: window.SoundyDemo?.isActive,
    analisesUsadas: window.SoundyDemo?.data?.analyses_used,
    limiteMaximo: window.SoundyDemo?.config?.limits?.maxAnalyses,
    ctaMostrado: !!sessionStorage.getItem('demo_first_cta_shown')
});
```

### Simular primeira análise
```javascript
// Resetar contador
window.SoundyDemo.data.analyses_used = 0;

// Simular registro
window.SoundyDemo.registerAnalysis();

// Aguardar CTA aparecer (~2s)
```

### Habilitar logs de validação
```javascript
// Descomentar no index.html:
<script src="demo-first-analysis-cta-validation.js?v=20260122" defer></script>

// Recarregar página
// Logs automáticos aparecerão no console
```

---

## 📊 RELATÓRIO DE TESTE

Preencher após completar todos os testes:

### Resumo
```
Data do teste: ___/___/______
Testador: _________________
Navegador: ________________
Versão: ___________________
```

### Resultados

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Primeira análise demo | ⬜ PASS / ⬜ FAIL | |
| 2. Segunda tentativa demo | ⬜ PASS / ⬜ FAIL | |
| 3. Usuário pago | ⬜ PASS / ⬜ FAIL | |
| 4. Modo anônimo | ⬜ PASS / ⬜ FAIL | |
| 5. Responsividade | ⬜ PASS / ⬜ FAIL | |

### Bugs Encontrados
```
1. _____________________________________
2. _____________________________________
3. _____________________________________
```

### Aprovação Final
```
⬜ APROVADO - Pronto para produção
⬜ REPROVADO - Necessita correções
⬜ APROVADO COM RESSALVAS - Pequenos ajustes
```

---

## 🚀 PRÓXIMOS PASSOS

### Se TODOS os testes passarem:
1. ✅ Commit das alterações
2. ✅ Push para repositório
3. ✅ Deploy para staging (se disponível)
4. ✅ Teste em staging
5. ✅ Deploy para produção
6. ✅ Monitorar métricas de conversão

### Se algum teste FALHAR:
1. ❌ Documentar o erro
2. 🔧 Corrigir o problema
3. 🔄 Repetir os testes
4. ✅ Apenas prosseguir quando 100% passou

---

## 📞 SUPORTE

### Em caso de dúvidas:
- Consultar: `AUDIT_CTA_DEMO_PRIMEIRA_ANALISE_2026-01-22.md`
- Consultar: `IMPLEMENTACAO_CTA_DEMO_RESUMO_EXECUTIVO.md`
- Verificar: Console do navegador (logs detalhados)

### Logs esperados:
```
✅ [DEMO-CORE] Módulo carregado
✅ [DEMO-GUARDS] Módulo carregado  
✅ [DEMO-UI] Módulo carregado
🎉 [DEMO-GUARDS] Primeira análise concluída
🎉 [DEMO-UI] Exibindo CTA não-bloqueante
✅ [DEMO-UI] Banners CTA exibidos
```

---

**Boa sorte com os testes! 🚀**
