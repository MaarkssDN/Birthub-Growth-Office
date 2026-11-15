// Gera docs/time-agentes-bgo.html a partir do catálogo canônico + ficha funcional do time.
// Uso: node scripts/gen-time-agentes-html.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "packages/agents/data/catalog-29.json"), "utf8"));

// Ficha funcional BGO por agente (id -> área, função, o que faz, o que não faz, autonomia, status)
const FICHA = {
  // TORRE DE COMANDO
  aegis:   { area: "Torre de Comando", func: "CEO operacional do enxame", faz: "Recebe missões, decompõe em tarefas, delega aos especialistas, consolida resultados e abre pedidos de aprovação.", nao: "Não envia mensagem, não aprova a si mesmo, não altera orçamento, não executa ação L3+.", aut: "L2 interno", status: "IMPLEMENTADO" },
  sudo:    { area: "Torre de Comando", func: "CISO do time — guardião de governança", faz: "Audita permissões/RBAC, isolamento multi-tenant, provenance e consentimento LGPD; aponta violações de política.", nao: "Não é bypass administrativo; não concede permissão que o backend nega; não cruza workspaces.", aut: "L1 análise / L2 achados", status: "PLANEJADO" },
  core:    { area: "Torre de Comando", func: "CTO de IA — mente principal", faz: "Mantém prompts versionados, roteia casos de uso de IA, consolida memória por oportunidade, responde sobre o ecossistema.", nao: "Não executa ação de negócio; não substitui especialista; nunca envia saída externa.", aut: "L1/L2", status: "PLANEJADO" },
  // COMERCIAL
  relay:   { area: "Comercial", func: "Diretor de operações comerciais", faz: "Quebra missões em tarefas, gerencia dependências, SLA e handoffs; sequência Scout→Meridian→Beacon→Pledge.", nao: "Não qualifica, não escreve abordagem, não envia nada, não aprova missão fora de política.", aut: "L2", status: "IMPLEMENTADO" },
  meridian:{ area: "Comercial", func: "Qualificador SDR com rubrica versionada", faz: "Aplica rubrica ICP, identifica gaps, classifica qualified/nurture, grava score explicável campo a campo.", nao: "Não inventa respostas do lead; não reprova sem política; não promete nada ao contato.", aut: "L1/L2 score", status: "IMPLEMENTADO" },
  scout:   { area: "Comercial", func: "Detetive de contas e dossiês", faz: "Monta dossiê pré-reunião com proveniência por campo e confiança verified|inferred|missing; alimenta Meridian e Beacon.", nao: "Não faz scraping restrito, não coleta PII real, não inventa contatos.", aut: "L1/L2 rascunho", status: "IMPLEMENTADO" },
  beacon:  { area: "Comercial", func: "Redator de abordagens outbound", faz: "Monta rascunho = template aprovado + dossiê; vincula claimIds usados; respeita opt-out e a guarda anti-promoções.", nao: "NUNCA envia (channel.send bloqueado); sem preço, %, garantia, SLA ou case sem claim approved.", aut: "L1 rascunho / L3 envio BLOQUEADO", status: "IMPLEMENTADO" },
  pledge:  { area: "Comercial", func: "Guardião de promessas e follow-up", faz: "Extrai compromissos de interações, cria tarefas/lembretes com responsável e prazo, alimenta nextAction da oportunidade.", nao: "Não confirma reunião sem evidência; não faz follow-up externo; não fecha ciclo sem aprovação humana.", aut: "L2 lembretes", status: "IMPLEMENTADO" },
  forge:   { area: "Comercial", func: "Closer copilot — apoia, nunca fecha", faz: "Prepara pauta de reunião, analisa objeções prováveis, organiza contexto de proposta e sugere táticas.", nao: "Não negocia preço, não promete desconto, não envia proposta; exceção exige Helm+Apex+humano.", aut: "L1/L2", status: "PLANEJADO" },
  helm:    { area: "Comercial", func: "Gerente comercial IA", faz: "Consolida conversão por etapa, detecta desvio de meta, propõe alçadas de desconto e prioriza pipeline travado.", nao: "Não aprova desconto de exceção sozinho — exige confirmação humana nominal.", aut: "L1/L2 recomendação", status: "PLANEJADO" },
  apex:    { area: "Comercial", func: "Diretor executivo IA", faz: "Visão macro de receita: consolida forecast, aponta concentração de risco, recomenda realocação de esforço.", nao: "Não é autoridade irrestrita — toda exceção vira approval.requested; não executa operação.", aut: "L1/L2", status: "PLANEJADO" },
  aria:    { area: "Comercial", func: "Maestrina de fluxos e cadências", faz: "Organiza etapas de cadência, prioriza contatos do dia, apoia roleplay e equilibra carga entre canais.", nao: "Não dispara cadência externa; etapa scheduled exige aprovação humana (Onda 19).", aut: "L1/L2", status: "PLANEJADO" },
  vanguard:{ area: "Comercial", func: "Estrategista de metas e funil", faz: "Mede conversão por estágio, investiga perdas e deals estagnados, compara cohort semanal.", nao: "Não inventa métrica; números reconciliam com o banco; simulado nunca soma com real.", aut: "L1", status: "PLANEJADO" },
  oracle:  { area: "Comercial", func: "Visionário de forecast", faz: "Pondera pipeline por score + sinais, modela cenários otimista/base/pessimista e expõe premissas.", nao: "Forecast é estimativa rotulada, nunca promessa; premissa não verificada = PENDENTE_DE_VALIDACAO.", aut: "L1", status: "PLANEJADO" },
  tribunal:{ area: "Comercial", func: "Advogado do diabo — auditor cético", faz: "Testa hipóteses de negócio, aponta riscos e lacunas, pode REBAIXAR rating de oportunidade com justificativa.", nao: "Não promove nada; não veta sem evidência registrada; contraprova sempre citável.", aut: "L1/L2 rebaixar", status: "PLANEJADO" },
  echo:    { area: "Comercial", func: "Especialista em voz e engajamento", faz: "Analisa transcrições de calls, sugere pontos de objeção, prepara resumo pós-call para o Pledge.", nao: "Não liga; discador real é Vox (bloqueado); não grava sem consentimento e base legal.", aut: "L1", status: "PLANEJADO" },
  vox:     { area: "Comercial", func: "Discador autônomo (canal futuro)", faz: "Contrato futuro do canal de voz com AMD e saudação governada — quando autorizado.", nao: "NÃO LIGA hoje; discagem exige Onda 26+ com aprovação nominal por lote.", aut: "Execução proibida (L4-adj.)", status: "BLOQUEADO" },
  // FINANCEIRO
  ledger:  { area: "Financeiro", func: "Auditor de faturamento e contratos", faz: "Reconcilia oferta × contrato × cobrança; aponta divergência entre claim aprovado e promessa; alimenta forecasts com dados lastreados.", nao: "Não movimenta dinheiro (pagamento = L4); não emite cobrança; não aprova preço fora da tabela.", aut: "L1/L2 bloqueio", status: "PLANEJADO" },
  harbinger:{ area: "Financeiro", func: "Oráculo de receita preditiva", faz: "Modela MRR projetado, churn-weighted pipeline e cenários combinando qualificação, cadência e retenção.", nao: "Estimativa nunca é fato; sem dados suficientes = PENDENTE_DE_VALIDACAO; nunca promete número a cliente.", aut: "L1", status: "PLANEJADO" },
  // MARKETING
  nexus:   { area: "Marketing", func: "Analista de inteligência de mercado", faz: "Pesquisa empresas, contatos, ICP e decisores em fontes autorizadas; consolida sinais para Scout e Tracker.", nao: "Sem scraping irrestrito; depende de integrações/credenciais autorizadas.", aut: "L1", status: "PLANEJADO" },
  tracker: { area: "Marketing", func: "Scanner de mercado — caçador de contas", faz: "Vigia fontes autorizadas (base CNPJ, portais, formulários), propõe listas de contas novas com provenance.", nao: "Não enriquece com dado pessoal sem base legal; lista nova entra como draft até revisão.", aut: "L1/L2 rascunho", status: "PLANEJADO" },
  scope:   { area: "Marketing", func: "Diagnóstico de leads inbound", faz: "Classifica leads por maturidade, aponta campos faltantes, sugere rota (Meridian direto vs. nutrição).", nao: "Não descarta lead sem rubrica; não envia resposta; diagnóstico sempre revisável.", aut: "L1/L2", status: "PLANEJADO" },
  spark:   { area: "Marketing", func: "Engenheiro de integrações e marketing ops", faz: "Monitora conectores e filas, organiza gatilhos (formulário→fila→diagnóstico), vigia integrações stub.", nao: "Não altera infra (L4); não cria credencial; mudança de conector exige revisão + auditoria.", aut: "L1/L2 rascunho", status: "PLANEJADO" },
  // CRM & RELACIONAMENTO
  orbit:   { area: "CRM & Relacionamento", func: "Guardião do CRM — dono do pipeline", faz: "Vigia integridade do funil, contas, contatos e propostas; aponta inconsistência de estágio e falta de rastreabilidade.", nao: "Personagem-pilar: não é executor; mutações saem por agentes com evento + auditoria.", aut: "Institucional", status: "PLANEJADO" },
  axiom:   { area: "CRM & Relacionamento", func: "LDR — inteligência e higiene de leads", faz: "Avalia sinais e qualidade de lead, sugere priorização, detecta duplicados/registros incompletos.", nao: "Não qualifica (é Meridian); não enriquece com PII sem provenance + consentimento.", aut: "L1/L2", status: "PLANEJADO" },
  cipher:  { area: "CRM & Relacionamento", func: "Guardião de integridade de dados", faz: "Detecta anomalia de sincronização, valida provenance de contatos, aponta registro sem consentimento.", nao: "Não corrige dado sensível sem regra; divergência vira incidente auditado, não edição silenciosa.", aut: "L1/L2 quarentena", status: "PLANEJADO" },
  anchor:  { area: "CRM & Relacionamento", func: "Guardião de retenção / customer success", faz: "Identifica conta em risco por sinais, propõe plano de resgate e prioriza contas para o time comercial.", nao: "Não contata cliente; não oferece desconto (Helm/Apex); ação reativa exige aprovação nominal.", aut: "L1/L2 rascunho", status: "PLANEJADO" },
  seal:    { area: "CRM & Relacionamento", func: "Guardião contratual — porta do L4", faz: "Organiza pendências de assinatura, acompanha formalização e bloqueia contrato sem revisão humana.", nao: "NUNCA envia contrato nem assina — contrato é L4 proibido; Seal prepara e bloqueia, humano decide.", aut: "L1 / bloqueio", status: "PLANEJADO" },
  tempo:   { area: "CRM & Relacionamento", func: "Copiloto tático do operador humano", faz: "Responde em chat com contexto do ecossistema: próximo passo, estado de missão, pendências de aprovação.", nao: "Não age em nome do operador; não aprova nada; toda sugestão é rotulada como sugestão.", aut: "L1", status: "PLANEJADO" },
};

// Propostas fora do catálogo canônico (aguardam catálogo v2)
const PROPOSTAS = [
  { id: "aurum", nome: "Aurum", papel: "Tesoureiro Digital", camada: "financeiro", comando: "Ei Aurum", arquetipo: "Non-Human Gilded Vault Core", animacao: "pulso dourado do cofre central", contexto: "Controladoria e custos de IA", descricao: "PROPOSTA — consolida custo de IA por provider/dia, orça missões e reconcilia usage records com auditoria.", cor_primaria: "#F59E0B", cor_secundaria: "#FCD34D", cor_destaque: "#B45309", mvp: false },
  { id: "delta", nome: "Delta", papel: "Analista de Recebíveis", camada: "financeiro", comando: "Ei Delta", arquetipo: "Non-Human Receivables Waveform", animacao: "varredura triangular de aging", contexto: "Risco de perda e follow-up de propostas", descricao: "PROPOSTA — aging de propostas, follow-up de proposta sem resposta e risco por estágio; alimenta Anchor e Ledger.", cor_primaria: "#34D399", cor_secundaria: "#059669", cor_destaque: "#F59E0B", mvp: false },
  { id: "lume", nome: "Lume", papel: "Criador de Conteúdo", camada: "marketing", comando: "Ei Lume", arquetipo: "Non-Human Content Prism", animacao: "refração de feixe em peças de conteúdo", contexto: "Biblioteca de templates e claims", descricao: "PROPOSTA — mantém templates versionados e só escreve sobre OfferClaim approved; todo conteúdo sai como rascunho.", cor_primaria: "#FBBF24", cor_secundaria: "#F59E0B", cor_destaque: "#FF2D9B", mvp: false },
  { id: "pulso", nome: "Pulso", papel: "Analista de Performance", camada: "marketing", comando: "Ei Pulso", arquetipo: "Non-Human Metric Oscilloscope", animacao: "onda de métricas por canal", contexto: "Marketing analytics de topo de funil", descricao: "PROPOSTA — mede o que cada canal/origem entrega (leads, qualificação, custo); fecha ciclo Nexus→Tracker→Scope→Vanguard.", cor_primaria: "#22D3EE", cor_secundaria: "#38BDF8", cor_destaque: "#34D399", mvp: false },
];

const FICHA_PROP = {
  aurum: { faz: "Consolida custo de IA por provider/dia, orça missões e reconcilia usage records com eventos de auditoria; alerta desvio de budget.", nao: "Nunca pausa job sozinho — isso é política (Sudo/Aegis + humano).", aut: "L1 leitura / L2 alerta", status: "PROPOSTA" },
  delta: { faz: "Aging de propostas emitidas, follow-up de proposta sem resposta, risco de perda por estágio; alimenta Anchor e Ledger.", nao: "Só dados internos do workspace; nunca contata cliente (é Pledge/Beacon com aprovação).", aut: "L1", status: "PROPOSTA" },
  lume:  { faz: "Biblioteca de conteúdo e claims versionados; sugere peças alinhadas às ofertas aprovadas; bloqueia claim pendente.", nao: "Só escreve sobre OfferClaim approved; todo conteúdo sai como rascunho para aprovação humana.", aut: "L1/L2 rascunho", status: "PROPOSTA" },
  pulso: { faz: "Mede o que cada canal/origem entrega de topo de funil: leads importados, taxa de qualificação, custo por lead.", nao: "Métricas reconciliam com o banco; nunca soma simulado com real.", aut: "L1", status: "PROPOSTA" },
};
const AREA_PROP = { aurum: "Financeiro", delta: "Financeiro", lume: "Marketing", pulso: "Marketing" };
const FUNC_PROP = { aurum: "Tesoureiro digital — controladoria", delta: "Analista de recebíveis e risco", lume: "Criador de conteúdo e claims", pulso: "Analista de performance de marketing" };

const AREAS = [
  { id: "torre", nome: "Torre de Comando", desc: "Governar, orquestrar e proteger a operação. Nenhum agente desta área toca cliente final.", membros: ["aegis", "sudo", "core"] },
  { id: "comercial", nome: "Comercial", desc: "Transformar contas em oportunidades qualificadas, propostas aprovadas e compromissos — sempre com rascunho, nunca com envio.", membros: ["relay", "meridian", "scout", "beacon", "pledge", "forge", "helm", "apex", "aria", "vanguard", "oracle", "tribunal", "echo", "vox"] },
  { id: "financeiro", nome: "Financeiro", desc: "Proteger receita e previsibilidade: auditar o que foi prometido e projetar o que deve entrar.", membros: ["ledger", "harbinger", "aurum", "delta"] },
  { id: "marketing", nome: "Marketing", desc: "Alimentar o topo do funil com inteligência de mercado, diagnóstico de inbound e conteúdo — sem disparo externo.", membros: ["nexus", "tracker", "scope", "spark", "lume", "pulso"] },
  { id: "crm", nome: "CRM & Relacionamento", desc: "A memória comercial: contas, contatos, pipeline, consentimento e retenção.", membros: ["orbit", "axiom", "cipher", "anchor", "seal", "tempo"] },
];

const STATUS_COR = {
  IMPLEMENTADO: ["#34D399", "Implementado"],
  SIMULADO: ["#22D3EE", "Simulado"],
  PLANEJADO: ["#94A3B8", "Planejado"],
  BLOQUEADO: ["#F87171", "Bloqueado"],
  PROPOSTA: ["#C084FC", "Proposta"],
};

const byId = new Map(catalog.personagens.map((p) => [p.id, p]));
for (const p of PROPOSTAS) byId.set(p.id, p);

function avatarSVG(p, size = 96) {
  const ini = p.nome.slice(0, 2).toUpperCase();
  const c1 = p.cor_primaria, c2 = p.cor_secundaria, c3 = p.cor_destaque;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar de ${p.nome}">
  <defs>
    <linearGradient id="g-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="r-${p.id}" cx="0.35" cy="0.3" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill="url(#g-${p.id})" stroke="${c3}" stroke-width="2.5"/>
  <polygon points="50,14 84,32 84,68 50,86 16,68 16,32" fill="none" stroke="${c3}" stroke-width="1" opacity="0.5"/>
  <circle cx="50" cy="50" r="26" fill="url(#r-${p.id})"/>
  <circle cx="50" cy="50" r="17" fill="#0b1020" opacity="0.82"/>
  <circle cx="43" cy="46" r="3.2" fill="${c1}"/><circle cx="57" cy="46" r="3.2" fill="${c1}"/>
  <path d="M43 56 q7 6 14 0" stroke="${c3}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <text x="50" y="94" text-anchor="middle" font-family="monospace" font-size="7" fill="${c3}" letter-spacing="1">${ini}</text>
</svg>`;
}

function fichaDe(p) {
  const f = FICHA[p.id] ?? FICHA_PROP[p.id];
  return {
    area: f.area ?? AREA_PROP[p.id],
    func: f.func ?? FUNC_PROP[p.id],
    faz: f.faz, nao: f.nao, aut: f.aut, status: f.status,
  };
}

function cardHTML(p) {
  const f = fichaDe(p);
  const [cor, rotulo] = STATUS_COR[f.status] ?? STATUS_COR.PLANEJADO;
  const proposta = f.status === "PROPOSTA" ? '<span class="tag prop">aguarda catálogo v2</span>' : "";
  const mvp = p.mvp ? '<span class="tag mvp">MVP ativo</span>' : "";
  return `<article class="card" style="--c1:${p.cor_primaria};--c2:${p.cor_secundaria};--c3:${p.cor_destaque}">
  <div class="card-top">
    ${avatarSVG(p, 84)}
    <div class="id">
      <h3>${p.nome}</h3>
      <div class="papel">${p.papel}</div>
      <div class="comando">${p.comando ?? ""}</div>
    </div>
  </div>
  <div class="func">${f.func}</div>
  <p class="arq"><em>${p.arquetipo ?? ""}</em> — ${p.animacao ?? ""}</p>
  <div class="block"><span class="lbl faz">O que faz</span><p>${f.faz}</p></div>
  <div class="block"><span class="lbl nao">O que não faz</span><p>${f.nao}</p></div>
  <div class="meta">
    <span class="badge" style="--bc:${cor}">${rotulo}</span>
    <span class="aut">Autonomia: ${f.aut}</span>
    ${mvp}${proposta}
  </div>
</article>`;
}

const secoes = AREAS.map((a) => {
  const cards = a.membros.map((id) => cardHTML(byId.get(id))).join("\n");
  return `<section class="area" id="${a.id}">
  <header class="area-head">
    <h2>${a.nome}</h2><span class="count">${a.membros.length} agentes</span>
    <p>${a.desc}</p>
  </header>
  <div class="grid">${cards}</div>
</section>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Birthub Growth Office — Time de Agentes</title>
<style>
  :root { --bg:#070b16; --panel:#0d1428; --line:#1e2a4a; --txt:#e6ecf7; --mut:#8fa0c4; --acc:#00D4FF; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:radial-gradient(1200px 600px at 70% -10%, #101a3a 0%, var(--bg) 55%); color:var(--txt);
         font-family:"Segoe UI",system-ui,sans-serif; padding:32px 20px 80px; }
  .wrap { max-width:1280px; margin:0 auto; }
  header.top { text-align:center; margin-bottom:36px; }
  header.top h1 { font-size:2rem; letter-spacing:.5px; }
  header.top h1 span { color:var(--acc); }
  header.top p { color:var(--mut); margin-top:8px; font-size:.95rem; }
  nav.toc { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin:20px 0 40px; }
  nav.toc a { color:var(--txt); text-decoration:none; background:var(--panel); border:1px solid var(--line);
              padding:6px 14px; border-radius:999px; font-size:.85rem; }
  nav.toc a:hover { border-color:var(--acc); }
  .area { margin-bottom:56px; }
  .area-head { border-left:4px solid var(--acc); padding-left:14px; margin-bottom:18px; }
  .area-head h2 { font-size:1.4rem; }
  .area-head .count { color:var(--mut); font-size:.8rem; margin-left:10px; text-transform:uppercase; letter-spacing:1px; }
  .area-head p { color:var(--mut); font-size:.9rem; margin-top:4px; max-width:760px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:18px; }
  .card { background:linear-gradient(160deg,var(--panel),#0a1122); border:1px solid var(--line);
          border-radius:16px; padding:18px; position:relative; overflow:hidden;
          border-top:3px solid var(--c1); transition:transform .15s, box-shadow .15s; }
  .card:hover { transform:translateY(-3px); box-shadow:0 10px 30px rgba(0,212,255,.12); }
  .card::before { content:""; position:absolute; inset:0 auto 0 0; width:4px;
                  background:linear-gradient(var(--c1),var(--c3)); opacity:.7; }
  .card-top { display:flex; gap:14px; align-items:center; }
  .id h3 { font-size:1.15rem; }
  .id .papel { color:var(--c1); font-size:.85rem; font-weight:600; }
  .id .comando { color:var(--mut); font-size:.75rem; font-family:monospace; }
  .func { margin:12px 0 4px; font-weight:600; font-size:.95rem; color:#fff; }
  .arq { color:var(--mut); font-size:.78rem; font-style:normal; margin-bottom:10px; line-height:1.35; }
  .block { margin:8px 0; }
  .lbl { display:inline-block; font-size:.68rem; text-transform:uppercase; letter-spacing:1px;
         padding:2px 8px; border-radius:4px; margin-bottom:3px; }
  .lbl.faz { background:rgba(52,211,153,.15); color:#34D399; }
  .lbl.nao { background:rgba(248,113,113,.15); color:#F87171; }
  .block p { font-size:.85rem; color:#c6d2ea; line-height:1.45; }
  .meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:12px; padding-top:10px; border-top:1px dashed var(--line); }
  .badge { font-size:.72rem; font-weight:700; padding:3px 10px; border-radius:999px; color:var(--bc); border:1px solid var(--bc); }
  .aut { font-size:.75rem; color:var(--mut); }
  .tag { font-size:.68rem; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,.06); color:var(--mut); border:1px solid var(--line); }
  .tag.mvp { color:#34D399; border-color:#34D39955; }
  .tag.prop { color:#C084FC; border-color:#C084FC55; }
  footer { text-align:center; color:var(--mut); font-size:.78rem; margin-top:40px; line-height:1.6; }
  footer code { color:var(--acc); }
  @media (max-width:640px){ .grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Birthub Growth Office — <span>Time de Agentes</span></h1>
    <p>${catalog.personagens.length} personas canônicas + ${PROPOSTAS.length} propostas · áreas: Comercial, Financeiro, Marketing, CRM e Torre de Comando</p>
  </header>
  <nav class="toc">
    ${AREAS.map((a) => `<a href="#${a.id}">${a.nome}</a>`).join("")}
  </nav>
  ${secoes}
  <footer>
    Avatares são <strong>conceituais</strong> (assets finais PLANEJADO no manifesto do catálogo).<br>
    Fontes: <code>packages/agents/data/catalog-29.json</code> · <code>docs/time-de-agentes.md</code> · governança <code>AGENTS.md</code>.<br>
    Nada aqui executa ação externa: L4 proibido, <code>channel.send</code> bloqueado, claims exigem aprovação.
  </footer>
</div>
</body>
</html>`;

const out = join(root, "docs", "time-agentes-bgo.html");
writeFileSync(out, html, "utf8");
console.log("gerado:", out);
