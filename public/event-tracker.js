/**
 * event-tracker.js — SoundyAI Funnel Tracking
 * 
 * Função global: track(event, data)
 * 
 * - Gera/reutiliza sessionId via localStorage
 * - Aguarda resolução do Firebase Auth antes de pegar o token
 * - Usa window.__firebaseAuth (exposto por home.html e planos.html)
 * - Envia POST /api/track e retorna Promise (suporta await no call site)
 * - Nunca lança exceção — não deve impactar fluxo principal
 *
 * @version 1.2.0
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

  // ── Resolver usuário autenticado de forma segura ────────────────────────
  //
  // Usa window.__firebaseAuth.currentUser como fonte mais atualizada.
  // Se currentUser ainda for null (auth ainda inicializando), aguarda o
  // primeiro disparo de onAuthStateChanged, que sempre resolve com o
  // estado real (user ou null) — nunca fica preso indefinidamente.
  //
  async function getUserSafe() {
    try {
      var auth = window.__firebaseAuth;
      if (!auth) return null;

      // Se o usuário já está disponível, retornar imediatamente
      if (auth.currentUser) return auth.currentUser;

      // Aguardar o primeiro disparo de onAuthStateChanged.
      // Firebase sempre dispara uma vez com o estado atual (user ou null).
      return await new Promise(function (resolve) {
        var unsub = auth.onAuthStateChanged(function (user) {
          unsub();       // desinscrito após 1ª chamada
          resolve(user); // resolve com user OU null — ambos tratados
        });
      });
    } catch (_) {
      return null;
    }
  }

  async function getUserTokenSafe() {
    try {
      var user = await getUserSafe();
      if (!user) return null;
      return await user.getIdToken(false);
    } catch (e) {
      console.warn('[event-tracker] Token error:', e.message);
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

