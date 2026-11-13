# Onda 06 — Orquestração (G52)

Jornada homologada (dados sintéticos): captação → dedup → missão Aegis →
distribuição Relay → diagnóstico Meridian → rascunho Beacon → follow-up
Pledge → aprovação humana → auditoria. `runDemoFlow` + `POST /api/demo/run`.
Histórico persiste em PostgreSQL (sobrevive restart — verificado Onda 04).

Rastreio por `correlationId` em todos os eventos; `AgentAssignment` registra
responsável por etapa; SSE alimenta estados do escritório 3D.
