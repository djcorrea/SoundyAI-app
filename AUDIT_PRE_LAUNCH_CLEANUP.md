# 🔍 AUDITORIA PRÉ-LANÇAMENTO - LIMPEZA DE USUÁRIOS

**Data:** 8 de janeiro de 2026  
**Objetivo:** Documentar estrutura do Firebase antes de criar script de limpeza de usuários de teste

---

## ✅ ETAPA 1 — AUDITORIA DA ESTRUTURA

### 1. Collection de Usuários
**Collection:** `usuarios`  
**Localização:** Raiz do Firestore  
**Fonte:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L8)

```javascript
const USERS = "usuarios"; // Coleção existente no Firestore
```

### 2. Campo que Define o Plano
**Campo:** `plan` (string)  
**Valores possíveis:**
- `"free"` — Plano gratuito
- `"plus"` — Plano Plus (20 análises/mês)
- `"pro"` — Plano Pro (60 análises/mês)
- `"dj"` — **Plano DJ BETA (15 dias de acesso)** ⚠️ **ESTE DEVE SER MANTIDO**
- `"studio"` — Plano Studio (400 análises/mês, R$99,90)

**Fonte:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L14-L60)

### 3. Fonte de Verdade
✅ **Firestore é a fonte de verdade**

Conforme [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L677-L710), o sistema:
- Busca `plan` diretamente do Firestore
- Normaliza o documento automaticamente (`normalizeUserDoc`)
- Aplica expiração de planos
- Gerencia limites mensais

**O front-end NÃO define o plano**, apenas exibe.

### 4. Relação Auth ↔ Firestore
✅ **Estrutura 1:1**

Conforme [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L220-L240):

```javascript
export async function getOrCreateUser(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const doc = await ref.get();

  if (!doc.exists) {
    // Criar usuário automaticamente se não existir
    const newUser = { plan: "free", ... };
    await ref.set(newUser);
    return newUser;
  }

  return doc.data();
}
```

**IMPORTANTE:**
- Se o usuário está no Auth mas **não está no Firestore**, o sistema cria automaticamente com `plan: "free"`
- Portanto, **usuários sem documento no Firestore são raros**, mas possíveis se forem criados manualmente no console do Firebase

### 5. Subcoleções Ligadas ao Usuário
✅ **NÃO existem subcoleções**

**Evidências:**
- Busca por `\.doc\(uid\)\.collection` retornou **0 resultados**
- O código de [work/api/delete-account.js](work/api/delete-account.js#L74) mostra que a exclusão de conta só apaga:
  1. Documento principal `usuarios/{uid}`
  2. Usuário no Firebase Auth

**Conclusão:** Todos os dados do usuário estão **no documento principal**.

Campos armazenados no documento:
```javascript
{
  plan: "free|plus|pro|dj|studio",
  analysesMonth: 0,
  messagesMonth: 0,
  imagesMonth: 0,
  billingMonth: "2026-01",
  plusExpiresAt: null,
  proExpiresAt: null,
  djExpiresAt: "2026-01-23T...", // Data de expiração do DJ Beta
  studioExpiresAt: null,
  perfil: { /* entrevista */ },
  subscription: { /* Stripe */ },
  email: "user@example.com",
  createdAt: "2026-01-01T...",
  updatedAt: "2026-01-08T..."
}
```

---

## ✅ ETAPA 2 — REGRAS DE PROTEÇÃO

### Regra Principal
```
SE plan === "dj" → MANTER (NÃO APAGAR)
CASO CONTRÁRIO → APAGAR (free, plus, pro, studio, null, undefined)
```

### Casos Especiais

#### Usuário no Auth sem documento no Firestore
**Ação:** APAGAR (considerar usuário de teste)  
**Motivo:** Sistema cria documento automaticamente no primeiro uso, então falta de documento indica conta não utilizada.

#### Usuário com plan === "dj" expirado
**Campo:** `djExpiresAt` (timestamp ISO 8601)  
**Ação:** APAGAR apenas se `Date.now() > djExpiresAt`  
**Exceção:** Se `djExpiresAt` for `null` ou `undefined`, **MANTER** (pode ser DJ vitalício)

---

## ✅ ETAPA 3 — CONTRATO DO SCRIPT

### Modo DRY_RUN (padrão)
```javascript
const DRY_RUN = true; // Só muda manualmente para false
```

**Comportamento:**
- ❌ NÃO apaga nada
- ✅ Lista todos os usuários:
  - `[MANTER] email@example.com (uid: abc123) - plan: dj`
  - `[APAGAR] test@test.com (uid: xyz789) - plan: free`
- ✅ Mostra estatísticas:
  - Total de usuários no Auth
  - Mantidos (plano DJ válido)
  - Marcados para exclusão

### Modo Destrutivo (DRY_RUN = false)
**Ordem de exclusão:**
1. Documento no Firestore (`usuarios/{uid}`)
2. Usuário no Firebase Auth

**Tratamento de erros:**
- `try/catch` individual por usuário
- Erro em um usuário NÃO interrompe os demais
- Log detalhado de sucessos e falhas

---

## ✅ ETAPA 4 — SEGURANÇA E VALIDAÇÕES

### Validações Obrigatórias
1. ✅ Verificar se `FIREBASE_SERVICE_ACCOUNT` está definida
2. ✅ Confirmar que `DRY_RUN` está `true` ao iniciar
3. ✅ Exigir confirmação manual antes de mudar `DRY_RUN` para `false`
4. ✅ Validar que `plan === "dj"` (case-sensitive)
5. ✅ Validar data de expiração (`djExpiresAt`)

### Logs de Auditoria
```
[DRY-RUN] Iniciando auditoria...
[KEEP] email@example.com (uid: abc123) - plan: dj, expires: 2026-01-30
[DELETE] test1@test.com (uid: xyz789) - plan: free
[DELETE] test2@test.com (uid: def456) - NO FIRESTORE DOC
[SUMMARY] Total: 100 | Keep: 5 | Delete: 95
```

---

## ✅ ETAPA 5 — CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar `scripts/cleanup-users.js`
- [ ] Importar Firebase Admin SDK corretamente
- [ ] Implementar modo DRY_RUN (padrão: true)
- [ ] Implementar paginação (listUsers 1000)
- [ ] Implementar verificação de `plan === "dj"`
- [ ] Implementar verificação de `djExpiresAt`
- [ ] Implementar exclusão Firestore → Auth
- [ ] Implementar try/catch por usuário
- [ ] Implementar logs detalhados
- [ ] Testar em DRY_RUN
- [ ] Documentar como rodar o script

---

## 📊 ESTRUTURA DO PROJETO

```
SoundyAI/
├── firebase/
│   └── admin.js          ← Singleton do Firebase Admin
├── work/
│   └── lib/
│       └── user/
│           └── userPlans.js  ← Lógica de planos
├── scripts/              ← NOVO: Scripts de manutenção
│   └── cleanup-users.js  ← Script de limpeza
└── .env                  ← FIREBASE_SERVICE_ACCOUNT
```

---

## ⚠️ RISCOS IDENTIFICADOS

### RISCO CRÍTICO: Apagar usuários DJ válidos
**Mitigação:**
- Verificação tripla: `plan === "dj"` AND (`djExpiresAt === null` OR `Date.now() < djExpiresAt`)
- DRY_RUN obrigatório antes de qualquer exclusão
- Log explícito de todos os usuários DJ mantidos

### RISCO MÉDIO: Apagar usuário sem ler Firestore
**Mitigação:**
- SEMPRE buscar documento do Firestore antes de decidir
- Se Firestore falhar, pular usuário e logar erro (não apagar por precaução)

### RISCO BAIXO: Script rodar em produção acidentalmente
**Mitigação:**
- DRY_RUN = true como padrão
- Comentário gigante antes da flag DRY_RUN
- Confirmação manual obrigatória

---

## ✅ CONCLUSÃO DA AUDITORIA

**APROVADO PARA CRIAR SCRIPT**

Todos os requisitos foram mapeados:
1. ✅ Collection identificada: `usuarios`
2. ✅ Campo de plano identificado: `plan`
3. ✅ Fonte de verdade confirmada: Firestore
4. ✅ Relação Auth-Firestore validada: 1:1
5. ✅ Subcoleções verificadas: Nenhuma
6. ✅ Regras de proteção definidas: `plan === "dj"`
7. ✅ Riscos mapeados e mitigados

**PRÓXIMOS PASSOS:**
1. Criar `scripts/cleanup-users.js`
2. Implementar conforme especificações desta auditoria
3. Testar em DRY_RUN
4. Rodar manualmente antes do lançamento oficial

---

**Autor:** GitHub Copilot  
**Revisão:** Aguardando aprovação do usuário
