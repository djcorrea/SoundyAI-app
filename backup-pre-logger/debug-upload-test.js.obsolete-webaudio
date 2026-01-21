// 🔧 TESTE DE UPLOAD ESPECÍFICO - Detectar limitações

window.uploadTest = {
  
  // 🎯 Teste específico do problema 32MB → 15 bytes
  async investigateSpecificIssue(file) {
    console.log('🎯 === INVESTIGAÇÃO ESPECÍFICA ===');
    console.log('🔍 Problema: 32MB → 15 bytes');
    
    if (!file) {
      console.error('❌ Nenhum arquivo fornecido para teste');
      return;
    }
    
    console.log('📁 Arquivo:', {
      name: file.name,
      originalSize: file.size,
      sizeFormatted: this.formatBytes(file.size),
      type: file.type
    });
    
    // 1. VERIFICAR SE É REALMENTE 32MB
    const realSize = file.size;
    console.log(`📏 Tamanho real do arquivo: ${this.formatBytes(realSize)}`);
    
    if (realSize < 30 * 1024 * 1024 || realSize > 35 * 1024 * 1024) {
      console.warn(`⚠️ Tamanho não está na faixa esperada de 32MB: ${this.formatBytes(realSize)}`);
    }
    
    // 2. TESTAR LEITURA EM ETAPAS
    await this.testSteppedReading(file);
    
    // 3. VERIFICAR ONDE A TRANSFERÊNCIA PARA
    await this.findBreakPoint(file);
    
    // 4. TESTAR DIFERENTES MÉTODOS DE LEITURA
    await this.testReadingMethods(file);
    
    // 5. SIMULAR O QUE O AUDIO ANALYZER FAZ
    await this.simulateAudioAnalyzerProcess(file);
  },
  
  // 📖 Teste de leitura em etapas
  async testSteppedReading(file) {
    console.log('📖 === TESTE DE LEITURA EM ETAPAS ===');
    
    const steps = [
      { name: 'Header WAV', size: 44 },
      { name: '1KB', size: 1024 },
      { name: '10KB', size: 10 * 1024 },
      { name: '100KB', size: 100 * 1024 },
      { name: '1MB', size: 1024 * 1024 },
      { name: '5MB', size: 5 * 1024 * 1024 },
      { name: '10MB', size: 10 * 1024 * 1024 },
      { name: '20MB', size: 20 * 1024 * 1024 },
      { name: 'ARQUIVO COMPLETO', size: file.size }
    ];
    
    for (const step of steps) {
      const sizeToRead = Math.min(step.size, file.size);
      
      try {
        console.log(`🔍 Testando ${step.name} (${this.formatBytes(sizeToRead)})...`);
        const startTime = performance.now();
        
        const chunk = file.slice(0, sizeToRead);
        const buffer = await chunk.arrayBuffer();
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const speed = (buffer.byteLength / 1024 / 1024) / (duration / 1000);
        
        if (buffer.byteLength === sizeToRead) {
          console.log(`✅ ${step.name}: Sucesso (${duration.toFixed(0)}ms, ${speed.toFixed(1)}MB/s)`);
        } else {
          console.error(`❌ ${step.name}: FALHOU - esperado ${sizeToRead}, recebido ${buffer.byteLength}`);
          console.error(`💥 PONTO DE FALHA DETECTADO: Sistema falha ao ler ${this.formatBytes(sizeToRead)}`);
          break;
        }
        
        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ ${step.name}: ERRO - ${error.message}`);
        console.error(`💥 ERRO DETECTADO em ${this.formatBytes(sizeToRead)}: ${error.message}`);
        break;
      }
    }
  },
  
  // 🎯 Encontrar ponto exato de falha
  async findBreakPoint(file) {
    console.log('🎯 === BUSCA BINÁRIA POR PONTO DE FALHA ===');
    
    let workingSize = 1024; // Começar com 1KB que geralmente funciona
    let failingSize = file.size; // Arquivo completo
    
    // Confirmar que 1KB funciona
    try {
      const testChunk = file.slice(0, workingSize);
      const testBuffer = await testChunk.arrayBuffer();
      if (testBuffer.byteLength !== workingSize) {
        console.error('❌ Até 1KB não funciona - problema grave');
        return;
      }
    } catch (error) {
      console.error('❌ Erro básico:', error);
      return;
    }
    
    console.log(`✅ Tamanho que funciona: ${this.formatBytes(workingSize)}`);
    
    // Busca binária para encontrar limite exato
    while (failingSize - workingSize > 1024) { // Precisão de 1KB
      const testSize = Math.floor((workingSize + failingSize) / 2);
      
      try {
        console.log(`🔍 Testando ${this.formatBytes(testSize)}...`);
        const chunk = file.slice(0, testSize);
        const buffer = await chunk.arrayBuffer();
        
        if (buffer.byteLength === testSize) {
          workingSize = testSize;
          console.log(`✅ ${this.formatBytes(testSize)} funciona`);
        } else {
          failingSize = testSize;
          console.log(`❌ ${this.formatBytes(testSize)} falha (recebeu ${buffer.byteLength} bytes)`);
        }
        
      } catch (error) {
        failingSize = testSize;
        console.log(`❌ ${this.formatBytes(testSize)} erro: ${error.message}`);
      }
      
      // Pausa para não travar o navegador
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`📊 RESULTADO:`);
    console.log(`  ✅ Tamanho máximo que funciona: ${this.formatBytes(workingSize)}`);
    console.log(`  ❌ Tamanho mínimo que falha: ${this.formatBytes(failingSize)}`);
    console.log(`  📏 Diferença: ${this.formatBytes(failingSize - workingSize)}`);
  },
  
  // 🔬 Testar diferentes métodos de leitura
  async testReadingMethods(file) {
    console.log('🔬 === TESTE DE MÉTODOS DE LEITURA ===');
    
    const methods = [
      {
        name: 'file.arrayBuffer()',
        test: async () => await file.arrayBuffer()
      },
      {
        name: 'file.slice().arrayBuffer()',
        test: async () => await file.slice(0, file.size).arrayBuffer()
      },
      {
        name: 'FileReader.readAsArrayBuffer()',
        test: () => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = e => reject(e.target.error);
          reader.readAsArrayBuffer(file);
        })
      }
    ];
    
    for (const method of methods) {
      try {
        console.log(`🔍 Testando ${method.name}...`);
        const startTime = performance.now();
        
        const result = await method.test();
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const speed = (result.byteLength / 1024 / 1024) / (duration / 1000);
        
        if (result.byteLength === file.size) {
          console.log(`✅ ${method.name}: Sucesso (${duration.toFixed(0)}ms, ${speed.toFixed(1)}MB/s)`);
        } else {
          console.error(`❌ ${method.name}: Parcial - ${result.byteLength}/${file.size} bytes`);
        }
        
      } catch (error) {
        console.error(`❌ ${method.name}: Erro - ${error.message}`);
      }
    }
  },
  
  // 🎵 Simular processo do Audio Analyzer
  async simulateAudioAnalyzerProcess(file) {
    console.log('🎵 === SIMULAÇÃO DO AUDIO ANALYZER ===');
    
    try {
      // Simular exatamente o que o audio analyzer faz
      console.log('🔍 Simulando analyzeAudioFile...');
      
      // 1. File validation (nossa nova validação)
      if (file.size < 100) {
        console.log('❌ Validação falhou: arquivo muito pequeno');
        return;
      }
      
      // 2. Verificar se tem cache
      if (file._cachedArrayBufferForHash) {
        console.log('📦 Arquivo tem cache de hash');
      } else {
        console.log('📦 Arquivo sem cache');
      }
      
      // 3. Tentar direct decode path
      console.log('🎯 Testando direct decode path...');
      try {
        const directBuf = file._cachedArrayBufferForHash || await file.arrayBuffer();
        console.log(`✅ Direct buffer: ${this.formatBytes(directBuf.byteLength)}`);
        
        if (directBuf.byteLength !== file.size) {
          console.error(`❌ PROBLEMA: Direct buffer diferente do tamanho original`);
          console.error(`   Esperado: ${this.formatBytes(file.size)}`);
          console.error(`   Recebido: ${this.formatBytes(directBuf.byteLength)}`);
        }
        
      } catch (error) {
        console.log(`❌ Direct decode falhou: ${error.message}`);
      }
      
      // 4. Tentar FileReader path
      console.log('📖 Testando FileReader path...');
      const fileReaderResult = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target.result;
          console.log(`📖 FileReader: ${this.formatBytes(buffer.byteLength)}`);
          
          if (buffer.byteLength !== file.size) {
            console.error(`❌ PROBLEMA: FileReader buffer diferente do tamanho original`);
            console.error(`   Esperado: ${this.formatBytes(file.size)}`);
            console.error(`   Recebido: ${this.formatBytes(buffer.byteLength)}`);
          }
          
          resolve(buffer);
        };
        reader.onerror = (error) => {
          console.error('❌ FileReader erro:', error);
          resolve(null);
        };
        reader.readAsArrayBuffer(file);
      });
      
    } catch (error) {
      console.error('❌ Erro na simulação:', error);
    }
  },
  
  // 🔧 Utilitário
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// Disponibilizar globalmente
window.debugUploadIssue = (file) => {
  if (!file) {
    console.log('💡 Use: debugUploadIssue(file) onde file é o arquivo de 32MB');
    return;
  }
  uploadTest.investigateSpecificIssue(file);
};

console.log('🚀 Upload Test carregado');
console.log('🔍 Use: debugUploadIssue(file) para investigar problema específico');
console.log('💡 IMPORTANTE: Scripts de debug só executam quando explicitamente chamados');
