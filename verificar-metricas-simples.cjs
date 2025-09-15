const { Client } = require('pg');

async function verificar(jobId) {
    const client = new Client({
        connectionString: 'postgresql://postgres:SoundyAI2024@monorail.proxy.rlwy.net:47813/railway'
    });

    try {
        await client.connect();
        
        const result = await client.query('SELECT id, status, result FROM jobs WHERE id = $1', [jobId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Job não encontrado');
            return;
        }

        const job = result.rows[0];
        console.log(`✅ Job ${job.id}: ${job.status}`);
        
        if (job.result && typeof job.result === 'object') {
            console.log('\n🔍 Verificando métricas espectrais...');
            
            const resultado = job.result;
            
            // Verificar métricas específicas
            const metricas = [
                'spectralCentroidHz',
                'spectralRolloffHz', 
                'spectralFlatness',
                'bandEnergies',
                'frequenciaCentral',
                'limiteAgudos85'
            ];
            
            console.log('📊 Métricas encontradas:');
            metricas.forEach(metrica => {
                if (resultado[metrica] !== undefined) {
                    console.log(`✅ ${metrica}: ${JSON.stringify(resultado[metrica])}`);
                } else {
                    console.log(`❌ ${metrica}: ausente`);
                }
            });
            
            // Verificar se há dados de scoring
            if (resultado.scoring) {
                console.log('\n🎯 Informações de scoring:');
                console.log(`├─ Score total: ${resultado.scoring.totalScore}`);
                
                if (resultado.scoring.categories && resultado.scoring.categories.spectral) {
                    console.log(`├─ Score espectral: ${resultado.scoring.categories.spectral.score}`);
                    console.log(`├─ Peso espectral: ${resultado.scoring.categories.spectral.weight}`);
                } else {
                    console.log(`├─ ❌ Categoria spectral ausente no scoring`);
                }
            }
            
        } else {
            console.log('❌ Resultado não é um objeto válido');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

const jobId = process.argv[2] || 'a8aa91bb-95bb-4d09-afd5-0304179aa433';
verificar(jobId);