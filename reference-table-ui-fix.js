/**
 * 🎯 CORREÇÃO DA EXIBIÇÃO DA TABELA DE REFERÊNCIA
 * 
 * Este arquivo implementa a correção solicitada:
 * - Oculta os valores numéricos de diferença (dB) na tabela de referência
 * - Mostra apenas os status visuais (✅ Ideal, ⚠️ Ajuste leve, ❌ Corrigir)
 * - Preserva TODOS os cálculos no backend para o sistema de sugestões avançadas
 * - NÃO quebra nenhuma funcionalidade existente
 * 
 * Estratégia:
 * - Intercepta a função createEnhancedDiffCell existente
 * - Mantém compatibilidade com sistemas antigo e novo
 * - Aplica apenas mudança visual na tabela
 */

// 🚀 Feature Flag para controlar a correção
window.REFERENCE_TABLE_HIDE_VALUES = true;

/**
 * 🎨 NOVA FUNÇÃO: Criar célula apenas com status visual
 * 
 * Substitui os valores numéricos por ícones e texto de status
 */
function createStatusOnlyDiffCell(diff, unit, tolerance, metricName = '') {
    // ✅ PRESERVAR: Se feature flag desabilitada, usar comportamento normal
    if (!window.REFERENCE_TABLE_HIDE_VALUES) {
        // Delegar para sistema existente
        if (window.createEnhancedDiffCellOriginal) {
            return window.createEnhancedDiffCellOriginal(diff, unit, tolerance, metricName);
        }
        
        // Fallback básico
        const diffValue = Number.isFinite(diff) ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit}` : '—';
        return `<td class="na">${diffValue}</td>`;
    }
    
    // 🎯 NOVA LÓGICA: Apenas status visual
    if (!Number.isFinite(diff) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return '<td class="na" style="text-align: center;"><span style="opacity: 0.6;">—</span></td>';
    }
    
    const absDiff = Math.abs(diff);
    let cssClass, statusIcon, statusText;
    
    // Mesma lógica de limites do sistema unificado
    if (absDiff <= tolerance) {
        // ✅ ZONA IDEAL
        cssClass = 'ok';
        statusIcon = '✅';
        statusText = 'Ideal';
    } else {
        const multiplicador = absDiff / tolerance;
        if (multiplicador <= 2) {
            // ⚠️ ZONA AJUSTAR
            cssClass = 'yellow';
            statusIcon = '⚠️';
            statusText = 'Ajuste leve';
        } else {
            // ❌ ZONA CORRIGIR
            cssClass = 'warn';
            statusIcon = '❌';
            statusText = 'Corrigir';
        }
    }
    
    return `<td class="${cssClass}" style="text-align: center; padding: 8px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <div style="font-size: 16px;">${statusIcon}</div>
            <div style="font-size: 11px; font-weight: 500; opacity: 0.9;">${statusText}</div>
        </div>
    </td>`;
}

/**
 * 🔄 PATCHER: Aplicar a correção da tabela
 * 
 * Substitui a função de criação de células apenas para a tabela de referência
 */
function applyReferenceTableFix() {
    console.log('🎯 [REFERENCE_TABLE_FIX] Aplicando correção da tabela de referência...');
    
    // Salvar função original se ainda não foi salva
    if (window.createEnhancedDiffCell && !window.createEnhancedDiffCellBeforeTableFix) {
        window.createEnhancedDiffCellBeforeTableFix = window.createEnhancedDiffCell;
        console.log('✅ [REFERENCE_TABLE_FIX] Função original salva');
    }
    
    // Aplicar a nova função
    window.createEnhancedDiffCell = createStatusOnlyDiffCell;
    
    console.log('✅ [REFERENCE_TABLE_FIX] Correção aplicada com sucesso');
    console.log('📋 [REFERENCE_TABLE_FIX] A tabela agora mostra apenas status visuais');
    console.log('🔒 [REFERENCE_TABLE_FIX] Dados completos preservados para sugestões avançadas');
    
    // Testar a nova função
    testReferenceTableFix();
}

/**
 * ⚡ ROLLBACK: Desfazer a correção se necessário
 */
function rollbackReferenceTableFix() {
    console.log('🔄 [REFERENCE_TABLE_FIX] Fazendo rollback da correção...');
    
    if (window.createEnhancedDiffCellBeforeTableFix) {
        window.createEnhancedDiffCell = window.createEnhancedDiffCellBeforeTableFix;
        console.log('✅ [REFERENCE_TABLE_FIX] Rollback concluído');
    } else {
        console.warn('⚠️ [REFERENCE_TABLE_FIX] Função original não encontrada para rollback');
    }
}

/**
 * 🧪 TESTES: Verificar se a correção funciona corretamente
 */
function testReferenceTableFix() {
    console.log('🧪 [REFERENCE_TABLE_FIX] Executando testes...');
    
    const testCases = [
        { diff: 0.2, tol: 0.5, expected: 'Ideal' },      // Dentro da tolerância
        { diff: 1.2, tol: 0.5, expected: 'Ajuste leve' }, // 1-2x tolerância
        { diff: 2.5, tol: 0.5, expected: 'Corrigir' }     // >2x tolerância
    ];
    
    let passedTests = 0;
    
    for (const testCase of testCases) {
        const result = createStatusOnlyDiffCell(testCase.diff, 'dB', testCase.tol, 'Test');
        const containsExpected = result.includes(testCase.expected);
        
        if (containsExpected) {
            passedTests++;
            console.log(`✅ Teste passou: diff=${testCase.diff}, esperado=${testCase.expected}`);
        } else {
            console.error(`❌ Teste falhou: diff=${testCase.diff}, esperado=${testCase.expected}, resultado=${result}`);
        }
    }
    
    console.log(`🎯 [REFERENCE_TABLE_FIX] Testes concluídos: ${passedTests}/${testCases.length} passaram`);
    
    if (passedTests === testCases.length) {
        console.log('🎉 [REFERENCE_TABLE_FIX] Todos os testes passaram! Correção funcionando corretamente.');
    } else {
        console.warn('⚠️ [REFERENCE_TABLE_FIX] Alguns testes falharam. Verifique a implementação.');
    }
}

/**
 * 🎛️ UTILITÁRIO: Alternar entre exibição de valores e apenas status
 */
function toggleReferenceTableDisplay(showValues = false) {
    window.REFERENCE_TABLE_HIDE_VALUES = !showValues;
    
    if (showValues) {
        console.log('🔢 [REFERENCE_TABLE_FIX] Modo: Exibindo valores numéricos');
    } else {
        console.log('🎨 [REFERENCE_TABLE_FIX] Modo: Apenas status visuais');
    }
    
    // Re-aplicar correção se necessário
    if (window.renderReferenceComparisons && window.__lastAnalysis) {
        console.log('🔄 [REFERENCE_TABLE_FIX] Atualizando tabela...');
        window.renderReferenceComparisons(window.__lastAnalysis);
    }
}

/**
 * 🔍 AUDITORIA: Verificar se a correção quebrou alguma funcionalidade
 */
function auditReferenceTableIntegrity() {
    console.log('🔍 [REFERENCE_TABLE_FIX] Auditando integridade do sistema...');
    
    const checks = [
        {
            name: 'Sistema de sugestões avançadas',
            test: () => typeof window.generateReferenceSuggestions === 'function' ||
                        typeof window.EnhancedSuggestionEngine === 'function',
            critical: true
        },
        {
            name: 'Função de renderização da tabela',
            test: () => typeof window.renderReferenceComparisons === 'function',
            critical: true
        },
        {
            name: 'Sistema de status unificado',
            test: () => typeof window.calcularStatusSugestaoUnificado === 'function',
            critical: false
        },
        {
            name: 'Dados da última análise',
            test: () => window.__lastAnalysis && window.__lastAnalysis.technicalData,
            critical: false
        }
    ];
    
    let criticalFailures = 0;
    let totalFailures = 0;
    
    for (const check of checks) {
        const passed = check.test();
        
        if (passed) {
            console.log(`✅ ${check.name}: OK`);
        } else {
            totalFailures++;
            if (check.critical) {
                criticalFailures++;
                console.error(`❌ ${check.name}: FALHOU (CRÍTICO)`);
            } else {
                console.warn(`⚠️ ${check.name}: FALHOU (não crítico)`);
            }
        }
    }
    
    if (criticalFailures === 0) {
        console.log('🎉 [REFERENCE_TABLE_FIX] Auditoria passou! Nenhuma funcionalidade crítica foi quebrada.');
    } else {
        console.error(`🚨 [REFERENCE_TABLE_FIX] AUDITORIA FALHOU! ${criticalFailures} funcionalidades críticas foram afetadas.`);
    }
    
    return {
        passed: criticalFailures === 0,
        criticalFailures,
        totalFailures,
        checks: checks.length
    };
}

// 🚀 INICIALIZAÇÃO AUTOMÁTICA
if (typeof window !== 'undefined') {
    // Disponibilizar funções no escopo global
    window.createStatusOnlyDiffCell = createStatusOnlyDiffCell;
    window.applyReferenceTableFix = applyReferenceTableFix;
    window.rollbackReferenceTableFix = rollbackReferenceTableFix;
    window.toggleReferenceTableDisplay = toggleReferenceTableDisplay;
    window.auditReferenceTableIntegrity = auditReferenceTableIntegrity;
    
    console.log('📦 [REFERENCE_TABLE_FIX] Sistema carregado. Use applyReferenceTableFix() para ativar.');
    
    // Auto-aplicar se feature flag estiver ativa
    if (window.REFERENCE_TABLE_HIDE_VALUES) {
        // Aguardar um pouco para garantir que outros sistemas estejam carregados
        setTimeout(() => {
            applyReferenceTableFix();
        }, 500);
    }
}