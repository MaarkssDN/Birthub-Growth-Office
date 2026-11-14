import React, { useState, useEffect } from "react";
import { api } from "./api";

// =========================================================================
// 1. PRONTIDÃO COMERCIAL (Onda 13 / Fase 02 / G171)
// =========================================================================

export function ReadinessView() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getCommercialReadiness();
      setReport(data);
    } catch (e) {
      setError(`Erro ao carregar prontidão comercial: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Carregando checklist de prontidão comercial...</div>;
  }

  if (error || !report) {
    return <div className="p-6 text-red-400">{error ?? "Relatório não disponível"}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Prontidão Comercial — Homologação da Oferta</h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                Onda 13 / G171
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Checklist das 9 dimensões de oferta comercial, materiais, roteiros e alegações verificáveis do Birthub 360°.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">Score de Prontidão</div>
              <div className="text-2xl font-bold text-emerald-400">{report.readinessScore}%</div>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                report.readyForOutreach
                  ? "bg-emerald-900/60 text-emerald-200 border border-emerald-500/50"
                  : "bg-amber-900/60 text-amber-200 border border-amber-500/50"
              }`}
            >
              {report.readyForOutreach ? "Pronto para Abordagem" : "Bloqueado por Pendências"}
            </span>
          </div>
        </div>

        {/* Bloqueios e Alertas */}
        {report.blockingReasons && report.blockingReasons.length > 0 && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 space-y-1">
            <div className="font-semibold text-red-200">Motivos de Bloqueio:</div>
            {report.blockingReasons.map((r: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span>✕</span> <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {report.pendingClaims && report.pendingClaims.length > 0 && (
          <div className="mt-3 p-3 bg-amber-950/30 border border-amber-800/50 rounded text-xs text-amber-300 space-y-1">
            <div className="font-semibold text-amber-200">Alegações Bloqueadas (Pendente de Validação):</div>
            {report.pendingClaims.map((c: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span>⚠️</span> <span>{c} (Uso estritamente bloqueado em abordagens comerciais)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid de Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {report.categories?.map((cat: any) => (
          <div
            key={cat.category}
            className={`bg-slate-900 border rounded-lg p-5 flex flex-col justify-between ${
              cat.ready ? "border-slate-800" : "border-amber-800/60 bg-amber-950/10"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {cat.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    cat.ready
                      ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50"
                      : "bg-amber-900/50 text-amber-300 border border-amber-700/50"
                  }`}
                >
                  {cat.ready ? "Homologado" : "Pendente"}
                </span>
              </div>
              <h3 className="font-semibold text-slate-100 text-sm">{cat.label}</h3>

              <div className="mt-3 space-y-2">
                {cat.items?.map((item: any) => (
                  <div key={item.id} className="text-xs p-2 rounded bg-slate-800/60 border border-slate-700/50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-200 font-medium">{item.title}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          item.status === "approved"
                            ? "bg-emerald-950 text-emerald-400"
                            : item.status === "pending_validation"
                            ? "bg-amber-950 text-amber-400"
                            : "bg-red-950 text-red-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.evidenceUrl ? (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-cyan-400 hover:underline">
                        <span>📄 Evidência:</span>
                        <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="truncate">
                          {item.evidenceUrl}
                        </a>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-amber-400/80">⚠️ Sem evidência documental anexada</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Aprovados: {cat.approvedCount}</span>
              <span>Pendentes: {cat.pendingCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 2. FICHA CONSOLIDADA / DOSSIÊ COMERCIAL (Onda 13 / Fase 05 / G176–G178)
// =========================================================================

export function ConsolidatedDossierView() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [selectedOppId, setSelectedOppId] = useState<string>("");
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  // Carrega lista de oportunidades para seleção
  const loadOpportunities = async () => {
    try {
      const res = await api.opportunities({ pageSize: "50" });
      setOpportunities(res.items);
      if (res.items.length > 0 && !selectedOppId && res.items[0]) {
        setSelectedOppId(res.items[0].id);
      }
    } catch (e) {
      console.error("Erro ao listar oportunidades:", e);
    }
  };

  const loadDossier = async (oppId: string) => {
    if (!oppId) return;
    setLoading(true);
    setDecisionNotice(null);
    try {
      const data = await api.getConsolidatedDossier(oppId);
      setDossier(data);
    } catch (e) {
      console.error("Erro ao carregar dossiê:", e);
      setDossier(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, []);

  useEffect(() => {
    if (selectedOppId) {
      loadDossier(selectedOppId);
    }
  }, [selectedOppId]);

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!selectedOppId) return;
    setDecisionLoading(true);
    try {
      const res = await api.reviewConsolidatedDossier(
        selectedOppId,
        decision,
        decision === "rejected" ? rejectReason : undefined,
      );
      setDecisionNotice(
        decision === "approved"
          ? "Dossiê e material homologados com sucesso para preparação humana. Disparo externo permanece bloqueado."
          : `Dossiê rejeitado. Motivo: ${rejectReason || "Revisão solicitada pelo operador"}.`,
      );
      setShowRejectBox(false);
      loadDossier(selectedOppId);
    } catch (e) {
      setDecisionNotice(`Erro na homologação: ${(e as Error).message}`);
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Oportunidade e Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Ficha Consolidada — Dossiê Comercial Integrado</h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-purple-900/40 text-purple-300 border border-purple-700/50">
                Onda 13 / G176–G178
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Visão unificada para revisão humana prévia. Separa fatos verificados, inferências e alegações autorizadas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Oportunidade Alvo:</label>
            <select
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.company?.razaoSocial ?? o.title ?? o.id} [{o.stage}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {decisionNotice && (
          <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-700/60 rounded text-xs text-indigo-300 flex items-center justify-between">
            <span>{decisionNotice}</span>
            <button onClick={() => setDecisionNotice(null)} className="text-slate-400 hover:text-slate-200">
              ✕
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Carregando ficha consolidada da oportunidade...</div>
      ) : !dossier ? (
        <div className="p-8 text-center text-slate-400">Nenhum dossiê disponível para esta oportunidade.</div>
      ) : (
        <div className="space-y-6">
          {/* Linha 1: Dados do Sujeito e Perfil de ICP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sujeito / Prospecto */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  <span>🏢 Sujeito Prospectado</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {dossier.subject?.targetType}
                  </span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  Consentimento Expresso LGPD
                </span>
              </div>

              <div className="text-xs space-y-1.5 text-slate-300">
                <div>
                  <span className="text-slate-500">Razão Social:</span>{" "}
                  <strong className="text-slate-100">{dossier.subject?.company}</strong>
                </div>
                {dossier.subject?.cnpj && (
                  <div>
                    <span className="text-slate-500">CNPJ:</span>{" "}
                    <span className="font-mono">{dossier.subject?.cnpj}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Contato Titular:</span> {dossier.subject?.name}
                </div>
                <div>
                  <span className="text-slate-500">E-mail:</span> {dossier.subject?.email}
                </div>
                <div>
                  <span className="text-slate-500">Telefone:</span> {dossier.subject?.phone}
                </div>
                <div>
                  <span className="text-slate-500">Origem:</span> {dossier.subject?.source}
                </div>
                <div>
                  <span className="text-slate-500">Aviso LGPD:</span>{" "}
                  <span className="font-mono text-cyan-400">{dossier.subject?.privacyVersion}</span>
                </div>
              </div>
            </div>

            {/* ICP & Aderência */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100 text-sm">🎯 Qualificação ICP ({dossier.icp?.profileName})</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                  v{dossier.icp?.version}
                </span>
              </div>

              <div className="flex items-center gap-4 py-1">
                <div>
                  <div className="text-[11px] text-slate-500">Score de Aderência</div>
                  <div className="text-2xl font-bold text-indigo-400">{dossier.icp?.score}/100</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Prioridade Comercial</div>
                  <div className="text-sm font-semibold uppercase text-amber-300">{dossier.icp?.priority}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-400 font-medium">Critérios de Inclusão Atendidos:</div>
                <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                  {dossier.icp?.matchedInclusions?.map((inc: string, i: number) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Linha 2: Diagnóstico Estruturado (G176: Fatos / Inferências / Recomendações) */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">
                  🧠 Diagnóstico Estruturado de Agentes (Meridian + Aegis)
                </h3>
                <p className="text-xs text-slate-400">
                  Separação formal entre fatos comprovados, inferências probabilísticas e recomendações de abordagem (G176).
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded font-mono bg-slate-800 text-cyan-300 border border-slate-700">
                {dossier.meridianDiagnosis?.model} (Honesto / Determinístico)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fatos */}
              <div className="bg-slate-950/60 border border-emerald-900/50 rounded p-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✓</span> Fatos Verificados
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  {dossier.structuredQualification?.facts?.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* Inferências */}
              <div className="bg-slate-950/60 border border-blue-900/50 rounded p-4 space-y-2">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>ℹ</span> Inferências e Diagnóstico
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  {dossier.structuredQualification?.inferences?.map((inf: string, i: number) => (
                    <li key={i}>{inf}</li>
                  ))}
                </ul>
              </div>

              {/* Recomendações */}
              <div className="bg-slate-950/60 border border-purple-900/50 rounded p-4 space-y-2">
                <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>★</span> Recomendações Comerciais
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  {dossier.structuredQualification?.recommendations?.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Linha 3: Rascunho de Abordagem do Beacon & Governança */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rascunho Beacon */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100 text-sm">✉️ Rascunho de Abordagem (Beacon)</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                  Canal: {dossier.beaconOutreach?.channel}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded p-3 text-xs space-y-2">
                <div>
                  <span className="text-slate-500">Assunto:</span>{" "}
                  <strong className="text-slate-200">{dossier.beaconOutreach?.subject}</strong>
                </div>
                <div className="p-2.5 bg-slate-900/80 rounded text-slate-300 whitespace-pre-wrap font-sans text-xs border border-slate-800">
                  {dossier.beaconOutreach?.text}
                </div>
              </div>

              {/* Alegações Aprovadas Vinculadas */}
              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">Alegações Comerciais Aprovadas Vinculadas:</div>
                <div className="space-y-1">
                  {dossier.beaconOutreach?.approvedClaims?.map((ac: string, i: number) => (
                    <div
                      key={i}
                      className="text-xs flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40"
                    >
                      <span>✓</span> <span>{ac}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Governança e Decisão do Operador */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-100 text-sm">🛡️ Governança & Compromissos (Pledge)</h3>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-red-950 text-red-300 border border-red-800/50">
                    Disparo Externo Bloqueado (L3)
                  </span>
                </div>

                <div className="text-xs space-y-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">Próxima Ação:</span>{" "}
                    <strong className="text-slate-200">{dossier.pledgeCommitments?.nextAction}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Status da Aprovação:</span>{" "}
                    <span className="font-mono text-amber-300 uppercase">{dossier.governance?.approvalStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Consumo & Duração:</span>{" "}
                    <span className="font-mono text-slate-400">
                      {dossier.costsAndDuration?.totalDurationMs}ms / {dossier.costsAndDuration?.totalCostUnits} unidades
                    </span>
                  </div>
                </div>

                {/* Banner de Aviso Legal */}
                <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-400 leading-relaxed">
                  ⚠️ <strong>Regra Inviolável de Governança:</strong> A homologação pelo operador autoriza
                  estritamente a <em>preparação e organização do material</em>. Disparos automáticos e contatos diretos
                  externos permanecem tecnicamente bloqueados pelo policy engine do Growth Office.
                </div>
              </div>

              {/* Botões de Ação Humana */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                {showRejectBox ? (
                  <div className="space-y-2">
                    <textarea
                      placeholder="Motivo da rejeição ou orientações de revisão..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision("rejected")}
                        disabled={decisionLoading}
                        className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-semibold"
                      >
                        Confirmar Rejeição
                      </button>
                      <button
                        onClick={() => setShowRejectBox(false)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDecision("approved")}
                      disabled={decisionLoading || dossier.governance?.approvalStatus === "approved"}
                      className={`flex-1 py-2 px-3 rounded text-xs font-bold transition-colors ${
                        dossier.governance?.approvalStatus === "approved"
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {dossier.governance?.approvalStatus === "approved"
                        ? "Dossiê Já Homologado"
                        : "Homologar Preparação de Dossiê"}
                    </button>
                    <button
                      onClick={() => setShowRejectBox(true)}
                      disabled={decisionLoading || dossier.governance?.approvalStatus === "approved"}
                      className="py-2 px-3 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 rounded text-xs font-semibold"
                    >
                      Rejeitar / Revisar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. PAINEL DE MÉTRICAS DO PILOTO (Onda 13 / Fase 06 / G180)
// =========================================================================

export function PilotMetricsView() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPilotMetrics();
      setMetrics(data);
    } catch (e) {
      console.error("Erro ao carregar métricas do piloto:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Carregando indicadores do piloto supervisionado...</div>;
  }

  if (!metrics) {
    return <div className="p-6 text-red-400">Não foi possível carregar o painel de métricas.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Painel de Métricas do Piloto Supervisionado</h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">
                Onda 13 / G180
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Indicadores operacionais de aquisição de clientes com estrita honestidade de estado (sem reuniões ou receitas fictícias).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
              Operação Supervisionada
            </span>
            <span className="text-xs px-2.5 py-1 rounded font-mono bg-red-950 text-red-300 border border-red-800">
              0 Envios Externos Reais
            </span>
          </div>
        </div>
      </div>

      {/* Grid de KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Leads Recebidos</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{metrics.leadsReceived}</div>
          <div className="text-[11px] text-slate-500 mt-1">Sintéticos com Consentimento</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Leads Qualificados</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{metrics.leadsQualified}</div>
          <div className="text-[11px] text-slate-500 mt-1">Aderência ICP avaliada</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Empresas Mapeadas</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{metrics.targetCompaniesIdentified}</div>
          <div className="text-[11px] text-slate-500 mt-1">Central Scout homologada</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Oportunidades Abertas</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{metrics.opportunitiesOpened}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pipeline Comercial ativo</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Abordagens Preparadas</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{metrics.outreachPrepared}</div>
          <div className="text-[11px] text-slate-500 mt-1">Rascunhos do Beacon</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Abordagens Homologadas</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.outreachApproved}</div>
          <div className="text-[11px] text-slate-500 mt-1">Revisão humana autorizada</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Reuniões Propostas</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.meetingsProposed}</div>
          <div className="text-[11px] text-slate-500 mt-1">Followup planejado</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Reuniões Realizadas</div>
          <div className="text-2xl font-bold text-slate-400 mt-1 flex items-center gap-2">
            <span>{metrics.meetingsHeld?.count ?? 0}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
              {metrics.meetingsHeld?.status ?? "absent"}
            </span>
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Honestidade: 0 reuniões fictícias</div>
        </div>
      </div>

      {/* Funil de Estágios e Consumo de IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Funil de Conversão */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
          <h3 className="font-semibold text-slate-100 text-sm">📊 Distribuição por Estágio Comercial</h3>
          <div className="space-y-2 text-xs">
            {Object.entries(metrics.stageConversion || {}).map(([stage, count]: [string, any]) => (
              <div key={stage} className="flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-700/50">
                <span className="font-mono text-slate-300">{stage}</span>
                <span className="font-bold text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consumo de IA e Honestidade */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-slate-100 text-sm">🤖 Consumo de IA e Governança de Estado</h3>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Modo de Operação:</span>
                <span className="font-mono text-cyan-400">{metrics.aiConsumption?.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tokens Consumidos:</span>
                <span className="font-mono text-slate-200">{metrics.aiConsumption?.totalTokens}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Custo Total:</span>
                <span className="font-mono text-emerald-400">{metrics.aiConsumption?.totalCostUnits} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aprovações Pendentes:</span>
                <span className="font-mono text-amber-400">{metrics.pendingApprovalsCount}</span>
              </div>
            </div>

            <div className="p-3 bg-indigo-950/30 border border-indigo-800/50 rounded space-y-1">
              <div className="font-semibold text-indigo-300 text-[11px] uppercase tracking-wider">
                Compromisso de Honestidade (AGENTS.md Regra 07):
              </div>
              <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                {metrics.dataHonesty?.notes}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
