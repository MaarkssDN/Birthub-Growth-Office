import { describe, expect, it } from "vitest";
import http from "node:http";
import { OllamaProvider } from "@bgo/ai";

describe("OllamaProvider (Onda 14 — G191)", () => {
  it("reporta 'service_down' quando a porta 11434 não responde", async () => {
    // Porta não utilizada
    const provider = new OllamaProvider({ baseUrl: "http://127.0.0.1:11999" });
    const status = await provider.getStatus();
    expect(status).toBe("service_down");

    const models = await provider.getAvailableModels();
    expect(models).toEqual([]);
  });

  it("reporta 'service_ready_no_models' quando serviço responde mas sem modelos locais", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ models: [] }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    try {
      const provider = new OllamaProvider({ baseUrl: `http://127.0.0.1:${port}` });
      const status = await provider.getStatus();
      expect(status).toBe("service_ready_no_models");
      const models = await provider.getAvailableModels();
      expect(models).toEqual([]);
    } finally {
      server.close();
    }
  });

  it("reporta 'ready' e lista modelos quando serviço responde com tags válidas", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            models: [
              { name: "qwen2.5:3b", size: 1900000000, modified_at: new Date().toISOString() },
              { name: "llama3.2:3b", size: 2000000000, modified_at: new Date().toISOString() },
            ],
          }),
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    try {
      const provider = new OllamaProvider({ baseUrl: `http://127.0.0.1:${port}` });
      const status = await provider.getStatus();
      expect(status).toBe("ready");
      const models = await provider.getAvailableModels();
      expect(models).toEqual(["qwen2.5:3b", "llama3.2:3b"]);
    } finally {
      server.close();
    }
  });

  it("executa inferência local com custo financeiro zero e registra tokens e latência", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/v1/chat/completions") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    diagnosis: "empresa elegível com fit prioritário",
                    justification: "análise local via qwen2.5",
                    confidence: 0.85,
                    nextAction: "encaminhar para operador",
                    claimRefs: ["claim-1"],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 180, completion_tokens: 65 },
          }),
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    try {
      const provider = new OllamaProvider({
        baseUrl: `http://127.0.0.1:${port}`,
        defaultModel: "qwen2.5:3b",
      });

      const res = await provider.complete({
        agentId: "meridian",
        promptKey: "meridian.diagnose.v1",
        input: { lead: { name: "Empresa Local" } },
      });

      expect(res.ok).toBe(true);
      expect(res.isLocal).toBe(true);
      expect(res.costUnits).toBe(0); // Zero custo externo
      expect(res.tokensIn).toBe(180);
      expect(res.tokensOut).toBe(65);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.output).toContain("fit prioritário");
    } finally {
      server.close();
    }
  });
});
