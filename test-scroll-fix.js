/**
 * 🧪 SCRIPT DE VALIDAÇÃO - CORREÇÃO DE SCROLL
 * Execute este script no console do browser (produção e localhost)
 * para validar que a correção funciona corretamente.
 */

console.log("🔍 INICIANDO VALIDAÇÃO DE SCROLL...\n");

// 1. Verificar página atual
const currentPage = window.location.pathname;
console.log(`📄 Página atual: ${currentPage}`);

// 2. Verificar classe do body
const bodyClass = document.body.className;
console.log(`🏷️  Classe do body: "${bodyClass}"`);

// 3. Verificar overflow computado
const htmlOverflow = getComputedStyle(document.documentElement).overflowY;
const bodyOverflow = getComputedStyle(document.body).overflowY;
console.log(`📊 html overflow-y: ${htmlOverflow}`);
console.log(`📊 body overflow-y: ${bodyOverflow}`);

// 4. Verificar altura do body
const bodyHeight = getComputedStyle(document.body).height;
console.log(`📏 body height: ${bodyHeight}`);

// 5. Validar comportamento esperado
console.log("\n✅ VALIDAÇÃO:");

if (currentPage.includes("index.html") || currentPage === "/") {
    if (bodyClass.includes("page-index") && bodyOverflow === "hidden") {
        console.log("✅ INDEX: overflow hidden CORRETO (layout tipo app)");
    } else {
        console.error("❌ INDEX: deveria ter classe 'page-index' e overflow hidden");
    }
} else if (currentPage.includes("documento-tecnico") || 
           currentPage.includes("plano") || 
           currentPage.includes("privacidade") ||
           currentPage.includes("termos") ||
           currentPage.includes("landing") ||
           currentPage.includes("gerenciar")) {
    if (bodyClass.includes("page-doc") && (bodyOverflow === "auto" || bodyOverflow === "visible")) {
        console.log(`✅ ${currentPage}: overflow auto/visible CORRETO (scroll normal)`);
    } else {
        console.error(`❌ ${currentPage}: deveria ter classe 'page-doc' e overflow auto/visible`);
        console.error(`   Atual: classe="${bodyClass}", overflow="${bodyOverflow}"`);
    }
}

// 6. Teste de scroll prático
console.log("\n🧪 TESTE PRÁTICO DE SCROLL:");
const canScroll = document.documentElement.scrollHeight > document.documentElement.clientHeight;
console.log(`📐 Conteúdo maior que viewport? ${canScroll}`);
console.log(`📐 scrollHeight: ${document.documentElement.scrollHeight}px`);
console.log(`📐 clientHeight: ${document.documentElement.clientHeight}px`);

if (canScroll && bodyOverflow !== "hidden") {
    console.log("✅ Página PODE rolar (comportamento correto para documentos)");
} else if (!canScroll) {
    console.log("ℹ️  Conteúdo cabe na tela (scroll não necessário)");
} else if (bodyOverflow === "hidden" && currentPage.includes("index")) {
    console.log("✅ Página NÃO rola (correto para index - layout fixo)");
} else {
    console.warn("⚠️  Atenção: página deveria rolar mas está bloqueada");
}

console.log("\n🔍 VALIDAÇÃO CONCLUÍDA");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
