# BGO · Onda 00 — Manual Comercial (verdade antes do marketing)

Status: V1 · Toda informação comercial não comprovada está marcada
`PENDENTE_DE_VALIDACAO` e é **bloqueada para uso em mensagens externas** pelo
policy engine (`@bgo/commercial`).

## 1. Ficha da Oferta — Birthub 360°

Fonte versionada: `packages/commercial/src/offer-claims.ts` (fixture `offer-v1`).

| Claim | Classificação | Versão |
|-------|---------------|--------|
| Nome do produto: Birthub 360° | APROVADO (documento mestre) | offer-v1 |
| Posicionamento estratégico "comercial unificado" | APROVADO como hipótese de posicionamento; wording pendente | offer-v1 |
| Módulos disponíveis hoje | **PENDENTE_DE_VALIDACAO** | offer-v1 |
| Preços, planos, descontos, trials | **PENDENTE_DE_VALIDACAO** — nunca inventar | offer-v1 |
| Integrações e automações | **PENDENTE_DE_VALIDACAO** por provedor | offer-v1 |
| Números de resultado, ROI, depoimentos | **PENDENTE_DE_VALIDACAO**; proibido sem fonte | offer-v1 |
| Tempo de implantação, suporte, SLA | **PENDENTE_DE_VALIDACAO** | offer-v1 |
| Recursos de IA, WhatsApp/telefonia | **PENDENTE_DE_VALIDACAO** | offer-v1 |

Regra: `Beacon` só pode referenciar claims com status `approved` no rascunho.
Na Onda 00 nenhum claim de feature/preço está aprovado → rascunhos são
necessariamente genéricos e marcados `SIMULADO`.

## 2. ICP — HIPÓTESE (não validada)

`packages/commercial/src/icp.ts` — `icp-hypothesis-v1`.

- Segmento: empresas B2B com rotina de SDR/BDR.
- Dores a validar: fragmentação de dados, baixa disciplina de follow-up,
  ausência de visão de funil, dificuldade de ligar sinais a receita.
- Exclusões propostas: empresas sem processo comercial, consumidor final,
  setor fora da hipótese inicial (a definir com o proprietário).
- **Não apresentar como evidência de mercado validada.**

## 3. Jornadas

### Inbound (prioritário na Onda 00)
Lead solicita contato (formulário futuro, indicação, conteúdo) → registro com
proveniência → triagem Meridian → missão Aegis → dossiê Scout → rascunho Beacon
→ aprovação humana → Pledge agenda follow-up interno.

### Outbound autorizado (futuro, Onda 03+)
Somente com opt-in documentado, fonte permitida, supressão ativa e revisão
legal. **Proibido na Onda 00**: prospecção massiva, cold outreach automatizado,
ligações sem revisão legal/política.

## 4. Qualificação (Meridian)

Rubrica versionada `rubric-v1` (ver `packages/commercial/src/rubric.ts`):
dores declaradas, fit com ICP, canal autorizado, urgência declarada, consentimento.
Score explicável: cada componente lista evidência ou lacuna. Lacunas viram
`perguntas_pendentes`, nunca suposições.

## 5. Objeções previstas (a responder somente com claims aprovados)

| Objeção | Resposta permitida hoje |
|---------|--------------------------|
| "Quanto custa?" | "PENDENTE_DE_VALIDACAO — direcionar ao responsável comercial" |
| "Quais integrações?" | "PENDENTE_DE_VALIDACAO — validar antes de afirmar" |
| "Tem cases?" | "PENDENTE_DE_VALIDACAO — nenhum case aprovado" |

## 6. Handoff humano

Todo rascunho de abordagem, proposta ou convite exige `ApprovalRequest` com
preview, motivo e decisão registrada. Rejeição preserva motivo. Aprovação
humana **não** dispara envio na Onda 00 — `channel.send` permanece `L3 blocked`.

## 7. LGPD / canais (gates, não avisos)

- Finalidade declarada, fonte+data do dado, minimização, exclusão/correção.
- Opt-out → status `suppressed`, bloqueio de qualquer draft futuro.
- WhatsApp: opt-in válido, templates aprovados, janela de serviço, supressão.
- Dados desta onda são 100% sintéticos (`synthetic: true`).
