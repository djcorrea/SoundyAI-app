#!/usr/bin/env node

/**
 * Quick Check - Verificação Rápida da Fase 5.1
 * 
 * Script para validação rápida da implementação do Audio Decoder
 * Executa testes essenciais e verifica dependências
 */

import { checkFFmpegAvailable, decodeAudioFile } from './audio-decoder.js';
import { generateTestWav } from './test-audio-decoder.js';

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

function log(message, color = '') {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, GREEN);
}

function logError(message) {
  log(`❌ ${message}`, RED);
}

function logWarning(message) {
  log(`⚠️  ${message}`, YELLOW);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, BLUE);
}

async function quickCheck() {
  log('\n🚀 VERIFICAÇÃO RÁPIDA - AUDIO DECODER FASE 5.1', `${BRIGHT}${BLUE}`);
  log('═'.repeat(60), BLUE);
  
  let checks = 0;
  let passed = 0;
  
  // 1. Verificar FFmpeg
  log('\n1️⃣  Verificando FFmpeg...', BRIGHT);
  checks++;
  
  try {
    const ffmpegAvailable = await checkFFmpegAvailable();
    
    if (ffmpegAvailable) {
      logSuccess('FFmpeg está disponível');
      passed++;
    } else {
      logError('FFmpeg não está disponível');
      logWarning('Instale FFmpeg: apt-get install ffmpeg (Ubuntu) ou brew install ffmpeg (macOS)');
    }
  } catch (error) {
    logError(`Erro ao verificar FFmpeg: ${error.message}`);
  }
  
  // 2. Teste de decodificação simples
  log('\n2️⃣  Teste de decodificação...', BRIGHT);
  checks++;
  
  try {
    const testWav = generateTestWav(0.5, 440); // 0.5s, 440Hz
    const result = await decodeAudioFile(testWav, 'teste-rapido.wav');
    
    // Validações básicas
    const validations = [
      [result.sampleRate === 48000, `Sample rate: ${result.sampleRate} === 48000`],
      [result.numberOfChannels === 1, `Canais: ${result.numberOfChannels} === 1`],
      [result.data instanceof Float32Array, `Tipo: ${result.data.constructor.name} === Float32Array`],
      [result.length > 0, `Samples: ${result.length} > 0`],
      [Math.abs(result.duration - 0.5) < 0.1, `Duração: ${result.duration}s ≈ 0.5s`]
    ];
    
    let validationsPassed = 0;
    
    for (const [valid, description] of validations) {
      if (valid) {
        logSuccess(description);
        validationsPassed++;
      } else {
        logError(description);
      }
    }
    
    if (validationsPassed === validations.length) {
      logSuccess('Decodificação funcionando perfeitamente');
      passed++;
    } else {
      logError(`${validationsPassed}/${validations.length} validações passaram`);
    }
    
  } catch (error) {
    logError(`Erro na decodificação: ${error.message}`);
  }
  
  // 3. Verificar tratamento de erros
  log('\n3️⃣  Teste de tratamento de erros...', BRIGHT);
  checks++;
  
  try {
    // Tentar decodificar formato não suportado
    const invalidBuffer = Buffer.from('dados inválidos');
    
    try {
      await decodeAudioFile(invalidBuffer, 'invalido.mp3');
      logError('Deveria ter rejeitado formato MP3');
    } catch (error) {
      if (error.message.includes('UNSUPPORTED_FORMAT')) {
        logSuccess('Rejeição de formato MP3 funcionando');
        passed++;
      } else {
        logError(`Erro inesperado: ${error.message}`);
      }
    }
    
  } catch (error) {
    logError(`Erro no teste de erros: ${error.message}`);
  }
  
  // 4. Verificar interface AudioBuffer
  log('\n4️⃣  Teste de compatibilidade AudioBuffer...', BRIGHT);
  checks++;
  
  try {
    const testWav = generateTestWav(0.1, 1000); // 0.1s, 1kHz
    const result = await decodeAudioFile(testWav, 'compat-test.wav');
    
    // Simular interface AudioBuffer
    const audioBufferLike = {
      sampleRate: result.sampleRate,
      numberOfChannels: result.numberOfChannels,
      length: result.length,
      duration: result.duration,
      getChannelData: (channel) => {
        if (channel !== 0) throw new Error('Canal inválido');
        return result.data;
      }
    };
    
    // Testar interface
    const channelData = audioBufferLike.getChannelData(0);
    
    if (channelData === result.data && channelData instanceof Float32Array) {
      logSuccess('Interface AudioBuffer compatível');
      passed++;
    } else {
      logError('Interface AudioBuffer incompatível');
    }
    
  } catch (error) {
    logError(`Erro no teste de compatibilidade: ${error.message}`);
  }
  
  // Resumo final
  log('\n📊 RESUMO DA VERIFICAÇÃO', `${BRIGHT}${BLUE}`);
  log('═'.repeat(60), BLUE);
  
  const percentage = Math.round((passed / checks) * 100);
  
  log(`✅ Testes passaram: ${passed}/${checks} (${percentage}%)`);
  
  if (passed === checks) {
    log('\n🎉 TUDO FUNCIONANDO PERFEITAMENTE!', `${BRIGHT}${GREEN}`);
    log('✅ Audio Decoder está pronto para uso', GREEN);
    log('✅ Integração com pipeline pode prosseguir', GREEN);
    log('✅ Próxima fase: 5.2 - Simulação Temporal', GREEN);
  } else if (passed >= checks * 0.7) {
    log('\n⚠️  FUNCIONAMENTO PARCIAL', `${BRIGHT}${YELLOW}`);
    log('✅ Funcionalidade básica ok, mas há problemas', YELLOW);
    log('⚠️  Revise erros antes de prosseguir', YELLOW);
  } else {
    log('\n❌ PROBLEMAS CRÍTICOS DETECTADOS', `${BRIGHT}${RED}`);
    log('❌ Não prossiga para próxima fase', RED);
    log('🔧 Corrija erros antes de continuar', RED);
  }
  
  // Informações adicionais
  log('\n📋 PRÓXIMOS PASSOS:', BRIGHT);
  
  if (passed === checks) {
    logInfo('1. Integrar com API existente (ver integration-example.js)');
    logInfo('2. Configurar feature flags para rollout gradual');
    logInfo('3. Implementar Fase 5.2 (Simulação Temporal)');
    logInfo('4. Executar testes completos: npm run test:audio-decoder');
  } else {
    logInfo('1. Corrigir problemas identificados acima');
    logInfo('2. Executar verificação completa novamente');
    logInfo('3. Verificar instalação do FFmpeg se necessário');
    logInfo('4. Consultar README-FASE-5.1.md para troubleshooting');
  }
  
  log('\n📁 ARQUIVOS IMPORTANTES:', BRIGHT);
  logInfo('• api/audio/audio-decoder.js - Módulo principal');
  logInfo('• api/audio/test-audio-decoder.js - Testes completos');
  logInfo('• api/audio/integration-example.js - Exemplo de integração');
  logInfo('• api/audio/README-FASE-5.1.md - Documentação completa');
  
  return passed === checks;
}

// Executar verificação
if (import.meta.url === `file://${process.argv[1]}`) {
  quickCheck()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`\n❌ ERRO CRÍTICO:`, error);
      console.error(error.stack);
      process.exit(1);
    });
}

export { quickCheck };
