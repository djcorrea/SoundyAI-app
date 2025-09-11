const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fbewbcutjgtvcsqmgkir.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZXdiY3V0amd0dmNzcW1na2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTE0OTIwMCwiZXhwIjoyMDQwNzI1MjAwfQ.0WN6WGVLJ5X1y7LJPSp5rWGLcO2E6vz8kfhvmzXP1qI'
);

async function fixStuckJob() {
    try {
        console.log('🚨 CORREÇÃO EMERGENCIAL - JOB TRAVADO');
        console.log('=====================================');

        const jobId = 'a77b431f-264a-49f6-800a-9950af9d9a17';
        
        // Marcar como erro
        const { data, error } = await supabase
            .from('jobs')
            .update({ 
                status: 'error',
                error: 'Arquivo causa travamento no pipeline - removido automaticamente',
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .select();

        if (error) {
            console.error('❌ Erro ao atualizar job:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('✅ Job marcado como erro:', jobId);
            console.log('📁 Arquivo:', data[0].file_key);
        } else {
            console.log('❌ Job não encontrado');
        }

        // Verificar status atual
        const { data: statusData, error: statusError } = await supabase
            .from('jobs')
            .select('status')
            .neq('status', null);

        if (statusError) {
            console.error('❌ Erro ao verificar status:', statusError);
            return;
        }

        const statusCount = {};
        statusData.forEach(job => {
            statusCount[job.status] = (statusCount[job.status] || 0) + 1;
        });

        console.log('\n📊 Status final dos jobs:');
        Object.entries(statusCount).forEach(([status, count]) => {
            console.log(`   - ${status}: ${count}`);
        });

        console.log('\n🎯 Sistema corrigido! Pode testar novamente.');

    } catch (error) {
        console.error('❌ Erro na correção:', error.message);
    }
}

fixStuckJob();
