const { spawn } = require('child_process');

console.log('🔍 Monitorando logs Railway...\n');

let attempt = 1;

function checkLogs() {
  console.log(`[${new Date().toLocaleTimeString()}] Tentativa ${attempt++}`);
  
  const railway = spawn('railway', ['logs'], {
    cwd: 'c:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\work',
    stdio: 'pipe'
  });

  let output = '';

  railway.stdout.on('data', (data) => {
    output += data.toString();
  });

  railway.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  railway.on('close', (code) => {
    if (output.trim()) {
      console.log('📋 LOGS:');
      console.log(output);
      console.log('─'.repeat(60));
    } else {
      console.log('❌ Logs vazios ou erro');
    }
    
    // Verificar novamente em 5 segundos
    setTimeout(checkLogs, 5000);
  });
}

checkLogs();