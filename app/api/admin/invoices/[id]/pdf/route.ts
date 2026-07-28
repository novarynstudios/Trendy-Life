import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { NextResponse } from "next/server"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff("orders.view")
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { order: true, items: true } })
  if (!invoice) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Invoice not found" } }, { status: 404 })
  const document = await PDFDocument.create()
  const page = document.addPage([595.28, 841.89])
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const navy = rgb(0.04, 0.1, 0.18)
  const blue = rgb(0.08, 0.35, 0.66)
  const gray = rgb(0.38, 0.43, 0.49)
  page.drawRectangle({ x: 0, y: 777, width: 595.28, height: 64.89, color: navy })
  page.drawText("TRENDY LIFE", { x: 38, y: 808, font: bold, size: 17, color: rgb(1, 1, 1) })
  page.drawText("Operated by Trendy Group", { x: 38, y: 791, font: regular, size: 8, color: rgb(.7, .77, .84) })
  page.drawText("INVOICE", { x: 466, y: 806, font: bold, size: 16, color: rgb(1, 1, 1) })
  page.drawText(invoice.invoiceNumber, { x: 438, y: 790, font: regular, size: 8, color: rgb(.7, .77, .84) })
  const address = invoice.billingAddress as Record<string, string | null>
  page.drawText("BILL TO", { x: 38, y: 742, font: bold, size: 8, color: blue })
  page.drawText(`${address.firstName ?? ""} ${address.lastName ?? ""}`.trim(), { x: 38, y: 724, font: bold, size: 10, color: navy })
  const addressLines = [address.company, address.line1, address.line2, [address.city, address.district, address.postalCode].filter(Boolean).join(", "), address.countryCode].filter(Boolean) as string[]
  addressLines.forEach((line, index) => page.drawText(line.slice(0, 72), { x: 38, y: 708 - index * 13, font: regular, size: 8, color: gray }))
  page.drawText(`Invoice date: ${invoice.issueDate.toLocaleDateString("en-BD")}`, { x: 385, y: 724, font: regular, size: 8, color: gray })
  page.drawText(`Order: ${invoice.order.orderNumber}`, { x: 385, y: 710, font: regular, size: 8, color: gray })
  page.drawText(`Status: ${invoice.status.replaceAll("_", " ")}`, { x: 385, y: 696, font: regular, size: 8, color: gray })
  let y = 632
  page.drawRectangle({ x: 38, y, width: 519, height: 25, color: rgb(.94, .96, .98) })
  page.drawText("Description", { x: 46, y: y + 9, font: bold, size: 7, color: navy })
  page.drawText("Qty", { x: 365, y: y + 9, font: bold, size: 7, color: navy })
  page.drawText("Unit price", { x: 410, y: y + 9, font: bold, size: 7, color: navy })
  page.drawText("Total", { x: 510, y: y + 9, font: bold, size: 7, color: navy })
  y -= 22
  for (const item of invoice.items.slice(0, 24)) {
    page.drawText(item.description.slice(0, 52), { x: 46, y, font: regular, size: 8, color: navy })
    page.drawText(String(item.quantity), { x: 369, y, font: regular, size: 8, color: gray })
    page.drawText(`BDT ${Number(item.unitPrice).toLocaleString("en")}`, { x: 410, y, font: regular, size: 8, color: gray })
    page.drawText(`BDT ${Number(item.total).toLocaleString("en")}`, { x: 490, y, font: bold, size: 8, color: navy })
    page.drawLine({ start: { x: 38, y: y - 8 }, end: { x: 557, y: y - 8 }, thickness: .5, color: rgb(.86, .89, .92) })
    y -= 25
  }
  const totalsY = Math.max(96, y - 20)
  const totals = [
    ["Subtotal", Number(invoice.subtotal)], ["Discount", -Number(invoice.discountTotal)], ["Tax", Number(invoice.taxTotal)],
    ["Shipping", Number(invoice.shippingTotal)], ["Total", Number(invoice.total)], ["Paid", Number(invoice.paidAmount)], ["Amount due", Number(invoice.dueAmount)],
  ] as const
  totals.forEach(([label, value], index) => {
    const lineY = totalsY - index * 17
    page.drawText(label, { x: 395, y: lineY, font: index === 4 || index === 6 ? bold : regular, size: index === 4 || index === 6 ? 9 : 8, color: index === 6 ? blue : navy })
    page.drawText(`BDT ${value.toLocaleString("en")}`, { x: 478, y: lineY, font: index === 4 || index === 6 ? bold : regular, size: index === 4 || index === 6 ? 9 : 8, color: index === 6 ? blue : navy })
  })
  page.drawText("Thank you for choosing Trendy Life.", { x: 38, y: 55, font: bold, size: 8, color: navy })
  page.drawText("This document was generated securely by Trendy Life Admin.", { x: 38, y: 41, font: regular, size: 7, color: gray })
  const bytes = await document.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
