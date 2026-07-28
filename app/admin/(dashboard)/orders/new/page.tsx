import Link from "next/link"
import { ArrowLeft, ShoppingCart } from "lucide-react"
import { createManualOrderAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function NewOrderPage() {
  await requireStaff("orders.create")
  const [csrfToken, customers, products, staff] = await Promise.all([
    getCsrfToken(),
    prisma.user.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: { profile: true },
      orderBy: { email: "asc" },
      take: 500,
    }),
    prisma.product.findMany({
      where: { deletedAt: null, status: { not: "ARCHIVED" } },
      include: { variants: { where: { enabled: true }, orderBy: { position: "asc" } } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ])
  const catalog = products.flatMap((product) => {
    if (product.variants.length) {
      return product.variants.map((variant) => ({
        value: `${product.id}:${variant.id}`,
        label: `${product.name} — ${variant.name} (${variant.sku}) · BDT ${Number(variant.salePrice ?? variant.regularPrice).toLocaleString("en-BD")}`,
      }))
    }
    return [{
      value: product.id,
      label: `${product.name} (${product.sku ?? "No SKU"}) · BDT ${Number(product.salePrice ?? product.regularPrice).toLocaleString("en-BD")}`,
    }]
  })

  return (
    <>
      <header className="tl-page-header">
        <div>
          <nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/orders">Orders</Link><span>/</span><span>New</span></nav>
          <Link className="tl-back-link" href="/admin/orders"><ArrowLeft size={13} />Back to orders</Link>
          <h1>Create manual order</h1>
          <p>Create a draft or reserve stock immediately for a pending-payment order.</p>
        </div>
      </header>
      <form className="tl-editor-main" action={createManualOrderAction}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <section className="tl-card tl-form-section">
          <div className="tl-card-header"><div><h2>Customer & ownership</h2><p>Manual orders must be attached to an active customer.</p></div></div>
          <div className="tl-card-body tl-form-grid">
            <label className="span-2">Customer *<select name="userId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.profile ? `${customer.profile.firstName} ${customer.profile.lastName}` : customer.email} · {customer.email}</option>)}</select></label>
            <label>Assigned staff<select name="assignedStaffId"><option value="">Assign to me</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Initial status<select name="status" defaultValue="PENDING_PAYMENT"><option value="PENDING_PAYMENT">Pending payment (reserve stock)</option><option value="DRAFT">Draft (do not reserve)</option></select></label>
          </div>
        </section>
        <section className="tl-card tl-form-section">
          <div className="tl-card-header"><div><h2>Products</h2><p>Up to five unique catalog items can be added here; edit the order afterward for further changes.</p></div></div>
          <div className="tl-card-body">
            {[0, 1, 2, 3, 4].map((index) => <div className="tl-inline-fields" key={index}>
              <label>Product or variation<select name="catalogItem" required={index === 0}><option value="">{index ? "Optional additional item" : "Select product"}</option>{catalog.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label>Quantity<input name="quantity" type="number" min="1" max="1000" defaultValue="1" required /></label>
            </div>)}
          </div>
        </section>
        <section className="tl-card tl-form-section">
          <div className="tl-card-header"><h2>Shipping address</h2></div>
          <div className="tl-card-body tl-form-grid">
            <label>First name *<input name="firstName" required /></label><label>Last name *<input name="lastName" required /></label>
            <label>Email *<input name="email" type="email" required /></label><label>Phone *<input name="phone" required /></label>
            <label className="span-2">Address line 1 *<input name="line1" required /></label><label className="span-2">Address line 2<input name="line2" /></label>
            <label>City *<input name="city" required /></label><label>District<input name="district" /></label><label>Postal code<input name="postalCode" /></label>
          </div>
        </section>
        <section className="tl-card tl-form-section">
          <div className="tl-card-header"><h2>Totals & notes</h2></div>
          <div className="tl-card-body tl-form-grid">
            <label>Order discount<input name="discountTotal" type="number" min="0" step="0.01" defaultValue="0.00" required /></label>
            <label>Shipping charge<input name="shippingTotal" type="number" min="0" step="0.01" defaultValue="120.00" required /></label>
            <label className="span-2">Customer note<textarea name="customerNote" rows={3} /></label>
            <label className="span-2">Private staff note<textarea name="internalNote" rows={3} /></label>
          </div>
        </section>
        <div className="tl-page-actions"><Link className="tl-button" href="/admin/orders">Cancel</Link><button className="tl-button tl-button-primary" type="submit"><ShoppingCart size={14} />Create order</button></div>
      </form>
    </>
  )
}
