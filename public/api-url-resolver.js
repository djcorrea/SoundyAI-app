/**
 * 🌐 API URL RESOLVER - Detecção Dinâmica de Ambiente
 * 
 * Resolve a URL correta da API baseado no hostname atual.
 * Garante que TESTE chama API TESTE e PROD chama API PROD.
 * 
 * @version 1.0.0
 * @created 2026-01-21
 */

(function() {
    'use strict';

    /**
     * Detecta o ambiente baseado no hostname
     * @returns {'test' | 'production' | 'local'}
     */
    function detectEnvironment() {
        const host = window.location.hostname || '';
        
        // 🧪 Ambiente de TESTE
        if (host.includes('teste') || host.includes('test')) {
            return 'test';
        }
        
        // 🔧 Ambiente LOCAL
        if (host === 'localhost' || host.startsWith('127.0.0.1')) {
            return 'local';
        }
        
        // 🚀 Ambiente de PRODUÇÃO (default)
        return 'production';
    }

    /**
     * Resolve a base URL da API baseado no ambiente
     * @returns {string} Base URL da API (ex: '/api' ou 'https://...')
     */
    function getApiBaseUrl() {
        const env = detectEnvironment();
        const host = window.location.hostname || '';
        
        // 🧪 TESTE: Railway TEST
        if (host === 'soundyai-app-soundyai-teste.up.railway.app') {
            console.log('🧪 [API-RESOLVER] Ambiente: Railway TEST (relativo)');
            return '/api';
        }
        
        // 🧪 TESTE: Vercel
        if (host === 'soundyai-teste.vercel.app') {
            console.log('🧪 [API-RESOLVER] Ambiente: Vercel TEST → API Railway TEST');
            return 'https://soundyai-app-soundyai-teste.up.railway.app/api';
        }
        
        // 🚀 PRODUÇÃO: Domínio principal
        if (host === 'soundyai.com.br' || host === 'www.soundyai.com.br') {
            console.log('🚀 [API-RESOLVER] Ambiente: Produção (relativo)');
            return '/api';
        }
        
        // 🚀 PRODUÇÃO: Railway direto
        if (host === 'soundyai-app-production.up.railway.app') {
            console.log('🚀 [API-RESOLVER] Ambiente: Railway PROD (relativo)');
            return '/api';
        }
        
        // 🔧 LOCAL: Chamar Railway PROD
        if (env === 'local') {
            console.log('🔧 [API-RESOLVER] Ambiente: Local → API Railway PROD');
            return 'https://soundyai-app-production.up.railway.app/api';
        }
        
        // ⚠️ Fallback: Railway PROD
        console.warn('⚠️ [API-RESOLVER] Ambiente desconhecido, usando PROD');
        return 'https://soundyai-app-production.up.railway.app/api';
    }

    /**
     * Constrói URL completa para um endpoint
     * @param {string} endpoint - Endpoint relativo (ex: '/chat', '/audio/analyze')
     * @returns {string} URL completa
     */
    function buildApiUrl(endpoint) {
        const baseUrl = getApiBaseUrl();
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${baseUrl}/${cleanEndpoint}`;
    }

    /**
     * Shortcut para endpoint de chat
     * @returns {string} URL do endpoint de chat
     */
    function getChatEndpoint() {
        return buildApiUrl('chat');
    }

    /**
     * Shortcut para endpoint de análise de áudio
     * @returns {string} URL do endpoint de análise
     */
    function getAnalyzeEndpoint() {
        return buildApiUrl('audio/analyze');
    }

    /**
     * Shortcut para endpoint de voice message
     * @returns {string} URL do endpoint de voice
     */
    function getVoiceEndpoint() {
        return buildApiUrl('voice-message');
    }

    /**
     * Shortcut para endpoint de history
     * @returns {string} URL do endpoint de history
     */
    function getHistoryEndpoint() {
        return buildApiUrl('history');
    }

    /**
     * Shortcut para endpoint de jobs
     * @param {string} jobId - ID do job
     * @returns {string} URL do endpoint de jobs
     */
    function getJobEndpoint(jobId) {
        return buildApiUrl(`jobs/${jobId}`);
    }

    // Exportar para window
    window.ApiUrlResolver = {
        detectEnvironment,
        getApiBaseUrl,
        buildApiUrl,
        getChatEndpoint,
        getAnalyzeEndpoint,
        getVoiceEndpoint,
        getHistoryEndpoint,
        getJobEndpoint
    };

    // Log de inicialização
    console.log('🌐 [API-RESOLVER] ═══════════════════════════════════════');
    console.log('🌐 [API-RESOLVER] Módulo carregado');
    console.log('🌐 [API-RESOLVER] Ambiente:', detectEnvironment());
    console.log('🌐 [API-RESOLVER] Base URL:', getApiBaseUrl());
    console.log('🌐 [API-RESOLVER] Chat:', getChatEndpoint());
    console.log('🌐 [API-RESOLVER] Analyze:', getAnalyzeEndpoint());
    console.log('🌐 [API-RESOLVER] ═══════════════════════════════════════');

})();
