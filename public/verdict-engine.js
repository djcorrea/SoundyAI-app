/**
 * VERDICT ENGINE (MIX) v3.0
 *
 * Camada de interpretacao pos-render — lida DEPOIS que displayModalResults termina.
 *
 * Fluxo:
 *   displayModalResults(analysis) concluido
 *   → applyMixVerdictToRenderedModal(analysis)
 *     1. gera veredito a partir de analysis.technicalData
 *     2. substitui .score-final-status (label curto)
 *     3. substitui #aiHelperText (texto grande explicativo)
 *     4. insere/atualiza #verdictMasterBtn abaixo do texto grande
 *
 * NAO altera: score numerico, cards de metricas, sugestoes, tabelas, fluxo.
 * Elemento-alvo: #aiHelperText (bloco grande central abaixo do score).
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
  // LOGICA DO VEREDITO
  // ─────────────────────────────────────────────────────────────

  /**
   * Retorna { verdict: { status, label, possiblyMastered } }
   * status: 'bad' | 'warning' | 'good'
   */
  function generateMixVerdict(dataOrMetrics) {
    // Aceita tanto o objeto analysis completo quanto métricas já extraídas
    var m = (dataOrMetrics && (dataOrMetrics.lufs !== undefined || dataOrMetrics.tp !== undefined))
      ? dataOrMetrics
      : extractMetrics(dataOrMetrics);

    var lufs     = m.lufs;
    var tp       = m.tp;
    var dr       = m.dr;
    var cf       = m.crestFactor;
    var clipping = m.clipping;

    var possiblyMastered = (lufs !== null && lufs >= -11 && tp !== null && tp >= -1.2);

    // ── VERMELHO: qualquer condição crítica ──
    if (clipping || (tp !== null && tp >= -0.3) || (lufs !== null && lufs >= -10)) {
      return {
        verdict: {
          status:           'bad',
          label:            'Mix n\u00e3o recomendada para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m
        }
      };
    }

    // ── VERDE: condições ideais ──
    if (!clipping &&
        lufs !== null && lufs >= -16 && lufs <= -14 &&
        tp   !== null && tp   <= -3  &&
        dr   !== null && dr   >= 10  &&
        (cf  === null || cf >= 6)) {
      return {
        verdict: {
          status:           'good',
          label:            'Mix apta para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m
        }
      };
    }

    // ── AMARELO: range aceitável ──
    if (!clipping &&
        lufs !== null && lufs >= -18 && lufs <= -13 &&
        tp   !== null && tp   <= -2  &&
        dr   !== null && dr   >= 9) {
      return {
        verdict: {
          status:           'warning',
          label:            'Mix pode melhorar antes da masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m
        }
      };
    }

    // ── FALLBACK ──
    return {
      verdict: {
        status:           'warning',
        label:            'Mix pode melhorar antes da masteriza\u00e7\u00e3o',
        possiblyMastered: possiblyMastered,
        metrics:          m
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // TEXTO GRANDE CENTRAL — generateMixVerdictMainText
  // Recebe verdict e o technicalData original (métricas reais)
  // ─────────────────────────────────────────────────────────────

  function generateMixVerdictMainText(verdict, metrics) {
    metrics = metrics || {};

    // Extrair métricas diretamente do technicalData com nomes corretos
    var rawLufs = safeNum(metrics.lufsIntegrated  !== undefined ? metrics.lufsIntegrated
                        : metrics.lufs_integrated !== undefined ? metrics.lufs_integrated
                        : metrics.lufs);
    var rawTp   = safeNum(metrics.truePeakDbtp    !== undefined ? metrics.truePeakDbtp
                        : metrics.true_peak_dbtp  !== undefined ? metrics.true_peak_dbtp
                        : metrics.truePeak);
    var rawDr   = safeNum(metrics.dynamicRange    !== undefined ? metrics.dynamicRange
                        : metrics.dynamic_range   !== undefined ? metrics.dynamic_range
                        : metrics.dr);
    var rawCf   = safeNum(metrics.crestFactor     !== undefined ? metrics.crestFactor
                        : metrics.crest_factor);

    var lu  = fmt1(rawLufs);
    var tp  = fmt1(rawTp);
    var dr  = fmt1(rawDr);
    var cf  = fmt1(rawCf);

    var luStr = lu  !== null ? lu  + ' LUFS'  : null;
    var tpStr = tp  !== null ? tp  + ' dBTP'  : null;
    var drStr = dr  !== null ? 'DR ' + dr     : null;
    var cfStr = cf  !== null ? 'Crest ' + cf  : null;

    var metricsInline = [luStr, tpStr, drStr, cfStr].filter(Boolean).join(', ');
    var metricsSuffix = metricsInline ? ' (' + metricsInline + ')' : '';

    var possiblyMasteredNote = verdict.possiblyMastered
      ? ' Esta faixa pode j\u00e1 estar masterizada \u2014 masterizar novamente pode degradar a qualidade.'
      : '';

    if (verdict.status === 'bad') {
      var problems = [];
      if (verdict.metrics && verdict.metrics.clipping) {
        problems.push('clipping real detectado');
      }
      if (rawTp !== null && rawTp >= -0.3) {
        problems.push('True Peak muito alto (' + (tp || rawTp) + ' dBTP)');
      }
      if (rawLufs !== null && rawLufs >= -10) {
        problems.push('LUFS saturado (' + (lu || rawLufs) + ')');
      }
      if (rawDr !== null && rawDr < 9) {
        problems.push('Dynamic Range comprimida (DR ' + (dr || rawDr) + ')');
      }
      var pStr = problems.length
        ? ' Os n\u00edveis atuais indicam ' + problems.join(', ') + '.'
        : ' Os n\u00edveis atuais indicam risco de distor\u00e7\u00e3o, perda de defini\u00e7\u00e3o e pouco espa\u00e7o para processamento final.';

      return 'Sua mix n\u00e3o est\u00e1 pronta para masteriza\u00e7\u00e3o.' + pStr +
             ' Se masterizada agora, a faixa tende a ficar mais agressiva, comprimida ou artificial.' +
             ' O ideal \u00e9 corrigir headroom, pico real e equil\u00edbrio antes de seguir' +
             metricsSuffix + '.' + possiblyMasteredNote;
    }

    if (verdict.status === 'warning') {
      var wIssues = [];
      if (rawLufs !== null && rawLufs < -18)       { wIssues.push('LUFS um pouco baixo (' + lu + ')'); }
      else if (rawLufs !== null && rawLufs > -13)  { wIssues.push('LUFS um pouco alto (' + lu + ')'); }
      if (rawTp  !== null && rawTp  > -2)          { wIssues.push('True Peak em ' + tp + ' dBTP'); }
      if (rawDr  !== null && rawDr  < 10)          { wIssues.push('din\u00e2mica reduzida (DR ' + dr + ')'); }

      var wLine = wIssues.length
        ? ' Pontos de aten\u00e7\u00e3o: ' + wIssues.join('; ') + '.'
        : '';

      return 'Sua mix pode ser masterizada, mas ainda h\u00e1 limita\u00e7\u00f5es que reduzem a margem de seguran\u00e7a do processamento final.' +
             wLine +
             ' Pequenos ajustes em headroom, din\u00e2mica ou equil\u00edbrio tonal podem melhorar bastante o resultado da masteriza\u00e7\u00e3o' +
             metricsSuffix + '.' + possiblyMasteredNote;
    }

    // good
    return 'Sua mix est\u00e1 apta para masteriza\u00e7\u00e3o. Os n\u00edveis atuais mostram espa\u00e7o t\u00e9cnico suficiente para aplicar o processamento final com mais seguran\u00e7a e preservar impacto, clareza e defini\u00e7\u00e3o.' +
           (metricsInline ? ' M\u00e9tricas: ' + metricsInline + '.' : '') +
           possiblyMasteredNote;
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
      '#aiHelperText.verdict-applied{' +
        'padding:14px;border-radius:8px;' +
        'background:rgba(30,36,50,.55);' +
        'border:1px solid rgba(100,120,180,.18);' +
        'line-height:1.65;font-size:14px;animation:__verdictIn .4s ease;' +
      '}' +
      '#verdictMasterBtn{' +
        'display:block;width:100%;margin-top:16px;padding:14px 0;' +
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
      '}';
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
  // RENDER: texto grande (#aiHelperText) + CTA (#verdictMasterBtn)
  // ─────────────────────────────────────────────────────────────

  var COLOR_MAP = { good: '#22c55e', warning: '#f59e0b', bad: '#ef4444' };

  function _renderMainTextAndCTA(verdict, techData) {
    var aiBox = document.getElementById('aiHelperText');
    if (!aiBox) {
      vwarn('[VERDICT] #aiHelperText não encontrado — texto principal não atualizado');
      return false;
    }
    vlog('[VERDICT] bloco principal encontrado (#aiHelperText)');

    // Substituir conteúdo completo
    aiBox.textContent = generateMixVerdictMainText(verdict, techData);
    aiBox.style.color = COLOR_MAP[verdict.status] || '#c8d3e8';
    aiBox.classList.add('verdict-applied');
    aiBox.style.display = '';            // garantir visível mesmo em modo reference
    vlog('[VERDICT] texto principal atualizado (status=' + verdict.status + ')');

    // CTA — criar uma vez, reaproveitar
    var cta = document.getElementById('verdictMasterBtn');
    if (!cta) {
      cta           = document.createElement('button');
      cta.id        = 'verdictMasterBtn';
      cta.type      = 'button';
      cta.textContent = 'MASTERIZAR AGORA';
      if (aiBox.parentNode) {
        aiBox.parentNode.insertBefore(cta, aiBox.nextSibling);
      }
    }

    cta.onclick = function () {
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

    vlog('[VERDICT] CTA masterizar inserido (#verdictMasterBtn)');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // PONTO DE ENTRADA PRINCIPAL
  // Chamado APÓS displayModalResults resolver (Promise.then)
  // ─────────────────────────────────────────────────────────────

  function applyMixVerdictToRenderedModal(analysis) {
    try {
      vlog('[VERDICT] modal render detectado — iniciando applyMixVerdictToRenderedModal');

      var src = analysis
                || window.__VERDICT_SOURCE_DATA__
                || window.__LAST_BACKEND_DATA__
                || {};

      // Gerar veredito a partir de technicalData (prioritário) ou objeto raiz
      var techData = (src.technicalData && typeof src.technicalData === 'object')
        ? src.technicalData
        : (src.metrics && typeof src.metrics === 'object' ? src.metrics : src);

      var vResult = generateMixVerdict(techData);
      if (!vResult || !vResult.verdict) {
        vwarn('[VERDICT] não foi possível gerar veredito — abortando');
        return;
      }

      var verdict = vResult.verdict;
      window.__LAST_MIX_VERDICT__ = verdict;

      _injectStyles();

      // 1. Label curto
      _renderScoreLabel(verdict);

      // 2. Texto grande + CTA
      var ok = _renderMainTextAndCTA(verdict, techData);

      if (ok) {
        vlog('[VERDICT] fluxo finalizado — status=' + verdict.status);
      }
    } catch (err) {
      vwarn('[VERDICT] erro em applyMixVerdictToRenderedModal:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // AUTO-PATCH: displayModalResults
  // Aguarda a Promise resolver (async function) para garantir que
  // o DOM está totalmente montado antes de aplicar o veredito.
  // ─────────────────────────────────────────────────────────────

  window.addEventListener('load', function () {
    var attempts = 0;
    (function tryPatch() {
      attempts++;
      var fn = window.displayModalResults;
      if (typeof fn !== 'function') {
        if (attempts < 50) { setTimeout(tryPatch, 250); }
        else { vwarn('[VERDICT] displayModalResults não encontrada após 50 tentativas'); }
        return;
      }
      if (fn.__verdictPatched__) { return; }

      var _orig = fn;

      window.displayModalResults = function verdictDisplayWrapper(analysis) {
        if (analysis) { window.__VERDICT_SOURCE_DATA__ = analysis; }

        var result;
        try {
          result = _orig.apply(this, arguments);
        } catch (syncErr) {
          vwarn('[VERDICT] erro síncrono em displayModalResults:', syncErr);
          applyMixVerdictToRenderedModal(analysis);
          return;
        }

        // displayModalResults é async → result é uma Promise
        if (result && typeof result.then === 'function') {
          result.then(
            function () { applyMixVerdictToRenderedModal(analysis); },
            function () { applyMixVerdictToRenderedModal(analysis); }  // mesmo em erro, tenta o veredito
          );
        } else {
          // Fallback: setTimeout conservador se não for Promise
          setTimeout(function () { applyMixVerdictToRenderedModal(analysis); }, 400);
        }

        return result;
      };

      window.displayModalResults.__verdictPatched__ = true;
      vlog('[VERDICT] displayModalResults patcheada com sucesso');
    })();
  });

  // ─────────────────────────────────────────────────────────────
  // EXPORTS GLOBAIS
  // ─────────────────────────────────────────────────────────────

  window.generateMixVerdict              = generateMixVerdict;
  window.applyMixVerdictToRenderedModal  = applyMixVerdictToRenderedModal;
  window.applyMixVerdict                 = applyMixVerdictToRenderedModal; // alias retrocompat
  window.generateMixVerdictMainText      = generateMixVerdictMainText;
  window.extractVerdictMetrics           = extractMetrics;

})();
