import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function InventoryMovementsPage() {
  await requireStaff("inventory.view")
  const movements = await prisma.inventoryMovement.findMany({ take: 250, orderBy: { createdAt: "desc" }, include: { inventoryItem: { include: { product: true, variant: true } }, warehouse: true, staff: { select: { name: true } } } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/inventory">Inventory</Link><span>/</span><span>Movements</span></nav><h1>Stock movement log</h1><p>Append-only inventory audit across all warehouses.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Date</th><th>Product</th><th>Warehouse</th><th>Type</th><th className="numeric">Quantity</th><th className="numeric">Balance</th><th>Reason</th><th>Staff</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.createdAt.toISOString())}</td><td><Link className="tl-table-primary" href={`/admin/inventory/${movement.inventoryItemId}`}>{movement.inventoryItem.product.name}{movement.inventoryItem.variant ? ` — ${movement.inventoryItem.variant.name}` : ""}</Link></td><td>{movement.warehouse.name}</td><td>{movement.type}</td><td className="numeric">{movement.quantity}</td><td className="numeric">{movement.balanceAfter}</td><td>{movement.reason}</td><td>{movement.staff?.name ?? "System"}</td></tr>)}</tbody></table></div></section></>
}
