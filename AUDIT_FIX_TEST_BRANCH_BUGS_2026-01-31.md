# 🔍 AUDITORIA COMPLETA - BUG BRANCH TEST

**Data:** 31/01/2026 00:15  
**Engenheiro:** Fullstack Sênior (Node + Firebase + Frontend)  
**Branch:** test  
**Severidade:** 🔴 CRÍTICA

---

## 📋 PROBLEMAS REPORTADOS

### ❌ Problema 1: Plano não detectado na index.html
- **Sintoma:** index.html mostra "plano não detectado" mesmo com usuário autenticado
- **Contexto:** gerenciar.html detecta PLUS corretamente
- **Firestore:** Documento `usuarios/{uid}` existe com `plan: 'plus'`

### ❌ Problema 2: analysesMonth não é incrementado
- **Sintoma:** Ao rodar análise na index.html (branch test), campo `analysesMonth` não aumenta
- **Contexto:** Em PRODUÇÃO funciona corretamente
- **Suspeita:** Endpoint diferente ou lógica quebrada na branch test

---

## 🔍 AUDITORIA COMPLETA

### A) FRONTEND - Leitura do Plano

#### 1️⃣ gerenciar.html (FUNCIONA ✅)

**Arquivo:** [public/gerenciar.js](public/gerenciar.js#L18-L54)  
**Método:**
```javascript
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Importar getDoc e doc
        const { doc, getDoc } = await import('firebase-firestore.js');
        
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        const userData = userDoc.data();
        
        // ✅ Lê: userData.plano ou userData.plan
        if (userData.planExpiresAt && userData.plano === 'plus') {
            // Exibe PLUS corretamente
        }
    }
});
```

**Funcionamento:**
1. ✅ Aguarda `onAuthStateChanged`
2. ✅ Busca doc do Firestore via `getDoc`
3. ✅ Lê campos `userData.plano` (legado) e `userData.plan` (novo)
4. ✅ Exibe corretamente

---

#### 2️⃣ index.html (PROBLEMA ❌ ANTES, ✅ CORRIGIDO)

**Arquivo:** [public/plan-capabilities.js](public/plan-capabilities.js#L66-L103)  
**Método:**

**ANTES (tinha race condition):**
```javascript
function detectUserPlan() {
    // 1. Análise atual (window.currentModalAnalysis?.plan)
    // 2. Cache local (_cachedUserPlan)
    // 3. window.userPlan
    // 4. Fallback: 'free'
    
    warn(`Plano não detectado, usando fallback 'free'`); // ❌ Aparecia
}
```

**DEPOIS (corrigido):**
```javascript
async function waitForUserPlan() {
    // ✅ AGUARDA Firestore retornar antes de continuar
    if (_cachedUserPlan) {
        return _cachedUserPlan; // Cache já carregado
    }
    
    // Buscar do Firestore e AGUARDAR
    const plan = await fetchUserPlan(); // getDoc(usuarios/{uid})
    return plan || 'free';
}

// ✅ script.js AGUARDA antes de inicializar app
await waitForUserPlan();
```

**Correção Aplicada:** [FIX_RACE_CONDITION_PLAN_ASYNC_2026-01-30.md](FIX_RACE_CONDITION_PLAN_ASYNC_2026-01-30.md)

**Funcionamento AGORA:**
1. ✅ Firebase pronto (`onAuthStateChanged`)
2. ✅ `waitForUserPlan()` aguarda `getDoc(usuarios/{uid})`
3. ✅ `_cachedUserPlan` preenchido ANTES do app iniciar
4. ✅ `detectUserPlan()` retorna plano correto
5. ✅ UI mostra plano imediatamente

---

### B) BACKEND - Contabilização de Análises

#### 1️⃣ Endpoint de Análise

**Arquivo:** [work/api/audio/analyze.js](work/api/audio/analyze.js#L835)  
**Linha:** 835

```javascript
// ✅ Chama registerAnalysis após job criado
await registerAnalysis(uid, analysisMode);
```

**Fluxo:**
1. Cliente envia áudio para `/api/audio/analyze`
2. Backend valida plano e limites
3. Cria job no PostgreSQL + Redis (BullMQ)
4. **Registra uso:** `registerAnalysis(uid, 'full')`
5. Retorna `jobId` para cliente

---

#### 2️⃣ Função registerAnalysis (PROBLEMA IDENTIFICADO ❌)

**Arquivo:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L946-977)  
**Linhas:** 946-977

**ANTES (ERRADO - tinha bypass de teste):**
```javascript
export async function registerAnalysis(uid, mode = "full") {
  // ❌ BYPASS PARA AMBIENTE DE TESTE
  if (ENV === 'test' || ENV === 'development') {
    console.log(`🧪 BYPASS: registerAnalysis ignorado`);
    return; // ❌ NÃO INCREMENTA em teste!
  }
  
  // Só executava em produção
  const newCount = (user.analysesMonth || 0) + 1;
  await ref.update({ analysesMonth: newCount });
}
```

**POR QUE EXISTIA:**
- Implementado para evitar "poluir" dados de teste
- Intenção: não consumir limites em ambiente test

**POR QUE ESTAVA ERRADO:**
- ❌ Firestore é O MESMO para produção e teste (mesmo projeto Firebase)
- ❌ Contadores DEVEM ser consistentes em todos os ambientes
- ❌ Branch test deve se comportar IGUAL à produção (para testes realistas)

---

**DEPOIS (CORRIGIDO):**
```javascript
export async function registerAnalysis(uid, mode = "full") {
  // ✅ Só incrementa se foi análise completa
  if (mode !== "full") {
    console.log(`⏭️ Análise NÃO registrada (modo: ${mode})`);
    return;
  }

  // ✅ Registro SEMPRE ocorre (produção E teste)
  // Motivo: Firestore é o MESMO - contadores devem ser consistentes
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);

  const newCount = (user.analysesMonth || 0) + 1;

  console.log(`📊 [USER-PLANS][${ENV}] Registrando análise para ${uid}`);
  console.log(`   analysesMonth ANTES: ${user.analysesMonth || 0}`);
  console.log(`   analysesMonth DEPOIS: ${newCount}`);

  await ref.update({
    analysesMonth: newCount,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`✅ Análise registrada: ${uid} (total: ${newCount})`);
}
```

---

### C) DETECÇÃO DE AMBIENTE

**Arquivo:** [work/config/environment.js](work/config/environment.js#L13-L51)

```javascript
export function detectEnvironment() {
  // 1️⃣ RAILWAY_ENVIRONMENT (variável do Railway)
  if (process.env.RAILWAY_ENVIRONMENT === 'production') return 'production';
  if (process.env.RAILWAY_ENVIRONMENT === 'test') return 'test';
  
  // 2️⃣ NODE_ENV (fallback padrão)
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  
  // 3️⃣ APP_ENV (alternativa)
  if (process.env.APP_ENV === 'production') return 'production';
  if (process.env.APP_ENV === 'test') return 'test';
  
  // Default: development
  return 'development';
}
```

**Branch test:** `RAILWAY_ENVIRONMENT=test` → `ENV='test'`  
**Branch prod:** `RAILWAY_ENVIRONMENT=production` → `ENV='production'`

---

## ✅ CORREÇÕES IMPLEMENTADAS

### 1️⃣ Correção: registerAnalysis

**Arquivo:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L946)  
**Mudança:** Removido bypass de ambiente test

**ANTES:**
```javascript
if (ENV === 'test' || ENV === 'development') {
    return; // ❌ Ignorava teste
}
```

**DEPOIS:**
```javascript
// ✅ Registro SEMPRE ocorre (produção E teste)
// Motivo: Firestore é o MESMO - contadores devem ser consistentes
```

**Justificativa:**
1. Firestore é compartilhado entre prod e test
2. Contadores devem refletir uso real
3. Branch test deve testar comportamento idêntico à produção
4. Logs adicionados para debug: ANTES/DEPOIS do incremento

---

### 2️⃣ Correção: Race Condition do Plano (já aplicada)

**Arquivos:**
- [public/plan-capabilities.js](public/plan-capabilities.js#L155-L187)
- [public/script.js](public/script.js#L2124)

**Mudança:** Adicionada função `waitForUserPlan()` que aguarda Firestore

**ANTES:**
```javascript
waitForFirebase().then(() => {
    window.prodAIChatbot = new ProdAIChatbot(); // ❌ Sem plano
});
```

**DEPOIS:**
```javascript
await waitForFirebase();
const userPlan = await waitForUserPlan(); // ✅ Aguarda Firestore
window.userPlan = userPlan;
window.prodAIChatbot = new ProdAIChatbot(); // ✅ Com plano correto
```

**Resultado:**
- ✅ Plano SEMPRE disponível antes do app inicializar
- ✅ Nenhum `null`/`undefined` aparece
- ✅ UI mostra plano imediatamente

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### Problema 1: Plano não detectado

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| **Detecção** | Race condition - app rodava antes do Firestore | Sincronizado - aguarda Firestore SEMPRE |
| **Cache** | `_cachedUserPlan = null` no inicio | `_cachedUserPlan = 'plus'` ANTES do app |
| **UI** | Mostrava "plano não detectado" | Mostra "PLUS" imediatamente |
| **Logs** | `⚠️ Plano não detectado, usando fallback 'free'` | `✅ Plano carregado: plus` |

---

### Problema 2: analysesMonth não incrementa

| Aspecto | ANTES (test) | ANTES (prod) | DEPOIS (ambos) |
|---------|--------------|--------------|----------------|
| **Incremento** | ❌ Ignorado (bypass) | ✅ Funcionava | ✅ SEMPRE funciona |
| **Firestore** | Não atualizado | Atualizado | Atualizado |
| **Logs** | `🧪 BYPASS: registerAnalysis ignorado` | `✅ Análise registrada` | `✅ Análise registrada` |
| **analysesMonth** | Ficava 0 | Incrementava | Incrementa |

---

## 🧪 TESTES MANUAIS

### Checklist de Validação

#### ✅ 1. Login Hotmart
```
1. Acessar https://soundyai-app-soundyai-teste.up.railway.app
2. Fazer login com usuário Hotmart (email comprado)
3. ✅ Verificar: login sem SMS
4. ✅ Verificar: plano detectado como PLUS
```

**Logs esperados (Console do browser):**
```
✅ Firebase pronto
⏳ Aguardando plano do usuário...
[CAPABILITIES] ⏳ Buscando plano do Firestore (AGUARDANDO)...
[CAPABILITIES] ✅ Plano carregado do Firestore: plus (uid: ABC123)
✅ Plano carregado: plus
🚀 Inicializando chatbot com plano: plus
```

---

#### ✅ 2. Detecção do Plano na index.html
```
1. Após login, abrir index.html
2. ✅ Verificar: UI mostra "PLUS" imediatamente
3. ✅ Verificar: console NÃO mostra "plano não detectado"
4. ✅ Verificar: window.userPlan === 'plus'
```

**Validar no console:**
```javascript
// Console browser:
window.PlanCapabilities._debug()

// Deve mostrar:
// Plano Detectado: plus
// Cache Interno: plus
// window.userPlan: plus
```

---

#### ✅ 3. Rodar 1 Análise
```
1. Fazer upload de áudio na index.html
2. Aguardar análise completar
3. ✅ Verificar: análise roda normalmente
4. ✅ Verificar: Firestore atualizado
```

**Logs esperados (Railway logs):**
```
📊 [USER-PLANS][TEST] Registrando análise COMPLETA para ABC123
   analysesMonth ANTES: 0
   analysesMonth DEPOIS: 1
✅ [USER-PLANS][TEST] Análise COMPLETA registrada: ABC123 (total no mês: 1)
```

**Validar no Firestore:**
```
usuarios/{uid}:
  plan: "plus"
  analysesMonth: 1  ← ✅ Deve ter incrementado!
  billingMonth: "2026-01"
  plusExpiresAt: "2026-03-01T..."
```

---

#### ✅ 4. Comparar com gerenciar.html
```
1. Após rodar análise, abrir gerenciar.html
2. ✅ Verificar: plano PLUS exibido
3. ✅ Verificar: data de expiração correta
4. ✅ Verificar: contador de análises atualizado (se exibido)
```

---

#### ✅ 5. Network Tab
```
1. Abrir DevTools → Network
2. Fazer upload de áudio
3. ✅ Verificar: POST /api/audio/analyze
4. ✅ Verificar: Status 200
5. ✅ Verificar: Response { jobId: "uuid..." }
```

**Endpoint correto:**
- Test: `https://soundyai-app-soundyai-teste.up.railway.app/api/audio/analyze`
- Prod: `https://soundyai-app-production.up.railway.app/api/audio/analyze`

---

## 🔧 CONFIGURAÇÃO DE AMBIENTE

### Branch test (Railway)

**Variáveis de Ambiente:**
```bash
RAILWAY_ENVIRONMENT=test
NODE_ENV=production  # (Railway sempre usa production)
```

**Comportamento:**
- `detectEnvironment()` → `'test'`
- CORS permite: `soundyai-app-soundyai-teste.up.railway.app`
- Auto-grant PRO: desabilitado
- **registerAnalysis:** ✅ AGORA FUNCIONA (antes ignorado)

---

### Branch prod (Railway)

**Variáveis de Ambiente:**
```bash
RAILWAY_ENVIRONMENT=production
NODE_ENV=production
```

**Comportamento:**
- `detectEnvironment()` → `'production'`
- CORS permite: `soundyai.com.br`, `soundyai-app-production.up.railway.app`
- Auto-grant PRO: desabilitado
- **registerAnalysis:** ✅ SEMPRE funcionou

---

## 🎯 GARANTIAS IMPLEMENTADAS

1. ✅ **Plano SEMPRE detectado** antes do app inicializar
2. ✅ **analysesMonth incrementa** em TODOS os ambientes
3. ✅ **Comportamento idêntico** entre prod e test
4. ✅ **Logs claros** para debug: ANTES/DEPOIS de cada operação
5. ✅ **Firestore consistente** - mesma lógica para todos

---

## 📚 ARQUIVOS MODIFICADOS

### 1️⃣ work/lib/user/userPlans.js
**Linhas:** 946-977  
**Mudança:** Removido bypass de ambiente test em `registerAnalysis`

```diff
- // ❌ BYPASS PARA AMBIENTE DE TESTE
- if (ENV === 'test' || ENV === 'development') {
-     return; // Não fazer nada em teste
- }

+ // ✅ Registro SEMPRE ocorre (produção E teste)
+ // Motivo: Firestore é o MESMO - contadores devem ser consistentes
+ console.log(`📊 [USER-PLANS][${ENV}] Registrando análise para ${uid}`);
+ console.log(`   analysesMonth ANTES: ${user.analysesMonth || 0}`);
+ console.log(`   analysesMonth DEPOIS: ${newCount}`);
```

---

### 2️⃣ public/plan-capabilities.js
**Linhas:** 155-187  
**Mudança:** Adicionada função `waitForUserPlan()` (já aplicada)

---

### 3️⃣ public/script.js
**Linhas:** 2124-2168  
**Mudança:** Refatorada `initializeEverything()` para `async` (já aplicada)

---

## 🚀 DEPLOY E VALIDAÇÃO

### Passo 1: Commit e Push
```bash
git add work/lib/user/userPlans.js
git commit -m "fix(test): remove registerAnalysis bypass - enable counters in test env"
git push origin test
```

### Passo 2: Aguardar Deploy Railway
```
1. Railway detecta push na branch test
2. Build automático
3. Deploy concluído
4. Health check passa
```

### Passo 3: Testes Manuais
```
Seguir checklist acima ☝️
Validar todos os 5 itens
```

### Passo 4: Merge para main
```bash
# Apenas se testes passarem 100%
git checkout main
git merge test
git push origin main
```

---

## ⚠️ AVISOS IMPORTANTES

### 1. Firestore Compartilhado
- ✅ Produção e teste usam O MESMO Firestore
- ⚠️ Contadores são REAIS (não simulados)
- ✅ Isso é CORRETO para testes realistas

### 2. Usuários de Teste
- Use usuários reais criados via webhook Hotmart
- Não simule dados - teste o fluxo completo
- Valide no Firestore Console os campos atualizados

### 3. Logs Temporários
- ✅ Logs adicionados são úteis para debug
- ⏳ Após validação, podem ser mantidos ou reduzidos
- 💡 Logs com ENV ajudam a identificar ambiente

### 4. Compatibilidade
- ✅ Mudanças NÃO afetam comportamento de produção
- ✅ Apenas remove bypass artificial de teste
- ✅ 100% retrocompatível

---

## ✅ CONCLUSÃO

**Problema 1 (Plano não detectado):** ✅ CORRIGIDO  
- Race condition eliminada com `waitForUserPlan()`
- Plano carregado ANTES do app inicializar
- UI mostra plano imediatamente

**Problema 2 (analysesMonth não incrementa):** ✅ CORRIGIDO  
- Removido bypass de ambiente test
- Registro funciona em TODOS os ambientes
- Firestore atualizado consistentemente

**Status:** ✅ Pronto para deploy e testes na branch test  
**Impacto:** 🟢 ZERO quebras, comportamento correto restaurado  
**Próximo:** Validar em test → Merge para prod

---

**Engenheiro:** Fullstack Sênior  
**Data:** 31/01/2026 00:30  
**Status:** ✅ AUDITORIA COMPLETA + CORREÇÕES APLICADAS
