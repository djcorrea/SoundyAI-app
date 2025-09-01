/**
 * 🔄 MIGRAÇÃO GRADUAL PARA SISTEMA UNIFICADO
 * 
 * Substitui implementações fragmentadas por chamadas ao sistema unificado
 * Rollout controlado via feature flag STATUS_SUGGESTION_UNIFIED_V1
 * 
 * Estratégia: Wrapper functions que detectam flag e delegam adequadamente
 */

/**
 * 🎯 MIGRAÇÃO: createEnhancedDiffCell -> Sistema Unificado
 * 
 * Mantém compatibilidade com assinatura existente
 */
function createEnhancedDiffCellMigrado(diff, unit, tolerance, metricName = '') {
    // Se flag ativa e sistema disponível, usar unificado
    if (window.STATUS_SUGGESTION_UNIFIED_V1 && window.criarCelulaDiferenca) {
        // Converter diff para valor/alvo (assumindo alvo = 0 para diferenças)
        const alvo = 0;
        const valor = diff;
        return window.criarCelulaDiferenca(valor, alvo, tolerance, unit, metricName);
    }
    
    // Fallback para sistema legacy
    let cssClass = 'na';
    let statusText = '';
    let suggestion = '';
    
    if (Number.isFinite(diff) && Number.isFinite(tolerance) && tolerance > 0) {
        const absDiff = Math.abs(diff);
        
        if (absDiff <= tolerance) {
            cssClass = 'ok';
            statusText = '✅ IDEAL';
            suggestion = ''; // NUNCA sugestão se ideal
        } else {
            const n = absDiff / tolerance;
            if (n <= 2) {
                cssClass = 'yellow';
                statusText = '⚠️ AJUSTAR';
                suggestion = diff > 0 ? '↓ DIMINUIR' : '↑ AUMENTAR';
            } else {
                cssClass = 'warn';
                statusText = '🚨 CORRIGIR';
                suggestion = diff > 0 ? '↓↓ REDUZIR' : '↑↑ ELEVAR';
            }
        }
    }
    
    const diffValue = Number.isFinite(diff) ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit}` : '—';
    
    return `<td class="${cssClass}">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 12px; font-weight: 600;">${diffValue}</div>
            <div style="font-size: 10px; opacity: 0.8;">${statusText}</div>
            ${suggestion ? `<div style="font-size: 9px; color: #666;">${suggestion}</div>` : ''}
        </div>
    </td>`;
}

/**
 * 🎯 MIGRAÇÃO: Status determination logic scattered across files
 * 
 * Função centralizadora para determinar status baseado em valor/alvo/tolerância
 */
function determineStatusMigrado(value, target, tolerance) {
    // Se flag ativa, usar sistema unificado
    if (window.STATUS_SUGGESTION_UNIFIED_V1 && window.calcularStatusSugestaoUnificado) {
        const resultado = window.calcularStatusSugestaoUnificado(value, target, tolerance);
        return {
            status: resultado.status.toUpperCase(), // Compatibilidade com IDEAL/AJUSTAR/CORRIGIR
            cssClass: resultado.cor,
            suggestion: resultado.sugestao ? resultado.sugestao.texto : '',
            visual: window.obterVisualizacaoStatus(resultado.status)
        };
    }
    
    // Fallback para lógica legacy
    if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return { status: 'INDEFINIDO', cssClass: 'na', suggestion: '', visual: null };
    }
    
    const diff = value - target;
    const absDiff = Math.abs(diff);
    
    if (absDiff <= tolerance) {
        return {
            status: 'IDEAL',
            cssClass: 'ok', 
            suggestion: '',
            visual: { icone: '✅', texto: 'IDEAL' }
        };
    }
    
    const n = absDiff / tolerance;
    if (n <= 2) {
        return {
            status: 'AJUSTAR',
            cssClass: 'yellow',
            suggestion: diff > 0 ? 'DIMINUIR' : 'AUMENTAR',
            visual: { icone: '⚠️', texto: 'AJUSTAR' }
        };
    }
    
    return {
        status: 'CORRIGIR',
        cssClass: 'warn',
        suggestion: diff > 0 ? 'REDUZIR' : 'ELEVAR',
        visual: { icone: '🚨', texto: 'CORRIGIR' }
    };
}

/**
 * 🎯 MIGRAÇÃO: Problem counter logic
 * 
 * Unifica contagem de problemas (valores fora do ideal)
 */
function countProblemsMigrado(metrics) {
    // Se flag ativa, usar sistema unificado
    if (window.STATUS_SUGGESTION_UNIFIED_V1 && window.contarProblemasUnificado) {
        return window.contarProblemasUnificado(metrics);
    }
    
    // Fallback para lógica legacy
    let problems = 0;
    const details = [];
    
    for (const metric of metrics) {
        const { value, target, tolerance, name } = metric;
        const status = determineStatusMigrado(value, target, tolerance);
        
        if (status.status !== 'IDEAL') {
            problems++;
            details.push({
                name,
                status: status.status,
                difference: value - target,
                suggestion: status.suggestion
            });
        }
    }
    
    return { total: problems, details };
}

/**
 * 🔄 PATCHER: Substitui implementações existentes
 * 
 * Aplica migration wrappers sobre funções existentes
 */
function applyUnifiedSystemPatches() {
    if (!window.STATUS_SUGGESTION_UNIFIED_V1) {
        console.log('[MIGRATION] Feature flag desabilitada, patches não aplicados');
        return;
    }
    
    // Patch createEnhancedDiffCell se existir
    if (window.createEnhancedDiffCell) {
        window.createEnhancedDiffCellOriginal = window.createEnhancedDiffCell;
        window.createEnhancedDiffCell = createEnhancedDiffCellMigrado;
        console.log('[MIGRATION] ✅ createEnhancedDiffCell migrado');
    }
    
    // Disponibilizar funções de migração
    window.determineStatusMigrado = determineStatusMigrado;
    window.countProblemsMigrado = countProblemsMigrado;
    
    console.log('[MIGRATION] Sistema de migração aplicado');
}

/**
 * 🧪 TESTES DE MIGRAÇÃO
 * 
 * Verifica se migration mantém compatibilidade
 */
function testMigrationCompatibility() {
    console.log('[MIGRATION] Testando compatibilidade...');
    
    const testCases = [
        // Teste createEnhancedDiffCell compatibility
        {
            name: 'createEnhancedDiffCell - ideal',
            input: [0.2, 'dB', 0.5],
            expectContains: ['ok', 'IDEAL']
        },
        {
            name: 'createEnhancedDiffCell - ajustar',
            input: [1.2, 'dB', 0.5],  
            expectContains: ['yellow', 'AJUSTAR']
        },
        
        // Teste determineStatus compatibility
        {
            name: 'determineStatus - ideal',
            input: [-14.0, -14, 1],
            expect: { status: 'IDEAL', cssClass: 'ok' }
        },
        {
            name: 'determineStatus - corrigir',
            input: [-17.0, -14, 1],
            expect: { status: 'CORRIGIR', cssClass: 'warn' }
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of testCases) {
        try {
            if (test.name.includes('createEnhancedDiffCell')) {
                const result = createEnhancedDiffCellMigrado(...test.input);
                const allFound = test.expectContains.every(expected => 
                    result.includes(expected)
                );
                
                if (allFound) {
                    passed++;
                    console.log(`✅ ${test.name}: PASSOU`);
                } else {
                    failed++;
                    console.error(`❌ ${test.name}: FALHOU - resultado não contém elementos esperados`);
                }
                
            } else if (test.name.includes('determineStatus')) {
                const result = determineStatusMigrado(...test.input);
                const statusOk = result.status === test.expect.status;
                const classOk = result.cssClass === test.expect.cssClass;
                
                if (statusOk && classOk) {
                    passed++;
                    console.log(`✅ ${test.name}: PASSOU`);
                } else {
                    failed++;
                    console.error(`❌ ${test.name}: FALHOU`, { expected: test.expect, got: result });
                }
            }
        } catch (error) {
            failed++;
            console.error(`❌ ${test.name}: ERRO`, error);
        }
    }
    
    console.log(`[MIGRATION] Testes concluídos: ${passed} passou, ${failed} falhou`);
    return { passed, failed, total: testCases.length };
}

/**
 * 🚀 ROLLOUT HELPER
 * 
 * Ativa/desativa feature flag com validação
 */
function toggleUnifiedSystem(enable = true) {
    const wasEnabled = window.STATUS_SUGGESTION_UNIFIED_V1;
    window.STATUS_SUGGESTION_UNIFIED_V1 = enable;
    
    if (enable && !wasEnabled) {
        // Ativando sistema
        if (window.calcularStatusSugestaoUnificado) {
            applyUnifiedSystemPatches();
            console.log('🚀 [ROLLOUT] Sistema unificado ATIVADO');
            
            // Auto-teste
            const testResult = testMigrationCompatibility();
            if (testResult.failed > 0) {
                console.warn('⚠️ [ROLLOUT] Alguns testes falharam, considere revisar');
            }
        } else {
            console.error('❌ [ROLLOUT] Sistema unificado não carregado, não é possível ativar');
            window.STATUS_SUGGESTION_UNIFIED_V1 = false;
        }
        
    } else if (!enable && wasEnabled) {
        // Desativando sistema
        if (window.createEnhancedDiffCellOriginal) {
            window.createEnhancedDiffCell = window.createEnhancedDiffCellOriginal;
        }
        console.log('🔄 [ROLLOUT] Sistema unificado DESATIVADO (rollback para legacy)');
    }
    
    return window.STATUS_SUGGESTION_UNIFIED_V1;
}

// 🚀 INICIALIZAÇÃO
if (typeof window !== 'undefined') {
    window.applyUnifiedSystemPatches = applyUnifiedSystemPatches;
    window.testMigrationCompatibility = testMigrationCompatibility;
    window.toggleUnifiedSystem = toggleUnifiedSystem;
    window.createEnhancedDiffCellMigrado = createEnhancedDiffCellMigrado;
    window.determineStatusMigrado = determineStatusMigrado;
    window.countProblemsMigrado = countProblemsMigrado;
    
    console.log('[MIGRATION] Sistema de migração carregado');
    
    // Auto-aplicar patches se flag estiver ativa (ATIVAÇÃO AUTOMÁTICA)
    setTimeout(() => {
        if (window.STATUS_SUGGESTION_UNIFIED_V1) {
            applyUnifiedSystemPatches();
            console.log('🚀 [AUTO-INIT] Sistema unificado aplicado automaticamente');
        }
    }, 100);
}
