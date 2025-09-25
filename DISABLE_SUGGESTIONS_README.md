# FLAG DE DESATIVAÇÃO DE SUGESTÕES - DISABLE_SUGGESTIONS

## 📋 Como usar

### Para DESATIVAR as sugestões:
Adicione no arquivo `.env`:
```
DISABLE_SUGGESTIONS=true
```

### Para MANTER as sugestões ativas (padrão):
Não adicione nada no `.env` ou adicione:
```
DISABLE_SUGGESTIONS=false
```

## ⚡ Comportamento

### Quando ATIVO (padrão):
- Sistema V2 de sugestões roda normalmente
- JSON inclui problemsAnalysis completo
- Log: "[SUGGESTIONS] Ativas (V2 rodando normalmente)."

### Quando DESATIVO:
- Sistema V2 não é executado
- problemsAnalysis = null no resultado
- JSON final continua íntegro, mas sem sugestões
- Log: "[SUGGESTIONS] Desativadas via flag de ambiente."

## 🛡️ Segurança

✅ **Não afeta outras métricas** (LUFS, BPM, Key, etc.)
✅ **JSON não quebra** - campos ficam como arrays vazios ou null
✅ **Reversível** - basta mudar .env e reiniciar worker
✅ **Performance** - economiza 10-50ms quando desativado

## 🔧 Implementação

Arquivo modificado: `work/api/audio/core-metrics.js`
- Linha ~87: Constante DISABLE_SUGGESTIONS
- Linha ~330: Lógica condicional com logs
- Tratamento seguro de null em coreMetrics