// OTIMIZAÇÕES SUGERIDAS PARA PROD.AI

/* ============ 1. LAZY LOADING DAS IMAGENS ============ */
// Adicionar ao CSS:
.cenario img {
    loading: lazy; /* Carregamento sob demanda */
    will-change: transform; /* Otimizar animações */
}

/* ============ 2. PRELOAD CRÍTICO ============ */
// Adicionar ao <head>:
<link rel="preload" as="image" href="robo-compressed.webp">
<link rel="preload" as="image" href="mesa-compressed.webp">

/* ============ 3. REMOVER CONSOLE.LOGS ============ */
// Substituir todos console.log por função vazia em produção:
if (window.location.hostname !== 'localhost') {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

/* ============ 4. OTIMIZAR BIBLIOTECAS ============ */
// Carregar apenas quando necessário:
function loadVantaOnDemand() {
    if (window.innerWidth > 768) { // Só desktop
        import('https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.net.min.js');
    }
}

/* ============ 5. COMPRIMIR ASSETS ============ */
// Configurações recomendadas:
- WebP qualidade 0.7-0.8
- Máximo 1920x1080px
- Minificar CSS/JS
- Gzip/Brotli no servidor

/* ============ 6. PERFORMANCE MONITORING ============ */
// Adicionar ao script principal:
window.addEventListener('load', () => {
    console.log('⚡ Site carregado em:', performance.now(), 'ms');
});

/* ============ PRIORIDADES ============ */
1. URGENTE: Comprimir imagens (maior impacto)
2. IMPORTANTE: Remover console.logs 
3. MÉDIO: Lazy loading
4. BAIXO: Otimizar bibliotecas
