import { useState } from "react";
import { useAsync } from "./hooks";
import { api, type OpportunityRecord, type ScoutCompany } from "./api";

const REVIEW_LABEL: Record<string, string> = {
  pending: "pendente",
  approved: "aprovada",
  rejected: "rejeitada",
  archived: "arquivada",
};

const REVIEW_BADGE: Record<string, string> = {
  pending: "gold",
  approved: "green",
  rejected: "red",
  archived: "dim",
};

const STAGE_BADGE: Record<string, string> = {
  approved_target: "cyan",
  researching: "iris",
  qualifying: "gold",
  qualified: "green",
  outreach_drafted: "magenta",
  awaiting_approval: "magenta",
  followup_planned: "cyan",
  nurture: "gold",
  won: "green",
  lost: "red",
  archived: "dim",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "dim",
  normal: "cyan",
  high: "gold",
  critical: "magenta",
};

const SAMPLE_SCOUT_CSV = [
  "cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf",
  "11.222.333/0001-81,ALFA SISTEMAS B2B LTDA,Alfa Cloud,6201-5/01,MEDIO,ATIVA,Sao Paulo,SP",
  "11.444.777/0001-61,BETA ANALYTICS SOFTWARE S.A.,Beta Data,6202-3/00,DEMAIS,ATIVA,Curitiba,PR",
  "60.746.948/0001-12,GAMMA GESTAO EMPRESARIAL LTDA,Gamma Ops,6311-9/00,EPP,ATIVA,Belo Horizonte,MG",
].join("\n");

function Dossier({
  company,
  onClose,
  onReviewed,
  onOpenPipeline,
}: {
  company: ScoutCompany;
  onClose: () => void;
  onReviewed: () => void;
  onOpenPipeline?: (opportunityId?: string) => void;
}) {
  const detail = useAsync(() => api.scoutCompany(company.id), [company.id]);
  const [justification, setJustification] = useState(
    "Aderência confirmada ao ICP na Central Scout — promover para prospecção comercial supervisionada",
  );
  const [requireApproval, setRequireApproval] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const d = detail.data?.company ?? company;
  const opp = detail.data?.opportunity ?? null;

  const doReview = async (decision: "approved" | "rejected" | "archived") => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await api.scoutReview(d.id, decision, reviewReason.trim() || undefined);
      setStatusMsg(`Revisão registrada: ${REVIEW_LABEL[decision]}.`);
      detail.reload();
      onReviewed();
    } catch (e) {
      setStatusMsg(`Erro ao revisar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doPromote = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const r = await api.promoteCompanyToOpportunity(d.id, {
        justification,
        requireApproval,
      });
      if (r.queuedForApproval) {
        setStatusMsg(
          `Promoção enviada para a Central de Aprovações (ID ${r.approval?.id.slice(0, 10)}…).`,
        );
      } else if (r.duplicate) {
        setStatusMsg(
          `Idempotência verificada: oportunidade comercial ${r.opportunity?.id} já existe para esta empresa — nenhuma duplicação criada.`,
        );
      } else {
        setStatusMsg(
          `Oportunidade comercial ${r.opportunity?.id} criada no estágio ${r.opportunity?.stage} (correlação ${r.correlationId.slice(0, 8)}…).`,
        );
      }
      detail.reload();
      onReviewed();
    } catch (e) {
      setStatusMsg(`Erro ao criar oportunidade: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" data-testid="scout-dossier" style={{ borderColor: "var(--cyan)", marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Dossiê: {d.razaoSocial}</h3>
        <button className="btn secondary small" onClick={onClose}>
          fechar dossiê
        </button>
      </div>
      <p className="mono muted">
        CNPJ {d.cnpj} · score ICP {d.score}/100 ({d.scoreVersion}) · fonte {d.fonte}
        {d.batchId ? ` · lote ${d.batchId}` : ""} · importado {new Date(d.importadoEm).toLocaleString("pt-BR")}
      </p>
      <p className="muted">
        {[
          d.nomeFantasia && `Fantasia: ${d.nomeFantasia}`,
          d.cnae && `CNAE ${d.cnae}`,
          d.porte && `Porte ${d.porte}`,
          d.situacao && `Situação ${d.situacao}`,
          [d.municipio, d.uf].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" · ") || "Sem metadados cadastrais adicionais"}
      </p>

      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div>
          <h4>Evidências de aderência ICP ({d.reasons.length})</h4>
          <ul>
            {d.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {d.reasons.length === 0 && <p className="muted">Nenhuma evidência positiva pontuada.</p>}
        </div>
        <div>
          <h4>Lacunas identificadas ({d.gaps.length})</h4>
          <ul>
            {d.gaps.map((g, i) => (
              <li key={i} className="muted">
                {g}
              </li>
            ))}
          </ul>
          {d.gaps.length === 0 && <p className="muted">Sem lacunas cadastrais registradas.</p>}
        </div>
      </div>

      <div className="card" style={{ background: "var(--surface-alt)", marginBottom: 12 }}>
        <h4>Revisão e Promoção para Oportunidade Comercial (G116 / Onda 11)</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span>
            Status atual: <span className={`badge ${REVIEW_BADGE[d.reviewStatus] ?? "dim"}`}>{REVIEW_LABEL[d.reviewStatus]}</span>
          </span>
          <input
            placeholder="Observação / motivo da revisão"
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <button className="btn small" disabled={busy} onClick={() => doReview("approved")}>
            aprovar empresa
          </button>
          <button className="btn secondary small" disabled={busy} onClick={() => doReview("rejected")}>
            rejeitar
          </button>
          <button className="btn secondary small" disabled={busy} onClick={() => doReview("archived")}>
            arquivar
          </button>
        </div>

        <div style={{ borderTop: "1px dashed #33333f", paddingTop: 10, display: "grid", gap: 8 }}>
          <label className="muted" style={{ fontSize: 12 }}>
            Justificativa comercial para promover ao Pipeline (nenhum contato pessoal fictício será criado):
          </label>
          <input
            data-testid="dossier-opportunity-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Justificativa comercial auditável"
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
              />
              Solicitar autorização prévia na Central de Aprovações
            </label>
            <button
              className="btn"
              data-testid="dossier-create-opportunity"
              disabled={busy || d.reviewStatus !== "approved"}
              onClick={doPromote}
            >
              Criar oportunidade comercial
            </button>
            {opp && (
              <>
                <span className="badge green" data-testid="dossier-existing-opp">
                  Oportunidade vinculada: {opp.id.slice(0, 12)} ({opp.stage})
                </span>
                {onOpenPipeline && (
                  <button className="btn secondary small" onClick={() => onOpenPipeline(opp.id)}>
                    Abrir no Pipeline →
                  </button>
                )}
              </>
            )}
          </div>
          {d.reviewStatus !== "approved" && (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              ⚠️ Regra de governança: uma empresa importada não é automaticamente um lead ou oportunidade. Aprove a empresa primeiro para liberar a criação de oportunidade comercial.
            </p>
          )}
          {statusMsg && (
            <p data-testid="dossier-status-msg" style={{ color: "var(--cyan)", margin: 0 }}>
              {statusMsg}
            </p>
          )}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12 }}>
        Score é heurística determinística sobre campos cadastrais — não é diagnóstico de IA nem evidência de intenção de compra.
        Empresa importada não é lead: somente revisão humana aprova para análise comercial.
      </p>

      {detail.data && (
        <>
          <h4>Histórico Auditável da Empresa</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th>Ator</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {detail.data.history.map((h, idx) => (
                  <tr key={h.occurredAt + h.action + idx}>
                    <td className="mono muted">{new Date(h.occurredAt).toLocaleString("pt-BR")}</td>
                    <td className="mono">{h.action}</td>
                    <td className="muted">{h.actor}</td>
                    <td>{h.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function ScoutView({ onOpenPipeline }: { onOpenPipeline?: (opportunityId?: string) => void }) {
  const [csv, setCsv] = useState("");
  const [fonte, setFonte] = useState("csv-licenciado-operador");
  const [filters, setFilters] = useState<Record<string, string>>({
    reviewStatus: "",
    uf: "",
    minScore: "",
    q: "",
    page: "1",
    pageSize: "10",
  });
  const [selected, setSelected] = useState<ScoutCompany | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const companies = useAsync(() => api.scoutCompanies(filters), [JSON.stringify(filters)]);
  const batches = useAsync(() => api.scoutImports());

  const doImport = async () => {
    setNotice(null);
    try {
      const r = await api.scoutImport(csv, fonte || "csv-upload");
      setNotice(
        `Importação: ${r.imported} novas, ${r.duplicates} duplicadas, ${r.rejected.length} rejeitadas. Persistidas: ${r.persisted.inserted}.`,
      );
      setCsv("");
      companies.reload();
      batches.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    }
  };

  const review = async (c: ScoutCompany, decision: "approved" | "rejected" | "archived") => {
    setBusyId(c.id);
    setNotice(null);
    try {
      const reason =
        decision === "approved"
          ? "Aprovada na Central Scout para prospecção comercial"
          : "Rejeitada na triagem cadastral da Central Scout";
      await api.scoutReview(c.id, decision, reason);
      setNotice(`Empresa ${c.razaoSocial} marcada como ${REVIEW_LABEL[decision]} — registrado na auditoria.`);
      companies.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const createOpportunityFromRow = async (c: ScoutCompany) => {
    setBusyId(c.id);
    setNotice(null);
    try {
      const r = await api.promoteCompanyToOpportunity(c.id, {
        justification: `Promoção direta na Central Scout para ${c.razaoSocial} (score ICP ${c.score}/100)`,
      });
      if (r.duplicate) {
        setNotice(
          `Idempotente: oportunidade comercial ${r.opportunity?.id} já existe para ${c.razaoSocial} — nenhuma duplicação criada.`,
        );
      } else if (r.queuedForApproval) {
        setNotice(`Solicitação enviada para a Central de Aprovações (${r.approval?.id}).`);
      } else {
        setNotice(
          `Oportunidade comercial criada (${r.opportunity?.id}) para ${c.razaoSocial} com estágio inicial '${r.opportunity?.stage}'.`,
        );
      }
      companies.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const setF = (k: string, v: string) =>
    setFilters((f) => ({ ...f, [k]: v, ...(k !== "page" ? { page: "1" } : {}) }));

  const page = companies.data?.page ?? 1;
  const pageSize = companies.data?.pageSize ?? 10;
  const total = companies.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Importar empresas (CSV autorizado)</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Cole o CSV com colunas <span className="mono">cnpj, razao_social</span> (recomendado: nome_fantasia, cnae, porte, situacao, municipio, uf).
          CNPJ validado por dígitos verificadores; dedup por CNPJ; limite 2MB/5000 linhas. Nenhum dado pessoal de sócios.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Fonte/origem da autorização (ex.: csv-licenciado-operador)"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button
              type="button"
              className="btn secondary small"
              data-testid="scout-load-sample"
              onClick={() => setCsv(SAMPLE_SCOUT_CSV)}
            >
              Carregar CSV sintético exemplo
            </button>
          </div>
          <textarea
            rows={5}
            data-testid="scout-csv-input"
            placeholder={"cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            style={{ fontFamily: "monospace" }}
          />
          <div>
            <button className="btn" data-testid="scout-import-btn" onClick={doImport} disabled={!csv.trim()}>
              Importar
            </button>
          </div>
        </div>
        {notice && (
          <p data-testid="scout-notice" style={{ color: "var(--cyan)", marginTop: 10 }}>
            {notice}
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Lotes de Importação</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Fonte</th>
                <th>Importadas</th>
                <th>Duplicadas</th>
                <th>Rejeitadas</th>
                <th>Por</th>
              </tr>
            </thead>
            <tbody>
              {(batches.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="mono muted">{new Date(b.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="mono">{b.fonte}</td>
                  <td>{b.imported}</td>
                  <td>{b.duplicates}</td>
                  <td>{b.rejected}</td>
                  <td className="muted">{b.importedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(batches.data ?? []).length && <p className="muted">Nenhuma importação ainda.</p>}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Empresas identificadas ({total})</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            placeholder="Buscar razão social / fantasia / CNPJ"
            data-testid="scout-filter-q"
            value={filters.q ?? ""}
            onChange={(e) => setF("q", e.target.value)}
            style={{ minWidth: 200 }}
          />
          <select
            data-testid="scout-filter-status"
            value={filters.reviewStatus}
            onChange={(e) => setF("reviewStatus", e.target.value)}
          >
            <option value="">todos status</option>
            <option value="pending">pendentes</option>
            <option value="approved">aprovadas</option>
            <option value="rejected">rejeitadas</option>
            <option value="archived">arquivadas</option>
          </select>
          <input
            placeholder="UF"
            data-testid="scout-filter-uf"
            style={{ width: 70 }}
            value={filters.uf}
            onChange={(e) => setF("uf", e.target.value)}
          />
          <input
            placeholder="score mín."
            data-testid="scout-filter-minscore"
            style={{ width: 95 }}
            value={filters.minScore}
            onChange={(e) => setF("minScore", e.target.value)}
          />
          <a className="btn secondary small" href={api.scoutExportUrl("approved")} style={{ alignSelf: "center" }}>
            exportar aprovadas (CSV)
          </a>
        </div>

        <div className="table-wrap">
          <table data-testid="scout-companies-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Local</th>
                <th>Score</th>
                <th>Status</th>
                <th>Pipeline</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(companies.data?.items ?? []).map((c) => (
                <tr key={c.id} data-testid={`scout-row-${c.cnpj}`}>
                  <td>
                    <b>{c.razaoSocial}</b>
                    {c.nomeFantasia ? <span className="muted"> · {c.nomeFantasia}</span> : null}
                  </td>
                  <td className="mono muted">{c.cnpj}</td>
                  <td className="muted">{[c.municipio, c.uf].filter(Boolean).join("/") || "—"}</td>
                  <td>
                    <b>{c.score}</b>/100
                  </td>
                  <td>
                    <span className={`badge ${REVIEW_BADGE[c.reviewStatus] ?? "cyan"}`}>
                      {REVIEW_LABEL[c.reviewStatus]}
                    </span>
                  </td>
                  <td>
                    {c.opportunityId ? (
                      <span className="badge green" data-testid={`scout-opp-badge-${c.cnpj}`}>
                        {c.opportunityStage ?? "no pipeline"}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn secondary small"
                      data-testid={`scout-dossier-btn-${c.cnpj}`}
                      onClick={() => setSelected(c)}
                    >
                      dossiê
                    </button>{" "}
                    {c.reviewStatus === "pending" && (
                      <>
                        <button
                          className="btn small"
                          data-testid={`scout-approve-btn-${c.cnpj}`}
                          disabled={busyId === c.id}
                          onClick={() => review(c, "approved")}
                        >
                          aprovar
                        </button>{" "}
                        <button
                          className="btn secondary small"
                          data-testid={`scout-reject-btn-${c.cnpj}`}
                          disabled={busyId === c.id}
                          onClick={() => review(c, "rejected")}
                        >
                          rejeitar
                        </button>
                      </>
                    )}
                    {c.reviewStatus === "approved" && (
                      <>
                        <button
                          className="btn small"
                          data-testid={`scout-create-opp-btn-${c.cnpj}`}
                          disabled={busyId === c.id}
                          onClick={() => createOpportunityFromRow(c)}
                        >
                          Criar oportunidade comercial
                        </button>{" "}
                        {c.opportunityId && onOpenPipeline && (
                          <button
                            className="btn secondary small"
                            onClick={() => onOpenPipeline(c.opportunityId)}
                          >
                            Pipeline →
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <span className="muted">
            {total} empresas · página {page} de {totalPages} · dados importados/verificados ≠ inferência de compra
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn secondary small"
              disabled={page <= 1}
              onClick={() => setF("page", String(page - 1))}
            >
              ← Anterior
            </button>
            <button
              className="btn secondary small"
              disabled={page >= totalPages}
              onClick={() => setF("page", String(page + 1))}
            >
              Próxima →
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <Dossier
          company={selected}
          onClose={() => setSelected(null)}
          onReviewed={() => companies.reload()}
          {...(onOpenPipeline ? { onOpenPipeline } : {})}
        />
      )}
    </>
  );
}

// ================================================================ PIPELINE COMERCIAL (FASE 04)

function OpportunityDetailPanel({
  opportunityId,
  onClose,
  onUpdated,
}: {
  opportunityId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const detail = useAsync(() => api.opportunity(opportunityId), [opportunityId]);
  const [toStage, setToStage] = useState("");
  const [stageReason, setStageReason] = useState("");
  const [stageRequireApproval, setStageRequireApproval] = useState(false);
  const [priority, setPriority] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const data = detail.data;
  if (detail.loading && !data) {
    return <div className="card loading">Carregando detalhes da oportunidade…</div>;
  }
  if (detail.error || !data) {
    return (
      <div className="card error-box">
        Erro ao carregar oportunidade: {detail.error ?? "não encontrada"}{" "}
        <button className="btn secondary small" onClick={onClose}>
          fechar
        </button>
      </div>
    );
  }

  const { opportunity: opp, company, history, mission, tasks, runs, drafts, approvals, validTransitions, maxDirectPriority, stageLabels } = data;

  const handleRunMission = async (forceNew = false) => {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await api.runOpportunityMission(opp.id, { forceNew });
      setFeedback(
        `Missão comercial ${r.mission.id} executada pelos 6 agentes (Aegis, Relay, Scout, Meridian, Beacon, Pledge) — rascunho ${r.draft.id} aguardando revisão na Central de Aprovações (${r.approval.id}).`,
      );
      detail.reload();
      onUpdated();
    } catch (e) {
      setFeedback(`Erro na missão comercial: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async () => {
    const target = toStage || validTransitions[0];
    if (!target) return;
    setBusy(true);
    setFeedback(null);
    try {
      const r = await api.transitionOpportunity(opp.id, {
        to: target,
        ...(stageReason.trim() ? { reason: stageReason.trim() } : {}),
        requireApproval: stageRequireApproval,
      });
      if (r.queuedForApproval) {
        setFeedback(`Mudança sensível para '${target}' enviada à Central de Aprovações (${r.approval?.id}).`);
      } else {
        setFeedback(`Estágio atualizado com sucesso para '${stageLabels[target] ?? target}'.`);
      }
      setStageReason("");
      detail.reload();
      onUpdated();
    } catch (e) {
      setFeedback(`Erro ao mudar estágio: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePriority = async () => {
    const target = priority || opp.priority;
    setBusy(true);
    setFeedback(null);
    try {
      const r = await api.updateOpportunityPriority(opp.id, {
        priority: target,
        ...(priorityReason.trim() ? { reason: priorityReason.trim() } : {}),
      });
      if (r.queuedForApproval) {
        setFeedback(
          `Prioridade '${target}' excede o teto determinístico '${r.rule.maxAllowed}' para score ICP ${opp.icpScore} — solicitação enviada para a Central de Aprovações (${r.approval?.id}).`,
        );
      } else {
        setFeedback(`Prioridade comercial atualizada para '${target}'.`);
      }
      detail.reload();
      onUpdated();
    } catch (e) {
      setFeedback(`Erro ao atualizar prioridade: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" data-testid="pipeline-detail-panel" style={{ borderColor: "var(--cyan)", marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>
          Oportunidade: {company?.razaoSocial ?? opp.companyId}{" "}
          <span className={`badge ${STAGE_BADGE[opp.stage] ?? "cyan"}`}>{stageLabels[opp.stage] ?? opp.stage}</span>
        </h3>
        <button className="btn secondary small" onClick={onClose}>
          fechar detalhes
        </button>
      </div>

      {feedback && (
        <div
          data-testid="pipeline-detail-feedback"
          style={{
            background: "rgba(0,212,255,0.1)",
            border: "1px solid var(--cyan)",
            padding: "8px 12px",
            borderRadius: 8,
            margin: "12px 0",
          }}
        >
          {feedback}
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ background: "var(--surface-alt)" }}>
          <h4>Proveniência e Governança (G133)</h4>
          <dl className="kv">
            <dt>ID Oportunidade</dt>
            <dd className="mono">{opp.id}</dd>
            <dt>Empresa / CNPJ</dt>
            <dd>
              {company?.razaoSocial ?? "—"} <span className="mono muted">({company?.cnpj ?? "—"})</span>
            </dd>
            <dt>Fonte / Lote</dt>
            <dd className="mono">
              {opp.source} {company?.batchId ? `· lote ${company.batchId}` : ""}
            </dd>
            <dt>Aprovada por</dt>
            <dd className="mono">
              {opp.approvedBy} em {new Date(opp.approvedAt).toLocaleString("pt-BR")}
            </dd>
            <dt>Justificativa</dt>
            <dd>{opp.justification}</dd>
            <dt>Score ICP / Prioridade</dt>
            <dd>
              <b>{opp.icpScore}/100</b> ·{" "}
              <span className={`badge ${PRIORITY_BADGE[opp.priority] ?? "cyan"}`}>{opp.priority}</span> (teto direto:{" "}
              <span className="mono">{maxDirectPriority}</span>)
            </dd>
            <dt>Agente atual</dt>
            <dd>
              <span className="badge iris">{opp.currentAgentId ?? "nenhum"}</span>
            </dd>
            <dt>Próxima ação</dt>
            <dd>{opp.nextAction ?? "—"}</dd>
            {opp.lostReason && (
              <>
                <dt>Motivo perda/arquivo</dt>
                <dd style={{ color: "var(--danger)" }}>{opp.lostReason}</dd>
              </>
            )}
            <dt>Correlação</dt>
            <dd className="mono muted">{opp.correlationId}</dd>
          </dl>
        </div>

        <div className="card" style={{ background: "var(--surface-alt)" }}>
          <h4>Evidências ICP e Lacunas do Dossiê</h4>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Evidências verificadas na importação e qualificação determinística do Meridian:
          </p>
          <ul>
            {(company?.reasons ?? []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <h4>Lacunas a confirmar</h4>
          <ul>
            {(company?.gaps ?? []).map((g, i) => (
              <li key={i} className="muted">
                {g}
              </li>
            ))}
          </ul>
          {!(company?.gaps.length) && <p className="muted">Nenhuma lacuna pendente.</p>}
        </div>
      </div>

      {/* Controles de Movimentação de Estágio e Prioridade */}
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ background: "var(--surface-alt)" }}>
          <h4>Movimentar Etapa Comercial (G134)</h4>
          <div style={{ display: "grid", gap: 8 }}>
            <select
              data-testid="pipeline-transition-select"
              value={toStage || validTransitions[0] || ""}
              onChange={(e) => setToStage(e.target.value)}
            >
              {validTransitions.map((st) => (
                <option key={st} value={st}>
                  {stageLabels[st] ?? st} ({st})
                </option>
              ))}
            </select>
            <input
              data-testid="pipeline-transition-reason"
              placeholder="Motivo da transição (obrigatório para lost / archived)"
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
            />
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={stageRequireApproval}
                onChange={(e) => setStageRequireApproval(e.target.checked)}
              />
              Submeter como alteração sensível na Central de Aprovações
            </label>
            <button
              className="btn small"
              data-testid="pipeline-transition-btn"
              disabled={busy || validTransitions.length === 0}
              onClick={handleTransition}
            >
              Mover etapa comercial
            </button>
          </div>
        </div>

        <div className="card" style={{ background: "var(--surface-alt)" }}>
          <h4>Prioridade Comercial e Regra Determinística (G136)</h4>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Teto determinístico para score {opp.icpScore}/100: <b>{maxDirectPriority}</b>. Prioridades acima do teto exigem aprovação humana.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <select
              data-testid="pipeline-priority-select"
              value={priority || opp.priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">low (baixa)</option>
              <option value="normal">normal</option>
              <option value="high">high (alta)</option>
              <option value="critical">critical (crítica)</option>
            </select>
            <input
              data-testid="pipeline-priority-reason"
              placeholder="Justificativa da mudança de prioridade"
              value={priorityReason}
              onChange={(e) => setPriorityReason(e.target.value)}
            />
            <button
              className="btn secondary small"
              data-testid="pipeline-priority-btn"
              disabled={busy}
              onClick={handlePriority}
            >
              Atualizar prioridade
            </button>
          </div>
        </div>
      </div>

      {/* Orquestração dos 6 Agentes (Fase 03 / G135) */}
      <div className="card" style={{ background: "var(--surface-alt)", marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h4 style={{ margin: 0 }}>Orquestração Comercial — 6 Agentes Ativos (G135)</h4>
            <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
              Aegis (Supervisão) → Relay (Coordenação) → Scout (Dossiê) → Meridian (Qualificação SDR) → Beacon (Proposta Outbound) → Pledge (Follow-up e Aprovação).
            </p>
          </div>
          <button
            className="btn"
            data-testid="pipeline-run-mission-btn"
            disabled={busy || opp.stage === "won" || opp.stage === "lost" || opp.stage === "archived"}
            onClick={() => handleRunMission(false)}
          >
            {busy ? "Executando 6 agentes…" : "⚡ Executar Missão Comercial (6 Agentes)"}
          </button>
        </div>

        {mission && (
          <div style={{ marginTop: 12 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>
              Missão: <b>{mission.id}</b> · Status: <span className="badge cyan">{mission.status}</span> · Correlação:{" "}
              {mission.correlationId}
            </p>
            <div className="table-wrap">
              <table data-testid="pipeline-mission-runs-table">
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Status</th>
                    <th>Duração</th>
                    <th>Units</th>
                    <th>Modo</th>
                    <th>Passos / Ferramentas</th>
                    <th>IA Assist (Onda 16)</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b className="mono">{r.agentId}</b>
                      </td>
                      <td>
                        <span className="badge green">{r.status}</span>
                      </td>
                      <td className="mono">{r.durationMs ?? 0}ms</td>
                      <td className="mono">{r.costUnits}</td>
                      <td>
                        {r.mock ? <span className="badge gold">SIMULADO</span> : <span className="badge cyan">REAL</span>}
                      </td>
                      <td className="mono muted">
                        {(r.steps ?? []).map((s) => `${s.tool}:${s.action}`).join(" → ") || "—"}
                      </td>
                      <td>
                        {(() => {
                          const ai = (r.output as Record<string, unknown> | undefined)?.aiAssist as
                            | { simulated?: boolean; provider?: string; model?: string; rejectedReason?: string; parsed?: unknown }
                            | undefined;
                          if (!ai) return <span className="mono muted">—</span>;
                          return (
                            <span
                              className={`badge ${ai.simulated ? "gold" : "green"}`}
                              title={`${ai.provider ?? "?"}/${ai.model ?? "?"}${ai.rejectedReason ? ` · ${ai.rejectedReason}` : ai.parsed ? " · saída estruturada" : ""}`}
                            >
                              {ai.simulated ? "IA SIM" : "IA REAL"}
                              {ai.rejectedReason ? " · recusada" : ""}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {drafts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4>Rascunho de Abordagem Outbound (Beacon — sem envio externo)</h4>
            {drafts.map((dr) => (
              <div key={dr.id} className="card" data-testid="pipeline-beacon-draft" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className="mono">{dr.id}</span>
                  <span className="badge cyan">canal: {dr.channel}</span>
                  <span className="badge magenta">status: {dr.status}</span>
                  <span className="badge gold">SIMULADO · ENVIO BLOQUEADO</span>
                  <span className="mono muted">claims aprovados: {(dr.claimRefs ?? []).join(", ")}</span>
                </div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 13 }}>{dr.text}</pre>
              </div>
            ))}
          </div>
        )}

        {tasks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4>Plano de Acompanhamento e Tarefas (Relay & Pledge)</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Tarefa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.assigneeId}</td>
                      <td>{t.title}</td>
                      <td>
                        <span className="badge green">{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {approvals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4>Solicitações de Aprovação Vinculadas ({approvals.length})</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ação</th>
                    <th>Status</th>
                    <th>Solicitante</th>
                    <th>Decisão</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.id}</td>
                      <td className="mono">{a.action}</td>
                      <td>
                        <span className={`badge ${REVIEW_BADGE[a.status] ?? "gold"}`}>{a.status}</span>
                      </td>
                      <td className="mono">{a.requestedBy}</td>
                      <td className="muted">
                        {a.decidedBy ? `${a.decidedBy} (${new Date(a.decidedAt!).toLocaleString("pt-BR")})` : "aguardando"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de Movimentação da Oportunidade */}
      <div style={{ marginTop: 12 }}>
        <h4>Histórico de Movimentação do Pipeline ({history.length})</h4>
        <div className="table-wrap">
          <table data-testid="pipeline-history-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>De → Para</th>
                <th>Ator</th>
                <th>Motivo</th>
                <th>Correlação</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="mono muted">{new Date(h.occurredAt).toLocaleString("pt-BR")}</td>
                  <td className="mono">{h.action}</td>
                  <td className="mono">
                    {h.fromStage ? `${h.fromStage} → ` : ""}
                    <b>{h.toStage}</b>
                  </td>
                  <td className="mono">{h.actor}</td>
                  <td>{h.reason ?? "—"}</td>
                  <td className="mono muted">{h.correlationId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function PipelineView({ initialOpportunityId }: { initialOpportunityId?: string | null }) {
  const [filters, setFilters] = useState<Record<string, string>>({
    stage: "",
    currentAgentId: "",
    priority: "",
    minScore: "",
    q: "",
    page: "1",
    pageSize: "10",
  });
  const [selectedId, setSelectedId] = useState<string | null>(initialOpportunityId ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);

  const pageData = useAsync(() => api.opportunities(filters), [JSON.stringify(filters)]);
  const d = pageData.data;
  const stageLabels = d?.stageLabels ?? {};

  const setF = (k: string, v: string) =>
    setFilters((f) => ({ ...f, [k]: v, ...(k !== "page" ? { page: "1" } : {}) }));

  const promoteReadyCompany = async (c: ScoutCompany) => {
    setBusyCompanyId(c.id);
    setNotice(null);
    try {
      const r = await api.promoteCompanyToOpportunity(c.id, {
        justification: `Promoção pelo Pipeline Comercial — ${c.razaoSocial} (score ICP ${c.score}/100)`,
      });
      if (r.opportunity) {
        setNotice(`Oportunidade ${r.opportunity.id} criada para ${c.razaoSocial}.`);
        setSelectedId(r.opportunity.id);
      }
      pageData.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyCompanyId(null);
    }
  };

  const page = d?.page ?? 1;
  const pageSize = d?.pageSize ?? 10;
  const total = d?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      {/* Resumo de etapas do funil */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Pipeline Comercial Integrado — Do Scout ao Follow-up</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Acompanhe empresas aprovadas para prospecção, oportunidades ativas, qualificação SDR (Meridian), rascunhos outbound (Beacon), compromissos (Pledge) e aprovações humanas pendentes.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button
            className="btn secondary small"
            style={!filters.stage ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}
            onClick={() => setF("stage", "")}
          >
            Todas ({Object.values(d?.stageCounts ?? {}).reduce((a, b) => a + b, 0)})
          </button>
          {Object.entries(stageLabels).map(([st, label]) => {
            const count = d?.stageCounts?.[st] ?? 0;
            return (
              <button
                key={st}
                className="btn secondary small"
                style={filters.stage === st ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}
                onClick={() => setF("stage", filters.stage === st ? "" : st)}
              >
                {label}: <b>{count}</b>
              </button>
            );
          })}
        </div>
        {notice && (
          <p data-testid="pipeline-notice" style={{ color: "var(--cyan)", marginTop: 10 }}>
            {notice}
          </p>
        )}
      </section>

      {/* Item 1 da Fase 04: Empresas aprovadas para prospecção aguardando promoção */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>1. Empresas Aprovadas na Central Scout Prontas para Prospecção ({d?.approvedCompaniesReady.length ?? 0})</h3>
        {(d?.approvedCompaniesReady.length ?? 0) > 0 ? (
          <div className="table-wrap">
            <table data-testid="pipeline-ready-companies-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Score ICP</th>
                  <th>Evidências</th>
                  <th>Fonte</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {(d?.approvedCompaniesReady ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.razaoSocial}</b>
                    </td>
                    <td className="mono muted">{c.cnpj}</td>
                    <td>
                      <b>{c.score}</b>/100
                    </td>
                    <td className="muted">{c.reasons.length} evidências</td>
                    <td className="mono">{c.fonte}</td>
                    <td>
                      <button
                        className="btn small"
                        disabled={busyCompanyId === c.id}
                        onClick={() => promoteReadyCompany(c)}
                      >
                        Criar oportunidade comercial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Todas as empresas aprovadas já possuem oportunidade no pipeline (ou aprove novas empresas na aba Scout).
          </p>
        )}
      </section>

      {/* Item 2 da Fase 04: Oportunidades comerciais no funil */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>2. Oportunidades Comerciais no Pipeline ({total})</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            placeholder="Pesquisar empresa, CNPJ, próxima ação…"
            data-testid="pipeline-filter-q"
            value={filters.q ?? ""}
            onChange={(e) => setF("q", e.target.value)}
            style={{ minWidth: 210 }}
          />
          <select
            data-testid="pipeline-filter-stage"
            value={filters.stage ?? ""}
            onChange={(e) => setF("stage", e.target.value)}
          >
            <option value="">todas etapas</option>
            {Object.entries(stageLabels).map(([st, label]) => (
              <option key={st} value={st}>
                {label}
              </option>
            ))}
          </select>
          <select
            data-testid="pipeline-filter-agent"
            value={filters.currentAgentId ?? ""}
            onChange={(e) => setF("currentAgentId", e.target.value)}
          >
            <option value="">todos agentes</option>
            {["aegis", "relay", "scout", "meridian", "beacon", "pledge"].map((ag) => (
              <option key={ag} value={ag}>
                {ag}
              </option>
            ))}
          </select>
          <select
            data-testid="pipeline-filter-priority"
            value={filters.priority ?? ""}
            onChange={(e) => setF("priority", e.target.value)}
          >
            <option value="">todas prioridades</option>
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <input
            placeholder="ICP mín."
            style={{ width: 90 }}
            value={filters.minScore ?? ""}
            onChange={(e) => setF("minScore", e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table data-testid="pipeline-opportunities-table">
            <thead>
              <tr>
                <th>Empresa / Conta</th>
                <th>Etapa Atual</th>
                <th>Score ICP / Prioridade</th>
                <th>Evidências</th>
                <th>Agente Atual</th>
                <th>Próxima Ação</th>
                <th>Aprovações</th>
                <th>Motivo Perda/Arq.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(d?.items ?? []).map((o: OpportunityRecord) => (
                <tr key={o.id} data-testid={`pipeline-opp-row-${o.id}`}>
                  <td>
                    <b>{o.company?.razaoSocial ?? o.companyId}</b>
                    <br />
                    <span className="mono muted">{o.company?.cnpj ?? o.source}</span>
                  </td>
                  <td>
                    <span className={`badge ${STAGE_BADGE[o.stage] ?? "cyan"}`}>
                      {stageLabels[o.stage] ?? o.stage}
                    </span>
                  </td>
                  <td>
                    <b>{o.icpScore}</b>/100{" "}
                    <span className={`badge ${PRIORITY_BADGE[o.priority] ?? "cyan"}`}>{o.priority}</span>
                  </td>
                  <td className="muted">
                    {o.company?.reasons.length ?? 0} evidências / {o.company?.gaps.length ?? 0} lacunas
                  </td>
                  <td>
                    {o.currentAgentId ? <span className="badge iris">{o.currentAgentId}</span> : <span className="muted">—</span>}
                  </td>
                  <td style={{ maxWidth: 260 }}>{o.nextAction ?? "—"}</td>
                  <td>
                    {(o.pendingApprovalsCount ?? 0) > 0 ? (
                      <span className="badge magenta">{o.pendingApprovalsCount} pendente(s)</span>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td className="muted">{o.lostReason ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn small"
                      data-testid={`pipeline-open-opp-${o.id}`}
                      onClick={() => setSelectedId(o.id)}
                    >
                      Detalhes / Orquestrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!(d?.items.length) && (
          <p className="muted" data-testid="pipeline-empty-state">
            Nenhuma oportunidade encontrada para os filtros selecionados.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <span className="muted">
            {total} oportunidade(s) · página {page} de {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn secondary small"
              disabled={page <= 1}
              onClick={() => setF("page", String(page - 1))}
            >
              ← Anterior
            </button>
            <button
              className="btn secondary small"
              disabled={page >= totalPages}
              onClick={() => setF("page", String(page + 1))}
            >
              Próxima →
            </button>
          </div>
        </div>
      </section>

      {selectedId && (
        <OpportunityDetailPanel
          opportunityId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => pageData.reload()}
        />
      )}
    </div>
  );
}

// ================================================================ CUSTOS DE IA (FASE 06)

export function CostsView() {
  const [filters, setFilters] = useState<Record<string, string>>({
    missionId: "",
    agentId: "",
    simulated: "",
  });
  const [tariffForm, setTariffForm] = useState({
    version: "tariff-2026-v1",
    provider: "mock",
    model: "mock-deterministic-v1",
    inputPer1MTokens: "0.15",
    outputPer1MTokens: "0.60",
  });
  const [tariffMsg, setTariffMsg] = useState<string | null>(null);

  const costs = useAsync(() => api.costs(filters), [JSON.stringify(filters)]);
  const tariffs = useAsync(() => api.costsTariffs());
  const d = costs.data;

  const setF = (k: string, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));

  const createTariff = async () => {
    setTariffMsg(null);
    try {
      const created = await api.addCostTariff({
        version: tariffForm.version,
        provider: tariffForm.provider,
        model: tariffForm.model,
        inputPer1MTokens: Number(tariffForm.inputPer1MTokens),
        outputPer1MTokens: Number(tariffForm.outputPer1MTokens),
        active: true,
      });
      setTariffMsg(`Tarifa ${created.version} (${created.provider}/${created.model}) registrada.`);
      tariffs.reload();
      costs.reload();
    } catch (e) {
      setTariffMsg(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <section className="card" data-testid="costs-view">
      <h2>Custos de IA e Orçamento Operacional</h2>

      {(costs.error || tariffs.error) && (
        <div className="error-box" data-testid="costs-error-box">
          Indisponibilidade ao consultar ledger de custos: {costs.error ?? tariffs.error}{" "}
          <button className="btn secondary small" onClick={() => { costs.reload(); tariffs.reload(); }}>
            Tentar novamente
          </button>
        </div>
      )}

      {d?.budget.blocked && (
        <div className="error-box" data-testid="costs-budget-blocked">
          ⛔ {d.budget.reason} — novas inferências bloqueadas até autorização na Central de Aprovações
        </div>
      )}

      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div className="card" style={{ background: "var(--surface-alt)" }} data-testid="costs-budget-daily">
          <div className="muted" style={{ fontSize: 12 }}>Orçamento Diário (unidades reais)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--cyan)" }}>
            {d?.budget.daily.used ?? 0} / {d?.budget.daily.limit ?? "∞"} <span className="muted" style={{ fontSize: 13 }}>units</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Restante: {d?.budget.daily.remaining ?? "sem teto configurado"}
          </div>
        </div>
        <div className="card" style={{ background: "var(--surface-alt)" }} data-testid="costs-budget-monthly">
          <div className="muted" style={{ fontSize: 12 }}>Orçamento Mensal (unidades reais)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--cyan)" }}>
            {d?.budget.monthly.used ?? 0} / {d?.budget.monthly.limit ?? "∞"} <span className="muted" style={{ fontSize: 13 }}>units</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Restante: {d?.budget.monthly.remaining ?? "sem teto configurado"}
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12 }}>
        {d?.note} {d?.simulatedDisclaimer}
      </p>

      {/* Filtros por missão, agente e tipo (real vs simulado) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          placeholder="Filtrar por missionId"
          data-testid="costs-filter-mission"
          value={filters.missionId ?? ""}
          onChange={(e) => setF("missionId", e.target.value)}
        />
        <select
          data-testid="costs-filter-agent"
          value={filters.agentId ?? ""}
          onChange={(e) => setF("agentId", e.target.value)}
        >
          <option value="">todos agentes</option>
          {["aegis", "relay", "scout", "meridian", "beacon", "pledge"].map((ag) => (
            <option key={ag} value={ag}>
              {ag}
            </option>
          ))}
        </select>
        <select
          data-testid="costs-filter-simulated"
          value={filters.simulated ?? ""}
          onChange={(e) => setF("simulated", e.target.value)}
        >
          <option value="">todos (real + simulado)</option>
          <option value="true">somente SIMULADO</option>
          <option value="false">somente REAL</option>
        </select>
        <button className="btn secondary small" onClick={() => setFilters({ missionId: "", agentId: "", simulated: "" })}>
          Limpar filtros
        </button>
      </div>

      <div className="table-wrap">
        <table data-testid="costs-usage-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Missão</th>
              <th>Agente</th>
              <th>Provider/Model</th>
              <th>Tokens</th>
              <th>Units</th>
              <th>Estimado</th>
              <th>Faturado</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {(d?.usage.items ?? []).map((u) => (
              <tr key={u.id}>
                <td className="mono muted">{new Date(u.occurredAt).toLocaleString("pt-BR")}</td>
                <td className="mono">{u.missionId ?? "—"}</td>
                <td className="mono">{u.agentId}</td>
                <td className="mono muted">
                  {u.provider}/{u.model}
                </td>
                <td className="mono">
                  {u.tokensIn}+{u.tokensOut}
                </td>
                <td>{u.costUnits}</td>
                <td>{u.estimatedCost !== null ? `$${u.estimatedCost}` : "—"}</td>
                <td>{u.billedCost !== null ? `$${u.billedCost}` : "—"}</td>
                <td>
                  {u.simulated ? (
                    <span className="badge gold">SIMULADO</span>
                  ) : (
                    <span className="badge cyan">REAL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!(d?.usage.items.length) && (
        <p className="muted" data-testid="costs-empty-usage">
          Nenhum consumo registrado para os filtros atuais.
        </p>
      )}

      <h3 style={{ marginTop: 20 }}>Tarifas versionadas</h3>
      <div className="table-wrap">
        <table data-testid="costs-tariffs-table">
          <thead>
            <tr>
              <th>Versão</th>
              <th>Provider</th>
              <th>Model</th>
              <th>In/1M</th>
              <th>Out/1M</th>
              <th>Ativa</th>
            </tr>
          </thead>
          <tbody>
            {(tariffs.data ?? []).map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.version}</td>
                <td>{t.provider}</td>
                <td className="mono">{t.model}</td>
                <td>{t.inputPer1MTokens}</td>
                <td>{t.outputPer1MTokens}</td>
                <td>{t.active ? "sim" : "não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!(tariffs.data ?? []).length && (
        <p className="muted" data-testid="costs-empty-tariffs">
          Sem tarifas — estimatedCost ficará vazio até o owner registrar preços reais.
        </p>
      )}

      <div className="card" style={{ background: "var(--surface-alt)", marginTop: 12 }}>
        <h4>Registrar tarifa versionada (restrito a owner)</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Versão"
            data-testid="tariff-version"
            value={tariffForm.version}
            onChange={(e) => setTariffForm((f) => ({ ...f, version: e.target.value }))}
            style={{ width: 130 }}
          />
          <input
            placeholder="Provider"
            data-testid="tariff-provider"
            value={tariffForm.provider}
            onChange={(e) => setTariffForm((f) => ({ ...f, provider: e.target.value }))}
            style={{ width: 120 }}
          />
          <input
            placeholder="Model"
            data-testid="tariff-model"
            value={tariffForm.model}
            onChange={(e) => setTariffForm((f) => ({ ...f, model: e.target.value }))}
            style={{ width: 170 }}
          />
          <input
            placeholder="In/1M"
            data-testid="tariff-in"
            value={tariffForm.inputPer1MTokens}
            onChange={(e) => setTariffForm((f) => ({ ...f, inputPer1MTokens: e.target.value }))}
            style={{ width: 80 }}
          />
          <input
            placeholder="Out/1M"
            data-testid="tariff-out"
            value={tariffForm.outputPer1MTokens}
            onChange={(e) => setTariffForm((f) => ({ ...f, outputPer1MTokens: e.target.value }))}
            style={{ width: 80 }}
          />
          <button className="btn small" data-testid="tariff-submit" onClick={createTariff}>
            Salvar tarifa
          </button>
        </div>
        {tariffMsg && (
          <p data-testid="tariff-msg" style={{ color: "var(--cyan)", margin: "8px 0 0" }}>
            {tariffMsg}
          </p>
        )}
      </div>
    </section>
  );
}
