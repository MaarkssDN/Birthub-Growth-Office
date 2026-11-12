import { z } from "zod";
import { AgentLayer, AutonomyLevel, ImplementationStatus } from "./enums";

export const CharacterPersona = z.object({
  id: z.string(), // id canônico minúsculo (aegis, orbit, ...)
  name: z.string(),
  role: z.string(), // papel curto do catálogo
  layer: AgentLayer,
  layerName: z.string(),
  archetype: z.string().optional(),
  animation: z.string().optional(),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  mvp: z.boolean(),
  statusDocumental: z.string().optional(),
  statusTexto: z.string().optional(),
  limiteDocumentado: z.string().optional(),
  command: z.string().optional(),
});
export type CharacterPersona = z.infer<typeof CharacterPersona>;

export const AgentDefinition = z.object({
  agentId: z.string(),
  personaId: z.string().optional(),
  displayName: z.string(),
  layer: AgentLayer,
  active: z.boolean(),
  autonomyCeiling: AutonomyLevel,
  implementationStatus: ImplementationStatus,
  station: z.string().optional(), // estação do escritório futuro
  summary: z.string().optional(),
});
export type AgentDefinition = z.infer<typeof AgentDefinition>;

export const PolicyDecision = z.object({
  allowed: z.boolean(),
  level: AutonomyLevel,
  reason: z.string(),
  requiresApproval: z.boolean(),
});
export type PolicyDecision = z.infer<typeof PolicyDecision>;

export const PolicyRequest = z.object({
  agentId: z.string(),
  tool: z.string(),
  action: z.string(),
  context: z.object({
    hasApproval: z.boolean().default(false),
    channelAllowed: z.boolean().default(false),
    optInVerified: z.boolean().default(false),
    claimApproved: z.boolean().default(true),
    selfApproval: z.boolean().default(false),
    crossTenant: z.boolean().default(false),
  }),
});
export type PolicyRequest = z.infer<typeof PolicyRequest>;
