# 🔍 AUDITORIA COMPLETA: ARQUITETURA E FLUXO DE ANÁLISE

**Data:** 10 de dezembro de 2025  
**Branch:** volta  
**Status:** ✅ AUDITORIA CONCLUÍDA

---

## 📋 1. ROTAS IDENTIFICADAS

### ✅ **CHAT (api/chat.js)**
- **Rota:** `POST /` (export default handler)
- **Autenticação:** Firebase Auth via `auth.verifyIdToken(idToken)`
- **UID obtido via:** `decoded.uid` após verificação do token
- **Função de limites:** `handleUserLimits(db, uid, email)` - linha ~1100
- **Verificação rate limit:** `checkRateLimit(uid)` - linha ~1100
- **Status:** ✅ Sistema de limites básico já existe (mensagens diárias)

### ✅ **ANÁLISE DE ÁUDIO (api/audio/analyze.js)**
- **Rota:** `POST /analyze` (router.post)
- **Linha:** 250
- **Função principal:** Cria job no banco PostgreSQL e enfileira no BullMQ
- **Função de criação:** `createJobInDatabase(fileKey, mode, fileName)` - linha ~83
- **Enfileiramento:** Usa `getAudioQueue()` de `work/lib/queue.js`
- **Autenticação:** ❌ NÃO TEM (crítico para implementar limites)
- **Status:** ⚠️ PRECISA ADICIONAR autenticação + limites

### ⚠️ **ANÁLISE DE ÁUDIO ALTERNATIVA (api/jobs/analyze.js)**
- **Rota:** `POST /analyze` (router.post)
- **Linha:** 182
- **Diferença:** NÃO enfileira no BullMQ, apenas cria registro no PostgreSQL
- **Status:** ❌ Arquivo parece DESATUALIZADO (não usa fila)
- **Ação:** Ignorar este arquivo, usar `api/audio/analyze.js`

---

## 🔄 2. FLUXO COMPLETO DA ANÁLISE

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND                                                     │
│  ↓                                                            │
│  POST /analyze { fileKey, mode, genre }                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  API: api/audio/analyze.js                                   │
│  ✅ Validar fileKey + modo                                   │
│  ⚠️ NÃO TEM autenticação (PRECISA ADICIONAR)                │
│  ✅ createJobInDatabase() → PostgreSQL                       │
│  ✅ queue.add() → BullMQ Redis                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  REDIS BULLMQ QUEUE                                          │
│  - Nome: 'audio-analyzer'                                    │
│  - Gerenciado por: work/lib/queue.js                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  WORKER: work/worker-redis.js                                │
│  ✅ Processa jobs da fila BullMQ                             │
│  ✅ Chama: processAudioComplete() de pipeline-complete.js    │
│  ✅ Atualiza PostgreSQL com resultados                       │
│  ✅ Enriquece sugestões com IA (enrichSuggestionsWithAI)     │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  PIPELINE: work/api/audio/pipeline-complete.js               │
│  ✅ Download de S3 (Backblaze)                               │
│  ✅ Análise completa: LUFS, TP, DR, espectral, BPM           │
│  ✅ Retorna métricas completas                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  RESULTADO SALVO NO POSTGRESQL                               │
│  - Tabela: jobs                                              │
│  - Status: 'completed' ou 'failed'                           │
│  - Payload: JSON com todas métricas                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 3. SISTEMA DE AUTENTICAÇÃO ATUAL

### ✅ **Firebase Admin SDK**
- **Arquivo:** `api/firebaseAdmin.js`
- **Modo:** Condicional via `process.env.USE_FIREBASE === "true"`
- **Mock ativo:** Sim (quando Firebase desativado)
- **Exports:** `auth` e `db`

### ✅ **Padrão de autenticação em api/chat.js:**
```javascript
// Linha ~1180
decoded = await auth.verifyIdToken(idToken);
const uid = decoded.uid;
const email = decoded.email;
```

### ⚠️ **api/audio/analyze.js NÃO tem autenticação:**
- Não recebe `idToken`
- Não valida usuário
- Não verifica limites
- **CRÍTICO:** Qualquer pessoa pode criar análises ilimitadas

---

## 📊 4. SISTEMA DE LIMITES ATUAL (api/chat.js)

### ✅ **Função handleUserLimits()**
Localização: Linha ~500-650 (aproximadamente)

**Lógica atual:**
1. Busca usuário no Firestore: `db.collection('usuarios').doc(uid)`
2. Cria perfil se não existir
3. Verifica expiração de plano Plus
4. Verifica reset diário de mensagens
5. Verifica limite de mensagens
6. Retorna `userData` ou throw `LIMIT_EXCEEDED`

**Campos Firestore atuais:**
```javascript
{
  uid: string,
  plano: 'gratis' | 'plus',
  mensagensEnviadas: number,
  mesAtual: number,
  anoAtual: number,
  dataUltimoReset: Timestamp,
  planExpiresAt: Timestamp | null,
  imagemAnalises: {
    quantidade: number,
    mesAtual: number,
    anoAtual: number
  }
}
```

### ⚠️ **Problemas identificados:**
1. ❌ Não há contador de análises de áudio
2. ❌ Limites hardcoded (10 mensagens/dia para free)
3. ❌ Não há plano "pro"
4. ❌ Reset é DIÁRIO, requisito pede MENSAL (para novo sistema)
5. ❌ Lógica duplicada entre chat.js e chat-with-images.js

---

## 🎯 5. IMPLEMENTAÇÃO NECESSÁRIA

### ✅ **FASE 1: Criar módulo centralizado**
**Arquivo:** `work/lib/user/userPlans.js`

**Funções necessárias:**
- `getOrCreateUser(uid, extra)` - Buscar/criar usuário
- `applyPlan(uid, { plan, durationDays })` - Aplicar plano via webhook
- `canUseChat(uid)` - Verificar limite de chat
- `registerChat(uid)` - Registrar uso de chat
- `canUseAnalysis(uid)` - Verificar limite de análise
- `registerAnalysis(uid)` - Registrar uso de análise

**Limites definidos:**
```javascript
free: { maxMessagesPerDay: 20, maxAnalysesPerDay: 3 }
plus: { maxMessagesPerDay: 80, maxAnalysesPerDay: 30 }
pro: { maxMessagesPerDay: Infinity, maxAnalysesPerDay: Infinity }
```

### ✅ **FASE 2: Integrar em api/chat.js**
**Modificações:**
1. Importar: `import { canUseChat, registerChat } from "../work/lib/user/userPlans.js";`
2. Substituir `handleUserLimits()` por `canUseChat(uid)`
3. Adicionar `registerChat(uid)` após resposta bem-sucedida
4. Manter autenticação existente (não mexer)

**Localização exata:**
- Import no topo (após linha 10)
- Check antes GPT (~linha 1190)
- Register após envio (~linha 1650)

### ✅ **FASE 3: Integrar em api/audio/analyze.js**
**Modificações:**
1. **ADICIONAR autenticação:**
   ```javascript
   import { auth } from '../../firebaseAdmin.js';
   const { idToken } = req.body;
   const decoded = await auth.verifyIdToken(idToken);
   const uid = decoded.uid;
   ```

2. **Importar limites:**
   ```javascript
   import { canUseAnalysis, registerAnalysis } from '../../work/lib/user/userPlans.js';
   ```

3. **Verificar ANTES de criar job:**
   ```javascript
   const check = await canUseAnalysis(uid);
   if (!check.allowed) {
     return res.status(429).json({
       error: "limit_reached",
       message: "Você atingiu o limite diário de análises do seu plano."
     });
   }
   ```

4. **Registrar APÓS enfileirar:**
   ```javascript
   await registerAnalysis(uid);
   ```

**Localização exata:**
- Import no topo (linha ~20)
- Auth check (~linha 260, início do try)
- Limit check (~linha 290, antes createJobInDatabase)
- Register (~linha 305, após enfileiramento bem-sucedido)

### ✅ **FASE 4: Criar webhook Mercado Pago**
**Arquivo:** `api/webhook/mercadopago.js`

**Fluxo:**
1. Receber notificação POST do Mercado Pago
2. Validar assinatura (se aplicável)
3. Buscar detalhes do pagamento via API
4. Verificar `status === "approved"`
5. Pegar `external_reference` (uid do Firebase)
6. Determinar plano (pro mensal = 30 dias, combo = 120 dias)
7. Chamar `applyPlan(uid, { plan, durationDays })`
8. Responder 200 OK sempre

---

## ⚠️ 6. PONTOS CRÍTICOS DE ATENÇÃO

### 🔴 **CRÍTICO 1: Paths relativos**
- `api/chat.js` importa `work/` → usar `"../work/..."`
- `api/audio/analyze.js` importa `work/` → usar `"../../work/..."`
- `api/webhook/mercadopago.js` importa `work/` → usar `"../../work/..."`

**NUNCA chutar o path. Sempre calcular baseado na estrutura:**
```
api/
  chat.js          → "../work/lib/user/userPlans.js"
  audio/
    analyze.js     → "../../work/lib/user/userPlans.js"
  webhook/
    mercadopago.js → "../../work/lib/user/userPlans.js"
```

### 🔴 **CRÍTICO 2: Firebase já inicializado**
**NÃO fazer:**
```javascript
import admin from 'firebase-admin';
admin.initializeApp(); // ❌ JÁ FOI INICIALIZADO
```

**FAZER:**
```javascript
import { auth, db } from '../../api/firebaseAdmin.js'; // ✅ Usar singleton
// OU, se dentro de work/:
import admin from 'firebase-admin';
const db = admin.firestore(); // ✅ Usar instância global
```

### 🔴 **CRÍTICO 3: Modo MOCK**
- Firebase pode estar em modo MOCK (Railway)
- `auth.verifyIdToken()` retorna mock se `USE_FIREBASE !== "true"`
- Sistema de limites DEVE funcionar mesmo em modo mock
- Usar uid do mock: `"mock-user-123"`

### 🔴 **CRÍTICO 4: ESModules**
- Projeto usa `"type": "module"` no package.json
- SEMPRE usar `import/export`, NUNCA `require/module.exports`
- Paths devem incluir extensão `.js` em imports locais

### 🔴 **CRÍTICO 5: Não quebrar análise existente**
- Worker Redis já funciona (`work/worker-redis.js`)
- Pipeline completo já funciona (`work/api/audio/pipeline-complete.js`)
- NÃO mexer em nada relacionado ao processamento
- APENAS adicionar camada de autenticação + limites

---

## 📁 7. ARQUIVOS A SEREM CRIADOS/MODIFICADOS

### ✅ **CRIAR:**
1. `work/lib/user/userPlans.js` - Módulo centralizado
2. `api/webhook/mercadopago.js` - Webhook de pagamentos

### ✅ **MODIFICAR:**
1. `api/chat.js` - Integrar limites centralizados
2. `api/audio/analyze.js` - Adicionar autenticação + limites

### ❌ **NÃO MEXER:**
1. `work/worker-redis.js` - Worker funcionando
2. `work/api/audio/pipeline-complete.js` - Pipeline funcionando
3. `work/lib/queue.js` - Fila BullMQ funcionando
4. `api/firebaseAdmin.js` - Inicialização do Firebase
5. `api/jobs/analyze.js` - Arquivo desatualizado (ignorar)

---

## 🎯 8. ORDEM DE EXECUÇÃO RECOMENDADA

1. ✅ **ETAPA 1:** Criar `work/lib/user/userPlans.js` completo
2. ✅ **ETAPA 2:** Integrar em `api/chat.js` (menos crítico, já tem limites)
3. ✅ **ETAPA 3:** Integrar em `api/audio/analyze.js` (mais crítico, sem limites)
4. ✅ **ETAPA 4:** Criar `api/webhook/mercadopago.js`
5. ✅ **ETAPA 5:** Testar fluxo completo

---

## ✅ 9. VALIDAÇÃO DE SUCESSO

### **Chat com limites:**
```bash
# Usuário free: 20 mensagens/dia
# Após 20 mensagens:
{
  "error": "limit_reached",
  "message": "Você atingiu o limite diário de mensagens do seu plano."
}
```

### **Análise com limites:**
```bash
# Usuário free: 3 análises/dia
# Após 3 análises:
{
  "error": "limit_reached",
  "message": "Você atingiu o limite diário de análises do seu plano."
}
```

### **Webhook aplicando plano:**
```bash
# Após pagamento aprovado:
# Firestore atualizado:
{
  "plan": "pro",
  "proExpiresAt": "2025-01-09T..."
}
```

---

## 🔒 GARANTIAS DE SEGURANÇA

✅ Análise de áudio continua funcionando  
✅ Worker Redis não é alterado  
✅ Pipeline completo não é alterado  
✅ Sistema de fila BullMQ não é alterado  
✅ Firebase Admin mantém modo MOCK compatível  
✅ Paths relativos calculados corretamente  
✅ ESModules sintaxe mantida  
✅ Nenhuma funcionalidade quebrada  

**AUDITORIA CONCLUÍDA - PRONTO PARA IMPLEMENTAÇÃO** ✅
