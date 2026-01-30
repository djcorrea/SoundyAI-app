# 🧪 CHECKLIST DE TESTES - SISTEMA DE AFILIADOS V2

## Data: 27 de janeiro de 2026
## Responsável: Equipe SoundyAI
## Objetivo: Validar arquitetura de rastreamento com visitorId

---

## 📋 PRÉ-REQUISITOS

### 1. Firestore Rules
- [ ] Deploy das regras em `firestore-rules-referral-visitors.rules`
- [ ] Validar no Console Firebase que a coleção `referral_visitors` existe
- [ ] Confirmar permissão de CREATE anônimo e UPDATE bloqueado

### 2. Índices Firestore
- [ ] Criar índice: `referral_visitors` WHERE `partnerId` ASC + `registered` ASC
- [ ] Criar índice: `referral_visitors` WHERE `partnerId` ASC + `converted` ASC
- [ ] Criar índice: `referral_visitors` WHERE `uid` ASC

### 3. Ambiente de Teste
- [ ] Usar navegador em modo anônimo (Ctrl+Shift+N)
- [ ] Abrir DevTools (F12) → Console
- [ ] Limpar localStorage antes de cada teste

---

## 🧪 TESTE 1: CAPTURA DE VISITANTE (Primeira Visita)

### Objetivo
Validar que visitante anônimo com `?ref=papohertz` cria documento no Firestore.

### Passos
1. [ ] Limpar localStorage: `localStorage.clear()`
2. [ ] Acessar: `https://soundyai-app-soundyai-teste.up.railway.app/?ref=papohertz`
3. [ ] Aguardar 3 segundos (carregamento assíncrono)
4. [ ] Verificar console:
   - [ ] Log `🆔 [VISITOR] Novo visitante gerado: [UUID]`
   - [ ] Log `🔗 [REFERRAL] Código capturado: papohertz`
   - [ ] Log `✅ [VISITOR] Registro criado no Firestore!`

### Validação Firestore
5. [ ] Abrir Console Firebase → Firestore Database
6. [ ] Navegar: `referral_visitors/{visitorId}`
7. [ ] Verificar campos:
   ```
   visitorId: [UUID gerado]
   partnerId: "papohertz"
   registered: false
   uid: null
   converted: false
   plan: null
   convertedAt: null
   firstSeenAt: [timestamp]
   lastSeenAt: [timestamp]
   userAgent: [string]
   referrer: [string ou null]
   ```

### Validação localStorage
8. [ ] Console: `localStorage.getItem('soundy_visitor_id')`
9. [ ] Deve retornar o mesmo UUID do Firestore
10. [ ] Console: `localStorage.getItem('soundy_referral_code')`
11. [ ] Deve retornar: `"papohertz"`

### Critério de Sucesso
✅ Documento criado no Firestore com `registered=false` e `partnerId="papohertz"`

---

## 🧪 TESTE 2: DEMO SEM CADASTRO (Persistência de visitorId)

### Objetivo
Validar que demo funciona normalmente e visitorId persiste entre páginas.

### Passos
1. [ ] (Continuando do Teste 1)
2. [ ] Clicar em "Testar Demo" ou acessar `/demo-audio-analyzer.html`
3. [ ] Fazer upload de um arquivo de áudio
4. [ ] Aguardar análise completa
5. [ ] Verificar console:
   - [ ] NUNCA deve aparecer `localStorage.clear()` removendo `soundy_visitor_id`
   - [ ] Log `🆔 [VISITOR] Visitante existente: [UUID]` ao recarregar páginas

### Validação localStorage (Durante Demo)
6. [ ] Console: `localStorage.getItem('soundy_visitor_id')`
7. [ ] Deve retornar o mesmo UUID do Teste 1
8. [ ] Console: `localStorage.getItem('soundy_referral_code')`
9. [ ] Deve retornar: `"papohertz"` (ainda preservado)

### Critério de Sucesso
✅ Demo funciona normalmente sem perder visitorId ou referralCode

---

## 🧪 TESTE 3: CADASTRO VINCULA UID (registered=true)

### Objetivo
Validar que ao criar conta, o `referral_visitors/{visitorId}` é atualizado com uid.

### Passos
1. [ ] (Continuando do Teste 2)
2. [ ] Clicar em "Criar Conta" ou acessar página de cadastro
3. [ ] Cadastrar com:
   - Email: `teste-afiliado-27jan@exemplo.com`
   - Senha: `Teste123!`
4. [ ] Aguardar criação da conta
5. [ ] Verificar console:
   - [ ] Log `🔗 [REFERRAL-V2] Visitor ID: [UUID]`
   - [ ] Log `💾 [REFERRAL-V2] Atualizando referral_visitors com uid...`
   - [ ] Log `✅ [REFERRAL-V2] Visitante atualizado com uid: [UID]`
   - [ ] Log `✅ [AUTH-LISTENER] Documento usuarios/ criado com sucesso!`

### Validação Firestore (referral_visitors)
6. [ ] Firestore → `referral_visitors/{visitorId do Teste 1}`
7. [ ] Verificar campos atualizados:
   ```
   registered: true (ALTERADO)
   uid: [UID do Firebase Auth] (PREENCHIDO)
   registeredAt: [timestamp] (NOVO)
   updatedAt: [timestamp] (ATUALIZADO)
   ```

### Validação Firestore (usuarios)
8. [ ] Firestore → `usuarios/{uid}`
9. [ ] Verificar campos:
   ```
   visitorId: [UUID do Teste 1]
   referralCode: "papohertz"
   referralTimestamp: [ISO string]
   convertedAt: null (ainda não pagante)
   ```

### Validação localStorage (Após Cadastro)
10. [ ] Console: `localStorage.getItem('soundy_visitor_id')`
11. [ ] Deve retornar: `[UUID]` (MANTIDO)
12. [ ] Console: `localStorage.getItem('soundy_referral_code')`
13. [ ] Deve retornar: `null` (LIMPO após cadastro bem-sucedido)

### Critério de Sucesso
✅ `referral_visitors/{visitorId}` atualizado com `registered=true` e `uid`
✅ `usuarios/{uid}` criado com `visitorId` e `referralCode`

---

## 🧪 TESTE 4: CONVERSÃO VIA STRIPE (converted=true)

### Objetivo
Validar que compra de plano marca conversão em `referral_visitors`.

### Passos
1. [ ] (Continuando do Teste 3, usuário logado)
2. [ ] Acessar página de planos: `/pricing` ou botão "Assinar"
3. [ ] Selecionar plano "Plus" (R$ 47,99/mês)
4. [ ] Preencher checkout Stripe (usar cartão de teste: `4242 4242 4242 4242`)
5. [ ] Completar pagamento
6. [ ] Aguardar webhook Stripe processar (até 30 segundos)

### Validação Backend (Logs)
7. [ ] Verificar logs do backend:
   - [ ] Log `✅ [REFERRAL-V2] Conversão registrada em usuarios/`
   - [ ] Log `✅ [REFERRAL-V2] Conversão registrada em referral_visitors/`
   - [ ] Log `VisitorId: [UUID]`
   - [ ] Log `Plano: plus`

### Validação Firestore (referral_visitors)
8. [ ] Firestore → `referral_visitors/{visitorId do Teste 1}`
9. [ ] Verificar campos atualizados:
   ```
   converted: true (ALTERADO)
   plan: "plus" (PREENCHIDO)
   convertedAt: [ISO timestamp] (NOVO)
   updatedAt: [timestamp] (ATUALIZADO)
   ```

### Validação Firestore (usuarios)
10. [ ] Firestore → `usuarios/{uid}`
11. [ ] Verificar campos:
    ```
    plan: "plus"
    convertedAt: [ISO timestamp] (PREENCHIDO)
    firstPaidPlan: "plus" (PREENCHIDO)
    subscription.status: "active"
    ```

### Critério de Sucesso
✅ `referral_visitors/{visitorId}` com `converted=true` e `plan="plus"`
✅ `usuarios/{uid}` com `convertedAt` preenchido

---

## 🧪 TESTE 5: PAINEL DO PARCEIRO (Métricas Corretas)

### Objetivo
Validar que dashboard mostra funil completo: visitantes → cadastros → conversões.

### Passos
1. [ ] Acessar: `https://soundyai-app-soundyai-teste.up.railway.app/partner-dashboard.html`
2. [ ] Fazer login com credenciais do parceiro:
   - Email: (criar parceiro no Firestore previamente)
   - Senha: (definir no cadastro)
3. [ ] Aguardar carregamento do dashboard

### Validação Visual
4. [ ] Verificar seção "📊 Funil de Conversão":
   - [ ] **Visitantes**: Deve mostrar `≥ 1` (do Teste 1)
   - [ ] **Cadastros**: Deve mostrar `≥ 1` (do Teste 3)
   - [ ] **Conversões**: Deve mostrar `≥ 1` (do Teste 4)
   - [ ] **Taxa de Cadastro**: `(Cadastros/Visitantes * 100)%`
   - [ ] **Taxa de Conversão**: `(Conversões/Cadastros * 100)%`

### Validação Métricas
5. [ ] Verificar cards de métricas:
   - [ ] **Total de Visitantes**: `≥ 1`
   - [ ] **Total de Cadastros**: `≥ 1`
   - [ ] **Assinantes Ativos**: `≥ 1`
   - [ ] **MRR Gerado**: `R$ 47,99` (ou mais)
   - [ ] **Comissão**: `(MRR * commissionPercent / 100)`

### Validação Console
6. [ ] Abrir DevTools → Console
7. [ ] Verificar logs:
   - [ ] Log `📊 [PARTNER-V2] Métricas brutas:`
   - [ ] Log `Visitantes: [número]`
   - [ ] Log `Cadastros: [número]`
   - [ ] Log `Conversões: [número]`
   - [ ] Log `Assinaturas ativas: [número]`
   - [ ] Log `MRR total: R$ [valor]`

### Critério de Sucesso
✅ Dashboard mostra funil completo com números corretos
✅ MRR e comissão calculados corretamente

---

## 🧪 TESTE 6: PERSISTÊNCIA MULTI-SESSÃO (Cenário Realista)

### Objetivo
Validar que visitorId persiste em visitas separadas (demo hoje → cadastro amanhã).

### Passos
1. [ ] **Sessão 1 (Hoje):**
   - [ ] Limpar localStorage
   - [ ] Acessar: `/?ref=papohertz`
   - [ ] Testar demo
   - [ ] Anotar `visitorId` do console
   - [ ] **FECHAR NAVEGADOR** (não apenas aba)

2. [ ] **Sessão 2 (Simular amanhã - 2 horas depois):**
   - [ ] Abrir navegador novamente
   - [ ] Acessar: `https://soundyai-app-soundyai-teste.up.railway.app` (SEM ?ref)
   - [ ] Verificar console: `🆔 [VISITOR] Visitante existente: [UUID]`
   - [ ] Criar conta
   - [ ] Verificar que cadastro vincula ao `visitorId` da Sessão 1

### Validação
3. [ ] Firestore → `referral_visitors/{visitorId da Sessão 1}`
4. [ ] Confirmar que `registered=true` e `uid` preenchido

### Critério de Sucesso
✅ visitorId persiste entre sessões diferentes (localStorage funciona)
✅ Cadastro em sessão futura vincula ao visitorId original

---

## 🧪 TESTE 7: TROCA DE DISPOSITIVO (Cenário de Falha Conhecido)

### Objetivo
Validar comportamento quando usuário troca de dispositivo entre visita e cadastro.

### Passos
1. [ ] **Dispositivo A (Desktop):**
   - [ ] Acessar: `/?ref=papohertz`
   - [ ] Anotar `visitorId` do console

2. [ ] **Dispositivo B (Mobile):**
   - [ ] Acessar: `https://soundyai-app-soundyai-teste.up.railway.app` (SEM ?ref)
   - [ ] Criar conta com mesmo email

### Validação
3. [ ] Firestore → Verificar 2 documentos:
   - [ ] `referral_visitors/{visitorId-desktop}`: `registered=false`
   - [ ] `usuarios/{uid}`: `visitorId=null` e `referralCode=null`

### Comportamento Esperado
⚠️ **CENÁRIO DE FALHA CONHECIDA:**
- Sistema NÃO rastreará conversão (localStorage não transfere entre dispositivos)
- Solução futura: Implementar link mágico por email ou código QR

### Critério de Sucesso
✅ Sistema não quebra (não gera erro)
✅ Documentado como limitação conhecida

---

## 🧪 TESTE 8: TENTATIVA DE FRAUDE (Segurança)

### Objetivo
Validar que usuário não pode forjar conversões via console.

### Passos
1. [ ] Abrir Console (F12)
2. [ ] Tentar atualizar visitante anônimo:
   ```javascript
   const { doc, updateDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
   const db = getFirestore();
   const visitorRef = doc(db, 'referral_visitors', 'VISITOR_ID_AQUI');
   await updateDoc(visitorRef, { converted: true, plan: 'pro' });
   ```
3. [ ] Aguardar resposta

### Validação
4. [ ] Console deve mostrar erro:
   ```
   FirebaseError: Missing or insufficient permissions.
   ```
5. [ ] Firestore NÃO deve atualizar documento

### Critério de Sucesso
✅ UPDATE bloqueado para frontend (regra `allow update: if false`)
✅ Apenas backend pode atualizar via Admin SDK

---

## 🧪 TESTE 9: IDEMPOTÊNCIA (Não Duplicar Conversões)

### Objetivo
Validar que usuário que já converteu não é marcado novamente.

### Passos
1. [ ] Usar usuário do Teste 4 (já convertido)
2. [ ] Cancelar assinatura no Stripe
3. [ ] Reativar assinatura (novo checkout)
4. [ ] Verificar logs backend

### Validação
5. [ ] Logs devem mostrar:
   ```
   ✅ [REFERRAL-V2] Usuário {uid} já converteu anteriormente em {data}
   ```
6. [ ] Firestore → `referral_visitors/{visitorId}`:
   - [ ] `convertedAt` deve manter data original (não atualizar)

### Critério de Sucesso
✅ Conversão não duplicada (idempotência garantida)

---

## 🧪 TESTE 10: PARCEIRO INATIVO (Validação Backend)

### Objetivo
Validar que conversão não é registrada se parceiro está inativo.

### Passos
1. [ ] Firestore → `partners/papohertz`
2. [ ] Alterar: `active: false`
3. [ ] Repetir Teste 4 (nova compra com novo usuário)

### Validação
4. [ ] Logs backend devem mostrar:
   ```
   ⚠️ [REFERRAL-V2] Parceiro "papohertz" está inativo
   ```
5. [ ] Firestore → `referral_visitors/{visitorId}`:
   - [ ] `converted` deve permanecer `false`

### Critério de Sucesso
✅ Conversão bloqueada quando parceiro inativo

---

## 📊 RESUMO DE VALIDAÇÃO

### Critérios de Aprovação

- [ ] ✅ TESTE 1: Visitante capturado no Firestore
- [ ] ✅ TESTE 2: Demo não perde visitorId
- [ ] ✅ TESTE 3: Cadastro vincula uid ao visitor
- [ ] ✅ TESTE 4: Conversão marca `converted=true`
- [ ] ✅ TESTE 5: Dashboard mostra métricas corretas
- [ ] ✅ TESTE 6: Persistência multi-sessão funciona
- [ ] ⚠️ TESTE 7: Falha em troca de dispositivo (conhecido)
- [ ] ✅ TESTE 8: Fraude bloqueada por regras
- [ ] ✅ TESTE 9: Idempotência garantida
- [ ] ✅ TESTE 10: Validação de parceiro ativo

### Status Geral
- [ ] **TODOS OS TESTES CRÍTICOS PASSARAM** (1-6, 8-10)
- [ ] **TESTE 7 DOCUMENTADO COMO LIMITAÇÃO**

---

## 🚀 PRÓXIMOS PASSOS APÓS TESTES

1. [ ] Deploy das Firestore Rules em produção
2. [ ] Criar índices compostos no Firestore
3. [ ] Monitorar logs por 7 dias
4. [ ] Coletar feedback do parceiro "papohertz"
5. [ ] Implementar melhorias (ex: link mágico para multi-device)

---

## 📞 CONTATO EM CASO DE FALHA

Se qualquer teste crítico falhar:
1. Capturar screenshot do erro
2. Copiar logs completos do console
3. Anotar timestamp exato
4. Reportar para equipe de desenvolvimento

---

**Data de Criação:** 27/01/2026  
**Última Atualização:** 27/01/2026  
**Versão:** 1.0
