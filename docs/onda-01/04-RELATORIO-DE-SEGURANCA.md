# Onda 01 — Relatório de Segurança

## Autenticação & sessões
- Senha: scrypt N=16384, salt 16B, timingSafeEqual; hash nunca sai da API.
- Token de sessão: 32B aleatório; só sha256 persistido (AuthSession.tokenHash unique).
- Expiração 12h, revogação em logout, `lastSeenAt` atualizado por uso.
- Enumeração de usuários mitigada por verifyPassword dummy em e-mail inexistente.

## Autorização
- Rotas `/api/*` privadas exceto health/auth-login/logout/capture; pré-handler exige sessão ou dev-header.
- `decideApproval` exige role owner|approver; auto-aprovação negada e auditada.
- `BGO_DEV_AUTH=1` é a ÚNICA forma de x-bgo-* funcionar; default desligado.

## Captação anti-abuso
- Rate limit por IP: login 5/5min, captação 10/h (em memória, por processo).
- Honeypot `website` (invisível) → 202 silencioso sem gravar.
- Validação zod estrita backend + HTML5/JS frontend; e-mail profissional obrigatório.
- Dedup por hash de e-mail normalizado ou name+company — evita registros duplicados.

## Dados sensíveis
- Audit usa `redactPII`; payloads de eventos passam por `redactPII` no EventBus.
- Nenhum segredo em repo (`.env.example` sanitizado); senha admin inicial gerada aleatória e impressa só no console se `BGO_ADMIN_PASSWORD` ausente.
- Logs da API não imprimem tokens nem senhas.

## Isolamento
- DB: PGlite exclusivo, dataDir `./var/pglite` (gitignored), socket só 127.0.0.1:5437.
- Tabela-marca `_bgo_instance` impede apontar DATABASE_URL para banco de outro produto.
- `var/`, credenciais e dados de leads reais nunca versionados.
