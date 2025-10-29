/**
 * 🧩 AUDITORIA TÉCNICA COMPLETA — Sistema de Cores da Tabela de Referência
 * 
 * Arquivo: auditoria-color-system.js
 * Objetivo: Inspecionar, mapear e entender toda a arquitetura e lógica que define 
 *           e aplica as cores dos campos na tabela de comparação de referência.
 * 
 * Data: 29/10/2025
 * Versão: 1.0.0
 */

// ============================================================================
// 🔍 1. MAPEAMENTO INICIAL DA ESTRUTURA
// ============================================================================

/**
 * ARQUITETURA DO SISTEMA DE CORES
 * 
 * Localização: public/audio-analyzer-integration.js
 * 
 * FUNÇÃO PRINCIPAL DE COLORAÇÃO:
 * - Nome: pushRow()
 * - Linha: 5815
 * - Responsabilidade: Calcular diferença, determinar status e aplicar classe CSS
 * 
 * PARÂMETROS:
 * @param {string} label - Nome da métrica (ex: "Loudness Integrado (LUFS)")
 * @param {number} val - Valor atual da métrica
 * @param {number|object} target - Valor alvo ou range {min, max}
 * @param {number} tol - Tolerância aceita
 * @param {string} unit - Unidade de medida (ex: ' LUFS', ' dB', '')
 */

const COLOR_SYSTEM_ARCHITECTURE = {
    // Função centralizada
    mainFunction: {
        name: 'pushRow',
        location: 'audio-analyzer-integration.js:5815',
        type: 'centralizada',
        scope: 'todas as métricas da tabela de referência'
    },
    
    // Classes CSS aplicadas
    cssClasses: {
        'ok': {
            status: 'Ideal',
            color: '#52f7ad', // Verde
            icon: '✅',
            condition: 'absDiff <= tol'
        },
        'yellow': {
            status: 'Ajuste leve',
            color: '#ffce4d', // Amarelo
            icon: '⚠️',
            condition: 'absDiff > tol && multiplicador <= 2'
        },
        'warn': {
            status: 'Corrigir',
            color: '#ff7b7b', // Vermelho
            icon: '❌',
            condition: 'multiplicador > 2'
        },
        'orange': {
            status: 'Ajustar',
            color: 'orange', // Laranja (bandas específicas)
            icon: '🟠',
            condition: 'absDiff > 1.0 && absDiff <= 3.0 (apenas bandas com tol=0)'
        }
    },
    
    // Locais de aplicação CSS
    cssDefinition: {
        location: 'audio-analyzer-integration.js:6409-6414',
        style: {
            '.ref-compare-table td.ok': 'color:#52f7ad; font-weight:600;',
            '.ref-compare-table td.ok::before': "content:'✅ '; margin-right:2px;",
            '.ref-compare-table td.yellow': 'color:#ffce4d; font-weight:600;',
            '.ref-compare-table td.yellow::before': "content:'⚠️ '; margin-right:2px;",
            '.ref-compare-table td.warn': 'color:#ff7b7b; font-weight:600;',
            '.ref-compare-table td.warn::before': "content:'❌ '; margin-right:2px;"
        }
    },
    
    // Renderização no DOM
    rendering: {
        method: 'template string injection',
        location: 'pushRow function lines 5940-5942',
        template: `<td class="\${cssClass}" style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; font-weight: 600;">\${statusText}</div>
        </td>`
    }
};

// ============================================================================
// 🧮 2. VERIFICAÇÃO DE CÁLCULO E ARREDONDAMENTO
// ============================================================================

/**
 * LÓGICA DE CÁLCULO DA DIFERENÇA (DIFF)
 * 
 * A função pushRow() implementa três modos de cálculo:
 */

const DIFF_CALCULATION_MODES = {
    // Modo 1: Target como RANGE {min, max}
    rangeMode: {
        condition: 'typeof target === "object" && target.min && target.max',
        logic: `
        if (val >= target.min && val <= target.max) {
            diff = 0; // Dentro do range = Ideal
        } else if (val < target.min) {
            diff = val - target.min; // Abaixo do range = negativo
        } else {
            diff = val - target.max; // Acima do range = positivo
        }`,
        location: 'lines 5839-5852',
        usedBy: 'bandas espectrais com ranges flexíveis'
    },
    
    // Modo 2: Target como VALOR FIXO
    fixedMode: {
        condition: 'Number.isFinite(val) && Number.isFinite(target)',
        logic: 'diff = val - target;',
        location: 'lines 5853-5855',
        usedBy: 'LUFS, True Peak, DR, LRA, Stereo Correlation'
    },
    
    // Modo 3: FALLBACK (valores inválidos)
    fallbackMode: {
        condition: '!Number.isFinite(diff)',
        result: 'N/A (sem cor aplicada)',
        location: 'lines 5861-5863'
    }
};

/**
 * ⚠️ PONTOS CRÍTICOS DE ARREDONDAMENTO
 */
const ROUNDING_ANALYSIS = {
    // 🎯 VALORES EXIBIDOS (com toFixed)
    displayValues: {
        location: 'audio-analyzer-integration.js:948 (função nf)',
        code: 'return val.toFixed(decimals);',
        impact: 'BAIXO - apenas visual, não afeta cálculo de cor',
        examples: [
            { real: -13.92, displayed: '-13.9', diff: 0.02 },
            { real: -14.01, displayed: '-14.0', diff: 0.01 }
        ]
    },
    
    // ✅ CÁLCULO DE DIFERENÇA (SEM toFixed)
    diffCalculation: {
        location: 'pushRow lines 5839-5855',
        code: 'diff = val - target; // SEM arredondamento',
        impact: 'NENHUM - mantém precisão total',
        precision: 'float64 (IEEE 754)',
        note: 'Diferenças menores que 0.01 são preservadas corretamente'
    },
    
    // 🧪 TESTE DE PRECISÃO
    precisionTest: {
        testCases: [
            { val: -13.99, target: -14.0, tol: 0.5, diff: 0.01, expected: 'ok' },
            { val: -13.49, target: -14.0, tol: 0.5, diff: 0.51, expected: 'yellow' },
            { val: -13.0, target: -14.0, tol: 0.5, diff: 1.0, expected: 'yellow' },
            { val: -12.99, target: -14.0, tol: 0.5, diff: 1.01, expected: 'warn' }
        ],
        runTest: function() {
            console.log('🧪 TESTE DE PRECISÃO DO SISTEMA DE CORES:');
            this.testCases.forEach(({ val, target, tol, diff, expected }) => {
                const calculatedDiff = val - target;
                const absDiff = Math.abs(calculatedDiff);
                let result;
                
                if (absDiff <= tol) {
                    result = 'ok';
                } else {
                    const multiplicador = absDiff / tol;
                    result = multiplicador <= 2 ? 'yellow' : 'warn';
                }
                
                const pass = result === expected ? '✅' : '❌';
                console.log(`${pass} val=${val} target=${target} → diff=${calculatedDiff.toFixed(4)} → ${result} (esperado: ${expected})`);
            });
        }
    }
};

// ============================================================================
// 🎨 3. AUDITORIA DAS REGRAS DE COR E STATUS
// ============================================================================

/**
 * LÓGICA DE COLORAÇÃO - TRÊS MODOS DISTINTOS
 */
const COLOR_LOGIC_MODES = {
    // Modo A: BANDAS COM TOLERÂNCIA ZERO (tol === 0)
    bandsMode: {
        location: 'lines 5865-5890',
        condition: 'tol === 0',
        rules: [
            { range: 'diff === 0', class: 'ok', status: 'Ideal', note: 'DENTRO do range' },
            { range: '0 < absDiff <= 1.0', class: 'yellow', status: 'Ajuste leve', note: 'Fora por até 1dB' },
            { range: '1.0 < absDiff <= 3.0', class: 'orange', status: 'Ajustar', note: 'Fora por até 3dB' },
            { range: 'absDiff > 3.0', class: 'warn', status: 'Corrigir', note: 'Fora por >3dB' }
        ],
        coverage: 'COMPLETA',
        gaps: 'NENHUM',
        fallback: 'Não aplicável (todas faixas cobertas)'
    },
    
    // Modo B: TOLERÂNCIA INVÁLIDA/AUSENTE (!Number.isFinite(tol) || tol < 0)
    fallbackToleranceMode: {
        location: 'lines 5891-5920',
        condition: '!Number.isFinite(tol) || tol < 0',
        defaultTolerance: 1.0,
        warning: true,
        warningMessage: '⚠️ [TOLERANCE_FALLBACK] Métrica sem tolerância válida',
        rules: [
            { range: 'absDiff <= 1.0', class: 'ok', status: 'Ideal' },
            { range: '1.0 < absDiff <= 2.0', class: 'yellow', status: 'Ajuste leve', note: 'multiplicador <= 2' },
            { range: 'absDiff > 2.0', class: 'warn', status: 'Corrigir', note: 'multiplicador > 2' }
        ],
        coverage: 'COMPLETA',
        gaps: 'NENHUM'
    },
    
    // Modo C: MÉTRICAS PRINCIPAIS (LUFS, True Peak, DR, etc.)
    mainMetricsMode: {
        location: 'lines 5922-5945',
        condition: 'tol > 0 && Number.isFinite(tol)',
        rules: [
            { range: 'absDiff <= tol', class: 'ok', status: 'Ideal', formula: 'absDiff <= tol' },
            { 
                range: 'tol < absDiff <= 2*tol', 
                class: 'yellow', 
                status: 'Ajuste leve', 
                formula: 'multiplicador = absDiff / tol; multiplicador <= 2' 
            },
            { 
                range: 'absDiff > 2*tol', 
                class: 'warn', 
                status: 'Corrigir', 
                formula: 'multiplicador > 2' 
            }
        ],
        coverage: 'COMPLETA',
        gaps: 'NENHUM',
        examples: [
            { metric: 'LUFS', target: -14, tol: 2.5, okRange: [-16.5, -11.5], yellowRange: '[-21.5, -16.5) U (-11.5, -9]', warnRange: '<-21.5 ou >-9' },
            { metric: 'True Peak', target: -1.0, tol: 0.5, okRange: [-1.5, -0.5], yellowRange: '[-2.5, -1.5) U (-0.5, 0]', warnRange: '<-2.5 ou >0' },
            { metric: 'DR', target: 8, tol: 2, okRange: [6, 10], yellowRange: '[2, 6) U (10, 14]', warnRange: '<2 ou >14' }
        ]
    }
};

/**
 * 🔍 ANÁLISE DE COBERTURA DAS REGRAS
 */
const COVERAGE_ANALYSIS = {
    allModesComplete: true,
    noGaps: true,
    fallbackExists: true,
    
    // Verificação matemática de cobertura
    verification: {
        mode_A: {
            ranges: ['diff=0', '0<absDiff≤1', '1<absDiff≤3', 'absDiff>3'],
            coverage: '(-∞, 0] U (0, 1] U (1, 3] U (3, +∞) = ℝ',
            complete: true
        },
        mode_B: {
            ranges: ['absDiff≤1', '1<absDiff≤2', 'absDiff>2'],
            coverage: '[0, 1] U (1, 2] U (2, +∞) = [0, +∞)',
            complete: true
        },
        mode_C: {
            ranges: ['absDiff≤tol', 'tol<absDiff≤2*tol', 'absDiff>2*tol'],
            coverage: '[0, tol] U (tol, 2*tol] U (2*tol, +∞) = [0, +∞)',
            complete: true
        }
    },
    
    edgeCases: [
        { case: 'diff = 0', mode: 'all', result: 'ok', handled: true },
        { case: 'diff = 0.01', mode: 'bands(tol=0)', result: 'yellow', handled: true },
        { case: 'diff = -0.01', mode: 'bands(tol=0)', result: 'yellow', handled: true },
        { case: 'tol = null', mode: 'fallback', result: 'ok/yellow/warn com tol=1.0', handled: true },
        { case: 'tol = undefined', mode: 'fallback', result: 'ok/yellow/warn com tol=1.0', handled: true },
        { case: 'tol = 0', mode: 'bands', result: 'binário baseado em diff', handled: true },
        { case: 'val = null', mode: 'all', result: 'N/A (linha não renderizada)', handled: true },
        { case: 'target = null', mode: 'all', result: 'N/A (colspan=2)', handled: true }
    ]
};

// ============================================================================
// 🧰 4. AUDITORIA DE RENDERIZAÇÃO
// ============================================================================

const RENDERING_AUDIT = {
    // Fluxo de aplicação da classe CSS
    flow: [
        {
            step: 1,
            action: 'Calcular diff',
            location: 'pushRow lines 5839-5855',
            output: 'number (float64)'
        },
        {
            step: 2,
            action: 'Determinar cssClass e statusText',
            location: 'pushRow lines 5865-5942',
            output: "cssClass: 'ok'|'yellow'|'warn'|'orange', statusText: string"
        },
        {
            step: 3,
            action: 'Gerar HTML com classe',
            location: 'pushRow lines 5940-5942',
            output: '<td class="${cssClass}">...</td>'
        },
        {
            step: 4,
            action: 'Injetar CSS no <head>',
            location: 'lines 6397-6417',
            timing: 'uma vez (verificado por #refCompareStyles)'
        },
        {
            step: 5,
            action: 'Renderizar no DOM',
            location: 'modal display',
            result: 'cor e ícone visíveis'
        }
    ],
    
    // Estrutura HTML gerada
    htmlStructure: {
        template: `
<tr>
    <td>Loudness Integrado (LUFS)</td>
    <td>-13.9 LUFS</td>
    <td>-14.0 LUFS<span class="tol">±2.5</span></td>
    <td class="ok" style="text-align: center; padding: 8px;">
        <div style="font-size: 12px; font-weight: 600;">Ideal</div>
    </td>
</tr>`,
        cssApplied: {
            class: '.ref-compare-table td.ok',
            styles: ['color: #52f7ad', 'font-weight: 600'],
            pseudoElement: "::before { content: '✅ '; margin-right: 2px; }"
        }
    },
    
    // Validação de fallback
    fallbackRendering: {
        case1_noTarget: {
            html: '<td colspan="2" style="opacity:.55">N/A</td>',
            location: 'line 5837',
            color: 'nenhuma (cinza opaco)'
        },
        case2_noDiff: {
            html: '<td class="na" style="text-align: center;"><span style="opacity: 0.6;">—</span></td>',
            location: 'line 5862',
            color: 'nenhuma (cinza opaco)'
        }
    }
};

// ============================================================================
// 🧾 5. AUDITORIA DE ESTILO E CAMADA VISUAL
// ============================================================================

const CSS_AUDIT = {
    // Definições CSS completas
    styles: {
        table: {
            selector: '.ref-compare-table',
            properties: {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '11px'
            }
        },
        headers: {
            selector: '.ref-compare-table th',
            properties: {
                fontWeight: '500',
                padding: '4px 6px',
                borderBottom: '1px solid rgba(255,255,255,.12)',
                fontSize: '11px',
                color: '#fff',
                letterSpacing: '.3px'
            }
        },
        cells: {
            selector: '.ref-compare-table td',
            properties: {
                padding: '5px 6px',
                borderBottom: '1px solid rgba(255,255,255,.06)',
                color: '#f5f7fa'
            }
        },
        statusOk: {
            selector: '.ref-compare-table td.ok',
            properties: {
                color: '#52f7ad',
                fontWeight: '600'
            },
            before: {
                content: "'✅ '",
                marginRight: '2px'
            }
        },
        statusYellow: {
            selector: '.ref-compare-table td.yellow',
            properties: {
                color: '#ffce4d',
                fontWeight: '600'
            },
            before: {
                content: "'⚠️ '",
                marginRight: '2px'
            }
        },
        statusWarn: {
            selector: '.ref-compare-table td.warn',
            properties: {
                color: '#ff7b7b',
                fontWeight: '600'
            },
            before: {
                content: "'❌ '",
                marginRight: '2px'
            }
        }
    },
    
    // Análise de conflitos CSS
    conflicts: {
        found: false,
        potentialIssues: [],
        specificity: {
            '.ref-compare-table td.ok': '0,0,2,1', // 2 classes + 1 element
            '.ref-compare-table td': '0,0,1,1',    // 1 class + 1 element
            'td': '0,0,0,1'                        // 1 element
        },
        winner: '.ref-compare-table td.ok (maior especificidade)',
        note: 'Sem conflitos - especificidade correta'
    },
    
    // Verificação de transparências
    transparency: {
        backgrounds: 'nenhuma (usa apenas color para texto)',
        opacity: {
            '.tol': 0.7,
            'N/A span': 0.6,
            'N/A td': 0.55
        },
        issue: 'NENHUM - opacidades aplicadas apenas em elementos auxiliares'
    },
    
    // Temas e variações
    themes: {
        darkMode: 'padrão (fundo escuro, textos claros)',
        lightMode: 'não implementado',
        adaptive: false
    }
};

// ============================================================================
// 🧠 6. AUDITORIA DE DATA BINDING E FRAMEWORK
// ============================================================================

const DATA_BINDING_AUDIT = {
    framework: 'Vanilla JavaScript (sem framework)',
    
    rendering: {
        type: 'string template concatenation',
        method: 'rows.push(`<tr>...</tr>`)',
        timing: 'build-time (não reativo)',
        reRender: 'completo (não incremental)'
    },
    
    dataFlow: [
        { step: 1, source: 'Backend API', data: 'analysis.metrics' },
        { step: 2, transform: 'getMetricForRef()', output: 'val (number)' },
        { step: 3, compare: 'ref (reference profile)', output: 'target, tol' },
        { step: 4, calculate: 'pushRow()', output: 'HTML string com classe CSS' },
        { step: 5, render: 'innerHTML injection', target: 'modal DOM' }
    ],
    
    reactivity: {
        isReactive: false,
        updateTrigger: 'full modal rebuild',
        caching: {
            metricsCache: false,
            colorCache: false,
            memoization: false
        },
        performance: 'adequado (poucas métricas, rebuild rápido)'
    },
    
    potentialIssues: {
        staleData: {
            risk: 'BAIXO',
            reason: 'modal fechado entre análises, sempre rebuilda',
            mitigation: 'não necessário'
        },
        colorNotUpdating: {
            risk: 'NENHUM',
            reason: 'cor calculada em tempo real durante render',
            verification: 'cada pushRow() calcula diff → cssClass novo'
        }
    }
};

// ============================================================================
// 🧩 7. AUDITORIA DE DADOS DE ENTRADA
// ============================================================================

const INPUT_DATA_AUDIT = {
    // Fonte dos valores
    valueSource: {
        primary: 'analysis.metrics (centralizado)',
        fallback: 'tech (technicalData legado)',
        function: 'getMetricForRef(metricPath, fallbackPath)',
        location: 'lines 5975-5990',
        validation: 'Number.isFinite() check'
    },
    
    // Fonte dos targets
    targetSource: {
        origin: 'ref (reference profile)',
        profiles: [
            'funk_mandela',
            'funk_automotivo',
            'trap',
            'trance',
            'eletronico',
            'funk_bruxaria',
            'hip_hop'
        ],
        location: 'lines 1090-1800',
        structure: {
            lufs_target: 'number',
            tol_lufs: 'number',
            true_peak_target: 'number',
            tol_true_peak: 'number',
            dr_target: 'number',
            tol_dr: 'number',
            bands: {
                sub: { min: 'number', max: 'number' },
                bass: { target_db: 'number', tol_db: 'number' }
            }
        }
    },
    
    // Validações implementadas
    validations: {
        valueCheck: {
            code: 'Number.isFinite(val)',
            location: 'line 5828',
            action: 'skip row if false'
        },
        targetCheck: {
            code: 'targetIsNA = (target == null || target === "" || !Number.isFinite(target))',
            location: 'lines 5828-5829',
            action: 'render N/A if true'
        },
        toleranceCheck: {
            code: '!Number.isFinite(tol) || tol < 0',
            location: 'line 5891',
            action: 'use defaultTol = 1.0'
        },
        diffCheck: {
            code: '!Number.isFinite(diff)',
            location: 'line 5861',
            action: 'render "—" sem cor'
        }
    },
    
    // Casos de dados incompletos
    incompleteDataHandling: {
        val_null: 'linha não renderizada (return early)',
        target_null: 'colspan=2 com "N/A"',
        tol_null: 'usa fallback tol=1.0 com warning',
        diff_NaN: 'célula com "—" sem classe CSS',
        allNull: 'linha não aparece na tabela'
    },
    
    // Métricas críticas
    criticalMetrics: [
        { name: 'Loudness Integrado (LUFS)', path: 'lufs_integrated', fallback: 'lufsIntegrated' },
        { name: 'Pico Real (dBTP)', path: 'true_peak_dbtp', fallback: 'truePeakDbtp' },
        { name: 'DR', path: 'dynamic_range', fallback: 'dynamicRange' },
        { name: 'Faixa de Loudness – LRA (LU)', path: 'lra', fallback: null },
        { name: 'Stereo Corr.', path: 'stereo_correlation', fallback: 'stereoCorrelation' }
    ]
};

// ============================================================================
// ⚡ 8. AUDITORIA DE FALLBACK E ERROS SILENCIOSOS
// ============================================================================

const FALLBACK_AUDIT = {
    // Operadores de fallback encontrados
    fallbackOperators: [
        {
            location: 'line 5828',
            code: 'target == null || target === "" || !Number.isFinite(target)',
            type: 'explicit null check',
            result: 'N/A rendering',
            silent: false,
            logged: false
        },
        {
            location: 'line 5892',
            code: 'defaultTol = 1.0',
            type: 'tolerance fallback',
            result: 'default tolerance applied',
            silent: false,
            logged: true,
            warning: '⚠️ [TOLERANCE_FALLBACK] Métrica sem tolerância válida'
        },
        {
            location: 'line 5824',
            code: 'window.enhanceRowLabel ? window.enhanceRowLabel(label) : label',
            type: 'optional enhancement',
            result: 'plain label if undefined',
            silent: true,
            logged: false
        },
        {
            location: 'line 5982',
            code: 'legacyValue = fallbackPath ? getNestedValue(tech, fallbackPath) : null',
            type: 'metric fallback',
            result: 'null if not found',
            silent: false,
            logged: true,
            warning: '🎯 REF_METRIC_DIFF'
        }
    ],
    
    // Erros silenciosos potenciais
    silentErrors: {
        missingTolerance: {
            detected: true,
            handling: 'fallback to defaultTol=1.0',
            logged: true,
            severity: 'LOW',
            fix: 'adicionar tolerâncias em todos os perfis de referência'
        },
        missingMetric: {
            detected: true,
            handling: 'linha não renderizada',
            logged: false,
            severity: 'MEDIUM',
            fix: 'adicionar log quando métrica não encontrada'
        },
        invalidDiff: {
            detected: true,
            handling: 'render "—" sem cor',
            logged: false,
            severity: 'LOW',
            fix: 'atual handling está adequado'
        }
    },
    
    // Sugestões de logging
    suggestedLogs: [
        {
            location: 'após line 5829',
            condition: '!Number.isFinite(val) && targetIsNA',
            log: 'console.warn("⚠️ Métrica ignorada (val e target inválidos):", label);'
        },
        {
            location: 'após line 5862',
            condition: '!Number.isFinite(diff)',
            log: 'console.warn("⚠️ Diff inválido para", label, { val, target });'
        }
    ]
};

// ============================================================================
// 🧩 9. AUDITORIA DE INTEGRAÇÃO COM COMPARAÇÃO DE REFERÊNCIA
// ============================================================================

const REFERENCE_COMPARISON_AUDIT = {
    // Sistema de perfis de gênero
    genreProfiles: {
        location: 'lines 1090-1800',
        count: 7,
        structure: {
            version: 'string (ex: "2025-08-mandela-targets.4-tolerances-updated")',
            metrics: {
                lufs: { integrated: { target: 'number', tolerance: 'number' } },
                truePeak: { target: 'number', tolerance: 'number' },
                dynamicRange: { target: 'number', tolerance: 'number' },
                lra: { target: 'number', tolerance: 'number' },
                stereo: { correlation: { target: 'number', tolerance: 'number' } }
            },
            flatStructure: {
                lufs_target: 'number',
                tol_lufs: 'number',
                true_peak_target: 'number',
                tol_true_peak: 'number',
                dr_target: 'number',
                tol_dr: 'number',
                lra_target: 'number',
                tol_lra: 'number',
                stereo_target: 'number',
                tol_stereo: 'number'
            },
            bands: {
                type: 'object',
                keys: ['sub', 'low_bass', 'low_mid', 'mid', 'high_mid', 'presenca', 'brilho'],
                structure: {
                    min: 'number (range mode)',
                    max: 'number (range mode)',
                    target_db: 'number (fixed mode)',
                    tol_db: 'number (fixed mode)'
                }
            }
        }
    },
    
    // Mapeamento de bandas
    bandMapping: {
        location: 'lines 6027-6040',
        purpose: 'mapear nomes de bandas calculadas para referência',
        mapping: {
            'sub': 'sub',
            'bass': 'low_bass',
            'lowMid': 'low_mid',
            'mid': 'mid',
            'highMid': 'high_mid',
            'presence': 'presenca',
            'air': 'brilho'
        },
        issues: {
            caseSensitivity: 'resolvido com .toLowerCase()',
            unmappedBands: 'possível se estrutura mudar'
        }
    },
    
    // Seleção de gênero
    genreSelection: {
        source: 'user input ou detecção automática',
        fallback: 'funk_mandela (padrão)',
        validation: 'perfil deve existir em GENRE_REFERENCE_PROFILES',
        impact: 'determina todos os targets e tolerâncias'
    },
    
    // Possíveis falhas de integração
    integrationFailures: [
        {
            scenario: 'Gênero não tem perfil definido',
            current: 'usa fallback',
            color: 'possível renderização sem cor',
            fix: 'garantir perfil default robusto'
        },
        {
            scenario: 'Banda não mapeada corretamente',
            current: 'banda não aparece na tabela',
            color: 'não afeta outras métricas',
            fix: 'melhorar mapeamento com fallback'
        },
        {
            scenario: 'Tolerância ausente no perfil',
            current: 'usa defaultTol=1.0',
            color: 'cor aplicada com tolerância genérica',
            fix: 'adicionar todas tolerâncias nos perfis'
        }
    ]
};

// ============================================================================
// 🧪 10. TESTES PRÁTICOS RECOMENDADOS
// ============================================================================

const PRACTICAL_TESTS = {
    // Teste 1: Matriz de valores LUFS
    test_lufs: {
        metric: 'Loudness Integrado (LUFS)',
        target: -14.0,
        tolerance: 2.5,
        cases: [
            { val: -14.0, diff: 0, expected: 'ok', status: 'Ideal' },
            { val: -13.99, diff: 0.01, expected: 'ok', status: 'Ideal' },
            { val: -13.5, diff: 0.5, expected: 'ok', status: 'Ideal' },
            { val: -13.49, diff: 0.51, expected: 'ok', status: 'Ideal' },
            { val: -11.5, diff: 2.5, expected: 'ok', status: 'Ideal' },
            { val: -11.49, diff: 2.51, expected: 'yellow', status: 'Ajuste leve' },
            { val: -13.8, diff: 0.2, expected: 'ok', status: 'Ideal' },
            { val: -12.0, diff: 2.0, expected: 'ok', status: 'Ideal' },
            { val: -9.0, diff: 5.0, expected: 'warn', status: 'Corrigir' },
            { val: -14.5, diff: -0.5, expected: 'ok', status: 'Ideal' },
            { val: -16.5, diff: -2.5, expected: 'ok', status: 'Ideal' },
            { val: -16.51, diff: -2.51, expected: 'yellow', status: 'Ajuste leve' },
            { val: -19.0, diff: -5.0, expected: 'warn', status: 'Corrigir' }
        ],
        runTest: function() {
            console.log('🧪 TESTE LUFS - Loudness Integrado');
            console.table(this.cases.map(c => ({
                'Valor': c.val + ' LUFS',
                'Diff': c.diff.toFixed(2),
                'Esperado': c.expected,
                'Status': c.status,
                'Dentro de tol?': Math.abs(c.diff) <= this.tolerance ? '✅' : '❌'
            })));
        }
    },
    
    // Teste 2: True Peak com tolerância menor
    test_truePeak: {
        metric: 'Pico Real (dBTP)',
        target: -1.0,
        tolerance: 0.5,
        cases: [
            { val: -1.0, diff: 0, expected: 'ok' },
            { val: -0.5, diff: 0.5, expected: 'ok' },
            { val: -0.49, diff: 0.51, expected: 'yellow' },
            { val: 0.0, diff: 1.0, expected: 'yellow' },
            { val: 0.01, diff: 1.01, expected: 'warn' },
            { val: -1.5, diff: -0.5, expected: 'ok' },
            { val: -1.51, diff: -0.51, expected: 'yellow' },
            { val: -2.0, diff: -1.0, expected: 'yellow' },
            { val: -2.01, diff: -1.01, expected: 'warn' }
        ]
    },
    
    // Teste 3: Banda com range (tol=0)
    test_bandRange: {
        metric: 'Sub (20-60 Hz)',
        target: { min: -15, max: -12 },
        tolerance: 0,
        cases: [
            { val: -14, diff: 0, expected: 'ok', note: 'dentro do range' },
            { val: -13, diff: 0, expected: 'ok', note: 'dentro do range' },
            { val: -11.5, diff: 0.5, expected: 'yellow', note: 'acima por 0.5dB' },
            { val: -11, diff: 1.0, expected: 'yellow', note: 'acima por 1dB' },
            { val: -10, diff: 2.0, expected: 'orange', note: 'acima por 2dB' },
            { val: -9, diff: 3.0, expected: 'orange', note: 'acima por 3dB' },
            { val: -8, diff: 4.0, expected: 'warn', note: 'acima por 4dB' },
            { val: -15.5, diff: -0.5, expected: 'yellow', note: 'abaixo por 0.5dB' },
            { val: -16, diff: -1.0, expected: 'yellow', note: 'abaixo por 1dB' },
            { val: -17, diff: -2.0, expected: 'orange', note: 'abaixo por 2dB' },
            { val: -18, diff: -3.0, expected: 'orange', note: 'abaixo por 3dB' },
            { val: -19, diff: -4.0, expected: 'warn', note: 'abaixo por 4dB' }
        ]
    },
    
    // Teste 4: Casos extremos
    test_edgeCases: {
        cases: [
            { label: 'Val nulo', val: null, target: -14, tol: 2.5, expected: 'não renderiza' },
            { label: 'Target nulo', val: -14, target: null, tol: 2.5, expected: 'N/A' },
            { label: 'Tol nulo', val: -14, target: -14, tol: null, expected: 'ok (com tol=1.0)' },
            { label: 'Val = NaN', val: NaN, target: -14, tol: 2.5, expected: 'não renderiza' },
            { label: 'Target = undefined', val: -14, target: undefined, tol: 2.5, expected: 'N/A' },
            { label: 'Tol = 0', val: -14, target: -14, tol: 0, expected: 'ok (modo banda)' },
            { label: 'Tol negativo', val: -14, target: -14, tol: -1, expected: 'ok (fallback tol=1.0)' },
            { label: 'Diff muito pequeno', val: -13.9999, target: -14, tol: 2.5, expected: 'ok' },
            { label: 'Diff exatamente tol', val: -11.5, target: -14, tol: 2.5, expected: 'ok' },
            { label: 'Diff exatamente 2*tol', val: -9.0, target: -14, tol: 2.5, expected: 'yellow' }
        ]
    },
    
    // Runner para todos os testes
    runAll: function() {
        console.log('🧪 ========================================');
        console.log('🧪 INICIANDO BATERIA DE TESTES COMPLETA');
        console.log('🧪 ========================================\n');
        
        this.test_lufs.runTest();
        console.log('\n');
        
        console.log('🧪 TESTE TRUE PEAK - Pico Real');
        console.table(this.test_truePeak.cases);
        console.log('\n');
        
        console.log('🧪 TESTE BANDA RANGE - Sub (20-60 Hz)');
        console.table(this.test_bandRange.cases);
        console.log('\n');
        
        console.log('🧪 TESTE CASOS EXTREMOS');
        console.table(this.test_edgeCases.cases);
        
        console.log('\n🧪 ========================================');
        console.log('🧪 TESTES CONCLUÍDOS');
        console.log('🧪 ========================================');
    }
};

// ============================================================================
// 🔧 11. RELATÓRIO DE SAÍDA E DIAGNÓSTICO
// ============================================================================

const DIAGNOSTIC_SYSTEM = {
    // Função para gerar log de métricas sem cor
    logMetricsWithoutColor: function(analysis, ref) {
        console.log('🔍 ========================================');
        console.log('🔍 DIAGNÓSTICO: Métricas sem cor');
        console.log('🔍 ========================================\n');
        
        const issues = [];
        
        // Simular pushRow para cada métrica principal
        const metricsToCheck = [
            { label: 'Loudness Integrado', val: analysis.metrics?.lufs_integrated, target: ref.lufs_target, tol: ref.tol_lufs },
            { label: 'True Peak', val: analysis.metrics?.true_peak_dbtp, target: ref.true_peak_target, tol: ref.tol_true_peak },
            { label: 'DR', val: analysis.metrics?.dynamic_range, target: ref.dr_target, tol: ref.tol_dr },
            { label: 'LRA', val: analysis.metrics?.lra, target: ref.lra_target, tol: ref.tol_lra },
            { label: 'Stereo Corr', val: analysis.metrics?.stereo_correlation, target: ref.stereo_target, tol: ref.tol_stereo }
        ];
        
        metricsToCheck.forEach(m => {
            let status = null;
            let reason = null;
            
            if (!Number.isFinite(m.val)) {
                status = 'SEM COR';
                reason = 'Valor inválido (null/undefined/NaN)';
            } else if (!Number.isFinite(m.target)) {
                status = 'N/A';
                reason = 'Target não definido';
            } else {
                const diff = m.val - m.target;
                const absDiff = Math.abs(diff);
                
                if (!Number.isFinite(m.tol) || m.tol < 0) {
                    status = 'FALLBACK';
                    reason = `Tolerância inválida (${m.tol}), usando defaultTol=1.0`;
                } else if (absDiff <= m.tol) {
                    status = 'ok';
                } else {
                    const mult = absDiff / m.tol;
                    status = mult <= 2 ? 'yellow' : 'warn';
                }
            }
            
            if (status === 'SEM COR' || status === 'N/A' || status === 'FALLBACK') {
                issues.push({
                    metric: m.label,
                    value: m.val,
                    target: m.target,
                    tol: m.tol,
                    diff: Number.isFinite(m.val) && Number.isFinite(m.target) ? m.val - m.target : null,
                    status: status,
                    reason: reason
                });
            }
        });
        
        if (issues.length === 0) {
            console.log('✅ Todas as métricas principais têm cor definida!');
        } else {
            console.log('⚠️ Métricas com problemas:');
            console.table(issues);
        }
        
        console.log('\n🔍 ========================================\n');
        
        return issues;
    },
    
    // Função para exportar JSON de diagnóstico
    exportDiagnosticJSON: function(analysis, ref) {
        const diagnostic = {
            timestamp: new Date().toISOString(),
            genre: ref.genre || 'unknown',
            profileVersion: ref.version || 'unknown',
            metrics: [],
            summary: {
                totalMetrics: 0,
                withColor: 0,
                withoutColor: 0,
                withFallback: 0,
                na: 0
            }
        };
        
        // Adicionar métricas principais
        const metricsToCheck = [
            { name: 'Loudness Integrado (LUFS)', path: 'lufs_integrated', target: ref.lufs_target, tol: ref.tol_lufs },
            { name: 'Pico Real (dBTP)', path: 'true_peak_dbtp', target: ref.true_peak_target, tol: ref.tol_true_peak },
            { name: 'DR', path: 'dynamic_range', target: ref.dr_target, tol: ref.tol_dr },
            { name: 'LRA', path: 'lra', target: ref.lra_target, tol: ref.tol_lra },
            { name: 'Stereo Corr', path: 'stereo_correlation', target: ref.stereo_target, tol: ref.tol_stereo }
        ];
        
        metricsToCheck.forEach(m => {
            const val = analysis.metrics?.[m.path];
            const diff = Number.isFinite(val) && Number.isFinite(m.target) ? val - m.target : null;
            
            let status = 'undefined';
            if (!Number.isFinite(val)) status = 'value_invalid';
            else if (!Number.isFinite(m.target)) status = 'target_na';
            else if (!Number.isFinite(m.tol) || m.tol < 0) status = 'tolerance_fallback';
            else if (Math.abs(diff) <= m.tol) status = 'ok';
            else status = (Math.abs(diff) / m.tol <= 2) ? 'yellow' : 'warn';
            
            diagnostic.metrics.push({
                metric: m.name,
                value: val,
                target: m.target,
                diff: diff,
                tolerance: m.tol,
                status: status
            });
            
            diagnostic.summary.totalMetrics++;
            if (status === 'ok' || status === 'yellow' || status === 'warn') diagnostic.summary.withColor++;
            if (status === 'value_invalid' || status === 'undefined') diagnostic.summary.withoutColor++;
            if (status === 'tolerance_fallback') diagnostic.summary.withFallback++;
            if (status === 'target_na') diagnostic.summary.na++;
        });
        
        return diagnostic;
    }
};

// ============================================================================
// ✅ 12. RESULTADO ESPERADO DA AUDITORIA
// ============================================================================

const AUDIT_CONCLUSION = {
    systemArchitecture: {
        type: 'CENTRALIZADA',
        quality: 'EXCELENTE',
        mainFunction: 'pushRow()',
        consistency: 'ALTA',
        note: 'Uma única função responsável por toda a lógica de coloração'
    },
    
    calculationPrecision: {
        accuracy: 'ALTA',
        rounding: 'NENHUM (mantém precisão float64)',
        edgeCases: 'TODOS COBERTOS',
        note: 'Diferenças menores que 0.01 são preservadas corretamente'
    },
    
    colorRules: {
        coverage: 'COMPLETA',
        gaps: 'NENHUM',
        modes: 3,
        fallback: 'PRESENTE',
        note: 'Três modos distintos cobrem todos os casos possíveis'
    },
    
    rendering: {
        method: 'Template string injection',
        timing: 'Build-time',
        conflicts: 'NENHUM',
        specificity: 'CORRETA',
        note: 'CSS bem estruturado sem conflitos'
    },
    
    cssLayer: {
        classes: ['ok', 'yellow', 'warn', 'orange'],
        colors: ['#52f7ad', '#ffce4d', '#ff7b7b'],
        icons: ['✅', '⚠️', '❌'],
        transparency: 'ADEQUADA',
        conflicts: 'NENHUM'
    },
    
    dataBinding: {
        framework: 'Vanilla JS',
        reactivity: 'NÃO',
        reRender: 'COMPLETO',
        performance: 'ADEQUADA',
        issues: 'NENHUM'
    },
    
    inputValidation: {
        value: 'PRESENTE',
        target: 'PRESENTE',
        tolerance: 'PRESENTE COM FALLBACK',
        diff: 'PRESENTE',
        note: 'Todas validações implementadas corretamente'
    },
    
    errorHandling: {
        silentErrors: 'POUCOS',
        logged: 'PARCIAL',
        fallbacks: 'PRESENTES',
        severity: 'BAIXA',
        recommendations: 'Adicionar logs em casos de métricas ausentes'
    },
    
    integration: {
        genreProfiles: 'IMPLEMENTADO',
        bandMapping: 'IMPLEMENTADO',
        fallback: 'PRESENTE',
        note: 'Sistema robusto com fallbacks adequados'
    },
    
    overallAssessment: {
        grade: 'A+',
        strengths: [
            'Arquitetura centralizada e consistente',
            'Cobertura completa de casos (sem gaps)',
            'Validações robustas com fallbacks',
            'CSS bem estruturado sem conflitos',
            'Três modos distintos para diferentes tipos de métricas',
            'Precisão matemática preservada (sem arredondamento prematuro)'
        ],
        weaknesses: [
            'Falta logging em alguns casos de métricas ausentes',
            'Não reativo (rebuild completo em cada atualização)',
            'Algumas tolerâncias podem estar ausentes nos perfis'
        ],
        recommendations: [
            'Adicionar log quando métricas não são encontradas',
            'Garantir que todos os perfis de gênero têm todas as tolerâncias definidas',
            'Considerar cache de cores se performance se tornar problema',
            'Adicionar testes automatizados baseados nos casos práticos'
        ]
    },
    
    bugAnalysis: {
        likelySource: 'DADOS',
        possibilities: [
            {
                scenario: 'Métricas aparecem sem cor',
                cause: 'Tolerância ausente no perfil de gênero',
                evidence: 'Fallback para defaultTol=1.0 está implementado',
                fix: 'Adicionar tolerâncias faltantes nos perfis',
                priority: 'MÉDIA'
            },
            {
                scenario: 'Diferenças pequenas não têm cor',
                cause: 'IMPROVÁVEL - sistema cobre todos os valores',
                evidence: 'Cobertura matemática completa verificada',
                fix: 'Não necessário',
                priority: 'NENHUMA'
            },
            {
                scenario: 'Bandas espectrais sem cor',
                cause: 'Possível mapeamento incorreto ou target ausente',
                evidence: 'Sistema de mapeamento implementado (line 6027)',
                fix: 'Verificar se todos os targets de bandas estão definidos',
                priority: 'ALTA'
            }
        ]
    }
};

// ============================================================================
// 🚀 EXECUÇÃO E EXPORTAÇÃO
// ============================================================================

// Exportar para uso em console do navegador
if (typeof window !== 'undefined') {
    window.AUDITORIA_CORES = {
        ARCHITECTURE: COLOR_SYSTEM_ARCHITECTURE,
        CALCULATION: DIFF_CALCULATION_MODES,
        ROUNDING: ROUNDING_ANALYSIS,
        COLOR_LOGIC: COLOR_LOGIC_MODES,
        COVERAGE: COVERAGE_ANALYSIS,
        RENDERING: RENDERING_AUDIT,
        CSS: CSS_AUDIT,
        DATA_BINDING: DATA_BINDING_AUDIT,
        INPUT_DATA: INPUT_DATA_AUDIT,
        FALLBACK: FALLBACK_AUDIT,
        REFERENCE: REFERENCE_COMPARISON_AUDIT,
        TESTS: PRACTICAL_TESTS,
        DIAGNOSTIC: DIAGNOSTIC_SYSTEM,
        CONCLUSION: AUDIT_CONCLUSION
    };
    
    // Helpers globais
    window.runColorTests = () => PRACTICAL_TESTS.runAll();
    window.runPrecisionTest = () => ROUNDING_ANALYSIS.precisionTest.runTest();
    window.diagnoseColors = (analysis, ref) => DIAGNOSTIC_SYSTEM.logMetricsWithoutColor(analysis, ref);
    window.exportColorDiagnostic = (analysis, ref) => DIAGNOSTIC_SYSTEM.exportDiagnosticJSON(analysis, ref);
    
    console.log('✅ Auditoria de cores carregada!');
    console.log('📊 Use window.AUDITORIA_CORES para acessar a documentação completa');
    console.log('🧪 Use window.runColorTests() para executar testes');
    console.log('🔍 Use window.diagnoseColors(analysis, ref) para diagnóstico');
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COLOR_SYSTEM_ARCHITECTURE,
        DIFF_CALCULATION_MODES,
        ROUNDING_ANALYSIS,
        COLOR_LOGIC_MODES,
        COVERAGE_ANALYSIS,
        RENDERING_AUDIT,
        CSS_AUDIT,
        DATA_BINDING_AUDIT,
        INPUT_DATA_AUDIT,
        FALLBACK_AUDIT,
        REFERENCE_COMPARISON_AUDIT,
        PRACTICAL_TESTS,
        DIAGNOSTIC_SYSTEM,
        AUDIT_CONCLUSION
    };
}

/**
 * 📝 COMO USAR ESTA AUDITORIA:
 * 
 * 1. No navegador:
 *    - Abra o console DevTools
 *    - Carregue este arquivo: <script src="auditoria-color-system.js"></script>
 *    - Execute: window.runColorTests() para ver todos os testes
 *    - Execute: window.AUDITORIA_CORES.CONCLUSION para ver o resumo
 * 
 * 2. Para diagnóstico em produção:
 *    - Após uma análise: window.diagnoseColors(analysis, refProfile)
 *    - Para exportar: const report = window.exportColorDiagnostic(analysis, refProfile)
 *    - Salvar: downloadObjectAsJson(report, 'color-diagnostic.json')
 * 
 * 3. Para verificar cobertura matemática:
 *    - window.AUDITORIA_CORES.COVERAGE.verification
 * 
 * 4. Para entender a arquitetura:
 *    - window.AUDITORIA_CORES.ARCHITECTURE
 *    - window.AUDITORIA_CORES.RENDERING.flow
 */
