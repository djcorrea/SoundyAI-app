# ✅ CHECKLIST PÓS-DEPLOY - VALIDAÇÃO DE TRACKING

**Objetivo:** Garantir que o sistema de conversões está funcionando corretamente em produção

---

## 📋 CHECKLIST TÉCNICO

### Fase 1: Pré-Deploy (Localhost)

- [ ] **1.1** Google Tag (`gtag.js`) incluído no `<head>` de todas as páginas
- [ ] **1.2** Script `tracking.js` incluído com `defer`
- [ ] **1.3** Placeholder `GOOGLE_ADS_ID` substituído por ID real em:
  - [ ] `/public/prelaunch.html`
  - [ ] `/public/index.html`
  - [ ] `/public/landing.html` (se existir)
- [ ] **1.4** Script de configuração `SoundyTracking.configure()` adicionado
- [ ] **1.5** Labels reais substituídos (ver `TRACKING_IDS_REQUIRED.md`)
- [ ] **1.6** Teste local: `SoundyTracking.getStats()` mostra IDs corretos
- [ ] **1.7** Teste local: cadastro na lista de espera dispara conversão (ver console)
- [ ] **1.8** Teste local: CTA Demo dispara evento (se aplicável)
- [ ] **1.9** Deduplicação funcionando (tentar cadastrar 2x, não deve duplicar)

### Fase 2: Deploy

- [ ] **2.1** Código commitado com mensagem clara
- [ ] **2.2** Deploy realizado (Vercel/Railway/etc)
- [ ] **2.3** URL de produção acessível

### Fase 3: Validação Inicial (Produção)

- [ ] **3.1** Abrir site em produção
- [ ] **3.2** Abrir DevTools → Console
- [ ] **3.3** Verificar se não há erros de JavaScript críticos
- [ ] **3.4** Executar: `typeof gtag === 'function'` → deve retornar `true`
- [ ] **3.5** Executar: `SoundyTracking.isEnabled()` → deve retornar `true`
- [ ] **3.6** Executar: `SoundyTracking.getStats()` → verificar IDs corretos

### Fase 4: Teste de Conversão (Lista de Espera)

- [ ] **4.1** Abrir `/prelaunch.html` (ou página de lista de espera)
- [ ] **4.2** Abrir Chrome Extension: [Google Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)
- [ ] **4.3** Clicar em "Enable" no Tag Assistant
- [ ] **4.4** Preencher formulário com dados de teste (usar e-mail real seu)
- [ ] **4.5** Antes de submeter: Tag Assistant deve mostrar tag `AW-XXXXXXX`
- [ ] **4.6** Submeter formulário
- [ ] **4.7** Verificar console:
  ```
  ✅ Lead cadastrado com sucesso
  📊 Conversão de lista de espera rastreada
  [TRACKING] 🎯 Enviando conversão: AW-XXXXXXX/LABEL_WAITLIST
  ```
- [ ] **4.8** Tag Assistant deve mostrar evento `conversion` disparado
- [ ] **4.9** Tentar cadastrar novamente com mesmo e-mail → deve deduplica
- [ ] **4.10** Verificar Firestore: documento criado na collection `waitlist`

### Fase 5: Teste CTA Demo (se aplicável)

- [ ] **5.1** Abrir `/index.html` (app)
- [ ] **5.2** Fazer 1 análise para esgotar limite demo
- [ ] **5.3** Modal de conversão deve aparecer
- [ ] **5.4** Verificar Tag Assistant ativo
- [ ] **5.5** Clicar em "Voltar para página do produto"
- [ ] **5.6** Verificar console: evento `cta_demo_to_sales` disparado
- [ ] **5.7** Tag Assistant mostra evento
- [ ] **5.8** Voltar e clicar novamente → deve deduplica

### Fase 6: Teste CTA Vendas → Checkout

- [ ] **6.1** Abrir página de vendas
- [ ] **6.2** Verificar Tag Assistant ativo
- [ ] **6.3** Clicar em botão CTA de checkout
- [ ] **6.4** Verificar console: evento `cta_sales_to_checkout` disparado
- [ ] **6.5** Tag Assistant mostra evento
- [ ] **6.6** (Opcional) Voltar e clicar novamente → deve deduplica

### Fase 7: Validação Google Ads (24h depois)

⚠️ **Importante:** Conversões podem levar até 24 horas para aparecer

- [ ] **7.1** Aguardar 24 horas após os testes
- [ ] **7.2** Acessar [Google Ads](https://ads.google.com/)
- [ ] **7.3** Menu: **Ferramentas → Medição → Conversões**
- [ ] **7.4** Verificar conversão "Lista de Espera":
  - [ ] Coluna "Conversões" deve mostrar número > 0
  - [ ] Verificar data/hora corresponde ao teste
- [ ] **7.5** (Opcional) Verificar outros eventos/conversões criados
- [ ] **7.6** Se não aparecer, ir para **Fase 8: Troubleshooting**

### Fase 8: Troubleshooting (se conversões não aparecem)

- [ ] **8.1** Verificar novamente IDs:
  ```javascript
  SoundyTracking.getStats().config
  ```
- [ ] **8.2** Verificar se `AW-XXXXXXX` está correto (copiar/colar do Google Ads)
- [ ] **8.3** Verificar se Labels estão corretos
- [ ] **8.4** No Google Ads: **Ferramentas → Conversões** → Clicar na conversão
- [ ] **8.5** Verificar status: deve estar "Ativa" e "Registrando conversões"
- [ ] **8.6** Verificar se há filtros aplicados (ex: conversões de tráfego direto)
- [ ] **8.7** Testar novamente em modo anônimo (para evitar cache)
- [ ] **8.8** Consultar seção Troubleshooting em `TRACKING.md`
- [ ] **8.9** Se persistir após 48h, considerar:
  - Conversões podem estar sendo filtradas por cliques inválidos
  - Usuário pode não ter clicado em anúncio antes de converter (conversões diretas não são atribuídas)
  - Verificar janela de conversão configurada

---

## 🧪 COMANDOS ÚTEIS PARA DEBUG

### Console do navegador (Produção):

```javascript
// 1. Verificar sistema de tracking
SoundyTracking.getStats()

// 2. Ver eventos rastreados nesta sessão
sessionStorage.getItem('soundy_tracking_events')

// 3. Limpar eventos (para testar deduplicação)
SoundyTracking.clearTrackedEvents()

// 4. Forçar disparo de evento (teste)
SoundyTracking.trackWaitlistSignup('teste@example.com', { value: 0 })

// 5. Verificar se gtag está presente
typeof gtag === 'function'
typeof dataLayer !== 'undefined'

// 6. Ativar modo debug
SoundyTracking.setDebug(true)

// 7. Ver eventos do dataLayer
dataLayer
```

---

## 📊 MÉTRICAS ESPERADAS (Primeiros 7 dias)

Após implementação e validação, acompanhar:

| Métrica | Onde ver | Expectativa |
|---------|----------|-------------|
| **Conversões Lista Espera** | Google Ads → Conversões | Crescimento linear conforme tráfego |
| **Taxa de conversão** | Google Ads → Campanhas | Depende da campanha (benchmark: 2-5%) |
| **CTA Demo cliques** | GA4 ou Google Ads | Se configurado como conversão |
| **CTA Vendas cliques** | GA4 ou Google Ads | Se configurado como conversão |
| **Compras** | Google Ads → Conversões | Conforme vendas Hotmart |

---

## ⚠️ ALERTAS IMPORTANTES

### 🔴 CRÍTICO - Não fazer:

- [ ] ❌ Não alterar IDs após deploy inicial (causa inconsistência)
- [ ] ❌ Não testar com bloqueador de ads ativo (Tag Assistant não funciona)
- [ ] ❌ Não assumir que "não aparece" = "não funciona" (aguardar 24h)
- [ ] ❌ Não duplicar tags `gtag.js` (causa erros)

### 🟡 ATENÇÃO:

- [ ] ⚠️ Conversões diretas (sem clique em anúncio) são registradas mas não atribuídas
- [ ] ⚠️ Adblockers impedem tracking (esperado e aceitável)
- [ ] ⚠️ Modo anônimo/privado pode ter comportamento diferente (cache/storage)
- [ ] ⚠️ Cliques inválidos são filtrados pelo Google (proteção automática)

### 🟢 BOM SABER:

- [ ] ✅ Logs em localhost são normais (modo debug ativo)
- [ ] ✅ Erros "gtag não disponível" são aceitáveis se usuário tem adblocker
- [ ] ✅ Sistema foi projetado para não quebrar o site mesmo sem tracking
- [ ] ✅ Deduplicação garante que conversões não duplicam

---

## 📁 ARQUIVOS DE REFERÊNCIA

| Arquivo | Propósito |
|---------|-----------|
| `TRACKING.md` | Documentação completa |
| `TRACKING_IDS_REQUIRED.md` | Lista de IDs para configurar |
| `public/js/tracking.js` | Módulo principal |
| `public/js/tracking-integration-examples.js` | Exemplos de uso |

---

## ✅ APROVAÇÃO FINAL

Marcar como ✅ apenas quando:

- [ ] Todos os itens acima foram verificados
- [ ] Conversões aparecem no Google Ads após 24h
- [ ] Deduplicação funciona corretamente
- [ ] Não há erros de JavaScript em produção
- [ ] Tag Assistant valida eventos
- [ ] Equipe foi notificada que tracking está ativo

---

**Data de validação:** ___/___/______  
**Responsável:** _______________________  
**Status:** ⬜ Pendente | ⬜ Em andamento | ⬜ Aprovado  

---

**Última atualização:** 20/01/2026  
**Versão:** 1.0.0
