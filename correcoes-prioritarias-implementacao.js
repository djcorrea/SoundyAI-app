// 🔧 CORREÇÕES PRIORITÁRIAS - Implementação Direcionada
// Baseado nos resultados da auditoria direcionada

console.log('🔧 INICIANDO CORREÇÕES PRIORITÁRIAS');

class PrioritizedFixer {
    constructor() {
        this.fixes = [];
        this.appliedFixes = [];
    }

    // 🔥 PRIORIDADE HIGH: Problem Count Mismatch
    async fixProblemCountMismatch() {
        console.log('\n🔥 [HIGH] Corrigindo Problem Count Mismatch');
        
        const fix = {
            priority: 'HIGH',
            issue: 'Problem Count Mismatch',
            description: 'Unificar contagem de problemas com status visual',
            files: ['audio-analyzer-integration-clean2.js'],
            implementation: this.createVisualProblemCounter()
        };

        this.fixes.push(fix);
        return fix;
    }

    createVisualProblemCounter() {
        return `
// 📊 CORREÇÃO: Contador Visual de Problemas
// Substitui problems.length por contagem baseada em status visual

function countVisualProblems(analysis) {
    if (!analysis || !analysis.technicalData) {
        return { count: 0, problems: [] };
    }

    const problemMetrics = [];
    
    // 1. LUFS Integration
    const lufs = analysis.technicalData.lufsIntegrated;
    if (Number.isFinite(lufs)) {
        const target = -14;
        const tolerance = 1;
        const diff = Math.abs(lufs - target);
        
        if (diff > tolerance) {
            problemMetrics.push({
                metric: 'LUFS',
                value: lufs,
                target,
                severity: diff > tolerance * 2 ? 'critical' : 'warning',
                issue: lufs > target ? 'Muito alto - pode causar limitação' : 'Muito baixo - falta presença'
            });
        }
    }

    // 2. True Peak
    const truePeak = analysis.technicalData.truePeakDbtp;
    if (Number.isFinite(truePeak)) {
        if (truePeak > -1) {
            problemMetrics.push({
                metric: 'True Peak',
                value: truePeak,
                target: -1,
                severity: truePeak > 0 ? 'critical' : 'warning',
                issue: truePeak > 0 ? 'CLIPPING DETECTADO' : 'Risco de clipping'
            });
        }
    }

    // 3. Dynamic Range
    const dr = analysis.technicalData.dynamicRange;
    if (Number.isFinite(dr)) {
        if (dr < 7) {
            problemMetrics.push({
                metric: 'Dynamic Range',
                value: dr,
                target: 10,
                severity: dr < 4 ? 'critical' : 'warning',
                issue: 'Compressão excessiva - som "achatado"'
            });
        }
    }

    // 4. Stereo Correlation (problemas mono/phase)
    const correlation = analysis.technicalData.stereoCorrelation;
    if (Number.isFinite(correlation)) {
        if (correlation < 0.1 || correlation > 0.9) {
            problemMetrics.push({
                metric: 'Stereo Width',
                value: correlation,
                target: 0.5,
                severity: 'warning',
                issue: correlation > 0.9 ? 'Muito mono' : 'Possível problema de fase'
            });
        }
    }

    // 5. Verificar problemas específicos detectados
    if (analysis.problems && Array.isArray(analysis.problems)) {
        analysis.problems.forEach(problem => {
            if (problem.severity === 'critical') {
                problemMetrics.push({
                    metric: problem.metric || 'Detectado',
                    severity: 'critical',
                    issue: problem.description || problem.type || 'Problema crítico detectado'
                });
            }
        });
    }

    return {
        count: problemMetrics.length,
        problems: problemMetrics,
        breakdown: {
            critical: problemMetrics.filter(p => p.severity === 'critical').length,
            warning: problemMetrics.filter(p => p.severity === 'warning').length
        }
    };
}

// 🔄 APLICAR CORREÇÃO: Substituir contador atual
function applyProblemCountFix() {
    // Localizar linha ~2569 em audio-analyzer-integration-clean2.js
    const originalCode = \`
    const problemCount = analysis.problems ? analysis.problems.length : 0;
    \`;
    
    const correctedCode = \`
    // ✅ CORREÇÃO: Usar contagem visual em vez de problems.length
    const visualProblems = countVisualProblems(analysis);
    const problemCount = visualProblems.count;
    
    // Debug: mostrar breakdown se necessário
    if (window.DEBUG_AUDIO_ANALYSIS) {
        console.log('🔍 Problem Count Fix:', {
            visualCount: visualProblems.count,
            originalCount: analysis.problems ? analysis.problems.length : 0,
            breakdown: visualProblems.breakdown,
            problems: visualProblems.problems
        });
    }
    \`;
    
    return {
        file: 'audio-analyzer-integration-clean2.js',
        searchFor: originalCode.trim(),
        replaceWith: correctedCode.trim(),
        lineReference: '~2569'
    };
}
        `;
    }

    // 🔶 PRIORIDADE MEDIUM: N/A Score Inflation
    async fixNAScoreInflation() {
        console.log('\n🔶 [MEDIUM] Corrigindo N/A Score Inflation');
        
        const fix = {
            priority: 'MEDIUM',
            issue: 'N/A Score Inflation',
            description: 'Garantir que N/A não participe do cálculo de scores',
            files: ['lib/audio/features/scoring.js', 'subscore-corrector.js'],
            implementation: this.createNAHandling()
        };

        this.fixes.push(fix);
        return fix;
    }

    createNAHandling() {
        return `
// ⚡ CORREÇÃO: Tratamento Correto de N/A
// Garantir que valores N/A não inflam scores

function calculateScoreWithoutNA(values, targetFunction) {
    if (!Array.isArray(values)) {
        return { score: 50, validCount: 0, note: 'Input inválido' };
    }

    // 1. Filtrar apenas valores válidos (excluir N/A)
    const validValues = values.filter(value => {
        return Number.isFinite(value) && 
               value !== null && 
               value !== undefined && 
               !isNaN(value);
    });

    if (validValues.length === 0) {
        return { 
            score: 50, // Score neutro quando não há dados válidos
            validCount: 0, 
            note: 'Nenhum valor válido - score neutro aplicado' 
        };
    }

    // 2. Calcular score apenas com valores válidos
    const scores = validValues.map(value => targetFunction(value));
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const averageScore = totalScore / scores.length;

    return {
        score: Math.round(averageScore),
        validCount: validValues.length,
        totalValues: values.length,
        excludedNA: values.length - validValues.length,
        note: validValues.length < values.length ? 
              \`\${values.length - validValues.length} valores N/A excluídos\` : 
              'Todos valores válidos'
    };
}

// 🔧 CORREÇÃO PARA SUBSCORE CORRECTOR
function fixSubScoreCorrector() {
    const correctedAggregateCategory = \`
    aggregateCategory(category, method = 'arithmetic') {
        if (!category || typeof category !== 'object') {
            return { score: 50, note: 'Categoria inválida' };
        }

        const validScores = [];
        const metrics = Object.keys(category);
        
        for (const metric of metrics) {
            const value = category[metric];
            
            // ✅ CORREÇÃO: Verificar se é valor válido antes de incluir
            if (Number.isFinite(value) && value >= 0 && value <= 100) {
                validScores.push(value);
            }
            // N/A, undefined, null são ignorados (não participam do cálculo)
        }

        if (validScores.length === 0) {
            return { 
                score: 50, // Score neutro
                validCount: 0,
                note: 'Nenhuma métrica válida na categoria'
            };
        }

        let aggregatedScore;
        switch (method) {
            case 'harmonic':
                const harmonicSum = validScores.reduce((sum, score) => sum + (1 / score), 0);
                aggregatedScore = validScores.length / harmonicSum;
                break;
            case 'geometric':
                const product = validScores.reduce((prod, score) => prod * score, 1);
                aggregatedScore = Math.pow(product, 1 / validScores.length);
                break;
            case 'arithmetic':
            default:
                const sum = validScores.reduce((sum, score) => sum + score, 0);
                aggregatedScore = sum / validScores.length;
                break;
        }

        return {
            score: Math.round(Math.max(0, Math.min(100, aggregatedScore))),
            validCount: validScores.length,
            totalMetrics: metrics.length,
            method: method,
            note: validScores.length < metrics.length ? 
                  \`\${metrics.length - validScores.length} métricas N/A excluídas\` : 
                  'Todas métricas válidas'
        };
    }
    \`;
    
    return {
        file: 'lib/audio/features/subscore-corrector.js',
        method: 'aggregateCategory',
        correction: correctedAggregateCategory
    };
}
        `;
    }

    // 🔴 PRIORIDADE MEDIUM: Frequency Subscore Logic
    async fixFrequencySubscore() {
        console.log('\n🔴 [MEDIUM] Corrigindo Frequency Subscore Logic');
        
        const fix = {
            priority: 'MEDIUM',
            issue: 'Frequency Subscore Inconsistency',
            description: 'Corrigir normalização do subscore de frequência',
            files: ['audio-analyzer.js'],
            implementation: this.createFrequencyFix()
        };

        this.fixes.push(fix);
        return fix;
    }

    createFrequencyFix() {
        return `
// 🎵 CORREÇÃO: Frequency Subscore Logic
// Linha ~2053 em audio-analyzer.js

function calculateFrequencySubscoreCorrect(spectralData, references) {
    const targets = {
        spectralCentroid: { 
            target: references?.spectral_centroid_target || 2500, 
            tolerance: references?.spectral_centroid_tolerance || 1200 
        },
        spectralRolloff50: { 
            target: references?.spectral_rolloff50_target || 3000, 
            tolerance: references?.spectral_rolloff50_tolerance || 1200 
        },
        spectralRolloff85: { 
            target: references?.spectral_rolloff85_target || 8000, 
            tolerance: references?.spectral_rolloff85_tolerance || 2500 
        }
    };

    let totalScore = 0;
    let validMetrics = 0;
    const details = [];

    for (const [metric, config] of Object.entries(targets)) {
        const value = spectralData[metric];
        
        // ✅ CORREÇÃO: Verificar se valor é válido
        if (!Number.isFinite(value)) {
            details.push({
                metric,
                value: 'N/A',
                target: config.target,
                tolerance: config.tolerance,
                score: null,
                note: 'Valor inválido - excluído do cálculo'
            });
            continue; // Pular N/A
        }

        const distance = Math.abs(value - config.target);
        let score;

        // ✅ CORREÇÃO: Lógica monotônica de score
        if (distance <= config.tolerance) {
            // Ideal: score decresce linearmente até tolerance
            score = 100 - (distance / config.tolerance) * 20; // 100 a 80
        } else if (distance <= config.tolerance * 2) {
            // Ajustar: score decresce de 80 a 40
            const excessDistance = distance - config.tolerance;
            score = 80 - (excessDistance / config.tolerance) * 40;
        } else if (distance <= config.tolerance * 4) {
            // Corrigir: score decresce de 40 a 0
            const excessDistance = distance - (config.tolerance * 2);
            score = 40 - (excessDistance / (config.tolerance * 2)) * 40;
        } else {
            // Muito longe: score 0
            score = 0;
        }

        score = Math.max(0, Math.min(100, score));
        totalScore += score;
        validMetrics++;

        details.push({
            metric,
            value,
            target: config.target,
            tolerance: config.tolerance,
            distance,
            score: Math.round(score),
            status: score >= 80 ? 'ideal' : score >= 40 ? 'ajustar' : 'corrigir'
        });
    }

    const finalScore = validMetrics > 0 ? Math.round(totalScore / validMetrics) : 50;

    return {
        score: finalScore,
        validMetrics,
        totalMetrics: Object.keys(targets).length,
        details,
        note: validMetrics === 0 ? 'Nenhuma métrica válida - score neutro' : 
              validMetrics < 3 ? 'Algumas métricas N/A' : 'Todas métricas válidas'
    };
}

// 🔄 APLICAR CORREÇÃO no audio-analyzer.js linha ~2053
function applyFrequencyFix() {
    const originalCode = \`
    scoreFreq = ((spectralCentroid / 10000) + 
                 (spectralRolloff50 / 10000) + 
                 (spectralRolloff85 / 10000)) / 3 * 100;
    \`;
    
    const correctedCode = \`
    // ✅ CORREÇÃO: Usar lógica monotônica baseada em targets
    const frequencyResult = calculateFrequencySubscoreCorrect({
        spectralCentroid,
        spectralRolloff50,
        spectralRolloff85
    }, genreReferences);
    
    scoreFreq = frequencyResult.score;
    
    // Debug para validação
    if (window.DEBUG_AUDIO_ANALYSIS) {
        console.log('🎵 Frequency Score Fix:', frequencyResult);
    }
    \`;
    
    return {
        file: 'audio-analyzer.js',
        lineReference: '~2053',
        searchFor: originalCode.trim(),
        replaceWith: correctedCode.trim()
    };
}
        `;
    }

    // 🔵 PRIORIDADE LOW: True-Peak Data Fix
    async fixTruePeakData() {
        console.log('\n🔵 [LOW] Corrigindo True-Peak Data');
        
        const fix = {
            priority: 'LOW',
            issue: 'True-Peak Target Validation',
            description: 'Corrigir targets implausíveis nos dados de referência',
            files: ['public/refs/embedded-refs-new.js'],
            implementation: this.createTruePeakDataFix()
        };

        this.fixes.push(fix);
        return fix;
    }

    createTruePeakDataFix() {
        return `
// 🎯 CORREÇÃO: True-Peak Targets Realistas
// Arquivo: public/refs/embedded-refs-new.js

const realisticTruePeakTargets = {
    // Padrões de streaming modernos
    'spotify': -1.0,
    'youtube_music': -1.0, 
    'apple_music': -1.0,
    'tidal': -1.0,
    
    // Gêneros com targets específicos
    'electronic': -0.8,  // Mais agressivo
    'classical': -2.0,   // Mais conservador
    'rock': -1.0,        // Padrão
    'pop': -1.0,         // Padrão
    'hip_hop': -0.8,     // Mais agressivo
    'jazz': -1.5,        // Conservador
    
    // Default para gêneros não especificados
    'default': -1.0
};

function validateAndFixTruePeakTargets(references) {
    const fixed = {};
    
    for (const [genre, data] of Object.entries(references)) {
        fixed[genre] = { ...data };
        
        if (data.legacy_compatibility?.true_peak_target) {
            const current = data.legacy_compatibility.true_peak_target;
            
            // Verificar se target é implausível (fora de -3 a 0 dBTP)
            if (current < -3.0 || current > 0.0) {
                const realistic = realisticTruePeakTargets[genre] || 
                                realisticTruePeakTargets.default;
                
                console.warn(\`🎯 True-Peak Fix: \${genre} target \${current} → \${realistic} dBTP\`);
                
                fixed[genre].legacy_compatibility.true_peak_target = realistic;
                fixed[genre].legacy_compatibility.fixed_by_audit = true;
                fixed[genre].legacy_compatibility.original_target = current;
            }
        }
    }
    
    return fixed;
}

// 🔧 APLICAR CORREÇÃO nos dados
function applyTruePeakDataFix() {
    // Identificar targets problemáticos e substituir
    const corrections = [
        {
            genre: 'problematic_genre',
            oldTarget: -8.0,
            newTarget: -1.0,
            reason: 'Target implausível para streaming'
        }
        // Adicionar outros conforme detectado
    ];
    
    return {
        file: 'public/refs/embedded-refs-new.js',
        corrections,
        note: 'Substituir targets < -3.0 ou > 0.0 por valores realistas'
    };
}
        `;
    }

    // 🚀 Executar todas as correções
    async runAllFixes() {
        console.log('\n🚀 EXECUTANDO TODAS AS CORREÇÕES');
        console.log('=' .repeat(50));

        const fixes = [
            () => this.fixProblemCountMismatch(),
            () => this.fixNAScoreInflation(),
            () => this.fixFrequencySubscore(),
            () => this.fixTruePeakData()
        ];

        for (const fix of fixes) {
            try {
                await fix();
            } catch (error) {
                console.error('Erro ao aplicar correção:', error);
            }
        }

        this.generateImplementationPlan();
    }

    generateImplementationPlan() {
        console.log('\n📋 PLANO DE IMPLEMENTAÇÃO');
        console.log('=' .repeat(50));

        console.log('🎯 ORDEM DE APLICAÇÃO:');
        
        this.fixes
            .sort((a, b) => {
                const priority = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                return priority[b.priority] - priority[a.priority];
            })
            .forEach((fix, i) => {
                console.log(`${i + 1}. [${fix.priority}] ${fix.issue}`);
                console.log(`   📁 Arquivos: ${fix.files.join(', ')}`);
                console.log(`   🔧 Ação: ${fix.description}`);
                console.log('');
            });

        console.log('⚠️ CUIDADOS:');
        console.log('  • Fazer backup dos arquivos antes de modificar');
        console.log('  • Aplicar uma correção por vez');
        console.log('  • Testar cada correção isoladamente');
        console.log('  • Limpar cache após cada mudança');
        console.log('  • Validar com áudios de teste conhecidos');
    }
}

// 🎯 Instanciar para uso
if (typeof window !== 'undefined') {
    window.PrioritizedFixer = PrioritizedFixer;
    
    window.runPrioritizedFixes = async function() {
        const fixer = new PrioritizedFixer();
        return await fixer.runAllFixes();
    };
    
    console.log('🔧 PrioritizedFixer carregado. Use window.runPrioritizedFixes() para executar.');
} else {
    module.exports = PrioritizedFixer;
}
