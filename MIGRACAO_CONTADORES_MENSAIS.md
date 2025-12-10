# 🔄 MIGRAÇÃO: SISTEMA DE CONTADORES MENSAIS

## 📋 SUMÁRIO EXECUTIVO

**Data:** 10/12/2025  
**Objetivo:** Migrar sistema de limites de contadores diários (`analysesToday`, `messagesToday`, `lastResetAt`) para contadores mensais (`analysesMonth`, `messagesMonth`, `billingMonth`).

**Status:** ✅ **CONCLUÍDO**

---

## 🎯 MOTIVAÇÃO

### Problema Anterior
- Contadores resetavam **diariamente** (`lastResetAt` comparado com dia atual)
- Campos confusos: `analysesToday` e `messagesToday` eram reaproveitados para contagem mensal
- Nomenclatura enganosa causava confusão no código

### Nova Solução
- Contadores resetam **mensalmente** no primeiro uso do mês
- Campos com nomes corretos: `analysesMonth`, `messagesMonth`, `billingMonth`
- Reset lazy (preguiçoso) na primeira operação do mês
- Compatibilidade retroativa: documentos antigos são automaticamente migrados

---

## 📊 MUDANÇAS NO FIRESTORE

### Schema Anterior (DESCONTINUADO)
```javascript
{
  uid: string,
  plan: "free" | "plus" | "pro",
  analysesToday: number,      // ❌ DESCONTINUADO
  messagesToday: number,       // ❌ DESCONTINUADO
  lastResetAt: string,         // ❌ DESCONTINUADO (ISO date "YYYY-MM-DD")
  plusExpiresAt: string | null,
  proExpiresAt: string | null,
  createdAt: string,
  updatedAt: string
}
```

### Schema Novo (ATUAL)
```javascript
{
  uid: string,
  plan: "free" | "plus" | "pro",
  analysesMonth: number,       // ✅ NOVO - Contador mensal de análises full
  messagesMonth: number,       // ✅ NOVO - Contador mensal de mensagens
  billingMonth: string,        // ✅ NOVO - Mês de billing ("YYYY-MM")
  plusExpiresAt: string | null,
  proExpiresAt: string | null,
  createdAt: string,
  updatedAt: string
}
```

### Compatibilidade Retroativa
Documentos antigos que ainda possuem `analysesToday/messagesToday/lastResetAt` são automaticamente normalizados:
- Campos antigos são **ignorados**
- `analysesMonth` e `messagesMonth` inicializados em `0`
- `billingMonth` definido como mês atual (`YYYY-MM`)
- Atualização lazy na primeira operação (sem migração em massa)

---

## 🔧 MUDANÇAS NO CÓDIGO

### 1. `work/lib/user/userPlans.js` (REESCRITO COMPLETAMENTE)

#### ✅ Novos Limites
```javascript
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 3,
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  plus: {
    maxMessagesPerMonth: 60,
    maxFullAnalysesPerMonth: 20,
    hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
    allowReducedAfterLimit: true,
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    hardCapAnalysesPerMonth: 200,         // Hard cap: 200/mês e bloqueia
    allowReducedAfterLimit: false,        // Sem reduced, só erro
  },
};
```

#### ✅ Reset Mensal Lazy
```javascript
async function normalizeUserDoc(user, uid, now = new Date()) {
  const currentMonth = getCurrentMonthKey(now); // "2025-12"
  
  // Reset mensal lazy
  if (user.billingMonth !== currentMonth) {
    console.log(`🔄 Reset mensal aplicado para UID=${uid} (${user.billingMonth} → ${currentMonth})`);
    user.analysesMonth = 0;
    user.messagesMonth = 0;
    user.billingMonth = currentMonth;
    // Salvar no Firestore...
  }
  
  return user;
}
```

#### ✅ API Pública (NÃO MUDOU)
```javascript
// ✅ MESMAS ASSINATURAS - Apenas implementação interna mudou
export async function canUseAnalysis(uid);
export async function registerAnalysis(uid, mode);
export async function canUseChat(uid);
export async function registerChat(uid);
export async function getUserPlanInfo(uid);
export function getPlanFeatures(plan, analysisMode);
```

### 2. `work/api/audio/analyze.js` (SEM MUDANÇAS)
✅ Já usava a API correta:
```javascript
const analysisCheck = await canUseAnalysis(uid);
if (!analysisCheck.allowed) { /* erro */ }

const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisCheck.mode,
  features: getPlanFeatures(analysisCheck.user.plan, analysisCheck.mode),
  uid
};

await registerAnalysis(uid, analysisMode);
```

### 3. `work/api/chat.js` (SEM MUDANÇAS)
✅ Já usava a API correta:
```javascript
const chatCheck = await canUseChat(uid);
if (!chatCheck.allowed) { /* erro */ }

// Processa mensagem...

await registerChat(uid);
```

### 4. `work/api/audio/pipeline-complete.js` (SEM MUDANÇAS)
✅ Já implementava filtro de modo reduzido:
```javascript
if (planContext.analysisMode === 'reduced') {
  return {
    analysisMode: 'reduced',
    score: finalJSON.score,
    truePeak: finalJSON.truePeak,
    lufs: finalJSON.lufs,
    dr: finalJSON.dr,
    limitWarning: `Você atingiu o limite...`
  };
}
```

---

## 📈 REGRAS DE NEGÓCIO

### FREE (Plano Gratuito)
| Recurso | Limite | Após Limite |
|---------|--------|-------------|
| **Análises Full** | 3/mês | Modo reduzido ilimitado |
| **Chat** | 20 mensagens/mês | Bloqueado (erro `LIMIT_REACHED`) |
| **Sugestões** | ❌ Nunca | - |
| **Espectro Avançado** | ❌ Nunca | - |
| **Ajuda IA** | ❌ Nunca | - |
| **PDF** | ❌ Nunca | - |

### PLUS (Plano Intermediário)
| Recurso | Limite | Após Limite |
|---------|--------|-------------|
| **Análises Full** | 20/mês | Modo reduzido ilimitado |
| **Chat** | 60 mensagens/mês | Bloqueado (erro `LIMIT_REACHED`) |
| **Sugestões** | ✅ Só em Full | ❌ Em reduced |
| **Espectro Avançado** | ❌ Nunca | - |
| **Ajuda IA** | ❌ Nunca | - |
| **PDF** | ❌ Nunca | - |

### PRO (Plano Premium)
| Recurso | Limite | Após Limite |
|---------|--------|-------------|
| **Análises Full** | Ilimitado (hard cap: 200/mês) | **Bloqueado** (erro `LIMIT_REACHED`) |
| **Chat** | ♾️ Ilimitado | - |
| **Sugestões** | ✅ Sempre | - |
| **Espectro Avançado** | ✅ Sempre | - |
| **Ajuda IA** | ✅ Sempre | - |
| **PDF** | ✅ Sempre | - |

---

## 🧪 VALIDAÇÃO

### Cenário 1: Usuário FREE

**Setup:**
```javascript
{
  uid: "user123",
  plan: "free",
  analysesMonth: 0,
  messagesMonth: 0,
  billingMonth: "2025-12"
}
```

**Testes:**

| Ação | analysesMonth | messagesMonth | Resultado Esperado |
|------|---------------|---------------|--------------------|
| 1ª análise | 0 → 1 | 0 | ✅ JSON completo (sem sugestões) |
| 2ª análise | 1 → 2 | 0 | ✅ JSON completo |
| 3ª análise | 2 → 3 | 0 | ✅ JSON completo |
| 4ª análise | 3 (não incrementa) | 0 | ⚠️ JSON reduzido (score, TP, LUFS, DR) |
| 5ª análise | 3 | 0 | ⚠️ JSON reduzido |
| 1ª mensagem chat | 3 | 0 → 1 | ✅ Resposta normal |
| 20ª mensagem chat | 3 | 19 → 20 | ✅ Resposta normal |
| 21ª mensagem chat | 3 | 20 | 🚫 Erro `LIMIT_REACHED` |

### Cenário 2: Usuário PLUS

**Setup:**
```javascript
{
  uid: "userPlus",
  plan: "plus",
  analysesMonth: 19,
  messagesMonth: 50,
  billingMonth: "2025-12"
}
```

**Testes:**

| Ação | analysesMonth | messagesMonth | Resultado Esperado |
|------|---------------|---------------|--------------------|
| 20ª análise | 19 → 20 | 50 | ✅ JSON completo COM sugestões |
| 21ª análise | 20 | 50 | ⚠️ JSON reduzido SEM sugestões |
| 60ª mensagem | 20 | 59 → 60 | ✅ Resposta normal |
| 61ª mensagem | 20 | 60 | 🚫 Erro `LIMIT_REACHED` |

### Cenário 3: Usuário PRO

**Setup:**
```javascript
{
  uid: "userPro",
  plan: "pro",
  analysesMonth: 199,
  messagesMonth: 1000,
  billingMonth: "2025-12"
}
```

**Testes:**

| Ação | analysesMonth | messagesMonth | Resultado Esperado |
|------|---------------|---------------|--------------------|
| 200ª análise | 199 → 200 | 1000 | ✅ JSON completo (sugestões, espectro, tudo) |
| 201ª análise | 200 | 1000 | 🚫 Erro `LIMIT_REACHED` (SEM modo reduced) |
| 1500ª mensagem | 200 | 1000 → 1001 | ✅ Resposta normal (ilimitado) |

### Cenário 4: Reset Mensal Automático

**Setup (31/12/2025 23:59):**
```javascript
{
  uid: "user123",
  plan: "free",
  analysesMonth: 3,
  messagesMonth: 20,
  billingMonth: "2025-12"
}
```

**Ação (01/01/2026 00:01): Fazer 1ª análise do mês**

**Resultado:**
```javascript
// Antes de processar, normalizeUserDoc detecta mudança de mês:
{
  uid: "user123",
  plan: "free",
  analysesMonth: 0,        // ✅ RESETADO
  messagesMonth: 0,        // ✅ RESETADO
  billingMonth: "2026-01"  // ✅ ATUALIZADO
}

// Análise procede normalmente como "full" (contador: 0 → 1)
```

---

## 🔐 SEGURANÇA E COMPATIBILIDADE

### ✅ Garantias Implementadas

1. **Lazy Migration:**
   - Documentos antigos NÃO são migrados em massa
   - Migração automática na primeira operação de cada usuário
   - Zero downtime, zero risco de perda de dados

2. **Validação de Tipos:**
   ```javascript
   if (typeof user.analysesMonth !== 'number' || isNaN(user.analysesMonth)) {
     user.analysesMonth = 0;
   }
   ```

3. **Fallback Seguro:**
   - Se `billingMonth` ausente → assume mês atual
   - Se `plan` ausente → assume "free"
   - Se contadores ausentes → assume 0

4. **Logs Detalhados:**
   ```
   🔄 [USER-PLANS] Reset mensal aplicado para UID=abc123 (2025-11 → 2025-12)
   ✅ [USER-PLANS] Análise COMPLETA permitida (FREE): abc123 (2/3) - 1 restantes
   📝 [USER-PLANS] Análise COMPLETA registrada: abc123 (total no mês: 3)
   ```

5. **API Externa Inalterada:**
   - `canUseAnalysis()`, `registerAnalysis()`, etc. mantêm mesma assinatura
   - Código consumidor (`analyze.js`, `chat.js`) NÃO precisou mudar

---

## 📝 LOGS ESPERADOS

### Novo Usuário (Primeira Criação)
```
🔍 [USER-PLANS] getOrCreateUser chamado para UID: newUser123
📊 [USER-PLANS] Snapshot obtido - Existe: false
💾 [USER-PLANS] Criando novo usuário no Firestore...
✅ [USER-PLANS] Novo usuário criado com sucesso: newUser123 (plan: free, billingMonth: 2025-12)
```

### Usuário Antigo (Primeira Operação Após Migração)
```
♻️ [USER-PLANS] Usuário já existe, normalizando...
💾 [USER-PLANS] Usuário normalizado e salvo: oldUser456 (plan: free, billingMonth: 2025-12)
```

### Reset Mensal Automático
```
🔄 [USER-PLANS] Reset mensal aplicado para UID=user789 (2025-11 → 2025-12)
💾 [USER-PLANS] Usuário normalizado e salvo: user789 (plan: plus, billingMonth: 2025-12)
```

### Análise Full (FREE - 2/3)
```
✅ [USER-PLANS] Análise COMPLETA permitida (FREE): user123 (2/3) - 1 restantes
📝 [USER-PLANS] Análise COMPLETA registrada: user123 (total no mês: 3)
```

### Análise Reduzida (FREE - 4/3)
```
⚠️ [USER-PLANS] Análise em MODO REDUZIDO (FREE): user123 (3/3 completas usadas)
⏭️ [USER-PLANS] Análise NÃO registrada (modo: reduced): user123
```

### Hard Cap PRO (201/200)
```
🚫 [USER-PLANS] HARD CAP ATINGIDO: userPro (200/200) - BLOQUEADO
```

---

## 🚀 PRÓXIMOS PASSOS

### ✅ Concluído
- [x] Reescrever `userPlans.js` com novos campos
- [x] Implementar reset mensal lazy
- [x] Manter API pública inalterada
- [x] Validar compatibilidade retroativa
- [x] Documentar migração completa

### 📋 Opcional (Futuro)
- [ ] Criar script de limpeza para remover campos antigos após 3 meses
- [ ] Dashboard admin para visualizar `billingMonth` de usuários
- [ ] Webhook para reset manual de contadores (suporte)
- [ ] Métricas agregadas: análises/mês por plano

---

## 📞 SUPORTE

### Como forçar reset manual de um usuário?
```javascript
import { getFirestore } from './firebase/admin.js';

const db = getFirestore();
await db.collection('usuarios').doc('UID_AQUI').update({
  analysesMonth: 0,
  messagesMonth: 0,
  billingMonth: new Date().toISOString().slice(0, 7), // Mês atual
  updatedAt: new Date().toISOString()
});
```

### Como verificar contadores de um usuário?
```javascript
import { getUserPlanInfo } from './work/lib/user/userPlans.js';

const info = await getUserPlanInfo('UID_AQUI');
console.log(info);
// {
//   plan: 'free',
//   analysesMonth: 2,
//   analysesLimit: 3,
//   analysesRemaining: 1,
//   messagesMonth: 5,
//   messagesLimit: 20,
//   messagesRemaining: 15,
//   billingMonth: '2025-12'
// }
```

---

**Data de Conclusão:** 10/12/2025  
**Autor:** Sistema de Planos SoundyAI  
**Status:** ✅ **MIGRAÇÃO COMPLETA E VALIDADA**
