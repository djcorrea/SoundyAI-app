/**
 * 🔐 DEVICE FINGERPRINT - Sistema de Identificação Forte de Dispositivo
 * 
 * Gera um fingerprint ÚNICO e PERSISTENTE do dispositivo usando múltiplas técnicas:
 * - Canvas fingerprint
 * - AudioContext fingerprint
 * - WebGL fingerprint
 * - Hardware info
 * - Screen + Navigator info
 * 
 * ⚠️ Este fingerprint é enviado ao backend junto com o visitorId
 * O backend usa AMBOS para bloqueio definitivo
 * 
 * 🌿 INDEX-LEAN: NUNCA executa no load, só sob demanda quando anti-burla detectar suspeita
 * 
 * @version 2.0.0 - INDEX-LEAN (lazy by default)
 * @date 2026-02-03
 */

(function() {
    'use strict';
    
    const log = window.log || console.log;
    
    // 🌿 INDEX-LEAN: BLOQUEADO no load por padrão
    const leanMode = window.__INDEX_LEAN_MODE || window.__LEAN_DISABLE_FINGERPRINT_AUTOSTART;
    
    if (leanMode) {
        log('🌿 [INDEX-LEAN] Fingerprint forte bloqueado no load (lazy loading)');
        
        // Expor função de inicialização para lazy loading
        window.initSoundyFingerprint = async function() {
            log('🔄 [INDEX-LEAN] Inicializando fingerprint forte sob demanda...');
            
            // Remove flag para permitir execução
            window.__LEAN_DISABLE_FINGERPRINT_AUTOSTART = false;
            
            // Executa fingerprint (código abaixo)
            await generateStrongFingerprint();
        };
        
        // API stub até carregar sob demanda
        window.SoundyFingerprint = {
            get: async function() {
                log('🔍 [INDEX-LEAN] Fingerprint solicitado - verificando necessidade...');
                
                // Se anti-burla requisitar, gera fingerprint forte
                if (window.shouldRunStrongFingerprint && window.shouldRunStrongFingerprint()) {
                    await window.initSoundyFingerprint();
                    return window.SoundyFingerprint.get();
                }
                
                // Caso contrário, retorna fingerprint leve
                log('🌿 [INDEX-LEAN] Usando fingerprint leve (sem Canvas/Audio/WebGL)');
                return 'lean_light_' + Date.now() + '_' + btoa(navigator.userAgent).slice(0, 12);
            }
        };
        
        return; // ✅ NÃO executar código pesado no load
    }
    
    log('🔍 [FINGERPRINT] Executando no load (lean mode desabilitado)');

    // ═══════════════════════════════════════════════════════════
    // 🔧 FUNÇÃO PRINCIPAL - GERAÇÃO DE FINGERPRINT FORTE
    // ═══════════════════════════════════════════════════════════
    
    async function generateStrongFingerprint() {
        log('🔍 [FINGERPRINT] Gerando fingerprint forte (Canvas + Audio + WebGL + Hardware)...');

    // ═══════════════════════════════════════════════════════════
    // 🔧 UTILITÁRIOS DE HASH
    // ═══════════════════════════════════════════════════════════

    /**
     * Gera hash SHA-256 de uma string (usa SubtleCrypto se disponível)
     */
    async function sha256(str) {
        if (window.crypto && window.crypto.subtle) {
            try {
                const msgBuffer = new TextEncoder().encode(str);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                // Fallback para hash simples
            }
        }
        
        // Fallback: hash simples mas determinístico
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(16);
    }

    /**
     * Hash simples e rápido (para componentes individuais)
     */
    function quickHash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return (hash >>> 0).toString(16);
    }

    // ═══════════════════════════════════════════════════════════
    // 🎨 CANVAS FINGERPRINT
    // ═══════════════════════════════════════════════════════════

    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) return 'canvas_unavailable';
            
            // Texto com fonte específica
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            
            ctx.fillStyle = '#069';
            ctx.fillText('SoundyAI Fingerprint 🎵', 2, 15);
            
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('SoundyAI Fingerprint 🎵', 4, 17);
            
            // Adicionar formas geométricas
            ctx.beginPath();
            ctx.arc(50, 25, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Gradiente
            const gradient = ctx.createLinearGradient(0, 0, 200, 0);
            gradient.addColorStop(0, '#ff0000');
            gradient.addColorStop(0.5, '#00ff00');
            gradient.addColorStop(1, '#0000ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 40, 200, 10);
            
            return canvas.toDataURL();
        } catch (e) {
            return 'canvas_error_' + e.message;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🔊 AUDIO FINGERPRINT
    // ═══════════════════════════════════════════════════════════

    function getAudioFingerprint() {
        return new Promise((resolve) => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    resolve('audio_unavailable');
                    return;
                }
                
                const context = new AudioContext();
                const oscillator = context.createOscillator();
                const analyser = context.createAnalyser();
                const gainNode = context.createGain();
                const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
                
                let fingerprint = [];
                
                analyser.fftSize = 1024;
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(10000, context.currentTime);
                
                gainNode.gain.setValueAtTime(0, context.currentTime);
                
                oscillator.connect(analyser);
                analyser.connect(scriptProcessor);
                scriptProcessor.connect(gainNode);
                gainNode.connect(context.destination);
                
                oscillator.start(0);
                
                scriptProcessor.onaudioprocess = function(event) {
                    const data = new Float32Array(analyser.fftSize);
                    analyser.getFloatFrequencyData(data);
                    
                    // Coletar apenas alguns samples
                    for (let i = 0; i < 10; i++) {
                        fingerprint.push(data[i * 50] || 0);
                    }
                    
                    oscillator.disconnect();
                    scriptProcessor.disconnect();
                    gainNode.disconnect();
                    context.close();
                    
                    resolve(fingerprint.join(','));
                };
                
                // Timeout de segurança
                setTimeout(() => {
                    try {
                        oscillator.disconnect();
                        context.close();
                    } catch (e) {}
                    resolve('audio_timeout');
                }, 500);
                
            } catch (e) {
                resolve('audio_error_' + e.message);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 🖥️ WEBGL FINGERPRINT
    // ═══════════════════════════════════════════════════════════

    function getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return 'webgl_unavailable';
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const data = {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
                unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.join(','),
                maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
                maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                extensions: gl.getSupportedExtensions()?.slice(0, 20).join(',')
            };
            
            return JSON.stringify(data);
        } catch (e) {
            return 'webgl_error_' + e.message;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 📱 HARDWARE & NAVIGATOR INFO
    // ═══════════════════════════════════════════════════════════

    function getHardwareInfo() {
        const nav = window.navigator;
        const screen = window.screen;
        
        return {
            // Navigator
            userAgent: nav.userAgent,
            platform: nav.platform,
            language: nav.language,
            languages: nav.languages?.join(','),
            hardwareConcurrency: nav.hardwareConcurrency,
            deviceMemory: nav.deviceMemory,
            maxTouchPoints: nav.maxTouchPoints,
            
            // Screen
            screenWidth: screen.width,
            screenHeight: screen.height,
            screenAvailWidth: screen.availWidth,
            screenAvailHeight: screen.availHeight,
            screenColorDepth: screen.colorDepth,
            screenPixelDepth: screen.pixelDepth,
            devicePixelRatio: window.devicePixelRatio,
            
            // Timezone
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            
            // Plugins (se disponível)
            plugins: Array.from(nav.plugins || []).slice(0, 10).map(p => p.name).join(','),
            
            // Mídia
            doNotTrack: nav.doNotTrack,
            cookieEnabled: nav.cookieEnabled,
            
            // Conexão
            connectionType: nav.connection?.effectiveType,
            connectionDownlink: nav.connection?.downlink
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 🎯 GERADOR PRINCIPAL DE FINGERPRINT
    // ═══════════════════════════════════════════════════════════

    /**
     * Gera fingerprint completo do dispositivo
     * 
     * @returns {Promise<Object>} Objeto com fingerprint_hash e componentes
     */
    async function generateDeviceFingerprint() {
        log('🔐 [FINGERPRINT] Gerando fingerprint forte do dispositivo...');
        
        const startTime = Date.now();
        
        // Coletar todos os componentes
        const [audioFp] = await Promise.all([
            getAudioFingerprint()
        ]);
        
        const canvasFp = getCanvasFingerprint();
        const webglFp = getWebGLFingerprint();
        const hardwareInfo = getHardwareInfo();
        
        // Criar string concatenada de todos os componentes
        const components = {
            canvas: quickHash(canvasFp),
            audio: quickHash(audioFp),
            webgl: quickHash(webglFp),
            hardware: quickHash(JSON.stringify(hardwareInfo))
        };
        
        // String final para hash
        const fingerprintString = [
            components.canvas,
            components.audio,
            components.webgl,
            components.hardware,
            hardwareInfo.screenWidth,
            hardwareInfo.screenHeight,
            hardwareInfo.hardwareConcurrency,
            hardwareInfo.platform,
            hardwareInfo.timezone
        ].join('|');
        
        // Gerar hash final
        const fingerprintHash = await sha256(fingerprintString);
        
        const elapsedTime = Date.now() - startTime;
        log(`✅ [FINGERPRINT] Gerado em ${elapsedTime}ms:`, fingerprintHash.substring(0, 16) + '...');
        
        return {
            fingerprint_hash: fingerprintHash,
            components: components,
            hardware_summary: {
                screen: `${hardwareInfo.screenWidth}x${hardwareInfo.screenHeight}`,
                platform: hardwareInfo.platform,
                timezone: hardwareInfo.timezone,
                cores: hardwareInfo.hardwareConcurrency,
                memory: hardwareInfo.deviceMemory,
                touch: hardwareInfo.maxTouchPoints
            },
            generated_at: new Date().toISOString()
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 💾 CACHE DO FINGERPRINT
    // ═══════════════════════════════════════════════════════════

    let cachedFingerprint = null;
    const CACHE_KEY = 'soundy_device_fp';

    /**
     * Obtém fingerprint (usa cache se disponível)
     */
    async function getDeviceFingerprint() {
        // Verificar cache em memória
        if (cachedFingerprint) {
            return cachedFingerprint;
        }
        
        // Verificar localStorage
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validar que tem hash válido
                if (parsed.fingerprint_hash && parsed.fingerprint_hash.length > 20) {
                    cachedFingerprint = parsed;
                    log('🔐 [FINGERPRINT] Carregado do cache:', parsed.fingerprint_hash.substring(0, 16) + '...');
                    return cachedFingerprint;
                }
            }
        } catch (e) {
            // Cache inválido, regenerar
        }
        
        // Gerar novo fingerprint
        cachedFingerprint = await generateDeviceFingerprint();
        
        // Salvar no localStorage para persistência
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cachedFingerprint));
        } catch (e) {
            warn('⚠️ [FINGERPRINT] Erro ao salvar cache:', e.message);
        }
        
        return cachedFingerprint;
    }

    /**
     * Força regeneração do fingerprint (ignora cache)
     */
    async function regenerateFingerprint() {
        cachedFingerprint = null;
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {}
        return await getDeviceFingerprint();
    }

    // ═══════════════════════════════════════════════════════════
    // 🌐 EXPORTAR API GLOBAL
    // ═══════════════════════════════════════════════════════════

    window.SoundyFingerprint = {
        // Função principal
        get: getDeviceFingerprint,
        
        // Forçar regeneração
        regenerate: regenerateFingerprint,
        
        // Componentes individuais (para debug)
        getCanvasFingerprint,
        getAudioFingerprint,
        getWebGLFingerprint,
        getHardwareInfo,
        
        // Status
        isReady: true,
        version: '1.0.0'
    };

    log('🔐 [FINGERPRINT] Sistema de fingerprint forte carregado');
    log('   Canvas + Audio + WebGL + Hardware');
    log('   Use: SoundyFingerprint.get() para obter');
    
    } // fim de generateStrongFingerprint()
    
    // Se não está em lean mode, executa imediatamente
    if (!leanMode) {
        generateStrongFingerprint();
    }

})();
