# 🔍 AUDITORIA COMPLETA: SISTEMA DE AUTENTICAÇÃO FIREBASE
**Data:** 05/02/2026  
**Tipo:** Mapeamento Completo (SEM ALTERAÇÕES)  
**Objetivo:** Entender exatamente o fluxo real de execução atual

---

## 📊 MAPA GERAL DO SISTEMA

### Collections Firestore:
- ✅ **`usuarios`** - única collection de usuários

### Pontos de Criação de Usuário:
1. **`confirmSMSCode()`** - Cadastro com SMS (linha ~1102)
2. **`signupDirectEmail()`** - Cadastro direto sem SMS (linha ~600)
3. **`loginWithGoogle()`** - Login Google (linha ~465)

### Pontos de Criação Firestore:
1. **`confirmSMSCode()`** → cria com updateDoc/setDoc merge (linha ~1390)
2. **`ensureUserDocument()`** → CASO 2 setDoc (linha ~1872)
3. **`login()`** → chama ensureUserDocument se não existe (linha ~270)
4. **`onAuthStateChanged()`** → chama ensureUserDocument se não existe (linha ~2418)

---

## 🔄 FLUXO 1: CADASTRO COM SMS (`confirmSMSCode`)

### Localização: Linha 1102-1500

### Sequência de Execução:

```
1. VALIDAÇÕES INICIAIS
   ├─ Email preenchido?
   │  └─ ❌ NÃO → return (linha 1106)
   ├─ Senha preenchida?
   │  └─ ❌ NÃO → return (linha 1112)
   ├─ Telefone preenchido?
   │  └─ ❌ NÃO → return (linha 1118)
   ├─ Código SMS preenchido?
   │  └─ ❌ NÃO → return (linha 1125)
   └─ Código tem 6 dígitos?
      └─ ❌ NÃO → return (linha 1129)

2. VALIDAÇÃO confirmationResult
   ├─ window.confirmationResult existe?
   │  └─ ❌ NÃO → return (linha 1146)
   └─ verificationId existe?
      └─ ❌ NÃO → return (linha 1151)

3. AUTENTICAÇÃO (try-catch linha 1177-1471)
   ├─ Marcar cadastroEmProgresso = 'true' (linha 1181)
   ├─ Obter deviceId (linha 1185-1197)
   │
   ├─ PASSO 1: createUserWithEmailAndPassword (linha 1207)
   │  └─ ❌ FALHA → catch linha 1461 → return
   │
   ├─ PASSO 2: Criar phoneCredential (linha 1218)
   │
   ├─ PASSO 3: linkWithCredential (linha 1227)
   │  └─ ❌ FALHA → catch linha 1461 → return
   │
   ├─ PASSO 4: POLLING até phoneNumber existir (linha 1241-1288)
   │  ├─ Loop 10 tentativas (500ms cada)
   │  ├─ Em cada tentativa: reload() + verificar phoneNumber
   │  ├─ ✅ phoneNumber existe → break
   │  └─ ❌ Timeout → throw Error (linha 1291)
   │
   ├─ PASSO 5: Renovar token (linha 1306)
   │
   ├─ PASSO 6: CRIAR/ATUALIZAR FIRESTORE (linha 1355-1448)
   │  ├─ VALIDAÇÃO CRÍTICA: phoneNumber deve existir (linha 1357)
   │  │  └─ ❌ phoneNumber NULL → throw Error
   │  │
   │  ├─ Criar payload com campos verificados (linha 1368)
   │  │
   │  ├─ RETRY EXPONENCIAL (3 tentativas):
   │  │  ├─ try: updateDoc() (linha 1393)
   │  │  └─ catch: setDoc(merge: true) (linha 1398)
   │  │
   │  ├─ VALIDAÇÃO PÓS-ESCRITA (linha 1405-1428)
   │  │  ├─ Ler documento
   │  │  ├─ Verificar phoneNumber corresponde
   │  │  ├─ Verificar verified === true
   │  │  └─ ❌ Validação falha → throw Error
   │  │
   │  └─ catch: Log erro MAS CONTINUA (linha 1430-1437)
   │
   └─ PASSO 7: initializeSessionAfterSignup (linha 1448)

4. FINALIZAÇÃO (linha 1484-1502)
   ├─ Limpar cadastroEmProgresso (linha 1486)
   ├─ Desbloquear scroll (linha 1490)
   └─ Redirecionar para index.html (linha 1498)
```

### ❌ PONTOS DE FALHA IDENTIFICADOS:

#### 1. Race Condition Eliminada (CORRETO)
- ✅ Flag `cadastroEmProgresso` bloqueia onAuthStateChanged
- ✅ Polling garante phoneNumber antes de criar Firestore
- ✅ Validação pré e pós-escrita

#### 2. Falha de Rede no Firestore (POSSÍVEL)
```javascript
// Linha 1430-1437
catch (syncErr) {
  error('❌ [CONFIRM] ERRO CRÍTICO ao sincronizar Firestore:', syncErr);
  warn('⚠️ [CONFIRM] Continuando apesar da falha (SMS-SYNC tentará corrigir)');
}
// ⚠️ NÃO ABORTA - Sistema continua
```
**IMPACTO:** phoneNumber vinculado no Auth, mas Firestore pode não refletir

#### 3. Timeout no Polling (RARO)
```javascript
// Linha 1291
if (!phoneNumberReady) {
  throw new Error('Falha ao vincular telefone: phoneNumber não propagou no Firebase Auth');
}
// ❌ ABORTA TODO O CADASTRO
```
**IMPACTO:** Usuário criado no Auth mas sem phoneNumber vinculado

---

## 🔄 FLUXO 2: CADASTRO DIRETO SEM SMS (`signupDirectEmail`)

### Localização: Linha 600-700

### Sequência de Execução:

```
1. VALIDAÇÕES
   ├─ Email e senha preenchidos? (linha 598)
   ├─ Formato de email válido? (linha 606)
   ├─ Senha >= 6 caracteres? (linha 612)
   └─ Telefone preenchido? (linha 618)

2. AUTENTICAÇÃO (try-catch linha 623-706)
   ├─ createUserWithEmailAndPassword (linha 626)
   │  └─ ❌ FALHA → catch linha 684
   │
   ├─ Salvar cadastroMetadata com criadoSemSMS: true (linha 638)
   │
   ├─ Salvar tokens (linha 650)
   │
   ├─ initializeSessionAfterSignup (linha 670)
   │
   └─ ⚠️ NÃO CRIA FIRESTORE AQUI (linha 633)
      └─ Comentário: "onAuthStateChanged criará"

3. REDIRECIONAR (linha 682)
   └─ index.html após 2 segundos
```

### ✅ COMPORTAMENTO:
- **NÃO cria Firestore diretamente**
- **Depende de onAuthStateChanged** para criar
- **Flag `criadoSemSMS: true`** permite bypass SMS

---

## 🔄 FLUXO 3: LOGIN (`login`)

### Localização: Linha 211-450

### Sequência de Execução:

```
1. VALIDAÇÕES
   └─ Email e senha preenchidos? (linha 217)

2. AUTENTICAÇÃO
   ├─ signInWithEmailAndPassword (linha 222)
   │  └─ ❌ FALHA → catch linha 411
   │
   ├─ Salvar tokens (linha 224-232)
   │
   └─ initializeSessionAfterSignup (linha 237)

3. VERIFICAR DOCUMENTO FIRESTORE (linha 240-393)
   │
   ├─ CASO 1: Documento NÃO existe (linha 256)
   │  │
   │  ├─ CASO 1a: phoneNumber existe no Auth (linha 263)
   │  │  ├─ Chamar ensureUserDocument() (linha 270)
   │  │  └─ Redirecionar index.html (linha 274)
   │  │
   │  └─ CASO 1b: phoneNumber NÃO existe (linha 282)
   │     ├─ signOut() (linha 287)
   │     ├─ localStorage.clear() (linha 288)
   │     └─ Mensagem "precisa verificação SMS" (linha 289)
   │
   └─ CASO 2: Documento existe (linha 302)
      │
      ├─ Ler userData (linha 304)
      │
      ├─ DECISÃO DE PEDIR SMS (linha 320-360)
      │  │
      │  ├─ smsVerificado = !!user.phoneNumber (linha 320)
      │  ├─ isBypassSMS = criadoSemSMS OU origin === 'hotmart' (linha 323)
      │  │
      │  ├─ if (!smsVerificado && !isBypassSMS) (linha 341)
      │  │  ├─ signOut() (linha 351)
      │  │  ├─ localStorage.clear() (linha 354)
      │  │  └─ Mensagem "precisa verificação SMS" (linha 363)
      │  │
      │  └─ ✅ PERMITE LOGIN
      │
      └─ REDIRECIONAR (linha 379-390)
         ├─ entrevista.html (se plano pago E não concluiu)
         └─ index.html (caso contrário)
```

### ❌ PONTOS DE FALHA IDENTIFICADOS:

#### 1. Usuário sem Firestore + sem phoneNumber
```javascript
// Linha 287-295
await auth.signOut();
localStorage.clear();
showMessage("❌ Sua conta precisa de verificação por SMS...");
return;
```
**RESULTADO:** ❌ LOGIN BLOQUEADO

#### 2. Usuário sem Firestore + com phoneNumber
```javascript
// Linha 270-277
await ensureUserDocument(result.user, {...});
window.location.href = "index.html";
return;
```
**RESULTADO:** ✅ FIRESTORE CRIADO AUTOMATICAMENTE → LOGIN PERMITIDO

#### 3. Usuário com Firestore + sem phoneNumber + sem bypass
```javascript
// Linha 351-365
await auth.signOut();
localStorage.clear();
showMessage("❌ Sua conta precisa de verificação por SMS...");
return;
```
**RESULTADO:** ❌ LOGIN BLOQUEADO

---

## 🔄 FLUXO 4: onAuthStateChanged (LISTENER GLOBAL)

### Localização: Linha 2375-2520

### Sequência de Execução:

```
1. VERIFICAR USUÁRIO AUTENTICADO
   └─ user === null? → return (linha 2376)

2. BLOQUEIO CADASTRO EM PROGRESSO
   ├─ cadastroEmProgresso === 'true'? (linha 2387)
   │  └─ ✅ SIM → return (linha 2393)
   │     └─ Log: "confirmSMSCode() criará o documento"
   │
   └─ ❌ NÃO → continuar

3. VERIFICAR DOCUMENTO FIRESTORE (linha 2403-2434)
   │
   ├─ CASO 1: Documento NÃO existe (linha 2408)
   │  │
   │  ├─ CASO 1a: phoneNumber existe (linha 2413)
   │  │  ├─ Chamar ensureUserDocument() (linha 2417)
   │  │  └─ Log: "Documento criado com sucesso"
   │  │
   │  └─ CASO 1b: phoneNumber NÃO existe (linha 2423)
   │     ├─ Log: "aguardando verificação SMS"
   │     └─ return (NÃO CRIA DOCUMENTO)
   │
   └─ CASO 2: Documento existe (linha 2430)
      │
      ├─ Chamar ensureUserDocument() (ATUALIZAÇÃO) (linha 2454)
      │
      └─ SMS-SYNC (se phoneNumber existe mas Firestore desatualizado)
         ├─ Detectar: !verificadoPorSMS OU !verified (linha 2477)
         ├─ Criar payload de sincronização (linha 2485)
         ├─ RETRY EXPONENCIAL updateDoc() (linha 2506)
         └─ VALIDAÇÃO PÓS-ESCRITA (linha 2513)
```

### ✅ COMPORTAMENTO CORRETO:
- **Bloqueio total** durante cadastro SMS
- **Cria documento** apenas se phoneNumber existe
- **SMS-SYNC** corrige dessincronia automaticamente

---

## 🔄 FLUXO 5: ensureUserDocument (FUNÇÃO CENTRALIZADA)

### Localização: Linha 1632-1900

### Sequência de Execução:

```
1. VALIDAÇÃO
   └─ user e user.uid válidos? (linha 1634)

2. LER DOCUMENTO FIRESTORE (linha 1655)
   │
   ├─ CASO 1: Documento EXISTE (linha 1661-1711)
   │  ├─ Criar payload updates (linha 1667-1669)
   │  ├─ Migrar plano PT → EN se necessário (linha 1672)
   │  ├─ Adicionar campos ausentes (linha 1681-1695)
   │  ├─ updateDoc(userRef, updates) (linha 1707)
   │  └─ return { created: false, updated: true }
   │
   └─ CASO 2: Documento NÃO EXISTE (linha 1716-1890)
      │
      ├─ Obter deviceId (linha 1721-1744)
      ├─ Obter referralCode, UTMs, etc (linha 1747-1764)
      │
      ├─ Calcular campos:
      │  ├─ bypassSMS = provider === 'google' OU 'email' (linha 1767)
      │  └─ verified = !!user.phoneNumber (linha 1768)
      │
      ├─ Criar newUserDoc completo (linha 1783-1836)
      │  ├─ plan: 'free' (SEMPRE)
      │  ├─ verified: !!user.phoneNumber
      │  ├─ phoneNumber: user.phoneNumber || null
      │  └─ +50 campos
      │
      ├─ Validar campos (whitelist) (linha 1841-1848)
      │
      ├─ setDoc(userRef, validatedDoc) (linha 1872)
      │  └─ ⚠️ SEM MERGE - cria documento novo
      │
      └─ return { created: true, updated: false }
```

### ⚠️ RISCO IDENTIFICADO:

```javascript
// Linha 1768
verified: !!user.phoneNumber
```

**CENÁRIO DE FALHA (TEÓRICO - JÁ CORRIGIDO):**
1. Se `ensureUserDocument` fosse chamado ANTES do polling completar
2. `user.phoneNumber` ainda seria `null`
3. Documento criado com `verified: false`

**MITIGAÇÃO ATUAL:**
- ✅ Flag `cadastroEmProgresso` bloqueia onAuthStateChanged
- ✅ Polling garante phoneNumber antes de criar
- ✅ Validação pré-criação no confirmSMSCode

---

## 📊 MATRIZ DE DECISÃO: "CRIAR FIRESTORE OU NÃO?"

| Função | Documento Existe | phoneNumber Existe | cadastroEmProgresso | Ação |
|--------|------------------|-------------------|---------------------|------|
| **confirmSMSCode** | - | ✅ SIM | TRUE | CRIA (updateDoc/setDoc merge) |
| **confirmSMSCode** | - | ❌ NÃO | TRUE | ❌ ABORTA (throw error) |
| **login** | ❌ NÃO | ✅ SIM | FALSE | CRIA (via ensureUserDocument) |
| **login** | ❌ NÃO | ❌ NÃO | FALSE | ❌ BLOQUEIA (logout + mensagem) |
| **login** | ✅ SIM | ❌ NÃO | FALSE | ❌ BLOQUEIA (se não bypass) |
| **onAuthStateChanged** | ❌ NÃO | ✅ SIM | FALSE | CRIA (via ensureUserDocument) |
| **onAuthStateChanged** | ❌ NÃO | ❌ NÃO | FALSE | ⏸️ AGUARDA (não cria) |
| **onAuthStateChanged** | qualquer | qualquer | TRUE | ⏸️ BLOQUEADO (return) |
| **signupDirectEmail** | - | - | - | ⏸️ DELEGA (onAuthStateChanged cria) |

---

## 🐛 CENÁRIOS DE FALHA MAPEADOS

### 1️⃣ FIRESTORE NÃO CRIADO

#### **Cenário A:** Cadastro direto sem SMS + onAuthStateChanged não dispara
```
1. signupDirectEmail() executa
2. Salva cadastroMetadata com criadoSemSMS: true
3. Redireciona para index.html
4. ⚠️ onAuthStateChanged NÃO dispara (navegação rápida)
5. Usuário entra no sistema SEM documento Firestore
```
**IMPACTO:** Sistema sem dados do usuário → erros em cascata

**MITIGAÇÃO ATUAL:** Login verifica e cria documento se não existir (linha 270)

#### **Cenário B:** Falha de rede durante createWithEmailAndPassword

```
1. confirmSMSCode() → createUserWithEmailAndPassword
2. Usuário criado no Auth
3. linkWithCredential falha (erro de rede)
4. catch linha 1461 → return
5. Usuário existe no Auth mas sem phoneNumber
```
**IMPACTO:** Próximo login → bloqueado (phoneNumber null)

#### **Cenário C:** Firestore escrita falha silenciosamente
```
1. confirmSMSCode() → polling completo (phoneNumber OK)
2. updateDoc/setDoc falha (erro de rede)
3. catch linha 1430 → CONTINUA (não aborta)
4. Usuário autenticado no Auth com phoneNumber
5. Mas Firestore não reflete verificação
```
**IMPACTO:** SMS-SYNC tentará corrigir, mas pode falhar também

---

### 2️⃣ SMS VOLTA A SER PEDIDO

#### **Cenário A:** phoneNumber não propagou no Auth
```
1. Usuário faz cadastro SMS com sucesso
2. Firestore criado com verified: true
3. Faz logout
4. Firebase Auth perde phoneNumber (raro)
5. Próximo login: phoneNumber === null
6. Login bloqueado (linha 351)
```
**CAUSA:** Firebase Auth não persistiu phoneNumber

#### **Cenário B:** Firestore sem campos verificados
```
1. Cadastro SMS completo
2. Firestore escrita falhou (linha 1430)
3. Auth tem phoneNumber
4. Firestore NÃO tem verified: true
5. Login: smsVerificado = !!phoneNumber → TRUE
6. ✅ LOGIN PERMITIDO
7. SMS-SYNC corrige Firestore (linha 2477)
```
**RESULTADO:** ✅ Não pede SMS novamente (Auth é fonte de verdade)

---

### 3️⃣ USUÁRIO ENTRA SEM DOCUMENTO FIRESTORE

#### **Cenário IMPOSSÍVEL (com código atual):**
```
1. Login verifica documento (linha 240)
2. Se não existe E phoneNumber existe → CRIA (linha 270)
3. Se não existe E phoneNumber NÃO existe → BLOQUEIA (linha 287)
4. onAuthStateChanged também cria se não existir (linha 2417)
```
**CONCLUSÃO:** ✅ IMPOSSÍVEL entrar sem documento Firestore

---

## 🎯 PONTOS DE CRIAÇÃO FIRESTORE (CONSOLIDADO)

### 1. `confirmSMSCode()` - Linha 1393-1398
```javascript
try {
  await updateDoc(userRef, updates);
} catch (uErr) {
  await setDoc(userRef, updates, { merge: true });
}
```
**CONDIÇÕES:**
- ✅ phoneNumber existe (validação linha 1357)
- ✅ cadastroEmProgresso === 'true'
- ✅ Após polling completo

**BLOQUEIOS:**
- ❌ phoneNumber null → throw error (linha 1361)
- ❌ Erro rede → catch log mas continua (linha 1430)

---

### 2. `ensureUserDocument()` CASO 2 - Linha 1872
```javascript
await setDoc(userRef, validatedDoc);
```
**CONDIÇÕES:**
- ✅ Documento NÃO existe
- ✅ Chamado por login OU onAuthStateChanged

**BLOQUEIOS:**
- Nenhum bloqueio direto
- `verified` calculado de `user.phoneNumber` (linha 1768)

---

### 3. `login()` → ensureUserDocument - Linha 270
```javascript
await ensureUserDocument(result.user, {...});
```
**CONDIÇÕES:**
- ✅ Documento NÃO existe
- ✅ phoneNumber existe no Auth

**BLOQUEIOS:**
- ❌ phoneNumber null → bloqueio logout (linha 287)

---

### 4. `onAuthStateChanged()` → ensureUserDocument - Linha 2417
```javascript
await ensureUserDocument(user, {...});
```
**CONDIÇÕES:**
- ✅ Documento NÃO existe
- ✅ phoneNumber existe
- ✅ cadastroEmProgresso !== 'true'

**BLOQUEIOS:**
- ❌ cadastroEmProgresso === 'true' → return (linha 2393)
- ❌ phoneNumber null → return (linha 2427)

---

## 🚨 FLAGS E VARIÁVEIS GLOBAIS

### 1. `window.confirmationResult`
- **Onde setado:** `sendSMS()` (não mostrado)
- **Onde usado:** `confirmSMSCode()` linha 1146-1151
- **Validação:** Verifica se existe e tem `verificationId`

### 2. `window.isNewUserRegistering`
- **Onde setado:** `confirmSMSCode()` linha 1181
- **Onde limpo:** `confirmSMSCode()` linha 1486
- **Uso:** Marcador de cadastro em progresso

### 3. `localStorage.cadastroEmProgresso`
- **Onde setado:** `confirmSMSCode()` linha 1182
- **Onde limpo:** `confirmSMSCode()` linha 1487
- **Onde checado:** `onAuthStateChanged()` linha 2387
- **CRÍTICO:** Bloqueia race condition

### 4. `localStorage.cadastroMetadata`
- **Onde setado:**
  - `confirmSMSCode()` linha 1338
  - `signupDirectEmail()` linha 638
- **Onde usado:** `ensureUserDocument()` linha 1723
- **Onde limpo:** `ensureUserDocument()` linha 1878
- **Conteúdo:** `{ email, telefone, deviceId, timestamp, criadoSemSMS? }`

---

## 📋 EARLY RETURNS MAPEADOS

### confirmSMSCode():
1. Email vazio → linha 1108
2. Senha vazia → linha 1114
3. Telefone vazio → linha 1120
4. Código vazio → linha 1127
5. Código ≠ 6 dígitos → linha 1131
6. confirmationResult null → linha 1148
7. verificationId null → linha 1153
8. Erro autenticação → linha 1470
9. ❌ NENHUM return após criar Firestore

### login():
1. Email/senha vazios → linha 219
2. Documento não existe E phoneNumber null → linha 295
3. Documento existe E (!smsVerificado && !isBypassSMS) → linha 365
4. ❌ NENHUM return após verificar Firestore existir

### onAuthStateChanged():
1. user null → linha 2376
2. cadastroEmProgresso true → linha 2393
3. Documento não existe E phoneNumber null → linha 2427
4. ❌ NENHUM return após criar Firestore

---

## 🎯 DIAGNÓSTICO OBJETIVO

### ✅ O QUE FUNCIONA BEM:

1. **Polling robusto** garante phoneNumber antes de criar Firestore
2. **Flag cadastroEmProgresso** elimina race condition
3. **Validação pré e pós-escrita** no confirmSMSCode
4. **Login dupla verificação** (Auth + Firestore)
5. **SMS-SYNC automático** corrige dessincronia
6. **Retry exponencial** em escritas críticas

### ⚠️ RISCOS EXISTENTES:

1. **Falha de rede silenciosa** no confirmSMSCode (linha 1430)
   - Auth atualizado, Firestore não
   - SMS-SYNC pode corrigir, mas pode falhar também

2. **Timeout no polling** (linha 1291)
   - Raro, mas aborta todo cadastro
   - Usuário criado no Auth sem phoneNumber

3. **signupDirectEmail** depende de onAuthStateChanged
   - Se listener não disparar, usuário sem Firestore
   - Mitigado por verificação no login

### ❌ CENÁRIOS DE FALHA COMPROVADOS:

#### 1. "Firestore não é criado quando..."
**Resposta:** 
- ✅ **SEMPRE é criado** se phoneNumber existe
- ❌ **NÃO é criado** se:
  - phoneNumber null E não é bypass
  - cadastroEmProgresso === 'true' (bloqueio intencional)
  - Falha de rede no confirmSMSCode (raro)

#### 2. "SMS volta a ser pedido quando..."
**Resposta:**
- ❌ Firebase Auth perde phoneNumber (raríssimo)
- ✅ Auth é fonte de verdade → se Auth tem phoneNumber, não pede SMS
- ✅ Firestore é secundário → SMS-SYNC corrige se necessário

#### 3. "Usuário entra sem documento Firestore quando..."
**Resposta:**
- ❌ **IMPOSSÍVEL** com código atual
- Login verifica e cria se não existir (linha 270)
- onAuthStateChanged cria se não existir (linha 2417)

---

## 📊 ESTATÍSTICAS FINAIS

### Pontos de Criação Firestore: **4**
1. confirmSMSCode (linha 1393)
2. ensureUserDocument CASO 2 (linha 1872)
3. login → ensureUserDocument (linha 270)
4. onAuthStateChanged → ensureUserDocument (linha 2417)

### Pontos de Decisão SMS: **2**
1. login (linha 341) - BLOQUEIA se !phoneNumber && !bypass
2. onAuthStateChanged (linha 2427) - NÃO CRIA se !phoneNumber

### Flags/Bloqueios: **3**
1. cadastroEmProgresso (bloqueia onAuthStateChanged)
2. phoneNumber validação (bloqueia criação)
3. isBypassSMS (permite login sem phoneNumber)

### Early Returns: **15**
- confirmSMSCode: 8 returns antes de criar Firestore
- login: 3 returns antes de permitir acesso
- onAuthStateChanged: 3 returns antes de criar documento

---

## 🎯 CONCLUSÃO

### Sistema Atual:
✅ **Robusto** contra race conditions  
✅ **Validações** em múltiplas camadas  
✅ **Retry** em operações críticas  
✅ **SMS-SYNC** como safety net  

### Riscos Remanescentes:
⚠️ **Falha de rede silenciosa** pode deixar Firestore desatualizado  
⚠️ **Timeout polling** raro mas crítico  
⚠️ **signupDirectEmail** depende de listener (mitigado)  

### Por que às vezes funciona e às vezes não:
**Resposta:** Falhas de rede intermitentes durante cadastro SMS  
- Maioria dos casos: ✅ Funciona (polling + retry + validação)  
- Casos raros: ❌ Falha de rede impede escrita Firestore  
- Recuperação: SMS-SYNC corrige em próximo login (se não falhar também)  

---

**Auditoria realizada por:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ✅ DIAGNÓSTICO COMPLETO  
**Próxima ação:** Decisão de correções necessárias
