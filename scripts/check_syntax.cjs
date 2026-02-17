const fs = require('fs');
try {
  new Function(fs.readFileSync('queue/automaster-worker.cjs','utf8'));
  console.log('SYNTAX_OK');
} catch (e) {
  console.error('SYNTAX_ERROR');
  console.error(e.stack);
  process.exit(1);
}
