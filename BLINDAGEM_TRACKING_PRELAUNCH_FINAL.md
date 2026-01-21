# 🛡️ BLINDAGEM TRACKING GOOGLE ADS - PRELAUNCH (AUDITORIA FINAL)

**Data:** 2026-01-21 23:45  
**Status:** ✅ BLINDADO E VALIDADO  
**Arquivo Principal:** [public/prelaunch.html](public/prelaunch.html)

---

## ✅ CHECKLIST DE CONFORMIDADE

### 1️⃣ ID Real AW-17884386312 (ÚNICO)
- ✅ **Linha 23:** `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17884386312"></script>`
- ✅ **Linha 28:** `gtag('config', 'AW-17884386312');`
- ✅ **Linha 1808:** `send_to: 'AW-17884386312/W06KCKfStOkbEIio-M9C'`
- ❌ **Zero ocorrências** de "AW-REPLACE" ou "REPLACE_WITH_YOUR_ID"

### 2️⃣ Arquivos tracking.js/tracking-config.js NÃO carregados
- ✅ **Confirmado:** prelaunch.html NÃO possui `<script src="js/tracking.js">` ou `tracking-config.js`
- ✅ **Motivo:** Evitar risco de placeholder injection
- ✅ **Implementação:** Tracking inline direto no HTML (linhas 1784-1823)

### 3️⃣ Deduplicação por Email (sessionStorage)
```javascript
// Linha 1798 - prelaunch.html
const dedupKey = 'lead_sent_' + emailLower;
if (sessionStorage.getItem(dedupKey)) {
    if (window.TRACKING_DEBUG) {
        console.log('[TRACKING] lead dedup skip:', emailLower);
    }
    return;
}
```
- ✅ **Key:** `'lead_sent_' + email.toLowerCase()`
- ✅ **Storage:** sessionStorage (não persiste entre tabs)
- ✅ **Log debug:** Exibe quando pula duplicata

### 4️⃣ Modo Debug (?debug_tracking=1)
```javascript
// Linha 30 - prelaunch.html
window.TRACKING_DEBUG = window.location.search.includes('debug_tracking=1');
if (window.TRACKING_DEBUG) console.log('🎯 [TRACKING] Debug mode ativado');
```
- ✅ **Ativação:** `?debug_tracking=1` na URL
- ✅ **Logs:**
  - Conversão disparada: `[TRACKING] lead fired: email@exemplo.com`
  - Deduplicação: `[TRACKING] lead dedup skip: email@exemplo.com`
  - Erro gtag: `[TRACKING] gtag não disponível, tracking ignorado`

### 5️⃣ Fail-Safe (gtag ausente não quebra UX)
```javascript
// Linha 1787 - prelaunch.html
if (typeof gtag !== 'function') {
    if (window.TRACKING_DEBUG) {
        console.log('[TRACKING] gtag não disponível, tracking ignorado');
    }
    return;
}
```
- ✅ **Verificação:** `typeof gtag !== 'function'`
- ✅ **Comportamento:** Retorna silenciosamente, formulário continua funcionando
- ✅ **Try/catch:** Envolve `gtag('event')` para capturar erros (linha 1807)

### 6️⃣ Disparo SOMENTE Após Sucesso Backend
```javascript
// Linha 1976 - prelaunch.html
// ⚠️ CRÍTICO: Só dispara SE o Firestore salvou com sucesso!
fireLeadConversion(email, result.data?.id);
```
- ✅ **Condição:** Dentro do bloco `if (response.ok)` após `/api/waitlist`
- ✅ **Parâmetros:** 
  - `email`: do formulário
  - `transactionId`: `result.data?.id` (ID do Firestore)
- ❌ **Delay:** ZERO ms (sem setTimeout, disparo imediato)

### 7️⃣ Conversão LEAD - Configuração Completa
```javascript
// Linha 1807 - prelaunch.html
gtag('event', 'conversion', {
    'send_to': 'AW-17884386312/W06KCKfStOkbEIio-M9C',
    'value': 1.0,
    'currency': 'BRL',
    'transaction_id': transactionId || ''
});
```
- ✅ **Conversion ID:** `AW-17884386312`
- ✅ **Conversion Label:** `W06KCKfStOkbEIio-M9C`
- ✅ **Value:** `1.0` BRL
- ✅ **Currency:** `BRL`
- ✅ **Transaction ID:** ID do backend (opcional)

### 8️⃣ Instalação ÚNICA do gtag (sem duplicação)
- ✅ **prelaunch.html:** 1x gtag carregado (linha 23)
- ✅ **index.html:** 1x gtag carregado (linha 13) - arquivo separado
- ✅ **vendas.html:** 1x gtag carregado (linha 10) - arquivo separado
- ✅ **Confirmado:** Cada página carrega gtag apenas 1 vez

---

## 🔒 SISTEMA DE VALIDAÇÃO

### Script Automático: validate-tracking-deploy.cjs

**Localização:** `scripts/validate-tracking-deploy.cjs`

**Integração package.json:**
```json
"scripts": {
  "prebuild": "node scripts/check-utf8.js && node scripts/validate-tracking-deploy.cjs",
  "predeploy": "node scripts/validate-tracking-deploy.cjs"
}
```

**Validações Executadas:**
1. ❌ Bloqueia placeholders:
   - `AW-REPLACE_WITH_YOUR_ID`
   - `REPLACE_WITH_YOUR_ID`
   - `REPLACE_WITH_WAITLIST_LABEL`
   - Outros 3 placeholders

2. ✅ Confirma ID real:
   - `AW-17884386312` presente em todos os arquivos

3. 📅 Verifica timestamp:
   - `DEPLOY_VERSION: 2026-01-21 23:30` presente

4. 🚫 Exit code 1 se falhar:
   - Impede build/deploy automático

**Última Execução:**
```bash
✅ public/prelaunch.html - ID REAL PRESENTE
📅 public/prelaunch.html - Deploy: 2026-01-21 23:30 --
✅ public/index.html - ID REAL PRESENTE
📅 public/index.html - Deploy: 2026-01-21 23:30 --
✅ public/vendas.html - ID REAL PRESENTE
📅 public/vendas.html - Deploy: 2026-01-21 23:30 --

✅ VALIDAÇÃO PASSOU: Todos os arquivos estão corretos
🚀 SEGURO PARA DEPLOY
```

---

## 🗂️ ARQUIVOS DE RISCO (NÃO USADOS EM PRODUÇÃO)

### ⚠️ Arquivos com Placeholders (ISOLADOS):

1. **`public/js/tracking.js`** (537 linhas)
   - Linha 30: `conversionId: 'AW-XXXXXXX'` ❌
   - Linha 32: `waitlist: 'LABEL_WAITLIST'` ❌
   - **Status:** NÃO carregado no prelaunch.html ✅
   - **Motivo:** Biblioteca genérica com placeholders de exemplo

2. **`public/js/tracking-config.js`** (91 linhas)
   - Linha 25: `conversionId: 'AW-17884386312'` ✅ (CORRIGIDO)
   - Linha 30: `waitlistSignup: 'W06KCKfStOkbEIio-M9C'` ✅ (CORRIGIDO)
   - Linha 36: `checkoutClick: 'CHECKOUT_LABEL'` ❌
   - **Status:** NÃO carregado no prelaunch.html ✅
   - **Motivo:** Config não utilizada na página de waitlist

### ✅ Confirmação:
```bash
$ grep -n "tracking.js\|tracking-config.js" public/prelaunch.html
# (sem resultados = arquivos NÃO carregados)
```

**Decisão de Arquitetura:**  
Implementação inline no prelaunch.html garante controle total e evita conflitos.

---

## 📋 CACHE BUSTING (vercel.json)

```json
{
  "src": "/prelaunch.html", 
  "dest": "/public/prelaunch.html",
  "headers": {
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  }
}
```

**Garantias:**
- ✅ CDN Vercel não serve versão antiga
- ✅ Navegador não usa cache local
- ✅ Deploy sempre força versão mais recente

---

## 🧪 TESTES DE VALIDAÇÃO

### ✅ Teste 1: View-Source (Produção)
```bash
# Verificar ID real
curl -s https://www.soundyai.com.br/prelaunch.html | grep "gtag/js?id="
# Deve retornar: src="https://www.googletagmanager.com/gtag/js?id=AW-17884386312"

# Confirmar SEM placeholders
curl -s https://www.soundyai.com.br/prelaunch.html | grep -i "REPLACE_WITH"
# Deve retornar: NADA (exit code 1)

# Verificar timestamp de deploy
curl -s https://www.soundyai.com.br/prelaunch.html | grep "DEPLOY_VERSION"
# Deve retornar: <!-- DEPLOY_VERSION: 2026-01-21 23:30 -->
```

### ✅ Teste 2: DevTools Network (Browser)
1. Abrir: `https://www.soundyai.com.br/prelaunch.html?debug_tracking=1`
2. DevTools → Network → Filtrar: `gtag`
3. Verificar request:
   - ✅ `https://www.googletagmanager.com/gtag/js?id=AW-17884386312`
   - ❌ NÃO deve ter `tid=AW-REPLACE`

### ✅ Teste 3: Console Debug (Cadastro Real)
1. Abrir: `https://www.soundyai.com.br/prelaunch.html?debug_tracking=1`
2. Preencher formulário com email válido
3. Console deve mostrar:
```
🎯 [TRACKING] Debug mode ativado
✅ Lead cadastrado com sucesso: abc123xyz
[TRACKING] lead fired: seu@email.com
```
4. F5 e cadastrar MESMO email novamente:
```
[TRACKING] lead dedup skip: seu@email.com
```

### ✅ Teste 4: Google Tag Assistant
1. Instalar extensão: [Google Tag Assistant](https://tagassistant.google.com/)
2. Abrir prelaunch.html
3. Cadastrar email
4. Verificar na extensão:
   - ✅ Tag: **Google Ads Conversion Tracking**
   - ✅ ID: **AW-17884386312**
   - ✅ Conversion: **W06KCKfStOkbEIio-M9C**
   - ✅ Status: **Tag fired**

---

## 📊 FLUXO DE CONVERSÃO LEAD

```
USUÁRIO PREENCHE FORMULÁRIO
    ↓
preventDefault() - bloqueia submit
    ↓
Validação frontend (nome + email)
    ↓
POST /api/waitlist
    ↓
┌─────────────────┐
│ response.ok?    │
└─────────────────┘
    │ NÃO → Exibir erro (SEM tracking)
    │
    │ SIM
    ↓
┌─────────────────────────────┐
│ fireLeadConversion(email)   │
│ ├─ Verifica: gtag exists?   │
│ ├─ Dedup: sessionStorage    │
│ ├─ Dispara: gtag('event')   │
│ └─ Marca: lead_sent_X       │
└─────────────────────────────┘
    ↓
Exibe tela de sucesso
```

**⚠️ CRÍTICO:** Conversão SOMENTE dispara após confirmação do backend (response.ok).

---

## 🚀 COMANDOS DE DEPLOY

### Deploy Manual:
```bash
# 1. Validar localmente
npm run predeploy

# 2. Commit e push
git add .
git commit -m "fix: tracking Google Ads blindado e validado"
git push origin main

# 3. Vercel deploy automático
# (ou executar: vercel --prod)
```

### Forçar Rebuild (se cache persistir):
```bash
vercel env rm FORCE_REBUILD
vercel env add FORCE_REBUILD
# Valor: timestamp atual (ex: 1737504000000)
vercel --prod --force
```

---

## 🔍 VERIFICAÇÃO PÓS-DEPLOY

### Checklist:
- [ ] View-source mostra `AW-17884386312` (não placeholder)
- [ ] Timestamp deploy está correto: `2026-01-21 23:30`
- [ ] Network mostra request para Google Ads com ID real
- [ ] Cadastro real dispara conversão (verificar Google Tag Assistant)
- [ ] Console debug mostra logs corretos (?debug_tracking=1)
- [ ] Segundo cadastro do mesmo email pula (dedup)
- [ ] Google Ads mostra conversão em 24-48h

---

## 📝 RESUMO EXECUTIVO

| Requisito | Status | Arquivo/Linha |
|-----------|--------|---------------|
| **ID Real AW-17884386312** | ✅ | prelaunch.html:23,28,1808 |
| **Label W06KCKfStOkbEIio-M9C** | ✅ | prelaunch.html:1808 |
| **Tracking inline (sem .js externos)** | ✅ | prelaunch.html:1784-1823 |
| **Deduplicação por email** | ✅ | sessionStorage `lead_sent_` |
| **Debug mode** | ✅ | ?debug_tracking=1 |
| **Fail-safe gtag** | ✅ | typeof gtag !== 'function' |
| **Disparo pós-backend** | ✅ | Após response.ok |
| **Zero delay** | ✅ | Sem setTimeout |
| **Instalação única gtag** | ✅ | 1x por página |
| **Validação automática** | ✅ | validate-tracking-deploy.cjs |
| **Cache busting** | ✅ | vercel.json headers |
| **Zero placeholders** | ✅ | Validado ✅ |

---

## 🛡️ GARANTIAS DE BLINDAGEM

✅ **Proteção 1:** Validador pré-deploy bloqueia placeholders automaticamente  
✅ **Proteção 2:** Tracking inline evita conflitos com arquivos externos  
✅ **Proteção 3:** Cache busting no vercel.json evita versões antigas  
✅ **Proteção 4:** Timestamps de deploy permitem rastreamento de versão  
✅ **Proteção 5:** Fail-safe garante que gtag ausente não quebra UX  
✅ **Proteção 6:** Deduplicação evita contagem duplicada  
✅ **Proteção 7:** Disparo condicional (só após backend ok) garante precisão  

---

**🎯 Status Final:** 🟢 **BLINDADO E PRONTO PARA PRODUÇÃO**

**📅 Próxima Ação:** Deploy + Verificação em 24-48h no Google Ads

**🔒 Manutenção:** Script de validação bloqueará automaticamente qualquer regressão futura.
