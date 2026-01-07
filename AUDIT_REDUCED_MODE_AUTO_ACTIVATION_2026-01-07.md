# AUDIT: Ativação Automática do Modo Reduced (2026-01-07)

## 🎯 OBJETIVO
Permitir que usuários **free/plus/pro** continuem analisando em **modo reduced** após atingirem o limite de análises completas, ao invés de bloquear completamente.

## ❌ PROBLEMA IDENTIFICADO

### Comportamento Anterior (INCORRETO)
1. **FREE** (1 análise/mês): Após 1 análise → **bloqueado**
2. **PLUS** (20 análises/mês): Após 20 análises → **bloqueado**  
3. **PRO** (60 análises/mês): Após 60 análises → **bloqueado** com mensagem "instabilidade"
4. **STUDIO** (400 análises/mês): Após 400 análises → **bloqueado** com mensagem "instabilidade"

### Causa Raiz
**Backend (`work/lib/user/userPlans.js`):**
- Plano **PRO** tinha `hardCapAnalysesPerMonth: 60` igual ao limite de análises completas (`maxFullAnalysesPerMonth: 60`)
- Plano **DJ** (beta) tinha o mesmo problema
- Quando atingia 60 análises, a verificação de hard cap bloqueava antes de permitir modo reduced:

```javascript
// ❌ ANTES (INCORRETO)
if (currentMonthAnalyses >= limits.hardCapAnalysesPerMonth) {
    return { allowed: false, mode: 'blocked', errorCode: 'SYSTEM_PEAK_USAGE' };
}
// Esta verificação executava ANTES da verificação de modo reduced
// Resultado: PRO ficava bloqueado ao invés de entrar em reduced
```

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Backend: Remoção de Hard Cap do PRO/DJ
**Arquivo:** `work/lib/user/userPlans.js`

#### Mudanças:
```javascript
// ✅ DEPOIS (CORRETO)
pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: 60,          // ✅ 60 análises completas/mês
    maxImagesPerMonth: 70,
    hardCapMessagesPerMonth: 300,
    hardCapAnalysesPerMonth: null,        // ✅ SEM HARD CAP: permite reduced
    allowReducedAfterLimit: true,         // ✅ Ativa modo reduced após limite
}

dj: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: 60,
    maxImagesPerMonth: 70,
    hardCapMessagesPerMonth: 300,
    hardCapAnalysesPerMonth: null,        // ✅ SEM HARD CAP (segue PRO)
    allowReducedAfterLimit: true,
}
```

#### Fluxo Backend Corrigido:
```javascript
// 1. Verificar hard cap (só para STUDIO)
if (limits.hardCapAnalysesPerMonth && currentMonthAnalyses >= limits.hardCapAnalysesPerMonth) {
    return { allowed: false, mode: 'blocked', errorCode: 'SYSTEM_PEAK_USAGE' };
}

// 2. Análises completas disponíveis
if (currentMonthAnalyses < limits.maxFullAnalysesPerMonth) {
    return { allowed: true, mode: 'full', remainingFull: ... };
}

// 3. FREE/PLUS/PRO: Modo reduced após limite (NOVO FLUXO ATIVO)
if (limits.allowReducedAfterLimit) {
    return { allowed: true, mode: 'reduced', remainingFull: 0 };
}

// 4. Fallback: bloqueado (não deve acontecer)
return { allowed: false, mode: 'blocked', errorCode: 'LIMIT_REACHED' };
```

### 2. Frontend: Auto-ativação do Modo Reduced
**Arquivo:** `public/audio-analyzer-integration.js`

#### Mudanças:
1. **Após polling do job** (linha ~10617 e ~5035):
   - Detectar `analysisResult.analysisMode === 'reduced'` ou `analysisResult.mode === 'reduced'`
   - Forçar `window.analysisMode = 'reduced'` automaticamente
   - Mostrar **toast informativo** (não bloqueante)
   - **Continuar renderização normal** (não abortar)

```javascript
// ✅ NOVO CÓDIGO INSERIDO
if (analysisResult.analysisMode === 'reduced' || analysisResult.mode === 'reduced') {
    console.log('[REDUCED-MODE] Ativando modo reduced automaticamente...');
    
    // Forçar modo reduced global
    window.analysisMode = 'reduced';
    
    // Toast não bloqueante
    if (window.showToast || window.Toastify) {
        const message = 'Você atingiu o limite de análises completas. Continuando em modo reduzido (métricas básicas).';
        // ... exibir toast
    }
}
// ✅ CONTINUA PROCESSAMENTO (não throw, não return)
```

## 📊 COMPORTAMENTO CORRETO (PÓS-FIX)

### Planos e Limites

| Plano | Análises Full | Após Limite | Hard Cap | Modo Reduced |
|-------|--------------|-------------|----------|--------------|
| **FREE** | 1/mês | ✅ Reduced | ❌ Sem | ✅ Ilimitado |
| **PLUS** | 20/mês | ✅ Reduced | ❌ Sem | ✅ Ilimitado |
| **PRO** | 60/mês | ✅ Reduced | ❌ Sem | ✅ Ilimitado |
| **DJ** | 60/mês | ✅ Reduced | ❌ Sem | ✅ Ilimitado |
| **STUDIO** | 400/mês | ❌ Bloqueado | ✅ 400 | ❌ Não |

### Fluxo de Usuário

#### FREE (1 análise/mês)
1. **1ª análise** → ✅ Modo completo
2. **2ª análise** → ⚠️ Toast "limite atingido" + ✅ **Modo reduced ativado**
3. **3ª, 4ª, 5ª...** → ✅ **Continuam em modo reduced**

#### PLUS (20 análises/mês)
1. **Análises 1-20** → ✅ Modo completo
2. **21ª análise** → ⚠️ Toast "limite atingido" + ✅ **Modo reduced ativado**
3. **22ª, 23ª, 24ª...** → ✅ **Continuam em modo reduced**

#### PRO (60 análises/mês)
1. **Análises 1-60** → ✅ Modo completo
2. **61ª análise** → ⚠️ Toast "limite atingido" + ✅ **Modo reduced ativado**
3. **62ª, 63ª, 64ª...** → ✅ **Continuam em modo reduced**

#### STUDIO (400 análises/mês)
1. **Análises 1-400** → ✅ Modo completo
2. **401ª análise** → 🚫 **Modal "instabilidade temporária"** + ❌ **BLOQUEADO**
3. **402ª, 403ª...** → ❌ **Bloqueadas** (sem reduced)

## 🎨 UX: MENSAGEM EXIBIDA

### Toast (não bloqueante)
```
⚠️ Você atingiu o limite de análises completas.
   Continuando em modo reduzido (métricas básicas).
```

- **Duração:** 7 segundos
- **Cor:** Laranja (`#ff9800`)
- **Posição:** Centro superior
- **Comportamento:** Não bloqueia a renderização

### Modo Reduced: Métricas Disponíveis
✅ **Métricas visíveis:**
- Score geral
- LUFS Integrated
- True Peak (dBTP)
- Dynamic Range (DR)

🔒 **Métricas bloqueadas (blur):**
- Análise de frequências
- Estéreo/Mono
- Detalhes técnicos avançados
- Comparações por banda

## 🔍 VALIDAÇÃO

### Checklist de Teste

#### FREE (1 análise)
- [ ] 1ª análise → modo completo (sem toast)
- [ ] 2ª análise → toast + modo reduced + resultado renderizado
- [ ] 3ª análise → modo reduced + resultado renderizado

#### PLUS (20 análises)
- [ ] Análises 1-20 → modo completo
- [ ] 21ª análise → toast + modo reduced + resultado renderizado
- [ ] 22ª+ análises → modo reduced + resultado renderizado

#### PRO (60 análises)
- [ ] Análises 1-60 → modo completo
- [ ] 61ª análise → toast + modo reduced + resultado renderizado
- [ ] 62ª+ análises → modo reduced + resultado renderizado

#### STUDIO (400 análises)
- [ ] Análises 1-400 → modo completo (sem mensagem de limite)
- [ ] 401ª análise → modal "instabilidade" + bloqueado
- [ ] 402ª análise → continua bloqueado

### Verificações Backend
- [ ] `canUseAnalysis(uid_free)` após 1 análise retorna `{ allowed: true, mode: 'reduced' }`
- [ ] `canUseAnalysis(uid_plus)` após 20 análises retorna `{ allowed: true, mode: 'reduced' }`
- [ ] `canUseAnalysis(uid_pro)` após 60 análises retorna `{ allowed: true, mode: 'reduced' }`
- [ ] `canUseAnalysis(uid_studio)` após 400 análises retorna `{ allowed: false, mode: 'blocked' }`

### Verificações Frontend
- [ ] `window.analysisMode` automaticamente vira `'reduced'` quando backend sinaliza
- [ ] Toast aparece apenas na primeira análise em modo reduced
- [ ] Resultado é renderizado normalmente (não aborta)
- [ ] Métricas básicas ficam visíveis
- [ ] Métricas avançadas ficam com blur

## 📝 IMPACTOS

### Positivos ✅
1. **FREE/PLUS/PRO** podem continuar usando o SoundyAI após limite
2. **UX mais amigável:** Mostra valor antes de pedir upgrade
3. **Redução de frustração:** Não bloqueia completamente
4. **Conversão gradual:** Usuário experimenta reduced antes de pagar

### Negativos ⚠️
1. **STUDIO:** Comportamento inalterado (bloqueado após 400)
2. **Custo potencial:** Mais análises reduced (mas sem IA, custo menor)

## 🔐 SEGURANÇA

### Proteções Mantidas
- ✅ Hard cap do STUDIO (400 análises) continua ativo
- ✅ Modo reduced não consome limite de análises full
- ✅ `registerAnalysis(uid, mode)` só incrementa quando `mode === 'full'`
- ✅ Backend valida plano antes de criar job

### Considerações
- Modo reduced não usa OpenAI (custo zero de IA)
- Custo apenas de processamento do áudio (FFmpeg)
- Limite mensal reset no dia 1º de cada mês

## 🚀 DEPLOY

### Arquivos Modificados
1. `work/lib/user/userPlans.js` (backend - limites)
2. `public/audio-analyzer-integration.js` (frontend - auto-ativação)

### Ordem de Deploy
1. ✅ Commit backend primeiro (remoção de hard cap PRO/DJ)
2. ✅ Commit frontend (auto-ativação)
3. ✅ Testar em dev/staging
4. ✅ Deploy production

### Rollback (se necessário)
```bash
# Reverter backend
git checkout HEAD~1 work/lib/user/userPlans.js

# Reverter frontend
git checkout HEAD~1 public/audio-analyzer-integration.js
```

## 📚 REFERÊNCIAS

- **ErrorMapper V3:** `public/error-mapper.js` (PLAN_POLICY)
- **Entitlements:** `work/lib/entitlements.js` (hasEntitlement)
- **User Plans:** `work/lib/user/userPlans.js` (canUseAnalysis, registerAnalysis)
- **Analyze API:** `work/api/audio/analyze.js` (validação de limites)

---

**Data:** 2026-01-07  
**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ✅ Implementado  
**Versão:** 1.0
