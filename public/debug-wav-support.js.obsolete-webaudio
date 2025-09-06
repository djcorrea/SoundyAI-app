// 🔍 DIAGNÓSTICO WAV SUPPORT - Investigar problemas específicos

window.debugWAVSupport = {
  
  // 🎯 Teste de formatos suportados
  async testFormatSupport() {
    console.log('🔍 === DIAGNÓSTICO WAV SUPPORT ===');
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('🎵 AudioContext criado:', {
      state: audioContext.state,
      sampleRate: audioContext.sampleRate,
      baseLatency: audioContext.baseLatency
    });
    
    // Teste com ArrayBuffer vazio para verificar método
    try {
      const emptyBuffer = new ArrayBuffer(44); // Header WAV mínimo
      await audioContext.decodeAudioData(emptyBuffer);
    } catch (e) {
      console.log('⚠️ decodeAudioData method test:', e.name, '-', e.message);
    }
    
    // Verificar suporte por extensão
    const formats = ['wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac'];
    console.log('📋 Formatos testáveis via Audio element:');
    
    formats.forEach(format => {
      const audio = new Audio();
      const canPlay = audio.canPlayType(`audio/${format}`);
      console.log(`  ${format}: ${canPlay || 'not supported'}`);
    });
    
    console.log('🔍 === FIM DIAGNÓSTICO ===');
  },
  
  // � VALIDAÇÃO CRÍTICA DE ARQUIVO
  validateFileBasics(file) {
    console.log('🚨 === VALIDAÇÃO CRÍTICA ===');
    
    const issues = [];
    const warnings = [];
    
    // 1. TAMANHO MÍNIMO
    if (file.size < 100) {
      issues.push({
        severity: 'CRÍTICO',
        type: 'ARQUIVO_MUITO_PEQUENO',
        message: `Arquivo com ${file.size} bytes é muito pequeno para WAV (mínimo ~100 bytes)`,
        suggestion: 'Verifique se o arquivo não está corrompido ou truncado'
      });
    } else if (file.size < 1000) {
      warnings.push({
        severity: 'AVISO',
        type: 'ARQUIVO_SUSPEITO',
        message: `Arquivo muito pequeno (${file.size} bytes) para áudio útil`,
        suggestion: 'Arquivo pode estar corrompido ou conter apenas silêncio'
      });
    }
    
    // 2. MIME TYPE
    if (file.type && !file.type.includes('audio')) {
      issues.push({
        severity: 'CRÍTICO',
        type: 'MIME_TYPE_INVÁLIDO',
        message: `MIME type "${file.type}" não é de áudio`,
        suggestion: 'Verifique se é realmente um arquivo de áudio'
      });
    }
    
    // 3. EXTENSÃO
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac', 'aac'].includes(ext)) {
      warnings.push({
        severity: 'AVISO',
        type: 'EXTENSÃO_DESCONHECIDA',
        message: `Extensão ".${ext}" pode não ser suportada`,
        suggestion: 'Use WAV, MP3, M4A para melhor compatibilidade'
      });
    }
    
    // 4. ARQUIVO VAZIO
    if (file.size === 0) {
      issues.push({
        severity: 'CRÍTICO',
        type: 'ARQUIVO_VAZIO',
        message: 'Arquivo está vazio (0 bytes)',
        suggestion: 'Selecione um arquivo válido'
      });
    }
    
    return { issues, warnings, isValid: issues.length === 0 };
  },
  
  // �🔬 Análise detalhada de arquivo WAV
  async analyzeWAVFile(file) {
    console.log('🔬 === ANÁLISE DETALHADA WAV ===');
    console.log('📁 Arquivo:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString()
    });
    
    // VALIDAÇÃO CRÍTICA PRIMEIRO
    const validation = this.validateFileBasics(file);
    
    if (validation.issues.length > 0) {
      console.error('❌ PROBLEMAS CRÍTICOS DETECTADOS:');
      validation.issues.forEach(issue => {
        console.error(`  🚨 ${issue.type}: ${issue.message}`);
        console.error(`     💡 ${issue.suggestion}`);
      });
      return { validation, criticalError: true };
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ AVISOS:');
      validation.warnings.forEach(warning => {
        console.warn(`  ⚠️ ${warning.type}: ${warning.message}`);
        console.warn(`     💡 ${warning.suggestion}`);
      });
    }
    
    // Ler header WAV
    const reader = new FileReader();
    const headerPromise = new Promise((resolve) => {
      reader.onload = (e) => {
        const buffer = e.target.result;
        const view = new DataView(buffer);
        
        try {
          // WAV Header Analysis
          const riff = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
          const fileSize = view.getUint32(4, true);
          const wave = String.fromCharCode(...new Uint8Array(buffer, 8, 4));
          const fmt = String.fromCharCode(...new Uint8Array(buffer, 12, 4));
          const audioFormat = view.getUint16(20, true);
          const numChannels = view.getUint16(22, true);
          const sampleRate = view.getUint32(24, true);
          const bitsPerSample = view.getUint16(34, true);
          
          const wavInfo = {
            riff,
            fileSize,
            wave,
            fmt,
            audioFormat,
            numChannels,
            sampleRate,
            bitsPerSample,
            isValidWAV: riff === 'RIFF' && wave === 'WAVE',
            formatName: audioFormat === 1 ? 'PCM' : audioFormat === 3 ? 'IEEE Float' : `Unknown (${audioFormat})`
          };
          
          console.log('🎵 WAV Header:', wavInfo);
          
          // Verificar se é um formato problemático
          if (audioFormat !== 1 && audioFormat !== 3) {
            console.warn('⚠️ PROBLEMA DETECTADO: Formato WAV não é PCM nem IEEE Float');
            console.warn('📋 Web Audio API só suporta PCM (1) e IEEE Float (3)');
          }
          
          if (sampleRate > 192000 || sampleRate < 8000) {
            console.warn('⚠️ PROBLEMA DETECTADO: Sample rate fora do padrão:', sampleRate);
          }
          
          if (bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
            console.warn('⚠️ PROBLEMA DETECTADO: Bits per sample problemático:', bitsPerSample);
          }
          
          resolve(wavInfo);
        } catch (e) {
          console.error('❌ Erro ao analisar header WAV:', e);
          console.error('📋 Isto confirma que o arquivo não é um WAV válido');
          resolve({ error: e.message, headerCorrupted: true });
        }
      };
    });
    
    reader.readAsArrayBuffer(file.slice(0, 100)); // Só ler header
    const wavInfo = await headerPromise;
    
    // Se header já falhou, não tentar decodificar
    if (wavInfo.error || wavInfo.headerCorrupted) {
      console.log('🔬 === FIM ANÁLISE (HEADER INVÁLIDO) ===');
      return { validation, wavInfo, skipDecodeTest: true };
    }
    
    // Teste de decodificação com AudioContext
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const fullReader = new FileReader();
      const decodePromise = new Promise((resolve, reject) => {
        fullReader.onload = async (e) => {
          try {
            const audioBuffer = await audioContext.decodeAudioData(e.target.result);
            console.log('✅ SUCESSO na decodificação:', {
              duration: audioBuffer.duration,
              sampleRate: audioBuffer.sampleRate,
              channels: audioBuffer.numberOfChannels,
              length: audioBuffer.length
            });
            resolve(true);
          } catch (decodeError) {
            console.error('❌ ERRO na decodificação:', decodeError);
            console.error('📋 Detalhes:', decodeError.name, '-', decodeError.message);
            resolve(false);
          }
        };
        fullReader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      });
      
      fullReader.readAsArrayBuffer(file);
      await decodePromise;
    } catch (contextError) {
      console.error('❌ Erro no AudioContext:', contextError);
    }
    
    console.log('🔬 === FIM ANÁLISE ===');
    return { validation, wavInfo };
  }
};

// Auto-executar teste básico
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Debug WAV Support carregado. Use:');
  console.log('  debugWAVSupport.testFormatSupport() - Teste geral');
  console.log('  debugWAVSupport.analyzeWAVFile(file) - Análise de arquivo específico');
  console.log('  debugWAVSupport.validateFileBasics(file) - Validação rápida');
  console.log('💡 IMPORTANTE: Scripts de debug só executam quando explicitamente chamados');
  
  // REMOVIDO: Execução automática que estava causando erros falsos
});

// ✅ Scripts de debug corrigidos - sem execução automática
