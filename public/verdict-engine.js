/**
 * VERDICT ENGINE (MIX) v2.0
 * Camada de interpretacao final — reaproveitamento total da UI existente.
 *
 * Fluxo: analise -> targets -> score -> sugestoes -> VERDICT ENGINE -> modal
 *
 * NAO modifica: score, sugestoes, targets, pipeline, estrutura modal.
 * Reaproveitamento:
 *   .score-final-status  — label do score substituido pelo veredito
 *   #aiHelperText        — conteudo substituido pelo diagnostico tecnico
 *   #masterBtnVerdict    — botao Masterizar (criado uma vez, reutilizado)
 *   SEM elementos extras (mixVerdictBanner removido)
 */
(function () {
  'use strict';

  // ── UTILITARIOS ────────────────────────────────────────────

  function safeNum(v) {
    var n = Number(v);
    return (v !== undefined && v !== null && isFinite(n)) ? n : null;
  }

  function fmt(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toFixed(1);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── EXTRACAO DE METRICAS ───────────────────────────────────

  function extractMetrics(data) {
    var tech = data;
    if (data && data.technicalData && typeof data.technicalData === 'object') {
      tech = data.technicalData;
    }
    if (!tech || typeof tech !== 'object') { tech = {}; }

    var lufs = safeNum(tech.lufsIntegrated !== undefined ? tech.lufsIntegrated
                     : tech.lufs_integrated !== undefined ? tech.lufs_integrated
                     : tech.lufs);

    var tp = safeNum(tech.truePeakDbtp !== undefined ? tech.truePeakDbtp
                   : tech.true_peak_dbtp !== undefined ? tech.true_peak_dbtp
                   : tech.truePeak);

    var dr = safeNum(tech.dynamicRange !== undefined ? tech.dynamicRange
                   : tech.dynamic_range !== undefined ? tech.dynamic_range
                   : tech.dr);

    var cf = safeNum(tech.crestFactor !== undefined ? tech.crestFactor : tech.crest_factor);

    var clipSamples = safeNum(tech.clippingSamples !== undefined ? tech.clippingSamples : tech.clipping_samples);
    var clipPct     = safeNum(tech.clippingPct !== undefined ? tech.clippingPct : tech.clipping_pct);
    var clipping    = !!(
      tech.clippingDetected     ||
      tech.clipping_detected    ||
      (clipSamples !== null && clipSamples > 0) ||
      (clipPct     !== null && clipPct     > 0)
    );

    return { lufs: lufs, tp: tp, dr: dr, crestFactor: cf, clipping: clipping };
  }

  // ── LOGICA DO VEREDITO ─────────────────────────────────────

  function generateMixVerdict(dataOrMetrics) {
    var m = (dataOrMetrics && (dataOrMetrics.lufs !== undefined || dataOrMetrics.tp !== undefined))
      ? dataOrMetrics
      : extractMetrics(dataOrMetrics);

    var lufs = m.lufs, tp = m.tp, dr = m.dr, cf = m.crestFactor, clipping = m.clipping;

    var possiblyMastered = (lufs !== null && lufs >= -11 && tp !== null && tp >= -1.2);

    // Vermelho — qualquer condicao critica
    if (clipping || (tp !== null && tp >= -0.3) || (lufs !== null && lufs >= -10)) {
      return _build('bad', 'Mix nao recomendada para masterizacao', 'bad',
        m, clipping, possiblyMastered);
    }

    // Verde — condicoes ideais
    if (!clipping &&
        lufs !== null && lufs >= -16 && lufs <= -14 &&
        tp   !== null && tp   <= -3  &&
        dr   !== null && dr   >= 10  &&
        (cf  === null || cf >= 6)) {
      return _build('good', 'Mix pronta para masterizacao', 'good',
        m, false, possiblyMastered);
    }

    // Amarelo — range aceitavel
    if (!clipping &&
        lufs !== null && lufs >= -18 && lufs <= -13 &&
        tp   !== null && tp   <= -2  &&
        dr   !== null && dr   >= 9) {
      return _build('warning', 'Mix pode melhorar antes da masterizacao', 'warning',
        m, false, possiblyMastered);
    }

    // Fallback
    return _build('warning', 'Mix pode melhorar antes da masterizacao', 'warning',
      m, false, possiblyMastered);
  }

  function _build(status, label, color, m, clipping, possiblyMastered) {
    return {
      verdict: {
        status:           status,
        label:            label,
        color:            color,
        message:          _buildMessage(status, m, clipping, possiblyMastered),
        possiblyMastered: possiblyMastered
      }
    };
  }

  function _buildMessage(status, m, clipping, possiblyMastered) {
    var lufs = m.lufs, tp = m.tp, dr = m.dr;

    var mastered = possiblyMastered
      ? ' As metricas indicam que a faixa pode ja estar masterizada - masterizar novamente pode degradar a qualidade.'
      : '';

    if (status === 'bad') {
      var problems = [];
      if (clipping)                        { problems.push('clipping detectado'); }
      if (tp !== null && tp >= -0.3)       { problems.push('True Peak muito alto (' + fmt(tp) + ' dBTP)'); }
      if (lufs !== null && lufs >= -10)    { problems.push('LUFS saturado (' + fmt(lufs) + ' LUFS)'); }
      if (dr !== null && dr < 9)           { problems.push('Dynamic Range comprimida (DR ' + fmt(dr) + ')'); }
      var plist = problems.length ? problems.join('; ') : 'problemas tecnicos criticos';
      return 'Esta mix apresenta ' + plist + ', o que pode comprometer o resultado da masterizacao.'
           + ' Corrija esses pontos na sua DAW antes de masterizar.' + mastered;
    }

    if (status === 'good') {
      var parts = [];
      if (lufs !== null) { parts.push('LUFS ' + fmt(lufs)); }
      if (tp   !== null) { parts.push('True Peak ' + fmt(tp) + ' dBTP'); }
      if (dr   !== null) { parts.push('DR ' + fmt(dr)); }
      return 'Excelente! A mix esta no range ideal'
           + (parts.length ? ' (' + parts.join('; ') + ')' : '')
           + '. A masterizacao podera ser aplicada com maxima eficiencia e qualidade.' + mastered;
    }

    // warning
    var wpoints = [];
    if (lufs !== null) {
      if (lufs < -18)      { wpoints.push('LUFS um pouco baixo (' + fmt(lufs) + ')'); }
      else if (lufs > -13) { wpoints.push('LUFS um pouco alto (' + fmt(lufs) + ')'); }
    }
    if (tp !== null && tp > -2) { wpoints.push('True Peak em ' + fmt(tp) + ' dBTP'); }
    if (dr !== null && dr < 10) { wpoints.push('Dynamic Range comprimida (DR ' + fmt(dr) + ')'); }

    var msg = 'A mix esta funcional mas pode ser otimizada antes da masterizacao.';
    if (wpoints.length) { msg += ' Pontos de atencao: ' + wpoints.join('; ') + '.'; }
    return msg + mastered;
  }

  // ── ESTILOS (injetados uma vez) ────────────────────────────

  function _injectStyles() {
    if (document.getElementById('__verdictStyles__')) { return; }
    var s = document.createElement('style');
    s.id = '__verdictStyles__';
    s.textContent =
      '@keyframes __verdictIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}' +
      '.verdict-good{color:#22c55e!important;animation:__verdictIn .35s ease;}' +
      '.verdict-warning{color:#f59e0b!important;animation:__verdictIn .35s ease;}' +
      '.verdict-bad{color:#ef4444!important;animation:__verdictIn .35s ease;}' +
      '#aiHelperText{animation:__verdictIn .45s ease;}' +
      '#masterBtnVerdict{' +
        'display:block;width:100%;margin-top:14px;padding:13px 0;' +
        'background:linear-gradient(135deg,#8b5cf6 0%,#4a8fff 100%);' +
        'color:#fff;border:none;border-radius:10px;' +
        'font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700;' +
        'letter-spacing:.08em;text-transform:uppercase;cursor:pointer;' +
        'transition:opacity .2s,transform .2s;' +
      '}' +
      '#masterBtnVerdict:hover{opacity:.88;transform:translateY(-1px);}';
    document.head.appendChild(s);
  }

  // ── RENDER 1 — Score label (.score-final-status) ───────────

  var ICON = { good: '🟢', warning: '🟡', bad: '🔴' };

  function renderVerdictScoreLabel(v) {
    var el = document.querySelector('.score-final-status');
    if (!el) { return; }

    el.textContent = (ICON[v.status] || '🟡') + ' ' + v.label;
    el.className   = 'score-final-status verdict-' + v.status;

    // Alerta "pode ja estar masterizada" logo abaixo
    if (v.possiblyMastered) {
      var warnEl = document.getElementById('__verdictMasteredWarn__');
      if (!warnEl) {
        warnEl = document.createElement('div');
        warnEl.id = '__verdictMasteredWarn__';
        warnEl.style.cssText =
          'font-size:11px;color:#fbbf24;margin-top:6px;padding:4px 8px;' +
          'background:rgba(251,191,36,.08);border-radius:5px;' +
          'border:1px solid rgba(251,191,36,.22);display:inline-block;';
        el.parentNode.insertBefore(warnEl, el.nextSibling);
      }
      warnEl.textContent = '\u26a0 Sua musica pode ja estar masterizada.';
    }
  }

  // ── RENDER 2 — Texto IA (#aiHelperText) ───────────────────

  var AI_COLORS = { good: '#22c55e', warning: '#f59e0b', bad: '#ef4444' };

  function renderVerdictAIText(v) {
    var aiBox = document.getElementById('aiHelperText');
    if (!aiBox) { return; }
    aiBox.innerHTML = escHtml(v.message);
    aiBox.style.color = AI_COLORS[v.status] || '#c8d3e8';
  }

  // ── RENDER 3 — Botao Masterizar (#masterBtnVerdict) ───────

  function renderVerdictMasterBtn() {
    var aiBox = document.getElementById('aiHelperText');
    if (!aiBox) { return; }

    var masterBtn = document.getElementById('masterBtnVerdict');
    if (!masterBtn) {
      masterBtn = document.createElement('button');
      masterBtn.id   = 'masterBtnVerdict';
      masterBtn.type = 'button';
      masterBtn.textContent = 'MASTERIZAR AGORA';
      if (aiBox.parentNode) {
        aiBox.parentNode.insertBefore(masterBtn, aiBox.nextSibling);
      }
    }

    masterBtn.onclick = function () {
      if (typeof window.startAutoMasterFlow === 'function') {
        window.startAutoMasterFlow();
        return;
      }
      var fileKey  = window.__HOME_FILE_KEY__  || window.__PENDING_FILE_KEY__  || '';
      var fileName = window.__HOME_FILE_NAME__ || window.__PENDING_FILE_NAME__ || '';
      var url = 'master.html'
              + (fileKey  ? '?fileKey='  + encodeURIComponent(fileKey)  : '')
              + (fileName ? '&fileName=' + encodeURIComponent(fileName) : '');
      window.open(url, '_blank', 'noopener,noreferrer');
    };
  }

  // ── PONTO DE ENTRADA ──────────────────────────────────────

  function applyMixVerdict(data) {
    try {
      var src = data
                || window.__VERDICT_SOURCE_DATA__
                || window.__LAST_BACKEND_DATA__
                || {};
      var vResult = generateMixVerdict(src);
      var v = vResult.verdict;
      window.__LAST_MIX_VERDICT__ = v;

      _injectStyles();
      renderVerdictScoreLabel(v);
      renderVerdictAIText(v);
      renderVerdictMasterBtn();
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[VERDICT ENGINE] Erro ao aplicar veredito:', err);
      }
    }
  }

  // ── AUTO-PATCH: displayModalResults ───────────────────────

  window.addEventListener('load', function () {
    var attempts = 0;
    (function tryPatch() {
      attempts++;
      var fn = window.displayModalResults;
      if (typeof fn !== 'function') {
        if (attempts < 40) { setTimeout(tryPatch, 250); }
        return;
      }
      if (fn.__verdictPatched__) { return; }

      var _orig = fn;
      window.displayModalResults = function verdictDisplayWrapper(analysis) {
        if (analysis) { window.__VERDICT_SOURCE_DATA__ = analysis; }
        var result = _orig.apply(this, arguments);
        setTimeout(function () { applyMixVerdict(analysis); }, 300);
        return result;
      };
      window.displayModalResults.__verdictPatched__ = true;
    })();
  });

  // ── EXPORTS GLOBAIS ───────────────────────────────────────

  window.generateMixVerdict    = generateMixVerdict;
  window.applyMixVerdict       = applyMixVerdict;
  window.extractVerdictMetrics = extractMetrics;

})();
