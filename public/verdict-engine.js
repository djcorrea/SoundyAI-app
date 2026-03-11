/**
 * VERDICT ENGINE (MIX) v1.0
 * ─────────────────────────────────────────────────────────────────────────
 * Adiciona uma camada de interpretação final ao fluxo de análise.
 *
 * Posição no fluxo:
 *   análise → targets → score → sugestões → VERDICT ENGINE → modal resultado
 *
 * NÃO modifica:
 *   ❌ cálculo de score
 *   ❌ lógica de sugestões
 *   ❌ targets
 *   ❌ pipeline do motor
 *   ❌ estrutura do modal
 *
 * Apenas adiciona:
 *   ✅ banner de veredito abaixo do score
 *   ✅ texto de diagnóstico no bloco de IA
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     UTILITÁRIOS
  ────────────────────────────────────────────────────────── */

  function safeNum(v) {
    var n = Number(v);
    return (v !== undefined && v !== null && isFinite(n)) ? n : null;
  }

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toFixed(1);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ──────────────────────────────────────────────────────────
     EXTRAÇÃO DE MÉTRICAS
     Suporta estruturas flat e nested (technicalData wrapper)
  ────────────────────────────────────────────────────────── */

  function extractMetrics(data) {
    var tech = data;
    if (data && data.technicalData && typeof data.technicalData === 'object') {
      tech = data.technicalData;
    }
    if (!tech || typeof tech !== 'object') tech = {};

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
      tech.clippingDetected ||
      tech.clipping_detected ||
      (clipSamples !== null && clipSamples > 0) ||
      (clipPct     !== null && clipPct     > 0)
    );

    return { lufs: lufs, tp: tp, dr: dr, crestFactor: cf, clipping: clipping };
  }

  /* ──────────────────────────────────────────────────────────
     LÓGICA DO VEREDITO
  ────────────────────────────────────────────────────────── */

  /**
   * generateMixVerdict(dataOrMetrics)
   * Aceita o objeto de análise completo (analysis) OU
   * um objeto já com chaves {lufs, tp, dr, crestFactor, clipping}.
   *
   * Retorna: { verdict: { status, label, color, message, possiblyMastered } }
   */
  function generateMixVerdict(dataOrMetrics) {
    // Detectar se já são métricas extraídas ou dados brutos
    var m = (dataOrMetrics && (dataOrMetrics.lufs !== undefined || dataOrMetrics.tp !== undefined))
      ? dataOrMetrics
      : extractMetrics(dataOrMetrics);

    var lufs = m.lufs, tp = m.tp, dr = m.dr, cf = m.crestFactor, clipping = m.clipping;

    // ⚠️ Alerta "pode já estar masterizada"
    var possiblyMastered = (lufs !== null && lufs >= -11 && tp !== null && tp >= -1.2);

    // 🔴 BAD — qualquer condição crítica dispara
    if (clipping || (tp !== null && tp >= -0.3) || (lufs !== null && lufs >= -10)) {
      return _build('bad', 'Mix não recomendada para masterização', 'red',
        m, clipping, possiblyMastered);
    }

    // 🟢 GOOD — condições ideais (verificar antes do amarelo)
    if (!clipping &&
        lufs !== null && lufs >= -16 && lufs <= -14 &&
        tp   !== null && tp  <= -3 &&
        dr   !== null && dr  >= 10 &&
        (cf  === null || cf >= 6)) {
      return _build('good', 'Mix pronta para masterização', 'green',
        m, false, possiblyMastered);
    }

    // 🟡 WARNING — range aceitável
    if (!clipping &&
        lufs !== null && lufs >= -18 && lufs <= -13 &&
        tp   !== null && tp  <= -2 &&
        dr   !== null && dr  >= 9) {
      return _build('warning', 'Mix pode melhorar antes da masterização', 'yellow',
        m, false, possiblyMastered);
    }

    // Fallback → warning (dados insuficientes ou fora do range esperado)
    return _build('warning', 'Mix pode melhorar antes da masterização', 'yellow',
      m, false, possiblyMastered);
  }

  /* ──────────────────────────────────────────────────────────
     GERAÇÃO DA MENSAGEM DE DIAGNÓSTICO
  ────────────────────────────────────────────────────────── */

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
      ? ' As métricas indicam que a faixa pode já estar masterizada — masterizar novamente pode degradar a qualidade.'
      : '';

    /* 🔴 BAD */
    if (status === 'bad') {
      var problems = [];
      if (clipping)                          problems.push('clipping detectado nas amostras');
      if (tp   !== null && tp   >= -0.3)     problems.push('True Peak muito alto (' + fmt(tp) + ' dBTP)');
      if (lufs !== null && lufs >= -10)      problems.push('LUFS saturado (' + fmt(lufs) + ' LUFS)');
      if (dr   !== null && dr   < 9)         problems.push('Dynamic Range muito comprimida (DR ' + fmt(dr) + ')');
      var plist = problems.length ? problems.join('; ') : 'problemas técnicos detectados';
      return 'Esta mix apresenta ' + plist + ', o que pode comprometer o resultado da masterização.' +
             ' Corrija esses pontos na sua DAW antes de masterizar.' + mastered;
    }

    /* 🟢 GOOD */
    if (status === 'good') {
      var parts = [];
      if (lufs !== null) parts.push('LUFS ' + fmt(lufs));
      if (tp   !== null) parts.push('True Peak ' + fmt(tp) + ' dBTP');
      if (dr   !== null) parts.push('DR ' + fmt(dr));
      return 'Excelente! A mix está no range ideal' +
             (parts.length ? ' (' + parts.join('; ') + ')' : '') +
             '. A masterização poderá ser aplicada com máxima eficiência e qualidade.' + mastered;
    }

    /* 🟡 WARNING */
    var wpoints = [];
    if (lufs !== null) {
      if (lufs < -18)       wpoints.push('LUFS um pouco baixo (' + fmt(lufs) + ')');
      else if (lufs > -13)  wpoints.push('LUFS um pouco alto (' + fmt(lufs) + ')');
    }
    if (tp !== null && tp > -2)  wpoints.push('True Peak em ' + fmt(tp) + ' dBTP');
    if (dr !== null && dr < 10)  wpoints.push('Dynamic Range comprimida (DR ' + fmt(dr) + ')');

    var msg = 'A mix está funcional mas pode ser otimizada antes da masterização.';
    if (wpoints.length) msg += ' Pontos de atenção: ' + wpoints.join('; ') + '.';
    return msg + mastered;
  }

  /* ──────────────────────────────────────────────────────────
     ESTILOS
  ────────────────────────────────────────────────────────── */

  var COLORS = {
    green:  { bg: 'rgba(52,211,153,.09)',  border: 'rgba(52,211,153,.36)',  fg: '#34d399' },
    yellow: { bg: 'rgba(251,191,36,.09)',  border: 'rgba(251,191,36,.36)',  fg: '#fbbf24' },
    red:    { bg: 'rgba(248,113,113,.09)', border: 'rgba(248,113,113,.36)', fg: '#f87171' }
  };

  var ICONS = { good: '🟢', warning: '🟡', bad: '🔴' };

  function _injectKeyframes() {
    if (document.getElementById('__verdictKF__')) return;
    var s = document.createElement('style');
    s.id = '__verdictKF__';
    s.textContent = '@keyframes __verdictIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(s);
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: BANNER DE VEREDITO (abaixo de #final-score-display)
  ────────────────────────────────────────────────────────── */

  function renderVerdictBanner(v) {
    _injectKeyframes();

    // Remove banner anterior se existir
    var old = document.getElementById('mixVerdictBanner');
    if (old) old.remove();

    var c    = COLORS[v.color] || COLORS.yellow;
    var icon = ICONS[v.status] || '🟡';

    var el = document.createElement('div');
    el.id = 'mixVerdictBanner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:12px 16px;' +
      'border-radius:10px;border:1px solid ' + c.border + ';' +
      'background:' + c.bg + ';margin:14px 0 4px;' +
      'animation:__verdictIn .4s ease;';

    el.innerHTML =
      '<span style="font-size:18px;line-height:1;flex-shrink:0">' + icon + '</span>' +
      '<span style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;' +
             'color:' + c.fg + ';letter-spacing:.04em">' + escHtml(v.label) + '</span>' +
      (v.possiblyMastered
        ? '<span style="font-size:11px;color:#fbbf24;margin-left:auto;flex-shrink:0;' +
                 'white-space:nowrap;padding:2px 8px;background:rgba(251,191,36,.1);' +
                 'border-radius:4px;border:1px solid rgba(251,191,36,.28)">⚠ Pode já estar masterizada</span>'
        : '');

    // Inserir imediatamente após #final-score-display
    var anchor = document.getElementById('final-score-display');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(el, anchor.nextSibling);
    } else {
      // Fallback: topo do #audioAnalysisResults
      var results = document.getElementById('audioAnalysisResults');
      if (results) results.insertBefore(el, results.firstChild);
    }
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: TEXTO DE DIAGNÓSTICO (bloco IA — #aiHelperText)
  ────────────────────────────────────────────────────────── */

  function renderVerdictAIText(v) {
    var aiText = document.getElementById('aiHelperText');
    if (!aiText) return;

    _injectKeyframes();

    var c    = COLORS[v.color] || COLORS.yellow;
    var icon = ICONS[v.status] || '🟡';

    aiText.style.cssText =
      'border:1px solid ' + c.border + ';background:' + c.bg + ';' +
      'border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.6;' +
      'animation:__verdictIn .5s ease;';

    aiText.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<span style="font-size:16px">' + icon + '</span>' +
        '<strong style="color:' + c.fg + ';font-family:Rajdhani,sans-serif;' +
                        'font-size:14px;letter-spacing:.04em">' + escHtml(v.label) + '</strong>' +
      '</div>' +
      '<span style="color:#c8d3e8">' + escHtml(v.message) + '</span>';
  }

  /* ──────────────────────────────────────────────────────────
     PONTO DE ENTRADA PÚBLICO
  ────────────────────────────────────────────────────────── */

  /**
   * window.applyMixVerdict(analysisData)
   * Chamado com o objeto `analysis` retornado pelo motor.
   * Gera e renderiza o veredito no modal.
   */
  function applyMixVerdict(data) {
    try {
      var src = data ||
                window.__VERDICT_SOURCE_DATA__ ||
                window.__LAST_BACKEND_DATA__   ||
                {};
      var vResult = generateMixVerdict(src);
      var v = vResult.verdict;
      window.__LAST_MIX_VERDICT__ = v;
      renderVerdictBanner(v);
      renderVerdictAIText(v);
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[VERDICT ENGINE] Erro ao aplicar veredito:', err);
      }
    }
  }

  /* ──────────────────────────────────────────────────────────
     AUTO-PATCH: displayModalResults após motor carregar
     Funciona em qualquer página que carregue este script.
     Usa flag __verdictPatched__ para não duplicar o wrap.
  ────────────────────────────────────────────────────────── */

  window.addEventListener('load', function () {
    var attempts = 0;
    (function tryPatch() {
      attempts++;
      var fn = window.displayModalResults;
      if (typeof fn !== 'function') {
        if (attempts < 40) setTimeout(tryPatch, 250);
        return;
      }
      if (fn.__verdictPatched__) return; // já patchado (ex: outro script fez o patch)

      var _orig = fn;
      window.displayModalResults = function verdictDisplayWrapper(analysis) {
        // Guardar dados para applyMixVerdict poder acessar
        if (analysis) window.__VERDICT_SOURCE_DATA__ = analysis;
        var result = _orig.apply(this, arguments);
        // Aguardar o DOM renderizar antes de injetar o veredito
        setTimeout(function () { applyMixVerdict(analysis); }, 250);
        return result;
      };
      window.displayModalResults.__verdictPatched__ = true;
    })();
  });

  /* ──────────────────────────────────────────────────────────
     EXPORTS GLOBAIS
  ────────────────────────────────────────────────────────── */

  window.generateMixVerdict   = generateMixVerdict;
  window.applyMixVerdict      = applyMixVerdict;
  window.extractVerdictMetrics = extractMetrics;

})();
