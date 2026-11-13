# Onda 04 — Matriz Atualizada de Gates

| Gate | Escopo | Status | Evidência |
|---|---|---|---|
| G21 | PostgreSQL nativo | ✅ | PG 17.12 serviço `postgresql-bgo`, migrate deploy, backup/restore, restart |
| G22 | BullMQ | ✅ | fila persistente + DLQ + restart (Onda 02/03) |
| G31 | Worker persistente | ✅ | PrismaStore compartilhado, outbox, idempotência domínio |
| G32 | Recuperação | ✅ | restart, stalled em execução, cancel pendente+ativo, DLQ |
| G33 | IA real | ⛔ BLOQUEADO POR CREDENCIAL | contrato testado via stub; sem `BGO_AI_API_KEY` autorizada |
| G34 | Escritório 3D | ✅ | cena iso navegável, WebGL + fallback |
| G35 | Modelos 3D | ⚠️ PARCIAL | 6 GLBs válidos individuais + expressivos; **sem rig/clips** — não são arte final |
| G36 | Eventos→animações | ✅ | SSE real → estados; Playwright prova mudança pós-eventos |
| G37 | Segurança | ✅ | auth/RBAC/rate-limit/aprovações/channel.send negado |
| G38 | Interface | ✅ | pw-glb 11/11, pw-office 8/8, mobile sem overflow, screenshots |
| G39 | Qualidade | ✅ | lint 0, typecheck 10/10, 73/73 testes, build OK |
| G40 | Independência | ✅ | zero deps Birthub 360° (teste isolation) |
| G41 | Infra durável | ✅ | PG nativo + Redis AOF com restart verificado (Memurai = ressalva documentada) |

## Veredito
- **Infra (G21/G41): APROVADA** — nativa, durável, isolada.
- **Operação (G31/G32): APROVADA** — worker persistente com recuperação completa.
- **Visual (G34/G36/G38): APROVADA**; **G35 parcial** — GLBs reais entregues,
  mas sem rig/animações esqueléticas (arte final é Onda 05).
- **G33 bloqueado** até credencial autorizada — implementação pronta.
