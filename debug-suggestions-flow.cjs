#!/usr/bin/env node
/**
 * 🔍 DEBUG: Investigar fluxo de sugestões educativas
 * Rastrear por que sugestões não estão aparecendo no modal
 */

const fs = require('fs');
const path = require('path');

// 1. Verificar se há análises recentes com sugestões vazias
function checkRecentAnalyses() {
    console.log('🔍 Verificando análises recentes...\n');
    
    const workDir = 'c:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\work';
    
    if (!fs.existsSync(workDir)) {
        console.log('❌ Diretório work não encontrado');
        return;
    }
    
    const folders = fs.readdirSync(workDir, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => ({
            name: item.name,
            path: path.join(workDir, item.name),
            modified: fs.statSync(path.join(workDir, item.name)).mtime
        }))
        .sort((a, b) => b.modified - a.modified)
        .slice(0, 5); // Últimas 5 análises
    
    console.log(`📊 Últimas ${folders.length} análises encontradas:\n`);
    
    folders.forEach((folder, index) => {
        console.log(`${index + 1}. ${folder.name} (${folder.modified.toISOString()})`);
        
        // Verificar se tem result.json
        const resultPath = path.join(folder.path, 'result.json');
        if (fs.existsSync(resultPath)) {
            try {
                const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
                
                console.log(`   📄 result.json encontrado`);
                console.log(`   🎯 Suggestions: ${result.suggestions ? result.suggestions.length : 'undefined'}`);
                console.log(`   ⚠️  Problems: ${result.problems ? result.problems.length : 'undefined'}`);
                
                if (result.suggestions && result.suggestions.length > 0) {
                    console.log('   📋 Primeiras sugestões:');
                    result.suggestions.slice(0, 2).forEach((sug, i) => {
                        console.log(`      ${i+1}. ${sug.message || sug.title || 'Sem título'} (${sug.severity?.level || 'sem severidade'})`);
                    });
                }
                
                if (result.problems && result.problems.length > 0) {
                    console.log('   🚨 Problemas:');
                    result.problems.slice(0, 2).forEach((prob, i) => {
                        console.log(`      ${i+1}. ${prob.message || prob.title || 'Sem título'}`);
                    });
                }
                
                console.log('');
            } catch (err) {
                console.log(`   ❌ Erro ao ler result.json: ${err.message}\n`);
            }
        } else {
            console.log(`   ❌ result.json não encontrado\n`);
        }
    });
}

// 2. Testar problemas-suggestions.js diretamente
async function testProblemsEngine() {
    console.log('🔧 Testando engine de sugestões...\n');
    
    try {
        // Carregar módulo de sugestões
        const suggestionPath = 'c:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\work\\lib\\audio\\features\\problems-suggestions.js';
        
        if (!fs.existsSync(suggestionPath)) {
            console.log('❌ problems-suggestions.js não encontrado');
            return;
        }
        
        // Importar dinamicamente seria melhor, mas para debug vamos ler e simular
        const content = fs.readFileSync(suggestionPath, 'utf8');
        
        // Verificar se getNullResult está corrigido
        if (content.includes('return { suggestions: [], problems: [] }')) {
            console.log('❌ PROBLEMA: getNullResult ainda retorna arrays vazios!');
            console.log('   Sugestões educativas não estão sendo aplicadas no backend\n');
        } else if (content.includes('suggestions: [') && content.includes('message:') && content.includes('educational')) {
            console.log('✅ getNullResult parece corrigido com sugestões educativas');
        } else {
            console.log('⚠️  getNullResult status incerto - precisa verificar manualmente\n');
        }
        
        // Verificar se SEVERITY_LEVELS tem estrutura educativa
        if (content.includes('educationalTone') && content.includes('emoji')) {
            console.log('✅ SEVERITY_LEVELS com estrutura educativa encontrada');
        } else {
            console.log('❌ SEVERITY_LEVELS sem estrutura educativa');
        }
        
        console.log('');
        
    } catch (err) {
        console.log(`❌ Erro ao testar engine: ${err.message}\n`);
    }
}

// 3. Verificar core-metrics.js
function testCoreMetrics() {
    console.log('🔧 Testando core-metrics.js...\n');
    
    try {
        const coreMetricsPath = 'c:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\work\\api\\audio\\core-metrics.js';
        
        if (!fs.existsSync(coreMetricsPath)) {
            console.log('❌ core-metrics.js não encontrado');
            return;
        }
        
        const content = fs.readFileSync(coreMetricsPath, 'utf8');
        
        // Verificar se fallback está corrigido
        if (content.includes('suggestions: []') && content.includes('problems: []')) {
            console.log('❌ PROBLEMA: core-metrics ainda usa fallback vazio!');
            console.log('   Análise vazia resulta em arrays vazios, não educativos\n');
        } else if (content.includes('getNullResult()') || content.includes('educational')) {
            console.log('✅ core-metrics parece usar fallback educativo');
        } else {
            console.log('⚠️  core-metrics status incerto\n');
        }
        
    } catch (err) {
        console.log(`❌ Erro ao testar core-metrics: ${err.message}\n`);
    }
}

// 4. Verificar audio-analyzer-integration.js
function testFrontendIntegration() {
    console.log('🔧 Testando integração frontend...\n');
    
    try {
        const integrationPath = 'c:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\audio-analyzer-integration.js';
        
        if (!fs.existsSync(integrationPath)) {
            console.log('❌ audio-analyzer-integration.js não encontrado');
            return;
        }
        
        const content = fs.readFileSync(integrationPath, 'utf8');
        
        // Verificar se diagCard verifica analysis.suggestions
        if (content.includes('analysis.suggestions.length > 0')) {
            console.log('✅ diagCard verifica analysis.suggestions.length');
        } else {
            console.log('❌ diagCard não verifica analysis.suggestions corretamente');
        }
        
        // Verificar se há logging de debug
        if (content.includes('console.log') && content.includes('suggestions')) {
            console.log('✅ Logging de debug encontrado para sugestões');
        } else {
            console.log('⚠️  Pouco logging de debug para sugestões');
        }
        
        // Verificar se renderSuggestionItem foi atualizado
        if (content.includes('renderSuggestionItem') && content.includes('educational')) {
            console.log('✅ renderSuggestionItem com estrutura educativa');
        } else {
            console.log('❌ renderSuggestionItem sem estrutura educativa');
        }
        
        console.log('');
        
    } catch (err) {
        console.log(`❌ Erro ao testar frontend: ${err.message}\n`);
    }
}

// Executar diagnóstico completo
async function runFullDiagnostic() {
    console.log('🔍 DIAGNÓSTICO COMPLETO - Fluxo de Sugestões Educativas');
    console.log('='.repeat(60) + '\n');
    
    checkRecentAnalyses();
    await testProblemsEngine();
    testCoreMetrics();
    testFrontendIntegration();
    
    console.log('📋 RESUMO:');
    console.log('1. Se análises recentes têm suggestions: [], o problema está no backend');
    console.log('2. Se getNullResult ainda retorna arrays vazios, backend não foi corrigido');
    console.log('3. Se core-metrics usa fallback vazio, análises vazias não geram educativas');
    console.log('4. Se diagCard não encontra suggestions, frontend não renderiza\n');
    
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('- Executar uma análise de teste e verificar result.json');
    console.log('- Adicionar debug logging no diagCard para rastrear dados');
    console.log('- Verificar se analysis object tem suggestions no momento de renderização');
}

runFullDiagnostic().catch(console.error);