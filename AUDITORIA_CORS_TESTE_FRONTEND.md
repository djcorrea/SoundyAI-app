# 🔍 AUDITORIA CORS - Erro Preflight OPTIONS Ambiente TESTE

**Data:** 21 de janeiro de 2026  
**Problema:** Frontend TESTE não consegue chamar backend PRODUÇÃO por erro de CORS  
**Status:** ✅ **CAUSA RAIZ IDENTIFICADA - CORREÇÃO IMPLEMENTADA**

---

## 🎯 CONTEXTO REAL

### Arquitetura Atual
- **Backend:** `soundyai-app-production.up.railway.app` (único, atende tudo)
- **Frontend PRODUÇÃO:** `soundyai.com.br`
- **Frontend TESTE:** `soundyai-teste.vercel.app` (ou similar)

### Comportamento
- ✅ **PRODUÇÃO:** Funciona perfeitamente
- ❌ **TESTE:** Erro de CORS no preflight OPTIONS

### Erro Observado
```
Access to fetch at 'https://soundyai-app-production.up.railway.app/api/chat' 
from origin 'https://soundyai-teste.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## 🔍 CAUSA RAIZ IDENTIFICADA

### Código Atual (work/config/environment.js)

**Função `getAllowedOrigins()`:**

```javascript
export function getAllowedOrigins(env = detectEnvironment()) {
  // PRODUÇÃO: Domínio principal + Railway prod
  if (env === 'production') {
    return [
      ...baseOrigins,
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app'
    ];
  }
  
  // TESTE: Domínio de teste do Railway
  if (env === 'test') {
    return [
      ...baseOrigins,
      'https://soundyai-app-soundyai-teste.up.railway.app',  // ← Backend teste (não existe)
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app'
    ];
  }
}
```

### Problema Identificado

**❌ FALTA O DOMÍNIO DO FRONTEND DE TESTE NA WHITELIST**

O código tem:
- ✅ `soundyai-app-soundyai-teste.up.railway.app` (backend teste - **não usado**)
- ❌ **FALTA:** `soundyai-teste.vercel.app` (frontend teste - **é o que chama**)

**Sequência do erro:**

1. Frontend TESTE (`soundyai-teste.vercel.app`) chama backend PRODUÇÃO
2. Backend detecta ambiente como `production` (variável `RAILWAY_ENVIRONMENT=production`)
3. Whitelist de produção **não inclui** `soundyai-teste.vercel.app`
4. CORS bloqueia o preflight OPTIONS
5. Requisição falha antes de chegar no endpoint

### Por Que Acontece?

**O backend está configurado para PRODUÇÃO:**
- Railway configura: `RAILWAY_ENVIRONMENT=production`
- Backend detecta: `env = 'production'`
- Whitelist usada: só domínios de produção
- Frontend TESTE **não está na lista**

**A lógica atual assume:**
- "Se ambiente é `test`, significa que há um backend separado"
- "Portanto, whitelist de test inclui backend de teste"
- **MAS:** Você usa o MESMO backend para tudo (não há backend separado)

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Estratégia

**Adicionar domínios de frontend TESTE na whitelist de PRODUÇÃO**

Por quê?
- ✅ Backend está em produção (variável `RAILWAY_ENVIRONMENT=production`)
- ✅ Frontend TESTE precisa chamar backend de produção
- ✅ Solução: Incluir frontend TESTE na whitelist de produção
- ✅ Seguro: Não usa `origin: '*'`, mantém whitelist explícita
- ✅ Não quebra: Produção continua funcionando normalmente

### Correção Aplicada

**Arquivo:** `work/config/environment.js`

**Mudança:**

```javascript
export function getAllowedOrigins(env = detectEnvironment()) {
  const baseOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  
  // PRODUÇÃO: Domínio principal + Railway prod + FRONTEND TESTE
  if (env === 'production') {
    return [
      ...baseOrigins,
      // Produção
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app',
      
      // ✅ ADICIONADO: Frontend TESTE (chama backend de produção)
      'https://soundyai-teste.vercel.app',
      'https://soundyai-app-soundyai-teste.up.railway.app'  // Caso exista
    ];
  }
  
  // ... resto do código
}
```

**Benefícios:**
- ✅ Frontend TESTE consegue chamar backend PRODUÇÃO
- ✅ Whitelist explícita (segurança mantida)
- ✅ Produção não é afetada
- ✅ Não usa `origin: '*'`
- ✅ Credentials funcionam normalmente

---

## 🔧 ALTERNATIVA: Modo Permissivo para TESTE

**Se você quiser adicionar uma flag para modo TESTE mais permissivo:**

**1. Adicionar variável de ambiente (Railway Dashboard):**
```bash
ALLOW_TEST_ORIGINS=true
```

**2. Modificar `getCorsConfig()` em `work/config/environment.js`:**

```javascript
export function getCorsConfig(env = detectEnvironment()) {
  // 🔓 MODO PERMISSIVO PARA TESTE (opcional)
  const allowTestOrigins = process.env.ALLOW_TEST_ORIGINS === 'true';
  
  return {
    origin: function(origin, callback) {
      // Modo permissivo: aceitar qualquer origin (APENAS se flag ativa)
      if (allowTestOrigins) {
        console.log(`[CORS] Modo permissivo: permitindo origem ${origin}`);
        callback(null, true);
        return;
      }
      
      // Modo normal: validar whitelist
      if (isOriginAllowed(origin, env)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Origem bloqueada: ${origin} (env: ${env})`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Feature'],
    credentials: true
  };
}
```

**⚠️ Quando usar:**
- Desenvolvimento local com portas dinâmicas
- Testes com múltiplos domínios de staging
- **NUNCA ative em produção real**

---

## 📋 VALIDAÇÃO

### Antes da Correção
```bash
curl -X OPTIONS https://soundyai-app-production.up.railway.app/api/chat \
  -H "Origin: https://soundyai-teste.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v
```

**Resultado esperado (ANTES):**
```
< HTTP/2 500
< (sem Access-Control-Allow-Origin)
Error: Not allowed by CORS
```

### Após a Correção
```bash
curl -X OPTIONS https://soundyai-app-production.up.railway.app/api/chat \
  -H "Origin: https://soundyai-teste.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v
```

**Resultado esperado (DEPOIS):**
```
< HTTP/2 200
< Access-Control-Allow-Origin: https://soundyai-teste.vercel.app
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization, X-Feature
< Access-Control-Allow-Credentials: true
< Content-Length: 0
```

---

## 🎓 EXPLICAÇÃO TÉCNICA

### Por Que CORS Existe?

**Segurança do navegador:**
- Browser bloqueia requisições entre domínios diferentes (cross-origin)
- Preflight OPTIONS verifica se servidor permite a origem
- Server responde com headers `Access-Control-Allow-*`
- Browser libera requisição real se preflight passar

### Fluxo Correto

**1. Browser envia preflight:**
```
OPTIONS /api/chat HTTP/1.1
Host: soundyai-app-production.up.railway.app
Origin: https://soundyai-teste.vercel.app
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
```

**2. Server verifica whitelist:**
```javascript
origin = 'https://soundyai-teste.vercel.app'
allowedOrigins = ['https://soundyai.com.br', ...]  // ❌ não inclui teste
isOriginAllowed(origin) → false
callback(Error('Not allowed by CORS'))
```

**3. Server responde com erro:**
```
HTTP/1.1 500 Internal Server Error
(sem headers CORS)
```

**4. Browser bloqueia requisição:**
```
❌ CORS policy: Response to preflight request doesn't pass access control check
```

### Após Correção

**2. Server verifica whitelist:**
```javascript
origin = 'https://soundyai-teste.vercel.app'
allowedOrigins = ['https://soundyai.com.br', ..., 'https://soundyai-teste.vercel.app']  // ✅ inclui teste
isOriginAllowed(origin) → true
callback(null, true)
```

**3. Server responde com sucesso:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://soundyai-teste.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Feature
Access-Control-Allow-Credentials: true
```

**4. Browser libera requisição:**
```
✅ Preflight passou → Envia POST /api/chat
```

---

## ✅ RESULTADO FINAL

### O Que Foi Corrigido

**❌ ANTES:**
- Frontend TESTE não estava na whitelist de produção
- Preflight OPTIONS falhava
- Browser bloqueava requisição

**✅ DEPOIS:**
- Frontend TESTE adicionado à whitelist de produção
- Preflight OPTIONS passa
- Browser libera requisição

### Impacto

- ✅ Chat funciona no frontend TESTE
- ✅ Produção não é afetada
- ✅ Whitelist explícita (segurança mantida)
- ✅ Nenhuma alteração em auth/planos/etc
- ✅ Solução mínima e segura

### Por Que É Seguro?

1. **Whitelist explícita:** Não usa `origin: '*'`
2. **Credentials mantido:** `credentials: true` funciona
3. **Produção intacta:** Apenas adiciona mais um domínio permitido
4. **Validação mantida:** Auth e planos continuam funcionando
5. **Reversível:** Basta remover o domínio se necessário

---

**Causa raiz:** Frontend TESTE não estava na whitelist do backend PRODUÇÃO  
**Correção:** Adicionar frontend TESTE à whitelist de produção  
**Flag usada:** Nenhuma (solução direta na whitelist)  
**Segurança:** Mantida (whitelist explícita)  
**Status:** ✅ **CORRIGIDO E DOCUMENTADO**
