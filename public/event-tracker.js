/**
 * event-tracker.js — SoundyAI Funnel Tracking
 * 
 * Função global: track(event, data)
 * 
 * - Gera/reutiliza sessionId via localStorage
 * - Lê token Firebase se usuário estiver logado
 * - Envia POST /api/track de forma assíncrona (fire-and-forget)
 * - Nunca lança exceção — não deve impactar fluxo principal
 *
 * @version 1.0.0
 */
(function () {
  'use strict';

  // ── Session ID ─────────────────────────────────────────────────────────
  var SESSION_KEY = '__soundy_sid__';

  function getSessionId() {
    try {
      var existing = localStorage.getItem(SESSION_KEY);
      if (existing) return existing;

      // Gerar UUID v4 simples (sem dependência externa)
      var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

      localStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (_) {
      // Fallback se localStorage bloqueado
      return 'ns-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }
  }

  // ── Obter token Firebase (opcional) ───────────────────────────────────
  async function getFirebaseToken() {
    try {
      var auth = window.__firebaseAuth;
      if (!auth) return null;
      var user = auth.currentUser;
      if (!user) return null;
      return await user.getIdToken(false);
    } catch (_) {
      return null;
    }
  }

  // ── Função principal de tracking ──────────────────────────────────────
  /**
   * Envia um evento de tracking para o backend.
   * Fire-and-forget — erros são silenciosos para não quebrar o produto.
   *
   * @param {string} eventName - Nome do evento (ex: 'result_viewed')
   * @param {Object} [data]    - Dados adicionais (valores primitivos apenas)
   */
  window.track = async function track(eventName, data) {
    try {
      var sessionId = getSessionId();
      var token     = await getFirebaseToken();

      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      fetch('/api/track', {
        method:  'POST',
        headers: headers,
        body:    JSON.stringify({
          event:     eventName,
          sessionId: sessionId,
          data:      data || {},
        }),
        // keepalive garante envio mesmo se a página for descarregada em seguida
        keepalive: true,
      }).catch(function () {
        // Silencioso — tracking não deve impactar o fluxo
      });

    } catch (_) {
      // Nunca lançar exceção
    }
  };

})();
