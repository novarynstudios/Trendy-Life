"use server"

import { randomInt } from "node:crypto"
import { Prisma, type OrderStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { parse as parseCsv } from "csv-parse/sync"
import { writeAuditLog } from "@/src/server/audit/service"
import { assertCsrf, requireRecentAuthentication } from "@/src/server/auth/staff"
import { can, PERMISSIONS, type PermissionKey } from "@/src/server/permissions"
import { prisma } from "@/src/server/db/prisma"
import { syncStorefrontProduct } from "@/lib/db"
import { canTransitionOrder, validateInventoryMutation, validateRefund } from "@/src/server/domain/commerce"
import { hashPassword, validatePassword } from "@/src/server/security/password"
import sanitizeHtml from "sanitize-html"

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,4})?$/)
const idListSchema = z.array(z.string().cuid()).min(1).max(100)

async function requireAction(formData: FormData, permission: PermissionKey) {
  const principal = await assertCsrf(formData)
  if (!can(principal.permissions, permission)) {
    await writeAuditLog({ staffId: principal.id, action: "authorization.denied", resourceType: "Permission", resourceId: permission, outcome: "DENIED" })
    throw new Error("You do not have permission to perform this action.")
  }
  return principal
}

async function publishProductToStorefront(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      images: { where: { isFeatured: true }, orderBy: { position: "asc" }, take: 1 },
      inventoryItems: { select: { onHand: true, reserved: true, damaged: true } },
    },
  })
  if (!product) return
  const image = product.images[0]?.url ?? ""
  const status: "active" | "draft" | "archived" = product.status === "ARCHIVED"
    ? "archived"
    : product.status === "PUBLISHED" && product.visibility !== "HIDDEN" && Boolean(image)
      ? "active"
      : "draft"
  syncStorefrontProduct({
    slug: product.slug,
    name: product.name,
    category: product.category?.name ?? "Uncategorized",
    description: product.description ?? product.shortDescription ?? "",
    price: Number(product.salePrice ?? product.regularPrice),
    comparePrice: product.salePrice ? Number(product.regularPrice) : null,
    sku: product.sku ?? product.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 80),
    inventory: product.inventoryItems.reduce((total, item) => total + item.onHand - item.reserved - item.damaged, 0),
    status,
    featured: false,
    badge: null,
    image,
    secondImage: image,
  })
}

async function nextNumber(transaction: Prisma.TransactionClient, prefix: string, model: "order" | "invoice" | "refund" | "shipment" | "ticket") {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trendy-life-${model}-number`}))`
  const count = model === "order" ? await transaction.order.count()
    : model === "invoice" ? await transaction.invoice.count()
      : model === "refund" ? await transaction.refund.count()
        : model === "shipment" ? await transaction.shipment.count()
          : await transaction.supportTicket.count()
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(count + 1).padStart(6, "0")}`
}

async function generateInvoice(transaction: Prisma.TransactionClient, orderId: string) {
  const existing = await transaction.invoice.findFirst({ where: { orderId, status: { not: "VOID" } } })
  if (existing) return existing
  const order = await transaction.order.findUnique({ where: { id: orderId }, include: { items: true, addresses: true } })
  if (!order) throw new Error("Order not found")
  const invoiceNumber = await nextNumber(transaction, "TL-INV", "invoice")
  const billing = order.addresses.find((address) => address.type === "BILLING") ?? order.addresses[0]
  return transaction.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      status: order.paidTotal.greaterThanOrEqualTo(order.total) ? "PAID" : order.paidTotal.greaterThan(0) ? "PARTIALLY_PAID" : "ISSUED",
      billingAddress: billing ? {
        firstName: billing.firstName, lastName: billing.lastName, company: billing.company,
        line1: billing.line1, line2: billing.line2, city: billing.city, district: billing.district,
        postalCode: billing.postalCode, countryCode: billing.countryCode, email: billing.email, phone: billing.phone,
      } : {},
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      shippingTotal: order.shippingTotal,
      total: order.total,
      paidAmount: order.paidTotal,
      dueAmount: Prisma.Decimal.max(order.total.minus(order.paidTotal), 0),
      paidDate: order.paidTotal.greaterThanOrEqualTo(order.total) ? new Date() : null,
      items: {
        create: order.items.map((item) => ({
          orderItemId: item.id,
          description: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discountTotal,
          tax: item.taxTotal,
          total: item.lineTotal,
        })),
      },
    },
  })
}

const productSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220),
  type: z.enum(["SIMPLE", "VARIABLE", "DIGITAL", "BUNDLE", "PREORDER"]),
  sku: z.string().trim().min(2).max(80),
  barcode: z.string().trim().max(80).optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().max(50_000).optional(),
  regularPrice: decimalString,
  salePrice: decimalString.optional(),
  costPrice: decimalString.optional(),
  taxClass: z.string().trim().min(1).max(80),
  weight: decimalString.optional(),
  length: decimalString.optional(),
  width: decimalString.optional(),
  height: decimalString.optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000),
  allowBackorder: z.boolean(),
  imageUrl: z.string().trim().url().or(z.string().startsWith("/")).optional(),
  videoUrl: z.string().trim().url().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  visibility: z.enum(["PUBLIC", "HIDDEN", "CATALOG", "SEARCH"]),
  publishAt: z.string().datetime().optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  searchKeywords: z.string().trim().max(500).optional(),
})

export async function saveAdminProductAction(formData: FormData) {
  const principal = await requireAction(formData, "products.manage")
  const parsed = productSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    sku: String(formData.get("sku") ?? "").toUpperCase(),
    barcode: String(formData.get("barcode") ?? "") || undefined,
    categoryId: String(formData.get("categoryId") ?? "") || undefined,
    brandId: String(formData.get("brandId") ?? "") || undefined,
    shortDescription: String(formData.get("shortDescription") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    regularPrice: formData.get("regularPrice"),
    salePrice: String(formData.get("salePrice") ?? "") || undefined,
    costPrice: String(formData.get("costPrice") ?? "") || undefined,
    taxClass: formData.get("taxClass"),
    weight: String(formData.get("weight") ?? "") || undefined,
    length: String(formData.get("length") ?? "") || undefined,
    width: String(formData.get("width") ?? "") || undefined,
    height: String(formData.get("height") ?? "") || undefined,
    lowStockThreshold: formData.get("lowStockThreshold"),
    allowBackorder: formData.get("allowBackorder") === "on",
    imageUrl: String(formData.get("imageUrl") ?? "") || undefined,
    videoUrl: String(formData.get("videoUrl") ?? "") || undefined,
    status: formData.get("status"),
    visibility: formData.get("visibility"),
    publishAt: String(formData.get("publishAt") ?? "") ? new Date(String(formData.get("publishAt"))).toISOString() : undefined,
    seoTitle: String(formData.get("seoTitle") ?? "") || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "") || undefined,
    searchKeywords: String(formData.get("searchKeywords") ?? "") || undefined,
  })
  if (!parsed.success) redirect(`/admin/products/${String(formData.get("id") ?? "") || "new"}?error=validation`)
  const data = parsed.data
  const previous = data.id ? await prisma.product.findUnique({ where: { id: data.id } }) : null
  const values = {
    name: data.name, slug: data.slug, type: data.type, sku: data.sku, barcode: data.barcode,
    categoryId: data.categoryId, brandId: data.brandId, shortDescription: data.shortDescription,
    description: data.description, regularPrice: new Prisma.Decimal(data.regularPrice),
    salePrice: data.salePrice ? new Prisma.Decimal(data.salePrice) : null,
    costPrice: data.costPrice ? new Prisma.Decimal(data.costPrice) : null,
    taxClass: data.taxClass, weight: data.weight ? new Prisma.Decimal(data.weight) : null,
    length: data.length ? new Prisma.Decimal(data.length) : null, width: data.width ? new Prisma.Decimal(data.width) : null,
    height: data.height ? new Prisma.Decimal(data.height) : null,
    lowStockThreshold: data.lowStockThreshold, allowBackorder: data.allowBackorder,
    videoUrl: data.videoUrl, status: data.status, visibility: data.visibility,
    publishAt: data.publishAt ? new Date(data.publishAt) : null,
    seoTitle: data.seoTitle, seoDescription: data.seoDescription, searchKeywords: data.searchKeywords,
  }
  const product = data.id
    ? await prisma.product.update({ where: { id: data.id }, data: values })
    : await prisma.product.create({ data: values })
  if (data.imageUrl) {
    const featured = await prisma.productImage.findFirst({ where: { productId: product.id, isFeatured: true } })
    if (featured) await prisma.productImage.update({ where: { id: featured.id }, data: { url: data.imageUrl, altText: data.name } })
    else await prisma.productImage.create({ data: { productId: product.id, url: data.imageUrl, altText: data.name, isFeatured: true, position: 0 } })
  }
  await publishProductToStorefront(product.id)
  await writeAuditLog({
    staffId: principal.id,
    action: data.id ? "product.update" : "product.create",
    resourceType: "Product",
    resourceId: product.id,
    previousValues: previous ? { name: previous.name, sku: previous.sku, status: previous.status } : undefined,
    newValues: { name: product.name, sku: product.sku, status: product.status },
  })
  revalidatePath("/admin/products")
  revalidatePath("/")
  revalidatePath("/shop")
  revalidatePath(`/products/${product.slug}`)
  redirect(`/admin/products/${product.id}?saved=1`)
}

export async function saveProductVariantAction(formData: FormData) {
  const principal = await requireAction(formData, "products.manage")
  const input = z.object({
    id: z.string().cuid().optional(), productId: z.string().cuid(), name: z.string().trim().min(1).max(150),
    sku: z.string().trim().min(2).max(80), barcode: z.string().trim().max(80).optional(),
    regularPrice: decimalString, salePrice: decimalString.optional(), costPrice: decimalString.optional(),
    stock: z.coerce.number().int().min(0).max(1_000_000), warehouseId: z.string().cuid(),
    imageUrl: z.string().trim().url().or(z.string().startsWith("/")).optional(), enabled: z.boolean(),
  }).parse({
    id: String(formData.get("id") ?? "") || undefined, productId: formData.get("productId"), name: formData.get("name"),
    sku: String(formData.get("sku") ?? "").toUpperCase(), barcode: String(formData.get("barcode") ?? "") || undefined,
    regularPrice: formData.get("regularPrice"), salePrice: String(formData.get("salePrice") ?? "") || undefined,
    costPrice: String(formData.get("costPrice") ?? "") || undefined, stock: formData.get("stock"),
    warehouseId: formData.get("warehouseId"), imageUrl: String(formData.get("imageUrl") ?? "") || undefined,
    enabled: formData.get("enabled") === "on",
  })
  const variant = await prisma.$transaction(async (transaction) => {
    const values = {
      productId: input.productId, name: input.name, sku: input.sku, barcode: input.barcode,
      regularPrice: new Prisma.Decimal(input.regularPrice), salePrice: input.salePrice ? new Prisma.Decimal(input.salePrice) : null,
      costPrice: input.costPrice ? new Prisma.Decimal(input.costPrice) : null, imageUrl: input.imageUrl, enabled: input.enabled,
    }
    const saved = input.id ? await transaction.productVariant.update({ where: { id: input.id }, data: values }) : await transaction.productVariant.create({ data: values })
    const inventory = await transaction.inventoryItem.findFirst({ where: { warehouseId: input.warehouseId, productId: input.productId, variantId: saved.id } })
    if (!inventory) await transaction.inventoryItem.create({ data: { warehouseId: input.warehouseId, productId: input.productId, variantId: saved.id, onHand: input.stock } })
    else if (inventory.onHand !== input.stock) {
      await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${inventory.id} FOR UPDATE`
      await transaction.inventoryItem.update({ where: { id: inventory.id }, data: { onHand: input.stock, version: { increment: 1 } } })
      await transaction.inventoryMovement.create({ data: { inventoryItemId: inventory.id, warehouseId: inventory.warehouseId, type: "CORRECTION", quantity: input.stock - inventory.onHand, balanceAfter: input.stock, reason: "Variant form stock correction", staffId: principal.id } })
    }
    return saved
  })
  await publishProductToStorefront(input.productId)
  await writeAuditLog({ staffId: principal.id, action: input.id ? "product.variant.update" : "product.variant.create", resourceType: "ProductVariant", resourceId: variant.id, newValues: { productId: input.productId, sku: input.sku } })
  revalidatePath(`/admin/products/${input.productId}`)
  revalidatePath("/")
  revalidatePath("/shop")
  redirect(`/admin/products/${input.productId}?tab=variants&saved=variant`)
}

const customerSchema = z.object({
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional(),
  customerGroup: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(128),
})

export async function createCustomerAction(formData: FormData) {
  const principal = await requireAction(formData, "customers.create")
  const input = customerSchema.safeParse({
    email: formData.get("email"), firstName: formData.get("firstName"), lastName: formData.get("lastName"),
    phone: String(formData.get("phone") ?? "") || undefined, customerGroup: formData.get("customerGroup"), password: formData.get("password"),
  })
  if (!input.success) redirect("/admin/customers/new?error=validation")
  const policy = validatePassword(input.data.password, [input.data.firstName, input.data.lastName, input.data.email])
  if (!policy.valid) redirect("/admin/customers/new?error=password-policy")
  const count = await prisma.user.count()
  const user = await prisma.user.create({
    data: {
      email: input.data.email.toLocaleLowerCase(),
      passwordHash: await hashPassword(input.data.password),
      status: "ACTIVE",
      forcePasswordReset: true,
      profile: {
        create: {
          customerNumber: `TL-CUS-${String(count + 1).padStart(6, "0")}`,
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          phone: input.data.phone,
          customerGroup: input.data.customerGroup,
        },
      },
    },
  })
  await writeAuditLog({ staffId: principal.id, action: "customer.create", resourceType: "User", resourceId: user.id, newValues: { email: user.email } })
  revalidatePath("/admin/customers")
  redirect(`/admin/customers/${user.id}?created=1`)
}

export async function updateCustomerAction(formData: FormData) {
  const principal = await requireAction(formData, "customers.edit")
  const input = z.object({
    userId: z.string().cuid(), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(40).optional(), company: z.string().trim().max(150).optional(),
    customerGroup: z.string().trim().min(1).max(80), marketingConsent: z.boolean(),
  }).parse({
    userId: formData.get("userId"), firstName: formData.get("firstName"), lastName: formData.get("lastName"),
    phone: String(formData.get("phone") ?? "") || undefined, company: String(formData.get("company") ?? "") || undefined,
    customerGroup: formData.get("customerGroup"), marketingConsent: formData.get("marketingConsent") === "on",
  })
  const previous = await prisma.customerProfile.findUnique({ where: { userId: input.userId } })
  await prisma.customerProfile.update({ where: { userId: input.userId }, data: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, company: input.company, customerGroup: input.customerGroup, marketingConsent: input.marketingConsent } })
  await writeAuditLog({ staffId: principal.id, action: "customer.update", resourceType: "User", resourceId: input.userId, previousValues: previous ? { firstName: previous.firstName, lastName: previous.lastName, phone: previous.phone, customerGroup: previous.customerGroup } : undefined, newValues: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, customerGroup: input.customerGroup } })
  revalidatePath(`/admin/customers/${input.userId}`)
  redirect(`/admin/customers/${input.userId}?saved=profile`)
}

export async function changeCustomerStatusAction(formData: FormData) {
  const principal = await requireAction(formData, "customers.edit")
  const userId = z.string().cuid().parse(formData.get("userId"))
  const status = z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).parse(formData.get("status"))
  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } })
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    ...(status !== "ACTIVE" ? [prisma.customerSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: `Account ${status.toLocaleLowerCase()} by staff` } })] : []),
  ])
  await writeAuditLog({ staffId: principal.id, action: `customer.${status.toLocaleLowerCase()}`, resourceType: "User", resourceId: userId, previousValues: { status: previous?.status }, newValues: { status } })
  revalidatePath(`/admin/customers/${userId}`)
  redirect(`/admin/customers/${userId}?saved=status`)
}

export async function adjustStoreCreditAction(formData: FormData) {
  const principal = await requireAction(formData, "customers.edit")
  const input = z.object({ userId: z.string().cuid(), amount: z.string().trim().regex(/^-?\d+(\.\d{1,4})?$/).refine((value) => Number(value) !== 0), reason: z.string().trim().min(4).max(500) }).parse({ userId: formData.get("userId"), amount: formData.get("amount"), reason: formData.get("reason") })
  const profile = await prisma.customerProfile.findUnique({ where: { userId: input.userId } })
  if (!profile) throw new Error("Customer not found")
  const next = profile.storeCredit.plus(input.amount)
  if (next.lessThan(0)) throw new Error("Store credit cannot become negative")
  await prisma.customerProfile.update({ where: { userId: input.userId }, data: { storeCredit: next } })
  await writeAuditLog({ staffId: principal.id, action: "customer.store_credit.adjust", resourceType: "User", resourceId: input.userId, previousValues: { storeCredit: profile.storeCredit.toString() }, newValues: { storeCredit: next.toString(), adjustment: input.amount, reason: input.reason } })
  revalidatePath(`/admin/customers/${input.userId}`)
  redirect(`/admin/customers/${input.userId}?saved=store-credit`)
}

export async function queuePasswordResetAction(formData: FormData) {
  const principal = await requireAction(formData, "customers.edit")
  const userId = z.string().cuid().parse(formData.get("userId"))
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("Customer not found")
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { forcePasswordReset: true } }),
    prisma.backgroundJob.create({ data: { queue: "email", name: "customer-password-reset", status: "WAITING", payload: { userId, recipient: user.email } } }),
  ])
  await writeAuditLog({ staffId: principal.id, action: "customer.password_reset.queue", resourceType: "User", resourceId: userId })
  revalidatePath(`/admin/customers/${userId}`)
  redirect(`/admin/customers/${userId}?saved=password-reset`)
}

export async function createManualOrderAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.create")
  const selections = formData.getAll("catalogItem").map(String)
  const quantities = formData.getAll("quantity").map(String)
  const rawItems = selections.map((selection, index) => ({
    selection,
    quantity: quantities[index] ?? "0",
  })).filter((item) => item.selection)
  const input = z.object({
    userId: z.string().cuid(),
    assignedStaffId: z.string().cuid().optional(),
    status: z.enum(["DRAFT", "PENDING_PAYMENT"]),
    shippingTotal: decimalString,
    discountTotal: decimalString,
    customerNote: z.string().trim().max(2_000).optional(),
    internalNote: z.string().trim().max(2_000).optional(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(5).max(40),
    line1: z.string().trim().min(3).max(240),
    line2: z.string().trim().max(240).optional(),
    city: z.string().trim().min(2).max(120),
    district: z.string().trim().max(120).optional(),
    postalCode: z.string().trim().max(30).optional(),
    items: z.array(z.object({
      selection: z.string().regex(/^c[a-z0-9]{20,}(:c[a-z0-9]{20,})?$/),
      quantity: z.coerce.number().int().min(1).max(1_000),
    })).min(1).max(20),
  }).parse({
    userId: formData.get("userId"),
    assignedStaffId: String(formData.get("assignedStaffId") ?? "") || undefined,
    status: formData.get("status"),
    shippingTotal: formData.get("shippingTotal"),
    discountTotal: formData.get("discountTotal"),
    customerNote: String(formData.get("customerNote") ?? "") || undefined,
    internalNote: String(formData.get("internalNote") ?? "") || undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: String(formData.get("line2") ?? "") || undefined,
    city: formData.get("city"),
    district: String(formData.get("district") ?? "") || undefined,
    postalCode: String(formData.get("postalCode") ?? "") || undefined,
    items: rawItems,
  })
  if (new Set(input.items.map((item) => item.selection)).size !== input.items.length) {
    throw new Error("Each product or variation may only be selected once.")
  }

  const order = await prisma.$transaction(async (transaction) => {
    const customer = await transaction.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true } })
    if (!customer || customer.status !== "ACTIVE") throw new Error("Select an active customer.")
    const itemRecords = []
    let subtotal = new Prisma.Decimal(0)

    for (const item of input.items) {
      const [productId, variantId] = item.selection.split(":")
      const product = await transaction.product.findFirst({
        where: { id: productId, deletedAt: null, status: { not: "ARCHIVED" } },
        include: { variants: variantId ? { where: { id: variantId, enabled: true } } : false },
      })
      if (!product) throw new Error("A selected product is unavailable.")
      const variant = variantId && Array.isArray(product.variants) ? product.variants[0] : null
      if (variantId && !variant) throw new Error(`${product.name}: selected variation is unavailable.`)
      const unitPrice = variant?.salePrice ?? variant?.regularPrice ?? product.salePrice ?? product.regularPrice
      const lineTotal = unitPrice.mul(item.quantity)
      subtotal = subtotal.plus(lineTotal)
      itemRecords.push({
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        sku: variant?.sku ?? product.sku ?? `PRODUCT-${product.id.slice(-8)}`,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      })

      if (input.status !== "DRAFT") {
        const inventory = await transaction.inventoryItem.findFirst({
          where: { productId: product.id, variantId: variant?.id ?? null },
          orderBy: { createdAt: "asc" },
        })
        if (!inventory) throw new Error(`${product.name}: no inventory record exists.`)
        await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${inventory.id} FOR UPDATE`
        const fresh = await transaction.inventoryItem.findUniqueOrThrow({ where: { id: inventory.id } })
        const available = fresh.onHand - fresh.reserved - fresh.damaged
        if (!product.allowBackorder && available < item.quantity) {
          throw new Error(`${product.name}: only ${Math.max(available, 0)} units are available.`)
        }
        await transaction.inventoryItem.update({
          where: { id: fresh.id },
          data: { reserved: { increment: item.quantity }, version: { increment: 1 } },
        })
        await transaction.inventoryMovement.create({
          data: {
            inventoryItemId: fresh.id,
            warehouseId: fresh.warehouseId,
            type: "RESERVATION",
            quantity: -item.quantity,
            balanceAfter: fresh.onHand,
            reason: "Reserved for manual order",
            staffId: principal.id,
          },
        })
      }
    }

    const discount = new Prisma.Decimal(input.discountTotal)
    const shipping = new Prisma.Decimal(input.shippingTotal)
    if (discount.greaterThan(subtotal)) throw new Error("Discount cannot exceed the order subtotal.")
    const total = subtotal.minus(discount).plus(shipping)
    const orderNumber = await nextNumber(transaction, "TL", "order")
    return transaction.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        assignedStaffId: input.assignedStaffId ?? principal.id,
        status: input.status,
        paymentStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        salesChannel: "admin",
        subtotal,
        discountTotal: discount,
        taxTotal: new Prisma.Decimal(0),
        shippingTotal: shipping,
        total,
        customerNote: input.customerNote,
        internalNote: input.internalNote,
        placedAt: input.status === "DRAFT" ? null : new Date(),
        items: { create: itemRecords },
        addresses: {
          create: [
            { type: "BILLING", firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, line1: input.line1, line2: input.line2, city: input.city, district: input.district, postalCode: input.postalCode },
            { type: "SHIPPING", firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, line1: input.line1, line2: input.line2, city: input.city, district: input.district, postalCode: input.postalCode },
          ],
        },
        statusHistory: { create: { toStatus: input.status, reason: "Manual order created", staffId: principal.id } },
      },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  await writeAuditLog({
    staffId: principal.id,
    action: "order.create",
    resourceType: "Order",
    resourceId: order.id,
    newValues: { orderNumber: order.orderNumber, total: order.total.toString(), channel: "admin" },
  })
  revalidatePath("/admin/orders")
  redirect(`/admin/orders/${order.id}?created=1`)
}

export async function bulkOrderAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const ids = idListSchema.safeParse(formData.getAll("ids"))
  const action = String(formData.get("bulkAction") ?? "")
  if (!ids.success) throw new Error("Select between one and 100 orders")
  const statusActions: Record<string, OrderStatus> = {
    confirm: "CONFIRMED", processing: "PROCESSING", hold: "ON_HOLD", cancel: "CANCELLED",
  }
  if (statusActions[action]) {
    const orders = await prisma.order.findMany({ where: { id: { in: ids.data } }, select: { id: true, status: true } })
    const invalid = orders.find((order) => !canTransitionOrder(order.status, statusActions[action]))
    if (invalid) throw new Error(`Order ${invalid.id} cannot transition from ${invalid.status} to ${statusActions[action]}`)
    await prisma.$transaction(async (transaction) => {
      for (const order of orders) {
        await transaction.order.update({ where: { id: order.id }, data: { status: statusActions[action] } })
        await transaction.orderStatusHistory.create({ data: { orderId: order.id, staffId: principal.id, fromStatus: order.status, toStatus: statusActions[action], reason: "Bulk administrative update" } })
      }
    })
  } else if (action === "invoice") {
    await prisma.$transaction(async (transaction) => {
      for (const id of ids.data) await generateInvoice(transaction, id)
    })
  } else {
    throw new Error("Unsupported bulk action")
  }
  await writeAuditLog({ staffId: principal.id, action: `order.bulk.${action}`, resourceType: "Order", newValues: { ids: ids.data } })
  revalidatePath("/admin/orders")
}

export async function updateOrderStatusAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const id = z.string().cuid().parse(formData.get("id"))
  const toStatus = z.enum(["DRAFT", "PENDING_PAYMENT", "PAYMENT_FAILED", "PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED", "ON_HOLD", "FRAUD_REVIEW"]).parse(formData.get("status"))
  const reason = z.string().trim().max(500).parse(String(formData.get("reason") ?? "Administrative update"))
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) throw new Error("Order not found")
  if (!canTransitionOrder(order.status, toStatus)) throw new Error(`Cannot transition ${order.status} to ${toStatus}`)
  await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { status: toStatus, cancelledAt: toStatus === "CANCELLED" ? new Date() : order.cancelledAt } }),
    prisma.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus, staffId: principal.id, reason } }),
  ])
  await writeAuditLog({ staffId: principal.id, action: "order.status.update", resourceType: "Order", resourceId: id, previousValues: { status: order.status }, newValues: { status: toStatus, reason } })
  revalidatePath(`/admin/orders/${id}`)
  redirect(`/admin/orders/${id}?saved=status`)
}

export async function addOrderNoteAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const id = z.string().cuid().parse(formData.get("id"))
  const body = z.string().trim().min(2).max(5000).parse(formData.get("body"))
  await prisma.orderNote.create({ data: { orderId: id, staffId: principal.id, body, isPrivate: true } })
  await writeAuditLog({ staffId: principal.id, action: "order.note.create", resourceType: "Order", resourceId: id })
  revalidatePath(`/admin/orders/${id}`)
  redirect(`/admin/orders/${id}?saved=note`)
}

export async function generateInvoiceAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const orderId = z.string().cuid().parse(formData.get("orderId"))
  const invoice = await prisma.$transaction((transaction) => generateInvoice(transaction, orderId))
  await writeAuditLog({ staffId: principal.id, action: "invoice.generate", resourceType: "Invoice", resourceId: invoice.id, newValues: { orderId } })
  revalidatePath(`/admin/orders/${orderId}`)
  redirect(`/admin/invoices/${invoice.id}`)
}

export async function assignOrderStaffAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const orderId = z.string().cuid().parse(formData.get("orderId"))
  const staffId = z.string().cuid().nullable().parse(String(formData.get("staffId") ?? "") || null)
  const previous = await prisma.order.findUnique({ where: { id: orderId }, select: { assignedStaffId: true } })
  await prisma.order.update({ where: { id: orderId }, data: { assignedStaffId: staffId } })
  await writeAuditLog({ staffId: principal.id, action: "order.assign", resourceType: "Order", resourceId: orderId, previousValues: { assignedStaffId: previous?.assignedStaffId }, newValues: { assignedStaffId: staffId } })
  revalidatePath(`/admin/orders/${orderId}`)
}

export async function duplicateOrderAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.create")
  const sourceId = z.string().cuid().parse(formData.get("orderId"))
  const duplicate = await prisma.$transaction(async (transaction) => {
    const source = await transaction.order.findUnique({ where: { id: sourceId }, include: { items: true, addresses: true } })
    if (!source) throw new Error("Order not found")
    const orderNumber = await nextNumber(transaction, "TL", "order")
    return transaction.order.create({
      data: {
        orderNumber, userId: source.userId, assignedStaffId: principal.id, status: "DRAFT",
        paymentStatus: "PENDING", fulfillmentStatus: "UNFULFILLED", salesChannel: "admin",
        currency: source.currency, subtotal: source.subtotal, discountTotal: source.discountTotal,
        taxTotal: source.taxTotal, shippingTotal: source.shippingTotal, total: source.total,
        internalNote: `Duplicated from ${source.orderNumber}`,
        items: { create: source.items.map((item) => ({ productId: item.productId, variantId: item.variantId, name: item.name, sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, discountTotal: item.discountTotal, taxTotal: item.taxTotal, lineTotal: item.lineTotal, metadata: item.metadata ?? undefined })) },
        addresses: { create: source.addresses.map((address) => ({ type: address.type, firstName: address.firstName, lastName: address.lastName, company: address.company, email: address.email, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, district: address.district, postalCode: address.postalCode, countryCode: address.countryCode })) },
      },
    })
  })
  await writeAuditLog({ staffId: principal.id, action: "order.duplicate", resourceType: "Order", resourceId: duplicate.id, newValues: { sourceId } })
  redirect(`/admin/orders/${duplicate.id}?created=duplicate`)
}

export async function createShipmentAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const input = z.object({
    orderId: z.string().cuid(),
    courier: z.string().trim().min(2).max(80),
    trackingNumber: z.string().trim().min(2).max(150),
    trackingUrl: z.string().trim().url().optional(),
  }).parse({
    orderId: formData.get("orderId"),
    courier: formData.get("courier"),
    trackingNumber: formData.get("trackingNumber"),
    trackingUrl: String(formData.get("trackingUrl") ?? "") || undefined,
  })
  const shipment = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({ where: { id: input.orderId }, include: { items: true } })
    if (!order) throw new Error("Order not found")
    const unfulfilled = order.items.map((item) => ({ item, quantity: item.quantity - item.fulfilledQty })).filter((entry) => entry.quantity > 0)
    if (!unfulfilled.length) throw new Error("Order is already fully fulfilled")
    const shipmentNumber = await nextNumber(transaction, "TL-SHP", "shipment")
    const created = await transaction.shipment.create({
      data: {
        orderId: order.id, shipmentNumber, status: "SHIPPED", courier: input.courier,
        trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl, shippedAt: new Date(),
        items: { create: unfulfilled.map(({ item, quantity }) => ({ orderItemId: item.id, quantity })) },
      },
    })
    for (const { item, quantity } of unfulfilled) await transaction.orderItem.update({ where: { id: item.id }, data: { fulfilledQty: { increment: quantity } } })
    await transaction.order.update({ where: { id: order.id }, data: { status: "SHIPPED", fulfillmentStatus: "FULFILLED" } })
    await transaction.orderStatusHistory.create({ data: { orderId: order.id, staffId: principal.id, fromStatus: order.status, toStatus: "SHIPPED", reason: `Shipment ${shipmentNumber} created` } })
    return created
  })
  await writeAuditLog({ staffId: principal.id, action: "shipment.create", resourceType: "Shipment", resourceId: shipment.id, newValues: { orderId: input.orderId, courier: input.courier, trackingNumber: input.trackingNumber } })
  revalidatePath(`/admin/orders/${input.orderId}`)
  redirect(`/admin/orders/${input.orderId}?saved=shipment`)
}

export async function enqueueOrderCommunicationAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.edit")
  const orderId = z.string().cuid().parse(formData.get("orderId"))
  const template = z.enum(["order-confirmation", "invoice", "shipment", "payment-receipt"]).parse(formData.get("template"))
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, user: { select: { email: true } } } })
  if (!order?.user?.email) throw new Error("Order does not have a customer email address")
  const job = await prisma.backgroundJob.create({ data: { queue: "email", name: "send-order-email", status: "WAITING", payload: { orderId, template, recipient: order.user.email } } })
  await writeAuditLog({ staffId: principal.id, action: "order.email.queue", resourceType: "Order", resourceId: orderId, newValues: { template, jobId: job.id } })
  revalidatePath(`/admin/orders/${orderId}`)
  redirect(`/admin/orders/${orderId}?saved=email`)
}

export async function recordManualPaymentAction(formData: FormData) {
  const principal = await requireAction(formData, "payments.capture")
  const input = z.object({
    orderId: z.string().cuid(),
    amount: decimalString,
    method: z.string().trim().min(2).max(80),
    reference: z.string().trim().min(2).max(120),
  }).parse({
    orderId: formData.get("orderId"), amount: formData.get("amount"), method: formData.get("method"), reference: formData.get("reference"),
  })
  const payment = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({ where: { id: input.orderId }, include: { items: true } })
    if (!order) throw new Error("Order not found")
    const amount = new Prisma.Decimal(input.amount)
    if (amount.lessThanOrEqualTo(0) || amount.greaterThan(order.total.minus(order.paidTotal))) throw new Error("Payment exceeds amount due")
    const transactionId = `TL-TXN-${Date.now()}-${randomInt(1000, 9999)}`
    const created = await transaction.payment.create({
      data: {
        orderId: order.id, gateway: "manual", method: input.method, amount, status: "SUCCESSFUL",
        gatewayReference: input.reference, capturedAt: new Date(), idempotencyKey: `manual:${input.reference}`,
        transactions: { create: { transactionId, type: "OFFLINE", amount, status: "SUCCESSFUL", processedAt: new Date() } },
      },
    })
    const paidTotal = order.paidTotal.plus(amount)
    await transaction.order.update({ where: { id: order.id }, data: { paidTotal, paymentStatus: paidTotal.greaterThanOrEqualTo(order.total) ? "SUCCESSFUL" : "PROCESSING", status: paidTotal.greaterThanOrEqualTo(order.total) && ["DRAFT", "PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) ? "PAID" : order.status } })
    for (const item of order.items) {
      const inventory = await transaction.inventoryItem.findFirst({ where: { productId: item.productId ?? undefined, variantId: item.variantId } })
      if (!inventory) continue
      await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${inventory.id} FOR UPDATE`
      const product = item.productId ? await transaction.product.findUnique({ where: { id: item.productId }, select: { allowBackorder: true } }) : null
      const validation = validateInventoryMutation(inventory.onHand, -item.quantity, product?.allowBackorder ?? false)
      if (!validation.valid) throw new Error(`${item.name}: ${validation.reason}`)
      await transaction.inventoryItem.update({ where: { id: inventory.id }, data: { onHand: validation.next, reserved: Math.max(0, inventory.reserved - item.quantity), version: { increment: 1 } } })
      await transaction.inventoryMovement.create({ data: { inventoryItemId: inventory.id, warehouseId: inventory.warehouseId, type: "SALE", quantity: -item.quantity, balanceAfter: validation.next, referenceType: "Order", referenceId: order.id, reason: "Inventory captured with payment", staffId: principal.id } })
    }
    return created
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await writeAuditLog({ staffId: principal.id, action: "payment.manual.record", resourceType: "Payment", resourceId: payment.id, newValues: { orderId: input.orderId, amount: input.amount, reference: input.reference } })
  revalidatePath(`/admin/orders/${input.orderId}`)
  redirect(`/admin/orders/${input.orderId}?saved=payment`)
}

export async function processRefundAction(formData: FormData) {
  const principal = await requireRecentAuthentication()
  if (!can(principal.permissions, "payments.refund")) throw new Error("Refund permission required")
  await assertCsrf(formData)
  const input = z.object({ orderId: z.string().cuid(), amount: decimalString, reason: z.string().trim().min(4).max(500), restock: z.boolean() }).parse({
    orderId: formData.get("orderId"), amount: formData.get("amount"), reason: formData.get("reason"), restock: formData.get("restock") === "on",
  })
  const refund = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({ where: { id: input.orderId }, include: { items: true, payments: { where: { status: { in: ["SUCCESSFUL", "PARTIALLY_REFUNDED"] } }, orderBy: { capturedAt: "desc" } } } })
    if (!order || !order.payments[0]) throw new Error("No captured payment is available")
    const amount = new Prisma.Decimal(input.amount)
    const validation = validateRefund(BigInt(amount.mul(100).toFixed(0)), BigInt(order.paidTotal.mul(100).toFixed(0)), BigInt(order.refundedTotal.mul(100).toFixed(0)))
    if (!validation.valid) throw new Error(validation.reason)
    const refundNumber = await nextNumber(transaction, "TL-REF", "refund")
    const newRefunded = order.refundedTotal.plus(amount)
    const full = newRefunded.greaterThanOrEqualTo(order.paidTotal)
    const created = await transaction.refund.create({
      data: { orderId: order.id, paymentId: order.payments[0].id, refundNumber, amount, status: "SUCCEEDED", reason: input.reason, restock: input.restock, requestedById: principal.id, processedAt: new Date() },
    })
    await transaction.order.update({ where: { id: order.id }, data: { refundedTotal: newRefunded, paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED", status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } })
    await transaction.payment.update({ where: { id: order.payments[0].id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } })
    await transaction.paymentTransaction.create({ data: { transactionId: `TL-RFTXN-${Date.now()}-${randomInt(1000, 9999)}`, paymentId: order.payments[0].id, type: "REFUND", amount, status: "REFUNDED", processedAt: new Date() } })
    if (input.restock && full) {
      for (const item of order.items) {
        const inventory = await transaction.inventoryItem.findFirst({ where: { productId: item.productId ?? undefined, variantId: item.variantId } })
        if (!inventory) continue
        await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${inventory.id} FOR UPDATE`
        const balance = inventory.onHand + item.quantity
        await transaction.inventoryItem.update({ where: { id: inventory.id }, data: { onHand: balance, returned: { increment: item.quantity }, version: { increment: 1 } } })
        await transaction.inventoryMovement.create({ data: { inventoryItemId: inventory.id, warehouseId: inventory.warehouseId, type: "REFUND_RESTOCK", quantity: item.quantity, balanceAfter: balance, referenceType: "Refund", referenceId: created.id, reason: input.reason, staffId: principal.id } })
      }
    }
    return created
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await writeAuditLog({ staffId: principal.id, action: "payment.refund", resourceType: "Refund", resourceId: refund.id, newValues: { orderId: input.orderId, amount: input.amount, restock: input.restock } })
  revalidatePath(`/admin/orders/${input.orderId}`)
  redirect(`/admin/orders/${input.orderId}?saved=refund`)
}

export async function adjustInventoryAction(formData: FormData) {
  const principal = await requireAction(formData, "inventory.adjust")
  const input = z.object({ inventoryItemId: z.string().cuid(), delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0), reason: z.string().trim().min(4).max(500) }).parse({
    inventoryItemId: formData.get("inventoryItemId"), delta: formData.get("delta"), reason: formData.get("reason"),
  })
  const movement = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${input.inventoryItemId} FOR UPDATE`
    const item = await transaction.inventoryItem.findUnique({ where: { id: input.inventoryItemId }, include: { product: { select: { allowBackorder: true } } } })
    if (!item) throw new Error("Inventory item not found")
    const validation = validateInventoryMutation(item.onHand, input.delta, item.product.allowBackorder)
    if (!validation.valid) throw new Error(validation.reason)
    await transaction.inventoryItem.update({ where: { id: item.id }, data: { onHand: validation.next, version: { increment: 1 } } })
    return transaction.inventoryMovement.create({ data: { inventoryItemId: item.id, warehouseId: item.warehouseId, type: "ADJUSTMENT", quantity: input.delta, balanceAfter: validation.next, reason: input.reason, staffId: principal.id } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  const adjustedItem = await prisma.inventoryItem.findUnique({ where: { id: input.inventoryItemId }, select: { productId: true } })
  if (adjustedItem?.productId) await publishProductToStorefront(adjustedItem.productId)
  await writeAuditLog({ staffId: principal.id, action: "inventory.adjust", resourceType: "InventoryItem", resourceId: input.inventoryItemId, newValues: { delta: input.delta, reason: input.reason, movementId: movement.id } })
  revalidatePath("/admin/inventory")
  revalidatePath("/")
  revalidatePath("/shop")
  redirect("/admin/inventory?saved=adjustment")
}

export async function createSupportTicketAction(formData: FormData) {
  const principal = await requireAction(formData, "support.manage")
  const input = z.object({ userId: z.string().cuid().optional(), departmentId: z.string().cuid(), subject: z.string().trim().min(3).max(200), message: z.string().trim().min(10).max(20_000), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]) }).parse({
    userId: String(formData.get("userId") ?? "") || undefined, departmentId: formData.get("departmentId"), subject: formData.get("subject"), message: formData.get("message"), priority: formData.get("priority"),
  })
  const ticket = await prisma.$transaction(async (transaction) => {
    const number = await nextNumber(transaction, "TL-TKT", "ticket")
    return transaction.supportTicket.create({
      data: {
        ticketNumber: number, userId: input.userId, departmentId: input.departmentId, subject: input.subject,
        priority: input.priority, status: "STAFF_REPLIED", assignedStaffId: principal.id, lastResponseAt: new Date(),
        messages: { create: { authorType: "STAFF", staffId: principal.id, authorName: principal.name, body: input.message } },
      },
    })
  })
  await writeAuditLog({ staffId: principal.id, action: "support.ticket.create", resourceType: "SupportTicket", resourceId: ticket.id })
  revalidatePath("/admin/tickets")
  redirect(`/admin/tickets/${ticket.id}`)
}

export async function replySupportTicketAction(formData: FormData) {
  const principal = await requireAction(formData, "support.reply")
  const input = z.object({ ticketId: z.string().cuid(), body: z.string().trim().min(2).max(20_000), status: z.enum(["OPEN", "STAFF_REPLIED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]), internal: z.boolean() }).parse({
    ticketId: formData.get("ticketId"), body: formData.get("body"), status: formData.get("status"), internal: formData.get("internal") === "on",
  })
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: input.ticketId, authorType: "STAFF", staffId: principal.id, authorName: principal.name, body: input.body, isInternal: input.internal } }),
    prisma.supportTicket.update({ where: { id: input.ticketId }, data: { status: input.status, assignedStaffId: principal.id, lastResponseAt: new Date(), closedAt: input.status === "CLOSED" ? new Date() : null } }),
  ])
  await writeAuditLog({ staffId: principal.id, action: input.internal ? "support.note.create" : "support.reply", resourceType: "SupportTicket", resourceId: input.ticketId, newValues: { status: input.status } })
  revalidatePath(`/admin/tickets/${input.ticketId}`)
  redirect(`/admin/tickets/${input.ticketId}?saved=reply`)
}

export async function saveCouponAction(formData: FormData) {
  const principal = await requireAction(formData, "marketing.manage")
  const input = z.object({
    id: z.string().cuid().optional(), code: z.string().trim().min(3).max(40), type: z.enum(["FIXED","PERCENTAGE","FREE_SHIPPING","BUY_ONE_GET_ONE"]),
    amount: decimalString, minimumOrderAmount: decimalString.optional(), maximumDiscount: decimalString.optional(),
    startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(),
    usageLimit: z.coerce.number().int().positive().optional(), perCustomerLimit: z.coerce.number().int().positive().optional(),
    stackable: z.boolean(), active: z.boolean(),
  }).parse({
    id: String(formData.get("id") ?? "") || undefined, code: String(formData.get("code") ?? "").toUpperCase(), type: formData.get("type"),
    amount: formData.get("amount"), minimumOrderAmount: String(formData.get("minimumOrderAmount") ?? "") || undefined,
    maximumDiscount: String(formData.get("maximumDiscount") ?? "") || undefined,
    startsAt: String(formData.get("startsAt") ?? "") ? new Date(String(formData.get("startsAt"))).toISOString() : undefined,
    endsAt: String(formData.get("endsAt") ?? "") ? new Date(String(formData.get("endsAt"))).toISOString() : undefined,
    usageLimit: String(formData.get("usageLimit") ?? "") || undefined, perCustomerLimit: String(formData.get("perCustomerLimit") ?? "") || undefined,
    stackable: formData.get("stackable") === "on", active: formData.get("active") === "on",
  })
  const values = {
    code: input.code, type: input.type, amount: new Prisma.Decimal(input.amount),
    minimumOrderAmount: input.minimumOrderAmount ? new Prisma.Decimal(input.minimumOrderAmount) : null,
    maximumDiscount: input.maximumDiscount ? new Prisma.Decimal(input.maximumDiscount) : null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null,
    usageLimit: input.usageLimit, perCustomerLimit: input.perCustomerLimit, stackable: input.stackable, active: input.active,
  }
  const coupon = input.id ? await prisma.coupon.update({ where: { id: input.id }, data: values }) : await prisma.coupon.create({ data: values })
  await writeAuditLog({ staffId: principal.id, action: input.id ? "coupon.update" : "coupon.create", resourceType: "Coupon", resourceId: coupon.id, newValues: { code: coupon.code, type: coupon.type, active: coupon.active } })
  revalidatePath("/admin/marketing")
  redirect("/admin/marketing?saved=coupon")
}

export async function moderateReviewAction(formData: FormData) {
  const principal = await requireAction(formData, "marketing.manage")
  const reviewId = z.string().cuid().parse(formData.get("reviewId"))
  const status = z.enum(["APPROVED", "REJECTED", "SPAM"]).parse(formData.get("status"))
  const featured = formData.get("featured") === "on"
  const staffResponse = z.string().trim().max(5000).parse(String(formData.get("staffResponse") ?? ""))
  const previous = await prisma.review.findUnique({ where: { id: reviewId } })
  await prisma.review.update({ where: { id: reviewId }, data: { status, featured, staffResponse: staffResponse || null } })
  await writeAuditLog({ staffId: principal.id, action: "review.moderate", resourceType: "Review", resourceId: reviewId, previousValues: { status: previous?.status }, newValues: { status, featured } })
  revalidatePath("/admin/reviews")
}

export async function saveStoreSettingsAction(formData: FormData) {
  const principal = await requireAction(formData, "settings.manage")
  const namespace = z.string().trim().regex(/^[a-z][a-z0-9-]{1,40}$/).parse(formData.get("namespace"))
  const permittedKeys = ["storeName","legalName","supportEmail","supportPhone","currency","timezone","taxInclusive","orderPrefix","invoicePrefix","lowStockThreshold","maintenanceMode","require2fa","sessionIdleMinutes","sessionAbsoluteHours","allowGuestCheckout","returnWindowDays"]
  const values: Record<string, string | boolean> = Object.fromEntries(permittedKeys.filter((key) => formData.has(key)).map((key) => [key, formData.get(key) === "on" ? true : String(formData.get(key) ?? "")]))
  if (namespace === "security") values.require2fa = formData.get("require2fa") === "on"
  if (namespace === "maintenance") values.maintenanceMode = formData.get("maintenanceMode") === "on"
  if (namespace === "tax") values.taxInclusive = formData.get("taxInclusive") === "on"
  await prisma.$transaction(Object.entries(values).map(([key, value]) => prisma.storeSetting.upsert({ where: { namespace_key: { namespace, key } }, create: { namespace, key, value, updatedById: principal.id }, update: { value, updatedById: principal.id } })))
  await writeAuditLog({ staffId: principal.id, action: "settings.update", resourceType: "StoreSetting", resourceId: namespace, newValues: values })
  revalidatePath("/admin/settings")
  redirect(`/admin/settings?section=${namespace}&saved=1`)
}

export async function saveContentPageAction(formData: FormData) {
  const principal = await requireAction(formData, "content.manage")
  const input = z.object({ id: z.string().cuid().optional(), title: z.string().trim().min(2).max(200), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), body: z.string().trim().min(1).max(100_000), status: z.enum(["DRAFT","SCHEDULED","PUBLISHED","ARCHIVED"]), publishAt: z.string().datetime().optional(), seoTitle: z.string().trim().max(70).optional(), seoDescription: z.string().trim().max(170).optional() }).parse({
    id: String(formData.get("id") ?? "") || undefined, title: formData.get("title"), slug: formData.get("slug"),
    body: formData.get("body"), status: formData.get("status"),
    publishAt: String(formData.get("publishAt") ?? "") ? new Date(String(formData.get("publishAt"))).toISOString() : undefined,
    seoTitle: String(formData.get("seoTitle") ?? "") || undefined, seoDescription: String(formData.get("seoDescription") ?? "") || undefined,
  })
  const sanitized = sanitizeHtml(input.body, { allowedTags: ["p","h2","h3","h4","ul","ol","li","strong","em","a","blockquote","br"], allowedAttributes: { a: ["href","title"] }, allowedSchemes: ["http","https","mailto"] })
  const values = { title: input.title, slug: input.slug, body: { format: "sanitized-html", value: sanitized }, status: input.status, publishAt: input.publishAt ? new Date(input.publishAt) : null, seoTitle: input.seoTitle, seoDescription: input.seoDescription }
  const page = input.id ? await prisma.page.update({ where: { id: input.id }, data: values }) : await prisma.page.create({ data: values })
  await writeAuditLog({ staffId: principal.id, action: input.id ? "content.page.update" : "content.page.create", resourceType: "Page", resourceId: page.id, newValues: { title: page.title, slug: page.slug, status: page.status } })
  revalidatePath("/admin/content")
  redirect("/admin/content?saved=page")
}

export async function queueTestEmailAction(formData: FormData) {
  const principal = await requireAction(formData, "content.manage")
  const templateId = z.string().cuid().parse(formData.get("templateId"))
  const recipient = z.string().email().parse(formData.get("recipient"))
  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } })
  if (!template) throw new Error("Email template not found")
  const job = await prisma.backgroundJob.create({ data: { queue: "email", name: "send-template-test", status: "WAITING", payload: { templateId, recipient, test: true } } })
  await writeAuditLog({ staffId: principal.id, action: "email.template.test", resourceType: "EmailTemplate", resourceId: templateId, newValues: { recipient, jobId: job.id } })
  revalidatePath("/admin/communications")
}

export async function retryBackgroundJobAction(formData: FormData) {
  const principal = await requireAction(formData, "jobs.manage")
  const jobId = z.string().cuid().parse(formData.get("jobId"))
  const job = await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "WAITING", runAt: new Date(), lastError: null } })
  await writeAuditLog({ staffId: principal.id, action: "job.retry", resourceType: "BackgroundJob", resourceId: jobId, newValues: { queue: job.queue, name: job.name } })
  revalidatePath("/admin/jobs")
}

export async function createStaffAction(formData: FormData) {
  const principal = await requireRecentAuthentication()
  await assertCsrf(formData)
  if (!can(principal.permissions, "staff.manage")) throw new Error("Staff management permission required")
  const input = z.object({ name: z.string().trim().min(2).max(150), email: z.string().trim().email().max(254), roleId: z.string().cuid(), password: z.string().min(12).max(128), requireTwoFactor: z.boolean() }).parse({
    name: formData.get("name"), email: formData.get("email"), roleId: formData.get("roleId"), password: formData.get("password"), requireTwoFactor: formData.get("requireTwoFactor") === "on",
  })
  const policy = validatePassword(input.password, [input.name, input.email])
  if (!policy.valid) redirect("/admin/staff/new?error=password-policy")
  const staff = await prisma.staff.create({ data: { name: input.name, email: input.email.toLocaleLowerCase(), roleId: input.roleId, passwordHash: await hashPassword(input.password), forcePasswordReset: true, requireTwoFactor: input.requireTwoFactor, status: "ACTIVE" } })
  await writeAuditLog({ staffId: principal.id, action: "staff.create", resourceType: "Staff", resourceId: staff.id, newValues: { name: staff.name, email: staff.email, roleId: staff.roleId, requireTwoFactor: staff.requireTwoFactor } })
  redirect(`/admin/staff/${staff.id}?created=1`)
}

export async function changeStaffStatusAction(formData: FormData) {
  const principal = await requireRecentAuthentication()
  await assertCsrf(formData)
  if (!can(principal.permissions, "staff.manage")) throw new Error("Staff management permission required")
  const staffId = z.string().cuid().parse(formData.get("staffId"))
  const status = z.enum(["ACTIVE", "DISABLED"]).parse(formData.get("status"))
  if (staffId === principal.id && status === "DISABLED") throw new Error("You cannot disable your own account")
  const previous = await prisma.staff.findUnique({ where: { id: staffId }, select: { status: true } })
  await prisma.$transaction([
    prisma.staff.update({ where: { id: staffId }, data: { status } }),
    ...(status === "DISABLED" ? [prisma.staffSession.updateMany({ where: { staffId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "Staff account disabled" } })] : []),
  ])
  await writeAuditLog({ staffId: principal.id, action: `staff.${status.toLocaleLowerCase()}`, resourceType: "Staff", resourceId: staffId, previousValues: { status: previous?.status }, newValues: { status } })
  revalidatePath(`/admin/staff/${staffId}`)
}

export async function updateStaffAccessAction(formData: FormData) {
  const principal = await requireRecentAuthentication()
  await assertCsrf(formData)
  if (!can(principal.permissions, "staff.manage")) throw new Error("Staff management permission required")
  const input = z.object({
    staffId: z.string().cuid(),
    roleId: z.string().cuid(),
    grants: z.string().max(5_000),
    denials: z.string().max(5_000),
    requireTwoFactor: z.boolean(),
  }).parse({
    staffId: formData.get("staffId"),
    roleId: formData.get("roleId"),
    grants: String(formData.get("grants") ?? ""),
    denials: String(formData.get("denials") ?? ""),
    requireTwoFactor: formData.get("requireTwoFactor") === "on",
  })
  const parseKeys = (value: string) => value.split(/[\s,]+/).map((key) => key.trim()).filter(Boolean)
  const grants = [...new Set(parseKeys(input.grants))]
  const denials = [...new Set(parseKeys(input.denials))]
  if (grants.some((key) => !PERMISSIONS.includes(key as PermissionKey)) || denials.some((key) => !PERMISSIONS.includes(key as PermissionKey))) throw new Error("One or more permission keys are invalid.")
  if (grants.some((key) => denials.includes(key))) throw new Error("A permission cannot be both granted and denied.")
  const role = await prisma.staffRole.findUnique({ where: { id: input.roleId } })
  const member = await prisma.staff.findUnique({ where: { id: input.staffId } })
  if (!role || !member) throw new Error("Staff account or role not found.")
  if (input.staffId === principal.id && (input.roleId !== member.roleId || denials.includes("staff.manage"))) throw new Error("You cannot reduce your own staff-management access.")
  const permissionRows = await prisma.permission.findMany({ where: { key: { in: [...grants, ...denials] } } })
  const permissionByKey = new Map(permissionRows.map((permission) => [permission.key, permission.id]))
  await prisma.$transaction([
    prisma.staff.update({ where: { id: input.staffId }, data: { roleId: input.roleId, requireTwoFactor: input.requireTwoFactor } }),
    prisma.staffPermission.deleteMany({ where: { staffId: input.staffId } }),
    ...(permissionRows.length ? [prisma.staffPermission.createMany({
      data: [
        ...grants.map((key) => ({ staffId: input.staffId, permissionId: permissionByKey.get(key)!, allowed: true })),
        ...denials.map((key) => ({ staffId: input.staffId, permissionId: permissionByKey.get(key)!, allowed: false })),
      ],
    })] : []),
    prisma.staffSession.updateMany({ where: { staffId: input.staffId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "Permissions changed" } }),
  ])
  await writeAuditLog({
    staffId: principal.id,
    action: "staff.permissions.update",
    resourceType: "Staff",
    resourceId: input.staffId,
    previousValues: { roleId: member.roleId },
    newValues: { roleId: role.id, grants, denials, requireTwoFactor: input.requireTwoFactor },
  })
  revalidatePath(`/admin/staff/${input.staffId}`)
  redirect(`/admin/staff/${input.staffId}?saved=access`)
}

export async function updateReturnStatusAction(formData: FormData) {
  const principal = await requireAction(formData, "orders.refund")
  const input = z.object({
    id: z.string().cuid(),
    status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "AWAITING_ITEM", "ITEM_RECEIVED", "INSPECTION", "REFUND_APPROVED", "REFUNDED", "REPLACEMENT_SHIPPED", "CLOSED"]),
    staffComments: z.string().trim().max(2_000).optional(),
    refundAmount: decimalString.optional(),
  }).parse({
    id: formData.get("id"),
    status: formData.get("status"),
    staffComments: String(formData.get("staffComments") ?? "") || undefined,
    refundAmount: String(formData.get("refundAmount") ?? "") || undefined,
  })
  const previous = await prisma.returnRequest.findUnique({ where: { id: input.id } })
  if (!previous) throw new Error("Return request not found.")
  await prisma.returnRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      staffComments: input.staffComments,
      refundAmount: input.refundAmount ? new Prisma.Decimal(input.refundAmount) : previous.refundAmount,
      receivedAt: input.status === "ITEM_RECEIVED" && !previous.receivedAt ? new Date() : previous.receivedAt,
      closedAt: input.status === "CLOSED" ? new Date() : null,
    },
  })
  await writeAuditLog({
    staffId: principal.id,
    action: "return.status.update",
    resourceType: "ReturnRequest",
    resourceId: input.id,
    previousValues: { status: previous.status },
    newValues: { status: input.status, refundAmount: input.refundAmount },
  })
  revalidatePath(`/admin/returns/${input.id}`)
  redirect(`/admin/returns/${input.id}?saved=1`)
}

export async function saveCategoryAction(formData: FormData) {
  const principal = await requireAction(formData, "products.manage")
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    parentId: z.string().cuid().optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    visible: z.boolean(),
  }).parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    parentId: String(formData.get("parentId") ?? "") || undefined,
    status: formData.get("status"),
    visible: formData.get("visible") === "on",
  })
  const category = await prisma.category.create({ data: input })
  await writeAuditLog({ staffId: principal.id, action: "category.create", resourceType: "Category", resourceId: category.id, newValues: input })
  revalidatePath("/admin/products/categories")
  redirect("/admin/products/categories?saved=category")
}

export async function saveBrandAction(formData: FormData) {
  const principal = await requireAction(formData, "products.manage")
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  }).parse({ name: formData.get("name"), slug: formData.get("slug"), status: formData.get("status") })
  const brand = await prisma.brand.create({ data: input })
  await writeAuditLog({ staffId: principal.id, action: "brand.create", resourceType: "Brand", resourceId: brand.id, newValues: input })
  revalidatePath("/admin/products/categories")
  redirect("/admin/products/categories?saved=brand")
}

export async function saveShippingZoneAction(formData: FormData) {
  const principal = await requireAction(formData, "settings.manage")
  const split = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 100)
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    countries: z.array(z.string().max(2)).min(1),
    regions: z.array(z.string().max(120)),
    postcodes: z.array(z.string().max(30)),
    priority: z.coerce.number().int().min(0).max(10_000),
  }).parse({
    name: formData.get("name"),
    countries: split(formData.get("countries")).map((value) => value.toUpperCase()),
    regions: split(formData.get("regions")),
    postcodes: split(formData.get("postcodes")),
    priority: formData.get("priority"),
  })
  const zone = await prisma.shippingZone.create({ data: input })
  await writeAuditLog({ staffId: principal.id, action: "shipping.zone.create", resourceType: "ShippingZone", resourceId: zone.id, newValues: input })
  revalidatePath("/admin/fulfillment/zones")
  redirect("/admin/fulfillment/zones?saved=1")
}

export async function saveShippingMethodAction(formData: FormData) {
  const principal = await requireAction(formData, "settings.manage")
  const input = z.object({
    zoneId: z.string().cuid(),
    name: z.string().trim().min(2).max(120),
    type: z.enum(["FLAT_RATE", "WEIGHT_BASED", "ORDER_VALUE", "FREE_SHIPPING"]),
    amount: decimalString,
    minimum: decimalString.optional(),
  }).parse({
    zoneId: formData.get("zoneId"),
    name: formData.get("name"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    minimum: String(formData.get("minimum") ?? "") || undefined,
  })
  const method = await prisma.shippingMethod.create({
    data: {
      zoneId: input.zoneId,
      name: input.name,
      type: input.type,
      configuration: { amount: input.amount, minimum: input.minimum, currency: "BDT" },
    },
  })
  await writeAuditLog({ staffId: principal.id, action: "shipping.method.create", resourceType: "ShippingMethod", resourceId: method.id, newValues: input })
  revalidatePath("/admin/fulfillment/methods")
  redirect("/admin/fulfillment/methods?saved=1")
}

export async function saveSupportDepartmentAction(formData: FormData) {
  const principal = await requireAction(formData, "support.manage")
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().optional(),
    slaMinutes: z.coerce.number().int().min(15).max(43_200),
  }).parse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "") || undefined,
    slaMinutes: formData.get("slaMinutes"),
  })
  const department = await prisma.supportDepartment.create({ data: input })
  await writeAuditLog({ staffId: principal.id, action: "support.department.create", resourceType: "SupportDepartment", resourceId: department.id, newValues: input })
  revalidatePath("/admin/tickets/departments")
  redirect("/admin/tickets/departments?saved=1")
}

export async function saveCannedResponseAction(formData: FormData) {
  const principal = await requireAction(formData, "support.manage")
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    body: z.string().trim().min(5).max(10_000),
  }).parse({ name: formData.get("name"), body: formData.get("body") })
  const key = input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100)
  const setting = await prisma.storeSetting.upsert({
    where: { namespace_key: { namespace: "support.canned", key } },
    update: { value: { name: input.name, body: input.body }, updatedById: principal.id },
    create: { namespace: "support.canned", key, value: { name: input.name, body: input.body }, updatedById: principal.id },
  })
  await writeAuditLog({ staffId: principal.id, action: "support.canned_response.save", resourceType: "StoreSetting", resourceId: setting.id, newValues: { name: input.name } })
  revalidatePath("/admin/tickets/canned-responses")
  redirect("/admin/tickets/canned-responses?saved=1")
}

export async function saveHomepageConfigurationAction(formData: FormData) {
  const principal = await requireAction(formData, "content.manage")
  const input = z.object({
    announcement: z.string().trim().max(240),
    heroTitle: z.string().trim().min(2).max(120),
    heroSubtitle: z.string().trim().max(240),
    featuredCollection: z.string().trim().max(120),
    enabled: z.boolean(),
  }).parse({
    announcement: formData.get("announcement"),
    heroTitle: formData.get("heroTitle"),
    heroSubtitle: formData.get("heroSubtitle"),
    featuredCollection: formData.get("featuredCollection"),
    enabled: formData.get("enabled") === "on",
  })
  const setting = await prisma.storeSetting.upsert({
    where: { namespace_key: { namespace: "content", key: "homepage" } },
    update: { value: input, updatedById: principal.id },
    create: { namespace: "content", key: "homepage", value: input, updatedById: principal.id },
  })
  await writeAuditLog({ staffId: principal.id, action: "content.homepage.update", resourceType: "StoreSetting", resourceId: setting.id, newValues: input })
  revalidatePath("/admin/content/homepage")
  redirect("/admin/content/homepage?saved=1")
}

async function readCsvUpload(formData: FormData) {
  const upload = formData.get("file")
  if (!(upload instanceof File)) throw new Error("Select a CSV file.")
  if (upload.size <= 0 || upload.size > 2 * 1024 * 1024) throw new Error("CSV files must be between 1 byte and 2 MB.")
  if (!upload.name.toLocaleLowerCase().endsWith(".csv")) throw new Error("Only .csv files are accepted.")
  if (upload.type && !["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(upload.type)) throw new Error("The uploaded file does not have an accepted CSV MIME type.")
  const content = await upload.text()
  if (content.includes("\0")) throw new Error("The CSV contains invalid binary data.")
  return parseCsv(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
  }) as Record<string, string>[]
}

export async function importProductsCsvAction(formData: FormData) {
  const principal = await requireAction(formData, "products.import")
  const rows = await readCsvUpload(formData)
  if (!rows.length || rows.length > 2_000) throw new Error("Product imports must contain between 1 and 2,000 rows.")
  const schema = z.object({
    sku: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(200),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    regularPrice: decimalString,
    salePrice: decimalString.optional(),
    costPrice: decimalString.optional(),
    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    type: z.enum(["SIMPLE", "VARIABLE", "DIGITAL", "BUNDLE", "PREORDER"]).default("SIMPLE"),
  })
  const parsed = rows.map((row, index) => {
    const result = schema.safeParse({
      ...row,
      sku: row.sku?.toUpperCase(),
      salePrice: row.salePrice || undefined,
      costPrice: row.costPrice || undefined,
      status: row.status || "DRAFT",
      type: row.type || "SIMPLE",
    })
    if (!result.success) throw new Error(`Row ${index + 2}: ${result.error.issues[0]?.message ?? "invalid product"}`)
    return result.data
  })
  await prisma.$transaction(parsed.map((row) => prisma.product.upsert({
    where: { sku: row.sku },
    update: {
      name: row.name,
      slug: row.slug,
      regularPrice: new Prisma.Decimal(row.regularPrice),
      salePrice: row.salePrice ? new Prisma.Decimal(row.salePrice) : null,
      costPrice: row.costPrice ? new Prisma.Decimal(row.costPrice) : null,
      status: row.status,
      type: row.type,
    },
    create: {
      sku: row.sku,
      name: row.name,
      slug: row.slug,
      regularPrice: new Prisma.Decimal(row.regularPrice),
      salePrice: row.salePrice ? new Prisma.Decimal(row.salePrice) : null,
      costPrice: row.costPrice ? new Prisma.Decimal(row.costPrice) : null,
      status: row.status,
      type: row.type,
    },
  })))
  await writeAuditLog({ staffId: principal.id, action: "product.csv.import", resourceType: "Product", newValues: { rowCount: parsed.length, fileName: uploadName(formData) } })
  revalidatePath("/admin/products")
  redirect(`/admin/products/import?imported=${parsed.length}`)
}

function uploadName(formData: FormData) {
  const upload = formData.get("file")
  return upload instanceof File ? upload.name.slice(0, 240) : "unknown.csv"
}

export async function importInventoryCsvAction(formData: FormData) {
  const principal = await requireAction(formData, "inventory.adjust")
  const rows = await readCsvUpload(formData)
  if (!rows.length || rows.length > 5_000) throw new Error("Inventory imports must contain between 1 and 5,000 rows.")
  const schema = z.object({
    sku: z.string().trim().min(2).max(80),
    warehouseCode: z.string().trim().min(2).max(40),
    onHand: z.coerce.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(4).max(500),
  })
  const parsed = rows.map((row, index) => {
    const result = schema.safeParse({ ...row, sku: row.sku?.toUpperCase(), warehouseCode: row.warehouseCode?.toUpperCase() })
    if (!result.success) throw new Error(`Row ${index + 2}: ${result.error.issues[0]?.message ?? "invalid inventory"}`)
    return result.data
  })
  await prisma.$transaction(async (transaction) => {
    for (const row of parsed) {
      const variant = await transaction.productVariant.findUnique({ where: { sku: row.sku }, include: { product: true } })
      const product = variant?.product ?? await transaction.product.findUnique({ where: { sku: row.sku } })
      const warehouse = await transaction.warehouse.findUnique({ where: { code: row.warehouseCode } })
      if (!product) throw new Error(`SKU ${row.sku} was not found.`)
      if (!warehouse) throw new Error(`Warehouse ${row.warehouseCode} was not found.`)
      const existing = await transaction.inventoryItem.findFirst({ where: { warehouseId: warehouse.id, productId: product.id, variantId: variant?.id ?? null } })
      if (!existing) {
        const created = await transaction.inventoryItem.create({ data: { warehouseId: warehouse.id, productId: product.id, variantId: variant?.id, onHand: row.onHand } })
        await transaction.inventoryMovement.create({ data: { inventoryItemId: created.id, warehouseId: warehouse.id, type: "RECEIPT", quantity: row.onHand, balanceAfter: row.onHand, reason: row.reason, staffId: principal.id } })
      } else {
        await transaction.$executeRaw`SELECT id FROM "InventoryItem" WHERE id = ${existing.id} FOR UPDATE`
        const fresh = await transaction.inventoryItem.findUniqueOrThrow({ where: { id: existing.id } })
        const delta = row.onHand - fresh.onHand
        if (!delta) continue
        await transaction.inventoryItem.update({ where: { id: fresh.id }, data: { onHand: row.onHand, version: { increment: 1 } } })
        await transaction.inventoryMovement.create({ data: { inventoryItemId: fresh.id, warehouseId: warehouse.id, type: "CORRECTION", quantity: delta, balanceAfter: row.onHand, reason: row.reason, staffId: principal.id } })
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await writeAuditLog({ staffId: principal.id, action: "inventory.csv.import", resourceType: "InventoryItem", newValues: { rowCount: parsed.length, fileName: uploadName(formData) } })
  revalidatePath("/admin/inventory")
  redirect(`/admin/inventory/import?imported=${parsed.length}`)
}
