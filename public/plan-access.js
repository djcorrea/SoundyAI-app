// public/plan-access.js
// Centraliza decisões de acesso por plano/capabilities.
// Regras:
// - analysis.isReduced / analysis.analysisMode==='reduced' tem prioridade máxima
// - Usa analysis.planFeatures quando disponível (fonte de verdade vinda do backend)
// - Fallback seguro por plan (free/plus/pro) apenas se planFeatures não existir

(function () {
  'use strict';

  const FEATURE_KEYS = {
    ai: 'canAiHelp',
    pdf: 'canPdf',
    suggestions: 'canSuggestions',
    spectralAdvanced: 'canSpectralAdvanced',
  };

  function getCurrentAnalysis() {
    return (
      window.currentModalAnalysis ||
      window.__soundyAI?.analysis ||
      window.__CURRENT_ANALYSIS__ ||
      null
    );
  }

  function isReducedAnalysis(analysis) {
    const a = analysis || getCurrentAnalysis();
    if (!a) return window.APP_MODE === 'reduced';

    return (
      window.APP_MODE === 'reduced' ||
      a.isReduced === true ||
      a.analysisMode === 'reduced'
    );
  }

  function getCurrentPlan(analysis) {
    const a = analysis || getCurrentAnalysis();
    return (
      a?.plan ||
      window.userPlan ||
      'free'
    );
  }

  function getPlanFeatures(analysis) {
    const a = analysis || getCurrentAnalysis();

    // Preferir sempre o que veio do backend.
    if (a?.planFeatures && typeof a.planFeatures === 'object') {
      return a.planFeatures;
    }

    // Fallback seguro (não libera recursos por engano).
    const plan = getCurrentPlan(a);
    if (plan === 'pro' || plan === 'full' || plan === 'premium') {
      return {
        canSuggestions: true,
        canSpectralAdvanced: true,
        canAiHelp: true,
        canPdf: true,
      };
    }

    if (plan === 'plus') {
      return {
        canSuggestions: true,
        canSpectralAdvanced: false,
        canAiHelp: false,
        canPdf: false,
      };
    }

    return {
      canSuggestions: false,
      canSpectralAdvanced: false,
      canAiHelp: false,
      canPdf: false,
    };
  }

  function canUseFeature(featureName, analysis) {
    const a = analysis || getCurrentAnalysis();

    // Prioridade máxima: reduced bloqueia recursos premium.
    if (isReducedAnalysis(a)) {
      if (featureName === 'ai' || featureName === 'pdf') return false;
      // Outras features podem depender do seu guard específico.
    }

    const planFeatures = getPlanFeatures(a);
    const key = FEATURE_KEYS[featureName] || featureName;

    // Se a chave existir, usar estritamente.
    if (key in planFeatures) {
      return planFeatures[key] === true;
    }

    // Fallback: não liberar desconhecido.
    return false;
  }

  // Nota: quem decide full vs reduced é o backend.
  // Aqui, expomos um helper coerente, sem reescrever fluxo.
  function shouldRunFullAnalysis(analysis) {
    const a = analysis || getCurrentAnalysis();
    return !isReducedAnalysis(a);
  }

  window.SoundyAccess = {
    getCurrentAnalysis,
    isReducedAnalysis,
    getCurrentPlan,
    getPlanFeatures,
    canUseFeature,
    shouldRunFullAnalysis,
  };

  console.log('✅ [PLAN-ACCESS] SoundyAccess inicializado');
})();
