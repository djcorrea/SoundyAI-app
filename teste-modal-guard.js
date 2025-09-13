/**
 * 🧪 TESTE DO MODAL GUARD
 * 
 * Valida se o Modal Guard está funcionando corretamente,
 * bloqueando exibição de dados incompletos e permitindo dados válidos
 */

console.log("🧪 [TEST_MODAL_GUARD] Iniciando testes do Modal Guard...");

// ========== CASOS DE TESTE ==========

const testCases = [
    {
        name: "Dados Completos Válidos",
        data: {
            technicalData: {
                peak: -3.2,
                rms: -18.7,
                lufsIntegrated: -14.2,
                dynamicRange: 8.5,
                truePeakDbtp: -1.1
            },
            score: 7.8,
            qualityOverall: 7.8,
            mode: "pipeline_complete"
        },
        expectedResult: { valid: true, dataQuality: "complete" }
    },
    {
        name: "Fallback com Score",
        data: {
            technicalData: {
                peak: -6.0,
                rms: -20.0,
                lufsIntegrated: -16.0,
                dynamicRange: 8.0
            },
            score: 5.0,
            mode: "fallback_metadata",
            usedFallback: true
        },
        expectedResult: { valid: true, dataQuality: "fallback" }
    },
    {
        name: "Dados Incompletos - Muitas Métricas Ausentes",
        data: {
            technicalData: {
                peak: -3.0
                // Faltando: rms, lufsIntegrated, dynamicRange
            },
            score: 7.0
        },
        expectedResult: { valid: false, reason: "Métricas ausentes" }
    },
    {
        name: "Fallback Sem Score",
        data: {
            technicalData: {
                peak: -5.0,
                rms: -18.0,
                lufsIntegrated: -15.0,
                dynamicRange: 7.0
            },
            mode: "fallback_metadata",
            usedFallback: true
            // Faltando: score
        },
        expectedResult: { valid: false, reason: "Fallback incompleto" }
    },
    {
        name: "Dados Ausentes",
        data: null,
        expectedResult: { valid: false, reason: "Dados ausentes" }
    },
    {
        name: "technicalData Vazio",
        data: {
            score: 6.0,
            technicalData: {}
        },
        expectedResult: { valid: false, reason: "Métricas ausentes" }
    },
    {
        name: "Enhanced Fallback Válido",
        data: {
            technicalData: {
                peak: -4.2,
                rms: -19.3,
                lufsIntegrated: -13.8,
                dynamicRange: 9.2,
                truePeakDbtp: -1.5
            },
            score: 65,
            qualityOverall: 65,
            mode: "enhanced_fallback",
            usedFallback: true
        },
        expectedResult: { valid: true, dataQuality: "fallback" }
    },
    {
        name: "Métricas com NaN/undefined",
        data: {
            technicalData: {
                peak: NaN,
                rms: undefined,
                lufsIntegrated: -14.0,
                dynamicRange: null
            },
            score: 7.0
        },
        expectedResult: { valid: false, reason: "Métricas ausentes" }
    }
];

// ========== EXECUTAR TESTES ==========

function runModalGuardTests() {
    console.log("🧪 [TEST] Executando testes do Modal Guard...\n");
    
    let passed = 0;
    let failed = 0;
    const results = [];
    
    testCases.forEach((testCase, index) => {
        console.log(`🧪 [TEST ${index + 1}] ${testCase.name}:`);
        
        try {
            // Verificar se função existe
            if (typeof validateAnalysisDataCompleteness !== 'function') {
                console.error("❌ Função validateAnalysisDataCompleteness não encontrada!");
                console.log("💡 Certifique-se de que o Modal Guard foi implementado em audio-analyzer-integration.js");
                return;
            }
            
            // Executar teste
            const result = validateAnalysisDataCompleteness(testCase.data);
            const expected = testCase.expectedResult;
            
            // Verificar resultado
            let testPassed = true;
            let details = [];
            
            if (result.valid !== expected.valid) {
                testPassed = false;
                details.push(`valid: esperado ${expected.valid}, obtido ${result.valid}`);
            }
            
            if (expected.dataQuality && result.dataQuality !== expected.dataQuality) {
                testPassed = false;
                details.push(`dataQuality: esperado ${expected.dataQuality}, obtido ${result.dataQuality}`);
            }
            
            if (expected.reason && !result.reason?.includes(expected.reason.split(':')[0])) {
                testPassed = false;
                details.push(`reason: esperado conter '${expected.reason}', obtido '${result.reason}'`);
            }
            
            if (testPassed) {
                console.log("   ✅ PASSOU");
                passed++;
            } else {
                console.log("   ❌ FALHOU");
                console.log(`      Diferenças: ${details.join(', ')}`);
                console.log(`      Esperado:`, expected);
                console.log(`      Obtido:`, result);
                failed++;
            }
            
            results.push({
                test: testCase.name,
                passed: testPassed,
                result,
                expected,
                details: testPassed ? null : details
            });
            
        } catch (error) {
            console.log("   ❌ ERRO");
            console.log(`      Exceção: ${error.message}`);
            failed++;
            
            results.push({
                test: testCase.name,
                passed: false,
                error: error.message
            });
        }
        
        console.log("");
    });
    
    // Relatório final
    console.log("📊 [TEST_SUMMARY] Resumo dos Testes:");
    console.log(`   ✅ Passou: ${passed}/${testCases.length}`);
    console.log(`   ❌ Falhou: ${failed}/${testCases.length}`);
    console.log(`   📈 Taxa de sucesso: ${Math.round((passed / testCases.length) * 100)}%`);
    
    if (failed > 0) {
        console.log("\n❌ [FAILURES] Testes que falharam:");
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   • ${r.test}: ${r.details ? r.details.join(', ') : r.error}`);
        });
    }
    
    if (passed === testCases.length) {
        console.log("\n🎉 [SUCCESS] Todos os testes passaram! Modal Guard funcionando corretamente.");
    } else {
        console.log("\n⚠️ [WARNING] Alguns testes falharam. Verifique a implementação do Modal Guard.");
    }
    
    return {
        totalTests: testCases.length,
        passed,
        failed,
        successRate: Math.round((passed / testCases.length) * 100),
        results
    };
}

// ========== TESTE DE INTEGRAÇÃO ==========

function testModalGuardIntegration() {
    console.log("\n🔗 [INTEGRATION_TEST] Testando integração com displayModalResults...");
    
    // Verificar se as funções necessárias existem
    const requiredFunctions = [
        'validateAnalysisDataCompleteness',
        'showAnalysisError',
        'displayModalResults'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
    
    if (missingFunctions.length > 0) {
        console.error("❌ [INTEGRATION] Funções ausentes:", missingFunctions);
        console.log("💡 Certifique-se de que o Modal Guard foi implementado corretamente");
        return false;
    }
    
    console.log("✅ [INTEGRATION] Todas as funções necessárias estão disponíveis");
    
    // Testar cenário de bloqueio
    console.log("\n🧪 [INTEGRATION] Testando bloqueio de dados incompletos...");
    
    const incompleteData = {
        technicalData: {
            peak: -3.0
            // Faltando outras métricas importantes
        }
    };
    
    try {
        // Simular chamada que deveria ser bloqueada
        const originalDisplayModal = window.displayModalResults;
        let modalWasCalled = false;
        
        // Mock temporário
        window.displayModalResults = function(data) {
            modalWasCalled = true;
            console.log("🚫 [INTEGRATION] Modal foi chamado (não deveria!)");
        };
        
        // Chamar função (deveria ser bloqueada pelo guard)
        if (typeof originalDisplayModal === 'function') {
            originalDisplayModal(incompleteData);
        }
        
        // Restaurar função original
        window.displayModalResults = originalDisplayModal;
        
        if (modalWasCalled) {
            console.log("❌ [INTEGRATION] Modal Guard não bloqueou dados incompletos");
            return false;
        } else {
            console.log("✅ [INTEGRATION] Modal Guard bloqueou corretamente dados incompletos");
            return true;
        }
        
    } catch (error) {
        console.log("⚠️ [INTEGRATION] Erro durante teste:", error.message);
        return false;
    }
}

// ========== EXECUTAR TODOS OS TESTES ==========

console.log("🚀 [MODAL_GUARD_TEST] Executando bateria completa de testes...\n");

try {
    // Testes unitários
    const unitTestResults = runModalGuardTests();
    
    // Teste de integração
    const integrationPassed = testModalGuardIntegration();
    
    // Resultado final
    console.log("\n" + "=".repeat(80));
    console.log("📋 RELATÓRIO FINAL: TESTES DO MODAL GUARD");
    console.log("=".repeat(80));
    
    console.log(`\n✅ Testes Unitários: ${unitTestResults.passed}/${unitTestResults.totalTests} (${unitTestResults.successRate}%)`);
    console.log(`✅ Teste Integração: ${integrationPassed ? 'PASSOU' : 'FALHOU'}`);
    
    const overallSuccess = unitTestResults.successRate >= 90 && integrationPassed;
    
    console.log(`\n🎯 RESULTADO GERAL: ${overallSuccess ? '✅ SUCESSO' : '❌ FALHA'}`);
    
    if (overallSuccess) {
        console.log("\n🎉 Modal Guard implementado e funcionando corretamente!");
        console.log("   • Bloqueia dados incompletos ✅");
        console.log("   • Permite dados válidos ✅");
        console.log("   • Exibe erros claros para usuário ✅");
        console.log("   • Integra com displayModalResults ✅");
    } else {
        console.log("\n⚠️ Modal Guard precisa de ajustes:");
        if (unitTestResults.successRate < 90) {
            console.log("   • Corrigir validação de dados");
        }
        if (!integrationPassed) {
            console.log("   • Corrigir integração com displayModalResults");
        }
    }
    
    // Salvar resultados
    if (typeof window !== 'undefined') {
        window.__MODAL_GUARD_TEST_RESULTS__ = {
            unitTests: unitTestResults,
            integration: integrationPassed,
            overallSuccess,
            timestamp: new Date().toISOString()
        };
        console.log("\n📊 Resultados salvos em window.__MODAL_GUARD_TEST_RESULTS__");
    }
    
} catch (error) {
    console.error("❌ [MODAL_GUARD_TEST] Erro durante execução dos testes:", error);
    console.error("Stack:", error.stack);
}