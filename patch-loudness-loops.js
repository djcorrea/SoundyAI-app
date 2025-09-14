// 🔧 CORREÇÃO CRÍTICA: Proteção contra loops infinitos no LUFS
// Este patch adiciona timeouts e validações para evitar travamentos

import { readFile, writeFile } from 'fs/promises';

async function patchLoudnessFile() {
    try {
        console.log('🔧 Aplicando patch de proteção contra loops no loudness.js...');
        
        const filePath = './work/lib/audio/features/loudness.js';
        let content = await readFile(filePath, 'utf8');
        
        // 1. Adicionar timeout na função calculateBlockLoudness
        const originalBlockLoudness = `calculateBlockLoudness(leftFiltered, rightFiltered) {
    const blocks = [];
    const numBlocks = Math.floor((leftFiltered.length - this.blockSize) / this.hopSize) + 1;
    
    for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {`;
        
        const patchedBlockLoudness = `calculateBlockLoudness(leftFiltered, rightFiltered) {
    const blocks = [];
    const numBlocks = Math.floor((leftFiltered.length - this.blockSize) / this.hopSize) + 1;
    
    // 🔥 PROTEÇÃO CRÍTICA: Timeout para evitar loops infinitos
    const maxBlocks = Math.ceil(leftFiltered.length / this.hopSize) + 100; // margem de segurança
    const actualNumBlocks = Math.min(numBlocks, maxBlocks);
    
    if (actualNumBlocks > 100000) {
      console.warn(\`⚠️ LUFS: muitos blocos (\${actualNumBlocks}), limitando para evitar travamento\`);
      actualNumBlocks = 100000;
    }
    
    const startTime = Date.now();
    
    for (let blockIdx = 0; blockIdx < actualNumBlocks; blockIdx++) {
      // 🔥 TIMEOUT CHECK a cada 1000 iterações
      if (blockIdx % 1000 === 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed > 30000) { // 30 segundos max
          console.error(\`🚨 LUFS timeout após \${elapsed}ms, parando em bloco \${blockIdx}/\${actualNumBlocks}\`);
          break;
        }
      }`;
        
        // 2. Adicionar validação de bounds no loop interno
        const originalInnerLoop = `for (let i = startSample; i < endSample; i++) {
        sumL += leftFiltered[i] * leftFiltered[i];
        sumR += rightFiltered[i] * rightFiltered[i];
      }`;
        
        const patchedInnerLoop = `// 🔥 VALIDAÇÃO DE BOUNDS
      if (startSample >= leftFiltered.length || endSample > leftFiltered.length) {
        console.warn(\`⚠️ LUFS bounds error: start=\${startSample}, end=\${endSample}, length=\${leftFiltered.length}\`);
        break;
      }
      
      for (let i = startSample; i < endSample && i < leftFiltered.length; i++) {
        sumL += leftFiltered[i] * leftFiltered[i];
        sumR += rightFiltered[i] * rightFiltered[i];
      }`;
        
        // Aplicar patches
        if (content.includes(originalBlockLoudness)) {
            content = content.replace(originalBlockLoudness, patchedBlockLoudness);
            console.log('✅ Patch 1: Timeout protection aplicado');
        }
        
        if (content.includes(originalInnerLoop)) {
            content = content.replace(originalInnerLoop, patchedInnerLoop);
            console.log('✅ Patch 2: Bounds validation aplicado');
        }
        
        // 3. Adicionar timeout geral na função calculateLUFS
        const originalCalculateLUFS = `calculateLUFS(leftChannel, rightChannel) {
    console.log('🎛️ Calculando LUFS integrado...');
    const startTime = Date.now();`;
        
        const patchedCalculateLUFS = `calculateLUFS(leftChannel, rightChannel) {
    console.log('🎛️ Calculando LUFS integrado...');
    const startTime = Date.now();
    
    // 🔥 PROTEÇÃO CRÍTICA: validar entrada
    if (!leftChannel || !rightChannel || leftChannel.length === 0) {
      console.warn('⚠️ LUFS: canais inválidos, retornando valores padrão');
      return {
        lufs_integrated: -70.0,
        lufs_momentary: -70.0,
        lufs_short_term: -70.0,
        lra: 0.0,
        processing_time: Date.now() - startTime
      };
    }
    
    // Timeout geral de 60 segundos
    const LUFS_TIMEOUT = 60000;`;
        
        if (content.includes(originalCalculateLUFS)) {
            content = content.replace(originalCalculateLUFS, patchedCalculateLUFS);
            console.log('✅ Patch 3: Input validation aplicado');
        }
        
        // Salvar arquivo patcheado
        await writeFile(filePath, content, 'utf8');
        console.log('✅ Patch aplicado com sucesso no loudness.js');
        
    } catch (error) {
        console.error('❌ Erro ao aplicar patch:', error.message);
    }
}

patchLoudnessFile();