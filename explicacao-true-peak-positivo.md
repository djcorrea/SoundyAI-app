# Por que True Peak pode ser POSITIVO?

## Conceito Fundamental

**Sample Peak**: Máximo valor das amostras = sempre ≤ 0 dBFS  
**True Peak**: Pico real da onda reconstruída = **PODE SER > 0 dBTP**

## Exemplo Prático

```
Amostras digitais:  [0.9, 0.8, 0.9] 
Sample Peak:        0.9 = -0.9 dBFS

Interpolação entre amostras:
     0.9 ——————— 1.2 ——————— 0.8 ——————— 1.1 ——————— 0.9
                 ↑                       ↑
            True Peak = 1.2          True Peak = 1.1
            = +1.6 dBTP             = +0.8 dBTP
```

## Quando acontece?

### 1. **Funk/Bass pesado**: 
- Limiters agressivos criam "intersample peaks"
- Frequências graves geram overshoots na reconstrução

### 2. **Música eletrônica moderna**:
- Mastering "loudness war" empurra tudo ao limite
- Brick wall limiters causam overshoot entre amostras

### 3. **Áudio clipado/distorcido**:
- Clipping digital gera harmônicos que "vazam" entre amostras

## Padrão ITU-R BS.1770-4

O FFmpeg com `ebur128=peak=true` implementa o padrão oficial que:
- Faz oversampling 4x (192kHz para 48kHz)
- Calcula o pico real da onda reconstruída
- **Reporta valores REAIS**, incluindo positivos

## Valores Típicos

- **Música clássica**: -6 a -3 dBTP
- **Pop/Rock**: -1 a +0.5 dBTP  
- **EDM/Funk moderno**: +0.5 a +3 dBTP ⚠️
- **Áudio clipado**: +3 a +6 dBTP 🚨

## Conclusão

True Peak positivo = **Áudio realmente problemático**
- Causa distorção em DACs
- Problemas em streaming (Spotify, Apple Music)
- Clipping em sistemas analógicos

**Agora o SoundyAI detecta isso corretamente!** 🎯