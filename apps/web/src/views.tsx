import { useState } from "react";
import { api, setAuthToken, type CaptureInput, type SessionUser } from "./api";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card section-card" style={{ marginBottom: 20 }}>
      <div className="section-header">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function LoginView({
  onLogin,
  onOpenCapture,
}: {
  onLogin: (u: SessionUser) => void;
  onOpenCapture?: () => void;
}) {
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
    <div className="card login-card">
      <div className="login-card-badge">
        <span className="pill-badge iris">ACESSO RESTRITO</span>
        <span className="pill-badge gold">OPERADOR & AUDITORIA</span>
      </div>

      <div className="login-card-header">
        <h2>Birthub Growth Office — acesso do escritório</h2>
        <p className="muted">
          Ambiente de controle comercial supervisionado. Credenciais locais restritas ao operador
          autorizado.
        </p>
      </div>

      <form onSubmit={submit} className="login-form">
        <label className="form-field">
          <span className="field-label">E-mail corporativo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex: owner@bgo.local"
            required
            autoComplete="username"
          />
        </label>

        <label className="form-field">
          <span className="field-label">Senha de autenticação</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div className="error-box" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button className="btn primary login-btn" disabled={busy} type="submit">
          {busy ? (
            <>
              <span className="spinner-sm" />
              <span>Autenticando…</span>
            </>
          ) : (
            <>
              <span>Entrar</span>
              <span className="btn-arrow">→</span>
            </>
          )}
        </button>

        <div className="login-hint">
          <div className="login-hint-item">
            <span className="hint-label">Operador padrão:</span>
            <code>owner@bgo.local</code>
          </div>
          <div className="login-hint-item">
            <span className="hint-label">Ambiente:</span>
            <span className="badge green">Local 127.0.0.1</span>
          </div>
        </div>

        {onOpenCapture && (
          <div className="login-alt-cta">
            <p className="muted tiny">É uma empresa interessada nas soluções Birthub 360?</p>
            <button
              type="button"
              className="btn text-btn"
              onClick={onOpenCapture}
            >
              📋 Manifestar interesse comercial via formulário
            </button>
          </div>
        )}
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
  { v: "email", l: "E-mail", icon: "✉️" },
  { v: "whatsapp", l: "WhatsApp", icon: "💬" },
  { v: "phone", l: "Telefone", icon: "📞" },
];

export function CaptureModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-modal-title"
    >
      <div className="modal-dialog capture-modal-dialog">
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="pill-badge cyan">CAPTAÇÃO SUPERVISIONADA</span>
            <h2 id="capture-modal-title">Manifestação de interesse comercial — Birthub 360</h2>
            <p className="muted">
              Formulário oficial do Growth Office. Seus dados ficam protegidos no banco exclusivo
              do escritório com governança estrita de privacidade. Nenhuma mensagem automática externa
              é enviada na Onda atual.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <CaptureFormContent onDone={() => {}} />
        </div>
      </div>
    </div>
  );
}

export function CaptureFormContent({ onDone }: { onDone?: () => void }) {
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
    if (form.name.trim().length < 2) errs.push("Nome é obrigatório (mínimo 2 caracteres)");
    if (form.company.trim().length < 2) errs.push("Empresa é obrigatória (mínimo 2 caracteres)");
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
      if (onDone) onDone();
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="capture-form">
      <div className="validation-notice">
        <span className="notice-icon">ℹ️</span>
        <span className="notice-text">
          Informações comerciais detalhadas (preços, planos, SLA) estão{" "}
          <strong>PENDENTES DE VALIDAÇÃO</strong> pelo catálogo de ofertas e são fornecidas de forma
          supervisionada.
        </span>
      </div>

      <div className="form-grid-2">
        <label className="form-field">
          <span className="field-label">Nome completo *</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="ex: Carlos Silva"
            required
          />
        </label>

        <label className="form-field">
          <span className="field-label">Nome da Empresa *</span>
          <input
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="ex: Alpha Logística S.A."
            required
          />
        </label>
      </div>

      <div className="form-grid-2">
        <label className="form-field">
          <span className="field-label">E-mail profissional *</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="ex: contato@empresa.com.br"
            required
          />
        </label>

        <label className="form-field">
          <span className="field-label">Telefone / WhatsApp (opcional)</span>
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(11) 98765-4321"
          />
        </label>
      </div>

      <div className="form-grid-2">
        <label className="form-field">
          <span className="field-label">Interesse comercial</span>
          <select value={form.interest} onChange={(e) => set("interest", e.target.value)}>
            {INTEREST_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">Origem do contato</span>
          <select value={form.source} onChange={(e) => set("source", e.target.value)}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="privacy-card">
        <div className="privacy-header">
          <span className="privacy-icon">🛡️</span>
          <div>
            <h4 className="privacy-title">Privacidade e preferências de contato (LGPD)</h4>
            <p className="privacy-desc">
              Aviso de privacidade v1 (<code>lgpd-notice-v1</code>): seus dados são protegidos por
              persistência estrita e usados exclusivamente para responder a esta manifestação com
              base em consentimento. Exclusão garantida sob demanda.
            </p>
          </div>
        </div>

        <div className="channel-section">
          <span className="channel-title">Canais de contato autorizados:</span>
          <div className="channel-chips">
            {CHANNEL_OPTIONS.map((c) => {
              const active = form.channels.includes(c.v);
              return (
                <button
                  type="button"
                  key={c.v}
                  className={`channel-chip ${active ? "active" : ""}`}
                  onClick={() => toggleChannel(c.v)}
                >
                  <span className="channel-check">{active ? "✓" : "+"}</span>
                  <span>{c.icon}</span>
                  <span>{c.l}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="optin-toggle">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={(e) => set("marketingOptIn", e.target.checked)}
          />
          <span className="optin-text">
            Aceito receber comunicações sobre atualizações do Birthub 360 (opcional)
          </span>
        </label>
      </div>

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

      {errors.length > 0 && (
        <div className="error-box">
          <span className="error-icon">⚠️</span>
          <span>{errors.join("; ")}</span>
        </div>
      )}

      {result && (
        <div className={`result-box ${result.ok ? "success" : "error"}`}>
          <span className="result-icon">{result.ok ? "✅" : "❌"}</span>
          <span>{result.msg}</span>
        </div>
      )}

      <div className="form-actions">
        <button className="btn primary submit-btn" disabled={busy} type="submit">
          {busy ? (
            <>
              <span className="spinner-sm" />
              <span>Processando manifestação…</span>
            </>
          ) : (
            <>
              <span>Enviar manifestação</span>
              <span className="btn-arrow">✓</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function CaptureView({
  inModal = false,
  onClose,
}: {
  inModal?: boolean;
  onClose?: () => void;
}) {
  if (inModal && onClose) {
    return <CaptureModal isOpen={true} onClose={onClose} />;
  }

  return (
    <Section title="Manifestação de interesse comercial — Birthub 360">
      <CaptureFormContent />
    </Section>
  );
}

export function PublicPortalView({
  onLogin,
}: {
  onLogin: (u: SessionUser) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="public-portal">
      {/* Hero Central */}
      <div className="portal-hero">
        <div className="portal-hero-badge">
          <span className="pill-badge iris">GOVERNANÇA AUDITÁVEL</span>
          <span className="pill-badge cyan">ONDA 14 · ISOLAMENTO 127.0.0.1</span>
        </div>
        <h1 className="portal-hero-title">
          Plataforma Comercial <span className="text-gradient-cyan">Integrada & Autônoma</span>
        </h1>
        <p className="portal-hero-subtitle">
          Operação corporativa do Growth Office: prospecção inteligente, diagnóstico multimodelo com
          IA local custo zero e governança supervisionada para o ecossistema Birthub 360.
        </p>
      </div>

      {/* Grid de 2 Cards Equilibrados */}
      <div className="portal-cards-grid">
        {/* Card 1: Portal de Captação e Interesse Comercial */}
        <div className="card capture-portal-card">
          <div className="login-card-badge">
            <span className="pill-badge magenta">OPERAÇÃO COMERCIAL</span>
            <span className="pill-badge green">CANAL OFICIAL</span>
          </div>

          <div className="capture-portal-header">
            <h2>Manifestação de interesse comercial</h2>
            <p className="muted">
              Canal oficial e controlado para empresas interessadas nas soluções e tecnologias do
              ecossistema Birthub 360.
            </p>
          </div>

          <div className="capture-highlights-list">
            <div className="capture-highlight-item">
              <span className="highlight-icon">🔒</span>
              <div className="highlight-content">
                <strong>Conformidade LGPD v1</strong>
                <p>Armazenamento estrito e auditável com consentimento formal.</p>
              </div>
            </div>

            <div className="capture-highlight-item">
              <span className="highlight-icon">🤖</span>
              <div className="highlight-content">
                <strong>Triagem Meridian Supervisionada</strong>
                <p>Enquadramento automatizado por perfil ICP sem promessas não validadas.</p>
              </div>
            </div>

            <div className="capture-highlight-item">
              <span className="highlight-icon">🚫</span>
              <div className="highlight-content">
                <strong>Sem Envios Externos Não Autorizados</strong>
                <p>Bloqueio total de mensagens automáticas na Onda atual.</p>
              </div>
            </div>
          </div>

          <div className="capture-portal-cta">
            <button
              type="button"
              className="btn cta-modal-btn"
              onClick={() => setModalOpen(true)}
            >
              <span>📋 Manifestar interesse comercial (Abrir Formulário)</span>
              <span className="btn-arrow">↗</span>
            </button>
            <span className="cta-note muted tiny">
              Abre o formulário seguro em modal sobreposto.
            </span>
          </div>
        </div>

        {/* Card 2: Acesso do Escritório (Login) */}
        <LoginView
          onLogin={onLogin}
          onOpenCapture={() => setModalOpen(true)}
        />
      </div>

      {/* Modal Seguro Sobreposto */}
      <CaptureModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
