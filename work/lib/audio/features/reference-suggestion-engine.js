/**
 * 🎯 REFERENCE SUGGESTION ENGINE
 * 
 * Gera sugestões baseadas na COMPARAÇÃO entre duas músicas (base vs compare).
 * Diferente do genre engine (que compara com targets estáticos), este engine
 * analisa DELTAS entre duas análises reais.
 * 
 * CONTRATO:
 * - Recebe: baseMetrics (1ª música) + compareMetrics (2ª música)
 * - Retorna: aiSuggestions[] em formato compatível com UI
 * 
 * TOLERÂNCIAS:
 * - LUFS: ±1.0 (diferença aceitável entre faixas)
 * - TruePeak: ±0.3 dBTP
 * - Dynamic Range: ±1.5 dB
 * - LRA (Loudness Range): ±2.0 LU
 * - Stereo Width: ±10%
 * - Bands (Low/Mid/High): ±2.0 dB
 */

/**
 * Gera sugestões de comparação entre base e compare
 * @param {Object} baseMetrics - Métricas da música base (1ª)
 * @param {Object} compareMetrics - Métricas da música atual (2ª)
 * @returns {Array} Array de sugestões no formato UI
 */
export function referenceSuggestionEngine(baseMetrics, compareMetrics) {
  console.log('[REFERENCE-ENGINE] Iniciando análise comparativa...');
  console.log('[REFERENCE-ENGINE] Base:', baseMetrics?.metadata?.fileName || 'N/A');
  console.log('[REFERENCE-ENGINE] Compare:', compareMetrics?.metadata?.fileName || 'N/A');

  const suggestions = [];

  // ══════════════════════════════════════════════════════════
  // VALIDAÇÃO: Verificar se métricas estão presentes
  // ══════════════════════════════════════════════════════════
  if (!baseMetrics || !compareMetrics) {
    console.error('[REFERENCE-ENGINE] ❌ Métricas ausentes!');
    console.error('[REFERENCE-ENGINE] Base presente:', !!baseMetrics);
    console.error('[REFERENCE-ENGINE] Compare presente:', !!compareMetrics);
    return [];
  }

  if (!baseMetrics.technicalData || !compareMetrics.technicalData) {
    console.error('[REFERENCE-ENGINE] ❌ TechnicalData ausente!');
    return [];
  }

  // ══════════════════════════════════════════════════════════
  // EXTRAÇÃO DE MÉTRICAS
  // ══════════════════════════════════════════════════════════
  const baseTech = baseMetrics.technicalData;
  const compareTech = compareMetrics.technicalData;

  const baseLUFS = baseTech.lufsIntegrated;
  const compareLUFS = compareTech.lufsIntegrated;
  
  const baseTP = baseTech.truePeakDbtp;
  const compareTP = compareTech.truePeakDbtp;
  
  const baseDR = baseTech.dynamicRange;
  const compareDR = compareTech.dynamicRange;
  
  const baseLRA = baseTech.loudnessRange;
  const compareLRA = compareTech.loudnessRange;

  // Stereo (opcional)
  const baseStereo = baseTech.stereoWidth || baseMetrics.metrics?.stereoImaging?.width;
  const compareStereo = compareTech.stereoWidth || compareMetrics.metrics?.stereoImaging?.width;

  // Bandas (opcional)
  const baseBands = baseMetrics.metrics?.spectralBalance?.bands;
  const compareBands = compareMetrics.metrics?.spectralBalance?.bands;

  console.log('[REFERENCE-ENGINE] Deltas:', {
    LUFS: (compareLUFS - baseLUFS).toFixed(2),
    TP: (compareTP - baseTP).toFixed(2),
    DR: (compareDR - baseDR).toFixed(2),
    LRA: compareLRA && baseLRA ? (compareLRA - baseLRA).toFixed(2) : 'N/A'
  });

  // ══════════════════════════════════════════════════════════
  // 1️⃣ COMPARAÇÃO: LOUDNESS (LUFS)
  // ══════════════════════════════════════════════════════════
  if (baseLUFS && compareLUFS) {
    const deltaLUFS = compareLUFS - baseLUFS;
    const absLUFS = Math.abs(deltaLUFS);

    if (absLUFS > 1.0) {
      const direction = deltaLUFS > 0 ? 'mais alto' : 'mais baixo';
      const severity = absLUFS > 3.0 ? 'crítico' : absLUFS > 2.0 ? 'alto' : 'médio';

      suggestions.push({
        categoria: 'Loudness',
        nivel: severity,
        problema: `Sua música está ${absLUFS.toFixed(1)} LUFS ${direction} que a referência`,
        solucao: `Ajuste o nível geral para aproximar do ${baseLUFS.toFixed(1)} LUFS da música base`,
        detalhes: {
          baseValue: baseLUFS.toFixed(1),
          compareValue: compareLUFS.toFixed(1),
          delta: deltaLUFS.toFixed(1),
          tolerancia: '±1.0 LUFS'
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated'
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 2️⃣ COMPARAÇÃO: TRUE PEAK
  // ══════════════════════════════════════════════════════════
  if (baseTP && compareTP) {
    const deltaTP = compareTP - baseTP;
    const absTP = Math.abs(deltaTP);

    if (absTP > 0.3) {
      const direction = deltaTP > 0 ? 'maior' : 'menor';
      const severity = absTP > 1.0 ? 'alto' : 'médio';

      suggestions.push({
        categoria: 'TruePeak',
        nivel: severity,
        problema: `Seu pico está ${absTP.toFixed(1)} dBTP ${direction} que a referência`,
        solucao: `Ajuste o limiter para aproximar do ${baseTP.toFixed(1)} dBTP da música base`,
        detalhes: {
          baseValue: baseTP.toFixed(1),
          compareValue: compareTP.toFixed(1),
          delta: deltaTP.toFixed(1),
          tolerancia: '±0.3 dBTP'
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated'
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 3️⃣ COMPARAÇÃO: DYNAMIC RANGE
  // ══════════════════════════════════════════════════════════
  if (baseDR && compareDR) {
    const deltaDR = compareDR - baseDR;
    const absDR = Math.abs(deltaDR);

    if (absDR > 1.5) {
      const direction = deltaDR > 0 ? 'maior' : 'menor';
      const severity = absDR > 3.0 ? 'alto' : 'médio';

      suggestions.push({
        categoria: 'DynamicRange',
        nivel: severity,
        problema: `Sua dinâmica está ${absDR.toFixed(1)} dB ${direction} que a referência`,
        solucao: `Ajuste compressão/expansão para aproximar dos ${baseDR.toFixed(1)} dB da música base`,
        detalhes: {
          baseValue: baseDR.toFixed(1),
          compareValue: compareDR.toFixed(1),
          delta: deltaDR.toFixed(1),
          tolerancia: '±1.5 dB'
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated'
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 4️⃣ COMPARAÇÃO: LOUDNESS RANGE (LRA)
  // ══════════════════════════════════════════════════════════
  if (baseLRA && compareLRA) {
    const deltaLRA = compareLRA - baseLRA;
    const absLRA = Math.abs(deltaLRA);

    if (absLRA > 2.0) {
      const direction = deltaLRA > 0 ? 'maior' : 'menor';
      
      suggestions.push({
        categoria: 'LoudnessRange',
        nivel: 'médio',
        problema: `Sua variação de loudness está ${absLRA.toFixed(1)} LU ${direction} que a referência`,
        solucao: `Revise automações e dinâmica para aproximar dos ${baseLRA.toFixed(1)} LU da base`,
        detalhes: {
          baseValue: baseLRA.toFixed(1),
          compareValue: compareLRA.toFixed(1),
          delta: deltaLRA.toFixed(1),
          tolerancia: '±2.0 LU'
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated'
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 5️⃣ COMPARAÇÃO: STEREO WIDTH
  // ══════════════════════════════════════════════════════════
  if (baseStereo && compareStereo) {
    const deltaStereo = compareStereo - baseStereo;
    const absStereo = Math.abs(deltaStereo);

    if (absStereo > 10) {
      const direction = deltaStereo > 0 ? 'mais aberto' : 'mais estreito';

      suggestions.push({
        categoria: 'StereoImaging',
        nivel: 'baixo',
        problema: `Seu campo estéreo está ${absStereo.toFixed(0)}% ${direction} que a referência`,
        solucao: `Ajuste width plugins ou panning para aproximar dos ${baseStereo.toFixed(0)}% da base`,
        detalhes: {
          baseValue: `${baseStereo.toFixed(0)}%`,
          compareValue: `${compareStereo.toFixed(0)}%`,
          delta: `${deltaStereo.toFixed(0)}%`,
          tolerancia: '±10%'
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated'
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 6️⃣ COMPARAÇÃO: SPECTRAL BANDS (LOW/MID/HIGH)
  // ══════════════════════════════════════════════════════════
  if (baseBands && compareBands) {
    const bandNames = ['low', 'mid', 'high'];
    const bandLabels = { low: 'Graves', mid: 'Médios', high: 'Agudos' };

    bandNames.forEach(band => {
      const baseVal = baseBands[band];
      const compareVal = compareBands[band];

      if (baseVal && compareVal) {
        const delta = compareVal - baseVal;
        const abs = Math.abs(delta);

        if (abs > 2.0) {
          const direction = delta > 0 ? 'reforçados' : 'atenuados';

          suggestions.push({
            categoria: 'SpectralBalance',
            nivel: abs > 4.0 ? 'alto' : 'médio',
            problema: `${bandLabels[band]} estão ${abs.toFixed(1)} dB ${direction} em relação à referência`,
            solucao: `Ajuste EQ na faixa ${bandLabels[band].toLowerCase()} para aproximar dos ${baseVal.toFixed(1)} dB da base`,
            detalhes: {
              band,
              baseValue: baseVal.toFixed(1),
              compareValue: compareVal.toFixed(1),
              delta: delta.toFixed(1),
              tolerancia: '±2.0 dB'
            },
            aiEnhanced: false,
            enrichmentStatus: 'comparison-generated'
          });
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ══════════════════════════════════════════════════════════
  console.log('[REFERENCE-ENGINE] ✅ Geradas', suggestions.length, 'sugestões comparativas');
  
  if (suggestions.length === 0) {
    console.log('[REFERENCE-ENGINE] ✅ Músicas muito similares - nenhuma sugestão necessária');
  }

  return suggestions;
}
