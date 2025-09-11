// 🐕 SISTEMA WATCHDOG - INICIADOR AUTOMÁTICO
// Executa automaticamente limpeza de jobs travados

const robustJobManager = require('./robust-job-manager.js');

console.log('🚀 Iniciando sistema watchdog SoundyAI...');

// Verificar saúde inicial
robustJobManager.getSystemHealth().then(health => {
  console.log('📊 Saúde inicial do sistema:', {
    healthy: health.healthy,
    totalJobs24h: health.totalJobs24h,
    currentlyStuck: health.currentlyStuck
  });
  
  if (!health.healthy) {
    console.warn('⚠️ Sistema não está saudável! Executando limpeza inicial...');
    robustJobManager.watchdogCleanup();
  }
});

// Iniciar watchdog automático
robustJobManager.startWatchdog();

// Endpoint de saúde
setInterval(async () => {
  const health = await robustJobManager.getSystemHealth();
  if (!health.healthy) {
    console.warn(`🚨 ALERTA: ${health.currentlyStuck} jobs travados detectados!`);
  }
}, 60000); // Verificar a cada minuto

console.log('✅ Watchdog ativo - monitoramento anti-travamento iniciado');
