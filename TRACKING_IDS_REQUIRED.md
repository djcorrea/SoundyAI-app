# 🔑 IDs DO GOOGLE ADS - CONFIGURAÇÃO OBRIGATÓRIA

**Status:** ⚠️ AGUARDANDO CONFIGURAÇÃO  
**Prioridade:** 🔴 CRÍTICO  
**Antes de fazer deploy:** Substituir TODOS os placeholders abaixo

---

## 📋 ONDE OBTER OS IDs

1. Acessar: https://ads.google.com/
2. Menu: **Ferramentas → Medição → Conversões**
3. Criar conversões necessárias (ver detalhes abaixo)
4. Anotar os IDs/Labels e substituir nos arquivos

---

## 🎯 IDs NECESSÁRIOS

### 1. ID de Conversão do Google Ads
**Formato:** `AW-XXXXXXX` (onde XXXXXXX são números)

**Como obter:**
- Na página de Conversões do Google Ads
- Clicar em qualquer conversão existente
- Copiar o ID que aparece no formato `AW-1234567890`
j
**Onde substituir:**
- [ ] `/public/prelaunch.html` (linha ~17)
- [ ] `/public/index.html` (linha ~12)
- [ ] `/public/landing.html` (se existir)
- [ ] Qualquer outra página HTML principal

**Buscar por:**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GOOGLE_ADS_ID"></script>
```

**Substituir por:**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-1234567890"></script>
```

E também:
```javascript
gtag('config', 'GOOGLE_ADS_ID');
```

Por:
```javascript
gtag('config', 'AW-1234567890');
```

---

### 2. Label da Conversão "Lista de Espera" (LEAD)
**Formato:** String alfanumérica (ex: `abc123xyz`)

**Como obter:**
1. No Google Ads: **Ferramentas → Conversões**
2. Clicar em **+ Nova conversão** → **Website**
3. Configurar:
   - **Nome:** Lista de Espera - SoundyAI
   - **Categoria:** Lead
   - **Valor:** Usar o mesmo valor para todas as conversões → R$ 0,00 (ou valor estimado do lead)
   - **Contagem:** Uma (uma conversão por clique)
   - **Janela de conversão:** 30 dias
4. Salvar e copiar o **Label** gerado (aparece como "Etiqueta da conversão")

**Onde substituir:**
- [ ] Configurar via código JavaScript (ver abaixo)

**Código:**
```javascript
// Adicionar em qualquer página (ex: prelaunch.html após inclusão de tracking.js)
<script>
SoundyTracking.configure({
    conversionId: 'AW-1234567890',  // ID obtido acima
    labels: {
        waitlist: 'abc123xyz',  // ← SUBSTITUIR pelo label real
        ctaDemo: '',            // Deixar vazio se não for criar
        ctaSales: '',           // Deixar vazio se não for criar
        purchase: 'def456uvw'   // ← SUBSTITUIR pelo label real
    }
});
</script>
```

---

### 3. Label CTA Demo → Vendas (OPCIONAL)
**Formato:** String alfanumérica

**Se optar por criar:**
- **Nome:** CTA Demo para Vendas - SoundyAI
- **Categoria:** Outro (ou Lead)
- **Valor:** R$ 0,00
- **Contagem:** Uma

**Se não criar:**
- Deixar vazio no código (`ctaDemo: ''`)
- O sistema enviará como evento GA4 em vez de conversão

---

### 4. Label CTA Vendas → Checkout (OPCIONAL)
**Formato:** String alfanumérica

**Se optar por criar:**
- **Nome:** CTA Vendas para Checkout - SoundyAI
- **Categoria:** Outro (ou Lead)
- **Valor:** R$ 0,00
- **Contagem:** Uma

**Se não criar:**
- Deixar vazio no código (`ctaSales: ''`)
- O sistema enviará como evento GA4 em vez de conversão

---

### 5. Label "Compra" (PURCHASE) - OBRIGATÓRIO
**Formato:** String alfanumérica

**Como obter:**
1. **Ferramentas → Conversões** → **+ Nova conversão**
2. Configurar:
   - **Nome:** Compra - SoundyAI Studio
   - **Categoria:** Compra
   - **Valor:** Usar valores de transação (importante!)
   - **Contagem:** Uma
   - **Janela de conversão:** 30 dias (ou conforme sua campanha)
3. Copiar o Label

---

## 🔄 SCRIPT DE CONFIGURAÇÃO COMPLETO

**Adicionar em TODAS as páginas principais após `<script src="/js/tracking.js">`:**

```html
<!-- Configuração do Tracking (após carregar tracking.js) -->
<script>
// Aguardar tracking.js carregar
document.addEventListener('DOMContentLoaded', function() {
    if (window.SoundyTracking) {
        SoundyTracking.configure({
            conversionId: 'AW-XXXXXXX',  // ⚠️ SUBSTITUIR
            labels: {
                waitlist: 'LABEL_WAITLIST',    // ⚠️ SUBSTITUIR
                ctaDemo: '',                    // Opcional: substituir ou deixar vazio
                ctaSales: '',                   // Opcional: substituir ou deixar vazio
                purchase: 'LABEL_PURCHASE'      // ⚠️ SUBSTITUIR
            }
        });
        console.log('📊 Tracking configurado com sucesso');
    }
});
</script>
```

---

## ✅ CHECKLIST DE SUBSTITUIÇÃO

### Antes do Deploy:

- [ ] **ID do Google Ads** (`AW-XXXXXXX`) obtido
- [ ] **Label "Lista de Espera"** obtido
- [ ] **Label "Compra"** obtido
- [ ] (Opcional) Labels de CTA Demo/Sales obtidos
- [ ] Placeholder `GOOGLE_ADS_ID` substituído em:
  - [ ] `/public/prelaunch.html`
  - [ ] `/public/index.html`
  - [ ] Outras páginas principais
- [ ] Script de configuração adicionado em todas as páginas
- [ ] Labels substituídos no script de configuração
- [ ] Teste local realizado (ver TRACKING.md → Testes)
- [ ] Google Tag Assistant validado
- [ ] Deploy em produção
- [ ] Aguardar 24h e verificar conversões no Google Ads

---

## 🧪 TESTE RÁPIDO (Localhost)

```javascript
// 1. Abrir qualquer página no navegador
// 2. Abrir DevTools → Console
// 3. Executar:

// Verificar se gtag carregou
typeof gtag === 'function'  // deve retornar true

// Verificar sistema de tracking
SoundyTracking.isEnabled()  // deve retornar true
SoundyTracking.getStats()   // deve mostrar config

// Verificar se IDs foram substituídos
const stats = SoundyTracking.getStats();
console.log('ID:', stats.config.conversionId);
console.log('Labels:', stats.config.labels);

// Se mostrar "AW-XXXXXXX" ou "LABEL_WAITLIST" → AINDA NÃO CONFIGURADO
// Se mostrar IDs reais → CONFIGURADO ✅
```

---

## ⚠️ IMPORTANTE

### NÃO fazer deploy sem configurar!

Sem os IDs corretos:
- ❌ Conversões não serão rastreadas
- ❌ Dados serão perdidos
- ❌ Não será possível medir ROI das campanhas

### Depois de configurar:

1. Commit com mensagem clara:
   ```bash
   git add .
   git commit -m "feat: configurar tracking Google Ads (IDs de produção)"
   git push
   ```

2. Testar em produção:
   - Fazer 1 cadastro na lista de espera
   - Verificar console para logs
   - Aguardar 24h
   - Verificar conversões no Google Ads

3. Se não funcionar:
   - Consultar TRACKING.md → Troubleshooting
   - Verificar Google Tag Assistant
   - Verificar se há bloqueador de ads

---

## 📞 SUPORTE

Dúvidas sobre onde encontrar os IDs:
- [Ajuda do Google Ads - Conversões](https://support.google.com/google-ads/answer/6331304)
- [Criar acompanhamento de conversões](https://support.google.com/google-ads/answer/1722054)

---

**Data:** 20/01/2026  
**Status:** ⚠️ Aguardando configuração pelos IDs reais  
**Próximo passo:** Obter IDs do Google Ads e substituir placeholders
