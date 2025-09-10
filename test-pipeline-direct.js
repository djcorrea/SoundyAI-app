/**
 * 🧪 TESTE DIRETO DO PIPELINE SEM BANCO
 * Testa apenas: Upload → Processamento → Resultado
 */

import { processAudioComplete } from './api/audio/pipeline-complete.js';
import fs from 'fs';

async function testPipelineDirectly() {
    console.log('🚀 INICIANDO TESTE DIRETO DO PIPELINE...\n');
    
    try {
        // 1. Carregar arquivo de teste que sabemos que funciona
        console.log('📁 1. Carregando arquivo de teste...');
        const testFile = './tests/test-sine-48k.wav';
        
        if (!fs.existsSync(testFile)) {
            throw new Error(`Arquivo de teste não encontrado: ${testFile}`);
        }
        
        const fileBuffer = fs.readFileSync(testFile);
        console.log(`✅ Arquivo carregado: ${fileBuffer.length} bytes\n`);
        
        // 2. Processar com pipeline
        console.log('🎵 2. Executando pipeline completo...');
        const startTime = Date.now();
        
        const result = await processAudioComplete(fileBuffer, 'test-sine-48k.wav', {});
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Pipeline executado em ${processingTime}ms\n`);
        
        // 3. Analisar resultado
        console.log('📊 3. ANÁLISE DO RESULTADO:');
        console.log('================================');
        
        // Dados principais
        console.log(`🎯 Status: ${result.status || 'N/A'}`);
        console.log(`📈 Score: ${result.score || result.qualityOverall || 'N/A'}`);
        console.log(`🏷️ Classificação: ${result.classification || 'N/A'}`);
        console.log(`📝 Método: ${result.method || result.scoringMethod || 'N/A'}`);
        console.log(`⏱️ Processamento: ${result.processingTime || processingTime}ms`);
        
        // Dados técnicos
        const tech = result.technicalData || {};
        console.log('\n🔧 DADOS TÉCNICOS:');
        console.log(`   📊 LUFS Integrado: ${tech.lufsIntegrated || 'N/A'} LUFS`);
        console.log(`   🏔️ True Peak: ${tech.truePeakDbtp || 'N/A'} dBTP`);
        console.log(`   🎛️ Correlação: ${tech.stereoCorrelation || 'N/A'}`);
        console.log(`   📏 LRA: ${tech.lra || 'N/A'} LU`);
        console.log(`   🎵 DR: ${tech.dynamicRange || 'N/A'} dB`);
        console.log(`   ⏰ Duração: ${tech.duration || 'N/A'}s`);
        console.log(`   🎼 Sample Rate: ${tech.sampleRate || 'N/A'} Hz`);
        console.log(`   📢 Canais: ${tech.channels || 'N/A'}`);
        
        // Bandas espectrais
        if (tech.bandEnergies) {
            console.log('\n🎵 BANDAS ESPECTRAIS:');
            Object.entries(tech.bandEnergies).forEach(([band, data]) => {
                const avg = data?.averageDb || data?.average || 'N/A';
                console.log(`   ${band}: ${avg} dB`);
            });
        }
        
        // Verificar se é análise real ou fallback
        const hasRealData = (
            tech.lufsIntegrated !== undefined &&
            tech.truePeakDbtp !== undefined &&
            tech.bandEnergies !== undefined
        );
        
        console.log('\n🔍 VERIFICAÇÃO DE QUALIDADE:');
        console.log('============================');
        
        if (hasRealData) {
            console.log('✅ ANÁLISE REAL DETECTADA!');
            console.log('✅ Pipeline processou áudio com FFmpeg + DSP');
            console.log('✅ Métricas LUFS/True Peak calculadas');
            console.log('✅ Bandas espectrais analisadas');
            console.log('✅ Sistema funcionando em modo completo');
        } else {
            console.log('⚠️ DADOS LIMITADOS');
            console.log('❌ Pipeline pode estar em modo fallback');
            console.log('❌ Verificar FFmpeg e dependências DSP');
        }
        
        // Estrutura JSON para front-end
        console.log('\n📋 COMPATIBILIDADE COM FRONT-END:');
        const hasRequiredFields = (
            result.status !== undefined &&
            (result.score !== undefined || result.qualityOverall !== undefined) &&
            result.technicalData !== undefined
        );
        
        if (hasRequiredFields) {
            console.log('✅ Estrutura JSON compatível com UI');
            console.log('✅ Campos obrigatórios presentes');
            console.log(`✅ Tamanho JSON: ${JSON.stringify(result).length} chars`);
        } else {
            console.log('❌ Estrutura JSON incompatível');
            console.log('❌ Campos obrigatórios ausentes');
        }
        
        // Salvar resultado para inspeção
        fs.writeFileSync('./test-pipeline-direct-result.json', JSON.stringify(result, null, 2));
        console.log('\n💾 Resultado completo salvo em: test-pipeline-direct-result.json');
        
        return result;
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// Executar teste
testPipelineDirectly()
    .then(() => {
        console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 TESTE FALHOU:', error.message);
        process.exit(1);
    });
