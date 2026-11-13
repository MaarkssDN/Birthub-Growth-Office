# Onda 04 — Infraestrutura Nativa Windows (G21/G41)

Data: 2026-11-13 · Autoridade: Supervisor de Engenharia

## Contexto

A tentativa de habilitar `VirtualMachinePlatform` falhou porque a imagem do
Windows está **"Desabilitado com Carga Removida"** — o payload do recurso foi
removido do component store. `DISM /RestoreHealth` falha com `0x800f0915`
(conteúdo de reparo indisponível) e `enable-feature` com `0x800f0950`.
Conclusão: **WSL2/Docker não são viáveis nesta máquina sem reparo pesado do SO**.

Decisão: provisionar **PostgreSQL + Redis nativos no Windows**, atendendo aos
requisitos reais dos gates (banco durável, Redis com AOF, isolamento `bgo_*`,
porta `127.0.0.1`) sem depender de containerização.

## PostgreSQL 17.12 nativo

| Item | Valor |
|---|---|
| Binários | `C:\bgo\pgsql` (copiados de `%TEMP%\pg17\pgsql`, origem embedded-postgres) |
| Dados | `C:\bgo\pgdata` (initdb próprio, locale pt-BR, UTF8) |
| Serviço | `postgresql-bgo` (auto-start, registrado via `pg_ctl register`) |
| Porta | `127.0.0.1:5437` (somente loopback) |
| Superuser | `postgres` (scram-sha-256) |
| Role da app | `bgo_app` (owner do banco, senha em `.env` gitignored) |
| Banco | `birthub_growth_office_dev` |

Observação: o instalador EDB via winget falhou (exit 1, InstallBuilder) —
por isso optou-se pelos binários oficiais PostgreSQL 17.12 já presentes no
ambiente, instalados manualmente como serviço do Windows. Equivalente funcional
a uma instalação EDB, sem pgAdmin/StackBuilder.

## Memurai Developer 4.1.2 (Redis para Windows)

| Item | Valor |
|---|---|
| Serviço | `Memurai` (auto-start) |
| Porta | `127.0.0.1:6387` |
| Persistência | `appendonly yes` — AOF em `C:\bgo\memurai\appendonlydir` |
| Bind | `127.0.0.1` apenas |

**Ressalva honesta:** Memurai é um Redis-compatível para Windows (não existe
build oficial da Redis Ltd. para Windows). API compatível com Redis ≥5;
BullMQ opera normalmente. Se um dia houver Redis oficial via Docker/WSL,
basta trocar `BGO_REDIS_URL`.

## Evidências coletadas

1. **Schema**: `prisma migrate deploy` aplicou `20250101000000_init_onda01`;
   18 modelos + `_prisma_migrations` = 19 tabelas verificadas via `\dt`.
2. **Backup**: `pg_dump -Fc` → `C:\bgo\backups\birthub_growth_office_dev_*.dump`.
3. **Restore**: `pg_restore` em banco de teste → 19 tabelas íntegras;
   banco de teste descartado após verificação.
4. **Restart PostgreSQL**: `net stop/start postgresql-bgo` → dados intactos
   (1 lead, 28 eventos outbox), API reconectou e respondeu `/api/health`.
5. **Restart Redis**: `net stop/start Memurai` → chave `bgo:durability_test`
   sobreviveu via AOF.
6. **E2E na stack nativa**: API (`persistence:"postgres"`) + worker
   (`queue=bullmq` via `redis://127.0.0.1:6387`) → `POST /api/demo/run`
   gerou lead + missão + 28 eventos no outbox + 17 auditorias, tudo em
   `birthub_growth_office_dev` nativo.
7. **Login real**: `owner@bgo.local` autenticou contra o Postgres nativo
   (senha fixa via `BGO_ADMIN_PASSWORD` no `.env` gitignored).

## Configuração do repositório

- `.env` (gitignored) criado com `DATABASE_URL`, `BGO_REDIS_URL`,
  `BGO_ADMIN_PASSWORD`, `BGO_DEV_AUTH=1`, `BGO_AI_MODE=simulated`.
- `apps/api` e `apps/worker`: scripts `dev`/`start` agora usam
  `tsx --env-file-if-exists=../../.env` — `.env` é carregado se existir;
  ausência não quebra nada (cai no comportamento anterior: PGlite/memória).
- PGlite continua disponível como fallback: sem `DATABASE_URL`, a API sobe
  o socket PGlite — **mas a porta 5437 agora pertence ao Postgres nativo**,
  então os dois não coexistem. Com `.env` presente isso não ocorre.

## Comandos operacionais

```bash
# status
sc.exe query postgresql-bgo
sc.exe query Memurai

# backup (rodar antes de qualquer migration destrutiva)
/c/bgo/pgsql/bin/pg_dump.exe -h 127.0.0.1 -p 5437 -U postgres \
  -d birthub_growth_office_dev -Fc -f C:/bgo/backups/bgo_$(date +%Y%m%d_%H%M).dump

# restore (exemplo)
/c/bgo/pgsql/bin/psql.exe -h 127.0.0.1 -p 5437 -U postgres -d postgres \
  -c "CREATE DATABASE birthub_growth_office_dev_restore;"
/c/bgo/pgsql/bin/pg_restore.exe -h 127.0.0.1 -p 5437 -U postgres \
  -d birthub_growth_office_dev_restore --no-owner --no-privileges <dump>
```

## Gates impactados

- **G21 (PostgreSQL nativo)**: ✅ provisionado, migrado, backup/restore e
  restart verificados. Ressalva: binários manuais, não instalador EDB.
- **G41 (infra durável)**: ✅ PostgreSQL nativo + Redis com AOF validados
  com restart real dos serviços. Ressalva: Memurai é Redis-compatível
  comunitário, não Redis oficial.
