// Embedded fallback for reference JSONs when CDN routing fails
(function(){
  window.__EMBEDDED_REFS__ = window.__EMBEDDED_REFS__ || {};
  window.__EMBEDDED_REFS__.manifest = {"genres":[
    {"key":"trance","label":"Trance"},
    {"key":"funk_mandela","label":"Funk Mandela"},
    {"key":"funk_bruxaria","label":"Funk Bruxaria"},
    {"key":"funk_automotivo","label":"Funk Automotivo"},
    {"key":"eletronico","label":"Eletrônico"},
    {"key":"eletrofunk","label":"Eletrofunk"},
    {"key":"funk_consciente","label":"Funk Consciente"},
    {"key":"trap","label":"Trap"}
  ]};
  window.__EMBEDDED_REFS__.byGenre = window.__EMBEDDED_REFS__.byGenre || {};
  // Fallback completo para Trance (qualidade de referência)
  window.__EMBEDDED_REFS__.byGenre.trance = {"version":"1.0","generated_at":"2025-08-11T01:24:45.744Z","num_tracks":5,"lufs_target":-14,"tol_lufs":0.5,"true_peak_target":-7.26,"tol_true_peak":1.14,"dr_target":9.4,"tol_dr":0.8,"lra_target":10.7,"tol_lra":2.7,"stereo_target":0.17,"tol_stereo":0.03,"calor_target":-12.64,"brilho_target":-24.71,"clareza_target":-6.46,"bands":{"sub":{"target_db":-17.3,"tol_db":2.5},"low_bass":{"target_db":-14.6,"tol_db":4.3},"upper_bass":{"target_db":-14.8,"tol_db":2.5},"low_mid":{"target_db":-12.6,"tol_db":3.7},"mid":{"target_db":-12,"tol_db":4.0},"high_mid":{"target_db":-20.2,"tol_db":3.6},"brilho":{"target_db":-24.7,"tol_db":2.5},"presenca":{"target_db":-32.1,"tol_db":3.6}}};
  // Fallbacks mínimos para outros gêneros (evitam badge vermelho)
  const minimal = (overrides={}) => Object.assign({
    lufs_target: -14, tol_lufs: 1,
    true_peak_target: -1, tol_true_peak: 1,
    dr_target: 8, tol_dr: 2,
    lra_target: 6, tol_lra: 3,
    stereo_target: 0.1, tol_stereo: 0.1,
    bands: {
      sub:{target_db:-18,tol_db:4.5}, low_bass:{target_db:-16,tol_db:4.5}, upper_bass:{target_db:-15,tol_db:4.5},
      low_mid:{target_db:-14,tol_db:4.5}, mid:{target_db:-13,tol_db:4.5}, high_mid:{target_db:-20,tol_db:4.5}, brilho:{target_db:-25,tol_db:4.5}, presenca:{target_db:-32,tol_db:4.5}
    }
  }, overrides);
  window.__EMBEDDED_REFS__.byGenre['funk_mandela']   = window.__EMBEDDED_REFS__.byGenre['funk_mandela']   || minimal({ stereo_target: 0.22 });
  // Novo dataset Funk Mandela v2.0 (Agregação Linear Domain Corrigida)
  window.__EMBEDDED_REFS__.byGenre['funk_mandela'] = {
    version: "v2.0", 
    aggregation_method: "linear_domain",
    num_tracks: 57,
    lufs_target: -14, tol_lufs: 0.5,
    true_peak_target: -10.46, tol_true_peak: 1.77,
    dr_target: 7.5, tol_dr: 1.2,
    lra_target: 7.4, tol_lra: 2.9,
    stereo_target: 0.22, tol_stereo: 0.1,
    calor_target: -8.42, brilho_target: -14.83, clareza_target: -0.35,
    bands: {
      sub: { target_db: -6.7, tol_db: 3.4 },
      low_bass: { target_db: -8.0, tol_db: 4.3 },
      upper_bass: { target_db: -12.0, tol_db: 3.1 },
      low_mid: { target_db: -8.4, tol_db: 3.8 },
      mid: { target_db: -6.3, tol_db: 2.9 },
      high_mid: { target_db: -11.2, tol_db: 3.6 },
      brilho: { target_db: -14.8, tol_db: 3.2 },
      presenca: { target_db: -19.2, tol_db: 4.5 }
    }
  };
  window.__EMBEDDED_REFS__.byGenre['funk_bruxaria']  = {
    version: "1.0.1",
    generated_at: "2025-08-23T18:03:37.143Z",
    num_tracks: 29,
    lufs_target: -14,
    tol_lufs: 0.5,
    true_peak_target: -10.6,
    tol_true_peak: 1.27,
    dr_target: 7.4,
    tol_dr: 1.3,
    lra_target: 8.4,
    tol_lra: 2.8,
    stereo_target: 0.3,
    tol_stereo: 0.1,
    calor_target: -11.95,
    brilho_target: -17.69,
    clareza_target: -1.21,
    bands: {
      sub: { target_db: -12.5, tol_db: 3 },
      low_bass: { target_db: -15.2, tol_db: 3 },
      upper_bass: { target_db: -15.2, tol_db: 2.3 },
      low_mid: { target_db: -12, tol_db: 1.7 },
      mid: { target_db: -8.7, tol_db: 1.7 },
      high_mid: { target_db: -14.5, tol_db: 2.8 },
      brilho: { target_db: -17.7, tol_db: 2.2 },
      presenca: { target_db: -26.7, tol_db: 2.8 }
    }
  };
  window.__EMBEDDED_REFS__.byGenre['funk_automotivo'] = window.__EMBEDDED_REFS__.byGenre['funk_automotivo'] || minimal({ 
    lufs_target: -8, 
    true_peak_target: -9.58,
    stereo_target: 0.3,
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
  });
  window.__EMBEDDED_REFS__.byGenre['eletronico']     = window.__EMBEDDED_REFS__.byGenre['eletronico']     || minimal({ lra_target: 8 });
  window.__EMBEDDED_REFS__.byGenre['eletrofunk']     = window.__EMBEDDED_REFS__.byGenre['eletrofunk']     || {
    lufs_target: -8.3, tol_lufs: 1.22,
    true_peak_target: -1.9, tol_true_peak: 0.5,
    dr_target: 10.1, tol_dr: 1.35,
    lra_target: 8.4, tol_lra: 2.54,
    stereo_target: null, tol_stereo: 0.07,
    bands: {
      sub: { target_db: null, tol_db: 3.28 },
      low_bass: { target_db: 13.3, tol_db: 3.86 },
      upper_bass: { target_db: 11.5, tol_db: 3.52 },
      low_mid: { target_db: 8.8, tol_db: 3.57 },
      mid: { target_db: 2.5, tol_db: 3.31 },
      high_mid: { target_db: -6.7, tol_db: 3.02 },
      brilho: { target_db: -13.1, tol_db: 3.88 },
      presenca: { target_db: -22.7, tol_db: 4.97 }
    }
  };
  window.__EMBEDDED_REFS__.byGenre['funk_consciente']= window.__EMBEDDED_REFS__.byGenre['funk_consciente']|| minimal({ dr_target: 10 });
  window.__EMBEDDED_REFS__.byGenre['trap']           = window.__EMBEDDED_REFS__.byGenre['trap']           || minimal({ sub: { target_db: -16, tol_db: 5.5 } });
})();
