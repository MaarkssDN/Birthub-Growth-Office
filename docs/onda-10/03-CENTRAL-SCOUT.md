# Central Scout (G114/G115)
UI: aba "Scout" (apps/web/src/scout.tsx) — importar CSV, histórico de lotes,
tabela com filtros (status, UF, score mín.), dossiê com reasons/gaps/histórico,
aprovar/rejeitar, exportar aprovadas.
API: POST /api/scout/import (persiste lote+empresas, evento scout.import.completed.v1),
GET /api/scout/imports, GET /api/scout/companies (filtros+paginação),
GET /api/scout/companies/:id (+history), POST .../review, GET /api/scout/export.
Export: somente owner/operator; células sanitizadas contra formula injection.
Auditoria: scout.import, scout.company.*, scout.export, scout.import.persist_failed.
Eventos novos versionados em contracts/event.ts.
Painel no escritório: agente scout mostra contagens p/ revisão/aprovadas + link.
