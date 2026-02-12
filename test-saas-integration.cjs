/**
 * ============================================================================
 * TESTE DE INTEGRAÇÃO SAAS
 * ============================================================================
 * 
 * Testa o fluxo completo:
 * 1. Upload via API
 * 2. Enfileiramento no Redis
 * 3. Processamento pelo Worker
 * 4. Polling de status
 * 5. Resultado final
 * 
 * Uso: node test-saas-integration.cjs
 * 
 * ============================================================================
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_AUDIO = path.resolve(__dirname, 'test-audio-sine-30s.wav');

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// ============================================================================
// TESTE
// ============================================================================

async function runIntegrationTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TESTE DE INTEGRAÇÃO SAAS - AutoMaster V1');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Verificar se arquivo de teste existe
    if (!fs.existsSync(TEST_AUDIO)) {
      console.error('❌ Arquivo de teste não encontrado:', TEST_AUDIO);
      console.log('\nGere um arquivo de teste com:');
      console.log('ffmpeg -f lavfi -i "sine=frequency=440:duration=30" test-audio-sine-30s.wav\n');
      process.exit(1);
    }

    console.log('✓ Arquivo de teste encontrado');
    console.log(`  Path: ${TEST_AUDIO}`);
    console.log(`  Size: ${(fs.statSync(TEST_AUDIO).size / 1024).toFixed(2)} KB\n`);

    // 2. Upload
    console.log('▶ STEP 1: Upload');
    const form = new FormData();
    form.append('audio', fs.createReadStream(TEST_AUDIO));
    form.append('mode', 'BALANCED');

    const uploadResponse = await fetch(`${API_URL}/automaster`, {
      method: 'POST',
      body: form
    }).then(r => r.json());

    if (!uploadResponse.success) {
      throw new Error(`Upload falhou: ${uploadResponse.error}`);
    }

    const jobId = uploadResponse.jobId;
    console.log(`✓ Upload concluído`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  Status: ${uploadResponse.status}\n`);

    // 3. Polling
    console.log('▶ STEP 2: Polling de Status');
    let attempts = 0;
    let maxAttempts = 30;
    let completed = false;

    while (attempts < maxAttempts && !completed) {
      await sleep(2000);
      attempts++;

      const statusResponse = await httpRequest(`${API_URL}/automaster/${jobId}`);

      console.log(`  [${attempts}/${maxAttempts}] Status: ${statusResponse.status} | Progress: ${statusResponse.progress}%`);

      if (statusResponse.status === 'completed') {
        completed = true;
        console.log('\n✓ Job concluído com sucesso!');
        console.log('  Resultado:', JSON.stringify(statusResponse.result, null, 2));
        break;
      }

      if (statusResponse.status === 'failed') {
        throw new Error(`Job falhou: ${statusResponse.error}`);
      }
    }

    if (!completed) {
      throw new Error('Timeout: Job não concluiu em tempo hábil');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ TESTE DE INTEGRAÇÃO PASSOU');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('  ❌ TESTE DE INTEGRAÇÃO FALHOU');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('\nErro:', error.message);
    console.error('\n');
    process.exit(1);
  }
}

// ============================================================================
// EXECUÇÃO
// ============================================================================

if (require.main === module) {
  runIntegrationTest();
}

module.exports = { runIntegrationTest };
