/**
 * 🚀 TESTE RÁPIDO DO SISTEMA ESPECTRAL
 * Script para validar rapidamente o funcionamento
 */

// Simular ambiente Node.js se necessário
if (typeof require !== 'undefined') {
  // Para uso em Node.js com ts-node
  require('ts-node/register');
}

import { executarExemplos } from './analyzer/integration-example';

async function testeRapido() {
  console.log('🚀 INICIANDO TESTE RÁPIDO DO SISTEMA');
  console.log('Implementação: Balanço Espectral com % Energia + dB UI');
  console.log('=' .repeat(60));
  
  try {
    // Executar demonstração completa
    await executarExemplos();
    
    console.log('\n🎊 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Sistema implementado e funcionando corretamente');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    process.exit(1);
  }
}

// Executar teste
if (typeof window === 'undefined') {
  testeRapido();
} else {
  // Para uso no browser
  (window as any).testeRapidoSpectral = testeRapido;
  console.log('🌐 Teste disponível como: window.testeRapidoSpectral()');
}
