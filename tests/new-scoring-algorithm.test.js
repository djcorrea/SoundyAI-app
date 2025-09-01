import { computeMixScore } from '../lib/audio/features/scoring.js';

function makeRef(){
  return {
    lufs_target: -14, tol_lufs: 1,
    true_peak_target: -1, tol_true_peak: 1,
    bands: {
      high_mid: { target_db: -20, tol_db: 2 },
      brilho: { target_db: -25, tol_db: 3 },
      presenca: { target_db: -32, tol_db: 3 },
      low_bass: { target_db: -16, tol_db: 3 },
      upper_bass: { target_db: -15, tol_db: 3 },
      low_mid: { target_db: -14, tol_db: 3 },
      mid: { target_db: -13, tol_db: 3 }
    }
  };
}

function band(val){ return { rms_db: val }; }

function buildTech(overrides={}){
  return {
    lufsIntegrated: overrides.lufsIntegrated ?? -14,
    truePeakDbtp: overrides.truePeakDbtp ?? -1,
    bandEnergies: {
      high_mid: band(overrides.high_mid ?? -20),
      brilho: band(overrides.brilho ?? -25),
      presenca: band(overrides.presenca ?? -32),
      low_bass: band(overrides.low_bass ?? -16),
      upper_bass: band(overrides.upper_bass ?? -15),
      low_mid: band(overrides.low_mid ?? -14),
      mid: band(overrides.mid ?? -13),
    }
  };
}

function logCase(name, tech, ref){
  const r = computeMixScore(tech, ref);
  console.log(name, r.scorePct, r.penaltiesSummary);
  return r;
}

const ref = makeRef();
// 1) Dentro do intervalo
logCase('ALL_OK', buildTech(), ref);
// 2) Desvio leve (~0.8x): ajustar high_mid -21.6 (1.6 abaixo tol 2 => n=0.8). repetido em alguns
logCase('LEVE_MULTI', buildTech({ high_mid:-21.6, brilho:-26.6, presenca:-33.6 }), ref);
// 3) Desvio alto 1 crítico n≈2.5 (high_mid acima): target -20 tol 2 => upper = -18; valor -13 => ( -13 - -18)/2 = 2.5
logCase('ALTO_HIGH_MID', buildTech({ high_mid:-13 }), ref);
// 4) Dois críticos >=3x (low_bass + high_mid) => low_bass: target -16 tol 3 upper -13; set -4 => (-4 - -13)/3 = 3.0
logCase('DOIS_CRITICOS_3X', buildTech({ high_mid:-13, low_bass:-4 }), ref);
// 5) Caso Eletrônico boost exagerado: +30dB em baixos (low_bass +30 relativo target -16 => valor ~14) e +11dB em high_mid (target -20 => valor -9)
logCase('ELETRONICO_EXCESSO', buildTech({ low_bass:14, upper_bass:12, high_mid:-9 }), ref);
// 6) Compat JSON só tol_db -> já coberto pelo ref criado; ensure tol_min assumed.
