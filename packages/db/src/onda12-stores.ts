/**
 * Birthub Growth Office — Adaptadores Prisma para Onda 12 (ICP, Sandbox, Catálogo).
 */

import { type PrismaClient, Prisma } from "@prisma/client";
import type {
  CommercialIcpProfile,
  CommercialIcpHistory,
  CommunicationDispatch,
  CommercialOfferItem,
  Channel,
  CommunicationDispatchStatus,
  OfferCategory,
  OfferItemStatus,
  IcpInclusionRule,
  IcpExclusionRule,
  IcpWeights,
} from "@bgo/contracts";
import type { IcpStorePort } from "@bgo/commercial";
import type { CommunicationSandboxStorePort } from "@bgo/commercial";
import type { OfferCatalogStorePort } from "@bgo/commercial";
import { DEFAULT_COMMERCIAL_ICP_PROFILE } from "@bgo/commercial";
import { prisma as defaultPrisma } from "./client";

const iso = (d: Date): string => d.toISOString();
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export class PrismaIcpStore implements IcpStorePort {
  constructor(private readonly prisma: PrismaClient = defaultPrisma()) {}

  async listProfiles(workspaceId: string, status?: string): Promise<CommercialIcpProfile[]> {
    const rows = await this.prisma.commercialIcpProfile.findMany({
      where: {
        workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toIcpProfile);
  }

  async getActiveProfile(workspaceId: string): Promise<CommercialIcpProfile | null> {
    const row = await this.prisma.commercialIcpProfile.findFirst({
      where: { workspaceId, status: "approved" },
      orderBy: { version: "desc" },
    });
    return row ? toIcpProfile(row) : null;
  }

  async getProfile(id: string): Promise<CommercialIcpProfile | null> {
    const row = await this.prisma.commercialIcpProfile.findUnique({
      where: { id },
    });
    return row ? toIcpProfile(row) : null;
  }

  async getProfileByVersion(workspaceId: string, name: string, version: number): Promise<CommercialIcpProfile | null> {
    const row = await this.prisma.commercialIcpProfile.findUnique({
      where: {
        workspaceId_name_version: { workspaceId, name, version },
      },
    });
    return row ? toIcpProfile(row) : null;
  }

  async createProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile> {
    const created = await this.prisma.commercialIcpProfile.create({
      data: {
        id: profile.id,
        workspaceId: profile.workspaceId,
        name: profile.name,
        version: profile.version,
        status: profile.status,
        description: profile.description ?? null,
        targetSegments: asJson(profile.targetSegments),
        targetCnaes: asJson(profile.targetCnaes),
        targetSizes: asJson(profile.targetSizes),
        targetUfs: asJson(profile.targetUfs),
        inclusions: asJson(profile.inclusions),
        exclusions: asJson(profile.exclusions),
        weights: asJson(profile.weights),
        changeReason: profile.changeReason ?? null,
        approvedBy: profile.approvedBy ?? null,
        approvedAt: profile.approvedAt ? new Date(profile.approvedAt) : null,
        createdBy: profile.createdBy,
      },
    });
    await this.addHistory({
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      profileId: created.id,
      action: "created",
      actor: profile.createdBy,
      reason: profile.changeReason,
      details: { version: profile.version, status: profile.status },
      occurredAt: new Date().toISOString(),
    });
    return toIcpProfile(created);
  }

  async updateProfile(profile: CommercialIcpProfile): Promise<CommercialIcpProfile> {
    const updated = await this.prisma.commercialIcpProfile.update({
      where: { id: profile.id },
      data: {
        description: profile.description ?? null,
        targetSegments: asJson(profile.targetSegments),
        targetCnaes: asJson(profile.targetCnaes),
        targetSizes: asJson(profile.targetSizes),
        targetUfs: asJson(profile.targetUfs),
        inclusions: asJson(profile.inclusions),
        exclusions: asJson(profile.exclusions),
        weights: asJson(profile.weights),
        changeReason: profile.changeReason ?? null,
      },
    });
    return toIcpProfile(updated);
  }

  async activateProfile(id: string, approvedBy: string): Promise<CommercialIcpProfile> {
    const updated = await this.prisma.commercialIcpProfile.update({
      where: { id },
      data: {
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
      },
    });
    await this.addHistory({
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      profileId: id,
      action: "approved",
      actor: approvedBy,
      reason: "Ativação de perfil ICP comercial autorizada por supervisor.",
      details: { version: updated.version },
      occurredAt: new Date().toISOString(),
    });
    return toIcpProfile(updated);
  }

  async archiveProfile(id: string, actor: string): Promise<CommercialIcpProfile> {
    const updated = await this.prisma.commercialIcpProfile.update({
      where: { id },
      data: {
        status: "archived",
      },
    });
    await this.addHistory({
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      profileId: id,
      action: "archived",
      actor,
      reason: "Perfil ICP arquivado.",
      details: { version: updated.version },
      occurredAt: new Date().toISOString(),
    });
    return toIcpProfile(updated);
  }

  async addHistory(entry: CommercialIcpHistory): Promise<void> {
    await this.prisma.commercialIcpHistory.create({
      data: {
        id: entry.id,
        profileId: entry.profileId,
        action: entry.action,
        actor: entry.actor,
        reason: entry.reason ?? null,
        details: entry.details ? asJson(entry.details) : Prisma.JsonNull,
        occurredAt: new Date(entry.occurredAt),
      },
    });
  }

  async listHistory(profileId: string): Promise<CommercialIcpHistory[]> {
    const rows = await this.prisma.commercialIcpHistory.findMany({
      where: { profileId },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      action: r.action,
      actor: r.actor,
      ...(r.reason ? { reason: r.reason } : {}),
      ...(r.details ? { details: r.details as Record<string, unknown> } : {}),
      occurredAt: iso(r.occurredAt),
    }));
  }
}

function toIcpProfile(row: {
  id: string;
  workspaceId: string;
  name: string;
  version: number;
  status: string;
  description: string | null;
  targetSegments: unknown;
  targetCnaes: unknown;
  targetSizes: unknown;
  targetUfs: unknown;
  inclusions: unknown;
  exclusions: unknown;
  weights: unknown;
  changeReason: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): CommercialIcpProfile {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    version: row.version,
    status: row.status as CommercialIcpProfile["status"],
    ...(row.description ? { description: row.description } : {}),
    targetSegments: (row.targetSegments as string[]) ?? [],
    targetCnaes: (row.targetCnaes as string[]) ?? [],
    targetSizes: (row.targetSizes as string[]) ?? [],
    targetUfs: (row.targetUfs as string[]) ?? [],
    inclusions: (row.inclusions as IcpInclusionRule[]) ?? [],
    exclusions: (row.exclusions as IcpExclusionRule[]) ?? [],
    weights: (row.weights as IcpWeights) ?? { cnae: 30, size: 25, location: 20, operation: 25 },
    ...(row.changeReason ? { changeReason: row.changeReason } : {}),
    ...(row.approvedBy ? { approvedBy: row.approvedBy } : {}),
    ...(row.approvedAt ? { approvedAt: iso(row.approvedAt) } : {}),
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export class PrismaCommunicationSandboxStore implements CommunicationSandboxStorePort {
  constructor(private readonly prisma: PrismaClient = defaultPrisma()) {}

  async saveDispatch(dispatch: CommunicationDispatch): Promise<void> {
    await this.prisma.communicationDispatch.create({
      data: {
        id: dispatch.id,
        workspaceId: dispatch.workspaceId,
        draftId: dispatch.draftId ?? null,
        opportunityId: dispatch.opportunityId ?? null,
        channel: dispatch.channel,
        recipient: dispatch.recipient,
        subject: dispatch.subject ?? null,
        content: dispatch.content,
        status: dispatch.status,
        simulated: dispatch.simulated,
        errorReason: dispatch.errorReason ?? null,
        dispatchedBy: dispatch.dispatchedBy,
        correlationId: dispatch.correlationId,
        createdAt: new Date(dispatch.createdAt),
      },
    });
  }

  async getDispatchByCorrelation(workspaceId: string, correlationId: string): Promise<CommunicationDispatch | null> {
    const row = await this.prisma.communicationDispatch.findFirst({
      where: { workspaceId, correlationId },
    });
    return row ? toDispatch(row) : null;
  }

  async listDispatches(workspaceId: string, filters?: { channel?: Channel; status?: CommunicationDispatchStatus }): Promise<CommunicationDispatch[]> {
    const rows = await this.prisma.communicationDispatch.findMany({
      where: {
        workspaceId,
        ...(filters?.channel ? { channel: filters.channel } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDispatch);
  }

  async isRecipientSuppressed(workspaceId: string, recipient: string): Promise<boolean> {
    const norm = recipient.trim().toLowerCase();
    if (norm === "optout@empresa.com.br" || norm === "bloqueado@teste.com") return true;
    const suppressed = await this.prisma.lead.findFirst({
      where: {
        workspaceId,
        email: norm,
        suppressedAt: { not: null },
      },
    });
    return Boolean(suppressed);
  }
}

function toDispatch(row: {
  id: string;
  workspaceId: string;
  draftId: string | null;
  opportunityId: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  simulated: boolean;
  errorReason: string | null;
  dispatchedBy: string;
  correlationId: string;
  createdAt: Date;
}): CommunicationDispatch {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ...(row.draftId ? { draftId: row.draftId } : {}),
    ...(row.opportunityId ? { opportunityId: row.opportunityId } : {}),
    channel: row.channel as Channel,
    recipient: row.recipient,
    ...(row.subject ? { subject: row.subject } : {}),
    content: row.content,
    status: row.status as CommunicationDispatchStatus,
    simulated: row.simulated,
    ...(row.errorReason ? { errorReason: row.errorReason } : {}),
    dispatchedBy: row.dispatchedBy,
    correlationId: row.correlationId,
    createdAt: iso(row.createdAt),
  };
}

export class PrismaOfferCatalogStore implements OfferCatalogStorePort {
  constructor(private readonly prisma: PrismaClient = defaultPrisma()) {}

  async listItems(workspaceId: string, filters?: { category?: OfferCategory; status?: OfferItemStatus }): Promise<CommercialOfferItem[]> {
    const rows = await this.prisma.commercialOfferItem.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: "ws_default" }],
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toOfferItem);
  }

  async getItem(id: string): Promise<CommercialOfferItem | null> {
    const row = await this.prisma.commercialOfferItem.findUnique({
      where: { id },
    });
    return row ? toOfferItem(row) : null;
  }

  async saveItem(item: CommercialOfferItem): Promise<void> {
    await this.prisma.commercialOfferItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        workspaceId: item.workspaceId,
        category: item.category,
        title: item.title,
        content: item.content,
        evidenceUrl: item.evidenceUrl ?? null,
        status: item.status,
        version: item.version,
        approvedBy: item.approvedBy ?? null,
        approvedAt: item.approvedAt ? new Date(item.approvedAt) : null,
        createdBy: item.createdBy,
      },
      update: {
        category: item.category,
        title: item.title,
        content: item.content,
        evidenceUrl: item.evidenceUrl ?? null,
        status: item.status,
        version: item.version,
        approvedBy: item.approvedBy ?? null,
        approvedAt: item.approvedAt ? new Date(item.approvedAt) : null,
      },
    });
  }

  async approveItem(id: string, approvedBy: string): Promise<CommercialOfferItem | null> {
    const updated = await this.prisma.commercialOfferItem.update({
      where: { id },
      data: {
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
      },
    });
    return toOfferItem(updated);
  }

  async rejectItem(id: string, rejectedBy: string, reason: string): Promise<CommercialOfferItem | null> {
    const updated = await this.prisma.commercialOfferItem.update({
      where: { id },
      data: {
        status: "rejected",
      },
    });
    return toOfferItem(updated);
  }
}

function toOfferItem(row: {
  id: string;
  workspaceId: string;
  category: string;
  title: string;
  content: string;
  evidenceUrl: string | null;
  status: string;
  version: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): CommercialOfferItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    category: row.category as OfferCategory,
    title: row.title,
    content: row.content,
    ...(row.evidenceUrl ? { evidenceUrl: row.evidenceUrl } : {}),
    status: row.status as OfferItemStatus,
    version: row.version,
    ...(row.approvedBy ? { approvedBy: row.approvedBy } : {}),
    ...(row.approvedAt ? { approvedAt: iso(row.approvedAt) } : {}),
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
