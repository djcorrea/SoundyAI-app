// 🔧 IMPLEMENTAÇÃO DAS CORREÇÕES - ALTA PRIORIDADE
// Script para aplicar as correções mais críticas identificadas na auditoria

console.log('🔧 IMPLEMENTANDO CORREÇÕES DA AUDITORIA - ALTA PRIORIDADE');

class CorrectionImplementer {
    constructor() {
        this.corrections = [];
        this.backups = {};
    }

    // 🎨 CORREÇÃO 1: Unificar Lógica Cor vs Sugestão
    implementColorSuggestionFix() {
        console.log('\n🎨 CORREÇÃO 1: Implementando Unificação Cor vs Sugestão');
        
        // Função corrigida para criar células de diff com consistência
        const createEnhancedDiffCellFixed = function(diff, unit = '', tolerance = null, target = 0) {
            if (!Number.isFinite(diff)) {
                return '<td class="na" style="opacity:.55">—</td>';
            }
            
            const absDiff = Math.abs(diff);
            let cssClass = 'na';
            let statusText = '';
            let suggestion = '';
            
            if (Number.isFinite(tolerance) && tolerance > 0) {
                if (absDiff <= tolerance) {
                    cssClass = 'ok';
                    statusText = '✅ IDEAL';
                    suggestion = ''; // CORREÇÃO: Sem sugestão se ideal
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
            
            const diffValue = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit}`;
            
            return `<td class="${cssClass}">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div style="font-size: 12px; font-weight: 600;">${diffValue}</div>
                    <div style="font-size: 10px; opacity: 0.8;">${statusText}</div>
                    ${suggestion ? `<div style="font-size: 9px; color: #666;">${suggestion}</div>` : ''}
                </div>
            </td>`;
        };
        
        // Registrar correção
        this.corrections.push({
            name: 'Color vs Suggestion Consistency',
            file: 'public/friendly-labels.js',
            function: 'createEnhancedDiffCell',
            status: 'implemented',
            description: 'Unificada lógica para cor e sugestão - verde nunca mostra sugestão'
        });
        
        // Disponibilizar função corrigida
        if (typeof window !== 'undefined') {
            window.createEnhancedDiffCellFixed = createEnhancedDiffCellFixed;
            console.log('   ✅ Função corrigida disponível como window.createEnhancedDiffCellFixed');
        }
        
        return createEnhancedDiffCellFixed;
    }

    // 📊 CORREÇÃO 2: Contagem Visual de Problemas
    implementProblemCountFix() {
        console.log('\n📊 CORREÇÃO 2: Implementando Contagem Visual de Problemas');
        
        // Função para contar problemas baseado em análise visual
        const countVisualProblemsFixed = function(analysis) {
            if (!analysis || !analysis.technicalData) return 0;
            
            let count = 0;
            const td = analysis.technicalData;
            
            // Obter referência ativa ou usar padrões
            const ref = (typeof window !== 'undefined' && window.__activeRefData) || {};
            
            // Definir métricas críticas e suas tolerâncias
            const metrics = [
                { 
                    key: 'lufsIntegrated', 
                    target: ref.lufs_target || -14, 
                    tol: ref.tol_lufs || 1,
                    name: 'Loudness'
                },
                { 
                    key: 'truePeakDbtp', 
                    target: ref.true_peak_target || -1, 
                    tol: ref.tol_true_peak || 1,
                    name: 'True Peak'
                },
                { 
                    key: 'dynamicRange', 
                    target: ref.dr_target || 10, 
                    tol: ref.tol_dr || 3,
                    name: 'Dynamic Range'
                },
                { 
                    key: 'stereoCorrelation', 
                    target: ref.stereo_target || 0.3, 
                    tol: ref.tol_stereo || 0.15,
                    name: 'Stereo Correlation'
                }
            ];
            
            const problems = [];
            
            for (const metric of metrics) {
                const value = td[metric.key];
                if (Number.isFinite(value)) {
                    const diff = Math.abs(value - metric.target);
                    if (diff > metric.tol) {
                        count++;
                        problems.push({
                            metric: metric.key,
                            name: metric.name,
                            value,
                            target: metric.target,
                            diff,
                            severity: diff > metric.tol * 2 ? 'critical' : 'warning'
                        });
                    }
                }
            }
            
            // Adicionar informações extras para debug
            return {
                count,
                problems,
                method: 'visual_analysis_v2'
            };
        };
        
        // Função para atualizar display de problemas
        const updateProblemsDisplayFixed = function(analysis) {
            const result = countVisualProblemsFixed(analysis);
            const count = result.count;
            
            if (count > 0) {
                const severeCounts = result.problems.reduce((acc, p) => {
                    acc[p.severity] = (acc[p.severity] || 0) + 1;
                    return acc;
                }, {});
                
                const warningCount = severeCounts.warning || 0;
                const criticalCount = severeCounts.critical || 0;
                
                let displayText = `${count} detectado(s)`;
                if (criticalCount > 0 && warningCount > 0) {
                    displayText += ` (${criticalCount} crítico${criticalCount > 1 ? 's' : ''}, ${warningCount} aviso${warningCount > 1 ? 's' : ''})`;
                }
                
                return `<span class="tag tag-danger">${displayText}</span>`;
            } else {
                return '—';
            }
        };
        
        // Registrar correção
        this.corrections.push({
            name: 'Problem Count Accuracy',
            file: 'public/audio-analyzer-integration-clean2.js',
            function: 'countVisualProblems + updateProblemsDisplay',
            status: 'implemented',
            description: 'Contagem baseada em análise visual das métricas vs tolerâncias'
        });
        
        // Disponibilizar funções corrigidas
        if (typeof window !== 'undefined') {
            window.countVisualProblemsFixed = countVisualProblemsFixed;
            window.updateProblemsDisplayFixed = updateProblemsDisplayFixed;
            console.log('   ✅ Funções corrigidas disponíveis');
        }
        
        return { countVisualProblemsFixed, updateProblemsDisplayFixed };
    }

    // 🎵 CORREÇÃO 3: Subscore de Frequência Monotônico
    implementFrequencySubscoreFix() {
        console.log('\n🎵 CORREÇÃO 3: Implementando Subscore de Frequência Corrigido');
        
        // Função corrigida para calcular subscore de frequência
        const calculateFrequencySubscoreFixed = function(technicalData, reference = null) {
            if (!technicalData) return 50; // Score neutro se sem dados
            
            // Métricas espectrais com targets e tolerâncias
            const spectralMetrics = {
                spectralCentroid: { 
                    target: 2500, 
                    tolerance: 1200,
                    weight: 0.4 
                },
                spectralRolloff50: { 
                    target: 3000, 
                    tolerance: 1200,
                    weight: 0.3 
                },
                spectralRolloff85: { 
                    target: 8000, 
                    tolerance: 2500,
                    weight: 0.3 
                }
            };
            
            const scores = [];
            let totalWeight = 0;
            
            for (const [metric, config] of Object.entries(spectralMetrics)) {
                const value = technicalData[metric];
                
                if (Number.isFinite(value)) {
                    const diff = Math.abs(value - config.target);
                    let score;
                    
                    if (diff <= config.tolerance) {
                        score = 100; // Perfeito
                    } else if (diff <= config.tolerance * 2) {
                        // Linear entre 100 e 0
                        score = 100 - (50 * ((diff / config.tolerance) - 1));
                    } else {
                        score = 0; // Muito longe
                    }
                    
                    scores.push({
                        metric,
                        value,
                        target: config.target,
                        diff,
                        score: Math.max(0, Math.min(100, score)),
                        weight: config.weight
                    });
                    
                    totalWeight += config.weight;
                }
            }
            
            // CORREÇÃO: Retornar score neutro se não há dados válidos
            if (scores.length === 0) {
                return 50; // ERA: return 100 (bug identificado)
            }
            
            // Calcular média ponderada
            const weightedSum = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);
            const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
            
            return {
                score: Math.round(finalScore),
                details: scores,
                method: 'weighted_spectral_v2',
                dataAvailable: scores.length,
                totalMetrics: Object.keys(spectralMetrics).length
            };
        };
        
        // Registrar correção
        this.corrections.push({
            name: 'Frequency Subscore Monotonicity',
            file: 'lib/audio/features/subscore-corrector.js',
            function: 'calculateFrequencySubscore',
            status: 'implemented',
            description: 'Corrigido N/A retornando 50 em vez de 100, adicionada monotonicidade'
        });
        
        // Disponibilizar função corrigida
        if (typeof window !== 'undefined') {
            window.calculateFrequencySubscoreFixed = calculateFrequencySubscoreFixed;
            console.log('   ✅ Função corrigida disponível');
        }
        
        return calculateFrequencySubscoreFixed;
    }

    // 🎼 CORREÇÃO 4: Debug Bandas Espectrais
    implementSpectralBandsDebug() {
        console.log('\n🎼 CORREÇÃO 4: Implementando Debug para Bandas Espectrais');
        
        // Função para verificar e corrigir tonalBalance
        const validateTonalBalanceFixed = function(technicalData) {
            if (!technicalData) return null;
            
            // Verificar se tonalBalance existe e tem dados válidos
            const tb = technicalData.tonalBalance;
            
            if (!tb || typeof tb !== 'object') {
                console.warn('⚠️ tonalBalance ausente ou inválido');
                return {
                    status: 'missing',
                    issue: 'tonalBalance não encontrado',
                    recommendation: 'Verificar geração de bandEnergies'
                };
            }
            
            // Verificar se todas as bandas têm o mesmo valor (problema identificado)
            const validBands = Object.entries(tb)
                .filter(([key, band]) => band && Number.isFinite(band.rms_db))
                .map(([key, band]) => ({ key, value: band.rms_db }));
            
            if (validBands.length === 0) {
                console.warn('⚠️ Nenhuma banda espectral válida encontrada');
                return {
                    status: 'empty',
                    issue: 'Todas as bandas são null ou NaN',
                    recommendation: 'Verificar processo de análise espectral'
                };
            }
            
            // Verificar se valores são todos iguais (bug reportado)
            const allSame = validBands.every(band => band.value === validBands[0].value);
            
            if (allSame) {
                console.warn('⚠️ Todas as bandas têm o mesmo valor:', validBands[0].value);
                return {
                    status: 'duplicate',
                    issue: 'Todas as bandas mostram mesmo valor',
                    sameValue: validBands[0].value,
                    recommendation: 'Verificar binding na UI ou geração de bandEnergies'
                };
            }
            
            // Verificar variação razoável
            const values = validBands.map(b => b.value);
            const range = Math.max(...values) - Math.min(...values);
            
            return {
                status: 'ok',
                validBands: validBands.length,
                totalBands: Object.keys(tb).length,
                range: range,
                values: validBands,
                summary: `${validBands.length} bandas válidas, variação de ${range.toFixed(1)}dB`
            };
        };
        
        // Função para gerar tonalBalance correto
        const generateTonalBalanceFixed = function(bandEnergies) {
            if (!bandEnergies || typeof bandEnergies !== 'object') {
                return null;
            }
            
            // Mapeamento correto das bandas
            const tonalBalance = {
                sub: bandEnergies.sub?.rms_db ? { rms_db: bandEnergies.sub.rms_db } : null,
                low: bandEnergies.low_bass?.rms_db ? { rms_db: bandEnergies.low_bass.rms_db } : null,
                mid: bandEnergies.mid?.rms_db ? { rms_db: bandEnergies.mid.rms_db } : null,
                high: bandEnergies.brilho?.rms_db ? { rms_db: bandEnergies.brilho.rms_db } : null
            };
            
            // Verificar se pelo menos 2 bandas têm dados
            const validCount = Object.values(tonalBalance).filter(b => b !== null).length;
            
            if (validCount < 2) {
                console.warn('⚠️ Dados insuficientes para tonalBalance:', validCount, 'bandas válidas');
                return null; // UI mostrará "—"
            }
            
            return tonalBalance;
        };
        
        // Registrar correção
        this.corrections.push({
            name: 'Spectral Bands Debug',
            file: 'public/audio-analyzer.js',
            function: 'tonalBalance generation',
            status: 'debug_implemented',
            description: 'Adicionado debug e validação para detectar problema de bandas iguais'
        });
        
        // Disponibilizar funções corrigidas
        if (typeof window !== 'undefined') {
            window.validateTonalBalanceFixed = validateTonalBalanceFixed;
            window.generateTonalBalanceFixed = generateTonalBalanceFixed;
            console.log('   ✅ Funções de debug disponíveis');
        }
        
        return { validateTonalBalanceFixed, generateTonalBalanceFixed };
    }

    // 🚀 Implementar todas as correções
    async implementAllCorrections() {
        console.log('🚀 IMPLEMENTANDO TODAS AS CORREÇÕES DE ALTA PRIORIDADE');
        console.log('=' .repeat(60));
        
        try {
            this.implementColorSuggestionFix();
            this.implementProblemCountFix();
            this.implementFrequencySubscoreFix();
            this.implementSpectralBandsDebug();
            
            this.generateImplementationReport();
            
        } catch (error) {
            console.error('❌ Erro durante implementação:', error);
        }
    }

    // 📊 Gerar relatório de implementação
    generateImplementationReport() {
        console.log('\n📊 RELATÓRIO DE IMPLEMENTAÇÃO');
        console.log('=' .repeat(60));
        
        const summary = {
            total: this.corrections.length,
            implemented: this.corrections.filter(c => c.status.includes('implemented')).length,
            debug: this.corrections.filter(c => c.status.includes('debug')).length
        };
        
        console.log(`📈 RESUMO:`);
        console.log(`  Total de correções: ${summary.total}`);
        console.log(`  ✅ Implementadas: ${summary.implemented}`);
        console.log(`  🔍 Debug adicionado: ${summary.debug}`);
        
        console.log('\n🔧 CORREÇÕES IMPLEMENTADAS:');
        this.corrections.forEach((correction, i) => {
            const statusIcon = correction.status.includes('implemented') ? '✅' : '🔍';
            console.log(`${i+1}. ${statusIcon} ${correction.name}`);
            console.log(`    📁 Arquivo: ${correction.file}`);
            console.log(`    🔧 Função: ${correction.function}`);
            console.log(`    📝 Descrição: ${correction.description}`);
            console.log('');
        });
        
        console.log('🧪 PRÓXIMOS PASSOS:');
        console.log('  1. Testar funções corrigidas com dados reais');
        console.log('  2. Executar validação: window.runCorrectionValidation()');
        console.log('  3. Se testes passarem, aplicar correções nos arquivos originais');
        console.log('  4. Fazer backup antes de modificar arquivos originais');
        
        console.log('\n🎯 FUNÇÕES DISPONÍVEIS PARA TESTE:');
        console.log('  • window.createEnhancedDiffCellFixed()');
        console.log('  • window.countVisualProblemsFixed()');
        console.log('  • window.calculateFrequencySubscoreFixed()');
        console.log('  • window.validateTonalBalanceFixed()');
        
        return {
            summary,
            corrections: this.corrections
        };
    }
}

// 🎯 Executar implementação se no browser
if (typeof window !== 'undefined') {
    window.CorrectionImplementer = CorrectionImplementer;
    
    // Função para executar implementação manualmente
    window.implementAuditCorrections = async function() {
        const implementer = new CorrectionImplementer();
        return await implementer.implementAllCorrections();
    };
    
    console.log('🔧 CorrectionImplementer carregado. Execute window.implementAuditCorrections() para iniciar.');
} else {
    module.exports = CorrectionImplementer;
}
