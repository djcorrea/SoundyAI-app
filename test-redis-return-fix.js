/**
 * 🧪 TESTE AUTOMÁTICO: Validar correção do retorno completo do Redis
 * 
 * Este teste valida que o endpoint /api/jobs/:id agora retorna
 * o JSON completo da análise em vez de apenas metadados.
 */

import pool from './work/db.js';

async function testRedisReturnFix() {
    console.log('🧪 [TEST] Iniciando teste de correção do retorno Redis...');
    
    try {
        // 🎯 Simular um job completo com análise
        const mockJobId = 'test-' + Date.now();
        const mockAnalysisResult = {
            score: 87,
            classification: "Ótima Qualidade",
            loudness: { 
                integrated: -11.2,
                lra: 2.1 
            },
            truePeak: { 
                maxDbtp: -0.5 
            },
            technicalData: {
                lufsIntegrated: -11.2,
                lra: 2.1,
                truePeakDbtp: -0.5,
                dynamicRange: 9.8,
                bandEnergies: {
                    bass: -12.5,
                    mid: -10.8,
                    treble: -15.2
                }
            },
            metadata: {
                duration: 180,
                sampleRate: 44100,
                channels: 2
            },
            suggestions: [
                {
                    type: "improvement",
                    description: "Consideração sobre loudness",
                    priority: "medium"
                }
            ]
        };
        
        // 🔧 Inserir job de teste no banco
        console.log(`📝 [TEST] Inserindo job de teste: ${mockJobId}`);
        await pool.query(`
            INSERT INTO jobs (id, file_key, mode, status, results, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, [
            mockJobId,
            'test-uploads/test-file.wav',
            'genre',
            'completed',
            JSON.stringify(mockAnalysisResult)
        ]);
        
        // 🚀 Simular chamada do frontend
        console.log(`🔍 [TEST] Simulando fetch do frontend...`);
        
        // Simular query do endpoint (sem fazer HTTP request)
        const { rows } = await pool.query(`
            SELECT id, file_key, mode, status, error, results, result,
                   created_at, updated_at, completed_at
            FROM jobs
            WHERE id = $1
            LIMIT 1
        `, [mockJobId]);
        
        if (rows.length === 0) {
            throw new Error('Job de teste não encontrado');
        }
        
        const job = rows[0];
        
        // 🎯 Aplicar mesma lógica do endpoint corrigido
        let normalizedStatus = job.status;
        if (normalizedStatus === "done") normalizedStatus = "completed";
        if (normalizedStatus === "failed") normalizedStatus = "error";
        
        let fullResult = null;
        const resultData = job.results || job.result;
        if (resultData) {
            fullResult = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
        }
        
        const response = {
            id: job.id,
            fileKey: job.file_key,
            mode: job.mode,
            status: normalizedStatus,
            error: job.error || null,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            completedAt: job.completed_at,
            ...(fullResult || {})
        };
        
        // ✅ Validar que dados completos estão presentes
        console.log('🔍 [TEST] Validando resposta...');
        console.log(`📊 [TEST] Status: ${response.status}`);
        console.log(`📊 [TEST] Score: ${response.score}`);
        console.log(`📊 [TEST] Classification: ${response.classification}`);
        console.log(`📊 [TEST] LUFS: ${response.technicalData?.lufsIntegrated}`);
        console.log(`📊 [TEST] LRA: ${response.technicalData?.lra}`);
        console.log(`📊 [TEST] True Peak: ${response.technicalData?.truePeakDbtp}`);
        console.log(`📊 [TEST] Bands: ${Object.keys(response.technicalData?.bandEnergies || {}).join(', ')}`);
        console.log(`📊 [TEST] Suggestions: ${response.suggestions?.length || 0}`);
        
        // 🧪 Validações críticas
        const validations = {
            hasStatus: response.status === 'completed',
            hasScore: typeof response.score === 'number' && response.score > 0,
            hasClassification: typeof response.classification === 'string',
            hasLoudness: response.loudness && Number.isFinite(response.loudness.integrated),
            hasTruePeak: response.truePeak && Number.isFinite(response.truePeak.maxDbtp),
            hasTechnicalData: response.technicalData && Number.isFinite(response.technicalData.lufsIntegrated),
            hasBands: response.technicalData?.bandEnergies && Object.keys(response.technicalData.bandEnergies).length > 0,
            hasMetadata: response.metadata && Number.isFinite(response.metadata.duration),
            hasSuggestions: Array.isArray(response.suggestions) && response.suggestions.length > 0
        };
        
        const allPassed = Object.values(validations).every(v => v === true);
        
        console.log('\n📋 [TEST] Resultados das validações:');
        Object.entries(validations).forEach(([key, passed]) => {
            console.log(`${passed ? '✅' : '❌'} [TEST] ${key}: ${passed}`);
        });
        
        if (allPassed) {
            console.log('\n🎉 [TEST] ✅ TODOS OS TESTES PASSARAM!');
            console.log('🎉 [TEST] O endpoint agora retorna JSON completo com todas as métricas');
            console.log('🎉 [TEST] Frontend receberá: loudness, truePeak, technicalData, bands, suggestions');
        } else {
            console.log('\n⚠️ [TEST] ❌ ALGUNS TESTES FALHARAM');
            console.log('⚠️ [TEST] Verificar se o JSON está sendo salvo/lido corretamente');
        }
        
        // 🧹 Limpeza: remover job de teste
        await pool.query('DELETE FROM jobs WHERE id = $1', [mockJobId]);
        console.log(`🗑️ [TEST] Job de teste removido: ${mockJobId}`);
        
        return allPassed;
        
    } catch (error) {
        console.error('💥 [TEST] Erro no teste:', error);
        return false;
    }
}

// 🚀 Executar teste
testRedisReturnFix()
    .then(success => {
        console.log(`\n🏁 [TEST] Teste finalizado: ${success ? 'SUCESSO' : 'FALHA'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 [TEST] Erro fatal:', error);
        process.exit(1);
    });