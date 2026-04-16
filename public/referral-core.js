/**
 * 🔗 REFERRAL SYSTEM V3 - CORE MODULE
 * Captura e rastreia visitantes via parâmetro ?ref
 * 
 * Uso: Importar em landing.html e index.html
 * Execução: Automática (IIFE)
 * Backend: POST /api/referral/track-visitor
 */

(function() {
  'use strict';

  debugLog('[REFERRAL] 🚀 Sistema de afiliados inicializado');

  /**
   * Gera UUID v4 válido
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Valida UUID v4
   */
  function isValidUUID(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  /**
   * Valida partnerId (3-50 chars alfanuméricos)
   */
  function isValidPartnerId(partnerId) {
    const regex = /^[a-z0-9_-]{3,50}$/i;
    return regex.test(partnerId);
  }

  /**
   * Captura parâmetro ?ref da URL
   */
  function getReferralFromURL() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      
      if (ref && isValidPartnerId(ref)) {
        debugLog('[REFERRAL] ✅ Código de parceiro capturado:', ref);
        return ref;
      }
      
      if (ref && !isValidPartnerId(ref)) {
        debugWarn('[REFERRAL] ⚠️ Código inválido (ignorado):', ref);
      }
      
      return null;
    } catch (error) {
      debugError('[REFERRAL] ❌ Erro ao capturar URL:', error);
      return null;
    }
  }

  /**
   * Obtém ou cria visitorId
   */
  function getOrCreateVisitorId() {
    try {
      let visitorId = localStorage.getItem('soundy_visitor_id');
      
      // Validar UUID existente
      if (visitorId && isValidUUID(visitorId)) {
        debugLog('[REFERRAL] 🔄 Visitor ID existente:', visitorId);
        return visitorId;
      }
      
      // Gerar novo UUID
      visitorId = generateUUID();
      localStorage.setItem('soundy_visitor_id', visitorId);
      debugLog('[REFERRAL] 🆕 Visitor ID criado:', visitorId);
      
      return visitorId;
    } catch (error) {
      debugError('[REFERRAL] ❌ Erro ao gerenciar visitor ID:', error);
      return generateUUID(); // Fallback sem localStorage
    }
  }

  /**
   * Salva dados do referral no localStorage
   */
  function saveReferralData(partnerId) {
    try {
      const timestamp = new Date().toISOString();
      
      localStorage.setItem('soundy_referral_code', partnerId);
      localStorage.setItem('soundy_referral_timestamp', timestamp);
      
      debugLog('[REFERRAL] 💾 Dados salvos no localStorage:', {
        partnerId,
        timestamp
      });
      
      return timestamp;
    } catch (error) {
      debugError('[REFERRAL] ❌ Erro ao salvar no localStorage:', error);
      return new Date().toISOString();
    }
  }

  /**
   * Limpa parâmetro ?ref da URL (sem reload)
   */
  function cleanURLParams() {
    try {
      const url = new URL(window.location);
      
      if (url.searchParams.has('ref')) {
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url);
        debugLog('[REFERRAL] 🧹 URL limpa (parâmetro removido)');
      }
    } catch (error) {
      debugError('[REFERRAL] ⚠️ Erro ao limpar URL:', error);
    }
  }

  /**
   * Envia rastreamento ao backend
   */
  async function trackVisitorOnBackend(visitorId, partnerId, timestamp) {
    try {
      // Usar ApiUrlResolver se disponível, senão fallback para window.getAPIUrl
      let apiUrl;
      
      if (typeof window.ApiUrlResolver !== 'undefined' && typeof window.ApiUrlResolver.buildApiUrl === 'function') {
        apiUrl = window.ApiUrlResolver.buildApiUrl('referral/track-visitor');
      } else if (typeof window.getAPIUrl === 'function') {
        apiUrl = window.getAPIUrl('/api/referral/track-visitor');
      } else {
        apiUrl = '/api/referral/track-visitor';
      }
      
      debugLog('[REFERRAL] 📡 Enviando rastreamento ao backend...');
      debugLog('[REFERRAL] 🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          visitorId,
          partnerId,
          timestamp,
          userAgent: navigator.userAgent,
          referrer: document.referrer || '(direct)'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        debugLog('[REFERRAL] ✅ Rastreamento salvo com sucesso!', {
          visitorId: result.data?.visitorId,
          partnerId: result.data?.partnerId,
          isNew: result.data?.isNew
        });
      } else {
        debugWarn('[REFERRAL] ⚠️ Backend retornou success=false:', result);
      }
      
      return result;
    } catch (error) {
      debugError('[REFERRAL] ❌ Erro ao enviar rastreamento:', error);
      // FALHA SILENCIOSA: Não quebra a página
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica se já existe rastreamento válido
   */
  function hasValidReferral() {
    try {
      const visitorId = localStorage.getItem('soundy_visitor_id');
      const referralCode = localStorage.getItem('soundy_referral_code');
      const timestamp = localStorage.getItem('soundy_referral_timestamp');
      
      if (!visitorId || !referralCode || !timestamp) {
        return false;
      }
      
      // Validar idade do referral (30 dias)
      const referralDate = new Date(timestamp);
      const now = new Date();
      const daysDiff = (now - referralDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 30) {
        debugLog('[REFERRAL] ⏰ Referral expirado (>30 dias)');
        return false;
      }
      
      debugLog('[REFERRAL] ✅ Referral válido encontrado:', {
        referralCode,
        age: Math.floor(daysDiff) + ' dias'
      });
      
      return true;
    } catch (error) {
      debugError('[REFERRAL] ❌ Erro ao verificar referral:', error);
      return false;
    }
  }

  /**
   * FUNÇÃO PRINCIPAL: Processa captura de referral
   */
  async function processReferral() {
    try {
      // 1. Capturar ?ref da URL
      const partnerId = getReferralFromURL();
      
      if (!partnerId) {
        // Verificar se já existe referral salvo
        if (hasValidReferral()) {
          debugLog('[REFERRAL] ℹ️ Usando referral existente (sem novo ?ref)');
        } else {
          debugLog('[REFERRAL] ℹ️ Sem código de parceiro na URL');
        }
        return;
      }

      // 2. Obter ou criar visitor ID
      const visitorId = getOrCreateVisitorId();
      
      if (!visitorId) {
        debugError('[REFERRAL] ❌ Falha ao obter visitor ID');
        return;
      }

      // 3. Verificar se já está rastreado (idempotência)
      const existingCode = localStorage.getItem('soundy_referral_code');
      
      if (existingCode && existingCode === partnerId) {
        debugLog('[REFERRAL] ℹ️ Parceiro já rastreado (idempotente)');
        cleanURLParams();
        return;
      }
      
      if (existingCode && existingCode !== partnerId) {
        debugWarn('[REFERRAL] ⚠️ Sobrescrevendo referral anterior:', {
          anterior: existingCode,
          novo: partnerId
        });
      }

      // 4. Salvar no localStorage
      const timestamp = saveReferralData(partnerId);

      // 5. Limpar URL
      cleanURLParams();

      // 6. Enviar ao backend
      await trackVisitorOnBackend(visitorId, partnerId, timestamp);

    } catch (error) {
      debugError('[REFERRAL] ❌ Erro crítico no processamento:', error);
      // FALHA SILENCIOSA: Não quebra a página
    }
  }

  // 🚀 EXECUÇÃO AUTOMÁTICA
  // Aguardar DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processReferral);
  } else {
    // DOM já carregado
    processReferral();
  }

})();
