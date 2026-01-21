#!/usr/bin/env node
/**
 * VALIDADOR PRÉ-DEPLOY - TRACKING GOOGLE ADS
 * 
 * Valida que NENHUM placeholder está presente antes do deploy
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDANDO ARQUIVOS DE PRODUÇÃO...\n');

const PLACEHOLDERS_PROIBIDOS = [
    'AW-REPLACE_WITH_YOUR_ID',
    'REPLACE_WITH_YOUR_ID',
    'AW-REPLACE',
    'REPLACE_WITH_WAITLIST_LABEL',
    'REPLACE_WITH_CHECKOUT_LABEL',
    'REPLACE_WITH_PURCHASE_LABEL'
];

const ARQUIVOS_PARA_VALIDAR = [
    'public/prelaunch.html',
    'public/index.html',
    'public/vendas.html'
];

let errosEncontrados = 0;

ARQUIVOS_PARA_VALIDAR.forEach(arquivo => {
    const caminho = path.join(process.cwd(), arquivo);
    
    if (!fs.existsSync(caminho)) {
        console.log(`⚠️  ${arquivo} - NÃO ENCONTRADO (ignorando)`);
        return;
    }
    
    const conteudo = fs.readFileSync(caminho, 'utf-8');
    
    PLACEHOLDERS_PROIBIDOS.forEach(placeholder => {
        if (conteudo.includes(placeholder)) {
            console.error(`❌ ${arquivo} - CONTÉM PLACEHOLDER: ${placeholder}`);
            errosEncontrados++;
        }
    });
    
    // Verificar se tem ID real
    if (conteudo.includes('AW-17884386312')) {
        console.log(`✅ ${arquivo} - ID REAL PRESENTE`);
    } else {
        console.error(`❌ ${arquivo} - ID REAL NÃO ENCONTRADO`);
        errosEncontrados++;
    }
    
    // Verificar timestamp de deploy
    if (conteudo.includes('DEPLOY_VERSION:')) {
        const match = conteudo.match(/DEPLOY_VERSION:\s*([0-9\-\s:]+)/);
        if (match) {
            console.log(`📅 ${arquivo} - Deploy: ${match[1].trim()}`);
        }
    } else {
        console.warn(`⚠️  ${arquivo} - SEM TIMESTAMP DE DEPLOY`);
    }
});

console.log('\n' + '='.repeat(60));

if (errosEncontrados > 0) {
    console.error(`\n❌ VALIDAÇÃO FALHOU: ${errosEncontrados} erro(s) encontrado(s)`);
    console.error('⛔ NÃO FAZER DEPLOY ATÉ CORRIGIR!\n');
    process.exit(1);
} else {
    console.log('\n✅ VALIDAÇÃO PASSOU: Todos os arquivos estão corretos');
    console.log('🚀 SEGURO PARA DEPLOY\n');
    process.exit(0);
}
