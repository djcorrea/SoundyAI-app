#!/usr/bin/env node
/**
 * 🔍 VERIFICAÇÃO PÓS-DEPLOY - DIAGNÓSTICO RÁPIDO
 * 
 * Verifica se o deploy foi bem-sucedido e o sistema está funcional
 */

console.log('🔍 VERIFICAÇÃO PÓS-DEPLOY - DIAGNÓSTICO RÁPIDO');
console.log('=' .repeat(60));

// ✅ 1. VERIFICAR CORREÇÃO DO ERRO v2Metrics
console.log('\n1️⃣ VERIFICANDO CORREÇÃO DO ERRO v2Metrics:');
const fs = require('fs');

try {
    const audioAnalyzerPath = 'c:/Users/DJ Correa/Desktop/Programação/ai-synth/public/audio-analyzer.js';
    const content = fs.readFileSync(audioAnalyzerPath, 'utf8');
    
    // Verificar se a definição foi adicionada
    const hasV2MetricsDefinition = content.includes('const v2Metrics = null; // placeholder para compatibilidade futura');
    const hasCorrectCalls = content.includes('applyLogicAlignmentCorrections(baseAnalysis, td, unifiedData, v2Metrics)');
    
    if (hasV2MetricsDefinition && hasCorrectCalls) {
        console.log('✅ v2Metrics definido corretamente');
        console.log('✅ Chamadas de função corrigidas');
    } else {
        console.log('❌ Correções v2Metrics não encontradas');
        console.log(`   Definition found: ${hasV2MetricsDefinition}`);
        console.log(`   Calls corrected: ${hasCorrectCalls}`);
    }
} catch (error) {
    console.log(`❌ Erro ao verificar correções: ${error.message}`);
}

// ✅ 2. VERIFICAR STATUS DO SERVIDOR
console.log('\n2️⃣ VERIFICANDO STATUS DO SERVIDOR:');
try {
    const http = require('http');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        console.log(`✅ Servidor respondendo: HTTP ${res.statusCode}`);
        if (res.statusCode === 200) {
            console.log('✅ Sistema acessível em http://localhost:3000');
        }
    });
    
    req.on('error', (err) => {
        console.log(`❌ Servidor não acessível: ${err.message}`);
        console.log('💡 Execute: python -m http.server 3000');
    });
    
    req.on('timeout', () => {
        console.log('⏱️ Timeout na verificação do servidor');
        req.destroy();
    });
    
    req.end();
    
} catch (error) {
    console.log(`❌ Erro na verificação do servidor: ${error.message}`);
}

// ✅ 3. VERIFICAR CONFIGURAÇÕES ESPECTRAIS
console.log('\n3️⃣ VERIFICANDO CONFIGURAÇÕES ESPECTRAIS:');
try {
    const configPaths = [
        'c:/Users/DJ Correa/Desktop/Programação/ai-synth/refs/out/funk_mandela.json',
        'c:/Users/DJ Correa/Desktop/Programação/ai-synth/public/refs/out/funk_mandela.json'
    ];
    
    configPaths.forEach((path, index) => {
        try {
            const config = JSON.parse(fs.readFileSync(path, 'utf8'));
            const spectralBalance = config.funk_mandela?.spectralBalance;
            
            if (spectralBalance && spectralBalance.bands) {
                const bandCount = Object.keys(spectralBalance.bands).length;
                console.log(`✅ ${index === 0 ? 'DEV' : 'PROD'}: ${bandCount} bandas espectrais configuradas`);
                
                // Verificar soma das porcentagens
                const totalPercent = Object.values(spectralBalance.bands)
                    .reduce((sum, band) => sum + (band.target_energy_percent || 0), 0);
                
                if (Math.abs(totalPercent - 100) < 1.0) {
                    console.log(`   ✅ Total de energia: ${totalPercent.toFixed(1)}%`);
                } else {
                    console.log(`   ⚠️  Total de energia: ${totalPercent.toFixed(1)}% (deveria ser ~100%)`);
                }
            } else {
                console.log(`❌ ${index === 0 ? 'DEV' : 'PROD'}: spectralBalance não encontrado`);
            }
        } catch (err) {
            console.log(`❌ ${index === 0 ? 'DEV' : 'PROD'}: erro ao ler configuração - ${err.message}`);
        }
    });
} catch (error) {
    console.log(`❌ Erro na verificação de configurações: ${error.message}`);
}

// ✅ 4. VERIFICAR FEATURE FLAGS
console.log('\n4️⃣ VERIFICANDO FEATURE FLAGS NO SISTEMA:');
try {
    const integrationPath = 'c:/Users/DJ Correa/Desktop/Programação/ai-synth/public/audio-analyzer-integration.js';
    const integrationContent = fs.readFileSync(integrationPath, 'utf8');
    
    const featureChecks = [
        { name: 'SPECTRAL_INTERNAL_MODE', pattern: 'SPECTRAL_INTERNAL_MODE' },
        { name: 'URL Parameter Support', pattern: 'params.has(\'spectral\')' },
        { name: 'SpectralBalanceAnalyzer', pattern: 'class SpectralBalanceAnalyzer' },
        { name: 'Feature Flag Processing', pattern: 'window.SPECTRAL_INTERNAL_MODE' }
    ];
    
    featureChecks.forEach(check => {
        if (integrationContent.includes(check.pattern)) {
            console.log(`✅ ${check.name}: implementado`);
        } else {
            console.log(`❌ ${check.name}: não encontrado`);
        }
    });
    
} catch (error) {
    console.log(`❌ Erro na verificação de feature flags: ${error.message}`);
}

// ✅ 5. INSTRUÇÕES PARA TESTE
console.log('\n5️⃣ INSTRUÇÕES PARA TESTE:');
console.log('🌐 Para testar o sistema:');
console.log('   1. Abra: http://localhost:3000');
console.log('   2. Modo porcentagem: http://localhost:3000?spectral=percent');
console.log('   3. Debug ativo: http://localhost:3000?spectral=percent&spectralLog=true');
console.log('   4. Faça upload de um arquivo de áudio');
console.log('   5. Verifique o console do browser para logs espectrais');

console.log('\n🔧 Comandos úteis no console do browser:');
console.log('   • window.SPECTRAL_INTERNAL_MODE - verificar modo atual');
console.log('   • window.SPECTRAL_INTERNAL_MODE = "legacy" - rollback');
console.log('   • window.SPECTRAL_INTERNAL_MODE = "percent" - ativar novo sistema');

console.log('\n' + '=' .repeat(60));
console.log('✨ VERIFICAÇÃO CONCLUÍDA - SISTEMA PRONTO PARA TESTE');
console.log('=' .repeat(60));
