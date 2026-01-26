# 🚨 CONFIGURAÇÃO URGENTE - Google Analytics 4

## ❌ Problema Detectado

O Google não está reconhecendo a tag porque você está usando apenas o ID do **Google Ads** (`AW-17884386312`), mas **NÃO tem o ID do Google Analytics 4**.

## ✅ Solução Rápida (5 minutos)

### Passo 1: Obter o Measurement ID do GA4

1. Acesse: https://analytics.google.com/
2. Clique em **Admin** (⚙️ no canto inferior esquerdo)
3. Na coluna **Property**, clique em **Data Streams**
4. Clique no seu stream web (ou crie um novo se não tiver)
5. Copie o **Measurement ID** (formato: `G-XXXXXXXXXX`)

**Exemplo:**
```
G-1A2B3C4D5E
```

### Passo 2: Substituir nos Arquivos

Abra os seguintes arquivos e substitua `G-XXXXXXXXXX` pelo seu ID real:

#### 📄 Arquivo 1: `public/index.html` (linha ~15)
```html
<!-- Substitua G-XXXXXXXXXX pelo seu ID -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    
    // GA4 Analytics
    gtag('config', 'G-XXXXXXXXXX');  // ← SUBSTITUA AQUI
    
    // Google Ads Conversions
    gtag('config', 'AW-17884386312');
    
    // Debug mode: ?debug_tracking=1
    window.TRACKING_DEBUG = window.location.search.includes('debug_tracking=1');
    if (window.TRACKING_DEBUG) console.log('🎯 [TRACKING] Debug mode ativado');
</script>
```

#### 📄 Arquivo 2: `public/planos.html` (linha ~11)
```html
<!-- Mesmo código acima, substitua G-XXXXXXXXXX -->
```

#### 📄 Arquivo 3: `public/analytics-tracking.js` (linha ~19)
```javascript
const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // ← SUBSTITUA AQUI
const GOOGLE_ADS_ID = 'AW-17884386312'; // Manter como está
```

### Passo 3: Testar

1. Salve os arquivos
2. Faça commit e push:
   ```bash
   git add .
   git commit -m "fix: Adicionar Google Analytics 4 Measurement ID"
   git push
   ```
3. Acesse seu site com `?debug_tracking=1`
4. Abra o console (F12) e veja:
   ```
   [GA4-TRACKING] 📊 Evento enviado: page_view
   ```
5. No Google Analytics, vá em **Reports > Realtime** e veja eventos chegando

## 🎯 Diferença entre GA4 e Google Ads

| Tipo | ID | Função |
|------|-----|--------|
| **Google Analytics 4** | `G-XXXXXXXXXX` | Análise completa do site, eventos, funis |
| **Google Ads** | `AW-XXXXXXXXXX` | Apenas conversões de anúncios |

**Você precisa dos DOIS!** ✅

## 📋 Checklist Final

- [ ] Obtive o Measurement ID do GA4 (formato `G-XXXXXXXXXX`)
- [ ] Substituí em `public/index.html`
- [ ] Substituí em `public/planos.html`
- [ ] Substituí em `public/analytics-tracking.js`
- [ ] Fiz commit e push
- [ ] Testei com `?debug_tracking=1`
- [ ] Verifiquei no GA4 Real-Time

## ❓ Não tem uma conta GA4 ainda?

### Criar Propriedade GA4 (3 minutos)

1. Acesse: https://analytics.google.com/
2. Clique em **Admin** (⚙️)
3. Na coluna **Account**, clique em **Create Property**
4. Preencha:
   - Property name: `SoundyAI`
   - Time zone: `(GMT-03:00) Brasília`
   - Currency: `Brazilian Real (R$)`
5. Clique em **Next**
6. Selecione **Web** como platform
7. Configure:
   - Website URL: `https://soundyai.com.br`
   - Stream name: `SoundyAI Web`
8. Clique em **Create stream**
9. **COPIE** o Measurement ID (formato `G-XXXXXXXXXX`)
10. Use esse ID nos arquivos acima

## 🆘 Precisa de ajuda?

Se continuar com problemas:

1. Verifique se o ID começa com `G-` (não `AW-`)
2. Confirme que salvou todos os 3 arquivos
3. Limpe o cache do navegador (Ctrl+Shift+Del)
4. Teste em aba anônima
5. Use a extensão [Google Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)

## ✅ Depois de Configurar

Quando tudo estiver funcionando, você verá no console:

```
[GA4-TRACKING] 🚀 Inicializando sistema de tracking...
[GA4-TRACKING] ✅ gtag disponível
[GA4-TRACKING] ✅ Sistema de tracking inicializado
[GA4-TRACKING] 📊 Evento enviado: page_view {
    timestamp: "2026-01-26T...",
    page_path: "/",
    page_title: "SoundyAI - Mentor Virtual"
}
```

E no Google Analytics Real-Time você verá seus eventos! 🎉
