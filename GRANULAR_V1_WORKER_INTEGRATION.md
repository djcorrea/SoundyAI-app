# 🔗 Integração Worker - Granular V1

## 📋 OBJETIVO

Modificar `work/index.js` para carregar e passar a referência granular para o pipeline.

---

## 📝 CÓDIGO ATUAL vs MODIFICADO

### Antes (work/index.js - linha ~50)
```javascript
async function processAudioComplete(buffer, filename, reference = null) {
  console.log(`📊 Iniciando processamento completo: ${filename}`);
  
  const jobId = generateJobId();
  const startTime = Date.now();
  
  try {
    // Pipeline atual
    const result = await pipelineComplete.processAudio(buffer, {
      fileName: filename,
      jobId: jobId
    });
    
    return result;
  } catch (error) {
    console.error(`❌ Erro no processamento: ${error.message}`);
    throw error;
  }
}
```

### Depois (work/index.js - linha ~50)
```javascript
async function processAudioComplete(buffer, filename, reference = null) {
  console.log(`📊 Iniciando processamento completo: ${filename}`);
  
  const jobId = generateJobId();
  const startTime = Date.now();
  
  try {
    // Pipeline com suporte a referência granular
    const result = await pipelineComplete.processAudio(buffer, {
      fileName: filename,
      jobId: jobId,
      reference: reference // 🆕 GRANULAR V1: Passar referência
    });
    
    return result;
  } catch (error) {
    console.error(`❌ Erro no processamento: ${error.message}`);
    throw error;
  }
}
```

---

### Antes (work/index.js - linha ~120 - processJob)
```javascript
async function processJob(job) {
  console.log(`🎵 Processando job: ${job.id}`);
  
  try {
    // Download do arquivo
    const buffer = await downloadFromS3(job.file_path);
    
    // Processar
    const result = await processAudioComplete(buffer, job.file_name);
    
    // Atualizar banco
    await updateJobStatus(job.id, 'done', result);
    
  } catch (error) {
    console.error(`❌ Erro no job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed', { error: error.message });
  }
}
```

### Depois (work/index.js - linha ~120 - processJob)
```javascript
async function processJob(job) {
  console.log(`🎵 Processando job: ${job.id}`);
  
  try {
    // 🆕 GRANULAR V1: Carregar referência se engine ativo e gênero especificado
    let reference = null;
    const engine = process.env.ANALYZER_ENGINE || 'legacy';
    
    if (engine === 'granular_v1' && job.genre) {
      const referencePath = path.join(__dirname, '..', 'references', `${job.genre}.v1.json`);
      
      try {
        const referenceData = await fs.promises.readFile(referencePath, 'utf-8');
        reference = JSON.parse(referenceData);
        console.log(`✅ [GRANULAR] Referência carregada: ${job.genre}`);
        console.log(`📊 [GRANULAR] Bandas: ${reference.bands?.length || 0}, Grupos: ${Object.keys(reference.grouping || {}).length}`);
      } catch (err) {
        console.warn(`⚠️ [GRANULAR] Referência ${job.genre} não encontrada, usando legacy:`, err.message);
        // Continua sem referência (fallback automático para legacy no core-metrics)
      }
    } else {
      console.log(`📌 [GRANULAR] Engine: ${engine}, Genre: ${job.genre || 'não especificado'}, Referência: não carregada`);
    }
    
    // Download do arquivo
    const buffer = await downloadFromS3(job.file_path);
    
    // Processar com referência (se disponível)
    const result = await processAudioComplete(buffer, job.file_name, reference);
    
    // Atualizar banco
    await updateJobStatus(job.id, 'done', result);
    
  } catch (error) {
    console.error(`❌ Erro no job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed', { error: error.message });
  }
}
```

---

## 📦 IMPORTS NECESSÁRIOS

Adicionar no topo de `work/index.js`:

```javascript
import path from 'path';
import fs from 'fs';
```

Se já existirem, não precisa duplicar.

---

## 🗄️ ESTRUTURA DO JOB NO BANCO

Adicionar coluna `genre` na tabela `jobs` (se não existir):

```sql
ALTER TABLE jobs ADD COLUMN genre VARCHAR(50) DEFAULT NULL;
```

Ou, se preferir usar JSONB:
```sql
ALTER TABLE jobs ADD COLUMN metadata JSONB DEFAULT '{}';
-- Armazenar genre em: metadata->>'genre'
```

---

## 🎯 EXEMPLO DE JOB COM GÊNERO

### Criar job via API (frontend)
```javascript
// Frontend envia gênero junto com upload
const formData = new FormData();
formData.append('audio', file);
formData.append('genre', 'techno'); // 🆕 GRANULAR V1

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

### Endpoint de upload (api/upload.js ou similar)
```javascript
// Salvar gênero no job
const jobId = await db.query(`
  INSERT INTO jobs (file_path, file_name, genre, status, created_at)
  VALUES ($1, $2, $3, 'queued', NOW())
  RETURNING id
`, [s3Path, fileName, req.body.genre || null]);
```

---

## 🧪 TESTE DE INTEGRAÇÃO

### 1. Criar job manualmente no banco
```sql
-- Inserir job de teste com gênero techno
INSERT INTO jobs (file_path, file_name, genre, status, created_at)
VALUES ('test/techno-track.wav', 'techno-track.wav', 'techno', 'queued', NOW());
```

### 2. Configurar engine
```powershell
# .env
$envContent = @"
ANALYZER_ENGINE=granular_v1
"@
Set-Content -Path ".env" -Value $envContent
```

### 3. Rodar worker
```powershell
cd work
node index.js
```

### 4. Verificar logs esperados
```
📌 [GRANULAR] Engine: granular_v1, Genre: techno, Referência: carregando...
✅ [GRANULAR] Referência carregada: techno
📊 [GRANULAR] Bandas: 13, Grupos: 7
🎵 Processando job: 12345
🔍 [SPECTRAL_BANDS_CRITICAL] Início do cálculo: ...
🌈 [granular_spectral] analysis_start: {"frameCount":1028,"referenceBands":13,"genre":"techno"}
✅ [granular_bands] completed: {"subBandsCount":13,"suggestionsCount":3,"algorithm":"granular_v1"}
📊 Processamento completo em 8234ms
```

---

## 🔄 COMPATIBILIDADE COM REFERÊNCIAS DINÂMICAS

### Cache de referências (otimização opcional)
```javascript
// No topo do arquivo work/index.js
const referenceCache = new Map();

async function loadReference(genre) {
  // Verificar cache
  if (referenceCache.has(genre)) {
    console.log(`✅ [GRANULAR] Referência ${genre} carregada do cache`);
    return referenceCache.get(genre);
  }
  
  // Carregar do disco
  const referencePath = path.join(__dirname, '..', 'references', `${genre}.v1.json`);
  
  try {
    const referenceData = await fs.promises.readFile(referencePath, 'utf-8');
    const reference = JSON.parse(referenceData);
    
    // Validar estrutura básica
    if (!reference.bands || !Array.isArray(reference.bands)) {
      throw new Error('Estrutura de referência inválida: bands ausente');
    }
    if (!reference.grouping || typeof reference.grouping !== 'object') {
      throw new Error('Estrutura de referência inválida: grouping ausente');
    }
    
    // Armazenar no cache
    referenceCache.set(genre, reference);
    console.log(`✅ [GRANULAR] Referência ${genre} carregada e cacheada`);
    
    return reference;
  } catch (err) {
    console.warn(`⚠️ [GRANULAR] Erro ao carregar referência ${genre}:`, err.message);
    return null;
  }
}

// Uso no processJob:
if (engine === 'granular_v1' && job.genre) {
  reference = await loadReference(job.genre);
}
```

---

## 🚨 TRATAMENTO DE ERROS

### Cenário 1: Gênero não especificado
```javascript
if (engine === 'granular_v1' && !job.genre) {
  console.log(`📌 [GRANULAR] Job sem gênero especificado, usando legacy`);
  // reference permanece null → fallback automático
}
```

### Cenário 2: Referência não encontrada
```javascript
try {
  reference = await loadReference(job.genre);
} catch (err) {
  console.warn(`⚠️ [GRANULAR] Referência ${job.genre} não encontrada:`, err.message);
  // reference = null → fallback automático
}
```

### Cenário 3: Referência corrompida
```javascript
try {
  const referenceData = await fs.promises.readFile(referencePath, 'utf-8');
  reference = JSON.parse(referenceData);
  
  // Validar estrutura crítica
  if (!reference.bands || !Array.isArray(reference.bands) || reference.bands.length === 0) {
    throw new Error('Estrutura inválida: bands ausente ou vazio');
  }
  
} catch (err) {
  console.error(`❌ [GRANULAR] Referência ${job.genre} corrompida:`, err.message);
  // reference = null → fallback automático
}
```

---

## 📊 LOGGING AVANÇADO

### Adicionar logs detalhados no worker:
```javascript
async function processJob(job) {
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎵 JOB ${job.id} - ${job.file_name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📌 Engine: ${process.env.ANALYZER_ENGINE || 'legacy'}`);
  console.log(`📌 Genre: ${job.genre || 'não especificado'}`);
  
  try {
    // Carregar referência
    let reference = null;
    const engine = process.env.ANALYZER_ENGINE || 'legacy';
    
    if (engine === 'granular_v1' && job.genre) {
      console.log(`🔍 [GRANULAR] Carregando referência: ${job.genre}`);
      const refStartTime = Date.now();
      
      reference = await loadReference(job.genre);
      
      const refLoadTime = Date.now() - refStartTime;
      
      if (reference) {
        console.log(`✅ [GRANULAR] Referência carregada em ${refLoadTime}ms`);
        console.log(`   └─ Bandas: ${reference.bands?.length || 0}`);
        console.log(`   └─ Grupos: ${Object.keys(reference.grouping || {}).length}`);
        console.log(`   └─ Schema: v${reference.schemaVersion || '?'}`);
      } else {
        console.log(`⚠️ [GRANULAR] Falha ao carregar referência, usando legacy`);
      }
    } else {
      console.log(`📌 [GRANULAR] Referência não solicitada (engine=${engine}, genre=${job.genre || 'null'})`);
    }
    
    // Download
    console.log(`\n📥 Baixando arquivo de S3...`);
    const downloadStartTime = Date.now();
    const buffer = await downloadFromS3(job.file_path);
    const downloadTime = Date.now() - downloadStartTime;
    console.log(`✅ Download completo em ${downloadTime}ms (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    
    // Processar
    console.log(`\n⚙️ Processando áudio...`);
    const processingStartTime = Date.now();
    const result = await processAudioComplete(buffer, job.file_name, reference);
    const processingTime = Date.now() - processingStartTime;
    console.log(`✅ Processamento completo em ${processingTime}ms`);
    
    // Resultado
    console.log(`\n📊 Resultado:`);
    console.log(`   └─ Score: ${result.score}`);
    console.log(`   └─ Classification: ${result.classification}`);
    console.log(`   └─ Engine: ${result.engineVersion || 'legacy'}`);
    
    if (result.engineVersion === 'granular_v1') {
      console.log(`   └─ Sub-bandas: ${result.granular?.length || 0}`);
      console.log(`   └─ Sugestões: ${result.suggestions?.length || 0}`);
    }
    
    // Atualizar banco
    await updateJobStatus(job.id, 'done', result);
    
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Job ${job.id} concluído em ${totalTime}ms`);
    console.log(`${'='.repeat(80)}\n`);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n❌ Erro no job ${job.id} após ${totalTime}ms:`, error);
    console.error(`   └─ Message: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack?.split('\n')[0] || 'N/A'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    await updateJobStatus(job.id, 'failed', { error: error.message });
  }
}
```

---

## ✅ CHECKLIST DE INTEGRAÇÃO

### Código
- [ ] Adicionar imports `path` e `fs` em `work/index.js`
- [ ] Modificar `processAudioComplete()` para aceitar `reference`
- [ ] Adicionar lógica de carregamento de referência em `processJob()`
- [ ] Passar `reference` na chamada de `processAudioComplete()`
- [ ] Adicionar logs detalhados para debugging

### Banco de Dados
- [ ] Adicionar coluna `genre` na tabela `jobs` (ou usar JSONB)
- [ ] Atualizar queries de inserção para incluir `genre`
- [ ] Migrar jobs existentes (se necessário)

### Arquivos
- [ ] Verificar que `references/techno.v1.json` existe
- [ ] Validar estrutura do JSON de referência
- [ ] Criar referências para outros gêneros (opcional)

### Testes
- [ ] Testar job com genre=techno → deve usar granular_v1
- [ ] Testar job sem genre → deve usar legacy
- [ ] Testar job com genre inexistente → deve fazer fallback para legacy
- [ ] Testar com ANALYZER_ENGINE=legacy → sempre legacy

---

## 🔄 ROLLBACK

Se algo der errado após a integração:

```powershell
# 1. Desativar granular imediatamente
$envContent = @"
ANALYZER_ENGINE=legacy
"@
Set-Content -Path ".env" -Value $envContent

# 2. Reiniciar workers
# Ctrl+C e rodar novamente

# 3. Verificar que jobs continuam sendo processados normalmente
```

---

**Data**: 16 de outubro de 2025  
**Versão**: granular_v1 - Integração Worker
