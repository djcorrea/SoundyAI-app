/**
 * Sistema de Upload e Pré-visualização de Imagens
 * Compatível com o chat existente do SoundyAI
 * Implementação: Dezembro 2024
 */

console.log('🖼️ Carregando sistema de upload de imagens...');

// Classe para gerenciar o sistema de imagens
class ImagePreviewSystem {
  constructor() {
    this.selectedImages = [];
    this.maxImages = 3; // ✅ CORREÇÃO CRÍTICA: Máximo 3 imagens por envio
    this.maxSizePerImage = 10 * 1024 * 1024; // 10MB por imagem 
    this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    this.previewContainer = null;
    this.isInitialized = false;
    
    console.log('🖼️ ImagePreviewSystem criado - Máximo:', this.maxImages, 'imagens');
  }

  // Inicializar o sistema
  init() {
    if (this.isInitialized) {
      console.log('⚠️ Sistema já inicializado');
      return;
    }
    
    console.log('🖼️ Inicializando sistema de imagens...');
    
    try {
      // Criar container de preview
      this.createPreviewContainer();
      
      // Configurar listener para o evento de adicionar fotos
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Sistema de imagens inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de imagens:', error);
    }
  }

  // Configurar event listeners
  setupEventListeners() {
    console.log('🎧 Configurando event listeners...');
    
    // Listener para evento de adicionar fotos do botão +
    const photoEventHandler = (event) => {
      console.log('📸 Evento chat:add-photos recebido:', event.detail);
      console.log('📸 Tipo do detail:', typeof event.detail);
      console.log('📸 É array?', Array.isArray(event.detail));
      console.log('📸 Tem length?', event.detail && event.detail.length);
      
      if (event.detail && event.detail.length > 0) {
        console.log('📸 Processando arquivos...');
        this.handleFileSelection(Array.from(event.detail));
      } else {
        console.warn('📸 Evento sem arquivos válidos');
      }
    };
    
    window.addEventListener('chat:add-photos', photoEventHandler);
    console.log('🎧 Event listener para chat:add-photos configurado');

    // Listener para mudanças nos inputs de texto (para validar estado do botão)
    const inputHandler = (e) => {
      if (e.target.matches('.chat-text-input')) {
        console.log('⌨️ Input de texto alterado');
        this.updateSendButtonState();
      }
    };
    
    document.addEventListener('input', inputHandler);
    console.log('🎧 Event listener para input configurado');

    // Testar se o event listener está funcionando
    setTimeout(() => {
      console.log('🧪 Testando event listener...');
      const testEvent = new CustomEvent('chat:add-photos', {
        detail: []
      });
      window.dispatchEvent(testEvent);
    }, 1000);

    console.log('✅ Event listeners configurados com sucesso');
  }

  // Criar container de preview
  createPreviewContainer() {
    console.log('🏗️ Criando container de preview...');

    // Buscar TODOS os possíveis containers
    const possibleContainers = [
      document.querySelector('.chatbot-active-input-field.chat-input-container'),
      document.querySelector('.chatbot-input-field.chat-input-container'),
      document.querySelector('.chatbot-input-section'),
      document.querySelector('#chatbotInputSection'),
      document.querySelector('.chatbot-container'),
      document.querySelector('#chatbotContainer')
    ];

    console.log('🔍 Containers encontrados:', possibleContainers.map(c => c ? c.className : 'null'));

    // Encontrar o primeiro container válido
    let targetContainer = possibleContainers.find(container => container !== null);
    
    if (!targetContainer) {
      console.warn('⚠️ Nenhum container específico encontrado, usando body');
      targetContainer = document.body;
    } else {
      console.log('✅ Container selecionado:', targetContainer.className);
    }

    // Remover containers existentes
    document.querySelectorAll('[id*="image-preview-container"]').forEach(el => {
      console.log('🗑️ Removendo container existente:', el.id);
      el.remove();
    });

    // Criar novo container de preview
    this.previewContainer = document.createElement('div');
    this.previewContainer.id = 'image-preview-container';
    this.previewContainer.className = 'image-preview-container';
    this.previewContainer.style.cssText = `
      display: none;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0;
      padding: 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      z-index: 100;
      width: 100%;
      box-sizing: border-box;
    `;

    // Estratégia de inserção mais robusta
    if (targetContainer === document.body) {
      // Se for o body, criar um container fixo
      this.previewContainer.style.position = 'fixed';
      this.previewContainer.style.top = '20px';
      this.previewContainer.style.left = '20px';
      this.previewContainer.style.right = '20px';
      this.previewContainer.style.zIndex = '9999';
      targetContainer.appendChild(this.previewContainer);
    } else {
      // Tentar inserir antes do input
      const inputElement = targetContainer.querySelector('input[type="text"]');
      if (inputElement) {
        targetContainer.insertBefore(this.previewContainer, inputElement);
        console.log('✅ Container inserido antes do input');
      } else {
        targetContainer.appendChild(this.previewContainer);
        console.log('✅ Container inserido como último filho');
      }
    }

    console.log('✅ Container de preview criado:', this.previewContainer);
    console.log('📍 Container pai:', this.previewContainer.parentElement?.className || 'body');

    // Criar container para ambos os estados (welcome e active)
    this.createContainerForBothStates();
  }

  // Criar containers para ambos os estados
  createContainerForBothStates() {
    const states = [
      { selector: '.chatbot-input-field.chat-input-container', name: 'welcome' },
      { selector: '.chatbot-active-input-field.chat-input-container', name: 'active' }
    ];

    states.forEach(state => {
      const container = document.querySelector(state.selector);
      if (container && !container.querySelector('.image-preview-container')) {
        const previewClone = this.previewContainer.cloneNode(true);
        previewClone.id = `image-preview-container-${state.name}`;
        
        const input = container.querySelector('input[type="text"]');
        if (input) {
          container.insertBefore(previewClone, input);
        } else {
          container.appendChild(previewClone);
        }
        
        console.log(`✅ Container criado para estado ${state.name}`);
      }
    });
  }

  // Manipular seleção de arquivos
  async handleFileSelection(files) {
    console.log(`📁 ${files.length} arquivo(s) selecionado(s)`, files);

    try {
      // Validar número de arquivos
      if (files.length > this.maxImages) {
        this.showError(`Máximo de ${this.maxImages} imagens por envio.`);
        return;
      }

      // Verificar se já tem imagens selecionadas
      const totalImages = this.selectedImages.length + files.length;
      if (totalImages > this.maxImages) {
        this.showError(`Você pode selecionar no máximo ${this.maxImages} imagens. Remova ${totalImages - this.maxImages} imagem(ns) primeiro.`);
        return;
      }

      // Processar cada arquivo
      let successCount = 0;
      for (const file of files) {
        try {
          console.log(`🔍 Processando arquivo: ${file.name} (${file.type}, ${(file.size/1024/1024).toFixed(2)}MB)`);
          await this.addImage(file);
          successCount++;
        } catch (error) {
          console.error('❌ Erro ao adicionar imagem:', error);
          this.showError(error.message);
        }
      }

      if (successCount > 0) {
        this.updatePreview();
        this.updateSendButtonState();
        this.showSuccess(`${successCount} imagem(ns) adicionada(s) com sucesso!`);
        
        // Log debug das imagens processadas
        console.log('📸 Imagens processadas para envio:', this.selectedImages.map(img => ({
          filename: img.filename,
          type: img.type,
          size: `${(img.size/1024/1024).toFixed(2)}MB`,
          base64Length: img.base64?.length || 0
        })));
      }

    } catch (error) {
      console.error('❌ Erro geral ao processar arquivos:', error);
      this.showError('Erro ao processar arquivos selecionados.');
    }
  }

  // ✅ CORREÇÃO CRÍTICA: Validação robusta de imagem com limite de payload
  async addImage(file) {
    console.log(`📸 Adicionando imagem: ${file.name}`);

    // ✅ Validar tipo MIME
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`Formato não suportado: ${file.name}. Use JPG, PNG ou WebP.`);
    }

    // ✅ Validar tamanho individual (10MB por imagem)
    if (file.size > this.maxSizePerImage) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      throw new Error(`Imagem muito grande: ${file.name} (${sizeMB}MB). Máximo: 10MB.`);
    }

    // ✅ Validar tamanho total do payload (30MB total)
    const currentTotalSize = this.selectedImages.reduce((sum, img) => sum + img.size, 0);
    const newTotalSize = currentTotalSize + file.size;
    const maxTotalSize = 30 * 1024 * 1024; // 30MB total
    
    if (newTotalSize > maxTotalSize) {
      const totalMB = (newTotalSize / 1024 / 1024).toFixed(1);
      throw new Error(`Payload total muito grande: ${totalMB}MB. Máximo: 30MB total.`);
    }

    // ✅ Validar se é realmente uma imagem (header check)
    if (!await this.isValidImageFile(file)) {
      throw new Error(`Arquivo corrompido ou não é uma imagem válida: ${file.name}`);
    }

    // Converter para base64 (sem blob:createObjectURL)
    const base64 = await this.fileToBase64(file);
    
    // ✅ Validar base64 gerado
    if (!base64 || base64.length < 1000) { // Mínimo razoável para uma imagem
      throw new Error(`Erro ao processar a imagem: ${file.name}`);
    }
    
    // Criar thumbnail
    const thumbnail = await this.createThumbnail(base64);
    
    // ✅ CRÍTICO: Objeto da imagem sem blob URLs
    const imageObj = {
      id: Date.now() + Math.random(),
      file: file,
      filename: file.name,
      size: file.size,
      type: file.type,
      base64: base64.split(',')[1], // Remover o prefixo data:image/...;base64,
      dataUrl: base64, // Manter data URL para preview
      preview: thumbnail
      // ✅ SEM blob:createObjectURL - apenas data: URLs
    };

    this.selectedImages.push(imageObj);
    console.log(`✅ Imagem adicionada: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB) - Total: ${(newTotalSize/1024/1024).toFixed(1)}MB`);
  }

  // ✅ NOVA: Verificar se arquivo é realmente uma imagem
  async isValidImageFile(file) {
    return new Promise((resolve) => {
      try {
        // Verificar primeiros bytes do arquivo (magic numbers)
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const arr = new Uint8Array(e.target.result);
            
            // JPEG: FF D8 FF
            if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
              resolve(true);
              return;
            }
            
            // PNG: 89 50 4E 47
            if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
              resolve(true);
              return;
            }
            
            // WebP: 52 49 46 46 (RIFF) + WebP signature
            if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) {
              resolve(true);
              return;
            }
            
            console.warn('⚠️ Magic number não reconhecido para:', file.name);
            resolve(false);
          } catch (error) {
            console.warn('⚠️ Erro ao verificar header da imagem:', error);
            resolve(false);
          }
        };
        
        reader.onerror = () => resolve(false);
        reader.readAsArrayBuffer(file.slice(0, 8)); // Ler apenas primeiros 8 bytes
      } catch (error) {
        console.warn('⚠️ Erro na validação de imagem:', error);
        resolve(false);
      }
    });
  }

  // Converter arquivo para base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  // Criar thumbnail da imagem
  async createThumbnail(dataUrl, maxWidth = 120, maxHeight = 80) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calcular dimensões mantendo proporção
          let { width, height } = img;
          const aspectRatio = width / height;
          
          if (width > height) {
            if (width > maxWidth) {
              width = maxWidth;
              height = width / aspectRatio;
            }
          } else {
            if (height > maxHeight) {
              height = maxHeight;
              width = height * aspectRatio;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (error) {
          console.error('Erro ao criar thumbnail:', error);
          resolve(dataUrl); // Fallback para imagem original
        }
      };
      img.onerror = () => resolve(dataUrl); // Fallback para imagem original
      img.src = dataUrl;
    });
  }

  // Atualizar preview visual
  updatePreview() {
    console.log(`🖼️ Atualizando preview: ${this.selectedImages.length} imagem(ns)`);

    // Buscar TODOS os containers de preview possíveis
    const containers = [
      document.getElementById('image-preview-container'),
      document.getElementById('image-preview-container-active'),
      document.getElementById('image-preview-container-welcome'),
      ...document.querySelectorAll('.image-preview-container')
    ].filter(container => container !== null);

    console.log(`🔍 Containers encontrados para update: ${containers.length}`);

    containers.forEach((container, index) => {
      console.log(`🔄 Atualizando container ${index + 1}:`, container.id || container.className);
      
      if (this.selectedImages.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        console.log(`👻 Container ${index + 1} ocultado (sem imagens)`);
        return;
      }

      // Tornar visível e popular com imagens
      container.style.display = 'flex';
      container.innerHTML = '';

      this.selectedImages.forEach((img, imgIndex) => {
        const previewItem = this.createPreviewItem(img, imgIndex);
        container.appendChild(previewItem);
      });

      console.log(`✅ Container ${index + 1} atualizado com ${this.selectedImages.length} imagem(ns)`);
      
      // Forçar visibilidade se houver imagens
      if (this.selectedImages.length > 0) {
        container.style.display = 'flex';
        container.style.opacity = '1';
        container.style.visibility = 'visible';
        
        // Destacar temporariamente para debug
        container.style.border = '2px solid #ff0000';
        setTimeout(() => {
          container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }, 2000);
      }
    });

    // Se não há containers, criar um de emergência
    if (containers.length === 0) {
      console.warn('⚠️ Nenhum container encontrado, criando um de emergência');
      this.createEmergencyContainer();
    }
  }

  // Criar container de emergência
  createEmergencyContainer() {
    const emergencyContainer = document.createElement('div');
    emergencyContainer.id = 'image-preview-emergency';
    emergencyContainer.className = 'image-preview-container';
    emergencyContainer.style.cssText = `
      position: fixed;
      top: 100px;
      left: 20px;
      right: 20px;
      z-index: 9999;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 16px;
      border-radius: 8px;
      border: 2px solid #ff0000;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    `;
    
    emergencyContainer.innerHTML = '<h3>🚨 Container de Emergência - Imagens Selecionadas:</h3>';
    
    this.selectedImages.forEach((img, index) => {
      const item = this.createPreviewItem(img, index);
      emergencyContainer.appendChild(item);
    });
    
    document.body.appendChild(emergencyContainer);
    
    // Remover após 10 segundos
    setTimeout(() => {
      emergencyContainer.remove();
    }, 10000);
    
    console.log('🚨 Container de emergência criado');
  }

  // Criar item de preview
  createPreviewItem(img, index) {
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    previewItem.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      max-width: 120px;
      transition: transform 0.2s ease;
    `;

    // Criar elementos
    const imgElement = document.createElement('img');
    imgElement.src = img.preview;
    imgElement.alt = img.filename;
    imgElement.style.cssText = `
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 4px;
    `;

    const filenameDiv = document.createElement('div');
    filenameDiv.textContent = img.filename;
    filenameDiv.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      margin-bottom: 4px;
    `;

    const sizeDiv = document.createElement('div');
    sizeDiv.textContent = `${(img.size / 1024 / 1024).toFixed(1)}MB`;
    sizeDiv.style.cssText = `
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 6px;
    `;

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border: none;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    `;

    // Event listeners para o botão de remoção
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = 'rgba(255, 0, 0, 1)';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = 'rgba(255, 0, 0, 0.8)';
    });
    removeBtn.addEventListener('click', () => {
      this.removeImage(index);
    });

    // Hover effect para o item
    previewItem.addEventListener('mouseenter', () => {
      previewItem.style.transform = 'scale(1.02)';
    });
    previewItem.addEventListener('mouseleave', () => {
      previewItem.style.transform = 'scale(1)';
    });

    // Montar o item
    previewItem.appendChild(imgElement);
    previewItem.appendChild(filenameDiv);
    previewItem.appendChild(sizeDiv);
    previewItem.appendChild(removeBtn);

    return previewItem;
  }

  // Remover uma imagem
  removeImage(index) {
    if (index >= 0 && index < this.selectedImages.length) {
      const removed = this.selectedImages.splice(index, 1)[0];
      console.log(`🗑️ Imagem removida: ${removed.filename}`);
      
      this.updatePreview();
      this.updateSendButtonState();
      this.showSuccess('Imagem removida');
    }
  }

  // Limpar todas as imagens
  clearImages() {
    this.selectedImages = [];
    this.updatePreview();
    this.updateSendButtonState();
    console.log('🧹 Todas as imagens removidas');
  }

  // Obter imagens para envio
  getImagesForSending() {
    const imagesToSend = this.selectedImages.map(img => ({
      filename: img.filename,
      base64: img.base64,
      size: img.size,
      type: img.type
    }));
    
    console.log('📤 Preparando imagens para envio:', imagesToSend.length);
    imagesToSend.forEach((img, index) => {
      console.log(`📷 Imagem ${index + 1}: ${img.filename} (${(img.size/1024/1024).toFixed(2)}MB)`);
    });
    
    return imagesToSend;
  }

  // Verificar se tem imagens selecionadas
  hasImages() {
    return this.selectedImages.length > 0;
  }

  // Atualizar estado do botão de envio
  updateSendButtonState() {
    // Buscar possíveis botões de envio
    const sendButtons = [
      document.getElementById('sendBtn'),
      document.getElementById('chatbotSendButton'),
      document.getElementById('chatbotActiveSendBtn'),
      document.querySelector('.chatbot-send-button'),
      document.querySelector('.chatbot-active-send-btn'),
      document.querySelector('.chat-send-btn')
    ].filter(btn => btn !== null);

    // Buscar possíveis inputs de texto
    const messageInputs = [
      document.getElementById('chatbotMainInput'),
      document.getElementById('chatbotActiveInput'),
      document.querySelector('.chatbot-main-input'),
      document.querySelector('.chatbot-active-input'),
      document.querySelector('.chat-text-input')
    ].filter(input => input !== null);

    // Verificar se há texto e imagens
    const hasText = messageInputs.some(input => input.value && input.value.trim().length > 0);
    const hasImages = this.hasImages();

    console.log('🔄 Atualizando estado dos botões:', { hasText, hasImages, sendButtons: sendButtons.length, inputs: messageInputs.length });

    // Habilitar envio apenas se houver texto + imagens
    // (bloquear envio apenas de imagens conforme requisito)
    sendButtons.forEach(btn => {
      if (hasImages && !hasText) {
        btn.disabled = true;
        btn.title = 'Adicione uma mensagem junto às imagens';
        btn.style.opacity = '0.5';
      } else {
        btn.disabled = false;
        btn.title = '';
        btn.style.opacity = '1';
      }
    });
  }

  // Mostrar mensagem de erro
  showError(message) {
    console.error('❌ Erro de imagem:', message);
    
    // Criar toast de erro
    this.showToast(message, 'error');
  }

  // Mostrar informações de sucesso
  showSuccess(message) {
    console.log('✅ Sucesso:', message);
    
    // Criar toast de sucesso
    this.showToast(message, 'success');
  }

  // ✅ MELHORIA: Sistema de toast com mais informações
  showToast(message, type = 'info', duration = 3000) {
    // Remover toasts existentes
    document.querySelectorAll('.image-toast').forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = 'image-toast';
    
    // ✅ Cores e ícones melhorados
    const toastStyles = {
      error: { bg: 'rgba(220, 38, 38, 0.95)', icon: '❌' },
      success: { bg: 'rgba(34, 197, 94, 0.95)', icon: '✅' },
      warning: { bg: 'rgba(245, 158, 11, 0.95)', icon: '⚠️' },
      info: { bg: 'rgba(59, 130, 246, 0.95)', icon: 'ℹ️' }
    };
    
    const style = toastStyles[type] || toastStyles.info;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 14px 18px;
      background: ${style.bg};
      color: white;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 320px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // ✅ Conteúdo com ícone
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 16px; margin-top: 1px;">${style.icon}</span>
        <span style="flex: 1; line-height: 1.4;">${message}</span>
      </div>
    `;

    document.body.appendChild(toast);

    // Adicionar animação CSS se não existir
    if (!document.querySelector('#toast-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'toast-styles';
      styleElement.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(styleElement);
    }

    // ✅ Remover toast com animação
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 300);
      }
    }, duration);
  }
}

// Criar instância global
console.log('🌍 Criando instância global...');
window.imagePreviewSystem = new ImagePreviewSystem();

// Função global de teste
window.testImageUpload = function() {
  console.log('🧪 Função de teste chamada');
  console.log('🧪 Sistema existe?', !!window.imagePreviewSystem);
  console.log('🧪 Sistema inicializado?', window.imagePreviewSystem?.isInitialized);
  console.log('🧪 Imagens selecionadas:', window.imagePreviewSystem?.selectedImages?.length || 0);
  
  // Testar evento
  const testFiles = [
    new File(['test'], 'test.jpg', { type: 'image/jpeg' })
  ];
  
  const event = new CustomEvent('chat:add-photos', {
    detail: testFiles
  });
  
  console.log('🧪 Disparando evento de teste...');
  window.dispatchEvent(event);
};

// Função para aguardar que o chat esteja pronto
function waitForChatReady() {
  return new Promise((resolve) => {
    // Verificar se elementos do chat já existem
    const checkElements = () => {
      const hasWelcomeInput = document.querySelector('.chatbot-input-field.chat-input-container');
      const hasActiveInput = document.querySelector('.chatbot-active-input-field.chat-input-container');
      
      if (hasWelcomeInput || hasActiveInput) {
        console.log('✅ Elementos do chat encontrados');
        resolve();
      } else {
        console.log('⏳ Aguardando elementos do chat...');
        setTimeout(checkElements, 100);
      }
    };
    
    checkElements();
  });
}

// Inicializar quando tudo estiver pronto
async function initializeImageSystem() {
  console.log('🚀 Iniciando sistema de imagens...');
  
  try {
    await waitForChatReady();
    await new Promise(resolve => setTimeout(resolve, 500)); // Aguardar um pouco mais
    
    window.imagePreviewSystem.init();
    
    // Configurar re-inicialização quando o chat mudar de estado
    const chatContainer = document.getElementById('chatbotContainer');
    if (chatContainer) {
      const observer = new MutationObserver(() => {
        // Re-criar containers se necessário
        if (!document.getElementById('image-preview-container')) {
          window.imagePreviewSystem.createPreviewContainer();
        }
      });
      
      observer.observe(chatContainer, {
        attributes: true,
        childList: true,
        subtree: true
      });
      
      console.log('👁️ Observer configurado para mudanças no chat');
    }
    
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de imagens:', error);
  }
}

// Executar inicialização
if (document.readyState === 'loading') {
  console.log('📄 Document ainda carregando, aguardando DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOMContentLoaded disparado, iniciando sistema...');
    initializeImageSystem();
  });
} else {
  console.log('📄 Document já carregado, iniciando sistema imediatamente...');
  initializeImageSystem();
}

console.log('✅ Sistema de upload de imagens carregado e pronto para inicialização');

// Exportar para uso externo se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImagePreviewSystem };
}
