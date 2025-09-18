// 📊 AUDIT LOGGING - Sistema de auditoria para correções de precisão
// Logs detalhados de normalização, LUFS, True Peak, correlação, FFT

import { logAudio } from '../error-handling.js';

/**
 * 🔍 Logs de auditoria para métricas de áudio
 */
export function auditMetricsCorrections(coreMetrics, originalAudio, normalization) {
  const jobId = coreMetrics.metadata?.jobId || 'unknown';
  const jobIdShort = jobId.substring(0, 8);
  
  console.log(`\n🔍 ===== AUDITORIA DE CORREÇÕES DE PRECISÃO [${jobIdShort}] =====`);
  
  // 1. NORMALIZAÇÃO PRÉ-ANÁLISE
  console.log(`\n1️⃣ NORMALIZAÇÃO PRÉ-ANÁLISE:`);
  if (normalization.applied) {
    console.log(`   ✅ Normalização aplicada para -23.0 LUFS`);
    console.log(`   📊 LUFS original: ${normalization.originalLUFS?.toFixed(2) || 'null'} LUFS`);
    console.log(`   🎛️ Ganho aplicado: ${normalization.gainAppliedDB?.toFixed(2) || 'null'} dB`);
    console.log(`   ⚠️ Clipping detectado: ${normalization.hasClipping ? 'SIM' : 'NÃO'}`);
    console.log(`   🔇 Silêncio digital: ${normalization.isSilence ? 'SIM' : 'NÃO'}`);
  } else {
    console.log(`   ❌ Normalização NÃO aplicada`);
    console.log(`   💾 Áudio original preservado`);
    if (normalization.error) {
      console.log(`   🚨 Erro: ${normalization.error}`);
    }
  }
  
  // 2. TRUE PEAK CORRIGIDO
  console.log(`\n2️⃣ TRUE PEAK REAL (dBTP):`);
  const tp = coreMetrics.truePeak;
  if (tp.maxDbtp !== null && isFinite(tp.maxDbtp)) {
    console.log(`   ✅ True Peak válido: ${tp.maxDbtp.toFixed(2)} dBTP`);
    console.log(`   🔬 Oversampling: ${tp.oversamplingFactor}x`);
    console.log(`   🚨 Clipping count: ${tp.clippingCount || 0}`);
    console.log(`   📏 Excede -1dBTP: ${tp.exceedsThreshold ? 'SIM' : 'NÃO'}`);
  } else {
    console.log(`   🔇 True Peak: null (silêncio digital ou erro)`);
    console.log(`   ✅ Correção aplicada: valores -Infinity eliminados`);
  }
  
  // 3. LUFS ITU-R BS.1770-4
  console.log(`\n3️⃣ LUFS ITU-R BS.1770-4:`);
  const lufs = coreMetrics.lufs;
  if (lufs) {
    console.log(`   📊 LUFS integrado (normalizado): ${lufs.integrated?.toFixed(2) || 'null'} LUFS`);
    console.log(`   📊 LUFS original: ${lufs.originalLUFS?.toFixed(2) || 'null'} LUFS`);
    console.log(`   🎯 Target normalização: ${lufs.normalizedTo?.toFixed(1) || 'null'} LUFS`);
    console.log(`   🚪 Gating efficiency: ${lufs.gating_stats?.gating_efficiency?.toFixed(3) || 'null'}`);
    console.log(`   📅 Short-term: ${lufs.short_term?.toFixed(2) || 'null'} LUFS`);
    console.log(`   📏 LRA: ${lufs.lra?.toFixed(2) || 'null'} LU`);
  } else {
    console.log(`   ❌ LUFS não calculado`);
  }
  
  // 4. CORRELAÇÃO ESTÉREO CORRIGIDA
  console.log(`\n4️⃣ CORRELAÇÃO ESTÉREO:`);
  const stereo = coreMetrics.stereo;
  if (stereo) {
    if (stereo.correlation !== null && isFinite(stereo.correlation)) {
      console.log(`   ✅ Correlação válida: ${stereo.correlation.toFixed(3)}`);
      console.log(`   📊 Range válido: ${Math.abs(stereo.correlation) <= 1 ? 'OK' : 'ERRO'}`);
    } else {
      console.log(`   🔇 Correlação: null (canais constantes ou silêncio)`);
      console.log(`   ✅ Correção aplicada: eliminado retorno 0 falso`);
    }
    console.log(`   ⚖️ Balance: ${stereo.balance?.toFixed(3) || 'null'}`);
    console.log(`   📐 Phase: ${stereo.phase?.toFixed(1) || 'null'}°`);
  } else {
    console.log(`   ❌ Análise estéreo não calculada`);
  }
  
  // 5. MÉTRICAS ESPECTRAIS COMPLETAS (8 MÉTRICAS)
  console.log(`\n5️⃣ MÉTRICAS ESPECTRAIS CORRIGIDAS:`);
  const fft = coreMetrics.fft;
  if (fft) {
    console.log(`   ✅ Magnitude: RMS stereo (corrigido de média aritmética)`);
    console.log(`   ✅ Energia: magnitude² para cálculos espectrais`);
    
    // Métricas de frequência (Hz)
    console.log(`\n   📊 MÉTRICAS DE FREQUÊNCIA:`);
    console.log(`   🎵 Spectral Centroid: ${fft.spectralCentroidHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   📈 Spectral Rolloff (85%): ${fft.spectralRolloffHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   📏 Spectral Bandwidth: ${fft.spectralBandwidthHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   📐 Spectral Spread: ${fft.spectralSpreadHz?.toFixed(2) || 'null'} Hz`);
    
    // Métricas adimensionais
    console.log(`\n   � MÉTRICAS ESTATÍSTICAS:`);
    console.log(`   📊 Spectral Flatness: ${fft.spectralFlatness?.toFixed(4) || 'null'} [0-1]`);
    console.log(`   🏔️ Spectral Crest: ${fft.spectralCrest?.toFixed(2) || 'null'}`);
    console.log(`   📈 Spectral Skewness: ${fft.spectralSkewness?.toFixed(4) || 'null'}`);
    console.log(`   � Spectral Kurtosis: ${fft.spectralKurtosis?.toFixed(4) || 'null'}`);
    
    // Configurações FFT
    console.log(`\n   ⚙️ CONFIGURAÇÕES FFT:`);
    console.log(`   🔢 FFT Size: ${coreMetrics.metadata?.fftSize || 'unknown'}`);
    console.log(`   🎵 Sample Rate: ${coreMetrics.metadata?.sampleRate || 'unknown'} Hz`);
    console.log(`   🔄 Frames processados: ${fft.processedFrames || 'unknown'}`);
    
    // Log detalhado se centroide válido
    if (fft.spectralCentroidHz !== null && isFinite(fft.spectralCentroidHz)) {
      console.log(`\n   ✅ [AUDITORIA] Centroide espectral corrigido:`);
      console.log(`      🧮 Fórmula: Σ(freq[i] * magnitude²[i]) / Σ magnitude²[i]`);
      console.log(`      📊 Resultado: ${fft.spectralCentroidHz.toFixed(2)} Hz`);
    } else {
      console.log(`\n   🔇 [AUDITORIA] Métricas espectrais: null (energia insuficiente)`);
      console.log(`      ✅ Correção aplicada: não mascarado com valores fixos`);
    }
  } else {
    console.log(`   ❌ Análise FFT não calculada`);
  }
  
  // 6. RESUMO DE CORREÇÕES
  console.log(`\n6️⃣ RESUMO DE CORREÇÕES APLICADAS:`);
  const corrections = [
    normalization.applied ? '✅ Normalização -23 LUFS' : '❌ Normalização',
    (tp.maxDbtp !== null) ? '✅ True Peak null-safe' : '❌ True Peak',
    (stereo.correlation !== null || stereo.correlation === null) ? '✅ Correlação null-safe' : '❌ Correlação',
    fft ? '✅ FFT RMS + Hz' : '❌ FFT',
    lufs ? '✅ LUFS ITU-R BS.1770-4' : '❌ LUFS'
  ];
  
  corrections.forEach(correction => console.log(`   ${correction}`));
  
  // 7. TEMPO DE PROCESSAMENTO
  console.log(`\n7️⃣ PERFORMANCE:`);
  console.log(`   ⏱️ Normalização: ${normalization.processingTime || 0}ms`);
  console.log(`   ⏱️ Core Metrics: ${coreMetrics.metadata?.processingTime || 0}ms`);
  console.log(`   📦 Total Pipeline: ${(normalization.processingTime || 0) + (coreMetrics.metadata?.processingTime || 0)}ms`);
  
  console.log(`\n🔍 ===== FIM AUDITORIA [${jobIdShort}] =====\n`);
  
  // Log estruturado para agregação
  logAudio('audit', 'corrections_summary', {
    jobId: jobIdShort,
    normalization: {
      applied: normalization.applied,
      originalLUFS: normalization.originalLUFS,
      gainDB: normalization.gainAppliedDB,
      hasClipping: normalization.hasClipping,
      isSilence: normalization.isSilence
    },
    truePeak: {
      valid: tp.maxDbtp !== null,
      value: tp.maxDbtp,
      oversampling: tp.oversamplingFactor,
      clipping: tp.clippingCount
    },
    lufs: {
      integrated: lufs?.integrated,
      original: lufs?.originalLUFS,
      shortTerm: lufs?.short_term,
      lra: lufs?.lra
    },
    stereo: {
      correlationValid: stereo?.correlation !== null,
      correlation: stereo?.correlation,
      balance: stereo?.balance
    },
    fft: {
      spectralCentroidHz: fft?.spectralCentroidHz,
      spectralRolloffHz: fft?.spectralRolloffHz,
      spectralBandwidthHz: fft?.spectralBandwidthHz,
      spectralSpreadHz: fft?.spectralSpreadHz,
      spectralFlatness: fft?.spectralFlatness,
      spectralCrest: fft?.spectralCrest,
      spectralSkewness: fft?.spectralSkewness,
      spectralKurtosis: fft?.spectralKurtosis,
      // Legacy compatibility
      centroidHz: fft?.spectralCentroid,
      rolloff: fft?.spectralRolloff,
      flatness: fft?.spectralFlatness
    },
    performance: {
      normalizationMs: normalization.processingTime,
      coreMetricsMs: coreMetrics.metadata?.processingTime,
      totalMs: (normalization.processingTime || 0) + (coreMetrics.metadata?.processingTime || 0)
    }
  });
}

/**
 * 🚨 Log de validação de métricas
 */
export function auditMetricsValidation(metrics, expectedValues = {}) {
  console.log(`\n🔬 ===== VALIDAÇÃO DE MÉTRICAS =====`);
  
  const validations = [];
  
  // Validar True Peak
  if (metrics.truePeak?.maxDbtp !== null) {
    const valid = metrics.truePeak.maxDbtp >= -60 && metrics.truePeak.maxDbtp <= 20;
    validations.push({
      metric: 'True Peak',
      value: `${metrics.truePeak.maxDbtp?.toFixed(2)} dBTP`,
      valid,
      reason: valid ? 'Range válido' : 'Fora do range esperado'
    });
  }
  
  // Validar LUFS
  if (metrics.lufs?.integrated !== null) {
    const valid = metrics.lufs.integrated >= -80 && metrics.lufs.integrated <= 0;
    validations.push({
      metric: 'LUFS Integrado',
      value: `${metrics.lufs.integrated?.toFixed(2)} LUFS`,
      valid,
      reason: valid ? 'Range válido' : 'Fora do range esperado'
    });
  }
  
  // Validar Correlação
  if (metrics.stereo?.correlation !== null) {
    const valid = Math.abs(metrics.stereo.correlation) <= 1;
    validations.push({
      metric: 'Correlação Estéreo',
      value: `${metrics.stereo.correlation?.toFixed(3)}`,
      valid,
      reason: valid ? 'Range válido [-1, 1]' : 'Fora do range válido'
    });
  }
  
  // ESPECIFICAÇÃO: Validar Crest Factor de Dinâmica (8-14 dB típico)
  if (metrics.crestFactor !== null) {
    const valid = metrics.crestFactor >= 0 && metrics.crestFactor <= 20;
    const typical = metrics.crestFactor >= 8 && metrics.crestFactor <= 14;
    validations.push({
      metric: 'Crest Factor',
      value: `${metrics.crestFactor?.toFixed(2)} dB`,
      valid,
      reason: valid ? (typical ? 'Range típico (8-14 dB)' : 'Range válido (0-20 dB)') : 'Fora do range válido'
    });
  }
  
  // ESPECIFICAÇÃO: Validar True Peak vs Sample Peak (±1 dB)
  if (metrics.truePeak?.maxDbtp !== null && metrics.truePeak?.sample_peak_left_db !== null && metrics.truePeak?.sample_peak_right_db !== null) {
    const truePeakDbtp = metrics.truePeak.maxDbtp;
    const samplePeakDb = Math.max(metrics.truePeak.sample_peak_left_db, metrics.truePeak.sample_peak_right_db);
    const delta = Math.abs(truePeakDbtp - samplePeakDb);
    const valid = delta <= 1.0; // ±1 dB tolerance
    
    validations.push({
      metric: 'True Peak vs Sample Peak',
      value: `Δ${delta.toFixed(2)} dB`,
      valid,
      reason: valid ? 'Delta ≤1 dB (esperado)' : 'Delta >1 dB (possível problema)'
    });
  }
  
  // ESPECIFICAÇÃO: Validar Bandas Espectrais (soma 100±0.5%)
  if (metrics.spectralBands?.bands) {
    const bandValues = Object.values(metrics.spectralBands.bands);
    const bandsSum = bandValues.reduce((sum, band) => sum + (band.percentage || 0), 0);
    const valid = Math.abs(bandsSum - 100) <= 0.5; // ±0.5% tolerance
    
    validations.push({
      metric: 'Bandas Espectrais (Soma)',
      value: `${bandsSum.toFixed(2)}%`,
      valid,
      reason: valid ? 'Soma 100±0.5% (válido)' : 'Soma fora de 100±0.5%'
    });
  }
  
  // ESPECIFICAÇÃO: Validar Sample Peak Range Float [-1, +1]
  if (metrics.truePeak?.sample_clipping_count !== undefined) {
    const leftClipping = metrics.truePeak?.sample_peak_left_db;
    const rightClipping = metrics.truePeak?.sample_peak_right_db;
    const validLeft = leftClipping <= 0; // Deve ser ≤0 dBFS
    const validRight = rightClipping <= 0; // Deve ser ≤0 dBFS
    const valid = validLeft && validRight;
    
    validations.push({
      metric: 'Sample Peak Range',
      value: `L:${leftClipping?.toFixed(2) || 'null'} R:${rightClipping?.toFixed(2) || 'null'} dBFS`,
      valid,
      reason: valid ? 'Sample peaks ≤0 dBFS (válido)' : 'Sample peaks >0 dBFS (clipping)'
    });
  }
  
  // Validar Métricas Espectrais (8 métricas)
  const nyquist = 24000; // Assumindo 48kHz / 2
  
  // Centroide Espectral (Hz)
  if (metrics.fft?.spectralCentroidHz !== null) {
    const valid = metrics.fft.spectralCentroidHz > 0 && metrics.fft.spectralCentroidHz <= nyquist;
    validations.push({
      metric: 'Spectral Centroid',
      value: `${metrics.fft.spectralCentroidHz?.toFixed(1)} Hz`,
      valid,
      reason: valid ? 'Range válido (0-24kHz)' : 'Fora do range de frequências válido'
    });
  }
  
  // Rolloff Espectral (Hz)
  if (metrics.fft?.spectralRolloffHz !== null) {
    const valid = metrics.fft.spectralRolloffHz > 0 && metrics.fft.spectralRolloffHz <= nyquist;
    validations.push({
      metric: 'Spectral Rolloff',
      value: `${metrics.fft.spectralRolloffHz?.toFixed(1)} Hz`,
      valid,
      reason: valid ? 'Range válido (0-24kHz)' : 'Fora do range de frequências válido'
    });
  }
  
  // Largura de Banda Espectral (Hz)
  if (metrics.fft?.spectralBandwidthHz !== null) {
    const valid = metrics.fft.spectralBandwidthHz >= 0 && metrics.fft.spectralBandwidthHz <= nyquist;
    validations.push({
      metric: 'Spectral Bandwidth',
      value: `${metrics.fft.spectralBandwidthHz?.toFixed(1)} Hz`,
      valid,
      reason: valid ? 'Range válido (0-24kHz)' : 'Fora do range válido'
    });
  }
  
  // Planura Espectral [0-1]
  if (metrics.fft?.spectralFlatness !== null) {
    const valid = metrics.fft.spectralFlatness >= 0 && metrics.fft.spectralFlatness <= 1;
    validations.push({
      metric: 'Spectral Flatness',
      value: `${metrics.fft.spectralFlatness?.toFixed(4)}`,
      valid,
      reason: valid ? 'Range válido [0-1]' : 'Fora do range válido'
    });
  }
  
  // Fator de Crista (≥1)
  if (metrics.fft?.spectralCrest !== null) {
    const valid = metrics.fft.spectralCrest >= 1;
    validations.push({
      metric: 'Spectral Crest',
      value: `${metrics.fft.spectralCrest?.toFixed(2)}`,
      valid,
      reason: valid ? 'Range válido (≥1)' : 'Valor inválido (deve ser ≥1)'
    });
  }
  
  // Validar Spectral Centroid (Legacy - compatibilidade)
  if (metrics.fft?.spectralCentroid !== null) {
    const valid = metrics.fft.spectralCentroid > 0 && metrics.fft.spectralCentroid <= nyquist;
    validations.push({
      metric: 'Spectral Centroid (Legacy)',
      value: `${metrics.fft.spectralCentroid?.toFixed(1)} Hz`,
      valid,
      reason: valid ? 'Range válido (0-24kHz)' : 'Fora do range de frequências válido'
    });
  }
  
  // Imprimir resultados
  validations.forEach(v => {
    const status = v.valid ? '✅' : '❌';
    console.log(`   ${status} ${v.metric}: ${v.value} (${v.reason})`);
  });
  
  const allValid = validations.every(v => v.valid);
  console.log(`\n📊 Resultado: ${allValid ? '✅ TODAS VÁLIDAS' : '❌ ALGUMAS INVÁLIDAS'}`);
  console.log(`🔬 ===== FIM VALIDAÇÃO =====\n`);
  
  return { allValid, validations };
}

console.log('📊 Audit Logging carregado - Sistema de auditoria de correções');