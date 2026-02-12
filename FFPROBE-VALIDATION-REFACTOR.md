# AutoMaster V1 - Refatoração de Validação com FFProbe

## 🎯 PROBLEMA RESOLVIDO

A validação anterior usando `file-type` (MIME detection) estava **rejeitando arquivos WAV PCM 24-bit válidos** exportados de DAWs profissionais. Isso era causado por variações nos headers WAV que não afetam a validade do áudio, mas confundiam a detecção de MIME type.

---

## ✅ SOLUÇÃO IMPLEMENTADA

**Validação determinística via FFProbe** - método usado por profissionais de áudio.

### Mudanças Realizadas

#### 1. **`services/audio-validator.cjs`** - REFATORADO COMPLETO

**Removido:**
- ❌ `require('file-type')`
- ❌ `validateMimeType()` - detecção de MIME
- ❌ `validateWavHeader()` - validação binária de header
- ❌ Validação baseada em buffer

**Adicionado:**
- ✅ `validateAudioWithFFProbe()` - validação via ffprobe JSON output
- ✅ `validateWavExtension()` - validação simples de extensão
- ✅ Validação de codec PCM (pcm_s16le, pcm_s24le, pcm_s32le, etc)
- ✅ Validação de sample rate (>= 44100 Hz)
- ✅ Validação de channels (>= 1)
- ✅ Validação de duração (via ffprobe format.duration)
- ✅ Metadata retornado para debug

**Nova assinatura:**
```javascript
// Antes (baseado em buffer)
validateAudioFile(buffer, filePath)

// Agora (baseado em arquivo)
validateAudioFile(filePath, originalName, fileSize)
```

**Exemplo de retorno:**
```javascript
{
  valid: true,
  errors: [],
  metadata: {
    codec: "pcm_s24le",
    sample_rate: 48000,
    channels: 2,
    duration: 180.5,
    bit_depth: 24
  }
}
```

---

#### 2. **`api/upload-route.cjs`** - REFATORADO

**Mudanças principais:**

**Multer Storage:**
```javascript
// Antes: Memory storage
multer.memoryStorage()

// Agora: Disk storage temporário
multer.diskStorage({
  destination: TMP_UPLOAD_DIR, // tmp/uploads/
  filename: `${uuid}-${timestamp}.wav`
})
```

**Fluxo de validação:**
```javascript
// 1. Upload para tmp/uploads/
const tmpFilePath = req.file.path;

// 2. Validar com ffprobe
const validation = await audioValidator.validateAudioFile(
  tmpFilePath,
  req.file.originalname,
  req.file.size
);

// 3. Se válido: ler buffer e enviar para R2/S3
const fileBuffer = await fs.readFile(tmpFilePath);
await storageService.uploadInput(fileBuffer, jobId);

// 4. Deletar arquivo temporário
await fs.unlink(tmpFilePath);
```

**Cleanup garantido:**
- ✅ Arquivo temporário deletado após upload para storage
- ✅ Cleanup em caso de erro de validação
- ✅ Cleanup em caso de limite de jobs excedido
- ✅ Cleanup em caso de erro de storage

---

#### 3. **`package.json`** - ATUALIZADO

**Removido:**
- ❌ `"file-type": "^18.5.0"`

**Mantido:**
- ✅ `ffprobe-static` - já estava instalado
- ✅ Todas as outras dependências

---

## 🔬 VALIDAÇÃO TÉCNICA

### O que é validado via FFProbe

```bash
ffprobe -v error -print_format json -show_streams -show_format arquivo.wav
```

**Output JSON:**
```json
{
  "streams": [
    {
      "codec_type": "audio",
      "codec_name": "pcm_s24le",
      "sample_rate": "48000",
      "channels": 2,
      "bits_per_raw_sample": "24"
    }
  ],
  "format": {
    "duration": "180.5"
  }
}
```

**Validações aplicadas:**
1. ✅ `streams.length > 0` - arquivo contém streams
2. ✅ `codec_type === "audio"` - existe stream de áudio
3. ✅ `codec_name.startsWith("pcm_")` - codec PCM válido
4. ✅ `sample_rate >= 44100` - sample rate profissional
5. ✅ `channels >= 1` - ao menos 1 canal
6. ✅ `duration <= MAX_DURATION_MINUTES * 60` - dentro do limite

---

## 🎛️ Suporte a Formatos

### ✅ Aceitos (PCM WAV)

| Bit Depth | Codec | Exemplo |
|-----------|-------|---------|
| 16-bit | `pcm_s16le` | WAV padrão CD quality |
| 24-bit | `pcm_s24le` | Export de DAWs profissionais |
| 32-bit | `pcm_s32le` | High-end audio interfaces |
| 32-bit float | `pcm_f32le` | Pro Tools, Logic, Ableton |

**Sample rates aceitos:**
- 44100 Hz (CD quality)
- 48000 Hz (Pro audio standard)
- 88200 Hz, 96000 Hz (High resolution)
- 176400 Hz, 192000 Hz (Ultra high resolution)

**Channels aceitos:**
- Mono (1 channel)
- Stereo (2 channels)
- Multicanal (> 2 channels)

---

### ❌ Rejeitados

| Formato | Razão |
|---------|-------|
| MP3 renomeado para .wav | Codec não é PCM (`mp3` detectado) |
| AAC renomeado para .wav | Codec não é PCM (`aac` detectado) |
| Arquivo corrompido | ffprobe falha |
| WAV não-PCM (ADPCM, etc) | Codec não começa com `pcm_` |
| Sample rate < 44100 Hz | Qualidade muito baixa |
| Arquivo sem stream de áudio | Metadados corrompidos |
| Duração > 15 minutos | Excede limite configurado |

---

## 🧪 TESTES

### Teste 1: WAV PCM 24-bit (deve aceitar)

```bash
# Criar WAV 24-bit com ffmpeg
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" \
  -c:a pcm_s24le -ar 48000 test-24bit.wav

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test-24bit.wav" \
  -F "mode=BALANCED"
```

**Esperado:**
```json
{
  "success": true,
  "jobId": "...",
  "status": "queued"
}
```

**Log do servidor:**
```json
{
  "level": "info",
  "msg": "Arquivo validado com sucesso",
  "metadata": {
    "codec": "pcm_s24le",
    "sample_rate": 48000,
    "channels": 1,
    "duration": 5.0,
    "bit_depth": 24
  }
}
```

---

### Teste 2: MP3 renomeado (deve rejeitar)

```bash
# Criar MP3 e renomear
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" fake.mp3
mv fake.mp3 fake.wav

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@fake.wav" \
  -F "mode=BALANCED"
```

**Esperado:**
```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": [
    "Invalid codec: mp3 (only PCM supported)"
  ]
}
```

---

### Teste 3: WAV com sample rate baixo (deve rejeitar)

```bash
# Criar WAV 22050 Hz
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" \
  -c:a pcm_s16le -ar 22050 test-lowrate.wav

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test-lowrate.wav" \
  -F "mode=BALANCED"
```

**Esperado:**
```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": [
    "Invalid sample rate: 22050 Hz (minimum 44100 Hz)"
  ]
}
```

---

### Teste 4: WAV muito longo (deve rejeitar)

```bash
# Criar WAV de 20 minutos (limite é 15)
ffmpeg -f lavfi -i "sine=frequency=440:duration=1200" \
  -c:a pcm_s16le -ar 44100 test-long.wav

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test-long.wav" \
  -F "mode=BALANCED"
```

**Esperado:**
```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": [
    "Duration exceeds 15 minutes (actual: 20m 0s)"
  ]
}
```

---

### Teste 5: Arquivo corrompido (deve rejeitar)

```bash
# Criar arquivo corrompido
dd if=/dev/urandom of=corrupt.wav bs=1024 count=100

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@corrupt.wav" \
  -F "mode=BALANCED"
```

**Esperado:**
```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": [
    "Audio validation failed: Invalid data found when processing input"
  ]
}
```

---

## 📊 COMPARAÇÃO: ANTES vs AGORA

| Aspecto | Antes (file-type) | Agora (ffprobe) |
|---------|-------------------|-----------------|
| **Método** | Detecção de MIME type | Análise técnica de áudio |
| **Precisão** | Baixa (falsos negativos) | Alta (determinístico) |
| **PCM 24-bit** | ❌ Rejeitado incorretamente | ✅ Aceito corretamente |
| **MP3 fake** | ✅ Rejeitado | ✅ Rejeitado |
| **Sample rate** | ❌ Não validado | ✅ Validado (>= 44100) |
| **Codec** | ❌ Não validado | ✅ Validado (PCM apenas) |
| **Metadata** | ❌ Não retornado | ✅ Retornado para debug |
| **Performance** | Rápido (buffer scan) | Rápido (ffprobe otimizado) |

---

## 🔐 SEGURANÇA

### Mantido (ainda protegido)

- ✅ Rate limiting (10 uploads/hora)
- ✅ Limite de jobs por usuário (3 simultâneos)
- ✅ Validação de extensão `.wav`
- ✅ Validação de tamanho (120MB)
- ✅ Timeout de validação
- ✅ Cleanup de arquivos temporários
- ✅ Nenhuma shell injection (usa execFile com args separados)

### Melhorado

- ✅ **Validação mais precisa** - não rejeita arquivos válidos
- ✅ **Metadata para auditoria** - codec, sample rate, bit depth logados
- ✅ **Mensagens de erro claras** - usuário sabe exatamente o problema

---

## 🚀 DEPLOY

### Sem mudanças no deploy

- ✅ Worker **NÃO MODIFICADO**
- ✅ Master pipeline **NÃO MODIFICADO**
- ✅ Core DSP **NÃO MODIFICADO**
- ✅ Storage service **NÃO MODIFICADO**
- ✅ Queue system **NÃO MODIFICADO**

### Apenas mudanças na API

1. **Remover dependência:**
```bash
npm uninstall file-type
```

2. **Garantir ffprobe instalado:**
```bash
ffprobe -version
# Já está instalado via ffprobe-static
```

3. **Criar diretório temporário:**
```bash
mkdir -p tmp/uploads
```

4. **Restart API:**
```bash
node api/server.cjs
```

---

## 📝 CHANGELOG

### v3.0.0 - FFProbe Validation

**Breaking Changes:**
- ❌ Removido `file-type` dependency
- ✅ Agora aceita WAV PCM 24-bit (antes rejeitado incorretamente)

**New Features:**
- ✅ Validação via ffprobe (determinística)
- ✅ Metadata de áudio retornado
- ✅ Suporte completo a PCM 16/24/32-bit
- ✅ Validação de sample rate e channels
- ✅ Mensagens de erro detalhadas

**Non-Breaking:**
- ✅ API endpoint **NÃO MUDOU**
- ✅ Response format **NÃO MUDOU**
- ✅ Worker **NÃO MUDOU**
- ✅ Core DSP **NÃO MUDOU**

---

## 🐛 TROUBLESHOOTING

### "ffprobe not found"

**Problema:** ffprobe não está instalado.

**Solução:**
```bash
# Verificar instalação
npm list ffprobe-static

# Reinstalar se necessário
npm install ffprobe-static
```

---

### "Invalid codec: mp2 (only PCM supported)"

**Problema:** Arquivo WAV usa codec MP2/MP3 ao invés de PCM.

**Solução:** Converter para PCM:
```bash
ffmpeg -i input.wav -c:a pcm_s16le output.wav
```

---

### "Invalid sample rate: 8000 Hz"

**Problema:** Sample rate muito baixo para áudio profissional.

**Solução:** Resample para 44100+ Hz:
```bash
ffmpeg -i input.wav -ar 44100 output.wav
```

---

### Arquivo temporário não deletado

**Problema:** Erro durante validação ou upload deixou arquivo em `tmp/uploads/`.

**Limpeza manual:**
```bash
rm tmp/uploads/*
```

**Prevenção:** O código tem cleanup em todos os caminhos (success, erro, exceção).

---

## ✅ CHECKLIST FINAL

### Implementação

- [x] `audio-validator.cjs` refatorado completamente
- [x] `upload-route.cjs` refatorado para usar ffprobe
- [x] `file-type` removido do package.json
- [x] Validação determinística via ffprobe implementada
- [x] Cleanup de arquivos temporários garantido
- [x] Logs estruturados com metadata
- [x] Comentário explicativo adicionado nos arquivos

### Garantias

- [x] Worker NÃO modificado
- [x] Master pipeline NÃO modificado
- [x] Core DSP NÃO modificado
- [x] Storage service NÃO modificado
- [x] Arquitetura da fila NÃO modificada
- [x] API endpoint signature NÃO mudou
- [x] Response format NÃO mudou

### Validações

- [x] Extensão `.wav` validada
- [x] Tamanho <= 120MB validado
- [x] Codec PCM validado
- [x] Sample rate >= 44100 validado
- [x] Channels >= 1 validado
- [x] Duração <= 15min validada
- [x] MP3 fake rejeitado
- [x] Arquivo corrompido rejeitado
- [x] WAV PCM 24-bit aceito ✅

### Segurança

- [x] Rate limiting mantido
- [x] Limite de jobs mantido
- [x] Cleanup de temporários garantido
- [x] Nenhuma shell injection
- [x] Timeout de validação
- [x] Mensagens de erro não expõem sistema

---

## 📈 RESULTADO

**Sistema agora aceita:**
- ✅ WAV PCM 16-bit (44100+ Hz)
- ✅ WAV PCM 24-bit (44100+ Hz) ← ANTES REJEITADO
- ✅ WAV PCM 32-bit (44100+ Hz)
- ✅ WAV PCM 32-bit float (44100+ Hz)
- ✅ Exports de Pro Tools, Logic, Ableton, Reaper, etc

**Sistema continua rejeitando:**
- ❌ MP3 renomeado para .wav
- ❌ AAC renomeado para .wav
- ❌ Arquivos corrompidos
- ❌ Sample rate < 44100 Hz
- ❌ Duração > 15 minutos
- ❌ Arquivos > 120MB

---

**SoundyAI Engineering • 2026**
