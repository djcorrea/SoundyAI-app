/**
 * ðŸŽ¯ FUNÃ‡Ã•ES DE VALIDAÃ‡ÃƒO E NORMALIZAÃ‡ÃƒO PARA RELATÃ“RIOS PDF
 * 
 * INSTRUÃ‡Ã•ES DE USO:
 * 1. Abra audio-analyzer-integration.js
 * 2. Localize a linha ~8067: "// ðŸŽ¯ Normalizar dados da anÃ¡lise..."
 * 3. Cole TODO o conteÃºdo deste arquivo ANTES dessa linha
 * 4. Salve e teste
 * 
 * Ãšltima atualizaÃ§Ã£o: 30/10/2025
 */

// ðŸ” VALIDAÃ‡ÃƒO: Comparar dados do relatÃ³rio com a UI
function validateAnalysisDataAgainstUI(analysis) {
    log('ðŸ” [PDF-VALIDATE] Iniciando validaÃ§Ã£o contra UI...');
    
    const assertEqual = (label, pdfValue, uiSelector, tolerance = 0.01) => {
        const uiElement = document.querySelector(uiSelector);
        if (!uiElement) {
            warn(`âš ï¸ [PDF-VALIDATE] Elemento UI nÃ£o encontrado: ${uiSelector}`);
            return;
        }
        
        // Tentar extrair valor de data-value, dataset ou textContent
        let uiValue = uiElement.dataset?.value || 
                     uiElement.getAttribute('data-value') ||
                     parseFloat(uiElement.textContent.replace(/[^0-9.-]/g, ''));
        
        if (isNaN(uiValue)) {
            warn(`âš ï¸ [PDF-VALIDATE] Valor UI nÃ£o numÃ©rico em ${uiSelector}`);
            return;
        }
        
        if (pdfValue == null || isNaN(pdfValue)) {
            warn(`âš ï¸ [PDF-VALIDATE] Valor PDF ausente para ${label}`);
            return;
        }
        
        const diff = Math.abs(Number(pdfValue) - Number(uiValue));
        const ok = diff < tolerance;
        
        if (!ok) {
            warn(`ðŸš¨ [PDF-VALIDATE] DIVERGÃŠNCIA em ${label}:`, {
                pdf: pdfValue,
                ui: uiValue,
                diferenca: diff.toFixed(3)
            });
        } else {
            log(`âœ… [PDF-VALIDATE] ${label}: OK (diff=${diff.toFixed(4)})`);
        }
    };
    
    // ValidaÃ§Ãµes principais
    try {
        // LUFS Integrado
        const lufsValue = analysis.lufsIntegrated || 
                         analysis.loudness?.integrated ||
                         analysis.technicalData?.lufsIntegrated;
        if (lufsValue) {
            assertEqual('LUFS Integrado', lufsValue, '[data-metric="lufs-integrated"]', 0.1);
        }
        
        // True Peak
        const truePeakValue = analysis.truePeakDbtp ||
                             analysis.truePeak?.maxDbtp ||
                             analysis.technicalData?.truePeakDbtp;
        if (truePeakValue) {
            assertEqual('True Peak', truePeakValue, '[data-metric="true-peak"]', 0.1);
        }
        
        // Dynamic Range
        const drValue = analysis.dynamicRange ||
                       analysis.dynamics?.range ||
                       analysis.technicalData?.dynamicRange;
        if (drValue) {
            assertEqual('Dynamic Range', drValue, '[data-metric="dynamic-range"]', 0.5);
        }
        
        // Score
        if (analysis.score) {
            assertEqual('Score', analysis.score, '.score-final-value', 1);
        }
        
        log('âœ… [PDF-VALIDATE] ValidaÃ§Ã£o concluÃ­da');
        
    } catch (error) {
        error('âŒ [PDF-VALIDATE] Erro na validaÃ§Ã£o:', error);
    }
}

// ðŸŽ¯ Normalizar dados da anÃ¡lise para formato compatÃ­vel com PDF (NOVA VERSÃƒO ROBUSTA)
function normalizeAnalysisDataForPDF(analysis) {
    log('ðŸ“Š [PDF-NORMALIZE] ============ INÃCIO DA NORMALIZAÃ‡ÃƒO ============');
    log('ðŸ“Š [PDF-NORMALIZE] Estrutura recebida:', {
        keys: Object.keys(analysis),
        fileName: analysis.fileName || analysis.metadata?.fileName,
        mode: analysis.analysisMode || analysis.mode,
        score: analysis.score,
        hasLufsRoot: !!analysis.lufsIntegrated,
        hasTruePeakRoot: !!analysis.truePeakDbtp,
        hasDRRoot: !!analysis.dynamicRange,
        hasLoudnessObj: !!analysis.loudness,
        hasTruePeakObj: !!analysis.truePeak,
        hasDynamicsObj: !!analysis.dynamics,
        hasBands: !!(analysis.bands || analysis.spectralBands)
    });
    
    // âœ… HELPER: Formatar valor com fallback "â€”" ou "N/A"
    const formatValue = (val, decimals = 1, unit = '') => {
        if (val === null || val === undefined || isNaN(val)) return 'â€”';
        return `${Number(val).toFixed(decimals)}${unit}`;
    };
    
    // âœ… HELPER: Extrair valor com mÃºltiplos fallbacks
    const extract = (...paths) => {
        for (const path of paths) {
            if (typeof path === 'function') {
                const val = path();
                if (Number.isFinite(val)) return val;
            } else if (Number.isFinite(path)) {
                return path;
            }
        }
        return null;
    };
    
    // ðŸ“Š EXTRAÃ‡ÃƒO DE MÃ‰TRICAS (MÃºltiplos caminhos)
    
    // Loudness
    const lufsIntegrated = extract(
        analysis.lufsIntegrated,
        analysis.loudness?.integrated,
        analysis.technicalData?.lufsIntegrated,
        analysis.technicalData?.lufs_integrated,
        analysis.metrics?.loudness?.integrated
    );
    
    const lufsShortTerm = extract(
        analysis.avgLoudness,
        analysis.loudness?.shortTerm,
        analysis.technicalData?.avgLoudness,
        analysis.metrics?.loudness?.shortTerm
    );
    
    const lufsMomentary = extract(
        lufsShortTerm, // Fallback para short term
        analysis.loudness?.momentary,
        analysis.metrics?.loudness?.momentary
    );
    
    const lra = extract(
        analysis.lra,
        analysis.loudness?.lra,
        analysis.technicalData?.lra,
        analysis.metrics?.loudness?.lra
    );
    
    log('ðŸŽ§ [PDF-NORMALIZE] Loudness extraÃ­do:', {
        integrated: lufsIntegrated,
        shortTerm: lufsShortTerm,
        momentary: lufsMomentary,
        lra: lra
    });
    
    // True Peak
    const truePeakDbtp = extract(
        analysis.truePeakDbtp,
        analysis.truePeak?.maxDbtp,
        analysis.technicalData?.truePeakDbtp,
        analysis.metrics?.truePeak?.maxDbtp
    );
    
    const clippingSamples = extract(
        analysis.truePeak?.clipping?.samples,
        analysis.clipping?.samples,
        0
    );
    
    const clippingPercentage = extract(
        analysis.truePeak?.clipping?.percentage,
        analysis.clipping?.percentage,
        0
    );
    
    log('âš™ï¸ [PDF-NORMALIZE] True Peak extraÃ­do:', {
        maxDbtp: truePeakDbtp,
        clipping: { samples: clippingSamples, percentage: clippingPercentage }
    });
    
    // DinÃ¢mica
    const dynamicRange = extract(
        analysis.dynamicRange,
        analysis.dynamics?.range,
        analysis.technicalData?.dynamicRange,
        analysis.metrics?.dynamics?.range
    );
    
    const crestFactor = extract(
        analysis.crestFactor,
        analysis.dynamics?.crest,
        analysis.technicalData?.crestFactor,
        analysis.metrics?.dynamics?.crest
    );
    
    log('ðŸŽšï¸ [PDF-NORMALIZE] DinÃ¢mica extraÃ­da:', {
        range: dynamicRange,
        crest: crestFactor
    });
    
    // Stereo
    const stereoWidth = extract(
        analysis.stereo?.width,
        analysis.stereoWidth,
        analysis.technicalData?.stereoWidth,
        analysis.metrics?.stereo?.width
    );
    
    const stereoCorrelation = extract(
        analysis.stereoCorrelation,
        analysis.stereo?.correlation,
        analysis.technicalData?.stereoCorrelation,
        analysis.metrics?.stereo?.correlation
    );
    
    const monoCompatibility = extract(
        analysis.stereo?.monoCompatibility,
        analysis.monoCompatibility,
        analysis.technicalData?.monoCompatibility,
        analysis.metrics?.stereo?.monoCompatibility
    );
    
    log('ðŸŽ›ï¸ [PDF-NORMALIZE] Stereo extraÃ­do:', {
        width: stereoWidth,
        correlation: stereoCorrelation,
        monoCompatibility: monoCompatibility
    });
    
    // Bandas Espectrais
    const bandsSource = analysis.bands || analysis.spectralBands || analysis.spectral?.bands || {};
    
    const spectralSub = extract(
        bandsSource.sub?.rms_db,
        bandsSource.subBass?.rms_db,
        bandsSource.sub,
        bandsSource.subBass
    );
    
    const spectralBass = extract(
        bandsSource.bass?.rms_db,
        bandsSource.low?.rms_db,
        bandsSource.bass,
        bandsSource.low
    );
    
    const spectralMid = extract(
        bandsSource.mid?.rms_db,
        bandsSource.midrange?.rms_db,
        bandsSource.mid,
        bandsSource.midrange
    );
    
    const spectralHigh = extract(
        bandsSource.high?.rms_db,
        bandsSource.presence?.rms_db,
        bandsSource.treble?.rms_db,
        bandsSource.high,
        bandsSource.presence,
        bandsSource.treble
    );
    
    log('ðŸ“ˆ [PDF-NORMALIZE] Bandas espectrais extraÃ­das:', {
        sub: spectralSub,
        bass: spectralBass,
        mid: spectralMid,
        high: spectralHigh
    });
    
    // Score e ClassificaÃ§Ã£o
    const score = Math.round(analysis.score || analysis.scoring?.final || 0);
    const classification = analysis.classification || 
                          analysis.scoring?.classification ||
                          getClassificationFromScore(score);
    
    // Metadados do Arquivo
    const fileName = analysis.fileName || 
                    analysis.metadata?.fileName ||
                    analysis.fileKey?.split('/').pop() ||
                    'audio_sem_nome.wav';
    
    const duration = extract(
        analysis.duration,
        analysis.metadata?.duration,
        0
    );
    
    const sampleRate = extract(
        analysis.sampleRate,
        analysis.metadata?.sampleRate,
        44100
    );
    
    const channels = extract(
        analysis.channels,
        analysis.metadata?.channels,
        2
    );
    
    // DiagnÃ³stico e RecomendaÃ§Ãµes
    const diagnostics = Array.isArray(analysis.problems) ? analysis.problems.map(p => p.message || p) :
                       Array.isArray(analysis.diagnostics) ? analysis.diagnostics :
                       [];
    
    const recommendations = Array.isArray(analysis.suggestions) ? analysis.suggestions.map(s => s.message || s.action || s) :
                           Array.isArray(analysis.recommendations) ? analysis.recommendations :
                           [];
    
    // ðŸ“¦ RESULTADO NORMALIZADO
    const normalizedResult = {
        score,
        classification,
        fileName,
        duration,
        sampleRate,
        channels,
        bitDepth: analysis.bitDepth || analysis.metadata?.bitDepth || 'N/A',
        loudness: {
            integrated: formatValue(lufsIntegrated, 1),
            shortTerm: formatValue(lufsShortTerm, 1),
            momentary: formatValue(lufsMomentary, 1),
            lra: formatValue(lra, 1)
        },
        truePeak: {
            maxDbtp: formatValue(truePeakDbtp, 2),
            clipping: {
                samples: clippingSamples || 0,
                percentage: formatValue(clippingPercentage, 2)
            }
        },
        dynamics: {
            range: formatValue(dynamicRange, 1),
            crest: formatValue(crestFactor, 1)
        },
        spectral: {
            sub: formatValue(spectralSub, 1),
            bass: formatValue(spectralBass, 1),
            mid: formatValue(spectralMid, 1),
            high: formatValue(spectralHigh, 1)
        },
        stereo: {
            width: formatValue(stereoWidth * 100, 1), // Converter para %
            correlation: formatValue(stereoCorrelation, 2),
            monoCompatibility: formatValue(monoCompatibility * 100, 1) // Converter para %
        },
        diagnostics: diagnostics.length > 0 ? diagnostics : ['âœ… Nenhum problema detectado'],
        recommendations: recommendations.length > 0 ? recommendations : ['âœ… AnÃ¡lise completa']
    };
    
    log('âœ… [PDF-NORMALIZE] Resultado normalizado:', normalizedResult);
    log('ðŸ“Š [PDF-NORMALIZE] ============ FIM DA NORMALIZAÃ‡ÃƒO ============');
    
    return normalizedResult;
}
