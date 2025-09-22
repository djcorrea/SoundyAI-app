// 🧪 TESTE DAS CORREÇÕES: LRA e Bandas Espectrais
// Este script testa as correções implementadas no Enhanced Suggestion Engine

const fs = require('fs');
const path = require('path');

// Simular ambiente browser
global.window = {
    PROD_AI_REF_GENRE: 'eletronico',
    enhancedSuggestionEngine: null
};

// Carregar scripts necessários
function loadScript(scriptPath) {
    const fullPath = path.join(__dirname, scriptPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    eval(content);
}

try {
    console.log('🔧 Carregando Enhanced Suggestion Engine...');
    loadScript('public/suggestion-scorer.js');
    loadScript('public/enhanced-suggestion-engine.js');
    
    // Criar instância usando a classe global
    const engine = new global.window.EnhancedSuggestionEngine();
    global.window.enhancedSuggestionEngine = engine;
    
    console.log('✅ Enhanced Suggestion Engine carregado com sucesso');
    
    // 🧪 DADOS DE TESTE
    const dadosBackendTeste = {
        technicalData: {
            peak: -2.1,
            rms: -17.8,
            dynamicRange: 8.2,
            lufsIntegrated: -13.5,
            truePeakDbtp: -1.8,
            lra: 3.2,  // MUITO BAIXO: target=6, tol=1.5 → fora da tolerância (deve gerar sugestão)
            stereoCorrelation: 0.85,
            spectral_balance: {
                sub: -30.1,     // MUITO BAIXO: target=-25, tol=2.5 → fora da tolerância  
                bass: -15.2,    // MUITO ALTO: target=-20, tol=2 → fora da tolerância
                lowMid: -16.8,  // OK: target=-17, tol=2
                mid: -14.3,     // OK: target=-14, tol=1.5  
                highMid: -17.9, // OK: target=-18, tol=2
                presence: -28.2, // MUITO BAIXO: target=-22, tol=2.5 → fora da tolerância
                air: -19.8      // MUITO ALTO: target=-24, tol=3 → fora da tolerância
            }
        },
        problems: [],
        suggestions: []
    };

    const dadosReferenciaTeste = {
        legacy_compatibility: {
            lufs_target: -14.0,
            tol_lufs: 1.5,
            true_peak_target: -1.0,
            tol_true_peak: 0.5,
            dr_target: 8.0,
            tol_dr: 2.0,
            lra_target: 6.0,  // LRA target
            tol_lra: 1.5,     // LRA tolerance
            stereo_target: 0.80,
            tol_stereo: 0.15,
            bands: {
                sub: { target_db: -25.0, tol_db: 2.5 },
                bass: { target_db: -20.0, tol_db: 2.0 },
                lowMid: { target_db: -17.0, tol_db: 2.0 },
                mid: { target_db: -14.0, tol_db: 1.5 },
                highMid: { target_db: -18.0, tol_db: 2.0 },
                presenca: { target_db: -22.0, tol_db: 2.5 },
                brilho: { target_db: -24.0, tol_db: 3.0 }
            }
        }
    };

    console.log('\n🚀 Executando teste das correções...');
    
    // EXECUTAR TESTE
    const startTime = Date.now();
    const resultado = engine.processAnalysis(dadosBackendTeste, dadosReferenciaTeste);
    const endTime = Date.now();
    
    console.log(`\n📊 RESULTADO DO PROCESSAMENTO (${endTime - startTime}ms):`);
    console.log(`Total de sugestões: ${resultado.suggestions.length}`);
    
    // Mostrar todas as sugestões geradas para debug
    if (resultado.suggestions.length > 0) {
        console.log('\n🔍 TODAS AS SUGESTÕES GERADAS:');
        resultado.suggestions.forEach((sugestao, index) => {
            console.log(`\n   Sugestão ${index + 1}:`);
            console.log(`   ├─ Tipo: ${sugestao.type}`);
            console.log(`   ├─ Subtipo: ${sugestao.subtype || 'N/A'}`);
            console.log(`   ├─ Mensagem: ${sugestao.message}`);
            console.log(`   ├─ Action: ${sugestao.action || 'N/A'}`);
            console.log(`   ├─ Why: ${sugestao.why || 'N/A'}`);
            console.log(`   ├─ Ícone: ${sugestao.icon || 'N/A'}`);
            console.log(`   ├─ Target Value: ${sugestao.targetValue !== undefined ? sugestao.targetValue : 'N/A'}`);
            console.log(`   ├─ Current Value: ${sugestao.currentValue !== undefined ? sugestao.currentValue : 'N/A'}`);
            console.log(`   └─ Technical: ${JSON.stringify(sugestao.technical, null, 2)}`);
        });
    }
    
    // VERIFICAR LRA
    console.log('\n🔍 TESTE LRA:');
    const sugestoesLRA = resultado.suggestions.filter(s => 
        s.type === 'reference_lra' || 
        (s.technical && s.message && s.message.toLowerCase().includes('lra'))
    );
    
    if (sugestoesLRA.length > 0) {
        console.log('✅ LRA: SUCESSO - Sugestão gerada');
        const lraSuggestion = sugestoesLRA[0];
        console.log(`   Tipo: ${lraSuggestion.type}`);
        console.log(`   Mensagem: ${lraSuggestion.message}`);
        console.log(`   Action: ${lraSuggestion.action || 'N/A'}`);
        console.log(`   Why: ${lraSuggestion.why || 'N/A'}`);
        console.log(`   Ícone: ${lraSuggestion.icon || 'N/A'}`);
        console.log(`   Target Value: ${lraSuggestion.targetValue || 'N/A'}`);
        console.log(`   Current Value: ${lraSuggestion.currentValue || 'N/A'}`);
        console.log(`   Technical: ${JSON.stringify(lraSuggestion.technical, null, 2)}`);
    } else {
        console.log('❌ LRA: ERRO - Nenhuma sugestão gerada');
    }
    
    // VERIFICAR BANDAS ESPECTRAIS
    console.log('\n🎵 TESTE BANDAS ESPECTRAIS:');
    const sugestoesBandas = resultado.suggestions.filter(s => s.type === 'band_adjust');
    
    if (sugestoesBandas.length > 0) {
        console.log(`✅ Bandas: ${sugestoesBandas.length} sugestões geradas`);
        
        sugestoesBandas.forEach((banda, index) => {
            const temCamposObrigatorios = 
                banda.icon && 
                banda.message && 
                banda.action && 
                banda.why && 
                banda.targetValue !== undefined && 
                banda.currentValue !== undefined;
            
            console.log(`\n   Banda ${index + 1}: ${banda.subtype || 'N/A'}`);
            console.log(`   ├─ Mensagem: ${banda.message}`);
            console.log(`   ├─ Action: ${banda.action || '❌ FALTANDO'}`);
            console.log(`   ├─ Why: ${banda.why || '❌ FALTANDO'}`);
            console.log(`   ├─ Ícone: ${banda.icon || '❌ FALTANDO'}`);
            console.log(`   ├─ Target Value: ${banda.targetValue !== undefined ? banda.targetValue : '❌ FALTANDO'}`);
            console.log(`   ├─ Current Value: ${banda.currentValue !== undefined ? banda.currentValue : '❌ FALTANDO'}`);
            console.log(`   └─ Campos OK: ${temCamposObrigatorios ? '✅' : '❌'}`);
        });
        
        const bandasCompletas = sugestoesBandas.filter(b => 
            b.icon && b.action && b.why && b.targetValue !== undefined && b.currentValue !== undefined
        );
        console.log(`\n   Bandas com todos os campos: ${bandasCompletas.length}/${sugestoesBandas.length}`);
    } else {
        console.log('❌ Bandas: ERRO - Nenhuma sugestão gerada');
    }
    
    // AUDIT LOG
    if (resultado.auditLog && resultado.auditLog.length > 0) {
        // FILTRAR LOGS ESPECÍFICOS
    const logsImportantes = resultado.auditLog.filter(log => 
        log.type === 'METRIC_EXTRACTED' || 
        log.type === 'METRIC_MISSING' ||
        log.type === 'BAND_ENERGIES_DEBUG' ||
        log.type === 'BAND_METRIC_EXTRACTED' ||
        log.type === 'BANDS_INPUT' ||
        log.type === 'GENERATE_SUGGESTIONS_INPUT' ||
        log.type === 'BEFORE_GENERATE_REFERENCE' ||
        log.type === 'AFTER_GENERATE_REFERENCE' ||
        log.type === 'REFERENCE_SUGGESTIONS_GENERATED' ||
        log.type === 'METRIC_VALIDATION' ||
        log.type === 'ZSCORE_LOOKUP'
    );
    
    if (logsImportantes.length > 0) {
        console.log('\n🔍 LOGS DE EXTRAÇÃO:');
        logsImportantes.forEach((log, index) => {
            console.log(`   ${index + 1}: ${JSON.stringify(log).substring(0, 300)}...`);
        });
    } else {
        console.log('\n❌ NENHUM LOG DE EXTRAÇÃO ENCONTRADO!');
    }
        const logsRelevantes = resultado.auditLog
            .filter(entry => 
                typeof entry === 'string' && (
                    entry.includes('LRA') || 
                    entry.includes('BAND') || 
                    entry.includes('METRIC_EXTRACTED') ||
                    entry.includes('METRIC_MISSING')
                )
            )
            .slice(0, 10);
        
        logsRelevantes.forEach(log => console.log(`   ${log}`));
        
        // Mostrar também todos os logs para debug
        console.log('\n🔍 TODOS OS LOGS:');
        resultado.auditLog.slice(0, 20).forEach((log, i) => {
            console.log(`   ${i + 1}: ${typeof log === 'string' ? log : JSON.stringify(log)}`);
        });
    }
    
    // RESUMO FINAL
    console.log('\n📋 RESUMO FINAL:');
    const problemasEncontrados = [];
    const sucessos = [];
    
    if (sugestoesLRA.length > 0) {
        sucessos.push('✅ LRA: Sugestões geradas corretamente');
    } else {
        problemasEncontrados.push('❌ LRA: Nenhuma sugestão foi gerada');
    }
    
    if (sugestoesBandas.length > 0) {
        const bandasCompletas = sugestoesBandas.filter(b => 
            b.icon && b.action && b.why && b.targetValue !== undefined && b.currentValue !== undefined
        );
        if (bandasCompletas.length === sugestoesBandas.length) {
            sucessos.push(`✅ Bandas: Todas as ${sugestoesBandas.length} sugestões têm campos obrigatórios`);
        } else {
            problemasEncontrados.push(`❌ Bandas: ${sugestoesBandas.length - bandasCompletas.length} sugestões sem campos obrigatórios`);
        }
    } else {
        problemasEncontrados.push('❌ Bandas: Nenhuma sugestão foi gerada');
    }
    
    console.log('\nSuccessos:');
    sucessos.forEach(s => console.log(`   ${s}`));
    
    console.log('\nProblemas:');
    problemasEncontrados.forEach(p => console.log(`   ${p}`));
    
    if (problemasEncontrados.length === 0) {
        console.log('\n🎉 TESTE PASSOU: Todas as correções estão funcionando!');
    } else {
        console.log('\n⚠️ TESTE FALHOU: Ainda há problemas a corrigir.');
    }
    
} catch (error) {
    console.error('💥 ERRO NO TESTE:', error.message);
    console.error(error.stack);
}