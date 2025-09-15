import pkg from 'pg';
const { Client } = pkg;

async function verificarPostgreSQL(jobId) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SoundyAI2024@monorail.proxy.rlwy.net:47813/railway'
    });

    try {
        console.log('✅ Conectando ao PostgreSQL Railway...');
        await client.connect();
        console.log('✅ Conectado com sucesso!');

        // Buscar o job específico
        const query = 'SELECT id, status, result FROM jobs WHERE id = $1';
        const result = await client.query(query, [jobId]);

        if (result.rows.length === 0) {
            console.log('❌ Job não encontrado no banco');
            return;
        }

        const job = result.rows[0];
        console.log('\n🔍 JOB ENCONTRADO:');
        console.log(`├─ ID: ${job.id}`);
        console.log(`├─ Status: ${job.status}`);
        
        // Analisar o resultado
        if (!job.result) {
            console.log('❌ Resultado está vazio');
            return;
        }

        console.log('\n📊 ANÁLISE DO RESULTADO:');
        
        // Buscar métricas espectrais
        const result_data = job.result;
        console.log(`├─ Tamanho do JSON: ${JSON.stringify(result_data).length} caracteres`);
        
        // Verificar se contém as métricas solicitadas
        const metricas = [
            'spectralCentroidHz',
            'spectralRolloffHz', 
            'spectralFlatness',
            'bandEnergies',
            'frequenciaCentral',
            'limiteAgudos85'
        ];

        console.log('\n🎯 MÉTRICAS ESPECTRAIS:');
        let encontradas = 0;
        let total = metricas.length;

        for (const metrica of metricas) {
            const valor = buscarMetricaRecursivamente(result_data, metrica);
            if (valor !== null && valor !== undefined) {
                console.log(`├─ ✅ ${metrica}: ${JSON.stringify(valor)}`);
                encontradas++;
            } else {
                console.log(`├─ ❌ ${metrica}: AUSENTE`);
            }
        }

        console.log(`\n📈 RESULTADO FINAL: ${encontradas}/${total} métricas encontradas`);
        
        if (encontradas === total) {
            console.log('🎉 SUCESSO! Todas as métricas espectrais estão presentes no PostgreSQL!');
        } else {
            console.log('⚠️  Algumas métricas ainda estão ausentes');
            
            // Mostrar estrutura para debug
            console.log('\n🔧 ESTRUTURA DO RESULTADO (primeiros níveis):');
            mostrarEstrutura(result_data, '', 0, 2);
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
        console.log('🔌 Conexão encerrada');
    }
}

function buscarMetricaRecursivamente(obj, chave, caminho = '') {
    if (!obj || typeof obj !== 'object') return null;
    
    // Verificação direta
    if (obj.hasOwnProperty(chave)) {
        return obj[chave];
    }
    
    // Busca recursiva
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            const resultado = buscarMetricaRecursivamente(value, chave, caminho + key + '.');
            if (resultado !== null) return resultado;
        }
    }
    
    return null;
}

function mostrarEstrutura(obj, prefix = '', depth = 0, maxDepth = 2) {
    if (depth > maxDepth || !obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            console.log(`${prefix}├─ ${key}: {objeto}`);
            mostrarEstrutura(value, prefix + '│  ', depth + 1, maxDepth);
        } else {
            console.log(`${prefix}├─ ${key}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : value}`);
        }
    }
}

// Executar
const jobId = process.argv[2];
if (!jobId) {
    console.log('❌ Uso: node verificar-postgresql-final.js <JOB_ID>');
    process.exit(1);
}

verificarPostgreSQL(jobId);