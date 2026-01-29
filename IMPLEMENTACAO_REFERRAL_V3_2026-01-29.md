# 🚀 IMPLEMENTAÇÃO: SISTEMA DE AFILIADOS V3
**Data:** 29 de Janeiro de 2026  
**Status:** ✅ IMPLEMENTADO - PRONTO PARA TESTE  
**Versão:** 3.0.0 (Backend-First com Admin SDK)

---

## 📋 RESUMO DA IMPLEMENTAÇÃO

### ✅ O QUE FOI FEITO

**Backend (2 novos endpoints):**
1. `POST /api/referral/track-visitor` - Rastrear visitante com ?ref
2. `POST /api/referral/link-registration` - Vincular cadastro ao afiliado

**Frontend (chamadas ao backend):**
1. `public/index.html` - Chama `/track-visitor` após capturar ?ref
2. `public/auth.js` - Chama `/link-registration` após cadastro

**Servidor:**
1. `server.js` - Rotas registradas com logs informativos

---

## 🔧 ARQUIVOS CRIADOS

### 1️⃣ `api/referral/track-visitor.js` (278 linhas)
**Função:** Rastrear visitante que chegou via ?ref=PARCEIRO

**Recursos:**
- ✅ Validação rigorosa (UUID v4, partnerId, timestamp ISO8601)
- ✅ Usa Admin SDK (bypassa Firestore Rules)
- ✅ Idempotente (merge mode, nunca sobrescreve registered=true)
- ✅ Logs detalhados em todas as etapas
- ✅ Graceful error handling (não bloqueia página)

**Endpoint:**
```javascript
POST /api/referral/track-visitor
Content-Type: application/json

{
  "visitorId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "partnerId": "estudioherta",
  "timestamp": "2026-01-29T12:00:00Z",
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://google.com"
}

// Resposta sucesso:
{
  "success": true,
  "message": "Visitante rastreado com sucesso",
  "data": {
    "visitorId": "f47ac10b-...",
    "partnerId": "estudioherta",
    "isNew": true,
    "timestamp": "2026-01-29T12:00:00.000Z"
  }
}
```

---

### 2️⃣ `api/referral/link-registration.js` (295 linhas)
**Função:** Vincular cadastro de usuário a um visitante rastreado

**Recursos:**
- ✅ Validação rigorosa (Firebase UID, UUID v4)
- ✅ Usa Admin SDK (bypassa Firestore Rules)
- ✅ Idempotente (não falha se já vinculado)
- ✅ **NÃO bloqueia cadastro** se falhar (graceful handling)
- ✅ Detecta tentativa de fraude (mesmo visitor, UIDs diferentes)
- ✅ Logs detalhados de segurança

**Endpoint:**
```javascript
POST /api/referral/link-registration
Content-Type: application/json

{
  "uid": "firebase-uid-abc123",
  "visitorId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}

// Resposta sucesso (vinculado):
{
  "success": true,
  "message": "Cadastro vinculado ao afiliado com sucesso",
  "data": {
    "uid": "firebase-uid-abc123",
    "visitorId": "f47ac10b-...",
    "partnerId": "estudioherta",
    "linked": true,
    "registeredAt": "2026-01-29T12:05:00.000Z"
  }
}

// Resposta sucesso (visitante não existe):
{
  "success": true,
  "message": "Cadastro processado (sem vínculo de afiliado)",
  "reason": "VISITOR_NOT_FOUND",
  "data": {
    "uid": "firebase-uid-abc123",
    "visitorId": "f47ac10b-...",
    "linked": false
  }
}
```

---

## 📝 ARQUIVOS ALTERADOS

### 3️⃣ `server.js` (13 linhas adicionadas)
**Localização:** Após registro de waitlist (linha ~283)

```javascript
// Imports adicionados
import trackVisitorRoute from "./api/referral/track-visitor.js";
import linkRegistrationRoute from "./api/referral/link-registration.js";

// Rotas registradas
app.use("/api/referral/track-visitor", trackVisitorRoute);
app.use("/api/referral/link-registration", linkRegistrationRoute);
console.log('🔗 [REFERRAL-V3] Sistema de afiliados registrado:');
console.log('   - POST /api/referral/track-visitor');
console.log('   - POST /api/referral/link-registration');
```

---

### 4️⃣ `public/index.html` (34 linhas alteradas)
**Localização:** Etapa 3 do sistema de captura de referral (linha ~70-104)

**O que mudou:**
- ❌ **REMOVIDO:** Código que escrevia direto no Firestore (via SDK frontend)
- ✅ **ADICIONADO:** Chamada ao backend `/api/referral/track-visitor`

**Comportamento:**
```javascript
// Captura ?ref da URL → salva localStorage → chama backend
if (partnerId) {
  const apiUrl = window.getAPIUrl('/api/referral/track-visitor');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId, partnerId, timestamp,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    })
  });
  
  const result = await response.json();
  console.log('✅ [REFERRAL-V3] Rastreamento salvo:', result);
}
```

**⚠️ Importante:**
- Erro não bloqueia carregamento da página
- Logs claros para debug
- Usa `window.getAPIUrl` (compatível com ambiente dev/prod)

---

### 5️⃣ `public/auth.js` (58 linhas alteradas)
**Localização:** onAuthStateChanged, após criação do documento usuarios/ (linha ~1660-1690)

**O que mudou:**
- ✅ **ADICIONADO:** Chamada ao backend `/api/referral/link-registration`
- ⚠️ **MANTIDO:** Código legado V2 como fallback temporário

**Comportamento:**
```javascript
if (visitorId && referralCode) {
  // 🔹 PRINCIPAL: Chamar backend V3
  const apiUrl = window.getAPIUrl('/api/referral/link-registration');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: user.uid,
      visitorId: visitorId
    })
  });
  
  const result = await response.json();
  console.log('✅ [REFERRAL-V3] Vinculação:', result);
  
  // 🔹 FALLBACK: Código antigo (será removido após validação)
  try {
    await updateDoc(visitorRef, { registered: true, uid });
    console.log('✅ [REFERRAL-V2-FALLBACK] Também executado');
  } catch (error) {
    console.log('⚠️ [REFERRAL-V2-FALLBACK] Falhou (esperado)');
  }
}
```

**⚠️ Importante:**
- Erro não bloqueia cadastro do usuário
- Logs claros com prefixo [REFERRAL-V3]
- Fallback V2 será removido após testes em produção

---

## 🔐 SEGURANÇA E VALIDAÇÕES

### ✅ Endpoint: track-visitor

**Validações de entrada:**
- `visitorId`: UUID v4 válido (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)
- `partnerId`: String alfanumérica 3-50 chars (regex: `/^[a-z0-9_-]{3,50}$/`)
- `timestamp`: ISO 8601 válido (Date parse)
- `userAgent`: String (opcional)
- `referrer`: String (opcional)

**Proteções:**
- CORS configurado (origem permitida)
- Admin SDK bypassa Firestore Rules
- Merge mode (nunca sobrescreve `registered: true`)
- Logs detalhados de cada etapa

---

### ✅ Endpoint: link-registration

**Validações de entrada:**
- `uid`: Firebase UID válido (20-128 chars)
- `visitorId`: UUID v4 válido

**Proteções:**
- Verifica se documento existe (não bloqueia se não existir)
- Detecta se já vinculado (idempotência)
- Detecta tentativa de vincular outro UID ao mesmo visitor (fraude)
- **CRÍTICO:** Sempre retorna `success: true` (não quebra cadastro)
- Logs de segurança quando detecta anomalias

**Cenários tratados:**
1. ✅ Visitante não existe → Cadastro prossegue sem vínculo
2. ✅ Visitante já vinculado (mesmo UID) → Retorna sucesso (idempotente)
3. ⚠️ Visitante vinculado a UID diferente → Alerta de segurança + cadastro prossegue
4. ✅ Erro inesperado → Cadastro prossegue + log detalhado

---

## 📊 FLUXO COMPLETO (ATUALIZADO)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Visitante acessa: https://soundyai.com/?ref=PARCEIRO     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. index.html (linha 12-145)                                 │
│    - Gera/recupera visitorId (localStorage)                 │
│    - Captura ?ref → partnerId                                │
│    - Salva localStorage (códigos + timestamp)                │
│    - ✅ Chama POST /api/referral/track-visitor               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend: track-visitor.js                                 │
│    - Valida payload                                          │
│    - Verifica se documento existe                            │
│    - Admin SDK: set({ merge: true })                         │
│    - Retorna success                                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ (Visitante usa demo/anonymous)
                         │ (Tempo passa...)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Visitante decide se cadastrar                             │
│    - Preenche formulário                                     │
│    - Envia SMS                                               │
│    - Confirma código                                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. auth.js: confirmSMSAndRegister()                          │
│    - createUserWithEmailAndPassword()                        │
│    - linkWithCredential()                                    │
│    - auth.currentUser.reload()                               │
│    - Aguarda onAuthStateChanged                              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. auth.js: onAuthStateChanged (linha 1520+)                 │
│    - Cria documento usuarios/{uid}                           │
│    - ✅ Chama POST /api/referral/link-registration           │
│    - ⚠️ Tenta código legado V2 (fallback)                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Backend: link-registration.js                             │
│    - Valida uid e visitorId                                  │
│    - Verifica se documento existe                            │
│    - Se existe e registered=false:                           │
│      - Admin SDK: update({ registered: true, uid })          │
│    - Retorna success (sempre)                                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. CADASTRO COMPLETO ✅                                      │
│    - Usuário criado no Firebase Auth                         │
│    - Documento usuarios/{uid} no Firestore                   │
│    - Referral vinculado (se existia visitor)                 │
│    - Painel do parceiro mostra cadastro                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 COMO TESTAR

### Teste 1: Rastreamento de Visitante

```bash
# 1. Acessar com referral
https://localhost:3000/?ref=estudioherta

# 2. Verificar console do navegador
✅ [REFERRAL-V3] Rastreamento salvo com sucesso!
   isNew: true

# 3. Verificar Firestore
# Coleção: referral_visitors
# Documento: {visitorId}
# Campos: registered=false, uid=null, partnerId=estudioherta
```

### Teste 2: Cadastro com Vinculação

```bash
# 1. Com visitante já rastreado, fazer cadastro
# 2. Verificar console após confirmação SMS
✅ [REFERRAL-V3] Vinculação concluída com sucesso!
   Linked: true
   PartnerId: estudioherta

# 3. Verificar Firestore
# Documento atualizado: registered=true, uid={firebase-uid}
```

### Teste 3: Cadastro SEM Referral (caso normal)

```bash
# 1. Acessar SEM ?ref
https://localhost:3000/

# 2. Fazer cadastro normalmente
# 3. Console mostra:
ℹ️ [REFERRAL-V3] Sem código de parceiro, nada a rastrear
✅ Cadastro concluído (sem vínculo de afiliado)
```

### Teste 4: Idempotência

```bash
# 1. Tentar vincular mesmo visitor/uid novamente
POST /api/referral/link-registration
{ uid: "abc", visitorId: "xyz" }

# 2. Resposta:
{
  "success": true,
  "message": "Visitante já vinculado (idempotente)",
  "reason": "ALREADY_REGISTERED"
}
```

---

## 🚨 O QUE NÃO FOI ALTERADO

❌ **Firestore Rules** - Mantidas como estão
❌ **Fluxo de login por SMS** - Zero alterações
❌ **Fluxo de cadastro** - Zero alterações
❌ **Demo/Anonymous** - Zero alterações
❌ **Fingerprint** - Zero alterações

---

## 📋 PRÓXIMOS PASSOS (APÓS VALIDAÇÃO)

### Fase 1: Testes Locais (AGORA)
```bash
# 1. Iniciar servidor
npm start

# 2. Testar fluxos completos
- Visita com ?ref
- Cadastro vinculado
- Verificar Firestore
- Verificar logs do console

# 3. Validar logs do backend
[REFERRAL:xxxxx] track-visitor iniciado
✅ [REFERRAL:xxxxx] Sucesso! Documento atualizado
```

### Fase 2: Deploy Staging (1-2 dias)
```bash
# 1. Deploy no Railway staging
# 2. Testar com Firebase de teste
# 3. Validar logs do Railway
# 4. Verificar painel de parceiros
```

### Fase 3: Deploy Produção (após 100% validado)
```bash
# 1. Deploy no Railway produção
# 2. Monitorar logs por 24h
# 3. Validar cadastros de afiliados no painel
# 4. Confirmar vinculações corretas
```

### Fase 4: Limpeza (após 1 semana)
```bash
# 1. Remover código legado V2 (fallback)
#    Arquivo: public/auth.js
#    Seção: [REFERRAL-V2-FALLBACK]

# 2. Remover imports do Firebase SDK (se não usado)
#    Arquivo: public/index.html
#    Imports não necessários de firebase-firestore

# 3. Documentar nova arquitetura
```

---

## 🎯 GARANTIAS DE SEGURANÇA

✅ **Cadastro NUNCA é bloqueado**
- Backend sempre retorna `success: true`
- Erro silencioso no frontend (try/catch)
- Logs detalhados para debug

✅ **Firestore Rules permanecem seguras**
- Admin SDK bypassa rules
- Frontend não escreve direto no Firestore
- Rules podem ser fechadas no futuro

✅ **Idempotência garantida**
- Múltiplas chamadas não causam inconsistência
- Merge mode em track-visitor
- Verificação de estado em link-registration

✅ **Logs completos**
- Cada etapa logada com prefixo [REFERRAL-V3]
- Request ID único por operação
- Stack trace completo em erros

---

## 📞 SUPORTE

**Logs importantes:**
```javascript
// Backend (server.js terminal)
🔗 [REFERRAL-V3] Sistema de afiliados registrado
🔗 [REFERRAL:abc123] track-visitor iniciado
✅ [REFERRAL:abc123] Sucesso! Documento atualizado

// Frontend (console do navegador)
✅ [REFERRAL-V3] Rastreamento salvo com sucesso!
✅ [REFERRAL-V3] Vinculação concluída com sucesso!
```

**Em caso de erro:**
1. Verificar logs do backend (Railway ou terminal local)
2. Verificar console do navegador (F12)
3. Verificar se FIREBASE_SERVICE_ACCOUNT está configurado
4. Verificar se Firestore está acessível

---

**Implementação concluída em:** 29/01/2026  
**Desenvolvedor:** GitHub Copilot + Claude Sonnet 4.5  
**Status:** ✅ PRONTO PARA TESTES
