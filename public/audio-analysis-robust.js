// 🎯 SISTEMA ROBUSTO ANTI-TRAVAMENTO
// Implementa timeout inteligente, retry automático e monitoramento preventivo

class AudioAnalysisManager {
  constructor() {
    this.timeoutMs = 120000; // 2 minutos timeout máximo
    this.maxRetries = 2;
    this.pollInterval = 2000; // 2 segundos
    this.watchdogInterval = 30000; // 30 segundos
  }

  async analyzeAudioRobust(file, referenceGenre = 'funk mandela') {
    console.log('🎯 Iniciando análise robusta de áudio...');
    
    try {
      // 1. Upload com retry
      const uploadResult = await this.uploadWithRetry(file);
      console.log('📤 Upload concluído:', uploadResult.jobId);
      
      // 2. Monitoramento robusto com watchdog
      const analysisResult = await this.monitorJobWithWatchdog(uploadResult.jobId);
      
      console.log('🎉 Análise concluída com sucesso!');
      return analysisResult;
      
    } catch (error) {
      console.error('❌ Falha na análise robusta:', error);
      throw new Error(`Análise falhou: ${error.message}`);
    }
  }

  async uploadWithRetry(file, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Tentativa de upload ${attempt}/${maxRetries}...`);
        
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('reference', 'funk mandela');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Upload falhou: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success || !result.jobId) {
          throw new Error('Upload não retornou jobId válido');
        }

        return result;

      } catch (error) {
        console.warn(`⚠️ Upload tentativa ${attempt} falhou:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Upload falhou após ${maxRetries} tentativas: ${error.message}`);
        }
        
        // Esperar antes de retry (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async monitorJobWithWatchdog(jobId) {
    console.log(`👁️ Iniciando monitoramento robusto do job ${jobId}...`);
    
    const startTime = Date.now();
    let attempts = 0;
    let lastStatus = 'unknown';
    let stuckCount = 0;
    
    return new Promise((resolve, reject) => {
      const checkJob = async () => {
        try {
          attempts++;
          const elapsed = Date.now() - startTime;
          
          // 🚨 TIMEOUT ABSOLUTO
          if (elapsed > this.timeoutMs) {
            console.error(`🚨 TIMEOUT: Job ${jobId} excedeu ${this.timeoutMs/1000}s`);
            this.cancelStuckJob(jobId);
            reject(new Error(`Timeout: análise excedeu ${this.timeoutMs/1000} segundos`));
            return;
          }

          // 📊 Verificar status do job
          const jobStatus = await this.checkJobStatus(jobId);
          console.log(`📊 [${elapsed/1000}s] Job ${jobId}: ${jobStatus.status}`);

          // 🎉 SUCESSO
          if (jobStatus.status === 'done' || jobStatus.status === 'completed') {
            if (jobStatus.result) {
              console.log('✅ Job concluído com resultado!');
              resolve(jobStatus.result);
              return;
            } else {
              console.warn('⚠️ Job concluído mas sem resultado, tentando novamente...');
            }
          }

          // ❌ FALHA
          if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
            console.error(`❌ Job falhou: ${jobStatus.error || 'erro desconhecido'}`);
            reject(new Error(`Job falhou: ${jobStatus.error || 'erro desconhecido'}`));
            return;
          }

          // 🔄 PROCESSANDO - Watchdog anti-travamento
          if (jobStatus.status === 'processing') {
            if (lastStatus === 'processing') {
              stuckCount++;
              
              // Se ficar muito tempo em processing, resetar
              if (stuckCount >= 10) { // 20 segundos travado
                console.warn(`🚨 Job ${jobId} travado em processing, resetando...`);
                await this.resetStuckJob(jobId);
                stuckCount = 0;
              }
            } else {
              stuckCount = 0; // Reset contador se status mudou
            }
          }

          lastStatus = jobStatus.status;

          // ⏰ Próxima verificação
          setTimeout(checkJob, this.pollInterval);

        } catch (error) {
          console.error(`❌ Erro ao verificar job ${jobId}:`, error);
          
          // Se for erro de rede, continuar tentando
          if (attempts < 20) {
            setTimeout(checkJob, this.pollInterval * 2);
          } else {
            reject(new Error(`Falha de comunicação: ${error.message}`));
          }
        }
      };

      // Iniciar monitoramento
      checkJob();
    });
  }

  async checkJobStatus(jobId) {
    const response = await fetch(`/api/job-status/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao verificar status: ${response.status}`);
    }
    
    return await response.json();
  }

  async resetStuckJob(jobId) {
    console.log(`🔄 Resetando job travado: ${jobId}`);
    
    try {
      const response = await fetch(`/api/reset-job/${jobId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log(`✅ Job ${jobId} resetado com sucesso`);
      } else {
        console.warn(`⚠️ Falha ao resetar job ${jobId}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao resetar job ${jobId}:`, error.message);
    }
  }

  async cancelStuckJob(jobId) {
    console.log(`❌ Cancelando job travado: ${jobId}`);
    
    try {
      const response = await fetch(`/api/cancel-job/${jobId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log(`✅ Job ${jobId} cancelado`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao cancelar job ${jobId}:`, error.message);
    }
  }
}

// 🎯 INSTÂNCIA GLOBAL ROBUSTA
window.audioAnalysisManager = new AudioAnalysisManager();

// 🎯 FUNÇÃO PRINCIPAL ROBUSTA - Substitui analyzeAudio()
async function analyzeAudioRobust(file, referenceGenre = 'funk mandela') {
  return await window.audioAnalysisManager.analyzeAudioRobust(file, referenceGenre);
}

console.log('🛡️ Sistema robusto anti-travamento carregado!');
console.log('   - Timeout automático: 2 minutos');
console.log('   - Watchdog anti-travamento: 20 segundos'); 
console.log('   - Retry automático em uploads');
console.log('   - Monitoramento preventivo');

export { AudioAnalysisManager, analyzeAudioRobust };
