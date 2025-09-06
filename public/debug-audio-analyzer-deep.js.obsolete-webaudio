// 🔬 INVESTIGAÇÃO PROFUNDA - Onde o arquivo está sendo corrompido?

window.deepAudioAnalyzerDebug = {
  
  // 🎯 Interceptar e monitorar cada etapa do Audio Analyzer
  async interceptAudioAnalyzerFlow(file) {
    console.log('🔬 === INTERCEPÇÃO COMPLETA DO AUDIO ANALYZER ===');
    console.log('📁 Arquivo original:', {
      name: file.name,
      size: file.size,
      sizeFormatted: this.formatBytes(file.size)
    });
    
    // 1. INTERCEPTAR analyzeAudioFile
    const originalAnalyzeAudioFile = window.audioAnalyzer.analyzeAudioFile.bind(window.audioAnalyzer);
    window.audioAnalyzer.analyzeAudioFile = async function(file, options = {}) {
      console.log('🎯 [INTERCEPT] analyzeAudioFile chamado:', {
        fileName: file.name,
        fileSize: file.size,
        options: options
      });
      
      try {
        const result = await originalAnalyzeAudioFile(file, options);
        console.log('✅ [INTERCEPT] analyzeAudioFile sucesso:', result);
        return result;
      } catch (error) {
        console.error('❌ [INTERCEPT] analyzeAudioFile erro:', error);
        console.error('📋 [INTERCEPT] Detalhes do erro:', {
          message: error.message,
          stack: error.stack,
          fileAtError: {
            name: file.name,
            size: file.size
          }
        });
        throw error;
      }
    };
    
    // 2. INTERCEPTAR _decodeAudioFile
    if (window.audioAnalyzer._decodeAudioFile) {
      const originalDecodeAudioFile = window.audioAnalyzer._decodeAudioFile.bind(window.audioAnalyzer);
      window.audioAnalyzer._decodeAudioFile = async function(file, runId) {
        console.log('🎯 [INTERCEPT] _decodeAudioFile chamado:', {
          fileName: file.name,
          fileSize: file.size,
          runId: runId
        });
        
        try {
          const result = await originalDecodeAudioFile(file, runId);
          console.log('✅ [INTERCEPT] _decodeAudioFile resultado:', {
            resultType: typeof result,
            resultSize: result?.byteLength || 'N/A',
            runId: runId
          });
          return result;
        } catch (error) {
          console.error('❌ [INTERCEPT] _decodeAudioFile erro:', error);
          console.error('📋 [INTERCEPT] Arquivo no momento do erro:', {
            name: file.name,
            size: file.size,
            runId: runId
          });
          throw error;
        }
      };
    }
    
    // 3. MONITORAR FileReader events
    this.interceptFileReaderEvents();
    
    // 4. MONITORAR AudioContext.decodeAudioData
    this.interceptAudioContextDecode();
    
    console.log('🔍 Interceptação ativa - execute análise de áudio agora');
  },
  
  // 📖 Interceptar eventos do FileReader
  interceptFileReaderEvents() {
    console.log('📖 [INTERCEPT] Configurando monitor de FileReader...');
    
    const originalFileReader = window.FileReader;
    window.FileReader = function() {
      const reader = new originalFileReader();
      
      const originalReadAsArrayBuffer = reader.readAsArrayBuffer;
      reader.readAsArrayBuffer = function(file) {
        console.log('📖 [INTERCEPT] FileReader.readAsArrayBuffer:', {
          fileName: file.name,
          fileSize: file.size
        });
        
        const originalOnLoad = reader.onload;
        reader.onload = function(event) {
          const result = event.target.result;
          console.log('📖 [INTERCEPT] FileReader.onload:', {
            inputFileSize: file.size,
            outputBufferSize: result.byteLength,
            match: result.byteLength === file.size,
            sizeDifference: file.size - result.byteLength
          });
          
          if (result.byteLength !== file.size) {
            console.error('🚨 [INTERCEPT] CORRUPÇÃO DETECTADA NO FILEREADER!');
            console.error('📋 Esperado:', file.size, 'bytes');
            console.error('📋 Recebido:', result.byteLength, 'bytes');
            console.error('📋 Perda:', file.size - result.byteLength, 'bytes');
          }
          
          if (originalOnLoad) {
            originalOnLoad.call(this, event);
          }
        };
        
        const originalOnError = reader.onerror;
        reader.onerror = function(event) {
          console.error('❌ [INTERCEPT] FileReader.onerror:', event);
          if (originalOnError) {
            originalOnError.call(this, event);
          }
        };
        
        return originalReadAsArrayBuffer.call(this, file);
      };
      
      return reader;
    };
  },
  
  // 🎵 Interceptar AudioContext.decodeAudioData
  interceptAudioContextDecode() {
    console.log('🎵 [INTERCEPT] Configurando monitor de AudioContext.decodeAudioData...');
    
    if (window.AudioContext) {
      const originalDecodeAudioData = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function(audioData) {
        console.log('🎵 [INTERCEPT] AudioContext.decodeAudioData:', {
          inputSize: audioData.byteLength,
          inputType: audioData.constructor.name
        });
        
        const promise = originalDecodeAudioData.call(this, audioData);
        
        return promise.then(
          (audioBuffer) => {
            console.log('✅ [INTERCEPT] decodeAudioData sucesso:', {
              duration: audioBuffer.duration,
              sampleRate: audioBuffer.sampleRate,
              channels: audioBuffer.numberOfChannels,
              length: audioBuffer.length
            });
            return audioBuffer;
          },
          (error) => {
            console.error('❌ [INTERCEPT] decodeAudioData erro:', error);
            console.error('📋 [INTERCEPT] Input que causou erro:', {
              size: audioData.byteLength,
              type: audioData.constructor.name
            });
            
            // ANÁLISE ESPECIAL PARA ERRO DE 15 BYTES
            if (audioData.byteLength <= 20) {
              console.error('🚨 [INTERCEPT] ARQUIVO TRUNCADO DETECTADO!');
              console.error('📋 Só há', audioData.byteLength, 'bytes para decodificar');
              console.error('📋 Este é o momento exato da corrupção!');
              
              // Tentar analisar o conteúdo dos primeiros bytes
              const view = new Uint8Array(audioData);
              console.error('📋 Primeiros bytes:', Array.from(view.slice(0, Math.min(20, view.length))));
            }
            
            throw error;
          }
        );
      };
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

// Função para ativar intercepção
window.startDeepDebug = (file) => {
  if (!file) {
    console.log('💡 Use: startDeepDebug(file) onde file é o arquivo de 32MB');
    console.log('💡 Depois execute o upload/análise normalmente');
    return;
  }
  
  deepAudioAnalyzerDebug.interceptAudioAnalyzerFlow(file);
  console.log('🔍 Intercepção ativada! Agora execute a análise de áudio normalmente.');
  console.log('🔍 O sistema vai mostrar exatamente onde o arquivo está sendo corrompido.');
};

console.log('🚀 Deep Audio Analyzer Debug carregado');
console.log('🔍 Use: startDeepDebug(file) para interceptar todo o fluxo');
console.log('💡 IMPORTANTE: Debug só ativo quando explicitamente iniciado');
