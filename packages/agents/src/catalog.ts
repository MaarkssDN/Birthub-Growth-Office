import { z } from "zod";
import type { AgentDefinition, CharacterPersona } from "@bgo/contracts";
import { AgentLayer, ImplementationStatus } from "@bgo/contracts";
import catalogJson from "../data/catalog-29.json" with { type: "json" };

const CatalogEntry = z.object({
  id: z.string(),
  nome: z.string(),
  papel: z.string(),
  camada: z.enum(["pillar", "commercial-agent", "channel-agent", "orchestration"]),
  camada_nome: z.string(),
  agentId: z.string().nullable(),
  comando: z.string().optional(),
  arquetipo: z.string().optional(),
  animacao: z.string().optional(),
  contexto: z.string().optional(),
  descricao: z.string().optional(),
  cor_primaria: z.string(),
  cor_secundaria: z.string(),
  cor_destaque: z.string(),
  mvp: z.boolean(),
  status_documental: z.string().optional(),
  status_texto: z.string().optional(),
  evidencia_documental: z.string().optional(),
  limite_documentado: z.string().optional(),
  atividades_documentadas: z.array(z.string()).optional(),
  status_do_novo_projeto: z.string().optional(),
});

const CatalogFile = z.object({
  produto: z.string(),
  versao: z.string(),
  data: z.string(),
  fonte: z.string().optional(),
  total: z.number(),
  mvp: z.number(),
  personagens: z.array(CatalogEntry),
});

export type CatalogEntry = z.infer<typeof CatalogEntry>;

const LAYER_MAP: Record<CatalogEntry["camada"], AgentLayer> = {
  pillar: "pillar",
  "commercial-agent": "commercial",
  "channel-agent": "channel",
  orchestration: "supervision",
};

export const MVP_AGENT_IDS = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"] as const;
export type MvpAgentId = (typeof MVP_AGENT_IDS)[number];

const STATIONS: Record<MvpAgentId, string> = {
  aegis: "Torre de Controle",
  relay: "Central de Orquestração",
  scout: "Observatório de Mercado",
  meridian: "Sala de Qualificação",
  beacon: "Estúdio de Abordagem",
  pledge: "Mesa de Compromissos",
};

const SUMMARIES: Record<MvpAgentId, string> = {
  aegis: "Supervisor da operação: planeja, delega, consolida e verifica políticas.",
  relay: "Coordenador comercial: quebra missões em tarefas, SLA e handoffs.",
  scout: "Pesquisa e dossiê de contas em fontes autorizadas, com proveniência.",
  meridian: "Qualificação SDR com rubrica versionada e score explicável.",
  beacon: "Rascunhos de abordagem baseados somente em claims aprovados.",
  pledge: "Compromissos e follow-up: tarefas e lembretes internos auditáveis.",
};

export interface Catalog {
  meta: { produto: string; versao: string; data: string; total: number; mvp: number };
  personas: CharacterPersona[];
  entries: CatalogEntry[];
  agents: AgentDefinition[];
}

let cached: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (cached) return cached;
  const file = CatalogFile.parse(catalogJson);
  if (file.personagens.length !== 29) {
    throw new Error(`catálogo deve ter 29 personagens, encontrado ${file.personagens.length}`);
  }
  const personas: CharacterPersona[] = file.personagens.map((p) => ({
    id: p.id,
    name: p.nome,
    role: p.papel,
    layer: LAYER_MAP[p.camada],
    layerName: p.camada_nome,
    ...(p.arquetipo !== undefined ? { archetype: p.arquetipo } : {}),
    ...(p.animacao !== undefined ? { animation: p.animacao } : {}),
    colors: { primary: p.cor_primaria, secondary: p.cor_secundaria, accent: p.cor_destaque },
    mvp: p.mvp,
    ...(p.status_documental !== undefined ? { statusDocumental: p.status_documental } : {}),
    ...(p.status_texto !== undefined ? { statusTexto: p.status_texto } : {}),
    ...(p.limite_documentado !== undefined ? { limiteDocumentado: p.limite_documentado } : {}),
    ...(p.comando !== undefined ? { command: p.comando } : {}),
  }));

  const agents: AgentDefinition[] = file.personagens.map((p) => {
    const isMvp = (MVP_AGENT_IDS as readonly string[]).includes(p.id) && p.mvp;
    return {
      agentId: p.id,
      personaId: p.id,
      displayName: p.nome,
      layer: LAYER_MAP[p.camada],
      active: isMvp,
      autonomyCeiling: isMvp ? (p.id === "beacon" || p.id === "pledge" ? "L3" : "L2") : "L1",
      implementationStatus: isMvp ? "SIMULADO" : "PLANEJADO",
      ...(isMvp ? { station: STATIONS[p.id as MvpAgentId] } : {}),
      ...(isMvp ? { summary: SUMMARIES[p.id as MvpAgentId] } : {}),
    };
  });

  cached = {
    meta: {
      produto: file.produto,
      versao: file.versao,
      data: file.data,
      total: file.total,
      mvp: file.mvp,
    },
    personas,
    entries: file.personagens,
    agents,
  };
  return cached;
}

export function getPersona(id: string): CharacterPersona | undefined {
  return loadCatalog().personas.find((p) => p.id === id);
}

export function getAgentDefinition(agentId: string): AgentDefinition | undefined {
  return loadCatalog().agents.find((a) => a.agentId === agentId);
}

export function listAgents(): AgentDefinition[] {
  return loadCatalog().agents;
}

export function activeAgents(): AgentDefinition[] {
  return listAgents().filter((a) => a.active);
}

export function layerCounts(): Record<AgentLayer, number> {
  const counts: Record<AgentLayer, number> = { pillar: 0, commercial: 0, channel: 0, supervision: 0 };
  for (const p of loadCatalog().personas) counts[p.layer] += 1;
  return counts;
}

export { ImplementationStatus };
