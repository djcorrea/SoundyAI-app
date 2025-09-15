const { Client } = require('pg');

async function verificarResultado(jobId) {
    const client = new Client({
        connectionString: 'postgresql://postgres:SoundyAI2024@monorail.proxy.rlwy.net:47813/railway'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL');

        const result = await client.query('SELECT result FROM jobs WHERE id = $1', [jobId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Job não encontrado');
            return;
        }

        const dados = result.rows[0].result;
        
        console.log('\n🔍 VERIFICANDO MÉTRICAS ESPECTRAIS:');
        
        // Buscar métricas essenciais
        const metricas = {
            'spectralCentroidHz': buscar(dados, 'spectralCentroidHz'),
            'spectralRolloffHz': buscar(dados, 'spectralRolloffHz'),
            'spectralFlatness': buscar(dados, 'spectralFlatness'),
            'bandEnergies': buscar(dados, 'bandEnergies'),
            'frequenciaCentral': buscar(dados, 'frequenciaCentral'),
            'limiteAgudos85': buscar(dados, 'limiteAgudos85')
        };

        let encontradas = 0;
        Object.entries(metricas).forEach(([nome, valor]) => {
            if (valor !== null) {
                console.log(`✅ ${nome}: ${JSON.stringify(valor)}`);
                encontradas++;
            } else {
                console.log(`❌ ${nome}: AUSENTE`);
            }
        });

        console.log(`\n📊 RESULTADO: ${encontradas}/6 métricas encontradas`);
        
        if (encontradas === 6) {
            console.log('🎉 SUCESSO TOTAL! Todas as métricas estão no PostgreSQL!');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

function buscar(obj, chave) {
    if (!obj || typeof obj !== 'object') return null;
    
    if (obj[chave] !== undefined) return obj[chave];
    
    for (const valor of Object.values(obj)) {
        if (typeof valor === 'object' && valor !== null) {
            const resultado = buscar(valor, chave);
            if (resultado !== null) return resultado;
        }
    }
    
    return null;
}

const jobId = process.argv[2] || '2018ef1f-c840-416b-a69b-5548801a1cc5';
verificarResultado(jobId);