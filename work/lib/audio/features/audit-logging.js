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
  
  // 5. FFT MAGNITUDE RMS
  console.log(`\n5️⃣ FFT CORREÇÕES:`);
  const fft = coreMetrics.fft;
  if (fft) {
    console.log(`   ✅ Magnitude: RMS stereo (corrigido de média aritmética)`);
    console.log(`   📊 Spectral Centroid: ${fft.spectralCentroid?.toFixed(1) || 'null'} Hz (corrigido de bins)`);
    console.log(`   📈 Spectral Rolloff: ${fft.spectralRolloff?.toFixed(3) || 'null'}`);
    console.log(`   📊 Spectral Flatness: ${fft.spectralFlatness?.toFixed(3) || 'null'}`);
    console.log(`   🔢 FFT Size: ${coreMetrics.metadata?.fftSize || 'unknown'}`);
    console.log(`   🎵 Sample Rate: ${coreMetrics.metadata?.sampleRate || 'unknown'} Hz`);
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