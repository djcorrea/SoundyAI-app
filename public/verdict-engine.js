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
   * Retorna { verdict: { status, label, possiblyMastered, targets, thresholds, fails } }
   * status: 'bad' | 'warning' | 'good'
   *
   * Ordem de importância (pré-master):
   *   clipping → true peak (headroom) → LUFS → crest factor → DR → LRA
   *
   * Thresholds derivados do JSON de gênero (mesma fonte que os cards).
   * Quando genreTargets=null, avalia apenas TP/clipping (absolutos).
   */
  function generateMixVerdict(dataOrMetrics, genreTargets) {
    // Aceita tanto o objeto analysis completo quanto métricas já extraídas
    var m = (dataOrMetrics && (dataOrMetrics.lufs !== undefined || dataOrMetrics.tp !== undefined))
      ? dataOrMetrics
      : extractMetrics(dataOrMetrics);

    var lufs     = m.lufs;
    var tp       = m.tp;
    var dr       = m.dr;
    var cf       = m.crestFactor;
    var lra      = m.lra;
    var clipping = m.clipping;

    // ── THRESHOLDS DERIVADOS DO JSON DE GÊNERO (SSOT) ──
    var t = (genreTargets && typeof genreTargets === 'object') ? genreTargets : null;

    // LUFS: range aceito = [lufs_target - tol_lufs, lufs_target + tol_lufs]
    var lufsLower = (t && typeof t.lufs_target === 'number' && typeof t.tol_lufs === 'number')
      ? t.lufs_target - t.tol_lufs : null;
    var lufsUpper = (t && typeof t.lufs_target === 'number' && typeof t.tol_lufs === 'number')
      ? t.lufs_target + t.tol_lufs : null;

    // True Peak: headroom — limiar superior aceito derivado do gênero (ONE-SIDED: só penaliza alto)
    // HARD CAP absoluto: tp > 0.0 = BAD sempre, independe do JSON
    var tpWarnAbove = (t && typeof t.true_peak_target === 'number' && typeof t.tol_true_peak === 'number')
      ? t.true_peak_target + t.tol_true_peak
      : -1.0;  // fallback conservador quando sem targets
    if (tpWarnAbove > 0.0) { tpWarnAbove = 0.0; }  // nunca passa do HARD CAP

    // DR: ONE-SIDED — alerta quando abaixo do mínimo aceito (target - tolerância)
    var drMin = (t && typeof t.dr_target === 'number' && typeof t.tol_dr === 'number')
      ? t.dr_target - t.tol_dr : null;

    // LRA: range aceito = [lra_target - tol_lra, lra_target + tol_lra]
    var lraLower = (t && typeof t.lra_target === 'number' && typeof t.tol_lra === 'number')
      ? t.lra_target - t.tol_lra : null;
    var lraUpper = (t && typeof t.lra_target === 'number' && typeof t.tol_lra === 'number')
      ? t.lra_target + t.tol_lra : null;

    // Crest Factor: ONE-SIDED fixo (≥8.0=OK, <8.0=ATENÇÃO/CRÍTICA — alinha com os cards)
    var CF_OK_MIN = 8.0;

    var thresholds = {
      tpWarnAbove: tpWarnAbove,
      lufsLower:   lufsLower,
      lufsUpper:   lufsUpper,
      drMin:       drMin,
      lraLower:    lraLower,
      lraUpper:    lraUpper,
      CF_OK_MIN:   CF_OK_MIN
    };

    var possiblyMastered = (lufs !== null && lufs >= -11 && tp !== null && tp >= -1.2);

    // ── ETAPA 1: BAD — clipping real OU TP > 0.0 (sinal saturado) ──
    if (clipping || (tp !== null && tp > 0.0)) {
      return {
        verdict: {
          status:           'bad',
          label:            'Mix com clipping \u2014 n\u00e3o enviar para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m,
          targets:          t,
          thresholds:       thresholds
        }
      };
    }

    // ── ETAPA 2: WARNING — alguma métrica fora do range derivado do gênero ──
    // TP: headroom insuficiente (ONE-SIDED)
    var tpFail = (tp !== null && tp > tpWarnAbove);

    // LUFS: fora do range do gênero (só avalia quando targets disponíveis)
    var lufsFail = (lufs !== null && lufsLower !== null && lufsUpper !== null)
      ? (lufs < lufsLower || lufs > lufsUpper) : false;

    // DR: abaixo do mínimo do gênero (ONE-SIDED, só avalia quando targets disponíveis)
    var drFail = (dr !== null && drMin !== null)
      ? (dr < drMin) : false;

    // LRA: fora do range do gênero (só avalia quando targets disponíveis)
    var lraFail = (lra !== null && lraLower !== null && lraUpper !== null)
      ? (lra < lraLower || lra > lraUpper) : false;

    // CF: ONE-SIDED fixo — alinha com threshold dos cards (cf < CF_OK_MIN = ATENÇÃO/CRÍTICA)
    var cfFail = (cf !== null && cf < CF_OK_MIN);

    if (tpFail || lufsFail || drFail || lraFail || cfFail) {
      return {
        verdict: {
          status:           'warning',
          label:            'Mix requer ajustes para masteriza\u00e7\u00e3o',
          possiblyMastered: possiblyMastered,
          metrics:          m,
          targets:          t,
          thresholds:       thresholds,
          fails:            { tpFail: tpFail, lufsFail: lufsFail, drFail: drFail, lraFail: lraFail, cfFail: cfFail }
        }
      };
    }

    // ── ETAPA 3: GOOD — todas as métricas dentro dos limites ──
    return {
      verdict: {
        status:           'good',
        label:            '\u2714 PRONTO PARA MASTERIZA\u00c7\u00c3O',
        possiblyMastered: possiblyMastered,
        metrics:          m,
        targets:          t,
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
    var rawLra  = safeNum(metrics.lra             !== undefined ? metrics.lra
                        : metrics.loudnessRange   !== undefined ? metrics.loudnessRange
                        : metrics.loudness_range);

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
      var fails      = verdict.fails      || {};
      var ths        = verdict.thresholds || {};
      var wIssues    = [];

      // Textos din\u00e2micos derivados dos targets do g\u00eanero (SSOT)
      var tpLimitVal = (ths.tpWarnAbove !== null && ths.tpWarnAbove !== undefined)
        ? fmt1(ths.tpWarnAbove) : '-1.0';
      var lufsWin    = (ths.lufsLower !== null && ths.lufsLower !== undefined &&
                        ths.lufsUpper !== null && ths.lufsUpper !== undefined)
        ? fmt1(ths.lufsLower) + ' a ' + fmt1(ths.lufsUpper) + ' LUFS'
        : '\u221226 a \u221214 LUFS';
      var drLimitStr = (ths.drMin !== null && ths.drMin !== undefined)
        ? 'DR ' + fmt1(ths.drMin) : 'DR 8';
      var lraWin     = (ths.lraLower !== null && ths.lraLower !== undefined &&
                        ths.lraUpper !== null && ths.lraUpper !== undefined)
        ? fmt1(ths.lraLower) + ' a ' + fmt1(ths.lraUpper) + ' LU'
        : '6 a 14 LU';
      var lra        = fmt1(rawLra);

      if (fails.tpFail   && rawTp   !== null) { wIssues.push('True Peak em ' + tp + ' dBTP (limite: \u2264 ' + tpLimitVal + ' dBTP)'); }
      if (fails.lufsFail && rawLufs !== null) { wIssues.push('LUFS em ' + lu + ' (janela: ' + lufsWin + ')'); }
      if (fails.drFail   && rawDr   !== null) { wIssues.push('DR em ' + dr + ' (m\u00ednimo aceito: ' + drLimitStr + ')'); }
      if (fails.lraFail  && rawLra  !== null) { wIssues.push('LRA em ' + lra + ' LU (faixa do g\u00eanero: ' + lraWin + ')'); }
      if (fails.cfFail   && rawCf   !== null) { wIssues.push('Crest Factor em ' + cf + ' dB (m\u00ednimo: 8 dB)'); }

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
      '.vc-mastered-warning{margin-top:12px;padding:8px 12px;background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.2);border-radius:6px;font-size:.8rem;color:rgba(0,200,255,.9);line-height:1.5;text-align:center;}';
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
