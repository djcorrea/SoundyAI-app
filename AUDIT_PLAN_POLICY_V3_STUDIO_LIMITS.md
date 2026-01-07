# 🎯 AUDIT: Plan Policy V3 - Studio "Ilimitado" com Hardcap Oculto

**Data:** 2026-01-06
**Status:** ✅ IMPLEMENTADO

---

## 📋 RESUMO DO PROBLEMA

### Comportamento Errado (Antes)
1. **Studio mostrava "20 mensagens"** - Fallback errado para `PLAN_CONFIG.free`
2. **Studio mostrava "limite atingido"** - Deveria mostrar "alta demanda"
3. **Todos os planos tratados igual** - Sem distinção de policy por plano

### Regras de Negócio Solicitadas
- **Studio é vendido como "ilimitado"** com hardcap oculto (400 chat, 400 análises)
- **NUNCA mostrar números, limites ou "renova em"** para Studio
- **Ao bater hardcap do Studio** → Modal de "alta demanda" apenas
- **Free/Plus/Pro têm limites explícitos** → Modal com números e CTA upgrade

---

## 🔍 AUDITORIA: CAUSA RAIZ

### Bug 1: "20 mensagens" no Studio
**Localização:** [error-mapper.js](public/error-mapper.js#L30-L37)

```javascript
// ANTES (V2) - Bug
getMessage: (plan, meta) => {
    const config = PLAN_CONFIG[plan] || PLAN_CONFIG.free; // ← FALLBACK para free!
    const cap = meta?.cap || config.chatLimit;           // ← Se meta.cap vazio, usa 20
    // ...
    return msgs[plan] || msgs.free;                      // ← Se studio não tem mensagem, usa free
}
```

**Problema:** Quando `plan === 'studio'` mas não tinha mensagem específica, fazia fallback para `msgs.free` que menciona "20 mensagens".

### Bug 2: Studio mostrando "limite atingido"
**Localização:** [error-mapper.js](public/error-mapper.js#L244-L260) (V2)

```javascript
// ANTES - Sem policy
function mapBlockUi({ scope, code, feature, plan, meta }) {
    const templateKey = CODE_MAPPING[normalizedCode]; // LIMIT_REACHED → LIMIT_REACHED
    // ... template de "Limite atingido" era usado para TODOS os planos
}
```

**Problema:** Não havia distinção por plano. `LIMIT_REACHED` sempre mapeava para template de limite.

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. PLAN_POLICY Central (NOVO)

```javascript
// error-mapper.js V3
const PLAN_POLICY = {
    free:   { exposeLimits: true,  overflowAnalysis: 'downgrade_to_reduced', overflowChat: 'limit_modal', showUpgradeCta: true },
    plus:   { exposeLimits: true,  overflowAnalysis: 'downgrade_to_reduced', overflowChat: 'limit_modal', showUpgradeCta: true },
    pro:    { exposeLimits: true,  overflowAnalysis: 'downgrade_to_reduced', overflowChat: 'limit_modal', showUpgradeCta: true },
    studio: { exposeLimits: false, overflowAnalysis: 'system_peak_modal',   overflowChat: 'system_peak_modal', showUpgradeCta: false }
};
```

### 2. Disfarce de LIMIT_REACHED para Studio

```javascript
// mapBlockUi() V3 - REGRA CRÍTICA
if (!policy.exposeLimits && templateKey === 'LIMIT_REACHED') {
    console.log('[ERROR-MAPPER-V3] ⚠️ DISFARÇANDO LIMIT_REACHED como SYSTEM_PEAK para', normalizedPlan);
    templateKey = 'SYSTEM_PEAK_USAGE'; // ← Studio vê "alta demanda" ao invés de "limite"
}
```

### 3. CTA Ajustado por Policy

```javascript
// Se Studio não tem upgrade, trocar botão
if (primaryCta?.action === 'upgrade' && !policy.showUpgradeCta) {
    primaryCta = { label: '🔄 Tentar Novamente', action: 'retry' };
}
```

### 4. Overflow de Análise com Downgrade

```javascript
// audio-analyzer-integration.js - showModalError()
if (scope === 'analysis' && isLimitError) {
    if (policy.overflowAnalysis === 'downgrade_to_reduced') {
        // FREE/PLUS/PRO: Mostra modal mas permite continuar em modo básico
        errorUi.secondaryCta = { label: '📊 Continuar Modo Básico', action: 'retry' };
    } else if (policy.overflowAnalysis === 'system_peak_modal') {
        // STUDIO: Apenas retry, sem downgrade
    }
}
```

---

## 📁 ARQUIVOS MODIFICADOS

| Arquivo | Alteração |
|---------|-----------|
| [public/error-mapper.js](public/error-mapper.js) | V3: PLAN_POLICY, disfarce LIMIT_REACHED→SYSTEM_PEAK para Studio, CTA dinâmico |
| [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js) | showModalError() usa policy para downgrade/reduced |

---

## 📊 TABELA DE COMPORTAMENTO POR PLANO

| Plano | Chat Limit | Análise Limit | Modal de Limite | Modal de Hardcap | Downgrade Reduced |
|-------|-----------|---------------|-----------------|------------------|-------------------|
| Free | 20/mês | 1/mês | ✅ "Limite atingido" | N/A | ✅ Permitido |
| Plus | 80/mês | 20/mês | ✅ "Limite atingido" | N/A | ✅ Permitido |
| Pro | 300/mês | 60/mês | ✅ "Limite atingido" | N/A | ✅ Permitido |
| **Studio** | 400/mês (oculto) | 400/mês (oculto) | ❌ NUNCA | ⏳ "Alta demanda" | ❌ NUNCA |

---

## 🧪 CHECKLIST DE TESTE

### Studio (plan: studio)
- [ ] **Chat hardcap** → Modal "Plataforma em alta demanda", SEM números, SEM "renova em"
- [ ] **Análise hardcap** → Modal "Plataforma em alta demanda", SEM números, SEM "renova em"
- [ ] **Botão** → "Tentar Novamente" (NÃO "Ver Planos")
- [ ] **Console** → `[ERROR-MAPPER-V3] ⚠️ DISFARÇANDO LIMIT_REACHED como SYSTEM_PEAK`

### Pro (plan: pro)
- [ ] **Chat limite** → Modal "Limite de 300 mensagens atingido. Renova em X. Conheça o Studio!"
- [ ] **Análise limite** → Modal "Limite de 60 análises atingido. Renova em X."
- [ ] **Botão primário** → "Ver Planos"
- [ ] **Botão secundário** → "Continuar Modo Básico" (para análise)

### Plus (plan: plus)
- [ ] **Chat limite** → Modal "80 mensagens do Plus. Renova em X. Conheça o Pro!"
- [ ] **Análise limite** → Modal "20 análises do Plus. Renova em X."
- [ ] **Overflow análise** → Permite continuar em modo reduced

### Free (plan: free)
- [ ] **Chat limite** → Modal "20 mensagens gratuitas. Faça upgrade para Plus!"
- [ ] **Análise limite** → Modal "1 análise gratuita. Faça upgrade!"
- [ ] **Overflow análise** → Permite continuar em modo reduced

### Cross-checks Críticos
- [ ] **Studio NUNCA mostra "20", "80", "300", "400"** em nenhuma mensagem
- [ ] **Studio NUNCA mostra "limite atingido"** - apenas "alta demanda"
- [ ] **Studio NUNCA mostra "renova em"** - sem datas
- [ ] **Free/Plus/Pro SEMPRE mostram números** quando batem limite

---

## 🔧 API ErrorMapper V3

```javascript
// Função principal
window.ErrorMapper.mapBlockUi({
    scope: 'chat' | 'analysis',
    code: 'LIMIT_REACHED',
    plan: 'studio',
    meta: { cap: 400, used: 400, resetDate: '2026-02-01' }
})

// Retorna para STUDIO:
{
    icon: '⏳',                              // ← NÃO 💬
    title: 'Plataforma em alta demanda',    // ← NÃO 'Limite de mensagens'
    message: 'Muitos usuários no momento...', // ← SEM números
    primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' }, // ← NÃO 'Ver Planos'
    severity: 'warning',                    // ← NÃO 'limit'
    _debug: { disguised: true, plan: 'studio', code: 'LIMIT_REACHED' }
}

// Obter policy de um plano
window.ErrorMapper.getPlanPolicy('studio')
// → { exposeLimits: false, overflowAnalysis: 'system_peak_modal', ... }
```

---

## ✅ CONCLUSÃO

O sistema agora diferencia corretamente o comportamento de bloqueio por plano:
- **Studio**: Experiência "ilimitada" - hardcaps são invisíveis, apenas "alta demanda"
- **Free/Plus/Pro**: Limites transparentes com números e opções de upgrade

A inversão de mensagens foi corrigida na raiz com a `PLAN_POLICY` central.
