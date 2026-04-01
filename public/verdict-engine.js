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
   *
   * Ordem de importância (pré-master):
   *   clipping → true peak → crest factor → headroom → LUFS (contexto)
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

    // ── REGRA FIXA DE PRONTID\u00c3O PARA MASTERIZA\u00c7\u00c3O ──
    // PRONTO quando: TP \u2264 -1 E LUFS entre -26 e -14 E DR \u2265 8 E Crest \u2265 8
    // Qualquer viola\u00e7\u00e3o dessas regras resulta em WARNING ou BAD.

    // BAD: clipping real OU TP > 0 (sinal j\u00e1 saturado)
    if (clipping || (tp !== null && tp > 0)) {
      return {
        verdict: {
          status:           'bad',
          label:            'Mix com clipping \u2014 n\u00e3o enviar para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m
        }
      };
    }

    // WARNING: alguma m\u00e9trica fora dos limiares de seguran\u00e7a
    var tpFail   = (tp   !== null && tp   > -1);
    var lufsFail = (lufs !== null && (lufs < -26 || lufs > -14));
    var drFail   = (dr   !== null && dr   < 8);
    var cfFail   = (cf   !== null && cf   < 8);

    if (tpFail || lufsFail || drFail || cfFail) {
      return {
        verdict: {
          status:           'warning',
          label:            'Mix requer ajustes para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m,
          fails:            { tpFail: tpFail, lufsFail: lufsFail, drFail: drFail, cfFail: cfFail }
        }
      };
    }

    // GOOD: todas as m\u00e9tricas dentro dos limiares
    return {
      verdict: {
        status:           'good',
        label:            '\u2714 PRONTO PARA MASTERIZA\u00c7\u00c3O',
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
      if (rawTp !== null && rawTp >= -0.5) {
        problems.push('True Peak cr\u00edtico (' + (tp || rawTp) + ' dBTP)');
      }
      if (rawCf !== null && rawCf <= 8) {
        problems.push('Crest Factor muito baixo (' + (cf || rawCf) + ' dB) \u2014 mix hiperlimitada');
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
      var fails  = verdict.fails || {};
      var wIssues = [];
      if (fails.tpFail   && rawTp   !== null) { wIssues.push('True Peak em ' + tp + ' dBTP (limite: \u2264 \u22121)'); }
      if (fails.lufsFail && rawLufs !== null) { wIssues.push('LUFS em ' + lu + ' (janela segura: \u221226 a \u221214)'); }
      if (fails.drFail   && rawDr   !== null) { wIssues.push('DR em ' + dr + ' (m\u00ednimo: 8)'); }
      if (fails.cfFail   && rawCf   !== null) { wIssues.push('Crest Factor em ' + cf + ' dB (m\u00ednimo: 8)'); }

      var wLine = wIssues.length
        ? ' Pontos fora dos limiares: ' + wIssues.join('; ') + '.'
        : '';

      return 'Sua mix ainda n\u00e3o atinge todos os crit\u00e9rios de seguran\u00e7a para masteriza\u00e7\u00e3o.' +
             wLine +
             ' Corrija os itens indicados antes de enviar para masteria\u00e7\u00e3o' +
             metricsSuffix + '.' + possiblyMasteredNote;
    }

    // good
    return 'Sua mix apresenta headroom e din\u00e2mica adequados para processamento. Pequenos ajustes s\u00e3o opcionais.' +
           (metricsInline ? ' (' + metricsInline + ')' : '') +
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
      '.verdict-card{padding:18px 24px;border-radius:12px;margin-bottom:16px;background:rgba(10,15,28,.65);border:1px solid rgba(100,120,180,.2);text-align:left;backdrop-filter:blur(10px);animation:__verdictIn .4s ease;position:relative;z-index:1;}' +
      '.verdict-card-bad{border-color:rgba(239,68,68,.4);}' +
      '.verdict-card-warning{border-color:rgba(245,158,11,.4);}' +
      '.verdict-card-good{border-color:rgba(34,197,94,.4);}' +
      '.vc-header{margin-bottom:8px;}' +
      '.vc-title{font-size:.95rem;font-weight:600;letter-spacing:.02em;}' +
      '.verdict-card-bad .vc-title{color:#ef4444;}' +
      '.verdict-card-warning .vc-title{color:#f59e0b;}' +
      '.verdict-card-good .vc-title{color:#22c55e;}' +
      '.vc-subtitle{font-size:.82rem;color:rgba(200,210,240,.7);margin-bottom:12px;line-height:1.5;}' +
      '.vc-issues{list-style:none;padding:0;margin:0 0 4px 0;}' +
      '.vc-issues li{font-size:.82rem;color:rgba(200,210,240,.88);padding:4px 0;line-height:1.5;}' +
      '.vc-mastered-warning{margin-top:12px;padding:8px 12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);border-radius:6px;font-size:.8rem;color:#fbbf24;line-height:1.5;}';
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
      subtitle = 'Não enviar para masterização neste estado';
    } else if (verdict.status === 'warning') {
      title    = 'Mix requer ajustes antes de masterizar';
      subtitle = 'Masterizar agora pode comprometer o resultado final';
    } else {
      title    = '\u2714 Mix pronta para masterização';
      subtitle = 'Os níveis estão dentro dos parâmetros ideais para processamento';
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
      if (fails.tpFail && metrics.tp !== null && metrics.tp !== undefined) {
        bullets.push('True Peak em ' + fmt1(metrics.tp) + ' dBTP (limite: \u2264 \u22121 dBTP)');
      }
      if (fails.lufsFail && metrics.lufs !== null && metrics.lufs !== undefined) {
        bullets.push('Volume de entrada em ' + fmt1(metrics.lufs) + ' LUFS (janela segura: \u221226 a \u221214)');
      }
      if (fails.drFail && metrics.dr !== null && metrics.dr !== undefined) {
        bullets.push('Range din\u00e2mico DR ' + fmt1(metrics.dr) + ' (m\u00ednimo recomendado: 8)');
      }
      if (fails.cfFail && metrics.crestFactor !== null && metrics.crestFactor !== undefined) {
        bullets.push('Crest Factor ' + fmt1(metrics.crestFactor) + ' dB (m\u00ednimo recomendado: 8)');
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

    // Mover #btnMasterizar para logo ap\u00f3s .score-final-bar-container
    var masterBtn = document.getElementById('btnMasterizar');
    if (masterBtn) {
      masterBtn.parentNode && masterBtn.parentNode.removeChild(masterBtn);
      masterBtn.style.position      = 'relative';
      masterBtn.style.zIndex        = '2';
      masterBtn.style.pointerEvents = 'auto';
      var barContainer = scoreContainer.querySelector('.score-final-bar-container');
      if (barContainer) {
        barContainer.insertAdjacentElement('afterend', masterBtn);
      } else {
        scoreContainer.appendChild(masterBtn);
      }
      vlog('[VERDICT] #btnMasterizar posicionado ap\u00f3s .score-final-bar-container');
    } else {
      vwarn('[VERDICT] #btnMasterizar n\u00e3o encontrado no DOM \u2014 CTA n\u00e3o posicionado');
    }

    // Limpar duplicatas do card
    document.querySelectorAll('.verdict-card').forEach(function (el, i) {
      if (i > 0) { el.remove(); }
    });

    vlog('[VERDICT] verdict-card renderizado e CTA reposicionado');
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
