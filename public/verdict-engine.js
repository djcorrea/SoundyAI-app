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
 *     3. substitui #aiHelperText (texto grande explicativo)
 *     4. insere/atualiza #verdictMasterBtn abaixo do texto grande
 *
 * NAO altera: score numerico, cards de metricas, sugestoes, tabelas, fluxo.
 * Elemento-alvo: #aiHelperText (bloco grande central abaixo do score).
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

    // Substituir conteúdo — innerHTML permite tags no texto gerado
    aiBox.innerHTML = generateMixVerdictMainText(verdict, techData);
    aiBox.style.color = COLOR_MAP[verdict.status] || '#c8d3e8';
    aiBox.classList.add('verdict-applied');
    aiBox.style.display = '';            // garantir visível mesmo em modo reference
    vlog('[VERDICT] texto principal atualizado (status=' + verdict.status + ')');

    // Remover duplicatas de botões anteriores (mantém só o primeiro)
    var allCtaBtns = document.querySelectorAll('#verdictMasterBtn');
    allCtaBtns.forEach(function (el, i) { if (i > 0) { el.remove(); } });

    // CTA — criar imediatamente abaixo de #aiHelperText via insertAdjacentElement
    var cta = document.getElementById('verdictMasterBtn');
    if (!cta) {
      cta      = document.createElement('button');
      cta.id   = 'verdictMasterBtn';
      cta.type = 'button';
      cta.textContent = 'MASTERIZAR AGORA';
      aiBox.insertAdjacentElement('afterend', cta);
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

      var vResult = generateMixVerdict(techData);
      if (!vResult || !vResult.verdict) {
        vwarn('[VERDICT-AUDIT] ❌ não foi possível gerar veredito — abortando');
        return;
      }

      var verdict = vResult.verdict;
      window.__LAST_MIX_VERDICT__ = verdict;

      vlog('[VERDICT-AUDIT] veredito gerado:', {
        status:           verdict.status,
        label:            verdict.label,
        possiblyMastered: verdict.possiblyMastered,
        lufs:             verdict.metrics && verdict.metrics.lufs,
        tp:               verdict.metrics && verdict.metrics.tp,
        dr:               verdict.metrics && verdict.metrics.dr
      });

      _injectStyles();

      // ── 1. Label curto (.score-final-status) ──
      var scoreLabelEl = document.querySelector('.score-final-status');
      vlog('[VERDICT-AUDIT] .score-final-status encontrado:', !!scoreLabelEl);
      _renderScoreLabel(verdict);

      // ── 2. Texto grande + CTA (#aiHelperText) ──
      var aiHelperEl = document.getElementById('aiHelperText');
      vlog('[VERDICT-AUDIT] #aiHelperText encontrado:', !!aiHelperEl,
        aiHelperEl ? '| display=' + (aiHelperEl.style.display || 'CSS') : ''
      );

      var ok = _renderMainTextAndCTA(verdict, techData);
      vlog('[VERDICT-AUDIT] _renderMainTextAndCTA retornou:', ok);

      // ── 3. Snapshot de confirmação ──
      var aiEl2 = document.getElementById('aiHelperText');
      if (aiEl2) {
        vlog('[VERDICT-AUDIT] #aiHelperText após render:',
          'display=' + (aiEl2.style.display || 'CSS'),
          '| texto[0..80]="' + (aiEl2.textContent || '').slice(0, 80) + '"'
        );
      }

      var ctaEl = document.getElementById('verdictMasterBtn');
      vlog('[VERDICT-AUDIT] #verdictMasterBtn presente no DOM:', !!ctaEl);

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
    var fn = window.displayModalResults;
    if (typeof fn !== 'function' || fn.__verdictPatched__) { return; }

    var _orig = fn;
    window.displayModalResults = function verdictDisplayWrapper(analysis) {
      if (analysis) { window.__VERDICT_SOURCE_DATA__ = analysis; }
      var result;
      try {
        result = _orig.apply(this, arguments);
      } catch (syncErr) {
        vwarn('[VERDICT-AUDIT] erro síncrono em displayModalResults (fallback):', syncErr);
        applyMixVerdictToRenderedModal(analysis);
        return;
      }
      if (result && typeof result.then === 'function') {
        result.then(
          function () { applyMixVerdictToRenderedModal(analysis); },
          function () { applyMixVerdictToRenderedModal(analysis); }
        );
      } else {
        setTimeout(function () { applyMixVerdictToRenderedModal(analysis); }, 500);
      }
      return result;
    };
    window.displayModalResults.__verdictPatched__ = true;
    vwarn('[VERDICT-AUDIT] ⚠️ Fallback patch instalado em window.displayModalResults');
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
