/**
 * VERDICT ENGINE (MIX) v4.0
 *
 * Camada de interpretacao pos-render — ativada por MutationObserver em
 * #audioAnalysisResults. Independe completamente da cadeia de chamadas de
 * window.displayModalResults.
 *
 * Fluxo:
 *   #audioAnalysisResults.style.display muda para 'block'
 *   → debounce 500ms (aguarda DOM estabilizar, incluindo AI enrichment)
 *   → applyMixVerdictToRenderedModal(window.__VERDICT_SOURCE_DATA__)
 *     1. gera veredito a partir de analysis.technicalData
 *     2. substitui .score-final-status (label curto)
 *     3. insere .verdict-main-text dentro de #final-score-display (apos #diagnostic-container)
 *     4. insere #verdictMasterBtn imediatamente apos .verdict-main-text
 *
 * NAO altera: score numerico, cards de metricas, sugestoes, tabelas, fluxo.
 * Elemento-alvo: #final-score-display (container do topo do modal).
 *
 * AUDITORIA: prefixo [VERDICT-AUDIT] em todos os logs críticos.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // UTILITARIOS
  // ─────────────────────────────────────────────────────────────

  function safeNum(v) {
    var n = Number(v);
    return (v !== undefined && v !== null && v !== '' && isFinite(n)) ? n : null;
  }

  function fmt1(n) {
    return (n !== null && n !== undefined) ? Number(n).toFixed(1) : null;
  }

  function vlog() {
    if (typeof console !== 'undefined') {
      var args = Array.prototype.slice.call(arguments);
      console.log.apply(console, args);
    }
  }

  function vwarn() {
    if (typeof console !== 'undefined') {
      var args = Array.prototype.slice.call(arguments);
      console.warn.apply(console, args);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EXTRACAO DE METRICAS
  // Lê sempre de analysis.technicalData (ou raiz se necessário)
  // ─────────────────────────────────────────────────────────────

  function extractMetrics(data) {
    if (!data || typeof data !== 'object') { return {}; }

    // Descer para technicalData se vier o objeto analysis completo
    var tech = (data.technicalData && typeof data.technicalData === 'object')
      ? data.technicalData
      : data;

    return {
      lufs:        safeNum(tech.lufsIntegrated  !== undefined ? tech.lufsIntegrated
                         : tech.lufs_integrated !== undefined ? tech.lufs_integrated
                         : tech.lufs),
      tp:          safeNum(tech.truePeakDbtp    !== undefined ? tech.truePeakDbtp
                         : tech.true_peak_dbtp  !== undefined ? tech.true_peak_dbtp
                         : tech.truePeak),
      dr:          safeNum(tech.dynamicRange    !== undefined ? tech.dynamicRange
                         : tech.dynamic_range   !== undefined ? tech.dynamic_range
                         : tech.dr),
      crestFactor: safeNum(tech.crestFactor     !== undefined ? tech.crestFactor
                         : tech.crest_factor),
      lra:         safeNum(tech.lra             !== undefined ? tech.lra
                         : tech.loudnessRange   !== undefined ? tech.loudnessRange
                         : tech.loudness_range),
      clipping: !!(
        tech.clippingDetected  ||
        tech.clipping_detected ||
        safeNum(tech.clippingSamples  !== undefined ? tech.clippingSamples
                                                    : tech.clipping_samples) > 0 ||
        safeNum(tech.clippingPct      !== undefined ? tech.clippingPct
                                                    : tech.clipping_pct)     > 0
      ),
      // Manter referencia ao tech original para generateMixVerdictMainText
      _raw: tech
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RESOLUCAO DE TARGETS DE GENERO
  // Lê da mesma cadeia usada por renderGenreComparisonTable —
  // garante SSOT único entre cards e veredito.
  // ─────────────────────────────────────────────────────────────

  function _resolveVerdictTargets() {
    var g = window.PROD_AI_REF_GENRE || window.__CURRENT_SELECTED_GENRE || '';

    // 1. PROD_AI_REF_DATA[genre] — flat targets, mesma fonte primária dos cards
    if (g && window.PROD_AI_REF_DATA && typeof window.PROD_AI_REF_DATA === 'object') {
      var pd = window.PROD_AI_REF_DATA[g];
      if (pd && typeof pd.lufs_target === 'number') {
        return { genre: g, targets: pd };
      }
    }

    // 2. __CURRENT_GENRE_TARGETS — pode ser flat ou nested por gênero
    if (window.__CURRENT_GENRE_TARGETS && typeof window.__CURRENT_GENRE_TARGETS === 'object') {
      var cgt = window.__CURRENT_GENRE_TARGETS;
      if (typeof cgt.lufs_target === 'number') {
        return { genre: g, targets: cgt };
      }
      if (g && cgt[g] && typeof cgt[g].lufs_target === 'number') {
        return { genre: g, targets: cgt[g] };
      }
      var cgtKeys = Object.keys(cgt);
      for (var i = 0; i < cgtKeys.length; i++) {
        var sub = cgt[cgtKeys[i]];
        if (sub && typeof sub === 'object' && typeof sub.lufs_target === 'number') {
          return { genre: cgtKeys[i], targets: sub };
        }
      }
    }

    // 3. __activeRefData — flat ou com sub-chave targets
    if (window.__activeRefData) {
      if (typeof window.__activeRefData.lufs_target === 'number') {
        return { genre: g, targets: window.__activeRefData };
      }
      if (window.__activeRefData.targets && typeof window.__activeRefData.targets.lufs_target === 'number') {
        return { genre: g, targets: window.__activeRefData.targets };
      }
    }

    // 4. Sem targets — veredito parcial (só TP/clipping avaliados)
    return { genre: g, targets: null };
  }

  // ─────────────────────────────────────────────────────────────
  // LOGICA DO VEREDITO
  // ─────────────────────────────────────────────────────────────

  /**
   * Retorna { verdict: { status, label, possiblyMastered, metrics, thresholds, fails } }
   * status: 'bad' | 'warning' | 'good'
   *
   * Lógica de produto:
   *   BAD     — clipping OR tp >= -1.0
   *   WARNING — lufs > -14 OR crestFactor < 6
   *   GOOD    — demais casos
   *
   * DR e LRA NÃO afetam o status do veredito.
   * genreTargets aceito mas ignorado na decisão (mantido por retrocompat).
   */
  function generateMixVerdict(dataOrMetrics, genreTargets) {
    // Aceita tanto o objeto analysis completo quanto métricas já extraídas
    var m = (dataOrMetrics && (dataOrMetrics.lufs !== undefined || dataOrMetrics.tp !== undefined))
      ? dataOrMetrics
      : extractMetrics(dataOrMetrics);

    var lufs     = m.lufs;
    var tp       = m.tp;
    var cf       = m.crestFactor;
    var clipping = m.clipping;

    // Thresholds fixos de produto
    var TP_BAD_ABOVE    = -1.0;  // tp >= -1.0 dBTP → BAD
    var LUFS_WARN_ABOVE = -14.0; // lufs > -14 LUFS → WARNING
    var CF_WARN_BELOW   =  6.0;  // cf < 6 dB → WARNING

    var thresholds = {
      tpBadAbove:    TP_BAD_ABOVE,
      lufsWarnAbove: LUFS_WARN_ABOVE,
      cfWarnBelow:   CF_WARN_BELOW
    };

    var possiblyMastered = (lufs !== null && lufs >= -11 && tp !== null && tp >= -1.2);

    // ── BAD: clipping real OU headroom insuficiente (tp >= -1.0 dBTP) ──
    if (clipping || (tp !== null && tp >= TP_BAD_ABOVE)) {
      return {
        verdict: {
          status:           'bad',
          label:            'Risco de distor\u00e7\u00e3o detectado',
          possiblyMastered: possiblyMastered,
          metrics:          m,
          thresholds:       thresholds
        }
      };
    }

    // ── WARNING: LUFS muito alto OU Crest Factor muito baixo ──
    var lufsFail = (lufs !== null && lufs > LUFS_WARN_ABOVE);
    var cfFail   = (cf   !== null && cf   < CF_WARN_BELOW);

    if (lufsFail || cfFail) {
      return {
        verdict: {
          status:           'warning',
          label:            'Masteriza\u00e7\u00e3o poss\u00edvel com ressalvas',
          possiblyMastered: possiblyMastered,
          metrics:          m,
          thresholds:       thresholds,
          fails:            { lufsFail: lufsFail, cfFail: cfFail, tpFail: false, drFail: false, lraFail: false }
        }
      };
    }

    // ── GOOD ──
    return {
      verdict: {
        status:           'good',
        label:            'Mix pronta para masteriza\u00e7\u00e3o',
        possiblyMastered: possiblyMastered,
        metrics:          m,
        thresholds:       thresholds
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // TEXTO GRANDE CENTRAL — generateMixVerdictMainText
  // Recebe verdict e o technicalData original (métricas reais)
  // ─────────────────────────────────────────────────────────────

  function generateMixVerdictMainText(verdict, metrics) {
    metrics = metrics || {};

    var rawTp   = safeNum(metrics.truePeakDbtp    !== undefined ? metrics.truePeakDbtp
                        : metrics.true_peak_dbtp  !== undefined ? metrics.true_peak_dbtp
                        : metrics.truePeak);
    var rawLufs = safeNum(metrics.lufsIntegrated  !== undefined ? metrics.lufsIntegrated
                        : metrics.lufs_integrated !== undefined ? metrics.lufs_integrated
                        : metrics.lufs);
    var rawCf   = safeNum(metrics.crestFactor     !== undefined ? metrics.crestFactor
                        : metrics.crest_factor);

    var tp  = fmt1(rawTp);
    var lu  = fmt1(rawLufs);
    var cf  = fmt1(rawCf);

    var possiblyMasteredNote = verdict.possiblyMastered
      ? ' Esta faixa pode j\u00e1 estar masterizada \u2014 masterizar novamente pode degradar a qualidade.'
      : '';

    if (verdict.status === 'bad') {
      var clipStr = (verdict.metrics && verdict.metrics.clipping)
        ? ' Clipping detectado no sinal.' : '';
      var tpStr = rawTp !== null
        ? ' True Peak atual: ' + tp + ' dBTP (limite: < -1.0 dBTP).'
        : '';
      return 'Risco de distor\u00e7\u00e3o detectado \u2014 ajuste o n\u00edvel de pico antes de masterizar.' +
             clipStr + tpStr + possiblyMasteredNote;
    }

    if (verdict.status === 'warning') {
      var fails   = verdict.fails || {};
      var wIssues = [];
      if (fails.lufsFail && rawLufs !== null) {
        wIssues.push('Volume de entrada em ' + lu + ' LUFS (limite: \u2264 -14 LUFS)');
      }
      if (fails.cfFail && rawCf !== null) {
        wIssues.push('Crest Factor em ' + cf + ' dB (m\u00ednimo: 6 dB)');
      }
      var wLine = wIssues.length ? ' Pontos a corrigir: ' + wIssues.join('; ') + '.' : '';
      return 'A masteriza\u00e7\u00e3o \u00e9 poss\u00edvel, mas alguns fatores podem limitar o resultado final.' +
             wLine + possiblyMasteredNote;
    }

    // good
    return 'Mix pronta para masteriza\u00e7\u00e3o.' + possiblyMasteredNote;
  }

  // ─────────────────────────────────────────────────────────────
  // ESTILOS (injetados uma vez)
  // ─────────────────────────────────────────────────────────────

  function _injectStyles() {
    if (document.getElementById('__verdictStyles__')) { return; }
    var s = document.createElement('style');
    s.id = '__verdictStyles__';
    s.textContent =
      '@keyframes __verdictIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}' +
      '.verdict-good{color:#22c55e!important;animation:__verdictIn .3s ease;}' +
      '.verdict-warning{color:#f59e0b!important;animation:__verdictIn .3s ease;}' +
      '.verdict-bad{color:#ef4444!important;animation:__verdictIn .3s ease;}' +
      '.verdict-main-text{' +
        'padding:14px;border-radius:8px;margin-top:12px;' +
        'background:rgba(30,36,50,.55);' +
        'border:1px solid rgba(100,120,180,.18);' +
        'line-height:1.65;font-size:14px;animation:__verdictIn .4s ease;' +
      '}' +
      '#verdictMasterBtn{' +
        'display:block;width:100%;margin-top:18px;padding:14px 0;' +
        'background:linear-gradient(135deg,#8b5cf6 0%,#4a8fff 100%);' +
        'color:#fff;border:none;border-radius:10px;' +
        'font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700;' +
        'letter-spacing:.1em;text-transform:uppercase;cursor:pointer;' +
        'transition:opacity .2s,transform .15s;' +
      '}' +
      '#verdictMasterBtn:hover{opacity:.88;transform:translateY(-2px);}' +
      '#__verdictMasteredBadge__{' +
        'display:inline-block;margin-top:6px;padding:4px 10px;' +
        'font-size:11px;color:#fbbf24;' +
        'background:rgba(251,191,36,.08);border-radius:5px;' +
        'border:1px solid rgba(251,191,36,.22);' +
      '}' +
      /* verdict-card — design integrado ao padrão azul ciano do sistema */
      '.verdict-card{' +
        'padding:20px 24px;border-radius:12px;' +
        'margin:0 auto 20px auto;' +
        'max-width:780px;width:100%;' +
        'background:rgba(0,200,255,.04);' +        /* fundo azul ciano — padrão neon */
        'border:1px solid rgba(0,200,255,.3);' +   /* borda azul ciano neon */
        'box-shadow:0 0 12px rgba(0,200,255,.08);' + /* glow neon suave */
        'text-align:center;' +                     /* conteúdo centralizado */
        'backdrop-filter:blur(10px);' +
        'animation:__verdictIn .4s ease;position:relative;z-index:1;' +
        'box-sizing:border-box;' +
      '}' +
      /* estados semânticos substituem apenas borda + fundo + glow */
      '.verdict-card-bad{' +
        'border-color:rgba(239,68,68,.4);' +
        'background:rgba(239,68,68,.04);' +
        'box-shadow:0 0 12px rgba(239,68,68,.08);' +
      '}' +
      '.verdict-card-warning{' +
        'border-color:rgba(0,200,255,.35);' +      /* warning também usa azul (não amarelo) */
        'background:rgba(0,200,255,.04);' +
        'box-shadow:0 0 12px rgba(0,200,255,.08);' +
      '}' +
      '.verdict-card-good{' +
        'border-color:rgba(34,197,94,.4);' +
        'background:rgba(34,197,94,.04);' +
        'box-shadow:0 0 12px rgba(34,197,94,.08);' +
      '}' +
      /* elementos internos — todos centralizados */
      '.vc-header{margin-bottom:6px;text-align:center;}' +
      '.vc-title{font-size:.95rem;font-weight:600;letter-spacing:.03em;line-height:1.3;text-align:center;}' +
      '.verdict-card-bad .vc-title{color:#ef4444;}' +
      '.verdict-card-warning .vc-title{color:rgba(0,200,255,.95);}' + /* azul no warning */
      '.verdict-card-good .vc-title{color:#22c55e;}' +
      '.vc-subtitle{font-size:.82rem;color:rgba(200,210,240,.65);margin-bottom:14px;line-height:1.55;text-align:center;}' +
      '.vc-issues{list-style:none;padding:10px 0 0 0;margin:0 0 4px 0;border-top:1px solid rgba(0,200,255,.1);text-align:center;}' +
      '.vc-issues li{font-size:.82rem;color:rgba(200,210,240,.85);padding:5px 0;line-height:1.5;border-bottom:1px solid rgba(255,255,255,.04);text-align:center;}' +
      '.vc-issues li:last-child{border-bottom:none;}' +
      '.vc-mastered-warning{margin-top:12px;padding:8px 12px;background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.2);border-radius:6px;font-size:.8rem;color:rgba(0,200,255,.9);line-height:1.5;text-align:center;}' +
      /* Botão secundário: scroll para sugestões (warning/bad) */
      '#btnCorrigirAntes{display:block;width:100%;margin:0 0 10px 0;padding:8px 0;' +
        'background:transparent;border:1px solid rgba(0,200,255,.25);border-radius:8px;' +
        'color:rgba(0,200,255,.7);font-family:Rajdhani,sans-serif;font-size:12px;font-weight:500;' +
        'letter-spacing:.03em;cursor:pointer;' +
        'transition:background .2s,border-color .2s;box-sizing:border-box;}' +
      '#btnCorrigirAntes:hover{background:rgba(0,200,255,.05);border-color:rgba(0,200,255,.45);}' +
      /* Botão opcional: ver melhorias (good) */
      '#btnVerMelhorias{display:block;width:100%;margin-top:14px;padding:10px 0;' +
        'background:transparent;border:1px solid rgba(34,197,94,.3);border-radius:10px;' +
        'color:rgba(34,197,94,.8);font-family:Rajdhani,sans-serif;font-size:13px;font-weight:600;' +
        'letter-spacing:.05em;cursor:pointer;transition:background .2s,border-color .2s;box-sizing:border-box;}' +
      '#btnVerMelhorias:hover{background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.5);}' +
      /* Highlight temporário no container de sugestões */
      '@keyframes __suggHighlight{0%{box-shadow:0 0 0 rgba(0,200,255,0);}' +
        '30%{box-shadow:0 0 22px rgba(0,200,255,.45);}' +
        '100%{box-shadow:0 0 0 rgba(0,200,255,0);}}' +
      '.verdict-suggestions-highlight{animation:__suggHighlight 2.5s ease forwards;' +
        'border:1px solid rgba(0,200,255,.4)!important;border-radius:12px;}';
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: label curto (.score-final-status)
  // ─────────────────────────────────────────────────────────────

  var ICON = { good: '\uD83D\uDFE2', warning: '\uD83D\uDFE1', bad: '\uD83D\uDD34' };

  function _renderScoreLabel(verdict) {
    var el = document.querySelector('.score-final-status');
    if (!el) {
      vwarn('[VERDICT] .score-final-status não encontrado — score label não atualizado');
      return;
    }
    el.textContent = (ICON[verdict.status] || '\uD83D\uDFE1') + ' ' + verdict.label;
    el.className   = 'score-final-status verdict-' + verdict.status;

    // Badge "pode já estar masterizada"
    if (verdict.possiblyMastered) {
      var badge = document.getElementById('__verdictMasteredBadge__');
      if (!badge) {
        badge    = document.createElement('div');
        badge.id = '__verdictMasteredBadge__';
        el.parentNode.insertBefore(badge, el.nextSibling);
      }
      badge.textContent = '\u26a0\ufe0f Esta faixa pode j\u00e1 estar masterizada';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: card estruturado do veredito (acima do score)
  // ─────────────────────────────────────────────────────────────

  var COLOR_MAP = { good: '#22c55e', warning: '#f59e0b', bad: '#ef4444' };

  /**
   * Gera o innerHTML do card de veredito estruturado.
   * Reutiliza dados calc. por generateMixVerdict — lógica intacta.
   */
  function _buildVerdictCardHTML(verdict) {
    var metrics = verdict.metrics || {};
    var fails   = verdict.fails   || {};

    var title, subtitle;
    if (verdict.status === 'bad') {
      title    = 'Mix com problemas críticos';
      subtitle = 'Não recomendado masterizar neste estado. Ajustes são necessários.';
    } else if (verdict.status === 'warning') {
      title    = 'Masterização possível com limitações';
      subtitle = 'Alguns fatores podem limitar o resultado final da masterização.';
    } else {
      title    = 'Mix pronta para masterização';
      subtitle = 'Os níveis estão dentro dos parâmetros ideais para processamento.';
    }

    var bullets = [];
    if (verdict.status === 'bad') {
      if (metrics.clipping) {
        bullets.push('Clipping detectado \u2014 distorção no sinal fonte');
      }
      if (metrics.tp !== null && metrics.tp !== undefined && metrics.tp > 0) {
        bullets.push('True Peak acima de 0 dBTP (' + fmt1(metrics.tp) + ' dBTP)');
      }
      if (metrics.crestFactor !== null && metrics.crestFactor !== undefined && metrics.crestFactor < 8) {
        bullets.push('Crest Factor cr\u00edtico (' + fmt1(metrics.crestFactor) + ' dB) \u2014 mix hiperlimitada');
      }
    } else if (verdict.status === 'warning') {
      // ── Thresholds din\u00e2micos do JSON de g\u00eanero (SSOT) ──
      var _ths    = verdict.thresholds || {};
      var _tpLim  = (_ths.tpWarnAbove !== null && _ths.tpWarnAbove !== undefined)
        ? fmt1(_ths.tpWarnAbove) : '-1.0';
      var _lufsL  = (_ths.lufsLower !== null && _ths.lufsLower !== undefined)
        ? fmt1(_ths.lufsLower) : '-26.0';
      var _lufsU  = (_ths.lufsUpper !== null && _ths.lufsUpper !== undefined)
        ? fmt1(_ths.lufsUpper) : '-14.0';
      var _drMn   = (_ths.drMin !== null && _ths.drMin !== undefined)
        ? fmt1(_ths.drMin) : '8.0';
      var _lraL   = (_ths.lraLower !== null && _ths.lraLower !== undefined)
        ? fmt1(_ths.lraLower) : '6.0';
      var _lraU   = (_ths.lraUpper !== null && _ths.lraUpper !== undefined)
        ? fmt1(_ths.lraUpper) : '14.0';

      if (fails.tpFail && metrics.tp !== null && metrics.tp !== undefined) {
        bullets.push('True Peak em ' + fmt1(metrics.tp) + ' dBTP (limite: \u2264 ' + _tpLim + ' dBTP)');
      }
      if (fails.lufsFail && metrics.lufs !== null && metrics.lufs !== undefined) {
        bullets.push('Volume de entrada em ' + fmt1(metrics.lufs) + ' LUFS (janela: ' + _lufsL + ' a ' + _lufsU + ' LUFS)');
      }
      if (fails.drFail && metrics.dr !== null && metrics.dr !== undefined) {
        bullets.push('Range din\u00e2mico DR ' + fmt1(metrics.dr) + ' (m\u00ednimo aceito: DR ' + _drMn + ')');
      }
      if (fails.lraFail && metrics.lra !== null && metrics.lra !== undefined) {
        bullets.push('LRA em ' + fmt1(metrics.lra) + ' LU (faixa do g\u00eanero: ' + _lraL + ' a ' + _lraU + ' LU)');
      }
      if (fails.cfFail && metrics.crestFactor !== null && metrics.crestFactor !== undefined) {
        bullets.push('Crest Factor ' + fmt1(metrics.crestFactor) + ' dB (m\u00ednimo: 8 dB)');
      }
    } else {
      if (metrics.lufs !== null && metrics.lufs !== undefined) {
        bullets.push('Volume: ' + fmt1(metrics.lufs) + ' LUFS \u2713');
      }
      if (metrics.tp !== null && metrics.tp !== undefined) {
        bullets.push('True Peak: ' + fmt1(metrics.tp) + ' dBTP \u2713');
      }
      if (metrics.dr !== null && metrics.dr !== undefined) {
        bullets.push('Range din\u00e2mico: DR ' + fmt1(metrics.dr) + ' \u2713');
      }
    }

    var bulletsHTML = '';
    if (bullets.length > 0) {
      bulletsHTML = '<ul class="vc-issues">' +
        bullets.map(function (b) { return '<li>\u2022 ' + b + '</li>'; }).join('') +
        '</ul>';
    }

    var masteredHTML = '';
    if (verdict.possiblyMastered) {
      masteredHTML =
        '<div class="vc-mastered-warning">' +
        '\u26a0\ufe0f Esta faixa pode j\u00e1 estar masterizada \u2014 masterizar novamente pode degradar a qualidade.' +
        '</div>';
    }

    return (
      '<div class="vc-header"><span class="vc-title">' + title + '</span></div>' +
      '<div class="vc-subtitle">' + subtitle + '</div>' +
      bulletsHTML +
      masteredHTML
    );
  }

  function _renderMainTextAndCTA(verdict, techData) {
    var scoreContainer = document.getElementById('final-score-display');
    if (!scoreContainer) {
      vwarn('[VERDICT] ERRO: #final-score-display n\u00e3o encontrado \u2014 abortando render');
      return false;
    }
    vlog('[VERDICT] container encontrado (#final-score-display) \u2014 renderizando verdict-card');

    // Ocultar .score-final-status e remover badge separado (migrados para o card)
    var statusEl = scoreContainer.querySelector('.score-final-status');
    if (statusEl) { statusEl.style.display = 'none'; }
    var badgeEl = document.getElementById('__verdictMasteredBadge__');
    if (badgeEl) { badgeEl.remove(); }

    // Remover inst\u00e2ncias pr\u00e9vias (idempotente)
    var existingCard = scoreContainer.querySelector('.verdict-card');
    if (existingCard) { existingCard.remove(); }
    var existingText = scoreContainer.querySelector('.verdict-main-text');
    if (existingText) { existingText.remove(); }

    // Construir novo card estruturado
    var card = document.createElement('div');
    card.className = 'verdict-card verdict-card-' + verdict.status;
    card.innerHTML = _buildVerdictCardHTML(verdict);

    // Inserir ANTES de .score-final-label (card fica acima do score)
    var labelEl = scoreContainer.querySelector('.score-final-label');
    if (labelEl) {
      scoreContainer.insertBefore(card, labelEl);
    } else {
      scoreContainer.insertBefore(card, scoreContainer.firstChild);
    }
    vlog('[VERDICT] verdict-card inserido antes de .score-final-label (status=' + verdict.status + ')');

    // Atualizar CTA: texto + estilo baseado no veredito
    var masterBtn = document.getElementById('btnMasterizar');
    if (masterBtn) {
      // Limpar estados anteriores
      masterBtn.classList.remove('action-btn--warning', 'action-btn--disabled');
      masterBtn.style.pointerEvents = 'auto';
      masterBtn.removeAttribute('aria-disabled');

      if (verdict.status === 'bad') {
        masterBtn.textContent = '\u274c Corrigir antes de masterizar';
        masterBtn.classList.add('action-btn--disabled');
        masterBtn.style.pointerEvents = 'none';
        masterBtn.setAttribute('aria-disabled', 'true');
      } else if (verdict.status === 'warning') {
        masterBtn.textContent = '\u26a0\ufe0f Masterizar mesmo assim';
        masterBtn.classList.add('action-btn--warning');
      } else {
        masterBtn.textContent = '\uD83D\uDD25 Masterizar agora';
      }

      masterBtn.parentNode && masterBtn.parentNode.removeChild(masterBtn);
      masterBtn.style.position = 'relative';
      masterBtn.style.zIndex   = '2';
      scoreContainer.appendChild(masterBtn);
      vlog('[VERDICT] #btnMasterizar atualizado e posicionado (status=' + verdict.status + ')');
    } else {
      vwarn('[VERDICT] #btnMasterizar n\u00e3o encontrado no DOM \u2014 CTA n\u00e3o posicionado');
    }

    // ── Botão secundário: scroll para sugestões (warning / bad) ─────────────
    var existingCorrigir = document.getElementById('btnCorrigirAntes');
    if (existingCorrigir) { existingCorrigir.remove(); }
    if (verdict.status === 'warning' || verdict.status === 'bad') {
      var corrigirBtn    = document.createElement('button');
      corrigirBtn.id     = 'btnCorrigirAntes';
      corrigirBtn.type   = 'button';
      corrigirBtn.textContent = 'Ver correções';
      corrigirBtn.addEventListener('click', function () {
        var sugSection = document.getElementById('aiSuggestionsExpanded');
        if (!sugSection) { return; }
        if (sugSection.style.display === 'none') { sugSection.style.display = ''; }
        sugSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        sugSection.classList.add('verdict-suggestions-highlight');
        setTimeout(function () { sugSection.classList.remove('verdict-suggestions-highlight'); }, 2500);
      });
      var masterBtnRef = document.getElementById('btnMasterizar');
      if (masterBtnRef) {
        scoreContainer.insertBefore(corrigirBtn, masterBtnRef);
      } else {
        scoreContainer.appendChild(corrigirBtn);
      }
      vlog('[VERDICT] #btnCorrigirAntes inserido para status=' + verdict.status);
    }
    // ── Fim botão secundário ─────────────────────────────────────────────────

    // Limpar duplicatas do card
    document.querySelectorAll('.verdict-card').forEach(function (el, i) {
      if (i > 0) { el.remove(); }
    });

    vlog('[VERDICT] verdict-card renderizado e CTA reposicionado');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // CONTROLE DE VISIBILIDADE DAS SUGESTÕES
  // ─────────────────────────────────────────────────────────────

  /**
   * Oculta cards além do índice 4 (máx 5) e esconde o container
   * se o número de sugestões visíveis for < 3.
   */
  function _validateAndCapSuggestions(sugSection) {
    var grid = document.getElementById('aiExpandedGrid');
    if (!grid) { return; }
    var cards = Array.from(grid.querySelectorAll('.ai-suggestion-card'));
    vlog('[VERDICT] _validateAndCapSuggestions: cards encontrados =', cards.length);

    if (cards.length === 0) {
      sugSection.style.display = 'none';
      vlog('[VERDICT] sem sugestões (0 cards) — container ocultado');
      return;
    }
    // Cap a 3
    if (cards.length > 3) {
      cards.slice(3).forEach(function (c) { c.style.display = 'none'; });
      vlog('[VERDICT] sugestões capadas a 3 (havia ' + cards.length + ')');
    }
    // Ocultar somente se não há cards visíveis
    var visible = cards.filter(function (c) { return c.style.display !== 'none'; });
    if (visible.length === 0) {
      sugSection.style.display = 'none';
      vlog('[VERDICT] nenhuma sugestão visível — container ocultado');
    }
  }

  /**
   * Controla visibilidade de #aiSuggestionsExpanded com base no veredito:
   *  - good    → oculta sugestões, insere botão "Ver melhorias opcionais"
   *  - warning → garante visível; valida/capa
   *  - bad     → garante visível + highlight; valida/capa
   */
  function _applySuggestionVisibility(verdict) {
    var sugSection    = document.getElementById('aiSuggestionsExpanded');
    var scoreContainer = document.getElementById('final-score-display');

    // Remover botão opcional anterior (idempotente)
    var existingVerMelhorias = document.getElementById('btnVerMelhorias');
    if (existingVerMelhorias) { existingVerMelhorias.remove(); }

    if (!sugSection) {
      vwarn('[VERDICT] #aiSuggestionsExpanded não encontrado — visibilidade não controlada');
      return;
    }

    if (verdict.status === 'good') {
      // APTO: ocultar sugestões e oferecer botão opcional
      sugSection.style.display = 'none';
      if (scoreContainer) {
        var verBtn       = document.createElement('button');
        verBtn.id        = 'btnVerMelhorias';
        verBtn.type      = 'button';
        verBtn.textContent = '\uD83D\uDD0E Ver melhorias opcionais';
        verBtn.addEventListener('click', function () {
          sugSection.style.display = '';
          verBtn.remove();
          sugSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        scoreContainer.appendChild(verBtn);
      }
      vlog('[VERDICT] status=good — sugestões ocultas; botão opcional inserido');
      return;
    }

    // warning / bad: garantir que a seção está visível
    if (sugSection.style.display === 'none') {
      sugSection.style.display = '';
    }

    // bad: highlight temporário na seção de sugestões
    if (verdict.status === 'bad') {
      sugSection.classList.add('verdict-suggestions-highlight');
      setTimeout(function () { sugSection.classList.remove('verdict-suggestions-highlight'); }, 2500);
    }

    // Validar e capar sugestões renderizadas
    _validateAndCapSuggestions(sugSection);
    vlog('[VERDICT] status=' + verdict.status + ' — sugestões controladas');
  }

  // ─────────────────────────────────────────────────────────────
  // PONTO DE ENTRADA PRINCIPAL
  // Chamado APÓS displayModalResults resolver (Promise.then)
  // ─────────────────────────────────────────────────────────────

  function applyMixVerdictToRenderedModal(analysis) {
    try {
      vlog('[VERDICT-AUDIT] ─────────────────────────────────────────────');
      vlog('[VERDICT-AUDIT] applyMixVerdictToRenderedModal iniciado');

      var src = analysis
                || window.__VERDICT_SOURCE_DATA__
                || window.__LAST_BACKEND_DATA__
                || {};

      vlog('[VERDICT-AUDIT] fonte de dados:', {
        hasAnalysis:       !!(analysis && typeof analysis === 'object'),
        hasVerdictSource:  !!window.__VERDICT_SOURCE_DATA__,
        hasLastBackend:    !!window.__LAST_BACKEND_DATA__,
        hasTechData:       !!(src && src.technicalData),
        techDataKeys:      src && src.technicalData ? Object.keys(src.technicalData).slice(0, 8).join(',') : 'n/a'
      });

      // Gerar veredito a partir de technicalData (prioritário) ou objeto raiz
      var techData = (src.technicalData && typeof src.technicalData === 'object')
        ? src.technicalData
        : (src.metrics && typeof src.metrics === 'object' ? src.metrics : src);

      // ── Resolver targets do gênero (SSOT: mesma cadeia dos cards) ──
      var _tRes            = _resolveVerdictTargets();
      var _resolvedTargets = _tRes.targets;
      var _resolvedGenre   = _tRes.genre;

      vlog('[VERDICT-AUDIT] targets resolvidos:', {
        genre:            _resolvedGenre,
        hasTargets:       !!_resolvedTargets,
        lufs_target:      _resolvedTargets ? _resolvedTargets.lufs_target      : null,
        tol_lufs:         _resolvedTargets ? _resolvedTargets.tol_lufs         : null,
        dr_target:        _resolvedTargets ? _resolvedTargets.dr_target        : null,
        tol_dr:           _resolvedTargets ? _resolvedTargets.tol_dr           : null,
        lra_target:       _resolvedTargets ? _resolvedTargets.lra_target       : null,
        tol_lra:          _resolvedTargets ? _resolvedTargets.tol_lra          : null,
        true_peak_target: _resolvedTargets ? _resolvedTargets.true_peak_target : null,
        tol_true_peak:    _resolvedTargets ? _resolvedTargets.tol_true_peak    : null
      });

      var vResult = generateMixVerdict(techData, _resolvedTargets);
      if (!vResult || !vResult.verdict) {
        vwarn('[VERDICT-AUDIT] \u274c n\u00e3o foi poss\u00edvel gerar veredito \u2014 abortando');
        return;
      }

      var verdict = vResult.verdict;
      window.__LAST_MIX_VERDICT__ = verdict;

      // ── Log completo de auditoria (coerência veredito ↔ cards) ──
      vlog('[VERDICT-AUDIT] \u2500\u2500\u2500\u2500\u2500\u2500\u2500 RESULTADO COMPLETO \u2500\u2500\u2500\u2500\u2500\u2500\u2500');
      vlog('[VERDICT-AUDIT]', {
        genre:   _resolvedGenre,
        metrics: {
          lufs:        verdict.metrics ? verdict.metrics.lufs        : null,
          tp:          verdict.metrics ? verdict.metrics.tp          : null,
          dr:          verdict.metrics ? verdict.metrics.dr          : null,
          lra:         verdict.metrics ? verdict.metrics.lra         : null,
          crestFactor: verdict.metrics ? verdict.metrics.crestFactor : null
        },
        targets: {
          lufs_target:      _resolvedTargets ? _resolvedTargets.lufs_target      : null,
          tol_lufs:         _resolvedTargets ? _resolvedTargets.tol_lufs         : null,
          dr_target:        _resolvedTargets ? _resolvedTargets.dr_target        : null,
          tol_dr:           _resolvedTargets ? _resolvedTargets.tol_dr           : null,
          lra_target:       _resolvedTargets ? _resolvedTargets.lra_target       : null,
          tol_lra:          _resolvedTargets ? _resolvedTargets.tol_lra          : null,
          true_peak_target: _resolvedTargets ? _resolvedTargets.true_peak_target : null,
          tol_true_peak:    _resolvedTargets ? _resolvedTargets.tol_true_peak    : null
        },
        thresholds:    verdict.thresholds,
        fails:         verdict.fails,
        finalVerdict:  verdict.status,
        label:         verdict.label,
        possiblyMastered: verdict.possiblyMastered
      });

      _injectStyles();

      // ── 1. Label curto (.score-final-status) ──
      var scoreLabelEl = document.querySelector('.score-final-status');
      vlog('[VERDICT-AUDIT] .score-final-status encontrado:', !!scoreLabelEl);
      _renderScoreLabel(verdict);

      // ── 2. Texto grande + CTA (dentro de #final-score-display) ──
      var _scoreContainerAudit = document.getElementById('final-score-display');
      vlog('[VERDICT-AUDIT] #final-score-display encontrado:', !!_scoreContainerAudit);

      var ok = _renderMainTextAndCTA(verdict, techData);
      vlog('[VERDICT-AUDIT] _renderMainTextAndCTA retornou:', ok);

      // ── 3. Remover bloco de diagnóstico antigo (gerado por renderFinalScoreAtTop) ──
      var oldDiagnostic = document.querySelector('#final-score-display #diagnostic-container');
      vlog('[VERDICT-AUDIT] diagnostic antigo:', oldDiagnostic);
      if (oldDiagnostic) {
        oldDiagnostic.remove();
        vlog('[VERDICT-AUDIT] #diagnostic-container removido');
      }
      // Proteção: garantir que não haja nenhuma instância restante
      document.querySelectorAll('#diagnostic-container').forEach(function (el) { el.remove(); });

      // ── 4. Snapshot de confirmação ──
      var verdictBoxEl = _scoreContainerAudit ? _scoreContainerAudit.querySelector('.verdict-main-text') : null;
      if (verdictBoxEl) {
        vlog('[VERDICT-AUDIT] .verdict-main-text após render:',
          '| texto[0..80]="' + (verdictBoxEl.textContent || '').slice(0, 80) + '"'
        );
      }

      // #verdictMasterBtn removido — CTA gerenciado por #btnMasterizar (HTML estático)

      // ── 5. Controle de visibilidade das sugestões ──────────────────────────
      _applySuggestionVisibility(verdict);
      vlog('[VERDICT-AUDIT] _applySuggestionVisibility concluído — status=' + verdict.status);

      if (ok) {
        vlog('[VERDICT-AUDIT] ✅ fluxo finalizado — status=' + verdict.status);
      } else {
        vwarn('[VERDICT-AUDIT] ⚠️ fluxo concluído com falha parcial');
      }
      vlog('[VERDICT-AUDIT] ─────────────────────────────────────────────');
    } catch (err) {
      vwarn('[VERDICT-AUDIT] ❌ erro em applyMixVerdictToRenderedModal:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // OBSERVADOR: MutationObserver em #audioAnalysisResults
  //
  // Abordagem v4: em vez de patchear window.displayModalResults,
  // observamos diretamente quando #audioAnalysisResults se torna
  // visível (display=block). Isso dispara independente da cadeia
  // de chamadas interna do motor.
  //
  // Debounce de 500ms para aguardar todas as mutações DOM
  // (AI enrichment assíncrono, sugestões, tabelas, etc.)
  // ─────────────────────────────────────────────────────────────

  function _installResultsObserver() {
    var resultsEl = document.getElementById('audioAnalysisResults');
    if (!resultsEl) {
      vwarn('[VERDICT-AUDIT] #audioAnalysisResults não encontrado — observer não instalado');
      return false;
    }

    var debounceTimer = null;
    var lastVisibleState = false;

    var obs = new MutationObserver(function (mutations) {
      var nowVisible = resultsEl.style.display === 'block';

      if (nowVisible && !lastVisibleState) {
        // Transição hidden → visible
        lastVisibleState = true;
        vlog('[VERDICT-AUDIT] #audioAnalysisResults ficou visível — aguardando 500ms para DOM estabilizar');

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          var src = window.__VERDICT_SOURCE_DATA__
                 || window.__LAST_BACKEND_DATA__
                 || {};

          vlog('[VERDICT-AUDIT] disparo do veredito — fonte de dados:',
            src && src.technicalData ? '✅ technicalData presente' : '⚠️ technicalData ausente',
            '| keys:', src ? Object.keys(src).slice(0,6).join(',') : 'nenhum'
          );

          applyMixVerdictToRenderedModal(src);
        }, 500);

      } else if (!nowVisible && lastVisibleState) {
        // Modal fechado
        lastVisibleState = false;
        clearTimeout(debounceTimer);
        vlog('[VERDICT-AUDIT] #audioAnalysisResults ocultado — timer cancelado');
      }
    });

    obs.observe(resultsEl, { attributes: true, attributeFilter: ['style'] });
    vlog('[VERDICT-AUDIT] ✅ MutationObserver instalado em #audioAnalysisResults');
    return true;
  }

  window.addEventListener('load', function () {
    // Tentar instalar imediatamente
    if (_installResultsObserver()) { return; }

    // Se o elemento ainda não existe, tentar periodicamente
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (_installResultsObserver() || attempts >= 30) {
        clearInterval(timer);
        if (attempts >= 30) {
          vwarn('[VERDICT-AUDIT] ❌ #audioAnalysisResults não encontrado após 30 tentativas — fallback para patch');
          _installFallbackPatch();
        }
      }
    }, 250);
  });

  // ─────────────────────────────────────────────────────────────
  // FALLBACK: patch de window.displayModalResults
  // Usado apenas se o MutationObserver não pôde ser instalado.
  // ─────────────────────────────────────────────────────────────

  function _installFallbackPatch() {
    // 📡 Usa evento central de render (substituiu monkey-patching de window.displayModalResults)
    if (window.__VERDICT_EVENT_LISTENER_INSTALLED__) { return; }
    window.__VERDICT_EVENT_LISTENER_INSTALLED__ = true;
    document.addEventListener('analysis:rendered', function(event) {
      var analysis = event.detail;
      if (analysis) { window.__VERDICT_SOURCE_DATA__ = analysis; }
      applyMixVerdictToRenderedModal(analysis);
    });
    vwarn('[VERDICT-AUDIT] 📡 Listener analysis:rendered instalado (substituiu fallback patch)');
  }

  // ─────────────────────────────────────────────────────────────
  // EXPORTS GLOBAIS
  // ─────────────────────────────────────────────────────────────

  window.generateMixVerdict              = generateMixVerdict;
  window.applyMixVerdictToRenderedModal  = applyMixVerdictToRenderedModal;
  window.applyMixVerdict                 = applyMixVerdictToRenderedModal; // alias retrocompat
  window.generateMixVerdictMainText      = generateMixVerdictMainText;
  window.extractVerdictMetrics           = extractMetrics;

})();
