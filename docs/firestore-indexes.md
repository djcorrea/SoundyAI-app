# 📑 Firestore - Índices Compostos Necessários

## 🎯 Contexto

O endpoint **HISTORY-API** (`api/history/index.js`) executa queries Firestore que exigem **índices compostos**.

Sem esses índices, você verá erros intermitentes:
```
FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/.../firestore/indexes?create_composite=...
```

**Importante:** O sistema continua funcionando (há fallbacks), mas o desempenho é degradado e você perde funcionalidades (ordenação, limite de histórico).

---

## 🔍 Queries que Exigem Índices

### 1️⃣ Verificação de Limite (POST /api/history)

**Localização:** `api/history/index.js` linha ~101-104

**Query:**
```javascript
historyRef
    .where('userId', '==', userId)
    .orderBy('createdAt', 'asc')
    .get()
```

**Função:** Conta quantas análises o usuário tem para aplicar limite de 50 análises e deletar as mais antigas.

**Índice necessário:**
- **Coleção:** `analysis_history`
- **Campos:** `userId` (ASC) + `createdAt` (ASC)
- **Query scope:** Collection

---

### 2️⃣ Listagem de Histórico (GET /api/history)

**Localização:** `api/history/index.js` linha ~201-205

**Query:**
```javascript
historyRef
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
```

**Função:** Lista as análises do usuário PRO ordenadas da mais recente para a mais antiga.

**Índice necessário:**
- **Coleção:** `analysis_history`
- **Campos:** `userId` (ASC) + `createdAt` (DESC)
- **Query scope:** Collection

---

## 🛠️ Como Criar os Índices

### Método 1: Automático via URL do Erro

1. Quando o erro aparecer nos logs, procure pela URL:
   ```
   https://console.firebase.google.com/v1/r/project/YOUR_PROJECT/firestore/indexes?create_composite=...
   ```

2. **Abra a URL** no navegador (já estará logado no Firebase)

3. O Firebase Console abrirá com o formulário **pré-preenchido**

4. Clique em **"Create Index"**

5. Aguarde ~2-5 minutos até o status mudar de "Building" para **"Enabled"**

---

### Método 2: Manual no Firebase Console

1. Acesse: https://console.firebase.google.com

2. Selecione seu projeto (SoundyAI)

3. Menu lateral: **Firestore Database** → **Indexes** (aba)

4. Clique em **"Create Index"**

5. Preencha para o **primeiro índice**:
   - **Collection ID:** `analysis_history`
   - **Query scope:** Collection
   - Adicione campos:
     - Campo: `userId` | Ordem: `Ascending`
     - Campo: `createdAt` | Ordem: `Ascending`
   - Clique em **"Create"**

6. Repita para o **segundo índice**:
   - **Collection ID:** `analysis_history`
   - **Query scope:** Collection
   - Adicione campos:
     - Campo: `userId` | Ordem: `Ascending`
     - Campo: `createdAt` | Ordem: `Descending`
   - Clique em **"Create"**

7. Aguarde os índices ficarem **"Enabled"** (status verde)

---

## ✅ Como Validar

### 1. Verificar Status no Console

1. Acesse: https://console.firebase.google.com → Firestore → Indexes

2. Confirme que ambos os índices aparecem com status **"Enabled"**:
   ```
   analysis_history  |  userId (ASC), createdAt (ASC)   | ✅ Enabled
   analysis_history  |  userId (ASC), createdAt (DESC)  | ✅ Enabled
   ```

### 2. Testar no App

**Pré-requisitos:**
- Usuário PRO ou DJ logado
- Pelo menos 2 análises salvas no histórico

**Passos:**
1. No terminal do servidor, rode:
   ```bash
   node server.js
   ```

2. Faça uma nova análise e aguarde o resultado

3. Monitore os logs do servidor:
   ```bash
   # ✅ Sucesso (índice funcionando):
   🕐 [HISTORY-API] ✅ Query com orderBy executada
   🕐 [HISTORY-API] Análises existentes: 3/50
   
   # ❌ Erro (índice faltando):
   🕐 [HISTORY-API] 🔴 DIAGNÓSTICO - FALTA ÍNDICE COMPOSTO
   🕐 [HISTORY-API] 📊 Query: checkDailyLimitQuery
   ```

4. Abra o histórico no app (botão "📜 Histórico" no header)

5. Verifique que:
   - Lista carrega sem erros
   - Análises aparecem ordenadas da mais recente para a mais antiga
   - Não há mensagens de fallback nos logs

### 3. Teste com cURL (opcional)

```bash
# Salvar análise
curl -X POST http://localhost:3000/api/history \
  -H "x-user-id: SEU_USER_ID" \
  -H "x-user-plan: pro" \
  -H "Content-Type: application/json" \
  -d '{"analysisResult": {...}}'

# Listar histórico
curl -X GET http://localhost:3000/api/history \
  -H "x-user-id: SEU_USER_ID" \
  -H "x-user-plan: pro"
```

---

## 🔬 Diagnóstico de Problemas

### Erro ainda persiste após criar índices

**Causa:** Índices ainda estão em "Building"

**Solução:** Aguarde 5-10 minutos. Índices complexos podem demorar mais se já houver muitos documentos.

---

### Erro diferente: "Permission denied"

**Causa:** Regras de segurança do Firestore bloqueando acesso

**Solução:** 
1. Vá em Firestore → Rules
2. Confirme que existe regra permitindo leitura/escrita em `analysis_history`
3. Exemplo de regra:
   ```
   match /analysis_history/{docId} {
     allow read, write: if request.auth != null;
   }
   ```

---

### Logs mostram "Query simples executada"

**Causa:** Fallback ativado porque o índice com orderBy falhou

**Sintoma:**
- Histórico funciona, mas ordenação pode estar incorreta
- Limite de 50 análises não é aplicado corretamente

**Solução:**
1. Confirme que criou os **dois índices** (ASC e DESC)
2. Aguarde status "Enabled"
3. Reinicie o servidor: `Ctrl+C` → `node server.js`
4. Teste novamente

---

## 📌 Observações Importantes

### Por que 2 índices diferentes?

Firestore exige índices **separados** para cada combinação de:
- Campos (userId + createdAt)
- **Direção do orderBy** (ASC vs DESC)

Por isso:
- `userId ASC + createdAt ASC` → para verificar limite
- `userId ASC + createdAt DESC` → para listar histórico (mais recente primeiro)

### Impacto no desempenho

**Sem índices:**
- Fallback para query simples (sem orderBy)
- Ordenação feita em memória no Node.js
- Limite de 50 não funciona corretamente (pode exceder)

**Com índices:**
- Query otimizada no Firestore
- Ordenação nativa (rápida)
- Limite aplicado corretamente no banco

### Custo

Índices compostos **não têm custo adicional** no Firestore.
Você paga apenas pelas operações de leitura/escrita (que já seriam feitas de qualquer forma).

---

## 🚀 Resumo Rápido

**TL;DR:**

1. Abra Firebase Console → Firestore → Indexes
2. Crie 2 índices na coleção `analysis_history`:
   - `userId (ASC) + createdAt (ASC)`
   - `userId (ASC) + createdAt (DESC)`
3. Aguarde status "Enabled"
4. Reinicie o servidor
5. Teste salvando e listando análises

**Resultado esperado:**
```
✅ Query com orderBy executada
✅ Análises existentes: X/50
✅ Y análises encontradas
```

---

## 📞 Suporte

Se o problema persistir após criar os índices:

1. Capture logs completos:
   ```bash
   node server.js 2>&1 | tee logs.txt
   ```

2. Capture screenshot da página Indexes no Firebase Console

3. Verifique o arquivo `AUDIT_README.md` para documentação geral do sistema

---

**Última atualização:** 05/01/2026  
**Versão:** 1.0  
**Responsável:** SoundyAI Backend Team
