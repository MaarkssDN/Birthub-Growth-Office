# Onda 11 — Testes de Concorrência e Idempotência

## 1. Desafio de Concorrência na Promoção Comercial
Em operações com múltiplos operadores ou requisições concorrentes (duplo clique, retries de rede), a criação de oportunidades duplicadas para a mesma conta empresarial gera inconsistência e dispersão no pipeline.

## 2. Mecanismo de Proteção Implementado

### 2.1 Advisory Locks no PostgreSQL (`pg_advisory_xact_lock`)
No `PrismaOpportunityStore.createFromCompany`, a operação executa dentro de uma transação `$transaction` serializada por lock consultivo de transação:

```typescript
const lockKey = hashStringToLockKey(`${workspaceId}:opportunity:company:${company.id}`);
await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockKey);
```

### 2.2 Verificação Prévia e Chave Idempotente
Com o lock adquirido, o banco verifica a existência prévia de oportunidade associada àquela `companyId` no workspace:
```typescript
const existing = await tx.opportunity.findFirst({
  where: { workspaceId, companyId: company.id },
});
if (existing) {
  return { opportunity: toOpportunity(existing), created: false, duplicated: true };
}
```

### 2.3 Garantia em Memória (`MemoryOpportunityStore`)
Para testes e modo isolado, o `MemoryOpportunityStore` utiliza controle síncrono com mutação atômica em array, garantindo o mesmo contrato sem duplicidade.

## 3. Resultados dos Testes de Concorrência

| Teste | Concorrência | Operação | Resultado |
|---|---|---|---|
| `tests/unit/opportunity-store.test.ts` | 2 chamadas sequenciais | Promoção de empresa aprovada | 1 criada, 1 idempotente (`duplicated: true`) |
| `tests/api/onda11.test.ts` | 5 chamadas simultâneas (`Promise.all`) | Promoção concorrente no PostgreSQL 17 | 1 criada (`201`), 4 idempotentes (`200 OK`, `duplicated: true`), 0 erros de chave |
| `tests/api/onda11.test.ts` | 3 chamadas concorrentes cross-workspace | Mesma empresa em workspace distinto | Isolamento estrito: erro 404 (empresa não encontrada no workspace alheio) |
| Central Scout CSV Import | 2 envios idênticos de CSV | Deduplicação de lote | `inserted: 0`, `duplicates: N`, zero colisão |

Todos os testes de concorrência e idempotência foram homologados com 100% de sucesso.
