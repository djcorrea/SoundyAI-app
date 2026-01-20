# 🛒 TRACKING PÁGINA DE VENDAS - musicaprofissional.com.br

**Objetivo:** Rastrear cliques em botões que levam ao checkout Hotmart.

---

## 📦 ARQUIVOS NECESSÁRIOS

Copiar 3 arquivos do projeto SoundyAI para o servidor da página de vendas:

```bash
SoundyAI/public/js/tracking.js          → musicaprofissional.com.br/js/tracking.js
SoundyAI/public/js/tracking-config.js   → musicaprofissional.com.br/js/tracking-config.js
SoundyAI/public/js/sales-tracking.js    → musicaprofissional.com.br/js/sales-tracking.js
```

---

## 📝 CÓDIGO HTML

Adicionar no `<head>` da página de vendas:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Sua Página de Vendas</title>
    
    <!-- ════════════════════════════════════════════════════════════ -->
    <!-- 📊 GOOGLE ADS TRACKING -->
    <!-- ════════════════════════════════════════════════════════════ -->
    
    <!-- Google Tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-REPLACE_WITH_YOUR_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-REPLACE_WITH_YOUR_ID');
    </script>
    
    <!-- Sistema de Tracking (ordem importante!) -->
    <script src="/js/tracking.js" defer></script>
    <script src="/js/tracking-config.js" defer></script>
    <script src="/js/sales-tracking.js" defer></script>
    
    <!-- ════════════════════════════════════════════════════════════ -->
    
</head>
<body>
    <!-- Seu conteúdo aqui -->
</body>
</html>
```

---

## 🎯 ESTRUTURA DOS BOTÕES

### Opção 1: Link direto (recomendado)

```html
<a href="https://pay.hotmart.com/SEU_LINK_AQUI" class="cta-checkout">
    Comprar Agora - R$ 197,00
</a>
```

### Opção 2: Com atributo data

```html
<button data-checkout-url="https://pay.hotmart.com/SEU_LINK_AQUI" class="buy-now">
    Quero Garantir Minha Vaga
</button>
```

### Opção 3: Classes personalizadas

O script detecta automaticamente qualquer elemento com:
- `href` contendo `hotmart.com` ou `pay.hotmart`
- Classe `.cta-checkout`
- Classe `.buy-now`
- Atributo `data-checkout-url`

```html
<div class="pricing-card">
    <h3>Plano Premium</h3>
    <p class="price">R$ 497,00</p>
    <a href="https://pay.hotmart.com/PREMIUM_LINK" class="cta-checkout">
        Comprar Plano Premium
    </a>
</div>
```

---

## 🧪 COMO TESTAR

### 1. Teste local (antes de subir):

```bash
# Se tiver Python instalado:
cd pasta-da-pagina-de-vendas
python -m http.server 8000

# Abrir no navegador:
http://localhost:8000?debug=true
```

### 2. No console do navegador:

```javascript
// Verificar se scripts carregaram
console.log(window.SoundyTracking);  // Deve retornar objeto
console.log(typeof gtag);            // Deve retornar "function"

// Executar validador
// (copiar conteúdo de tracking-validator.js e colar aqui)
```

### 3. Com Google Tag Assistant:

1. Instalar extensão: https://tagassistant.google.com/
2. Abrir página de vendas
3. Clicar em "Start recording"
4. Clicar em botão de checkout
5. Verificar evento `conversion` com `send_to: AW-XXX/LABEL`

---

## ⚙️ COMPORTAMENTO ESPERADO

1. **Usuário clica em CTA:**
   - Script intercepta o clique
   - Previne navegação imediata
   - Envia evento para Google Ads
   - Aguarda 80ms (para beacon ser enviado)
   - Redireciona para Hotmart

2. **No console (debug=true):**
   ```
   🛒 [SALES-TRACKING] Módulo carregado
   🎯 [SALES-TRACKING] 3 botão(ões) de checkout encontrado(s)
   🎯 [SALES-TRACKING] Clique detectado no botão 1: https://pay.hotmart.com/...
   ✅ [SALES-TRACKING] Evento enviado
   📡 [SALES-TRACKING] Usando sendBeacon para garantia
   ```

3. **No Google Ads (24-48h depois):**
   - Conversões → Checkout Click
   - Coluna "Conversões últimos 30 dias" incrementada

---

## 🔧 PERSONALIZAÇÃO (OPCIONAL)

Se precisar ajustar os seletores de botões, editar `sales-tracking.js`:

```javascript
// Linha ~32
const selectors = [
    'a[href*="hotmart.com"]',
    'a[href*="pay.hotmart"]',
    'button[data-checkout-url]',
    '.checkout-btn',
    '.buy-now',
    '.cta-checkout',
    // Adicionar seus seletores personalizados aqui:
    '.meu-botao-customizado',
    '#botao-comprar'
];
```

---

## 🚨 TROUBLESHOOTING

### ❌ Console: "SoundyTracking não encontrado"

**Causa:** Scripts não carregaram na ordem correta.

**Solução:** Verificar se `tracking.js` está antes de `sales-tracking.js`.

### ❌ Console: "IDs ainda não preenchidos"

**Causa:** `tracking-config.js` com placeholders.

**Solução:** Editar `tracking-config.js` e preencher IDs reais.

### ❌ Clique não rastreia

**Causa 1:** Botão não tem seletor reconhecido.  
**Solução:** Adicionar classe `.cta-checkout` ou ajustar seletores.

**Causa 2:** Script não inicializou.  
**Solução:** Verificar console por erros, confirmar ordem dos scripts.

### ❌ Tracking duplicado (conta 2x)

**NÃO DEVE ACONTECER:** Sistema tem deduplicação.

**Verificar:** Console com `?debug=true` mostra "Evento já rastreado nesta sessão".

---

## 📊 EVENTOS RASTREADOS

| Evento | Gatilho | Conversão Google Ads |
|--------|---------|----------------------|
| `checkout_click` | Click em CTA → Hotmart | Checkout Click |

---

## ✅ CHECKLIST FINAL

- [ ] 3 arquivos copiados para servidor
- [ ] Scripts incluídos no HTML (ordem correta)
- [ ] Botões têm classes/atributos reconhecidos
- [ ] `tracking-config.js` preenchido com IDs reais
- [ ] Testado localmente com `?debug=true`
- [ ] Validado com Google Tag Assistant
- [ ] Deploy realizado
- [ ] Teste real de clique
- [ ] Aguardar 24-48h
- [ ] Confirmar conversão no Google Ads

---

## 📞 SUPORTE

**Documentação completa:** `TRACKING_SETUP.md`

**Validação:** Executar `tracking-validator.js` no console

**Debug:** Adicionar `?debug=true` na URL

---

**Status:** ✅ Pronto para implementação na página de vendas externa
