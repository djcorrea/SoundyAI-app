// 🔍 DIAGNÓSTICO DE UPLOAD - Investigar transferência parcial

window.uploadDiagnostic = {
  
  // 🎯 Monitor de upload detalhado
  async monitorFileUpload(file, inputElement) {
    console.log('🔍 === DIAGNÓSTICO DE UPLOAD INICIADO ===');
    console.log('📁 Arquivo original:', {
      name: file.name,
      size: file.size,
      type: file.type,
      sizeFormatted: this.formatFileSize(file.size),
      lastModified: new Date(file.lastModified).toLocaleString()
    });
    
    // 1. VERIFICAR INTEGRIDADE DO OBJETO FILE
    const fileIntegrity = this.checkFileObjectIntegrity(file);
    console.log('🔍 Integridade do File object:', fileIntegrity);
    
    // 2. TESTAR LEITURA GRADUAL
    await this.testGradualRead(file);
    
    // 3. MONITORAR EVENTOS DE INPUT
    this.monitorInputEvents(inputElement);
    
    // 4. TESTAR LIMITES DO SISTEMA
    await this.testSystemLimits();
    
    console.log('🔍 === DIAGNÓSTICO CONCLUÍDO ===');
  },
  
  // 📏 Verificar integridade do objeto File
  checkFileObjectIntegrity(file) {
    const checks = {
      hasFile: !!file,
      hasName: !!file?.name,
      hasSize: typeof file?.size === 'number',
      hasType: typeof file?.type === 'string',
      hasArrayBuffer: typeof file?.arrayBuffer === 'function',
      hasStream: typeof file?.stream === 'function',
      hasSlice: typeof file?.slice === 'function',
      sizeConsistent: file?.size > 0,
      isActualFile: file instanceof File
    };
    
    const issues = Object.entries(checks)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    return {
      checks,
      issues,
      isValid: issues.length === 0
    };
  },
  
  // 📖 Teste de leitura gradual
  async testGradualRead(file) {
    console.log('📖 === TESTE DE LEITURA GRADUAL ===');
    
    const chunkSizes = [100, 1024, 10240, 102400, 1048576]; // 100B, 1KB, 10KB, 100KB, 1MB
    
    for (const chunkSize of chunkSizes) {
      try {
        const chunk = file.slice(0, chunkSize);
        const arrayBuffer = await chunk.arrayBuffer();
        
        console.log(`✅ Leitura ${this.formatFileSize(chunkSize)}:`, {
          requested: chunkSize,
          received: arrayBuffer.byteLength,
          success: arrayBuffer.byteLength === Math.min(chunkSize, file.size),
          percentage: Math.min(100, (chunkSize / file.size) * 100).toFixed(2) + '%'
        });
        
        // Se conseguiu ler menos que solicitado, pode indicar problema
        if (arrayBuffer.byteLength < chunkSize && arrayBuffer.byteLength < file.size) {
          console.warn(`⚠️ PROBLEMA DETECTADO: Só conseguiu ler ${arrayBuffer.byteLength} de ${chunkSize} bytes solicitados`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ Falha ao ler ${this.formatFileSize(chunkSize)}:`, error);
        break;
      }
    }
  },
  
  // 👂 Monitor de eventos do input
  monitorInputEvents(inputElement) {
    console.log('👂 === MONITOR DE EVENTOS INICIADO ===');
    
    if (!inputElement) {
      console.warn('⚠️ Elemento input não fornecido para monitoramento');
      return;
    }
    
    const events = ['change', 'input', 'load', 'error', 'abort', 'progress'];
    
    events.forEach(eventType => {
      inputElement.addEventListener(eventType, (event) => {
        console.log(`🎯 Evento ${eventType}:`, {
          type: event.type,
          target: event.target.tagName,
          files: event.target.files?.length || 0,
          timestamp: new Date().toISOString()
        });
        
        if (event.target.files?.length > 0) {
          const file = event.target.files[0];
          console.log(`📁 Arquivo no evento ${eventType}:`, {
            name: file.name,
            size: file.size,
            sizeFormatted: this.formatFileSize(file.size)
          });
        }
      });
    });
  },
  
  // 🔧 Testar limites do sistema
  async testSystemLimits() {
    console.log('🔧 === TESTE DE LIMITES DO SISTEMA ===');
    
    // Verificar memória disponível
    if ('memory' in performance) {
      console.log('💾 Memória:', {
        used: this.formatFileSize(performance.memory.usedJSHeapSize),
        total: this.formatFileSize(performance.memory.totalJSHeapSize),
        limit: this.formatFileSize(performance.memory.jsHeapSizeLimit)
      });
    }
    
    // Testar ArrayBuffer máximo
    try {
      const testSizes = [
        1024 * 1024,      // 1MB
        10 * 1024 * 1024, // 10MB  
        50 * 1024 * 1024, // 50MB
        100 * 1024 * 1024 // 100MB
      ];
      
      for (const size of testSizes) {
        try {
          const buffer = new ArrayBuffer(size);
          console.log(`✅ ArrayBuffer ${this.formatFileSize(size)}: OK`);
        } catch (e) {
          console.log(`❌ ArrayBuffer ${this.formatFileSize(size)}: FALHOU (${e.message})`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Erro no teste de ArrayBuffer:', error);
    }
  },
  
  // 📊 Análise completa de upload
  async analyzeUploadProcess(file, progressCallback) {
    console.log('📊 === ANÁLISE COMPLETA DE UPLOAD ===');
    
    const analysis = {
      file: {
        name: file.name,
        size: file.size,
        type: file.type
      },
      steps: [],
      errors: [],
      warnings: []
    };
    
    try {
      // Passo 1: Verificar File object
      analysis.steps.push('File object check');
      const integrity = this.checkFileObjectIntegrity(file);
      if (!integrity.isValid) {
        analysis.errors.push(`File object comprometido: ${integrity.issues.join(', ')}`);
        return analysis;
      }
      
      // Passo 2: Teste de slice pequeno
      analysis.steps.push('Small slice test');
      const smallChunk = file.slice(0, 100);
      const smallBuffer = await smallChunk.arrayBuffer();
      if (smallBuffer.byteLength !== Math.min(100, file.size)) {
        analysis.errors.push(`Slice pequeno falhou: esperado ${Math.min(100, file.size)}, recebido ${smallBuffer.byteLength}`);
      }
      
      // Passo 3: Teste de FileReader
      analysis.steps.push('FileReader test');
      await this.testFileReader(file, analysis);
      
      // Passo 4: Teste de arrayBuffer() direto
      analysis.steps.push('Direct arrayBuffer test');
      await this.testDirectArrayBuffer(file, analysis, progressCallback);
      
    } catch (error) {
      analysis.errors.push(`Erro geral: ${error.message}`);
    }
    
    console.log('📊 Análise completa:', analysis);
    return analysis;
  },
  
  // 📖 Teste de FileReader
  async testFileReader(file, analysis) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      let bytesRead = 0;
      
      reader.onload = (e) => {
        bytesRead = e.target.result.byteLength;
        if (bytesRead !== file.size) {
          analysis.warnings.push(`FileReader: leu ${bytesRead} de ${file.size} bytes`);
        } else {
          analysis.steps.push('FileReader: sucesso');
        }
        resolve();
      };
      
      reader.onerror = (e) => {
        analysis.errors.push(`FileReader erro: ${e.target.error}`);
        resolve();
      };
      
      reader.readAsArrayBuffer(file);
    });
  },
  
  // 🎯 Teste de arrayBuffer direto
  async testDirectArrayBuffer(file, analysis, progressCallback) {
    try {
      console.log('🎯 Testando file.arrayBuffer() direto...');
      
      // Monitorar progresso se possível
      const startTime = performance.now();
      const buffer = await file.arrayBuffer();
      const endTime = performance.now();
      
      const success = buffer.byteLength === file.size;
      const speed = file.size / ((endTime - startTime) / 1000) / 1024 / 1024; // MB/s
      
      if (success) {
        analysis.steps.push(`Direct arrayBuffer: sucesso (${speed.toFixed(2)} MB/s)`);
      } else {
        analysis.errors.push(`Direct arrayBuffer: leu ${buffer.byteLength} de ${file.size} bytes`);
      }
      
      if (progressCallback) {
        progressCallback({
          bytesRead: buffer.byteLength,
          totalBytes: file.size,
          percentage: (buffer.byteLength / file.size) * 100,
          speed: speed
        });
      }
      
    } catch (error) {
      analysis.errors.push(`Direct arrayBuffer erro: ${error.message}`);
    }
  },
  
  // 🔧 Utilitários
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// Auto-configurar quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Upload Diagnostic carregado');
  console.log('🔍 Use: uploadDiagnostic.monitorFileUpload(file, inputElement)');
  console.log('📊 Use: uploadDiagnostic.analyzeUploadProcess(file)');
  
  // REMOVIDO: Interceptação automática que estava causando erros falsos
  // Scripts de debug só executam quando explicitamente chamados
});
