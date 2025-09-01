// Teste unitário para o gênero Funk Automotivo
import { computeMixScore } from '../lib/audio/features/scoring.js';

function makeFunkAutomotivoRef() {
  return {
    lufs_target: -8,
    tol_lufs: 1.2,
    true_peak_target: -9.58,
    tol_true_peak: 2.5,
    dr_target: 8.1,
    tol_dr: 2.0,
    lra_target: 6.6,
    tol_lra: 4.0,
    stereo_target: 0.3,
    tol_stereo: 0.15,
    bands: {
      sub: { target_db: -7.6, tol_db: 6.0 },
      low_bass: { target_db: -6.6, tol_db: 4.5 },
      upper_bass: { target_db: -11.4, tol_db: 3.5 },
      low_mid: { target_db: -8.2, tol_db: 3.5 },
      mid: { target_db: -6.7, tol_db: 3.0 },
      high_mid: { target_db: -12.8, tol_db: 4.5 },
      brilho: { target_db: -16.6, tol_db: 4.5 },
      presenca: { target_db: -22.7, tol_db: 5.0 }
    }
  };
}

function buildFunkAutomotivoTech(overrides = {}) {
  return {
    lufsIntegrated: overrides.lufsIntegrated ?? -8,
    truePeakDbtp: overrides.truePeakDbtp ?? -9.58,
    dynamicRange: overrides.dynamicRange ?? 8.1,
    lra: overrides.lra ?? 6.6,
    stereoWidth: overrides.stereoWidth ?? 0.3,
    bandEnergies: {
      sub: { rms_db: overrides.sub ?? -7.6 },
      low_bass: { rms_db: overrides.low_bass ?? -6.6 },
      upper_bass: { rms_db: overrides.upper_bass ?? -11.4 },
      low_mid: { rms_db: overrides.low_mid ?? -8.2 },
      mid: { rms_db: overrides.mid ?? -6.7 },
      high_mid: { rms_db: overrides.high_mid ?? -12.8 },
      brilho: { rms_db: overrides.brilho ?? -16.6 },
      presenca: { rms_db: overrides.presenca ?? -22.7 }
    }
  };
}

function logTestCase(name, tech, ref) {
  const result = computeMixScore(tech, ref);
  console.log(`${name}: Score ${result.scorePct}% - ${result.penaltiesSummary}`);
  return result;
}

const ref = makeFunkAutomotivoRef();

console.log('=== Testes Funk Automotivo ===\n');

// 1) Mix perfeita dentro dos alvos
logTestCase('PERFEITO', buildFunkAutomotivoTech(), ref);

// 2) LUFS característico do funk automotivo (-5 LUFS) - mais alto que outros funks
logTestCase('LUFS_ALTO_OK', buildFunkAutomotivoTech({ lufsIntegrated: -5 }), ref);

// 3) Sub-bass forte (característica do automotivo)
logTestCase('SUB_FORTE', buildFunkAutomotivoTech({ sub: -3 }), ref);

// 4) Médios presentes para vocais
logTestCase('VOCAL_PRESENTE', buildFunkAutomotivoTech({ mid: -4, low_mid: -5 }), ref);

// 5) True peak alto (mix agressiva)
logTestCase('PEAK_ALTO', buildFunkAutomotivoTech({ truePeakDbtp: -1 }), ref);

// 6) Estéreo wide (espacialidade característica)
logTestCase('STEREO_WIDE', buildFunkAutomotivoTech({ stereoWidth: 0.45 }), ref);

// 7) Mix com problemas - graves fracos
logTestCase('GRAVES_FRACOS', buildFunkAutomotivoTech({ sub: -20, low_bass: -15 }), ref);

// 8) Mix com problemas - agudos excessivos
logTestCase('AGUDOS_HARSH', buildFunkAutomotivoTech({ brilho: -8, presenca: -10 }), ref);

console.log('\n=== Teste de validação de bandas críticas ===');

// 9) Teste das bandas mais importantes para funk automotivo
const criticalBands = ['sub', 'low_bass', 'mid', 'high_mid'];
criticalBands.forEach(band => {
  const testValues = {
    sub: [-15, -3, 5],      // fraco, forte, excessivo
    low_bass: [-12, -3, 2], // fraco, forte, excessivo
    mid: [-12, -3, 2],      // abafado, presente, harsh
    high_mid: [-20, -8, -3] // abafado, presente, harsh
  };
  
  testValues[band].forEach((value, idx) => {
    const labels = ['FRACO', 'FORTE', 'EXCESSIVO'];
    const override = {};
    override[band] = value;
    logTestCase(`${band.toUpperCase()}_${labels[idx]}`, buildFunkAutomotivoTech(override), ref);
  });
});

console.log('\n=== Teste concluído ===');
