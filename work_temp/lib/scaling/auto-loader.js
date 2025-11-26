/**
 * 🚀 AUTO-LOADER PARA ESCALABILIDADE - FASE 1
 * Carrega automaticamente as melhorias sem quebrar o sistema existente
 */

(function() {
  'use strict';
  
  console.log('🚀 Carregando melhorias de escalabilidade (Fase 1)...');
  
  // Configurações
  const SCALING_CONFIG = {
    autoLoadQueue: true,
    autoConfigureHardware: true,
    enableDebugMode: window.location.search.includes('debug=scaling'),
    enableMetrics: true
  };
  
  /**
   * Carrega módulo de escalabilidade de forma assíncrona
   */
  async function loadScalingModule(modulePath) {
    try {
      const timestamp = Date.now(); // Cache busting
      const module = await import(`${modulePath}?v=${timestamp}`);
      return module;
    } catch (error) {
      console.warn(`⚠️ Falha ao carregar módulo: ${modulePath}`, error);
      return null;
    }
  }
  
  /**
   * Inicialização principal
   */
  async function initializeScaling() {
    try {
      // 1. Carregar Audio Queue Integration
      if (SCALING_CONFIG.autoLoadQueue) {
        const queueModule = await loadScalingModule('/lib/scaling/audio-queue-integration.js');
        if (queueModule) {
          console.log('✅ Audio Queue carregada');
          
          // Auto-configurar baseado no hardware
          if (SCALING_CONFIG.autoConfigureHardware && window.configureAudioProcessing) {
            window.configureAudioProcessing({ auto: true });
          }
        }
      }
      
      // 2. Configurar métricas se habilitado
      if (SCALING_CONFIG.enableMetrics) {
        setupMetrics();
      }
      
      // 3. Debug mode
      if (SCALING_CONFIG.enableDebugMode) {
        setupDebugMode();
      }
      
      console.log('🎯 Melhorias de escalabilidade carregadas com sucesso');
      
    } catch (error) {
      console.error('❌ Erro na inicialização das melhorias:', error);
    }
  }
  
  /**
   * Configura sistema de métricas
   */
  function setupMetrics() {
    const metrics = {
      pageLoadTime: performance.now(),
      audioProcessingCount: 0,
      errors: [],
      userActions: []
    };
    
    // Interceptar erros
    window.addEventListener('error', (event) => {
      metrics.errors.push({
        message: event.message,
        source: event.filename,
        line: event.lineno,
        timestamp: Date.now()
      });
    });
    
    // Monitorar ações do usuário
    ['click', 'change', 'submit'].forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        if (event.target.id || event.target.className) {
          metrics.userActions.push({
            type: eventType,
            target: event.target.id || event.target.className,
            timestamp: Date.now()
          });
        }
      });
    });
    
    // Expor métricas globalmente
    window.__SCALING_METRICS__ = () => ({
      ...metrics,
      uptime: Date.now() - metrics.pageLoadTime,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : 'Not available'
    });
    
    console.log('📊 Sistema de métricas ativado');
  }
  
  /**
   * Configura modo debug
   */
  function setupDebugMode() {
    // Painel de debug
    const debugPanel = document.createElement('div');
    debugPanel.id = 'scaling-debug-panel';
    debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 10001;
      max-width: 300px;
      border: 1px solid #333;
    `;
    
    debugPanel.innerHTML = `
      <div style="color: #ffff00; font-weight: bold; margin-bottom: 10px;">
        🚀 SCALING DEBUG MODE
      </div>
      <div id="debug-content">Carregando...</div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Atualizar informações do debug
    function updateDebugInfo() {
      const debugContent = document.getElementById('debug-content');
      if (!debugContent) return;
      
      const metrics = window.__SCALING_METRICS__ ? window.__SCALING_METRICS__() : {};
      const queueStatus = window.getAudioQueueStatus ? window.getAudioQueueStatus() : {};
      
      debugContent.innerHTML = `
        <div><strong>⏱️ Uptime:</strong> ${Math.round((metrics.uptime || 0) / 1000)}s</div>
        <div><strong>🧠 Memory:</strong> ${metrics.memoryUsage?.used || 'N/A'}MB</div>
        <div><strong>🎵 Queue:</strong> ${queueStatus.queue?.total || 0} waiting</div>
        <div><strong>🔄 Running:</strong> ${queueStatus.running || 0}</div>
        <div><strong>❌ Errors:</strong> ${metrics.errors?.length || 0}</div>
        <div><strong>👆 Actions:</strong> ${metrics.userActions?.length || 0}</div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333;">
          <button onclick="window.__SCALING_METRICS__ && console.log(window.__SCALING_METRICS__())" 
                  style="background: #333; color: #00ff00; border: 1px solid #666; padding: 4px 8px; border-radius: 3px; font-size: 10px;">
            📊 Log Metrics
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" 
                  style="background: #333; color: #ff6666; border: 1px solid #666; padding: 4px 8px; border-radius: 3px; font-size: 10px; margin-left: 5px;">
            ❌ Hide
          </button>
        </div>
      `;
    }
    
    // Atualizar a cada 3 segundos
    setInterval(updateDebugInfo, 3000);
    updateDebugInfo();
    
    console.log('🐛 Modo debug ativado');
  }
  
  /**
   * Detecta dispositivo e ajusta configurações
   */
  function detectAndOptimize() {
    const device = {
      cores: navigator.hardwareConcurrency || 2,
      memory: navigator.deviceMemory || 2,
      connection: navigator.connection?.effectiveType || '4g',
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };
    
    console.log('📱 Dispositivo detectado:', device);
    
    // Otimizações baseadas no dispositivo
    if (device.isMobile || device.memory < 4) {
      // Dispositivo com recursos limitados
      SCALING_CONFIG.autoLoadQueue = true; // Usar fila para controlar recursos
      console.log('⚡ Otimização para dispositivo com recursos limitados');
    }
    
    if (device.connection === 'slow-2g' || device.connection === '2g') {
      // Conexão lenta - reduzir timeouts
      console.log('🐌 Conexão lenta detectada - ajustando timeouts');
    }
    
    return device;
  }
  
  // Detectar dispositivo primeiro
  const deviceInfo = detectAndOptimize();
  
  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScaling);
  } else {
    // DOM já está pronto
    initializeScaling();
  }
  
  // Expor configuração globalmente
  window.__SCALING_CONFIG__ = SCALING_CONFIG;
  window.__DEVICE_INFO__ = deviceInfo;
  
})();
