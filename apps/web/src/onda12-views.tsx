import React, { useState, useEffect } from "react";
import { api } from "./api";

// =========================================================================
// 1. ICP DINÂMICO E VERSIONADO (Onda 12 / Fase 02)
// =========================================================================

export function IcpView() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileHistory, setProfileHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);

  // Formulário de novo perfil / nova versão
  const [showNewModal, setShowNewModal] = useState(false);
  const [isVersionMode, setIsVersionMode] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCnaes, setFormCnaes] = useState("62.01-5-01, 62.02-3-00, 70.20-4-00");
  const [formSizes, setFormSizes] = useState("EPP, MEDIO, GRANDE");
  const [formUfs, setFormUfs] = useState("SP, RJ, MG, PR, SC, RS");
  const [formChangeReason, setFormChangeReason] = useState("");

  // Comparação entre perfis
  const [compareModal, setCompareModal] = useState(false);
  const [compProfileA, setCompProfileA] = useState("");
  const [compProfileB, setCompProfileB] = useState("");
  const [compResult, setCompResult] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, activeRes] = await Promise.all([
        api.listIcpProfiles(statusFilter || undefined),
        api.getActiveIcp(),
      ]);
      setProfiles(listRes.profiles);
      setActiveProfile(activeRes);
      if (listRes.profiles[0] && !selectedProfile) {
        selectProfile(listRes.profiles[0]);
      }
    } catch (e) {
      setNotice(`Erro ao carregar perfis de ICP: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const selectProfile = async (p: any) => {
    setSelectedProfile(p);
    try {
      const detail = await api.getIcpProfile(p.id);
      setProfileHistory(detail.history);
    } catch {
      setProfileHistory([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isVersionMode && selectedProfile) {
        await api.versionIcpProfile(selectedProfile.id, {
          targetCnaes: formCnaes.split(",").map((s) => s.trim()),
          targetSizes: formSizes.split(",").map((s) => s.trim()),
          targetUfs: formUfs.split(",").map((s) => s.trim()),
          changeReason: formChangeReason || "Nova versão com ajuste de pesos e critérios",
        });
        setNotice(`Nova versão criada com sucesso para ${selectedProfile.name}`);
      } else {
        await api.createIcpProfile({
          name: formName,
          description: formDesc,
          targetCnaes: formCnaes.split(",").map((s) => s.trim()),
          targetSizes: formSizes.split(",").map((s) => s.trim()),
          targetUfs: formUfs.split(",").map((s) => s.trim()),
          changeReason: formChangeReason || "Perfil inicial",
        });
        setNotice(`Perfil de ICP '${formName}' criado com sucesso em modo rascunho.`);
      }
      setShowNewModal(false);
      loadData();
    } catch (err) {
      setNotice(`Falha: ${(err as Error).message}`);
    }
  };

  const handleSubmitApproval = async (id: string) => {
    try {
      const res = await api.submitIcpApproval(id);
      setNotice(`Perfil enviado para Central de Aprovações (ID: ${res.approval.id})`);
      loadData();
    } catch (err) {
      setNotice(`Falha ao submeter aprovação: ${(err as Error).message}`);
    }
  };

  const handleCompare = async () => {
    if (!compProfileA || !compProfileB) return;
    try {
      const res = await api.compareIcp({
        profileAId: compProfileA,
        profileBId: compProfileB,
      });
      setCompResult(res);
    } catch (err) {
      setNotice(`Falha na comparação: ${(err as Error).message}`);
    }
  };

  return (
    <div className="section icp-view">
      <div className="header-row">
        <div>
          <h2>ICP Comercial Dinâmico & Versionado</h2>
          <p className="subtitle">
            Critérios configuráveis para qualificação de empresas pelo Scout e Meridian.
          </p>
        </div>
        <div className="actions">
          <button
            className="btn secondary"
            onClick={() => {
              setCompareModal(true);
              if (profiles.length >= 2) {
                setCompProfileA(profiles[0].id);
                setCompProfileB(profiles[1].id);
              }
            }}
          >
            Comparar Versões
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setIsVersionMode(false);
              setFormName("");
              setFormDesc("");
              setFormChangeReason("");
              setShowNewModal(true);
            }}
          >
            + Novo Perfil ICP
          </button>
        </div>
      </div>

      {notice && (
        <div className="notice-banner" style={{ background: "rgba(0,255,200,0.1)", border: "1px solid var(--cyan)", padding: "10px", margin: "10px 0", borderRadius: "6px" }}>
          {notice}
          <button onClick={() => setNotice(null)} style={{ float: "right", background: "none", border: "none", color: "var(--cyan)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Alerta de Governança sobre Intenção de Compra */}
      <div className="card alert-card" style={{ borderLeft: "4px solid var(--accent)", background: "rgba(255,180,0,0.08)", marginBottom: "16px" }}>
        <strong>Regra de Governança:</strong> Toda pontuação de ICP reflete aderência heurística cadastral. Nenhuma métrica deve ser apresentada como evidência de intenção de compra.
      </div>

      {/* Perfil Ativo em Destaque */}
      {activeProfile && (
        <div className="card active-icp-card" style={{ borderColor: "var(--cyan)", background: "rgba(0,180,255,0.05)", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="badge success">PERFIL ATIVO NO SCOUT & MERIDIAN</span>
              <h3 style={{ margin: "6px 0" }}>{activeProfile.name} (Versão {activeProfile.version})</h3>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>{activeProfile.description}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Aprovado por: {activeProfile.approvedBy || "Sistema"}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Data: {new Date(activeProfile.approvedAt || activeProfile.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Lista de Perfis e Detalhes */}
      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Coluna Esquerda: Lista de Perfis */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4>Perfis Registrados ({profiles.length})</h4>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="">Todos os status</option>
              <option value="approved">Aprovados</option>
              <option value="draft">Rascunhos</option>
              <option value="pending_approval">Aguardando Aprovação</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>

          {loading ? (
            <p>Carregando perfis...</p>
          ) : (
            <div className="list-group">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={`list-item ${selectedProfile?.id === p.id ? "selected" : ""}`}
                  onClick={() => selectProfile(p)}
                  style={{
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    cursor: "pointer",
                    background: selectedProfile?.id === p.id ? "rgba(0,255,200,0.06)" : "transparent",
                    borderColor: selectedProfile?.id === p.id ? "var(--cyan)" : "var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{p.name}</strong>
                    <span className={`badge ${p.status === "approved" ? "success" : p.status === "pending_approval" ? "warning" : "muted"}`}>
                      v{p.version} · {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    CNAEs: {p.targetCnaes?.slice(0, 3).join(", ")} {p.targetCnaes?.length > 3 ? `(+${p.targetCnaes.length - 3})` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna Direita: Detalhe do Perfil Selecionado */}
        {selectedProfile && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3>{selectedProfile.name} <small style={{ color: "var(--cyan)" }}>v{selectedProfile.version}</small></h3>
                <span className={`badge ${selectedProfile.status === "approved" ? "success" : "warning"}`}>
                  {selectedProfile.status}
                </span>
              </div>
              <div className="actions">
                {selectedProfile.status === "draft" && (
                  <button className="btn primary small" onClick={() => handleSubmitApproval(selectedProfile.id)}>
                    Submeter p/ Aprovação
                  </button>
                )}
                <button
                  className="btn secondary small"
                  onClick={() => {
                    setIsVersionMode(true);
                    setFormCnaes(selectedProfile.targetCnaes?.join(", ") || "");
                    setFormSizes(selectedProfile.targetSizes?.join(", ") || "");
                    setFormUfs(selectedProfile.targetUfs?.join(", ") || "");
                    setFormChangeReason("");
                    setShowNewModal(true);
                  }}
                >
                  + Nova Versão
                </button>
              </div>
            </div>

            <p style={{ marginTop: "10px", color: "var(--text-muted)" }}>{selectedProfile.description || "Sem descrição."}</p>

            <div style={{ margin: "16px 0" }}>
              <strong>Pesos Configuráveis:</strong>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <span className="pill">CNAE: {selectedProfile.weights?.cnae ?? 30}%</span>
                <span className="pill">Porte: {selectedProfile.weights?.size ?? 25}%</span>
                <span className="pill">Localização: {selectedProfile.weights?.location ?? 20}%</span>
                <span className="pill">Operação Ativa: {selectedProfile.weights?.operation ?? 25}%</span>
              </div>
            </div>

            <div style={{ margin: "16px 0" }}>
              <strong>Segmentos e CNAEs Alvo:</strong>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                {selectedProfile.targetCnaes?.join(", ") || "Nenhum CNAE cadastrado"}
              </div>
            </div>

            <div style={{ margin: "16px 0" }}>
              <strong>Portes e Estados (UFs):</strong>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                Portes: {selectedProfile.targetSizes?.join(", ")} | UFs: {selectedProfile.targetUfs?.join(", ")}
              </div>
            </div>

            <div style={{ margin: "16px 0" }}>
              <strong>Regras de Exclusão Automática:</strong>
              <ul style={{ margin: "4px 0", paddingLeft: "20px", fontSize: "13px" }}>
                {selectedProfile.exclusions?.map((exc: any) => (
                  <li key={exc.id}><strong>{exc.name}</strong>: {exc.reason}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <strong>Histórico de Alterações e Auditoria:</strong>
              {profileHistory.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nenhuma alteração registrada.</p>
              ) : (
                <ul style={{ fontSize: "12px", paddingLeft: "16px", marginTop: "6px" }}>
                  {profileHistory.map((h) => (
                    <li key={h.id}>
                      <strong>{h.action}</strong> por {h.actor} em {new Date(h.occurredAt).toLocaleString()}
                      {h.reason && ` — "${h.reason}"`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Novo Perfil / Nova Versão */}
      {showNewModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card modal-card" style={{ width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{isVersionMode ? `Criar Versão ${selectedProfile.version + 1} de ${selectedProfile.name}` : "Criar Novo Perfil de ICP"}</h3>
            <form onSubmit={handleCreate}>
              {!isVersionMode && (
                <>
                  <label>Nome do Perfil</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: SaaS e Fintechs B2B"
                    className="input-field"
                  />
                  <label>Descrição</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Objetivo comercial deste perfil..."
                    className="input-field"
                  />
                </>
              )}

              <label>CNAEs Prioritários (separados por vírgula)</label>
              <input
                type="text"
                value={formCnaes}
                onChange={(e) => setFormCnaes(e.target.value)}
                className="input-field"
              />

              <label>Portes Alvo</label>
              <input
                type="text"
                value={formSizes}
                onChange={(e) => setFormSizes(e.target.value)}
                className="input-field"
              />

              <label>Estados / Regiões (UFs)</label>
              <input
                type="text"
                value={formUfs}
                onChange={(e) => setFormUfs(e.target.value)}
                className="input-field"
              />

              <label>Justificativa da Versão / Regras</label>
              <input
                type="text"
                required
                value={formChangeReason}
                onChange={(e) => setFormChangeReason(e.target.value)}
                placeholder="Motivo da criação ou atualização..."
                className="input-field"
              />

              <div className="actions" style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary">{isVersionMode ? "Publicar Nova Versão (Draft)" : "Criar Perfil (Draft)"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Comparação de Versões */}
      {compareModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card modal-card" style={{ width: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Comparador de Versões de ICP</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "12px 0" }}>
              <div>
                <label>Perfil A</label>
                <select value={compProfileA} onChange={(e) => setCompProfileA(e.target.value)} className="select-input">
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Perfil B</label>
                <select value={compProfileB} onChange={(e) => setCompProfileB(e.target.value)} className="select-input">
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn primary" onClick={handleCompare}>Executar Comparação Heurística</button>

            {compResult && (
              <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                <h4>Resultado da Comparação</h4>
                <p>Empresa de Teste: <strong>{compResult.company.razaoSocial}</strong> ({compResult.company.cnpj})</p>
                <div style={{ display: "flex", gap: "20px", margin: "10px 0" }}>
                  <div className="card" style={{ flex: 1 }}>
                    <h5>{compResult.profileA.name} v{compResult.profileA.version}</h5>
                    <div style={{ fontSize: "24px", color: "var(--cyan)" }}>{compResult.profileA.score}/100</div>
                  </div>
                  <div className="card" style={{ flex: 1 }}>
                    <h5>{compResult.profileB.name} v{compResult.profileB.version}</h5>
                    <div style={{ fontSize: "24px", color: compResult.scoreDifference >= 0 ? "var(--green)" : "var(--accent)" }}>
                      {compResult.profileB.score}/100 ({compResult.scoreDifference >= 0 ? `+${compResult.scoreDifference}` : compResult.scoreDifference})
                    </div>
                  </div>
                </div>
                {compResult.reasonsAdded.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--green)" }}>Novos critérios pontuados:</strong>
                    <ul>{compResult.reasonsAdded.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}
                {compResult.reasonsRemoved.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--accent)" }}>Critérios descontinuados:</strong>
                    <ul>{compResult.reasonsRemoved.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button className="btn secondary" onClick={() => { setCompareModal(false); setCompResult(null); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. CENTRAL DE COMUNICAÇÃO SUPERVISIONADA & SANDBOX (Onda 12 / Fase 05)
// =========================================================================

export function CommunicationView() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [scenario, setScenario] = useState<string>("success");
  const [customRecipient, setCustomRecipient] = useState<string>("contato@empresa-sintetica.com.br");
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [draftsRes, dispatchesRes] = await Promise.all([
        api.listCommunicationDrafts(),
        api.listCommunicationDispatches(),
      ]);
      setDrafts(draftsRes.drafts);
      setDispatches(dispatchesRes.dispatches);
      if (draftsRes.drafts[0] && !selectedDraft) {
        setSelectedDraft(draftsRes.drafts[0]);
      }
    } catch (e) {
      setNotice(`Erro ao carregar dados de comunicação: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSimulatedDispatch = async () => {
    if (!selectedDraft) return;
    try {
      const res = await api.dispatchCommunicationSandbox({
        draftId: selectedDraft.id,
        opportunityId: selectedDraft.opportunityId,
        channel: selectedDraft.channel,
        recipient: customRecipient,
        subject: selectedDraft.subject || `Proposta Comercial — ${selectedDraft.companyId}`,
        content: selectedDraft.text,
        scenario,
      });
      setSimulationResult(res);
      setNotice(`Disparo simulado executado com status: ${res.dispatch.status}`);
      loadData();
    } catch (err) {
      setNotice(`Erro na simulação: ${(err as Error).message}`);
    }
  };

  return (
    <div className="section communication-view">
      <div className="header-row">
        <div>
          <h2>Central de Comunicação Supervisionada & Sandbox</h2>
          <p className="subtitle">
            Gestão de abordagens personalizadas e ambiente isolado de testes de envio.
          </p>
        </div>
      </div>

      {notice && (
        <div className="notice-banner" style={{ background: "rgba(0,255,200,0.1)", border: "1px solid var(--cyan)", padding: "10px", margin: "10px 0", borderRadius: "6px" }}>
          {notice}
          <button onClick={() => setNotice(null)} style={{ float: "right", background: "none", border: "none", color: "var(--cyan)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Banner de Segurança do Sandbox */}
      <div className="card alert-card" style={{ borderLeft: "4px solid var(--cyan)", background: "rgba(0,180,255,0.06)", marginBottom: "16px" }}>
        <strong>Sandbox 100% Simulado:</strong> O Birthub Growth Office não efetua envios externos reais na Onda 12. O policy engine bloqueia <code>channel.send</code> e todos os testes são gravados no sandbox para auditoria e teste de falhas controladas.
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Coluna Esquerda: Rascunhos por Oportunidade */}
        <div className="card">
          <h4>Rascunhos de Abordagem ({drafts.length})</h4>
          {loading ? (
            <p>Carregando rascunhos...</p>
          ) : drafts.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhum rascunho de abordagem gerado ainda.</p>
          ) : (
            <div className="list-group">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className={`list-item ${selectedDraft?.id === d.id ? "selected" : ""}`}
                  onClick={() => setSelectedDraft(d)}
                  style={{
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    cursor: "pointer",
                    background: selectedDraft?.id === d.id ? "rgba(0,255,200,0.06)" : "transparent",
                    borderColor: selectedDraft?.id === d.id ? "var(--cyan)" : "var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{d.subject || "Sem assunto"}</strong>
                    <span className={`badge ${d.status === "approved" ? "success" : "muted"}`}>
                      {d.channel} · {d.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Claims aprovados vinculados: {d.claimRefs?.join(", ") || "Nenhum"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna Direita: Prévia e Simulador do Sandbox */}
        {selectedDraft ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4>Prévia da Mensagem (Beacon)</h4>
              <span className={`badge ${selectedDraft.status === "approved" ? "success" : "warning"}`}>
                {selectedDraft.status}
              </span>
            </div>

            <div style={{ margin: "12px 0", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", whiteSpace: "pre-wrap" }}>
              {selectedDraft.text}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "14px" }}>
              <h5>Simulador de Disparo (Sandbox)</h5>
              <div style={{ margin: "8px 0" }}>
                <label>Destinatário de Teste (Sintético)</label>
                <input
                  type="text"
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "6px" }}
                />
              </div>

              <div style={{ margin: "8px 0" }}>
                <label>Cenário de Teste / Falha</label>
                <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="select-input" style={{ width: "100%" }}>
                  <option value="success">Sucesso Simulado (Entrega mock normal)</option>
                  <option value="network_timeout">Falha de Timeout de Rede (Simulado)</option>
                  <option value="bounce">Falha de Rejeição / Bounce (Simulado)</option>
                  <option value="rate_limit">Excesso de Cota / Rate Limit (Simulado)</option>
                  <option value="suppressed">Destinatário em Lista de Opt-out / Supressão</option>
                  <option value="unauthorized">Tentativa de Envio sem Rascunho Aprovado</option>
                </select>
              </div>

              <button className="btn primary" onClick={handleSimulatedDispatch} style={{ marginTop: "10px", width: "100%" }}>
                Simular Disparo via Sandbox
              </button>
            </div>

            {simulationResult && (
              <div style={{ marginTop: "14px", padding: "10px", background: "rgba(0,255,200,0.05)", border: "1px solid var(--cyan)", borderRadius: "6px" }}>
                <strong>Resultado da Simulação:</strong>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  Status: <code>{simulationResult.dispatch.status}</code> | Idempotente: <code>{String(simulationResult.duplicated)}</code>
                </div>
                {simulationResult.dispatch.errorReason && (
                  <div style={{ fontSize: "12px", color: "var(--accent)", marginTop: "4px" }}>
                    Motivo: {simulationResult.dispatch.errorReason}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Headers Sandbox: <code>{JSON.stringify(simulationResult.simulatedPayload.headers)}</code>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card muted" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            Selecione um rascunho de comunicação à esquerda.
          </div>
        )}
      </div>

      {/* Histórico de Disparos Simulados no Sandbox */}
      <div className="card" style={{ marginTop: "20px" }}>
        <h4>Disparos Registrados no Sandbox ({dispatches.length})</h4>
        {dispatches.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Nenhum disparo de teste registrado.</p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Canal</th>
                <th>Destinatário</th>
                <th>Status Sandbox</th>
                <th>Operador</th>
                <th>CorrelationId</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleTimeString()}</td>
                  <td><span className="badge">{d.channel}</span></td>
                  <td>{d.recipient}</td>
                  <td>
                    <span className={`badge ${d.status === "sent_simulated" ? "success" : "accent"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td>{d.dispatchedBy}</td>
                  <td><code>{d.correlationId.slice(0, 8)}…</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 3. GOVERNANÇA DA OFERTA COMERCIAL (Onda 12 / Fase 06)
// =========================================================================

export function OfferCatalogView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);

  const [newModal, setNewModal] = useState(false);
  const [newCat, setNewCat] = useState("feature");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newEvidence, setNewEvidence] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.listOfferCatalog(categoryFilter || undefined);
      setItems(res.items);
    } catch (e) {
      setNotice(`Erro ao carregar catálogo: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createOfferItem({
        category: newCat,
        title: newTitle,
        content: newContent,
        ...(newEvidence.trim() ? { evidenceUrl: newEvidence.trim() } : {}),
      });
      setNotice(`Alegação '${newTitle}' criada com status 'pending_validation'`);
      setNewModal(false);
      setNewTitle("");
      setNewContent("");
      setNewEvidence("");
      loadData();
    } catch (err) {
      setNotice(`Falha: ${(err as Error).message}`);
    }
  };

  const handleReview = async (id: string, decision: "approved" | "rejected") => {
    try {
      await api.reviewOfferItem(id, decision);
      setNotice(`Alegação ${decision === "approved" ? "aprovada" : "rejeitada"} com sucesso.`);
      loadData();
    } catch (err) {
      setNotice(`Falha ao revisar alegação: ${(err as Error).message}`);
    }
  };

  return (
    <div className="section offer-view">
      <div className="header-row">
        <div>
          <h2>Governança da Oferta Comercial (Birthub 360°)</h2>
          <p className="subtitle">
            Base oficial de alegações, funcionalidades e diferenciais aprovados para uso pelo Beacon e Meridian.
          </p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setNewModal(true)}>+ Nova Alegação</button>
        </div>
      </div>

      {notice && (
        <div className="notice-banner" style={{ background: "rgba(0,255,200,0.1)", border: "1px solid var(--cyan)", padding: "10px", margin: "10px 0", borderRadius: "6px" }}>
          {notice}
          <button onClick={() => setNotice(null)} style={{ float: "right", background: "none", border: "none", color: "var(--cyan)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Regra de Governança */}
      <div className="card alert-card" style={{ borderLeft: "4px solid var(--cyan)", background: "rgba(0,200,255,0.06)", marginBottom: "16px" }}>
        <strong>Proteção de Marca e Compliance:</strong> Somente itens com status <code>approved</code> podem ser citados em minutas comerciais. Alegações com status <code>pending_validation</code> bloqueiam o rascunho de abordagem do Beacon até homologação formal.
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4>Itens do Catálogo ({items.length})</h4>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select-input">
            <option value="">Todas as categorias</option>
            <option value="value_prop">Proposta de Valor</option>
            <option value="feature">Funcionalidades</option>
            <option value="differentiator">Diferenciais</option>
            <option value="target_audience">Público-Alvo</option>
            <option value="contract_term">Condições de Contrato</option>
            <option value="objection_response">Respostas a Objeções</option>
          </select>
        </div>

        {loading ? (
          <p>Carregando catálogo...</p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Título</th>
                <th>Conteúdo Aprovado</th>
                <th>Status</th>
                <th>Versão</th>
                <th>Ações de Compliance</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><span className="badge">{item.category}</span></td>
                  <td><strong>{item.title}</strong></td>
                  <td style={{ maxWidth: "300px" }}>{item.content}</td>
                  <td>
                    <span className={`badge ${item.status === "approved" ? "success" : item.status === "pending_validation" ? "warning" : "accent"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td><code>{item.version}</code></td>
                  <td>
                    {item.status === "pending_validation" && (
                      <div className="actions" style={{ display: "flex", gap: "6px" }}>
                        <button className="btn primary small" onClick={() => handleReview(item.id, "approved")}>Aprovar</button>
                        <button className="btn secondary small" onClick={() => handleReview(item.id, "rejected")}>Rejeitar</button>
                      </div>
                    )}
                    {item.status === "approved" && (
                      <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Aprovado ({item.approvedBy})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {newModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card modal-card" style={{ width: "500px" }}>
            <h3>Nova Alegação Comercial</h3>
            <form onSubmit={handleCreate}>
              <label>Categoria</label>
              <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="select-input">
                <option value="feature">Funcionalidade Comprovada</option>
                <option value="value_prop">Proposta de Valor</option>
                <option value="differentiator">Diferencial Comercial</option>
                <option value="contract_term">Condição Contratual Autorizada</option>
                <option value="objection_response">Resposta a Objeção</option>
              </select>

              <label>Título da Alegação</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Auditoria append-only em tempo real"
                className="input-field"
              />

              <label>Conteúdo Exato Autorizado</label>
              <textarea
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Texto que o Beacon e Meridian poderão citar..."
                className="input-field"
              />

              <label>URL / Documento de Evidência</label>
              <input
                type="text"
                value={newEvidence}
                onChange={(e) => setNewEvidence(e.target.value)}
                placeholder="https://docs.birthub.interno/compliance/..."
                className="input-field"
              />

              <div className="actions" style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn secondary" onClick={() => setNewModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Submeter p/ Validação</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
