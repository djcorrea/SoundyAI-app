# 🚨 INSTRUÇÕES MANUAIS - FIX NODE 20 NO RAILWAY

**Data:** 14 de dezembro de 2025  
**Problema:** Services usando Node 22 intermitentemente  
**Solução:** Limpar variáveis conflitantes + forçar rebuild sem cache

---

## ⚠️ IMPORTANTE: ESTE ERRO NUNCA É RESOLVIDO SÓ COM CÓDIGO

O Railway/Nixpacks pode cachear decisões de versão de Node **por service**.  
Variáveis de ambiente `NODE_VERSION` ou `NIXPACKS_NODE_VERSION` **sobrescrevem** `.nvmrc` e `package.json`.

---

## ✅ ETAPA 1: CÓDIGO (JÁ CONCLUÍDO)

Os seguintes arquivos já foram corrigidos:

- ✅ `.nvmrc` → `20`
- ✅ `package.json` (raiz) → `"engines": { "node": "20.x" }`
- ✅ `work/package.json` → `"engines": { "node": "20.x" }`
- ✅ `api/package.json` → `"engines": { "node": "20.x" }`
- ✅ `work/api/package.json` → `"engines": { "node": "20.x" }`
- ✅ `railway.json` → `"build": { "nodeVersion": "20" }`

**Ação necessária:** Fazer commit e push:
```bash
git add .
git commit -m "fix: force Node 20 on all Railway services"
git push origin main
```

---

## 🔧 ETAPA 2: LIMPAR VARIÁVEIS NO RAILWAY (MANUAL - OBRIGATÓRIO)

### **Para CADA service que está falhando:**

1. **Acessar o service no Railway**
   - Ex: `work-production-a`, `work-production-b`, etc.

2. **Ir em Settings → Variables**

3. **PROCURAR estas variáveis:**
   - `NODE_VERSION`
   - `NIXPACKS_NODE_VERSION`
   - `RUNTIME_NODE_VERSION`

4. **SE ENCONTRAR alguma dessas:**
   - **OPÇÃO A (RECOMENDADO):** Deletar completamente
   - **OPÇÃO B:** Alterar valor para `20`

5. **Clicar em "Save"**

---

## 🧹 ETAPA 3: FORÇAR REBUILD SEM CACHE (MANUAL - OBRIGATÓRIO)

### **Para CADA service que foi alterado:**

1. **Ir na aba "Deployments"**

2. **Clicar no botão "Deploy"**

3. **IMPORTANTE:** Marcar a opção:
   - ☑️ **"Clear build cache"**
   - OU
   - ☑️ **"Redeploy from scratch"**

4. **Confirmar o deploy**

5. **Aguardar build completo**

6. **Verificar nos logs:**
   ```
   ✅ CORRETO: "Using Node.js 20.x"
   ❌ ERRADO:  "Using Node.js 22.x"
   ```

---

## 📋 CHECKLIST POR SERVICE

Use esta tabela para rastrear progresso:

| Service | Variáveis Limpas? | Cache Limpo? | Node 20 Confirmado? | Status |
|---------|-------------------|--------------|---------------------|--------|
| work-production-a | ☐ | ☐ | ☐ | 🔴 |
| work-production-b | ☐ | ☐ | ☐ | 🔴 |
| work-production-c | ☐ | ☐ | ☐ | 🔴 |
| work-production-d | ☐ | ☐ | ☐ | 🔴 |
| work-production-e | ☐ | ☐ | ☐ | 🔴 |

**Legenda:**
- 🔴 Pendente
- 🟡 Em andamento
- 🟢 Concluído

---

## 🔍 COMO IDENTIFICAR QUAL SERVICE ESTÁ FALHANDO

### **Método 1: Logs de Build**
```bash
# No log de build, procurar:
❌ "Using Node.js 22.x"  ← PROBLEMA
✅ "Using Node.js 20.x"  ← CORRETO
```

### **Método 2: Erro de Módulos Nativos**
```
Error: The module '/app/node_modules/[module]/build/Release/[binary].node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 115.
```

**Tradução:**
- `NODE_MODULE_VERSION 127` = Node 22 ❌
- `NODE_MODULE_VERSION 115` = Node 20 ✅

Se você vê esse erro, o service tentou usar Node 22.

---

## 🎯 ORDEM RECOMENDADA DE EXECUÇÃO

1. **Fazer commit e push do código** (ETAPA 1)
2. **Aguardar deploy automático falhar** (para identificar services problemáticos)
3. **Limpar variáveis** nos services que falharam (ETAPA 2)
4. **Forçar rebuild com cache limpo** (ETAPA 3)
5. **Validar logs** mostrando "Using Node.js 20.x"
6. **Repetir para próximo service** se necessário

---

## 🚫 O QUE NÃO FAZER

❌ **NÃO mexer em services que já estão funcionando**  
- Se um service já está com Node 20 e está online, deixe como está

❌ **NÃO tentar "atualizar" para Node 22**  
- O projeto NÃO é compatível com Node 22

❌ **NÃO deletar railway.json**  
- Este arquivo é crítico para forçar Node 20

❌ **NÃO usar `>=20` ou `^20` em engines**  
- Use EXATAMENTE `20.x` (já está correto)

---

## 🔒 POR QUE ISSO ACONTECE

### **Ordem de Precedência do Railway/Nixpacks:**

1. **Variáveis de ambiente** (`NODE_VERSION`, `NIXPACKS_NODE_VERSION`) ← ⚠️ MAIS ALTA
2. **railway.json** (`build.nodeVersion`)
3. **package.json** (`engines.node`)
4. **.nvmrc**
5. **Inferência automática** (usa última versão disponível)

**Problema:**
- Se algum service tem `NODE_VERSION=22` ou `NIXPACKS_NODE_VERSION=22` definido
- Ele **IGNORA** todos os outros arquivos
- Resulta em build com Node 22

**Solução:**
- Remover essas variáveis
- Deixar railway.json + package.json + .nvmrc forçarem Node 20

---

## 🧪 VALIDAÇÃO FINAL

Após completar todas as etapas, verificar:

### **1. Logs de Build**
```
✅ Usando Node.js 20.x
✅ npm install bem-sucedido
✅ Nenhum erro de módulo nativo
```

### **2. Runtime**
```bash
# SSH no service ou verificar logs:
node --version
# Deve retornar: v20.x.x
```

### **3. Health Checks**
```
✅ /health retorna 200 OK
✅ Service não está crashando
✅ Logs normais (sem erros de compatibilidade)
```

---

## 📊 CAUSAS RAIZ IDENTIFICADAS

| Causa | Onde Estava | Como Foi Corrigido |
|-------|-------------|-------------------|
| Sem `.nvmrc` | Raiz ausente | ✅ Criado com `20` |
| Sem `engines.node` | 5 package.json | ✅ Adicionado `"20.x"` em todos |
| railway.json incompleto | Sem `build.nodeVersion` | ✅ Adicionado `"nodeVersion": "20"` |
| Variáveis conflitantes | Services individuais | ⚠️ Requer limpeza manual |
| Cache de build | Railway | ⚠️ Requer rebuild forçado |

---

## 🆘 SE AINDA FALHAR APÓS TUDO ISSO

### **Última Tentativa:**

1. **Deletar o service completamente**
2. **Recriar do zero** no Railway
3. **NÃO adicionar variáveis NODE_VERSION**
4. **Deixar o Railway detectar automaticamente** (via railway.json + .nvmrc)

### **Contato Railway:**

Se nada funcionar, abrir ticket:
```
Título: "Nixpacks forcing Node 22 despite .nvmrc and railway.json"

Descrição:
- Projeto requer Node 20
- railway.json tem "nodeVersion": "20"
- .nvmrc tem "20"
- package.json engines tem "20.x"
- Service continua tentando Node 22
- Solicitando investigação de cache/configuração
```

---

## ✅ CONFIRMAÇÃO FINAL

Marque quando completar:

- [ ] Código commitado e pushed
- [ ] Variáveis NODE_* removidas de TODOS os services
- [ ] Cache limpo em TODOS os services
- [ ] Logs confirmam "Using Node.js 20.x"
- [ ] Services estão online e funcionais
- [ ] Health checks passando

**Data de conclusão:** ___/___/_____

---

## 📝 NOTAS ADICIONAIS

### **Prevenção Futura:**

⚠️ **NUNCA adicionar variáveis:**
- `NODE_VERSION`
- `NIXPACKS_NODE_VERSION`
- `RUNTIME_NODE_VERSION`

⚠️ **SEMPRE verificar:**
- railway.json tem `"nodeVersion": "20"`
- .nvmrc tem `20`
- package.json tem `"engines": { "node": "20.x" }`

⚠️ **Se atualizar para Node 22 no futuro:**
- Atualizar railway.json
- Atualizar .nvmrc
- Atualizar package.json
- Testar TODOS os services
- Fazer deploy gradual

---

## 🎯 RESUMO EXECUTIVO

**Problema:** Railway tentando usar Node 22 em alguns deploys  
**Causa:** Variáveis de ambiente sobrescrevendo arquivos de config + cache  
**Solução:** Limpar variáveis + forçar rebuild + configurações explícitas  

**Impacto:** ZERO no código funcional  
**Tempo estimado:** 5-10 minutos por service  
**Prioridade:** 🔴 CRÍTICA (bloqueador de deploy)

---

**Última atualização:** 14/12/2025  
**Revisão recomendada:** Após cada incident similar
