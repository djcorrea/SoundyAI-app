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
  // RESULTADO FINAL + FALLBACK OBRIGATÓRIO
  // ══════════════════════════════════════════════════════════
  console.log('[REFERENCE-ENGINE] ✅ Geradas', suggestions.length, 'sugestões comparativas');
  
  // 🛡️ CONTRATO OBRIGATÓRIO: Análise de referência SEMPRE retorna sugestões
  // Se não há diferenças significativas, gerar sugestão informativa + sugestões das MAIORES diferenças
  if (suggestions.length === 0) {
    console.log('[REFERENCE-ENGINE] ⚠️ Nenhuma diferença acima da tolerância - gerando sugestões das maiores diferenças');
    
    // Calcular TODAS as diferenças para identificar as mais relevantes
    const allDeltas = [];
    
    // LUFS
    const deltaLUFS = (compareTech.lufsIntegrated || 0) - (baseTech.lufsIntegrated || 0);
    if (baseTech.lufsIntegrated && compareTech.lufsIntegrated) {
      allDeltas.push({ 
        type: 'LUFS', 
        delta: deltaLUFS, 
        abs: Math.abs(deltaLUFS),
        base: baseTech.lufsIntegrated,
        compare: compareTech.lufsIntegrated,
        unit: 'LUFS',
        tolerancia: 1.0
      });
    }
    
    // True Peak
    const deltaTP = (compareTech.truePeakDbtp || 0) - (baseTech.truePeakDbtp || 0);
    if (baseTech.truePeakDbtp && compareTech.truePeakDbtp) {
      allDeltas.push({ 
        type: 'TruePeak', 
        delta: deltaTP, 
        abs: Math.abs(deltaTP),
        base: baseTech.truePeakDbtp,
        compare: compareTech.truePeakDbtp,
        unit: 'dBTP',
        tolerancia: 0.3
      });
    }
    
    // Dynamic Range
    const deltaDR = (compareTech.dynamicRange || 0) - (baseTech.dynamicRange || 0);
    if (baseTech.dynamicRange && compareTech.dynamicRange) {
      allDeltas.push({ 
        type: 'DynamicRange', 
        delta: deltaDR, 
        abs: Math.abs(deltaDR),
        base: baseTech.dynamicRange,
        compare: compareTech.dynamicRange,
        unit: 'dB',
        tolerancia: 1.5
      });
    }
    
    // LRA
    const deltaLRA = (compareTech.loudnessRange || 0) - (baseTech.loudnessRange || 0);
    if (baseTech.loudnessRange && compareTech.loudnessRange) {
      allDeltas.push({ 
        type: 'LoudnessRange', 
        delta: deltaLRA, 
        abs: Math.abs(deltaLRA),
        base: baseTech.loudnessRange,
        compare: compareTech.loudnessRange,
        unit: 'LU',
        tolerancia: 2.0
      });
    }
    
    // Ordenar por relevância (maior delta proporcional à tolerância)
    allDeltas.sort((a, b) => (b.abs / b.tolerancia) - (a.abs / a.tolerancia));
    
    // 🎯 GERAR SUGESTÕES INFORMATIVAS DAS TOP 3 DIFERENÇAS (mesmo abaixo da tolerância)
    const topDiffs = allDeltas.slice(0, 3);
    
    topDiffs.forEach((diff, index) => {
      const isWithinTolerance = diff.abs <= diff.tolerancia;
      const direction = diff.delta > 0 ? 'acima' : 'abaixo';
      const percentage = ((diff.abs / diff.tolerancia) * 100).toFixed(0);
      
      suggestions.push({
        categoria: diff.type,
        nivel: isWithinTolerance ? 'info' : 'baixo',
        problema: isWithinTolerance 
          ? `${diff.type}: Sua música está ${diff.abs.toFixed(2)} ${diff.unit} ${direction} da referência (dentro da tolerância de ±${diff.tolerancia} ${diff.unit})`
          : `${diff.type}: Diferença de ${diff.abs.toFixed(2)} ${diff.unit} (${percentage}% da tolerância máxima)`,
        solucao: isWithinTolerance
          ? `Sua mixagem está bem calibrada neste aspecto. Diferença representa ${percentage}% da tolerância máxima.`
          : `Ajuste ${diff.type.toLowerCase()} para aproximar de ${diff.base.toFixed(2)} ${diff.unit} da referência`,
        detalhes: {
          baseValue: diff.base.toFixed(2),
          compareValue: diff.compare.toFixed(2),
          delta: diff.delta.toFixed(2),
          tolerancia: `±${diff.tolerancia} ${diff.unit}`,
          percentOfTolerance: `${percentage}%`,
          withinTolerance: isWithinTolerance
        },
        aiEnhanced: false,
        enrichmentStatus: 'comparison-generated-informative',
        isInformative: true,
        priority: index + 1
      });
    });
    
    // 🎯 ADICIONAR SUGESTÃO DE RESUMO SEMPRE
    suggestions.unshift({
      categoria: 'Resumo',
      nivel: 'info',
      problema: `Comparação concluída: Sua música está bem alinhada com a referência`,
      solucao: `As diferenças detectadas estão majoritariamente dentro das tolerâncias profissionais. Pequenos ajustes opcionais estão listados abaixo.`,
      detalhes: {
        totalDeltasAnalisados: allDeltas.length,
        deltasForaTolerancia: allDeltas.filter(d => d.abs > d.tolerancia).length,
        maiorDelta: allDeltas[0] ? `${allDeltas[0].type}: ${allDeltas[0].delta.toFixed(2)} ${allDeltas[0].unit}` : 'N/A'
      },
      aiEnhanced: false,
      enrichmentStatus: 'comparison-summary',
      isSummary: true,
      priority: 0
    });
    
    console.log('[REFERENCE-ENGINE] ✅ Geradas', suggestions.length, 'sugestões informativas (fallback)');
  }
  
  // 🛡️ VALIDAÇÃO FINAL OBRIGATÓRIA: NUNCA retornar array vazio
  if (!suggestions || suggestions.length === 0) {
    console.error('[REFERENCE-ENGINE] ❌ ERRO CRÍTICO: Ainda sem sugestões após fallback - criando sugestão de emergência');
    
    suggestions.push({
      categoria: 'Sistema',
      nivel: 'info',
      problema: 'Análise comparativa concluída',
      solucao: 'Sua música foi comparada com a referência. As métricas técnicas estão disponíveis na tabela de comparação.',
      detalhes: {
        note: 'Sugestão gerada automaticamente pelo sistema de fallback',
        timestamp: new Date().toISOString()
      },
      aiEnhanced: false,
      enrichmentStatus: 'emergency-fallback',
      isEmergencyFallback: true
    });
    
    console.log('[REFERENCE-ENGINE] ✅ Sugestão de emergência criada');
  }

  return suggestions;
}
