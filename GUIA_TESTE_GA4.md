# 🧪 GUIA RÁPIDO: Como Testar o Google Analytics 4

## ⚡ Teste em 3 Minutos

### 1️⃣ **Abrir Google Analytics 4**
1. Acesse: https://analytics.google.com/
2. Selecione a propriedade: **SoundyAI** (ID: G-MBDHDYN6Z0)
3. Menu lateral: **Relatórios → Tempo Real**

### 2️⃣ **Abrir o Site em Nova Aba**
```
https://soundyai.com.br/landing.html
```
ou se estiver testando localmente:
```
http://localhost:3000/landing.html
```

### 3️⃣ **Ver Eventos em Tempo Real**
No Google Analytics, você verá instantaneamente:
- **Usuários ativos agora:** 1
- **Visualizações de página:** landing.html
- **Eventos por nome:** lista de eventos disparados

---

## 🎯 TESTE DOS PRINCIPAIS CTAs

### Landing Page (landing.html):
1. ✅ **Clique em "Analisar minha música grátis"** (hero)
   - Evento esperado: `cta_click` → `cta_analisar_musica_hero`

2. ✅ **Clique em "Ver demonstração"**
   - Evento esperado: `cta_click` → `cta_ver_demonstracao`

3. ✅ **Clique em "COMEÇAR ANÁLISE GRATUITA"** (CTA final)
   - Evento esperado: `cta_click` → `cta_comecar_analise`

### Login (login.html):
4. ✅ **Clique em "Continuar com Google"**
   - Evento esperado: `login_attempt` → `google_login`

5. ✅ **Clique em "Esqueci a senha"**
   - Evento esperado: `cta_click` → `esqueci_senha`

### App Principal (index.html):
6. ✅ **Fazer upload de áudio e iniciar análise**
   - Evento esperado: `audio_analysis` → `analise_iniciada`

7. ✅ **Enviar mensagem no chat**
   - Evento esperado: `chat_interaction` → `mensagem_enviada`

### Planos (planos.html):
8. ✅ **Visualizar página**
   - Evento esperado: `view_item_list` → `planos_page_view`

9. ✅ **Clicar em "Assinar" (qualquer plano)**
   - Evento esperado: `cta_click` → `assinar_plus/pro/studio`

### Checkout (vendas.html):
10. ✅ **Clicar no botão de checkout**
    - Evento esperado: `cta_click` → `cta_checkout_hotmart`

---

## 🔍 VALIDAÇÃO NO CONSOLE DO NAVEGADOR

### 1. Abra o DevTools (F12)
### 2. Vá na aba **Console**
### 3. Procure por mensagens:
```
🎯 [GA4] Evento enviado: cta_click {event_category: "engagement", event_label: "cta_analisar_musica_hero", ...}
```

Se você vir essas mensagens → **GA4 está funcionando! ✅**

---

## 🌐 TESTE DE NETWORK (Avançado)

### 1. DevTools → Aba **Network**
### 2. Filtrar por: `google-analytics.com`
### 3. Clicar em qualquer CTA
### 4. Ver requisição para:
```
https://www.google-analytics.com/g/collect?v=2&tid=G-MBDHDYN6Z0&...
```

Se aparecer a requisição → **Evento enviado com sucesso! ✅**

---

## 📊 VERIFICAR TODOS OS EVENTOS (24h-48h)

Após 24-48 horas, os eventos estarão disponíveis nos relatórios completos:

1. **Google Analytics 4 → Relatórios → Engajamento → Eventos**
2. Você verá a lista de todos os eventos:
   - `cta_click`
   - `audio_analysis`
   - `chat_interaction`
   - `login_attempt`
   - `purchase`
   - etc.

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Tag GA4 carrega sem erros no console
- [ ] Eventos aparecem no Tempo Real do GA4
- [ ] Console mostra `🎯 [GA4] Evento enviado`
- [ ] Network mostra requisições para `google-analytics.com`
- [ ] Todos os CTAs principais disparam eventos
- [ ] Não há erros JavaScript relacionados ao GA4

---

## 🚨 TROUBLESHOOTING

### ❌ "Eventos não aparecem no Tempo Real"
**Possíveis causas:**
1. Ad blocker ativo (desabilite para teste)
2. Bloqueio de cookies
3. VPN/proxy interferindo
4. Tag GA4 não carregada (verificar console)

**Solução:** Teste em navegador anônimo/privado sem extensões.

### ❌ "Console não mostra mensagens [GA4]"
**Causa:** Tag GA4 bloqueada ou não carregada

**Solução:** 
1. Verificar se `gtag` existe: Digite no console → `typeof gtag`
2. Deve retornar: `"function"`
3. Se retornar `"undefined"`, tag não carregou

### ❌ "Erro: gtag is not defined"
**Causa:** Script GA4 bloqueado por ad blocker

**Solução:** Desabilitar ad blocker e recarregar página

---

## 📞 SUPORTE RÁPIDO

### Comandos úteis no Console:
```javascript
// Verificar se GA4 está carregado
typeof gtag

// Enviar evento manual de teste
gtag('event', 'test_event', {test: true})

// Ver DataLayer
dataLayer
```

---

## 🎉 SUCESSO!

Se você consegue ver eventos no **Tempo Real** do Google Analytics 4, a implementação está **100% funcional**! 🚀

**Próximo passo:** Monitorar por 7 dias e criar conversões personalizadas no GA4.
