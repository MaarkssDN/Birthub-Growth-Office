/**
 * Birthub Growth Office — Store de Perfis de ICP Comercial Dinâmico (Onda 12 / Fase 02).
 */

import { randomUUID } from "node:crypto";
import type {
  CommercialIcpProfile,
  CommercialIcpHistory,
  IcpInclusionRule,
  IcpExclusionRule,
  IcpWeights,
} from "@bgo/contracts";
import { DEFAULT_COMMERCIAL_ICP_PROFILE } from "./icp-engine";

export interface IcpStorePort {
  listProfiles(workspaceId: string, status?: string): Promise<CommercialIcpProfile[]>;
  getActiveProfile(workspaceId: string): Promise<CommercialIcpProfile | null>;
  getProfile(id: string): Promise<CommercialIcpProfile | null>;
  getProfileByVersion(workspaceId: string, name: string, version: number): Promise<CommercialIcpProfile | null>;
  createProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile>;
  updateProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile>;
  activateProfile(id: string, approvedBy: string): Promise<CommercialIcpProfile>;
  archiveProfile(id: string, actor: string): Promise<CommercialIcpProfile>;
  addHistory(entry: CommercialIcpHistory): Promise<void>;
  listHistory(profileId: string): Promise<CommercialIcpHistory[]>;
}

export class MemoryIcpStore implements IcpStorePort {
  private profiles: CommercialIcpProfile[] = [{ ...DEFAULT_COMMERCIAL_ICP_PROFILE }];
  private history: CommercialIcpHistory[] = [];

  async listProfiles(workspaceId: string, status?: string): Promise<CommercialIcpProfile[]> {
    return this.profiles.filter((p) => {
      if (p.workspaceId !== workspaceId && p.workspaceId !== "ws_default") return false;
      if (status && p.status !== status) return false;
      return true;
    });
  }

  async getActiveProfile(workspaceId: string): Promise<CommercialIcpProfile | null> {
    const list = await this.listProfiles(workspaceId, "approved");
    return list[0] ?? DEFAULT_COMMERCIAL_ICP_PROFILE;
  }

  async getProfile(id: string): Promise<CommercialIcpProfile | null> {
    return this.profiles.find((p) => p.id === id) ?? null;
  }

  async getProfileByVersion(workspaceId: string, name: string, version: number): Promise<CommercialIcpProfile | null> {
    return this.profiles.find(
      (p) => (p.workspaceId === workspaceId || p.workspaceId === "ws_default") && p.name === name && p.version === version,
    ) ?? null;
  }

  async createProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile> {
    const existing = await this.getProfileByVersion(profile.workspaceId, profile.name, profile.version);
    if (existing) {
      throw new Error(`Perfil '${profile.name}' versão ${profile.version} já existe no workspace.`);
    }
    this.profiles.unshift(profile);
    await this.addHistory({
      id: `hist_${randomUUID()}`,
      profileId: profile.id,
      action: "created",
      actor: profile.createdBy,
      reason: profile.changeReason,
      details: { version: profile.version, status: profile.status },
      occurredAt: new Date().toISOString(),
    });
    return profile;
  }

  async updateProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile> {
    const idx = this.profiles.findIndex((p) => p.id === profile.id);
    if (idx < 0) throw new Error(`Perfil ICP ${profile.id} não encontrado.`);
    this.profiles[idx] = profile;
    return profile;
  }

  async activateProfile(id: string, approvedBy: string): Promise<CommercialIcpProfile> {
    const profile = await this.getProfile(id);
    if (!profile) throw new Error(`Perfil ICP ${id} não encontrado.`);
    // Se ativado, outros perfis ativos do mesmo nome ou workspace podem ser arquivados
    profile.status = "approved";
    profile.approvedBy = approvedBy;
    profile.approvedAt = new Date().toISOString();
    profile.updatedAt = new Date().toISOString();

    await this.addHistory({
      id: `hist_${randomUUID()}`,
      profileId: profile.id,
      action: "approved",
      actor: approvedBy,
      reason: "Ativação de perfil ICP comercial autorizada por supervisor.",
      details: { version: profile.version },
      occurredAt: new Date().toISOString(),
    });
    return profile;
  }

  async archiveProfile(id: string, actor: string): Promise<CommercialIcpProfile> {
    const profile = await this.getProfile(id);
    if (!profile) throw new Error(`Perfil ICP ${id} não encontrado.`);
    profile.status = "archived";
    profile.updatedAt = new Date().toISOString();

    await this.addHistory({
      id: `hist_${randomUUID()}`,
      profileId: profile.id,
      action: "archived",
      actor,
      reason: "Perfil ICP arquivado.",
      details: { version: profile.version },
      occurredAt: new Date().toISOString(),
    });
    return profile;
  }

  async addHistory(entry: CommercialIcpHistory): Promise<void> {
    this.history.unshift(entry);
  }

  async listHistory(profileId: string): Promise<CommercialIcpHistory[]> {
    return this.history.filter((h) => h.profileId === profileId);
  }
}
