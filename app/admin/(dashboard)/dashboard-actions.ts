"use server"

import { revalidatePath } from "next/cache"
import { assertCsrf } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import { writeAuditLog } from "@/src/server/audit/service"

export async function updateDashboardWidgetAction(formData: FormData) {
  const principal = await assertCsrf(formData)
  const widgetKey = String(formData.get("widgetKey") ?? "").slice(0, 80)
  const intent = String(formData.get("intent") ?? "")
  if (!widgetKey) throw new Error("Widget key is required")
  const current = await prisma.dashboardWidgetPreference.findUnique({ where: { staffId_widgetKey: { staffId: principal.id, widgetKey } } })
  const position = current?.position ?? Number(formData.get("position") ?? 0)
  if (intent === "hide") {
    await prisma.dashboardWidgetPreference.upsert({
      where: { staffId_widgetKey: { staffId: principal.id, widgetKey } },
      create: { staffId: principal.id, widgetKey, position, visible: false },
      update: { visible: false },
    })
  } else if (intent === "show") {
    await prisma.dashboardWidgetPreference.upsert({
      where: { staffId_widgetKey: { staffId: principal.id, widgetKey } },
      create: { staffId: principal.id, widgetKey, position, visible: true },
      update: { visible: true },
    })
  } else if (intent === "up" || intent === "down") {
    const targetPosition = Math.max(0, position + (intent === "up" ? -1 : 1))
    const target = await prisma.dashboardWidgetPreference.findFirst({ where: { staffId: principal.id, position: targetPosition } })
    await prisma.$transaction(async (transaction) => {
      if (target) await transaction.dashboardWidgetPreference.update({ where: { id: target.id }, data: { position } })
      await transaction.dashboardWidgetPreference.upsert({
        where: { staffId_widgetKey: { staffId: principal.id, widgetKey } },
        create: { staffId: principal.id, widgetKey, position: targetPosition, visible: true },
        update: { position: targetPosition },
      })
    })
  }
  await writeAuditLog({ staffId: principal.id, action: "dashboard.widget.update", resourceType: "DashboardWidget", resourceId: widgetKey, newValues: { intent } })
  revalidatePath("/admin")
}
