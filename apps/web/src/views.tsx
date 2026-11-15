import { useState } from "react";
import { api, setAuthToken, type CaptureInput, type SessionUser } from "./api";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card section-card" style={{ marginBottom: 20 }}>
      <div className="section-header">
        <h2 className="title-iris">{title}</h2>
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
    <div className="card login-card" id="login">
      <div className="login-card-badge">
        <span className="pill-badge iris">ACESSO RESTRITO</span>
        <span className="pill-badge gold">OPERADOR & AUDITORIA</span>
      </div>

      <div className="login-card-header">
        <h2 className="title-cyan">Birthub Growth Office — acesso do escritório</h2>
        <p className="subtitle-ice-cyan">
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
            <p className="subtitle-ice-iris tiny">É uma empresa interessada nas soluções Birthub 360?</p>
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
            <h2 id="capture-modal-title" className="title-gradient-cyan-iris">
              Manifestação de interesse comercial — Birthub 360
            </h2>
            <p className="subtitle-ice-cyan">
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
            <h4 className="privacy-title title-cyan">Privacidade e preferências de contato (LGPD)</h4>
            <p className="privacy-desc subtitle-ice-cyan">
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

/* -------------------------------------------------------------------------- */
/* SALES LANDING PAGE (Baseada no Modelo do Birthub 360)                      */
/* Regra de Ouro: Nenhum título ou subtítulo em branco ou preto              */
/* -------------------------------------------------------------------------- */

export function PublicPortalView({
  onLogin,
}: {
  onLogin: (u: SessionUser) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="landing-container">
      {/* 1. Hero Section de Alta Conversão */}
      <section className="hero-sales" id="inicio">
        <div className="hero-badge-wrap">
          <span className="pill-badge cyan">⚡ ECOSSISTEMA DE ALTA PERFORMANCE</span>
          <span className="pill-badge iris">CENTRO DE COMANDO COMERCIAL</span>
          <span className="pill-badge gold">ONDA 14 · ISOLAMENTO 127.0.0.1</span>
        </div>

        <h1 className="hero-sales-title">
          Aqui está o centro de comando da sua{" "}
          <span className="title-gradient-cyan-iris">operação comercial com agentes de IA</span>
        </h1>

        <p className="hero-sales-subtitle subtitle-ice-cyan">
          Conecte prospecção inteligente, qualificação preditiva com modelos de IA locais custo zero,
          abordagens orientadas por claims validados e governança em um ecossistema executivo unificado.
        </p>

        <div className="hero-ctas-wrap">
          <button
            type="button"
            className="btn cta-modal-btn"
            onClick={() => setModalOpen(true)}
          >
            <span>🚀 Solicitar Demonstração Operacional (Modal)</span>
            <span className="btn-arrow">→</span>
          </button>
          <a href="#acesso" className="btn secondary">
            <span>🔐 Acessar Central do Escritório</span>
            <span className="btn-arrow">↓</span>
          </a>
        </div>

        <div className="hero-trust-bar">
          <span className="trust-item">🔒 Isolamento Multi-tenant RLS</span>
          <span className="trust-item">🤖 6 Agentes Especializados</span>
          <span className="trust-item">💰 IA com Custo R$ 0,00</span>
          <span className="trust-item">🛡️ Conformidade Estrita LGPD</span>
          <span className="trust-item">📊 EventStore Imutável</span>
        </div>
      </section>

      {/* 2. Stats Strip (Métricas de Impacto) */}
      <section className="stats-strip-grid">
        <div className="stat-card">
          <div className="stat-number title-cyan">6</div>
          <div className="stat-label title-iris">Agentes Autônomos Ativos</div>
          <p className="stat-desc subtitle-ice-cyan">Scout, Meridian, Beacon, Relay, Pledge e Aegis em cooperação contínua.</p>
        </div>
        <div className="stat-card">
          <div className="stat-number title-gold">R$ 0,00</div>
          <div className="stat-label title-gold">Custo de Inferência Externa</div>
          <p className="stat-desc subtitle-warm-gold">Inferência local Ollama multithreaded na CPU com privacidade absoluta.</p>
        </div>
        <div className="stat-card">
          <div className="stat-number title-emerald">100%</div>
          <div className="stat-label title-emerald">Auditabilidade e LGPD</div>
          <p className="stat-desc subtitle-emerald">Ledger de auditoria append-only e isolamento rigoroso de dados sintéticos.</p>
        </div>
        <div className="stat-card">
          <div className="stat-number title-magenta">L0–L3</div>
          <div className="stat-label title-magenta">Autonomia Supervisionada</div>
          <p className="stat-desc subtitle-soft-magenta">Zero disparos automáticos não autorizados: aprovação humana como chave.</p>
        </div>
      </section>

      {/* 3. Pain vs Solution (Onde operações falham vs Como o Birthub resolve) */}
      <section className="landing-section" id="solucao">
        <div className="landing-section-header">
          <span className="pill-badge magenta">DIAGNÓSTICO ESTRATÉGICO</span>
          <h2 className="title-gradient-magenta-iris">
            Por que as operações comerciais tradicionais estagnam?
          </h2>
          <p className="subtitle-warm-gold">
            A fragmentação de dados em planilhas, CRMs estáticos e disparos genéricos destrói a
            conversão e queima a reputação da sua marca no mercado.
          </p>
        </div>

        <div className="comparison-grid">
          <div className="comparison-card pain">
            <span className="pill-badge magenta">OPERAÇÃO CONVENCIONAL FRAGMENTADA</span>
            <ul className="comparison-list">
              <li className="comparison-item">
                <span className="comparison-icon">❌</span>
                <span className="subtitle-soft-magenta">Prospecção manual cega: horas perdidas buscando empresas sem fit de ICP.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">❌</span>
                <span className="subtitle-soft-magenta">Qualificação subjetiva: leads passam adiante sem critério técnico verificável.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">❌</span>
                <span className="subtitle-soft-magenta">Mensagens alucinadas: promessas comerciais não autorizadas feitas por vendedores.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">❌</span>
                <span className="subtitle-soft-magenta">Custos descontrolados com APIs de nuvem e ferramentas desconectadas.</span>
              </li>
            </ul>
          </div>

          <div className="comparison-card solution">
            <span className="pill-badge cyan">ARQUITETURA BIRTHUB 360 & GROWTH OFFICE</span>
            <ul className="comparison-list">
              <li className="comparison-item">
                <span className="comparison-icon">✅</span>
                <span className="subtitle-ice-cyan">Central Scout automatizada com cruzamento de CNAE, porte e filtros de mercado.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">✅</span>
                <span className="subtitle-ice-cyan">Diagnóstico preditivo Meridian com IA estruturada baseada em regras de ICP.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">✅</span>
                <span className="subtitle-ice-cyan">Roteiros Beacon fundamentados em catálogo canônico de claims auditados.</span>
              </li>
              <li className="comparison-item">
                <span className="comparison-icon">✅</span>
                <span className="subtitle-ice-cyan">Governança Aegis com orçamento R$ 0,00 e proteção nativa de privacidade.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Os 4 Pilares da Plataforma */}
      <section className="landing-section" id="pilares">
        <div className="landing-section-header">
          <span className="pill-badge iris">ARQUITETURA INTEGRADA</span>
          <h2 className="title-gradient-cyan-iris">
            Os 4 Pilares da Nossa Arquitetura Comercial
          </h2>
          <p className="subtitle-ice-iris">
            Projetada para que inteligência artificial, dados reais e supervisão executiva trabalhem
            em sincronia do primeiro contato ao fechamento.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box">🔍</div>
            <h3 className="title-cyan">1. Scout & Inteligência</h3>
            <p className="subtitle-ice-cyan">
              Varredura de dados públicos, deduplicação transacional, classificação de CNAE e mapeamento
              imediato de alvos com alto potencial.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box">⚖️</div>
            <h3 className="title-iris">2. Diagnóstico & Fit ICP</h3>
            <p className="subtitle-ice-iris">
              O agente Meridian analisa maturidade, calcula pontuações transparentes e identifica lacunas
              antes de qualquer esforço de contato.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box">📢</div>
            <h3 className="title-gold">3. Abordagem Validada</h3>
            <p className="subtitle-warm-gold">
              O agente Beacon formula planos de comunicação estritamente baseados em diferenciais e
              propostas de valor previamente homologadas.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box">🛡️</div>
            <h3 className="title-emerald">4. Governança & Risco</h3>
            <p className="subtitle-emerald">
              Aegis e Pledge garantem que nenhum envio ocorra sem autorização formal e que todo evento
              seja registrado de forma indelével.
            </p>
          </div>
        </div>
      </section>

      {/* 5. A Força de Trabalho Autônoma (Os 6 Agentes) */}
      <section className="landing-section" id="agentes">
        <div className="landing-section-header">
          <span className="pill-badge green">AGENTES ESPECIALIZADOS</span>
          <h2 className="title-gradient-emerald-cyan">
            Conheça sua Força de Trabalho Comercial com IA
          </h2>
          <p className="subtitle-emerald">
            Cada agente possui responsabilidades delimitadas por contratos TypeScript estritos e
            presta contas diretamente ao operador humano.
          </p>
        </div>

        <div className="agents-showcase-grid">
          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(0, 212, 255, 0.12)", color: "#00D4FF" }}>
              🔍
            </div>
            <div className="agent-info">
              <h3 className="title-cyan">Scout</h3>
              <span className="agent-role-pill title-cyan">Inteligência de Mercado</span>
              <p className="subtitle-ice-cyan">Importação em lote de empresas, higienização de bases e identificação de sinais comerciais.</p>
            </div>
          </div>

          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(139, 125, 255, 0.12)", color: "#8B7DFF" }}>
              ⚖️
            </div>
            <div className="agent-info">
              <h3 className="title-iris">Meridian</h3>
              <span className="agent-role-pill title-iris">Qualificação & ICP</span>
              <p className="subtitle-ice-iris">Diagnóstico automatizado com IA estruturada, enquadramento por perfil e análise de maturidade.</p>
            </div>
          </div>

          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(255, 193, 7, 0.12)", color: "#FFC107" }}>
              📢
            </div>
            <div className="agent-info">
              <h3 className="title-gold">Beacon</h3>
              <span className="agent-role-pill title-gold">Comunicação Estratégica</span>
              <p className="subtitle-warm-gold">Elaboração de narrativas de abordagem ancoradas em diferenciais e ofertas comprovadas.</p>
            </div>
          </div>

          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981" }}>
              🔄
            </div>
            <div className="agent-info">
              <h3 className="title-emerald">Relay</h3>
              <span className="agent-role-pill title-emerald">Orquestração & Pipeline</span>
              <p className="subtitle-emerald">Sincronização de etapas, avanço de oportunidades e transições de estado supervisionadas.</p>
            </div>
          </div>

          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(255, 45, 155, 0.12)", color: "#FF2D9B" }}>
              📅
            </div>
            <div className="agent-info">
              <h3 className="title-magenta">Pledge</h3>
              <span className="agent-role-pill title-magenta">Compromissos & SLA</span>
              <p className="subtitle-soft-magenta">Acompanhamento de prazos, próximos passos operacionais e cadência comercial sem atritos.</p>
            </div>
          </div>

          <div className="agent-showcase-card">
            <div className="agent-avatar-box" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38BDF8" }}>
              🛡️
            </div>
            <div className="agent-info">
              <h3 className="title-cyan">Aegis</h3>
              <span className="agent-role-pill title-cyan">Compliance & Auditoria</span>
              <p className="subtitle-ice-cyan">Guardião de políticas de privacidade, auditoria contínua e barreira contra envios indevidos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Governança e Segurança */}
      <section className="landing-section" id="governanca">
        <div className="landing-section-header">
          <span className="pill-badge gold">SEGURANÇA CORPORATIVA</span>
          <h2 className="title-gradient-gold-amber">
            Governança e Segurança Não Negociáveis
          </h2>
          <p className="subtitle-warm-gold">
            Princípios invioláveis registrados no AGENTS.md que asseguram conformidade jurídica e
            técnica sem precedentes.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box">🔒</div>
            <h3 className="title-gold">Isolamento Local</h3>
            <p className="subtitle-warm-gold">Todo tráfego e banco de dados operam exclusivamente vinculados a 127.0.0.1 em portas seguras.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-icon-box">🛡️</div>
            <h3 className="title-cyan">Guarda LGPD Nativa</h3>
            <p className="subtitle-ice-cyan">Nenhum dado real ou não sanitizado sai para provedores de nuvem: dados sintéticos controlados.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-icon-box">🚫</div>
            <h3 className="title-magenta">Sem Envios Externos</h3>
            <p className="subtitle-soft-magenta">O motor de políticas bloqueia no backend qualquer tentativa de disparo sem validação prévia.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-icon-box">📋</div>
            <h3 className="title-emerald">Ofertas Auditadas</h3>
            <p className="subtitle-emerald">Propostas só utilizam informações comprovadas. Itens pendentes de validação são bloqueados.</p>
          </div>
        </div>
      </section>

      {/* 7. FAQ Estratégico */}
      <section className="landing-section" id="faq">
        <div className="landing-section-header">
          <span className="pill-badge iris">TIRA-DÚVIDAS</span>
          <h2 className="title-gradient-cyan-iris">
            Perguntas Frequentes sobre a Solução
          </h2>
          <p className="subtitle-ice-iris">
            Respostas diretas sobre como a plataforma opera em produção supervisionada.
          </p>
        </div>

        <div className="faq-grid">
          <div className="faq-card">
            <h3 className="title-cyan">Como o Birthub 360 garante custo R$ 0,00 de inteligência artificial?</h3>
            <p className="subtitle-ice-cyan">
              A arquitetura prioriza modelos locais via Ollama (Qwen 2.5) rodando diretamente na infraestrutura
              hospedeira, com adaptadores gratuitos em fallback ordenado e teto orçamentário configurado em R$ 0.
            </p>
          </div>

          <div className="faq-card">
            <h3 className="title-iris">Os agentes tomam decisões ou enviam mensagens sozinhos?</h3>
            <p className="subtitle-ice-iris">
              Não. A operação funciona em autonomia supervisionada (níveis L0 a L3). Toda mensagem comercial
              e transição de etapa depende de aprovação explícita do operador humano na Central de Aprovações.
            </p>
          </div>

          <div className="faq-card">
            <h3 className="title-gold">Como é tratada a privacidade de dados (LGPD)?</h3>
            <p className="subtitle-warm-gold">
              Toda interação armazena o histórico formal de consentimento, versão do aviso de privacidade e
              canais autorizados. Dados sensíveis nunca saem do perímetro local protegido.
            </p>
          </div>

          <div className="faq-card">
            <h3 className="title-emerald">Como solicitar uma demonstração técnica com o time do escritório?</h3>
            <p className="subtitle-emerald">
              Basta clicar no botão de manifestação nesta página para abrir o formulário controlado em modal
              e registrar as informações da sua empresa.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Chamada Final de Conversão */}
      <section className="final-conversion-banner">
        <span className="pill-badge gold">PRÓXIMO PASSO</span>
        <h2 className="title-gradient-gold-amber">
          Pare de pilotar sua operação comercial no escuro.
        </h2>
        <p className="subtitle-ice-cyan">
          Descubra como o ecossistema Birthub 360 e os 6 agentes de IA podem acelerar a qualificação
          e estruturar seu pipeline comercial com governança auditável.
        </p>
        <button
          type="button"
          className="btn cta-gold-btn"
          onClick={() => setModalOpen(true)}
          style={{ fontSize: 15, padding: "14px 28px" }}
        >
          <span>📋 Solicitar Demonstração Operacional Agora (Modal) ↗</span>
        </button>
      </section>

      {/* 9. Hub de Acesso: Card de Captação e Login do Escritório */}
      <section className="landing-section" id="acesso" style={{ borderBottom: "none" }}>
        <div className="landing-section-header">
          <span className="pill-badge cyan">CENTRAL DE ACESSO</span>
          <h2 className="title-gradient-cyan-iris">
            Canais de Atendimento e Operação
          </h2>
          <p className="subtitle-ice-cyan">
            Acesso público para manifestações comerciais e login exclusivo para operadores autorizados.
          </p>
        </div>

        <div className="portal-cards-grid">
          {/* Card 1: Portal de Captação e Interesse Comercial (.card) */}
          <div className="card capture-portal-card">
            <div className="login-card-badge">
              <span className="pill-badge magenta">OPERAÇÃO COMERCIAL</span>
              <span className="pill-badge green">CANAL OFICIAL</span>
            </div>

            <div className="capture-portal-header">
              <h2 className="title-magenta">Manifestação de interesse comercial</h2>
              <p className="subtitle-ice-cyan">
                Canal oficial e controlado para empresas interessadas nas soluções e tecnologias do
                ecossistema Birthub 360.
              </p>
            </div>

            <div className="capture-highlights-list">
              <div className="capture-highlight-item">
                <span className="highlight-icon">🔒</span>
                <div className="highlight-content">
                  <strong className="title-cyan">Conformidade LGPD v1</strong>
                  <p className="subtitle-ice-cyan">Armazenamento estrito e auditável com consentimento formal.</p>
                </div>
              </div>

              <div className="capture-highlight-item">
                <span className="highlight-icon">🤖</span>
                <div className="highlight-content">
                  <strong className="title-iris">Triagem Meridian Supervisionada</strong>
                  <p className="subtitle-ice-iris">Enquadramento automatizado por perfil ICP sem promessas não validadas.</p>
                </div>
              </div>

              <div className="capture-highlight-item">
                <span className="highlight-icon">🚫</span>
                <div className="highlight-content">
                  <strong className="title-gold">Sem Envios Externos Não Autorizados</strong>
                  <p className="subtitle-warm-gold">Bloqueio total de mensagens automáticas na Onda atual.</p>
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
              <span className="cta-note subtitle-ice-iris tiny">
                Abre o formulário seguro em modal sobreposto.
              </span>
            </div>
          </div>

          {/* Card 2: Acesso do Escritório (Login) (.card.last()) */}
          <LoginView
            onLogin={onLogin}
            onOpenCapture={() => setModalOpen(true)}
          />
        </div>
      </section>

      {/* Modal Seguro Sobreposto */}
      <CaptureModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
