/**
 * 🧪 DIAGNÓSTICO DOCUMENTO TÉCNICO - PRODUÇÃO
 * 
 * Cole este script no DevTools Console da página /documento-tecnico.html
 * em PRODUÇÃO para diagnosticar o problema.
 */

console.log("🔍 ========================================");
console.log("🔍 DIAGNÓSTICO DOCUMENTO TÉCNICO");
console.log("🔍 ========================================\n");

// 1. Verificar URL atual
console.log("📍 1. URL ATUAL:");
console.log(`   ${window.location.href}`);
console.log(`   Pathname: ${window.location.pathname}`);
console.log("");

// 2. Verificar classe do body
console.log("🏷️  2. CLASSE DO BODY:");
console.log(`   "${document.body.className}"`);
console.log(`   Contém 'page-doc'? ${document.body.classList.contains('page-doc')}`);
console.log(`   Contém 'page-index'? ${document.body.classList.contains('page-index')}`);
console.log("");

// 3. Verificar proteção global
console.log("🛡️  3. PROTEÇÃO GLOBAL:");
console.log(`   window.IS_DOCUMENTATION_PAGE = ${window.IS_DOCUMENTATION_PAGE}`);
console.log("");

// 4. Verificar conteúdo do docContent
console.log("📄 4. CONTEÚDO DO DOCUMENTO:");
const docContent = document.getElementById('docContent');
if (docContent) {
    const contentLength = docContent.innerHTML.length;
    const hasContent = contentLength > 100;
    console.log(`   #docContent existe: ✅`);
    console.log(`   Tamanho do HTML: ${contentLength} caracteres`);
    console.log(`   Tem conteúdo renderizado? ${hasContent ? '✅' : '❌'}`);
    
    if (!hasContent) {
        console.log(`   Conteúdo atual: "${docContent.innerHTML.substring(0, 200)}"`);
    } else {
        const headings = docContent.querySelectorAll('h1, h2, h3');
        console.log(`   Títulos encontrados: ${headings.length}`);
        if (headings.length > 0) {
            console.log(`   Primeiro título: "${headings[0].textContent.substring(0, 50)}"`);
        }
    }
} else {
    console.error(`   #docContent NÃO EXISTE ❌`);
}
console.log("");

// 5. Verificar elementos da index que não deveriam estar aqui
console.log("🔍 5. ELEMENTOS INDESEJADOS DA INDEX:");
const unwantedElements = [
    '.cenario',
    '.chat-container',
    '.notebook-container',
    '.audio-modal',
    '#menuButton',
    '.vanta-canvas',
    '[class*="upgrade"]',
    '[id*="audio"]'
];

let foundUnwanted = false;
unwantedElements.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
        console.warn(`   ⚠️  Encontrado: ${selector} (${elements.length} elementos)`);
        elements.forEach((el, idx) => {
            console.log(`      [${idx}] ${el.tagName} - display: ${getComputedStyle(el).display}`);
        });
        foundUnwanted = true;
    }
});

if (!foundUnwanted) {
    console.log(`   ✅ Nenhum elemento indesejado encontrado`);
}
console.log("");

// 6. Verificar CSS carregado
console.log("🎨 6. ARQUIVOS CSS CARREGADOS:");
const styleSheets = Array.from(document.styleSheets);
styleSheets.forEach((sheet, idx) => {
    if (sheet.href) {
        const filename = sheet.href.split('/').pop().split('?')[0];
        console.log(`   [${idx}] ${filename}`);
    }
});
console.log("");

// 7. Verificar scripts carregados
console.log("📜 7. SCRIPTS CARREGADOS:");
const scripts = Array.from(document.scripts);
scripts.forEach((script, idx) => {
    if (script.src) {
        const filename = script.src.split('/').pop().split('?')[0];
        console.log(`   [${idx}] ${filename}`);
    }
});
console.log("");

// 8. Verificar fetch do markdown
console.log("📂 8. TESTANDO FETCH DO MARKDOWN:");
fetch('/DOCUMENTO_TECNICO_USO_PLATAFORMA.md')
    .then(response => {
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`);
        return response.text();
    })
    .then(text => {
        console.log(`   ✅ Markdown carregado: ${text.length} caracteres`);
        console.log(`   Primeiras 100 chars: "${text.substring(0, 100)}"`);
    })
    .catch(error => {
        console.error(`   ❌ ERRO ao buscar markdown:`, error);
    });
console.log("");

// 9. Verificar console logs do loader
console.log("📝 9. LOGS DO LOADER:");
console.log("   (Verifique acima se há mensagens '[DOCLOADER]')");
console.log("");

// 10. Sugestões
console.log("💡 10. DIAGNÓSTICO:");
setTimeout(() => {
    const hasDocContent = docContent && docContent.innerHTML.length > 100;
    const hasUnwantedElements = document.querySelectorAll('.cenario, .chat-container').length > 0;
    const hasCorrectClass = document.body.classList.contains('page-doc');
    
    if (!hasDocContent) {
        console.error("❌ PROBLEMA: Conteúdo do documento NÃO foi carregado");
        console.log("   Possíveis causas:");
        console.log("   1. Arquivo markdown não encontrado (verificar fetch acima)");
        console.log("   2. Erro no documento-tecnico-loader.js");
        console.log("   3. docContent sendo sobrescrito por outro script");
    }
    
    if (hasUnwantedElements) {
        console.error("❌ PROBLEMA: Elementos da index estão presentes");
        console.log("   Possíveis causas:");
        console.log("   1. CSS de proteção não está sendo aplicado");
        console.log("   2. Scripts da index estão sendo executados");
        console.log("   3. Fallback para index.html no servidor");
    }
    
    if (!hasCorrectClass) {
        console.error("❌ PROBLEMA: Body não tem classe 'page-doc'");
        console.log("   Isso pode causar conflitos de estilo com a index");
    }
    
    if (hasDocContent && !hasUnwantedElements && hasCorrectClass) {
        console.log("✅ TUDO CERTO! Documento carregado corretamente");
    }
}, 1000);

console.log("\n🔍 ========================================");
console.log("🔍 FIM DO DIAGNÓSTICO");
console.log("🔍 ========================================");
