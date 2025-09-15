// Verificar métricas espectrais específicas no job corrigido
import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function checkSpectralMetrics(jobId) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✅ Conectado ao PostgreSQL Railway");

  try {
    const result = await client.query(
      'SELECT result FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Job não encontrado');
      return;
    }
    
    const jobResult = result.rows[0].result;
    
    console.log('\n🔍 ANÁLISE DETALHADA DAS MÉTRICAS ESPECTRAIS:');
    console.log('='.repeat(60));
    
    // Métricas que o usuário quer:
    const targetMetrics = [
      'spectralCentroidHz',
      'spectralRolloffHz', 
      'spectralFlatness',
      'bandEnergies',
      'frequenciaCentral',
      'limiteAgudos85'
    ];
    
    console.log('📊 Métricas espectrais buscadas:');
    targetMetrics.forEach(metric => {
      const found = findMetricInResult(jobResult, metric);
      console.log(`├─ ${metric}: ${found ? '✅ ENCONTRADO' : '❌ AUSENTE'}`);
      if (found) {
        console.log(`│  └─ Valor: ${JSON.stringify(found)}`);
      }
    });
    
    console.log('\n🎯 Seções relevantes encontradas:');
    console.log(`├─ spectral.hasData: ${jobResult.spectral?.hasData || 'não encontrado'}`);
    console.log(`├─ spectralBands.hasData: ${jobResult.spectralBands?.hasData || 'não encontrado'}`);
    console.log(`├─ dominantFrequencies: ${JSON.stringify(jobResult.dominantFrequencies || 'não encontrado')}`);
    console.log(`└─ technicalData tem: ${Object.keys(jobResult.technicalData || {}).length} campos`);
    
    // Buscar por qualquer métrica espectral
    console.log('\n🔍 Busca ampla por métricas espectrais:');
    searchForSpectralTerms(jobResult, 'spectral');
    searchForSpectralTerms(jobResult, 'centroid');
    searchForSpectralTerms(jobResult, 'rolloff');
    searchForSpectralTerms(jobResult, 'flatness');
    searchForSpectralTerms(jobResult, 'band');
    
  } catch (error) {
    console.error('❌ Erro ao verificar métricas:', error);
  } finally {
    await client.end();
  }
}

function findMetricInResult(obj, metricName, path = '') {
  if (!obj || typeof obj !== 'object') return null;
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (key === metricName) {
      return { path: currentPath, value };
    }
    
    if (typeof value === 'object' && value !== null) {
      const found = findMetricInResult(value, metricName, currentPath);
      if (found) return found;
    }
  }
  
  return null;
}

function searchForSpectralTerms(obj, term, path = '', results = []) {
  if (!obj || typeof obj !== 'object') return results;
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (key.toLowerCase().includes(term.toLowerCase())) {
      results.push({ path: currentPath, key, value });
    }
    
    if (typeof value === 'object' && value !== null) {
      searchForSpectralTerms(value, term, currentPath, results);
    }
  }
  
  if (path === '') { // Root level, print results
    if (results.length > 0) {
      console.log(`├─ "${term}" encontrado em ${results.length} locais:`);
      results.forEach(r => console.log(`│  └─ ${r.path}: ${typeof r.value === 'object' ? '{...}' : r.value}`));
    } else {
      console.log(`├─ "${term}": ❌ não encontrado`);
    }
  }
  
  return results;
}

// Usar argumento da linha de comando ou ID do job corrigido
const jobId = process.argv[2] || 'ee32445a-3452-460d-950b-30a58a696dee';
checkSpectralMetrics(jobId);