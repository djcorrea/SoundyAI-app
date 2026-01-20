# 🎯 SOUNDYAI - SETUP DE TRACKING (GUIA RÁPIDO)

**Versão:** 1.0 | **Status:** Pronto para deploy após preenchimento de IDs

---

## 📋 CHECKLIST PRÉ-DEPLOY

- [ ] Preencher IDs no `tracking-config.js`
- [ ] Testar conversão de lista de espera (LEAD)
- [ ] Testar tracking na página de vendas (opcional)
- [ ] Validar com Google Tag Assistant
- [ ] Confirmar eventos no Google Ads (24-48h)

---

## 🔑 ONDE PREENCHER OS IDS

### Arquivo único: `/public/js/tracking-config.js`

```javascript
const TRACKING_CONFIG = {
    conversionId: 'AW-REPLACE_WITH_YOUR_ID',  // ⚠️ Substituir
    labels: {
        waitlistSignup: 'REPLACE_WITH_WAITLIST_LABEL',    // ⚠️ Substituir
        checkoutClick: 'REPLACE_WITH_CHECKOUT_LABEL',     // ⚠️ Substituir
        purchase: 'REPLACE_WITH_PURCHASE_LABEL'           // ⚠️ Substituir
    }
};
```

### Como obter os IDs:

1. **Acessar Google Ads:** https://ads.google.com/
2. **Menu:** Ferramentas e Configurações → Medição → **Conversões**
3. **Criar 3 conversões:**

| Conversão | Categoria | Valor | Contagem | Janela |
|-----------|-----------|-------|----------|--------|
| **Lista de Espera** | Lead | 0 | Uma | 30 dias |
| **Checkout Click** | Outro | 0 | Todas | 7 dias |
| **Compra** | Compra | Dinâmico | Uma | 30 dias |

4. **Copiar IDs:**
   - **Conversion ID** (AW-XXXXXXXXXX): igual para todas, aparece no topo
   - **Conversion Label**: específico para cada conversão
   - Formato final: `AW-XXXXXXXXXX/LABEL-YYYYY`

5. **Colar em `tracking-config.js`:**
   - `conversionId`: apenas a parte `AW-XXXXXXXXXX`
   - `labels.waitlistSignup`: apenas o label da conversão "Lista de Espera"
   - `labels.checkoutClick`: apenas o label da conversão "Checkout Click"
   - `labels.purchase`: apenas o label da conversão "Compra"

---

## 🧪 COMO TESTAR

### Método 1: Google Tag Assistant (Recomendado)

1. **Instalar extensão:** [Google Tag Assistant](https://tagassistant.google.com/)
2. **Abrir página de teste:** http://localhost:3000/prelaunch.html?debug=true
3. **Iniciar gravação** no Tag Assistant
4. **Realizar ação:**
   - Lista de espera: preencher email e clicar "Entrar na Lista"
   - Aguardar mensagem de sucesso
5. **Parar gravação** e verificar:
   - ✅ Tag `Google Ads Conversion Tracking` disparada
   - ✅ Evento `conversion` com `send_to: AW-XXX/LABEL`
   - ✅ Status: sem erros

### Método 2: Console do navegador

```javascript
// Abrir página com ?debug=true
// Preencher formulário de lista de espera
// Observar no console:

✅ [TRACKING] Evento enviado: waitlist_signup
✅ [TRACKING] Deduplicação ativa (event_id: evt_xxx)
```

### Método 3: Google Ads (produção)

- **Tempo de processamento:** 24-48 horas
- **Verificar:** Google Ads → Ferramentas → Conversões
- **Coluna:** "Conversões (últimos 30 dias)"

---

## ⚙️ ARQUITETURA DO SISTEMA

```
Página HTML
    ↓
gtag.js (Google Tag)
    ↓
tracking.js (módulo core)
    ↓
tracking-config.js (IDs)
    ↓
Evento do usuário (submit form / click CTA)
    ↓
Backend confirma sucesso ✅
    ↓
tracking.trackWaitlistSignup() OU trackCTASalesToCheckout()
    ↓
gtag('event', 'conversion', { send_to: 'AW-XXX/LABEL' })
    ↓
Google Ads API
```

---

## 📊 EVENTOS RASTREADOS

| Evento | Página | Trigger | Conversão |
|--------|--------|---------|-----------|
| **LEAD** | `/prelaunch.html` | Form submit + backend success | Lista de Espera |
| **Checkout Click** | Página de vendas externa | Click em CTA Hotmart | Checkout Click |
| **Compra** | (futuro) | Webhook Hotmart | Compra |

---

## 🚨 LIMITAÇÕES E CONSIDERAÇÕES

### ✅ O que funciona agora:

- ✅ Rastreamento de cadastro na lista de espera (LEAD)
- ✅ Deduplicação automática (mesmo email não conta 2x)
- ✅ Rastreamento de cliques para checkout (página de vendas)
- ✅ Funciona offline (eventos são enviados via beacon)

### ⚠️ Limitações conhecidas:

- ⚠️ **Compras no Hotmart não são rastreadas automaticamente**
  - Motivo: checkout acontece em domínio externo (hotmart.com)
  - Solução: implementar postback do Hotmart (webhook)
  - Alternativa: conversões offline via API do Google Ads

- ⚠️ **Página de vendas externa (musicaprofissional.com.br)**
  - Se a página estiver em domínio diferente, incluir:
    1. `tracking.js`
    2. `tracking-config.js`
    3. `sales-tracking.js`
  - Ver seção "Página de Vendas" abaixo

- ⚠️ **Adblockers podem bloquear gtag.js**
  - Tracking falha silenciosamente
  - Sem impacto na UX (sistema continua funcionando)
  - Perda estimada: 10-20% dos eventos

---

## 🛒 PÁGINA DE VENDAS (musicaprofissional.com.br)

Se a página de vendas estiver em domínio diferente:

### 1. Copiar arquivos:

```bash
/public/js/tracking.js          → pasta da página de vendas
/public/js/tracking-config.js   → pasta da página de vendas
/public/js/sales-tracking.js    → pasta da página de vendas
```

### 2. Incluir na página HTML (ordem importante):

```html
<!-- Google Tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-REPLACE_WITH_YOUR_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'AW-REPLACE_WITH_YOUR_ID');
</script>

<!-- Sistema de Tracking -->
<script src="/js/tracking.js" defer></script>
<script src="/js/tracking-config.js" defer></script>
<script src="/js/sales-tracking.js" defer></script>
```

### 3. Botões de checkout devem ter:

```html
<!-- Opção 1: Link direto -->
<a href="https://pay.hotmart.com/XXXX" class="cta-checkout">
    Comprar Agora
</a>

<!-- Opção 2: Atributo data -->
<button data-checkout-url="https://pay.hotmart.com/XXXX" class="buy-now">
    Comprar Agora
</button>
```

O script `sales-tracking.js` detecta automaticamente cliques e rastreia antes de redirecionar.

---

## 🔍 TROUBLESHOOTING

### ❌ "SoundyTracking não encontrado"

- **Causa:** tracking.js não carregou
- **Solução:** verificar caminho do script e ordem de carregamento

### ❌ "IDs ainda não foram preenchidos"

- **Causa:** placeholders não foram substituídos em `tracking-config.js`
- **Solução:** preencher `conversionId` e `labels` com IDs reais

### ❌ Conversão não aparece no Google Ads

- **Causa 1:** Aguardar 24-48h para processamento
- **Causa 2:** IDs incorretos
- **Causa 3:** Adblocker bloqueou gtag.js
- **Solução:** testar com Tag Assistant primeiro

### ❌ Evento duplicado (mesmo email conta 2x)

- **NÃO DEVE ACONTECER:** sistema tem 3 camadas de deduplicação
- **Verificar:** console do navegador (debug=true)
- **Se persistir:** abrir issue com logs

---

## 📦 ESTRUTURA DE ARQUIVOS

```
/public
├── prelaunch.html              [✅ Tracking integrado]
├── index.html                  [✅ Tracking integrado]
└── /js
    ├── tracking.js             [✅ Módulo core (600+ linhas)]
    ├── tracking-config.js      [⚠️ PREENCHER IDs AQUI]
    └── sales-tracking.js       [✅ Para página de vendas externa]
```

---

## ✅ CHECKLIST FINAL (PRONTO PRA DEPLOY)

### Configuração:

- [ ] `tracking-config.js` preenchido com IDs reais
- [ ] IDs testados no Tag Assistant
- [ ] Conversões criadas no Google Ads

### Testes locais:

- [ ] Lista de espera dispara evento LEAD (console log ✅)
- [ ] Tag Assistant confirma evento `conversion`
- [ ] Refresh da página não duplica evento
- [ ] Debug logs aparecem com `?debug=true`

### Testes em produção:

- [ ] Deploy realizado
- [ ] Teste real de cadastro na lista de espera
- [ ] Aguardar 24-48h
- [ ] Confirmar conversão no Google Ads

### Página de vendas (se aplicável):

- [ ] Arquivos copiados para página de vendas
- [ ] Scripts incluídos na ordem correta
- [ ] Teste de clique em CTA de checkout
- [ ] Tag Assistant confirma evento

---

## 📞 SUPORTE

**Documentação completa:** `TRACKING.md` (900+ linhas)

**IDs e configuração:** `TRACKING_IDS_REQUIRED.md`

**Validação técnica:** `TRACKING_VALIDATION_CHECKLIST.md`

**Logs de debug:** Adicionar `?debug=true` na URL

---

## 📝 CHANGELOG

- **2026-01-20:** Setup inicial, configuração centralizada em tracking-config.js
- **2026-01-27:** Sistema de deduplicação aprimorado (3 camadas)
- **2026-01-XX:** (aguardando) Webhook Hotmart para rastreamento de compras

---

**🎯 Status:** Sistema pronto. Apenas preencher IDs em `tracking-config.js` e testar.
