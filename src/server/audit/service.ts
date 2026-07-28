import "server-only"

import type { AuditOutcome, Prisma } from "@prisma/client"
import { prisma } from "@/src/server/db/prisma"
import { requestMetadata } from "@/src/server/security/request"

type AuditInput = {
  staffId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  previousValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
  outcome?: AuditOutcome
  failureReason?: string
  metadata?: Prisma.InputJsonValue
}

export async function writeAuditLog(input: AuditInput) {
  const request = await requestMetadata()
  return prisma.auditLog.create({
    data: {
      staffId: input.staffId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      previousValues: input.previousValues,
      newValues: input.newValues,
      outcome: input.outcome ?? "SUCCESS",
      failureReason: input.failureReason,
      metadata: input.metadata,
      requestId: request.requestId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    },
  })
}
