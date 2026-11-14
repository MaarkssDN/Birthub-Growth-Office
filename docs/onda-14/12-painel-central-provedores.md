# Onda 14 — Relatório 12: Painel Central de Provedores de IA

**Projeto:** Birthub Growth Office (BGO)  
**Interface:** `apps/web/src/onda14-views.tsx` (Aba `Provedores IA`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Visão Geral do Painel

A aba **Provedores IA** foi introduzida no console do BGO (`apps/web`) para centralizar o controle de inferência e auditoria:

### 1.1 Banner de Governança e Hardware
- Exibe o status consolidado do host:
  - Processador: AMD Ryzen 5 5625U (6C/12T).
  - Memória: 24 GB RAM.
  - Acelerador: AMD Radeon Graphics.
  - Orçamento externo: R$ 0,00.
  - Provedor ativo atual: detecção automática em tempo real.

### 1.2 Matriz de Provedores e Fallback
- Tabela interativa dos 7 provedores (Ollama, Groq, Gemini, OpenRouter, Cloudflare, xAI e Mock).
- Botões de reordenação de prioridade (▲ e ▼).
- Botão "Testar Conexão" para disparar inferência sintética imediata e exibir a latência e a resposta ou erro.

### 1.3 Sandbox de Diagnóstico Comercial Meridian
- Permite que operadores simulem a análise comercial de uma empresa ou lead.
- Opção de roteamento automático ou seleção de provedor específico.
- Exibe:
  - Diagnóstico comercial emitido.
  - Justificativa detalhada.
  - Próxima ação recomendada.
  - Grau de confiança (0-100%).
  - Metadados: modelo, latência (ms), tag `SIMULADO` vs `INFERÊNCIA REAL`, e custo (R$ 0,00).

### 1.4 Histórico de Inferências Append-Only
- Log das últimas execuções com timestamp, agente solicitante, provedor, modelo, status (`SUCCESS`, `FALLBACK`, `BLOCKED`), latência e contagem de tokens.
