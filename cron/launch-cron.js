/**
 * ⏰ CRON JOB - Disparo Automático de E-mails de Lançamento
 * 
 * Este script é executado periodicamente para verificar se chegou
 * o horário do lançamento e disparar os e-mails automaticamente.
 * 
 * CONFIGURAÇÃO:
 * - Data do lançamento: 22/01/2026
 * - Horário: 12:00 (America/Sao_Paulo)
 * - Frequência do cron: A cada 5 minutos entre 11:30 e 12:30 do dia 22
 * 
 * OPÇÕES DE DEPLOY:
 * 
 * 1. RAILWAY CRON (Recomendado):
 *    - Crie um novo serviço "cron" no Railway
 *    - Configure: "30 11-12 22 1 * node cron/launch-cron.js"
 * 
 * 2. GITHUB ACTIONS:
 *    - Veja o arquivo .github/workflows/launch-cron.yml
 * 
 * 3. VERCEL CRON:
 *    - Configure em vercel.json
 * 
 * 4. MANUAL (backup):
 *    - curl -X POST "https://api.soundyai.com.br/api/launch/schedule-check" \
 *      -H "X-Launch-Key: sua-chave-secreta"
 * 
 * @version 1.0.0
 * @created 2026-01-05
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.API_BASE_URL || 'https://soundyai-app-production.up.railway.app';
const LAUNCH_SECRET_KEY = process.env.LAUNCH_SECRET_KEY || 'soundyai-launch-2026-01-22-secret';

// Data/hora do lançamento (timezone: America/Sao_Paulo)
const LAUNCH_DATE = '2026-01-22';
const LAUNCH_HOUR = 12;

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtém o horário atual em Brasília
 */
function getBrasiliaTime() {
  const now = new Date();
  const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return {
    date: brTime.toISOString().split('T')[0],
    hour: brTime.getHours(),
    minute: brTime.getMinutes(),
    full: brTime.toISOString()
  };
}

/**
 * Verifica se está no horário de lançamento
 */
function isLaunchTime() {
  const br = getBrasiliaTime();
  return br.date === LAUNCH_DATE && br.hour >= LAUNCH_HOUR;
}

/**
 * Chama o endpoint de disparo
 */
async function triggerLaunchBlast() {
  console.log('🚀 [CRON] Chamando endpoint de disparo...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/launch/schedule-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Launch-Key': LAUNCH_SECRET_KEY
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ [CRON] Resposta do servidor:', data);
      return data;
    } else {
      console.error('❌ [CRON] Erro na resposta:', response.status, data);
      return { success: false, error: data };
    }
    
  } catch (error) {
    console.error('❌ [CRON] Erro de conexão:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⏰ [CRON] VERIFICAÇÃO DE LANÇAMENTO INICIADA');
  console.log('═══════════════════════════════════════════════════════════');
  
  const br = getBrasiliaTime();
  console.log(`📅 Data atual (BR): ${br.date}`);
  console.log(`⏰ Hora atual (BR): ${br.hour}:${br.minute}`);
  console.log(`🎯 Data de lançamento: ${LAUNCH_DATE} ${LAUNCH_HOUR}:00`);
  
  if (isLaunchTime()) {
    console.log('🚀 [CRON] HORÁRIO DE LANÇAMENTO! Disparando e-mails...');
    const result = await triggerLaunchBlast();
    
    if (result.dispatched) {
      console.log('✅ [CRON] E-mails disparados com sucesso!');
      console.log(`   Enviados: ${result.stats?.sent || 0}`);
      console.log(`   Pulados: ${result.stats?.skipped || 0}`);
      console.log(`   Falhas: ${result.stats?.failed || 0}`);
    } else if (result.success && !result.dispatched) {
      console.log('⏳ [CRON] Servidor diz que ainda não é hora');
    } else {
      console.error('❌ [CRON] Erro no disparo:', result.error);
    }
  } else {
    console.log('⏳ [CRON] Ainda não é hora do lançamento');
    
    // Calcular tempo restante
    const launchDate = new Date(`${LAUNCH_DATE}T${LAUNCH_HOUR}:00:00-03:00`);
    const now = new Date();
    const diffMs = launchDate - now;
    
    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`⏱️ [CRON] Tempo restante: ${diffHours}h ${diffMinutes}min`);
    } else {
      console.log('⚠️ [CRON] Data de lançamento já passou!');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
}

// Executar
main().catch(console.error);
