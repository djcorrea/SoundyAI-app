/**
 * event-tracker.js — SoundyAI Funnel Tracking
 * 
 * Função global: track(event, data)
 * 
 * - Gera/reutiliza sessionId via localStorage
 * - Aguarda resolução do Firebase Auth antes de pegar o token
 * - Suporta home.html (__firebaseAuthReady) e planos.html (window.currentUser)
 * - Envia POST /api/track e retorna Promise (suporta await no call site)
 * - Nunca lança exceção — não deve impactar fluxo principal
 *
 * @version 1.1.0
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

  // ── Obter token Firebase aguardando resolução de auth ─────────────────
  //
  // Estratégia em ordem de prioridade:
  //  1. window.__firebaseAuthReady — Promise criada por home.html que resolve
  //     com o usuário na primeira mudança de estado (segura para await)
  //  2. window.currentUser — variável global populada via onAuthStateChanged
  //     em planos.html; já estará preenchida quando o usuário clicar
  //  3. window.__firebaseAuth.currentUser — fallback direto (menos seguro
  //     em page load, mas útil em contextos onde auth já está resolvido)
  //
  async function getUserTokenSafe() {
    try {
      // Prioridade 1: __firebaseAuthReady (home.html)
      if (window.__firebaseAuthReady) {
        var user = await window.__firebaseAuthReady;
        if (!user) return null;
        return await user.getIdToken(false);
      }

      // Prioridade 2: window.currentUser (planos.html)
      if (window.currentUser) {
        return await window.currentUser.getIdToken(false);
      }

      // Prioridade 3: currentUser direto (já resolvido em contextos tardios)
      var auth = window.__firebaseAuth;
      if (auth && auth.currentUser) {
        return await auth.currentUser.getIdToken(false);
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Função principal de tracking ──────────────────────────────────────
  /**
   * Envia um evento de tracking para o backend.
   * Retorna uma Promise que resolve quando o fetch é concluído —
   * use `await track(...)` antes de redirects para garantir envio.
   *
   * @param {string} eventName - Nome do evento (ex: 'result_viewed')
   * @param {Object} [data]    - Dados adicionais (valores primitivos apenas)
   * @returns {Promise<void>}
   */
  window.track = async function track(eventName, data) {
    try {
      var sessionId = getSessionId();
      var token     = await getUserTokenSafe();

      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      await fetch('/api/track', {
        method:  'POST',
        headers: headers,
        body:    JSON.stringify({
          event:     eventName,
          sessionId: sessionId,
          data:      data || {},
        }),
        // keepalive garante envio mesmo se a página for descarregada em seguida
        keepalive: true,
      });

    } catch (_) {
      // Nunca lançar exceção — tracking não deve impactar o fluxo
    }
  };

})();

