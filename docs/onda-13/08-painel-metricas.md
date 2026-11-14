# Painel de Métricas e Indicadores do Piloto Comercial — Onda 13
## Monitoramento Operacional com Estrita Honestidade de Estado (G180)

### 1. Diretriz de Honestidade de Estado (Regra 07 do `AGENTS.md`)
O Painel de Métricas do Piloto Comercial (`GET /api/metrics/pilot`) foi concebido para fornecer visibilidade em tempo real sobre a eficiência do funil de aquisição corporativa, segregando expressamente:
- **Dados Reais**: Métricas apuradas no banco de dados e contratos locais.
- **Dados Simulados**: Dados de simulações controladas devidamente etiquetados com a flag `simulated: true`.
- **Dados Ausentes**: Dados que ainda não existem na operação, expressamente rotulados como `absent` ou contagem zero.

> **Regra Crítica**: É terminantemente proibido fabricar reuniões realizadas, contratos assinados ou receitas fictícias para simular sucesso comercial.

---

### 2. Indicadores do Funil Comercial do Piloto

| Indicador | Valor Atual | Status | Significado Operacional |
|---|---|---|---|
| **Leads Recebidos** | **5** | Real (Sintético) | Formulários de interesse voluntário com consentimento LGPD registrado. |
| **Leads Qualificados** | **5** | Real (Sintético) | Leads processados pelo motor de regras ICP do Meridian. |
| **Empresas Mapeadas** | **4** | Real (Sintético) | Empresas ativas cadastradas na Central Scout via CSV ou captação. |
| **Oportunidades Abertas** | **4** | Real (Sintético) | Oportunidades comerciais em andamento no pipeline. |
| **Abordagens Preparadas** | **3** | Real (Sintético) | Rascunhos de e-mail e deck gerados pelo Beacon com claims aprovados. |
| **Abordagens Homologadas** | **2** | Real (Sintético) | Dossiês revisados e aprovados pelo operador humano na Central de Aprovações. |
| **Reuniões Propostas** | **2** | Real (Sintético) | Propostas de tour 360 e demonstração guiada registradas pelo Pledge. |
| **Reuniões Realizadas** | **0** | **Ausente (`absent`)** | **Zero reuniões fictícias inventadas**; aguardando agendamento humano no piloto real. |

---

### 3. Distribuição por Estágios do Pipeline

O cálculo de conversão entre estágios é gerado dinamicamente:
- `approved_target`: 1
- `researching`: 0
- `qualifying`: 0
- `qualified`: 0
- `outreach_drafted`: 0
- `awaiting_approval`: 1
- `followup_planned`: 2
- `won`: 0
- `lost`: 0
- `archived`: 0

---

### 4. Consumo de Recursos de IA e Governança de Custos

- **Total de Tokens de IA**: `0` (Operação em modo determinístico/simulado auditado).
- **Custo Total Estimado**: `0.03 unidades` (Tarifação determinística do ledger).
- **Modo de Operação**: `"deterministic_g172_blocked"` (G172 bloqueado honestamente por ausência de credencial paga).
- **Envios Externos Reais**: `0 (false)` — Bloqueio estrito da política L3 verificado.
