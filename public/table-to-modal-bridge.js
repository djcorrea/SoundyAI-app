// 🌉 TABLE-TO-MODAL BRIDGE
// Fonte da verdade única: Tabela gera rows, Modal consome rows.filter(severity !== 'OK')
// Garante 1:1 entre tabela vermelha e cards do modal

/**
 * 🎯 FONTE DA VERDADE: Gerar rows canônicas de métricas + bandas
 * 
 * Esta função é a ÚNICA responsável por calcular severidade e ranges.
 * Tanto a tabela quanto o modal DEVEM consumir estas rows.
 * 
 * @param {Object} analysis - Dados completos da análise
 * @param {Object} genreTargets - Targets do gênero (flat object)
 * @returns {Array<Object>} Array de rows: { key, label, value, targetMin, targetMax, targetRecommended, delta, severity, severityClass, actionText }
 */
function generateCanonicalRows(analysis, genreTargets) {
    console.group('[TABLE-MODAL-BRIDGE] 🌉 Gerando Rows Canônicas');
    
    if (!analysis || !genreTargets) {
        console.error('[BRIDGE] ❌ Dados insuficientes:', { analysis: !!analysis, genreTargets: !!genreTargets });
        console.groupEnd();
        return [];
    }
    
    const rows = [];
    
    // ═══════════════════════════════════════════════════════════════════════
    // HELPER: Calcular severidade com suporte a target_range
    // ═══════════════════════════════════════════════════════════════════════
    const calcSeverity = (value, target, tolerance, options = {}) => {
        const { targetRange } = options;
        
        if (!Number.isFinite(value)) {
            return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
        }
        
        // 🎯 PRIORIDADE: target_range se existir
        if (targetRange && typeof targetRange === 'object') {
            const min = targetRange.min ?? targetRange.min_db;
            const max = targetRange.max ?? targetRange.max_db;
            
            if (typeof min !== 'number' || typeof max !== 'number') {
                // Range inválido, fallback para target fixo
                if (target === null || target === undefined) {
                    return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
                }
            } else {
                // ✅ Dentro do range
                if (value >= min && value <= max) {
                    return { 
                        severity: 'OK', 
                        severityClass: 'ok', 
                        action: '✅ Dentro do padrão', 
                        diff: 0,
                        targetMin: min,
                        targetMax: max,
                        targetRecommended: (min + max) / 2
                    };
                }
                
                // ❌ Fora do range: calcular distância
                let diff;
                let absDelta;
                if (value < min) {
                    diff = value - min;  // negativo
                    absDelta = min - value;
                } else {
                    diff = value - max;  // positivo
                    absDelta = value - max;
                }
                
                // Thresholds para severidade
                if (absDelta >= 2) {
                    const action = diff > 0 ? `🔴 Reduzir ${absDelta.toFixed(1)} dB` : `🔴 Aumentar ${absDelta.toFixed(1)} dB`;
                    return { 
                        severity: 'CRÍTICA', 
                        severityClass: 'critical', 
                        action, 
                        diff,
                        targetMin: min,
                        targetMax: max,
                        targetRecommended: (min + max) / 2
                    };
                } else {
                    const action = diff > 0 ? `⚠️ Reduzir ${absDelta.toFixed(1)} dB` : `⚠️ Aumentar ${absDelta.toFixed(1)} dB`;
                    return { 
                        severity: 'ATENÇÃO', 
                        severityClass: 'caution', 
                        action, 
                        diff,
                        targetMin: min,
                        targetMax: max,
                        targetRecommended: (min + max) / 2
                    };
                }
            }
        }
        
        // 🔄 FALLBACK: target fixo (métricas sem range)
        if (target === null || target === undefined) {
            return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
        }
        
        const diff = value - target;
        const absDiff = Math.abs(diff);
        
        if (absDiff <= tolerance) {
            return { 
                severity: 'OK', 
                severityClass: 'ok', 
                action: '✅ Dentro do padrão', 
                diff,
                targetMin: target - tolerance,
                targetMax: target + tolerance,
                targetRecommended: target
            };
        } else if (absDiff <= tolerance * 2) {
            const action = diff > 0 ? `⚠️ Reduzir ${absDiff.toFixed(1)}` : `⚠️ Aumentar ${absDiff.toFixed(1)}`;
            return { 
                severity: 'ATENÇÃO', 
                severityClass: 'caution', 
                action, 
                diff,
                targetMin: target - tolerance,
                targetMax: target + tolerance,
                targetRecommended: target
            };
        } else if (absDiff <= tolerance * 3) {
            const action = diff > 0 ? `🟡 Reduzir ${absDiff.toFixed(1)}` : `🟡 Aumentar ${absDiff.toFixed(1)}`;
            return { 
                severity: 'ALTA', 
                severityClass: 'warning', 
                action, 
                diff,
                targetMin: target - tolerance,
                targetMax: target + tolerance,
                targetRecommended: target
            };
        } else {
            const action = diff > 0 ? `🔴 Reduzir ${absDiff.toFixed(1)}` : `🔴 Aumentar ${absDiff.toFixed(1)}`;
            return { 
                severity: 'CRÍTICA', 
                severityClass: 'critical', 
                action, 
                diff,
                targetMin: target - tolerance,
                targetMax: target + tolerance,
                targetRecommended: target
            };
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // 1️⃣ MÉTRICAS PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🔊 LUFS
    const lufsIntegrated = analysis.loudness?.integrated ?? analysis.technicalData?.lufsIntegrated ?? null;
    if (Number.isFinite(lufsIntegrated) && Number.isFinite(genreTargets.lufs_target)) {
        const result = calcSeverity(lufsIntegrated, genreTargets.lufs_target, genreTargets.tol_lufs || 1.0);
        rows.push({
            key: 'lufsIntegrated',
            label: '🔊 Loudness (LUFS Integrado)',
            value: lufsIntegrated,
            valueFormatted: `${lufsIntegrated.toFixed(2)} LUFS`,
            unit: 'LUFS',
            ...result
        });
    }
    
    // ⚡ TRUE PEAK
    const truePeakDbtp = analysis.truePeakDbtp ?? analysis.truePeak?.maxDbtp ?? analysis.technicalData?.truePeakDbtp ?? null;
    if (Number.isFinite(truePeakDbtp) && Number.isFinite(genreTargets.true_peak_target)) {
        const result = calcSeverity(truePeakDbtp, genreTargets.true_peak_target, genreTargets.tol_true_peak || 0.5);
        rows.push({
            key: 'truePeak',
            label: '⚡ True Peak',
            value: truePeakDbtp,
            valueFormatted: `${truePeakDbtp.toFixed(2)} dBTP`,
            unit: 'dBTP',
            ...result
        });
    }
    
    // 📊 DYNAMIC RANGE (DR)
    const dynamicRange = analysis.dynamicRange ?? analysis.dynamics?.range ?? analysis.technicalData?.dynamicRange ?? null;
    if (Number.isFinite(dynamicRange) && Number.isFinite(genreTargets.dr_target)) {
        const result = calcSeverity(dynamicRange, genreTargets.dr_target, genreTargets.tol_dr || 1.0);
        rows.push({
            key: 'dr',
            label: '📊 Dynamic Range (DR)',
            value: dynamicRange,
            valueFormatted: `${dynamicRange.toFixed(1)} dB DR`,
            unit: 'dB',
            ...result
        });
    }
    
    // 📉 LRA
    const lra = analysis.lra ?? analysis.loudness?.lra ?? analysis.technicalData?.lra ?? null;
    if (Number.isFinite(lra) && Number.isFinite(genreTargets.lra_target)) {
        const result = calcSeverity(lra, genreTargets.lra_target, genreTargets.tol_lra || 2.0);
        rows.push({
            key: 'lra',
            label: '📉 LRA (Loudness Range)',
            value: lra,
            valueFormatted: `${lra.toFixed(1)} LU`,
            unit: 'LU',
            ...result
        });
    }
    
    // 🎚️ STEREO
    const stereoCorrelation = analysis.stereoCorrelation ?? analysis.stereo?.correlation ?? analysis.technicalData?.stereoCorrelation ?? null;
    if (Number.isFinite(stereoCorrelation) && Number.isFinite(genreTargets.stereo_target)) {
        const result = calcSeverity(stereoCorrelation, genreTargets.stereo_target, genreTargets.tol_stereo || 0.1);
        rows.push({
            key: 'stereo',
            label: '🎚️ Correlação Estéreo',
            value: stereoCorrelation,
            valueFormatted: `${stereoCorrelation.toFixed(3)}`,
            unit: '',
            ...result
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2️⃣ BANDAS ESPECTRAIS (CANÔNICAS)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Buscar bandas do usuário
    const technicalBands = analysis.technicalData?.bands;
    const centralizedBands = analysis.metrics?.bands;
    const spectralBalance = analysis.technicalData?.spectral_balance;
    const legacyBandEnergies = analysis.technicalData?.bandEnergies;

    const userBands = 
        (technicalBands && Object.keys(technicalBands).length > 0) ? technicalBands :
        (centralizedBands && Object.keys(centralizedBands).length > 0) ? centralizedBands :
        (spectralBalance && Object.keys(spectralBalance).length > 0) ? spectralBalance :
        legacyBandEnergies;
    
    // Buscar bandas do target
    const targetBands = genreTargets.bands || genreTargets.spectral_bands || {};
    
    // 🎯 BANDAS CANÔNICAS (ORDEM FIXA)
    const canonicalBands = [
        { key: 'sub', label: '🔉 Sub (20-60 Hz)', freq: '20-60 Hz', group: 'LOW END' },
        { key: 'low_bass', label: '🔊 Bass (60-120 Hz)', freq: '60-120 Hz', group: 'LOW END' },
        { key: 'low_mid', label: '🎵 Low Mid (250-500 Hz)', freq: '250-500 Hz', group: 'MID' },
        { key: 'mid', label: '🎵 Mid (500-2k Hz)', freq: '500-2k Hz', group: 'MID' },
        { key: 'high_mid', label: '🎸 High Mid (2k-4k Hz)', freq: '2k-4k Hz', group: 'HIGH' },
        { key: 'brilho', label: '✨ Brilho (4k-10k Hz)', freq: '4k-10k Hz', group: 'HIGH' },
        { key: 'presenca', label: '💎 Presença (10k-20k Hz)', freq: '10k-20k Hz', group: 'HIGH' }
    ];
    
    canonicalBands.forEach(({ key, label, freq, group }) => {
        // Buscar target da banda
        const targetBand = targetBands[key];
        if (!targetBand) {
            console.log(`[BRIDGE] ⏭️ Banda ${key} sem target, pulando`);
            return;
        }
        
        // Buscar valor do usuário
        const bandData = userBands?.[key];
        if (!bandData) {
            console.log(`[BRIDGE] ⏭️ Banda ${key} sem dados do usuário, pulando`);
            return;
        }
        
        // Extrair valor numérico
        let energyDb = null;
        if (typeof bandData === 'number') {
            energyDb = bandData;
        } else if (typeof bandData === 'object') {
            energyDb = bandData.energy_db ?? bandData.rms_db ?? bandData.db ?? null;
        }
        
        if (!Number.isFinite(energyDb)) {
            console.log(`[BRIDGE] ⏭️ Banda ${key} sem valor numérico válido, pulando`);
            return;
        }
        
        // 🎯 USAR target_range SE EXISTIR, senão fallback para target_db ± tol_db
        const hasRange = targetBand.target_range 
            && (typeof targetBand.target_range.min === 'number' || typeof targetBand.target_range.min_db === 'number')
            && (typeof targetBand.target_range.max === 'number' || typeof targetBand.target_range.max_db === 'number');
        
        const targetRange = hasRange ? targetBand.target_range : null;
        const targetValue = targetBand.target_db ?? null;
        const tolerance = targetBand.tol_db ?? 3.0;
        
        // Calcular severidade
        const result = calcSeverity(energyDb, targetValue, tolerance, { targetRange });
        
        rows.push({
            key: key,
            label: label,
            value: energyDb,
            valueFormatted: `${energyDb.toFixed(2)} dB`,
            unit: 'dB',
            frequency: freq,
            group: group,
            ...result
        });
        
        console.log(`[BRIDGE] ✅ Banda ${key}: ${energyDb.toFixed(2)} dB | Target: ${targetRange ? `[${targetRange.min}, ${targetRange.max}]` : targetValue} | ${result.severity}`);
    });
    
    console.log('[BRIDGE] 📊 Total de rows geradas:', rows.length);
    console.log('[BRIDGE] 🔴 Rows problemáticas (≠ OK):', rows.filter(r => r.severity !== 'OK').length);
    console.groupEnd();
    
    return rows;
}

/**
 * 🎴 Converter row em card de sugestão para o modal
 * @param {Object} row - Row canônica
 * @returns {Object} Objeto de sugestão formatado para o modal
 */
function rowToSuggestionCard(row) {
    // Mapeamento de keys para categorias do modal
    const categoryMap = {
        lufsIntegrated: 'Loudness',
        truePeak: 'True Peak',
        dr: 'Dinâmica',
        lra: 'Dinâmica',
        stereo: 'Estéreo',
        // Bandas
        sub: 'Espectro',
        low_bass: 'Espectro',
        low_mid: 'Espectro',
        mid: 'Espectro',
        high_mid: 'Espectro',
        brilho: 'Espectro',
        presenca: 'Espectro'
    };
    
    return {
        categoria: categoryMap[row.key] || 'Geral',
        nivel: row.severity === 'CRÍTICA' ? 1 : (row.severity === 'ALTA' ? 2 : (row.severity === 'ATENÇÃO' ? 3 : 5)),
        problema: `${row.label} está em ${row.valueFormatted}`,
        causaProvavel: `Valor fora da faixa ideal para o gênero (${row.targetMin.toFixed(1)} a ${row.targetMax.toFixed(1)} ${row.unit})`,
        solucao: row.action,
        pluginRecomendado: row.group === 'LOW END' || row.group === 'MID' || row.group === 'HIGH' ? 'EQ' : 'Dynamics',
        dicaExtra: `Delta: ${row.diff >= 0 ? '+' : ''}${row.diff.toFixed(2)} ${row.unit}`,
        
        // Dados técnicos para validação
        _tableRow: row,
        _metricKey: row.key,
        _severity: row.severity,
        _group: row.group || null
    };
}

// Exportar funções globalmente
window.generateCanonicalRows = generateCanonicalRows;
window.rowToSuggestionCard = rowToSuggestionCard;

console.log('[TABLE-MODAL-BRIDGE] 🌉 Bridge carregado e pronto');
