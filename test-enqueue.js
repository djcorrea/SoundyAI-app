import dotenv from 'dotenv';
dotenv.config();

import { getAudioQueue, getQueueReadyPromise } from './work/lib/queue.js';

console.log('🚀 [TEST] Iniciando teste de enfileiramento...');

await getQueueReadyPromise(); // ✅ primeiro inicializa

const queue = getAudioQueue(); // ✅ depois pega a fila pronta

try {
  const job = await queue.add('process-audio', {
    fileKey: 'teste123',
    mode: 'manual',
    fileName: 'teste.wav'
  });
  console.log('✅ [TEST] Job enfileirado com sucesso:', job.id);
} catch (err) {
  console.error('❌ [TEST] Falha ao enfileirar job:', err);
}
