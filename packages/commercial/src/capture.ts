import { createHash } from "node:crypto";
import type { CaptureFormInput, CaptureResult } from "@bgo/contracts";
import { PRIVACY_NOTICE_VERSION as NOTICE_VERSION } from "@bgo/contracts";
import type { StorePort } from "./store-port";

/**
 * Regra de deduplicação documentada (Onda 01):
 * 1. e-mail normalizado (trim+lowercase) presente → dedupKey `email:<hash>`;
 * 2. sem e-mail válido → `name+company` normalizados (sem acento/caixa);
 * 3. mesma dedupKey dentro do workspace → lead existente retornado com
 *    `duplicate: true`; NENHUM novo registro é criado e a origem original
 *    é preservada (proveniência não é sobrescrita por reenvio).
 */
export function dedupKeyFor(input: { email?: string; name: string; company: string }): string {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (input.email && input.email.includes("@")) {
    return `email:${createHash("sha256").update(norm(input.email)).digest("hex").slice(0, 32)}`;
  }
  return `nc:${createHash("sha256").update(`${norm(input.name)}|${norm(input.company)}`).digest("hex").slice(0, 32)}`;
}

export async function captureLead(
  store: StorePort,
  input: CaptureFormInput,
  actor: string,
): Promise<CaptureResult> {
  const dedupKey = dedupKeyFor({ email: input.email, name: input.name, company: input.company });
  const existing = await store.findLeadByDedupKey(dedupKey);
  if (existing) {
    return {
      leadId: existing.id,
      duplicate: true,
      status: existing.status,
      message: "Recebemos sua manifestação anteriormente — nossa equipe já tem seu registro.",
    };
  }

  const privacy = {
    noticeVersion: NOTICE_VERSION,
    acceptedAt: new Date().toISOString(),
    channels: input.privacy.channels,
    marketingOptIn: input.privacy.marketingOptIn,
  };
  const consent =
    input.privacy.channels.length > 0
      ? { channel: input.privacy.channels[0]!, optIn: true, at: privacy.acceptedAt }
      : undefined;

  const lead = await store.createLead(
    {
      name: input.name,
      company: input.company,
      email: input.email,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      interest: input.interest,
      source: input.source,
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
      synthetic: false,
      provenance: {
        source: input.source,
        at: privacy.acceptedAt,
        legalBasis: "consentimento do titular (formulário de manifestação de interesse)",
      },
      ...(consent !== undefined ? { consent } : {}),
      privacy,
      dedupKey,
    },
    actor,
  );

  return {
    leadId: lead.id,
    duplicate: false,
    status: lead.status,
    message: "Manifestação registrada. Um especialista comercial analisará seu interesse.",
  };
}
