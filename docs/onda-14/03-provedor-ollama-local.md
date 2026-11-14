# Onda 14 — Relatório 03: Provedor Ollama Local (Prioridade Máxima)

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** Ollama Local (`127.0.0.1:11434`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Motivação e Enquadramento

O Ollama local é a solução prioritária absoluta na Onda 14 pelos seguintes fatores:
- **Custo Financeiro Zero:** Não consome tokens de API faturáveis.
- **Privacidade Total:** Os dados e diagnósticos não trafegam pela internet pública; o processamento ocorre integralmente no processador Ryzen e na RAM do host.
- **Independência Operacional:** A operação não sofre com oscilações de conexão de rede ou cotas de provedores de terceiros.
- **Compatibilidade com Saída Estruturada:** Suporta `response_format: { type: "json_object" }` no endpoint OpenAI-compatible `/v1/chat/completions` e na API `/api/chat`.

---

## 2. Integração Técnica

O adaptador `OllamaProvider` (`packages/ai/src/providers/ollama.ts`) implementa:
1. **Health Check Ativo:** Consulta `GET http://127.0.0.1:11434/api/tags`.
   - Se a porta não responder: `status = "service_down"`.
   - Se o serviço responder sem modelos baixados: `status = "service_ready_no_models"`.
   - Se houver modelos disponíveis: `status = "ready"`.
2. **Listagem de Modelos:** Extrai dinamicamente as tags dos modelos locais instalados (`qwen2.5:3b`, `llama3.2:3b`, etc.).
3. **Execução de Inferência:** Dispara requisições `POST /v1/chat/completions` com timeout controlado (padrão 60s) e tratamento de cancelamento via `AbortController`.
4. **Contabilidade de Custo:** Define estritamente `costUnits: 0`, mas monitora e registra latência em milissegundos e contagem de tokens in/out.

---

## 3. Recomendações de Modelos para o Host (Ryzen 5 5625U + 24GB RAM)

| Modelo | Parâmetros | Quantização | Tamanho em Disco | Uso de RAM | Desempenho Esperado |
|---|---|---|---|---|---|
| **Qwen 2.5** | 3B | Q4_K_M | ~1.9 GB | ~2.5 GB | Excelente compreensão de português e alta aderência a JSON schema. (~20 tokens/s). |
| **Llama 3.2** | 3B | Q4_K_M | ~2.0 GB | ~2.6 GB | Rápido e preciso para categorização e diagnósticos curtos. |
| **Qwen 2.5** | 1.5B | Q4_K_M | ~980 MB | ~1.4 GB | Ultrarrápido para extrações e triagens. (~35 tokens/s). |
| **Qwen 2.5** | 7B | Q4_K_M | ~4.7 GB | ~5.8 GB | Maior raciocínio e precisão em rubricas complexas (~8-12 tokens/s). |
