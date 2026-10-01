import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

export type AuditEventInput = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
};

export const writeAuditEvent = async (
  event: AuditEventInput,
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        ...(event.metadata !== undefined && { metadata: event.metadata }),
        ipAddress: event.request?.ip?.slice(0, 100) ?? null,
        userAgent: event.request?.get("user-agent")?.slice(0, 2000) ?? null,
      },
    });
  } catch (error) {
    console.error(
      "Audit event could not be persisted:",
      error instanceof Error ? error.message : "Unknown database error",
    );
  }
};
