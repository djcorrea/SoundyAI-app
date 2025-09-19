const fs = require('fs');
const path = require('path');

// Verificar se há algum job recente com dados de True Peak
const workDir = path.join(__dirname, 'work', 'storage');

console.log('🔍 Procurando jobs recentes...');

try {
    const folders = fs.readdirSync(workDir).filter(f => 
        f.startsWith('job_') && fs.statSync(path.join(workDir, f)).isDirectory()
    );
    
    // Pegar o job mais recente
    const recentJob = folders
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(workDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time)[0];
    
    if (!recentJob) {
        console.log('❌ Nenhum job encontrado');
        process.exit(1);
    }
    
    console.log(`✅ Job mais recente: ${recentJob.name}`);
    
    const jobPath = path.join(workDir, recentJob.name);
    
    // Verificar arquivos no job
    const files = fs.readdirSync(jobPath);
    console.log(`📁 Arquivos no job:`, files);
    
    // Procurar por output.json
    const outputPath = path.join(jobPath, 'output.json');
    if (fs.existsSync(outputPath)) {
        const outputData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        
        console.log('\n🎯 TRUE PEAK DEBUG:');
        console.log('technicalData.truePeakDbtp:', outputData.technicalData?.truePeakDbtp);
        console.log('metrics.truePeakDbtp:', outputData.metrics?.truePeakDbtp);
        
        // Procurar qualquer campo que contenha "peak" ou "true"
        const searchInObject = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            Object.keys(obj).forEach(key => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                
                if (key.toLowerCase().includes('peak') || key.toLowerCase().includes('true')) {
                    console.log(`  📍 ${fullKey}:`, value);
                }
                
                if (typeof value === 'object' && value !== null) {
                    searchInObject(value, fullKey);
                }
            });
        };
        
        console.log('\n🔍 Todos os campos relacionados a Peak:');
        searchInObject(outputData);
        
        // Verificar estrutura completa de technicalData
        console.log('\n📊 Estrutura technicalData:');
        if (outputData.technicalData) {
            Object.keys(outputData.technicalData).forEach(key => {
                console.log(`  ${key}: ${outputData.technicalData[key]}`);
            });
        } else {
            console.log('  ❌ technicalData não existe');
        }
        
        // Verificar estrutura completa de metrics  
        console.log('\n📊 Estrutura metrics:');
        if (outputData.metrics) {
            Object.keys(outputData.metrics).forEach(key => {
                console.log(`  ${key}: ${outputData.metrics[key]}`);
            });
        } else {
            console.log('  ❌ metrics não existe');
        }
        
    } else {
        console.log('❌ output.json não encontrado');
        
        // Listar outros arquivos JSON
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        console.log('📄 Arquivos JSON encontrados:', jsonFiles);
        
        jsonFiles.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(jobPath, file), 'utf8'));
                console.log(`\n📄 ${file}:`);
                if (data.truePeak || data.truePeakDbtp) {
                    console.log('  ✅ Contém True Peak:', data.truePeak || data.truePeakDbtp);
                }
            } catch (e) {
                console.log(`  ❌ Erro lendo ${file}:`, e.message);
            }
        });
    }
    
} catch (error) {
    console.error('❌ Erro:', error.message);
}