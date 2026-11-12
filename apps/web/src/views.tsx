import { useState } from "react";
import { api, setAuthToken, type CaptureInput, type SessionUser } from "./api";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LoginView({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.login(email, password);
      setAuthToken(r.token);
      onLogin(r.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Birthub Growth Office — acesso do escritório</h2>
      <p className="muted">Login local do administrador. Credenciais fornecidas pelo responsável.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button className="btn" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const INTEREST_OPTIONS = [
  "Conhecer o Birthub 360",
  "Agendar conversa comercial",
  "Receber material informativo",
  "Outro",
];
const SOURCE_OPTIONS = [
  { v: "website_form", l: "Site institucional" },
  { v: "indication", l: "Indicação" },
  { v: "content", l: "Conteúdo" },
  { v: "demo_form", l: "Formulário de demonstração" },
];
const CHANNEL_OPTIONS = [
  { v: "email", l: "E-mail" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "phone", l: "Telefone" },
];

export function CaptureView() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    interest: INTEREST_OPTIONS[0]!,
    source: "website_form",
    marketingOptIn: false,
    channels: ["email"] as string[],
    website: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleChannel = (c: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setErrors([]);
    const errs: string[] = [];
    if (form.name.trim().length < 2) errs.push("Nome é obrigatório");
    if (form.company.trim().length < 2) errs.push("Empresa é obrigatória");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.push("E-mail profissional inválido");
    if (form.interest.trim().length < 3) errs.push("Descreva seu interesse comercial");
    if (form.channels.length === 0) errs.push("Selecione ao menos um canal de contato preferido");
    if (errs.length) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    try {
      const input: CaptureInput = {
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        interest: form.interest.trim(),
        source: form.source,
        privacy: {
          noticeVersion: "lgpd-notice-v1",
          marketingOptIn: form.marketingOptIn,
          channels: form.channels,
        },
        website: form.website,
      };
      const r = await api.capture(input);
      setResult({ ok: true, msg: r.message + (r.duplicate ? " (registro já existente)" : "") });
      setForm({ ...form, name: "", company: "", email: "", phone: "", website: "" });
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Manifestação de interesse comercial — Birthub 360">
      <p className="muted">
        Formulário controlado do Growth Office. Seus dados ficam no banco exclusivo do escritório.
        Nenhuma mensagem automática é enviada. Informações comerciais detalhadas (preços, SLA,
        funcionalidades) estão <b>PENDENTES DE VALIDAÇÃO</b> e não são prometidas aqui.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <label>
          Nome *
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <label>
          Empresa *
          <input value={form.company} onChange={(e) => set("company", e.target.value)} required />
        </label>
        <label>
          E-mail profissional *
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </label>
        <label>
          Telefone/WhatsApp (opcional)
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label>
          Interesse comercial
          <select value={form.interest} onChange={(e) => set("interest", e.target.value)}>
            {INTEREST_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Origem do contato
          <select value={form.source} onChange={(e) => set("source", e.target.value)}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <fieldset style={{ border: "1px solid #333", borderRadius: 8, padding: 10 }}>
          <legend className="muted">Privacidade e preferências de contato</legend>
          <p className="muted" style={{ fontSize: 12 }}>
            Aviso de privacidade v1 (lgpd-notice-v1): seus dados são usados apenas para responder a
            esta manifestação de interesse, com base no seu consentimento. Você pode pedir exclusão
            a qualquer momento.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {CHANNEL_OPTIONS.map((c) => (
              <label key={c.v} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.channels.includes(c.v)}
                  onChange={() => toggleChannel(c.v)}
                />
                {c.l}
              </label>
            ))}
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(e) => set("marketingOptIn", e.target.checked)}
            />
            Aceito receber conteúdo comercial futuro (opcional)
          </label>
        </fieldset>
        {/* honeypot anti-spam — invisível para humanos */}
        <input
          type="text"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          style={{ position: "absolute", left: -9999, opacity: 0 }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        {errors.length > 0 && <div className="error-box">{errors.join("; ")}</div>}
        {result && (
          <div
            className={result.ok ? "card" : "error-box"}
            style={result.ok ? { borderColor: "#3f6", padding: 10 } : {}}
          >
            {result.msg}
          </div>
        )}
        <button className="btn" disabled={busy}>
          {busy ? "Enviando…" : "Enviar manifestação"}
        </button>
      </form>
    </Section>
  );
}
