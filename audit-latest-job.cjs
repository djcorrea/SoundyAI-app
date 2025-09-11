require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function auditLatestJob() {
  try {
    // Buscar o job mais recente que foi concluído
    const result = await pool.query(`
      SELECT id, status, result, error, file_key, created_at
      FROM jobs 
      WHERE status IN ('completed', 'done') 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const job = result.rows[0];
      console.log('🔍 AUDITORIA DO JOB MAIS RECENTE CONCLUÍDO:');
      console.log('==========================================');
      console.log('ID:', job.id);
      console.log('Status:', job.status);
      console.log('Arquivo:', job.file_key);
      console.log('Criado:', job.created_at);
      console.log('Erro:', job.error || 'nenhum');
      console.log('Resultado existe:', !!job.result);
      
      if (job.result) {
        const data = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
        
        console.log('\n📋 ESTRUTURA GERAL DO RESULTADO:');
        console.log('Keys principais:', Object.keys(data));
        console.log('Mode:', data.mode);
        console.log('Status:', data.status);
        console.log('Score geral:', data.overallScore || data.score);
        console.log('Classification:', data.classification);
        
        console.log('\n📊 MÉTRICAS TÉCNICAS DETALHADAS:');
        if (data.technicalData) {
          const td = data.technicalData;
          console.log('Keys em technicalData:', Object.keys(td));
          
          // Métricas principais
          console.log('\n🎚️ MÉTRICAS PRINCIPAIS:');
          console.log('  LUFS Integrated:', td.lufs_integrated || td.lufsIntegrated || 'AUSENTE');
          console.log('  LUFS Short Term:', td.lufs_short_term || td.lufsShortTerm || 'AUSENTE');
          console.log('  True Peak dBTP:', td.true_peak || td.truePeakDbtp || 'AUSENTE');
          console.log('  Dynamic Range:', td.dynamic_range || td.dynamicRange || 'AUSENTE');
          console.log('  Stereo Correlation:', td.stereo_correlation || td.stereoCorrelation || 'AUSENTE');
          
          // Análise espectral
          console.log('\n🌈 ANÁLISE ESPECTRAL:');
          console.log('  Spectral Balance existe:', !!td.spectral_balance);
          if (td.spectral_balance) {
            console.log('  Bandas em spectral_balance:', Object.keys(td.spectral_balance));
          }
          console.log('  Tonal Balance existe:', !!td.tonalBalance);
          if (td.tonalBalance) {
            console.log('  Bandas em tonalBalance:', Object.keys(td.tonalBalance));
          }
          console.log('  Dominant Frequencies:', td.dominantFrequencies?.length || 0);
          if (td.dominantFrequencies?.length > 0) {
            console.log('  Primeira freq dominante:', td.dominantFrequencies[0]);
          }
          
          // Outras métricas
          console.log('\n🔧 OUTRAS MÉTRICAS:');
          console.log('  Spectral Centroid:', td.spectral_centroid || 'AUSENTE');
          console.log('  Spectral Rolloff:', td.spectral_rolloff || 'AUSENTE');
          console.log('  MFCC Coefficients:', td.mfcc_coefficients?.length || 0);
          console.log('  Zero Crossing Rate:', td.zero_crossing_rate || 'AUSENTE');
        } else {
          console.log('❌ technicalData AUSENTE COMPLETAMENTE');
        }
        
        console.log('\n💡 SUGESTÕES E PROBLEMAS:');
        console.log('Suggestions count:', data.suggestions?.length || 0);
        if (data.suggestions?.length > 0) {
          console.log('Primeira sugestão:', data.suggestions[0]);
        }
        console.log('Problems count:', data.problems?.length || 0);
        if (data.problems?.length > 0) {
          console.log('Primeiro problema:', data.problems[0]);
        }
        
        console.log('\n⚡ PERFORMANCE:');
        if (data.performance) {
          console.log('Total Time:', data.performance.totalTimeMs || data.performance.workerTotalTimeMs, 'ms');
          console.log('Backend Phase:', data.performance.backendPhase);
          console.log('FFT Operations:', data.performance.fftOperations);
          console.log('Samples Processed:', data.performance.samplesProcessed);
        }
        
        console.log('\n🏷️ METADATA:');
        if (data.metadata) {
          console.log('Sample Rate:', data.metadata.sampleRate);
          console.log('Channels:', data.metadata.channels);
          console.log('Duration:', data.metadata.duration || data.metadata.durationSec);
          console.log('Pipeline Version:', data.metadata.pipelineVersion);
        }
        
      } else {
        console.log('❌ RESULTADO COMPLETAMENTE AUSENTE');
      }
    } else {
      console.log('❌ Nenhum job concluído encontrado');
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Erro na auditoria:', err.message);
    await pool.end();
  }
}

auditLatestJob();
