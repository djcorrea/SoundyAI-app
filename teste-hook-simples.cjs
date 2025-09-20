/**
 * 🧪 TESTE SIMPLES DO HOOK DE AUDITORIA
 * 
 * Verifica se o hook foi adicionado corretamente no código fonte
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTE DO HOOK DE AUDITORIA NO CÓDIGO FONTE');
console.log('============================================================\n');

// Ler o arquivo enhanced-suggestion-engine.js
const filePath = path.join(__dirname, 'public', 'enhanced-suggestion-engine.js');
const fileContent = fs.readFileSync(filePath, 'utf8');

console.log('📄 Analisando arquivo enhanced-suggestion-engine.js...\n');

// Verificações
const checks = [
    {
        name: 'Hook de auditoria presente',
        test: () => fileContent.includes('HOOK DE AUDITORIA PERMANENTE'),
        details: 'Procurando comentário identificador do hook'
    },
    {
        name: 'Captura window.__DEBUG_ANALYSIS__',
        test: () => fileContent.includes('window.__DEBUG_ANALYSIS__ = analysis'),
        details: 'Verificando se analysis é salvo globalmente'
    },
    {
        name: 'Captura window.__DEBUG_REF__',
        test: () => fileContent.includes('window.__DEBUG_REF__ = referenceData'),
        details: 'Verificando se referenceData é salvo globalmente'
    },
    {
        name: 'Captura window.__DEBUG_OPTIONS__',
        test: () => fileContent.includes('window.__DEBUG_OPTIONS__ = options'),
        details: 'Verificando se options é salvo globalmente'
    },
    {
        name: 'Console log de auditoria',
        test: () => fileContent.includes('[AUDITORIA] processAnalysis capturado'),
        details: 'Verificando se há log identificável'
    },
    {
        name: 'Preserva método original',
        test: () => fileContent.includes('originalProcessAnalysis.apply(this, arguments)'),
        details: 'Verificando se método original é chamado'
    },
    {
        name: 'Wrapper em IIFE',
        test: () => fileContent.includes('(function() {') && fileContent.includes('})();'),
        details: 'Verificando se hook está em função auto-executável'
    },
    {
        name: 'Declaração do originalProcessAnalysis',
        test: () => fileContent.includes('const originalProcessAnalysis = EnhancedSuggestionEngine.prototype.processAnalysis'),
        details: 'Verificando se método original é preservado'
    },
    {
        name: 'Override do prototype',
        test: () => fileContent.includes('EnhancedSuggestionEngine.prototype.processAnalysis = function'),
        details: 'Verificando se prototype é sobrescrito'
    },
    {
        name: 'Log de confirmação',
        test: () => fileContent.includes('Hook de auditoria ativado para processAnalysis'),
        details: 'Verificando se há confirmação de ativação'
    }
];

// Executar verificações
let passed = 0;
let total = checks.length;

checks.forEach((check, index) => {
    const result = check.test();
    const status = result ? '✅' : '❌';
    
    console.log(`${index + 1}. ${status} ${check.name}`);
    console.log(`   ${check.details}`);
    
    if (result) {
        passed++;
    } else {
        console.log(`   ⚠️ FALHOU: Esta verificação não passou`);
    }
    console.log('');
});

// Resultado final
console.log('============================================================');
console.log(`📊 RESULTADO: ${passed}/${total} verificações passaram`);

if (passed === total) {
    console.log('🎉 SUCESSO! Hook de auditoria implementado corretamente!');
    console.log('');
    console.log('🔧 INSTRUÇÕES DE USO:');
    console.log('1. Carregue a página do SoundyAI no navegador');
    console.log('2. Execute uma análise de áudio'); 
    console.log('3. Abra o console do navegador (F12)');
    console.log('4. Procure por logs "[AUDITORIA] processAnalysis capturado"');
    console.log('5. Inspecione window.__DEBUG_ANALYSIS__ e window.__DEBUG_REF__');
    console.log('');
    console.log('📋 VARIÁVEIS DISPONÍVEIS NO CONSOLE:');
    console.log('• window.__DEBUG_ANALYSIS__ - Dados da análise atual');
    console.log('• window.__DEBUG_REF__ - Dados de referência utilizados');
    console.log('• window.__DEBUG_OPTIONS__ - Opções passadas (se houver)');
} else {
    console.log('❌ FALHA! Hook de auditoria não foi implementado corretamente.');
    console.log(`   ${total - passed} verificações falharam.`);
}

console.log('============================================================');

// Mostrar um trecho do hook adicionado
console.log('\n📝 TRECHO DO HOOK ADICIONADO:');
console.log('------------------------------------------------------------');

const hookStart = fileContent.indexOf('// ===== HOOK DE AUDITORIA PERMANENTE =====');
const hookEnd = fileContent.indexOf('console.log(\'🔍 Hook de auditoria ativado para processAnalysis\');') + 65;

if (hookStart !== -1 && hookEnd !== -1) {
    const hookCode = fileContent.substring(hookStart, hookEnd);
    console.log(hookCode);
} else {
    console.log('❌ Não foi possível extrair o trecho do hook');
}

console.log('------------------------------------------------------------');