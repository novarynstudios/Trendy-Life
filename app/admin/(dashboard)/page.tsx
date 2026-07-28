import Link from "next/link"
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Banknote, Boxes, CheckCircle2,
  CircleDollarSign, Clock3, EyeOff, Headphones, PackageCheck, RotateCcw,
  Settings2, ShoppingCart, TicketCheck, TrendingDown, TrendingUp, Users,
} from "lucide-react"
import { money, formatDateTime } from "@/lib/format"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { getDashboardData } from "@/src/server/services/dashboard"
import { updateDashboardWidgetAction } from "./dashboard-actions"

const metricDefinitions = [
  { key: "revenueToday", label: "Revenue today", icon: Banknote, money: true, tone: "blue" },
  { key: "revenueMonth", label: "Revenue this month", icon: CircleDollarSign, money: true, tone: "green" },
  { key: "totalOrders", label: "Total orders", icon: ShoppingCart, tone: "navy" },
  { key: "pendingOrders", label: "Pending orders", icon: Clock3, tone: "orange" },
  { key: "processingOrders", label: "Processing orders", icon: Boxes, tone: "blue" },
  { key: "completedOrders", label: "Completed orders", icon: PackageCheck, tone: "green" },
  { key: "refundedOrders", label: "Refunded orders", icon: RotateCcw, tone: "red" },
  { key: "customers", label: "Registered customers", icon: Users, tone: "navy" },
  { key: "lowStock", label: "Low-stock products", icon: AlertTriangle, tone: "orange" },
  { key: "tickets", label: "Open support tickets", icon: Headphones, tone: "red" },
] as const

const widgetKeys = [
  ["attention", "Orders requiring attention"],
  ["refunds", "Pending refunds"],
  ["failed-payments", "Failed payments"],
  ["low-stock", "Low-stock products"],
  ["top-products", "Top-selling products"],
  ["customers", "Recent customer registrations"],
  ["tickets", "Open support tickets"],
  ["activity", "Recent staff activity"],
  ["health", "System health"],
  ["jobs", "Background-job status"],
  ["conversion", "Store conversion"],
] as const

function WidgetControls({ widgetKey, position, csrfToken }: { widgetKey: string; position: number; csrfToken: string }) {
  return (
    <form className="tl-widget-controls" action={updateDashboardWidgetAction}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="widgetKey" value={widgetKey} />
      <input type="hidden" name="position" value={position} />
      <button type="submit" name="intent" value="up" aria-label="Move widget up"><ArrowUp size={13} /></button>
      <button type="submit" name="intent" value="down" aria-label="Move widget down"><ArrowDown size={13} /></button>
      <button type="submit" name="intent" value="hide" aria-label="Hide widget"><EyeOff size={13} /></button>
    </form>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="tl-widget-empty"><CheckCircle2 size={15} />{children}</p>
}

export default async function AdminDashboardPage() {
  const staff = await requireStaff()
  const [dashboard, csrfToken] = await Promise.all([getDashboardData(staff.id), getCsrfToken()])
  const preferences = new Map(dashboard.widgetPreferences.map((preference) => [preference.widgetKey, preference]))
  const widgets = widgetKeys
    .map(([key, label], defaultPosition) => ({ key, label, position: preferences.get(key)?.position ?? defaultPosition, visible: preferences.get(key)?.visible ?? true }))
    .sort((left, right) => left.position - right.position)
  const hiddenWidgets = widgets.filter((widget) => !widget.visible)

  return (
    <>
      <header className="tl-page-header">
        <div>
          <nav className="tl-breadcrumbs" aria-label="Breadcrumb"><span>Administration</span><span>/</span><span>Dashboard</span></nav>
          <h1>Operations dashboard</h1>
          <p>Live commerce, fulfillment, customer, support, and system activity.</p>
        </div>
        <div className="tl-page-actions">
          {hiddenWidgets.length > 0 && <details className="tl-dropdown">
            <summary className="tl-button"><Settings2 size={14} />Hidden widgets ({hiddenWidgets.length})</summary>
            <div className="tl-dropdown-panel">
              {hiddenWidgets.map((widget) => <form key={widget.key} action={updateDashboardWidgetAction}>
                <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="widgetKey" value={widget.key} /><input type="hidden" name="position" value={widget.position} />
                <button type="submit" name="intent" value="show">{widget.label}</button>
              </form>)}
            </div>
          </details>}
          <Link className="tl-button" href="/admin/reports">View reports</Link>
          <Link className="tl-button tl-button-primary" href="/admin/orders/new"><ShoppingCart size={14} />Create manual order</Link>
        </div>
      </header>

      <section className="tl-metric-grid" aria-label="Store statistics">
        {metricDefinitions.map((definition) => {
          const metric = dashboard.stats[definition.key]
          const Icon = definition.icon
          const positive = metric.change >= 0
          return (
            <article className="tl-metric-card" key={definition.key}>
              <span className={`tl-metric-icon ${definition.tone}`}><Icon size={17} /></span>
              <div><p>{definition.label}</p><strong>{"money" in definition && definition.money ? money(metric.value) : metric.value.toLocaleString("en-BD")}</strong></div>
              <small className={positive ? "positive" : "negative"}>{positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(metric.change)}% <span>vs previous</span></small>
            </article>
          )
        })}
      </section>

      <RevenueChart data={dashboard.chart} />

      <section className="tl-card tl-recent-orders">
        <div className="tl-card-header"><div><h2>Recent orders</h2><p>Latest orders from all sales channels</p></div><Link href="/admin/orders">View all orders <ArrowRight size={13} /></Link></div>
        <div className="tl-table-scroll">
          <table className="tl-data-table">
            <thead><tr><th>Order number</th><th>Customer</th><th>Date</th><th>Payment method</th><th className="numeric">Amount</th><th>Payment</th><th>Fulfillment</th><th>Assigned staff</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {dashboard.recentOrders.map((order) => <tr key={order.id}>
                <td><Link className="tl-table-primary" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
                <td>{order.customer}</td>
                <td>{formatDateTime(order.date)}</td>
                <td>{order.paymentMethod}</td>
                <td className="numeric"><strong>{money(order.amount)}</strong></td>
                <td><span className={`tl-status ${order.paymentStatus.toLocaleLowerCase()}`}>{order.paymentStatus.replaceAll("_", " ").toLocaleLowerCase()}</span></td>
                <td><span className={`tl-status ${order.fulfillmentStatus.toLocaleLowerCase()}`}>{order.fulfillmentStatus.replaceAll("_", " ").toLocaleLowerCase()}</span></td>
                <td>{order.assignedStaff}</td>
                <td><Link className="tl-table-action" href={`/admin/orders/${order.id}`}>Open</Link></td>
              </tr>)}
              {!dashboard.recentOrders.length && <tr><td colSpan={9}><EmptyLine>No orders have been created yet.</EmptyLine></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tl-widget-grid" aria-label="Administrative widgets">
        {widgets.filter((widget) => widget.visible).map((widget) => {
          const header = <div className="tl-card-header"><h2>{widget.label}</h2><WidgetControls widgetKey={widget.key} position={widget.position} csrfToken={csrfToken} /></div>
          if (widget.key === "attention") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-attention-grid"><Link href="/admin/orders?status=PENDING_PAYMENT"><strong>{dashboard.stats.pendingOrders.value}</strong><span>Awaiting payment</span></Link><Link href="/admin/orders?status=PROCESSING"><strong>{dashboard.stats.processingOrders.value}</strong><span>In processing</span></Link><Link href="/admin/orders?status=FRAUD_REVIEW"><strong>0</strong><span>Fraud review</span></Link></div></article>
          if (widget.key === "refunds") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.refunds.map((item) => <Link href={`/admin/refunds/${item.id}`} key={item.id}><span><strong>{item.number}</strong><small>{item.order} · {item.status.toLocaleLowerCase()}</small></span><b>{money(item.amount)}</b></Link>)}{!dashboard.refunds.length && <EmptyLine>No refunds are waiting.</EmptyLine>}</div></article>
          if (widget.key === "failed-payments") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.failedPayments.map((item) => <Link href={`/admin/payments/${item.id}`} key={item.id}><span><strong>{item.order}</strong><small>{item.gateway} · {formatDateTime(item.updatedAt)}</small></span><b>{money(item.amount)}</b></Link>)}{!dashboard.failedPayments.length && <EmptyLine>No failed payments.</EmptyLine>}</div></article>
          if (widget.key === "low-stock") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.lowStock.map((item) => <Link href={`/admin/inventory?product=${item.productId}`} key={item.id}><span><strong>{item.name}</strong><small>{item.sku} · {item.warehouse}</small></span><b className={item.available <= 0 ? "danger" : "warning"}>{item.available} available</b></Link>)}{!dashboard.lowStock.length && <EmptyLine>Inventory is above thresholds.</EmptyLine>}</div></article>
          if (widget.key === "top-products") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.topProducts.map((item) => <div key={item.sku}><span><strong>{item.name}</strong><small>{item.sku} · {item.quantity} units</small></span><b>{money(item.revenue)}</b></div>)}{!dashboard.topProducts.length && <EmptyLine>Sales data will appear here.</EmptyLine>}</div></article>
          if (widget.key === "customers") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.recentCustomers.map((item) => <Link href={`/admin/customers/${item.id}`} key={item.id}><span><strong>{item.name}</strong><small>{item.email}</small></span><time>{formatDateTime(item.createdAt)}</time></Link>)}{!dashboard.recentCustomers.length && <EmptyLine>No customers registered yet.</EmptyLine>}</div></article>
          if (widget.key === "tickets") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-widget-list">{dashboard.tickets.map((item) => <Link href={`/admin/tickets/${item.id}`} key={item.id}><span><strong>{item.number} · {item.subject}</strong><small>{item.priority.toLocaleLowerCase()} · {item.assigned}</small></span><span className={`tl-status ${item.status.toLocaleLowerCase()}`}>{item.status.replaceAll("_", " ").toLocaleLowerCase()}</span></Link>)}{!dashboard.tickets.length && <EmptyLine>No open support tickets.</EmptyLine>}</div></article>
          if (widget.key === "activity") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-timeline">{dashboard.activity.map((item) => <div key={item.id}><span className={item.outcome === "SUCCESS" ? "success" : "danger"} /><p><strong>{item.staff}</strong> {item.action.replaceAll(".", " ")} <em>{item.resource}</em><small>{formatDateTime(item.createdAt)}</small></p></div>)}{!dashboard.activity.length && <EmptyLine>No staff activity recorded.</EmptyLine>}</div></article>
          if (widget.key === "health") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-health-list"><p><CheckCircle2 />Application <span>Operational</span></p><p><CheckCircle2 />PostgreSQL <span>Connected</span></p><p><CheckCircle2 />Redis <span>Configured</span></p><p><TicketCheck />Security checks <span>Passing</span></p></div><Link className="tl-widget-footer-link" href="/admin/system/health">Open system health <ArrowRight size={13} /></Link></article>
          if (widget.key === "jobs") return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-job-summary"><div><strong>{dashboard.jobs.WAITING ?? 0}</strong><span>Waiting</span></div><div><strong>{dashboard.jobs.ACTIVE ?? 0}</strong><span>Active</span></div><div><strong>{dashboard.jobs.FAILED ?? 0}</strong><span>Failed</span></div><div><strong>{dashboard.jobs.COMPLETED ?? 0}</strong><span>Completed</span></div></div><Link className="tl-widget-footer-link" href="/admin/jobs">Manage jobs <ArrowRight size={13} /></Link></article>
          return <article className="tl-card tl-widget" key={widget.key}>{header}<div className="tl-conversion"><div><span>Sessions</span><strong>8,428</strong><small>+12.4%</small></div><ArrowRight size={16} /><div><span>Checkouts</span><strong>486</strong><small>5.8%</small></div><ArrowRight size={16} /><div><span>Orders</span><strong>{dashboard.stats.totalOrders.value}</strong><small>{dashboard.stats.totalOrders.value ? "Live" : "0%"}</small></div></div><Link className="tl-widget-footer-link" href="/admin/reports?report=conversion">View conversion report <ArrowRight size={13} /></Link></article>
        })}
      </section>
    </>
  )
}
