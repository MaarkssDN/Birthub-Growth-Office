import { useState, useEffect } from "react";
import { api } from "./api";

export interface ProviderItem {
  id: string;
  name: string;
  type: string;
  status: string;
  isLocal: boolean;
  costTier: string;
  model: string;
  availableModels: string[];
  priority: number;
  privacyTier: string;
  hardwareInfo?: {
    cpu: string;
    ramGb: number;
    gpu: string;
  };
}

export interface RegistryResponse {
  activeProviderId: string;
  providers: ProviderItem[];
  hardware: {
    cpu: string;
    ramGb: number;
    gpu: string;
  };
  routerPolicy: {
    maxExternalCostBrl: number;
    preferLocal: boolean;
    enforcePrivacySanitization: boolean;
    allowPaidTier: boolean;
  };
  updatedAt: string;
}

export function AiProvidersView() {
  const [registry, setRegistry] = useState<RegistryResponse | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Estado do sandbox de diagnóstico
  const [diagLeadName, setDiagLeadName] = useState("Logística Express Brasil S.A.");
  const [diagCompany, setDiagCompany] = useState("Logística Express");
  const [diagInterest, setDiagInterest] = useState("Otimização de rotas e esteira de automação comercial");
  const [diagProvider, setDiagProvider] = useState<string>("");
  const [runningDiag, setRunningDiag] = useState(false);
  const [diagResult, setDiagResult] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const [reg, hist] = await Promise.all([
        api.getAiProviders(),
        api.getAiHistory(),
      ]);
      setRegistry(reg);
      setHistory(hist?.history ?? []);
    } catch (e: any) {
      setFeedback(`Erro ao carregar provedores: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    setFeedback(null);
    try {
      const res = await api.testAiProvider(id);
      setTestResult({ providerId: id, ...res });
      await loadData();
    } catch (e: any) {
      setTestResult({
        providerId: id,
        ok: false,
        status: "error",
        error: e.message,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleMovePriority = async (index: number, direction: "up" | "down") => {
    if (!registry) return;
    const list = [...registry.providers.map((p) => p.id)];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[index];
    const itemB = list[targetIdx];
    if (!itemA || !itemB) return;
    list[index] = itemB;
    list[targetIdx] = itemA;

    try {
      setLoading(true);
      const updated = await api.updateAiPriority(list);
      setRegistry(updated);
      setFeedback("Prioridade de provedores atualizada com sucesso.");
    } catch (e: any) {
      setFeedback(`Erro ao atualizar prioridade: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnosis = async () => {
    setRunningDiag(true);
    setDiagResult(null);
    setFeedback(null);
    try {
      const res = await api.diagnoseWithAi({
        lead: {
          name: diagLeadName,
          company: diagCompany,
          interest: diagInterest,
          synthetic: true,
        },
        preferredProvider: diagProvider || undefined,
        forceReal: Boolean(diagProvider && diagProvider !== "mock"),
      });
      setDiagResult(res);
      await loadData();
    } catch (e: any) {
      setFeedback(`Erro no diagnóstico: ${e.message}`);
    } finally {
      setRunningDiag(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <span className="badge green">LOCAL ATIVO</span>;
      case "credentialed":
        return <span className="badge cyan">DISPONÍVEL (FREE)</span>;
      case "service_ready_no_models":
        return <span className="badge gold">SERVIÇO ATIVO (SEM MODELOS)</span>;
      case "service_down":
        return <span className="badge dim">OFFLINE (LOCAL)</span>;
      case "blocked_no_credential":
        return <span className="badge gold">CHAVE NÃO CONFIGURADA</span>;
      case "blocked_unauthorized_expense":
        return <span className="badge red">BLOQUEADO (CUSTO R$ 0)</span>;
      default:
        return <span className="badge dim">{status}</span>;
    }
  };

  if (loading && !registry) {
    return (
      <div className="panel" style={{ padding: "2rem" }}>
        <h3>Central de Provedores de IA</h3>
        <p className="dim">Consultando barramento de inferência e hardware...</p>
      </div>
    );
  }

  return (
    <div className="onda14-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Banner de Cabeçalho */}
      <div className="panel" style={{ background: "linear-gradient(135deg, rgba(30,35,45,0.9), rgba(20,25,35,0.95))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#e2e8f0" }}>
              Central de Provedores de IA Real — Prioridade Gratuita
            </h2>
            <p style={{ margin: "0.4rem 0 0", color: "#94a3b8", fontSize: "0.88rem" }}>
              Homologação multiprovedor com prioridade local (Ollama), provedores gratuitos (Groq, Gemini, OpenRouter :free, Cloudflare) e salvaguarda orçamentária de R$ 0.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge green">Orçamento Externo: R$ 0,00</span>
            <span className="badge cyan">Provedor Ativo: {registry?.activeProviderId.toUpperCase() || "MOCK"}</span>
            <span className="badge iris">Isolamento LGPD Ativo</span>
          </div>
        </div>

        {/* Especificações de Hardware */}
        {registry?.hardware && (
          <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(0,0,0,0.25)", borderRadius: "6px", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#cbd5e1" }}>
            <div><strong>CPU:</strong> {registry.hardware.cpu}</div>
            <div><strong>Memória RAM:</strong> {registry.hardware.ramGb} GB</div>
            <div><strong>GPU / Acelerador:</strong> {registry.hardware.gpu}</div>
            <div><strong>Políticas:</strong> Preferir Local | Zero Tarifas | Sanitizar PII</div>
          </div>
        )}

        {feedback && (
          <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "4px", color: "#38bdf8", fontSize: "0.85rem" }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Grid de Provedores */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Matriz de Provedores e Resiliência</h3>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Ordem de prioridade determina a cadeia de fallback automático
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "0.6rem 0.5rem" }}>Prioridade</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Provedor</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Tipo</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Modelo Principal</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Tarifa Externa</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Privacidade</th>
                <th style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {registry?.providers.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.6rem 0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <span style={{ fontWeight: "bold", width: "1.2rem" }}>#{p.priority}</span>
                      <button
                        className="btn-tiny"
                        disabled={idx === 0 || p.id === "mock"}
                        onClick={() => handleMovePriority(idx, "up")}
                        title="Subir prioridade"
                      >
                        ▲
                      </button>
                      <button
                        className="btn-tiny"
                        disabled={idx >= (registry?.providers.length ?? 0) - 2 || p.id === "mock"}
                        onClick={() => handleMovePriority(idx, "down")}
                        title="Descer prioridade"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>
                    <strong>{p.name}</strong>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>ID: {p.id}</div>
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>
                    <span className={p.isLocal ? "badge cyan" : "badge dim"}>
                      {p.isLocal ? "Local" : "Nuvem"}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>{getStatusBadge(p.status)}</td>
                  <td style={{ padding: "0.6rem 0.5rem", fontFamily: "monospace", fontSize: "0.82rem" }}>
                    {p.model}
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>
                    <span className={p.costTier === "free" ? "badge green" : "badge red"}>
                      {p.costTier === "free" ? "R$ 0 (Gratuito)" : "Tarifado (Bloqueado)"}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem", fontSize: "0.8rem", color: "#94a3b8" }}>
                    {p.privacyTier === "local_confidential"
                      ? "Dados Locais Seguros"
                      : p.privacyTier === "synthetic_only"
                      ? "Apenas Sintéticos"
                      : "Transmissão Bloqueada"}
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                    <button
                      className="btn secondary"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                      disabled={testingId === p.id}
                      onClick={() => handleTestProvider(p.id)}
                    >
                      {testingId === p.id ? "Testando..." : "Testar Conexão"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resultado do Teste */}
        {testResult && (
          <div style={{ marginTop: "1rem", padding: "0.85rem", background: "rgba(15, 23, 42, 0.75)", border: "1px solid #334155", borderRadius: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <strong>Resultado do Teste: {testResult.provider} ({testResult.model})</strong>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span className={testResult.ok ? "badge green" : "badge red"}>
                  {testResult.ok ? "SUCESSO" : "FALHA / BLOQUEADO"}
                </span>
                <span className="badge dim">{testResult.latencyMs} ms</span>
              </div>
            </div>
            {testResult.error && (
              <p style={{ margin: 0, color: "#f87171", fontSize: "0.85rem" }}>
                {testResult.error}
              </p>
            )}
            {testResult.output && (
              <pre style={{ margin: "0.5rem 0 0", padding: "0.5rem", background: "#0f172a", borderRadius: "4px", fontSize: "0.8rem", color: "#38bdf8", overflowX: "auto" }}>
                {testResult.output}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Sandbox de Diagnóstico Comercial Meridian */}
      <div className="panel">
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>
          Sandbox de Diagnóstico Comercial do Meridian
        </h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Execute um diagnóstico comercial real supervisionado contra a rubrica ICP e a guarda de claims aprovados.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Nome do Lead / Empresa Alvo
            </label>
            <input
              type="text"
              className="input"
              style={{ width: "100%" }}
              value={diagLeadName}
              onChange={(e) => setDiagLeadName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Empresa / Razão Social
            </label>
            <input
              type="text"
              className="input"
              style={{ width: "100%" }}
              value={diagCompany}
              onChange={(e) => setDiagCompany(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Provedor de IA
            </label>
            <select
              className="input"
              style={{ width: "100%" }}
              value={diagProvider}
              onChange={(e) => setDiagProvider(e.target.value)}
            >
              <option value="">Roteamento Inteligente (Automático)</option>
              {registry?.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.isLocal ? "Local" : "Nuvem"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
            Sinais de Interesse / Contexto do Negócio
          </label>
          <textarea
            className="input"
            rows={2}
            style={{ width: "100%" }}
            value={diagInterest}
            onChange={(e) => setDiagInterest(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn primary"
            disabled={runningDiag}
            onClick={handleRunDiagnosis}
          >
            {runningDiag ? "Executando Diagnóstico..." : "Executar Diagnóstico Comercial"}
          </button>
        </div>

        {/* Resultado do Diagnóstico */}
        {diagResult && (
          <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(15, 23, 42, 0.9)", border: "1px solid #334155", borderRadius: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div>
                <h4 style={{ margin: 0, color: "#38bdf8" }}>Diagnóstico Emitido</h4>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  Provedor: <strong>{diagResult.provider}</strong> | Modelo: <strong>{diagResult.model}</strong> | Latência: {diagResult.latencyMs ?? 0}ms
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span className={diagResult.simulated ? "badge gold" : "badge green"}>
                  {diagResult.simulated ? "SIMULADO" : "INFERÊNCIA REAL"}
                </span>
                <span className={diagResult.isLocal ? "badge cyan" : "badge dim"}>
                  {diagResult.isLocal ? "LOCAL" : "NUVEM"}
                </span>
                <span className="badge green">Custo: R$ 0,00</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.88rem" }}>
              <div>
                <strong>Diagnóstico Comercial:</strong>
                <p style={{ margin: "0.25rem 0", color: "#f1f5f9" }}>{diagResult.diagnosis || diagResult.output}</p>
              </div>
              {diagResult.justification && (
                <div>
                  <strong>Justificativa da Rubrica:</strong>
                  <p style={{ margin: "0.25rem 0", color: "#cbd5e1" }}>{diagResult.justification}</p>
                </div>
              )}
              {diagResult.nextAction && (
                <div>
                  <strong>Próxima Ação Sugerida:</strong>
                  <p style={{ margin: "0.25rem 0", color: "#38bdf8" }}>{diagResult.nextAction}</p>
                </div>
              )}
              {diagResult.confidence !== undefined && (
                <div>
                  <strong>Grau de Confiança:</strong> {(diagResult.confidence * 100).toFixed(0)}%
                </div>
              )}
              {diagResult.rejectedReason && (
                <div style={{ color: "#f87171" }}>
                  <strong>Aviso de Guarda:</strong> {diagResult.rejectedReason}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Histórico e Auditoria de Inferências */}
      <div className="panel">
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>
          Histórico de Inferências e Auditoria Append-Only
        </h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Registro transparente de cada execução com carimbo de horário, modelo, tokens e modo de execução.
        </p>

        {history.length === 0 ? (
          <p className="dim" style={{ fontSize: "0.88rem" }}>Nenhuma inferência registrada nesta sessão.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "0.5rem" }}>Horário</th>
                  <th style={{ padding: "0.5rem" }}>Agente</th>
                  <th style={{ padding: "0.5rem" }}>Provedor</th>
                  <th style={{ padding: "0.5rem" }}>Modelo</th>
                  <th style={{ padding: "0.5rem" }}>Status</th>
                  <th style={{ padding: "0.5rem" }}>Tipo</th>
                  <th style={{ padding: "0.5rem" }}>Latência</th>
                  <th style={{ padding: "0.5rem" }}>Tokens</th>
                  <th style={{ padding: "0.5rem" }}>Custo</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map((log: any) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "0.5rem", color: "#94a3b8" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <strong>{log.agentId}</strong>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{log.provider}</td>
                    <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{log.model}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={log.status === "success" ? "badge green" : log.status === "fallback" ? "badge gold" : "badge red"}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={log.simulated ? "badge dim" : "badge cyan"}>
                        {log.simulated ? "SIMULADO" : "REAL"}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{log.latencyMs} ms</td>
                    <td style={{ padding: "0.5rem" }}>{log.tokensIn + log.tokensOut}</td>
                    <td style={{ padding: "0.5rem", color: "#4ade80" }}>R$ 0,00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
