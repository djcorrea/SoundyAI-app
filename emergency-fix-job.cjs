const { Client } = require('pg');

async function emergencyFix() {
    const client = new Client({
        connectionString: "postgresql://postgres.fbewbcutjgtvcsqmgkir:SoundyAI_Postgre_245@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
    });

    try {
        await client.connect();
        console.log('🚨 CORREÇÃO EMERGENCIAL - JOB TRAVADO');
        console.log('=====================================');

        // Marcar job específico como erro
        const jobId = 'a77b431f-264a-49f6-800a-9950af9d9a17';
        
        const updateResult = await client.query(`
            UPDATE jobs 
            SET status = 'error', 
                error = 'Arquivo causa travamento no pipeline - removido automaticamente',
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [jobId]);

        if (updateResult.rows.length > 0) {
            console.log('✅ Job marcado como erro:', jobId);
            console.log('📁 Arquivo:', updateResult.rows[0].file_key);
        } else {
            console.log('❌ Job não encontrado:', jobId);
        }

        // Verificar status final
        const statusResult = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM jobs 
            GROUP BY status 
            ORDER BY status
        `);

        console.log('\n📊 Status final dos jobs:');
        statusResult.rows.forEach(row => {
            console.log(`   - ${row.status}: ${row.count}`);
        });

        console.log('\n🎯 Sistema corrigido! Pode testar novamente.');

    } catch (error) {
        console.error('❌ Erro na correção:', error.message);
    } finally {
        await client.end();
    }
}

emergencyFix();
