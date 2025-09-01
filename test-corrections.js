/**
 * 🧪 TESTE DE VALIDAÇÃO DAS CORREÇÕES
 * Verifica se os problemas críticos foram resolvidos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 VALIDANDO CORREÇÕES APLICADAS...\n');

// 1. Verificar se o bug do recálculo foi corrigido

const metricsRecalcPath = path.join(__dirname, 'tools', 'metrics-recalc.js');
const metricsContent = fs.readFileSync(metricsRecalcPath, 'utf8');

console.log('1️⃣ VERIFICANDO BUG NO METRICS-RECALC.JS:');
if (metricsContent.includes('lufs_integrated: CONFIG.lufsTarget')) {
    console.log('❌ BUG AINDA PRESENTE: lufs_integrated: CONFIG.lufsTarget encontrado');
} else if (metricsContent.includes('lufs_integrated: lufs.integrated')) {
    console.log('✅ BUG CORRIGIDO: Agora usa lufs.integrated (valor medido real)');
} else {
    console.log('⚠️ AMBÍGUO: Padrão não encontrado - verificar manualmente');
}

// 2. Verificar se funk_mandela.json foi corrigido
const funkMandelaPath = path.join(__dirname, 'public', 'refs', 'out', 'funk_mandela.json');
try {
    const funkData = JSON.parse(fs.readFileSync(funkMandelaPath, 'utf8'));
    const lufsTarget = funkData.funk_mandela?.legacy_compatibility?.lufs_target;
    
    console.log('\n2️⃣ VERIFICANDO LUFS TARGET FUNK_MANDELA:');
    console.log(`   Valor atual: ${lufsTarget}`);
    
    if (lufsTarget === -4.9) {
        console.log('❌ AINDA INCORRETO: LUFS -4.9 é impossível para música');
    } else if (lufsTarget === -8.0 || lufsTarget === -8) {
        console.log('✅ CORRIGIDO: LUFS -8.0 é um valor sensato para funk');
    } else {
        console.log(`⚠️ VALOR INESPERADO: ${lufsTarget} - verificar se está correto`);
    }
} catch (e) {
    console.log('❌ ERRO ao ler funk_mandela.json:', e.message);
}

// 3. Verificar se embedded refs foram corrigidas
const embeddedRefsPath = path.join(__dirname, 'public', 'refs', 'embedded-refs-new.js');
const embeddedContent = fs.readFileSync(embeddedRefsPath, 'utf8');

console.log('\n3️⃣ VERIFICANDO REFERÊNCIAS EMBARCADAS:');
if (embeddedContent.includes('"lufs_target": -4.9')) {
    console.log('❌ REFS EMBARCADAS AINDA INCORRETAS: lufs_target: -4.9 encontrado');
} else {
    console.log('✅ REFS EMBARCADAS CORRIGIDAS: -4.9 removido');
}

// 4. Verificar se audio-analyzer-integration.js tem recálculo de score
const integrationPath = path.join(__dirname, 'public', 'audio-analyzer-integration.js');
const integrationContent = fs.readFileSync(integrationPath, 'utf8');

console.log('\n4️⃣ VERIFICANDO RECÁLCULO DE SCORE:');
if (integrationContent.includes('currentModalAnalysis.qualityOverall = window.computeMixScore')) {
    console.log('✅ RECÁLCULO DE SCORE ADICIONADO ao changeGenre');
} else {
    console.log('❌ RECÁLCULO DE SCORE NÃO ENCONTRADO');
}

console.log('\n🏁 VALIDAÇÃO CONCLUÍDA');
