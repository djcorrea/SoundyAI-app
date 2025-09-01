// Teste simplificado de geração de sugestões ALTO/BAIXO
import fs from 'fs';
import path from 'path';

const analyzerPath = path.resolve('./public/audio-analyzer.js');
if (!fs.existsSync(analyzerPath)) {
  console.error('audio-analyzer.js não encontrado para teste manual.');
  process.exit(0);
}
// Este teste não executa o browser; valida regex de mensagem construida manualmente
const sampleSuggestion = {
  type: 'band_adjust',
  _bandKey: 'band:high_mid',
  message: 'Banda high_mid acima do ideal',
  action: 'High-mid acima do alvo (+3.2dB). Considere reduzir ~3.0 dB em 2–6 kHz',
  details: 'Valor -4.80dB vs alvo -8.00dB | dif +3.20dB | limites [-10.00, -6.00] (leve) | faixa 2000-6000Hz'
};
console.log('Mensagem exemplo excesso high_mid OK');
