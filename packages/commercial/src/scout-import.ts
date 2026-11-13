/**
 * Scout — importação de empresas autorizadas (CSV) — Onda 09.
 * Independente de provedores pagos: operador fornece CSV licenciado.
 * Sem scraping, sem dados pessoais de sócios, sem intenção deduzida
 * de CNPJ. Saída: empresas normalizadas + score ICP + dossiê.
 */

export interface CompanyRecord {
  cnpj: string;            // 14 dígitos
  razaoSocial: string;
  nomeFantasia?: string;
  cnae?: string;
  porte?: string;
  situacao?: string;
  municipio?: string;
  uf?: string;
  fonte: string;           // ex.: "csv-upload", "receita-cnpj-aberto"
  importadoEm: string;     // ISO
}

export interface CompanyDossier {
  company: CompanyRecord;
  score: number;           // 0-100 — aderência à ICP (heurística, não evidência de compra)
  reasons: string[];
  gaps: string[];          // campos ausentes/contraditórios
  simulated: false;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  rejected: { line: number; reason: string }[];
  dossiers: CompanyDossier[];
}

const CNPJ_LEN = 14;

/** Valida dígitos verificadores do CNPJ. */
export function isValidCnpj(digits: string): boolean {
  if (digits.length !== CNPJ_LEN || /^\d{14}$/.test(digits) === false) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((a, d, i) => a + Number(d) * (weights[i] ?? 0), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(digits.slice(0, 12), w1) === Number(digits.charAt(12)) && calc(digits.slice(0, 13), w2) === Number(digits.charAt(13));
}

/** Normaliza CNPJ: extrai dígitos, valida. Retorna null se inválido. */
export function normalizeCnpj(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return isValidCnpj(d) ? d : null;
}

/** CSV simples: cabeçalho obrigatório; separador vírgula; sem aspas complexas. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const split = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const head = lines[0];
  if (head === undefined) return { headers: [], rows: [] };
  return { headers: split(head), rows: lines.slice(1).map(split) };
}

const HEADER_MAP: Record<string, keyof CompanyRecord> = {
  cnpj: "cnpj", cnpj_basico: "cnpj",
  razao_social: "razaoSocial", razao: "razaoSocial", nome: "razaoSocial",
  nome_fantasia: "nomeFantasia", fantasia: "nomeFantasia",
  cnae: "cnae", cnae_principal: "cnae",
  porte: "porte", porte_empresa: "porte",
  situacao: "situacao", situacao_cadastral: "situacao",
  municipio: "municipio", cidade: "municipio",
  uf: "uf", estado: "uf",
};

/** Heurística de aderência à ICP (hipótese v1) — NÃO é evidência de compra. */
export function scoreIcp(c: CompanyRecord): { score: number; reasons: string[]; gaps: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const gaps: string[] = [];
  const sit = (c.situacao ?? "").toUpperCase();
  if (sit.includes("ATIVA")) { score += 25; reasons.push("situação cadastral ativa"); }
  else if (sit) { score += 10; reasons.push(`situação: ${sit}`); gaps.push("situação não ativa"); }
  else gaps.push("situação cadastral ausente");
  const porte = (c.porte ?? "").toUpperCase();
  if (/M[eé]DIA|GRANDE|EPP/.test(porte)) { score += 20; reasons.push(`porte ${porte} — estrutura comercial provável`); }
  else if (porte) { score += 10; reasons.push(`porte ${porte}`); }
  else gaps.push("porte ausente");
  if (c.cnae) { score += 15; reasons.push(`CNAE ${c.cnae} registrado`); }
  else gaps.push("CNAE ausente — segmento não verificável");
  if (c.municipio && c.uf) { score += 10; reasons.push(`${c.municipio}/${c.uf}`); }
  else gaps.push("município/UF ausentes");
  if (!c.nomeFantasia) gaps.push("nome fantasia ausente");
  // score máximo heurístico = 70; escala p/ 0-100
  return { score: Math.min(100, Math.round((score / 70) * 100)), reasons, gaps };
}

/**
 * Importa CSV autorizado. `fonte` registra a origem (obrigatória);
 * `importadoEm` injetável p/ testes. Dedup por CNPJ (14 dígitos).
 */
export function importCompaniesCsv(
  csvText: string,
  opts: { fonte: string; importadoEm?: string; maxRows?: number },
): ImportResult {
  const maxRows = opts.maxRows ?? 5000;
  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0) {
    return { imported: 0, duplicates: 0, rejected: [{ line: 0, reason: "CSV vazio ou sem cabeçalho" }], dossiers: [] };
  }
  const colIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h.toLowerCase().replace(/[\s-]+/g, "_")];
    if (key && !colIndex.has(key)) colIndex.set(key, i);
  });
  if (!colIndex.has("cnpj") || !colIndex.has("razaoSocial")) {
    return { imported: 0, duplicates: 0, rejected: [{ line: 0, reason: "colunas obrigatórias ausentes: cnpj e razao_social" }], dossiers: [] };
  }
  const get = (row: string[], key: keyof CompanyRecord) => {
    const i = colIndex.get(key);
    return i !== undefined ? row[i] : undefined;
  };
  const seen = new Set<string>();
  const result: ImportResult = { imported: 0, duplicates: 0, rejected: [], dossiers: [] };
  const now = opts.importadoEm ?? new Date().toISOString();
  rows.slice(0, maxRows).forEach((row, idx) => {
    const line = idx + 2;
    const cnpj = normalizeCnpj(get(row, "cnpj"));
    if (!cnpj) { result.rejected.push({ line, reason: "CNPJ ausente ou dígito verificador inválido" }); return; }
    const razao = get(row, "razaoSocial");
    if (!razao) { result.rejected.push({ line, reason: "razão social ausente" }); return; }
    if (seen.has(cnpj)) { result.duplicates++; return; }
    seen.add(cnpj);
    const nf = get(row, "nomeFantasia");
    const cn = get(row, "cnae");
    const po = get(row, "porte");
    const si = get(row, "situacao");
    const mu = get(row, "municipio");
    const uf = get(row, "uf");
    const company: CompanyRecord = {
      cnpj, razaoSocial: razao,
      ...(nf ? { nomeFantasia: nf } : {}),
      ...(cn ? { cnae: cn } : {}),
      ...(po ? { porte: po } : {}),
      ...(si ? { situacao: si } : {}),
      ...(mu ? { municipio: mu } : {}),
      ...(uf ? { uf } : {}),
      fonte: opts.fonte, importadoEm: now,
    };
    const { score, reasons, gaps } = scoreIcp(company);
    result.dossiers.push({ company, score, reasons, gaps, simulated: false });
    result.imported++;
  });
  if (rows.length > maxRows) {
    result.rejected.push({ line: maxRows + 2, reason: `limite de ${maxRows} linhas excedido — restante ignorado` });
  }
  result.dossiers.sort((a, b) => b.score - a.score);
  return result;
}
