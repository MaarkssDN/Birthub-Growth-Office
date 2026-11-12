# Onda 02 — Relatório de Segurança (G23)

## Revisão da autenticação (Onda 01 — reconfirmada)
- Senhas: scrypt N=16384; sessões opacas com sha256 no banco; expiração 12h; revogação.
- Cookies httpOnly; Bearer alternativo; RBAC owner/approver.
- `x-bgo-user`/`x-bgo-role` (dev-header) **só** com `BGO_DEV_AUTH=1` — fora de dev permanece inerte.
- Rate limit: login 5/5min, captação 10/h; honeypot + dedup na captação pública.
- Rotas admin protegidas por sessão; captação pública é a única rota sem auth.

## Credenciais de demonstração
- Seed dev: `owner@bgo.local` / senha definida por `BGO_ADMIN_PASSWORD` (ou gerada aleatória em log — **nunca commitada**). `smoke-pass-123` aparece apenas em scripts de teste local e docs de uso dev; não é credencial de produção.
- Varredura: nenhum `.env` real, token ou senha em commits (`tests/isolation` verde).

## Exposição de serviços
- API `127.0.0.1:4181`, web `127.0.0.1:4180`, PGlite `127.0.0.1:5437`, Redis dev `127.0.0.1:6387` — todos loopback.
- `infra/compose` mantém binds `127.0.0.1` para quando Docker estiver disponível.
- Nenhuma porta admin/banco exposta externamente.

## Dados sensíveis
- PII redactada por `redactPII` nos eventos; captação registra apenas dados necessários + contexto de privacidade LGPD v1.
- Logs não imprimem tokens/senhas; URL Redis logada com credenciais mascaradas (`replace(//.*@, //***@)`).

## Novidades Onda 02
- `/api/ai/status` público porém **sem segredos**: expõe apenas modo/modeIsReal/provider — proposital para transparência.
- `packages/ai`: API key só via env; nunca logada; modo real exige `BGO_AI_MODE=real` + `BGO_AI_ENABLED=1` + `BGO_AI_API_KEY`.
- Filas: sem dados de PII em payloads de job (payload = dados de orquestração); `idempotencyKey` não contém PII.

## Pendências de segurança (não bloqueantes)
- Troca forçada de senha do seed em primeiro login real (quando houver usuários reais).
- `secure` flag do cookie deve ser ativada quando houver HTTPS (atualmente http local).
- Auditoria de `queue.cancel` ainda não emite evento de auditoria — recomendado na Onda 03.
