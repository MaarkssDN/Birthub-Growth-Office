# Birthub Growth Office — governança deste repositório

## Identidade

Este é o repositório **independente** do Birthub Growth Office (BGO).
Nenhum arquivo, secret, banco, volume ou credencial do projeto Birthub 360°
pode ser referenciado, importado ou reutilizado aqui.

## Regras invioláveis

1. **Isolamento**: todo recurso usa prefixo/nome `bgo_*`, `birthub_growth_*`,
   portas 4180/4181/5437/6387, bind `127.0.0.1`. Proibido Docker remoto inseguro.
2. **Sem envios externos reais** na Onda 00: `channel.send` é bloqueado pelo
   policy engine no backend; UI nunca é autoridade de permissão.
3. **Sem PII real**: apenas dados sintéticos (`synthetic: true`). Contato exige
   provenance + consentimento; opt-out → `suppressed`.
4. **Sem claims não validados** em saídas voltadas a cliente: OfferClaim com
   status `approved` é pré-requisito; `PENDENTE_DE_VALIDACAO` bloqueia uso.
5. **Eventos versionados e auditáveis**: toda mutação relevante emite evento
   do envelope `packages/contracts` + `AuditEvent` append-only.
6. **Autonomia L0–L4**: L4 é proibido (pagamento, contrato, disparo em massa,
   alteração de infra, cross-tenant, bypass de política).
7. **Honestidade de estado**: `IMPLEMENTADO / SIMULADO / PLANEJADO /
   BLOQUEADO / PENDENTE_DE_VALIDACAO` sempre visíveis; nunca exibir simulado
   como real.
8. **Catálogo canônico**: exatamente 29 personas; IDs imutáveis; 6 ativos.
9. **TypeScript strict** em todos os pacotes; sem `any` em contratos.
10. **Commits locais atômicos**; sem push/deploy automático.

## Comandos

`pnpm install` → `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
API: `pnpm dev:api` (127.0.0.1:4181). Web: `pnpm dev:web` (127.0.0.1:4180).

## Fontes

`docs/onda-00/` (10 docs) + `references/onda-00/` (pacote-fonte original).
