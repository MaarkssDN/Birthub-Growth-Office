import { useState } from "react";
import { useAsync } from "./hooks";
import { api, type ScoutCompany } from "./api";

const REVIEW_LABEL: Record<string, string> = {
  pending: "pendente", approved: "aprovada", rejected: "rejeitada", archived: "arquivada",
};

function Dossier({ company, onClose }: { company: ScoutCompany; onClose: () => void }) {
  const detail = useAsync(() => api.scoutCompany(company.id), [company.id]);
  const d = detail.data?.company ?? company;
  return (
    <div className="card" style={{ borderColor: "var(--cyan)" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ marginTop: 0 }}>{d.razaoSocial}</h3>
        <button className="btn secondary small" onClick={onClose}>fechar</button>
      </div>
      <p className="mono muted">
        CNPJ {d.cnpj} · score ICP {d.score}/100 ({d.scoreVersion}) · fonte {d.fonte} · importado {new Date(d.importadoEm).toLocaleString("pt-BR")}
      </p>
      <p className="muted">{[d.cnae && `CNAE ${d.cnae}`, d.porte, d.situacao, [d.municipio, d.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</p>
      <h4>Por que pontuou</h4>
      <ul>{d.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      <h4>Lacunas</h4>
      <ul>{d.gaps.map((g, i) => <li key={i} className="muted">{g}</li>)}</ul>
      {d.gaps.length === 0 && <p className="muted">Sem lacunas registradas.</p>}
      <p className="muted" style={{ fontSize: 12 }}>
        Score é heurística determinística sobre campos cadastrais — não é diagnóstico de IA nem evidência de intenção de compra.
        Empresa importada não é lead: somente revisão humana aprova para análise comercial.
      </p>
      {detail.data && (
        <>
          <h4>Histórico</h4>
          <table>
            <thead><tr><th>Quando</th><th>Ação</th><th>Ator</th><th>Motivo</th></tr></thead>
            <tbody>
              {detail.data.history.map((h) => (
                <tr key={h.occurredAt + h.action}>
                  <td className="mono muted">{new Date(h.occurredAt).toLocaleString("pt-BR")}</td>
                  <td className="mono">{h.action}</td>
                  <td className="muted">{h.actor}</td>
                  <td>{h.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function ScoutView() {
  const [csv, setCsv] = useState("");
  const [fonte, setFonte] = useState("csv-upload");
  const [filters, setFilters] = useState<Record<string, string>>({ reviewStatus: "", uf: "", minScore: "" });
  const [selected, setSelected] = useState<ScoutCompany | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const companies = useAsync(() => api.scoutCompanies(filters), [JSON.stringify(filters)]);
  const batches = useAsync(() => api.scoutImports());

  const doImport = async () => {
    setNotice(null);
    try {
      const r = await api.scoutImport(csv, fonte || "csv-upload");
      setNotice(`Importação: ${r.imported} novas, ${r.duplicates} duplicadas, ${r.rejected.length} rejeitadas. Persistidas: ${r.persisted.inserted}.`);
      setCsv("");
      companies.reload();
      batches.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    }
  };

  const review = async (c: ScoutCompany, decision: "approved" | "rejected" | "archived") => {
    const reason = decision === "approved" ? undefined : window.prompt(`Motivo (${decision}):`) ?? undefined;
    try {
      await api.scoutReview(c.id, decision, reason);
      setNotice(`Empresa ${REVIEW_LABEL[decision]} — registrado na auditoria.`);
      companies.reload();
      if (selected?.id === c.id) setSelected(null);
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    }
  };

  const setF = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Importar empresas (CSV autorizado)</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Cole o CSV com colunas <span className="mono">cnpj, razao_social</span> (recomendado: nome_fantasia, cnae, porte, situacao, municipio, uf).
          CNPJ validado por dígitos verificadores; dedup por CNPJ; limite 2MB/5000 linhas. Nenhum dado pessoal de sócios.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="Fonte/origem da autorização (ex.: csv-licenciado-operador)" value={fonte} onChange={(e) => setFonte(e.target.value)} />
          <textarea rows={5} placeholder={"cnpj,razao_social,..."} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ fontFamily: "monospace" }} />
          <div><button className="btn" onClick={doImport} disabled={!csv.trim()}>Importar</button></div>
        </div>
        {notice && <p style={{ color: "var(--cyan)" }}>{notice}</p>}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Importações</h2>
        <table>
          <thead><tr><th>Quando</th><th>Fonte</th><th>Importadas</th><th>Duplicadas</th><th>Rejeitadas</th><th>Por</th></tr></thead>
          <tbody>
            {(batches.data ?? []).map((b) => (
              <tr key={b.id}>
                <td className="mono muted">{new Date(b.createdAt).toLocaleString("pt-BR")}</td>
                <td className="mono">{b.fonte}</td>
                <td>{b.imported}</td><td>{b.duplicates}</td><td>{b.rejected}</td>
                <td className="muted">{b.importedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(batches.data ?? []).length && <p className="muted">Nenhuma importação ainda.</p>}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Empresas identificadas</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select value={filters.reviewStatus} onChange={(e) => setF("reviewStatus", e.target.value)}>
            <option value="">todos status</option>
            <option value="pending">pendentes</option>
            <option value="approved">aprovadas</option>
            <option value="rejected">rejeitadas</option>
            <option value="archived">arquivadas</option>
          </select>
          <input placeholder="UF" style={{ width: 70 }} value={filters.uf} onChange={(e) => setF("uf", e.target.value)} />
          <input placeholder="score mín." style={{ width: 90 }} value={filters.minScore} onChange={(e) => setF("minScore", e.target.value)} />
          <a className="btn secondary small" href={api.scoutExportUrl("approved")} style={{ alignSelf: "center" }}>exportar aprovadas (CSV)</a>
        </div>
        <table>
          <thead><tr><th>Empresa</th><th>CNPJ</th><th>Local</th><th>Score</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(companies.data?.items ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.razaoSocial}{c.nomeFantasia ? <span className="muted"> · {c.nomeFantasia}</span> : null}</td>
                <td className="mono muted">{c.cnpj}</td>
                <td className="muted">{[c.municipio, c.uf].filter(Boolean).join("/") || "—"}</td>
                <td>{c.score}</td>
                <td><span className="badge cyan">{REVIEW_LABEL[c.reviewStatus]}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn secondary small" onClick={() => setSelected(c)}>dossiê</button>{" "}
                  {c.reviewStatus === "pending" && (
                    <>
                      <button className="btn small" onClick={() => review(c, "approved")}>aprovar</button>{" "}
                      <button className="btn secondary small" onClick={() => review(c, "rejected")}>rejeitar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{companies.data?.total ?? 0} empresas · dados importados/verificados ≠ inferência de compra</p>
      </section>

      {selected && <Dossier company={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export function CostsView() {
  const costs = useAsync(() => api.costs());
  const tariffs = useAsync(() => api.costsTariffs());
  const d = costs.data;
  return (
    <section className="card">
      <h2>Custos de IA</h2>
      {d?.budget.blocked && <p style={{ color: "#f0a" }}>⛔ {d.budget.reason} — novas inferências bloqueadas</p>}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
        <div>Dia: <b>{d?.budget.daily.used ?? "—"}</b> / {d?.budget.daily.limit ?? "∞"} units</div>
        <div>Mês: <b>{d?.budget.monthly.used ?? "—"}</b> / {d?.budget.monthly.limit ?? "∞"} units</div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{d?.note} {d?.simulatedDisclaimer}</p>
      <table>
        <thead><tr><th>Quando</th><th>Missão</th><th>Agente</th><th>Provider/Model</th><th>Tokens</th><th>Units</th><th>Estimado</th><th>Faturado</th><th>Tipo</th></tr></thead>
        <tbody>
          {(d?.usage.items ?? []).map((u) => (
            <tr key={u.id}>
              <td className="mono muted">{new Date(u.occurredAt).toLocaleString("pt-BR")}</td>
              <td className="mono">{u.missionId ?? "—"}</td>
              <td>{u.agentId}</td>
              <td className="mono muted">{u.provider}/{u.model}</td>
              <td className="mono">{u.tokensIn}+{u.tokensOut}</td>
              <td>{u.costUnits}</td>
              <td>{u.estimatedCost !== null ? `$${u.estimatedCost}` : "—"}</td>
              <td>{u.billedCost !== null ? `$${u.billedCost}` : "—"}</td>
              <td>{u.simulated ? <span className="badge gold">SIMULADO</span> : <span className="badge cyan">REAL</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(d?.usage.items.length) && <p className="muted">Nenhum consumo registrado ainda.</p>}
      <h3>Tarifas versionadas</h3>
      <table>
        <thead><tr><th>Versão</th><th>Provider</th><th>Model</th><th>In/1M</th><th>Out/1M</th><th>Ativa</th></tr></thead>
        <tbody>
          {(tariffs.data ?? []).map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.version}</td><td>{t.provider}</td><td className="mono">{t.model}</td>
              <td>{t.inputPer1MTokens}</td><td>{t.outputPer1MTokens}</td>
              <td>{t.active ? "sim" : "não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(tariffs.data ?? []).length && <p className="muted">Sem tarifas — estimatedCost ficará vazio até o owner registrar preços reais via POST /api/costs/tariffs.</p>}
    </section>
  );
}
