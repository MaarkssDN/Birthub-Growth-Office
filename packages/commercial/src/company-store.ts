import type { CompanyDossier } from "./scout-import";

/**
 * Central Scout — persistência de empresas importadas (Onda 10 / G111-G115).
 * Empresa importada NUNCA é lead/outrora oportunidade: reviewStatus
 * controla a promoção humana para análise comercial.
 */

export type CompanyReviewStatus = "pending" | "approved" | "rejected" | "archived";
export type CompanyReviewDecision = Exclude<CompanyReviewStatus, "pending">;

export interface CompanyHistoryRecord {
  id: string;
  companyId: string;
  action: string;
  actor: string;
  reason?: string;
  details?: Record<string, unknown>;
  occurredAt: string;
}

export interface StoredCompany {
  id: string;
  batchId?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnae?: string;
  porte?: string;
  situacao?: string;
  municipio?: string;
  uf?: string;
  fonte: string;
  importadoEm: string;
  score: number;
  scoreVersion: string;
  reasons: string[];
  gaps: string[];
  reviewStatus: CompanyReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
  missionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportBatchRecord {
  id: string;
  fonte: string;
  filename?: string;
  missionId?: string;
  correlationId: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  rejected: number;
  rejectedDetail?: { line: number; reason: string }[];
  importedBy: string;
  createdAt: string;
}

export interface CompanyFilters {
  minScore?: number;
  maxScore?: number;
  uf?: string;
  municipio?: string;
  cnae?: string;
  porte?: string;
  situacao?: string;
  reviewStatus?: CompanyReviewStatus;
  q?: string; // busca em razão social / fantasia
  page?: number;
  pageSize?: number;
}

export interface CompanyPage {
  items: StoredCompany[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CompanyStorePort {
  createImportBatch(input: {
    fonte: string;
    filename?: string;
    missionId?: string;
    correlationId: string;
    totalRows: number;
    imported: number;
    duplicates: number;
    rejected: number;
    rejectedDetail?: { line: number; reason: string }[];
    importedBy: string;
  }): Promise<ImportBatchRecord>;
  /** Idempotente por (workspace, cnpj): reimportação conta duplicatas, não duplica linhas. */
  upsertCompanies(batchId: string, dossiers: CompanyDossier[], missionId?: string): Promise<{ inserted: number; duplicates: number }>;
  listCompanies(f: CompanyFilters): Promise<CompanyPage>;
  getCompany(id: string): Promise<StoredCompany | undefined>;
  reviewCompany(id: string, decision: CompanyReviewDecision, actor: string, reason?: string): Promise<StoredCompany>;
  listImportBatches(limit?: number): Promise<ImportBatchRecord[]>;
  companyHistory(companyId: string): Promise<CompanyHistoryRecord[]>;
}

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Implementação em memória — testes e modo volátil. */
export class MemoryCompanyStore implements CompanyStorePort {
  private batches = new Map<string, ImportBatchRecord>();
  private companies = new Map<string, StoredCompany>();
  private history = new Map<string, CompanyHistoryRecord[]>();
  private byCnpj = new Map<string, string>(); // cnpj -> companyId

  async createImportBatch(input: Parameters<CompanyStorePort["createImportBatch"]>[0]): Promise<ImportBatchRecord> {
    const b: ImportBatchRecord = {
      id: nid("batch"),
      fonte: input.fonte,
      ...(input.filename !== undefined ? { filename: input.filename } : {}),
      ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
      correlationId: input.correlationId,
      totalRows: input.totalRows,
      imported: input.imported,
      duplicates: input.duplicates,
      rejected: input.rejected,
      ...(input.rejectedDetail !== undefined ? { rejectedDetail: input.rejectedDetail } : {}),
      importedBy: input.importedBy,
      createdAt: new Date().toISOString(),
    };
    this.batches.set(b.id, b);
    return b;
  }

  async upsertCompanies(batchId: string, dossiers: CompanyDossier[], missionId?: string): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0;
    let duplicates = 0;
    for (const d of dossiers) {
      const cnpj = d.company.cnpj;
      const existingId = this.byCnpj.get(cnpj);
      if (existingId) {
        duplicates++;
        this.addHistory(existingId, "reimport_seen", "system", undefined, { batchId, score: d.score });
        continue;
      }
      const now = new Date().toISOString();
      const c: StoredCompany = {
        id: nid("co"),
        batchId,
        cnpj,
        razaoSocial: d.company.razaoSocial,
        ...(d.company.nomeFantasia !== undefined ? { nomeFantasia: d.company.nomeFantasia } : {}),
        ...(d.company.cnae !== undefined ? { cnae: d.company.cnae } : {}),
        ...(d.company.porte !== undefined ? { porte: d.company.porte } : {}),
        ...(d.company.situacao !== undefined ? { situacao: d.company.situacao } : {}),
        ...(d.company.municipio !== undefined ? { municipio: d.company.municipio } : {}),
        ...(d.company.uf !== undefined ? { uf: d.company.uf } : {}),
        fonte: d.company.fonte,
        importadoEm: d.company.importadoEm,
        score: d.score,
        scoreVersion: "score-icp-v1",
        reasons: d.reasons,
        gaps: d.gaps,
        reviewStatus: "pending",
        ...(missionId !== undefined ? { missionId } : {}),
        createdAt: now,
        updatedAt: now,
      };
      this.companies.set(c.id, c);
      this.byCnpj.set(cnpj, c.id);
      this.addHistory(c.id, "imported", "scout", undefined, { batchId, fonte: c.fonte, score: c.score });
      inserted++;
    }
    return { inserted, duplicates };
  }

  async listCompanies(f: CompanyFilters): Promise<CompanyPage> {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));
    let items = [...this.companies.values()];
    if (f.minScore !== undefined) items = items.filter((c) => c.score >= f.minScore!);
    if (f.maxScore !== undefined) items = items.filter((c) => c.score <= f.maxScore!);
    if (f.uf) items = items.filter((c) => (c.uf ?? "").toUpperCase() === f.uf!.toUpperCase());
    if (f.municipio) items = items.filter((c) => (c.municipio ?? "").toLowerCase().includes(f.municipio!.toLowerCase()));
    if (f.cnae) items = items.filter((c) => (c.cnae ?? "").includes(f.cnae!));
    if (f.porte) items = items.filter((c) => (c.porte ?? "").toLowerCase().includes(f.porte!.toLowerCase()));
    if (f.situacao) items = items.filter((c) => (c.situacao ?? "").toUpperCase().includes(f.situacao!.toUpperCase()));
    if (f.reviewStatus) items = items.filter((c) => c.reviewStatus === f.reviewStatus);
    if (f.q) {
      const q = f.q.toLowerCase();
      items = items.filter((c) => c.razaoSocial.toLowerCase().includes(q) || (c.nomeFantasia ?? "").toLowerCase().includes(q));
    }
    items.sort((a, b) => b.score - a.score || a.razaoSocial.localeCompare(b.razaoSocial));
    const total = items.length;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  async getCompany(id: string): Promise<StoredCompany | undefined> {
    return this.companies.get(id);
  }

  async reviewCompany(id: string, decision: CompanyReviewDecision, actor: string, reason?: string): Promise<StoredCompany> {
    const c = this.companies.get(id);
    if (!c) throw new Error(`empresa não encontrada: ${id}`);
    const now = new Date().toISOString();
    c.reviewStatus = decision;
    c.reviewedBy = actor;
    c.reviewedAt = now;
    if (reason !== undefined) c.reviewReason = reason;
    c.updatedAt = now;
    this.addHistory(id, `review_${decision}`, actor, reason, {});
    return c;
  }

  async listImportBatches(limit = 50): Promise<ImportBatchRecord[]> {
    return [...this.batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async companyHistory(companyId: string): Promise<CompanyHistoryRecord[]> {
    return this.history.get(companyId) ?? [];
  }

  private addHistory(companyId: string, action: string, actor: string, reason: string | undefined, details: Record<string, unknown>): void {
    const list = this.history.get(companyId) ?? [];
    list.push({
      id: nid("hist"),
      companyId,
      action,
      actor,
      ...(reason !== undefined ? { reason } : {}),
      details,
      occurredAt: new Date().toISOString(),
    });
    this.history.set(companyId, list);
  }
}

/** Sanitiza célula CSV contra formula injection (=, +, -, @, tab, CR). */
export function sanitizeCsvCell(value: string): string {
  const v = String(value);
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function companiesToCsv(companies: StoredCompany[]): string {
  const esc = (v: string | undefined) => `"${sanitizeCsvCell(v ?? "").replace(/"/g, '""')}"`;
  const header = "cnpj;razao_social;nome_fantasia;cnae;porte;situacao;municipio;uf;score;review_status;fonte;importado_em";
  const lines = companies.map((c) => [
    c.cnpj, c.razaoSocial, c.nomeFantasia, c.cnae, c.porte, c.situacao,
    c.municipio, c.uf, String(c.score), c.reviewStatus, c.fonte, c.importadoEm,
  ].map(esc).join(";"));
  return [header, ...lines].join("\r\n") + "\r\n";
}
