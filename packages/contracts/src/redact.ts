/** Minimização de PII em payloads de eventos/auditoria. */
export function redactPII(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string") {
      if (/email/i.test(k)) out[k] = maskEmail(v);
      else if (/phone|tel/i.test(k)) out[k] = maskPhone(v);
      else out[k] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactPII(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}
