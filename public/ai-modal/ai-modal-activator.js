/* 🎨 AI MODAL ACTIVATOR - Ativador do Sistema Ultra-Futurista
   Data: 11 de outubro de 2025
   Compatibilidade: Integração com sistema existente SoundyAI
   
   🎯 MISSÃO: Ativar o novo sistema CSS de forma não-invasiva,
            mantendo 100% de compatibilidade com o código existente.
*/

/**
 * 🚀 SISTEMA DE ATIVAÇÃO DO AI MODAL
 * 
 * Este script detecta quando o modal de análise está aberto
 * e adiciona as classes necessárias para ativar o novo design.
 * 
 * ✅ Não quebra nenhuma funcionalidade existente
 * ✅ Adiciona apenas classes CSS, não modifica comportamento
 * ✅ Compatível com todos os IDs e classes existentes
 */

class AIModalActivator {
  constructor() {
    this.isInitialized = false;
    this.modalSelector = '#audioAnalysisModal';
    this.beginnerMode = localStorage.getItem('ai-modal-beginner-mode') === 'true';
    this.debugMode = localStorage.getItem('ai-modal-debug-mode') === 'true';
    
    this.init();
  }

  init() {
    // Aguarda o DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.activate());
    } else {
      this.activate();
    }
  }

  activate() {
    const modal = document.querySelector(this.modalSelector);
    
    if (!modal) {
      console.warn('🎨 AI Modal: Modal de análise não encontrado. Tentando novamente em 1s...');
      setTimeout(() => this.activate(), 1000);
      return;
    }

    // Adiciona a classe principal que ativa o novo sistema
    modal.classList.add('analysis-modal');
    
    // Adiciona classes de estado baseadas nas preferências
    if (this.beginnerMode) {
      modal.classList.add('ai-beginner-mode');
    }
    
    if (this.debugMode) {
      modal.classList.add('ai-debug-mode');
    }

    // Detecta preferências do sistema
    this.applySystemPreferences(modal);
    
    // Observa mudanças no modal
    this.observeModalChanges(modal);
    
    // Adiciona controles de modo
    this.addModeControls(modal);
    
    // Marca como inicializado
    modal.classList.add('ai-system-ready');
    this.isInitialized = true;
    
    console.log('🎨 AI Modal: Sistema ultra-futurista ativado com sucesso!');
  }

  applySystemPreferences(modal) {
    // Detecta preferência de movimento reduzido
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      modal.classList.add('ai-reduced-motion');
    }
    
    // Detecta preferência de alto contraste
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      modal.classList.add('ai-force-high-contrast');
    }
    
    // Detecta preferência de tema escuro
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      modal.classList.add('ai-theme-dark');
    }
  }

  observeModalChanges(modal) {
    // Observa quando o modal é mostrado/escondido
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const isVisible = modal.style.display !== 'none' && 
                          getComputedStyle(modal).display !== 'none';
          
          if (isVisible && !modal.classList.contains('ai-entering')) {
            modal.classList.add('ai-entering');
            setTimeout(() => modal.classList.remove('ai-entering'), 600);
          }
        }
      });
    });
    
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  addModeControls(modal) {
    // Procura por uma área onde pode adicionar controles
    const modalHeader = modal.querySelector('.modal-header') || 
                       modal.querySelector('.ai-modal-header') ||
                       modal.querySelector('h4');
    
    if (!modalHeader) return;

    // Cria container de controles se não existir
    let controlsContainer = modal.querySelector('.ai-mode-controls');
    
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'ai-mode-controls';
      controlsContainer.innerHTML = `
        <div class="ai-mode-toggle" role="group" aria-label="Controles de Modo">
          <button class="ai-mode-toggle-btn ${this.beginnerMode ? 'ai-active' : ''}" 
                  data-mode="beginner" 
                  aria-pressed="${this.beginnerMode}"
                  title="Modo Iniciante - Interface simplificada">
            <span class="ai-icon">🎯</span>
            Iniciante
          </button>
          <button class="ai-mode-toggle-btn ${!this.beginnerMode ? 'ai-active' : ''}" 
                  data-mode="advanced" 
                  aria-pressed="${!this.beginnerMode}"
                  title="Modo Avançado - Todas as informações técnicas">
            <span class="ai-icon">🔧</span>
            Avançado
          </button>
        </div>
      `;
      
      // Insere após o header
      modalHeader.parentNode.insertBefore(controlsContainer, modalHeader.nextSibling);
      
      // Adiciona event listeners
      controlsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.ai-mode-toggle-btn')) {
          this.toggleMode(e.target, modal);
        }
      });
    }
  }

  toggleMode(button, modal) {
    const mode = button.dataset.mode;
    const isBeginnerMode = mode === 'beginner';
    
    // Atualiza botões
    const buttons = button.parentNode.querySelectorAll('.ai-mode-toggle-btn');
    buttons.forEach(btn => {
      btn.classList.remove('ai-active');
      btn.setAttribute('aria-pressed', 'false');
    });
    
    button.classList.add('ai-active');
    button.setAttribute('aria-pressed', 'true');
    
    // Atualiza modal
    modal.classList.toggle('ai-beginner-mode', isBeginnerMode);
    
    // Salva preferência
    localStorage.setItem('ai-modal-beginner-mode', isBeginnerMode.toString());
    this.beginnerMode = isBeginnerMode;
    
    // Anúncio para leitores de tela
    this.announceChange(`Modo ${isBeginnerMode ? 'Iniciante' : 'Avançado'} ativado`);
    
    console.log(`🎨 AI Modal: Modo ${mode} ativado`);
  }

  announceChange(message) {
    // Cria anúncio para screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'ai-sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  // Método público para outras partes do sistema
  static activateBeginnerMode() {
    const modal = document.querySelector('#audioAnalysisModal');
    if (modal) {
      modal.classList.add('ai-beginner-mode');
      localStorage.setItem('ai-modal-beginner-mode', 'true');
    }
  }

  static activateAdvancedMode() {
    const modal = document.querySelector('#audioAnalysisModal');
    if (modal) {
      modal.classList.remove('ai-beginner-mode');
      localStorage.setItem('ai-modal-beginner-mode', 'false');
    }
  }

  static isBeginnerMode() {
    return localStorage.getItem('ai-modal-beginner-mode') === 'true';
  }
}

/**
 * 🏷️ SISTEMA DE LABELS AMIGÁVEIS
 * 
 * Importa e aplica automaticamente os labels amigáveis
 * para termos técnicos do sistema de análise.
 */

class AIModalLabels {
  static async init() {
    try {
      // Importa o sistema de labels
      const labelsModule = await import('./ai-modal-labels.js');
      const { ANALYSIS_LABELS, getFormattedLabel, formatTechnicalValue } = labelsModule;
      
      // Aplica labels automaticamente em elementos com data-tech-term
      document.addEventListener('DOMContentLoaded', () => {
        this.applyLabels();
      });
      
      // Observa mudanças dinâmicas no modal
      const modal = document.querySelector('#audioAnalysisModal');
      if (modal) {
        const observer = new MutationObserver(() => {
          this.applyLabels();
        });
        
        observer.observe(modal, {
          childList: true,
          subtree: true
        });
      }
      
      return { ANALYSIS_LABELS, getFormattedLabel, formatTechnicalValue };
    } catch (error) {
      console.warn('🏷️ AI Modal Labels: Erro ao carregar sistema de labels:', error);
      return null;
    }
  }

  static applyLabels() {
    // Aplica labels em elementos com atributo data-tech-term
    const techElements = document.querySelectorAll('[data-tech-term]');
    
    techElements.forEach(element => {
      const techTerm = element.dataset.techTerm;
      const friendlyLabel = this.getFriendlyLabel(techTerm);
      
      if (friendlyLabel && !element.dataset.originalText) {
        element.dataset.originalText = element.textContent;
        
        // Se estiver em modo iniciante, mostra label amigável
        const modal = element.closest('.analysis-modal');
        if (modal && modal.classList.contains('ai-beginner-mode')) {
          element.textContent = friendlyLabel;
        }
      }
    });
  }

  static getFriendlyLabel(techTerm) {
    // Mapeamento básico de termos técnicos para labels amigáveis
    const basicLabels = {
      'LUFS': 'Volume Percebido',
      'RMS': 'Volume Médio',
      'Peak': 'Pico de Volume',
      'True Peak': 'Pico Real',
      'DR': 'Dinâmica',
      'Stereo Width': 'Largura Estéreo',
      'Low': 'Graves',
      'Mid': 'Médios',
      'High': 'Agudos',
      'Sub': 'Sub-graves',
      'Hz': 'Frequência'
    };
    
    return basicLabels[techTerm] || techTerm;
  }
}

/**
 * 🎨 INICIALIZAÇÃO AUTOMÁTICA
 * 
 * Ativa o sistema automaticamente quando o script é carregado.
 */

// Inicializa automaticamente
const aiModalActivator = new AIModalActivator();

// Inicializa sistema de labels
AIModalLabels.init();

// Exporta para uso global
window.AIModalActivator = AIModalActivator;
window.AIModalLabels = AIModalLabels;

// Adiciona event listener para debugging
if (localStorage.getItem('ai-modal-debug-mode') === 'true') {
  console.log('🎨 AI Modal Activator carregado:', {
    activator: aiModalActivator,
    labels: AIModalLabels
  });
}